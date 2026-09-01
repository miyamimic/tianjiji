import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  ChevronLeft,
  Settings2,
  Sliders,
  Send,
  HelpCircle,
  History,
  RotateCcw,
  Square,
  Play,
  Flame,
  Award,
  Star,
  CheckCircle2,
  X,
  Smile
} from 'lucide-react';
import type {
  GachaPoolConfig,
  VirtualCursorState,
  GachaBubbleState,
  PulledCardInstance,
  GachaHistoryRecord,
  ClickHabitProfile,
  LlmActionType
} from '../../lib/gachaTypes';
import {
  loadGachaPoolConfig,
  saveGachaPoolConfig,
  executeGachaPull,
  parseClickRhythmMs,
  loadGachaHistory,
  appendGachaHistory,
  clearGachaHistory,
  getDefaultClickHabitProfile,
  validateAndSanitizeClickTarget
} from '../../lib/gachaEngine';
import {
  callGachaLlm1_Enter,
  callGachaLlm2_Decision,
  callGachaLlm3_ResultEval,
  callGachaLlm4_UserMessage,
  callGachaLlm5_Ending
} from '../../lib/gachaLlm';
import { loadLlmConfig, isLlmConfigured } from '../../lib/llm';
import { GachaVirtualCursor } from './gacha/GachaVirtualCursor';
import { GachaAnimationStage } from './gacha/GachaAnimationStage';
import { GachaCardRevealStage } from './gacha/GachaCardRevealStage';
import { GachaPoolEditorModal } from './gacha/GachaPoolEditorModal';
import { GachaDetailsModal, GachaHistoryModal } from './gacha/GachaHistoryDetailsModal';
import { idbSaveGameMatch, type DBGameMatchRecord } from '../../lib/idb';
import { saveGameEmotionImpact } from '../../lib/gameStore';
import { getCharacterById, MOCK_CHARACTERS } from '../../data/characters';
import type { Character, EmotionVector } from '../../data/types';

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
  onExit?: () => void;
}

export const GachaApp: React.FC<Props> = ({
  currentCharacterId,
  characterName,
  character: propChar,
  currentEmotionSnapshot,
  onGameFinished,
  onApplyGameEmotionDelta,
  onExit,
}) => {
  // Character object
  const activeChar = getCharacterById(currentCharacterId) || propChar || MOCK_CHARACTERS[0];
  const llmConfig = loadLlmConfig();

  // 1. Pool & Engine States
  const [poolConfig, setPoolConfig] = useState<GachaPoolConfig>(() => loadGachaPoolConfig());
  const [currentSparkCount, setCurrentSparkCount] = useState<number>(0);
  const [totalPulls, setTotalPulls] = useState<number>(0);
  const [pulledSsrList, setPulledSsrList] = useState<string[]>([]);
  const [historyRecords, setHistoryRecords] = useState<GachaHistoryRecord[]>(() => loadGachaHistory());

  // 2. Flow & Screen States
  const [currentScreen, setCurrentScreen] = useState<'main' | 'details' | 'history'>('main');
  const [isPullingAnimation, setIsPullingAnimation] = useState<boolean>(false);
  const [isCardRevealStage, setIsCardRevealStage] = useState<boolean>(false);
  const [currentPullBatch, setCurrentPullBatch] = useState<PulledCardInstance[]>([]);
  const [allCardsFlipped, setAllCardsFlipped] = useState<boolean>(false);
  const [isLlmReadyForReveal, setIsLlmReadyForReveal] = useState<boolean>(false);
  const [hasSsrInCurrentBatch, setHasSsrInCurrentBatch] = useState<boolean>(false);

  // 3. User Commands & Goals
  const [userGoal, setUserGoal] = useState<string>('');
  const [chatInputText, setChatInputText] = useState<string>('');
  const [isLlmThinking, setIsLlmThinking] = useState<boolean>(false);
  const [isAutoLoopRunning, setIsAutoLoopRunning] = useState<boolean>(false);

  // 4. Cursor & Bubble States
  const [cursorState, setCursorState] = useState<VirtualCursorState>({
    x: 0.5,
    y: 0.5,
    isHovering: false,
    isClicking: false,
    activeBubble: null,
  });

  // 5. LLM Call ③ Cached Result
  const pendingEvalResultRef = useRef<{
    habit: ClickHabitProfile;
    evaluations: Array<{ card_index: number; text: string }>;
    summary: string;
  } | null>(null);

  // Action Footprint history
  const historyActionSummaryRef = useRef<string[]>([]);

  // 6. Modals
  const [showEditorModal, setShowEditorModal] = useState<boolean>(false);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showSettlementModal, setShowSettlementModal] = useState<boolean>(false);

  // 7. Settlement & Emotion
  const [endingSummary, setEndingSummary] = useState<string>('');
  const [gameTotalDelta, setGameTotalDelta] = useState<{ joy?: number; excitement?: number; disappointment?: number }>({});
  const [matchId] = useState<string>(() => `gacha_match_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);

  // Bubble dismiss timer
  const bubbleTimerRef = useRef<any>(null);

  const displayBubble = useCallback(
    (type: 'bubble_to_user' | 'bubble_self' | 'bubble_evaluation', text: string, durationMs = 5000) => {
      if (!text) return;
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
      const newBubble: GachaBubbleState = {
        id: `bubble_${Date.now()}`,
        type,
        text,
        createdAt: Date.now(),
        durationMs,
      };
      setCursorState((prev) => ({ ...prev, activeBubble: newBubble }));
      bubbleTimerRef.current = setTimeout(() => {
        setCursorState((prev) => ({ ...prev, activeBubble: null }));
      }, durationMs);
    },
    []
  );

  // -------------------------------------------------------------
  // Step Execution: Move & Click Cursor on Target
  // -------------------------------------------------------------
  const moveCursorTo = useCallback((targetX: number, targetY: number, hesitationMs = 600) => {
    return new Promise<void>((resolve) => {
      setCursorState((prev) => ({
        ...prev,
        x: targetX,
        y: targetY,
        isHovering: true,
      }));
      setTimeout(() => {
        resolve();
      }, hesitationMs);
    });
  }, []);

  const triggerCursorClick = useCallback(() => {
    return new Promise<void>((resolve) => {
      setCursorState((prev) => ({ ...prev, isClicking: true }));
      setTimeout(() => {
        setCursorState((prev) => ({ ...prev, isClicking: false }));
        resolve();
      }, 200);
    });
  }, []);

  // -------------------------------------------------------------
  // Initial Enter Hook (LLM Call ①)
  // -------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;
    async function initEnter() {
      setIsLlmThinking(true);
      try {
        const out = await callGachaLlm1_Enter(llmConfig, activeChar, poolConfig, userGoal);
        if (!isMounted) return;

        // Determine target position
        let targetX = 0.5;
        let targetY = 0.5;
        const clickTgt = out.click_target;
        if (clickTgt.type === 'button') {
          const btn = poolConfig.buttons.find((b) => b.id === clickTgt.button_id);
          if (btn) {
            targetX = btn.position.x;
            targetY = btn.position.y;
          }
        } else if (clickTgt.type === 'blank') {
          targetX = clickTgt.position.x;
          targetY = clickTgt.position.y;
        }


        await moveCursorTo(targetX, targetY, 800);
        if (out.first_action === 'click') {
          await triggerCursorClick();
        }

        if (out.bubble_to_user) {
          displayBubble('bubble_to_user', out.bubble_to_user, 6000);
        } else if (out.opening_bubble) {
          displayBubble('bubble_self', out.opening_bubble, 5000);
        }
      } catch (err) {
        console.warn('[GachaApp] Enter LLM failed:', err);
      } finally {
        if (isMounted) setIsLlmThinking(false);
      }
    }

    initEnter();
    return () => {
      isMounted = false;
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    };
  }, []);

  // -------------------------------------------------------------
  // Gacha Pull & Reveal Logic (Triggered by Button Click)
  // -------------------------------------------------------------
  const handleExecutePull = async (pullCount: number) => {
    // 1. JS Probability Engine
    const result = executeGachaPull(poolConfig, pullCount, currentSparkCount);
    setCurrentSparkCount(result.newSparkCount);
    setTotalPulls((prev) => prev + pullCount);
    setCurrentPullBatch(result.pulledCards);
    setAllCardsFlipped(false);
    setIsLlmReadyForReveal(false);
    setHasSsrInCurrentBatch(result.totalSsrCountInPull > 0);

    const newlyPulledSsrs = result.pulledCards
      .filter((c) => c.card.rarity === 'SSR')
      .map((c) => c.card.name);
    if (newlyPulledSsrs.length > 0) {
      setPulledSsrList((prev) => [...prev, ...newlyPulledSsrs]);
    }

    // Record history
    const historyItem: GachaHistoryRecord = {
      id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      pullCount,
      cards: result.pulledCards.map((c) => c.card),
      sparkCountAtPull: result.newSparkCount,
    };
    appendGachaHistory(historyItem);
    setHistoryRecords((prev) => [historyItem, ...prev]);

    // 2. Start Fullscreen Animation
    setIsPullingAnimation(true);
    setIsCardRevealStage(false);

    // 3. Simultaneously Call LLM ③ for original evaluation & click habit
    pendingEvalResultRef.current = null;
    callGachaLlm3_ResultEval(
      llmConfig,
      activeChar,
      poolConfig,
      result.pulledCards,
      totalPulls + pullCount,
      result.newSparkCount,
      result.isSparkTriggered
    ).then((llmRes) => {
      pendingEvalResultRef.current = {
        habit: llmRes.click_habit_profile,
        evaluations: llmRes.evaluations,
        summary: llmRes.summary_bubble,
      };
      setIsLlmReadyForReveal(true);
    });
  };

  // Skip animation and start card flipping sequence
  const handleAnimationEnd = async () => {
    setIsPullingAnimation(false);
    setIsCardRevealStage(true);

    const evalData = pendingEvalResultRef.current;
    const habit = evalData?.habit || getDefaultClickHabitProfile();
    const evals = evalData?.evaluations || [];

    // Drive virtual cursor to click skip position first if not skipped yet
    await moveCursorTo(habit.skip_click_position.x, habit.skip_click_position.y, 400);
    await triggerCursorClick();

    // Now drive virtual cursor to flip each card one by one!
    const rhythmMs = parseClickRhythmMs(habit.click_rhythm);
    const cardCount = currentPullBatch.length;

    for (let i = 0; i < cardCount; i++) {
      // Calculate approximate position of card on screen
      const isTenPull = cardCount > 1;
      const col = isTenPull ? i % 5 : 0;
      const row = isTenPull ? Math.floor(i / 5) : 0;
      const targetCardX = isTenPull ? 0.12 + col * 0.19 : 0.5;
      const targetCardY = isTenPull ? 0.35 + row * 0.28 : 0.45;

      await moveCursorTo(targetCardX, targetCardY, Math.min(600, rhythmMs));
      await triggerCursorClick();

      // Flip card i
      setCurrentPullBatch((prev) =>
        prev.map((c, idx) => (idx === i ? { ...c, isFlipped: true } : c))
      );

      // Show evaluation bubble for card i if evaluation_timing is 'on_flip'
      if (habit.evaluation_timing === 'on_flip') {
        const evalItem = evals.find((e) => e.card_index === i);
        if (evalItem && evalItem.text) {
          displayBubble('bubble_evaluation', evalItem.text, rhythmMs + 1800);
        }
      }

      await new Promise((res) => setTimeout(res, rhythmMs));
    }

    setAllCardsFlipped(true);

    // If summary exists, display summary bubble
    if (evalData?.summary) {
      setTimeout(() => {
        displayBubble('bubble_self', evalData.summary, 5000);
      }, 600);
    }
  };

  // Flip a single card on manual user click
  const handleManualCardClick = (index: number) => {
    setCurrentPullBatch((prev) =>
      prev.map((c, idx) => (idx === index ? { ...c, isFlipped: true } : c))
    );
    const evals = pendingEvalResultRef.current?.evaluations || [];
    const found = evals.find((e) => e.card_index === index);
    if (found?.text) {
      displayBubble('bubble_evaluation', found.text, 3500);
    }
  };

  // Finish reveal stage and return to main screen (or proceed in loop)
  const handleFinishReveal = () => {
    // If not all flipped, flip all
    setCurrentPullBatch((prev) => prev.map((c) => ({ ...c, isFlipped: true })));
    setAllCardsFlipped(true);
    setIsCardRevealStage(false);

    // If auto-loop is on or active, schedule next decision step
    if (isAutoLoopRunning) {
      setTimeout(() => {
        executeNextDecisionStep();
      }, 1000);
    }
  };

  // -------------------------------------------------------------
  // Decision Cycle (LLM Call ②) - Every single step is decided by LLM
  // -------------------------------------------------------------
  const executeNextDecisionStep = async () => {
    if (isLlmThinking || isPullingAnimation || isCardRevealStage) return;

    setIsLlmThinking(true);
    try {
      const decision = await callGachaLlm2_Decision(llmConfig, activeChar, poolConfig, {
        currentScreen,
        cursorPos: { x: cursorState.x, y: cursorState.y },
        totalPulls,
        currentSparkCount,
        pulledSsrList,
        userGoal,
        latestUserMsg: chatInputText,
        historyActionSummary: historyActionSummaryRef.current,
      });

      // Track action
      const targetSummary = decision.click_target.type === 'button' ? decision.click_target.button_id : 'blank';
      historyActionSummaryRef.current.push(`${decision.action} (${targetSummary})`);

      // 1. Move cursor to target
      let targetX = cursorState.x;
      let targetY = cursorState.y;
      let matchedBtn: any = null;

      const decTgt = decision.click_target;
      if (decTgt.type === 'button') {
        matchedBtn = poolConfig.buttons.find((b) => b.id === decTgt.button_id);
        if (matchedBtn) {
          targetX = matchedBtn.position.x;
          targetY = matchedBtn.position.y;
        }
      } else if (decTgt.type === 'blank') {
        targetX = decTgt.position.x;
        targetY = decTgt.position.y;
      }


      await moveCursorTo(targetX, targetY, decision.hesitation_ms || 800);

      // 2. Speak bubbles
      if (decision.bubble_to_user) {
        displayBubble('bubble_to_user', decision.bubble_to_user, 5000);
      } else if (decision.bubble_self) {
        displayBubble('bubble_self', decision.bubble_self, 4500);
      }

      // 3. Execute action
      if (decision.action === 'click') {
        await triggerCursorClick();

        if (matchedBtn) {
          if (matchedBtn.type === 'details') {
            setShowDetailsModal(true);
          } else if (matchedBtn.type === 'history') {
            setShowHistoryModal(true);
          } else if (matchedBtn.type === 'pull_single' || matchedBtn.type === 'pull_ten' || matchedBtn.pullCount) {
            const count = matchedBtn.pullCount || (matchedBtn.type === 'pull_ten' ? 10 : 1);
            await handleExecutePull(count);
          }
        }
      } else if (decision.action === 'stop') {
        setIsAutoLoopRunning(false);
        handleTriggerEnding();
      }
    } catch (err) {
      console.warn('[GachaApp] Decision LLM execution failed:', err);
    } finally {
      setIsLlmThinking(false);
    }
  };

  // -------------------------------------------------------------
  // User Real-time Message Input (LLM Call ④)
  // -------------------------------------------------------------
  const handleSendUserMessage = async (customText?: string) => {
    const textToSend = (customText || chatInputText).trim();
    if (!textToSend) return;
    setChatInputText('');

    // If text looks like a goal (e.g. "抽80发"), record as userGoal
    if (textToSend.includes('抽') || textToSend.includes('发') || textToSend.includes('金')) {
      setUserGoal(textToSend);
    }

    setIsLlmThinking(true);
    try {
      const summary = `已抽 ${totalPulls} 发，已出 SSR: ${pulledSsrList.length} 张，当前井计数: ${currentSparkCount}/${poolConfig.spark_count}`;
      const out = await callGachaLlm4_UserMessage(llmConfig, activeChar, poolConfig, textToSend, summary);

      if (out.response_bubble) {
        displayBubble('bubble_to_user', out.response_bubble, 5500);
      }

      if (out.action === 'stop') {
        setIsAutoLoopRunning(false);
        handleTriggerEnding();
      } else if (out.action === 'continue') {
        setIsAutoLoopRunning(true);
        setTimeout(() => {
          executeNextDecisionStep();
        }, 1200);
      }
    } catch (err) {
      console.warn('[GachaApp] User msg handling failed:', err);
    } finally {
      setIsLlmThinking(false);
    }
  };

  // -------------------------------------------------------------
  // Ending & Emotion Settlement (LLM Call ⑤)
  // -------------------------------------------------------------
  const handleTriggerEnding = async () => {
    setIsLlmThinking(true);
    try {
      const out = await callGachaLlm5_Ending(
        llmConfig,
        activeChar,
        poolConfig,
        totalPulls,
        userGoal,
        pulledSsrList,
        currentSparkCount === 0 && totalPulls >= poolConfig.spark_count
      );

      setEndingSummary(out.ending_bubble);
      setGameTotalDelta(out.gameTotalDelta || {});
      setShowSettlementModal(true);
    } catch (err) {
      console.warn('[GachaApp] Ending LLM failed:', err);
      setShowSettlementModal(true);
    } finally {
      setIsLlmThinking(false);
    }
  };

  const handleApplyEmotion = () => {
    // Construct DB record
    const matchRecord: DBGameMatchRecord = {
      id: matchId,
      gameType: 'gomoku', // generic compatibility
      characterId: currentCharacterId,
      characterName,
      winner: pulledSsrList.length > 0 ? 'player' : 'character',
      totalMoves: totalPulls,
      chats: [
        {
          id: `chat_${Date.now()}`,
          sender: 'character',
          text: endingSummary || `本次共祈愿 ${totalPulls} 发，收获 ${pulledSsrList.length} 张 SSR。`,
          timestamp: Date.now(),
        },
      ],
      summary: `与 ${characterName} 进行了抽卡祈愿模拟，共抽卡 ${totalPulls} 次，获得 SSR: [${pulledSsrList.join('、') || '无'}]。`,
      timestamp: Date.now(),
      gameTotalDelta: gameTotalDelta as Record<string, number>,
      emotionApplied: true,
    };

    idbSaveGameMatch(matchRecord);

    const deltaVector: Partial<EmotionVector> = {
      joy: (gameTotalDelta.joy || 0) * 0.15,
      warmth: (gameTotalDelta.excitement || 0) * 0.1,
      sadness: (gameTotalDelta.disappointment || 0) * -0.05,
    };

    if (onApplyGameEmotionDelta) {
      onApplyGameEmotionDelta(deltaVector, matchRecord.summary);
    }
    if (onGameFinished) {
      onGameFinished(matchRecord.summary, matchRecord, true, deltaVector);
    }

    setShowSettlementModal(false);
    if (onExit) onExit();
  };

  const handleIgnoreEmotion = () => {
    const matchRecord: DBGameMatchRecord = {
      id: matchId,
      characterId: currentCharacterId,
      characterName,
      winner: 'draw',
      totalMoves: totalPulls,
      chats: [],
      summary: `与 ${characterName} 进行了抽卡模拟（已忽略情绪影响）。`,
      timestamp: Date.now(),
      emotionApplied: false,
    };
    idbSaveGameMatch(matchRecord);

    setShowSettlementModal(false);
    if (onExit) onExit();
  };

  return (
    <div className="w-full h-full flex flex-col bg-stone-950 text-white select-none relative overflow-hidden">
      {/* ---------------- TOP NAV BAR ---------------- */}
      <div className="flex items-center justify-between px-3 py-2 bg-black/60 border-b border-white/10 shrink-0 z-30">
        <div className="flex items-center gap-2">
          {onExit && (
            <button
              onClick={() => {
                if (totalPulls > 0) {
                  handleTriggerEnding();
                } else {
                  onExit();
                }
              }}
              className="flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300 py-1 px-2 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>返回大厅</span>
            </button>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-white tracking-wide truncate max-w-[140px] sm:max-w-[200px]">
              {poolConfig.pool_name}
            </span>
          </div>
        </div>

        {/* Top Control Chips */}
        <div className="flex items-center gap-1.5">
          {/* Spark Counter Badge */}
          <div className="px-2 py-1 rounded-xl bg-amber-500/15 border border-amber-400/30 text-[10px] font-mono text-amber-300 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>
              井 {currentSparkCount}/{poolConfig.spark_count}
            </span>
          </div>

          {/* Visual Editor Button */}
          <button
            onClick={() => setShowEditorModal(true)}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-stone-300 hover:text-white border border-white/10 transition cursor-pointer"
            title="打开卡池与光标可视化编辑器"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ---------------- MAIN GACHA CONTAINER (Strict CSS Specification) ---------------- */}
      <div className="flex-1 flex items-center justify-center p-2 min-h-0 relative">
        <div className="gacha-container relative rounded-2xl border border-white/15 shadow-2xl overflow-hidden flex flex-col justify-between">
          
          {/* 1. Pool Banner Background */}
          <img
            src={poolConfig.banner_image}
            alt={poolConfig.pool_name}
            className="gacha-banner"
          />

          {/* 2. Frame Overlay (if configured) */}
          {poolConfig.frame_overlay && (
            <img
              src={poolConfig.frame_overlay}
              alt="frame overlay"
              className="gacha-frame"
            />
          )}

          {/* 3. Banner Gradient & Spark Bar */}
          <div className="absolute inset-x-0 top-0 p-3 bg-gradient-to-b from-black/80 via-black/30 to-transparent z-10 flex items-center justify-between pointer-events-none">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-amber-300 tracking-wider">
                ✨ 伴侣祈愿 · {activeChar.name} 掌舵
              </span>
              <p className="text-[9px] text-white/60">
                已抽 {totalPulls} 发 · 出金: {pulledSsrList.length} 张
              </p>
            </div>
            {userGoal && (
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/30 border border-purple-400/40 text-purple-200 font-mono">
                目标: {userGoal}
              </span>
            )}
          </div>

          {/* 4. Banner Interactive Buttons (Rendered at exact percentage coordinates) */}
          <div className="gacha-buttons absolute inset-0 pointer-events-auto">
            {poolConfig.buttons.map((btn) => {
              const isGold = btn.styleVariant === 'gold' || btn.type === 'pull_ten';
              const isGhost = btn.styleVariant === 'ghost' || btn.type === 'details' || btn.type === 'history';

              return (
                <div
                  key={btn.id}
                  id={btn.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform"
                  style={{
                    left: `${btn.position.x * 100}%`,
                    top: `${btn.position.y * 100}%`,
                  }}
                >
                  <button
                    onClick={() => {
                      if (btn.type === 'details') {
                        setShowDetailsModal(true);
                      } else if (btn.type === 'history') {
                        setShowHistoryModal(true);
                      } else {
                        const count = btn.pullCount || (btn.type === 'pull_ten' ? 10 : 1);
                        handleExecutePull(count);
                      }
                    }}
                    className={`px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl text-xs font-bold transition-all shadow-xl backdrop-blur-md cursor-pointer active:scale-95 flex items-center gap-1.5 whitespace-nowrap ${
                      isGold
                        ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-stone-950 hover:brightness-110 ring-2 ring-amber-300/60 shadow-amber-500/30 font-black'
                        : isGhost
                        ? 'bg-black/50 hover:bg-black/70 text-white/90 border border-white/20 hover:border-amber-400/60 text-[11px]'
                        : 'bg-stone-900/85 hover:bg-stone-800 text-amber-200 border border-amber-400/50'
                    }`}
                  >
                    {isGold && <Sparkles className="w-3.5 h-3.5 text-stone-950 animate-spin" style={{ animationDuration: '6s' }} />}
                    <span>{btn.label}</span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* 5. Fullscreen Summoning Animation Stage */}
          {isPullingAnimation && (
            <GachaAnimationStage
              isLlmReady={isLlmReadyForReveal}
              pullCount={currentPullBatch.length}
              hasSsr={hasSsrInCurrentBatch}
              skipPosition={pendingEvalResultRef.current?.habit?.skip_click_position || { x: 0.88, y: 0.08 }}
              onAnimationEnd={handleAnimationEnd}
            />
          )}

          {/* 6. Card Reveal & Flip Stage */}
          {isCardRevealStage && (
            <GachaCardRevealStage
              pulledCards={currentPullBatch}
              onCardClick={handleManualCardClick}
              onFinishReveal={handleFinishReveal}
              allFlipped={allCardsFlipped}
              summaryBubble={pendingEvalResultRef.current?.summary}
            />
          )}

          {/* 7. Virtual Cursor & Dynamic Bubble (Absolute top layer) */}
          <GachaVirtualCursor
            cursorState={cursorState}
            cursorStyle={poolConfig.cursor_style}
            characterName={activeChar.name}
          />
        </div>
      </div>

      {/* ---------------- BOTTOM USER INTERACTION & CHAT BAR ---------------- */}
      <div className="px-3 py-2 bg-stone-900/90 border-t border-white/10 shrink-0 space-y-1.5 z-30">
        {/* Quick Goal & Instruction Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          <button
            onClick={() => handleSendUserMessage('抽80发出保底！')}
            className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-[10px] text-stone-300 font-medium whitespace-nowrap cursor-pointer transition active:scale-95"
          >
            🎯 抽80发出保底
          </button>
          <button
            onClick={() => handleSendUserMessage('帮我抽个金SSR！')}
            className="px-2.5 py-1 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 text-[10px] text-amber-300 font-medium whitespace-nowrap cursor-pointer transition active:scale-95"
          >
            ✨ 帮我抽个金SSR
          </button>
          <button
            onClick={() => handleSendUserMessage('再来一次十连祈愿')}
            className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-[10px] text-stone-300 font-medium whitespace-nowrap cursor-pointer transition active:scale-95"
          >
            🎲 再来一次十连
          </button>
          <button
            onClick={() => handleSendUserMessage('今天运气真好，收手吧')}
            className="px-2.5 py-1 rounded-full bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 text-[10px] text-rose-300 font-medium whitespace-nowrap cursor-pointer transition active:scale-95"
          >
            🛑 收手结束
          </button>
        </div>

        {/* Live Chat & Command Input Bar */}
        <div className="flex items-center gap-2">
          {/* Step Trigger Button */}
          <button
            onClick={() => {
              setIsAutoLoopRunning(true);
              executeNextDecisionStep();
            }}
            disabled={isLlmThinking || isPullingAnimation || isCardRevealStage}
            className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 text-xs font-bold shadow transition flex items-center gap-1 disabled:opacity-50 cursor-pointer"
            title="让角色决定并执行下一步动作"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span className="hidden sm:inline">下一步决策</span>
          </button>

          <input
            id="gacha-user-chat-input"
            type="text"
            value={chatInputText}
            onChange={(e) => setChatInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendUserMessage()}
            placeholder={`对 ${activeChar.name} 说点什么或下达抽卡指令……`}
            className="flex-1 px-3 py-2 rounded-xl bg-stone-950 border border-white/10 text-white text-xs placeholder:text-stone-500 focus:border-amber-400 focus:outline-none"
          />

          <button
            onClick={() => handleSendUserMessage()}
            disabled={!chatInputText.trim() || isLlmThinking}
            className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 transition disabled:opacity-40 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ---------------- MODALS ---------------- */}
      {/* 1. Visual Pool Editor Modal */}
      {showEditorModal && (
        <GachaPoolEditorModal
          initialConfig={poolConfig}
          onSave={(newConf) => {
            saveGachaPoolConfig(newConf);
            setPoolConfig(newConf);
          }}
          onClose={() => setShowEditorModal(false)}
        />
      )}

      {/* 2. Details Modal */}
      {showDetailsModal && (
        <GachaDetailsModal
          poolConfig={poolConfig}
          onClose={() => setShowDetailsModal(false)}
        />
      )}

      {/* 3. History Modal */}
      {showHistoryModal && (
        <GachaHistoryModal
          historyRecords={historyRecords}
          onClearHistory={() => {
            clearGachaHistory();
            setHistoryRecords([]);
          }}
          onClose={() => setShowHistoryModal(false)}
        />
      )}

      {/* 4. Ending & Emotion Settlement Modal (Section 10 Emotion Isolation) */}
      {showSettlementModal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-white/15 rounded-2xl max-w-sm w-full p-4 shadow-2xl space-y-3.5 text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">祈愿结算与情绪回写</h3>
              </div>
              <span className="text-[10px] text-amber-300 font-mono">共 {totalPulls} 抽</span>
            </div>

            <div className="p-3 rounded-xl bg-stone-950 border border-white/10 space-y-2 text-xs">
              <p className="text-stone-300 leading-relaxed italic">
                "{endingSummary || `今天与 ${activeChar.name} 共进行了 ${totalPulls} 发祈愿。`}"
              </p>
              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-white/60">
                <span>收获 SSR: {pulledSsrList.length} 张</span>
                <span>井计数: {currentSparkCount}/{poolConfig.spark_count}</span>
              </div>
            </div>

            {/* Emotion Vector preview */}
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-400/30 text-xs space-y-1">
              <span className="text-[11px] font-bold text-amber-300">情绪共鸣波动</span>
              <p className="text-[11px] text-amber-200/80">
                喜悦: +{((gameTotalDelta.joy || 0.3) * 100).toFixed(0)}% · 兴奋: +
                {((gameTotalDelta.excitement || 0.3) * 100).toFixed(0)}%
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleApplyEmotion}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 text-xs font-bold transition shadow"
              >
                应用情绪影响
              </button>
              <button
                onClick={handleIgnoreEmotion}
                className="flex-1 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs transition"
              >
                忽略结算
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
