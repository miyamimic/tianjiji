export type EmotionKey = 'anger' | 'fear' | 'joy' | 'sadness' | 'desire' | 'warmth';

export type EmotionVector = {
  anger: number;
  fear: number;
  joy: number;
  sadness: number;
  desire: number;
  warmth: number;
};

export type EmotionTrigger = {
  keywords: string[];
  delta: Partial<EmotionVector>;
};

export type BackgroundThread = {
  content: string;
  remaining_turns: number;
};

export type MemoryAnchor = {
  trigger: string;
  emotion_shift: Partial<EmotionVector>;
  reaction: string;
  weight: number;
};

export type DynamicMemory = {
  id: string;
  character_id: string;
  topic_keywords: string[];
  emotion_type: EmotionKey;
  intensity: number; // 1-5
  user_trigger_summary: string;
  character_reaction_summary: string;
  created_at: number;
  last_recalled_at?: number;
  recall_count: number;
};

export type TriggeredAnchor = {
  anchor: MemoryAnchor;
  triggered_at: number;
};

export type ActionTendency = {
  control_actions: string[];
  touch_actions: string[];
  forbidden_actions: string[];
  control_affinity: number;
  touch_affinity: number;
};

export type SpeechStyle = {
  catchphrases: string[];
  forbidden_phrases: string[];
};

export type CharacterCore = {
  values: string[];
  instinct_base: 'attack' | 'avoid' | 'freeze' | 'fawn' | 'observe';
  speech_filter: 'rough' | 'gentle' | 'formal' | 'casual';
};

export type Character = {
  character_id: string;
  name: string;
  core: CharacterCore;
  emotion: {
    current: EmotionVector;
    baseline: EmotionVector;
    inertia: EmotionVector;
    triggers: EmotionTrigger[];
  };
  background_threads: {
    active: BackgroundThread[];
  };
  memory: {
    anchors: MemoryAnchor[];
  };
  action_tendency: ActionTendency;
  speech: SpeechStyle;
};

export type SegmentType = 'speech' | 'action' | 'thought';

export type MessageSegment = {
  type: SegmentType;
  text: string;
};

export type EngineSnapshot = {
  emotion: EmotionVector;
  backgroundThreads: BackgroundThread[];
  triggeredAnchors: TriggeredAnchor[];
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'character';
  content: string;
  segments: MessageSegment[];
  timestamp: number;
  character_id?: string;
  snapshot?: EngineSnapshot;
  llmError?: string;
};

export type IntentAnalysis = {
  intent: string;
  intent_label: string;
  emotion_delta: Partial<EmotionVector>;
  entities: string[];
  sentiment: string;
  confidence: number;
  notes: string;
};

export const EMOTION_KEYS: EmotionKey[] = [
  'anger', 'fear', 'joy', 'sadness', 'desire', 'warmth',
];

export const EMOTION_NAMES: Record<EmotionKey, string> = {
  anger: '愤怒',
  fear: '恐惧',
  joy: '喜悦',
  sadness: '悲伤',
  desire: '欲望',
  warmth: '温情',
};

export const INSTINCT_DESCRIPTIONS: Record<string, string> = {
  attack: '面对压力时你的本能是主动出击，除非你主动选择压制',
  avoid: '面对压力时你的本能是回避和逃离，除非你主动选择面对',
  freeze: '面对压力时你的本能是僵住和沉默，除非你主动选择反应',
  fawn: '面对压力时你的本能是讨好和迎合，除非你主动选择坚持',
  observe: '面对压力时你的本能是先观察再行动，除非你主动选择介入',
};

export const SPEECH_FILTER_DESCRIPTIONS: Record<string, string> = {
  rough: '说话粗糙、直接，不喜欢绕弯子，偶尔带脏字',
  gentle: '说话温柔、低沉，语速慢，喜欢用柔和的词',
  formal: '说话正式、克制，用词讲究，不带多余情绪',
  casual: '说话慵懒、随意，常用单字和短句，带点漫不经心',
};
