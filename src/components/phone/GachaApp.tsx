import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  RotateCcw,
  X,
  History,
  Info,
  HelpCircle,
  Settings,
  Send,
  Sparkle,
  Layers,
  Flame,
  CheckCircle2,
  ChevronLeft,
  Sliders,
  Volume2,
  VolumeX,
  Maximize2,
} from 'lucide-react';
import {
  type GachaPoolConfig,
  type GachaCard,
  type GachaButton,
  type GachaPullItem,
  type ClickHabitProfile,
  DEFAULT_GACHA_POOL,
  loadGachaPoolConfig,
  saveGachaPoolConfig,
  executeGachaPull,
  parseClickRhythm,
  playGachaButtonSound,
  playCardFlipSound,
  playSsrSparkleSound,
  playBubblePopSound,
} from '../../lib/gachaEngine';
import {
  generateGachaOpening,
  generateGachaDecision,
  generateGachaResultProfile,
  generateGachaUserResponse,
  generateGachaEnding,
  loadLlmConfig,
  isLlmConfigured,
  type GachaClickTarget,
} from '../../lib/llm';
import {
  idbSaveGameMatch,
  type DBGameMatchRecord,
} from '../../lib/idb';
import { saveGameEmotionImpact } from '../../lib/gameStore';
import type { Character, EmotionVector, EmotionKey } from '../../data/types';
import { EMOTION_NAMES } from '../../data/types';
import GachaEditor from './GachaEditor';

interface Props {
  currentCharacterId: string;
  characterName: string;
  character?: Character;
  currentEmotionSnapshot?: EmotionVector;
  initialUserInstruction?: string;
  onGameFinished?: (
    summary: string,
    rawRecord: DBGameMatchRecord,
    applyEmotionDelta?: boolean,
    customDelta?: Partial<EmotionVector>
  ) => void;
  onApplyGameEmotionDelta?: (delta: Partial<EmotionVector>, summary: string) => void;
  onExit?: () => void;
}

export default function GachaApp({
  currentCharacterId,
  characterName,
  character,
  currentEmotionSnapshot,
  initialUserInstruction = '帮我抽几发试试手气！',
  onGameFinished,
  onApplyGameEmotionDelta,
  onExit,
}: Props) {
  // 1. Config & Pool State
  const [poolConfig, setPoolConfig] = useState<GachaPoolConfig>(() => loadGachaPoolConfig());
  const [sparkCount, setSparkCount] = useState<number>(0);
  const [totalPulls, setTotalPulls] = useState<number>(0);
  const [ssrObtainedList, setSsrObtainedList] = useState<string[]>([]);
  const [pullHistory, setPullHistory] = useState<GachaPullItem[]>([]);
  const [userInstruction, setUserInstruction] = useState<string>(initialUserInstruction);

  // 2. Cursor State (0-100 percentage inside gacha container)
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({ x: 50, y: 80 });
  const [cursorTransition, setCursorTransition] = useState<string>('all 0.6s cubic-bezier(0.25, 0.1, 0.25, 1)');
  const [isClicking, setIsClicking] = useState<boolean>(false);

  // 3. Bubble System State
  const [activeBubble, setActiveBubble] = useState<{
    text: string;
    type: 'bubble_to_user' | 'bubble_self' | 'bubble_evaluation';
    thumbnail?: string;
  } | null>(null);

  // 4. Screen & Flow State
  const [currentScreen, setCurrentScreen] = useState<
    'pool_main' | 'pool_detail' | 'rate_info' | 'pull_history' | 'summon_anim' | 'result_flipping' | 'result_done'
  >('pool_main');

  const [currentBatchPulls, setCurrentBatchPulls] = useState<GachaPullItem[]>([]);
  const [currentFlipIdx, setCurrentFlipIdx] = useState<number>(-1);
  const [isWaitingUserReply, setIsWaitingUserReply] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isSsrFlashActive, setIsSsrFlashActive] = useState<boolean>(false);

  // 5. Modals State
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [showRateModal, setShowRateModal] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showEditorModal, setShowEditorModal] = useState<boolean>(false);
  const [showSettlementModal, setShowSettlementModal] = useState<boolean>(false);
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);

  // 6. Dialogue / Settlement / Emotion Accumulation
  const [gameTotalDelta, setGameTotalDelta] = useState<Partial<EmotionVector>>({
    joy: 0.1,
    warmth: 0.1,
  });
  const [endingSummaryText, setEndingSummaryText] = useState<string>('');
  const [inGameChatInput, setInGameChatInput] = useState<string>('');
  const [inGameChatLogs, setInGameChatLogs] = useState<Array<{ sender: 'user' | 'agent' | 'system'; text: string; time: number }>>([]);
  const [behaviorLogs, setBehaviorLogs] = useState<string[]>([]);
  const [isAgentThinking, setIsAgentThinking] = useState<boolean>(false);

  // References for async loops & safety
  const containerRef = useRef<HTMLDivElement>(null);
  const bubbleTimerRef = useRef<any>(null);
  const llmPendingProfileRef = useRef<any>(null);
  const abortCurrentActionRef = useRef<boolean>(false);
  const waitingUserReplyResolverRef = useRef<(() => void) | null>(null);

  const fallbackCharacter: Character = character || {
    id: currentCharacterId || 'char_001',
    name: characterName || '风铃',
    core: {
      values: ['灵动', '温柔', '玄学调侃'],
      speech_filter: '亲昵活泼',
      taboos: [],
    },
    emotion: {
      current: currentEmotionSnapshot || { anger: 0.1, fear: 0.1, joy: 0.5, sadness: 0.1, desire: 0.3, warmth: 0.6 },
      base: { anger: 0.1, fear: 0.1, joy: 0.5, sadness: 0.1, desire: 0.3, warmth: 0.6 },
    },
  } as any;

  // Show Bubble Helper
  const showBubble = useCallback((
    text: string,
    type: 'bubble_to_user' | 'bubble_self' | 'bubble_evaluation' = 'bubble_to_user',
    durationMs: number = 4500,
    thumbnail?: string
  ) => {
    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    if (!text || text.trim() === '') {
      setActiveBubble(null);
      return;
    }
    if (soundEnabled) playBubblePopSound();
    setActiveBubble({ text, type, thumbnail });

    // Append to in-game chat stream
    setInGameChatLogs((prev) => [
      ...prev.slice(-40),
      {
        sender: 'agent',
        text: type === 'bubble_self' ? `（独白）${text}` : text,
        time: Date.now(),
      },
    ]);

    if (durationMs > 0) {
      bubbleTimerRef.current = setTimeout(() => {
        setActiveBubble(null);
      }, durationMs);
    }
  }, [soundEnabled]);

  // Smooth Move Virtual Cursor
  const moveCursorTo = useCallback((x: number, y: number, transitionSec: number = 0.6) => {
    setCursorTransition(`all ${transitionSec}s cubic-bezier(0.25, 0.1, 0.25, 1)`);
    setCursorPos({ x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) });
  }, []);

  // Perform Click Action
  const triggerCursorClick = useCallback(async (callback?: () => void) => {
    setIsClicking(true);
    if (soundEnabled) playGachaButtonSound();
    await new Promise((r) => setTimeout(r, 200));
    setIsClicking(false);
    if (callback) callback();
    await new Promise((r) => setTimeout(r, 150));
  }, [soundEnabled]);

  // Execute Agent Action from Endpoint ② or ①
  const executeAgentDecisionAction = useCallback(async (
    target: GachaClickTarget,
    rhythmText: string,
    hesitationMs: number,
    bubbleUser: string,
    bubbleSelf: string,
    onComplete?: () => void
  ) => {
    const rhythm = parseClickRhythm(rhythmText);

    // 1. Show pre-movement or thinking bubble
    if (bubbleSelf) {
      showBubble(bubbleSelf, 'bubble_self', 3000);
    } else if (bubbleUser) {
      showBubble(bubbleUser, 'bubble_to_user', 4000);
    }

    // 2. Resolve coordinates
    let targetX = 50;
    let targetY = 80;
    let targetButton: GachaButton | undefined;

    if (target.type === 'button' && target.button_id) {
      targetButton = poolConfig.buttons.find((b) => b.id === target.button_id);
      if (targetButton) {
        targetX = targetButton.position.x;
        targetY = targetButton.position.y;
      }
    } else if (target.type === 'blank' && target.position) {
      targetX = target.position.x * 100;
      targetY = target.position.y * 100;
    }

    // 3. Move cursor with parsed rhythm transition
    moveCursorTo(targetX, targetY, rhythm.moveDurationSec);
    await new Promise((r) => setTimeout(r, rhythm.moveDurationSec * 1000));

    // 4. Hover hesitation
    if (hesitationMs > 0) {
      await new Promise((r) => setTimeout(r, hesitationMs));
    }

    // 5. Speak bubble_to_user before or while clicking
    if (bubbleUser && bubbleUser !== bubbleSelf) {
      showBubble(bubbleUser, 'bubble_to_user', 4000);
    }

    // 6. Click trigger
    await triggerCursorClick(() => {
      if (targetButton) {
        handleButtonClick(targetButton.id);
      }
    });

    if (onComplete) onComplete();
  }, [poolConfig.buttons, moveCursorTo, triggerCursorClick, showBubble]);

  // Start Gacha Pull Execution (1-pull or 10-pull)
  const executePullFlow = useCallback(async (pullCount: number) => {
    abortCurrentActionRef.current = false;
    setIsAgentThinking(true);

    // 1. Generate Pull Results (Mechanical Layer)
    const pullResult = executeGachaPull(poolConfig, pullCount, sparkCount, totalPulls);
    setSparkCount(pullResult.newSparkCount);
    const newTotal = totalPulls + pullCount;
    setTotalPulls(newTotal);
    setPullHistory((prev) => [...prev, ...pullResult.items]);
    setCurrentBatchPulls(pullResult.items.map((item) => ({ ...item, flipped: false })));
    setCurrentFlipIdx(-1);

    const newSsrNames = pullResult.items
      .filter((p) => p.card.rarity === 'SSR')
      .map((p) => p.card.name);

    if (newSsrNames.length > 0) {
      setSsrObtainedList((prev) => [...prev, ...newSsrNames]);
      setGameTotalDelta((prev) => ({
        ...prev,
        joy: Math.min(0.6, (prev.joy || 0) + 0.25),
        warmth: Math.min(0.6, (prev.warmth || 0) + 0.2),
      }));
    }

    // 2. Enter Summon Animation Screen
    setCurrentScreen('summon_anim');
    setBehaviorLogs((prev) => [
      ...prev,
      `执行了${pullCount === 10 ? '十连共鸣' : '单抽共鸣'}，产生结果并播放召唤动画。`,
    ]);

    // 3. Immediately auto-request LLM for reaction & card flipping habit during summon animation
    const llmConfig = loadLlmConfig();
    const resultProfilePromise = generateGachaResultProfile(
      llmConfig,
      fallbackCharacter,
      pullResult.items,
      newTotal,
      [...ssrObtainedList, ...newSsrNames],
      pullResult.newSparkCount,
      poolConfig.spark_count,
      poolConfig
    );

    llmPendingProfileRef.current = resultProfilePromise;

    // 4. Play Summon Animation (with Agent Skip Click)
    const animDurationMs = 3000;
    await new Promise((r) => setTimeout(r, animDurationMs));

    // Agent awaits LLM reaction profile
    let profileResult: any;
    try {
      profileResult = await Promise.race([
        resultProfilePromise,
        new Promise((r) => setTimeout(r, 2000)), // fallback timeout
      ]);
    } catch (e) {
      // fallback
    }

    if (!profileResult) {
      profileResult = {
        click_habit_profile: {
          skip_click_position: { x: 0.85, y: 0.12 },
          click_rhythm: '正常',
          random_tap: false,
          wait_for_user_reply: false,
          tap_while_talking: true,
          evaluation_timing: 'on_flip',
        },
        evaluations: [],
        summary_bubble: '共鸣完成，让我们一张张揭开卡面！',
      };
    }

    // Move cursor to skip position and click to proceed to results
    const skipX = (profileResult.click_habit_profile?.skip_click_position?.x || 0.85) * 100;
    const skipY = (profileResult.click_habit_profile?.skip_click_position?.y || 0.12) * 100;

    moveCursorTo(skipX, skipY, 0.35);
    await new Promise((r) => setTimeout(r, 400));
    await triggerCursorClick();

    // 5. Transition to Card Flipping Screen (v2 core)
    setCurrentScreen('result_flipping');
    setIsAgentThinking(false);

    // 6. Execute v2 Card Flipping Driver via Agent Virtual Cursor with LLM reactions
    await runAgentCardFlippingSequence(pullResult.items, profileResult);
  }, [
    poolConfig,
    sparkCount,
    totalPulls,
    ssrObtainedList,
    fallbackCharacter,
    moveCursorTo,
    triggerCursorClick,
  ]);

  // v2 Core: Agent Virtual Cursor Card Flipping Sequence
  const runAgentCardFlippingSequence = async (
    items: GachaPullItem[],
    profileResult: any
  ) => {
    const habit: ClickHabitProfile = profileResult.click_habit_profile || {
      skip_click_position: { x: 0.85, y: 0.12 },
      click_rhythm: '正常',
      random_tap: false,
      wait_for_user_reply: false,
      tap_while_talking: true,
      evaluation_timing: 'on_flip',
    };

    const rhythm = parseClickRhythm(habit.click_rhythm);
    const evaluations = profileResult.evaluations || [];

    // Calculate grid positions for 10 cards (2 rows x 5 columns) or 1 card
    const cardPositions: Array<{ x: number; y: number }> = [];
    if (items.length === 1) {
      cardPositions.push({ x: 50, y: 48 });
    } else {
      // 10 cards arranged in 2 rows of 5
      const colX = [16, 33, 50, 67, 84];
      const rowY = [38, 62];
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 5; c++) {
          cardPositions.push({ x: colX[c], y: rowY[r] });
        }
      }
    }

    // Agent flips cards one by one
    for (let i = 0; i < items.length; i++) {
      if (abortCurrentActionRef.current) break;
      setCurrentFlipIdx(i);

      const targetPos = cardPositions[i] || { x: 50, y: 50 };
      const currentCardItem = items[i];

      // a. Random Tap feature
      if (habit.random_tap && Math.random() < 0.25) {
        const randX = Math.max(10, Math.min(90, targetPos.x + (Math.random() * 20 - 10)));
        const randY = Math.max(15, Math.min(85, targetPos.y + (Math.random() * 20 - 10)));
        moveCursorTo(randX, randY, 0.3);
        await new Promise((r) => setTimeout(r, 320));
        await triggerCursorClick();
      }

      // b. Move cursor to card center
      moveCursorTo(targetPos.x, targetPos.y, rhythm.moveDurationSec);
      await new Promise((r) => setTimeout(r, rhythm.moveDurationSec * 1000));

      // c. Hesitation / pause on card
      const intervalPause = rhythm.isVariable
        ? Math.floor(Math.random() * 1500) + 400
        : rhythm.clickIntervalMs;
      await new Promise((r) => setTimeout(r, Math.max(200, intervalPause * 0.6)));

      // d. Click card -> 3D flip
      await triggerCursorClick(() => {
        setCurrentBatchPulls((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, flipped: true } : item))
        );
        if (soundEnabled) playCardFlipSound(currentCardItem.card.rarity);
      });

      // e. SSR special burst FX
      if (currentCardItem.card.rarity === 'SSR') {
        setIsSsrFlashActive(true);
        if (soundEnabled) playSsrSparkleSound();
        setTimeout(() => setIsSsrFlashActive(false), 900);
      }

      // f. Show evaluation bubble (v4: generated live by LLM from card characteristics)
      const matchingEval = evaluations.find((e: any) => e.card_index === i);
      let evalText = matchingEval?.text;
      if (!evalText) {
        if (currentCardItem.card.rarity === 'SSR') {
          evalText = `金光闪耀！是SSR【${currentCardItem.card.name}】！太幸运了～`;
        } else if (currentCardItem.card.rarity === 'SR') {
          evalText = `紫光微耀，入手了SR【${currentCardItem.card.name}】～`;
        } else {
          evalText = `翻开一张【${currentCardItem.card.name}】，继续稳步向前～`;
        }
      }

      if (evalText) {
        showBubble(evalText, 'bubble_evaluation', 3500, currentCardItem.card.card_image);
      }

      // g. Wait for User Reply if enabled
      if (habit.wait_for_user_reply && currentCardItem.card.rarity === 'SSR') {
        setIsWaitingUserReply(true);
        await new Promise<void>((resolve) => {
          waitingUserReplyResolverRef.current = resolve;
          // auto timeout 8s if user doesn't speak
          setTimeout(() => {
            if (waitingUserReplyResolverRef.current) {
              waitingUserReplyResolverRef.current();
              waitingUserReplyResolverRef.current = null;
            }
          }, 8000);
        });
        setIsWaitingUserReply(false);
      }

      // h. If tap_while_talking is false, wait for bubble to finish
      if (!habit.tap_while_talking && evalText) {
        await new Promise((r) => setTimeout(r, 1800));
      } else {
        await new Promise((r) => setTimeout(r, Math.max(250, intervalPause * 0.4)));
      }
    }

    // Summary bubble after all 10 cards are flipped
    if (profileResult.summary_bubble) {
      showBubble(profileResult.summary_bubble, 'bubble_to_user', 5000);
    }

    setCurrentScreen('result_done');
    setCurrentFlipIdx(-1);

    // Trigger next Agent Decision Cycle (Endpoint ②) after 3s
    setTimeout(() => {
      triggerAgentDecisionLoop();
    }, 3200);
  };

  // Trigger Endpoint ②: Decision Loop
  const triggerAgentDecisionLoop = useCallback(async () => {
    if (showSettlementModal || showEditorModal) return;
    setIsAgentThinking(true);

    const availableBtns = poolConfig.buttons;
    const llmConfig = loadLlmConfig();

    try {
      const decision = await generateGachaDecision(llmConfig, fallbackCharacter, poolConfig, {
        currentScreen,
        cursorPosition: { x: cursorPos.x / 100, y: cursorPos.y / 100 },
        availableButtons: availableBtns,
        sparkCurrent: sparkCount,
        sparkCount: poolConfig.spark_count,
        totalPulls,
        ssrList: ssrObtainedList,
        userInstruction,
        userLatestMessage: inGameChatLogs[inGameChatLogs.length - 1]?.text,
        behaviorSummary: behaviorLogs.slice(-3).join('; ') || '正在浏览卡池',
      });

      setIsAgentThinking(false);

      if (decision.action === 'stop') {
        handleEndGachaSession();
        return;
      }

      await executeAgentDecisionAction(
        decision.click_target,
        decision.click_rhythm,
        decision.hesitation_ms,
        decision.bubble_to_user,
        decision.bubble_self
      );
    } catch (err) {
      console.warn('Agent decision loop error:', err);
      setIsAgentThinking(false);
    }
  }, [
    showSettlementModal,
    showEditorModal,
    poolConfig,
    fallbackCharacter,
    currentScreen,
    cursorPos,
    sparkCount,
    totalPulls,
    ssrObtainedList,
    userInstruction,
    inGameChatLogs,
    behaviorLogs,
    executeAgentDecisionAction,
  ]);

  // Button Click Handler
  const handleButtonClick = (buttonId: string) => {
    if (buttonId === 'pull_once') {
      executePullFlow(1);
    } else if (buttonId === 'pull_ten') {
      executePullFlow(10);
    } else if (buttonId === 'pool_detail') {
      setShowDetailModal(true);
      setCurrentScreen('pool_detail');
    } else if (buttonId === 'rate_info') {
      setShowRateModal(true);
      setCurrentScreen('rate_info');
    } else if (buttonId === 'pull_history') {
      setShowHistoryModal(true);
      setCurrentScreen('pull_history');
    } else if (buttonId === 'custom') {
      setShowEditorModal(true);
    }
  };

  // User In-Game Chat Submission (Endpoint ④)
  const handleSendUserChatMessage = async (customText?: string) => {
    const text = (customText || inGameChatInput).trim();
    if (!text) return;

    setInGameChatInput('');
    setInGameChatLogs((prev) => [...prev, { sender: 'user', text, time: Date.now() }]);

    // If agent was waiting for user reply during card flipping, unlock it!
    if (waitingUserReplyResolverRef.current) {
      waitingUserReplyResolverRef.current();
      waitingUserReplyResolverRef.current = null;
      setIsWaitingUserReply(false);
    }

    // If we were on result done or modal screen and user commands a pull, close modals
    if (showDetailModal) setShowDetailModal(false);
    if (showRateModal) setShowRateModal(false);
    if (showHistoryModal) setShowHistoryModal(false);

    // Call Endpoint ④ (Async user message & intent decision)
    const progressSummary = `已累计抽 ${totalPulls} 发，已出SSR: ${ssrObtainedList.join('、') || '暂无'}，当前井进度 ${sparkCount}/${poolConfig.spark_count}`;
    const llmConfig = loadLlmConfig();

    try {
      setIsAgentThinking(true);
      const resp = await generateGachaUserResponse(llmConfig, fallbackCharacter, progressSummary, text, poolConfig);
      setIsAgentThinking(false);

      if (resp.bubble_self) {
        showBubble(resp.bubble_self, 'bubble_self', 3000);
      }
      if (resp.response_bubble) {
        showBubble(resp.response_bubble, 'bubble_to_user', 4000);
      }

      const rhythm = parseClickRhythm(resp.click_rhythm || '稳健从容');
      const hesitation = resp.hesitation_ms || 600;

      if (resp.action === 'pull_ten') {
        const btn = poolConfig.buttons.find((b) => b.id === 'pull_ten');
        const targetX = btn ? btn.position.x : 75;
        const targetY = btn ? btn.position.y : 86;
        moveCursorTo(targetX, targetY, rhythm.moveDurationSec);
        await new Promise((r) => setTimeout(r, rhythm.moveDurationSec * 1000 + hesitation));
        await triggerCursorClick();
        await executePullFlow(10);
      } else if (resp.action === 'pull_once') {
        const btn = poolConfig.buttons.find((b) => b.id === 'pull_once');
        const targetX = btn ? btn.position.x : 25;
        const targetY = btn ? btn.position.y : 86;
        moveCursorTo(targetX, targetY, rhythm.moveDurationSec);
        await new Promise((r) => setTimeout(r, rhythm.moveDurationSec * 1000 + hesitation));
        await triggerCursorClick();
        await executePullFlow(1);
      } else if (resp.action === 'pool_detail') {
        const btn = poolConfig.buttons.find((b) => b.id === 'pool_detail');
        const targetX = btn ? btn.position.x : 20;
        const targetY = btn ? btn.position.y : 15;
        moveCursorTo(targetX, targetY, rhythm.moveDurationSec);
        await new Promise((r) => setTimeout(r, rhythm.moveDurationSec * 1000 + hesitation));
        await triggerCursorClick();
        setShowDetailModal(true);
        setCurrentScreen('pool_detail');
      } else if (resp.action === 'rate_info') {
        const btn = poolConfig.buttons.find((b) => b.id === 'rate_info');
        const targetX = btn ? btn.position.x : 50;
        const targetY = btn ? btn.position.y : 15;
        moveCursorTo(targetX, targetY, rhythm.moveDurationSec);
        await new Promise((r) => setTimeout(r, rhythm.moveDurationSec * 1000 + hesitation));
        await triggerCursorClick();
        setShowRateModal(true);
        setCurrentScreen('rate_info');
      } else if (resp.action === 'pull_history') {
        const btn = poolConfig.buttons.find((b) => b.id === 'pull_history');
        const targetX = btn ? btn.position.x : 80;
        const targetY = btn ? btn.position.y : 15;
        moveCursorTo(targetX, targetY, rhythm.moveDurationSec);
        await new Promise((r) => setTimeout(r, rhythm.moveDurationSec * 1000 + hesitation));
        await triggerCursorClick();
        setShowHistoryModal(true);
        setCurrentScreen('pull_history');
      } else if (resp.action === 'stop') {
        setTimeout(() => handleEndGachaSession(), 1500);
      }
    } catch (err) {
      console.warn('User chat response failed:', err);
      setIsAgentThinking(false);
    }
  };

  // Endpoint ⑤: Session Finish & Emotion Settlement
  const handleEndGachaSession = async () => {
    setIsAgentThinking(true);
    const llmConfig = loadLlmConfig();

    try {
      const ending = await generateGachaEnding(llmConfig, fallbackCharacter, {
        totalPulls,
        userInstruction,
        goalAchieved: ssrObtainedList.length > 0 || (sparkCount === 0 && totalPulls >= poolConfig.spark_count),
        ssrList: ssrObtainedList,
        sparkUsed: sparkCount === 0 && totalPulls >= poolConfig.spark_count,
      });

      setEndingSummaryText(ending.ending_bubble);
      if (ending.gameTotalDelta) {
        setGameTotalDelta(ending.gameTotalDelta);
      }
    } catch (e) {
      setEndingSummaryText(`总共抽了 ${totalPulls} 发，收获满满！感谢你的陪伴～`);
    }

    setIsAgentThinking(false);
    setShowSettlementModal(true);
  };

  // Apply Emotion Delta to World
  const handleApplyEmotion = () => {
    const rawRecord: DBGameMatchRecord = {
      id: `gacha_${Date.now()}`,
      gameType: 'ai_gacha' as any,
      characterId: currentCharacterId,
      characterName: fallbackCharacter.name,
      winner: ssrObtainedList.length > 0 ? 'player' : 'character',
      totalMoves: totalPulls,
      totalRounds: totalPulls,
      summary: endingSummaryText || `与${fallbackCharacter.name}共同进行了${totalPulls}发抽卡共鸣。`,
      timestamp: Date.now(),
      gameTotalDelta: gameTotalDelta as Record<string, number>,
      emotionApplied: true,
      chats: inGameChatLogs.map((c) => ({
        id: `chat_${c.time}`,
        sender: c.sender === 'agent' ? 'character' : 'user',
        text: c.text,
        timestamp: c.time,
      })),
    };

    idbSaveGameMatch(rawRecord);
    saveGameEmotionImpact({
      id: rawRecord.id,
      matchId: rawRecord.id,
      characterId: currentCharacterId,
      characterName: fallbackCharacter.name,
      gameType: 'ai_gacha' as any,
      timestamp: Date.now(),
      winner: rawRecord.winner,
      totalMoves: totalPulls,
      totalDelta: gameTotalDelta,
      applied: true,
      appliedTimestamp: Date.now(),
      summary: rawRecord.summary,
    });

    if (onApplyGameEmotionDelta) {
      onApplyGameEmotionDelta(gameTotalDelta, rawRecord.summary);
    }
    if (onGameFinished) {
      onGameFinished(rawRecord.summary, rawRecord, true, gameTotalDelta);
    }

    setShowSettlementModal(false);
    if (onExit) onExit();
  };

  // Ignore Emotion Delta
  const handleIgnoreEmotion = () => {
    const rawRecord: DBGameMatchRecord = {
      id: `gacha_${Date.now()}`,
      gameType: 'ai_gacha' as any,
      characterId: currentCharacterId,
      characterName: fallbackCharacter.name,
      winner: ssrObtainedList.length > 0 ? 'player' : 'character',
      totalMoves: totalPulls,
      totalRounds: totalPulls,
      summary: endingSummaryText || `与${fallbackCharacter.name}完成了抽卡体验（忽略情绪）。`,
      timestamp: Date.now(),
      gameTotalDelta: gameTotalDelta as Record<string, number>,
      emotionApplied: false,
      chats: inGameChatLogs.map((c) => ({
        id: `chat_${c.time}`,
        sender: c.sender === 'agent' ? 'character' : 'user',
        text: c.text,
        timestamp: c.time,
      })),
    };

    idbSaveGameMatch(rawRecord);

    if (onGameFinished) {
      onGameFinished(rawRecord.summary, rawRecord, false, undefined);
    }

    setShowSettlementModal(false);
    if (onExit) onExit();
  };

  // First Turn Endpoint ① on mount
  useEffect(() => {
    let isMounted = true;
    const runOpening = async () => {
      setIsAgentThinking(true);
      const llmConfig = loadLlmConfig();
      try {
        const opening = await generateGachaOpening(
          llmConfig,
          fallbackCharacter,
          poolConfig,
          userInstruction
        );

        if (!isMounted) return;
        setIsAgentThinking(false);

        // Execute first action
        await executeAgentDecisionAction(
          opening.click_target,
          '稳健从容',
          1200,
          opening.bubble_to_user,
          opening.opening_bubble
        );
      } catch (err) {
        if (!isMounted) return;
        setIsAgentThinking(false);
        showBubble(`既然你让我抽，那我今天可要大展身手了！`, 'bubble_to_user', 4000);
      }
    };

    runOpening();

    return () => {
      isMounted = false;
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    };
  }, []);

  return (
    <div className="w-full h-full flex flex-col bg-stone-950 text-white relative select-none overflow-hidden font-sans">
      
      {/* 1. TOP STATUS BAR & CONTROLS */}
      <div className="flex items-center justify-between px-3 py-2 bg-stone-950/90 border-b border-stone-800/80 shrink-0 z-30">
        <div className="flex items-center gap-2">
          {onExit && (
            <button
              onClick={handleEndGachaSession}
              className="flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300 py-1 px-2 rounded-xl bg-white/5 hover:bg-white/10 transition cursor-pointer"
            >
              <ChevronLeft className="size-4" />
              <span>退出/结算</span>
            </button>
          )}
          <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
            <Sparkles className="size-3 text-amber-400 animate-pulse" />
            <span className="text-[11px] font-bold text-amber-300">
              {fallbackCharacter.name} 正在执掌抽卡
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Spark Pity Indicator */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-black/60 border border-amber-500/30 text-[10px]">
            <span className="text-stone-400">井保底:</span>
            <span className="font-mono font-bold text-amber-400">
              {sparkCount}/{poolConfig.spark_count}
            </span>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 transition cursor-pointer"
            title={soundEnabled ? '音效开启' : '音效静音'}
          >
            {soundEnabled ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
          </button>

          {/* Rules Button */}
          <button
            onClick={() => setShowRulesModal(true)}
            className="p-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 transition cursor-pointer"
            title="查看玩法说明"
          >
            <HelpCircle className="size-3.5" />
          </button>

          {/* Visual Editor Button */}
          <button
            onClick={() => setShowEditorModal(true)}
            className="p-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition cursor-pointer"
            title="打开卡池可视化编辑器"
          >
            <Sliders className="size-3.5" />
          </button>
        </div>
      </div>

      {/* 2. MAIN GACHA CONTAINER & CANVAS (v4 Vertical Screen layout) */}
      <div className="flex-1 flex flex-col items-center justify-center p-1 sm:p-2 relative overflow-hidden bg-black/95">
        
        <div
          ref={containerRef}
          className="w-full max-w-[450px] h-[640px] sm:h-[700px] max-h-[82vh] relative overflow-hidden rounded-2xl border border-stone-800 bg-black shadow-2xl gacha-container"
          style={{ perspective: '1000px' }}
        >
          
          {/* A. Banner Background Layer */}
          <img
            src={poolConfig.banner_image}
            alt="Gacha Banner"
            className={`w-full h-full object-cover absolute inset-0 transition-transform duration-700 gacha-banner ${
              currentScreen === 'summon_anim' ? 'scale-110 filter brightness-125' : 'scale-100'
            }`}
            referrerPolicy="no-referrer"
          />

          {/* Optional Frame Overlay Layer */}
          {poolConfig.frame_overlay && (
            <img
              src={poolConfig.frame_overlay}
              alt="Gacha Frame Overlay"
              className="w-full h-full object-contain absolute inset-0 pointer-events-none z-[1] gacha-frame"
              referrerPolicy="no-referrer"
            />
          )}

          {/* Banner Gradient Scrim */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/40 pointer-events-none" />

          {/* Pool Title & Spark Reward Header */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
            <div className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/10 shadow">
              <h2 className="text-xs font-black text-amber-300 tracking-wider flex items-center gap-1.5">
                <span>✦ {poolConfig.pool_name}</span>
              </h2>
            </div>
            <div className="bg-amber-500/20 backdrop-blur-md px-2 py-0.5 rounded-xl border border-amber-400/30 text-[9.5px] text-amber-200 font-medium">
              累计共鸣: {totalPulls} 发
            </div>
          </div>

          {/* B. MAIN INTERACTIVE BUTTONS LAYER */}
          {currentScreen !== 'summon_anim' && currentScreen !== 'result_flipping' && (
            <div className="absolute inset-0 pointer-events-none z-10">
              {poolConfig.buttons.map((btn) => {
                const isTen = btn.id === 'pull_ten';
                const isOnce = btn.id === 'pull_once';
                return (
                  <div
                    key={btn.id}
                    style={{ left: `${btn.position.x}%`, top: `${btn.position.y}%` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center transition-all ${
                      isTen
                        ? 'px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-stone-950 font-black text-xs shadow-lg shadow-amber-500/30 border border-amber-300'
                        : isOnce
                        ? 'px-3.5 py-1.5 rounded-2xl bg-gradient-to-r from-stone-800 to-stone-900 text-amber-300 font-bold text-xs shadow border border-amber-500/40'
                        : 'px-2 py-1 rounded-xl bg-black/60 backdrop-blur-sm text-stone-300 font-medium text-[10px] border border-white/10 hover:border-amber-400/40'
                    }`}
                  >
                    <span>{btn.label}</span>
                    {btn.cost && (
                      <span className="text-[8px] opacity-75 font-mono">
                        {btn.cost} 抽共鸣
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* C. SUMMONING ANIMATION FULLSCREEN OVERLAY */}
          {currentScreen === 'summon_anim' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90 animate-fadeIn">
              {/* Magical Portal & Particles */}
              <div className="relative size-64 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-dashed border-amber-400/60 animate-spin" style={{ animationDuration: '6s' }} />
                <div className="absolute inset-4 rounded-full border-2 border-dotted border-purple-400/80 animate-spin" style={{ animationDuration: '4s', animationDirection: 'reverse' }} />
                <div className="absolute inset-10 rounded-full bg-gradient-to-tr from-amber-500/40 via-purple-600/40 to-pink-500/40 blur-xl animate-pulse" />
                <div className="text-4xl animate-bounce">✨</div>
              </div>

              <div className="mt-4 text-center space-y-1 z-10">
                <div className="text-sm font-bold text-amber-300 tracking-widest animate-pulse">
                  ✦ 星轨共鸣召唤中 ✦
                </div>
                <div className="text-[10px] text-stone-400">
                  {fallbackCharacter.name} 正在感知天命之牌……（光标点击任意处跳过）
                </div>
              </div>

              {/* Skip Badge Indicator */}
              <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-stone-900/80 border border-white/20 text-[10px] text-stone-300">
                <span>跳过 ⏭</span>
              </div>
            </div>
          )}

          {/* D. RESULT CARDS FLIPPING LAYER (v2 core) */}
          {(currentScreen === 'result_flipping' || currentScreen === 'result_done') && (
            <div className="absolute inset-0 z-20 bg-stone-950/95 backdrop-blur-md p-3 flex flex-col justify-between animate-fadeIn">
              
              {/* Header inside results */}
              <div className="flex items-center justify-between px-1 shrink-0 pb-1 border-b border-stone-800">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                  <Sparkles className="size-3.5" />
                  <span>共鸣结果展示 · 由 {fallbackCharacter.name} 指尖逐张翻阅</span>
                </span>
                <span className="text-[10px] text-stone-400 font-mono">
                  {currentBatchPulls.filter((p) => p.flipped).length}/{currentBatchPulls.length} 已揭开
                </span>
              </div>

              {/* Cards Grid */}
              <div className="flex-1 flex items-center justify-center py-2">
                {currentBatchPulls.length === 1 ? (
                  /* Single Card Display */
                  <div className="w-40 h-56 relative perspective-1000">
                    <div
                      className={`w-full h-full rounded-2xl transition-transform duration-700 transform-style-3d border shadow-xl ${
                        currentBatchPulls[0].flipped
                          ? 'rotate-y-180 border-amber-400/80'
                          : 'border-stone-700 bg-gradient-to-b from-stone-800 to-stone-900'
                      }`}
                      style={{
                        transform: currentBatchPulls[0].flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                        transformStyle: 'preserve-3d',
                      }}
                    >
                      {/* Back Face */}
                      <div
                        className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center p-3 bg-gradient-to-b from-stone-800 via-stone-900 to-black text-center"
                        style={{ backfaceVisibility: 'hidden' }}
                      >
                        <div className="size-14 rounded-full border-2 border-dashed border-amber-400/50 flex items-center justify-center mb-2">
                          <span className="text-xl">✦</span>
                        </div>
                        <span className="text-[11px] font-bold text-stone-400">星辉共鸣之牌</span>
                      </div>

                      {/* Front Face */}
                      <div
                        className="absolute inset-0 rounded-2xl overflow-hidden bg-black flex flex-col justify-between p-2"
                        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                      >
                        <img
                          src={currentBatchPulls[0].card.card_image}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="relative z-10 flex justify-between">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500 text-stone-950">
                            {currentBatchPulls[0].card.rarity}
                          </span>
                        </div>
                        <div className="relative z-10 bg-black/80 backdrop-blur-sm p-1.5 rounded-xl border border-white/10">
                          <div className="text-xs font-bold text-white truncate">{currentBatchPulls[0].card.name}</div>
                          <div className="text-[9px] text-stone-300 truncate">{currentBatchPulls[0].card.description}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 10 Cards Grid (2 rows of 5) */
                  <div className="grid grid-cols-5 gap-1.5 sm:gap-2 w-full max-w-sm">
                    {currentBatchPulls.map((item, idx) => {
                      const isFlipped = item.flipped;
                      const isSSR = item.card.rarity === 'SSR';
                      const isSR = item.card.rarity === 'SR';
                      const isCurrentTarget = currentFlipIdx === idx;

                      return (
                        <div
                          key={item.id}
                          className={`aspect-[3/4.2] relative rounded-xl transition-all duration-300 ${
                            isCurrentTarget ? 'scale-105 z-10' : ''
                          }`}
                          style={{ perspective: '800px' }}
                        >
                          <div
                            className={`w-full h-full rounded-xl transition-transform duration-500 shadow-md ${
                              isFlipped ? 'rotate-y-180' : ''
                            }`}
                            style={{
                              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                              transformStyle: 'preserve-3d',
                            }}
                          >
                            {/* Card Back */}
                            <div
                              className={`absolute inset-0 rounded-xl flex flex-col items-center justify-center p-1 border text-center transition-colors ${
                                isCurrentTarget
                                  ? 'border-amber-400 bg-amber-950/40 ring-1 ring-amber-400'
                                  : 'border-stone-700 bg-gradient-to-b from-stone-800 to-stone-950'
                              }`}
                              style={{ backfaceVisibility: 'hidden' }}
                            >
                              <span className="text-xs sm:text-sm">✦</span>
                              <span className="text-[7.5px] text-stone-400 font-mono scale-90">CARD</span>
                            </div>

                            {/* Card Front */}
                            <div
                              className={`absolute inset-0 rounded-xl overflow-hidden bg-black flex flex-col justify-between p-1 border ${
                                isSSR
                                  ? 'border-amber-400 ring-2 ring-amber-400/60 shadow-lg shadow-amber-500/40'
                                  : isSR
                                  ? 'border-purple-400'
                                  : 'border-blue-400/40'
                              }`}
                              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                            >
                              <img
                                src={item.card.card_image}
                                alt=""
                                className="absolute inset-0 w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                              <div className="relative z-10 flex justify-between">
                                <span
                                  className={`px-1 rounded text-[8px] font-bold ${
                                    isSSR
                                      ? 'bg-amber-400 text-stone-950 font-black'
                                      : isSR
                                      ? 'bg-purple-500 text-white'
                                      : 'bg-blue-600 text-white'
                                  }`}
                                >
                                  {item.card.rarity}
                                </span>
                              </div>
                              <div className="relative z-10 bg-black/85 backdrop-blur-sm px-1 py-0.5 rounded text-[8px] font-bold text-white truncate text-center">
                                {item.card.name.split('·')[0]}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bottom Quick Return Button */}
              {currentScreen === 'result_done' && (
                <div className="flex items-center justify-between pt-1 border-t border-stone-800 shrink-0">
                  <span className="text-[10px] text-stone-400">
                    本轮抽卡已由 Agent 翻阅完成
                  </span>
                  <button
                    onClick={() => setCurrentScreen('pool_main')}
                    className="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow transition cursor-pointer"
                  >
                    返回卡池
                  </button>
                </div>
              )}
            </div>
          )}

          {/* E. SSR FULL SCREEN FLASH OVERLAY */}
          {isSsrFlashActive && (
            <div className="absolute inset-0 z-35 bg-gradient-to-r from-amber-400/40 via-yellow-200/50 to-amber-500/40 pointer-events-none animate-ping" />
          )}

          {/* F. VIRTUAL CURSOR & FLOATING SPEECH BUBBLE LAYER */}
          <div
            className="absolute z-40 pointer-events-none"
            style={{
              left: `${cursorPos.x}%`,
              top: `${cursorPos.y}%`,
              transition: cursorTransition,
            }}
          >
            {/* Virtual Cursor Icon */}
            <div
              className={`-translate-x-1/2 -translate-y-1/2 transition-transform duration-150 ${
                isClicking ? 'scale-75' : 'scale-100 animate-bounce'
              }`}
              style={{
                animationDuration: '2.5s',
              }}
            >
              {poolConfig.cursor?.style === 'pointer' ? (
                <span className="text-2xl filter drop-shadow">👆</span>
              ) : poolConfig.cursor?.style === 'wand' ? (
                <span className="text-2xl filter drop-shadow">🪄</span>
              ) : poolConfig.cursor?.style === 'star' ? (
                <span className="text-2xl filter drop-shadow">✨</span>
              ) : poolConfig.cursor?.style === 'crosshair' ? (
                <span className="text-xl font-mono text-amber-400 filter drop-shadow">✛</span>
              ) : (
                /* Classic Pointer Cursor */
                <svg
                  width={poolConfig.cursor?.size || 24}
                  height={poolConfig.cursor?.size || 24}
                  viewBox="0 0 24 24"
                  fill={poolConfig.cursor?.color || '#F59E0B'}
                  stroke="#000"
                  strokeWidth="1.5"
                  className="filter drop-shadow-md"
                >
                  <path d="M3 3l7 18 3-7 7-3L3 3z" />
                </svg>
              )}
            </div>

            {/* Attached Speech Bubble */}
            {activeBubble && (
              <div
                className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 min-w-[140px] max-w-[220px] p-2.5 rounded-2xl text-xs shadow-2xl animate-fadeIn ${
                  activeBubble.type === 'bubble_self'
                    ? 'bg-black/75 backdrop-blur-md border border-white/20 text-stone-300 italic text-[11px]'
                    : activeBubble.type === 'bubble_evaluation'
                    ? 'bg-gradient-to-r from-amber-950 via-stone-900 to-amber-900 border border-amber-400 text-white font-medium'
                    : 'bg-stone-900/95 border border-amber-500/40 text-stone-100 font-medium'
                }`}
              >
                {/* Header label */}
                <div className="flex items-center gap-1 text-[9px] text-amber-400 font-bold mb-0.5">
                  <Sparkle className="size-2.5" />
                  <span>
                    {activeBubble.type === 'bubble_self'
                      ? `${fallbackCharacter.name} 的内心独白`
                      : `${fallbackCharacter.name} 的发言`}
                  </span>
                </div>
                
                <div className="leading-snug">{activeBubble.text}</div>

                {/* Speech Arrow for user bubbles */}
                {activeBubble.type !== 'bubble_self' && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-stone-900" />
                )}
              </div>
            )}
          </div>

          {/* G. Waiting for User Reply Badge */}
          {isWaitingUserReply && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full bg-amber-500 text-stone-950 font-bold text-xs shadow-lg animate-pulse border border-white">
              <span>等待主控发言互动中……（在下方输入框说话）</span>
            </div>
          )}

        </div>
      </div>

      {/* 3. BOTTOM LIVE CHAT & QUICK INSTRUCTIONS BAR */}
      <div className="p-2 sm:p-3 bg-stone-950/95 border-t border-stone-800 shrink-0 space-y-2 z-30">
        {/* Quick User Instruction Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
          <span className="text-[10px] text-stone-400 shrink-0">快捷指令:</span>
          {[
            '来一发十连试试运气！',
            '单抽一发试试手气',
            '先看看卡池详情再决定',
            '看一眼抽卡概率',
            '看下刚才出了什么',
            '别抽了，今天先收手',
          ].map((pill) => (
            <button
              key={pill}
              onClick={() => handleSendUserChatMessage(pill)}
              className="px-2.5 py-1 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-amber-300 border border-stone-800 text-[10.5px] whitespace-nowrap transition cursor-pointer"
            >
              {pill}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inGameChatInput}
            onChange={(e) => setInGameChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSendUserChatMessage();
            }}
            placeholder={`对 ${fallbackCharacter.name} 说点什么，如：“冲刺十连”、“先看卡池”...`}
            className="flex-1 px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-100 text-xs focus:border-amber-500 focus:outline-none placeholder:text-stone-500"
          />
          <button
            onClick={() => handleSendUserChatMessage()}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1 shadow transition cursor-pointer shrink-0"
          >
            <Send className="size-3.5" />
            <span>发送</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. MODALS (Pool Detail, Rate Info, History, Rules, Settlement, Editor) */}
      {/* ========================================================================= */}

      {/* POOL DETAIL MODAL */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-sm p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-2">
              <h3 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Info className="size-4" />
                <span>卡池详情 · {poolConfig.pool_name}</span>
              </h3>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setCurrentScreen('pool_main');
                }}
                className="text-stone-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-stone-300 max-h-[60vh] overflow-y-auto pr-1">
              <div className="p-2.5 rounded-xl bg-stone-950 border border-stone-800">
                <span className="text-[11px] font-bold text-amber-400">当期保底井机制：</span>
                <p className="text-[10px] text-stone-400 mt-1 leading-relaxed">
                  {poolConfig.spark_reward?.description || `每共鸣1次累计1点，达到 ${poolConfig.spark_count} 抽必定获得限定角色。`}
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-stone-200">收录角色图鉴：</span>
                {poolConfig.cards.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 p-2 rounded-xl bg-stone-950 border border-stone-800">
                    <img src={c.card_image} alt="" className="size-10 rounded-lg object-cover bg-black" referrerPolicy="no-referrer" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-white text-xs">{c.name}</span>
                        <span className={`text-[8px] font-mono px-1 py-0.2 rounded font-bold ${
                          c.rarity === 'SSR' ? 'bg-amber-400 text-stone-950' : c.rarity === 'SR' ? 'bg-purple-500 text-white' : 'bg-blue-600 text-white'
                        }`}>{c.rarity}</span>
                      </div>
                      <p className="text-[10px] text-stone-400 truncate">{c.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RATE INFO MODAL */}
      {showRateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-xs p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-2">
              <h3 className="text-xs font-bold text-amber-300">共鸣概率说明</h3>
              <button
                onClick={() => {
                  setShowRateModal(false);
                  setCurrentScreen('pool_main');
                }}
                className="text-stone-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs text-stone-300">
              <div className="flex items-center justify-between p-2 rounded-lg bg-stone-950 border border-stone-800">
                <span className="text-amber-400 font-bold">SSR 出现概率</span>
                <span className="font-mono font-bold">{(poolConfig.rates.SSR * 100).toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-stone-950 border border-stone-800">
                <span className="text-purple-400 font-bold">SR 出现概率</span>
                <span className="font-mono font-bold">{(poolConfig.rates.SR * 100).toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-stone-950 border border-stone-800">
                <span className="text-blue-400 font-bold">R 出现概率</span>
                <span className="font-mono font-bold">{(poolConfig.rates.R * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PULL HISTORY MODAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-sm p-4 space-y-3 shadow-2xl flex flex-col max-h-[75vh]">
            <div className="flex items-center justify-between border-b border-stone-800 pb-2">
              <h3 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <History className="size-4" />
                <span>本次抽卡战绩日志 ({pullHistory.length} 发)</span>
              </h3>
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setCurrentScreen('pool_main');
                }}
                className="text-stone-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {pullHistory.length === 0 ? (
                <div className="text-center text-xs text-stone-500 py-8">暂无抽卡记录</div>
              ) : (
                pullHistory.map((item, i) => (
                  <div key={item.id} className="flex items-center justify-between p-2 rounded-xl bg-stone-950 border border-stone-800 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-stone-500">#{item.pull_number}</span>
                      <span className="font-bold text-white">{item.card.name}</span>
                    </div>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                      item.card.rarity === 'SSR' ? 'bg-amber-400 text-stone-950' : item.card.rarity === 'SR' ? 'bg-purple-500 text-white' : 'bg-blue-600 text-white'
                    }`}>
                      {item.card.rarity} {item.is_spark ? '· 井' : ''}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* RULES MODAL */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-sm p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-2">
              <h3 className="text-xs font-bold text-stone-100 flex items-center gap-1.5">
                <HelpCircle className="size-4 text-amber-400" />
                <span>AI 抽卡模拟器（v2）体验规则</span>
              </h3>
              <button onClick={() => setShowRulesModal(false)} className="text-stone-400 hover:text-white p-1">
                <X className="size-4" />
              </button>
            </div>
            <div className="text-xs text-stone-300 space-y-2 leading-relaxed max-h-[60vh] overflow-y-auto">
              <p>• <strong>看 AI 帮你抽卡</strong>：Agent 使用虚拟光标像真人一样移动、犹豫、点击抽卡按钮与卡池详情。</p>
              <p>• <strong>真人化光标逐张翻卡 (v2)</strong>：翻卡不再是死板的动画播放，而是 Agent 用虚拟光标逐张点击卡牌翻面，节奏、犹豫与乱点均由性格画像驱动。</p>
              <p>• <strong>异步局内互动</strong>：主控可随时在底部输入框与 Agent 交流，引导抽卡冲刺或喊停。</p>
              <p>• <strong>情绪隔离结算</strong>：抽卡情绪仅在结束时由你确认是否写入主世界。</p>
            </div>
            <button
              onClick={() => setShowRulesModal(false)}
              className="w-full py-2 rounded-xl bg-amber-500 text-stone-950 font-bold text-xs mt-2"
            >
              我知道了
            </button>
          </div>
        </div>
      )}

      {/* VISUAL EDITOR MODAL */}
      {showEditorModal && (
        <GachaEditor
          initialConfig={poolConfig}
          onSave={(newCfg) => setPoolConfig(newCfg)}
          onClose={() => setShowEditorModal(false)}
        />
      )}

      {/* EMOTION SETTLEMENT MODAL (Section X) */}
      {showSettlementModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-sm p-4 space-y-3.5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-2">
              <h3 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <CheckCircle2 className="size-4" />
                <span>本次抽卡情绪结算</span>
              </h3>
            </div>

            <div className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-300 leading-relaxed italic">
              “{endingSummaryText || '抽卡体验圆满结束啦！'}”
            </div>

            {/* Emotion Delta Grid */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-stone-400">
                六维情绪影响结算（局内累计）
              </div>
              <div className="grid grid-cols-3 gap-1.5 bg-stone-950 p-2 rounded-xl border border-stone-800">
                {(['joy', 'warmth', 'sadness', 'anger', 'fear', 'desire'] as EmotionKey[]).map((key) => {
                  const val = gameTotalDelta[key] || 0;
                  const isPos = val > 0;
                  const isNeg = val < 0;
                  return (
                    <div key={key} className="flex items-center justify-between px-2 py-1 rounded bg-stone-900 text-[10.5px]">
                      <span className="text-stone-400">{EMOTION_NAMES[key]}</span>
                      <span className={`font-mono font-bold ${isPos ? 'text-emerald-400' : isNeg ? 'text-rose-400' : 'text-stone-500'}`}>
                        {isPos ? `+${Math.round(val * 100)}%` : isNeg ? `${Math.round(val * 100)}%` : '0'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleApplyEmotion}
                className="flex-1 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold transition shadow cursor-pointer"
              >
                应用情绪至主世界
              </button>
              <button
                onClick={handleIgnoreEmotion}
                className="flex-1 py-2.5 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs transition cursor-pointer"
              >
                忽略结算
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
