import type {
  Character,
  EmotionVector,
  BackgroundThread,
  TriggeredAnchor,
  ChatMessage,
  IntentAnalysis,
  MessageSegment,
} from '../data/types';
import { EMOTION_KEYS } from '../data/types';
import { getCharacterOrDefault } from '../data/characters';
import {
  addEmotion,
  scaleEmotion,
  updateEmotionWithInertia,
} from './emotion';
import { analyzeIntent } from './nlp';
import { runPostprocessor } from './postprocess';
import { mockGenerate } from './mockLlm';

export type SessionState = {
  sessionId: string;
  characterId: string;
  characterName: string;
  emotion: EmotionVector;
  backgroundThreads: BackgroundThread[];
  triggeredAnchors: TriggeredAnchor[];
  messages: ChatMessage[];
};

function nowMs(): number {
  return Date.now();
}

function cloneThreads(threads: BackgroundThread[]): BackgroundThread[] {
  return threads.map((t) => ({ ...t }));
}

function processThreads(
  threads: BackgroundThread[],
): { drawn: BackgroundThread[]; updated: BackgroundThread[] } {
  if (threads.length === 0) return { drawn: [], updated: threads };
  const drawCount = Math.min(threads.length, 1 + Math.floor(Math.random() * 2));
  const pool = [...threads];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const drawn = pool.slice(0, drawCount);
  const drawnContents = new Set(drawn.map((t) => t.content));
  const updated: BackgroundThread[] = [];
  for (const t of threads) {
    if (drawnContents.has(t.content)) {
      const nt = { ...t, remaining_turns: t.remaining_turns - 1 };
      if (nt.remaining_turns > 0) updated.push(nt);
    } else {
      updated.push({ ...t });
    }
  }
  return { drawn, updated };
}

function checkMemoryAnchors(
  character: Character,
  userInput: string,
  intent: IntentAnalysis,
  triggeredAnchors: TriggeredAnchor[],
): { delta: Partial<EmotionVector>; reactions: string[]; updatedAnchors: TriggeredAnchor[] } {
  const delta: Partial<EmotionVector> = {};
  const reactions: string[] = [];
  const updatedAnchors = [...triggeredAnchors];
  const anchors = character.memory.anchors;

  for (const anchor of anchors) {
    let triggered = userInput.includes(anchor.trigger);
    if (!triggered && (intent.intent === 'affection' || intent.intent === 'confess') && anchor.trigger.includes('想你')) {
      triggered = userInput.includes('想你') || (intent.intent === 'affection' && intent.entities.some((e) => e.includes('想')));
    }
    if (!triggered && intent.intent === 'refuse' && anchor.trigger.includes('不行')) {
      triggered = intent.intent === 'refuse';
    }
    if (triggered) {
      reactions.push(anchor.reaction);
      const scaled = scaleEmotion(anchor.emotion_shift, anchor.weight);
      for (const k of EMOTION_KEYS) {
        const v = scaled[k];
        if (v !== undefined) {
          const cur = delta[k] ?? 0;
          delta[k] = Math.round((cur + v) * 10000) / 10000;
        }
      }
      updatedAnchors.push({ anchor, triggered_at: nowMs() });
    }
  }

  return { delta, reactions, updatedAnchors };
}

export type ChatResult = {
  reply: ChatMessage;
  emotion: EmotionVector;
  backgroundThreads: BackgroundThread[];
  triggeredAnchors: TriggeredAnchor[];
  intent: IntentAnalysis;
  fallback: boolean;
};

export function processChat(
  state: SessionState,
  character: Character,
  userInput: string,
): ChatResult {
  const trimmed = userInput.trim();
  const ts = nowMs();

  const userMsg: ChatMessage = {
    id: `user-${ts}`,
    role: 'user',
    content: trimmed,
    segments: [{ type: 'speech', text: trimmed }],
    timestamp: ts,
  };

  const intent = analyzeIntent(trimmed);
  const triggerDelta = { ...intent.emotion_delta };

  const baseline = character.emotion.baseline;
  const inertia = character.emotion.inertia;
  let newEmotion = updateEmotionWithInertia(state.emotion, baseline, inertia, triggerDelta);

  const { drawn, updated: updatedThreads } = processThreads(state.backgroundThreads);

  const { delta: memoryDelta, reactions, updatedAnchors } = checkMemoryAnchors(
    character,
    trimmed,
    intent,
    state.triggeredAnchors,
  );
  if (Object.keys(memoryDelta).length > 0) {
    newEmotion = addEmotion(newEmotion, memoryDelta);
  }

  const recent = state.messages.slice(-6);

  const rawReply = mockGenerate(character, newEmotion, intent);
  const post = runPostprocessor(rawReply, character);

  const charMsg: ChatMessage = {
    id: `char-${ts}`,
    role: 'character',
    content: post.cleaned_text,
    segments: post.segments as MessageSegment[],
    timestamp: nowMs(),
    character_id: character.character_id,
  };

  return {
    reply: charMsg,
    emotion: newEmotion,
    backgroundThreads: updatedThreads,
    triggeredAnchors: updatedAnchors,
    intent,
    fallback: true,
  };
}

export function createSessionState(character: Character): SessionState {
  return {
    sessionId: '',
    characterId: character.character_id,
    characterName: character.name,
    emotion: { ...character.emotion.baseline },
    backgroundThreads: cloneThreads(character.background_threads.active),
    triggeredAnchors: [],
    messages: [],
  };
}

export function switchCharacterState(
  state: SessionState,
  newCharacter: Character,
): SessionState {
  const ts = nowMs();
  const switchMsg: ChatMessage = {
    id: `sys-${ts}`,
    role: 'character',
    content: `（已切换到角色：${newCharacter.name}）`,
    segments: [{ type: 'thought', text: `已切换到角色：${newCharacter.name}` }],
    timestamp: ts,
    character_id: newCharacter.character_id,
  };

  return {
    ...state,
    characterId: newCharacter.character_id,
    characterName: newCharacter.name,
    emotion: { ...newCharacter.emotion.baseline },
    backgroundThreads: cloneThreads(newCharacter.background_threads.active),
    triggeredAnchors: [],
    messages: [...state.messages, switchMsg],
  };
}

export function resetEmotionState(state: SessionState, character: Character): SessionState {
  return {
    ...state,
    emotion: { ...character.emotion.baseline },
  };
}

export function clearHistoryState(state: SessionState): SessionState {
  return {
    ...state,
    messages: [],
    triggeredAnchors: [],
  };
}

export { getCharacterOrDefault };
