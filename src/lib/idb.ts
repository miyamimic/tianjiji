// Pure TypeScript IndexedDB Storage Engine for Roleplay Applet
// Robust, versioned, zero-dependency with seamless localStorage fallback

const DB_NAME = 'rp_roleplay_engine_db';
const DB_VERSION = 2;

export interface DBGameMatchRecord {
  id: string;
  characterId: string;
  characterName: string;
  playerColor: 'B' | 'W';
  winner: 'player' | 'character' | 'draw' | 'surrender';
  totalMoves: number;
  moves: Array<{
    step: number;
    r: number;
    c: number;
    color: 'B' | 'W';
    timestamp: number;
  }>;
  chats: Array<{
    id: string;
    sender: 'user' | 'character';
    text: string;
    timestamp: number;
  }>;
  summary: string;
  timestamp: number;
}

export interface DBGameInvite {
  id: string;
  gameType: 'gomoku';
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
        // 1. Store for game matches log
        if (!db.objectStoreNames.contains('game_matches')) {
          const matchStore = db.createObjectStore('game_matches', { keyPath: 'id' });
          matchStore.createIndex('characterId', 'characterId', { unique: false });
          matchStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // 2. Store for game invitations
        if (!db.objectStoreNames.contains('game_invitations')) {
          const inviteStore = db.createObjectStore('game_invitations', { keyPath: 'id' });
          inviteStore.createIndex('characterId', 'characterId', { unique: false });
          inviteStore.createIndex('status', 'status', { unique: false });
        }

        // 3. Store for intimacy milestones
        if (!db.objectStoreNames.contains('intimacy_milestones')) {
          const milestoneStore = db.createObjectStore('intimacy_milestones', { keyPath: 'id' });
          milestoneStore.createIndex('characterId', 'characterId', { unique: false });
          milestoneStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // 4. Store for main world state snapshots
        if (!db.objectStoreNames.contains('main_world_state')) {
          db.createObjectStore('main_world_state', { keyPath: 'characterId' });
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
// 1. Game Matches Storage
// -------------------------------------------------------------

const MATCHES_LS_KEY = '__rp_game_matches_cache';

function getMatchesFromLS(characterId?: string): DBGameMatchRecord[] {
  try {
    const raw = localStorage.getItem(MATCHES_LS_KEY);
    if (!raw) return [];
    const list: DBGameMatchRecord[] = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    if (characterId) {
      return list.filter((m) => m && m.characterId === characterId);
    }
    return list;
  } catch {
    return [];
  }
}

function saveMatchToLS(record: DBGameMatchRecord): void {
  try {
    const list = getMatchesFromLS();
    const existingIdx = list.findIndex((m) => m && m.id === record.id);
    if (existingIdx !== -1) {
      list[existingIdx] = record;
    } else {
      list.unshift(record);
      if (list.length > 50) list.pop(); // Keep recent 50
    }
    localStorage.setItem(MATCHES_LS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export async function idbSaveGameMatch(record: DBGameMatchRecord): Promise<void> {
  saveMatchToLS(record);
  try {
    const db = await openDB();
    if (!db) return;
    const tx = db.transaction('game_matches', 'readwrite');
    const store = tx.objectStore('game_matches');
    store.put(record);
  } catch {
    // fallback was handled
  }
}

export async function idbLoadGameMatches(characterId?: string): Promise<DBGameMatchRecord[]> {
  try {
    const db = await openDB();
    if (!db) return getMatchesFromLS(characterId);

    return new Promise((resolve) => {
      try {
        const tx = db.transaction('game_matches', 'readonly');
        const store = tx.objectStore('game_matches');
        const req = store.getAll();
        req.onsuccess = () => {
          const list: DBGameMatchRecord[] = req.result || [];
          if (characterId) {
            const filtered = list.filter((m) => m && m.characterId === characterId);
            resolve(filtered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
          } else {
            resolve(list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
          }
        };
        req.onerror = () => {
          resolve(getMatchesFromLS(characterId));
        };
      } catch {
        resolve(getMatchesFromLS(characterId));
      }
    });
  } catch {
    return getMatchesFromLS(characterId);
  }
}

// -------------------------------------------------------------
// 2. Game Invitations Storage
// -------------------------------------------------------------

const INVITES_LS_KEY = '__rp_game_invites_cache';

function getInvitesFromLS(): DBGameInvite[] {
  try {
    const raw = localStorage.getItem(INVITES_LS_KEY);
    if (!raw) return [];
    const list: DBGameInvite[] = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveInvitesToLS(list: DBGameInvite[]): void {
  try {
    localStorage.setItem(INVITES_LS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export async function idbSaveInvitation(invite: DBGameInvite): Promise<void> {
  const list = getInvitesFromLS();
  const idx = list.findIndex((i) => i && i.id === invite.id);
  if (idx !== -1) {
    list[idx] = invite;
  } else {
    list.unshift(invite);
    if (list.length > 30) list.pop();
  }
  saveInvitesToLS(list);

  try {
    const db = await openDB();
    if (!db) return;
    const tx = db.transaction('game_invitations', 'readwrite');
    const store = tx.objectStore('game_invitations');
    store.put(invite);
  } catch {
    // ignore
  }
}

export async function idbLoadInvitations(characterId?: string): Promise<DBGameInvite[]> {
  try {
    const db = await openDB();
    if (!db) {
      const list = getInvitesFromLS();
      return characterId ? list.filter((i) => i && i.characterId === characterId) : list;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction('game_invitations', 'readonly');
        const store = tx.objectStore('game_invitations');
        const req = store.getAll();
        req.onsuccess = () => {
          const list: DBGameInvite[] = req.result || [];
          if (characterId) {
            resolve(list.filter((i) => i && i.characterId === characterId).sort((a, b) => b.timestamp - a.timestamp));
          } else {
            resolve(list.sort((a, b) => b.timestamp - a.timestamp));
          }
        };
        req.onerror = () => {
          const list = getInvitesFromLS();
          resolve(characterId ? list.filter((i) => i && i.characterId === characterId) : list);
        };
      } catch {
        const list = getInvitesFromLS();
        resolve(characterId ? list.filter((i) => i && i.characterId === characterId) : list);
      }
    });
  } catch {
    const list = getInvitesFromLS();
    return characterId ? list.filter((i) => i && i.characterId === characterId) : list;
  }
}

// -------------------------------------------------------------
// 3. Intimacy Milestones Storage
// -------------------------------------------------------------

const MILESTONES_LS_KEY = '__rp_intimacy_milestones_cache';

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

  try {
    const db = await openDB();
    if (!db) return;
    const tx = db.transaction('intimacy_milestones', 'readwrite');
    const store = tx.objectStore('intimacy_milestones');
    store.put(milestone);
  } catch {
    // ignore
  }
}

export async function idbLoadIntimacyMilestones(characterId?: string): Promise<DBIntimacyMilestone[]> {
  try {
    const raw = localStorage.getItem(MILESTONES_LS_KEY);
    const list: DBIntimacyMilestone[] = raw ? JSON.parse(raw) : [];
    if (characterId) {
      return list.filter((m) => m && m.characterId === characterId);
    }
    return list;
  } catch {
    return [];
  }
}
