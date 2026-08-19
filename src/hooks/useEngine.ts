import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  EmotionVector,
  BackgroundThread,
  TriggeredAnchor,
  ChatMessage,
  IntentAnalysis,
  Character,
} from '../data/types';
import { MOCK_CHARACTERS, getCharacterById, getSavedCharacters } from '../data/characters';
import {
  processChat,
  createSessionState,
  switchCharacterState,
  resetEmotionState,
  clearHistoryState,
  type SessionState,
} from '../engine';
import { decayEmotionTowardsBaseline, addEmotion } from '../engine/emotion';
import { 
  callLlm, 
  buildSystemPrompt, 
  parseStructuredLlmResponse, 
  isLlmConfigured, 
  type LlmConfig 
} from '../lib/llm';
import { parseSegments } from '../engine/postprocess';
import { 
  checkSensitiveWords, 
  loadUserPromptProfile, 
  loadCharVisualDesc, 
  loadUserVisualDesc,
  loadEmotionDecayRate 
} from '../lib/customStore';


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

          const systemPrompt = buildSystemPrompt(character.name, emotionSummary, {
            characterCore: charCoreStr,
            charVisual,
            userPersona,
            userVisual,
            backgroundThreads: s.backgroundThreads.map((t) => t.content),
          });

          const llmMessages = [
            { role: 'system' as const, content: systemPrompt },
            ...s.messages.slice(-10).map((m) => ({
              role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
              content: m.content,
            })),
          ];

          const rawText = await callLlm(llmConfig, llmMessages);
          const structured = parseStructuredLlmResponse(rawText);

          // 3. Unified Engine Update with LLM Emotion Delta & Triggered Memory
          if (structured.emotion_delta && Object.keys(structured.emotion_delta).length > 0) {
            s.emotion = addEmotion(s.emotion, structured.emotion_delta);
          } else {
            // Fallback to rule engine emotion if model didn't return delta
            s.emotion = result.emotion;
          }

          if (structured.triggered_memory) {
            s.backgroundThreads.push({
              content: structured.triggered_memory,
              remaining_turns: 3,
            });
          }

          reply = {
            id: `char-${Date.now()}`,
            role: 'character',
            content: structured.reply,
            segments: parseSegments(structured.reply),
            timestamp: Date.now(),
            character_id: character.character_id,
            snapshot: captureSnapshot(s),
          };
          lastFallbackRef.current = false;
        } catch {
          s.emotion = result.emotion;
          reply = {
            ...result.reply,
            snapshot: captureSnapshot(s),
          };
          lastFallbackRef.current = true;
        }
      } else {
        s.emotion = result.emotion;
        reply = {
          ...result.reply,
          snapshot: captureSnapshot(s),
        };
        lastFallbackRef.current = true;
      }

      s.messages = [...s.messages, reply];
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

    const newUserMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content,
      segments: [{ type: 'speech', text: content }],
      timestamp: Date.now(),
      snapshot: captureSnapshot(s),
    };

    s.messages = [...s.messages, newUserMsg];
    persist(s);
    rerender();
  }, [persist, rerender]);

  const triggerCharacterReply = useCallback(async (messageId: string, llmConfig?: LlmConfig) => {
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

    previousEmotionRef.current = { ...s.emotion };
    emotionConfirmedRef.current = false;
    lastIntentRef.current = null;

    const character = getCharacterById(s.characterId) ?? MOCK_CHARACTERS[0];
    const lastUserMsg = [...s.messages].reverse().find((m) => m.role === 'user');
    const triggerInput = lastUserMsg ? lastUserMsg.content : '...';

    const result = processChat(
      { ...s, emotion: { ...s.emotion }, backgroundThreads: s.backgroundThreads.map((t) => ({ ...t })) },
      character,
      triggerInput,
    );

    s.emotion = result.emotion;
    s.backgroundThreads = result.backgroundThreads;
    s.triggeredAnchors = result.triggeredAnchors;
    lastIntentRef.current = result.intent;

    let reply: ChatMessage;

    if (llmConfig && isLlmConfigured(llmConfig)) {
      try {
        const emotionSummary = Object.entries(s.emotion)
          .map(([k, v]) => `${k}: ${Math.round(v * 100)}%`)
          .join(', ');
        
        let systemPrompt = buildSystemPrompt(character.name, emotionSummary);

        if ((character as any).custom_system_prompt) {
          systemPrompt = `【角色核心专属背景与约束提示词】\n${(character as any).custom_system_prompt}\n\n${systemPrompt}`;
        }

        const userPersona = loadUserPromptProfile();
        if (userPersona) {
          systemPrompt = `${systemPrompt}\n\n【主控角色/当前对话者档案（用于匹配关系和心理）】\n用户正在扮演以下角色，请自始至终匹配与其契合的张力和态度：\n${userPersona}`;
        }

        const llmMessages = [
          { role: 'system' as const, content: systemPrompt },
          ...s.messages.slice(-10).map((m) => ({
            role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: m.content,
          })),
        ];
        const rawText = await callLlm(llmConfig, llmMessages);
        reply = {
          id: `char-${Date.now()}`,
          role: 'character',
          content: rawText,
          segments: parseSegments(rawText),
          timestamp: Date.now(),
          character_id: character.character_id,
          snapshot: captureSnapshot(s),
        };
        lastFallbackRef.current = false;
      } catch {
        reply = {
          ...result.reply,
          id: `char-fallback-${Date.now()}`,
          snapshot: captureSnapshot(s),
        };
        lastFallbackRef.current = true;
      }
    } else {
      reply = {
        ...result.reply,
        id: `char-fallback-${Date.now()}`,
        snapshot: captureSnapshot(s),
      };
      lastFallbackRef.current = true;
    }

    s.messages = [...s.messages, reply];
    persist(s);
    rerender();
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
