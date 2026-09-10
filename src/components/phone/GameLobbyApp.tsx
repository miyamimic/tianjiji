import React, { useState, useEffect } from 'react';
import { 
  Gamepad2, 
  Smile, 
  Trophy, 
  ChevronRight, 
  Sparkle,
  Sparkles,
  Users,
  Palette,
  AlertTriangle,
  Play
} from 'lucide-react';
import GomokuApp from './GomokuApp';
import { GhostCardApp } from './GhostCardApp';
import StickersApp from './StickersApp';
import DrawAndGuessApp from './DrawAndGuessApp';
import GachaApp from './GachaApp';
import PixelJumperGame from './PixelJumperGame';
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
import { loadCharAvatar, loadCharGomokuRank } from '../../lib/customStore';
import type { Character, EmotionVector } from '../../data/types';

export type GameLobbySubApp = 'lobby' | 'gomoku' | 'ghost_card' | 'stickers' | 'draw_guess' | 'ai_gacha' | 'pixel_jumper';

export interface DosFileEntry {
  id: GameLobbySubApp;
  name: string;
  category: string;
  desc: string;
}

export const DOS_FILE_LIST: DosFileEntry[] = [
  { id: 'ghost_card', name: '捉鬼牌', category: '纸牌博弈', desc: '心理博弈·互抽手牌消对' },
  { id: 'gomoku', name: '五子棋', category: '棋艺对局', desc: '黑白落子·棋盘手谈交锋' },
  { id: 'draw_guess', name: '你画我猜', category: '趣味画技', desc: '笔锋还原时序·默契猜词' },
  { id: 'ai_gacha', name: 'AI抽卡', category: '掌机模拟', desc: 'AI掌控光标·沉浸保底抽卡' },
  { id: 'pixel_jumper', name: '像素跳跃', category: '单机街机', desc: '经典跑酷避障·极速跑酷' },
  { id: 'stickers', name: '表情图库', category: '表情管理', desc: '偷表情管理·表情包鉴赏' },
];

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
  const [showSelectorModal, setShowSelectorModal] = useState(false);
  const [gameMenuOpen, setGameMenuOpen] = useState(false);
  const [helpMenuOpen, setHelpMenuOpen] = useState(false);

  // Resolve active character object
  const activeChar = getCharacterById(selectedOpponentId) || propChar || MOCK_CHARACTERS[0];
  const activeCharName = activeChar.name;
  const activeAvatar = loadCharAvatar(activeChar.character_id);
  const activeRank = loadCharGomokuRank(activeChar.character_id);

  // Check active sessions for selected character
  const activeGomokuSession = loadActiveGameSession(selectedOpponentId);
  const activeGhostSession = loadActiveGhostCardSession(selectedOpponentId);
  const gomokuStats: GomokuStats = loadGomokuStats(selectedOpponentId);

  const userStickersCount = getUserStickers().length;
  const charStickersCount = getCharacterStickers(selectedOpponentId).length;

  const totalGomokuGames = gomokuStats.playerWins + gomokuStats.characterWins + gomokuStats.draws;
  const gomokuWinRate = totalGomokuGames > 0 ? Math.round((gomokuStats.playerWins / totalGomokuGames) * 100) : 0;

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

  // Selected file row in DOS commander
  const [selectedRowIndex, setSelectedRowIndex] = useState(0);

  // Keyboard shortcut listener for classic DOS feel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeSub !== 'lobby') {
        if (e.key === 'Escape') {
          setActiveSub('lobby');
        }
        return;
      }
      if (showSelectorModal) return;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedRowIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedRowIndex(prev => Math.min(DOS_FILE_LIST.length - 1, prev + 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (pendingInvite) {
          if (pendingInvite.characterId) setSelectedOpponentId(pendingInvite.characterId);
          setActiveSub(pendingInvite.gameType === 'ghost_card' ? 'ghost_card' : 'gomoku');
          return;
        }
        const target = DOS_FILE_LIST[selectedRowIndex];
        if (target) {
          setActiveSub(target.id);
        }
      } else if (e.key === '1') {
        setSelectedRowIndex(0);
        setActiveSub('ghost_card');
      } else if (e.key === '2') {
        setSelectedRowIndex(1);
        setActiveSub('gomoku');
      } else if (e.key === '3') {
        setSelectedRowIndex(2);
        setActiveSub('draw_guess');
      } else if (e.key === '4') {
        setSelectedRowIndex(3);
        setActiveSub('ai_gacha');
      } else if (e.key === '5') {
        setSelectedRowIndex(4);
        setActiveSub('pixel_jumper');
      } else if (e.key === 's' || e.key === 'S') {
        setSelectedRowIndex(5);
        setActiveSub('stickers');
      } else if (e.key === 'F2') {
        e.preventDefault();
        setShowSelectorModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSub, selectedRowIndex, showSelectorModal, pendingInvite]);

  return (
    <div 
      className="w-full h-full flex flex-col relative text-black select-none font-mono text-xs overflow-hidden"
      style={{
        backgroundColor: '#0000a8',
        backgroundImage: 'radial-gradient(#0044aa 15%, transparent 16%)',
        backgroundSize: '4px 4px',
      }}
    >
      {/* ================= SUB-APP ROUTERS ================= */}
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
        <div className="w-full h-full flex flex-col bg-[#c0c0c0]">
          {/* Turbo Vision Top Bar */}
          <div className="flex items-center justify-between px-2 py-1 bg-[#0000a8] text-[#ffff55] border-b-2 border-black font-mono font-bold text-xs shrink-0 shadow-[0_2px_0_#000]">
            <button
              onClick={() => setActiveSub('lobby')}
              className="flex items-center gap-1 text-[#000000] bg-[#c0c0c0] hover:bg-white px-2 py-0.5 border-t border-l border-white border-b-2 border-r-2 border-black active:translate-x-0.5 active:translate-y-0.5 cursor-pointer text-[11px]"
            >
              <span>[ ◄ 返回游戏大厅 (Esc) ]</span>
            </button>
            <span className="flex items-center gap-1.5 text-[#ffff55]">
              <Smile className="size-3.5 text-[#ffff55]" />
              <span>[■] 表情包图库与偷表情管理 [▲]</span>
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-1 bg-[#000080]">
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

      {activeSub === 'ai_gacha' && (
        <div className="w-full h-full flex-1 flex flex-col min-h-0">
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

      {activeSub === 'pixel_jumper' && (
        <div className="w-full h-full flex-1 flex flex-col min-h-0">
          <PixelJumperGame onExit={() => setActiveSub('lobby')} />
        </div>
      )}

      {/* ================= MAIN LOBBY: 90s TURBO VISION INTERFACE ================= */}
      {activeSub === 'lobby' && (
        <div className="flex flex-col w-full h-full">
          
          {/* Minesweeper Style Menu Bar */}
          <div className="h-6 bg-[#c0c0c0] text-black border-b-2 border-black flex items-center justify-between px-2 text-[11px] font-bold shrink-0">
            <div className="flex items-center gap-3 relative">
              {/* Game Menu */}
              <div className="relative">
                <span 
                  className={`cursor-pointer px-1.5 py-0.5 select-none ${gameMenuOpen ? 'bg-[#0000a8] text-white' : 'hover:bg-[#0000a8] hover:text-white'}`}
                  onClick={() => {
                    setGameMenuOpen(!gameMenuOpen);
                    setHelpMenuOpen(false);
                  }}
                >
                  游戏
                </span>
                
                {gameMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setGameMenuOpen(false)} />
                    <div className="absolute left-0 top-full mt-0.5 w-36 bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-r-black border-b-black shadow-[2px_2px_4px_rgba(0,0,0,0.5)] z-50 py-1 font-mono text-[10.5px]">
                      <button
                        onClick={() => {
                          setGameMenuOpen(false);
                          setShowSelectorModal(true);
                        }}
                        className="w-full text-left px-3 py-1 hover:bg-[#0000a8] hover:text-white flex items-center justify-between"
                      >
                        <span>新游戏</span>
                        <span className="text-gray-500 hover:text-white text-[9px] ml-1">F2</span>
                      </button>
                      <div className="border-b border-gray-400 my-1 mx-1" />
                      <button
                        onClick={() => {
                          setGameMenuOpen(false);
                          setActiveSub('stickers');
                        }}
                        className="w-full text-left px-3 py-1 hover:bg-[#0000a8] hover:text-white flex items-center justify-between"
                      >
                        <span>表情图库</span>
                        <span className="text-gray-500 hover:text-white text-[9px] ml-1">F3</span>
                      </button>
                      <button
                        onClick={() => {
                          setGameMenuOpen(false);
                          setActiveSub('pixel_jumper');
                        }}
                        className="w-full text-left px-3 py-1 hover:bg-[#0000a8] hover:text-white flex items-center justify-between"
                      >
                        <span>单机街机</span>
                        <span className="text-gray-500 hover:text-white text-[9px] ml-1">F5</span>
                      </button>
                      <div className="border-b border-gray-400 my-1 mx-1" />
                      <button
                        onClick={() => {
                          setGameMenuOpen(false);
                          onExitLobby?.();
                        }}
                        className="w-full text-left px-3 py-1 hover:bg-[#0000a8] hover:text-white flex items-center justify-between"
                      >
                        <span>退出</span>
                        <span className="text-gray-500 hover:text-white text-[9px] ml-1">F10</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Help Menu */}
              <div className="relative">
                <span 
                  className={`cursor-pointer px-1.5 py-0.5 select-none ${helpMenuOpen ? 'bg-[#0000a8] text-white' : 'hover:bg-[#0000a8] hover:text-white'}`}
                  onClick={() => {
                    setHelpMenuOpen(!helpMenuOpen);
                    setGameMenuOpen(false);
                  }}
                >
                  帮助
                </span>

                {helpMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setHelpMenuOpen(false)} />
                    <div className="absolute left-0 top-full mt-0.5 w-36 bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-r-black border-b-black shadow-[2px_2px_4px_rgba(0,0,0,0.5)] z-50 py-1 font-mono text-[10.5px]">
                      <button
                        onClick={() => {
                          setHelpMenuOpen(false);
                          alert("【游戏帮助】\n1. 使用上下方向键移动光标选区，按回车 [Enter] 启动选中的游戏项目。\n2. 在大厅任意时刻收到对战挑战时，可以直接按回车接受迎战。\n3. 点击“对手”按钮可以更换聊天对弈的对手。");
                        }}
                        className="w-full text-left px-3 py-1 hover:bg-[#0000a8] hover:text-white"
                      >
                        <span>帮助说明</span>
                      </button>
                      <div className="border-b border-gray-400 my-1 mx-1" />
                      <button
                        onClick={() => {
                          setHelpMenuOpen(false);
                          alert("【关于扫雷大厅】\n本游戏大厅完美致敬了 90 年代经典 Windows 扫雷 and Turbo Vision 的菜单布局。内置了多款精美的微表情对战小游戏。");
                        }}
                        className="w-full text-left px-3 py-1 hover:bg-[#0000a8] hover:text-white"
                      >
                        <span>关于扫雷大厅...</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-gray-700 select-none">
              <span>WIN95 COMPATIBLE</span>
              <span className="bg-[#0000a8] text-[#ffff55] px-1">[就绪]</span>
            </div>
          </div>

          {/* Main Content Workspace */}
          <div className="flex-1 flex p-2 gap-2 overflow-hidden min-h-0">
            
            {/* ================= LEFT WINDOW: OPPONENT & STICKERS INSPECTOR ================= */}
            <div className="w-32 sm:w-36 shrink-0 flex flex-col bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-black border-r-black shadow-[3px_3px_0px_#000000] text-black overflow-hidden">
              
              {/* Window Header */}
              <div className="bg-[#0000a8] text-[#ffff55] px-1.5 py-0.5 text-[10.5px] font-bold flex items-center justify-between border-b border-black shrink-0">
                <span>[≡] 对战情报</span>
                <span>[▲]</span>
              </div>

              <div className="p-1.5 flex-1 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-2">
                  
                  {/* Current Opponent Box */}
                  <div className="border border-black bg-white p-1.5 text-center shadow-inner">
                    <div className="text-[9.5px] text-gray-600 font-bold mb-1 border-b border-gray-300 pb-0.5">
                      ┌ 选定对手 ┐
                    </div>
                    <div className="size-11 mx-auto bg-black border border-black overflow-hidden mb-1">
                      {activeAvatar ? (
                        <img src={activeAvatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-yellow-300 text-sm">
                          {activeCharName.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="font-bold text-xs truncate text-black">{activeCharName}</div>
                    <div className="text-[9px] bg-[#00aaaa] text-black font-bold mt-1 px-1 py-0.2 inline-block">
                      [{activeRank === 'master' ? '王者' : activeRank === 'gold' ? '黄金' : activeRank === 'silver' ? '白银' : '青铜'}]
                    </div>
                  </div>

                  {/* Switch Opponent Button */}
                  <button
                    onClick={() => setShowSelectorModal(true)}
                    className="w-full py-1 px-1 text-[10px] font-bold bg-[#d4d4d4] hover:bg-white text-black border-t border-l border-white border-b-2 border-r-2 border-black active:translate-x-0.5 active:translate-y-0.5 shadow-[1px_1px_0px_#000] cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Users className="size-3 text-[#0000a8]" />
                    <span>换对手</span>
                  </button>

                  {/* ASCII Sticker Stats Table */}
                  <div className="border border-black bg-[#000080] text-white p-1 text-[9.5px] font-mono shadow-inner leading-tight">
                    <div className="text-[#ffff55] font-bold border-b border-[#00aaaa] pb-0.5 mb-1 text-center">
                      [表情包统计]
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">我的表情:</span>
                      <span className="text-[#00ffff] font-bold">{userStickersCount}张</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">对手表情:</span>
                      <span className="text-[#ffff55] font-bold">{charStickersCount}张</span>
                    </div>
                  </div>

                  {/* Quick Sticker App Button */}
                  <button
                    onClick={() => setActiveSub('stickers')}
                    className="w-full py-1 px-1 text-[10px] font-bold bg-[#00aaaa] hover:bg-[#55ffff] text-black border-t border-l border-white border-b-2 border-r-2 border-black active:translate-x-0.5 active:translate-y-0.5 shadow-[1px_1px_0px_#000] cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Smile className="size-3" />
                    <span>表情专区</span>
                  </button>
                </div>

                {/* Bottom Tip in Sidebar */}
                <div className="pt-2 border-t border-gray-400 text-center">
                  <button
                    onClick={() => setActiveSub('stickers')}
                    className="w-full py-0.5 text-[9.5px] bg-[#d4d4d4] hover:bg-white text-[#a80000] font-bold border border-black cursor-pointer active:translate-x-0.5 active:translate-y-0.5 shadow-[1px_1px_0px_#000]"
                  >
                    偷表情
                  </button>
                </div>
              </div>
            </div>

            {/* ================= RIGHT WINDOW: CLASSIC RETRO GAME MENU ================= */}
            <div className="flex-1 flex flex-col bg-[#0000a8] border-2 border-[#00ffff] shadow-[3px_3px_0px_#000000] text-white overflow-hidden min-w-0 font-mono select-none">
              
              {/* Panel Top Border with Title: 游戏项目 */}
              <div className="bg-[#0000a8] text-[#00ffff] px-1.5 py-0.5 text-[11px] font-bold flex items-center justify-between border-b border-[#00aaaa] shrink-0">
                <div className="flex items-center gap-1 truncate">
                  <span className="text-[#00ffff]">╔═</span>
                  <span className="text-[#ffff55] font-bold tracking-wider">游戏大厅 · 娱乐列表</span>
                  <span className="text-[#00ffff]">═════════════════</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-[#00ffff] shrink-0">
                  <span className="text-white font-mono">[{DOS_FILE_LIST.length} 个项目]</span>
                  <span>═╗</span>
                </div>
              </div>

              {/* Pending Invite Alert Dialog (DOS Banner Style) */}
              {pendingInvite && (
                <div className="bg-[#aa0000] text-[#ffff55] border-b-2 border-yellow-300 px-2 py-1 flex items-center justify-between text-[10px] shrink-0 animate-pulse">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-yellow-300 font-bold">►[!]</span>
                    <span className="truncate">挑战: {pendingInvite.characterName} 邀请加入 {pendingInvite.gameType === 'ghost_card' ? '捉鬼牌' : '五子棋'}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    <button
                      onClick={() => {
                        if (pendingInvite.characterId) setSelectedOpponentId(pendingInvite.characterId);
                        setActiveSub(pendingInvite.gameType === 'ghost_card' ? 'ghost_card' : 'gomoku');
                      }}
                      className="px-1.5 py-0.2 bg-[#ffff55] hover:bg-white text-black font-bold text-[9.5px] cursor-pointer"
                    >
                      [接受 Enter]
                    </button>
                    {onRejectGameInvite && (
                      <button
                        onClick={() => {
                          onRejectGameInvite(pendingInvite);
                          setPendingInvite(null);
                        }}
                        className="px-1 py-0.2 bg-[#555555] hover:bg-white text-white font-bold text-[9.5px] cursor-pointer"
                      >
                        [拒绝]
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Table Column Headers */}
              <div className="flex items-center bg-[#0000a8] text-[#ffff55] border-b border-[#00aaaa] px-2 py-0.5 text-[10.5px] font-bold shrink-0">
                <div className="flex-1">
                  游戏名称
                </div>
              </div>

              {/* Game Menu Rows */}
              <div className="flex-1 overflow-y-auto bg-[#0000a8] divide-y divide-transparent">
                {DOS_FILE_LIST.map((file, idx) => {
                  const isSelected = selectedRowIndex === idx;
                  const isGhostRunning = file.id === 'ghost_card' && activeGhostSession && (activeGhostSession.userHand.length > 0 || activeGhostSession.charHand.length > 0);
                  const isGomokuRunning = file.id === 'gomoku' && activeGomokuSession && activeGomokuSession.moveHistory.length > 0;
                  const isRunning = isGhostRunning || isGomokuRunning;

                  return (
                    <div
                      key={file.name}
                      onClick={() => {
                        if (selectedRowIndex === idx) {
                          setActiveSub(file.id);
                        } else {
                          setSelectedRowIndex(idx);
                        }
                      }}
                      onDoubleClick={() => setActiveSub(file.id)}
                      className={`flex items-center px-2 py-0.5 text-[10.5px] font-mono cursor-pointer transition-none select-none ${
                        isSelected
                          ? 'bg-[#00aaaa] text-black font-bold'
                          : 'hover:bg-[#0000d0] text-[#00ffff]'
                      }`}
                    >
                      {/* Name Column */}
                      <div className="flex-1 flex items-center gap-1 truncate">
                        {isSelected && <span className="text-black">►</span>}
                        <span className={isSelected ? 'text-black font-bold' : 'text-white'}>
                          {file.name}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Empty Filler Rows for retro list feel */}
                {[...Array(12)].map((_, i) => (
                  <div key={`filler-${i}`} className="flex items-center px-2 py-0.5 text-[10.5px] font-mono text-[#0000a8] opacity-30 pointer-events-none">
                    <div className="flex-1">&nbsp;</div>
                  </div>
                ))}
              </div>

              {/* Selected Game Status Bar */}
              <div className="bg-[#0000a8] text-[#00ffff] border-t border-[#00aaaa] px-2 py-0.5 text-[10px] flex items-center justify-between font-mono shrink-0">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-[#ffff55] font-bold">
                    【{DOS_FILE_LIST[selectedRowIndex]?.name}】
                  </span>
                  <span className="text-white">
                    {DOS_FILE_LIST[selectedRowIndex]?.desc}
                  </span>
                </div>
                <span className="text-[#55ffff] hidden sm:inline">
                  对手: {activeCharName}
                </span>
              </div>

              {/* Clean Blinking Instructions Row instead of system disk prompt */}
              <div className="bg-[#000000] text-[#55ff55] px-2 py-0.5 text-[10.5px] font-mono flex items-center justify-between shrink-0 border-t border-[#0055aa]">
                <div className="flex items-center gap-1 truncate">
                  <span className="text-[#55ff55]">提示:</span>
                  <span className="text-white font-bold">双击 或 敲击 [Enter] 回车键立即启动《{DOS_FILE_LIST[selectedRowIndex]?.name}》</span>
                  <span className="inline-block w-1.5 h-3 bg-[#55ff55] animate-pulse"></span>
                </div>
                <button
                  onClick={() => {
                    const target = DOS_FILE_LIST[selectedRowIndex];
                    if (target) setActiveSub(target.id);
                  }}
                  className="bg-[#00aaaa] hover:bg-[#55ffff] text-black font-bold px-2 py-0.2 text-[9.5px] border border-white cursor-pointer active:translate-x-0.5 active:translate-y-0.5 shrink-0 ml-1"
                >
                  [ 运行 Enter ► ]
                </button>
              </div>

              {/* Classic Function Key Bar in Chinese */}
              <div className="h-5 bg-[#000000] text-white flex items-center justify-between px-1 text-[9.5px] font-mono shrink-0 border-t border-[#00aaaa]">
                <div className="flex items-center gap-0.5">
                  <span className="bg-[#00aaaa] text-black font-bold px-1">1</span>
                  <span className="text-gray-300">帮助</span>
                </div>
                <button 
                  onClick={() => setShowSelectorModal(true)} 
                  className="flex items-center gap-0.5 cursor-pointer hover:opacity-80"
                >
                  <span className="bg-[#00aaaa] text-black font-bold px-1">2</span>
                  <span className="text-gray-300">对手</span>
                </button>
                <button 
                  onClick={() => setActiveSub('stickers')} 
                  className="flex items-center gap-0.5 cursor-pointer hover:opacity-80"
                >
                  <span className="bg-[#00aaaa] text-black font-bold px-1">3</span>
                  <span className="text-gray-300">表情</span>
                </button>
                <button 
                  onClick={() => {
                    const target = DOS_FILE_LIST[selectedRowIndex];
                    if (target) setActiveSub(target.id);
                  }} 
                  className="flex items-center gap-0.5 cursor-pointer hover:opacity-80"
                >
                  <span className="bg-[#ffff55] text-black font-bold px-1">4</span>
                  <span className="text-[#ffff55] font-bold">启动</span>
                </button>
                <button 
                  onClick={() => setActiveSub('pixel_jumper')} 
                  className="flex items-center gap-0.5 cursor-pointer hover:opacity-80"
                >
                  <span className="bg-[#00aaaa] text-black font-bold px-1">5</span>
                  <span className="text-gray-300">街机</span>
                </button>
                <button 
                  onClick={() => onExitLobby?.()} 
                  className="flex items-center gap-0.5 cursor-pointer hover:opacity-80"
                >
                  <span className="bg-[#aa0000] text-white font-bold px-1">10</span>
                  <span className="text-gray-300">退出</span>
                </button>
              </div>

            </div>

          </div>

          {/* Opponent Selector Modal inside GameLobbyApp if requested */}
          {showSelectorModal && (
            <GameCharacterSelector
              selectedCharacterId={selectedOpponentId}
              onSelectCharacter={(newId) => {
                setSelectedOpponentId(newId);
                setShowSelectorModal(false);
              }}
              title="选择游戏对战伙伴"
              retro={true}
              defaultOpen={true}
              onClose={() => setShowSelectorModal(false)}
            />
          )}

        </div>
      )}
    </div>
  );
}
