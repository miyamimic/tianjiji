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
  Layers,
  BrainCircuit,
  Eye,
  EyeOff,
  Check,
  AlertCircle
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
  recordGameEmotionImpact,
  type GomokuStats,
  type GomokuMatchRecord,
  type GameInvitation,
  type ActiveGomokuSession,
  type InGameChatMessage
} from '../../lib/gameStore';
import { loadCharAvatar, loadCharGomokuRank, saveCharGomokuRank, type GomokuRank } from '../../lib/customStore';
import { 
  BOARD_SIZE,
  checkWinner,
  generateStrategyCandidateGroups,
  generateGomokuCandidatePools,
  cleanAndNormalizeWeights,
  sampleMoveFromPools,
  detectBoardInflection,
  detectAiConsecutiveThree,
  selectMoveByStrategy,
  generateTop5CandidateMoves,
  analyzePlayerSandbagging,
  accumulateGameEmotionDelta,
  checkIfCharacterShouldSurrender,
  getEmotionWeightingObjectiveInfo,
  type Cell,
  type CandidateMove,
  type StrategyCandidateGroup,
  type GomokuCandidatePools,
  type GomokuWeights,
  type GomokuLlmOutput,
  type GomokuStrategy,
  type SandbaggingReport,
  type StepLogItem
} from '../../lib/gomokuProtocolEngine';
import { 
  generateGomokuLlmResponse,
  generateGomokuMoveDecision,
  loadLlmConfig,
  isLlmConfigured,
  type GomokuTriggerType
} from '../../lib/llm';
import { getCharacterById, MOCK_CHARACTERS, getSavedCharacters } from '../../data/characters';
import { EMOTION_NAMES } from '../../data/types';
import type { Character, EmotionVector, EmotionKey } from '../../data/types';
import InGameStickerBar from '../InGameStickerBar';
import GameCharacterSelector from './GameCharacterSelector';
import type { Sticker } from '../../lib/stickerStore';

export type { Cell };
export type AiTactic = 'aggressive' | 'defensive' | 'gentle' | 'balanced';

interface Props {
  currentCharacterId: string;
  characterName: string;
  character?: Character;
  currentEmotionSnapshot?: EmotionVector;
  onGameFinished?: (
    summary: string, 
    rawRecord: GomokuMatchRecord, 
    applyEmotionDelta?: boolean, 
    customDelta?: Partial<EmotionVector>
  ) => void;
  onApplyGameEmotionDelta?: (delta: Partial<EmotionVector>, summary: string) => void;
  onInGameChat?: (
    userInput: string,
    matchContext: { moveCount: number; playerColor: 'B' | 'W'; currentTurn: 'B' | 'W' },
    chatHistory?: InGameChatMessage[] | Array<{ sender: 'user' | 'character' | 'system'; text: string }>
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
  characterName: propCharacterName,
  character: propCharacter,
  currentEmotionSnapshot: propEmotionSnapshot,
  onGameFinished,
  onApplyGameEmotionDelta,
  onInGameChat,
  onRejectInvite,
  onExit,
}: Props) {
  const [selectedOpponentId, setSelectedOpponentId] = useState<string>(currentCharacterId);
  const activeChar = getCharacterById(selectedOpponentId) || propCharacter || MOCK_CHARACTERS[0];
  const characterName = activeChar.name;

  const initialEmotionSnapshot = propEmotionSnapshot || {
    joy: 0.5,
    sadness: 0.1,
    anger: 0.05,
    fear: 0.05,
    warmth: 0.6,
    desire: 0.4,
  };

  // Sync prop changes
  useEffect(() => {
    if (currentCharacterId && currentCharacterId !== selectedOpponentId) {
      setSelectedOpponentId(currentCharacterId);
    }
  }, [currentCharacterId]);

  // Screen Mode: 'arena' (Full Screen Game) or 'hub' (Game Selection & Archives Hub)
  const initialSession = loadActiveGameSession(selectedOpponentId);
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

  // Mechanical Protocol Layer State (v4.1)
  const [candidatePools, setCandidatePools] = useState<GomokuCandidatePools | null>(null);
  const [currentWeights, setCurrentWeights] = useState<GomokuWeights>({
    weight_attack: 0.10,
    weight_defend: 0.20,
    weight_steady: 0.70,
  });
  const [thoughtNote, setThoughtNote] = useState<string>('【心智备忘】甜蜜相伴对弈，以主控开怀为重。');
  const [opponentImpression, setOpponentImpression] = useState<string>('棋姿温雅，相伴甚欢');
  const [isPlaydateInvite, setIsPlaydateInvite] = useState<boolean>(true);
  const [lastCrisisTriggerStep, setLastCrisisTriggerStep] = useState<number>(-1);
  const [lastThreeTriggerKey, setLastThreeTriggerKey] = useState<string>('');
  const [lastAiWasLlm, setLastAiWasLlm] = useState<boolean>(false);
  const [lastChosenPool, setLastChosenPool] = useState<'attack' | 'defend' | 'steady'>('steady');
  const [isEmergencyActive, setIsEmergencyActive] = useState<boolean>(false);

  // Backward compatibility state for inspector / logs
  const [top5Candidates, setTop5Candidates] = useState<CandidateMove[]>([]);
  const [strategyGroups, setStrategyGroups] = useState<StrategyCandidateGroup | null>(null);
  const [lastEmotionLabel, setLastEmotionLabel] = useState<string>('');
  const [lastSelectedStrategy, setLastSelectedStrategy] = useState<GomokuStrategy | null>(null);
  const [sandbaggingReport, setSandbaggingReport] = useState<SandbaggingReport>({
    isPlayerSandbagging: false,
    abandonedBestPoints: [],
    playerMistakeCount: 0,
  });
  const [showInspector, setShowInspector] = useState(false);

  // In-Game Emotion Isolation & Step Logs
  const [gameTotalDelta, setGameTotalDelta] = useState<Partial<EmotionVector>>({});
  const [stepLogs, setStepLogs] = useState<StepLogItem[]>([]);
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [settlementPendingRecord, setSettlementPendingRecord] = useState<GomokuMatchRecord | null>(null);

  // AI Tactic State (Modulated by LLM during in-game chat)
  const [currentTactic, setCurrentTactic] = useState<AiTactic>('gentle');

  // Sound switch
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Pause State
  const [isPaused, setIsPaused] = useState<boolean>(() => (initialSession ? true : false));

  // In-Game Chat Stream & Timeline State (Persistent, scrollable round history)
  const [inGameChats, setInGameChats] = useState<InGameChatMessage[]>(() => {
    if (initialSession?.inGameChats && initialSession.inGameChats.length > 0) {
      return initialSession.inGameChats;
    }
    return [
      {
        id: `chat_init_${Date.now()}`,
        sender: 'character',
        text: `（拂袖落座，眉眼间满是温柔笑意）"难得与你约好对弈，今天只想安安静静陪着你。你想执黑先行还是执白？"`,
        timestamp: Date.now(),
      },
    ];
  });
  const [chatInputText, setChatInputText] = useState('');
  const [isChatSending, setIsChatSending] = useState(false);
  const [showSurrenderConfirm, setShowSurrenderConfirm] = useState(false);

  // Character Dialogue Bubble & Inner Thought
  const [characterSpeech, setCharacterSpeech] = useState<string>(() => {
    if (initialSession && initialSession.moveHistory.length > 0) {
      return `（见你重新坐回棋盘前，微微抬眸）"局势已为你保存在第 ${initialSession.moveHistory.length} 手，请继续落子。"`;
    }
    return `（拂袖落座，眉眼间满是温柔笑意）"难得与你约好对弈，今天只想安安静静陪着你。你想执黑先行还是执白？"`;
  });
  const [characterInnerThought, setCharacterInnerThought] = useState<string>('');

  // Stats & Match History Archive
  const [stats, setStats] = useState<GomokuStats>(() => loadGomokuStats(selectedOpponentId));
  const [matchHistory, setMatchHistory] = useState<GomokuMatchRecord[]>([]);
  const [pendingInvitesList, setPendingInvitesList] = useState<GameInvitation[]>([]);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  // Character Gomoku Skill Level
  const [charRank, setCharRank] = useState<GomokuRank>(() => loadCharGomokuRank(selectedOpponentId));

  // Debug mode switch
  const [debugShortcutEnabled, setDebugShortcutEnabled] = useState(isGameDebugShortcutEnabled);

  const charAvatar = loadCharAvatar(selectedOpponentId);
  const boardRef = useRef<HTMLDivElement>(null);
  const gameFinalizedRef = useRef(false);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const chatsEndRef = useRef<HTMLDivElement>(null);

  // Switch opponent helper
  const handleSwitchOpponent = (newId: string) => {
    if (newId === selectedOpponentId) return;
    if (!winner && moveHistory.length > 0) {
      saveActiveGameSession({
        characterId: selectedOpponentId,
        characterName,
        board,
        moveHistory,
        playerColor,
        currentTurn,
        inGameChats,
        characterSpeech,
        isPaused: true,
        lastUpdated: Date.now(),
      });
    }
    setSelectedOpponentId(newId);
    const newSession = loadActiveGameSession(newId);

    if (newSession && newSession.moveHistory.length > 0) {
      setBoard(newSession.board);
      setMoveHistory(newSession.moveHistory);
      setPlayerColor(newSession.playerColor);
      setCurrentTurn(newSession.currentTurn);
      setInGameChats(newSession.inGameChats);
      setCharacterSpeech(newSession.characterSpeech);
      setWinner(null);
      setIsPaused(true);
    } else {
      setBoard(Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)));
      setMoveHistory([]);
      setWinner(null);
      setWinningLine(null);
      setPlayerColor('B');
      setCurrentTurn('B');
      setIsPaused(false);
      const greeting = `（见你落座，眼中带着欣喜）"今天想和我下棋吗？来吧，执黑先行。"`;
      setCharacterSpeech(greeting);
      setInGameChats([
        {
          id: `chat_init_${Date.now()}`,
          sender: 'character',
          text: greeting,
          timestamp: Date.now(),
        },
      ]);
    }

    setStats(loadGomokuStats(newId));
    setCharRank(loadCharGomokuRank(newId));
  };

  // Auto-scroll to bottom of live chat stream when new message arrives
  useEffect(() => {
    chatsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [inGameChats]);

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

  // Finalize Game Record Preparation (Opens Settlement Modal)
  const prepareGameSettlement = useCallback(
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

      // Base game delta based on outcome if no step delta accumulated
      let calculatedTotalDelta = { ...gameTotalDelta };
      if (Object.keys(calculatedTotalDelta).length === 0) {
        if (finalWinner === 'player') {
          calculatedTotalDelta = { joy: 0.2, warmth: 0.15, desire: 0.1 };
        } else if (finalWinner === 'character') {
          calculatedTotalDelta = { joy: 0.25, warmth: 0.1, anger: -0.05 };
        } else if (finalWinner === 'draw') {
          calculatedTotalDelta = { warmth: 0.2, joy: 0.1 };
        } else {
          calculatedTotalDelta = { warmth: 0.1, desire: 0.05 };
        }
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
        gameTotalDelta: calculatedTotalDelta,
        stepLogs: [...stepLogs],
        sandbaggingReport: { ...sandbaggingReport },
        emotionApplied: false,
      };

      const summary = generateGameSummary(matchRecord);
      matchRecord.summary = summary;

      setSettlementPendingRecord(matchRecord);
      setShowSettlementModal(true);
      refreshLists();
    },
    [
      currentCharacterId,
      characterName,
      playerColor,
      moveHistory,
      inGameChats,
      soundEnabled,
      gameTotalDelta,
      stepLogs,
      sandbaggingReport,
      refreshLists,
    ]
  );

  // Settlement Confirm Actions
  const handleConfirmSettlement = (apply: boolean) => {
    if (!settlementPendingRecord) return;
    const finalRecord = {
      ...settlementPendingRecord,
      emotionApplied: apply,
    };

    // Record emotion impact item for sidebar audit
    recordGameEmotionImpact({
      id: `impact_${Date.now()}`,
      matchId: finalRecord.id,
      characterId: currentCharacterId,
      characterName,
      timestamp: Date.now(),
      winner: finalRecord.winner,
      totalMoves: finalRecord.totalMoves,
      totalDelta: finalRecord.gameTotalDelta || {},
      applied: apply,
      appliedTimestamp: apply ? Date.now() : undefined,
      summary: finalRecord.summary || `五子棋对局(${finalRecord.totalMoves}手)`,
    });

    if (apply && onApplyGameEmotionDelta && finalRecord.gameTotalDelta) {
      onApplyGameEmotionDelta(finalRecord.gameTotalDelta, finalRecord.summary);
    }

    if (onGameFinished) {
      onGameFinished(finalRecord.summary, finalRecord, apply, finalRecord.gameTotalDelta);
    }

    setShowSettlementModal(false);
    refreshLists();
  };

  // Watch winner state & trigger dynamic game_over settlement dialogue
  useEffect(() => {
    if (!winner) return;

    const handleGameOverSettlement = async () => {
      const finalWinner =
        winner === 'draw'
          ? 'draw'
          : winner === 'surrender'
          ? 'surrender'
          : winner === playerColor
          ? 'player'
          : 'character';

      prepareGameSettlement(finalWinner);

      const llmConfig = loadLlmConfig();
      if (isLlmConfigured(llmConfig)) {
        try {
          const aiCol: 'B' | 'W' = playerColor === 'B' ? 'W' : 'B';
          const activeRank = loadCharGomokuRank(currentCharacterId);
          const pools =
            candidatePools ||
            generateGomokuCandidatePools(board, aiCol, activeRank, initialEmotionSnapshot);

          const endRes = await generateGomokuLlmResponse(llmConfig, {
            trigger: 'game_over',
            character: activeChar,
            currentEmotionSnapshot: initialEmotionSnapshot,
            charRank: activeRank,
            aiColor: aiCol,
            is_playdate_invite: isPlaydateInvite,
            candidatePools: pools,
            oldWeights: currentWeights,
            previousThoughtNote: thoughtNote,
            opponentImpression,
            stepNumber: moveHistory.length,
            recentMoves: moveHistory.map((m) => ({ step: m.step, r: m.r, c: m.c, color: m.color })),
            inGameChats: inGameChats.map((c) => ({ sender: c.sender, text: c.text })),
            gameResult: finalWinner,
          });

          if (endRes.ending_dialog) {
            setCharacterSpeech(endRes.ending_dialog);
            setInGameChats((prev) => [
              ...prev,
              {
                id: `chat_end_llm_${Date.now()}`,
                sender: 'character',
                text: endRes.ending_dialog,
                thought: endRes.thought_note,
                tactic: currentTactic,
                timestamp: Date.now(),
              },
            ]);
            return;
          }
        } catch (err) {
          console.warn('Game over LLM dialogue error, using fallback:', err);
        }
      }

      // Fallback if LLM not configured
      if (winner === 'draw') {
        setCharacterSpeech(`（将剩余棋子收回盒中）"棋逢对手，不分伯仲。能与我下成和局，你很不错。"`);
      } else if (winner === playerColor) {
        setCharacterSpeech(`（目光在胜势处停留片刻，含笑抬眸）"你赢了。只要你开心，这盘棋就下得值得。"`);
      } else if (winner === 'surrender') {
        setCharacterSpeech(`（见你投子认负，轻按住你的手背，眼眸微敛）"认输了？胜败乃兵家常事，这局你下得很有章法，待会儿再陪你下一盘。"`);
      } else {
        setCharacterSpeech(`（从容放下最后一子，抬眸看向你）"承让了。棋盘如战场，还想再来一局吗？"`);
      }
    };

    handleGameOverSettlement();
  }, [
    winner,
    playerColor,
    prepareGameSettlement,
    activeChar,
    initialEmotionSnapshot,
    candidatePools,
    board,
    currentCharacterId,
    isPlaydateInvite,
    currentWeights,
    thoughtNote,
    opponentImpression,
    moveHistory,
    inGameChats,
    currentTactic,
  ]);

  // AI Move Execution: Entertainment & Companion Oriented (User instructions are supreme)
  const triggerAiMove = useCallback(
    async (currentBoard: Cell[][], aiCol: 'B' | 'W') => {
      setIsAiThinking(true);

      const activeRank = loadCharGomokuRank(currentCharacterId);

      // 1. JS Mechanical Layer: Generate the 3 Candidate Pools
      const pools = generateGomokuCandidatePools(currentBoard, aiCol, activeRank, initialEmotionSnapshot);
      setCandidatePools(pools);
      setStrategyGroups({
        aggressive: pools.attack_candidates,
        balanced: pools.defend_candidates,
        passive: pools.steady_candidates,
      });
      setTop5Candidates([...pools.attack_candidates, ...pools.defend_candidates, ...pools.steady_candidates].slice(0, 5));

      const llmConfig = loadLlmConfig();
      let activeWeights = { ...currentWeights };
      let activeThought = thoughtNote;
      let activeImpression = opponentImpression;
      let spokenText = '';

      // Count moves made by AI
      const aiMovesCount = moveHistory.filter((m) => m.color === aiCol).length;
      const isAiFirstMove = aiMovesCount === 0;
      const currentStepCount = moveHistory.length + 1;

      // Companionship banter trigger (random flirt or first move, NO board-state fighting triggers)
      const isOccasionalFlirt = !lastAiWasLlm && aiMovesCount >= 2 && Math.random() < 0.25;

      const shouldCallLlm =
        isLlmConfigured(llmConfig) && (isAiFirstMove || isOccasionalFlirt);

      if (shouldCallLlm) {
        try {
          const triggerType: GomokuTriggerType = isAiFirstMove ? 'first_move' : 'flirt';

          const llmRes = await generateGomokuLlmResponse(llmConfig, {
            trigger: triggerType,
            character: activeChar,
            currentEmotionSnapshot: initialEmotionSnapshot,
            charRank: activeRank,
            aiColor: aiCol,
            is_playdate_invite: isPlaydateInvite,
            candidatePools: pools,
            oldWeights: currentWeights,
            previousThoughtNote: thoughtNote,
            opponentImpression,
            stepNumber: currentStepCount,
            recentMoves: moveHistory.map((m) => ({ step: m.step, r: m.r, c: m.c, color: m.color })),
            inGameChats: inGameChats.map((c) => ({ sender: c.sender, text: c.text })),
          });

          // Check if AI resigns
          if (llmRes.action === 'resign') {
            const resignSpeech =
              llmRes.speech_text ||
              `（抬眸看着你，眼角含笑地放下手中棋子）"这局算我认输了，只要你玩得开心就好。"`;
            setCharacterSpeech(resignSpeech);
            setWinner(playerColor);
            setInGameChats((prev) => [
              ...prev,
              {
                id: `chat_event_resign_${Date.now()}`,
                sender: 'character',
                text: resignSpeech,
                thought: llmRes.thought_note,
                tactic: currentTactic,
                timestamp: Date.now(),
              },
            ]);
            setIsAiThinking(false);
            return;
          }

          activeWeights = {
            weight_attack: llmRes.weight_attack,
            weight_defend: llmRes.weight_defend,
            weight_steady: llmRes.weight_steady,
          };
          activeThought = llmRes.thought_note;
          activeImpression = llmRes.opponent_impression;
          spokenText = llmRes.speech_text;

          setCurrentWeights(activeWeights);
          setThoughtNote(activeThought);
          setOpponentImpression(activeImpression);
          setLastAiWasLlm(true);
        } catch (err) {
          console.warn('LLM Gomoku update error, using existing weights:', err);
          const simulatedDelayMs = 500 + Math.floor(Math.random() * 350);
          await new Promise((resolve) => setTimeout(resolve, simulatedDelayMs));
          setLastAiWasLlm(false);
        }
      } else {
        // Fast JS turn: simulate human deliberation delay
        const simulatedDelayMs = 520 + Math.floor(Math.random() * 380);
        await new Promise((resolve) => setTimeout(resolve, simulatedDelayMs));
        setLastAiWasLlm(false);
      }

      // 3. JS Mechanical Layer: Weighted Sampling across the 3 Candidate Pools without forced mechanical blocking
      const sampleRes = sampleMoveFromPools(pools, activeWeights);
      const chosenCoord = sampleRes.coord;
      setLastChosenPool(sampleRes.chosenPool);
      setIsEmergencyActive(false);
      setLastSelectedStrategy(
        sampleRes.chosenPool === 'attack' ? 'aggressive' : sampleRes.chosenPool === 'defend' ? 'balanced' : 'passive'
      );

      const [r, c] = chosenCoord;

      if (soundEnabled) {
        playStoneSound(aiCol === 'B');
      }

      if (spokenText) {
        setCharacterSpeech(spokenText);
        setInGameChats((prev) => [
          ...prev,
          {
            id: `chat_event_speech_${Date.now()}`,
            sender: 'character',
            text: spokenText,
            thought: activeThought,
            tactic: currentTactic,
            timestamp: Date.now(),
          },
        ]);
      }
      if (activeThought) {
        setCharacterInnerThought(activeThought);
      }

      // Record step log
      const newStepLog: StepLogItem = {
        step: currentStepCount,
        coord: [r, c],
        color: aiCol,
        weights: activeWeights,
        chosenPool: sampleRes.chosenPool,
        isEmergencyOverride: false,
        innerThought: activeThought,
        spokenDialogue: spokenText,
        timestamp: Date.now(),
      };
      setStepLogs((prev) => [...prev, newStepLog]);

      const nextBoard = currentBoard.map((row) => [...row]);
      nextBoard[r][c] = aiCol;
      setBoard(nextBoard);

      const newHistoryItem = {
        step: currentStepCount,
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
        setInGameChats((prev) => [
          ...prev,
          {
            id: `chat_win_event_${Date.now()}`,
            sender: 'system',
            text: `⚔️ 「${characterName}」达成五子连珠，获得胜利。`,
            timestamp: Date.now(),
          },
        ]);
      } else {
        const isFull = nextBoard.every((row) => row.every((cell) => cell !== null));
        if (isFull) {
          setWinner('draw');
          setInGameChats((prev) => [
            ...prev,
            {
              id: `chat_draw_event_${Date.now()}`,
              sender: 'system',
              text: `🤝 棋盘已满，双方握手言和。`,
              timestamp: Date.now(),
            },
          ]);
        } else {
          setCurrentTurn(aiCol === 'B' ? 'W' : 'B');
        }
      }
      setIsAiThinking(false);
    },
    [
      moveHistory,
      activeChar,
      initialEmotionSnapshot,
      inGameChats,
      soundEnabled,
      currentTactic,
      characterName,
      currentCharacterId,
      currentWeights,
      thoughtNote,
      opponentImpression,
      isPlaydateInvite,
      lastAiWasLlm,
      playerColor,
    ]
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
      const playerWinSpeech = `（目光在胜势的五子处停留片刻，低笑一声）"竟然真被你破了局……棋力见长啊，这局算你赢了。"`;
      setCharacterSpeech(playerWinSpeech);
      setInGameChats((prev) => [
        ...prev,
        {
          id: `chat_win_event_${Date.now()}`,
          sender: 'system',
          text: `🏆 五子连珠！你赢得了对局胜利！`,
          timestamp: Date.now(),
        },
        {
          id: `chat_char_win_resp_${Date.now() + 1}`,
          sender: 'character',
          text: playerWinSpeech,
          timestamp: Date.now() + 1,
        },
      ]);
      return;
    }

    const isFull = nextBoard.every((row) => row.every((cell) => cell !== null));
    if (isFull) {
      setWinner('draw');
      setInGameChats((prev) => [
        ...prev,
        {
          id: `chat_draw_event_${Date.now()}`,
          sender: 'system',
          text: `🤝 棋盘已满，双方握手言和。`,
          timestamp: Date.now(),
        },
      ]);
      return;
    }

    const aiColor = playerColor === 'B' ? 'W' : 'B';
    setCurrentTurn(aiColor);
    triggerAiMove(nextBoard, aiColor);
  };

  // Restart / Reset (v4.1: Calls LLM with trigger='game_start' and passes is_playdate_invite=true)
  const handleRestart = async (newPlayerColor = playerColor, isPlaydate = true) => {
    gameFinalizedRef.current = false;
    clearActiveGameSession(currentCharacterId);
    const emptyBoard = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
    setBoard(emptyBoard);
    setMoveHistory([]);
    setStepLogs([]);
    setGameTotalDelta({});
    setWinner(null);
    setWinningLine(null);
    setShowSettlementModal(false);
    setShowSurrenderConfirm(false);
    setSettlementPendingRecord(null);
    setIsPaused(false);
    setPlayerColor(newPlayerColor);
    setCurrentTurn('B');
    setIsAiThinking(false);
    setCurrentTactic('gentle');
    setIsPlaydateInvite(isPlaydate);
    setLastCrisisTriggerStep(-1);
    setLastThreeTriggerKey('');
    setLastAiWasLlm(false);

    const aiCol: 'B' | 'W' = newPlayerColor === 'B' ? 'W' : 'B';
    const activeRank = loadCharGomokuRank(currentCharacterId);
    const initialPools = generateGomokuCandidatePools(emptyBoard, aiCol, activeRank, initialEmotionSnapshot);
    setCandidatePools(initialPools);

    const defaultSoftWeights: GomokuWeights = {
      weight_attack: 0.10,
      weight_defend: 0.20,
      weight_steady: 0.70,
    };
    setCurrentWeights(defaultSoftWeights);

    const llmConfig = loadLlmConfig();
    let initialOpeningText =
      newPlayerColor === 'W'
        ? `（黑子先落，轻扣天元）"既然你让我先行，那我就落这一子了。你想怎么下都依你。"`
        : `（拂袖落座，眉眼含笑）"难得与你相约手谈，今天只想安安静静陪你下棋。请吧，执黑先行。"`;

    if (isLlmConfigured(llmConfig)) {
      try {
        const startRes = await generateGomokuLlmResponse(llmConfig, {
          trigger: 'game_start',
          character: activeChar,
          currentEmotionSnapshot: initialEmotionSnapshot,
          charRank: activeRank,
          aiColor: aiCol,
          is_playdate_invite: isPlaydate,
          candidatePools: initialPools,
          oldWeights: defaultSoftWeights,
          previousThoughtNote: thoughtNote,
          opponentImpression,
          stepNumber: 1,
          recentMoves: [],
          inGameChats: [],
          isPlayerSandbagging: false,
          abandonedBestPoints: [],
        });

        const newWeights: GomokuWeights = {
          weight_attack: startRes.weight_attack,
          weight_defend: startRes.weight_defend,
          weight_steady: startRes.weight_steady,
        };
        setCurrentWeights(newWeights);
        setThoughtNote(startRes.thought_note);
        setOpponentImpression(startRes.opponent_impression);
        if (startRes.opening_dialog) {
          initialOpeningText = startRes.opening_dialog;
        }
      } catch (err) {
        console.warn('Game start LLM error, using local defaults:', err);
      }
    }

    setCharacterSpeech(initialOpeningText);
    setInGameChats([
      {
        id: `chat_init_${Date.now()}`,
        sender: 'character',
        text: initialOpeningText,
        timestamp: Date.now(),
      },
    ]);

    // If AI is Black, AI plays Move 1 immediately with local JS weighted sampling
    if (newPlayerColor === 'W') {
      triggerAiMove(emptyBoard, 'B');
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
    const undoText = `（无奈失笑，任由你收回棋子）"下错了？落子可要多看三步。"`;
    setCharacterSpeech(undoText);
    setInGameChats((prev) => [
      ...prev,
      {
        id: `chat_undo_sys_${Date.now()}`,
        sender: 'system',
        text: `↩️ 悔棋一步`,
        timestamp: Date.now(),
      },
      {
        id: `chat_undo_char_${Date.now() + 1}`,
        sender: 'character',
        text: undoText,
        timestamp: Date.now() + 1,
      },
    ]);
  };

  // Surrender: Show confirmation first
  const handleSurrender = () => {
    if (winner || moveHistory.length === 0) return;
    setShowSurrenderConfirm(true);
  };

  // Confirm Player Surrender
  const confirmPlayerSurrender = () => {
    setShowSurrenderConfirm(false);
    setWinner('surrender');
    const concedeSpeech = `（见你投子认负，轻按住你的手背，眼眸微敛）"认输了？胜败乃兵家常事，这局你下得很有章法，待会儿再陪你下一盘。"`;
    setCharacterSpeech(concedeSpeech);
    setInGameChats((prev) => [
      ...prev,
      {
        id: `chat_user_surrender_${Date.now()}`,
        sender: 'system',
        text: `🏳️ 你主动投子认负。`,
        timestamp: Date.now(),
      },
      {
        id: `chat_char_concede_${Date.now() + 1}`,
        sender: 'character',
        text: concedeSpeech,
        timestamp: Date.now() + 1,
      },
    ]);
  };

  // Toggle Pause / Resume
  const togglePause = () => {
    if (winner || moveHistory.length === 0) return;
    setIsPaused((prev) => {
      const next = !prev;
      const speech = next
        ? `（静候在棋盘前，双手拢入袖中）"棋局已暂停。等你得空我们再接着下。"`
        : `（抬眸微微一笑）"继续手谈。该谁落子了？"`;
      setCharacterSpeech(speech);
      setInGameChats((old) => [
        ...old,
        {
          id: `chat_pause_sys_${Date.now()}`,
          sender: 'system',
          text: next ? '⏸️ 对局已暂停' : '▶️ 对局继续进行',
          timestamp: Date.now(),
        },
        {
          id: `chat_pause_char_${Date.now() + 1}`,
          sender: 'character',
          text: speech,
          timestamp: Date.now() + 1,
        },
      ]);
      return next;
    });
  };

  // In-Game Live Chat Sender (v4.1: Calls LLM with trigger='player_chat' to update weights and dialogue)
  const handleSendInGameChat = async (e?: React.FormEvent, overrideText?: string, overrideSticker?: Sticker) => {
    if (e) e.preventDefault();
    const text = (overrideText !== undefined ? overrideText : chatInputText).trim();
    if (!text || isChatSending) return;

    const userMsg: InGameChatMessage = {
      id: `chat_user_${Date.now()}`,
      sender: 'user',
      text: overrideSticker ? `[表情: ${overrideSticker.name}]` : text,
      stickerUrl: overrideSticker?.url,
      stickerName: overrideSticker?.name,
      timestamp: Date.now(),
    };
    const updatedChats = [...inGameChats, userMsg];
    setInGameChats(updatedChats);
    if (overrideText === undefined) {
      setChatInputText('');
    }
    setIsChatSending(true);

    const llmConfig = loadLlmConfig();
    const aiCol: 'B' | 'W' = playerColor === 'B' ? 'W' : 'B';
    const activeRank = loadCharGomokuRank(selectedOpponentId);
    const pools = candidatePools || generateGomokuCandidatePools(board, aiCol, activeRank, initialEmotionSnapshot);

    try {
      if (isLlmConfigured(llmConfig)) {
        const chatRes = await generateGomokuLlmResponse(llmConfig, {
          trigger: 'player_chat',
          character: activeChar,
          currentEmotionSnapshot: initialEmotionSnapshot,
          charRank: activeRank,
          aiColor: aiCol,
          is_playdate_invite: isPlaydateInvite,
          candidatePools: pools,
          oldWeights: currentWeights,
          previousThoughtNote: thoughtNote,
          opponentImpression,
          stepNumber: moveHistory.length + 1,
          recentMoves: moveHistory.map((m) => ({ step: m.step, r: m.r, c: m.c, color: m.color })),
          inGameChats: updatedChats.map((c) => ({ sender: c.sender, text: c.text })),
          isPlayerSandbagging: sandbaggingReport.isPlayerSandbagging,
          abandonedBestPoints: sandbaggingReport.abandonedBestPoints,
          playerChatText: overrideSticker ? `[发送了表情包: ${overrideSticker.name}]` : text,
        });

        // Check if AI obeys user instructions by resigning
        if (chatRes.action === 'resign') {
          const resignSpeech =
            chatRes.speech_text ||
            `（见你如此说，微笑着将指间棋子放回盒中）"好好好，依你便是。这局算我输了，你开心就好。"`;
          setCharacterSpeech(resignSpeech);
          setWinner(playerColor);
          const charMsg: InGameChatMessage = {
            id: `chat_char_resign_${Date.now() + 1}`,
            sender: 'character',
            text: resignSpeech,
            thought: chatRes.thought_note || '顺从主控心愿，主动投子认负。',
            tactic: currentTactic,
            timestamp: Date.now() + 1,
          };
          setInGameChats((prev) => [...prev, charMsg]);
          setIsChatSending(false);
          return;
        }

        setCurrentWeights({
          weight_attack: chatRes.weight_attack,
          weight_defend: chatRes.weight_defend,
          weight_steady: chatRes.weight_steady,
        });
        setThoughtNote(chatRes.thought_note);
        setOpponentImpression(chatRes.opponent_impression);

        if (chatRes.speech_text) {
          setCharacterSpeech(chatRes.speech_text);
          const charMsg: InGameChatMessage = {
            id: `chat_char_${Date.now() + 1}`,
            sender: 'character',
            text: chatRes.speech_text,
            thought: chatRes.thought_note,
            tactic: currentTactic,
            timestamp: Date.now() + 1,
          };
          setInGameChats((prev) => [...prev, charMsg]);
        }
      } else if (onInGameChat) {
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
          const charMsg: InGameChatMessage = {
            id: `chat_char_${Date.now() + 1}`,
            sender: 'character',
            text: replyText,
            tactic: currentTactic,
            timestamp: Date.now() + 1,
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
          id: `chat_fallback_${Date.now() + 1}`,
          sender: 'character',
          text: fallbackReply,
          timestamp: Date.now() + 1,
        },
      ]);
    } finally {
      setIsChatSending(false);
    }
  };

  const handleSendStickerInGame = (sticker: Sticker) => {
    handleSendInGameChat(undefined, `[发送了表情包: ${sticker.name}]`, sticker);
  };

  // Handle invitation actions in "Pending Invites" tab (passes isPlaydate=true)
  const handleAcceptPendingInvite = (invite: GameInvitation) => {
    acceptGameInvite(invite.id);
    setScreenMode('arena');
    handleRestart('B', true);
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
          {/* Left: Exit to Game Hub button & Character switch */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExitArena}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-amber-300 hover:text-white transition active:scale-95 cursor-pointer shadow-sm"
              title="退出对弈并自动暂存进度"
            >
              <ChevronLeft className="size-4" />
              <span className="hidden sm:inline">退出</span>
            </button>

            <GameCharacterSelector
              selectedCharacterId={selectedOpponentId}
              onSelectCharacter={handleSwitchOpponent}
              compact={true}
            />
          </div>

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

          {/* Right: Protocol Inspector toggle & Score & Sound Mute toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInspector(!showInspector)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition cursor-pointer ${
                showInspector
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-white/5 hover:bg-white/10 text-white/60 border-white/10'
              }`}
              title="查看机械层 Top-5 候选与心智分析"
            >
              <BrainCircuit className="size-3.5 text-amber-400" />
              <span className="hidden sm:inline">心智分析</span>
            </button>

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
        <div className="flex-1 flex items-center justify-center py-1 shrink-0 relative">
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
                    const candidateIndex = top5Candidates.findIndex((cand) => cand.coord[0] === r && cand.coord[1] === c);

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

                        {/* Hint Glow Badges (when Inspector is open and cell is empty) - No 12345 numbers */}
                        {showInspector && !cell && candidateIndex !== -1 && (
                          <div className="absolute size-2.5 rounded-full bg-amber-400/80 shadow-[0_0_8px_rgba(251,191,36,0.8)] pointer-events-none z-10 animate-pulse border border-amber-200" />
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

          {/* Floating Mechanical Top-5 & Mind Analysis Inspector Drawer */}
          {showInspector && (
            <div className="absolute right-2 top-2 bottom-2 w-64 rounded-2xl bg-black/85 border border-amber-500/30 p-3 shadow-2xl backdrop-blur-md overflow-y-auto no-scrollbar space-y-2.5 z-20 animate-in slide-in-from-right-2 duration-150 text-xs">
              <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                <div className="flex items-center gap-1.5 font-bold text-amber-300">
                  <BrainCircuit className="size-4" />
                  <span>机械层与心智透镜</span>
                </div>
                <button
                  onClick={() => setShowInspector(false)}
                  className="p-1 rounded-lg text-white/50 hover:text-white transition cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              {/* v4.1 Persistent Weights & Sampling Status */}
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-amber-200">
                  <span>三维偏好权重 (v4.1)</span>
                  <div className="flex items-center gap-1">
                    {lastAiWasLlm ? (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-400/30">
                        ⚡ LLM决策
                      </span>
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                        ⏱️ 真人拟真
                      </span>
                    )}
                    {isEmergencyActive ? (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse">
                        🚨 生死防守
                      </span>
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30">
                        {lastChosenPool === 'attack' ? '进攻' : lastChosenPool === 'defend' ? '防守' : '稳健'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 text-[10px]">
                  {/* Attack weight */}
                  <div className="space-y-0.5">
                    <div className="flex justify-between text-red-300 font-medium">
                      <span>🔥 进攻权重 (weight_attack)</span>
                      <span className="font-mono">{(currentWeights.weight_attack * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/10">
                      <div
                        className="h-full bg-gradient-to-r from-red-500 to-rose-400 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, currentWeights.weight_attack * 100))}%` }}
                      />
                    </div>
                  </div>

                  {/* Defend weight */}
                  <div className="space-y-0.5">
                    <div className="flex justify-between text-amber-300 font-medium">
                      <span>🛡️ 防守权重 (weight_defend)</span>
                      <span className="font-mono">{(currentWeights.weight_defend * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/10">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, currentWeights.weight_defend * 100))}%` }}
                      />
                    </div>
                  </div>

                  {/* Steady weight */}
                  <div className="space-y-0.5">
                    <div className="flex justify-between text-blue-300 font-medium">
                      <span>⚖️ 稳健权重 (weight_steady)</span>
                      <span className="font-mono">{(currentWeights.weight_steady * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/10">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, currentWeights.weight_steady * 100))}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Opponent Impression & Thought Note */}
              <div className="p-2 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                <div className="text-[10px] text-amber-200/90 font-bold flex items-center gap-1">
                  <span>🧠 心智备忘与对手印象:</span>
                </div>
                <div className="text-[9.5px] text-white/80 bg-black/30 p-1.5 rounded-lg space-y-1 border border-white/5">
                  <div>
                    <span className="text-amber-400/90 font-medium">对手印象: </span>
                    <span className="italic">{opponentImpression || '观察中...'}</span>
                  </div>
                  <div>
                    <span className="text-blue-400/90 font-medium">思维笔记: </span>
                    <span className="italic text-white/70">{thoughtNote || '按当前策略推演中。'}</span>
                  </div>
                </div>
              </div>

              {/* Character Rank and Sandbagging fact */}
              <div className="p-2 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                <div className="text-[11px] font-bold text-white flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Swords className="size-3 text-amber-400" />
                    <span>角色对局等级:</span>
                  </span>
                  <span className="text-amber-300 font-mono">
                    {charRank === 'bronze' ? '青铜(×0.6封顶)' : charRank === 'silver' ? '白银(×0.8封顶)' : charRank === 'gold' ? '黄金(无封顶)' : '王者(×1.2上限)'}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1 pt-0.5">
                  {(['bronze', 'silver', 'gold', 'master'] as GomokuRank[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => {
                        setCharRank(r);
                        saveCharGomokuRank(currentCharacterId, r);
                      }}
                      className={`py-0.5 text-[9px] rounded font-medium border transition cursor-pointer ${
                        charRank === r
                          ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                          : 'border-white/10 text-white/40 hover:text-white/70'
                      }`}
                    >
                      {r === 'bronze' ? '青铜' : r === 'silver' ? '白银' : r === 'gold' ? '黄金' : '王者'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sandbagging fact */}
              <div className="p-2 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <div className="text-[11px] font-bold text-white flex items-center justify-between">
                  <span>放水让子检测:</span>
                  <span className={sandbaggingReport.isPlayerSandbagging ? 'text-amber-400' : 'text-emerald-400'}>
                    {sandbaggingReport.isPlayerSandbagging ? '⚠️ 发现让棋迹象' : '✅ 正常对抗'}
                  </span>
                </div>
                {sandbaggingReport.abandonedBestPoints.length > 0 && (
                  <p className="text-[10px] text-white/60">
                    错失点位: {sandbaggingReport.abandonedBestPoints.map(p => `[${p.coord.join(',')}]`).join('、')}
                  </p>
                )}
              </div>

              {/* Strategy Candidate Groups Pool */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-amber-200 block">机械层三组候选池 (v4.1):</span>
                {candidatePools ? (
                  <div className="space-y-1.5">
                    {/* Attack pool */}
                    <div className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold text-red-300">
                        <span>🔥 进攻池 (attack_candidates)</span>
                        <span className="text-[9px] font-normal text-red-300/70">{candidatePools.attack_candidates.length} 项</span>
                      </div>
                      {candidatePools.attack_candidates.map((c, i) => (
                        <div key={i} className="text-[9.5px] text-white/80 flex justify-between">
                          <span>[{c.coord[0]},{c.coord[1]}] {c.reason}</span>
                          <span className="font-mono text-red-300/70">{c.score}</span>
                        </div>
                      ))}
                    </div>

                    {/* Defend pool */}
                    <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold text-amber-300">
                        <span>🛡️ 防守池 (defend_candidates)</span>
                        <span className="text-[9px] font-normal text-amber-300/70">{candidatePools.defend_candidates.length} 项</span>
                      </div>
                      {candidatePools.defend_candidates.map((c, i) => (
                        <div key={i} className="text-[9.5px] text-white/80 flex justify-between">
                          <span>[{c.coord[0]},{c.coord[1]}] {c.reason}</span>
                          <span className="font-mono text-amber-300/70">{c.score}</span>
                        </div>
                      ))}
                    </div>

                    {/* Steady pool */}
                    <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold text-blue-300">
                        <span>⚖️ 稳健池 (steady_candidates)</span>
                        <span className="text-[9px] font-normal text-blue-300/70">{candidatePools.steady_candidates.length} 项</span>
                      </div>
                      {candidatePools.steady_candidates.map((c, i) => (
                        <div key={i} className="text-[9.5px] text-white/80 flex justify-between">
                          <span>[{c.coord[0]},{c.coord[1]}] {c.reason}</span>
                          <span className="font-mono text-blue-300/70">{c.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : strategyGroups ? (
                  <div className="space-y-1.5">
                    {/* Aggressive group */}
                    <div className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold text-red-300">
                        <span>🔥 进攻组 (aggressive)</span>
                        <span className="text-[9px] font-normal text-red-300/70">{strategyGroups.aggressive.length} 项</span>
                      </div>
                      {strategyGroups.aggressive.map((c, i) => (
                        <div key={i} className="text-[9.5px] text-white/80 flex justify-between">
                          <span>[{c.coord[0]},{c.coord[1]}] {c.reason}</span>
                          <span className="font-mono text-red-300/60">{c.score}</span>
                        </div>
                      ))}
                    </div>

                    {/* Balanced group */}
                    <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold text-amber-300">
                        <span>⚖️ 稳健组 (balanced)</span>
                        <span className="text-[9px] font-normal text-amber-300/70">{strategyGroups.balanced.length} 项</span>
                      </div>
                      {strategyGroups.balanced.map((c, i) => (
                        <div key={i} className="text-[9.5px] text-white/80 flex justify-between">
                          <span>[{c.coord[0]},{c.coord[1]}] {c.reason}</span>
                          <span className="font-mono text-amber-300/60">{c.score}</span>
                        </div>
                      ))}
                    </div>

                    {/* Passive group */}
                    <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold text-blue-300">
                        <span>🍃 保守/闲棋组 (passive)</span>
                        <span className="text-[9px] font-normal text-blue-300/70">{strategyGroups.passive.length} 项</span>
                      </div>
                      {strategyGroups.passive.map((c, i) => (
                        <div key={i} className="text-[9.5px] text-white/80 flex justify-between">
                          <span>[{c.coord[0]},{c.coord[1]}] {c.reason}</span>
                          <span className="font-mono text-blue-300/60">{c.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : top5Candidates.length > 0 ? (
                  top5Candidates.map((cand, idx) => (
                    <div
                      key={idx}
                      className="p-1.5 rounded-lg bg-white/[0.04] border border-white/5 space-y-0.5"
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-amber-300">
                          [{cand.coord[0]}, {cand.coord[1]}]
                        </span>
                        <span className="text-[9px] font-mono text-white/50">{cand.score}</span>
                      </div>
                      <p className="text-[9.5px] text-white/70">{cand.reason}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-white/40 italic">等待下一手演算...</p>
                )}
              </div>

              {/* In-Game Accumulated Emotion Delta */}
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1 text-[10.5px]">
                <span className="font-bold text-amber-300 block">局内隔离情绪累积账本:</span>
                <p className="text-white/60 text-[9.5px]">
                  （此数值对局中完全隔离，仅在对局结束后经你确认才结算写入主世界）
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {Object.entries(gameTotalDelta).map(([k, v]) => (
                    <span key={k} className="px-1.5 py-0.5 rounded bg-black/40 text-amber-200 font-mono text-[10px]">
                      {EMOTION_NAMES[k as EmotionKey] || k}: {v && v > 0 ? `+${v.toFixed(2)}` : v?.toFixed(2)}
                    </span>
                  ))}
                  {Object.keys(gameTotalDelta).length === 0 && (
                    <span className="text-white/40 text-[10px]">暂无剧烈波动</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ================= 2. MIDDLE: PERSISTENT LIVE SCROLLABLE ROUND & CHAT STREAM ================= */}
        <div className="shrink-0 max-w-xl mx-auto w-full flex flex-col space-y-1">
          <div
            ref={chatScrollContainerRef}
            className="h-[130px] sm:h-[155px] w-full rounded-2xl bg-black/65 border border-white/15 p-2.5 overflow-y-auto space-y-2 backdrop-blur-md shadow-inner text-xs"
          >
            {inGameChats.map((c) => {
              if (c.sender === 'system') {
                return (
                  <div key={c.id} className="flex justify-center my-1">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 border border-amber-500/25 text-amber-200 shadow-xs">
                      {c.text}
                    </span>
                  </div>
                );
              }

              if (c.sender === 'user') {
                return (
                  <div key={c.id} className="flex justify-end gap-1.5 items-end ml-8">
                    <div className="bg-gradient-to-r from-amber-600/30 to-amber-500/25 border border-amber-400/30 text-amber-100 px-3 py-1.5 rounded-2xl rounded-br-xs text-xs shadow-sm max-w-[85%] break-words space-y-1">
                      {c.stickerUrl && (
                        <div className="rounded-xl overflow-hidden max-w-[110px] max-h-[110px] bg-black/40 border border-amber-400/30 p-1">
                          <img src={c.stickerUrl} alt={c.stickerName || '表情包'} referrerPolicy="no-referrer" className="w-full h-full object-contain rounded-lg" />
                        </div>
                      )}
                      <div>{c.text}</div>
                    </div>
                    <div className="size-5 rounded-full bg-amber-500/30 border border-amber-400/40 text-[9px] font-bold text-amber-200 flex items-center justify-center shrink-0">
                      你
                    </div>
                  </div>
                );
              }

              // Character message
              return (
                <div key={c.id} className="flex items-start gap-2 mr-6 text-xs">
                  <div className="size-6 rounded-full overflow-hidden bg-gradient-to-br from-[hsl(28_85%_62%)] to-[hsl(28_85%_62%/0.6)] flex items-center justify-center text-[9px] font-bold text-amber-950 ring-1 ring-amber-400/50 shrink-0 mt-0.5">
                    {charAvatar ? (
                      <img src={charAvatar} alt={characterName} className="w-full h-full object-cover" />
                    ) : (
                      characterName.charAt(0)
                    )}
                  </div>

                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-amber-300 text-[11px]">{characterName}</span>
                      {c.moveStep && (
                        <span className="text-[9px] bg-white/10 text-white/70 px-1.5 py-0.2 rounded font-mono">
                          第 {c.moveStep} 手
                        </span>
                      )}
                      {c.emotionLabel ? (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-200 border border-amber-400/30 font-medium">
                          {c.emotionLabel}
                        </span>
                      ) : c.tactic && TACTIC_INFO[c.tactic as AiTactic] ? (
                        <span className={`text-[9px] px-1.5 py-0.2 rounded border ${TACTIC_INFO[c.tactic as AiTactic].color}`}>
                          {TACTIC_INFO[c.tactic as AiTactic].label}
                        </span>
                      ) : null}
                      {c.strategy === 'passive' && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                          棋风偏保守
                        </span>
                      )}
                    </div>

                    <div className="p-2 rounded-2xl rounded-tl-xs bg-white/[0.08] border border-white/10 text-white/95 leading-relaxed break-words space-y-1">
                      {c.stickerUrl && (
                        <div className="rounded-xl overflow-hidden max-w-[110px] max-h-[110px] bg-black/40 border border-white/20 p-1">
                          <img src={c.stickerUrl} alt={c.stickerName || '表情包'} referrerPolicy="no-referrer" className="w-full h-full object-contain rounded-lg" />
                        </div>
                      )}
                      <div>{c.text}</div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={chatsEndRef} />
          </div>
        </div>

        {/* ================= 3. LOWER: TALK INPUT FIELD & STICKERS ================= */}
        <div className="shrink-0 max-w-xl mx-auto w-full pt-0.5 space-y-1.5">
          {/* In-Game Sticker Bar */}
          <InGameStickerBar
            currentCharacterId={selectedOpponentId}
            characterName={characterName}
            onSelectSticker={handleSendStickerInGame}
            disabled={isChatSending}
          />

          <form onSubmit={handleSendInGameChat} className="flex items-center gap-2">
            <input
              type="text"
              value={chatInputText}
              onChange={(e) => setChatInputText(e.target.value)}
              placeholder="边下边聊，对TA说句话..."
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
        <div className="shrink-0 max-w-xl mx-auto w-full grid grid-cols-5 gap-1.5 pt-1">
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

        {/* Surrender Confirmation Modal */}
        {showSurrenderConfirm && (
          <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in-0 duration-150">
            <div className="max-w-xs w-full rounded-2xl bg-gradient-to-b from-[#221c17] to-[#120f0d] border border-red-500/40 p-4 space-y-3 shadow-2xl text-white">
              <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                <Flag className="size-4" />
                <span>投子认负确认</span>
              </div>
              <p className="text-xs text-white/80 leading-relaxed">
                确定要向【{characterName}】投子认负吗？本局将以对方获胜结算，并沉淀相应对局情绪。
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => setShowSurrenderConfirm(false)}
                  className="py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs text-white/70 hover:text-white transition cursor-pointer"
                >
                  继续对弈
                </button>
                <button
                  onClick={confirmPlayerSurrender}
                  className="py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md transition active:scale-95 cursor-pointer"
                >
                  确定认输
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= 5. POST-GAME EMOTION SETTLEMENT CONFIRMATION MODAL ================= */}
        {showSettlementModal && settlementPendingRecord && (
          <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in-0 duration-200">
            <div className="max-w-md w-full rounded-3xl bg-gradient-to-b from-[#221c17] to-[#120f0d] border border-amber-400/40 p-5 space-y-4 shadow-2xl text-white">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <Trophy className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">对弈胜负与情绪结算确认</h3>
                    <p className="text-[11px] text-white/50">
                      共 {settlementPendingRecord.totalMoves} 手 ·{' '}
                      {settlementPendingRecord.winner === 'player'
                        ? '你赢得了对局 🏆'
                        : settlementPendingRecord.winner === 'surrender'
                        ? '玩家主动投子认负 🏳️'
                        : settlementPendingRecord.winner === 'draw'
                        ? '双方战成和局 🤝'
                        : `${characterName} 赢得了对局 ⚔️`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Summary quote */}
              <div className="p-3 rounded-2xl bg-black/40 border border-white/10 space-y-1.5 text-xs">
                <div className="text-amber-300 font-semibold">{characterName} 的棋后心声:</div>
                <p className="text-white/80 italic leading-relaxed">
                  "{characterSpeech.replace(/^（.*?）/g, '') || '手谈一局，意犹未尽。'}"
                </p>
              </div>

              {/* Emotion Ledger Breakdown */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-200">本次对局产生的情绪沉淀 (账本)</span>
                  <span className="text-[10px] text-white/40">完全隔离，需确认应用</span>
                </div>

                <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-white/[0.04] border border-white/10 text-center">
                  {Object.entries(settlementPendingRecord.gameTotalDelta || {}).map(([k, v]) => {
                    const num = v || 0;
                    const isPos = num > 0;
                    return (
                      <div key={k} className="p-1.5 rounded-xl bg-black/30">
                        <span className="text-[10px] text-white/50 block">{EMOTION_NAMES[k as EmotionKey] || k}</span>
                        <span className={`text-xs font-bold font-mono ${isPos ? 'text-emerald-400' : num < 0 ? 'text-rose-400' : 'text-white/60'}`}>
                          {isPos ? `+${num.toFixed(2)}` : num.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                  {Object.keys(settlementPendingRecord.gameTotalDelta || {}).length === 0 && (
                    <div className="col-span-3 py-2 text-white/40 text-xs">
                      本局情绪波动平稳，无显著数值增减
                    </div>
                  )}
                </div>
              </div>

              {/* Confirm & Cancel Buttons */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  onClick={() => handleConfirmSettlement(false)}
                  className="py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white/70 hover:text-white transition active:scale-95 cursor-pointer"
                >
                  忽略，不沉淀情绪
                </button>
                <button
                  onClick={() => handleConfirmSettlement(true)}
                  className="py-2.5 rounded-xl bg-gradient-to-r from-[hsl(28_85%_62%)] to-[hsl(28_95%_55%)] text-amber-950 font-bold text-xs shadow-md hover:brightness-110 transition active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                >
                  <Check className="size-4" />
                  <span>应用到主世界情绪</span>
                </button>
              </div>

            </div>
          </div>
        )}

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
                        {m.gameTotalDelta && Object.keys(m.gameTotalDelta).length > 0 && (
                          <div>
                            <span className="font-bold text-amber-300 block mb-0.5">情绪结算账本:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(m.gameTotalDelta).map(([k, v]) => (
                                <span key={k} className="px-2 py-0.5 rounded-md bg-white/5 text-amber-200 font-mono text-[10px]">
                                  {EMOTION_NAMES[k as EmotionKey] || k}: {v && v > 0 ? `+${v.toFixed(2)}` : v?.toFixed(2)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
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
              <div className="p-2.5 rounded-xl bg-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white flex items-center gap-1">
                      <Swords className="size-3.5 text-amber-400" />
                      <span>{characterName} 的对局棋力等级</span>
                    </div>
                    <div className="text-[10px] text-white/40">约束进攻算力上限（不限制保守意图）</div>
                  </div>
                  <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-400/30 px-2 py-0.5 rounded">
                    {charRank === 'bronze' ? '青铜 (上限×0.6)' : charRank === 'silver' ? '白银 (上限×0.8)' : charRank === 'gold' ? '黄金 (标准高手)' : '王者 (杀招上限×1.2)'}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {(['bronze', 'silver', 'gold', 'master'] as GomokuRank[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => {
                        setCharRank(r);
                        saveCharGomokuRank(currentCharacterId, r);
                      }}
                      className={`py-1.5 text-[10px] font-bold rounded-lg border transition cursor-pointer flex flex-col items-center gap-0.5 ${
                        charRank === r
                          ? 'border-amber-400 bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/40'
                          : 'border-white/10 bg-black/30 text-white/40 hover:text-white/80'
                      }`}
                    >
                      <span>{r === 'bronze' ? '青铜' : r === 'silver' ? '白银' : r === 'gold' ? '黄金' : '王者'}</span>
                      <span className="text-[8px] font-normal opacity-70 scale-90">
                        {r === 'bronze' ? '×0.6封顶' : r === 'silver' ? '×0.8封顶' : r === 'gold' ? '无封顶' : '×1.2上限'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

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
