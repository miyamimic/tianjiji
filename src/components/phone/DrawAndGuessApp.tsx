import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Palette,
  Eraser,
  RotateCcw,
  Sparkles,
  Play,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Send,
  Volume2,
  VolumeX,
  Bot,
  User,
  HelpCircle as QuestionIcon,
  Unlock,
  MessageCircle,
  Lightbulb,
  Award,
  Zap,
  Check,
  ChevronDown,
  Home,
} from 'lucide-react';
import drawGuessBg from '../../assets/images/draw_guess_bg_1788233580724.jpg';
import {
  WORD_CATEGORIES,
  AI_ARTISTS,
  getAllPlayableArtists,
  getRandomWord,
  getRandomAiSecretWord,
  getAiArtistById,
  type AiArtistCharacter,
} from '../../data/drawAndGuessData';
import {
  getStrokeOutline,
  renderStrokeToCanvas,
  playSound,
} from '../../lib/perfectFreehandHelper';

function getAvatarDisplayEmoji(avatar?: string): string {
  if (!avatar || avatar.startsWith('data:') || avatar.startsWith('http') || avatar.startsWith('/') || avatar.length > 8) {
    return '🎨';
  }
  return avatar;
}

function CharAvatar({ avatar, name, className }: { avatar?: string; name?: string; className?: string }) {
  if (avatar && (avatar.startsWith('data:') || avatar.startsWith('http') || avatar.startsWith('/'))) {
    return (
      <img
        src={avatar}
        alt={name || '画伴'}
        referrerPolicy="no-referrer"
        className={`object-cover rounded-full ${className || 'size-6'}`}
      />
    );
  }
  return <span className={className || 'text-base'}>{avatar || '🎨'}</span>;
}
import {
  translateInstructionToPixelPoints,
  generateStrokeSemanticSummary,
  type LlmStrokeInstruction,
} from '../../lib/drawInstructionTranslator';
import {
  loadLlmConfig,
  generateDrawAndGuessTopicProposal,
  generateDrawAndGuessTopicAgreement,
  generateDrawAndGuessOpeningAndStrokes,
  generateDrawAndGuessProgressiveStrokes,
  generateDrawAndGuessCorrectEnding,
  generateDrawAndGuessRevealEnding,
  generateDrawAndGuessAiGuessReaction,
} from '../../lib/llm';
import { Character, EmotionVector } from '../../data/types';
import { loadSavedCharacters } from '../../lib/customStore';
import { recordGameEmotionImpact } from '../../lib/gameStore';

interface Props {
  currentCharacterId?: string;
  characterName?: string;
  onExit?: () => void;
}

export type GameRound = 'round_ai_draw' | 'round_player_draw';
export type GamePhase =
  | 'welcome'           // 选模式与分类引导界面
  | 'idle'
  | 'topic_negotiation' // LLM 商量出题/选题阶段
  | 'ai_generating'     // LLM 构思与生成阶段
  | 'ai_drawing'        // 画布运笔动画阶段
  | 'guessing'          // 玩家猜词阶段
  | 'roundA_success'    // 结算阶段
  | 'player_drawing'    // 玩家作画阶段
  | 'player_finished'   // 玩家画完 AI 猜词互动阶段
  | 'player_replaying'  // 重播玩家画作阶段
  | 'roundB_success';   // 玩家画 AI 猜成功结算

interface ChatMessage {
  id: string;
  sender: 'ai' | 'player';
  name: string;
  text: string;
  time: string;
  avatar?: string;
}

interface PixelStroke {
  points: [number, number][];
  color: string;
  size: number;
  isFilled?: boolean;
  duration?: number;
}

// Canvas default logical coordinate space
const CANVAS_WIDTH = 520;
const CANVAS_HEIGHT = 380;

const PALETTE_COLORS = [
  { name: '墨黑', value: '#1E293B' },
  { name: '朱砂红', value: '#EF4444' },
  { name: '珊瑚粉', value: '#F43F5E' },
  { name: '暖阳橙', value: '#F97316' },
  { name: '金黄', value: '#F59E0B' },
  { name: '青翠绿', value: '#10B981' },
  { name: '晴空蓝', value: '#0EA5E9' },
  { name: '罗兰紫', value: '#8B5CF6' },
  { name: '咖啡褐', value: '#78350F' },
];

export default function DrawAndGuessApp({
  currentCharacterId = 'char_001',
  characterName: propCharName,
  onExit,
}: Props) {
  // All playable artists (seamlessly merged custom saved characters + built-in presets)
  const [playableArtists, setPlayableArtists] = useState<AiArtistCharacter[]>(() => getAllPlayableArtists());

  // Selected AI character profile
  const [selectedCharId, setSelectedCharId] = useState<string>(() => {
    const all = getAllPlayableArtists();
    const match = all.find((a) => a.id === currentCharacterId || a.name === propCharName);
    return match ? match.id : (all[0]?.id || 'char_001');
  });

  const currentArtist = useMemo(() => {
    return getAiArtistById(selectedCharId);
  }, [selectedCharId]);

  // Active full character data for LLM persona & Emotion
  const [activeChar, setActiveChar] = useState<Character>(() => {
    const list = loadSavedCharacters();
    const found = list.find((c) => c.character_id === selectedCharId || c.name === currentArtist.name);
    if (found) return found;
    return {
      character_id: currentArtist.id,
      name: currentArtist.name,
      core: {
        values: [currentArtist.title, currentArtist.tag, currentArtist.personality],
        instinct_base: 'observe',
        speech_filter: 'casual',
      },
      emotion: {
        current: { anger: 0.1, fear: 0.1, joy: 0.6, sadness: 0.1, desire: 0.3, warmth: 0.7 },
        baseline: { anger: 0.1, fear: 0.1, joy: 0.5, sadness: 0.1, desire: 0.3, warmth: 0.6 },
        inertia: { anger: 0.5, fear: 0.5, joy: 0.5, sadness: 0.5, desire: 0.5, warmth: 0.5 },
        triggers: [],
      },
      background_threads: { active: [] },
      memory: { anchors: [] },
      action_tendency: { control_actions: [], touch_actions: [], forbidden_actions: [], control_affinity: 0.5, touch_affinity: 0.7 },
      speech: { catchphrases: [], forbidden_phrases: [] },
    };
  });

  // Sound effects toggle
  const [soundEnabled, setSoundEnabled] = useState(true);
  const triggerSound = useCallback((type: 'draw' | 'correct' | 'wrong' | 'complete' | 'click') => {
    if (soundEnabled) playSound(type);
  }, [soundEnabled]);

  // Main Mode Choice: 'round_ai_draw' (AI出题我猜) or 'round_player_draw' (我画AI猜)
  const [round, setRound] = useState<GameRound>('round_ai_draw');
  const [phase, setPhase] = useState<GamePhase>('welcome');
  const [selectedCategory, setSelectedCategory] = useState<string>('可爱动物');

  // Topic Negotiation State (AI商量出题)
  const [negotiationInput, setNegotiationInput] = useState<string>('');
  const [suggestedCategories, setSuggestedCategories] = useState<string[]>([
    '可爱动物',
    '成语典故',
    '美味食物',
    '日常物品',
    '恋爱主题',
  ]);
  const [isNegotiating, setIsNegotiating] = useState<boolean>(false);

  // AI Drawing Secret Word & Progressive Drawing State
  const [aiSecret, setAiSecret] = useState<{ word: string; category: string; hints: string[] }>(() =>
    getRandomAiSecretWord()
  );
  const [aiSecretRevealed, setAiSecretRevealed] = useState<boolean>(false);
  const [drawingRoundNumber, setDrawingRoundNumber] = useState<1 | 2 | 3>(1); // Progressive stages: 1=Skeleton, 2=Detail, 3=Polish
  const [accumulatedAiStrokes, setAccumulatedAiStrokes] = useState<PixelStroke[]>([]);
  const [guessHistory, setGuessHistory] = useState<string[]>([]);
  const [activeQuip, setActiveQuip] = useState<string | null>(null);

  // Player Drawing Topic State (Used in round_player_draw - STRICTLY HIDDEN FROM AI!)
  const [playerTopic, setPlayerTopic] = useState<{ word: string; category: string; hints: string[] }>(() =>
    getRandomWord('all')
  );
  const [playerCategory, setPlayerCategory] = useState<string>('all');
  const [customWordInput, setCustomWordInput] = useState<string>('');

  // Guessing state in AI drawing round
  const [guessInput, setGuessInput] = useState<string>('');
  const [guessFeedback, setGuessFeedback] = useState<{
    correct: boolean;
    text: string;
  } | null>(null);

  // AI Guessing in Player Drawing Round (Stage 1: Wrong -> Stage 2: Close -> Stage 3: Correct)
  const [aiGuessStage, setAiGuessStage] = useState<0 | 1 | 2 | 3>(0);
  const [aiIsThinking, setAiIsThinking] = useState<boolean>(false);
  const [playerInteractiveInput, setPlayerInteractiveInput] = useState<string>('');

  // Score state
  const [scores, setScores] = useState({ playerWins: 0, aiWins: 0 });

  // Player drawing tool state
  const [brushColor, setBrushColor] = useState<string>('#1E293B');
  const [brushSize, setBrushSize] = useState<number>(10);
  const [isEraser, setIsEraser] = useState<boolean>(false);
  const [playerStrokes, setPlayerStrokes] = useState<PixelStroke[]>([]);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const currentStrokeRef = useRef<[number, number][]>([]);
  const strokeStartTimeRef = useRef<number>(0);

  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const isPlayingRef = useRef<boolean>(false);

  // Chat conversation
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const isInitiatingProposalRef = useRef<boolean>(false);
  const hasMountedRef = useRef<boolean>(false);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isNegotiating, aiIsThinking]);

  const addChatMessage = useCallback(
    (sender: 'ai' | 'player', text: string, senderName?: string, avatar?: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      setChatMessages((prev) => {
        // Prevent consecutive identical duplicate messages
        if (prev.length > 0) {
          const last = prev[prev.length - 1];
          if (last.sender === sender && last.text.trim() === trimmed) {
            return prev;
          }
        }
        return [
          ...prev,
          {
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            sender,
            name: senderName || (sender === 'ai' ? currentArtist.name : '我'),
            avatar: avatar || (sender === 'ai' ? currentArtist.avatar : '🎨'),
            text: trimmed,
            time: timeStr,
          },
        ];
      });
    },
    [currentArtist]
  );

  // Sync activeChar & playable artists when selectedCharId changes or on reload
  useEffect(() => {
    const list = loadSavedCharacters();
    setPlayableArtists(getAllPlayableArtists());
    const found = list.find((c) => c.character_id === selectedCharId || c.name === currentArtist.name);
    if (found) {
      setActiveChar(found);
    }
  }, [selectedCharId, currentArtist]);

  // Clear Canvas to pure smooth paper white
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Paper guide subtle grid dots
    ctx.fillStyle = 'rgba(203, 213, 225, 0.35)';
    const spacing = 28;
    for (let x = 20; x < canvas.width; x += spacing) {
      for (let y = 20; y < canvas.height; y += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }, []);

  // Redraw all accumulated strokes onto canvas
  const redrawAllStrokes = useCallback((strokes: PixelStroke[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    clearCanvas();
    strokes.forEach((s) => {
      if (s.isFilled && s.points.length > 2) {
        ctx.save();
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.moveTo(s.points[0][0], s.points[0][1]);
        for (let i = 1; i < s.points.length; i++) {
          ctx.lineTo(s.points[i][0], s.points[i][1]);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        const outline = getStrokeOutline(s.points, {
          ...currentArtist.brushParams,
          size: s.size || currentArtist.brushParams.size || 10,
        });
        renderStrokeToCanvas(ctx, outline, s.color, s.color === '__ERASER__');
      }
    });
  }, [clearCanvas, currentArtist.brushParams]);

  // Stop active animation loop
  const stopAnimation = useCallback(() => {
    isPlayingRef.current = false;
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    setActiveQuip(null);
  }, []);

  // -------------------------------------------------------------
  // AI PROGRESSIVE STROKE ANIMATION PLAYER
  // Animates new incoming strokes over existing completed strokes
  // -------------------------------------------------------------
  const playStrokeBatchAnimation = useCallback(
    (
      newStrokes: PixelStroke[],
      existingStrokes: PixelStroke[],
      quips: string[] = [],
      onFinish?: () => void
    ) => {
      stopAnimation();
      if (newStrokes.length === 0) {
        redrawAllStrokes(existingStrokes);
        onFinish?.();
        return;
      }

      isPlayingRef.current = true;
      let strokeIdx = 0;
      let strokeStartTime = performance.now();
      const inProgressAccumulated = [...existingStrokes];

      if (quips.length > 0) {
        setActiveQuip(quips[0]);
      }

      const animate = (timestamp: number) => {
        if (!isPlayingRef.current) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const currentStroke = newStrokes[strokeIdx];
        const strokeDuration = currentStroke.duration || 650;
        const elapsed = timestamp - strokeStartTime;
        const progress = Math.min(1, elapsed / strokeDuration);

        // Update quip halfway through
        if (quips.length > 1 && strokeIdx >= Math.floor(newStrokes.length / 2)) {
          setActiveQuip(quips[1]);
        }

        const ptCount = Math.max(2, Math.floor(currentStroke.points.length * progress));
        const partialPoints = currentStroke.points.slice(0, ptCount);

        clearCanvas();

        // 1. Draw all completed base strokes
        inProgressAccumulated.forEach((s) => {
          if (s.isFilled && s.points.length > 2) {
            ctx.save();
            ctx.fillStyle = s.color;
            ctx.beginPath();
            ctx.moveTo(s.points[0][0], s.points[0][1]);
            for (let i = 1; i < s.points.length; i++) {
              ctx.lineTo(s.points[i][0], s.points[i][1]);
            }
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          } else {
            const outline = getStrokeOutline(s.points, {
              ...currentArtist.brushParams,
              size: s.size || currentArtist.brushParams.size || 10,
            });
            renderStrokeToCanvas(ctx, outline, s.color, false);
          }
        });

        // 2. Draw currently animating stroke
        if (partialPoints.length >= 2) {
          const currentOutline = getStrokeOutline(partialPoints, {
            ...currentArtist.brushParams,
            size: currentStroke.size || currentArtist.brushParams.size || 10,
          });
          renderStrokeToCanvas(ctx, currentOutline, currentStroke.color, false);

          // Animated brush tip indicator
          const lastPt = partialPoints[partialPoints.length - 1];
          ctx.save();
          ctx.fillStyle = currentStroke.color;
          ctx.beginPath();
          ctx.arc(lastPt[0], lastPt[1], 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
        }

        if (progress < 1) {
          animFrameIdRef.current = requestAnimationFrame(animate);
        } else {
          inProgressAccumulated.push(currentStroke);
          strokeIdx++;
          if (strokeIdx < newStrokes.length) {
            strokeStartTime = performance.now() + 80;
            animFrameIdRef.current = requestAnimationFrame(animate);
          } else {
            isPlayingRef.current = false;
            setActiveQuip(null);
            setAccumulatedAiStrokes([...inProgressAccumulated]);
            redrawAllStrokes(inProgressAccumulated);
            triggerSound('complete');
            onFinish?.();
          }
        }
      };

      animFrameIdRef.current = requestAnimationFrame(animate);
    },
    [stopAnimation, redrawAllStrokes, clearCanvas, currentArtist.brushParams, triggerSound]
  );

  // -------------------------------------------------------------
  // ① TOPIC NEGOTIATION START: AI 角色主动向玩家发起出题商量
  // -------------------------------------------------------------
  const startTopicNegotiation = useCallback(async (initialCategory?: string) => {
    if (isInitiatingProposalRef.current) return;
    isInitiatingProposalRef.current = true;
    stopAnimation();
    setRound('round_ai_draw');
    setPhase('topic_negotiation');
    setAiSecretRevealed(false);
    setDrawingRoundNumber(1);
    setAccumulatedAiStrokes([]);
    setGuessHistory([]);
    setGuessFeedback(null);
    setGuessInput('');
    setNegotiationInput('');
    clearCanvas();
    setIsNegotiating(true);
    triggerSound('click');

    const config = loadLlmConfig();
    try {
      const proposal = await generateDrawAndGuessTopicProposal(config, activeChar);
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      let textMsg = proposal.speech;
      if (initialCategory && initialCategory !== '自由出题') {
        textMsg = `“我们来挑战【${initialCategory}】分类吧！我已经想好题目了，看看你能用几笔猜出来～”`;
      }

      // Cleanly initialize the chat stream with this single opening proposal
      setChatMessages([
        {
          id: `msg_init_${Date.now()}`,
          sender: 'ai',
          name: currentArtist.name,
          avatar: currentArtist.avatar,
          text: textMsg,
          time: timeStr,
        },
      ]);

      if (proposal.suggestedCategories && proposal.suggestedCategories.length > 0) {
        setSuggestedCategories(proposal.suggestedCategories);
      }
    } finally {
      setIsNegotiating(false);
      isInitiatingProposalRef.current = false;
    }
  }, [stopAnimation, clearCanvas, triggerSound, activeChar, currentArtist]);

  // -------------------------------------------------------------
  // ② TOPIC AGREEMENT & START DRAWING: 敲定题目后落笔作画
  // -------------------------------------------------------------
  const confirmTopicAndStartDrawing = useCallback(
    async (playerMsgOrCategory: string) => {
      if (isNegotiating) return;
      setIsNegotiating(true);
      triggerSound('click');

      const userText = playerMsgOrCategory.trim() || '随心出题，直接画吧！';
      addChatMessage('player', userText);

      // Find matching category words
      let matchedCat = WORD_CATEGORIES.find(
        (c) => c.name.includes(userText) || userText.includes(c.name) || userText.includes(c.id)
      );
      if (!matchedCat) {
        matchedCat = WORD_CATEGORIES[Math.floor(Math.random() * WORD_CATEGORIES.length)];
      }

      const candidateWords = matchedCat.words.map((w) => w.text);
      const config = loadLlmConfig();

      setPhase('ai_generating');

      let chosenSecretWord = candidateWords[0];
      try {
        const agreement = await generateDrawAndGuessTopicAgreement(
          config,
          activeChar,
          userText,
          matchedCat.name,
          candidateWords
        );
        addChatMessage('ai', agreement.speech);
        chosenSecretWord = agreement.chosenWord;
      } catch (err) {
        console.warn('Agreement error:', err);
      }

      const activeSecret = {
        word: chosenSecretWord,
        category: matchedCat.name,
        hints: matchedCat.words.find((w) => w.text === chosenSecretWord)?.hints || [matchedCat.description],
      };
      setAiSecret(activeSecret);

      // Now start LLM Round 1 Drawing with the agreed secret word
      const output = await generateDrawAndGuessOpeningAndStrokes(
        config,
        activeChar,
        activeSecret.word,
        activeSecret.category,
        currentArtist.paintingPersona
      );

      // Add character's spoken opening line to chat
      addChatMessage('ai', output.speech);

      // Convert LLM 0-100 instructions to pixel points
      const pixelStrokes: PixelStroke[] = [];
      output.strokes.forEach((instr) => {
        const res = translateInstructionToPixelPoints(instr, CANVAS_WIDTH, CANVAS_HEIGHT);
        if (res) {
          pixelStrokes.push({
            points: res.points,
            color: res.color,
            size: (currentArtist.brushParams.size || 10) * res.sizeMultiplier,
            isFilled: res.isFilled,
            duration: 650,
          });
        }
      });

      setIsNegotiating(false);
      setPhase('ai_drawing');
      playStrokeBatchAnimation(pixelStrokes, [], output.drawing_quips, () => {
        setPhase('guessing');
      });
    },
    [isNegotiating, triggerSound, addChatMessage, activeChar, currentArtist, playStrokeBatchAnimation]
  );

  // -------------------------------------------------------------
  // ③ PROGRESSIVE DRAWING ROUND 2 & 3: 玩家猜错后真实追加笔画
  // -------------------------------------------------------------
  const triggerAiProgressiveDrawing = useCallback(
    async (nextRound: 2 | 3) => {
      setDrawingRoundNumber(nextRound);
      setPhase('ai_generating');

      const semanticSummary = generateStrokeSemanticSummary(accumulatedAiStrokes);
      const config = loadLlmConfig();

      const output = await generateDrawAndGuessProgressiveStrokes(
        config,
        activeChar,
        aiSecret.word,
        aiSecret.category,
        currentArtist.paintingPersona,
        nextRound,
        semanticSummary,
        guessHistory
      );

      addChatMessage('ai', output.speech);

      const newPixelStrokes: PixelStroke[] = [];
      output.strokes.forEach((instr) => {
        const res = translateInstructionToPixelPoints(instr, CANVAS_WIDTH, CANVAS_HEIGHT);
        if (res) {
          newPixelStrokes.push({
            points: res.points,
            color: res.color,
            size: (currentArtist.brushParams.size || 10) * res.sizeMultiplier,
            isFilled: res.isFilled,
            duration: 550,
          });
        }
      });

      setPhase('ai_drawing');
      playStrokeBatchAnimation(newPixelStrokes, accumulatedAiStrokes, output.drawing_quips, () => {
        setPhase('guessing');
      });
    },
    [accumulatedAiStrokes, activeChar, aiSecret, currentArtist, guessHistory, addChatMessage, playStrokeBatchAnimation]
  );

  // Handle Player Guess submission
  const handleGuessSubmit = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      const trimmed = guessInput.trim();
      if (!trimmed || phase !== 'guessing') return;

      addChatMessage('player', trimmed);
      const updatedHistory = [...guessHistory, trimmed];
      setGuessHistory(updatedHistory);
      setGuessInput('');

      // Check guess against secret word
      const isMatch =
        trimmed === aiSecret.word ||
        trimmed.includes(aiSecret.word) ||
        aiSecret.word.includes(trimmed);

      const config = loadLlmConfig();

      if (isMatch) {
        // Player guessed correctly!
        triggerSound('correct');
        setAiSecretRevealed(true);
        setGuessFeedback({
          correct: true,
          text: `🎉 完全猜对！答案正是【${aiSecret.word}】！`,
        });
        setScores((prev) => ({ ...prev, playerWins: prev.playerWins + 1 }));
        setPhase('roundA_success');

        const ending = await generateDrawAndGuessCorrectEnding(
          config,
          activeChar,
          aiSecret.word,
          drawingRoundNumber,
          updatedHistory.length
        );
        addChatMessage('ai', ending.speech);

        // Record Emotion Impact
        recordGameEmotionImpact({
          id: `dg_${Date.now()}`,
          matchId: `match_${Date.now()}`,
          characterId: activeChar.character_id,
          characterName: activeChar.name,
          gameType: 'gomoku',
          timestamp: Date.now(),
          winner: 'player',
          totalMoves: updatedHistory.length,
          totalDelta: ending.gameTotalDelta,
          applied: true,
          appliedTimestamp: Date.now(),
          summary: `【你画我猜】主控在第 ${drawingRoundNumber} 轮猜中了「${activeChar.name}」所画的秘密题目【${aiSecret.word}】。`,
        });
      } else {
        triggerSound('wrong');

        if (drawingRoundNumber < 3) {
          const nextRound = (drawingRoundNumber + 1) as 2 | 3;
          setGuessFeedback({
            correct: false,
            text: `没猜中！${activeChar.name} 正在补充第 ${nextRound} 轮细节线条...`,
          });
          triggerAiProgressiveDrawing(nextRound);
        } else {
          // 3 rounds exhausted without correct guess
          setGuessFeedback({
            correct: false,
            text: `第 3 轮机会用完啦！揭晓答案中...`,
          });
          setAiSecretRevealed(true);
          setPhase('roundA_success');

          const ending = await generateDrawAndGuessRevealEnding(config, activeChar, aiSecret.word);
          addChatMessage('ai', ending.speech);

          recordGameEmotionImpact({
            id: `dg_${Date.now()}`,
            matchId: `match_${Date.now()}`,
            characterId: activeChar.character_id,
            characterName: activeChar.name,
            timestamp: Date.now(),
            winner: 'draw',
            totalMoves: updatedHistory.length,
            totalDelta: ending.gameTotalDelta,
            applied: true,
            appliedTimestamp: Date.now(),
            summary: `【你画我猜】主控历经3轮未猜中「${activeChar.name}」的画作【${aiSecret.word}】。`,
          });
        }
      }
    },
    [
      guessInput,
      phase,
      guessHistory,
      aiSecret,
      triggerSound,
      activeChar,
      drawingRoundNumber,
      addChatMessage,
      triggerAiProgressiveDrawing,
    ]
  );

  // Give up and reveal secret answer
  const handleGiveUpAndReveal = useCallback(async () => {
    triggerSound('click');
    setAiSecretRevealed(true);
    setPhase('roundA_success');
    setGuessFeedback({
      correct: false,
      text: `已揭晓答案：【${aiSecret.word}】（${aiSecret.category}）`,
    });

    const config = loadLlmConfig();
    const ending = await generateDrawAndGuessRevealEnding(config, activeChar, aiSecret.word);
    addChatMessage('ai', ending.speech);
  }, [aiSecret, triggerSound, activeChar, addChatMessage]);

  // -------------------------------------------------------------
  // ④ PLAYER DRAWING ROUND (我画·AI猜 - 题目绝对不暴露给AI！)
  // -------------------------------------------------------------
  const startPlayerDrawingRound = useCallback(
    (chosenTopic?: { word: string; category: string; hints: string[] }) => {
      stopAnimation();
      setRound('round_player_draw');
      setPhase('player_drawing');
      setPlayerStrokes([]);
      currentStrokeRef.current = [];
      setAiGuessStage(0);
      setAiIsThinking(false);
      setPlayerInteractiveInput('');
      clearCanvas();
      triggerSound('click');

      const topic = chosenTopic || playerTopic;
      setPlayerTopic(topic);

      const playerTurnGreetings = [
        `“画板交给你了！信马由缰地画吧，我会在一旁认真看着的。”`,
        `“我很期待你笔下的线条，画好后随时叫我来猜哦～”`,
        `“来吧，画板已备好，尽情发挥你的画技吧！”`,
      ];
      const randomGreeting = playerTurnGreetings[Math.floor(Math.random() * playerTurnGreetings.length)];
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      setChatMessages([
        {
          id: `player_init_${Date.now()}`,
          sender: 'ai',
          name: currentArtist.name,
          avatar: currentArtist.avatar,
          text: randomGreeting,
          time: timeStr,
        },
      ]);
    },
    [stopAnimation, clearCanvas, triggerSound, playerTopic, currentArtist]
  );

  // Pick a new random word for player to draw
  const handleRerollPlayerWord = useCallback(() => {
    triggerSound('click');
    const newWord = getRandomWord(playerCategory);
    setPlayerTopic(newWord);
    setCustomWordInput('');
    startPlayerDrawingRound(newWord);
  }, [playerCategory, triggerSound, startPlayerDrawingRound]);

  // Custom player word
  const handleApplyCustomPlayerWord = useCallback(() => {
    const trimmed = customWordInput.trim();
    if (!trimmed) return;
    triggerSound('click');
    const customTopic = {
      word: trimmed,
      category: '自定义',
      hints: [`玩家自定义题目：${trimmed}`],
    };
    setPlayerTopic(customTopic);
    startPlayerDrawingRound(customTopic);
  }, [customWordInput, triggerSound, startPlayerDrawingRound]);

  // Convert pointer event to exact canvas pixel coordinates
  const getCanvasPoint = useCallback((e: React.PointerEvent<HTMLCanvasElement>): [number, number] | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    return [x, y];
  }, []);

  // Pointer Down (Pointer Events with Pointer Capture to guarantee no scroll clash)
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (phase !== 'player_drawing') return;
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}

      const pt = getCanvasPoint(e);
      if (!pt) return;

      setIsDrawing(true);
      strokeStartTimeRef.current = performance.now();
      currentStrokeRef.current = [pt];
      triggerSound('draw');

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const outline = getStrokeOutline(currentStrokeRef.current, {
        thinning: isEraser ? 0 : 0.5,
        smoothing: 0.5,
        jitter: 0,
        taperStart: isEraser ? 0 : 5,
        taperEnd: isEraser ? 0 : 5,
        size: brushSize,
      });
      renderStrokeToCanvas(ctx, outline, brushColor, isEraser);
    },
    [phase, getCanvasPoint, triggerSound, isEraser, brushSize, brushColor]
  );

  // Pointer Move
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing || phase !== 'player_drawing') return;
      e.preventDefault();
      const pt = getCanvasPoint(e);
      if (!pt) return;

      const last = currentStrokeRef.current[currentStrokeRef.current.length - 1];
      if (last && Math.hypot(pt[0] - last[0], pt[1] - last[1]) < 2) return;

      currentStrokeRef.current.push(pt);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      clearCanvas();

      // Draw completed strokes
      playerStrokes.forEach((s) => {
        const outline = getStrokeOutline(s.points, {
          thinning: 0.5,
          smoothing: 0.5,
          jitter: 0,
          taperStart: 6,
          taperEnd: 6,
          size: s.size,
        });
        renderStrokeToCanvas(ctx, outline, s.color, s.color === '__ERASER__');
      });

      // Draw active in-progress stroke
      const currentOutline = getStrokeOutline(currentStrokeRef.current, {
        thinning: isEraser ? 0 : 0.5,
        smoothing: 0.5,
        jitter: 0,
        taperStart: isEraser ? 0 : 6,
        taperEnd: isEraser ? 0 : 6,
        size: brushSize,
      });
      renderStrokeToCanvas(ctx, currentOutline, isEraser ? '__ERASER__' : brushColor, isEraser);
    },
    [isDrawing, phase, getCanvasPoint, clearCanvas, playerStrokes, isEraser, brushSize, brushColor]
  );

  // Pointer Up
  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing || phase !== 'player_drawing') return;
      e.preventDefault();
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      setIsDrawing(false);

      if (currentStrokeRef.current.length > 0) {
        const strokeDuration = Math.max(150, Math.round(performance.now() - strokeStartTimeRef.current));
        const newStroke: PixelStroke = {
          points: [...currentStrokeRef.current],
          color: isEraser ? '__ERASER__' : brushColor,
          size: brushSize,
          duration: strokeDuration,
        };
        setPlayerStrokes((prev) => [...prev, newStroke]);
      }
      currentStrokeRef.current = [];
    },
    [isDrawing, phase, isEraser, brushColor, brushSize]
  );

  // Undo player's last stroke
  const handleUndo = useCallback(() => {
    if (phase !== 'player_drawing' || playerStrokes.length === 0) return;
    triggerSound('click');
    setPlayerStrokes((prev) => {
      const next = prev.slice(0, -1);
      const canvas = canvasRef.current;
      if (!canvas) return next;
      const ctx = canvas.getContext('2d');
      if (!ctx) return next;

      clearCanvas();
      next.forEach((s) => {
        const outline = getStrokeOutline(s.points, {
          thinning: 0.5,
          smoothing: 0.5,
          jitter: 0,
          taperStart: 6,
          taperEnd: 6,
          size: s.size,
        });
        renderStrokeToCanvas(ctx, outline, s.color, s.color === '__ERASER__');
      });
      return next;
    });
  }, [phase, playerStrokes.length, triggerSound, clearCanvas]);

  // Clear player drawing board
  const handleClearPlayerBoard = useCallback(() => {
    if (phase !== 'player_drawing') return;
    triggerSound('click');
    setPlayerStrokes([]);
    currentStrokeRef.current = [];
    clearCanvas();
  }, [phase, triggerSound, clearCanvas]);

  // Player completes drawing and triggers AI Stage 1 Guessing
  const handleFinishPlayerDrawing = useCallback(async () => {
    if (playerStrokes.length === 0) return;
    stopAnimation();
    setPhase('player_finished');
    setAiGuessStage(1);
    setAiIsThinking(true);
    triggerSound('complete');

    // Player natural chat (NO SPOILERS OF TOPIC!)
    addChatMessage('player', '我画好啦！你快来看看我画的是什么～');

    const semanticSummary = generateStrokeSemanticSummary(playerStrokes);
    const config = loadLlmConfig();
    try {
      // Stage 1: AI purposefully guesses wrong based on stroke summary and asks for clues
      const res = await generateDrawAndGuessAiGuessReaction(
        config,
        activeChar,
        1,
        playerTopic.category,
        semanticSummary
      );
      addChatMessage('ai', res.speech);
    } finally {
      setAiIsThinking(false);
    }
  }, [playerStrokes, stopAnimation, triggerSound, addChatMessage, activeChar, playerTopic.category]);

  // Player asks AI to guess drawing or interacts with AI
  const handlePlayerSendInteractiveMessage = useCallback(
    async (customText?: string) => {
      if (aiIsThinking) return;
      const text = (customText || playerInteractiveInput).trim();
      const sendText = text || '你看我画的是什么？快猜猜看～';

      addChatMessage('player', sendText);
      setPlayerInteractiveInput('');
      setAiIsThinking(true);

      const canvasDataUrl = canvasRef.current?.toDataURL('image/png');
      const semanticSummary = generateStrokeSemanticSummary(playerStrokes);
      const config = loadLlmConfig();
      try {
        const res = await generateDrawAndGuessAiGuessReaction(
          config,
          activeChar,
          aiGuessStage + 1,
          playerTopic.category,
          semanticSummary,
          sendText,
          canvasDataUrl
        );

        // Evaluate if AI guessed correctly locally without revealing targetWord to LLM
        const guessedWord = (res.guessWord || '').trim();
        const secretWord = playerTopic.word.trim();

        const cleanGuess = guessedWord.replace(/[【】"'\s,，!！?？]/g, '').toLowerCase();
        const cleanSecret = secretWord.replace(/[【】"'\s,，!！?？]/g, '').toLowerCase();

        const isCorrect =
          cleanGuess.length > 0 &&
          (cleanGuess === cleanSecret ||
            cleanSecret.includes(cleanGuess) ||
            cleanGuess.includes(cleanSecret));

        let aiSpeech = res.speech;
        if (isCorrect) {
          if (!aiSpeech.includes('猜对') && !aiSpeech.includes('绝了') && !aiSpeech.includes('太神了')) {
            aiSpeech += ` 真的被我猜中了！答案就是【${secretWord}】！主控这线条画技太绝了！`;
          }
        }

        addChatMessage('ai', aiSpeech);

        if (isCorrect) {
          triggerSound('correct');
          setScores((prev) => ({ ...prev, aiWins: prev.aiWins + 1 }));
          setPhase('roundB_success');
          setAiGuessStage(3);

          if (res.gameTotalDelta) {
            recordGameEmotionImpact({
              id: `dg_${Date.now()}`,
              matchId: `match_${Date.now()}`,
              characterId: activeChar.character_id,
              characterName: activeChar.name,
              timestamp: Date.now(),
              winner: 'character',
              totalMoves: playerStrokes.length,
              totalDelta: res.gameTotalDelta,
              applied: true,
              appliedTimestamp: Date.now(),
              summary: `【你画我猜】「${activeChar.name}」精明猜出了主控所画的【${playerTopic.word}】。`,
            });
          }
        } else {
          triggerSound('click');
          setAiGuessStage((prev) => (prev >= 3 ? 3 : ((prev + 1) as 0 | 1 | 2 | 3)));
          // Keep canvas open in 'player_drawing' so player can add more strokes!
          setPhase('player_drawing');
        }
      } finally {
        setAiIsThinking(false);
      }
    },
    [playerInteractiveInput, aiIsThinking, aiGuessStage, playerStrokes, activeChar, playerTopic, addChatMessage, triggerSound]
  );

  // Quick hint actions for player
  const handleSendQuickHint = useCallback(() => {
    const hint = playerTopic.hints[0] || '生活里很常见的东西哦～';
    handlePlayerSendInteractiveMessage(`给你一个小提示：${hint}`);
  }, [playerTopic.hints, handlePlayerSendInteractiveMessage]);

  const handleSendWrongFeedback = useCallback(() => {
    handlePlayerSendInteractiveMessage('方向全猜偏啦！再仔细看看线条轮廓嘛～');
  }, [handlePlayerSendInteractiveMessage]);

  const handleRevealAndPraise = useCallback(async () => {
    if (aiIsThinking) return;
    setAiIsThinking(true);
    setAiGuessStage(3);
    addChatMessage('player', `好啦揭晓谜底！其实我画的是【${playerTopic.word}】哦！`);

    const semanticSummary = generateStrokeSemanticSummary(playerStrokes);
    const config = loadLlmConfig();
    try {
      const res = await generateDrawAndGuessAiGuessReaction(
        config,
        activeChar,
        3,
        playerTopic.category,
        semanticSummary,
        '揭晓答案',
        playerTopic.word
      );
      addChatMessage('ai', res.speech);
      triggerSound('correct');
      setScores((prev) => ({ ...prev, aiWins: prev.aiWins + 1 }));

      if (res.gameTotalDelta) {
        recordGameEmotionImpact({
          id: `dg_${Date.now()}`,
          matchId: `match_${Date.now()}`,
          characterId: activeChar.character_id,
          characterName: activeChar.name,
          timestamp: Date.now(),
          winner: 'character',
          totalMoves: playerStrokes.length,
          totalDelta: res.gameTotalDelta,
          applied: true,
          appliedTimestamp: Date.now(),
          summary: `【你画我猜】主控揭晓了画作答案【${playerTopic.word}】，「${activeChar.name}」赞叹不已。`,
        });
      }
    } finally {
      setAiIsThinking(false);
    }
  }, [aiIsThinking, playerTopic, playerStrokes, activeChar, addChatMessage, triggerSound]);

  // Replay Player's Drawing Animation
  const handleReplayPlayerDrawing = useCallback(() => {
    if (playerStrokes.length === 0) return;
    stopAnimation();
    setPhase('player_replaying');
    clearCanvas();
    triggerSound('click');

    isPlayingRef.current = true;
    let strokeIdx = 0;
    let strokeStartTime = performance.now();
    const completed: PixelStroke[] = [];

    const animate = (timestamp: number) => {
      if (!isPlayingRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const cur = playerStrokes[strokeIdx];
      const duration = cur.duration || 450;
      const progress = Math.min(1, (timestamp - strokeStartTime) / duration);

      const ptCount = Math.max(2, Math.floor(cur.points.length * progress));
      const partial = cur.points.slice(0, ptCount);

      clearCanvas();

      completed.forEach((s) => {
        const outline = getStrokeOutline(s.points, {
          thinning: 0.5,
          smoothing: 0.5,
          jitter: 0,
          taperStart: 6,
          taperEnd: 6,
          size: s.size,
        });
        renderStrokeToCanvas(ctx, outline, s.color, s.color === '__ERASER__');
      });

      if (partial.length >= 2) {
        const outline = getStrokeOutline(partial, {
          thinning: 0.5,
          smoothing: 0.5,
          jitter: 0,
          taperStart: 6,
          taperEnd: 6,
          size: cur.size,
        });
        renderStrokeToCanvas(ctx, outline, cur.color, cur.color === '__ERASER__');
      }

      if (progress < 1) {
        animFrameIdRef.current = requestAnimationFrame(animate);
      } else {
        completed.push(cur);
        strokeIdx++;
        if (strokeIdx < playerStrokes.length) {
          strokeStartTime = performance.now() + 40;
          animFrameIdRef.current = requestAnimationFrame(animate);
        } else {
          isPlayingRef.current = false;
          setPhase('player_finished');
          triggerSound('complete');
        }
      }
    };

    animFrameIdRef.current = requestAnimationFrame(animate);
  }, [playerStrokes, stopAnimation, clearCanvas, triggerSound]);

  // Clean up rAF on unmount
  useEffect(() => {
    return () => {
      stopAnimation();
    };
  }, [stopAnimation]);

  // Initial mount: Start on Welcome screen
  useEffect(() => {
    // Keep phase as 'welcome' on launch so player chooses mode and category first
  }, []);

  return (
    <div data-no-swipe="true" className="w-full h-full flex flex-col bg-stone-950 text-white select-none overflow-hidden text-xs relative no-sidebar-swipe">
      
      {/* ================= WELCOME / SETUP SCREEN OVERLAY ================= */}
      {phase === 'welcome' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-3 sm:p-5 bg-stone-950 text-white overflow-hidden">
          {/* Background Image */}
          <img
            src={drawGuessBg}
            alt="你画我猜背景"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-30 blur-[1px]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/75 to-stone-950/45" />

          {/* Setup Card */}
          <div className="relative z-10 w-full max-w-sm sm:max-w-md bg-stone-900/90 border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-xl flex flex-col gap-3.5 my-auto overflow-y-auto max-h-[95vh]">
            
            {/* Top Bar inside welcome card */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Palette className="size-5 text-pink-400 animate-pulse" />
                <span className="font-bold text-sm text-pink-300">你画我猜 · 笔尖默契</span>
              </div>
              {onExit && (
                <button
                  onClick={onExit}
                  className="px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/15 text-stone-300 text-[10px] transition cursor-pointer"
                >
                  ← 退出
                </button>
              )}
            </div>

            <p className="text-stone-300 text-[11px] leading-relaxed">
              欢迎来到你画我猜！先挑选你心仪的<b>玩法模式</b>与<b>题目分类</b>，开启趣味互动作画吧：
            </p>

            {/* 1. Mode Selector */}
            <div className="space-y-1">
              <div className="text-[10.5px] font-bold text-amber-300 flex items-center gap-1">
                <Zap className="size-3 text-amber-400" />
                <span>1. 选择玩法模式</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setRound('round_ai_draw')}
                  className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-0.5 cursor-pointer ${
                    round === 'round_ai_draw'
                      ? 'bg-gradient-to-br from-pink-500/25 to-rose-500/25 border-pink-400 text-white ring-1 ring-pink-500/50'
                      : 'bg-white/5 border-white/10 text-stone-300 hover:bg-white/10'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center justify-between">
                    <span>🎨 我猜 (AI出题)</span>
                    {round === 'round_ai_draw' && <Check className="size-3.5 text-pink-400" />}
                  </div>
                  <p className="text-[9.5px] opacity-75 leading-tight">AI画伴执笔在画板作画，你在聊天框随时猜词</p>
                </button>

                <button
                  onClick={() => setRound('round_player_draw')}
                  className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-0.5 cursor-pointer ${
                    round === 'round_player_draw'
                      ? 'bg-gradient-to-br from-amber-500/25 to-orange-500/25 border-amber-400 text-white ring-1 ring-amber-500/50'
                      : 'bg-white/5 border-white/10 text-stone-300 hover:bg-white/10'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center justify-between">
                    <span>✏️ 我画 (AI来猜)</span>
                    {round === 'round_player_draw' && <Check className="size-3.5 text-amber-400" />}
                  </div>
                  <p className="text-[9.5px] opacity-75 leading-tight">你在画板挥毫作画，AI实时看懂线条并智能猜词</p>
                </button>
              </div>
            </div>

            {/* 2. Category Selector */}
            <div className="space-y-1">
              <div className="text-[10.5px] font-bold text-pink-300 flex items-center gap-1">
                <Sparkles className="size-3 text-pink-400" />
                <span>2. 选择题目分类</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: '可爱动物', name: '🐶 可爱动物' },
                  { id: '美味食物', name: '🍔 美味食物' },
                  { id: '日常物品', name: '📱 日常物品' },
                  { id: '成语典故', name: '📜 成语典故' },
                  { id: '自然科技', name: '🚀 自然科技' },
                  { id: '自由出题', name: '💡 随机趣味' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`py-1.5 px-2 rounded-xl border text-center text-[11px] transition font-medium cursor-pointer ${
                      selectedCategory === cat.id
                        ? 'bg-pink-500/20 border-pink-400 text-pink-300 font-bold'
                        : 'bg-white/5 border-white/10 text-stone-300 hover:bg-white/10'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Character Selector */}
            <div className="space-y-1">
              <div className="text-[10.5px] font-bold text-emerald-300 flex items-center gap-1">
                <Bot className="size-3 text-emerald-400" />
                <span>3. 选择画伴角色</span>
              </div>
              <div className="flex items-center gap-2 bg-black/40 p-2 rounded-xl border border-white/10">
                <CharAvatar avatar={currentArtist.avatar} name={currentArtist.name} className="size-8 rounded-full border border-pink-500/30 object-cover shrink-0 flex items-center justify-center bg-stone-800 text-lg" />
                <div className="flex-1 min-w-0">
                  <select
                    value={selectedCharId}
                    onChange={(e) => setSelectedCharId(e.target.value)}
                    className="bg-transparent text-amber-300 font-bold text-xs outline-none cursor-pointer w-full"
                  >
                    {playableArtists.map((a) => (
                      <option key={a.id} value={a.id} className="bg-stone-900 text-white">
                        {getAvatarDisplayEmoji(a.avatar)} {a.name} ({a.tag || '画伴'})
                      </option>
                    ))}
                  </select>
                  <p className="text-[9.5px] text-stone-400 truncate">{currentArtist.paintingPersona}</p>
                </div>
              </div>
            </div>

            {/* Start Game Button */}
            <button
              onClick={() => {
                triggerSound('complete');
                if (round === 'round_ai_draw') {
                  startTopicNegotiation(selectedCategory);
                } else {
                  const topic = getRandomWord(selectedCategory);
                  startPlayerDrawingRound(topic);
                }
              }}
              className="w-full py-2.5 mt-1 bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 hover:from-pink-400 hover:to-amber-400 text-stone-950 font-extrabold rounded-xl shadow-lg shadow-pink-500/25 text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <Play className="size-4 fill-stone-950" />
              <span>开启互动 · 开始你画我猜</span>
            </button>
          </div>
        </div>
      )}
      
      {/* ================= TOP NAV BAR ================= */}
      <div className="h-11 shrink-0 px-2 bg-stone-900 border-b border-white/10 flex items-center justify-between gap-1.5 z-10 w-full">
        <div className="flex items-center gap-1 shrink-0">
          {onExit && (
            <button
              onClick={onExit}
              className="p-1 px-2 rounded-lg bg-white/5 hover:bg-white/10 text-stone-300 hover:text-white border border-white/10 text-[11px] transition active:scale-95 cursor-pointer font-medium whitespace-nowrap"
            >
              <span>← 返回</span>
            </button>
          )}

          <button
            onClick={() => setPhase('welcome')}
            className="p-1 px-2 rounded-lg bg-pink-500/15 hover:bg-pink-500/25 text-pink-300 border border-pink-500/30 text-[11px] transition active:scale-95 cursor-pointer font-medium whitespace-nowrap flex items-center gap-1"
            title="重新选择玩法模式与分类"
          >
            <Home className="size-3" />
            <span>模式/分类</span>
          </button>
        </div>

        {/* Two compact dropdowns side-by-side inside the Nav Bar */}
        <div className="flex-1 flex items-center gap-1.5 max-w-xs sm:max-w-md min-w-0">
          {/* Mode Selector */}
          <div className="flex-1 flex items-center gap-1 bg-black/40 px-1.5 py-0.5 rounded-lg border border-white/5 min-w-0">
            <span className="text-[9px] text-stone-400 shrink-0">模式:</span>
            <select
              value={round}
              onChange={(e) => {
                const val = e.target.value as GameRound;
                setRound(val);
                if (val === 'round_ai_draw') {
                  startTopicNegotiation();
                } else {
                  startPlayerDrawingRound();
                }
              }}
              className="bg-transparent text-pink-300 text-[10.5px] font-bold outline-none cursor-pointer w-full truncate border-0 p-0"
            >
              <option value="round_ai_draw" className="bg-stone-900 text-white">我猜 (AI出题)</option>
              <option value="round_player_draw" className="bg-stone-900 text-white">我画 (AI来猜)</option>
            </select>
          </div>

          {/* Character Selector */}
          <div className="flex-1 flex items-center gap-1 bg-black/40 px-1.5 py-0.5 rounded-lg border border-white/5 min-w-0">
            <span className="text-[9px] text-stone-400 shrink-0">画伴:</span>
            <select
              value={selectedCharId}
              onChange={(e) => {
                const newId = e.target.value;
                setSelectedCharId(newId);
                const artist = getAiArtistById(newId);
                addChatMessage('ai', `你好呀，接下来由我「${artist.name}」来陪你玩你画我猜！`, artist.name, artist.avatar);
              }}
              className="bg-transparent text-amber-300 text-[10.5px] font-bold outline-none cursor-pointer w-full truncate border-0 p-0"
            >
              {playableArtists.map((a) => (
                <option key={a.id} value={a.id} className="bg-stone-900 text-white">
                  {getAvatarDisplayEmoji(a.avatar)} {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Score & Sound controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setSoundEnabled((v) => !v)}
            className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-stone-300 border border-white/10 transition cursor-pointer"
            title={soundEnabled ? '音效开启' : '音效静音'}
          >
            {soundEnabled ? <Volume2 className="size-3 text-emerald-400" /> : <VolumeX className="size-3 text-stone-500" />}
          </button>

          <div className="flex items-center gap-1 bg-black/40 px-1.5 py-0.5 rounded-full border border-white/10 font-mono text-[9px] whitespace-nowrap">
            <span className="text-amber-300">我:{scores.playerWins}</span>
            <span className="text-pink-300">{currentArtist.name}:{scores.aiWins}</span>
          </div>
        </div>
      </div>

      {/* ================= MAIN TWO-COLUMN BODY ================= */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden p-1.5 sm:p-2 gap-2 min-h-0 w-full">
        
        {/* ================= LEFT MAIN CANVAS & CONTROLS ================= */}
        <div className="shrink-0 md:flex-1 flex flex-col bg-stone-900/80 border border-white/10 rounded-xl p-2 shadow-lg backdrop-blur-md gap-1.5 w-full min-h-0">

          {/* Secret / Topic Status Strip */}
          {round === 'round_ai_draw' ? (
            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-pink-950/30 rounded-xl border border-pink-500/30 shrink-0 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10.5px] text-pink-300 font-bold flex items-center gap-1">
                  <QuestionIcon className="size-3.5" />
                  <span>AI秘密题目:</span>
                </span>
                {phase === 'topic_negotiation' ? (
                  <span className="px-2.5 py-0.5 rounded-md bg-pink-500/20 border border-pink-400/30 text-pink-200 font-bold text-xs">
                    正在商量选题中...
                  </span>
                ) : aiSecretRevealed ? (
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/25 border border-emerald-400/50 text-emerald-200 font-bold text-sm tracking-wider flex items-center gap-1">
                    <Unlock className="size-3 text-emerald-400" />
                    <span>{aiSecret.word}</span>
                  </span>
                ) : (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: aiSecret.word.length }).map((_, i) => (
                        <span
                          key={i}
                          className="size-6 rounded-md bg-pink-500/20 border border-pink-400/40 text-pink-200 font-black text-sm flex items-center justify-center font-mono shadow-inner"
                        >
                          ？
                        </span>
                      ))}
                    </div>
                    <span className="text-[10px] text-pink-300/80">
                      （{aiSecret.word.length}个字 · {aiSecret.category} · 第 <b className="text-amber-300">{drawingRoundNumber}/3</b> 轮）
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => startTopicNegotiation()}
                  className="px-2 py-1 bg-white/10 hover:bg-white/15 text-pink-300 rounded-lg border border-white/10 text-[10.5px] flex items-center gap-1 transition cursor-pointer active:scale-95"
                  title="重新商量题目"
                >
                  <RefreshCw className="size-3" />
                  <span>重商换题</span>
                </button>

                {phase === 'guessing' && !aiSecretRevealed && (
                  <button
                    onClick={handleGiveUpAndReveal}
                    className="text-[10px] text-stone-400 hover:text-pink-300 underline cursor-pointer transition"
                  >
                    揭晓答案
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-amber-950/30 rounded-xl border border-amber-500/30 shrink-0 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10.5px] text-amber-300 font-bold flex items-center gap-1">
                  <Palette className="size-3.5" />
                  <span>你要画的题目（仅自己可见）:</span>
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-amber-400/25 border border-amber-400/50 text-amber-200 font-bold text-sm tracking-wider">
                  {playerTopic.word}
                </span>
                <span className="text-[10px] text-amber-300/70">
                  （{playerTopic.category} · {playerTopic.word.length}个字）
                </span>
              </div>

              {/* Custom Word Input */}
              <div className="flex items-center gap-1">
                <button
                  onClick={handleRerollPlayerWord}
                  className="px-2 py-0.5 bg-white/10 hover:bg-white/15 text-amber-300 rounded-md border border-white/10 text-[10px] cursor-pointer mr-1"
                >
                  换一题
                </button>
                <input
                  type="text"
                  placeholder="自定题目..."
                  value={customWordInput}
                  onChange={(e) => setCustomWordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleApplyCustomPlayerWord();
                  }}
                  className="w-20 sm:w-24 px-2 py-0.5 bg-stone-800/80 border border-white/15 rounded-md text-base md:text-[10.5px] text-stone-200 placeholder-stone-500 outline-none focus:border-amber-400"
                />
                <button
                  onClick={handleApplyCustomPlayerWord}
                  className="px-2 py-0.5 bg-white/10 hover:bg-white/15 text-stone-200 rounded-md border border-white/10 text-[10px] cursor-pointer"
                >
                  设定
                </button>
              </div>
            </div>
          )}

          {/* Status Bar - Concise & neat */}
          <div className="px-2 py-1 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between text-[10px] shrink-0 font-medium text-stone-300">
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-pink-400 animate-pulse" />
              <span>画板状态:</span>
            </span>
            <span className="font-bold text-amber-300">
              {phase === 'topic_negotiation' && `商定分类`}
              {phase === 'ai_generating' && `AI 构思中...`}
              {phase === 'ai_drawing' && `AI 实时画画 (${drawingRoundNumber}/3)`}
              {phase === 'guessing' && `开始猜词！`}
              {phase === 'player_drawing' && `我画 AI猜`}
              {phase === 'player_finished' && `AI 猜词中...`}
              {phase === 'player_replaying' && `重播画迹`}
            </span>
          </div>

          {/* ================= CANVAS DRAWING BOARD ================= */}
          {/* Note: touch-action: none & select-none guarantee zero scroll interference on the canvas itself */}
          <div className="relative w-full h-[180px] xs:h-[200px] sm:h-[230px] md:h-[320px] bg-white rounded-xl shadow-md overflow-hidden border border-stone-800 cursor-crosshair shrink-0 flex-shrink-0 touch-none select-none">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
                touchAction: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />

            {/* In-Game Drawing Quip Bubble (AI 作画随口小词) */}
            {activeQuip && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none animate-bounce">
                <div className="px-3 py-1.5 rounded-2xl bg-black/85 text-amber-200 text-[11px] font-bold border border-amber-400/40 shadow-xl backdrop-blur-md flex items-center gap-1.5">
                  <CharAvatar avatar={currentArtist.avatar} name={currentArtist.name} className="size-4 rounded-full object-cover shrink-0 flex items-center justify-center text-xs" />
                  <span>“{activeQuip}”</span>
                </div>
              </div>
            )}
          </div>

          {/* ================= COMPACT CONTROLS DIRECTLY UNDER CANVAS ================= */}
          {/* Under canvas we ONLY render category chips or drawing controls/tools or success state action triggers */}
          <div className="shrink-0 pt-0.5 space-y-1.5">
            {round === 'round_ai_draw' ? (
              phase === 'topic_negotiation' ? (
                /* Topic Negotiation Bar */
                <div className="space-y-1 bg-stone-950/60 p-2 rounded-xl border border-pink-500/10">
                  <div className="flex items-center gap-1 text-pink-300 font-bold text-[10px]">
                    <Sparkles className="size-3 shrink-0" />
                    <span>选择想猜的题目分类，或在右侧输入想画什么：</span>
                  </div>
                  {/* Category Chips */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {suggestedCategories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => confirmTopicAndStartDrawing(cat)}
                        disabled={isNegotiating}
                        className="px-2 py-0.5 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 text-pink-200 rounded-md font-bold text-[10px] transition cursor-pointer disabled:opacity-50"
                      >
                        {cat}
                      </button>
                    ))}
                    <button
                      onClick={() => confirmTopicAndStartDrawing('随心出题，直接画吧！')}
                      disabled={isNegotiating}
                      className="px-2 py-0.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/20 text-amber-200 rounded-md font-bold text-[10px] transition cursor-pointer disabled:opacity-50"
                    >
                      🎲 直接画！
                    </button>
                  </div>
                </div>
              ) : phase === 'guessing' ? (
                /* Guessing stage quick action */
                <div className="flex items-center justify-between gap-1 px-1 py-0.5">
                  <span className="text-[10px] text-stone-400">请在右下方对话框提交您的猜词噢</span>
                  {!aiSecretRevealed && (
                    <button
                      onClick={handleGiveUpAndReveal}
                      className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-stone-300 rounded-lg text-[10px] transition cursor-pointer border border-white/5"
                    >
                      🏳️ 我猜不出，揭晓答案
                    </button>
                  )}
                </div>
              ) : phase === 'roundA_success' ? (
                <div className="flex gap-1.5">
                  <button
                    onClick={() => startTopicNegotiation()}
                    className="flex-1 py-1.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white font-bold rounded-xl shadow-md text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                  >
                    <RefreshCw className="size-3" />
                    <span>再来一局 (商量出题)</span>
                  </button>
                  <button
                    onClick={() => {
                      setRound('round_player_draw');
                      startPlayerDrawingRound();
                    }}
                    className="py-1.5 px-3 bg-white/5 hover:bg-white/10 text-stone-200 font-bold rounded-xl border border-white/10 text-xs flex items-center gap-1 transition cursor-pointer"
                  >
                    <span>换我来画 →</span>
                  </button>
                </div>
              ) : (
                <div className="py-1 px-2.5 bg-black/30 rounded-xl border border-white/5 text-stone-400 text-[10.5px] text-center">
                  {phase === 'ai_generating'
                    ? `AI 正在构思作画第 ${drawingRoundNumber} 轮，请稍候...`
                    : `AI 正在逐笔作画中，请仔细观察画面...`}
                </div>
              )
            ) : (
              /* Player Drawing Round Controls */
              phase === 'player_drawing' ? (
                <div className="flex flex-col gap-1.5 p-2 bg-black/40 rounded-xl border border-white/5 shrink-0">
                  {/* Color Palette */}
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] text-stone-400 shrink-0">颜色:</span>
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                      {PALETTE_COLORS.map((c) => (
                        <button
                          key={c.value}
                          onClick={() => {
                            setBrushColor(c.value);
                            setIsEraser(false);
                          }}
                          className={`size-4.5 rounded-full border transition cursor-pointer ${
                            !isEraser && brushColor === c.value
                              ? 'border-white scale-110 shadow-md ring-1 ring-amber-400'
                              : 'border-transparent hover:scale-105 opacity-85'
                          }`}
                          style={{ backgroundColor: c.value }}
                          title={c.name}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Brush Tools */}
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <div className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded-lg border border-white/10">
                      <span className="text-[10px] text-stone-400">粗细:</span>
                      <input
                        type="range"
                        min="4"
                        max="24"
                        value={brushSize}
                        onChange={(e) => setBrushSize(Number(e.target.value))}
                        className="w-12 h-1 accent-amber-400 cursor-pointer"
                      />
                      <span className="text-[9.5px] font-mono text-amber-300 w-3.5">{brushSize}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setIsEraser((v) => !v)}
                        className={`px-2 py-0.5 rounded-md border text-[10px] transition cursor-pointer flex items-center gap-1 ${
                          isEraser
                            ? 'bg-amber-500 text-stone-950 font-bold border-amber-400 shadow-sm'
                            : 'bg-white/5 hover:bg-white/10 text-stone-300 border-white/10'
                        }`}
                      >
                        <Eraser className="size-3" />
                        <span>橡皮</span>
                      </button>

                      <button
                        onClick={handleUndo}
                        disabled={playerStrokes.length === 0}
                        className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 disabled:opacity-40 text-stone-300 border border-white/10 text-[10px] transition cursor-pointer flex items-center gap-1"
                      >
                        <RotateCcw className="size-3" />
                        <span>撤回</span>
                      </button>

                      <button
                        onClick={handleClearPlayerBoard}
                        className="px-2 py-0.5 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 text-[10px] transition cursor-pointer"
                      >
                        清空
                      </button>

                      <button
                        onClick={() => handlePlayerSendInteractiveMessage()}
                        disabled={playerStrokes.length === 0 || aiIsThinking}
                        className="px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-40 text-stone-950 font-bold rounded-lg shadow-md text-[10px] flex items-center gap-1 transition active:scale-95 cursor-pointer ml-1"
                      >
                        <Sparkles className="size-3" />
                        <span>🤖 让AI猜猜看</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Player Finished / Success Actions */
                <div className="space-y-1.5">
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleRerollPlayerWord}
                      className="flex-1 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 font-bold rounded-xl shadow-md text-xs flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer"
                    >
                      <RefreshCw className="size-3" />
                      <span>再画一题</span>
                    </button>
                    <button
                      onClick={() => {
                        setRound('round_ai_draw');
                        startTopicNegotiation();
                      }}
                      className="py-1.5 px-3 bg-white/5 hover:bg-white/10 text-stone-200 font-bold rounded-xl border border-white/10 text-xs flex items-center gap-1 transition cursor-pointer"
                    >
                      <span>换AI画 →</span>
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* ================= RIGHT CONVERSATION & GUESSING PANEL ================= */}
        {/* Dedicated scrollable chat stream with independent scrolling and fixed bottom input send bar */}
        <div className="w-full md:w-80 lg:w-96 flex flex-col bg-stone-900/80 border border-white/10 rounded-xl p-2 shadow-lg backdrop-blur-md flex-1 md:flex-initial min-h-0 overflow-hidden">
          
          {/* Header of Chat Panel */}
          <div className="flex items-center justify-between pb-2 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-1.5">
              <MessageCircle className="size-4 text-pink-400" />
              <span className="font-bold text-stone-200">互动对话与心语</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-stone-400">
              <span>{currentArtist.name} 在线</span>
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          </div>

          {/* Chat Bubble Stream */}
          <div
            ref={chatScrollRef}
            className="flex-1 overflow-y-auto no-scrollbar py-2.5 space-y-2.5 text-[11px] min-h-0"
          >
            {chatMessages.map((msg) => {
              const isMe = msg.sender === 'player';
              return (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div className="size-6 rounded-full bg-stone-800 border border-white/10 flex items-center justify-center shrink-0 text-xs shadow overflow-hidden">
                    <CharAvatar
                      avatar={msg.avatar || (isMe ? '🎨' : currentArtist.avatar)}
                      name={msg.name}
                      className="size-6 rounded-full object-cover shrink-0 flex items-center justify-center text-xs"
                    />
                  </div>
                  <div className={`max-w-[78%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="text-[9.5px] text-stone-400 mb-0.5 px-1">
                      {msg.name} · {msg.time}
                    </div>
                    <div
                      className={`px-3 py-2 rounded-2xl shadow leading-relaxed ${
                        isMe
                          ? 'bg-amber-500 text-stone-950 font-medium rounded-tr-none'
                          : 'bg-stone-800/90 text-stone-100 border border-white/10 rounded-tl-none'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                </div>
              );
            })}

            {aiIsThinking && (
              <div className="flex gap-2">
                <div className="size-6 rounded-full bg-stone-800 border border-white/10 flex items-center justify-center shrink-0 text-xs overflow-hidden">
                  <CharAvatar avatar={currentArtist.avatar} name={currentArtist.name} className="size-6 rounded-full object-cover shrink-0 flex items-center justify-center text-xs" />
                </div>
                <div className="px-3 py-1.5 rounded-2xl bg-stone-800/90 text-stone-400 border border-white/10 rounded-tl-none flex items-center gap-1 text-[10.5px]">
                  <span className="inline-block size-1.5 rounded-full bg-pink-400 animate-bounce" />
                  <span className="inline-block size-1.5 rounded-full bg-pink-400 animate-bounce [animation-delay:0.2s]" />
                  <span className="inline-block size-1.5 rounded-full bg-pink-400 animate-bounce [animation-delay:0.4s]" />
                  <span>正在端详画作思考中...</span>
                </div>
              </div>
            )}
          </div>

          {/* Feedback banner if any */}
          {guessFeedback && (
            <div
              className={`p-2 rounded-xl border my-1 text-[10.5px] flex items-center gap-1.5 shrink-0 ${
                guessFeedback.correct
                  ? 'bg-emerald-950/80 border-emerald-400/50 text-emerald-200'
                  : 'bg-rose-950/80 border-rose-400/50 text-rose-200'
              }`}
            >
              {guessFeedback.correct ? (
                <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="size-3.5 text-rose-400 shrink-0" />
              )}
              <span>{guessFeedback.text}</span>
            </div>
          )}

          {/* ================= FIXED BOTTOM INPUT BAR ================= */}
          {/* This input bar stays fixed at the bottom of the right panel and never scrolls away */}
          <div className="shrink-0 pt-2 border-t border-white/10 mt-1 space-y-1.5">
            {round === 'round_ai_draw' ? (
              phase === 'topic_negotiation' ? (
                /* Topic Negotiation Input Bar */
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (negotiationInput.trim()) {
                      confirmTopicAndStartDrawing(negotiationInput.trim());
                    }
                  }}
                  className="flex gap-1.5"
                >
                  <input
                    type="text"
                    value={negotiationInput}
                    onChange={(e) => setNegotiationInput(e.target.value)}
                    placeholder={`告诉 ${currentArtist.name} 想画什么类别/题目...`}
                    disabled={isNegotiating}
                    className="flex-1 bg-stone-800/90 border border-white/15 rounded-xl px-3 py-1.5 text-stone-100 placeholder-stone-500 outline-none focus:border-pink-400 text-base md:text-xs shadow-inner disabled:opacity-50 min-w-0"
                  />
                  <button
                    type="submit"
                    disabled={!negotiationInput.trim() || isNegotiating}
                    className="px-3 py-1.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 disabled:opacity-40 text-white font-bold rounded-xl shadow-md border border-pink-300 text-xs flex items-center gap-1 transition active:scale-95 cursor-pointer shrink-0"
                  >
                    <Send className="size-3.5" />
                    <span>商定</span>
                  </button>
                </form>
              ) : phase === 'guessing' ? (
                /* Guessing Input Bar */
                <form onSubmit={handleGuessSubmit} className="flex gap-1.5">
                  <input
                    type="text"
                    value={guessInput}
                    onChange={(e) => setGuessInput(e.target.value)}
                    placeholder={`输入猜词（${aiSecret.word.length}字 · ${aiSecret.category}）...`}
                    className="flex-1 bg-stone-800/90 border border-white/15 rounded-xl px-3 py-1.5 text-stone-100 placeholder-stone-500 outline-none focus:border-pink-400 text-base md:text-xs shadow-inner min-w-0"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={!guessInput.trim()}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 disabled:opacity-40 text-white font-bold rounded-xl shadow-md border border-pink-300 text-xs flex items-center gap-1 transition active:scale-95 cursor-pointer shrink-0"
                  >
                    <Send className="size-3.5" />
                    <span>提交</span>
                  </button>
                </form>
              ) : null
            ) : (
              /* Player Drawing Round Controls */
              <div className="space-y-1.5">
                {/* Quick Interaction Helper Buttons */}
                <div className="flex flex-wrap items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
                  <button
                    onClick={() => handlePlayerSendInteractiveMessage()}
                    disabled={aiIsThinking}
                    className="px-2 py-0.5 bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/40 text-pink-300 rounded-md text-[9.5px] flex items-center gap-1 transition cursor-pointer disabled:opacity-40 font-bold"
                  >
                    <Sparkles className="size-2.5 text-pink-400" />
                    <span>让AI猜猜看</span>
                  </button>
                  <button
                    onClick={handleSendQuickHint}
                    disabled={aiIsThinking}
                    className="px-2 py-0.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 rounded-md text-[9.5px] flex items-center gap-1 transition cursor-pointer disabled:opacity-40"
                  >
                    <Lightbulb className="size-2.5 text-amber-400" />
                    <span>给提示</span>
                  </button>
                  <button
                    onClick={handleRevealAndPraise}
                    disabled={aiIsThinking}
                    className="px-2 py-0.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 rounded-md text-[9.5px] flex items-center gap-1 transition cursor-pointer disabled:opacity-40"
                  >
                    <Award className="size-2.5 text-emerald-400" />
                    <span>公布答案</span>
                  </button>
                  <button
                    onClick={handleReplayPlayerDrawing}
                    className="px-2 py-0.5 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 rounded-md text-[9.5px] flex items-center gap-1 transition cursor-pointer ml-auto"
                  >
                    <Play className="size-2.5 text-purple-400" />
                    <span>重播轨迹</span>
                  </button>
                </div>

                {/* Free text interaction */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handlePlayerSendInteractiveMessage();
                  }}
                  className="flex gap-1.5"
                >
                  <input
                    type="text"
                    value={playerInteractiveInput}
                    onChange={(e) => setPlayerInteractiveInput(e.target.value)}
                    placeholder="和AI说话、给线索或让他猜词..."
                    disabled={aiIsThinking}
                    className="flex-1 bg-stone-800/90 border border-white/15 rounded-xl px-3 py-1.5 text-stone-100 placeholder-stone-500 outline-none focus:border-amber-400 text-base md:text-xs shadow-inner disabled:opacity-50 min-w-0"
                  />
                  <button
                    type="submit"
                    disabled={aiIsThinking}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-40 text-stone-950 font-bold rounded-xl shadow-md text-xs flex items-center gap-1 transition active:scale-95 cursor-pointer shrink-0"
                  >
                    <Send className="size-3.5" />
                    <span>发送</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
