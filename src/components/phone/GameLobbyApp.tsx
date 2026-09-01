import React, { useState, useEffect } from 'react';
import { 
  Gamepad2, 
  Sparkles, 
  Smile, 
  Swords, 
  Trophy, 
  Layers, 
  ChevronRight, 
  Flame, 
  Bot, 
  Heart,
  RotateCcw,
  Sparkle,
  Users,
  Palette
} from 'lucide-react';
import GomokuApp from './GomokuApp';
import { GhostCardApp } from './GhostCardApp';
import StickersApp from './StickersApp';
import DrawAndGuessApp from './DrawAndGuessApp';
import { GachaApp } from './GachaApp';
import GameCharacterSelector from './GameCharacterSelector';
import { 
  getPendingGameInvite, 
  loadActiveGameSession, 
  loadActiveGhostCardSession,
  loadGomokuStats,
  type GameInvitation,
  type GomokuStats
} from '../../lib/gameStore';
import { getCharacterStickers, getUserStickers } from '../../lib/stickerStore';
import { getCharacterById, MOCK_CHARACTERS } from '../../data/characters';
import type { Character, EmotionVector } from '../../data/types';

export type GameLobbySubApp = 'lobby' | 'gomoku' | 'ghost_card' | 'stickers' | 'draw_guess' | 'gacha';


interface Props {
  currentCharacterId?: string;
  characterName?: string;
  character?: Character;
  currentEmotionSnapshot?: EmotionVector;
  initialSubApp?: GameLobbySubApp;
  onGameFinished?: (
    summary: string, 
    rawRecord: any, 
    applyEmotionDelta?: boolean, 
    customDelta?: Partial<EmotionVector>
  ) => void;
  onApplyGameEmotionDelta?: (delta: Partial<EmotionVector>, summary: string) => void;
  onInGameChat?: (
    userInput: string,
    matchContext: { moveCount: number; playerColor: 'B' | 'W'; currentTurn: 'B' | 'W' },
    chatHistory?: Array<{ sender: 'user' | 'character' | 'system'; text: string }>
  ) => Promise<{ reply: string; tactic: 'aggressive' | 'defensive' | 'gentle' | 'balanced' } | string>;
  onRejectGameInvite?: (invite: GameInvitation) => void;
  onExitLobby?: () => void;
}

export default function GameLobbyApp({
  currentCharacterId = 'char_001',
  characterName = '角色',
  character: propChar,
  currentEmotionSnapshot,
  initialSubApp = 'lobby',
  onGameFinished,
  onApplyGameEmotionDelta,
  onInGameChat,
  onRejectGameInvite,
  onExitLobby,
}: Props) {
  const [selectedOpponentId, setSelectedOpponentId] = useState<string>(currentCharacterId);
  const [activeSub, setActiveSub] = useState<GameLobbySubApp>(initialSubApp);
  const [pendingInvite, setPendingInvite] = useState<GameInvitation | null>(() => getPendingGameInvite());

  // Resolve active character object
  const activeChar = getCharacterById(selectedOpponentId) || propChar || MOCK_CHARACTERS[0];
  const activeCharName = activeChar.name;

  // Check active sessions for selected character
  const activeGomokuSession = loadActiveGameSession(selectedOpponentId);
  const activeGhostSession = loadActiveGhostCardSession(selectedOpponentId);
  const gomokuStats: GomokuStats = loadGomokuStats(selectedOpponentId);

  const userStickersCount = getUserStickers().length;
  const charStickersCount = getCharacterStickers(selectedOpponentId).length;

  // Sync if prop currentCharacterId changes
  useEffect(() => {
    if (currentCharacterId) {
      setSelectedOpponentId(currentCharacterId);
    }
  }, [currentCharacterId]);

  useEffect(() => {
    const checkInvite = () => {
      setPendingInvite(getPendingGameInvite());
    };
    checkInvite();
    window.addEventListener('game_invite_event', checkInvite);
    return () => window.removeEventListener('game_invite_event', checkInvite);
  }, []);

  // If initialSubApp changes externally, sync
  useEffect(() => {
    if (initialSubApp && initialSubApp !== 'lobby') {
      setActiveSub(initialSubApp);
    }
  }, [initialSubApp]);

  return (
    <div className="w-full h-full flex flex-col relative text-white select-none">
      {/* Sub-app router */}
      {activeSub === 'gomoku' && (
        <div className="w-full h-full">
          <GomokuApp
            currentCharacterId={selectedOpponentId}
            characterName={activeCharName}
            character={activeChar}
            currentEmotionSnapshot={currentEmotionSnapshot}
            onGameFinished={onGameFinished}
            onApplyGameEmotionDelta={onApplyGameEmotionDelta}
            onInGameChat={onInGameChat}
            onRejectInvite={onRejectGameInvite}
            onExit={() => setActiveSub('lobby')}
          />
        </div>
      )}

      {activeSub === 'ghost_card' && (
        <div className="w-full h-full">
          <GhostCardApp
            currentCharacterId={selectedOpponentId}
            characterName={activeCharName}
            character={activeChar}
            currentEmotionSnapshot={currentEmotionSnapshot}
            onGameFinished={onGameFinished}
            onApplyGameEmotionDelta={onApplyGameEmotionDelta}
            onRejectInvite={onRejectGameInvite}
            onExit={() => setActiveSub('lobby')}
          />
        </div>
      )}

      {activeSub === 'stickers' && (
        <div className="w-full h-full flex flex-col">
          {/* Top Bar to Return to Game Lobby */}
          <div className="flex items-center justify-between px-3 py-2 bg-black/40 border-b border-white/10 shrink-0">
            <button
              onClick={() => setActiveSub('lobby')}
              className="flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors py-1 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer"
            >
              <span>← 返回游戏大厅</span>
            </button>
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Smile className="size-3.5 text-pink-400" />
              <span>表情包图库与偷表情</span>
            </span>
          </div>
          <div className="flex-1 overflow-y-auto pt-1">
            <StickersApp currentCharacterId={selectedOpponentId} />
          </div>
        </div>
      )}

      {activeSub === 'draw_guess' && (
        <div className="w-full flex-1 flex flex-col min-h-0">
          <DrawAndGuessApp
            currentCharacterId={selectedOpponentId}
            characterName={activeCharName}
            onExit={() => setActiveSub('lobby')}
          />
        </div>
      )}

      {activeSub === 'gacha' && (
        <div className="w-full h-full">
          <GachaApp
            currentCharacterId={selectedOpponentId}
            characterName={activeCharName}
            character={activeChar}
            currentEmotionSnapshot={currentEmotionSnapshot}
            onGameFinished={onGameFinished}
            onApplyGameEmotionDelta={onApplyGameEmotionDelta}
            onExit={() => setActiveSub('lobby')}
          />
        </div>
      )}

      {/* Main Lobby Home View with Left Vertical Sidebar for Stickers */}

      {activeSub === 'lobby' && (
        <div className="flex w-full h-full gap-2.5 animate-in fade-in-0 duration-200">
          
          {/* ================= LEFT VERTICAL SIDEBAR: STICKERS & STOLEN GALLERY ================= */}
          <div className="w-24 sm:w-28 shrink-0 flex flex-col bg-gradient-to-b from-stone-900/90 via-stone-900/70 to-stone-950/90 border border-white/10 rounded-2xl p-2 shadow-xl backdrop-blur-md justify-between">
            <div className="space-y-2">
              <div className="flex flex-col items-center text-center pb-2 border-b border-white/10">
                <div className="size-9 rounded-xl bg-gradient-to-br from-pink-500 via-rose-500 to-amber-500 flex items-center justify-center shadow-md mb-1.5 ring-1 ring-white/20">
                  <Smile className="size-5 text-white" />
                </div>
                <span className="text-[11px] font-bold text-white tracking-wide">表情专区</span>
                <span className="text-[9px] text-pink-300/80 font-mono scale-90">STICKERS</span>
              </div>

              {/* Quick Stickers Button */}
              <button
                onClick={() => setActiveSub('stickers')}
                className="w-full p-2 rounded-xl bg-white/5 hover:bg-pink-500/20 border border-white/10 hover:border-pink-400/40 flex flex-col items-center gap-1 transition-all cursor-pointer group active:scale-95 text-center"
                title="打开表情包图床、管理与偷表情详情"
              >
                <Sparkles className="size-3.5 text-pink-400 group-hover:rotate-12 transition-transform" />
                <span className="text-[10.5px] font-medium text-stone-200 group-hover:text-pink-200">表情包图库</span>
                <span className="text-[8.5px] text-white/40">管理/导入</span>
              </button>

              {/* Counter Badges */}
              <div className="space-y-1.5 pt-1">
                <div className="bg-black/40 rounded-lg p-1.5 border border-white/5 text-center">
                  <div className="text-[8.5px] text-white/50">我的表情</div>
                  <div className="text-xs font-bold text-amber-300 font-mono">{userStickersCount} 张</div>
                </div>
                <div className="bg-black/40 rounded-lg p-1.5 border border-white/5 text-center">
                  <div className="text-[8.5px] text-white/50">{activeCharName} 表情</div>
                  <div className="text-xs font-bold text-pink-300 font-mono">{charStickersCount} 张</div>
                </div>
              </div>
            </div>

            {/* Bottom Tip in Sidebar */}
            <div className="pt-2 border-t border-white/5 text-center">
              <button
                onClick={() => setActiveSub('stickers')}
                className="w-full py-1.5 px-1 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-400/30 text-[9.5px] font-bold flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer"
              >
                <span>偷表情 ✨</span>
              </button>
            </div>
          </div>

          {/* ================= RIGHT MAIN AREA: GAME CARDS ================= */}
          <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto no-scrollbar">
            
            {/* Header: Opponent Selector & Banner */}
            <div className="space-y-2">
              {/* Opponent Selection Bar */}
              <GameCharacterSelector
                selectedCharacterId={selectedOpponentId}
                onSelectCharacter={(newId) => setSelectedOpponentId(newId)}
                title="选择游戏对战伙伴"
              />

              {/* Header Banner */}
              <div className="p-2.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-purple-500/15 border border-white/10 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-6 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow">
                      <Gamepad2 className="size-3.5 text-stone-950 font-bold" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white tracking-wide">对弈娱乐大厅</h3>
                      <p className="text-[9px] text-white/50">与 {activeCharName} 展开心理博弈与棋盘交锋</p>
                    </div>
                  </div>
                  <span className="text-[9px] text-amber-300 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full font-mono">
                    4 款互动娱乐
                  </span>
                </div>
              </div>
            </div>


            {/* Pending Invite Alert */}
            {pendingInvite && (
              <div className="p-2.5 rounded-2xl bg-gradient-to-r from-red-500/20 via-amber-500/20 to-orange-500/20 border border-red-400/50 flex items-center justify-between shadow-lg animate-pulse">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-xl bg-red-500 text-white flex items-center justify-center shadow">
                    <Sparkles className="size-4" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-[11px] font-bold text-red-200">
                      {pendingInvite.characterName} 正在向你发起邀约！
                    </div>
                    <div className="text-[9px] text-red-300/80">
                      {pendingInvite.gameType === 'ghost_card' ? '🃏 纸牌对决 · 捉鬼牌' : '♟️ 棋盘争锋 · 五子棋'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (pendingInvite.characterId) {
                      setSelectedOpponentId(pendingInvite.characterId);
                    }
                    setActiveSub(pendingInvite.gameType === 'ghost_card' ? 'ghost_card' : 'gomoku');
                  }}
                  className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-red-500 to-amber-500 text-stone-950 font-bold text-[10.5px] shadow transition hover:scale-105 active:scale-95 cursor-pointer"
                >
                  前往迎战
                </button>
              </div>
            )}

            {/* Games Grid */}
            <div className="grid grid-cols-1 gap-2.5 flex-1">
              
              {/* Game 1: 捉鬼牌 (Ghost Card) */}
              <div
                onClick={() => setActiveSub('ghost_card')}
                className="group relative rounded-2xl bg-gradient-to-br from-purple-950/40 via-stone-900/80 to-amber-950/40 border border-purple-500/30 hover:border-amber-400/60 p-3 shadow-lg hover:shadow-purple-900/20 transition-all duration-200 cursor-pointer active:scale-[0.99] flex flex-col justify-between"
              >
                {/* Status Badge */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="size-10 rounded-xl bg-gradient-to-br from-purple-600 via-stone-800 to-amber-600 flex items-center justify-center shadow-md ring-1 ring-white/20 group-hover:scale-105 transition-transform">
                      <span className="text-xl">🐾</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                          捉鬼牌 · 心理博弈
                        </h4>
                        <span className="text-[8.5px] px-1.5 py-0.2 rounded bg-purple-500/30 text-purple-200 border border-purple-400/30 font-medium">
                          纸牌
                        </span>
                      </div>
                      <p className="text-[9.5px] text-white/50">滑动试探微表情 · 互抽手牌消对</p>
                    </div>
                  </div>

                  {activeGhostSession && (activeGhostSession.userHand.length > 0 || activeGhostSession.charHand.length > 0) && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-500/80 text-white shadow animate-pulse">
                      进行中 · 轮次 {activeGhostSession.turnCount}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px] text-white/60">
                  <span className="flex items-center gap-1 text-amber-300/80">
                    <Sparkle className="size-3 text-amber-400" />
                    <span>对手: {activeCharName} · 专属微表情反应</span>
                  </span>
                  <div className="flex items-center gap-1 text-purple-300 group-hover:translate-x-0.5 transition-transform font-medium">
                    <span>进入牌局</span>
                    <ChevronRight className="size-3.5" />
                  </div>
                </div>
              </div>

              {/* Game 2: 对弈棋局 (Gomoku) */}
              <div
                onClick={() => setActiveSub('gomoku')}
                className="group relative rounded-2xl bg-gradient-to-br from-amber-950/40 via-stone-900/80 to-orange-950/40 border border-amber-500/30 hover:border-amber-400/60 p-3 shadow-lg hover:shadow-amber-900/20 transition-all duration-200 cursor-pointer active:scale-[0.99] flex flex-col justify-between"
              >
                {/* Status Badge */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="size-10 rounded-xl bg-gradient-to-br from-amber-500 via-orange-600 to-rose-600 flex items-center justify-center shadow-md ring-1 ring-white/20 group-hover:scale-105 transition-transform">
                      <Gamepad2 className="size-5 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                          对弈手谈 · 五子棋
                        </h4>
                        <span className="text-[8.5px] px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-200 border border-amber-400/30 font-medium">
                          棋艺
                        </span>
                      </div>
                      <p className="text-[9.5px] text-white/50">黑白落子 · 局内聊天与情绪共振</p>
                    </div>
                  </div>

                  {activeGomokuSession && activeGomokuSession.moveHistory.length > 0 ? (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-stone-950 shadow animate-pulse">
                      进行中 · {activeGomokuSession.moveHistory.length}手
                    </span>
                  ) : (
                    <span className="text-[9px] text-stone-400 font-mono">
                      胜率 {gomokuStats.playerWins + gomokuStats.characterWins + gomokuStats.draws > 0 ? Math.round((gomokuStats.playerWins / (gomokuStats.playerWins + gomokuStats.characterWins + gomokuStats.draws)) * 100) : 0}%
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px] text-white/60">
                  <span className="flex items-center gap-1 text-stone-300">
                    <Trophy className="size-3 text-amber-400" />
                    <span>胜 {gomokuStats.playerWins} · 负 {gomokuStats.characterWins} · 平 {gomokuStats.draws}</span>
                  </span>
                  <div className="flex items-center gap-1 text-amber-300 group-hover:translate-x-0.5 transition-transform font-medium">
                    <span>进入棋局</span>
                    <ChevronRight className="size-3.5" />
                  </div>
                </div>
              </div>

              {/* Game 3: 你画我猜 (Draw & Guess) */}
              <div
                onClick={() => setActiveSub('draw_guess')}
                className="group relative rounded-2xl bg-gradient-to-br from-rose-950/40 via-stone-900/80 to-pink-950/40 border border-pink-500/30 hover:border-pink-400/60 p-3 shadow-lg hover:shadow-pink-900/20 transition-all duration-200 cursor-pointer active:scale-[0.99] flex flex-col justify-between"
              >
                {/* Status Badge */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="size-10 rounded-xl bg-gradient-to-br from-pink-500 via-rose-600 to-amber-500 flex items-center justify-center shadow-md ring-1 ring-white/20 group-hover:scale-105 transition-transform">
                      <Palette className="size-5 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-white group-hover:text-pink-300 transition-colors">
                          你画我猜 · 笔尖默契
                        </h4>
                        <span className="text-[8.5px] px-1.5 py-0.2 rounded bg-pink-500/30 text-pink-200 border border-pink-400/30 font-medium">
                          画技
                        </span>
                        <span className="text-[8.5px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-200 border border-amber-400/30 font-mono">
                          NEW
                        </span>
                      </div>
                      <p className="text-[9.5px] text-white/50">perfect-freehand 笔锋 · 轮流时序回放与猜词对决</p>
                    </div>
                  </div>

                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-pink-500/30 text-pink-200 border border-pink-400/30">
                    双回合循环
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px] text-white/60">
                  <span className="flex items-center gap-1 text-stone-300">
                    <Sparkle className="size-3 text-pink-400" />
                    <span>对手: {activeCharName} · 专属笔画抖动与起笔收笔</span>
                  </span>
                  <div className="flex items-center gap-1 text-pink-300 group-hover:translate-x-0.5 transition-transform font-medium">
                    <span>挥毫对决</span>
                    <ChevronRight className="size-3.5" />
                  </div>
                </div>
              </div>

              {/* GAME 4: Gacha Simulator (AI 伴侣抽卡模拟器) */}
              <div
                id="gacha-lobby-card"
                onClick={() => setActiveSub('gacha')}
                className="group relative rounded-2xl bg-gradient-to-br from-amber-950/40 via-stone-900/80 to-yellow-950/40 border border-amber-500/30 hover:border-amber-400/60 p-3 shadow-lg hover:shadow-amber-900/20 transition-all duration-200 cursor-pointer active:scale-[0.99] flex flex-col justify-between"
              >
                {/* Status Badge */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="size-10 rounded-xl bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 flex items-center justify-center shadow-md ring-1 ring-white/20 group-hover:scale-105 transition-transform">
                      <Sparkles className="size-5 text-stone-950 font-black" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                          风铃 · 抽卡模拟器 (v4)
                        </h4>
                        <span className="text-[8.5px] px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-200 border border-amber-400/30 font-medium">
                          祈愿
                        </span>
                        <span className="text-[8.5px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-200 border border-rose-400/30 font-mono">
                          HOT
                        </span>
                      </div>
                      <p className="text-[9.5px] text-white/50">虚拟光标掌舵 · 10-30s 祈愿特效 · 原创即兴点评</p>
                    </div>
                  </div>

                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-200 border border-amber-400/30">
                    伴侣代抽
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px] text-white/60">
                  <span className="flex items-center gap-1 text-stone-300">
                    <Sparkle className="size-3 text-amber-400" />
                    <span>主控: {activeCharName} · 井保底与个性翻牌习惯</span>
                  </span>
                  <div className="flex items-center gap-1 text-amber-300 group-hover:translate-x-0.5 transition-transform font-medium">
                    <span>开启祈愿</span>
                    <ChevronRight className="size-3.5" />
                  </div>
                </div>
              </div>


            </div>
          </div>

        </div>
      )}
    </div>
  );
}
