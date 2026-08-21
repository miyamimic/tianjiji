import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  RotateCcw, 
  Undo2, 
  Trophy, 
  Flag, 
  Sparkles, 
  CheckCircle2, 
  Dices,
  Send,
  History,
  Inbox,
  Settings,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Trash2,
  Swords,
  Pause,
  Play,
  Loader2,
  Shield,
  Flame,
  HeartHandshake,
  Scale,
  ChevronLeft,
  X,
  Volume2,
  VolumeX,
  Gamepad2,
  Layers
} from 'lucide-react';
import { 
  getPendingGameInvite, 
  acceptGameInvite, 
  rejectGameInvite,
  loadGomokuStats, 
  saveGomokuStats, 
  loadMatchRecords,
  generateGameSummary,
  isGameDebugShortcutEnabled,
  setGameDebugShortcutEnabled,
  loadAllPendingInvites,
  saveActiveGameSession,
  loadActiveGameSession,
  clearActiveGameSession,
  type GomokuStats,
  type GomokuMatchRecord,
  type GameInvitation,
  type ActiveGomokuSession
} from '../../lib/gameStore';
import { loadCharAvatar } from '../../lib/customStore';

const BOARD_SIZE = 15;
export type Cell = 'B' | 'W' | null;
export type AiTactic = 'aggressive' | 'defensive' | 'gentle' | 'balanced';

interface Props {
  currentCharacterId: string;
  characterName: string;
  onGameFinished?: (summary: string, rawRecord: GomokuMatchRecord) => void;
  onInGameChat?: (
    userInput: string,
    matchContext: { moveCount: number; playerColor: 'B' | 'W'; currentTurn: 'B' | 'W' },
    chatHistory?: Array<{ sender: 'user' | 'character'; text: string }>
  ) => Promise<{ reply: string; tactic: 'aggressive' | 'defensive' | 'gentle' | 'balanced' } | string>;
  onRejectInvite?: (invite: GameInvitation) => void;
  onExit?: () => void;
}

// -------------------------------------------------------------
// Web Audio Sound Synthesizers
// -------------------------------------------------------------

function playStoneSound(isBlack: boolean) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    const baseFreq = isBlack ? 380 : 440;
    osc.frequency.setValueAtTime(baseFreq + Math.random() * 20 - 10, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.08);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  } catch {
    // ignore
  }
}

function playWinSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);
      gain.gain.setValueAtTime(0.12, now + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.1 + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.55);
    });
  } catch {
    // ignore
  }
}

// -------------------------------------------------------------
// Gomoku Rules Engine: 5-in-a-row checker
// -------------------------------------------------------------

function checkWinner(board: Cell[][]): { winner: Cell; line?: [number, number][] } {
  const directions = [
    [0, 1],  // Horizontal
    [1, 0],  // Vertical
    [1, 1],  // Diagonal \
    [1, -1], // Diagonal /
  ];

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = board[r][c];
      if (!cell) continue;

      for (const [dr, dc] of directions) {
        let count = 1;
        const line: [number, number][] = [[r, c]];

        for (let step = 1; step < 5; step++) {
          const nr = r + dr * step;
          const nc = c + dc * step;
          if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === cell) {
            count++;
            line.push([nr, nc]);
          } else {
            break;
          }
        }

        if (count >= 5) {
          return { winner: cell, line };
        }
      }
    }
  }

  return { winner: null };
}

// -------------------------------------------------------------
// Gomoku Heuristic AI Calculation (Dynamic Tactic Aware)
// -------------------------------------------------------------

function findBestMove(
  board: Cell[][],
  aiColor: 'B' | 'W',
  tactic: AiTactic = 'balanced'
): [number, number] {
  const humanColor: 'B' | 'W' = aiColor === 'B' ? 'W' : 'B';
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  const evaluateLine = (r: number, c: number, dr: number, dc: number, color: 'B' | 'W'): number => {
    let count = 0;
    let openEnds = 0;

    // Check forward
    let step = 1;
    while (step <= 4) {
      const nr = r + dr * step;
      const nc = c + dc * step;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
      if (board[nr][nc] === color) {
        count++;
        step++;
      } else if (board[nr][nc] === null) {
        openEnds++;
        break;
      } else {
        break;
      }
    }

    // Check backward
    step = 1;
    while (step <= 4) {
      const nr = r - dr * step;
      const nc = c - dc * step;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
      if (board[nr][nc] === color) {
        count++;
        step++;
      } else if (board[nr][nc] === null) {
        openEnds++;
        break;
      } else {
        break;
      }
    }

    if (count >= 4) return 100000;
    if (count === 3) {
      if (openEnds === 2) return 10000;
      if (openEnds === 1) return 1200;
    }
    if (count === 2) {
      if (openEnds === 2) return 1500;
      if (openEnds === 1) return 120;
    }
    if (count === 1) {
      if (openEnds === 2) return 50;
      if (openEnds === 1) return 10;
    }
    return 0;
  };

  let maxScore = -1;
  let bestMoves: [number, number][] = [];

  // Tactic weighting multipliers
  let aiWeight = 1.15;
  let humanWeight = 1.05;

  if (tactic === 'aggressive') {
    aiWeight = 2.5;
    humanWeight = 0.75;
  } else if (tactic === 'defensive') {
    aiWeight = 0.7;
    humanWeight = 2.6;
  } else if (tactic === 'gentle') {
    aiWeight = 0.65;
    humanWeight = 0.65;
  }

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== null) continue;

      const centerDist = Math.abs(r - 7) + Math.abs(c - 7);
      let score = (14 - centerDist) * 2;

      let hasNeighbor = false;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] !== null) {
            hasNeighbor = true;
            break;
          }
        }
        if (hasNeighbor) break;
      }

      if (!hasNeighbor && r === 7 && c === 7) {
        return [7, 7];
      }
      if (!hasNeighbor) continue;

      let aiScore = 0;
      let humanScore = 0;

      for (const [dr, dc] of directions) {
        aiScore += evaluateLine(r, c, dr, dc, aiColor);
        humanScore += evaluateLine(r, c, dr, dc, humanColor);
      }

      // If AI can win this turn immediately, always take it
      if (aiScore >= 100000) {
        return [r, c];
      }

      // If Human is about to win (4 in a row), block unless in purely gentle mode
      if (humanScore >= 100000 && tactic !== 'gentle') {
        score += 200000;
      }

      score += aiScore * aiWeight + humanScore * humanWeight;

      if (score > maxScore) {
        maxScore = score;
        bestMoves = [[r, c]];
      } else if (score === maxScore) {
        bestMoves.push([r, c]);
      }
    }
  }

  if (bestMoves.length === 0) {
    return [7, 7];
  }

  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

const TACTIC_INFO: Record<AiTactic, { label: string; icon: React.ElementType; color: string; desc: string }> = {
  aggressive: {
    label: '激进绞杀',
    icon: Flame,
    color: 'text-red-400 bg-red-500/15 border-red-500/30',
    desc: '好胜心起，强攻破局',
  },
  defensive: {
    label: '严防死守',
    icon: Shield,
    color: 'text-blue-400 bg-blue-500/15 border-blue-500/30',
    desc: '封锁气门，步步为营',
  },
  gentle: {
    label: '从容相让',
    icon: HeartHandshake,
    color: 'text-pink-300 bg-pink-500/15 border-pink-500/30',
    desc: '温柔相待，留有余地',
  },
  balanced: {
    label: '沉稳攻守',
    icon: Scale,
    color: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
    desc: '攻守兼备，从容不迫',
  },
};

export default function GomokuApp({
  currentCharacterId,
  characterName,
  onGameFinished,
  onInGameChat,
  onRejectInvite,
  onExit,
}: Props) {
  // Screen Mode: 'arena' (Full Screen Game) or 'hub' (Game Selection & Archives Hub)
  const initialSession = loadActiveGameSession(currentCharacterId);
  const pendingInviteOnMount = getPendingGameInvite();
  
  // Default to full-screen arena if there is an active session or a pending invite
  const [screenMode, setScreenMode] = useState<'arena' | 'hub'>('arena');

  // Hub sub-tabs: 'games' | 'invites' | 'history' | 'settings'
  const [hubTab, setHubTab] = useState<'games' | 'invites' | 'history' | 'settings'>('games');

  // Board & Game State
  const [board, setBoard] = useState<Cell[][]>(() =>
    initialSession?.board || Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null))
  );
  const [moveHistory, setMoveHistory] = useState<
    Array<{ step: number; r: number; c: number; color: 'B' | 'W'; timestamp: number }>
  >(() => initialSession?.moveHistory || []);
  const [playerColor, setPlayerColor] = useState<'B' | 'W'>(() => initialSession?.playerColor || 'B');
  const [currentTurn, setCurrentTurn] = useState<'B' | 'W'>(() => initialSession?.currentTurn || 'B');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [winner, setWinner] = useState<Cell | 'draw' | 'surrender' | null>(null);
  const [winningLine, setWinningLine] = useState<[number, number][] | null>(null);

  // AI Tactic State (Modulated by LLM during in-game chat)
  const [currentTactic, setCurrentTactic] = useState<AiTactic>('balanced');

  // Sound switch
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Pause State
  const [isPaused, setIsPaused] = useState<boolean>(() => (initialSession ? true : false));

  // In-Game Chat State
  const [inGameChats, setInGameChats] = useState<
    Array<{ id: string; sender: 'user' | 'character'; text: string; timestamp: number }>
  >(() => initialSession?.inGameChats || []);
  const [chatInputText, setChatInputText] = useState('');
  const [isChatSending, setIsChatSending] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);

  // Character Dialogue Bubble
  const [characterSpeech, setCharacterSpeech] = useState<string>(() => {
    if (initialSession && initialSession.moveHistory.length > 0) {
      return `（见你重新坐回棋盘前，微微抬眸）"局势已为你保存在第 ${initialSession.moveHistory.length} 手，请继续落子。"`;
    }
    return `（拂袖落座，指尖轻敲棋子）"落子无悔。你想执黑先行还是执白？"`;
  });

  // Stats & Match History Archive
  const [stats, setStats] = useState<GomokuStats>(() => loadGomokuStats(currentCharacterId));
  const [matchHistory, setMatchHistory] = useState<GomokuMatchRecord[]>([]);
  const [pendingInvitesList, setPendingInvitesList] = useState<GameInvitation[]>([]);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  // Debug mode switch
  const [debugShortcutEnabled, setDebugShortcutEnabled] = useState(isGameDebugShortcutEnabled);

  const charAvatar = loadCharAvatar(currentCharacterId);
  const boardRef = useRef<HTMLDivElement>(null);
  const gameFinalizedRef = useRef(false);
  const chatsEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of chat history when drawer opens or new message arrives
  useEffect(() => {
    if (showHistoryDrawer) {
      chatsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [inGameChats, showHistoryDrawer]);

  // Persistent Auto-Save In-Progress Match & Pause on Exit
  useEffect(() => {
    if (!winner && moveHistory.length > 0) {
      const session: ActiveGomokuSession = {
        characterId: currentCharacterId,
        characterName,
        board,
        moveHistory,
        playerColor,
        currentTurn,
        inGameChats,
        characterSpeech,
        isPaused: true,
        lastUpdated: Date.now(),
      };
      saveActiveGameSession(session);
    } else if (winner) {
      clearActiveGameSession(currentCharacterId);
    }
  }, [
    winner,
    moveHistory,
    board,
    playerColor,
    currentTurn,
    inGameChats,
    characterSpeech,
    currentCharacterId,
    characterName,
  ]);

  // Load history & pending list
  const refreshLists = useCallback(async () => {
    try {
      const records = await loadMatchRecords(currentCharacterId);
      setMatchHistory(records);
      const pending = await loadAllPendingInvites(currentCharacterId);
      setPendingInvitesList(pending);
    } catch {
      // ignore
    }
  }, [currentCharacterId]);

  useEffect(() => {
    refreshLists();
  }, [refreshLists]);

  // Handle active pending invitation upon mount
  useEffect(() => {
    const invite = getPendingGameInvite();
    if (invite) {
      acceptGameInvite(invite.id);
      setCharacterSpeech(`（微微勾起唇角，指尖轻敲棋子）"你果然赴约了。今日就陪你手谈一局，请吧。"`);
      setScreenMode('arena');
      refreshLists();
    }
  }, [refreshLists]);

  // Finalize Game & Trigger Mind Pipeline
  const finalizeGameConclusion = useCallback(
    (finalWinner: 'player' | 'character' | 'draw' | 'surrender') => {
      if (gameFinalizedRef.current) return;
      gameFinalizedRef.current = true;
      clearActiveGameSession(currentCharacterId);

      const resultStat =
        finalWinner === 'player' ? 'player' : finalWinner === 'draw' ? 'draw' : 'character';
      const updatedStats = saveGomokuStats(currentCharacterId, resultStat);
      setStats(updatedStats);

      if (soundEnabled && finalWinner === 'player') {
        playWinSound();
      }

      const matchRecord: GomokuMatchRecord = {
        id: `match_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        characterId: currentCharacterId,
        characterName,
        playerColor,
        winner: finalWinner,
        totalMoves: moveHistory.length,
        moves: [...moveHistory],
        chats: [...inGameChats],
        summary: '',
        timestamp: Date.now(),
      };

      const summary = generateGameSummary(matchRecord);
      matchRecord.summary = summary;

      if (onGameFinished) {
        onGameFinished(summary, matchRecord);
      }

      refreshLists();
    },
    [
      currentCharacterId,
      characterName,
      playerColor,
      moveHistory,
      inGameChats,
      soundEnabled,
      onGameFinished,
      refreshLists,
    ]
  );

  // Watch winner state
  useEffect(() => {
    if (!winner) return;

    if (winner === 'draw') {
      finalizeGameConclusion('draw');
      setCharacterSpeech(`（将剩余棋子收回盒中）"棋逢对手，不分伯仲。能与我下成和局，你很不错。"`);
    } else if (winner === playerColor) {
      finalizeGameConclusion('player');
      setCharacterSpeech(
        `（目光在胜势的五子处停留片刻，低笑一声）"竟然真被你破了局……棋力见长啊，这局算你赢了。"`
      );
    } else if (winner === 'surrender') {
      finalizeGameConclusion('surrender');
      setCharacterSpeech(`（轻按住你的棋子）"认输了？不急，棋局复盘多练几次自会开窍。"`);
    } else {
      finalizeGameConclusion('character');
      setCharacterSpeech(
        `（从容放下最后一子，抬眸看向你）"承让了。棋盘如战场，稍有不慎就会被我抓住破绽。还想再来吗？"`
      );
    }
  }, [winner, playerColor, finalizeGameConclusion]);

  // AI Move Execution
  const triggerAiMove = useCallback(
    (currentBoard: Cell[][], aiCol: 'B' | 'W') => {
      setIsAiThinking(true);

      setTimeout(() => {
        const [r, c] = findBestMove(currentBoard, aiCol, currentTactic);
        if (soundEnabled) {
          playStoneSound(aiCol === 'B');
        }

        const nextBoard = currentBoard.map((row) => [...row]);
        nextBoard[r][c] = aiCol;
        setBoard(nextBoard);

        const newHistoryItem = {
          step: moveHistory.length + 1,
          r,
          c,
          color: aiCol,
          timestamp: Date.now(),
        };
        setMoveHistory((prev) => [...prev, newHistoryItem]);

        const winCheck = checkWinner(nextBoard);
        if (winCheck.winner) {
          setWinner(winCheck.winner);
          setWinningLine(winCheck.line || null);
        } else {
          const isFull = nextBoard.every((row) => row.every((cell) => cell !== null));
          if (isFull) {
            setWinner('draw');
          } else {
            setCurrentTurn(aiCol === 'B' ? 'W' : 'B');
          }
        }
        setIsAiThinking(false);
      }, 450 + Math.random() * 250);
    },
    [moveHistory.length, currentTactic, soundEnabled]
  );

  // Human Cell Click
  const handleCellClick = (r: number, c: number) => {
    if (winner || isAiThinking) return;
    if (board[r][c] !== null) return;
    if (isPaused) {
      setIsPaused(false);
    }
    if (currentTurn !== playerColor) return;

    if (soundEnabled) {
      playStoneSound(playerColor === 'B');
    }

    const nextBoard = board.map((row) => [...row]);
    nextBoard[r][c] = playerColor;
    setBoard(nextBoard);

    const newHistoryItem = {
      step: moveHistory.length + 1,
      r,
      c,
      color: playerColor,
      timestamp: Date.now(),
    };
    setMoveHistory((prev) => [...prev, newHistoryItem]);

    const winCheck = checkWinner(nextBoard);
    if (winCheck.winner) {
      setWinner(winCheck.winner);
      setWinningLine(winCheck.line || null);
      return;
    }

    const isFull = nextBoard.every((row) => row.every((cell) => cell !== null));
    if (isFull) {
      setWinner('draw');
      return;
    }

    const aiColor = playerColor === 'B' ? 'W' : 'B';
    setCurrentTurn(aiColor);
    triggerAiMove(nextBoard, aiColor);
  };

  // Restart / Reset
  const handleRestart = (newPlayerColor = playerColor) => {
    gameFinalizedRef.current = false;
    clearActiveGameSession(currentCharacterId);
    const emptyBoard = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
    setBoard(emptyBoard);
    setMoveHistory([]);
    setInGameChats([]);
    setWinner(null);
    setWinningLine(null);
    setIsPaused(false);
    setPlayerColor(newPlayerColor);
    setCurrentTurn('B');
    setIsAiThinking(false);
    setCurrentTactic('balanced');

    if (newPlayerColor === 'W') {
      setCharacterSpeech(`（黑子先落，轻扣天元）"既然你让我先行，那我就不客气了。"`);
      triggerAiMove(emptyBoard, 'B');
    } else {
      setCharacterSpeech(`（棋盘归整如初）"请吧，执黑先行。这次可要全力以赴。"`);
    }
  };

  // Undo Move
  const handleUndo = () => {
    if (moveHistory.length < 2 || isAiThinking || winner) return;

    const newHistory = moveHistory.slice(0, moveHistory.length - 2);
    const newBoard = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
    newHistory.forEach((m) => {
      newBoard[m.r][m.c] = m.color;
    });

    setBoard(newBoard);
    setMoveHistory(newHistory);
    setCurrentTurn(playerColor);
    setCharacterSpeech(`（无奈失笑，任由你收回棋子）"下错了？落子可要多看三步。"`);
  };

  // Surrender
  const handleSurrender = () => {
    if (winner || moveHistory.length === 0) return;
    setWinner('surrender');
  };

  // Toggle Pause / Resume
  const togglePause = () => {
    if (winner || moveHistory.length === 0) return;
    setIsPaused((prev) => {
      const next = !prev;
      if (next) {
        setCharacterSpeech(`（静候在棋盘前，双手拢入袖中）"棋局已暂停。等你得空我们再接着下。"`);
      } else {
        setCharacterSpeech(`（抬眸微微一笑）"继续手谈。该谁落子了？"`);
      }
      return next;
    });
  };

  // In-Game Live Chat Sender
  const handleSendInGameChat = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = chatInputText.trim();
    if (!text || isChatSending) return;

    const userMsg = {
      id: `chat_${Date.now()}`,
      sender: 'user' as const,
      text,
      timestamp: Date.now(),
    };
    const updatedChats = [...inGameChats, userMsg];
    setInGameChats(updatedChats);
    setChatInputText('');
    setIsChatSending(true);

    try {
      if (onInGameChat) {
        const res = await onInGameChat(
          text,
          {
            moveCount: moveHistory.length,
            playerColor,
            currentTurn,
          },
          updatedChats
        );

        let replyText = '';
        if (typeof res === 'object' && res !== null && 'reply' in res) {
          replyText = res.reply;
          if (res.tactic) {
            setCurrentTactic(res.tactic);
          }
        } else if (typeof res === 'string') {
          replyText = res;
        }

        if (replyText) {
          setCharacterSpeech(replyText);
          const charMsg = {
            id: `chat_${Date.now() + 1}`,
            sender: 'character' as const,
            text: replyText,
            timestamp: Date.now(),
          };
          setInGameChats((prev) => [...prev, charMsg]);
        }
      }
    } catch (err) {
      console.warn('In-game chat error, using in-character fallback:', err);
      const fallbackReply = `（指尖轻叩棋盘，眼眸含笑）"专心看棋，别想借着说话乱我心神。"`;
      setCharacterSpeech(fallbackReply);
      setInGameChats((prev) => [
        ...prev,
        {
          id: `chat_${Date.now() + 1}`,
          sender: 'character',
          text: fallbackReply,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsChatSending(false);
    }
  };

  // Handle invitation actions in "Pending Invites" tab
  const handleAcceptPendingInvite = (invite: GameInvitation) => {
    acceptGameInvite(invite.id);
    setScreenMode('arena');
    handleRestart('B');
    setCharacterSpeech(`（含笑执子相待）"你赴约了，请执黑先行。"`);
    refreshLists();
  };

  const handleRejectPendingInvite = (invite: GameInvitation) => {
    rejectGameInvite(invite.id);
    if (onRejectInvite) {
      onRejectInvite(invite);
    }
    refreshLists();
  };

  // Exit Arena back to Hub
  const handleExitArena = () => {
    if (!winner && moveHistory.length > 0) {
      setIsPaused(true);
    }
    setScreenMode('hub');
  };

  const lastMove = moveHistory.length > 0 ? moveHistory[moveHistory.length - 1] : null;
  const ActiveTacticIcon = TACTIC_INFO[currentTactic].icon;

  // =========================================================================
  // VIEW 1: FULL SCREEN GAME ARENA (Strictly Follows User Request & Wireframe)
  // No phone chassis borders, no fake 5G/battery status bar, no top sub-tabs!
  // =========================================================================
  if (screenMode === 'arena') {
    return (
      <div className="fixed inset-0 z-[60] bg-gradient-to-b from-[#141210] via-[#1a1614] to-[#0c0a09] flex flex-col justify-between p-2.5 sm:p-4 text-white select-none animate-in fade-in-0 duration-200 overflow-hidden">
        
        {/* ================= TOP COMPACT HEADER ================= */}
        <div className="flex items-center justify-between px-1 shrink-0 pb-1">
          {/* Left: Exit to Game Hub button */}
          <button
            onClick={handleExitArena}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-amber-300 hover:text-white transition active:scale-95 cursor-pointer shadow-sm"
            title="退出对弈并自动暂存进度"
          >
            <ChevronLeft className="size-4" />
            <span>退出对局</span>
          </button>

          {/* Center: Live Game Status Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 border border-amber-500/30 text-xs shadow-inner">
            <span
              className={`size-2 rounded-full ${
                currentTurn === 'B' ? 'bg-black border border-white/60' : 'bg-white'
              } ${isAiThinking ? 'animate-ping' : ''}`}
            />
            <span className="font-semibold text-white/90">
              {winner
                ? '对局结束'
                : isPaused
                ? '对局已暂停'
                : isAiThinking
                ? `${characterName} 正在思考...`
                : currentTurn === playerColor
                ? `轮到你落子 · 执${playerColor === 'B' ? '黑' : '白'}`
                : `${characterName} 回合`}
            </span>
          </div>

          {/* Right: Score and Sound Mute toggle */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white/70">
              <Trophy className="size-3 text-amber-400" />
              <span>{stats.playerWins}胜 {stats.characterWins}负</span>
            </div>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-white/60 hover:text-white transition cursor-pointer"
              title={soundEnabled ? '静音落子声' : '开启落子声'}
            >
              {soundEnabled ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
            </button>
          </div>
        </div>

        {/* ================= 1. TOP/UPPER HALF: FULL PROMINENT CHESSBOARD ================= */}
        <div className="flex-1 flex items-center justify-center py-1 shrink-0">
          <div
            ref={boardRef}
            className="relative w-full max-w-[340px] sm:max-w-[400px] aspect-square rounded-2xl bg-gradient-to-br from-[#c89b65] via-[#b5844e] to-[#9a6a34] p-2.5 sm:p-3 shadow-[0_20px_50px_rgba(0,0,0,0.8)] border-[3.5px] border-[#7d5225] overflow-hidden select-none"
          >
            {/* Real Wood Grain Overlay */}
            <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:8px_8px] pointer-events-none" />

            <div className="relative w-full h-full">
              {/* SVG Grid Lines */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100">
                {Array.from({ length: BOARD_SIZE }).map((_, i) => {
                  const pos = (i / (BOARD_SIZE - 1)) * 100;
                  return (
                    <g key={`grid-${i}`}>
                      <line x1="0" y1={pos} x2="100" y2={pos} stroke="#5b3b19" strokeWidth="0.65" strokeOpacity="0.85" />
                      <line x1={pos} y1="0" x2={pos} y2="100" stroke="#5b3b19" strokeWidth="0.65" strokeOpacity="0.85" />
                    </g>
                  );
                })}

                {/* Star Points (3, 7, 11) */}
                {[
                  [3, 3],
                  [3, 11],
                  [7, 7],
                  [11, 3],
                  [11, 11],
                ].map(([r, c], idx) => {
                  const x = (c / (BOARD_SIZE - 1)) * 100;
                  const y = (r / (BOARD_SIZE - 1)) * 100;
                  return (
                    <circle key={`star-${idx}`} cx={x} cy={y} r="1.25" fill="#4a2e12" />
                  );
                })}

                {/* Winning Line Glow Indicator */}
                {winningLine && winningLine.length >= 2 && (
                  <line
                    x1={(winningLine[0][1] / (BOARD_SIZE - 1)) * 100}
                    y1={(winningLine[0][0] / (BOARD_SIZE - 1)) * 100}
                    x2={(winningLine[winningLine.length - 1][1] / (BOARD_SIZE - 1)) * 100}
                    y2={(winningLine[winningLine.length - 1][0] / (BOARD_SIZE - 1)) * 100}
                    stroke="#ef4444"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeDasharray="4 2"
                    className="animate-pulse"
                  />
                )}
              </svg>

              {/* 15x15 Interactive Cells */}
              <div className="absolute inset-0 grid grid-cols-15 grid-rows-15">
                {board.map((row, r) =>
                  row.map((cell, c) => {
                    const isLast = lastMove && lastMove.r === r && lastMove.c === c;
                    const isWinCell = winningLine?.some(([wr, wc]) => wr === r && wc === c);

                    return (
                      <div
                        key={`${r}-${c}`}
                        onClick={() => handleCellClick(r, c)}
                        className="relative flex items-center justify-center cursor-pointer group"
                      >
                        {/* Ghost hover preview */}
                        {!cell && !winner && !isAiThinking && currentTurn === playerColor && (
                          <div
                            className={`size-[78%] rounded-full opacity-0 group-hover:opacity-40 transition-opacity pointer-events-none ${
                              playerColor === 'B' ? 'bg-black' : 'bg-white'
                            }`}
                          />
                        )}

                        {/* Placed Stone */}
                        {cell && (
                          <div
                            className={`size-[88%] rounded-full shadow-md transition-transform scale-100 flex items-center justify-center ${
                              cell === 'B'
                                ? 'bg-gradient-to-br from-[#444] via-[#222] to-[#0a0a0a] border border-black/80 shadow-[0_3px_6px_rgba(0,0,0,0.65)]'
                                : 'bg-gradient-to-br from-[#ffffff] via-[#f0f0f0] to-[#d6d6d6] border border-gray-300 shadow-[0_3px_6px_rgba(0,0,0,0.4)]'
                            } ${isWinCell ? 'ring-2 ring-red-500 scale-105 animate-pulse' : ''}`}
                          >
                            <div
                              className={`size-1.5 rounded-full absolute top-1 left-1.5 ${
                                cell === 'B' ? 'bg-white/30' : 'bg-white/90'
                              }`}
                            />
                            {isLast && !winner && (
                              <div className="size-2 rounded-full bg-amber-400 shadow-sm animate-ping opacity-75" />
                            )}
                            {isLast && !winner && (
                              <div className="size-2 rounded-full bg-amber-400 shadow-sm" />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ================= 2. MIDDLE: CHARACTER DIALOGUE BUBBLE & LIVE TACTIC ================= */}
        <div className="shrink-0 max-w-xl mx-auto w-full space-y-1.5">
          <div className="relative p-3 rounded-2xl bg-black/60 border border-white/15 shadow-xl space-y-1.5 backdrop-blur-md">
            <div className="flex items-center justify-between">
              {/* Character Avatar + Name + Live Strategy Badge */}
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-full overflow-hidden bg-gradient-to-br from-[hsl(28_85%_62%)] to-[hsl(28_85%_62%/0.6)] flex items-center justify-center text-[10px] font-bold text-amber-950 ring-1 ring-amber-400/50 shrink-0">
                  {charAvatar ? (
                    <img src={charAvatar} alt={characterName} className="w-full h-full object-cover" />
                  ) : (
                    characterName.charAt(0)
                  )}
                </div>
                <span className="text-xs font-bold text-white">{characterName}</span>

                {/* Dynamic Strategy Badge */}
                <div
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${TACTIC_INFO[currentTactic].color}`}
                  title={TACTIC_INFO[currentTactic].desc}
                >
                  <ActiveTacticIcon className="size-3" />
                  <span>{TACTIC_INFO[currentTactic].label}</span>
                </div>
              </div>

              {/* History Drawer Toggle Button */}
              {inGameChats.length > 0 && (
                <button
                  onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
                  className="flex items-center gap-1 text-[11px] text-amber-300/80 hover:text-amber-300 transition cursor-pointer"
                >
                  <MessageSquare className="size-3" />
                  <span>{showHistoryDrawer ? '收起历史' : `交谈记录(${inGameChats.length})`}</span>
                  {showHistoryDrawer ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                </button>
              )}
            </div>

            {/* In-Character Dialogue Text (Direct LLM Speech) */}
            <p className="text-xs sm:text-[13px] text-amber-100 leading-relaxed italic pl-1">
              {characterSpeech}
            </p>

            {/* Collapsible Chat History Drawer */}
            {showHistoryDrawer && inGameChats.length > 0 && (
              <div className="mt-2 pt-2 border-t border-white/10 max-h-32 overflow-y-auto space-y-1.5 pr-1 no-scrollbar animate-in slide-in-from-top-2 duration-150">
                {inGameChats.map((c) => (
                  <div
                    key={c.id}
                    className={`text-[11px] p-2 rounded-xl leading-snug ${
                      c.sender === 'user'
                        ? 'bg-amber-500/20 text-amber-200 ml-6 text-right'
                        : 'bg-white/10 text-white/90 mr-6'
                    }`}
                  >
                    <span className="font-bold opacity-60 mr-1">
                      {c.sender === 'user' ? '你' : characterName}:
                    </span>
                    <span>{c.text}</span>
                  </div>
                ))}
                <div ref={chatsEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* ================= 3. LOWER: TALK INPUT FIELD ================= */}
        <div className="shrink-0 max-w-xl mx-auto w-full pt-1">
          <form onSubmit={handleSendInGameChat} className="flex items-center gap-2">
            <input
              type="text"
              value={chatInputText}
              onChange={(e) => setChatInputText(e.target.value)}
              placeholder="对TA说句话，TA会依据对话调整棋路..."
              disabled={isChatSending}
              className="flex-1 bg-black/50 border border-white/20 rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/40 outline-none focus:border-amber-400/80 transition shadow-inner"
            />
            <button
              type="submit"
              disabled={!chatInputText.trim() || isChatSending}
              className="flex items-center justify-center size-9 rounded-xl bg-gradient-to-r from-[hsl(28_85%_62%)] to-[hsl(28_95%_55%)] text-amber-950 font-bold hover:brightness-110 disabled:opacity-35 transition active:scale-95 cursor-pointer shadow-md"
              title="发送对话"
            >
              {isChatSending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </button>
          </form>
        </div>

        {/* ================= 4. BOTTOM: OPERATION TOOLBAR ================= */}
        <div className="shrink-0 max-w-xl mx-auto w-full grid grid-cols-5 gap-1.5 pt-1.5">
          {/* Switch Player Color */}
          <button
            onClick={() => handleRestart(playerColor === 'B' ? 'W' : 'B')}
            className="flex flex-col items-center justify-center py-2 px-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-medium text-white/80 hover:text-white transition active:scale-95 cursor-pointer"
            title="切换执黑/执白并重新开始"
          >
            <Dices className="size-3.5 text-amber-400 mb-0.5" />
            <span>{playerColor === 'B' ? '执黑(换白)' : '执白(换黑)'}</span>
          </button>

          {/* Undo Move */}
          <button
            onClick={handleUndo}
            disabled={moveHistory.length < 2 || isAiThinking || !!winner}
            className="flex flex-col items-center justify-center py-2 px-1 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none border border-white/10 text-[11px] font-medium text-white/80 hover:text-white transition active:scale-95 cursor-pointer"
            title="悔棋一步"
          >
            <Undo2 className="size-3.5 text-blue-400 mb-0.5" />
            <span>悔棋</span>
          </button>

          {/* Pause / Resume */}
          <button
            onClick={togglePause}
            disabled={moveHistory.length === 0 || !!winner}
            className="flex flex-col items-center justify-center py-2 px-1 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none border border-white/10 text-[11px] font-medium text-white/80 hover:text-white transition active:scale-95 cursor-pointer"
            title={isPaused ? '继续对局' : '暂停对局'}
          >
            {isPaused ? (
              <Play className="size-3.5 text-emerald-400 fill-current mb-0.5" />
            ) : (
              <Pause className="size-3.5 text-amber-400 mb-0.5" />
            )}
            <span>{isPaused ? '继续' : '暂停'}</span>
          </button>

          {/* Restart Match */}
          <button
            onClick={() => handleRestart(playerColor)}
            className="flex flex-col items-center justify-center py-2 px-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-medium text-white/80 hover:text-white transition active:scale-95 cursor-pointer"
            title="重新开局"
          >
            <RotateCcw className="size-3.5 text-amber-400 mb-0.5" />
            <span>重开</span>
          </button>

          {/* Surrender */}
          <button
            onClick={handleSurrender}
            disabled={moveHistory.length === 0 || !!winner}
            className="flex flex-col items-center justify-center py-2 px-1 rounded-xl bg-red-500/15 hover:bg-red-500/25 disabled:opacity-30 disabled:pointer-events-none border border-red-500/30 text-[11px] font-medium text-red-300 hover:text-red-200 transition active:scale-95 cursor-pointer"
            title="认输投子"
          >
            <Flag className="size-3.5 text-red-400 mb-0.5" />
            <span>认输</span>
          </button>
        </div>

      </div>
    );
  }

  // =========================================================================
  // VIEW 2: GAME HUB & ARCHIVE (When not playing / after exiting)
  // Shows game selection list, pending invitations, match history, and debug.
  // =========================================================================
  return (
    <div className="flex flex-col h-full space-y-3 text-white select-none pb-1 animate-in fade-in-0 duration-200">
      
      {/* Top Hub Navigation Bar */}
      <div className="flex items-center justify-between px-1 shrink-0">
        <div className="flex items-center gap-1.5">
          {onExit && (
            <button
              onClick={onExit}
              className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition cursor-pointer mr-1"
              title="返回桌面"
            >
              <ChevronLeft className="size-4" />
            </button>
          )}
          <Gamepad2 className="size-4 text-[hsl(28_85%_62%)]" />
          <h3 className="text-xs font-bold text-white">手谈游戏大厅</h3>
        </div>

        {/* Hub Tabs */}
        <div className="flex items-center gap-1 bg-white/[0.05] p-0.5 rounded-xl border border-white/10">
          <button
            onClick={() => setHubTab('games')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
              hubTab === 'games'
                ? 'bg-[hsl(28_85%_62%)] text-amber-950 shadow-xs'
                : 'text-white/60 hover:text-white'
            }`}
          >
            游戏
          </button>
          <button
            onClick={() => {
              setHubTab('invites');
              refreshLists();
            }}
            className={`relative px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
              hubTab === 'invites'
                ? 'bg-[hsl(28_85%_62%)] text-amber-950 shadow-xs'
                : 'text-white/60 hover:text-white'
            }`}
          >
            邀约
            {pendingInvitesList.length > 0 && (
              <span className="size-1.5 rounded-full bg-red-500 animate-pulse absolute top-1 right-1" />
            )}
          </button>
          <button
            onClick={() => {
              setHubTab('history');
              refreshLists();
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
              hubTab === 'history'
                ? 'bg-[hsl(28_85%_62%)] text-amber-950 shadow-xs'
                : 'text-white/60 hover:text-white'
            }`}
          >
            战绩
          </button>
          <button
            onClick={() => setHubTab('settings')}
            className={`p-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
              hubTab === 'settings'
                ? 'bg-[hsl(28_85%_62%)] text-amber-950 shadow-xs'
                : 'text-white/50 hover:text-white'
            }`}
            title="设置与调试"
          >
            <Settings className="size-3" />
          </button>
        </div>
      </div>

      {/* ================= TAB 1: GAME SELECTOR ================= */}
      {hubTab === 'games' && (
        <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar pr-0.5">
          {/* Active Gomoku Card */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-black/40 border border-amber-400/40 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-gradient-to-br from-[#c89b65] to-[#7d5225] text-amber-950 font-bold shadow-md ring-1 ring-amber-400/30">
                  <Swords className="size-5 text-amber-100" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>五子棋 (Gomoku)</span>
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-mono">
                      已就绪
                    </span>
                  </h4>
                  <p className="text-[10px] text-white/50">
                    与 {characterName} 展开15×15实木棋盘对弈，支持边下边聊
                  </p>
                </div>
              </div>
            </div>

            {/* Status & Stats info */}
            <div className="grid grid-cols-3 gap-2 p-2 rounded-xl bg-black/40 border border-white/5 text-center text-[10px]">
              <div>
                <span className="text-white/40 block">胜负战绩</span>
                <span className="font-bold text-amber-300">{stats.playerWins}胜 {stats.characterWins}负</span>
              </div>
              <div>
                <span className="text-white/40 block">当前状态</span>
                <span className="font-bold text-white/90">
                  {moveHistory.length > 0 && !winner ? `第 ${moveHistory.length} 手 (已暂存)` : '空闲'}
                </span>
              </div>
              <div>
                <span className="text-white/40 block">对弈风格</span>
                <span className="font-bold text-amber-200">{TACTIC_INFO[currentTactic].label}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-0.5">
              {moveHistory.length > 0 && !winner && (
                <button
                  onClick={() => handleRestart('B')}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/60 hover:text-white transition cursor-pointer"
                >
                  重新开局
                </button>
              )}
              <button
                onClick={() => setScreenMode('arena')}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[hsl(28_85%_62%)] to-[hsl(28_95%_55%)] text-amber-950 font-bold text-xs shadow-md transition hover:brightness-110 active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Play className="size-3.5 fill-current" />
                <span>{moveHistory.length > 0 && !winner ? '继续全屏对局' : '开始全屏对局'}</span>
              </button>
            </div>
          </div>

          {/* More Games Placeholders */}
          <div className="space-y-2">
            <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between opacity-70">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/5 text-white/40">
                  <Layers className="size-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white/70">弹胜社 · 双人推弹棋</h4>
                  <p className="text-[10px] text-white/30">传统桌游力学对抗小游戏</p>
                </div>
              </div>
              <span className="text-[10px] text-white/40 bg-white/5 px-2 py-0.5 rounded-full">
                敬请期待
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between opacity-70">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/5 text-white/40">
                  <Dices className="size-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white/70">双陆棋与投壶</h4>
                  <p className="text-[10px] text-white/30">古风雅趣休闲博弈</p>
                </div>
              </div>
              <span className="text-[10px] text-white/40 bg-white/5 px-2 py-0.5 rounded-full">
                敬请期待
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: PENDING INVITES ================= */}
      {hubTab === 'invites' && (
        <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar pr-0.5">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs font-bold text-white/80">待答复的游戏邀约</h4>
            <span className="text-[10px] text-white/40">选择“赴约”将立即全屏开局</span>
          </div>

          {pendingInvitesList.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
              <Inbox className="size-8 text-white/20 mx-auto" />
              <p className="text-xs text-white/40">暂无待处理的游戏邀约</p>
              <p className="text-[10px] text-white/30">
                当与角色在主界面交谈情绪融洽时，TA会主动发出下棋邀约
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {pendingInvitesList.map((inv) => (
                <div
                  key={inv.id}
                  className="p-3.5 rounded-2xl bg-black/40 border border-amber-400/30 space-y-3 shadow-md"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-full overflow-hidden bg-gradient-to-br from-[hsl(28_85%_62%)] to-[hsl(28_85%_62%/0.6)] flex items-center justify-center text-xs font-bold text-amber-950 ring-2 ring-amber-400/40">
                      {charAvatar ? (
                        <img src={charAvatar} alt={inv.characterName} className="w-full h-full object-cover" />
                      ) : (
                        inv.characterName.charAt(0)
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>{inv.characterName}</span>
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-400/30 px-1.5 py-0.2 rounded">
                          五子棋
                        </span>
                      </div>
                      <span className="text-[10px] text-white/40">
                        {new Date(inv.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-amber-100/90 italic leading-relaxed bg-white/[0.03] p-2.5 rounded-xl border border-white/5">
                    {inv.inviteText || '“可有兴致同我下一盘五子棋？”'}
                  </p>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleRejectPendingInvite(inv)}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-xs text-white/60 hover:text-red-200 transition cursor-pointer"
                    >
                      婉拒
                    </button>
                    <button
                      onClick={() => handleAcceptPendingInvite(inv)}
                      className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[hsl(28_85%_62%)] to-[hsl(28_95%_55%)] text-amber-950 font-bold text-xs shadow-md transition hover:brightness-110 active:scale-95 cursor-pointer"
                    >
                      赴约对弈
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 3: MATCH HISTORY ARCHIVE ================= */}
      {hubTab === 'history' && (
        <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar pr-0.5">
          {/* Stats Summary Card */}
          <div className="grid grid-cols-4 gap-2 p-3 rounded-2xl bg-black/40 border border-white/10 text-center">
            <div>
              <div className="text-sm font-bold text-white">
                {stats.playerWins + stats.characterWins + stats.draws}
              </div>
              <div className="text-[10px] text-white/40">总对局</div>
            </div>
            <div>
              <div className="text-sm font-bold text-emerald-400">{stats.playerWins}</div>
              <div className="text-[10px] text-white/40">胜局</div>
            </div>
            <div>
              <div className="text-sm font-bold text-red-400">{stats.characterWins}</div>
              <div className="text-[10px] text-white/40">负局</div>
            </div>
            <div>
              <div className="text-sm font-bold text-amber-400">
                {stats.playerWins + stats.characterWins > 0
                  ? `${Math.round((stats.playerWins / (stats.playerWins + stats.characterWins)) * 100)}%`
                  : '0%'}
              </div>
              <div className="text-[10px] text-white/40">胜率</div>
            </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs font-bold text-white/80">对局复盘档案</h4>
            <span className="text-[10px] text-white/40">保留最近 20 局</span>
          </div>

          {matchHistory.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
              <p className="text-xs text-white/40">暂无已完成的对局记录</p>
              <p className="text-[10px] text-white/30">下完一局后将自动沉淀复盘摘要</p>
            </div>
          ) : (
            <div className="space-y-2">
              {matchHistory.map((m) => {
                const isExpanded = expandedMatchId === m.id;
                const winText =
                  m.winner === 'player'
                    ? '胜利 🏆'
                    : m.winner === 'draw'
                    ? '和局 🤝'
                    : m.winner === 'surrender'
                    ? '认输 🏳️'
                    : '惜败 ⚔️';
                const winColor =
                  m.winner === 'player'
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                    : m.winner === 'draw'
                    ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                    : 'text-red-400 bg-red-500/10 border-red-500/20';

                return (
                  <div
                    key={m.id}
                    className="p-3 rounded-2xl bg-black/40 border border-white/10 space-y-2 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${winColor}`}>
                          {winText}
                        </span>
                        <span className="text-xs font-semibold text-white/90">
                          {m.totalMoves} 手 · 主控执{m.playerColor === 'B' ? '黑' : '白'}
                        </span>
                      </div>
                      <span className="text-[10px] text-white/40">
                        {new Date(m.timestamp).toLocaleDateString([], {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <p className="text-[11px] text-white/70 leading-relaxed line-clamp-2">
                      {m.summary}
                    </p>

                    <div className="flex items-center justify-between pt-1 border-t border-white/5">
                      <span className="text-[10px] text-white/40">
                        局内交谈: {m.chats.length} 条
                      </span>
                      <button
                        onClick={() => setExpandedMatchId(isExpanded ? null : m.id)}
                        className="flex items-center gap-1 text-[10px] text-amber-400 hover:underline cursor-pointer"
                      >
                        <span>{isExpanded ? '收起详情' : '查看完整复盘'}</span>
                        {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="mt-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-2 text-[10.5px] animate-in slide-in-from-top-1 duration-150">
                        <div>
                          <span className="font-bold text-amber-300 block mb-0.5">心智沉淀摘要:</span>
                          <p className="text-white/80 whitespace-pre-wrap leading-relaxed">{m.summary}</p>
                        </div>
                        {m.chats.length > 0 && (
                          <div>
                            <span className="font-bold text-amber-300 block mb-1">对弈交谈回顾:</span>
                            <div className="space-y-1 max-h-36 overflow-y-auto no-scrollbar">
                              {m.chats.map((c, i) => (
                                <div
                                  key={i}
                                  className={`p-1.5 rounded-lg ${
                                    c.sender === 'user' ? 'bg-amber-500/10 text-amber-200' : 'bg-white/5 text-white/80'
                                  }`}
                                >
                                  <span className="font-bold opacity-75 mr-1">
                                    {c.sender === 'user' ? '你' : m.characterName}:
                                  </span>
                                  <span>{c.text}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 4: SETTINGS & DEBUG ================= */}
      {hubTab === 'settings' && (
        <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar pr-0.5">
          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-3">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Settings className="size-3.5 text-amber-400" />
              <span>对弈游戏选项</span>
            </h4>

            <div className="space-y-2 text-xs text-white/80">
              <div className="flex items-center justify-between p-2 rounded-xl bg-white/5">
                <div>
                  <div className="font-semibold text-white">落子音效</div>
                  <div className="text-[10px] text-white/40">Web Audio 拟真棋石清脆敲击声</div>
                </div>
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    soundEnabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-white/10 text-white/40'
                  }`}
                >
                  {soundEnabled ? '已开启' : '已静音'}
                </button>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-white/5">
                <div>
                  <div className="font-semibold text-white">快速调试按钮</div>
                  <div className="text-[10px] text-white/40">在主对话区显示“测试触发邀约”入口</div>
                </div>
                <button
                  onClick={() => {
                    const next = !debugShortcutEnabled;
                    setDebugShortcutEnabled(next);
                    setGameDebugShortcutEnabled(next);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    debugShortcutEnabled ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-white/10 text-white/40'
                  }`}
                >
                  {debugShortcutEnabled ? '已显示' : '已隐藏'}
                </button>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-black/40 border border-red-500/20 space-y-2">
            <h4 className="text-xs font-bold text-red-300 flex items-center gap-1.5">
              <Trash2 className="size-3.5" />
              <span>数据与存档重置</span>
            </h4>
            <p className="text-[11px] text-white/50">
              重置当前角色【{characterName}】的胜负统计、暂存对局与对弈复盘档案。
            </p>
            <button
              onClick={() => {
                if (window.confirm(`确定要清空与 ${characterName} 的全部对弈战绩和暂存对局吗？`)) {
                  localStorage.removeItem(`__rp_gomoku_stats_${currentCharacterId}`);
                  localStorage.removeItem(`__rp_gomoku_history_${currentCharacterId}`);
                  clearActiveGameSession(currentCharacterId);
                  setStats({ playerWins: 0, characterWins: 0, draws: 0 });
                  setMatchHistory([]);
                  refreshLists();
                }
              }}
              className="px-3.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-xs text-red-300 hover:text-red-200 transition cursor-pointer"
            >
              清空本角色对弈战绩
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
