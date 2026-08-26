import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  RotateCcw, 
  Trophy, 
  Flag, 
  Sparkles, 
  CheckCircle2, 
  Send, 
  History, 
  Loader2, 
  Volume2, 
  VolumeX, 
  HelpCircle,
  Flame,
  Shield,
  Layers,
  X,
  Shuffle,
  Pointer,
  Sparkle
} from 'lucide-react';
import { 
  createCompactDeck,
  dealInitialHands,
  autoDiscardPairs,
  executeDrawCard,
  checkGhostCardWinner,
  shuffleHand,
  type Card,
  type DiscardedPair,
  type UserBluffHistoryItem,
  type CharBluffHistoryItem,
  type GhostCardKeyMoment,
  type CardHoverReaction,
  type TacticDirection
} from '../../lib/ghostCardEngine';
import { 
  saveActiveGhostCardSession,
  loadActiveGhostCardSession,
  clearActiveGhostCardSession,
  saveGameEmotionImpact,
  type ActiveGhostCardSession,
  type InGameChatMessage,
  type GameInvitation
} from '../../lib/gameStore';
import { 
  idbSaveGameMatch, 
  idbLoadGameMatches, 
  type DBGameMatchRecord 
} from '../../lib/idb';
import { loadCharAvatar } from '../../lib/customStore';
import { 
  generateGhostCardOpening,
  generateGhostCardBatchHoverReactions,
  generateGhostCardUserDrawReaction,
  generateGhostCardCharHoverDecision,
  generateGhostCardCharFinalDraw,
  generateGhostCardEnding,
  loadLlmConfig,
  isLlmConfigured,
  callLlm
} from '../../lib/llm';
import { getCharacterById, MOCK_CHARACTERS } from '../../data/characters';
import { EMOTION_NAMES } from '../../data/types';
import type { Character, EmotionVector, EmotionKey } from '../../data/types';
import InGameStickerBar from '../InGameStickerBar';
import GameCharacterSelector from './GameCharacterSelector';
import type { Sticker } from '../../lib/stickerStore';
import { ChevronLeft } from 'lucide-react';

interface Props {
  currentCharacterId: string;
  characterName: string;
  character?: Character;
  currentEmotionSnapshot?: EmotionVector;
  onGameFinished?: (
    summary: string, 
    rawRecord: DBGameMatchRecord, 
    applyEmotionDelta?: boolean, 
    customDelta?: Partial<EmotionVector>
  ) => void;
  onApplyGameEmotionDelta?: (delta: Partial<EmotionVector>, summary: string) => void;
  onRejectInvite?: (invite: GameInvitation) => void;
  onExit?: () => void;
}

// -------------------------------------------------------------
// Web Audio Sound Synthesizers
// -------------------------------------------------------------

function playCardDrawSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.08);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  } catch {}
}

function playCardHoverSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(560, now);
    osc.frequency.linearRampToValueAtTime(620, now + 0.03);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  } catch {}
}

function playPairMatchSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    [523.25, 659.25, 1046.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      gain.gain.setValueAtTime(0.18, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.3);
    });
  } catch {}
}

function playGhostRevealSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.linearRampToValueAtTime(220, now + 0.3);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.36);
  } catch {}
}

function playVictorySound() {
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
      gain.gain.setValueAtTime(0.15, now + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.1 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.45);
    });
  } catch {}
}

export const GhostCardApp: React.FC<Props> = ({
  currentCharacterId,
  characterName: propCharacterName,
  character: propChar,
  currentEmotionSnapshot,
  onGameFinished,
  onApplyGameEmotionDelta,
  onExit,
}) => {
  const [selectedOpponentId, setSelectedOpponentId] = useState<string>(currentCharacterId);
  const activeChar = getCharacterById(selectedOpponentId) || propChar || MOCK_CHARACTERS[0];
  const characterName = activeChar.name;
  const charAvatar = loadCharAvatar(selectedOpponentId);

  // Sync prop changes
  useEffect(() => {
    if (currentCharacterId && currentCharacterId !== selectedOpponentId) {
      setSelectedOpponentId(currentCharacterId);
    }
  }, [currentCharacterId]);

  // Mechanical State
  const [userHand, setUserHand] = useState<Card[]>([]);
  const [charHand, setCharHand] = useState<Card[]>([]);
  const [discardPile, setDiscardPile] = useState<DiscardedPair[]>([]);
  const [ghostCardId, setGhostCardId] = useState<string>('');
  const [currentTurn, setCurrentTurn] = useState<'user' | 'character'>('user');
  const [turnCount, setTurnCount] = useState<number>(1);
  const [winner, setWinner] = useState<'user' | 'character' | 'surrender' | null>(null);

  // Bluff and Psychological History
  const [userBluffHistory, setUserBluffHistory] = useState<UserBluffHistoryItem[]>([]);
  const [charBluffHistory, setCharBluffHistory] = useState<CharBluffHistoryItem[]>([]);
  const [keyMoments, setKeyMoments] = useState<GhostCardKeyMoment[]>([]);

  // Dialogue and Interaction
  const [inGameChats, setInGameChats] = useState<InGameChatMessage[]>([]);
  const [characterSpeech, setCharacterSpeech] = useState<string>('“捉鬼牌马上开始了，来看看我们谁能先清空手牌～”');
  const [characterAction, setCharacterAction] = useState<string>('*轻轻理顺手中的卡牌*');
  const [characterInnerThought, setCharacterInnerThought] = useState<string>('');

  // -------------------------------------------------------------
  // Interaction State (Card Selection ≠ Game Action)
  // -------------------------------------------------------------
  interface SelectedCardTarget {
    zone: 'char' | 'user';
    index: number;
    card: Card;
  }
  const [selectedCard, setSelectedCard] = useState<SelectedCardTarget | null>(null);
  const [hoveredCharCardIdx, setHoveredCharCardIdx] = useState<number | null>(null);
  const [charBatchReactions, setCharBatchReactions] = useState<CardHoverReaction[]>([]);
  const lastHoveredIdxRef = useRef<number | null>(null);
  const charCardContainerRef = useRef<HTMLDivElement>(null);

  // Character Turn Focus & Intuition
  const [charHoveredUserCardIdx, setCharHoveredUserCardIdx] = useState<number | null>(null);
  const [isProactiveInitiative, setIsProactiveInitiative] = useState<boolean>(false);

  // System & Flags
  const [isLlmThinking, setIsLlmThinking] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [gameTotalDelta, setGameTotalDelta] = useState<Partial<EmotionVector>>({});

  // Modals
  const [showSettlementModal, setShowSettlementModal] = useState<boolean>(false);
  const [showSurrenderModal, setShowSurrenderModal] = useState<boolean>(false);
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [matchHistoryList, setMatchHistoryList] = useState<DBGameMatchRecord[]>([]);

  // Post-Game Data
  const [endingDialogue, setEndingDialogue] = useState<string>('');
  const [rewardOrPunishment, setRewardOrPunishment] = useState<string>('');
  const [emotionSettled, setEmotionSettled] = useState<boolean>(false);

  // Chat Input (Always Active)
  const [chatInputText, setChatInputText] = useState<string>('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [inGameChats, characterSpeech, characterInnerThought]);

  // -------------------------------------------------------------
  // Pre-calculate batch hover reactions for User's Draw Turn
  // -------------------------------------------------------------
  const prepareBatchHoverReactions = useCallback(
    async (currentHand: Card[], userCount: number, turn: number) => {
      if (currentHand.length === 0) return;
      const activeConfig = loadLlmConfig();
      try {
        const reactions = await generateGhostCardBatchHoverReactions(
          activeConfig,
          activeChar,
          currentEmotionSnapshot || { joy: 0.5, warmth: 0.5, sadness: 0.1, anger: 0.1, fear: 0.1, desire: 0.2 },
          {
            charHand: currentHand,
            userHandCount: userCount,
            turnCount: turn,
          }
        );
        setCharBatchReactions(reactions);
      } catch (err) {
        console.warn('Failed to prefetch batch hover reactions:', err);
      }
    },
    [activeChar, currentEmotionSnapshot]
  );

  // Load / resume session on mount / opponent change
  useEffect(() => {
    const saved = loadActiveGhostCardSession(selectedOpponentId);
    if (saved && saved.userHand && saved.charHand && (saved.userHand.length > 0 || saved.charHand.length > 0)) {
      setUserHand(saved.userHand);
      setCharHand(saved.charHand);
      setDiscardPile(saved.discardPile || []);
      setGhostCardId(saved.ghostCardId || '');
      setCurrentTurn(saved.currentTurn || 'user');
      setTurnCount(saved.turnCount || 1);
      setUserBluffHistory(saved.userBluffHistory || []);
      setCharBluffHistory(saved.charBluffHistory || []);
      setKeyMoments(saved.keyMoments || []);
      setInGameChats(saved.inGameChats || []);
      setCharacterSpeech(saved.characterSpeech || '“对局继续，刚才停留在你的回合。”');
      setCharacterInnerThought(saved.characterInnerThought || '');
      setGameTotalDelta(saved.gameTotalDelta || {});
      setWinner(saved.winner || null);
      if (saved.currentTurn === 'user') {
        prepareBatchHoverReactions(saved.charHand, saved.userHand.length, saved.turnCount || 1);
      }
    } else {
      initNewGame();
    }
  }, [selectedOpponentId]);

  // Save session on state change
  useEffect(() => {
    if (!winner && (userHand.length > 0 || charHand.length > 0)) {
      saveActiveGhostCardSession({
        characterId: selectedOpponentId,
        characterName,
        userHand,
        charHand,
        discardPile,
        ghostCardId,
        currentTurn,
        turnCount,
        userBluffHistory,
        charBluffHistory,
        keyMoments,
        inGameChats,
        characterSpeech,
        characterInnerThought,
        isPaused,
        lastUpdated: Date.now(),
        gameTotalDelta,
        winner,
      });
    }
  }, [
    selectedOpponentId,
    characterName,
    userHand,
    charHand,
    discardPile,
    ghostCardId,
    currentTurn,
    turnCount,
    userBluffHistory,
    charBluffHistory,
    keyMoments,
    inGameChats,
    characterSpeech,
    characterInnerThought,
    isPaused,
    gameTotalDelta,
    winner,
  ]);

  // Switch opponent helper
  const handleSwitchOpponent = (newId: string) => {
    if (newId === selectedOpponentId) return;
    if (!winner && (userHand.length > 0 || charHand.length > 0)) {
      saveActiveGhostCardSession({
        characterId: selectedOpponentId,
        characterName,
        userHand,
        charHand,
        discardPile,
        ghostCardId,
        currentTurn,
        turnCount,
        userBluffHistory,
        charBluffHistory,
        keyMoments,
        inGameChats,
        characterSpeech,
        characterInnerThought,
        isPaused: true,
        lastUpdated: Date.now(),
        gameTotalDelta,
        winner,
      });
    }
    setSelectedOpponentId(newId);
  };

  // -------------------------------------------------------------
  // Initialize New Game
  // -------------------------------------------------------------
  const initNewGame = useCallback(async () => {
    clearActiveGhostCardSession(currentCharacterId);
    setWinner(null);
    setShowSettlementModal(false);
    setEmotionSettled(false);
    setGameTotalDelta({});
    setUserBluffHistory([]);
    setCharBluffHistory([]);
    setKeyMoments([]);
    setTurnCount(1);
    setCurrentTurn('user');
    setSelectedCard(null);
    setCharHoveredUserCardIdx(null);
    setHoveredCharCardIdx(null);
    lastHoveredIdxRef.current = null;

    // 1. Generate 17 cards deck
    const deck = createCompactDeck();
    const ghostCard = deck.find((c) => c.isGhost);
    const gId = ghostCard ? ghostCard.id : '';
    setGhostCardId(gId);

    // 2. Deal
    const { userHand: rawUser, charHand: rawChar } = dealInitialHands(deck, 'user');

    // 3. Auto-discard matching pairs
    const { remainingHand: finalUser, discardedPairs: userPairs } = autoDiscardPairs(rawUser, 'initial');
    const { remainingHand: finalChar, discardedPairs: charPairs } = autoDiscardPairs(rawChar, 'initial');

    const allDiscarded = [...userPairs, ...charPairs];
    setUserHand(finalUser);
    setCharHand(finalChar);
    setDiscardPile(allDiscarded);

    const initialChats: InGameChatMessage[] = [
      {
        id: `sys_start_${Date.now()}`,
        sender: 'system',
        text: `🐾 牌局开始！牌堆17张已分发完毕，双方初始对子已打出（主控打出${userPairs.length}对，${characterName}打出${charPairs.length}对）。`,
        timestamp: Date.now(),
      },
    ];
    setInGameChats(initialChats);

    if (soundEnabled) playPairMatchSound();

    // 4. Preload batch hover reactions
    prepareBatchHoverReactions(finalChar, finalUser.length, 1);

    // 5. LLM Opening Call
    const activeConfig = loadLlmConfig();
    const charHasGhost = finalChar.some((c) => c.isGhost);
    setIsLlmThinking(true);

    try {
      if (isLlmConfigured(activeConfig)) {
        const opening = await generateGhostCardOpening(
          activeConfig,
          activeChar,
          currentEmotionSnapshot || { joy: 0.5, warmth: 0.5, sadness: 0.1, anger: 0.1, fear: 0.1, desire: 0.2 },
          finalChar.length,
          finalUser.length,
          charHasGhost
        );
        setCharacterSpeech(opening.openingDialogue);
        setCharacterAction(opening.openingAction);
        setInGameChats((prev) => [
          ...prev,
          {
            id: `char_open_${Date.now()}`,
            sender: 'character',
            text: `${opening.openingAction} ${opening.openingDialogue}`,
            timestamp: Date.now(),
          },
        ]);
      } else {
        const fallbackText = `“牌发好啦，双方对子都扣下了。现在轮到你先抽，手指滑一滑看看想抽哪张～”`;
        setCharacterSpeech(fallbackText);
        setCharacterAction(`*轻摇尾巴，扇形展开手牌*`);
        setInGameChats((prev) => [
          ...prev,
          {
            id: `char_open_${Date.now()}`,
            sender: 'character',
            text: `*轻摇尾巴，扇形展开手牌* ${fallbackText}`,
            timestamp: Date.now(),
          },
        ]);
      }
    } finally {
      setIsLlmThinking(false);
    }
  }, [currentCharacterId, characterName, activeChar, currentEmotionSnapshot, soundEnabled, prepareBatchHoverReactions]);

  // -------------------------------------------------------------
  // User Hover / Slide Over Character Cards Interaction
  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // Card Selection & Focus Handling (Card Selection ≠ Game Action)
  // -------------------------------------------------------------
  const handleSelectCard = (zone: 'char' | 'user', idx: number, card: Card) => {
    if (winner || isLlmThinking) return;

    if (selectedCard && selectedCard.zone === zone && selectedCard.index === idx) {
      // Toggle deselect
      setSelectedCard(null);
    } else {
      setSelectedCard({ zone, index: idx, card });
      if (zone === 'char') {
        handleHoverCharCard(idx);
      }
    }
  };

  const handleHoverCharCard = (idx: number) => {
    if (idx < 0 || idx >= charHand.length) return;
    if (hoveredCharCardIdx === idx) return;

    setHoveredCharCardIdx(idx);
    if (soundEnabled && lastHoveredIdxRef.current !== idx) {
      playCardHoverSound();
    }
    lastHoveredIdxRef.current = idx;

    // Retrieve pre-generated response for this card
    const r = charBatchReactions.find((item) => item.cardIndex === idx);
    if (r) {
      setCharacterSpeech(r.speech);
      setCharacterAction(r.action);
      if (r.innerThought) {
        setCharacterInnerThought(r.innerThought);
      }
    }
  };

  const handleCharFanPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (winner || isLlmThinking) return;
    if (!charCardContainerRef.current || charHand.length === 0) return;

    const rect = charCardContainerRef.current.getBoundingClientRect();
    const clientX = e.clientX;
    if (clientX < rect.left || clientX > rect.right) return;

    const relativeX = clientX - rect.left;
    const segmentWidth = rect.width / charHand.length;
    const targetIdx = Math.min(charHand.length - 1, Math.max(0, Math.floor(relativeX / segmentWidth)));
    handleHoverCharCard(targetIdx);
  };

  // -------------------------------------------------------------
  // Shuffle User Hand (Physical Game Action)
  // -------------------------------------------------------------
  const handleShuffleUserHand = (userWords?: string) => {
    if (isLlmThinking || winner) return;
    const shuffled = shuffleHand(userHand);
    setUserHand(shuffled);
    setSelectedCard(null);

    const logText = userWords || '（将手中的手牌重新打乱洗牌，调整阵型）';
    setInGameChats((prev) => [
      ...prev,
      {
        id: `user_shuffle_${Date.now()}`,
        sender: 'user',
        text: logText,
        timestamp: Date.now(),
      },
    ]);

    if (currentTurn === 'character') {
      const newHover = Math.floor(Math.random() * shuffled.length);
      setCharHoveredUserCardIdx(newHover);
      const reactText = `“哎？把手牌打乱重新洗了一遍呀？那我重新看看你这第 ${newHover + 1} 张～”`;
      setCharacterSpeech(reactText);
      setCharacterAction(`*饶有兴致地看着你洗牌，重新将手指悬停在第 ${newHover + 1} 张牌上方*`);
      setInGameChats((prev) => [
        ...prev,
        {
          id: `char_react_${Date.now()}`,
          sender: 'character',
          text: reactText,
          timestamp: Date.now(),
        },
      ]);
    }
  };

  // -------------------------------------------------------------
  // Full State Transition: User Draws Card (DRAW_CARD)
  // -------------------------------------------------------------
  const executeUserDrawCard = async (cardIdx: number, userPromptText: string) => {
    if (currentTurn !== 'user' || winner || isLlmThinking || isPaused) return;
    if (cardIdx < 0 || cardIdx >= charHand.length) return;

    if (soundEnabled) playCardDrawSound();
    setSelectedCard(null);
    setHoveredCharCardIdx(null);
    lastHoveredIdxRef.current = null;

    // 1. Mechanical execution
    const result = executeDrawCard(charHand, userHand, cardIdx, 'user');
    setCharHand(result.newFromHand);
    setUserHand(result.newToHand);

    if (result.newDiscardedPairs.length > 0) {
      setDiscardPile((prev) => [...prev, ...result.newDiscardedPairs]);
      if (soundEnabled) playPairMatchSound();
    }

    if (result.isGhost && soundEnabled) {
      playGhostRevealSound();
    }

    // 2. Log User message & draw event
    const drawDesc = result.isGhost
      ? `抽到了【鬼牌 🐾】！`
      : result.pairedCard
      ? `抽到了 [${result.drawnCard.rank}]，并与手牌配成一对打出！`
      : `抽到了 [${result.drawnCard.rank}]。`;

    setInGameChats((prev) => [
      ...prev,
      {
        id: `user_draw_${Date.now()}`,
        sender: 'user',
        text: `${userPromptText} （从${characterName}手中抽取了第 ${cardIdx + 1} 张牌，${drawDesc}）`,
        timestamp: Date.now(),
      },
    ]);

    // 3. Check Win/Loss
    const winResult = checkGhostCardWinner(result.newToHand, result.newFromHand);
    if (winResult) {
      handleGameOver(winResult, result.newToHand, result.newFromHand);
      return;
    }

    // 4. LLM Reaction for User's Draw
    setIsLlmThinking(true);
    const activeConfig = loadLlmConfig();
    const charHasGhost = result.newFromHand.some((c) => c.isGhost);

    try {
      if (isLlmConfigured(activeConfig)) {
        const reaction = await generateGhostCardUserDrawReaction(
          activeConfig,
          activeChar,
          currentEmotionSnapshot || { joy: 0.5, warmth: 0.5, sadness: 0.1, anger: 0.1, fear: 0.1, desire: 0.2 },
          {
            charRemainingCount: result.newFromHand.length,
            userRemainingCount: result.newToHand.length,
            drawnCardIsGhost: result.isGhost,
            userFormedPair: Boolean(result.pairedCard),
            charLostGhost: result.isGhost,
            charHandHasGhost: charHasGhost,
            turnCount,
            drawnCardRank: result.drawnCard.rank,
          }
        );

        setCharacterSpeech(reaction.reactionDialogue);
        setCharacterInnerThought(reaction.innerThought);
        if (reaction.stepEmotionDelta) {
          setGameTotalDelta((prev) => ({
            ...prev,
            ...Object.fromEntries(
              Object.entries(reaction.stepEmotionDelta).map(([k, v]) => [
                k,
                (prev[k as EmotionKey] || 0) + (v || 0),
              ])
            ),
          }));
        }

        setInGameChats((prev) => [
          ...prev,
          {
            id: `char_react_${Date.now()}`,
            sender: 'character',
            text: reaction.reactionDialogue,
            thought: reaction.innerThought,
            timestamp: Date.now(),
          },
        ]);

        if (result.isGhost) {
          setKeyMoments((prev) => [
            ...prev,
            {
              round: turnCount,
              event: '主控抽中鬼牌',
              detail: `主控在第${turnCount}轮抽中了${characterName}手中的鬼牌🐾`,
            },
          ]);
        }
      } else {
        const fallbackText = result.isGhost
          ? `“哇！你真的把鬼牌抓走了！” *忍不住松了一大口气*`
          : result.pairedCard
          ? `“竟然让你配成一对打出去了，运气真好～”`
          : `“拿走啦？看看你能不能撑到最后哦～”`;
        setCharacterSpeech(fallbackText);
        setInGameChats((prev) => [
          ...prev,
          {
            id: `char_react_${Date.now()}`,
            sender: 'character',
            text: fallbackText,
            timestamp: Date.now(),
          },
        ]);
      }

      // 5. Advance Turn to Character
      startCharacterTurn(result.newToHand, result.newFromHand);
    } finally {
      setIsLlmThinking(false);
    }
  };

  // -------------------------------------------------------------
  // Start Character Turn (Observing and Hovering)
  // -------------------------------------------------------------
  const startCharacterTurn = async (currentUserHand: Card[], currentCharHand: Card[]) => {
    setCurrentTurn('character');
    setSelectedCard(null);
    setCharHoveredUserCardIdx(null);

    setIsLlmThinking(true);
    const activeConfig = loadLlmConfig();
    const fallbackIdx = Math.floor(Math.random() * currentUserHand.length);
    const isProactive = Math.random() < 0.3;
    setIsProactiveInitiative(isProactive);

    try {
      let hoverRes: {
        hoveredIndex: number;
        hoverDialogue: string;
        hoverAction: string;
        innerThought: string;
        stepEmotionDelta: Partial<EmotionVector>;
      };

      if (isLlmConfigured(activeConfig)) {
        hoverRes = await generateGhostCardCharHoverDecision(
          activeConfig,
          activeChar,
          currentEmotionSnapshot || { joy: 0.5, warmth: 0.5, sadness: 0.1, anger: 0.1, fear: 0.1, desire: 0.2 },
          {
            userCardCount: currentUserHand.length,
            selectedIndices: [],
            tactic: 'provoke',
            userHasGhost: currentUserHand.some((c) => c.isGhost),
            userBluffHistory,
            turnCount,
            isProactive,
          }
        );
      } else {
        hoverRes = {
          hoveredIndex: fallbackIdx,
          hoverDialogue: isProactive
            ? `“轮到我抽了！我直觉最准，先认准你这第 ${fallbackIdx + 1} 张牌！”`
            : `“我的手指先悬停在这第 ${fallbackIdx + 1} 张上面看看……你准备怎么跟我出招？”`,
          hoverAction: `*手指轻轻悬停在你的第 ${fallbackIdx + 1} 张牌上方，微眯起眼端详你的表情*`,
          innerThought: `*端详牌面，看看ta是胸有成竹还是在虚张声势……*`,
          stepEmotionDelta: { warmth: 0.05 },
        };
      }

      setCharHoveredUserCardIdx(hoverRes.hoveredIndex);
      setCharacterSpeech(hoverRes.hoverDialogue);
      setCharacterAction(hoverRes.hoverAction);
      setCharacterInnerThought(hoverRes.innerThought);

      setInGameChats((prev) => [
        ...prev,
        {
          id: `char_hover_${Date.now()}`,
          sender: 'character',
          text: `${hoverRes.hoverAction} ${hoverRes.hoverDialogue}`,
          thought: hoverRes.innerThought,
          timestamp: Date.now(),
        },
      ]);
    } catch (err) {
      console.warn('Char hover decision LLM failed:', err);
      setCharHoveredUserCardIdx(fallbackIdx);
    } finally {
      setIsLlmThinking(false);
    }
  };

  // -------------------------------------------------------------
  // Full State Transition: Character Draws with User's Speech (DRAW_CARD)
  // -------------------------------------------------------------
  const executeCharacterDrawWithSpeech = async (speechText: string) => {
    if (currentTurn !== 'character' || winner || isLlmThinking || isPaused) return;
    if (userHand.length === 0) return;

    const hoveredIdx = charHoveredUserCardIdx !== null ? charHoveredUserCardIdx : 0;
    const chosenSpeech = speechText.trim() || '“随你抽吧，我相信我的直觉～”';
    setIsLlmThinking(true);

    // Record user's speech
    setInGameChats((prev) => [
      ...prev,
      {
        id: `user_speech_${Date.now()}`,
        sender: 'user',
        text: `（对${characterName}说）：${chosenSpeech}`,
        timestamp: Date.now(),
      },
    ]);

    const activeConfig = loadLlmConfig();
    const userHasGhost = userHand.some((c) => c.isGhost);
    const pointedIndices = selectedCard && selectedCard.zone === 'user' ? [selectedCard.index] : [];

    try {
      let finalDecision: {
        finalSelectedIndex: number;
        switchedMind: boolean;
        reactionDialogue: string;
        innerThought: string;
        stepEmotionDelta: Partial<EmotionVector>;
      };

      if (isLlmConfigured(activeConfig)) {
        finalDecision = await generateGhostCardCharFinalDraw(
          activeConfig,
          activeChar,
          currentEmotionSnapshot || { joy: 0.5, warmth: 0.5, sadness: 0.1, anger: 0.1, fear: 0.1, desire: 0.2 },
          {
            userSpeech: chosenSpeech,
            hoveredIndex: hoveredIdx,
            selectedIndices: pointedIndices,
            tactic: 'provoke',
            userCardCount: userHand.length,
            turnCount,
          }
        );
      } else {
        const finalIdx = pointedIndices.length > 0 && Math.random() < 0.6
          ? pointedIndices[0]
          : hoveredIdx;
        finalDecision = {
          finalSelectedIndex: finalIdx,
          switchedMind: finalIdx !== hoveredIdx,
          reactionDialogue: `“听你这么说，我决定就抽这张了！” *指尖干脆利落地将牌抽出*`,
          innerThought: `*心一横，就相信自己的直觉了！*`,
          stepEmotionDelta: { warmth: 0.05 },
        };
      }

      const safeIdx = Math.max(0, Math.min(finalDecision.finalSelectedIndex, userHand.length - 1));

      if (soundEnabled) playCardDrawSound();

      // Mechanical draw
      const result = executeDrawCard(userHand, charHand, safeIdx, 'character');
      setUserHand(result.newFromHand);
      setCharHand(result.newToHand);

      if (result.newDiscardedPairs.length > 0) {
        setDiscardPile((prev) => [...prev, ...result.newDiscardedPairs]);
        if (soundEnabled) playPairMatchSound();
      }

      if (result.isGhost && soundEnabled) {
        playGhostRevealSound();
      }

      // Record bluff history
      const bluffItem: UserBluffHistoryItem = {
        turn: turnCount,
        userSaid: chosenSpeech,
        charBelieved: !finalDecision.switchedMind,
        actualResult: result.isGhost ? '抽到鬼牌' : result.pairedCard ? '抽到安全牌并成对' : '抽到安全牌',
        isLie: userHasGhost,
        timestamp: Date.now(),
      };
      setUserBluffHistory((prev) => [...prev, bluffItem]);

      setCharacterSpeech(finalDecision.reactionDialogue);
      setCharacterInnerThought(finalDecision.innerThought);

      if (finalDecision.stepEmotionDelta) {
        setGameTotalDelta((prev) => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(finalDecision.stepEmotionDelta).map(([k, v]) => [
              k,
              (prev[k as EmotionKey] || 0) + (v || 0),
            ])
          ),
        }));
      }

      const charDrawDesc = result.isGhost
        ? `【抽到了鬼牌 🐾】！`
        : result.pairedCard
        ? `抽走了一张牌，并与自己的手牌凑成一对打出！`
        : `抽走了一张牌。`;

      setInGameChats((prev) => [
        ...prev,
        {
          id: `char_draw_${Date.now()}`,
          sender: 'character',
          text: `${finalDecision.reactionDialogue} （${characterName}从你的手牌中抽取了第 ${safeIdx + 1} 张牌，${charDrawDesc}）`,
          thought: finalDecision.innerThought,
          timestamp: Date.now(),
        },
      ]);

      if (result.isGhost) {
        setKeyMoments((prev) => [
          ...prev,
          {
            round: turnCount,
            event: '角色抽中鬼牌',
            detail: `${characterName}在第${turnCount}轮抽中了鬼牌🐾（主控话术：${chosenSpeech}）`,
          },
        ]);
      }

      // Check Win/Loss
      const winResult = checkGhostCardWinner(result.newFromHand, result.newToHand);
      if (winResult) {
        handleGameOver(winResult, result.newFromHand, result.newToHand);
        return;
      }

      // Preload next batch hover reactions for user's turn
      prepareBatchHoverReactions(result.newToHand, result.newFromHand.length, turnCount + 1);

      // Next Turn
      setTurnCount((prev) => prev + 1);
      setCurrentTurn('user');
      setSelectedCard(null);
      setCharHoveredUserCardIdx(null);
    } finally {
      setIsLlmThinking(false);
    }
  };

  // -------------------------------------------------------------
  // Game Over & Conclusion
  // -------------------------------------------------------------
  const handleGameOver = async (
    gameWinner: 'user' | 'character' | 'surrender',
    finalUserHand: Card[],
    finalCharHand: Card[]
  ) => {
    setWinner(gameWinner);
    clearActiveGhostCardSession(currentCharacterId);

    if (soundEnabled) {
      if (gameWinner === 'user') playVictorySound();
      else playGhostRevealSound();
    }

    const isUserWin = gameWinner === 'user';
    const summaryText = isUserWin
      ? `主控与${characterName}进行了${turnCount}轮捉鬼牌博弈，主控凭借敏锐读心率先清空手牌夺冠，${characterName}被鬼牌捉住。`
      : gameWinner === 'surrender'
      ? `主控主动认输，结束了与${characterName}的捉鬼牌对局。`
      : `${characterName}在第${turnCount}轮捉鬼牌中率先清空手牌获胜，主控手里留下了鬼牌。`;

    setInGameChats((prev) => [
      ...prev,
      {
        id: `sys_end_${Date.now()}`,
        sender: 'system',
        text: `🏆 对局结束！${isUserWin ? '主控获胜！🎉' : `${characterName} 获胜！🐾`}`,
        timestamp: Date.now(),
      },
    ]);

    const activeConfig = loadLlmConfig();
    setIsLlmThinking(true);

    let endDialogue = '';
    let rewardText = '';
    let finalDelta = gameTotalDelta;

    try {
      if (isLlmConfigured(activeConfig) && gameWinner !== 'surrender') {
        const endingRes = await generateGhostCardEnding(
          activeConfig,
          activeChar,
          gameWinner,
          turnCount,
          charBluffHistory.length,
          userBluffHistory.length,
          keyMoments,
          currentEmotionSnapshot || { joy: 0.5, warmth: 0.5, sadness: 0.1, anger: 0.1, fear: 0.1, desire: 0.2 },
          gameTotalDelta
        );

        endDialogue = endingRes.endingDialogue;
        rewardText = endingRes.rewardOrPunishment;
        finalDelta = endingRes.gameTotalDelta || gameTotalDelta;
      } else {
        endDialogue = isUserWin
          ? `*看着手里最后那张鬼牌，委屈地扁了扁嘴* “呜……你是不是会读心呀，每次都能猜准！罚你待会儿多揉揉我的耳朵🐾～”`
          : `*把手中最后一张牌丢下，开心地尾巴直摇* “赢啦赢啦！你看我就说我能赢吧～快来夸夸我！”`;
        rewardText = isUserWin ? '索要摸头与安慰' : '讨要夸赞与贴贴';
        finalDelta = isUserWin ? { warmth: 0.25, joy: 0.15 } : { joy: 0.3, warmth: 0.2 };
      }
    } finally {
      setIsLlmThinking(false);
    }

    setEndingDialogue(endDialogue);
    setRewardOrPunishment(rewardText);
    setGameTotalDelta(finalDelta);

    setInGameChats((prev) => [
      ...prev,
      {
        id: `char_end_${Date.now()}`,
        sender: 'character',
        text: endDialogue,
        timestamp: Date.now(),
      },
    ]);

    // Save Record to IndexedDB
    const matchRecord: DBGameMatchRecord = {
      id: `ghost_match_${Date.now()}`,
      gameType: 'ghost_card',
      characterId: currentCharacterId,
      characterName,
      winner: gameWinner === 'user' ? 'player' : gameWinner === 'character' ? 'character' : 'surrender',
      totalMoves: turnCount,
      totalRounds: turnCount,
      summary: summaryText,
      timestamp: Date.now(),
      gameTotalDelta: finalDelta as Record<string, number>,
      rewardOrPunishment: rewardText,
      keyMoments,
      bluffStats: {
        userBluffCount: userBluffHistory.length,
        charBluffCount: charBluffHistory.length,
        charBelievedCount: userBluffHistory.filter((b) => b.charBelieved).length,
      },
      chats: inGameChats.map((c) => ({
        id: c.id,
        sender: c.sender,
        text: c.text,
        thought: c.thought,
        timestamp: c.timestamp,
      })),
    };

    await idbSaveGameMatch(matchRecord);

    if (onGameFinished) {
      onGameFinished(summaryText, matchRecord, false, finalDelta);
    }

    setShowSettlementModal(true);
  };

  // -------------------------------------------------------------
  // Apply / Settle Emotion to World
  // -------------------------------------------------------------
  const handleApplyEmotion = () => {
    if (onApplyGameEmotionDelta) {
      onApplyGameEmotionDelta(gameTotalDelta, `捉鬼牌对局总结算（${winner === 'user' ? '主控胜' : `${characterName}胜`}）`);
    }
    saveGameEmotionImpact({
      id: `impact_${Date.now()}`,
      matchId: `ghost_${Date.now()}`,
      characterId: currentCharacterId,
      characterName,
      gameType: 'ghost_card',
      timestamp: Date.now(),
      winner: winner === 'user' ? 'player' : winner === 'character' ? 'character' : 'surrender',
      totalMoves: turnCount,
      totalDelta: gameTotalDelta,
      applied: true,
      appliedTimestamp: Date.now(),
      summary: `捉鬼牌${turnCount}轮交锋，情绪波澜`,
    });
    setEmotionSettled(true);
    setShowSettlementModal(false);
  };

  const handleIgnoreEmotion = () => {
    setEmotionSettled(true);
    setShowSettlementModal(false);
  };

  // -------------------------------------------------------------
  // Casual In-Game Banter / Chat without Advancing Turn
  // -------------------------------------------------------------
  const executeCasualInGameChat = async (text?: string, overrideSticker?: Sticker) => {
    const chatText = overrideSticker ? `[表情: ${overrideSticker.name}]` : (text || '').trim();
    if (!chatText) return;

    setInGameChats((prev) => [
      ...prev,
      {
        id: `user_chat_${Date.now()}`,
        sender: 'user',
        text: chatText,
        stickerUrl: overrideSticker?.url,
        stickerName: overrideSticker?.name,
        timestamp: Date.now(),
      },
    ]);

    const activeConfig = loadLlmConfig();
    setIsLlmThinking(true);

    try {
      if (isLlmConfigured(activeConfig)) {
        const sysPrompt = `你正在与主控进行【捉鬼牌（抽鬼牌）】心理博弈对局。
你的身份：${activeChar.name}
核心特质：${activeChar.core.values.join('、')}
语言风格：${activeChar.core.speech_filter}
当前局势：已进行 ${turnCount} 轮，你的手牌 ${charHand.length} 张，主控手牌 ${userHand.length} 张。当前回合：${currentTurn === 'user' ? '主控回合' : '你的回合'}。
请以第一人称对主控的话做出极具真情实感、生动调侃、或心虚/得意的心理战回应。包含动作描写和台词。`;

        const messages = [
          { role: 'system' as const, content: sysPrompt },
          ...inGameChats.slice(-6).map((c) => ({
            role: c.sender === 'user' ? ('user' as const) : ('assistant' as const),
            content: c.text,
          })),
          { role: 'user' as const, content: overrideSticker ? `（在牌桌前向你发送了表情包【${overrideSticker.name}】）` : `（在牌桌前对你说）：${chatText}` },
        ];

        const reply = await callLlm(activeConfig, messages);
        setCharacterSpeech(reply);
        setInGameChats((prev) => [
          ...prev,
          {
            id: `char_chat_${Date.now()}`,
            sender: 'character',
            text: reply,
            timestamp: Date.now(),
          },
        ]);
      } else {
        const reply = `*嘴角含笑看着你* “你这是想用言语打乱我的阵脚吗？我可精明着呢。”`;
        setCharacterSpeech(reply);
        setInGameChats((prev) => [
          ...prev,
          {
            id: `char_chat_${Date.now()}`,
            sender: 'character',
            text: reply,
            timestamp: Date.now(),
          },
        ]);
      }
    } finally {
      setIsLlmThinking(false);
    }
  };

  const handleSendStickerInGame = (sticker: Sticker) => {
    executeCasualInGameChat(undefined, sticker);
  };

  // -------------------------------------------------------------
  // Main Natural Language Intent Resolution Controller
  // -------------------------------------------------------------
  const handleSendChat = async () => {
    if (!chatInputText.trim() || isLlmThinking) return;
    const text = chatInputText.trim();
    setChatInputText('');

    // 1. Shuffling intent
    if (/洗牌|打乱|重新理|洗下手|乱序/.test(text)) {
      handleShuffleUserHand(text);
      return;
    }

    // 2. User Turn (Drawing or talking)
    if (currentTurn === 'user') {
      const isDrawWord = /(抽|拿|要|就这|就它|翻牌|选这|抓|来一张|选第|拿第|抽第|右边|左边|中间|抽它|要它|就这一张|拿过来|决定了|开牌|第一张|第二张|第三张|第四张|第五张|刚才那张|拿走这个|选这张|抽这张|我就要|抽这个)/.test(text);
      const isConfirmation = /(好|行|确认|就这个|就这张|来吧|冲|看牌|同意|可以|就它了)/.test(text) && selectedCard?.zone === 'char';

      if (isDrawWord || isConfirmation) {
        let targetIdx = selectedCard?.zone === 'char' ? selectedCard.index : (hoveredCharCardIdx ?? 0);
        if (/第1张|第一张|最左/.test(text)) targetIdx = 0;
        else if (/第2张|第二张/.test(text) && charHand.length > 1) targetIdx = 1;
        else if (/第3张|第三张/.test(text) && charHand.length > 2) targetIdx = 2;
        else if (/第4张|第四张/.test(text) && charHand.length > 3) targetIdx = 3;
        else if (/第5张|第五张/.test(text) && charHand.length > 4) targetIdx = 4;
        else if (/第6张|第六张/.test(text) && charHand.length > 5) targetIdx = 5;
        else if (/最右|右边/.test(text)) targetIdx = charHand.length - 1;
        else if (/中间/.test(text)) targetIdx = Math.floor(charHand.length / 2);

        await executeUserDrawCard(targetIdx, text);
        return;
      }
    }

    // 3. Character Turn (Psychological Interjection / Resolution)
    if (currentTurn === 'character') {
      await executeCharacterDrawWithSpeech(text);
      return;
    }

    // 4. Otherwise, casual in-game talk
    await executeCasualInGameChat(text);
  };

  // Surrender Handler
  const handleSurrender = () => {
    setShowSurrenderModal(false);
    handleGameOver('surrender', userHand, charHand);
  };

  // Load Match History
  const openHistoryModal = async () => {
    const list = await idbLoadGameMatches(selectedOpponentId);
    const ghostList = list.filter((m) => m.gameType === 'ghost_card');
    setMatchHistoryList(ghostList);
    setShowHistoryModal(true);
  };

  return (
    <div id="ghost-card-app-container" className="flex flex-col h-full bg-stone-950 text-stone-100 select-none overflow-hidden font-sans">
      {/* 1. Header Navigation Bar */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-stone-900 border-b border-stone-800 shrink-0">
        <div className="flex items-center space-x-2">
          {onExit && (
            <button
              onClick={onExit}
              className="p-1 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition active:scale-95"
              title="返回大厅"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          <GameCharacterSelector
            selectedCharacterId={selectedOpponentId}
            onSelectCharacter={handleSwitchOpponent}
            compact={true}
          />

          <div className="hidden sm:block">
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-bold text-stone-200">{characterName}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                捉鬼牌 · 心理博弈
              </span>
            </div>
            <div className="text-[10px] text-stone-400">
              第 {turnCount} 轮 · {currentTurn === 'user' ? '主控抽牌' : `角色抽牌`}
            </div>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center space-x-1">
          <button
            id="ghost-card-sound-toggle"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800"
            title={soundEnabled ? '音效开启' : '音效静音'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-stone-500" />}
          </button>
          <button
            id="ghost-card-rules-btn"
            onClick={() => setShowRulesModal(true)}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800"
            title="规则说明"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <button
            id="ghost-card-history-btn"
            onClick={openHistoryModal}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800"
            title="对战档案"
          >
            <History className="w-4 h-4" />
          </button>
          <button
            id="ghost-card-restart-btn"
            onClick={initNewGame}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800"
            title="重新发牌"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            id="ghost-card-surrender-btn"
            onClick={() => setShowSurrenderModal(true)}
            className="p-1.5 rounded-lg text-stone-400 hover:text-rose-400 hover:bg-stone-800"
            title="认输"
          >
            <Flag className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Character Zone (Top Arena: Face-down Cards in Fan / Arc with Interactive Slide / Focus) */}
      <div className="relative pt-3 pb-2 px-3 bg-gradient-to-b from-stone-900/80 to-stone-950/40 border-b border-stone-800/70 shrink-0">
        <div className="flex items-center justify-between text-xs text-stone-400 mb-1.5">
          <div className="flex items-center space-x-1.5">
            <span className="font-semibold text-stone-300">{characterName} 的手牌</span>
            <span className="text-[10px] px-1.5 rounded-full bg-stone-800 text-stone-300 font-mono">
              {charHand.length} 张
            </span>
          </div>
          {currentTurn === 'user' && !winner && (
            <span className="text-[11px] text-amber-400 flex items-center space-x-1 animate-pulse font-medium">
              <Sparkle className="w-3 h-3 text-amber-300" />
              <span>{selectedCard?.zone === 'char' ? '已关注此牌 · 可打字交流或直接抽取' : '滑动悬停试探 · 点击关注'}</span>
            </span>
          )}
        </div>

        {/* Character Card Backs Fan Container with Slide / Pointer Listener */}
        <div 
          ref={charCardContainerRef}
          onPointerMove={handleCharFanPointerMove}
          onTouchMove={(e) => {
            if (e.touches.length > 0) {
              const touch = e.touches[0];
              const rect = charCardContainerRef.current?.getBoundingClientRect();
              if (rect) {
                const relativeX = touch.clientX - rect.left;
                const segmentWidth = rect.width / charHand.length;
                const targetIdx = Math.min(charHand.length - 1, Math.max(0, Math.floor(relativeX / segmentWidth)));
                handleHoverCharCard(targetIdx);
              }
            }
          }}
          className="flex items-center justify-center py-2 min-h-[95px] overflow-x-auto touch-none select-none relative"
        >
          {charHand.length === 0 ? (
            <div className="text-xs text-emerald-400 py-3 flex items-center space-x-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>手牌已全部清空！</span>
            </div>
          ) : (
            <div className="flex items-center justify-center -space-x-3 sm:-space-x-4 px-4 py-1">
              {charHand.map((card, idx) => {
                const isHovered = hoveredCharCardIdx === idx;
                const isSelected = selectedCard?.zone === 'char' && selectedCard.index === idx;
                return (
                  <div
                    key={card.id || idx}
                    id={`char-card-${idx}`}
                    onMouseEnter={() => handleHoverCharCard(idx)}
                    onClick={() => handleSelectCard('char', idx, card)}
                    className={`relative w-12 h-20 sm:w-14 sm:h-22 rounded-xl border-2 transition-all duration-200 flex flex-col items-center justify-between p-1.5 select-none cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-b from-amber-700 via-stone-800 to-amber-950 border-amber-300 ring-4 ring-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.8)] -translate-y-5 scale-110 z-30'
                        : isHovered
                        ? 'bg-gradient-to-b from-stone-700 via-stone-800 to-amber-950/60 border-amber-400/80 ring-2 ring-amber-400/50 shadow-lg -translate-y-3 scale-105 z-20'
                        : 'bg-gradient-to-b from-stone-800 to-stone-900 border-stone-700 shadow-md z-10'
                    }`}
                  >
                    {/* Hover indicator badge */}
                    {isHovered && !isSelected && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-amber-500 text-stone-950 font-bold text-[9px] px-1.5 py-0.2 rounded-full shadow-lg animate-bounce">
                        <span>试探中</span>
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-amber-400 text-stone-950 font-extrabold text-[9px] px-2 py-0.5 rounded-full shadow-lg border border-amber-200 animate-pulse">
                        <span>✦ 当前关注</span>
                      </div>
                    )}

                    <div className="text-[9px] text-stone-400 font-mono self-start">🐾</div>
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-base sm:text-lg">🐶</span>
                      <span className="text-[9px] text-amber-500/80 font-mono tracking-wider">✦ ✦</span>
                    </div>
                    <div className="text-[9px] text-stone-500 font-mono self-end">🐾</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Real-time floating reaction bubble when user hovers or focuses on a card */}
        {hoveredCharCardIdx !== null && charHand[hoveredCharCardIdx] && !winner && (
          <div className="mt-1 mx-2 p-2 bg-stone-900/90 border border-amber-500/20 rounded-xl backdrop-blur-sm shadow-md transition-all">
            <div className="flex items-center space-x-1 text-[11px] text-amber-300 font-medium mb-0.5">
              <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
              <span>{characterName} 的微反应 · 指尖悬停</span>
            </div>
            <div className="text-xs text-stone-200 italic leading-snug">
              {characterSpeech || '……（目光微微晃动，神色莫测）'}
            </div>
            {characterAction && (
              <div className="text-[10px] text-stone-400 mt-0.5">
                {characterAction}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Middle Area: Discard Pile & Live Dialogue Log */}
      <div className="flex-1 flex flex-col min-h-0 bg-stone-950/90 relative">
        {/* Discard Pile Status */}
        <div className="px-3 py-1 bg-stone-900/60 border-b border-stone-800/40 flex items-center justify-between text-[11px] text-stone-400 shrink-0">
          <div className="flex items-center space-x-2">
            <span className="flex items-center space-x-1 text-stone-300">
              <Layers className="w-3 h-3 text-amber-400" />
              <span>弃牌堆:</span>
            </span>
            <span className="text-amber-400 font-mono font-semibold">{discardPile.length} 对</span>
          </div>
          {discardPile.length > 0 && (
            <div className="flex items-center space-x-1 text-[10px] text-stone-400 truncate max-w-[200px]">
              <span>最近消除:</span>
              <span className="px-1 py-0.2 rounded bg-stone-800 text-stone-200 font-mono">
                {discardPile[discardPile.length - 1].rank} 对
              </span>
            </div>
          )}
        </div>

        {/* Scrollable Compact Timeline Stream */}
        <div className="flex-1 min-h-0 p-2 overflow-hidden flex flex-col justify-end">
          <div
            ref={chatScrollRef}
            className="h-full overflow-y-auto p-2.5 space-y-2 bg-stone-900/70 rounded-xl border border-stone-800/80 shadow-inner"
          >
            {inGameChats.map((msg) => {
              const isChar = msg.sender === 'character';
              const isSys = msg.sender === 'system';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    isSys ? 'items-center my-0.5' : isChar ? 'items-start' : 'items-end'
                  }`}
                >
                  {isSys ? (
                    <div className="text-[10px] text-stone-400 bg-stone-900/90 px-2 py-0.5 rounded-full border border-stone-800 text-center max-w-[90%]">
                      {msg.text}
                    </div>
                  ) : isChar ? (
                    <div className="flex items-start space-x-1.5 max-w-[85%]">
                      <div className="w-5 h-5 rounded-full overflow-hidden shrink-0 mt-0.5 border border-stone-700">
                        {charAvatar ? (
                          <img src={charAvatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px]">🐾</span>
                        )}
                      </div>
                      <div className="flex flex-col space-y-0.5">
                        <div className="bg-stone-900 border border-stone-800 text-stone-200 text-xs px-2.5 py-1.5 rounded-2xl rounded-tl-none shadow-sm leading-relaxed">
                          {msg.stickerUrl && (
                            <img
                              src={msg.stickerUrl}
                              alt={msg.stickerName || '表情包'}
                              className="w-20 h-20 object-contain rounded-lg mb-1 border border-stone-700/50 bg-stone-950/40 p-0.5"
                            />
                          )}
                          <div>{msg.text}</div>
                        </div>
                        {msg.thought && (
                          <div className="text-[10px] text-amber-400/80 italic bg-amber-950/20 border border-amber-800/30 px-2 py-0.5 rounded-lg">
                            💭 {msg.thought}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-600 text-white text-xs px-2.5 py-1.5 rounded-2xl rounded-tr-none shadow-sm max-w-[85%] leading-relaxed flex flex-col items-end">
                      {msg.stickerUrl && (
                        <img
                          src={msg.stickerUrl}
                          alt={msg.stickerName || '表情包'}
                          className="w-20 h-20 object-contain rounded-lg mb-1 border border-amber-400/40 bg-black/20 p-0.5"
                        />
                      )}
                      <div>{msg.text}</div>
                    </div>
                  )}
                </div>
              );
            })}

            {isLlmThinking && (
              <div className="flex items-center space-x-2 text-stone-400 text-xs py-0.5">
                <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                <span>{characterName} 正在推演心理博弈……</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Player Hand Zone (Bottom Arena: Face-up Cards with Ranks & Free Card Selection) */}
      <div className="p-3 bg-stone-900 border-t border-stone-800 shrink-0">
        <div className="flex items-center justify-between text-xs text-stone-400 mb-1.5">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-stone-200">主控手牌</span>
            <span className="text-[10px] px-1.5 rounded-full bg-stone-800 text-stone-300 font-mono">
              {userHand.length} 张
            </span>
            <button
              id="ghost-card-shuffle-hand-btn"
              disabled={isLlmThinking || !!winner}
              onClick={() => handleShuffleUserHand()}
              className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-300 flex items-center space-x-1 transition"
              title="洗乱手中卡牌次序"
            >
              <Shuffle className="w-2.5 h-2.5 text-amber-400" />
              <span>洗牌</span>
            </button>
          </div>
          {userHand.some((c) => c.isGhost) && (
            <span className="text-[11px] text-amber-400 font-medium flex items-center space-x-1 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
              <span>🐾 鬼牌在你手中</span>
            </span>
          )}
        </div>

        {/* User's Cards Face Up */}
        <div className="flex items-center justify-center py-1 min-h-[95px] overflow-x-auto">
          {userHand.length === 0 ? (
            <div className="text-xs text-emerald-400 py-3 flex items-center space-x-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>你已清空所有手牌，胜利！</span>
            </div>
          ) : (
            <div className="flex items-center justify-center -space-x-3 px-2 py-1">
              {userHand.map((card, idx) => {
                const isGhost = card.isGhost;
                const isSelected = selectedCard?.zone === 'user' && selectedCard.index === idx;
                const isAiHovered = currentTurn === 'character' && charHoveredUserCardIdx === idx;

                return (
                  <div
                    key={card.id || idx}
                    id={`user-card-${idx}`}
                    onClick={() => handleSelectCard('user', idx, card)}
                    className={`relative w-13 h-22 sm:w-15 sm:h-24 rounded-xl border-2 transition-all duration-200 flex flex-col items-center justify-between p-1.5 select-none cursor-pointer ${
                      isAiHovered
                        ? isProactiveInitiative
                          ? 'border-amber-300 ring-4 ring-amber-400/90 shadow-[0_0_35px_rgba(251,191,36,0.95)] -translate-y-5 scale-110 z-30 bg-gradient-to-b from-amber-950/80 via-stone-900 to-amber-950 text-stone-100 animate-pulse'
                          : 'border-rose-400 ring-4 ring-rose-500/80 shadow-[0_0_25px_rgba(244,63,94,0.7)] -translate-y-4 scale-105 z-30 bg-gradient-to-b from-rose-950/70 to-stone-900 text-stone-100 animate-pulse'
                        : isSelected
                        ? 'border-amber-400 ring-3 ring-amber-400/70 -translate-y-3 scale-105 z-20 bg-amber-950/30'
                        : isGhost
                        ? 'bg-gradient-to-b from-purple-950 via-stone-900 to-amber-950/80 border-amber-400 shadow-amber-500/30 z-10'
                        : 'bg-gradient-to-b from-stone-100 to-stone-200 text-stone-900 border-stone-300'
                    }`}
                  >
                    {/* Targeted by AI Hover Badge */}
                    {isAiHovered && (
                      <div
                        className={`absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap font-extrabold text-[9px] px-1.5 py-0.2 rounded-full shadow-lg animate-bounce flex items-center space-x-0.5 ${
                          isProactiveInitiative
                            ? 'bg-amber-500 text-stone-950 border border-amber-200 shadow-amber-500/50'
                            : 'bg-rose-500 text-white border border-rose-300 shadow-rose-500/50'
                        }`}
                      >
                        {isProactiveInitiative ? (
                          <>
                            <Sparkles className="w-2.5 h-2.5 text-stone-950" />
                            <span>⚡ 直觉锁定！</span>
                          </>
                        ) : (
                          <span>👇 正在关注</span>
                        )}
                      </div>
                    )}

                    {/* Selected Badge */}
                    {isSelected && !isAiHovered && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-stone-950 font-bold text-[9px] px-1.5 py-0.2 rounded-full shadow">
                        选中
                      </div>
                    )}

                    {/* Top corner rank & suit */}
                    <div className="flex items-center justify-between w-full text-[10px] font-bold leading-none">
                      <span className={isGhost || isAiHovered ? 'text-amber-400' : 'text-stone-900'}>{card.displayRank}</span>
                      <span className="text-xs">{card.suit}</span>
                    </div>

                    {/* Middle motif / icon */}
                    <div className="flex flex-col items-center justify-center my-0.5">
                      {isGhost ? (
                        <>
                          <span className="text-xl animate-bounce">🐾</span>
                          <span className="text-[8px] font-bold text-amber-400 tracking-tighter">GHOST</span>
                        </>
                      ) : (
                        <>
                          <span className="text-base">{card.displayMotif}</span>
                          <span className={`text-[9px] font-mono font-bold ${isAiHovered ? 'text-rose-300' : 'text-stone-800'}`}>
                            {card.rank}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Bottom corner */}
                    <div className="flex items-center justify-between w-full text-[10px] font-bold leading-none">
                      <span className="text-xs">{card.suit}</span>
                      <span className={isGhost || isAiHovered ? 'text-amber-400' : 'text-stone-900'}>{card.displayRank}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* In-Game Sticker Selection Bar */}
        <InGameStickerBar
          currentCharacterId={selectedOpponentId}
          characterName={characterName}
          onSelectSticker={handleSendStickerInGame}
          disabled={isLlmThinking || !!winner}
        />

        {/* Live Chat Input Bar (Always Active) */}
        <div className="mt-2 flex items-center space-x-2">
          <input
            id="ghost-card-chat-input"
            type="text"
            value={chatInputText}
            onChange={(e) => setChatInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
            placeholder={
              selectedCard?.zone === 'char'
                ? `已关注对方这张牌 · 可打字交流或直接输入“抽这张”……`
                : selectedCard?.zone === 'user'
                ? `已关注自己这张牌 · 可说话互动或点击“洗牌”……`
                : `对 ${characterName} 说话、试探或输入“抽牌/洗牌”……`
            }
            className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-1.5 text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500"
          />
          <button
            id="ghost-card-chat-send"
            disabled={!chatInputText.trim() || isLlmThinking}
            onClick={handleSendChat}
            className="p-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white transition-all shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. Post-Game Emotion Settlement Modal (隔离结算) */}
      {/* ------------------------------------------------------------- */}
      {showSettlementModal && (
        <div id="ghost-card-settlement-modal" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">{winner === 'user' ? '🏆' : '🐾'}</span>
                <div>
                  <h3 className="text-base font-bold text-stone-100">
                    {winner === 'user' ? '对局胜利！清空手牌' : `${characterName} 获得了胜利`}
                  </h3>
                  <p className="text-xs text-stone-400">
                    共交锋 {turnCount} 轮 · 捉鬼牌结算
                  </p>
                </div>
              </div>
            </div>

            {/* Ending dialogue quote */}
            <div className="bg-stone-950 p-3 rounded-xl border border-stone-800">
              <div className="text-xs text-stone-300 italic leading-relaxed">
                “{endingDialogue}”
              </div>
              {rewardOrPunishment && (
                <div className="mt-2 pt-2 border-t border-stone-800/80 text-[11px] text-amber-400 flex items-center space-x-1">
                  <span>🎁 角色互动诉求：{rewardOrPunishment}</span>
                </div>
              )}
            </div>

            {/* Bluff stats */}
            <div className="grid grid-cols-2 gap-2 text-xs bg-stone-950/60 p-2.5 rounded-xl border border-stone-800">
              <div>
                <span className="text-stone-500">主控博弈话术:</span>{' '}
                <span className="text-stone-200 font-mono font-semibold">{userBluffHistory.length} 次</span>
              </div>
              <div>
                <span className="text-stone-500">角色信任度:</span>{' '}
                <span className="text-amber-400 font-mono font-semibold">
                  {userBluffHistory.filter((b) => b.charBelieved).length} 次相信
                </span>
              </div>
            </div>

            {/* Emotion delta breakdown */}
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-stone-300 flex items-center justify-between">
                <span>六维情绪影响结算（局内累计）</span>
                <span className="text-[10px] text-amber-400">需确认后写入主世界</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 bg-stone-950 p-2.5 rounded-xl border border-stone-800">
                {(['joy', 'warmth', 'sadness', 'anger', 'fear', 'desire'] as EmotionKey[]).map((key) => {
                  const val = gameTotalDelta[key] || 0;
                  const isPos = val > 0;
                  const isNeg = val < 0;
                  return (
                    <div key={key} className="flex items-center justify-between px-2 py-1 rounded bg-stone-900 text-[11px]">
                      <span className="text-stone-400">{EMOTION_NAMES[key]}</span>
                      <span
                        className={`font-mono font-bold ${
                          isPos ? 'text-emerald-400' : isNeg ? 'text-rose-400' : 'text-stone-500'
                        }`}
                      >
                        {isPos ? `+${Math.round(val * 100)}%` : isNeg ? `${Math.round(val * 100)}%` : '0'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2 pt-2">
              <button
                id="settlement-apply-btn"
                onClick={handleApplyEmotion}
                className="flex-1 py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition shadow"
              >
                应用情绪影响
              </button>
              <button
                id="settlement-ignore-btn"
                onClick={handleIgnoreEmotion}
                className="flex-1 py-2.5 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs transition"
              >
                忽略结算
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. Surrender Modal */}
      {/* ------------------------------------------------------------- */}
      {showSurrenderModal && (
        <div id="ghost-card-surrender-modal" className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-xs w-full p-4 shadow-2xl space-y-3">
            <h3 className="text-sm font-bold text-stone-100">确认主动认输？</h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              主动认输将直接结束本局捉鬼牌，并由 {characterName} 判定胜局。
            </p>
            <div className="flex items-center space-x-2 pt-2">
              <button
                onClick={handleSurrender}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
              >
                确认认输
              </button>
              <button
                onClick={() => setShowSurrenderModal(false)}
                className="flex-1 py-2 rounded-xl bg-stone-800 text-stone-300 text-xs"
              >
                继续游戏
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 7. Rules Modal */}
      {/* ------------------------------------------------------------- */}
      {showRulesModal && (
        <div id="ghost-card-rules-modal" className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-stone-800 pb-2">
              <h3 className="text-sm font-bold text-stone-100 flex items-center space-x-1.5">
                <span>🐾 捉鬼牌（心理博弈版）游戏规则</span>
              </h3>
              <button onClick={() => setShowRulesModal(false)} className="text-stone-400 hover:text-stone-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-stone-300 space-y-2 leading-relaxed">
              <p>• <strong>紧凑牌组</strong>：共 17 张牌（8 对普通配对牌 + 1 张鬼牌 🐾）。开局自动消除起手对子。</p>
              <p>• <strong>主控抽牌（滑动试探与自然表达）</strong>：手指在角色展开的手牌上左右滑动或点击关注，实时感知角色微表情与心理防线，在输入框自然输入“抽这张/就它”或直接交流即可抽取。</p>
              <p>• <strong>角色抽牌（实时心理拉扯与自由洗牌）</strong>：
                <br />1. 角色端详主控手牌并将手指悬停在某张牌上方试探。
                <br />2. 主控可通过输入框自由说话、误导、试探、保持沉默，或随时点击<strong>【洗牌】</strong>打乱阵型。
                <br />3. 角色根据主控的微反应与言语完成最终抽牌决断！
              </p>
              <p>• <strong>胜负判定</strong>：率先清空手牌者获得胜利！最后手里留下鬼牌 🐾 的人落败。</p>
            </div>
            <button
              onClick={() => setShowRulesModal(false)}
              className="w-full py-2 rounded-xl bg-amber-600 text-white text-xs font-bold mt-2"
            >
              我知道了
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 8. Match History Modal */}
      {/* ------------------------------------------------------------- */}
      {showHistoryModal && (
        <div id="ghost-card-history-modal" className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between border-b border-stone-800 pb-2 mb-3">
              <h3 className="text-sm font-bold text-stone-100 flex items-center space-x-1.5">
                <History className="w-4 h-4 text-amber-400" />
                <span>与 {characterName} 的捉鬼牌战绩档案</span>
              </h3>
              <button onClick={() => setShowHistoryModal(false)} className="text-stone-400 hover:text-stone-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {matchHistoryList.length === 0 ? (
                <div className="text-center text-xs text-stone-500 py-8">暂无捉鬼牌对局记录</div>
              ) : (
                matchHistoryList.map((m) => (
                  <div key={m.id} className="bg-stone-950 p-2.5 rounded-xl border border-stone-800 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`font-bold ${m.winner === 'player' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {m.winner === 'player' ? '主控胜 🏆' : `${characterName} 胜 🐾`}
                      </span>
                      <span className="text-[10px] text-stone-500">{new Date(m.timestamp).toLocaleDateString()}</span>
                    </div>
                    <p className="text-stone-400 text-[11px] leading-relaxed">{m.summary}</p>
                    {m.rewardOrPunishment && (
                      <p className="text-[10px] text-amber-400">诉求：{m.rewardOrPunishment}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
