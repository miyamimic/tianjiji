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
  parseStructuredLlmResponse,
  parseStructuredLlmResponses, 
  isLlmConfigured, 
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
} from '../lib/customStore';
import {
  loadRelationState,
  buildRelationPrompt,
  stepRelationCooldown,
  applyDialogueMicroDrift,
} from '../lib/relationEngine';


const STORAGE_KEY = '__rp_engine_state';

type SavedState = {
  characterId: string;
  emotion: EmotionVector;
  backgroundThreads: BackgroundThread[];
  triggeredAnchors: TriggeredAnchor[];
  messages: ChatMessage[];
};

function loadSavedState(): SavedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedState;
    if (!parsed.characterId || !parsed.emotion) return null;
    return parsed;
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // non-fatal
  }
}

export function useEngine() {
  const [, forceUpdate] = useState(0);
  const rerender = useCallback(() => forceUpdate((n) => n + 1), []);

  const saved = useRef<SavedState | null>(null);
  if (!saved.current) {
    saved.current = loadSavedState();
  }

  const initCharacter = saved.current?.characterId
    ? getCharacterById(saved.current.characterId) ?? MOCK_CHARACTERS[0]
    : MOCK_CHARACTERS[0];

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

  useEffect(() => {
    readyRef.current = true;
    rerender();
  }, [rerender]);

  const persist = useCallback((s: SessionState) => {
    saveState(s);
  }, []);

  const sendMessage = useCallback(
    async (userInput: string, llmConfig?: LlmConfig) => {
      const s = stateRef.current;
      const character = getCharacterById(s.characterId) ?? MOCK_CHARACTERS[0];

      previousEmotionRef.current = { ...s.emotion };
      emotionConfirmedRef.current = false;

      // 1. Natural Emotional Calming / Decay Curve (随轮数与时间自然平复趋向基准线)
      const decayRate = loadEmotionDecayRate();
      s.emotion = decayEmotionTowardsBaseline(s.emotion, character.emotion.baseline, decayRate);

      // 2. Pre-process input through NLP Sensitive Words Dictionary
      const sensitive = checkSensitiveWords(userInput);
      let processedInput = userInput;

      if (sensitive.matched) {
        if (sensitive.blocked) {
          // Block message sending! Output a warning bubble and abort processing.
          const ts = Date.now();
          const warningMsg: ChatMessage = {
            id: `sys-warning-${ts}`,
            role: 'character',
            content: `⚠️【设定拦截警告】您的消息包含敏感词（如："${sensitive.matchedWords.join('、')}"），已触发前置绝对拦截过滤，此条消息未发送。`,
            segments: [{ type: 'thought', text: '前置拦截成功' }],
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

        // Apply severe emotional shifts if mapped
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
          
          const charCoreStr = [
            `核心特质: ${character.core.values.join('、')}`,
            `直觉本能反应: ${character.core.instinct_base}`,
            `语言风格: ${character.core.speech_filter}`,
            character.speech.catchphrases.length > 0 ? `口癖习惯: ${character.speech.catchphrases.join('、')}` : '',
            character.speech.forbidden_phrases.length > 0 ? `禁止言语: ${character.speech.forbidden_phrases.join('、')}` : '',
            (character as any).custom_system_prompt ? `专属补充: ${(character as any).custom_system_prompt}` : '',
          ].filter(Boolean).join('\n');

          const charVisual = loadCharVisualDesc(character.character_id);
          const userPersona = loadUserPromptProfile();
          const userVisual = loadUserVisualDesc();
          const relationState = loadRelationState(character.character_id);
          const relationPrompt = buildRelationPrompt(relationState);

          const systemPrompt = buildSystemPrompt(character.name, emotionSummary, {
            characterCore: charCoreStr,
            charVisual,
            userPersona,
            userVisual,
            backgroundThreads: s.backgroundThreads.map((t) => t.content),
            relationPrompt,
          });

          const llmMessages = [
            { role: 'system' as const, content: systemPrompt },
            ...s.messages.slice(-10).map((m) => ({
              role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
              content: m.content,
            })),
          ];

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

          s.messages = [...s.messages, ...replies];
          lastFallbackRef.current = false;
        } catch {
          s.emotion = result.emotion;
          reply = {
            ...result.reply,
            snapshot: captureSnapshot(s),
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

      // Decrement intimacy cooldown on round completion if active
      stepRelationCooldown(character.character_id);

      // 日常对话细微积极波动（自然陪伴升温）
      const isConflict = s.emotion.anger > 0.45;
      const isPositive = !isConflict && (lastIntentRef.current?.sentiment === 'positive' || s.emotion.warmth > 0.3 || s.emotion.joy > 0.3);
      applyDialogueMicroDrift(character.character_id, character, {
        isPositive,
        warmthLevel: s.emotion.warmth,
        joyLevel: s.emotion.joy,
        isConflict,
      });

      persist(s);
      rerender();
    },
    [persist, rerender],
  );

  const switchCharacter = useCallback(
    (characterId: string) => {
      const s = stateRef.current;
      const newChar = getCharacterById(characterId);
      if (!newChar) return;
      const newState = switchCharacterState(s, newChar);
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

    // Pre-process input through NLP Sensitive Words Dictionary
    const sensitive = checkSensitiveWords(content);
    let processedInput = content;

    if (sensitive.matched) {
      if (sensitive.blocked) {
        const ts = Date.now();
        const warningMsg: ChatMessage = {
          id: `sys-warning-${ts}`,
          role: 'character',
          content: `⚠️【设定拦截警告】您的消息包含敏感词（如："${sensitive.matchedWords.join('、')}"），已触发前置绝对拦截过滤，此条消息未发送。`,
          segments: [{ type: 'thought', text: '前置拦截成功' }],
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

  const triggerCharacterReply = useCallback(async (messageId?: string, llmConfig?: LlmConfig) => {
    const s = stateRef.current;
    
    if (messageId) {
      const msgIndex = s.messages.findIndex((m) => m.id === messageId);
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

    const character = getCharacterById(s.characterId) ?? MOCK_CHARACTERS[0];

    // 1. Natural Emotional Calming / Decay Curve before reply
    const decayRate = loadEmotionDecayRate();
    s.emotion = decayEmotionTowardsBaseline(s.emotion, character.emotion.baseline, decayRate);

    previousEmotionRef.current = { ...s.emotion };
    emotionConfirmedRef.current = false;
    lastIntentRef.current = null;

    const lastUserMsg = [...s.messages].reverse().find((m) => m.role === 'user');
    const triggerInput = lastUserMsg ? lastUserMsg.content : '...';

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
        
        const charCoreStr = [
          `核心特质: ${character.core.values.join('、')}`,
          `直觉本能反应: ${character.core.instinct_base}`,
          `语言风格: ${character.core.speech_filter}`,
          character.speech.catchphrases.length > 0 ? `口癖习惯: ${character.speech.catchphrases.join('、')}` : '',
          character.speech.forbidden_phrases.length > 0 ? `禁止言语: ${character.speech.forbidden_phrases.join('、')}` : '',
          (character as any).custom_system_prompt ? `专属补充: ${(character as any).custom_system_prompt}` : '',
        ].filter(Boolean).join('\n');

        const charVisual = loadCharVisualDesc(character.character_id);
        const userPersona = loadUserPromptProfile();
        const userVisual = loadUserVisualDesc();
        const relationState = loadRelationState(character.character_id);
        const relationPrompt = buildRelationPrompt(relationState);

        const systemPrompt = buildSystemPrompt(character.name, emotionSummary, {
          characterCore: charCoreStr,
          charVisual,
          userPersona,
          userVisual,
          backgroundThreads: s.backgroundThreads.map((t) => t.content),
          dynamicMemoriesContext,
          relationPrompt,
        });

        const llmMessages = [
          { role: 'system' as const, content: systemPrompt },
          ...s.messages.slice(-12).map((m) => ({
            role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: m.content,
          })),
        ];

        // Defensive guardrail LLM call with auto-regeneration
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
            // 1. Emotion Intensity Calibration (1-5 multiplier)
            const calibratedDelta = applyIntensityCalibration(structured.emotion_delta, intensity);

            // 2. Multi-turn Emotion Inertia & Saturation Numbing
            const { finalDelta, numbedKeys, sensitizedKeys } = processMultiTurnInertia(
              s.emotion,
              calibratedDelta,
              emotionHistoryRef.current,
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

            // Track net delta for dynamic episodic memory trigger
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

        // 3. High Emotional Volatility Episodic Memory Generation
        const maxDeltaVal = Math.max(0, ...Object.values(netDeltaThisTurn).map((v) => Math.abs(v || 0)));
        if ((maxIntensityThisTurn >= 4 || maxDeltaVal >= 0.2) && triggerInput !== '...' && triggerInput.trim().length >= 2) {
          let topEmotionKey: EmotionKey = 'sadness';
          let topMag = 0;
          for (const k of EMOTION_KEYS) {
            const val = Math.abs(netDeltaThisTurn[k] || 0);
            if (val > topMag) {
              topMag = val;
              topEmotionKey = k;
            }
          }

          // Extract meaningful keywords from user's message
          const cleanWords = triggerInput
            .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ')
            .split(/\s+/)
            .filter((w) => w.length >= 2 && !['什么', '怎么', '这个', '那个', '因为', '所以', '虽然', '但是'].includes(w));
          const keywords = cleanWords.slice(0, 3);

          if (keywords.length > 0) {
            const dynamicMemory: DynamicMemory = {
              id: `dyn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              character_id: character.character_id,
              topic_keywords: keywords,
              emotion_type: topEmotionKey,
              intensity: maxIntensityThisTurn,
              user_trigger_summary: `主控说："${triggerInput.slice(0, 35)}${triggerInput.length > 35 ? '...' : ''}"`,
              character_reaction_summary: `${character.name}对这番话产生了显著的${EMOTION_NAMES[topEmotionKey]}共鸣`,
              created_at: Date.now(),
              recall_count: 0,
            };
            saveDynamicMemory(character.character_id, dynamicMemory);
          }
        }

        // 4. Record to multi-turn emotion history (keep last 8)
        emotionHistoryRef.current.push({ ...s.emotion });
        if (emotionHistoryRef.current.length > 8) {
          emotionHistoryRef.current.shift();
        }

        lastFallbackRef.current = false;

        s.messages = [...s.messages, ...newReplies];
        persist(s);
        rerender();

        return {
          replies: newReplies,
          numbedKeys: turnNumbedKeys,
          sensitizedKeys: turnSensitizedKeys,
          characterName: character.name,
        };
      } catch (err) {
        console.warn('LLM call error, using local engine fallback:', err);
        s.emotion = result.emotion;
        newReplies.push({
          ...result.reply,
          id: `char-fallback-${Date.now()}`,
          snapshot: captureSnapshot(s),
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

    s.messages = [...s.messages, ...newReplies];
    stepRelationCooldown(character.character_id);
    persist(s);
    rerender();

    return {
      replies: newReplies,
      numbedKeys: [],
      sensitizedKeys: [],
      characterName: character.name,
    };
  }, [persist, rerender]);

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
    switchCharacter,
    clearHistory,
    resetEmotion,
    confirmEmotion,
    rollbackToMessage,
    editMessage,
    addUserMessageOnly,
    triggerCharacterReply,
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
