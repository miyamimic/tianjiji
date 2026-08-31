import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Palette,
  Eraser,
  RotateCcw,
  Sparkles,
  Play,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronRight,
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
  Layers,
  Heart
} from 'lucide-react';
import {
  WORD_CATEGORIES,
  AI_ARTISTS,
  getRandomWord,
  getRandomAiSecretWord,
  getAiArtistById,
} from '../../data/drawAndGuessData';
import {
  getStrokeOutline,
  renderStrokeToCanvas,
  playSound,
} from '../../lib/perfectFreehandHelper';
import {
  translateInstructionToPixelPoints,
  generateStrokeSemanticSummary,
  type LlmStrokeInstruction,
} from '../../lib/drawInstructionTranslator';
import {
  loadLlmConfig,
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
type GamePhase =
  | 'idle'
  | 'ai_generating'
  | 'ai_drawing'
  | 'guessing'
  | 'roundA_success'
  | 'player_drawing'
  | 'player_finished'
  | 'player_replaying';

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
  // Selected AI character profile
  const [selectedCharId, setSelectedCharId] = useState<string>(() => {
    return AI_ARTISTS.some((a) => a.id === currentCharacterId) ? currentCharacterId : 'char_001';
  });
  const currentArtist = getAiArtistById(selectedCharId);

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
  const [phase, setPhase] = useState<GamePhase>('idle');

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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'init_1',
      sender: 'ai',
      name: currentArtist.name,
      avatar: currentArtist.avatar,
      text: `你好呀！我是${currentArtist.name}。准备好来一场心有灵犀的你画我猜了吗？不管是你画还是我画，我都奉陪到底哦～`,
      time: '刚刚',
    },
  ]);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const addChatMessage = useCallback(
    (sender: 'ai' | 'player', text: string, senderName?: string, avatar?: string) => {
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      setChatMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          sender,
          name: senderName || (sender === 'ai' ? currentArtist.name : '我'),
          avatar: avatar || (sender === 'ai' ? currentArtist.avatar : '🎨'),
          text,
          time: timeStr,
        },
      ]);
    },
    [currentArtist]
  );

  // Sync activeChar when selectedCharId changes
  useEffect(() => {
    const list = loadSavedCharacters();
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

    // Subtle paper guide dots
    ctx.fillStyle = 'rgba(203, 213, 225, 0.3)';
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

  // Stop any active animation loop
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
  // AI DRAWING ROUND 1: LLM 现画骨架 + 开场白
  // -------------------------------------------------------------
  const startAiDrawingRound = useCallback(
    async (chosenSecret?: { word: string; category: string; hints: string[] }) => {
      stopAnimation();
      setRound('round_ai_draw');
      setPhase('ai_generating');
      setAiSecretRevealed(false);
      setDrawingRoundNumber(1);
      setAccumulatedAiStrokes([]);
      setGuessHistory([]);
      setGuessFeedback(null);
      setGuessInput('');
      clearCanvas();
      triggerSound('click');

      const activeSecret = chosenSecret || aiSecret;
      setAiSecret(activeSecret);

      const config = loadLlmConfig();
      const output = await generateDrawAndGuessOpeningAndStrokes(
        config,
        activeChar,
        activeSecret.word,
        activeSecret.category,
        currentArtist.paintingPersona
      );

      // Add character's spoken line to chat
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

      setPhase('ai_drawing');
      playStrokeBatchAnimation(pixelStrokes, [], output.drawing_quips, () => {
        setPhase('guessing');
      });
    },
    [stopAnimation, clearCanvas, triggerSound, aiSecret, activeChar, currentArtist, addChatMessage, playStrokeBatchAnimation]
  );

  // -------------------------------------------------------------
  // AI PROGRESSIVE DRAWING ROUND 2 & 3 (玩家猜错后补笔)
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

  // Switch secret word for AI
  const handleRerollAiSecretWord = useCallback(() => {
    triggerSound('click');
    const newSecret = getRandomAiSecretWord(undefined, aiSecret.word);
    setAiSecret(newSecret);
    startAiDrawingRound(newSecret);
  }, [aiSecret.word, triggerSound, startAiDrawingRound]);

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
  // PLAYER DRAWING ROUND (我画·AI猜 - 题目绝对不暴露给AI！)
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
        '“画板交给你了！信马由缰地画吧，我会在一旁认真看着的。”',
        '“我很期待你笔下的线条，画好后随时叫我来猜哦～”',
        '“来吧，画板已备好，尽情发挥你的画技吧！”',
      ];
      const randomGreeting = playerTurnGreetings[Math.floor(Math.random() * playerTurnGreetings.length)];
      addChatMessage('ai', randomGreeting);
    },
    [stopAnimation, clearCanvas, triggerSound, playerTopic, addChatMessage]
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

  // Convert mouse/touch event to exact canvas pixel coordinates
  const getCanvasPoint = useCallback((e: React.MouseEvent | React.TouchEvent): [number, number] | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    const x = Math.round((clientX - rect.left) * scaleX);
    const y = Math.round((clientY - rect.top) * scaleY);
    return [x, y];
  }, []);

  // Pointer Down (Mouse / Touch)
  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (phase !== 'player_drawing') return;
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

  // Pointer Move (Mouse / Touch)
  const handlePointerMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing || phase !== 'player_drawing') return;
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

  // Pointer Up (Mouse / Touch)
  const handlePointerUp = useCallback(() => {
    if (!isDrawing || phase !== 'player_drawing') return;
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
  }, [isDrawing, phase, isEraser, brushColor, brushSize]);

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

  // Player interacts with AI during AI Guessing (gives text hints or encouragement)
  const handlePlayerSendInteractiveMessage = useCallback(
    async (customText?: string) => {
      const text = (customText || playerInteractiveInput).trim();
      if (!text || aiIsThinking) return;

      addChatMessage('player', text);
      setPlayerInteractiveInput('');
      setAiIsThinking(true);

      const nextStage = aiGuessStage === 1 ? 2 : 3;
      setAiGuessStage(nextStage as 2 | 3);

      const semanticSummary = generateStrokeSemanticSummary(playerStrokes);
      const config = loadLlmConfig();
      try {
        if (nextStage === 2) {
          // Stage 2: AI gets very close and asks for encouragement
          const res = await generateDrawAndGuessAiGuessReaction(
            config,
            activeChar,
            2,
            playerTopic.category,
            semanticSummary,
            text
          );
          addChatMessage('ai', res.speech);
        } else {
          // Stage 3: AI excitedly guesses correctly!
          const res = await generateDrawAndGuessAiGuessReaction(
            config,
            activeChar,
            3,
            playerTopic.category,
            semanticSummary,
            text,
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
              summary: `【你画我猜】「${activeChar.name}」心领神会猜出了主控所画的【${playerTopic.word}】。`,
            });
          }
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

  // Auto-start AI Drawing Round on initial mount
  useEffect(() => {
    startAiDrawingRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full h-full flex flex-col bg-stone-950 text-white select-none overflow-hidden text-xs">
      
      {/* ================= TOP NAV BAR ================= */}
      <div className="h-11 shrink-0 px-3 bg-gradient-to-r from-stone-900 via-stone-900/90 to-stone-950 border-b border-white/10 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          {onExit && (
            <button
              onClick={onExit}
              className="py-1 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-stone-300 hover:text-white border border-white/10 flex items-center gap-1 transition active:scale-95 cursor-pointer font-medium"
            >
              <span>← 返回大厅</span>
            </button>
          )}
          <div className="flex items-center gap-1.5 font-bold text-amber-300">
            <Palette className="size-4 text-pink-400" />
            <span className="tracking-wide">你画我猜 · 笔尖默契</span>
          </div>
        </div>

        {/* Action Controls in Top Bar */}
        <div className="flex items-center gap-2">
          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled((v) => !v)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-stone-300 border border-white/10 transition cursor-pointer"
            title={soundEnabled ? '音效开启' : '音效静音'}
          >
            {soundEnabled ? <Volume2 className="size-3.5 text-emerald-400" /> : <VolumeX className="size-3.5 text-stone-500" />}
          </button>

          {/* Score Counter */}
          <div className="flex items-center gap-2 bg-black/40 px-2.5 py-1 rounded-full border border-white/10 font-mono text-[10.5px]">
            <span className="text-amber-300">你: {scores.playerWins}</span>
            <span className="text-white/30">|</span>
            <span className="text-pink-300">{currentArtist.name}: {scores.aiWins}</span>
          </div>
        </div>
      </div>

      {/* ================= MAIN TWO-COLUMN BODY ================= */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden p-2 sm:p-2.5 gap-2.5">
        
        {/* ================= LEFT MAIN CANVAS & CONTROLS ================= */}
        <div className="flex-1 flex flex-col bg-stone-900/80 border border-white/10 rounded-2xl p-2.5 shadow-xl backdrop-blur-md overflow-y-auto no-scrollbar gap-2">
          
          {/* Top Control Bar: Mode Switcher & Opponent Selector */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-white/10 shrink-0">
            {/* Mode Switcher Buttons */}
            <div className="flex items-center bg-black/60 p-1 rounded-xl border border-white/10 gap-1">
              <button
                onClick={() => {
                  setRound('round_ai_draw');
                  startAiDrawingRound();
                }}
                className={`px-3 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer flex items-center gap-1.5 ${
                  round === 'round_ai_draw'
                    ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md ring-1 ring-pink-300'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                <Bot className="size-3.5" />
                <span>AI出题（我来猜）</span>
              </button>

              <button
                onClick={() => {
                  setRound('round_player_draw');
                  startPlayerDrawingRound();
                }}
                className={`px-3 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer flex items-center gap-1.5 ${
                  round === 'round_player_draw'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-stone-950 shadow-md ring-1 ring-amber-300'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                <User className="size-3.5" />
                <span>我来画（AI来猜）</span>
              </button>
            </div>

            {/* Character Selector Pill */}
            <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-xl border border-white/10">
              <span className="text-[10px] text-stone-400">画伴:</span>
              <select
                value={selectedCharId}
                onChange={(e) => {
                  const newId = e.target.value;
                  setSelectedCharId(newId);
                  const artist = getAiArtistById(newId);
                  addChatMessage('ai', `你好呀，接下来由我「${artist.name}」来陪你玩你画我猜！`, artist.name, artist.avatar);
                }}
                className="bg-transparent text-amber-300 text-[11px] font-bold outline-none cursor-pointer"
              >
                {AI_ARTISTS.map((a) => (
                  <option key={a.id} value={a.id} className="bg-stone-900 text-white">
                    {a.avatar} {a.name}（{a.tag}）
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Secret / Topic Status Strip */}
          {round === 'round_ai_draw' ? (
            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-pink-950/30 rounded-xl border border-pink-500/30 shrink-0 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-[10.5px] text-pink-300 font-bold flex items-center gap-1">
                  <QuestionIcon className="size-3.5" />
                  <span>AI秘密题目:</span>
                </span>
                {aiSecretRevealed ? (
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/25 border border-emerald-400/50 text-emerald-200 font-bold text-sm tracking-wider flex items-center gap-1">
                    <Unlock className="size-3 text-emerald-400" />
                    <span>{aiSecret.word}</span>
                  </span>
                ) : (
                  <div className="flex items-center gap-1.5">
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
                  onClick={handleRerollAiSecretWord}
                  className="px-2 py-1 bg-white/10 hover:bg-white/15 text-pink-300 rounded-lg border border-white/10 text-[10.5px] flex items-center gap-1 transition cursor-pointer active:scale-95"
                  title="让AI重新挑一道秘密题目并现画"
                >
                  <RefreshCw className="size-3" />
                  <span>换题现画</span>
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
              <div className="flex items-center gap-2">
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
                  className="w-20 sm:w-24 px-2 py-0.5 bg-stone-800/80 border border-white/15 rounded-md text-[10.5px] text-stone-200 placeholder-stone-500 outline-none focus:border-amber-400"
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

          {/* ================= CANVAS DRAWING BOARD ================= */}
          <div className="relative w-full aspect-[520/380] max-h-[380px] bg-white rounded-2xl shadow-2xl overflow-hidden border-2 border-stone-800 cursor-crosshair shrink-0">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              style={{ width: '100%', height: '100%', display: 'block' }}
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerUp}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
            />

            {/* Status Overlay Ribbon */}
            <div className="absolute top-2 left-2 z-10 pointer-events-none flex flex-col gap-1.5">
              {phase === 'ai_generating' && (
                <div className="px-2.5 py-1 rounded-full bg-black/80 text-amber-300 font-bold text-[10.5px] backdrop-blur-sm border border-amber-400/40 flex items-center gap-1.5 shadow animate-pulse">
                  <Sparkles className="size-3.5 text-amber-400 animate-spin" />
                  <span>{currentArtist.name} 构思运笔中...</span>
                </div>
              )}

              {phase === 'ai_drawing' && (
                <div className="px-2.5 py-1 rounded-full bg-black/75 text-pink-300 font-bold text-[10.5px] backdrop-blur-sm border border-pink-400/30 flex items-center gap-1.5 shadow">
                  <Bot className="size-3.5 text-pink-400 animate-spin" />
                  <span>
                    第 {drawingRoundNumber}/3 轮作画中（{drawingRoundNumber === 1 ? '基础骨架' : drawingRoundNumber === 2 ? '细节添笔' : '画龙点睛'}）
                  </span>
                </div>
              )}

              {phase === 'guessing' && (
                <div className="px-2.5 py-1 rounded-full bg-emerald-950/85 text-emerald-300 font-bold text-[10.5px] backdrop-blur-sm border border-emerald-400/40 flex items-center gap-1.5 shadow animate-pulse">
                  <HelpCircle className="size-3.5 text-emerald-400" />
                  <span>第 {drawingRoundNumber} 轮绘画完成！请在右侧输入猜词</span>
                </div>
              )}

              {phase === 'player_drawing' && (
                <div className="px-2.5 py-1 rounded-full bg-amber-950/85 text-amber-200 font-bold text-[10.5px] backdrop-blur-sm border border-amber-400/40 flex items-center gap-1.5 shadow">
                  <User className="size-3.5 text-amber-400" />
                  <span>请在画板自由作画</span>
                </div>
              )}
            </div>

            {/* In-Game Drawing Quip Bubble (AI 作画随口小词) */}
            {activeQuip && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none animate-bounce">
                <div className="px-3 py-1.5 rounded-2xl bg-black/85 text-amber-200 text-[11px] font-bold border border-amber-400/40 shadow-xl backdrop-blur-md flex items-center gap-1.5">
                  <span>{currentArtist.avatar}</span>
                  <span>“{activeQuip}”</span>
                </div>
              </div>
            )}
          </div>

          {/* ================= BOTTOM CANVAS TOOLBAR ================= */}
          {round === 'round_player_draw' ? (
            <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-black/40 rounded-xl border border-white/10 shrink-0">
              {/* Color Palette */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-stone-400">颜色:</span>
                <div className="flex items-center gap-1">
                  {PALETTE_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => {
                        setBrushColor(c.value);
                        setIsEraser(false);
                      }}
                      className={`size-5 rounded-full border transition cursor-pointer ${
                        !isEraser && brushColor === c.value
                          ? 'border-white scale-110 shadow-md ring-2 ring-amber-400'
                          : 'border-transparent hover:scale-105 opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              {/* Brush Tools */}
              <div className="flex items-center gap-2">
                {/* Brush Size */}
                <div className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-lg border border-white/10">
                  <span className="text-[10px] text-stone-400">粗细:</span>
                  <input
                    type="range"
                    min="4"
                    max="24"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-16 h-1 accent-amber-400 cursor-pointer"
                  />
                  <span className="text-[10px] font-mono text-amber-300 w-4">{brushSize}</span>
                </div>

                {/* Eraser */}
                <button
                  onClick={() => setIsEraser((v) => !v)}
                  className={`p-1.5 rounded-lg border text-[11px] transition cursor-pointer flex items-center gap-1 ${
                    isEraser
                      ? 'bg-amber-500 text-stone-950 font-bold border-amber-400 shadow-md'
                      : 'bg-white/5 hover:bg-white/10 text-stone-300 border-white/10'
                  }`}
                  title="橡皮擦"
                >
                  <Eraser className="size-3.5" />
                  <span>橡皮</span>
                </button>

                {/* Undo */}
                <button
                  onClick={handleUndo}
                  disabled={playerStrokes.length === 0}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 text-stone-300 border border-white/10 text-[11px] transition cursor-pointer flex items-center gap-1"
                  title="撤回上一笔"
                >
                  <RotateCcw className="size-3.5" />
                  <span>撤回</span>
                </button>

                {/* Clear */}
                <button
                  onClick={handleClearPlayerBoard}
                  className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 text-[11px] transition cursor-pointer"
                  title="清空画板"
                >
                  清空
                </button>

                {/* Submit to AI */}
                {phase === 'player_drawing' && (
                  <button
                    onClick={handleFinishPlayerDrawing}
                    disabled={playerStrokes.length === 0}
                    className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 text-stone-950 font-bold rounded-lg shadow-lg border border-emerald-300 text-[11px] flex items-center gap-1.5 transition active:scale-95 cursor-pointer ml-1"
                  >
                    <Sparkles className="size-3.5" />
                    <span>画好啦，让AI来猜！</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-2 bg-black/40 rounded-xl border border-white/10 shrink-0 text-stone-300">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-pink-300 font-bold flex items-center gap-1">
                  <Sparkles className="size-3.5 text-pink-400" />
                  <span>当前画风：{currentArtist.tag}</span>
                </span>
                <span className="text-[10.5px] text-stone-400 hidden sm:inline">
                  （{currentArtist.personality}）
                </span>
              </div>

              {phase === 'guessing' && !aiSecretRevealed && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-amber-300">
                    猜错自动进入下一轮补笔（最多3轮）
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ================= RIGHT CONVERSATION & GUESSING PANEL ================= */}
        <div className="w-full md:w-80 lg:w-96 flex flex-col bg-stone-900/80 border border-white/10 rounded-2xl p-2.5 shadow-xl backdrop-blur-md overflow-hidden shrink-0">
          
          {/* Header of Chat Panel */}
          <div className="flex items-center justify-between pb-2 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-1.5">
              <MessageCircle className="size-4 text-pink-400" />
              <span className="font-bold text-stone-200">互动对话与猜词</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-stone-400">
              <span>{currentArtist.name} 在线</span>
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          </div>

          {/* Chat Bubble Stream */}
          <div
            ref={chatScrollRef}
            className="flex-1 overflow-y-auto no-scrollbar py-2.5 space-y-2.5 text-[11px]"
          >
            {chatMessages.map((msg) => {
              const isMe = msg.sender === 'player';
              return (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div className="size-6 rounded-full bg-stone-800 border border-white/10 flex items-center justify-center shrink-0 text-xs shadow">
                    {msg.avatar || (isMe ? '🎨' : currentArtist.avatar)}
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
                <div className="size-6 rounded-full bg-stone-800 border border-white/10 flex items-center justify-center shrink-0 text-xs">
                  {currentArtist.avatar}
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
              className={`p-2 rounded-xl border mb-2 text-[10.5px] flex items-center gap-1.5 shrink-0 ${
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

          {/* Input Area Based on Current Round & Phase */}
          <div className="pt-2 border-t border-white/10 shrink-0">
            {round === 'round_ai_draw' ? (
              phase === 'guessing' ? (
                <form onSubmit={handleGuessSubmit} className="flex gap-1.5">
                  <input
                    type="text"
                    value={guessInput}
                    onChange={(e) => setGuessInput(e.target.value)}
                    placeholder={`输入你猜的词语（${aiSecret.word.length}个字）...`}
                    className="flex-1 bg-stone-800/90 border border-white/15 rounded-xl px-3 py-2 text-stone-100 placeholder-stone-500 outline-none focus:border-pink-400 text-xs shadow-inner"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={!guessInput.trim()}
                    className="px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 disabled:opacity-40 text-white font-bold rounded-xl shadow-md border border-pink-300 text-xs flex items-center gap-1 transition active:scale-95 cursor-pointer"
                  >
                    <Send className="size-3.5" />
                    <span>提交</span>
                  </button>
                </form>
              ) : phase === 'roundA_success' ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleRerollAiSecretWord}
                    className="flex-1 py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white font-bold rounded-xl shadow-md text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                  >
                    <RefreshCw className="size-3.5" />
                    <span>再来一局 (AI出题)</span>
                  </button>
                  <button
                    onClick={() => {
                      setRound('round_player_draw');
                      startPlayerDrawingRound();
                    }}
                    className="py-2 px-3 bg-white/10 hover:bg-white/15 text-stone-200 font-bold rounded-xl border border-white/10 text-xs flex items-center gap-1 transition cursor-pointer"
                  >
                    <span>换我来画 →</span>
                  </button>
                </div>
              ) : (
                <div className="py-2 text-center text-stone-500 text-[11px]">
                  {phase === 'ai_generating'
                    ? 'AI 正在构思作画，请稍候...'
                    : 'AI 正在逐笔作画，请仔细观察...'}
                </div>
              )
            ) : (
              // Player Drawing Round Interactive Panel
              phase === 'player_drawing' ? (
                <div className="py-1 text-stone-400 text-[10.5px] text-center flex items-center justify-center gap-1">
                  <span>在画板挥毫作画，画完点击「画好啦，让AI来猜」</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Interactive Quick Reaction Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={handleSendQuickHint}
                      disabled={aiIsThinking || aiGuessStage >= 3}
                      className="px-2 py-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 rounded-lg text-[10px] flex items-center gap-1 transition cursor-pointer disabled:opacity-40"
                    >
                      <Lightbulb className="size-3 text-amber-400" />
                      <span>给点提示</span>
                    </button>
                    <button
                      onClick={handleSendWrongFeedback}
                      disabled={aiIsThinking || aiGuessStage >= 3}
                      className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 text-stone-300 rounded-lg text-[10px] flex items-center gap-1 transition cursor-pointer disabled:opacity-40"
                    >
                      <span>提示猜偏了</span>
                    </button>
                    <button
                      onClick={handleRevealAndPraise}
                      disabled={aiIsThinking || aiGuessStage >= 3}
                      className="px-2 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 rounded-lg text-[10px] flex items-center gap-1 transition cursor-pointer disabled:opacity-40"
                    >
                      <Award className="size-3 text-emerald-400" />
                      <span>直接公布答案</span>
                    </button>
                    <button
                      onClick={handleReplayPlayerDrawing}
                      className="px-2 py-1 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 rounded-lg text-[10px] flex items-center gap-1 transition cursor-pointer ml-auto"
                    >
                      <Play className="size-3 text-purple-400" />
                      <span>重播我的画作</span>
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
                      placeholder="和AI对话或给更多提示..."
                      disabled={aiIsThinking}
                      className="flex-1 bg-stone-800/90 border border-white/15 rounded-xl px-3 py-1.5 text-stone-100 placeholder-stone-500 outline-none focus:border-amber-400 text-xs shadow-inner disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={!playerInteractiveInput.trim() || aiIsThinking}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-stone-950 font-bold rounded-xl shadow-md text-xs flex items-center gap-1 transition active:scale-95 cursor-pointer"
                    >
                      <Send className="size-3.5" />
                      <span>发送</span>
                    </button>
                  </form>

                  {aiGuessStage >= 3 && (
                    <div className="pt-1 flex gap-2">
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
                          startAiDrawingRound();
                        }}
                        className="py-1.5 px-3 bg-white/10 hover:bg-white/15 text-stone-200 font-bold rounded-xl border border-white/10 text-xs flex items-center gap-1 transition cursor-pointer"
                      >
                        <span>换AI画 →</span>
                      </button>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
