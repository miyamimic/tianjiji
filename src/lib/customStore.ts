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
      return JSON.parse(raw);
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
// 5. Hard Reset / Purge All Cache (解除设备锁定感)
// -------------------------------------------------------------

const ALL_KNOWN_KEYS = [
  CSS_STORAGE_KEY,
  WORDS_STORAGE_KEY,
  CHARS_STORAGE_KEY,
  USER_PROFILE_KEY,
  '__rp_engine_state',
  '__rp_engine_llm_config',
];

/**
 * 清除所有本地缓存数据，解决"设备卡死"、"关掉再开还是旧数据"的问题。
 * 包含：引擎状态、角色编辑、敏感词、CSS、主控档案、LLM配置
 */
export function hardResetAllLocalData(): void {
  try {
    for (const key of ALL_KNOWN_KEYS) {
      localStorage.removeItem(key);
    }
    // 兜底：扫一下所有 key，清掉带 __rp_engine_ 前缀的
    const prefix = '__rp_engine_';
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        toRemove.push(k);
      }
    }
    for (const k of toRemove) {
      localStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
}

