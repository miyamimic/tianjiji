// Game State & Invitation Manager for Roleplay Engine
// Complete integration with IndexedDB, rate-limiting, and mind pipeline hooks

import { 
  idbSaveGameMatch, 
  idbLoadGameMatches, 
  idbSaveInvitation, 
  idbLoadInvitations,
  idbSaveIntimacyMilestone,
  type DBGameMatchRecord,
  type DBGameInvite,
  type DBIntimacyMilestone
} from './idb';

import type { EmotionVector } from '../data/types';
import type { SandbaggingReport, StepLogItem } from './gomokuProtocolEngine';
import type {
  Card,
  DiscardedPair,
  UserBluffHistoryItem,
  CharBluffHistoryItem,
  GhostCardKeyMoment
} from './ghostCardEngine';

export type GameInvitation = DBGameInvite;
export type GomokuMatchRecord = DBGameMatchRecord;

const PENDING_INVITE_KEY = '__rp_engine_pending_game_invite';
const ACTIVE_SESSION_KEY_PREFIX = '__rp_active_gomoku_session_';
const ACTIVE_GHOST_SESSION_KEY_PREFIX = '__rp_active_ghost_card_session_';
const GAME_HISTORY_KEY = '__rp_engine_gomoku_history';
const DEBUG_SHORTCUT_KEY = '__rp_game_debug_shortcut';
const LAST_INVITE_TIMESTAMP_PREFIX = '__rp_last_invite_ts_';
const GAME_EMOTION_IMPACTS_KEY = '__rp_game_emotion_impacts';

export const INVITE_HARD_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes hard cooldown

export interface GameEmotionImpactRecord {
  id: string;
  matchId: string;
  characterId: string;
  characterName: string;
  gameType?: 'gomoku' | 'ghost_card';
  timestamp: number;
  winner: 'player' | 'character' | 'draw' | 'surrender';
  totalMoves: number;
  totalDelta: Partial<EmotionVector>;
  applied: boolean;
  appliedTimestamp?: number;
  summary: string;
}

export interface InGameChatMessage {
  id: string;
  sender: 'user' | 'character' | 'system';
  text: string;
  thought?: string;
  moveStep?: number;
  coord?: [number, number];
  tactic?: string;
  strategy?: string;
  emotionLabel?: string;
  stickerUrl?: string;
  stickerName?: string;
  timestamp: number;
}

export interface ActiveGomokuSession {
  characterId: string;
  characterName: string;
  board: ('B' | 'W' | null)[][];
  moveHistory: Array<{ step: number; r: number; c: number; color: 'B' | 'W'; timestamp: number }>;
  playerColor: 'B' | 'W';
  currentTurn: 'B' | 'W';
  inGameChats: InGameChatMessage[];
  characterSpeech: string;
  characterInnerThought?: string;
  currentTactic?: string;
  isPaused: boolean;
  lastUpdated: number;
  gameTotalDelta?: Partial<EmotionVector>;
  stepLogs?: StepLogItem[];
  sandbaggingReport?: SandbaggingReport;
}

export interface ActiveGhostCardSession {
  characterId: string;
  characterName: string;
  userHand: Card[];
  charHand: Card[];
  discardPile: DiscardedPair[];
  ghostCardId: string;
  currentTurn: 'user' | 'character';
  turnCount: number;
  userBluffHistory: UserBluffHistoryItem[];
  charBluffHistory: CharBluffHistoryItem[];
  keyMoments: GhostCardKeyMoment[];
  inGameChats: InGameChatMessage[];
  characterSpeech: string;
  characterInnerThought?: string;
  currentOptions?: { option_a: string; option_b: string };
  isPaused: boolean;
  lastUpdated: number;
  gameTotalDelta?: Partial<EmotionVector>;
  winner?: 'user' | 'character' | null;
  stepLogs?: any[];
}

export function saveActiveGhostCardSession(session: ActiveGhostCardSession): void {
  try {
    localStorage.setItem(
      `${ACTIVE_GHOST_SESSION_KEY_PREFIX}${session.characterId}`,
      JSON.stringify(session)
    );
  } catch {
    // ignore
  }
}

export function loadActiveGhostCardSession(characterId: string): ActiveGhostCardSession | null {
  try {
    const raw = localStorage.getItem(`${ACTIVE_GHOST_SESSION_KEY_PREFIX}${characterId}`);
    if (!raw) return null;
    const session: ActiveGhostCardSession = JSON.parse(raw);
    if (session && Array.isArray(session.userHand) && Array.isArray(session.charHand)) {
      return session;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearActiveGhostCardSession(characterId: string): void {
  try {
    localStorage.removeItem(`${ACTIVE_GHOST_SESSION_KEY_PREFIX}${characterId}`);
  } catch {
    // ignore
  }
}

export function saveActiveGameSession(session: ActiveGomokuSession): void {
  try {
    localStorage.setItem(
      `${ACTIVE_SESSION_KEY_PREFIX}${session.characterId}`,
      JSON.stringify(session)
    );
  } catch {
    // ignore
  }
}

export function loadActiveGameSession(characterId: string): ActiveGomokuSession | null {
  try {
    const raw = localStorage.getItem(`${ACTIVE_SESSION_KEY_PREFIX}${characterId}`);
    if (!raw) return null;
    const session: ActiveGomokuSession = JSON.parse(raw);
    if (session && Array.isArray(session.board) && session.moveHistory?.length > 0) {
      return session;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearActiveGameSession(characterId: string): void {
  try {
    localStorage.removeItem(`${ACTIVE_SESSION_KEY_PREFIX}${characterId}`);
  } catch {
    // ignore
  }
}

// -------------------------------------------------------------
// 1. Debug Mode Shortcut Switch
// -------------------------------------------------------------

export function isGameDebugShortcutEnabled(): boolean {
  try {
    const val = localStorage.getItem(DEBUG_SHORTCUT_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setGameDebugShortcutEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(DEBUG_SHORTCUT_KEY, String(enabled));
  } catch {
    // ignore
  }
}

// -------------------------------------------------------------
// 2. Character Active Invitation Hard Cooldown (30 Minutes Mandatory)
// -------------------------------------------------------------

export function checkInviteCooldown(characterId: string): { allowed: boolean; remainingMinutes: number } {
  try {
    const raw = localStorage.getItem(`${LAST_INVITE_TIMESTAMP_PREFIX}${characterId}`);
    if (!raw) return { allowed: true, remainingMinutes: 0 };
    const lastTime = parseInt(raw, 10);
    if (isNaN(lastTime)) return { allowed: true, remainingMinutes: 0 };

    const elapsed = Date.now() - lastTime;
    if (elapsed >= INVITE_HARD_COOLDOWN_MS) {
      return { allowed: true, remainingMinutes: 0 };
    }

    const remainingMs = INVITE_HARD_COOLDOWN_MS - elapsed;
    const remainingMinutes = Math.ceil(remainingMs / 60000);
    return { allowed: false, remainingMinutes };
  } catch {
    return { allowed: true, remainingMinutes: 0 };
  }
}

export function canCharacterSendInvite(characterId: string): boolean {
  return checkInviteCooldown(characterId).allowed;
}

export function recordCharacterInviteSent(characterId: string): void {
  try {
    localStorage.setItem(`${LAST_INVITE_TIMESTAMP_PREFIX}${characterId}`, String(Date.now()));
  } catch {
    // ignore
  }
}

// -------------------------------------------------------------
// 2.1 Game Emotion Impact Records (右侧边栏情绪变动总账)
// -------------------------------------------------------------

export function loadGameEmotionImpacts(characterId?: string): GameEmotionImpactRecord[] {
  try {
    const raw = localStorage.getItem(GAME_EMOTION_IMPACTS_KEY);
    if (!raw) return [];
    const list: GameEmotionImpactRecord[] = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    if (characterId) {
      return list.filter((item) => item.characterId === characterId);
    }
    return list;
  } catch {
    return [];
  }
}

export function saveGameEmotionImpact(record: GameEmotionImpactRecord): void {
  try {
    const list = loadGameEmotionImpacts();
    const existingIdx = list.findIndex((item) => item.id === record.id);
    if (existingIdx !== -1) {
      list[existingIdx] = record;
    } else {
      list.unshift(record);
      // Keep up to 50 records
      if (list.length > 50) list.pop();
    }
    localStorage.setItem(GAME_EMOTION_IMPACTS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function clearGameEmotionImpacts(characterId?: string): void {
  try {
    if (!characterId) {
      localStorage.removeItem(GAME_EMOTION_IMPACTS_KEY);
    } else {
      const list = loadGameEmotionImpacts();
      const filtered = list.filter((item) => item.characterId !== characterId);
      localStorage.setItem(GAME_EMOTION_IMPACTS_KEY, JSON.stringify(filtered));
    }
  } catch {
    // ignore
  }
}

// -------------------------------------------------------------
// 3. Pending Game Invitation Manager & Event Subscriptions
// -------------------------------------------------------------

type InviteListener = (invite: GameInvitation | null) => void;
const listeners: Set<InviteListener> = new Set();

export function subscribeGameInvite(listener: InviteListener): () => void {
  listeners.add(listener);
  listener(getPendingGameInvite());
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(invite: GameInvitation | null) {
  listeners.forEach((l) => {
    try {
      l(invite);
    } catch {
      // ignore
    }
  });
}

export function getPendingGameInvite(): GameInvitation | null {
  try {
    const raw = localStorage.getItem(PENDING_INVITE_KEY);
    if (!raw) return null;
    const invite: GameInvitation = JSON.parse(raw);
    if (invite && invite.status === 'pending') {
      return invite;
    }
    return null;
  } catch {
    return null;
  }
}

export function setPendingGameInvite(invite: GameInvitation | null): void {
  try {
    if (!invite || invite.status !== 'pending') {
      localStorage.removeItem(PENDING_INVITE_KEY);
      notifyListeners(null);
    } else {
      localStorage.setItem(PENDING_INVITE_KEY, JSON.stringify(invite));
      notifyListeners(invite);
      idbSaveInvitation(invite);
    }
  } catch {
    // ignore
  }
}

export function acceptGameInvite(id: string): void {
  const current = getPendingGameInvite();
  if (current && current.id === id) {
    recordCharacterInviteSent(current.characterId);
    const updated: GameInvitation = { ...current, status: 'accepted' };
    setPendingGameInvite(null);
    idbSaveInvitation(updated);
  }
}

export function rejectGameInvite(id: string): void {
  const current = getPendingGameInvite();
  if (current && current.id === id) {
    recordCharacterInviteSent(current.characterId);
    const updated: GameInvitation = { ...current, status: 'rejected' };
    setPendingGameInvite(null);
    idbSaveInvitation(updated);
  }
}

export function dismissGameInvite(id: string): void {
  const current = getPendingGameInvite();
  if (current && current.id === id) {
    recordCharacterInviteSent(current.characterId);
    const updated: GameInvitation = { ...current, status: 'dismissed' };
    setPendingGameInvite(null);
    idbSaveInvitation(updated);
  }
}

export async function loadAllPendingInvites(characterId?: string): Promise<GameInvitation[]> {
  const all = await idbLoadInvitations(characterId);
  return all.filter((i) => i && i.status === 'pending');
}

export async function loadAllInviteHistory(characterId?: string): Promise<GameInvitation[]> {
  return idbLoadInvitations(characterId);
}

// -------------------------------------------------------------
// 4. Gomoku Statistics & Match Archive Persistence
// -------------------------------------------------------------

export interface GomokuStats {
  playerWins: number;
  characterWins: number;
  draws: number;
}

export function loadGomokuStats(characterId: string): GomokuStats {
  try {
    const raw = localStorage.getItem(`${GAME_HISTORY_KEY}_${characterId}`);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return { playerWins: 0, characterWins: 0, draws: 0 };
}

export function saveGomokuStats(characterId: string, result: 'player' | 'character' | 'draw'): GomokuStats {
  const stats = loadGomokuStats(characterId);
  if (result === 'player') stats.playerWins += 1;
  else if (result === 'character') stats.characterWins += 1;
  else stats.draws += 1;

  try {
    localStorage.setItem(`${GAME_HISTORY_KEY}_${characterId}`, JSON.stringify(stats));
  } catch {
    // ignore
  }
  return stats;
}

export async function saveMatchRecord(record: GomokuMatchRecord): Promise<void> {
  await idbSaveGameMatch(record);
}

export async function loadMatchRecords(characterId?: string): Promise<GomokuMatchRecord[]> {
  return idbLoadGameMatches(characterId);
}

// -------------------------------------------------------------
// 5. Objective Structured Summary Generator for Game Conclusion
// -------------------------------------------------------------

export function generateGameSummary(record: GomokuMatchRecord): string {
  const resultText =
    record.winner === 'player'
      ? `玩家获胜（执${record.playerColor === 'B' ? '黑先行' : '白后手'}）`
      : record.winner === 'character'
      ? `${record.characterName}获胜（执${record.playerColor === 'B' ? '白后手' : '黑先行'}）`
      : record.winner === 'draw'
      ? '双方势均力敌，战成和局'
      : '玩家主动认输投子';

  const chatSummary =
    record.chats.length > 0
      ? `对局期间交谈共 ${record.chats.length} 句，气氛生动试探。`
      : '对局期间专注于落子推演，沉静对弈。';

  return `【五子棋对局事件】胜负结果：${resultText}，总计历经 ${record.totalMoves} 手落子。${chatSummary}`;
}

export async function recordGameMilestone(
  characterId: string,
  title: string,
  description: string,
  type: DBIntimacyMilestone['type']
): Promise<void> {
  const milestone: DBIntimacyMilestone = {
    id: `ms_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    characterId,
    title,
    description,
    type,
    timestamp: Date.now(),
  };
  await idbSaveIntimacyMilestone(milestone);
}

// -------------------------------------------------------------
// 6. Voice & Audio Notification
// -------------------------------------------------------------

export function playInviteVoiceNotification(): void {
  // 1. Synthesize two-tone pleasant chime
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Tone 1: E5
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.45);

      // Tone 2: G#5
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.frequency.setValueAtTime(830.61, now + 0.15);
      gain2.gain.setValueAtTime(0.15, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.75);
    }
  } catch {
    // non-fatal
  }

  // 2. Female voice prompt: "您有新的游戏邀请。"
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const text = '您有新的游戏邀请。';
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 1.0;
      utterance.pitch = 1.2;

      const voices = window.speechSynthesis.getVoices();
      const zhVoices = voices.filter((v) => v.lang.includes('zh') || v.lang.includes('cmn'));
      const femaleVoice = zhVoices.find(
        (v) =>
          v.name.includes('Xiaoxiao') ||
          v.name.includes('Female') ||
          v.name.includes('女') ||
          v.name.includes('Mei-Jia') ||
          v.name.includes('Sinji') ||
          v.name.includes('Ting-Ting') ||
          v.name.includes('Yaoyao') ||
          v.name.includes('Huihui')
      ) || zhVoices[0];

      if (femaleVoice) {
        utterance.voice = femaleVoice;
      }

      setTimeout(() => {
        try {
          window.speechSynthesis.speak(utterance);
        } catch {
          // ignore
        }
      }, 250);
    }
  } catch {
    // ignore
  }
}

export const recordGameEmotionImpact = saveGameEmotionImpact;

