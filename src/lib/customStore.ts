import type { Character, EmotionKey, DynamicMemory } from '../data/types';
import { MOCK_CHARACTERS } from '../data/characters';

// -------------------------------------------------------------
// 1. Dynamic CSS Persistence
// -------------------------------------------------------------

const CSS_STORAGE_KEY = '__rp_engine_custom_css';

export function loadCustomCss(): string {
  try {
    return localStorage.getItem(CSS_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveCustomCss(css: string): void {
  try {
    localStorage.setItem(CSS_STORAGE_KEY, css);
    applyCustomCss(css);
  } catch {
    // ignore
  }
}

export function applyCustomCss(css: string): void {
  if (typeof document === 'undefined') return;
  let styleEl = document.getElementById('custom-user-css');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'custom-user-css';
    document.head.appendChild(styleEl);
  }
  styleEl.innerHTML = css;
}

// -------------------------------------------------------------
// 2. Sensitive Words / Lexicon Engine
// -------------------------------------------------------------

export type SensitiveWordRule = {
  id: string;
  word: string;
  category: string;
  action: 'censor' | 'block' | 'emotion';
  emotionKey?: EmotionKey;
  emotionDelta?: number;
};

const WORDS_STORAGE_KEY = '__rp_engine_sensitive_words';

export const DEFAULT_SENSITIVE_WORDS: SensitiveWordRule[] = [
  { id: 'sw_1', word: '他妈', category: '粗俗言语', action: 'censor' },
  { id: 'sw_2', word: '傻逼', category: '粗俗言语', action: 'block' },
  { id: 'sw_3', word: '操你', category: '粗俗言语', action: 'block' },
  { id: 'sw_4', word: '逼嘴', category: '粗俗言语', action: 'censor' },
  { id: 'sw_5', word: '自杀', category: '极端词汇', action: 'emotion', emotionKey: 'sadness', emotionDelta: 0.5 },
  { id: 'sw_6', word: '跳楼', category: '极端词汇', action: 'emotion', emotionKey: 'fear', emotionDelta: 0.6 },
  { id: 'sw_7', word: '滚开', category: '人身攻击', action: 'emotion', emotionKey: 'anger', emotionDelta: 0.5 },
  { id: 'sw_8', word: '死女人', category: '人身攻击', action: 'block' },
  { id: 'sw_9', word: '垃圾', category: '粗俗言语', action: 'censor' },
  { id: 'sw_10', word: '不想活了', category: '极端词汇', action: 'emotion', emotionKey: 'sadness', emotionDelta: 0.4 },
];

export function loadSensitiveWords(): SensitiveWordRule[] {
  try {
    const raw = localStorage.getItem(WORDS_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  // Initialize with default if empty
  try {
    localStorage.setItem(WORDS_STORAGE_KEY, JSON.stringify(DEFAULT_SENSITIVE_WORDS));
  } catch {
    // ignore
  }
  return DEFAULT_SENSITIVE_WORDS;
}

export function saveSensitiveWords(words: SensitiveWordRule[]): void {
  try {
    localStorage.setItem(WORDS_STORAGE_KEY, JSON.stringify(words));
  } catch {
    // ignore
  }
}

export type MatchResult = {
  matched: boolean;
  blocked: boolean;
  censoredText: string;
  triggeredEmotion?: {
    key: EmotionKey;
    delta: number;
  };
  matchedWords: string[];
};

/**
 * Checks a user message against the sensitive dictionary before it is sent
 */
export function checkSensitiveWords(text: string): MatchResult {
  const rules = loadSensitiveWords();
  let censoredText = text;
  let blocked = false;
  let matched = false;
  let triggeredEmotion: { key: EmotionKey; delta: number } | undefined = undefined;
  const matchedWords: string[] = [];

  // Sort rules by word length descending so we match longer phrases first
  const sortedRules = [...rules].sort((a, b) => b.word.length - a.word.length);

  for (const rule of sortedRules) {
    if (!rule.word.trim()) continue;
    if (text.includes(rule.word)) {
      matched = true;
      matchedWords.push(rule.word);

      if (rule.action === 'block') {
        blocked = true;
      } else if (rule.action === 'censor') {
        const stars = '*'.repeat(rule.word.length);
        censoredText = censoredText.replaceAll(rule.word, stars);
      } else if (rule.action === 'emotion' && rule.emotionKey && rule.emotionDelta) {
        triggeredEmotion = {
          key: rule.emotionKey,
          delta: rule.emotionDelta,
        };
      }
    }
  }

  return {
    matched,
    blocked,
    censoredText,
    triggeredEmotion,
    matchedWords,
  };
}

// -------------------------------------------------------------
// 3. Dynamic Character Profiles Storage
// -------------------------------------------------------------

const CHARS_STORAGE_KEY = '__rp_engine_characters_edited';

export function loadSavedCharacters(): Character[] {
  try {
    const raw = localStorage.getItem(CHARS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const map = new Map<string, Character>();
        for (const c of parsed) {
          if (c && c.character_id) map.set(c.character_id, c);
        }
        for (const c of MOCK_CHARACTERS) {
          if (!map.has(c.character_id)) map.set(c.character_id, c);
        }
        return Array.from(map.values());
      }
    }
  } catch {
    // ignore
  }
  // If not edited yet, return the default mock characters
  return MOCK_CHARACTERS;
}

export function saveCharacterEdit(character: Character): void {
  try {
    const current = loadSavedCharacters();
    const idx = current.findIndex((c) => c.character_id === character.character_id);
    if (idx !== -1) {
      current[idx] = character;
    } else {
      current.push(character);
    }
    localStorage.setItem(CHARS_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore
  }
}

export interface CreateCharacterInput {
  name: string;
  avatar?: string;
  instinct_base?: 'attack' | 'avoid' | 'freeze' | 'fawn' | 'observe';
  speech_filter?: 'rough' | 'gentle' | 'formal' | 'casual';
  values?: string[];
  catchphrases?: string[];
  forbidden_phrases?: string[];
  custom_system_prompt?: string;
  min_bubbles?: number;
}

export function createCustomCharacter(input: CreateCharacterInput): Character {
  const id = `char_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const newChar: Character = {
    character_id: id,
    name: input.name.trim() || '新角色',
    core: {
      values: input.values && input.values.length > 0 ? input.values : ['专属设定', '独立个性'],
      instinct_base: input.instinct_base || 'observe',
      speech_filter: input.speech_filter || 'casual',
    },
    emotion: {
      current: { anger: 0.1, fear: 0.1, joy: 0.3, sadness: 0.1, desire: 0.3, warmth: 0.3 },
      baseline: { anger: 0.1, fear: 0.1, joy: 0.3, sadness: 0.1, desire: 0.3, warmth: 0.3 },
      inertia: { anger: 0.6, fear: 0.6, joy: 0.5, sadness: 0.6, desire: 0.5, warmth: 0.5 },
      triggers: [
        { keywords: ['不行', '做不到', '不能'], delta: { anger: 0.4, desire: 0.2 } },
        { keywords: ['乖', '听话', '好吗'], delta: { warmth: 0.3, desire: 0.2 } },
        { keywords: ['想你', '想见你', '等你'], delta: { joy: 0.4, warmth: 0.4 } },
      ],
    },
    background_threads: {
      active: [
        { content: '初次相识，静静注视着你的一举一动', remaining_turns: 3 },
      ],
    },
    memory: {
      anchors: [],
    },
    action_tendency: {
      control_actions: ['注视着你', '缓步靠近', '微微偏头'],
      touch_actions: ['指尖轻触', '递过一杯水', '轻按手背'],
      forbidden_actions: ['粗暴伤害', '人格贬损'],
      control_affinity: 0.5,
      touch_affinity: 0.6,
    },
    speech: {
      catchphrases:
        input.catchphrases && input.catchphrases.length > 0
          ? input.catchphrases
          : ['嗯', '有意思', '过来'],
      forbidden_phrases:
        input.forbidden_phrases && input.forbidden_phrases.length > 0
          ? input.forbidden_phrases
          : ['对不起嘛', '求求你', '我不行'],
    },
  };

  if (input.custom_system_prompt) {
    (newChar as any).custom_system_prompt = input.custom_system_prompt.trim();
  }

  saveCharacterEdit(newChar);

  if (input.avatar) {
    saveCharAvatar(id, input.avatar);
  }
  if (input.min_bubbles) {
    saveCharMinBubbles(id, input.min_bubbles);
  }

  return newChar;
}

export function resetCharactersToDefault(): void {
  try {
    localStorage.removeItem(CHARS_STORAGE_KEY);
  } catch {
    // ignore
  }
}

// -------------------------------------------------------------
// 4. User Persona Profile (主控角色档案)
// -------------------------------------------------------------

const USER_PROFILE_KEY = '__rp_engine_user_prompt_profile';
const DEFAULT_USER_PROFILE = '一个有些敏感、寻求关怀并试图在这里获得真实情感互动的探访者。';

export function loadUserPromptProfile(): string {
  try {
    return localStorage.getItem(USER_PROFILE_KEY) || DEFAULT_USER_PROFILE;
  } catch {
    return DEFAULT_USER_PROFILE;
  }
}

export function saveUserPromptProfile(profile: string): void {
  try {
    localStorage.setItem(USER_PROFILE_KEY, profile);
  } catch {
    // ignore
  }
}

// -------------------------------------------------------------
// 5. Custom Chat Background Image Storage
// -------------------------------------------------------------

const CHAT_BG_STORAGE_KEY = '__rp_engine_custom_chat_bg';

export function loadCustomChatBg(): string {
  try {
    return localStorage.getItem(CHAT_BG_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveCustomChatBg(dataUrlOrUrl: string): void {
  try {
    if (!dataUrlOrUrl) {
      localStorage.removeItem(CHAT_BG_STORAGE_KEY);
    } else {
      localStorage.setItem(CHAT_BG_STORAGE_KEY, dataUrlOrUrl);
    }
  } catch {
    // ignore
  }
}

export function removeCustomChatBg(): void {
  try {
    localStorage.removeItem(CHAT_BG_STORAGE_KEY);
  } catch {
    // ignore
  }
}

// -------------------------------------------------------------
// 6. User and Character Avatars & Vision Descriptions
// -------------------------------------------------------------

const USER_AVATAR_KEY = '__rp_engine_user_avatar';
const USER_VISUAL_DESC_KEY = '__rp_engine_user_visual_desc';
const CHAR_AVATAR_PREFIX = '__rp_engine_char_avatar_';
const CHAR_VISUAL_DESC_PREFIX = '__rp_engine_char_visual_desc_';

export function loadUserAvatar(): string {
  try {
    return localStorage.getItem(USER_AVATAR_KEY) || '';
  } catch {
    return '';
  }
}

export function saveUserAvatar(urlOrData: string): void {
  try {
    if (!urlOrData) {
      localStorage.removeItem(USER_AVATAR_KEY);
    } else {
      localStorage.setItem(USER_AVATAR_KEY, urlOrData);
    }
  } catch {
    // ignore
  }
}

export function loadUserVisualDesc(): string {
  try {
    return localStorage.getItem(USER_VISUAL_DESC_KEY) || '';
  } catch {
    return '';
  }
}

export function saveUserVisualDesc(desc: string): void {
  try {
    localStorage.setItem(USER_VISUAL_DESC_KEY, desc);
  } catch {
    // ignore
  }
}

export function loadCharAvatar(charId: string): string {
  try {
    return localStorage.getItem(`${CHAR_AVATAR_PREFIX}${charId}`) || '';
  } catch {
    return '';
  }
}

export function saveCharAvatar(charId: string, urlOrData: string): void {
  try {
    if (!urlOrData) {
      localStorage.removeItem(`${CHAR_AVATAR_PREFIX}${charId}`);
    } else {
      localStorage.setItem(`${CHAR_AVATAR_PREFIX}${charId}`, urlOrData);
    }
  } catch {
    // ignore
  }
}

export function loadCharVisualDesc(charId: string): string {
  try {
    return localStorage.getItem(`${CHAR_VISUAL_DESC_PREFIX}${charId}`) || '';
  } catch {
    return '';
  }
}

export function saveCharVisualDesc(charId: string, desc: string): void {
  try {
    localStorage.setItem(`${CHAR_VISUAL_DESC_PREFIX}${charId}`, desc);
  } catch {
    // ignore
  }
}

// -------------------------------------------------------------
// 7. Structured Prompt & System Injection Architect
// -------------------------------------------------------------

const CUSTOM_SYSTEM_PROMPT_KEY = '__rp_engine_custom_system_prompt';
const STRUCTURED_JSON_SCHEMA_PROMPT_KEY = '__rp_engine_structured_json_prompt';
const EMOTION_DECAY_RATE_KEY = '__rp_engine_emotion_decay_rate';

export const DEFAULT_STRUCTURED_JSON_PROMPT = `【强制结构化输出规范】
为了维持沉浸感与角色心理引擎的精准同步，你必须且只能返回纯 JSON 格式（可以直接返回或用 \`\`\`json 包裹）。
支持单条消息返回单个 JSON 对象，或多段连发返回 JSON 数组（1~3条气泡消息，模拟真人连发打字体验）：
[
  {
    "reply": "角色第一句自然对话（动作描写写在*星号*内，心理活动写在（中文括号）内）",
    "action": "角色此时的主要动作细节，如：微微俯身/指尖轻扣桌面",
    "thought": "角色此时不宣于口的内心微澜或独白",
    "emotion_intensity": 3,
    "emotion_delta": {
      "anger": 0.0,
      "fear": 0.0,
      "joy": 0.0,
      "sadness": 0.0,
      "desire": 0.0,
      "warmth": 0.0
    },
    "triggered_memory": "触发的具体回忆碎片（若无则填 null）"
  },
  {
    "reply": "角色跟进说的第二句或递进话语（可选）",
    "action": "递进微动作（可选）",
    "thought": "递进心理活动（可选）",
    "emotion_intensity": 3,
    "emotion_delta": {
      "anger": 0.0,
      "fear": 0.0,
      "joy": 0.0,
      "sadness": 0.0,
      "desire": 0.0,
      "warmth": 0.0
    },
    "triggered_memory": null
  }
]

说明与数值约束：
1. emotion_intensity: 情绪强度评级（整数 1~5 级）：
   - 1: 平静/极微弱波澜
   - 2: 轻度触动
   - 3: 中度标准波动
   - 4: 强烈冲击（如明显被激怒、破防、动容）
   - 5: 剧烈/极端高潮（如情绪爆发、彻底失控、深层共情）
2. emotion_delta: 各项数值填写基准方向（如激怒时 anger: +0.2，被治愈时 warmth: +0.15）。引擎将自动结合 emotion_intensity 综合校准实际增量。
3. reply 中必须融入生动的人设语言与动作描写，每条消息精炼富有画面感。`;

export function loadCustomSystemPrompt(): string {
  try {
    return localStorage.getItem(CUSTOM_SYSTEM_PROMPT_KEY) || '';
  } catch {
    return '';
  }
}

export function saveCustomSystemPrompt(prompt: string): void {
  try {
    localStorage.setItem(CUSTOM_SYSTEM_PROMPT_KEY, prompt);
  } catch {
    // ignore
  }
}

export function loadStructuredJsonPrompt(): string {
  try {
    return localStorage.getItem(STRUCTURED_JSON_SCHEMA_PROMPT_KEY) || DEFAULT_STRUCTURED_JSON_PROMPT;
  } catch {
    return DEFAULT_STRUCTURED_JSON_PROMPT;
  }
}

export function saveStructuredJsonPrompt(prompt: string): void {
  try {
    localStorage.setItem(STRUCTURED_JSON_SCHEMA_PROMPT_KEY, prompt);
  } catch {
    // ignore
  }
}

export function loadEmotionDecayRate(): number {
  try {
    const v = localStorage.getItem(EMOTION_DECAY_RATE_KEY);
    if (v !== null) {
      const n = parseFloat(v);
      if (!isNaN(n)) return Math.max(0, Math.min(0.5, n));
    }
  } catch {
    // ignore
  }
  return 0.12; // default 12% decay per turn towards baseline
}

export function saveEmotionDecayRate(rate: number): void {
  try {
    localStorage.setItem(EMOTION_DECAY_RATE_KEY, String(rate));
  } catch {
    // ignore
  }
}

// -------------------------------------------------------------
// 8. Character Min Reply Bubbles Configuration (单次最少回复气泡数)
// -------------------------------------------------------------

const CHAR_MIN_BUBBLES_PREFIX = '__rp_engine_char_min_bubbles_';

export function loadCharMinBubbles(charId: string): number {
  try {
    const raw = localStorage.getItem(`${CHAR_MIN_BUBBLES_PREFIX}${charId}`);
    if (raw !== null) {
      const num = parseInt(raw, 10);
      if (!isNaN(num) && num >= 1 && num <= 8) {
        return num;
      }
    }
  } catch {
    // ignore
  }
  return 1; // Default minimum 1 bubble
}

export function saveCharMinBubbles(charId: string, count: number): void {
  try {
    const clamped = Math.max(1, Math.min(8, Math.round(count)));
    localStorage.setItem(`${CHAR_MIN_BUBBLES_PREFIX}${charId}`, String(clamped));
  } catch {
    // ignore
  }
}

// -------------------------------------------------------------
// 9. Dynamic High-Emotion Episodic Memories (情绪记忆联动持久化)
// -------------------------------------------------------------

const DYNAMIC_MEMORIES_PREFIX = '__rp_engine_dynamic_memories_';

export function loadDynamicMemories(charId: string): DynamicMemory[] {
  try {
    const raw = localStorage.getItem(`${DYNAMIC_MEMORIES_PREFIX}${charId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveDynamicMemory(charId: string, memory: DynamicMemory): void {
  try {
    const list = loadDynamicMemories(charId);
    // deduplicate or update
    const existingIdx = list.findIndex((m) => m.id === memory.id);
    if (existingIdx !== -1) {
      list[existingIdx] = memory;
    } else {
      list.unshift(memory);
      // Keep up to 30 most recent dynamic memories per character
      if (list.length > 30) list.pop();
    }
    localStorage.setItem(`${DYNAMIC_MEMORIES_PREFIX}${charId}`, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function findRelevantDynamicMemories(charId: string, text: string): DynamicMemory[] {
  const memories = loadDynamicMemories(charId);
  if (memories.length === 0 || !text.trim()) return [];

  const lowerText = text.toLowerCase();
  const matched: DynamicMemory[] = [];

  for (const m of memories) {
    const hasKeyword = m.topic_keywords.some((kw) => kw && lowerText.includes(kw.toLowerCase()));
    if (hasKeyword) {
      matched.push(m);
    }
  }

  return matched.slice(0, 3);
}

export function clearDynamicMemories(charId: string): void {
  try {
    localStorage.removeItem(`${DYNAMIC_MEMORIES_PREFIX}${charId}`);
  } catch {
    // ignore
  }
}






