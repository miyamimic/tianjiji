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
import { callLlm, buildSystemPrompt, isLlmConfigured, type LlmConfig } from '../lib/llm';
import { parseSegments } from '../engine/postprocess';
import { checkSensitiveWords, loadUserPromptProfile, hardResetAllLocalData } from '../lib/customStore';


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

      // Pre-process input through NLP Sensitive Words Dictionary
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

      await new Promise((r) => setTimeout(r, 300 + Math.random() * 200));

      const result = processChat(
        { ...s, emotion: { ...s.emotion }, backgroundThreads: s.backgroundThreads.map((t) => ({ ...t })) },
        character,
        processedInput,
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

          // 1. Embed custom backstory / custom system prompt instructions
          if ((character as any).custom_system_prompt) {
            systemPrompt = `【角色核心专属背景与约束提示词】\n${(character as any).custom_system_prompt}\n\n${systemPrompt}`;
          }

          // 2. Embed user persona / user backstory profile (主控角色档案)
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
            snapshot: captureSnapshot(s),
          };
          lastFallbackRef.current = true;
        }
      } else {
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

  /**
   * 修改某条用户消息的内容，并从该条消息开始截断后续内容。
   * （调用方在之后调用 sendMessage 即可重新生成新的角色回复，
   *  或者直接用 editAndResend 一次性完成）
   */
  const editMessage = useCallback((messageId: string, newContent: string) => {
    const s = stateRef.current;
    const msgIndex = s.messages.findIndex((m) => m.id === messageId);
    if (msgIndex === -1) return;

    const targetMsg = s.messages[msgIndex];
    if (targetMsg.role !== 'user') return;

    // 1. 用这条消息的快照回到"发送之前"的状态
    if (targetMsg.snapshot) {
      s.emotion = { ...targetMsg.snapshot.emotion };
      s.backgroundThreads = targetMsg.snapshot.backgroundThreads.map((t) => ({ ...t }));
      s.triggeredAnchors = targetMsg.snapshot.triggeredAnchors.map((a) => ({ ...a }));
    }
    // 2. 截断到这条消息之前（不含这条）
    s.messages = s.messages.slice(0, msgIndex);

    previousEmotionRef.current = null;
    emotionConfirmedRef.current = true;
    lastIntentRef.current = null;

    persist(s);
    rerender();
  }, [persist, rerender]);

  /**
   * 修改某条用户消息并立即重新发送（从该点开始重新走完整的流程）
   */
  const editAndResendMessage = useCallback(
    async (messageId: string, newContent: string, llmConfig?: LlmConfig) => {
      editMessage(messageId, newContent);
      // 在 editMessage 截断和重置状态后，用同样的 sendMessage 流程发送新内容
      await sendMessage(newContent, llmConfig);
    },
    [editMessage, sendMessage],
  );

  /**
   * 一键硬重置：清空所有 localStorage（引擎状态、人设、词典、CSS、LLM配置），
   * 并恢复到默认初始状态。解决"设备卡死、关掉再开还是旧数据"的问题。
   */
  const hardReset = useCallback(() => {
    // 1. 清空所有本地存储
    hardResetAllLocalData();
    // 2. 重置内存状态到默认角色
    const defaultChar = MOCK_CHARACTERS[0];
    const defaultState = createSessionState(defaultChar);
    stateRef.current = defaultState;
    previousEmotionRef.current = null;
    emotionConfirmedRef.current = true;
    lastIntentRef.current = null;
    lastFallbackRef.current = false;
    // 3. 保存干净的初始状态（不依赖 saved.current 旧值）
    saved.current = null;
    persist(defaultState);
    rerender();
  }, [persist, rerender]);

  const controller = {
    ready: readyRef.current,
    getCharacter: (): Character => getCharacterById(stateRef.current.characterId) ?? MOCK_CHARACTERS[0],
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
    editAndResendMessage,
    hardReset,
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
