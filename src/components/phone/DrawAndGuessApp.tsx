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
  Award
} from 'lucide-react';
import {
  WORD_CATEGORIES,
  AI_ARTISTS,
  hasPreDrawData,
  getPreDrawData,
  getRandomWord,
  getRandomAiSecretWord,
  getAiArtistById,
} from '../../data/drawAndGuessData';
import {
  getStrokeOutline,
  renderStrokeToCanvas,
  playSound,
  type StrokeData,
} from '../../lib/perfectFreehandHelper';
import {
  loadLlmConfig,
  generateDrawAndGuessAiOpening,
  generateDrawAndGuessPlayerGuessReaction,
  generateDrawAndGuessAiGuessReaction,
} from '../../lib/llm';
import { Character } from '../../data/types';
import { loadSavedCharacters } from '../../lib/customStore';

interface Props {
  currentCharacterId?: string;
  characterName?: string;
  onExit?: () => void;
}

export type GameRound = 'round_ai_draw' | 'round_player_draw';
type GamePhase =
  | 'idle'
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

interface PlayerStroke {
  points: [number, number][];
  color: string;
  size: number;
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

  // Active full character data for LLM persona
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

  // Main Mode Choice: 'round_player_draw' (我先画) or 'round_ai_draw' (AI先画)
  const [round, setRound] = useState<GameRound>('round_player_draw');
  const [phase, setPhase] = useState<GamePhase>('idle');

  // AI Drawing Secret Word State (Completely hidden from user in round_ai_draw!)
  const [aiSecret, setAiSecret] = useState<{ word: string; category: string; hints: string[] }>(() =>
    getRandomAiSecretWord()
  );
  const [aiSecretRevealed, setAiSecretRevealed] = useState<boolean>(false);
  const [aiHintLevel, setAiHintLevel] = useState<number>(0);

  // Player Drawing Topic State (Used in round_player_draw - STRICTLY HIDDEN FROM AI!)
  const [playerTopic, setPlayerTopic] = useState<{ word: string; category: string; hints: string[] }>(() =>
    getRandomWord('all')
  );
  const [playerCategory, setPlayerCategory] = useState<string>('all');
  const [customWordInput, setCustomWordInput] = useState<string>('');

  // Guessing state in AI drawing round
  const [guessInput, setGuessInput] = useState<string>('');
  const [guessAttempts, setGuessAttempts] = useState<number>(0);
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
  const [playerStrokes, setPlayerStrokes] = useState<PlayerStroke[]>([]);
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
          id: `msg_${Date.now()}_${Math.random()}`,
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
    ctx.fillStyle = 'rgba(203, 213, 225, 0.4)';
    const dotSpacing = 30;
    for (let x = 20; x < canvas.width; x += dotSpacing) {
      for (let y = 20; y < canvas.height; y += dotSpacing) {
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    }
    ctx.restore();
  }, []);

  // Cancel any running animation loop
  const stopAnimation = useCallback(() => {
    isPlayingRef.current = false;
    if (animFrameIdRef.current !== null) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
  }, []);

  // Initialize and scale canvas for HiDPI sharpness
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_WIDTH * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
    clearCanvas();
  }, [clearCanvas]);

  // -------------------------------------------------------------
  // AI DRAWING ROUND (AI画·你猜) - Strictly Secret Word Bank
  // -------------------------------------------------------------
  const startAiDrawingRound = useCallback(
    async (newSecretWordObj?: { word: string; category: string; hints: string[] }) => {
      stopAnimation();

      const activeSecret = newSecretWordObj || aiSecret;
      const strokes = getPreDrawData(activeSecret.word);
      if (!strokes || strokes.length === 0) return;

      setRound('round_ai_draw');
      setPhase('ai_drawing');
      setAiSecretRevealed(false);
      setAiHintLevel(0);
      setGuessInput('');
      setGuessFeedback(null);
      setGuessAttempts(0);
      clearCanvas();
      triggerSound('click');

      // AI speech generated via LLM or character persona (DOES NOT REVEAL THE WORD!)
      const config = loadLlmConfig();
      generateDrawAndGuessAiOpening(config, activeChar, activeSecret.category, activeSecret.word.length).then((opening) => {
        addChatMessage('ai', opening);
      });

      // Begin sequential stroke playback
      isPlayingRef.current = true;
      let strokeIdx = 0;
      let strokeStartTime = performance.now();
      const completedStrokes: StrokeData[] = [];
      let midSpoken = false;

      const animate = (timestamp: number) => {
        if (!isPlayingRef.current) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const currentStroke = strokes[strokeIdx];
        const strokeDuration = currentStroke.duration || 600;
        const elapsed = timestamp - strokeStartTime;
        const progress = Math.min(1, elapsed / strokeDuration);

        // Mid-stroke dialogue trigger
        if (!midSpoken && strokeIdx === Math.floor(strokes.length / 2)) {
          midSpoken = true;
          const midLines = currentArtist.dialogues.drawing;
          addChatMessage('ai', midLines[Math.floor(Math.random() * midLines.length)]);
        }

        const ptCount = Math.max(2, Math.floor(currentStroke.points.length * progress));
        const partialPoints = currentStroke.points.slice(0, ptCount);

        clearCanvas();

        completedStrokes.forEach((s) => {
          const outline = getStrokeOutline(s.points, {
            ...currentArtist.brushParams,
            size: s.size || currentArtist.brushParams.size || 10,
          });
          renderStrokeToCanvas(ctx, outline, s.color, false);
        });

        if (partialPoints.length >= 2) {
          const currentOutline = getStrokeOutline(partialPoints, {
            ...currentArtist.brushParams,
            size: currentStroke.size || currentArtist.brushParams.size || 10,
          });
          renderStrokeToCanvas(ctx, currentOutline, currentStroke.color, false);

          const lastPt = partialPoints[partialPoints.length - 1];
          ctx.save();
          ctx.fillStyle = currentStroke.color;
          ctx.beginPath();
          ctx.arc(lastPt[0], lastPt[1], 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }

        if (progress < 1) {
          animFrameIdRef.current = requestAnimationFrame(animate);
        } else {
          completedStrokes.push(currentStroke);
          strokeIdx++;
          if (strokeIdx < strokes.length) {
            strokeStartTime = performance.now() + 60;
            animFrameIdRef.current = requestAnimationFrame(animate);
          } else {
            isPlayingRef.current = false;
            clearCanvas();
            completedStrokes.forEach((s) => {
              const outline = getStrokeOutline(s.points, {
                ...currentArtist.brushParams,
                size: s.size || currentArtist.brushParams.size || 10,
              });
              renderStrokeToCanvas(ctx, outline, s.color, false);
            });

            setPhase('guessing');
            triggerSound('complete');

            const finishLines = currentArtist.dialogues.finishDraw;
            addChatMessage(
              'ai',
              `${finishLines[Math.floor(Math.random() * finishLines.length)]} 题目共有【${activeSecret.word.length}个字】，快在右侧猜猜看是什么吧！`
            );
          }
        }
      };

      animFrameIdRef.current = requestAnimationFrame(animate);
    },
    [stopAnimation, aiSecret, clearCanvas, triggerSound, activeChar, currentArtist, addChatMessage]
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
      const newAttempts = guessAttempts + 1;
      setGuessAttempts(newAttempts);
      setGuessInput('');

      // Check guess against secret word
      const isMatch =
        trimmed === aiSecret.word ||
        trimmed.includes(aiSecret.word) ||
        aiSecret.word.includes(trimmed);

      const config = loadLlmConfig();
      const subtleHint = aiSecret.hints[Math.min(aiHintLevel, aiSecret.hints.length - 1)];

      if (isMatch) {
        triggerSound('correct');
        setAiSecretRevealed(true);
        setGuessFeedback({
          correct: true,
          text: `🎉 太神啦！完全猜对！答案正是【${aiSecret.word}】！`,
        });
        setScores((prev) => ({ ...prev, playerWins: prev.playerWins + 1 }));
        setPhase('roundA_success');

        generateDrawAndGuessPlayerGuessReaction(config, activeChar, aiSecret.word, trimmed, true, newAttempts).then(
          (reply) => addChatMessage('ai', reply)
        );
      } else {
        triggerSound('wrong');

        if (newAttempts >= 2 && aiHintLevel === 0 && aiSecret.hints.length > 0) {
          setAiHintLevel(1);
        } else if (newAttempts >= 4 && aiHintLevel < aiSecret.hints.length) {
          setAiHintLevel((v) => Math.min(v + 1, aiSecret.hints.length));
        }

        setGuessFeedback({
          correct: false,
          text: `不对哦，再仔细端详一下画面的线条与神韵吧~`,
        });

        generateDrawAndGuessPlayerGuessReaction(
          config,
          activeChar,
          aiSecret.word,
          trimmed,
          false,
          newAttempts,
          subtleHint
        ).then((reply) => addChatMessage('ai', reply));
      }
    },
    [guessInput, phase, aiSecret, triggerSound, activeChar, addChatMessage, guessAttempts, aiHintLevel]
  );

  // Give up and reveal secret answer
  const handleGiveUpAndReveal = useCallback(() => {
    triggerSound('click');
    setAiSecretRevealed(true);
    setPhase('roundA_success');
    setGuessFeedback({
      correct: false,
      text: `已揭晓答案：【${aiSecret.word}】（${aiSecret.category}）`,
    });
    addChatMessage('ai', `这道题的答案其实是【${aiSecret.word}】哦！没关系，下一盘我们再战！`);
  }, [aiSecret, triggerSound, addChatMessage]);

  // -------------------------------------------------------------
  // PLAYER DRAWING ROUND (你画·AI猜 - 题目绝对不暴露给AI！)
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
      const newStroke: PlayerStroke = {
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

    const config = loadLlmConfig();
    try {
      // Stage 1: AI purposefully guesses wrong and asks for clues
      const reply = await generateDrawAndGuessAiGuessReaction(
        config,
        activeChar,
        1,
        playerTopic.category,
        playerStrokes.length
      );
      addChatMessage('ai', reply);
    } finally {
      setAiIsThinking(false);
    }
  }, [playerStrokes.length, stopAnimation, triggerSound, addChatMessage, activeChar, playerTopic.category]);

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

      const config = loadLlmConfig();
      try {
        if (nextStage === 2) {
          // Stage 2: AI gets very close and asks for confirmation/encouragement
          const reply = await generateDrawAndGuessAiGuessReaction(
            config,
            activeChar,
            2,
            playerTopic.category,
            playerStrokes.length,
            text
          );
          addChatMessage('ai', reply);
        } else {
          // Stage 3: AI excitedly guesses correctly!
          const reply = await generateDrawAndGuessAiGuessReaction(
            config,
            activeChar,
            3,
            playerTopic.category,
            playerStrokes.length,
            text,
            playerTopic.word
          );
          addChatMessage('ai', reply);
          triggerSound('correct');
          setScores((prev) => ({ ...prev, aiWins: prev.aiWins + 1 }));
        }
      } finally {
        setAiIsThinking(false);
      }
    },
    [playerInteractiveInput, aiIsThinking, aiGuessStage, activeChar, playerTopic, playerStrokes.length, addChatMessage, triggerSound]
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

    const config = loadLlmConfig();
    try {
      const reply = await generateDrawAndGuessAiGuessReaction(
        config,
        activeChar,
        3,
        playerTopic.category,
        playerStrokes.length,
        '揭晓答案',
        playerTopic.word
      );
      addChatMessage('ai', reply);
      triggerSound('correct');
      setScores((prev) => ({ ...prev, aiWins: prev.aiWins + 1 }));
    } finally {
      setAiIsThinking(false);
    }
  }, [aiIsThinking, playerTopic, playerStrokes.length, activeChar, addChatMessage, triggerSound]);

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
    const completed: PlayerStroke[] = [];

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

  // Start with chosen mode on initial mount
  useEffect(() => {
    if (round === 'round_player_draw') {
      startPlayerDrawingRound();
    }
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
          
          {/* Top Control Bar: Player Selects Who Draws First */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-white/10 shrink-0">
            {/* Mode Switcher Buttons */}
            <div className="flex items-center bg-black/60 p-1 rounded-xl border border-white/10 gap-1">
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
                <span>我先画（AI来猜）</span>
              </button>

              <button
                onClick={() => {
                  setRound('round_ai_draw');
                  setPhase('idle');
                  stopAnimation();
                  clearCanvas();
                }}
                className={`px-3 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer flex items-center gap-1.5 ${
                  round === 'round_ai_draw'
                    ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md ring-1 ring-pink-300'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                <Bot className="size-3.5" />
                <span>AI先画（我来猜）</span>
              </button>
            </div>

            {/* Mode-Specific Status / Category Pick */}
            {round === 'round_player_draw' ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <select
                  value={playerCategory}
                  onChange={(e) => {
                    setPlayerCategory(e.target.value);
                    const pick = getRandomWord(e.target.value);
                    setPlayerTopic(pick);
                    startPlayerDrawingRound(pick);
                  }}
                  className="bg-stone-800 border border-white/15 text-stone-200 rounded-lg px-2 py-1 text-[10.5px] cursor-pointer outline-none focus:border-amber-400"
                >
                  <option value="all">🌟 全部分类</option>
                  {WORD_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji} {c.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleRerollPlayerWord}
                  className="px-2 py-1 bg-white/10 hover:bg-white/15 text-amber-300 rounded-lg border border-white/10 text-[10.5px] flex items-center gap-1 transition cursor-pointer active:scale-95"
                  title="随机换一道画题"
                >
                  <RefreshCw className="size-3" />
                  <span>换个题目</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-pink-300 bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <QuestionIcon className="size-3 text-pink-400" />
                  <span>题目已加密 · 凭画技猜词</span>
                </span>
                <button
                  onClick={handleRerollAiSecretWord}
                  className="px-2 py-1 bg-white/10 hover:bg-white/15 text-pink-300 rounded-lg border border-white/10 text-[10.5px] flex items-center gap-1 transition cursor-pointer active:scale-95"
                  title="让AI重新挑一道秘密题目"
                >
                  <RefreshCw className="size-3" />
                  <span>重挑题目</span>
                </button>
              </div>
            )}
          </div>

          {/* Topic Strip: STRICTLY FOR PLAYER ONLY in round_player_draw */}
          {round === 'round_player_draw' ? (
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
                  className="px-2 py-0.5 bg-white/10 hover:bg-white/15 text-stone-200 rounded-md border border-white/10 text-[10.5px] cursor-pointer"
                >
                  设定
                </button>
              </div>
            </div>
          ) : (
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
                      （{aiSecret.word.length}个字 · {aiSecret.category}）
                    </span>
                  </div>
                )}
              </div>

              {phase === 'ai_drawing' && (
                <span className="text-[10px] text-pink-300 animate-pulse flex items-center gap-1">
                  <span className="inline-block size-1.5 rounded-full bg-pink-400 animate-ping" />
                  {currentArtist.name} 挥毫作画中...
                </span>
              )}

              {phase === 'guessing' && !aiSecretRevealed && (
                <button
                  onClick={handleGiveUpAndReveal}
                  className="text-[10px] text-stone-400 hover:text-pink-300 underline cursor-pointer transition"
                >
                  认输揭晓答案
                </button>
              )}
            </div>
          )}

          {/* ================= CANVAS DRAWING BOARD ================= */}
          <div className="relative w-full aspect-[520/380] max-h-[380px] bg-white rounded-2xl shadow-2xl overflow-hidden border-2 border-stone-800 cursor-crosshair shrink-0">
            <canvas
              ref={canvasRef}
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
            <div className="absolute top-2 left-2 z-10 pointer-events-none">
              {phase === 'ai_drawing' && (
                <div className="px-2.5 py-1 rounded-full bg-black/75 text-pink-300 font-bold text-[10.5px] backdrop-blur-sm border border-pink-400/30 flex items-center gap-1.5 shadow">
                  <Bot className="size-3.5 text-pink-400 animate-spin" />
                  <span>AI 作画回放中 · 观察笔锋与轮廓...</span>
                </div>
              )}
              {phase === 'guessing' && (
                <div className="px-2.5 py-1 rounded-full bg-emerald-950/85 text-emerald-300 font-bold text-[10.5px] backdrop-blur-sm border border-emerald-400/40 flex items-center gap-1.5 shadow animate-pulse">
                  <HelpCircle className="size-3.5 text-emerald-400" />
                  <span>AI 绘画完成！请在右侧输入你猜的词语</span>
                </div>
              )}
              {phase === 'player_drawing' && (
                <div className="px-2.5 py-1 rounded-full bg-amber-950/85 text-amber-200 font-bold text-[10.5px] backdrop-blur-sm border border-amber-400/40 flex items-center gap-1.5 shadow">
                  <User className="size-3.5 text-amber-400" />
                  <span>请在画板自由绘制</span>
                </div>
              )}
              {phase === 'player_replaying' && (
                <div className="px-2.5 py-1 rounded-full bg-purple-950/85 text-purple-200 font-bold text-[10.5px] backdrop-blur-sm border border-purple-400/40 flex items-center gap-1.5 shadow animate-pulse">
                  <Play className="size-3.5 text-purple-400" />
                  <span>正在逐笔回放你的手绘轨迹...</span>
                </div>
              )}
            </div>

            {/* Hint Display in AI Draw Guessing Phase */}
            {round === 'round_ai_draw' && phase === 'guessing' && aiHintLevel > 0 && (
              <div className="absolute bottom-2 left-2 z-10 bg-black/85 px-3 py-1.5 rounded-xl border border-amber-400/40 text-amber-200 text-[10px] max-w-xs shadow">
                <span className="font-bold text-amber-300">💡 提示：</span>
                {aiSecret.hints.slice(0, aiHintLevel).join(' · ')}
              </div>
            )}
          </div>

          {/* ================= CANVAS TOOLBAR & ACTION STRIP ================= */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {/* If in Player Drawing Mode: Color Palette & Brush Tools */}
            {round === 'round_player_draw' && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Color Swatches */}
                <div className="flex items-center gap-1 p-1 bg-black/40 rounded-xl border border-white/10">
                  {PALETTE_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => {
                        setBrushColor(c.value);
                        setIsEraser(false);
                      }}
                      style={{ backgroundColor: c.value }}
                      className={`size-5 rounded-full transition-transform cursor-pointer border ${
                        !isEraser && brushColor === c.value
                          ? 'scale-125 border-white ring-2 ring-amber-400'
                          : 'border-white/20 hover:scale-110'
                      }`}
                      title={c.name}
                    />
                  ))}
                </div>

                {/* Eraser Button */}
                <button
                  onClick={() => setIsEraser((v) => !v)}
                  className={`p-1.5 rounded-xl border transition cursor-pointer flex items-center gap-1 text-[10.5px] ${
                    isEraser
                      ? 'bg-amber-400 text-stone-950 font-bold border-amber-300 shadow'
                      : 'bg-white/5 hover:bg-white/10 text-stone-300 border-white/10'
                  }`}
                  title="橡皮擦"
                >
                  <Eraser className="size-3.5" />
                  <span>橡皮</span>
                </button>

                {/* Brush Size Selector */}
                <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-xl border border-white/10">
                  <span className="text-[10px] text-white/50">粗细:</span>
                  {[6, 11, 18].map((s) => (
                    <button
                      key={s}
                      onClick={() => setBrushSize(s)}
                      className={`size-4 rounded-full flex items-center justify-center transition ${
                        brushSize === s ? 'bg-amber-400' : 'bg-white/20 hover:bg-white/40'
                      }`}
                      title={`笔触粗细 ${s}px`}
                    >
                      <span
                        className="rounded-full bg-stone-950"
                        style={{ width: s / 2.5, height: s / 2.5 }}
                      />
                    </button>
                  ))}
                </div>

                {/* Undo Button */}
                <button
                  onClick={handleUndo}
                  disabled={playerStrokes.length === 0}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-stone-300 border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                  title="撤销上一笔"
                >
                  <RotateCcw className="size-3.5" />
                </button>

                {/* Clear Button */}
                <button
                  onClick={handleClearPlayerBoard}
                  className="px-2 py-1 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-400/30 text-[10.5px] transition cursor-pointer"
                >
                  清屏
                </button>
              </div>
            )}

            {/* Action Buttons for Round States */}
            <div className="flex items-center gap-2 ml-auto">
              {round === 'round_ai_draw' && (
                <>
                  {phase === 'idle' && (
                    <button
                      onClick={() => startAiDrawingRound()}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 text-white font-bold text-[11px] shadow-lg hover:scale-105 active:scale-95 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Play className="size-3.5" />
                      <span>开始 AI 绘画（准备猜词）</span>
                    </button>
                  )}

                  {phase === 'ai_drawing' && (
                    <button
                      onClick={stopAnimation}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-stone-300 text-[11px] transition cursor-pointer"
                    >
                      暂停
                    </button>
                  )}

                  {phase === 'roundA_success' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleRerollAiSecretWord}
                        className="px-3 py-1.5 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 text-pink-200 border border-pink-400/40 text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                      >
                        <RefreshCw className="size-3" />
                        <span>再猜一局</span>
                      </button>

                      <button
                        onClick={() => {
                          setRound('round_player_draw');
                          startPlayerDrawingRound();
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-stone-950 font-bold text-[11px] shadow-lg hover:scale-105 active:scale-95 transition cursor-pointer flex items-center gap-1.5"
                      >
                        <span>换我来画（AI猜）</span>
                        <ChevronRight className="size-3.5" />
                      </button>
                    </div>
                  )}
                </>
              )}

              {round === 'round_player_draw' && (
                <>
                  {phase === 'player_drawing' && (
                    <button
                      onClick={handleFinishPlayerDrawing}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-stone-950 font-bold text-[11px] shadow-lg hover:scale-105 active:scale-95 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="size-3.5" />
                      <span>完成绘画，让TA猜！</span>
                    </button>
                  )}

                  {phase === 'player_finished' && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleReplayPlayerDrawing}
                        className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-400/40 text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                      >
                        <Play className="size-3" />
                        <span>🎬 回放画作</span>
                      </button>

                      <button
                        onClick={handleRerollPlayerWord}
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-stone-950 font-bold text-[11px] shadow-lg hover:scale-105 active:scale-95 transition cursor-pointer flex items-center gap-1.5"
                      >
                        <span>再画一局</span>
                        <ChevronRight className="size-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          setRound('round_ai_draw');
                          setPhase('idle');
                          stopAnimation();
                          clearCanvas();
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 text-pink-200 border border-pink-400/40 text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                      >
                        <span>换AI来画（我猜）</span>
                        <ChevronRight className="size-3.5" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ================= RIGHT SIDEBAR: AI CHARACTER & CHAT STREAM ================= */}
        <div className="w-full md:w-80 shrink-0 flex flex-col bg-stone-900/80 border border-white/10 rounded-2xl p-2.5 shadow-xl backdrop-blur-md gap-2.5 overflow-hidden">
          
          {/* AI Artist Character Switcher & Card */}
          <div className="p-2 rounded-xl bg-gradient-to-br from-stone-950/60 to-black/60 border border-white/10 space-y-1.5 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{currentArtist.avatar}</span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white text-[11.5px]">{currentArtist.name}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-pink-500/30 text-pink-200 border border-pink-400/30">
                      {currentArtist.tag}
                    </span>
                  </div>
                  <span className="text-[9px] text-white/50">{currentArtist.title}</span>
                </div>
              </div>

              {/* Character Switch Dropdown */}
              <select
                value={selectedCharId}
                onChange={(e) => {
                  setSelectedCharId(e.target.value);
                  const char = getAiArtistById(e.target.value);
                  addChatMessage(
                    'ai',
                    `画笔已交由我【${char.name}】执掌！${char.personality}`
                  );
                }}
                className="bg-stone-800 border border-white/20 text-stone-200 rounded-lg px-2 py-0.5 text-[10px] outline-none cursor-pointer"
              >
                {AI_ARTISTS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.avatar} {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Chat Messages Log */}
          <div className="flex-1 flex flex-col min-h-[180px] bg-black/40 rounded-xl border border-white/5 p-2 overflow-hidden">
            <div className="text-[10px] text-white/40 pb-1 mb-1 border-b border-white/5 flex items-center justify-between font-mono">
              <span className="flex items-center gap-1">
                <MessageCircle className="size-3 text-pink-400" />
                <span>局内实时互动</span>
              </span>
              <span className="text-emerald-400">● 实时在线</span>
            </div>

            <div ref={chatScrollRef} className="flex-1 overflow-y-auto space-y-2 pr-1 no-scrollbar text-[11px]">
              {chatMessages.map((msg) => {
                const isAi = msg.sender === 'ai';
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-1.5 ${isAi ? 'flex-row' : 'flex-row-reverse'}`}
                  >
                    <span className="text-sm shrink-0">{isAi ? msg.avatar || '🤖' : '🎨'}</span>
                    <div
                      className={`max-w-[84%] rounded-xl p-2 leading-relaxed shadow-sm ${
                        isAi
                          ? 'bg-stone-800 text-stone-200 rounded-tl-none border border-white/5'
                          : 'bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-tr-none'
                      }`}
                    >
                      <div className="text-[9px] opacity-60 mb-0.5 flex items-center justify-between gap-1">
                        <span>{msg.name}</span>
                        <span>{msg.time}</span>
                      </div>
                      <div>{msg.text}</div>
                    </div>
                  </div>
                );
              })}

              {aiIsThinking && (
                <div className="flex items-center gap-1.5 text-[10px] text-pink-300/80 italic p-1 animate-pulse">
                  <Bot className="size-3 animate-spin text-pink-400" />
                  <span>{currentArtist.name} 正在仔细端详画布并思索...</span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Interactive Area */}
          <div className="space-y-1.5 shrink-0">
            {round === 'round_ai_draw' ? (
              <form onSubmit={handleGuessSubmit} className="space-y-1.5">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    disabled={phase !== 'guessing'}
                    placeholder={
                      phase === 'ai_drawing'
                        ? '等待AI作画完成中...'
                        : phase === 'guessing'
                        ? `猜猜是什么？(${aiSecret.word.length}个字)`
                        : '点击开始AI绘画进入猜词'
                    }
                    value={guessInput}
                    onChange={(e) => setGuessInput(e.target.value)}
                    className="w-full pl-3 pr-16 py-2 bg-stone-800/90 border border-white/20 rounded-xl text-xs text-white placeholder-stone-400 outline-none focus:border-pink-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-inner"
                  />
                  <button
                    type="submit"
                    disabled={phase !== 'guessing' || !guessInput.trim()}
                    className="absolute right-1.5 px-2.5 py-1 rounded-lg bg-pink-500 hover:bg-pink-400 disabled:bg-stone-700 text-white font-bold text-[10.5px] transition cursor-pointer flex items-center gap-1 shadow"
                  >
                    <span>提交</span>
                    <Send className="size-3" />
                  </button>
                </div>

                {/* Guess Feedback Message */}
                {guessFeedback && (
                  <div
                    className={`p-2 rounded-xl text-[10.5px] flex items-center gap-1.5 border shadow ${
                      guessFeedback.correct
                        ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                        : 'bg-red-500/20 border-red-400/50 text-red-200'
                    }`}
                  >
                    {guessFeedback.correct ? (
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertCircle className="size-4 shrink-0 text-red-400" />
                    )}
                    <span>{guessFeedback.text}</span>
                  </div>
                )}
              </form>
            ) : (
              /* Player Drawing Round: Natural Interactive Chat & Hint Chips */
              <div className="space-y-1.5">
                {phase === 'player_finished' && aiGuessStage > 0 && aiGuessStage < 3 && (
                  <div className="flex items-center gap-1 flex-wrap pb-0.5">
                    <button
                      onClick={handleSendQuickHint}
                      disabled={aiIsThinking}
                      className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 text-[10px] flex items-center gap-1 transition cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      <Lightbulb className="size-3 text-amber-300" />
                      <span>给TA一点提示</span>
                    </button>
                    <button
                      onClick={handleSendWrongFeedback}
                      disabled={aiIsThinking}
                      className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-stone-300 border border-white/10 text-[10px] flex items-center gap-1 transition cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      <span>猜错啦，再猜！</span>
                    </button>
                    <button
                      onClick={handleRevealAndPraise}
                      disabled={aiIsThinking}
                      className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 text-[10px] flex items-center gap-1 transition cursor-pointer active:scale-95 disabled:opacity-50 ml-auto"
                    >
                      <Award className="size-3 text-emerald-400" />
                      <span>揭晓答案</span>
                    </button>
                  </div>
                )}

                <div className="relative flex items-center">
                  <input
                    type="text"
                    placeholder={
                      phase === 'player_drawing'
                        ? '在画板绘制中，画好后让TA猜～'
                        : aiGuessStage === 3
                        ? 'TA已经猜中啦！可点击下方再画一局'
                        : '打字给TA提示或聊两句...'
                    }
                    disabled={phase === 'player_drawing' || aiIsThinking || aiGuessStage === 3}
                    value={playerInteractiveInput}
                    onChange={(e) => setPlayerInteractiveInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && playerInteractiveInput.trim()) {
                        e.preventDefault();
                        handlePlayerSendInteractiveMessage();
                      }
                    }}
                    className="w-full pl-3 pr-16 py-2 bg-stone-800/90 border border-white/20 rounded-xl text-xs text-white placeholder-stone-400 outline-none focus:border-amber-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => handlePlayerSendInteractiveMessage()}
                    disabled={phase === 'player_drawing' || aiIsThinking || !playerInteractiveInput.trim() || aiGuessStage === 3}
                    className="absolute right-1.5 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-stone-700 text-stone-950 font-bold text-[10.5px] transition cursor-pointer flex items-center gap-1 shadow"
                  >
                    <span>发送</span>
                    <Send className="size-3" />
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
