import type { Character, EmotionKey } from '../data/types';
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
为了维持沉浸感与角色心理引擎的精准同步，你必须且只能返回纯 JSON 格式（可以直接返回或用 \`\`\`json 包裹）：
{
  "reply": "角色说出的自然对话内容（动作描写写在*星号*内，心理活动写在（中文括号）内）",
  "action": "角色此时的主要动作细节，如：微微俯身/指尖轻扣桌面",
  "thought": "角色此时不宣于口的内心微澜或独白",
  "emotion_delta": {
    "anger": 0.0,
    "fear": 0.0,
    "joy": 0.0,
    "sadness": 0.0,
    "desire": 0.0,
    "warmth": 0.0
  },
  "triggered_memory": "触发的具体回忆碎片（若无则填 null）"
}

说明与数值约束：
1. emotion_delta 各项数值范围为 -0.30 至 +0.30 之间的小数（如激怒时 anger: +0.2，被治愈时 warmth: +0.15, anger: -0.1）。请根据主控言行真实微调，避免极端满格。
2. reply 中必须融入生动的人设语言与动作描写，保持2~4句话的精炼对话体验。`;

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




