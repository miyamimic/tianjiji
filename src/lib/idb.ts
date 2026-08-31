// Pure TypeScript IndexedDB Storage Engine for Tianjiji / Roleplay Engine
// Versioned, robust, zero-dependency with synchronous in-memory caching and seamless fallback

import type { 
  ChatMessage, 
  EmotionVector, 
  BackgroundThread, 
  TriggeredAnchor, 
  Character, 
  DynamicMemory 
} from '../data/types';
import { MOCK_CHARACTERS } from '../data/characters';

const DB_NAME = 'rp_roleplay_engine_db';
const DB_VERSION = 3;

export interface DBChatSession {
  characterId: string;
  characterName?: string;
  emotion: EmotionVector;
  backgroundThreads: BackgroundThread[];
  triggeredAnchors: TriggeredAnchor[];
  messages: ChatMessage[];
  updatedAt: number;
}

export interface DBCharacterExtra {
  avatar?: string;
  visual_desc?: string;
  min_bubbles?: number;
  gomoku_rank?: string;
  custom_system_prompt?: string;
}

export interface DBGameMatchRecord {
  id: string;
  gameType?: 'gomoku' | 'ghost_card';
  characterId: string;
  characterName: string;
  playerColor?: 'B' | 'W';
  winner: 'player' | 'character' | 'draw' | 'surrender';
  totalMoves: number;
  totalRounds?: number;
  moves?: Array<{
    step: number;
    r: number;
    c: number;
    color: 'B' | 'W';
    timestamp: number;
  }>;
  chats: Array<{
    id: string;
    sender: 'user' | 'character' | 'system';
    text: string;
    thought?: string;
    moveStep?: number;
    timestamp: number;
  }>;
  summary: string;
  timestamp: number;
  gameTotalDelta?: Record<string, number>;
  emotionApplied?: boolean;
  stepLogs?: Array<{
    step?: number;
    round?: number;
    coord?: [number, number];
    color?: 'B' | 'W';
    drawnCard?: any;
    innerThought?: string;
    spokenDialogue?: string;
    emotionDelta?: Record<string, number>;
    timestamp: number;
  }>;
  sandbaggingReport?: {
    isPlayerSandbagging: boolean;
    abandonedBestPoints: Array<{
      coord: [number, number];
      reason: string;
      missedAdvantage: number;
    }>;
  };
  rewardOrPunishment?: string;
  keyMoments?: Array<{
    round: number;
    event: string;
    detail: string;
  }>;
  bluffStats?: {
    userBluffCount: number;
    charBluffCount: number;
    charBelievedCount: number;
  };
}

export interface DBGameInvite {
  id: string;
  gameType: 'gomoku' | 'ghost_card';
  characterId: string;
  characterName: string;
  inviteText: string;
  timestamp: number;
  status: 'pending' | 'accepted' | 'rejected' | 'dismissed';
}

export interface DBIntimacyMilestone {
  id: string;
  characterId: string;
  title: string;
  description: string;
  type: 'game_win' | 'game_loss' | 'game_draw' | 'game_refuse' | 'deep_chat' | 'emotion_peak';
  timestamp: number;
}

// In-Memory Fast Cache for instant synchronous access
const memCache = {
  sessions: new Map<string, DBChatSession>(),
  characters: new Map<string, Character>(),
  charExtras: new Map<string, DBCharacterExtra>(),
  memories: new Map<string, DynamicMemory[]>(),
  settings: new Map<string, any>(),
  initialized: false,
};

function openDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }

    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e: IDBVersionChangeEvent) => {
        const db = req.result;

        // 1. Chat Sessions Store (Per-character chat history and emotion state)
        if (!db.objectStoreNames.contains('chat_sessions')) {
          const sessionStore = db.createObjectStore('chat_sessions', { keyPath: 'characterId' });
          sessionStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // 2. Characters Store
        if (!db.objectStoreNames.contains('characters')) {
          db.createObjectStore('characters', { keyPath: 'character_id' });
        }

        // 3. Dynamic Memories Store (Per-character dynamic memories array)
        if (!db.objectStoreNames.contains('dynamic_memories')) {
          db.createObjectStore('dynamic_memories', { keyPath: 'charId' });
        }

        // 4. Key-Value Settings Store
        if (!db.objectStoreNames.contains('settings_kv')) {
          db.createObjectStore('settings_kv', { keyPath: 'key' });
        }

        // 5. Game Matches Store
        if (!db.objectStoreNames.contains('game_matches')) {
          const matchStore = db.createObjectStore('game_matches', { keyPath: 'id' });
          matchStore.createIndex('characterId', 'characterId', { unique: false });
          matchStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // 6. Game Invitations Store
        if (!db.objectStoreNames.contains('game_invitations')) {
          const inviteStore = db.createObjectStore('game_invitations', { keyPath: 'id' });
          inviteStore.createIndex('characterId', 'characterId', { unique: false });
          inviteStore.createIndex('status', 'status', { unique: false });
        }

        // 7. Intimacy Milestones Store
        if (!db.objectStoreNames.contains('intimacy_milestones')) {
          const milestoneStore = db.createObjectStore('intimacy_milestones', { keyPath: 'id' });
          milestoneStore.createIndex('characterId', 'characterId', { unique: false });
          milestoneStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // 8. Stickers Store
        if (!db.objectStoreNames.contains('stickers')) {
          db.createObjectStore('stickers', { keyPath: 'id' });
        }
      };

      req.onsuccess = () => {
        resolve(req.result);
      };

      req.onerror = () => {
        resolve(null);
      };

      req.onblocked = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

// -------------------------------------------------------------
// Core Generic IndexedDB Helpers
// -------------------------------------------------------------

async function idbGet<T>(storeName: string, key: IDBValidKey): Promise<T | null> {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGetAll<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

async function idbPut<T>(storeName: string, value: T): Promise<void> {
  const db = await openDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbDelete(storeName: string, key: IDBValidKey): Promise<void> {
  const db = await openDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbClear(storeName: string): Promise<void> {
  const db = await openDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

// -------------------------------------------------------------
// 1. Chat Sessions (Messages & State per character)
// -------------------------------------------------------------

const STORAGE_PREFIX = '__rp_engine_char_state_';
const ACTIVE_CHAR_KEY = '__rp_engine_active_char_id';

export async function idbSaveChatSession(session: DBChatSession): Promise<void> {
  memCache.sessions.set(session.characterId, session);
  // Also sync to localStorage lightweight mirror for fastest synchronous bootstrapping if needed
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${session.characterId}`, JSON.stringify(session));
    localStorage.setItem(ACTIVE_CHAR_KEY, session.characterId);
  } catch {
    // localStorage full or disabled, safe to ignore since IndexedDB handles heavy data!
  }
  await idbPut('chat_sessions', session);
}

export function idbGetCachedChatSession(characterId: string): DBChatSession | null {
  if (memCache.sessions.has(characterId)) {
    return memCache.sessions.get(characterId)!;
  }
  // Try localStorage fallback
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${characterId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as DBChatSession;
      memCache.sessions.set(characterId, parsed);
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function idbLoadChatSession(characterId: string): Promise<DBChatSession | null> {
  const cached = idbGetCachedChatSession(characterId);
  const fromDb = await idbGet<DBChatSession>('chat_sessions', characterId);
  if (fromDb) {
    // Use whichever has more messages or newer timestamp
    if (!cached || (fromDb.messages && fromDb.messages.length >= (cached.messages?.length || 0))) {
      memCache.sessions.set(characterId, fromDb);
      return fromDb;
    }
  }
  return cached;
}

export async function idbLoadAllChatSessions(): Promise<DBChatSession[]> {
  const list = await idbGetAll<DBChatSession>('chat_sessions');
  const sessionMap = new Map<string, DBChatSession>();
  for (const s of list) {
    if (s && s.characterId) sessionMap.set(s.characterId, s);
  }
  // Check memory cache
  for (const [id, s] of memCache.sessions.entries()) {
    if (!sessionMap.has(id) || (s.messages && s.messages.length > (sessionMap.get(id)?.messages?.length || 0))) {
      sessionMap.set(id, s);
    }
  }
  // Also scan localStorage for any legacy unmigrated sessions
  try {
    if (typeof window !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) {
          const charId = k.replace(STORAGE_PREFIX, '');
          if (!sessionMap.has(charId)) {
            const raw = localStorage.getItem(k);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed && parsed.characterId) {
                sessionMap.set(charId, parsed);
              }
            }
          }
        }
      }
    }
  } catch {
    // ignore
  }
  return Array.from(sessionMap.values());
}

export async function idbDeleteChatSession(characterId: string): Promise<void> {
  memCache.sessions.delete(characterId);
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${characterId}`);
  } catch {
    // ignore
  }
  await idbDelete('chat_sessions', characterId);
}

// -------------------------------------------------------------
// 2. Characters Store
// -------------------------------------------------------------

const CHARS_STORAGE_KEY = '__rp_engine_characters_edited';

export interface StoredCharacterDoc {
  character_id: string;
  character: Character;
  extra?: DBCharacterExtra;
  updatedAt: number;
}

export async function idbSaveCharacter(char: Character, extra?: DBCharacterExtra): Promise<void> {
  memCache.characters.set(char.character_id, char);
  if (extra) {
    memCache.charExtras.set(char.character_id, extra);
  }
  const doc: StoredCharacterDoc = {
    character_id: char.character_id,
    character: char,
    extra: extra || memCache.charExtras.get(char.character_id),
    updatedAt: Date.now(),
  };
  await idbPut('characters', doc);

  // Sync list to localStorage for fast sync init
  try {
    const list = Array.from(memCache.characters.values());
    localStorage.setItem(CHARS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export async function idbSaveAllCharacters(chars: Character[]): Promise<void> {
  for (const c of chars) {
    memCache.characters.set(c.character_id, c);
    const extra = memCache.charExtras.get(c.character_id);
    await idbPut('characters', {
      character_id: c.character_id,
      character: c,
      extra,
      updatedAt: Date.now(),
    });
  }
  try {
    localStorage.setItem(CHARS_STORAGE_KEY, JSON.stringify(chars));
  } catch {
    // ignore
  }
}

export async function idbLoadAllCharacters(): Promise<{ characters: Character[]; extras: Record<string, DBCharacterExtra> }> {
  const docs = await idbGetAll<StoredCharacterDoc>('characters');
  const charMap = new Map<string, Character>();
  const extraMap: Record<string, DBCharacterExtra> = {};

  for (const doc of docs) {
    if (doc && doc.character_id && doc.character) {
      charMap.set(doc.character_id, doc.character);
      if (doc.extra) {
        extraMap[doc.character_id] = doc.extra;
        memCache.charExtras.set(doc.character_id, doc.extra);
      }
    }
  }

  // Merge builtins
  for (const mock of MOCK_CHARACTERS) {
    if (!charMap.has(mock.character_id)) {
      charMap.set(mock.character_id, mock);
    }
  }

  // Update memory cache
  for (const [id, c] of charMap.entries()) {
    memCache.characters.set(id, c);
  }

  return {
    characters: Array.from(charMap.values()),
    extras: extraMap,
  };
}

// -------------------------------------------------------------
// 3. Dynamic Memories Store
// -------------------------------------------------------------

const DYNAMIC_MEMORIES_PREFIX = '__rp_engine_dynamic_memories_';

interface StoredMemoryDoc {
  charId: string;
  memories: DynamicMemory[];
  updatedAt: number;
}

export async function idbSaveDynamicMemories(charId: string, memories: DynamicMemory[]): Promise<void> {
  memCache.memories.set(charId, memories);
  try {
    localStorage.setItem(`${DYNAMIC_MEMORIES_PREFIX}${charId}`, JSON.stringify(memories));
  } catch {
    // ignore
  }
  await idbPut('dynamic_memories', {
    charId,
    memories,
    updatedAt: Date.now(),
  });
}

export async function idbLoadDynamicMemories(charId: string): Promise<DynamicMemory[]> {
  if (memCache.memories.has(charId)) {
    return memCache.memories.get(charId)!;
  }
  const doc = await idbGet<StoredMemoryDoc>('dynamic_memories', charId);
  if (doc && Array.isArray(doc.memories)) {
    memCache.memories.set(charId, doc.memories);
    return doc.memories;
  }
  // Try localStorage
  try {
    const raw = localStorage.getItem(`${DYNAMIC_MEMORIES_PREFIX}${charId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memCache.memories.set(charId, parsed);
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return [];
}

export async function idbLoadAllDynamicMemories(): Promise<Record<string, DynamicMemory[]>> {
  const docs = await idbGetAll<StoredMemoryDoc>('dynamic_memories');
  const result: Record<string, DynamicMemory[]> = {};
  for (const doc of docs) {
    if (doc && doc.charId && Array.isArray(doc.memories)) {
      result[doc.charId] = doc.memories;
      memCache.memories.set(doc.charId, doc.memories);
    }
  }
  // Scan localStorage for any unmigrated memories
  try {
    if (typeof window !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(DYNAMIC_MEMORIES_PREFIX)) {
          const charId = k.replace(DYNAMIC_MEMORIES_PREFIX, '');
          if (!result[charId]) {
            const raw = localStorage.getItem(k);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                result[charId] = parsed;
                memCache.memories.set(charId, parsed);
              }
            }
          }
        }
      }
    }
  } catch {
    // ignore
  }
  return result;
}

// -------------------------------------------------------------
// 4. Key-Value Settings Store
// -------------------------------------------------------------

interface StoredSettingDoc {
  key: string;
  value: any;
  updatedAt: number;
}

export async function idbSetSetting(key: string, value: any): Promise<void> {
  memCache.settings.set(key, value);
  try {
    if (typeof value === 'string') {
      localStorage.setItem(key, value);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    // ignore
  }
  await idbPut('settings_kv', {
    key,
    value,
    updatedAt: Date.now(),
  });
}

export async function idbGetSetting<T>(key: string, fallback?: T): Promise<T> {
  if (memCache.settings.has(key)) {
    return memCache.settings.get(key) as T;
  }
  const doc = await idbGet<StoredSettingDoc>('settings_kv', key);
  if (doc && doc.value !== undefined) {
    memCache.settings.set(key, doc.value);
    return doc.value as T;
  }
  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw);
        memCache.settings.set(key, parsed);
        return parsed as T;
      } catch {
        memCache.settings.set(key, raw);
        return raw as unknown as T;
      }
    }
  } catch {
    // ignore
  }
  return fallback as T;
}

export async function idbGetAllSettings(): Promise<Record<string, any>> {
  const docs = await idbGetAll<StoredSettingDoc>('settings_kv');
  const res: Record<string, any> = {};
  for (const doc of docs) {
    if (doc && doc.key) {
      res[doc.key] = doc.value;
      memCache.settings.set(doc.key, doc.value);
    }
  }
  return res;
}

// -------------------------------------------------------------
// 5. Game Matches, Invitations & Milestones Storage
// -------------------------------------------------------------

const MATCHES_LS_KEY = '__rp_game_matches_cache';
const INVITES_LS_KEY = '__rp_game_invites_cache';
const MILESTONES_LS_KEY = '__rp_intimacy_milestones_cache';

export async function idbSaveGameMatch(record: DBGameMatchRecord): Promise<void> {
  try {
    const raw = localStorage.getItem(MATCHES_LS_KEY);
    const list: DBGameMatchRecord[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex((m) => m && m.id === record.id);
    if (idx !== -1) list[idx] = record;
    else {
      list.unshift(record);
      if (list.length > 50) list.pop();
    }
    localStorage.setItem(MATCHES_LS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
  await idbPut('game_matches', record);
}

export async function idbLoadGameMatches(characterId?: string): Promise<DBGameMatchRecord[]> {
  const list = await idbGetAll<DBGameMatchRecord>('game_matches');
  if (list.length > 0) {
    if (characterId) {
      return list.filter((m) => m && m.characterId === characterId).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }
    return list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }
  // Try localStorage
  try {
    const raw = localStorage.getItem(MATCHES_LS_KEY);
    if (raw) {
      const parsed: DBGameMatchRecord[] = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        if (characterId) {
          return parsed.filter((m) => m && m.characterId === characterId);
        }
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return [];
}

export async function idbSaveInvitation(invite: DBGameInvite): Promise<void> {
  try {
    const raw = localStorage.getItem(INVITES_LS_KEY);
    const list: DBGameInvite[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex((i) => i && i.id === invite.id);
    if (idx !== -1) list[idx] = invite;
    else {
      list.unshift(invite);
      if (list.length > 30) list.pop();
    }
    localStorage.setItem(INVITES_LS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
  await idbPut('game_invitations', invite);
}

export async function idbLoadInvitations(characterId?: string): Promise<DBGameInvite[]> {
  const list = await idbGetAll<DBGameInvite>('game_invitations');
  if (list.length > 0) {
    if (characterId) {
      return list.filter((i) => i && i.characterId === characterId).sort((a, b) => b.timestamp - a.timestamp);
    }
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }
  try {
    const raw = localStorage.getItem(INVITES_LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return characterId ? parsed.filter((i) => i && i.characterId === characterId) : parsed;
      }
    }
  } catch {
    // ignore
  }
  return [];
}

export async function idbSaveIntimacyMilestone(milestone: DBIntimacyMilestone): Promise<void> {
  try {
    const raw = localStorage.getItem(MILESTONES_LS_KEY);
    const list: DBIntimacyMilestone[] = raw ? JSON.parse(raw) : [];
    list.unshift(milestone);
    if (list.length > 50) list.pop();
    localStorage.setItem(MILESTONES_LS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
  await idbPut('intimacy_milestones', milestone);
}

export async function idbLoadIntimacyMilestones(characterId?: string): Promise<DBIntimacyMilestone[]> {
  const list = await idbGetAll<DBIntimacyMilestone>('intimacy_milestones');
  if (list.length > 0) {
    if (characterId) {
      return list.filter((m) => m && m.characterId === characterId);
    }
    return list;
  }
  try {
    const raw = localStorage.getItem(MILESTONES_LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return characterId ? parsed.filter((m) => m && m.characterId === characterId) : parsed;
      }
    }
  } catch {
    // ignore
  }
  return [];
}

// -------------------------------------------------------------
// 6. Automated One-Time Migration from localStorage to IndexedDB
// -------------------------------------------------------------

const MIGRATION_DONE_KEY = '__rp_idb_migration_v3_complete';

export async function idbMigrateFromLocalStorage(): Promise<{
  migrated: boolean;
  chatCount: number;
  charCount: number;
  memoryCount: number;
}> {
  if (typeof window === 'undefined') {
    return { migrated: false, chatCount: 0, charCount: 0, memoryCount: 0 };
  }

  let chatCount = 0;
  let charCount = 0;
  let memoryCount = 0;

  try {
    // Check if already migrated
    const alreadyDone = localStorage.getItem(MIGRATION_DONE_KEY);
    if (alreadyDone === 'true') {
      // Warm up memory cache
      await idbLoadAllChatSessions();
      await idbLoadAllCharacters();
      await idbLoadAllDynamicMemories();
      memCache.initialized = true;
      return { migrated: false, chatCount: 0, charCount: 0, memoryCount: 0 };
    }

    console.info('[Tianjiji Storage] Performing one-time migration from localStorage to IndexedDB...');

    // 1. Migrate Chat Sessions
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        const charId = key.replace(STORAGE_PREFIX, '');
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as DBChatSession;
            if (parsed && parsed.characterId) {
              await idbSaveChatSession(parsed);
              chatCount++;
            }
          } catch {
            // ignore corrupt entry
          }
        }
      }
    }

    // 2. Migrate Characters
    const charsRaw = localStorage.getItem(CHARS_STORAGE_KEY);
    if (charsRaw) {
      try {
        const chars = JSON.parse(charsRaw);
        if (Array.isArray(chars)) {
          for (const char of chars) {
            if (char && char.character_id) {
              const avatar = localStorage.getItem(`__rp_engine_char_avatar_${char.character_id}`) || undefined;
              const visual_desc = localStorage.getItem(`__rp_engine_char_visual_desc_${char.character_id}`) || undefined;
              const min_bubbles_raw = localStorage.getItem(`__rp_engine_char_min_bubbles_${char.character_id}`);
              const min_bubbles = min_bubbles_raw ? parseInt(min_bubbles_raw, 10) : undefined;
              const gomoku_rank = localStorage.getItem(`__rp_engine_char_gomoku_rank_${char.character_id}`) || undefined;
              
              await idbSaveCharacter(char, {
                avatar,
                visual_desc,
                min_bubbles,
                gomoku_rank,
                custom_system_prompt: (char as any).custom_system_prompt,
              });
              charCount++;
            }
          }
        }
      } catch {
        // ignore
      }
    }

    // 3. Migrate Dynamic Memories
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DYNAMIC_MEMORIES_PREFIX)) {
        const charId = key.replace(DYNAMIC_MEMORIES_PREFIX, '');
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              await idbSaveDynamicMemories(charId, parsed);
              memoryCount += parsed.length;
            }
          } catch {
            // ignore
          }
        }
      }
    }

    // 4. Migrate Common Settings
    const settingKeys = [
      '__rp_engine_user_prompt_profile',
      '__rp_engine_user_avatar',
      '__rp_engine_user_visual_desc',
      '__rp_engine_prompt_layers_pipeline',
      '__rp_engine_prompt_layers_version',
      '__rp_engine_prompt_presets',
      '__rp_engine_active_prompt_preset_id',
      '__rp_engine_sensitive_words',
      '__rp_engine_custom_chat_bg',
      '__rp_engine_custom_system_prompt',
      '__rp_engine_structured_json_prompt',
      '__rp_engine_emotion_decay_rate',
      '__rp_engine_llm_config',
      '__rp_custom_stickers',
    ];

    for (const sk of settingKeys) {
      const val = localStorage.getItem(sk);
      if (val !== null) {
        try {
          const parsed = JSON.parse(val);
          await idbSetSetting(sk, parsed);
        } catch {
          await idbSetSetting(sk, val);
        }
      }
    }

    // Mark migration finished
    localStorage.setItem(MIGRATION_DONE_KEY, 'true');
    memCache.initialized = true;
    console.info(`[Tianjiji Storage] Migration complete! (${chatCount} chat sessions, ${charCount} characters, ${memoryCount} memories)`);

    return { migrated: true, chatCount, charCount, memoryCount };
  } catch (err) {
    console.warn('[Tianjiji Storage] Migration error:', err);
    memCache.initialized = true;
    return { migrated: false, chatCount, charCount, memoryCount };
  }
}
