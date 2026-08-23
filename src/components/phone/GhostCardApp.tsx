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
  characterName,
  character: propChar,
  currentEmotionSnapshot,
  onGameFinished,
  onApplyGameEmotionDelta,
  onExit,
}) => {
  const activeChar = propChar || getCharacterById(currentCharacterId) || MOCK_CHARACTERS[0];
  const charAvatar = loadCharAvatar(currentCharacterId);

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

  // User Draw Sliding State
  const [hoveredCharCardIdx, setHoveredCharCardIdx] = useState<number | null>(null);
  const [charBatchReactions, setCharBatchReactions] = useState<CardHoverReaction[]>([]);
  const lastHoveredIdxRef = useRef<number | null>(null);
  const charCardContainerRef = useRef<HTMLDivElement>(null);

  // Character Turn Psychology & Tactics
  type UserTacticPhase = 'select_tactic' | 'char_hovering' | 'interject_speech' | 'resolving_draw';
  const [userTacticPhase, setUserTacticPhase] = useState<UserTacticPhase>('select_tactic');
  const [selectedUserCardIndices, setSelectedUserCardIndices] = useState<number[]>([]);
  const [currentTactic, setCurrentTactic] = useState<TacticDirection>('provoke');
  const [charHoveredUserCardIdx, setCharHoveredUserCardIdx] = useState<number | null>(null);
  const [interjectInputText, setInterjectInputText] = useState<string>('');
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

  // Chat Input
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

  // Load / resume session on mount
  useEffect(() => {
    const saved = loadActiveGhostCardSession(currentCharacterId);
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
  }, [currentCharacterId]);

  // Save session on state change
  useEffect(() => {
    if (!winner && (userHand.length > 0 || charHand.length > 0)) {
      saveActiveGhostCardSession({
        characterId: currentCharacterId,
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
    currentCharacterId,
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
    setUserTacticPhase('select_tactic');
    setSelectedUserCardIndices([]);
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
  const handleHoverCharCard = (idx: number) => {
    if (currentTurn !== 'user' || winner || isLlmThinking) return;
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

  // Touch / Pointer sliding move handler
  const handleCharFanPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (currentTurn !== 'user' || winner || isLlmThinking) return;
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
  // Player Finalizes Draw of a Card from Character Hand
  // -------------------------------------------------------------
  const handleUserDrawCard = async (cardIdx: number) => {
    if (currentTurn !== 'user' || winner || isLlmThinking || isPaused) return;
    if (cardIdx < 0 || cardIdx >= charHand.length) return;

    if (soundEnabled) playCardDrawSound();
    setHoveredCharCardIdx(null);
    lastHoveredIdxRef.current = null;

    // Mechanical execution
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

    // Log action to chat
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
        text: `（从${characterName}的手牌中抽取了第 ${cardIdx + 1} 张牌）${drawDesc}`,
        timestamp: Date.now(),
      },
    ]);

    // Check Win/Loss
    const winResult = checkGhostCardWinner(result.newToHand, result.newFromHand);
    if (winResult) {
      handleGameOver(winResult, result.newToHand, result.newFromHand);
      return;
    }

    // Step 2: LLM Reaction for User's Draw
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
              event: '抓到鬼牌',
              detail: `主控在第${turnCount}轮抽中了鬼牌🐾，${characterName}暗喜`,
            },
          ]);
        }
      }
    } catch (err) {
      console.warn('User draw reaction LLM failed:', err);
    } finally {
      setIsLlmThinking(false);
    }

    // Transition to Character's Turn with 30% Proactive Initiative Check
    await startCharacterTurnWithProactiveCheck(result.newToHand, result.newFromHand);
  };

  // -------------------------------------------------------------
  // Character's Turn Step 0: Check 30% Proactive Initiative (AI 直觉先发制人)
  // -------------------------------------------------------------
  const startCharacterTurnWithProactiveCheck = async (currentUserHand: Card[], currentCharHand: Card[]) => {
    setCurrentTurn('character');
    setSelectedUserCardIndices([]);
    setCharHoveredUserCardIdx(null);

    // 30% probability to trigger LLM Proactive Initiative
    const isProactive = Math.random() < 0.3;

    if (isProactive && currentUserHand.length > 0) {
      setIsProactiveInitiative(true);
      setUserTacticPhase('interject_speech'); // Skip manual selection
      setIsLlmThinking(true);

      const activeConfig = loadLlmConfig();
      const userHasGhost = currentUserHand.some((c) => c.isGhost);
      const fallbackIdx = Math.floor(Math.random() * currentUserHand.length);

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
              userHasGhost,
              userBluffHistory,
              turnCount,
              isProactive: true,
            }
          );
        } else {
          hoverRes = {
            hoveredIndex: fallbackIdx,
            hoverDialogue: `“哈哈！不等你慢吞吞出招耍花样了，我直觉最灵！我就先认准你这第 ${fallbackIdx + 1} 张！”`,
            hoverAction: `*不等你动作，指尖如电般瞬间闪烁着灵觉微光锁定在你的第 ${fallbackIdx + 1} 张牌上方，神态自信而狡黠*`,
            innerThought: `*直觉告诉我就是这张！看主控这下怎么跟我拉扯心理战～*`,
            stepEmotionDelta: { joy: 0.08, warmth: 0.05 },
          };
        }

        setCharHoveredUserCardIdx(hoverRes.hoveredIndex);
        setCharacterSpeech(hoverRes.hoverDialogue);
        setCharacterAction(hoverRes.hoverAction);
        setCharacterInnerThought(hoverRes.innerThought);

        setInGameChats((prev) => [
          ...prev,
          {
            id: `proactive_event_${Date.now()}`,
            sender: 'system',
            text: `⚡【直觉触发】${characterName} 触发了 30% 直觉先发制人！跳过了标记环节，直接锁定了你的【第 ${hoverRes.hoveredIndex + 1} 张牌】！`,
            timestamp: Date.now(),
          },
          {
            id: `char_hover_${Date.now()}`,
            sender: 'character',
            text: `${hoverRes.hoverAction} ${hoverRes.hoverDialogue}`,
            thought: hoverRes.innerThought,
            timestamp: Date.now() + 1,
          },
        ]);
      } catch (err) {
        console.warn('Proactive initiative LLM failed:', err);
        setCharHoveredUserCardIdx(fallbackIdx);
      } finally {
        setIsLlmThinking(false);
      }
    } else {
      // Normal 70% flow: manual selection
      setIsProactiveInitiative(false);
      setUserTacticPhase('select_tactic');
    }
  };

  // -------------------------------------------------------------
  // Character's Turn Step 1: Player Selects Cards + Tactic (挑逗 vs 求饶)
  // -------------------------------------------------------------
  const handleToggleSelectUserCard = (idx: number) => {
    if (currentTurn !== 'character' || userTacticPhase !== 'select_tactic' || winner) return;
    setSelectedUserCardIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const handleConfirmTactic = async (tactic: TacticDirection) => {
    if (currentTurn !== 'character' || userTacticPhase !== 'select_tactic' || winner || isLlmThinking) return;

    setCurrentTactic(tactic);
    setUserTacticPhase('char_hovering');
    setIsLlmThinking(true);

    const activeConfig = loadLlmConfig();
    const userHasGhost = userHand.some((c) => c.isGhost);

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
            userCardCount: userHand.length,
            selectedIndices: selectedUserCardIndices,
            tactic,
            userHasGhost,
            userBluffHistory,
            turnCount,
          }
        );
      } else {
        const targetIdx = selectedUserCardIndices.length > 0
          ? selectedUserCardIndices[0]
          : Math.floor(Math.random() * userHand.length);
        hoverRes = {
          hoveredIndex: targetIdx,
          hoverDialogue: tactic === 'provoke'
            ? `“你越是挑逗我选这张，我手指就越想悬在这上面……你是不是心里打鼓呢？”`
            : `“你这一副求饶的样子，该不会是故意引我避开吧？那我可要在这张上面停一停了。”`,
          hoverAction: `*手指轻轻悬停在第 ${targetIdx + 1} 张牌上方，微眯起眼端详你的表情*`,
          innerThought: `*先悬停在第 ${targetIdx + 1} 张牌上试探一下，看ta接下来怎么说……*`,
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
          id: `tactic_event_${Date.now()}`,
          sender: 'user',
          text: `（主控标记了 ${selectedUserCardIndices.map((i) => `第${i + 1}张`).join('、') || '整手牌'}，并选择了【${tactic === 'provoke' ? '🔥 挑逗（让ta选）' : '🥺 求饶（不想让ta选）'}】）`,
          timestamp: Date.now(),
        },
        {
          id: `char_hover_${Date.now()}`,
          sender: 'character',
          text: `${hoverRes.hoverAction} ${hoverRes.hoverDialogue}`,
          thought: hoverRes.innerThought,
          timestamp: Date.now() + 1,
        },
      ]);

      setUserTacticPhase('interject_speech');
    } finally {
      setIsLlmThinking(false);
    }
  };

  // -------------------------------------------------------------
  // Character's Turn Option: Shuffle / Swap Hand & Repeat Tactic
  // -------------------------------------------------------------
  const handleSwapCardsAndRestartTactic = () => {
    if (userTacticPhase !== 'interject_speech' || isLlmThinking) return;
    const shuffled = shuffleHand(userHand);
    setUserHand(shuffled);
    setSelectedUserCardIndices([]);
    setCharHoveredUserCardIdx(null);
    setUserTacticPhase('select_tactic');
    setCharacterSpeech(`“哎？把牌打乱重新洗了一遍呀？那我也重新看你出招～”`);
    setCharacterAction(`*收回手指，耐心地等待你重新理牌*`);
    setInGameChats((prev) => [
      ...prev,
      {
        id: `user_shuffle_${Date.now()}`,
        sender: 'user',
        text: `（将手中的牌重新打乱洗牌，调整博弈策略）`,
        timestamp: Date.now(),
      },
    ]);
  };

  // -------------------------------------------------------------
  // Character's Turn Step 2: Player Speaks -> LLM Draws Card & Gives Speech
  // -------------------------------------------------------------
  const handlePlayerSubmitInterjection = async (speechText: string) => {
    if (currentTurn !== 'character' || userTacticPhase !== 'interject_speech' || winner || isLlmThinking || isPaused) return;
    if (charHoveredUserCardIdx === null) return;

    const chosenSpeech = speechText.trim() || (currentTactic === 'provoke' ? '“有种你就抽这张！”' : '“求求你别选这张！”');
    setInterjectInputText('');
    setUserTacticPhase('resolving_draw');
    setIsLlmThinking(true);

    // Record user's words
    setInGameChats((prev) => [
      ...prev,
      {
        id: `user_interject_${Date.now()}`,
        sender: 'user',
        text: `（看着${characterName}悬停的手指说）：${chosenSpeech}`,
        timestamp: Date.now(),
      },
    ]);

    const activeConfig = loadLlmConfig();
    const userHasGhost = userHand.some((c) => c.isGhost);

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
            hoveredIndex: charHoveredUserCardIdx,
            selectedIndices: selectedUserCardIndices,
            tactic: currentTactic,
            userCardCount: userHand.length,
            turnCount,
          }
        );
      } else {
        finalDecision = {
          finalSelectedIndex: charHoveredUserCardIdx,
          switchedMind: false,
          reactionDialogue: `“听你这么说，我反而更认准它了！就抽这张！” *指尖干脆利落地将牌抽出*`,
          innerThought: `*心一横，就相信自己的直觉了！*`,
          stepEmotionDelta: { warmth: 0.05 },
        };
      }

      // Safe index bound
      const safeIdx = Math.max(0, Math.min(finalDecision.finalSelectedIndex, userHand.length - 1));

      if (soundEnabled) playCardDrawSound();

      // Execute mechanical draw
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
        userSaid: `${currentTactic === 'provoke' ? '[挑逗]' : '[求饶]'} ${chosenSpeech}`,
        charBelieved: !finalDecision.switchedMind,
        actualResult: result.isGhost ? '抽到鬼牌' : result.pairedCard ? '抽到安全牌并成对' : '抽到安全牌',
        isLie: userHasGhost,
        timestamp: Date.now(),
      };
      setUserBluffHistory((prev) => [...prev, bluffItem]);

      // Update character speech & thought
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
      setUserTacticPhase('select_tactic');
      setSelectedUserCardIndices([]);
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
  // Live Chat Input Send
  // -------------------------------------------------------------
  const handleSendChat = async () => {
    if (!chatInputText.trim() || isLlmThinking) return;
    const text = chatInputText.trim();
    setChatInputText('');

    setInGameChats((prev) => [
      ...prev,
      {
        id: `user_chat_${Date.now()}`,
        sender: 'user',
        text,
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
当前局势：已进行 ${turnCount} 轮，你的手牌 ${charHand.length} 张，主控手牌 ${userHand.length} 张。
请以第一人称对主控的话做出极具真情实感、生动调侃、或心虚/得意的心理战回应。包含动作描写和台词。`;

        const messages = [
          { role: 'system' as const, content: sysPrompt },
          ...inGameChats.slice(-6).map((c) => ({
            role: c.sender === 'user' ? ('user' as const) : ('assistant' as const),
            content: c.text,
          })),
          { role: 'user' as const, content: `（在牌桌前对你说）：${text}` },
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

  // Surrender Handler
  const handleSurrender = () => {
    setShowSurrenderModal(false);
    handleGameOver('surrender', userHand, charHand);
  };

  // Load Match History
  const openHistoryModal = async () => {
    const list = await idbLoadGameMatches(currentCharacterId);
    const ghostList = list.filter((m) => m.gameType === 'ghost_card');
    setMatchHistoryList(ghostList);
    setShowHistoryModal(true);
  };

  return (
    <div id="ghost-card-app-container" className="flex flex-col h-full bg-stone-950 text-stone-100 select-none overflow-hidden font-sans">
      {/* 1. Header Navigation Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-stone-900 border-b border-stone-800 shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-amber-500/50 bg-stone-800 flex items-center justify-center">
            {charAvatar ? (
              <img src={charAvatar} alt={characterName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-bold text-amber-400">🐾</span>
            )}
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-bold text-stone-200">{characterName}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                捉鬼牌 · 心理博弈
              </span>
            </div>
            <div className="text-[10px] text-stone-400">
              第 {turnCount} 轮 · {currentTurn === 'user' ? '主控抽牌（左右滑动选牌）' : `角色抽牌（主控心理拉扯）`}
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
            {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4" />}
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

      {/* 2. Character Zone (Top Arena: Face-down Cards in Fan / Arc with Interactive Slide / Hover) */}
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
              <span>左右滑动手指试探 · 点击抽牌</span>
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
          className="flex items-center justify-center py-3 min-h-[105px] overflow-x-auto touch-none select-none"
        >
          {charHand.length === 0 ? (
            <div className="text-xs text-emerald-400 py-4 flex items-center space-x-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>手牌已全部清空！</span>
            </div>
          ) : (
            <div className="flex items-center justify-center -space-x-3 sm:-space-x-4 px-4 py-2">
              {charHand.map((card, idx) => {
                const isHovered = hoveredCharCardIdx === idx;
                const canDraw = currentTurn === 'user' && !isLlmThinking && !winner;
                return (
                  <button
                    key={card.id || idx}
                    id={`char-card-${idx}`}
                    disabled={!canDraw}
                    onMouseEnter={() => handleHoverCharCard(idx)}
                    onClick={() => handleUserDrawCard(idx)}
                    className={`relative w-13 h-22 sm:w-15 sm:h-24 rounded-xl border-2 transition-all duration-200 flex flex-col items-center justify-between p-1.5 select-none ${
                      canDraw ? 'cursor-pointer' : 'cursor-default opacity-85'
                    } ${
                      isHovered && canDraw
                        ? 'bg-gradient-to-b from-stone-700 via-stone-800 to-amber-950/60 border-amber-300 ring-4 ring-amber-400/70 shadow-[0_0_25px_rgba(251,191,36,0.65)] -translate-y-5 scale-110 z-30 animate-pulse'
                        : 'bg-gradient-to-b from-stone-800 to-stone-900 border-stone-700 shadow-md z-10'
                    }`}
                  >
                    {/* Hover indicator badge */}
                    {isHovered && canDraw && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-amber-400 text-stone-950 font-extrabold text-[9px] px-1.5 py-0.2 rounded-full shadow-lg border border-amber-200 animate-bounce flex items-center space-x-0.5">
                        <span>✨ 试探中</span>
                      </div>
                    )}

                    <div className="text-[9px] text-stone-400 font-mono self-start">🐾</div>
                    <div className="flex flex-col items-center">
                      <span className="text-base sm:text-lg">🐶</span>
                      <span className="text-[8px] text-stone-400 font-mono tracking-tight">第{idx + 1}张</span>
                    </div>
                    <div className="text-[9px] text-stone-500 font-mono self-end">🐾</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* User draw confirm button when a card is actively hovered */}
        {currentTurn === 'user' && hoveredCharCardIdx !== null && !winner && (
          <div className="mt-1 flex justify-center">
            <button
              id="ghost-card-confirm-draw-btn"
              onClick={() => handleUserDrawCard(hoveredCharCardIdx)}
              className="py-1.5 px-4 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold text-xs shadow-[0_0_15px_rgba(245,158,11,0.4)] flex items-center space-x-1.5 transition-all transform hover:scale-105"
            >
              <Pointer className="w-3.5 h-3.5" />
              <span>👉 我想抽这张 (第 {hoveredCharCardIdx + 1} 张)</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Middle Area: Stream Dialogue, Inner Thought & Psychological Choice Option Bubble */}
      <div className="flex-1 flex flex-col min-h-0 bg-stone-950/90 relative">
        {/* Dynamic Discard Pile Indicator */}
        <div className="px-3 py-1.5 bg-stone-900/50 border-b border-stone-800/40 flex items-center justify-between text-[11px] text-stone-400 shrink-0">
          <div className="flex items-center space-x-2">
            <span className="flex items-center space-x-1 text-stone-300">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>已消除弃牌堆:</span>
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

        {/* Scrollable Timeline Stream */}
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {inGameChats.map((msg) => {
            const isChar = msg.sender === 'character';
            const isSys = msg.sender === 'system';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  isSys ? 'items-center my-1' : isChar ? 'items-start' : 'items-end'
                }`}
              >
                {isSys ? (
                  <div className="text-[10px] text-stone-400 bg-stone-900/80 px-2.5 py-1 rounded-full border border-stone-800/80 text-center max-w-[90%]">
                    {msg.text}
                  </div>
                ) : isChar ? (
                  <div className="flex items-start space-x-2 max-w-[85%]">
                    <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 mt-0.5 border border-stone-700">
                      {charAvatar ? (
                        <img src={charAvatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs">🐾</span>
                      )}
                    </div>
                    <div className="flex flex-col space-y-1">
                      <div className="bg-stone-900 border border-stone-800 text-stone-200 text-xs px-3 py-2 rounded-2xl rounded-tl-none shadow-sm leading-relaxed">
                        {msg.text}
                      </div>
                      {/* Character Inner Thought */}
                      {msg.thought && (
                        <div className="text-[11px] text-amber-400/80 italic bg-amber-950/20 border border-amber-800/30 px-2.5 py-1 rounded-xl">
                          💭 {msg.thought}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-600 text-white text-xs px-3 py-2 rounded-2xl rounded-tr-none shadow-sm max-w-[85%] leading-relaxed">
                    {msg.text}
                  </div>
                )}
              </div>
            );
          })}

          {/* LLM Thinking indicator */}
          {isLlmThinking && (
            <div className="flex items-center space-x-2 text-stone-400 text-xs py-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span>{characterName} 正在凝视你的微表情并进行心理战推演……</span>
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* CHARACTER TURN PSYCHOLOGICAL BLUFFING CONTROLLER */}
        {/* ------------------------------------------------------------- */}
        {currentTurn === 'character' && !winner && (
          <div className="p-3 bg-stone-900/95 border-t border-amber-500/30 shadow-2xl shrink-0 backdrop-blur-md">
            {/* Phase 1: Player selects cards + Tactic direction */}
            {userTacticPhase === 'select_tactic' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-amber-300 font-semibold">
                  <span className="flex items-center space-x-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>第 1 步：在下方手牌点击选中 1~多张，然后选择大方向：</span>
                  </span>
                  <span className="text-[10px] text-stone-400">
                    已选: {selectedUserCardIndices.length > 0 ? selectedUserCardIndices.map((i) => `第${i + 1}张`).join(',') : '整把手牌'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    id="tactic-provoke-btn"
                    disabled={isLlmThinking}
                    onClick={() => handleConfirmTactic('provoke')}
                    className="p-2.5 rounded-xl bg-gradient-to-r from-rose-950/70 to-rose-900/50 hover:from-rose-900 hover:to-rose-800 border border-rose-500/60 text-xs text-rose-200 transition-all shadow flex flex-col items-center justify-center space-y-0.5 group"
                  >
                    <div className="flex items-center space-x-1 font-bold text-rose-300">
                      <Flame className="w-3.5 h-3.5 text-rose-400 group-hover:scale-110 transition-transform" />
                      <span>🔥 【挑逗】让它选</span>
                    </div>
                    <span className="text-[10px] text-stone-300">挑衅诱导 · “有种你选这几张”</span>
                  </button>

                  <button
                    id="tactic-plead-btn"
                    disabled={isLlmThinking}
                    onClick={() => handleConfirmTactic('plead')}
                    className="p-2.5 rounded-xl bg-gradient-to-r from-blue-950/70 to-blue-900/50 hover:from-blue-900 hover:to-blue-800 border border-blue-500/60 text-xs text-blue-200 transition-all shadow flex flex-col items-center justify-center space-y-0.5 group"
                  >
                    <div className="flex items-center space-x-1 font-bold text-blue-300">
                      <Shield className="w-3.5 h-3.5 text-blue-400 group-hover:scale-110 transition-transform" />
                      <span>🥺 【求饶】不想让它选</span>
                    </div>
                    <span className="text-[10px] text-stone-300">慌张掩护 · “求求你别碰这几张”</span>
                  </button>
                </div>
              </div>
            )}

            {/* Phase 2: AI is Hovering on a card + Player Interjects Speech or Swaps */}
            {userTacticPhase === 'interject_speech' && charHoveredUserCardIdx !== null && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  {isProactiveInitiative ? (
                    <div className="flex items-center space-x-1.5 text-amber-300 font-bold animate-pulse">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>⚡【先发制人】{characterName} 直觉锁定你的【第 {charHoveredUserCardIdx + 1} 张牌】！</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1.5 text-rose-400 animate-pulse">
                      <Pointer className="w-3.5 h-3.5" />
                      <span>{characterName} 正在悬停你的【第 {charHoveredUserCardIdx + 1} 张牌】！</span>
                    </div>
                  )}
                  <button
                    id="ghost-card-swap-cards-btn"
                    onClick={handleSwapCardsAndRestartTactic}
                    className="text-[11px] px-2 py-0.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-600 text-stone-300 flex items-center space-x-1 transition"
                  >
                    <Shuffle className="w-3 h-3 text-amber-400" />
                    <span>🔀 换牌打乱重选</span>
                  </button>
                </div>

                {/* Quick Speech Bubbles for Language Tug-of-war */}
                <div className="grid grid-cols-2 gap-1.5">
                  {(isProactiveInitiative
                    ? [
                        '“你直觉这么准？有种就真抽它！”',
                        '“别碰！那张是我的底牌！”',
                        '“抽吧抽吧，抽完你可别后悔～”',
                        '“算你狠，不过你真敢拿吗？”',
                      ]
                    : currentTactic === 'provoke'
                    ? [
                        '“有胆你就真抽这张，看谁笑到最后～”',
                        '“我就知道你会选这张，快抽吧！”',
                      ]
                    : [
                        '“真的求你了别选这张，我认输还不行嘛！”',
                        '“……你手下留情，选别的牌好不好？”',
                      ]
                  ).map((phrase, pIdx) => (
                    <button
                      key={pIdx}
                      disabled={isLlmThinking}
                      onClick={() => handlePlayerSubmitInterjection(phrase)}
                      className="p-1.5 rounded-lg bg-stone-800/80 hover:bg-stone-700 border border-stone-700 text-[11px] text-stone-300 text-left truncate hover:border-amber-400 transition"
                      title={phrase}
                    >
                      {phrase}
                    </button>
                  ))}
                </div>

                {/* Custom speech input box */}
                <div className="flex items-center space-x-2">
                  <input
                    id="interject-speech-input"
                    type="text"
                    value={interjectInputText}
                    onChange={(e) => setInterjectInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handlePlayerSubmitInterjection(interjectInputText)}
                    placeholder={
                      isProactiveInitiative
                        ? `进行语言拉扯（向角色施压/示弱/虚张声势）……`
                        : `输入心理战施压/真诚拉扯话术（或直接点击确认）……`
                    }
                    className="flex-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-1.5 text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    id="interject-speech-submit-btn"
                    disabled={isLlmThinking}
                    onClick={() => handlePlayerSubmitInterjection(interjectInputText)}
                    className="py-1.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow transition shrink-0"
                  >
                    {isProactiveInitiative ? '语言拉扯并确认' : '确认让ta抽'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Player Hand Zone (Bottom Arena: Face-up Cards with Ranks, Multi-select & Hover Targeting) */}
      <div className="p-3 bg-stone-900 border-t border-stone-800 shrink-0">
        <div className="flex items-center justify-between text-xs text-stone-400 mb-1.5">
          <div className="flex items-center space-x-1.5">
            <span className="font-semibold text-stone-200">主控手牌 (你自己)</span>
            <span className="text-[10px] px-1.5 rounded-full bg-stone-800 text-stone-300 font-mono">
              {userHand.length} 张
            </span>
          </div>
          {userHand.some((c) => c.isGhost) && (
            <span className="text-[11px] text-amber-400 font-medium flex items-center space-x-1 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30 animate-pulse">
              <span>🐾 鬼牌在你手中！</span>
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
                const isSelectedForTactic = selectedUserCardIndices.includes(idx);
                const isAiHovered = currentTurn === 'character' && charHoveredUserCardIdx === idx;

                return (
                  <div
                    key={card.id || idx}
                    id={`user-card-${idx}`}
                    onClick={() => handleToggleSelectUserCard(idx)}
                    className={`relative w-13 h-22 sm:w-15 sm:h-24 rounded-xl border-2 transition-all duration-200 flex flex-col items-center justify-between p-1.5 select-none ${
                      currentTurn === 'character' && userTacticPhase === 'select_tactic'
                        ? 'cursor-pointer hover:-translate-y-3'
                        : ''
                    } ${
                      isAiHovered
                        ? isProactiveInitiative
                          ? 'border-amber-300 ring-4 ring-amber-400/90 shadow-[0_0_35px_rgba(251,191,36,0.95)] -translate-y-5 scale-110 z-30 bg-gradient-to-b from-amber-950/80 via-stone-900 to-amber-950 text-stone-100 animate-pulse'
                          : 'border-rose-400 ring-4 ring-rose-500/80 shadow-[0_0_25px_rgba(244,63,94,0.7)] -translate-y-4 scale-105 z-30 bg-gradient-to-b from-rose-950/70 to-stone-900 text-stone-100 animate-pulse'
                        : isSelectedForTactic
                        ? 'border-amber-400 ring-2 ring-amber-400/60 -translate-y-2 z-20 bg-amber-950/30'
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
                            <span>⚡ 直觉先发锁定！</span>
                          </>
                        ) : (
                          <span>👇 {characterName} 悬停中</span>
                        )}
                      </div>
                    )}

                    {/* Selected checkbox for tactic */}
                    {isSelectedForTactic && !isAiHovered && (
                      <div className="absolute -top-2 -right-1 bg-amber-500 text-stone-950 rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold shadow">
                        ✓
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

        {/* Live Chat Input Bar */}
        <div className="mt-2 flex items-center space-x-2">
          <input
            id="ghost-card-chat-input"
            type="text"
            value={chatInputText}
            onChange={(e) => setChatInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
            placeholder={`对 ${characterName} 说话或进行闲聊试探……`}
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
              <p>• <strong>主控抽牌（滑动试探）</strong>：手指在角色展开的手牌上左右滑动，轮廓闪烁光效，实时查看角色对每张牌的微表情与心理防线，选中后点击确认抽牌。</p>
              <p>• <strong>角色抽牌（挑逗与求饶博弈）</strong>：
                <br />1. 主控选择手牌并确立大方向：<strong>【挑逗（让它选）】</strong> 或 <strong>【求饶（不想让它选）】</strong>。
                <br />2. 角色进行心理推演，将手指悬停在某张牌上试探。
                <br />3. 主控可输入言语施压/心理战拉扯，或点击<strong>【换牌重新洗牌】</strong>；角色做出最终抽牌决断并发表感言！
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
