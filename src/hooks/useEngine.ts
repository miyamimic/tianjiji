import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  EmotionVector,
  EmotionKey,
  BackgroundThread,
  TriggeredAnchor,
  ChatMessage,
  IntentAnalysis,
  Character,
  DynamicMemory,
} from '../data/types';
import { EMOTION_KEYS, EMOTION_NAMES } from '../data/types';
import { MOCK_CHARACTERS, getCharacterById, getSavedCharacters } from '../data/characters';
import {
  processChat,
  createSessionState,
  switchCharacterState,
  resetEmotionState,
  clearHistoryState,
  type SessionState,
} from '../engine';
import { 
  decayEmotionTowardsBaseline, 
  addEmotion,
  applyIntensityCalibration,
  processMultiTurnInertia,
} from '../engine/emotion';
import { 
  callLlm, 
  callLlmWithGuardrail,
  buildSystemPrompt, 
  assemblePipelineLlmMessages,
  parseStructuredLlmResponse,
  parseStructuredLlmResponses, 
  isLlmConfigured, 
  loadLlmConfig,
  cleanRawLlmOutput,
  type LlmConfig 
} from '../lib/llm';
import { parseSegments } from '../engine/postprocess';
import { 
  checkSensitiveWords, 
  loadUserPromptProfile, 
  loadCharVisualDesc, 
  loadUserVisualDesc,
  loadEmotionDecayRate,
  loadCharMinBubbles,
  loadDynamicMemories,
  saveDynamicMemory,
  findRelevantDynamicMemories,
  clearDynamicMemories,
  loadHistoryInjectionCount,
  loadPromptLayers,
} from '../lib/customStore';
import { 
  setPendingGameInvite, 
  canCharacterSendInvite,
  recordCharacterInviteSent,
  isGameDebugShortcutEnabled,
  recordGameMilestone,
  saveMatchRecord,
  type GameInvitation,
  type GomokuMatchRecord 
} from '../lib/gameStore';
import { 
  getCharacterStickers, 
  aiStealUserSticker, 
  isStickerStolenByAi, 
  type Sticker 
} from '../lib/stickerStore';
import { outboxQueue, type OutboxTaskResult } from '../lib/outboxQueue';
import { backgroundKeepAlive } from '../lib/backgroundKeepAlive';


const STORAGE_PREFIX = '__rp_engine_char_state_';
const ACTIVE_CHAR_KEY = '__rp_engine_active_char_id';
const LEGACY_STORAGE_KEY = '__rp_engine_state';

type SavedState = {
  characterId: string;
  emotion: EmotionVector;
  backgroundThreads: BackgroundThread[];
  triggeredAnchors: TriggeredAnchor[];
  messages: ChatMessage[];
};

function getStorageKeyForChar(characterId: string): string {
  return `${STORAGE_PREFIX}${characterId}`;
}

function loadSavedStateForChar(characterId: string): SavedState | null {
  try {
    const raw = localStorage.getItem(getStorageKeyForChar(characterId));
    if (raw) {
      const parsed = JSON.parse(raw) as SavedState;
      if (parsed.characterId && parsed.emotion) return parsed;
    }
    // Fallback: check legacy storage if character matches
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as SavedState;
      if (legacy && legacy.characterId === characterId) {
        return legacy;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function captureSnapshot(s: SessionState) {
  return {
    emotion: { ...s.emotion },
    backgroundThreads: s.backgroundThreads.map((t) => ({ ...t })),
    triggeredAnchors: s.triggeredAnchors.map((a) => ({
      ...a,
      anchor: { ...a.anchor },
    })),
  };
}

function saveState(s: SessionState) {
  try {
    const data: SavedState = {
      characterId: s.characterId,
      emotion: s.emotion,
      backgroundThreads: s.backgroundThreads,
      triggeredAnchors: s.triggeredAnchors,
      messages: s.messages,
    };
    localStorage.setItem(getStorageKeyForChar(s.characterId), JSON.stringify(data));
    localStorage.setItem(ACTIVE_CHAR_KEY, s.characterId);
  } catch {
    // non-fatal
  }
}

export function useEngine() {
  const [, forceUpdate] = useState(0);
  const rerender = useCallback(() => forceUpdate((n) => n + 1), []);

  const saved = useRef<SavedState | null>(null);
  if (!saved.current) {
    const savedActiveCharId = typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_CHAR_KEY) : null;
    const initialCharId = savedActiveCharId || MOCK_CHARACTERS[0].character_id;
    saved.current = loadSavedStateForChar(initialCharId);
  }

  const initCharacter = saved.current?.characterId
    ? getCharacterById(saved.current.characterId) ?? MOCK_CHARACTERS[0]
    : (typeof window !== 'undefined' && localStorage.getItem(ACTIVE_CHAR_KEY)
        ? getCharacterById(localStorage.getItem(ACTIVE_CHAR_KEY)!) ?? MOCK_CHARACTERS[0]
        : MOCK_CHARACTERS[0]);

  const stateRef = useRef<SessionState>({
    sessionId: '',
    characterId: initCharacter.character_id,
    characterName: initCharacter.name,
    emotion: saved.current?.emotion ?? { ...initCharacter.emotion.baseline },
    backgroundThreads: saved.current?.backgroundThreads ?? initCharacter.background_threads.active.map((t) => ({ ...t })),
    triggeredAnchors: saved.current?.triggeredAnchors ?? [],
    messages: saved.current?.messages ?? [],
  });

  const previousEmotionRef = useRef<EmotionVector | null>(null);
  const emotionConfirmedRef = useRef(true);
  const lastIntentRef = useRef<IntentAnalysis | null>(null);
  const lastFallbackRef = useRef(false);
  const readyRef = useRef(false);
  const emotionHistoryRef = useRef<EmotionVector[]>([]);
  const isEngineBusyRef = useRef(false);

  useEffect(() => {
    readyRef.current = true;
    rerender();

    // Listen for outbox tasks completed in background or across tab switches
    const unsub = outboxQueue.onCompleted((task) => {
      const s = stateRef.current;
      if (task.payload.characterId === s.characterId && task.result) {
        // If replies not already in messages, sync them
        const newMsgIds = new Set(task.result.newReplies.map((r) => r.id));
        const hasAny = s.messages.some((m) => newMsgIds.has(m.id));
        if (!hasAny && task.result.newReplies.length > 0) {
          s.emotion = { ...task.result.updatedEmotion };
          s.backgroundThreads = task.result.updatedThreads.map((t) => ({
            content: t.content,
            remaining_turns: t.remaining_turns ?? 3,
          }));
          s.messages = [...s.messages, ...task.result.newReplies];
          saveState(s);
          rerender();
        }
      }
    });

    return () => unsub();
  }, [rerender]);

  const persist = useCallback((s: SessionState) => {
    saveState(s);
  }, []);

  const sendMessage = useCallback(
    async (userInput: string, llmConfig?: LlmConfig) => {
      if (isEngineBusyRef.current) {
        console.warn('Engine busy processing previous message, skipping duplicate send.');
        return;
      }
      isEngineBusyRef.current = true;

      try {
        const s = stateRef.current;
        const character = getCharacterById(s.characterId) ?? MOCK_CHARACTERS[0];

        previousEmotionRef.current = { ...s.emotion };
        emotionConfirmedRef.current = true;

        // 1. Natural Emotional Calming / Decay Curve (随轮数与时间自然平复趋向基准线)
        const decayRate = loadEmotionDecayRate();
        s.emotion = decayEmotionTowardsBaseline(s.emotion, character.emotion.baseline, decayRate);

        // 2. Pre-process input through NLP Intent Analysis & AI Sensitive Interception
        const sensitive = checkSensitiveWords(userInput);
        let processedInput = userInput;

        if (sensitive.matched) {
          if (sensitive.blocked) {
            // Block message sending! Output a warning bubble and abort processing.
            const ts = Date.now();
            const blockedWords = sensitive.matchedInterceptions.map((i) => i.word);
            const warningMsg: ChatMessage = {
              id: `sys-warning-${ts}`,
              role: 'character',
              content: `🛡️【AI敏感防御拦截】您的消息包含针对AI角色的敏感违规词（如："${blockedWords.join('、') || sensitive.matchedWords.join('、')}"），已触发前置安全防御拦截，此条消息已拒绝发送。`,
              segments: [{ type: 'thought', text: '前置安全防御拦截成功' }],
              timestamp: ts,
              character_id: character.character_id,
            };
            s.messages = [...s.messages, warningMsg];
            persist(s);
            rerender();
            return;
          } else if (sensitive.censoredText !== userInput) {
            processedInput = sensitive.censoredText;
          }

          // Apply severe emotional shifts from NLP Intent Analysis if mapped
          if (sensitive.triggeredEmotion) {
            const { key, delta } = sensitive.triggeredEmotion;
            s.emotion[key] = Math.max(0, Math.min(1, s.emotion[key] + delta));
          }
        }

        const userMsg: ChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content: processedInput,
          segments: [{ type: 'speech', text: processedInput }],
          timestamp: Date.now(),
          snapshot: captureSnapshot(s),
        };
        s.messages = [...s.messages, userMsg];
        rerender();

        await new Promise((r) => setTimeout(r, 200 + Math.random() * 150));

        const result = processChat(
          { ...s, emotion: { ...s.emotion }, backgroundThreads: s.backgroundThreads.map((t) => ({ ...t })) },
          character,
          processedInput,
        );

        s.backgroundThreads = result.backgroundThreads;
        s.triggeredAnchors = result.triggeredAnchors;
        lastIntentRef.current = result.intent;

        let reply: ChatMessage;

        if (llmConfig && isLlmConfigured(llmConfig)) {
          try {
            const emotionSummary = Object.entries(s.emotion)
              .map(([k, v]) => `${k}: ${Math.round(v * 100)}%`)
              .join(', ');
            
            const pipelineLayers = loadPromptLayers();
            const llmMessages = assemblePipelineLlmMessages(pipelineLayers, {
              character,
              emotionSummary,
              backgroundThreads: s.backgroundThreads.map((t) => t.content),
              chatHistory: s.messages,
            });

            const rawText = await callLlm(llmConfig, llmMessages);
            const structuredList = parseStructuredLlmResponses(rawText);
            const now = Date.now();
            const replies: ChatMessage[] = [];

            structuredList.forEach((structured, idx) => {
              if (structured.emotion_delta && Object.keys(structured.emotion_delta).length > 0) {
                s.emotion = addEmotion(s.emotion, structured.emotion_delta);
              } else if (idx === 0) {
                s.emotion = result.emotion;
              }

              if (structured.triggered_memory) {
                s.backgroundThreads.push({
                  content: structured.triggered_memory,
                  remaining_turns: 3,
                });
              }

              replies.push({
                id: `char-${now}-${idx}`,
                role: 'character',
                content: structured.reply,
                segments: parseSegments(structured.reply),
                timestamp: now + idx * 10,
                character_id: character.character_id,
                snapshot: captureSnapshot(s),
              });
            });

            // Prevent duplicate message pushes
            const existingIds = new Set(s.messages.map((m) => m.id));
            const nonDupReplies = replies.filter((r) => !existingIds.has(r.id));
            if (nonDupReplies.length > 0) {
              s.messages = [...s.messages, ...nonDupReplies];
            }
            lastFallbackRef.current = false;
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.warn('LLM call error, using local engine fallback:', errMsg);
            s.emotion = result.emotion;
            reply = {
              ...result.reply,
              id: `char-fallback-${Date.now()}`,
              snapshot: captureSnapshot(s),
              llmError: errMsg,
            };
            s.messages = [...s.messages, reply];
            lastFallbackRef.current = true;
          }
        } else {
          s.emotion = result.emotion;
          reply = {
            ...result.reply,
            snapshot: captureSnapshot(s),
          };
          s.messages = [...s.messages, reply];
          lastFallbackRef.current = true;
        }

        persist(s);
        rerender();
      } finally {
        isEngineBusyRef.current = false;
      }
    },
    [persist, rerender],
  );

  const switchCharacter = useCallback(
    (characterId: string) => {
      const s = stateRef.current;
      if (s.characterId === characterId) return;

      // 1. Persist current character's conversation state
      saveState(s);

      // 2. Locate target character
      const newChar = getCharacterById(characterId);
      if (!newChar) return;

      // 3. Load target character's saved state or initialize clean session state
      const savedForNewChar = loadSavedStateForChar(characterId);
      const newState: SessionState = savedForNewChar
        ? {
            sessionId: `sess_${newChar.character_id}`,
            characterId: newChar.character_id,
            characterName: newChar.name,
            emotion: savedForNewChar.emotion ?? { ...newChar.emotion.baseline },
            backgroundThreads: savedForNewChar.backgroundThreads ?? newChar.background_threads.active.map((t) => ({ ...t })),
            triggeredAnchors: savedForNewChar.triggeredAnchors ?? [],
            messages: savedForNewChar.messages ?? [],
          }
        : {
            sessionId: `sess_${newChar.character_id}_${Date.now()}`,
            characterId: newChar.character_id,
            characterName: newChar.name,
            emotion: { ...newChar.emotion.baseline },
            backgroundThreads: newChar.background_threads.active.map((t) => ({ ...t })),
            triggeredAnchors: [],
            messages: [],
          };

      stateRef.current = newState;
      previousEmotionRef.current = null;
      emotionConfirmedRef.current = true;
      lastIntentRef.current = null;
      persist(newState);
      rerender();
    },
    [persist, rerender],
  );

  const clearHistory = useCallback(() => {
    const s = stateRef.current;
    const newState = clearHistoryState(s);
    stateRef.current = newState;
    previousEmotionRef.current = null;
    emotionConfirmedRef.current = true;
    persist(newState);
    rerender();
  }, [persist, rerender]);

  const resetEmotion = useCallback(() => {
    const s = stateRef.current;
    const character = getCharacterById(s.characterId) ?? MOCK_CHARACTERS[0];
    const newState = resetEmotionState(s, character);
    stateRef.current = newState;
    previousEmotionRef.current = null;
    emotionConfirmedRef.current = true;
    persist(newState);
    rerender();
  }, [persist, rerender]);

  const confirmEmotion = useCallback(() => {
    emotionConfirmedRef.current = true;
    rerender();
  }, [rerender]);

  const rollbackToMessage = useCallback((messageId: string) => {
    const s = stateRef.current;
    const msgIndex = s.messages.findIndex((m) => m.id === messageId);
    if (msgIndex === -1) return;

    const targetMsg = s.messages[msgIndex];
    s.messages = s.messages.slice(0, msgIndex + 1);

    if (targetMsg.snapshot) {
      s.emotion = { ...targetMsg.snapshot.emotion };
      s.backgroundThreads = targetMsg.snapshot.backgroundThreads.map((t) => ({ ...t }));
      s.triggeredAnchors = targetMsg.snapshot.triggeredAnchors.map((a) => ({ ...a }));
    }

    previousEmotionRef.current = null;
    emotionConfirmedRef.current = true;
    lastIntentRef.current = null;

    persist(s);
    rerender();
  }, [persist, rerender]);

  const editMessage = useCallback((messageId: string, newContent: string) => {
    const s = stateRef.current;
    const msg = s.messages.find((m) => m.id === messageId);
    if (!msg) return;

    msg.content = newContent;
    msg.segments = parseSegments(newContent);

    persist(s);
    rerender();
  }, [persist, rerender]);

  const addUserMessageOnly = useCallback((content: string, afterMessageId?: string) => {
    const s = stateRef.current;
    const character = getCharacterById(s.characterId) ?? MOCK_CHARACTERS[0];
    
    if (afterMessageId) {
      const msgIndex = s.messages.findIndex((m) => m.id === afterMessageId);
      if (msgIndex !== -1) {
        const targetMsg = s.messages[msgIndex];
        s.messages = s.messages.slice(0, msgIndex + 1);
        if (targetMsg.snapshot) {
          s.emotion = { ...targetMsg.snapshot.emotion };
          s.backgroundThreads = targetMsg.snapshot.backgroundThreads.map((t) => ({ ...t }));
          s.triggeredAnchors = targetMsg.snapshot.triggeredAnchors.map((a) => ({ ...a }));
        }
      }
    }

    // Pre-process input through NLP Intent Analysis & AI Sensitive Interception
    const sensitive = checkSensitiveWords(content);
    let processedInput = content;

    if (sensitive.matched) {
      if (sensitive.blocked) {
        const ts = Date.now();
        const blockedWords = sensitive.matchedInterceptions.map((i) => i.word);
        const warningMsg: ChatMessage = {
          id: `sys-warning-${ts}`,
          role: 'character',
          content: `🛡️【AI敏感防御拦截】您的消息包含针对AI角色的敏感违规词（如："${blockedWords.join('、') || sensitive.matchedWords.join('、')}"），已触发前置安全防御拦截，此条消息已拒绝发送。`,
          segments: [{ type: 'thought', text: '前置安全防御拦截成功' }],
          timestamp: ts,
          character_id: character.character_id,
        };
        s.messages = [...s.messages, warningMsg];
        persist(s);
        rerender();
        return;
      } else if (sensitive.censoredText !== content) {
        processedInput = sensitive.censoredText;
      }

      if (sensitive.triggeredEmotion) {
        const { key, delta } = sensitive.triggeredEmotion;
        s.emotion[key] = Math.max(0, Math.min(1, s.emotion[key] + delta));
      }
    }

    const newUserMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: processedInput,
      segments: [{ type: 'speech', text: processedInput }],
      timestamp: Date.now(),
      snapshot: captureSnapshot(s),
    };

    s.messages = [...s.messages, newUserMsg];
    persist(s);
    rerender();
  }, [persist, rerender]);

  const sendUserSticker = useCallback((sticker: Sticker, accompanyingText?: string) => {
    const s = stateRef.current;
    const character = getCharacterById(s.characterId) ?? MOCK_CHARACTERS[0];
    const text = accompanyingText?.trim() || `[表情包: ${sticker.name}]`;

    const newUserMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      segments: [{ type: 'speech', text }],
      sticker: {
        id: sticker.id,
        name: sticker.name,
        url: sticker.url,
        category: sticker.category,
        ownerType: 'user',
        isStolen: sticker.isStolen,
        stolenMeta: sticker.stolenMeta,
      },
      timestamp: Date.now(),
      snapshot: captureSnapshot(s),
    };

    s.messages = [...s.messages, newUserMsg];
    persist(s);
    rerender();

    // AI Stealing Chance:
    // If AI character doesn't have this sticker yet, 60% chance they steal it!
    // Captures exact snapshot of timestamp, user's accompanying words, and current AI emotion!
    if (!isStickerStolenByAi(character.character_id, sticker.url)) {
      if (Math.random() < 0.65) {
        setTimeout(() => {
          aiStealUserSticker(
            character.character_id,
            character.name,
            sticker,
            text,
            { ...s.emotion }
          );
        }, 400);
      }
    }
  }, [persist, rerender]);

  const triggerCharacterReply = useCallback(async (messageId?: string, llmConfig?: LlmConfig) => {
    const s = stateRef.current;
    
    let targetMsg: ChatMessage | undefined;
    if (messageId) {
      const msgIndex = s.messages.findIndex((m) => m.id === messageId);
      if (msgIndex !== -1) {
        targetMsg = s.messages[msgIndex];
        // Do NOT slice/truncate message history - keep whole conversation intact
        // But adopt targetMsg snapshot emotion if available as the emotional baseline
        if (targetMsg.snapshot) {
          s.emotion = { ...targetMsg.snapshot.emotion };
          s.backgroundThreads = targetMsg.snapshot.backgroundThreads.map((t) => ({ ...t }));
          s.triggeredAnchors = targetMsg.snapshot.triggeredAnchors.map((a) => ({ ...a }));
        }
      }
    }

    const character = getCharacterById(s.characterId) ?? MOCK_CHARACTERS[0];

    // 1. Natural Emotional Calming / Decay Curve before reply
    const decayRate = loadEmotionDecayRate();
    s.emotion = decayEmotionTowardsBaseline(s.emotion, character.emotion.baseline, decayRate);

    previousEmotionRef.current = { ...s.emotion };
    emotionConfirmedRef.current = true;
    lastIntentRef.current = null;

    const lastUserMsg = [...s.messages].reverse().find((m) => m.role === 'user');
    const triggerInput = targetMsg ? targetMsg.content : (lastUserMsg ? lastUserMsg.content : '...');

    // A. Dynamic Memory topic matching and contextual recall injection
    const matchedDynamicMemories = findRelevantDynamicMemories(character.character_id, triggerInput);
    let dynamicMemoriesContext = '';
    if (matchedDynamicMemories.length > 0) {
      const topMem = matchedDynamicMemories[0];
      const kwStr = topMem.topic_keywords.join('、');
      dynamicMemoriesContext = `主控在当前对话中触及了与「${kwStr}」相关的过往事件与话题。\n【过往高情绪回忆】：${topMem.user_trigger_summary}，你当时内心对这件事产生了强烈的${EMOTION_NAMES[topMem.emotion_type]}反应。\n请务必在你的内心独白（thought）或细微动作中展现出你一直清楚地记着这件事（形成 "你上次因为 XX 难过/开心，所以这次我特别注意到了..." 的长线连续感）！`;
      
      // Also register into active backgroundThreads
      if (!s.backgroundThreads.some((t) => t.content.includes(topMem.topic_keywords[0] || '回忆'))) {
        s.backgroundThreads.push({
          content: `忆起主控曾因为${topMem.topic_keywords[0] || '这件事'}引发过强烈情绪`,
          remaining_turns: 3,
        });
      }
    }

    const result = processChat(
      { ...s, emotion: { ...s.emotion }, backgroundThreads: s.backgroundThreads.map((t) => ({ ...t })) },
      character,
      triggerInput,
    );

    s.backgroundThreads = result.backgroundThreads;
    s.triggeredAnchors = result.triggeredAnchors;
    lastIntentRef.current = result.intent;

    const newReplies: ChatMessage[] = [];

    if (llmConfig && isLlmConfigured(llmConfig)) {
      try {
        const emotionSummary = Object.entries(s.emotion)
          .map(([k, v]) => `${k}: ${Math.round(v * 100)}%`)
          .join(', ');
        
        const pipelineLayers = loadPromptLayers();
        const llmMessages = assemblePipelineLlmMessages(pipelineLayers, {
          character,
          emotionSummary,
          backgroundThreads: s.backgroundThreads.map((t) => t.content),
          dynamicMemoriesContext,
          chatHistory: s.messages,
          targetMsgInstruction: targetMsg
            ? `（特别指令：希望你以这一句“${targetMsg.content}”为本次回复的核心情感基准与回应重点，在此情绪基调上进行接续推演与回应。）`
            : undefined,
        });

        // 202 Accepted: Asynchronous Outbox Enqueue with iOS Background Keep-Alive
        const enqueueRes = outboxQueue.enqueue('chat_reply', {
          characterId: character.character_id,
          character,
          triggerInput,
          messageId,
          llmConfig,
          llmMessages,
          currentEmotionSnapshot: { ...s.emotion },
          backgroundThreads: s.backgroundThreads.map((t) => ({ ...t })),
          dynamicMemoriesContext,
          targetMsgContent: targetMsg?.content,
        });

        // Await Outbox worker completion with auto-retry resilience
        const taskResult = await new Promise<OutboxTaskResult>((resolve, reject) => {
          const pollInterval = setInterval(() => {
            const task = outboxQueue.getTask(enqueueRes.taskId);
            if (!task) {
              clearInterval(pollInterval);
              reject(new Error('任务已被移除或取消'));
              return;
            }
            if (task.status === 'completed' && task.result) {
              clearInterval(pollInterval);
              resolve(task.result);
            } else if (task.status === 'failed') {
              clearInterval(pollInterval);
              reject(new Error(task.error || '生成失败'));
            } else if (task.status === 'cancelled') {
              clearInterval(pollInterval);
              reject(new Error('生成已取消'));
            }
          }, 150);
        });

        // Apply updated emotion and threads from outbox
        s.emotion = { ...taskResult.updatedEmotion };
        s.backgroundThreads = taskResult.updatedThreads.map((t) => ({
          content: t.content,
          remaining_turns: t.remaining_turns ?? 3,
        }));
        newReplies.push(...taskResult.newReplies);

        // Record to multi-turn emotion history
        emotionHistoryRef.current.push({ ...s.emotion });
        if (emotionHistoryRef.current.length > 8) {
          emotionHistoryRef.current.shift();
        }

        lastFallbackRef.current = false;

        // Optionally attach an AI sticker to the last bubble if character has stickers
        const charStickers = getCharacterStickers(character.character_id);
        if (charStickers.length > 0 && newReplies.length > 0) {
          const shouldSendSticker = Math.random() < 0.35 || /表情包|表情|图|看看你/.test(triggerInput);
          if (shouldSendSticker) {
            const randomStk = charStickers[Math.floor(Math.random() * charStickers.length)];
            const lastReply = newReplies[newReplies.length - 1];
            if (!lastReply.sticker) {
              lastReply.sticker = {
                id: randomStk.id,
                name: randomStk.name,
                url: randomStk.url,
                category: randomStk.category,
                ownerType: 'ai',
                characterId: character.character_id,
                isStolen: randomStk.isStolen,
                stolenMeta: randomStk.stolenMeta,
              };
            }
          }
        }

        // Deduplicate before adding to messages to avoid double appending
        const existingIds = new Set(s.messages.map((m) => m.id));
        const nonDup = newReplies.filter((r) => !existingIds.has(r.id));
        if (nonDup.length > 0) {
          s.messages = [...s.messages, ...nonDup];
        }
        persist(s);
        rerender();

        return {
          replies: newReplies,
          numbedKeys: taskResult.numbedKeys,
          sensitizedKeys: taskResult.sensitizedKeys,
          characterName: character.name,
        };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn('LLM call error, using local engine fallback:', errMsg);
        s.emotion = result.emotion;
        newReplies.push({
          ...result.reply,
          id: `char-fallback-${Date.now()}`,
          snapshot: captureSnapshot(s),
          llmError: errMsg,
        });
        lastFallbackRef.current = true;
      }
    } else {
      s.emotion = result.emotion;
      newReplies.push({
        ...result.reply,
        id: `char-mock-${Date.now()}`,
        snapshot: captureSnapshot(s),
      });
      lastFallbackRef.current = true;
    }

    // Trigger game invite in mock / fallback ONLY if debug shortcut enabled
    const isGhostCardKeywordFallback = /捉鬼牌|抽鬼牌|鬼牌|抽牌游戏|玩捉鬼牌|来局捉鬼牌/.test(triggerInput);
    const isGomokuKeywordFallback = /下棋|五子棋|来一局|来一盘|玩游戏|玩局游戏|下盘棋|陪我下棋|对弈|下一局/.test(triggerInput);
    if (isGhostCardKeywordFallback && isGameDebugShortcutEnabled()) {
      const invite: GameInvitation = {
        id: `invite_ghost_${Date.now()}`,
        gameType: 'ghost_card',
        characterId: character.character_id,
        characterName: character.name,
        inviteText: `“牌已经洗好啦，来和我玩一局捉鬼牌吧🐾～”`,
        timestamp: Date.now(),
        status: 'pending',
      };
      setPendingGameInvite(invite);
    } else if (isGomokuKeywordFallback && isGameDebugShortcutEnabled()) {
      const invite: GameInvitation = {
        id: `invite_${Date.now()}`,
        gameType: 'gomoku',
        characterId: character.character_id,
        characterName: character.name,
        inviteText: `“既然你提起了，我正好有兴致同你手谈一局五子棋。”`,
        timestamp: Date.now(),
        status: 'pending',
      };
      setPendingGameInvite(invite);
    }

    const existingFallbackIds = new Set(s.messages.map((m) => m.id));
    const nonDupFallback = newReplies.filter((r) => !existingFallbackIds.has(r.id));
    if (nonDupFallback.length > 0) {
      s.messages = [...s.messages, ...nonDupFallback];
    }
    persist(s);
    rerender();

    return {
      replies: newReplies,
      numbedKeys: [],
      sensitizedKeys: [],
      characterName: character.name,
    };
  }, [persist, rerender]);

  // -------------------------------------------------------------
  // Reroll Message (Direct clean reroll or with score & reason feedback)
  // -------------------------------------------------------------
  const rerollMessage = useCallback(
    async (
      messageId: string,
      feedback?: { score?: number; reason?: string },
      llmConfig?: LlmConfig
    ) => {
      const s = stateRef.current;
      const msgIndex = s.messages.findIndex((m) => m.id === messageId);
      if (msgIndex === -1) return;

      const targetMsg = s.messages[msgIndex];
      let triggerInput = '...';

      if (targetMsg.role === 'character') {
        // Find preceding user message as the trigger prompt without truncating conversation history
        let userMsgIndex = -1;
        for (let i = msgIndex - 1; i >= 0; i--) {
          if (s.messages[i].role === 'user') {
            userMsgIndex = i;
            break;
          }
        }

        if (userMsgIndex !== -1) {
          const userMsg = s.messages[userMsgIndex];
          triggerInput = userMsg.content;
          if (userMsg.snapshot) {
            s.emotion = { ...userMsg.snapshot.emotion };
            s.backgroundThreads = userMsg.snapshot.backgroundThreads.map((t) => ({ ...t }));
            s.triggeredAnchors = userMsg.snapshot.triggeredAnchors.map((a) => ({ ...a }));
          }
        } else {
          if (targetMsg.snapshot) {
            s.emotion = { ...targetMsg.snapshot.emotion };
            s.backgroundThreads = targetMsg.snapshot.backgroundThreads.map((t) => ({ ...t }));
            s.triggeredAnchors = targetMsg.snapshot.triggeredAnchors.map((a) => ({ ...a }));
          }
        }
      } else {
        triggerInput = targetMsg.content;
        if (targetMsg.snapshot) {
          s.emotion = { ...targetMsg.snapshot.emotion };
          s.backgroundThreads = targetMsg.snapshot.backgroundThreads.map((t) => ({ ...t }));
          s.triggeredAnchors = targetMsg.snapshot.triggeredAnchors.map((a) => ({ ...a }));
        }
      }

      const character = getCharacterById(s.characterId) ?? MOCK_CHARACTERS[0];
      const decayRate = loadEmotionDecayRate();
      s.emotion = decayEmotionTowardsBaseline(s.emotion, character.emotion.baseline, decayRate);

      previousEmotionRef.current = { ...s.emotion };
      emotionConfirmedRef.current = true;
      lastIntentRef.current = null;

      const matchedDynamicMemories = findRelevantDynamicMemories(character.character_id, triggerInput);
      let dynamicMemoriesContext = '';
      if (matchedDynamicMemories.length > 0) {
        const topMem = matchedDynamicMemories[0];
        const kwStr = topMem.topic_keywords.join('、');
        dynamicMemoriesContext = `主控在当前对话中触及了与「${kwStr}」相关的过往事件与话题。\n【过往高情绪回忆】：${topMem.user_trigger_summary}，你当时内心对这件事产生了强烈的${EMOTION_NAMES[topMem.emotion_type]}反应。\n请务必在你的内心独白（thought）或细微动作中展现出你一直清楚地记着这件事！`;
      }

      const result = processChat(
        { ...s, emotion: { ...s.emotion }, backgroundThreads: s.backgroundThreads.map((t) => ({ ...t })) },
        character,
        triggerInput
      );

      s.backgroundThreads = result.backgroundThreads;
      s.triggeredAnchors = result.triggeredAnchors;
      lastIntentRef.current = result.intent;

      const newReplies: ChatMessage[] = [];

      // Construct targetMsgInstruction based on feedback
      let targetMsgInstruction: string | undefined = undefined;
      if (feedback && (feedback.score !== undefined || feedback.reason?.trim())) {
        const scorePart = feedback.score !== undefined ? `评分：【${feedback.score}星/5星（${feedback.score}分）】` : '';
        const reasonPart = feedback.reason?.trim() ? `改进理由与调整要求：“${feedback.reason.trim()}”` : '';
        targetMsgInstruction = `（【主控打分与重roll/刷新反馈】：${[scorePart, reasonPart].filter(Boolean).join('，')}。请严格根据主控给出的评分与意见，调整情绪温差、肢体动作细节与台词深度，重新生成更具质感的全新回复！）`;
      }

      if (llmConfig && isLlmConfigured(llmConfig)) {
        try {
          const emotionSummary = Object.entries(s.emotion)
            .map(([k, v]) => `${k}: ${Math.round(v * 100)}%`)
            .join(', ');

          const pipelineLayers = loadPromptLayers();
          const llmMessages = assemblePipelineLlmMessages(pipelineLayers, {
            character,
            emotionSummary,
            backgroundThreads: s.backgroundThreads.map((t) => t.content),
            dynamicMemoriesContext,
            chatHistory: s.messages,
            targetMsgInstruction,
          });

          const rawText = await callLlmWithGuardrail(llmConfig, llmMessages, character);
          const structuredList = parseStructuredLlmResponses(rawText);

          const now = Date.now();
          let maxIntensityThisTurn = 1;
          const netDeltaThisTurn: Partial<EmotionVector> = {};
          const turnNumbedKeys: string[] = [];
          const turnSensitizedKeys: string[] = [];

          structuredList.forEach((structured, idx) => {
            const intensity = structured.emotion_intensity ?? 3;
            if (intensity > maxIntensityThisTurn) maxIntensityThisTurn = intensity;

            if (structured.emotion_delta && Object.keys(structured.emotion_delta).length > 0) {
              const calibratedDelta = applyIntensityCalibration(structured.emotion_delta, intensity);
              const { finalDelta, numbedKeys, sensitizedKeys } = processMultiTurnInertia(
                s.emotion,
                calibratedDelta,
                emotionHistoryRef.current
              );

              if (numbedKeys.length > 0) {
                numbedKeys.forEach((nk) => {
                  if (!turnNumbedKeys.includes(nk)) turnNumbedKeys.push(nk);
                });
              }
              if (sensitizedKeys.length > 0) {
                sensitizedKeys.forEach((sk) => {
                  if (!turnSensitizedKeys.includes(sk)) turnSensitizedKeys.push(sk);
                });
              }

              s.emotion = addEmotion(s.emotion, finalDelta);

              for (const k of EMOTION_KEYS) {
                const d = finalDelta[k];
                if (d !== undefined && d !== null) {
                  netDeltaThisTurn[k] = (netDeltaThisTurn[k] || 0) + d;
                }
              }
            }

            if (structured.triggered_memory) {
              s.backgroundThreads.push({
                content: structured.triggered_memory,
                remaining_turns: 3,
              });
            }

            newReplies.push({
              id: `char-${now}-${idx}`,
              role: 'character',
              content: structured.reply,
              segments: parseSegments(structured.reply),
              timestamp: now + idx * 10,
              character_id: character.character_id,
              snapshot: captureSnapshot(s),
            });
          });

          emotionHistoryRef.current.push({ ...s.emotion });
          if (emotionHistoryRef.current.length > 8) {
            emotionHistoryRef.current.shift();
          }

          lastFallbackRef.current = false;

          // Attach sticker if applicable
          const charStickers = getCharacterStickers(character.character_id);
          if (charStickers.length > 0 && newReplies.length > 0) {
            const shouldSendSticker = Math.random() < 0.35 || /表情包|表情|图/.test(triggerInput);
            if (shouldSendSticker) {
              const randomStk = charStickers[Math.floor(Math.random() * charStickers.length)];
              const lastReply = newReplies[newReplies.length - 1];
              if (!lastReply.sticker) {
                lastReply.sticker = {
                  id: randomStk.id,
                  name: randomStk.name,
                  url: randomStk.url,
                  category: randomStk.category,
                  ownerType: 'ai',
                  characterId: character.character_id,
                  isStolen: randomStk.isStolen,
                  stolenMeta: randomStk.stolenMeta,
                };
              }
            }
          }

          // In-place replacement: replace target message at msgIndex without truncating subsequent conversation
          const updatedMessages = [...s.messages];
          updatedMessages.splice(msgIndex, 1, ...newReplies);
          s.messages = updatedMessages;
          persist(s);
          rerender();

          return {
            replies: newReplies,
            numbedKeys: turnNumbedKeys,
            sensitizedKeys: turnSensitizedKeys,
            characterName: character.name,
          };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.warn('LLM call error during reroll, using local fallback:', errMsg);
          s.emotion = result.emotion;
          newReplies.push({
            ...result.reply,
            id: `char-fallback-${Date.now()}`,
            snapshot: captureSnapshot(s),
            llmError: errMsg,
          });
          lastFallbackRef.current = true;
        }
      } else {
        s.emotion = result.emotion;
        newReplies.push({
          ...result.reply,
          id: `char-mock-${Date.now()}`,
          snapshot: captureSnapshot(s),
        });
        lastFallbackRef.current = true;
      }

      // In-place fallback replacement
      const updatedMessages = [...s.messages];
      updatedMessages.splice(msgIndex, 1, ...newReplies);
      s.messages = updatedMessages;
      persist(s);
      rerender();

      return {
        replies: newReplies,
        numbedKeys: [],
        sensitizedKeys: [],
        characterName: character.name,
      };
    },
    [persist, rerender]
  );

  // -------------------------------------------------------------
  // Handle User Rejection of Game Invitation (Pipeline Integration)
  // -------------------------------------------------------------
  const handleUserRejectGameInvite = useCallback((characterId: string, characterName: string) => {
    const s = stateRef.current;
    const character = getCharacterById(characterId) ?? MOCK_CHARACTERS[0];

    // Shift emotion based on instinct
    if (character.core.instinct_base === 'attack') {
      s.emotion = addEmotion(s.emotion, { anger: 0.1, desire: 0.1 });
    } else if (character.core.instinct_base === 'fawn') {
      s.emotion = addEmotion(s.emotion, { sadness: 0.15, warmth: 0.05 });
    } else {
      s.emotion = addEmotion(s.emotion, { sadness: 0.08, warmth: -0.05 });
    }

    // Add background thought
    s.backgroundThreads.unshift({
      content: `主控刚才婉拒了对弈邀约，心中掠过一丝遗憾与微澜`,
      remaining_turns: 3,
    });
    if (s.backgroundThreads.length > 5) s.backgroundThreads.pop();

    // Log intimacy milestone
    recordGameMilestone(
      characterId,
      '婉拒对弈',
      `主控婉拒了与${characterName}的五子棋手谈邀约。`,
      'game_refuse'
    );

    persist(s);
    rerender();
  }, [persist, rerender]);

  // -------------------------------------------------------------
  // Handle Game Finished Conclusion (Pipeline Integration)
  // -------------------------------------------------------------
  const handleGameFinished = useCallback(
    async (
      summary: string, 
      rawRecord: GomokuMatchRecord, 
      applyEmotionDelta: boolean = false, 
      customDelta?: Partial<EmotionVector>
    ) => {
      const s = stateRef.current;
      const character = getCharacterById(rawRecord.characterId) ?? MOCK_CHARACTERS[0];

      // 1. Emotion shift strictly obeys settlement confirmation
      if (applyEmotionDelta) {
        const deltaToApply = customDelta || rawRecord.gameTotalDelta || (
          rawRecord.winner === 'player'
            ? { joy: 0.2, warmth: 0.15, desire: 0.1 }
            : rawRecord.winner === 'character'
            ? { joy: 0.25, warmth: 0.1, anger: -0.1 }
            : rawRecord.winner === 'draw'
            ? { warmth: 0.2, joy: 0.1 }
            : { warmth: 0.1, desire: 0.05 }
        );
        s.emotion = addEmotion(s.emotion, deltaToApply);
      }

      // 2. Add background thought thread
      s.backgroundThreads.unshift({
        content: `刚刚手谈一局五子棋：${rawRecord.winner === 'player' ? '主控技高一筹破局' : '局势激烈试探'}，棋意犹存`,
        remaining_turns: 4,
      });
      if (s.backgroundThreads.length > 5) s.backgroundThreads.pop();

      // 3. Save intimacy milestone & dynamic memory
      const milestoneType =
        rawRecord.winner === 'player'
          ? 'game_win'
          : rawRecord.winner === 'character'
          ? 'game_loss'
          : 'game_draw';

      recordGameMilestone(
        rawRecord.characterId,
        '五子棋手谈',
        summary,
        milestoneType
      );

      const dynamicMemory: DynamicMemory = {
        id: `dyn_game_${Date.now()}`,
        character_id: rawRecord.characterId,
        topic_keywords: ['五子棋', '对弈', '下棋'],
        emotion_type: 'warmth',
        intensity: 3,
        user_trigger_summary: `与${character.name}对弈了一局五子棋`,
        character_reaction_summary: summary,
        created_at: Date.now(),
        recall_count: 0,
      };
      saveDynamicMemory(rawRecord.characterId, dynamicMemory);

      // 4. Save raw match record to IndexedDB (isolated from LLM history)
      await saveMatchRecord(rawRecord);

      persist(s);
      rerender();
    },
    [persist, rerender]
  );

  const applyGameEmotionSettlement = useCallback(
    (delta: Partial<EmotionVector>, _summary?: string) => {
      const s = stateRef.current;
      s.emotion = addEmotion(s.emotion, delta);
      persist(s);
      rerender();
    },
    [persist, rerender]
  );

  // -------------------------------------------------------------
  // In-Game Live Dialogue / Chat (Proxied through LLM & Engine)
  // -------------------------------------------------------------
  const sendInGameChat = useCallback(
    async (
      userInput: string,
      charId: string,
      matchContext: { moveCount: number; playerColor: 'B' | 'W'; currentTurn: 'B' | 'W' },
      llmConfig?: LlmConfig,
      chatHistory?: Array<{ sender: 'user' | 'character' | 'system'; text: string }>
    ): Promise<{ reply: string; tactic: 'aggressive' | 'defensive' | 'gentle' | 'balanced' }> => {
      const character = getCharacterById(charId) ?? MOCK_CHARACTERS[0];
      const activeConfig = (llmConfig && isLlmConfigured(llmConfig)) ? llmConfig : loadLlmConfig();

      if (isLlmConfigured(activeConfig)) {
        try {
          const s = stateRef.current;
          const emotionSummary = Object.entries(s.emotion)
            .map(([k, v]) => `${k}: ${Math.round(v * 100)}%`)
            .join(', ');

          const sysPrompt = `你正在与主控进行【五子棋对局】手谈。
你的角色身份：${character.name}
核心特质：${character.core.values.join('、')}
语言风格：${character.core.speech_filter}
当前情绪状态：${emotionSummary}
对局当前状态：已下 ${matchContext.moveCount} 手，主控执${matchContext.playerColor === 'B' ? '黑' : '白'}，当前轮到${matchContext.currentTurn === 'B' ? '黑方' : '白方'}落子。

【回复规范】：
1. 必须完全代入${character.name}的性格，以第一人称对主控在棋局上的话语做出精妙生动的回应。
2. 包含细腻传神的（动作描写/神态）与"台词"，突出手谈博弈时的心理与对主控的互动。
3. 请在回复最后一行输出且仅输出下棋决策策略标签之一：
   - [TACTIC: aggressive] （激进绞杀、猛烈进攻、被挑衅激发好胜心）
   - [TACTIC: defensive] （防守严密、谨慎堵路、步步为营）
   - [TACTIC: gentle] （温柔宠溺、故意放水、留有余地）
   - [TACTIC: balanced] （攻守兼备、沉稳从容）
4. 严禁输出任何JSON或无关注释。`;

          const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
            { role: 'system', content: sysPrompt },
          ];

          if (chatHistory && chatHistory.length > 0) {
            const recent = chatHistory.slice(-6);
            recent.forEach((item) => {
              messages.push({
                role: item.sender === 'user' ? 'user' : 'assistant',
                content: item.text,
              });
            });
          }

          messages.push({ role: 'user', content: `（在棋盘前对你说）：${userInput}` });

          const rawReply = await callLlm(activeConfig, messages);
          const cleanText = cleanRawLlmOutput(rawReply);

          let tactic: 'aggressive' | 'defensive' | 'gentle' | 'balanced' = 'balanced';
          const tacticMatch = cleanText.match(/\[TACTIC:\s*(aggressive|defensive|gentle|balanced)\]/i);
          if (tacticMatch) {
            tactic = tacticMatch[1].toLowerCase() as any;
          }

          const reply = cleanText.replace(/\[TACTIC:\s*(aggressive|defensive|gentle|balanced)\]/gi, '').trim();

          return {
            reply: reply || `（指尖转动着棋子，轻笑一声）"专心看棋，别想借着说话乱我心神。"`,
            tactic,
          };
        } catch (err) {
          console.warn('In-game LLM chat failed, using in-character fallback:', err);
        }
      }

      const defaultResponses = [
        `（修长指尖轻敲棋子，垂眸审视）"怎么，想借说话分散我的注意？专心下你的棋。"`,
        `（微微偏头看着你，唇角含笑）"落子无悔，我可不会轻易让你。"`,
        `（指尖拈起一枚棋子在指间把玩）"步步紧逼啊……有意思，我看你接下来怎么走。"`,
        `（从容落子于位）"局势才刚铺开，胜负犹未可知呢。"`,
      ];
      return {
        reply: defaultResponses[Math.floor(Math.random() * defaultResponses.length)],
        tactic: 'balanced',
      };
    },
    []
  );

  const controller = {
    ready: readyRef.current,
    getCharacter: (): Character => getCharacterById(stateRef.current.characterId) ?? MOCK_CHARACTERS[0],
    getCharactersList: (): Character[] => {
      try {
        const saved = getSavedCharacters();
        const map = new Map<string, Character>();
        for (const c of saved) {
          if (c && c.character_id) {
            map.set(c.character_id, c);
          }
        }
        for (const c of MOCK_CHARACTERS) {
          if (!map.has(c.character_id)) {
            map.set(c.character_id, c);
          }
        }
        return Array.from(map.values());
      } catch {
        return MOCK_CHARACTERS;
      }
    },
    getEmotion: (): EmotionVector => ({ ...stateRef.current.emotion }),
    getPreviousEmotion: (): EmotionVector | null =>
      previousEmotionRef.current ? { ...previousEmotionRef.current } : null,
    getEmotionConfirmed: (): boolean => emotionConfirmedRef.current,
    getBackgroundThreads: (): BackgroundThread[] =>
      stateRef.current.backgroundThreads.map((t) => ({ ...t })),
    getTriggeredAnchors: (): TriggeredAnchor[] => [...stateRef.current.triggeredAnchors],
    getMessages: (): ChatMessage[] => [...stateRef.current.messages],
    getLastIntent: (): IntentAnalysis | null => lastIntentRef.current,
    getLastFallback: (): boolean => lastFallbackRef.current,
    sendMessage,
    sendUserSticker,
    switchCharacter,
    clearHistory,
    resetEmotion,
    confirmEmotion,
    rollbackToMessage,
    editMessage,
    addUserMessageOnly,
    rerollMessage,
    triggerCharacterReply,
    handleUserRejectGameInvite,
    handleGameFinished,
    applyGameEmotionSettlement,
    sendInGameChat,
    reload: () => {
      const freshChar = getCharacterById(stateRef.current.characterId);
      if (freshChar) {
        stateRef.current.characterName = freshChar.name;
      }
      rerender();
    },
  };

  return controller;
}

export type EngineController = ReturnType<typeof useEngine>;
