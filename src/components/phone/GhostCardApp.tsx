import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  RotateCcw, 
  Trophy, 
  Flag, 
  Sparkles, 
  CheckCircle2, 
  Send, 
  History, 
  Settings, 
  MessageSquare, 
  Pause, 
  Play, 
  Loader2, 
  Volume2, 
  VolumeX, 
  HelpCircle,
  Eye,
  EyeOff,
  Flame,
  Shield,
  Layers,
  Sparkle,
  X,
  ChevronRight,
  Smile,
  Frown,
  Meh
} from 'lucide-react';
import { 
  createCompactDeck,
  dealInitialHands,
  autoDiscardPairs,
  executeDrawCard,
  checkGhostCardWinner,
  type Card,
  type DiscardedPair,
  type UserBluffHistoryItem,
  type CharBluffHistoryItem,
  type GhostCardKeyMoment
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
  generateGhostCardUserDrawReaction,
  generateGhostCardUserOptions,
  generateGhostCardCharDrawDecision,
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
// Web Audio Sound Synthesizers (Old Maid / Dog Motifs)
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
  const [currentOptions, setCurrentOptions] = useState<{ option_a: string; option_b: string } | null>(null);

  // System & Flags
  const [isLlmThinking, setIsLlmThinking] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [hoveredCharCardIdx, setHoveredCharCardIdx] = useState<number | null>(null);
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
      setCurrentOptions(saved.currentOptions || null);
      setGameTotalDelta(saved.gameTotalDelta || {});
      setWinner(saved.winner || null);
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
        currentOptions: currentOptions || undefined,
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
    currentOptions,
    isPaused,
    gameTotalDelta,
    winner,
  ]);

  // -------------------------------------------------------------
  // Mechanical: Start / Initialize New Game
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
    setCurrentOptions(null);

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
        text: `🐾 牌局开始！牌堆17张已分发完毕，双方初始手牌已自动打出成对卡牌（主控打出${userPairs.length}对，${characterName}打出${charPairs.length}对）。`,
        timestamp: Date.now(),
      },
    ];
    setInGameChats(initialChats);

    if (soundEnabled) playPairMatchSound();

    // 4. LLM Opening Call
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
        const fallbackText = `“牌发好啦，双方对子都扣下了。现在轮到你先抽，可别第一张就抓到鬼牌哦～”`;
        setCharacterSpeech(fallbackText);
        setCharacterAction(`*轻摇尾巴，展开手牌*`);
        setInGameChats((prev) => [
          ...prev,
          {
            id: `char_open_${Date.now()}`,
            sender: 'character',
            text: `*轻摇尾巴，展开手牌* ${fallbackText}`,
            timestamp: Date.now(),
          },
        ]);
      }
    } finally {
      setIsLlmThinking(false);
    }
  }, [currentCharacterId, characterName, activeChar, currentEmotionSnapshot, soundEnabled]);

  // -------------------------------------------------------------
  // Player Draws Card from Character Hand
  // -------------------------------------------------------------
  const handleUserDrawCard = async (cardIdx: number) => {
    if (currentTurn !== 'user' || winner || isLlmThinking || isPaused) return;
    if (cardIdx < 0 || cardIdx >= charHand.length) return;

    if (soundEnabled) playCardDrawSound();

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

        // Key moment tracking
        if (result.isGhost) {
          setKeyMoments((prev) => [
            ...prev,
            {
              round: turnCount,
              event: '抓到鬼牌',
              detail: `主控在第${turnCount}轮抽中了鬼牌🐾，${characterName}内心暗喜`,
            },
          ]);
        }
      }
    } catch (err) {
      console.warn('User draw reaction LLM failed:', err);
    }

    // Transition to Character's Turn
    setCurrentTurn('character');

    // Step 3: Generate Dynamic Choice Options for Player before Character Draws
    try {
      const userHasGhost = result.newToHand.some((c) => c.isGhost);
      if (isLlmConfigured(activeConfig)) {
        const options = await generateGhostCardUserOptions(
          activeConfig,
          activeChar,
          currentEmotionSnapshot || { joy: 0.5, warmth: 0.5, sadness: 0.1, anger: 0.1, fear: 0.1, desire: 0.2 },
          {
            userCardCount: result.newToHand.length,
            charCardCount: result.newFromHand.length,
            userHasGhost,
            turnCount,
            userBluffHistory,
          }
        );
        setCurrentOptions(options);
      } else {
        setCurrentOptions({
          option_a: '“左边那张手感特别好，你肯定想选它吧～”',
          option_b: '“……我劝你别选中间那张，真的。”',
        });
      }
    } finally {
      setIsLlmThinking(false);
    }
  };

  // -------------------------------------------------------------
  // Character Draws Card from Player Hand (Triggered by Player Bluff Choice)
  // -------------------------------------------------------------
  const handlePlayerChooseOption = async (chosenText: string, isOptionA: boolean) => {
    if (currentTurn !== 'character' || winner || isLlmThinking || isPaused) return;

    setCurrentOptions(null);
    setIsLlmThinking(true);

    // Add user's speech to chat
    setInGameChats((prev) => [
      ...prev,
      {
        id: `user_bluff_${Date.now()}`,
        sender: 'user',
        text: `（对${characterName}说）：${chosenText}`,
        timestamp: Date.now(),
      },
    ]);

    const activeConfig = loadLlmConfig();
    const userHasGhost = userHand.some((c) => c.isGhost);
    const charHasGhost = charHand.some((c) => c.isGhost);

    try {
      let decision: {
        believed: boolean;
        selectedIndex: number;
        reactionDialogue: string;
        innerThought: string;
        stepEmotionDelta: Partial<EmotionVector>;
      };

      if (isLlmConfigured(activeConfig)) {
        decision = await generateGhostCardCharDrawDecision(
          activeConfig,
          activeChar,
          currentEmotionSnapshot || { joy: 0.5, warmth: 0.5, sadness: 0.1, anger: 0.1, fear: 0.1, desire: 0.2 },
          {
            userChoiceText: chosenText,
            userCardCount: userHand.length,
            userBluffHistory,
            charHasGhost,
            charCardCount: charHand.length,
            turnCount,
          }
        );
      } else {
        const randIdx = Math.floor(Math.random() * userHand.length);
        decision = {
          believed: isOptionA ? false : true,
          selectedIndex: randIdx,
          reactionDialogue: `“那我就选这张了！” *指尖抽出一张牌*`,
          innerThought: `*希望这张不是鬼牌……*`,
          stepEmotionDelta: { warmth: 0.05 },
        };
      }

      // Safe index bound
      const safeIdx = Math.max(0, Math.min(decision.selectedIndex, userHand.length - 1));

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
        userSaid: chosenText,
        charBelieved: decision.believed,
        actualResult: result.isGhost ? '抽到鬼牌' : result.pairedCard ? '抽到安全牌并成对' : '抽到安全牌',
        isLie: userHasGhost,
        timestamp: Date.now(),
      };
      setUserBluffHistory((prev) => [...prev, bluffItem]);

      // Update character speech & thought
      setCharacterSpeech(decision.reactionDialogue);
      setCharacterInnerThought(decision.innerThought);

      if (decision.stepEmotionDelta) {
        setGameTotalDelta((prev) => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(decision.stepEmotionDelta).map(([k, v]) => [
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
          text: `${decision.reactionDialogue} （${characterName}从你的手牌中抽取了第 ${safeIdx + 1} 张牌，${charDrawDesc}）`,
          thought: decision.innerThought,
          timestamp: Date.now(),
        },
      ]);

      if (result.isGhost) {
        setKeyMoments((prev) => [
          ...prev,
          {
            round: turnCount,
            event: '角色抽中鬼牌',
            detail: `${characterName}在第${turnCount}轮抽中了鬼牌🐾（主控话术：${chosenText}）`,
          },
        ]);
      }

      // Check Win/Loss
      const winResult = checkGhostCardWinner(result.newFromHand, result.newToHand);
      if (winResult) {
        handleGameOver(winResult, result.newFromHand, result.newToHand);
        return;
      }

      // Next Turn
      setTurnCount((prev) => prev + 1);
      setCurrentTurn('user');
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
                捉鬼牌
              </span>
            </div>
            <div className="text-[10px] text-stone-400">
              第 {turnCount} 轮 · {currentTurn === 'user' ? '轮到你抽牌' : `轮到${characterName}抽牌`}
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

      {/* 2. Character Zone (Top Arena: Face-down Cards in Fan / Arc) */}
      <div className="relative pt-3 pb-2 px-4 bg-gradient-to-b from-stone-900/60 to-stone-950/20 border-b border-stone-800/60 shrink-0">
        <div className="flex items-center justify-between text-xs text-stone-400 mb-1.5">
          <div className="flex items-center space-x-1.5">
            <span className="font-semibold text-stone-300">{characterName} 的手牌</span>
            <span className="text-[10px] px-1.5 rounded-full bg-stone-800 text-stone-300 font-mono">
              {charHand.length} 张
            </span>
          </div>
          {currentTurn === 'user' && !winner && (
            <span className="text-[11px] text-amber-400 flex items-center space-x-1 animate-pulse">
              <span>👉 请点击下方一张抽取</span>
            </span>
          )}
        </div>

        {/* Character Card Backs Fan */}
        <div className="flex items-center justify-center py-2 min-h-[95px] overflow-x-auto">
          {charHand.length === 0 ? (
            <div className="text-xs text-emerald-400 py-4 flex items-center space-x-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>手牌已全部清空！</span>
            </div>
          ) : (
            <div className="flex items-center justify-center -space-x-4 px-4 py-2">
              {charHand.map((card, idx) => {
                const isHovered = hoveredCharCardIdx === idx;
                const canDraw = currentTurn === 'user' && !isLlmThinking && !winner;
                return (
                  <button
                    key={card.id || idx}
                    id={`char-card-${idx}`}
                    disabled={!canDraw}
                    onMouseEnter={() => setHoveredCharCardIdx(idx)}
                    onMouseLeave={() => setHoveredCharCardIdx(null)}
                    onClick={() => handleUserDrawCard(idx)}
                    className={`relative w-14 h-20 rounded-xl border-2 transition-all duration-200 flex flex-col items-center justify-between p-1.5 shadow-lg select-none ${
                      canDraw
                        ? 'cursor-pointer hover:-translate-y-3 hover:border-amber-400 hover:shadow-amber-500/20 hover:z-30'
                        : 'cursor-default opacity-90'
                    } ${
                      isHovered && canDraw
                        ? 'bg-gradient-to-b from-stone-700 to-stone-800 border-amber-400 z-20 scale-105'
                        : 'bg-gradient-to-b from-stone-800 to-stone-900 border-stone-700'
                    }`}
                    style={{
                      transform: isHovered && canDraw ? 'translateY(-12px)' : 'none',
                    }}
                  >
                    <div className="text-[9px] text-stone-400 font-mono self-start">🐾</div>
                    <div className="flex flex-col items-center">
                      <span className="text-lg">🐶</span>
                      <span className="text-[8px] text-stone-400 font-mono tracking-tight">GHOST</span>
                    </div>
                    <div className="text-[9px] text-stone-500 font-mono self-end">🐾</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
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
              <span>{characterName} 正在凝视你的微表情并思索对策……</span>
            </div>
          )}
        </div>

        {/* Interactive Psychological Options Bar (When Character is drawing from User) */}
        {currentTurn === 'character' && currentOptions && !winner && (
          <div className="p-3 bg-stone-900/95 border-t border-amber-500/30 shadow-2xl shrink-0 backdrop-blur-md">
            <div className="flex items-center justify-between text-xs text-amber-400 font-semibold mb-2">
              <span className="flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>心理博弈：在{characterName}抽牌前，选择你想说的话：</span>
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <button
                id="ghost-card-option-a"
                onClick={() => handlePlayerChooseOption(currentOptions.option_a, true)}
                className="w-full text-left p-2.5 rounded-xl bg-gradient-to-r from-stone-800 to-stone-800/80 hover:from-amber-950/60 hover:to-amber-900/40 border border-stone-700 hover:border-amber-500/60 text-xs text-stone-200 transition-all shadow group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-amber-300">话术 A (虚张声势/诱导)：</span>
                  <span className="text-[10px] text-stone-400 group-hover:text-amber-300">点击发出 🐾</span>
                </div>
                <div className="mt-1 text-stone-300">{currentOptions.option_a}</div>
              </button>

              <button
                id="ghost-card-option-b"
                onClick={() => handlePlayerChooseOption(currentOptions.option_b, false)}
                className="w-full text-left p-2.5 rounded-xl bg-gradient-to-r from-stone-800 to-stone-800/80 hover:from-stone-700/80 hover:to-stone-700/60 border border-stone-700 hover:border-amber-500/60 text-xs text-stone-200 transition-all shadow group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-amber-300">话术 B (真诚提醒/反向暗示)：</span>
                  <span className="text-[10px] text-stone-400 group-hover:text-amber-300">点击发出 🐾</span>
                </div>
                <div className="mt-1 text-stone-300">{currentOptions.option_b}</div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Player Hand Zone (Bottom Arena: Face-up Cards with Ranks & Ghost Highlights) */}
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
        <div className="flex items-center justify-center py-1 min-h-[90px] overflow-x-auto">
          {userHand.length === 0 ? (
            <div className="text-xs text-emerald-400 py-3 flex items-center space-x-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>你已清空所有手牌，胜利！</span>
            </div>
          ) : (
            <div className="flex items-center justify-center -space-x-3 px-2 py-1">
              {userHand.map((card, idx) => {
                const isGhost = card.isGhost;
                return (
                  <div
                    key={card.id || idx}
                    id={`user-card-${idx}`}
                    className={`relative w-13 h-20 sm:w-14 sm:h-22 rounded-xl border-2 transition-all duration-200 flex flex-col items-center justify-between p-1.5 shadow-md select-none hover:-translate-y-2 ${
                      isGhost
                        ? 'bg-gradient-to-b from-purple-950 via-stone-900 to-amber-950/80 border-amber-400 shadow-amber-500/30 z-10'
                        : 'bg-gradient-to-b from-stone-100 to-stone-200 text-stone-900 border-stone-300'
                    }`}
                  >
                    {/* Top corner rank & suit */}
                    <div className="flex items-center justify-between w-full text-[10px] font-bold leading-none">
                      <span className={isGhost ? 'text-amber-400' : 'text-stone-900'}>{card.displayRank}</span>
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
                          <span className="text-[9px] font-mono font-bold">{card.rank}</span>
                        </>
                      )}
                    </div>

                    {/* Bottom corner */}
                    <div className="flex items-center justify-between w-full text-[10px] font-bold leading-none">
                      <span className="text-xs">{card.suit}</span>
                      <span className={isGhost ? 'text-amber-400' : 'text-stone-900'}>{card.displayRank}</span>
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
            placeholder={`对 ${characterName} 说话或进行心理战试探……`}
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
                <span>🐾 捉鬼牌（紧凑版）游戏规则</span>
              </h3>
              <button onClick={() => setShowRulesModal(false)} className="text-stone-400 hover:text-stone-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-stone-300 space-y-2 leading-relaxed">
              <p>• <strong>紧凑牌组</strong>：共 17 张牌（8 对普通配对牌 + 1 张鬼牌 🐾）。</p>
              <p>• <strong>初始发牌与自动消对</strong>：发牌后，双方手中相同点数的对子会自动打出弃入弃牌堆。</p>
              <p>• <strong>抽牌轮转</strong>：双方轮流从对方的手牌中抽取一张。若抽到的牌与自己手牌成对，立即打出消除。</p>
              <p>• <strong>心理博弈与读心</strong>：角色抽牌前，你可以选择虚张声势诱导或真诚提醒；角色也会根据性格和直觉分析你的真假！</p>
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
