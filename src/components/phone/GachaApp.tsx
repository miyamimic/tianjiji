import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload,
  RotateCcw,
  Sparkles,
  Check,
  Send,
  Sliders,
  MessageSquare,
  Eye,
  EyeOff,
  Trash2,
  Plus,
} from 'lucide-react';

export interface CircleButtonArea {
  cx: number; // percentage 0-100
  cy: number; // percentage 0-100
  r: number;  // radius percentage 0-100
}

export interface GachaCardItem {
  id: string;
  name: string;
  rarity: 'SSR' | 'SR' | 'R';
  image: string;
  description?: string;
}

export interface LayeredGachaConfig {
  bgImage: string;        // Layer 1: 底图
  characterImage: string; // Layer 2: 卡池人物图
  frameImage: string;     // Layer 3: 免扣边框图 (最上层)

  // 3 calibrated button circles based on frame layer
  exitCircle: CircleButtonArea;     // 退出抽卡
  pullOnceCircle: CircleButtonArea; // 抽一次
  pullTenCircle: CircleButtonArea;  // 抽十次

  rates: {
    SSR: number;
    SR: number;
    R: number;
  };
  cards: GachaCardItem[];
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'character';
  text: string;
  timestamp: number;
}

// Built-in default preset with layered greeting-card effect
const DEFAULT_FRAME_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 450 800" width="450" height="800">
  <defs>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a" />
      <stop offset="50%" stop-color="#eab308" />
      <stop offset="100%" stop-color="#ca8a04" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity="0.6"/>
    </filter>
  </defs>

  <!-- Ornate Outer Frame Border with cutout center -->
  <rect x="8" y="8" width="434" height="784" rx="28" fill="none" stroke="url(#gold)" stroke-width="5" filter="url(#shadow)" />
  <rect x="16" y="16" width="418" height="768" rx="24" fill="none" stroke="#fef08a" stroke-width="1.5" stroke-opacity="0.7" />

  <!-- Top Vignette Header Overlay -->
  <path d="M 16 16 L 434 16 L 434 80 C 350 90, 280 110, 225 110 C 170 110, 100 90, 16 80 Z" fill="#0c0a09" fill-opacity="0.85" />
  
  <!-- Exit Button Placeholder on Frame (Top Left) -->
  <g id="frame-exit" filter="url(#shadow)">
    <circle cx="55" cy="55" r="24" fill="#1c1917" stroke="url(#gold)" stroke-width="2.5" />
    <path d="M 45 45 L 65 65 M 65 45 L 45 65" stroke="#fef08a" stroke-width="3" stroke-linecap="round" />
  </g>

  <!-- Top Title Banner -->
  <text x="225" y="58" fill="#fef08a" font-size="18" font-weight="bold" font-family="sans-serif" text-anchor="middle" letter-spacing="3">✦ 限定共鸣卡池 ✦</text>

  <!-- Bottom Console Panel Overlay -->
  <path d="M 16 670 C 120 650, 330 650, 434 670 L 434 784 L 16 784 Z" fill="#0c0a09" fill-opacity="0.9" filter="url(#shadow)" />
  <line x1="20" y1="675" x2="430" y2="675" stroke="url(#gold)" stroke-width="2" />

  <!-- Pull 1 Button Circle Placeholder on Frame (Bottom Left) -->
  <g id="frame-pull-once" filter="url(#shadow)">
    <circle cx="130" cy="728" r="36" fill="#1c1917" stroke="url(#gold)" stroke-width="3" />
    <circle cx="130" cy="728" r="31" fill="#292524" />
    <text x="130" y="725" fill="#fef08a" font-size="13" font-weight="bold" font-family="sans-serif" text-anchor="middle">单抽</text>
    <text x="130" y="742" fill="#a8a29e" font-size="10" font-family="sans-serif" text-anchor="middle">1 抽</text>
  </g>

  <!-- Pull 10 Button Circle Placeholder on Frame (Bottom Right) -->
  <g id="frame-pull-ten" filter="url(#shadow)">
    <circle cx="320" cy="728" r="38" fill="url(#gold)" stroke="#fef08a" stroke-width="3" />
    <circle cx="320" cy="728" r="33" fill="#ca8a04" />
    <text x="320" y="725" fill="#0c0a09" font-size="14" font-weight="900" font-family="sans-serif" text-anchor="middle">十连</text>
    <text x="320" y="742" fill="#451a03" font-size="10" font-weight="bold" font-family="sans-serif" text-anchor="middle">必得 SR</text>
  </g>
</svg>
`)}`;

const DEFAULT_CONFIG: LayeredGachaConfig = {
  // Layer 1: 底图
  bgImage: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1000&auto=format&fit=crop',
  // Layer 2: 卡池人物图
  characterImage: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=800&auto=format&fit=crop',
  // Layer 3: 免扣边框图 (最上层)
  frameImage: DEFAULT_FRAME_SVG,

  // Initial calibrated buttons on frame
  exitCircle: { cx: 12.2, cy: 6.9, r: 6.5 },
  pullOnceCircle: { cx: 28.9, cy: 91.0, r: 9.0 },
  pullTenCircle: { cx: 71.1, cy: 91.0, r: 9.5 },

  rates: {
    SSR: 0.03,
    SR: 0.15,
    R: 0.82,
  },
  cards: [
    {
      id: 'card_ssr_1',
      name: '夜蔷薇 · 莉莉丝',
      rarity: 'SSR',
      image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=800&auto=format&fit=crop',
      description: '限定UP角色 · 绝美魅影',
    },
    {
      id: 'card_ssr_2',
      name: '极光巡礼 · 艾尔温',
      rarity: 'SSR',
      image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=800&auto=format&fit=crop',
      description: '限定UP角色 · 星穹之剑',
    },
    {
      id: 'card_sr_1',
      name: '月影秘术师',
      rarity: 'SR',
      image: 'https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=600&auto=format&fit=crop',
      description: '秘银法杖之影',
    },
    {
      id: 'card_sr_2',
      name: '狂岚猎手',
      rarity: 'SR',
      image: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=600&auto=format&fit=crop',
      description: '疾风破空之矢',
    },
    {
      id: 'card_r_1',
      name: '见习骑士 · 铜剑',
      rarity: 'R',
      image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop',
      description: '基础共鸣之源',
    },
    {
      id: 'card_r_2',
      name: '魔导晶石',
      rarity: 'R',
      image: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?q=80&w=600&auto=format&fit=crop',
      description: '基础材料之源',
    },
  ],
};

const STORAGE_KEY = 'tiancuji_layered_gacha_v1';

interface Props {
  onExit?: () => void;
  currentCharacterId?: string;
  characterName?: string;
  character?: any;
  currentEmotionSnapshot?: any;
  onGameFinished?: (...args: any[]) => void;
  onApplyGameEmotionDelta?: (...args: any[]) => void;
  onInGameChat?: (
    text: string,
    context?: any,
    history?: any[]
  ) => Promise<string | { reply: string; tactic?: string } | null | void>;
}

export default function GachaApp({
  onExit,
  characterName = '陆沉',
  character,
  onInGameChat,
}: Props) {
  // Config state
  const [config, setConfig] = useState<LayeredGachaConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.bgImage && parsed.frameImage && parsed.rates) {
          return { ...DEFAULT_CONFIG, ...parsed };
        }
      }
    } catch (e) {
      console.warn('Failed to load gacha config:', e);
    }
    return DEFAULT_CONFIG;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.warn('Failed to save gacha config:', e);
    }
  }, [config]);

  // Pull Results State
  const [pullResults, setPullResults] = useState<GachaCardItem[] | null>(null);

  // Right Side View: 'chat' (聊天地方) or 'settings' (卡池与图层定制)
  const [rightView, setRightView] = useState<'chat' | 'settings'>('chat');
  const [settingsTab, setSettingsTab] = useState<'layers' | 'brush' | 'cards'>('layers');

  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'init_1',
      sender: 'character',
      text: `${characterName || '我'}已在卡池旁守候。点击左侧的卡池，看看今天的共鸣契机。`,
      timestamp: Date.now(),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Brush Circle Calibration State
  const [activeBrushTarget, setActiveBrushTarget] = useState<'exit' | 'pull_once' | 'pull_ten'>('exit');
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawnPoints, setDrawnPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [confirmationNotice, setConfirmationNotice] = useState<string | null>(null);
  const [showHotZoneOutline, setShowHotZoneOutline] = useState(true);

  // New Card Form State
  const [newCardName, setNewCardName] = useState('');
  const [newCardRarity, setNewCardRarity] = useState<'SSR' | 'SR' | 'R'>('SSR');
  const [newCardImage, setNewCardImage] = useState('');

  // Canvas Refs for Brush Circle Calibration
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (rightView === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, rightView]);

  // Send Chat Message
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || chatInput).trim();
    if (!text || isSending) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text,
      timestamp: Date.now(),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setChatInput('');
    setIsSending(true);

    try {
      let charReply = '';
      if (onInGameChat) {
        const res = await onInGameChat(
          text,
          {
            scene: 'gacha_pool',
            characterName,
            rates: config.rates,
          },
          [...chatMessages, userMsg]
        );
        if (typeof res === 'object' && res !== null && 'reply' in res) {
          charReply = res.reply;
        } else if (typeof res === 'string') {
          charReply = res;
        }
      }

      if (!charReply) {
        // Natural contextual fallback replies
        const fallbacks = [
          `无论抽到什么，都由我陪着你。`,
          `深呼吸，把手交给我，再试一次。`,
          `命运的罗盘在转动，你想要的那张卡，随时都会显现。`,
          `我在看着你，不必焦虑，放松享受当下的共鸣。`,
        ];
        charReply = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      }

      setChatMessages((prev) => [
        ...prev,
        {
          id: `char_${Date.now()}`,
          sender: 'character',
          text: charReply,
          timestamp: Date.now(),
        },
      ]);
    } catch (err) {
      console.warn('Chat error:', err);
    } finally {
      setIsSending(false);
    }
  };

  // Perform Gacha Pull
  const doPull = useCallback((count: number) => {
    const ssrCards = config.cards.filter((c) => c.rarity === 'SSR');
    const srCards = config.cards.filter((c) => c.rarity === 'SR');
    const rCards = config.cards.filter((c) => c.rarity === 'R');

    const results: GachaCardItem[] = [];

    for (let i = 0; i < count; i++) {
      const rand = Math.random();
      let pickedRarity: 'SSR' | 'SR' | 'R' = 'R';

      if (rand < config.rates.SSR && ssrCards.length > 0) {
        pickedRarity = 'SSR';
      } else if (rand < config.rates.SSR + config.rates.SR && srCards.length > 0) {
        pickedRarity = 'SR';
      } else {
        pickedRarity = 'R';
      }

      // 10-pull guarantee: at least one SR or above
      if (count === 10 && i === 9 && !results.some((c) => c.rarity === 'SSR' || c.rarity === 'SR')) {
        pickedRarity = srCards.length > 0 ? 'SR' : 'SSR';
      }

      const poolOfRarity =
        pickedRarity === 'SSR' ? ssrCards : pickedRarity === 'SR' ? srCards : rCards;

      const chosen = poolOfRarity.length > 0
        ? poolOfRarity[Math.floor(Math.random() * poolOfRarity.length)]
        : config.cards[0] || {
            id: 'fallback',
            name: '神秘记忆碎片',
            rarity: 'R',
            image: config.characterImage,
          };

      results.push(chosen);
    }

    setPullResults(results);

    // Contextual reaction in chat
    const hasSSR = results.some((r) => r.rarity === 'SSR');
    const hasSR = results.some((r) => r.rarity === 'SR');

    const reactionText = hasSSR
      ? `【金光闪烁】抽到了SSR「${results.find((r) => r.rarity === 'SSR')?.name}」！恭喜，愿望在此刻实现了。`
      : hasSR
      ? `【紫辉共鸣】获得SR「${results.find((r) => r.rarity === 'SR')?.name}」，光芒正在汇聚。`
      : count === 10
      ? `十连共鸣完成。所有的积蓄，都是为了下一次更耀眼的邂逅。`
      : `单抽轻响。心愿沉淀在指尖，继续前行吧。`;

    setChatMessages((prev) => [
      ...prev,
      {
        id: `char_pull_${Date.now()}`,
        sender: 'character',
        text: reactionText,
        timestamp: Date.now(),
      },
    ]);
  }, [config, characterName]);

  // File Upload Helper
  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    callback: (dataUrl: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        callback(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ============================================================================
  // Brush Canvas Drawing & Circle Auto-Detection
  // ============================================================================
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (config.frameImage) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        drawCirclesAndStrokes(ctx, width, height);
      };
      img.src = config.frameImage;
      if (img.complete) {
        ctx.drawImage(img, 0, 0, width, height);
        drawCirclesAndStrokes(ctx, width, height);
      }
    } else {
      drawCirclesAndStrokes(ctx, width, height);
    }
  }, [config.frameImage, config.exitCircle, config.pullOnceCircle, config.pullTenCircle, drawnPoints, activeBrushTarget]);

  const drawCirclesAndStrokes = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const targets = [
      { key: 'exit', circle: config.exitCircle, color: '#ef4444', label: '退出' },
      { key: 'pull_once', circle: config.pullOnceCircle, color: '#3b82f6', label: '单抽' },
      { key: 'pull_ten', circle: config.pullTenCircle, color: '#eab308', label: '十连' },
    ];

    targets.forEach((t) => {
      const px = (t.circle.cx / 100) * width;
      const py = (t.circle.cy / 100) * height;
      const pr = (t.circle.r / 100) * width;

      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = `${t.color}33`;
      ctx.fill();
      ctx.lineWidth = activeBrushTarget === t.key ? 3 : 2;
      ctx.strokeStyle = t.color;
      ctx.setLineDash(activeBrushTarget === t.key ? [] : [4, 4]);
      ctx.stroke();

      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.label, px, py);
      ctx.restore();
    });

    if (drawnPoints.length > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.lineWidth = 4;
      ctx.strokeStyle =
        activeBrushTarget === 'exit'
          ? '#ef4444'
          : activeBrushTarget === 'pull_once'
          ? '#3b82f6'
          : '#eab308';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const first = drawnPoints[0];
      ctx.moveTo((first.x / 100) * width, (first.y / 100) * height);
      for (let i = 1; i < drawnPoints.length; i++) {
        const pt = drawnPoints[i];
        ctx.lineTo((pt.x / 100) * width, (pt.y / 100) * height);
      }
      ctx.stroke();
      ctx.restore();
    }
  };

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    const pt = getCanvasCoords(e);
    setDrawnPoints([pt]);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const pt = getCanvasCoords(e);
    setDrawnPoints((prev) => [...prev, pt]);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {
      // ignore
    }

    if (drawnPoints.length < 5) {
      setDrawnPoints([]);
      return;
    }

    let minX = 100, maxX = 0, minY = 100, maxY = 0;
    drawnPoints.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    const cx = Number(((minX + maxX) / 2).toFixed(1));
    const cy = Number(((minY + maxY) / 2).toFixed(1));
    const r = Number(Math.max(3.5, ((maxX - minX) / 2)).toFixed(1));

    const confirmedCircle: CircleButtonArea = { cx, cy, r };

    let targetName = '退出抽卡';
    if (activeBrushTarget === 'exit') {
      targetName = '退出抽卡';
      setConfig((prev) => ({ ...prev, exitCircle: confirmedCircle }));
      setActiveBrushTarget('pull_once');
    } else if (activeBrushTarget === 'pull_once') {
      targetName = '抽一次';
      setConfig((prev) => ({ ...prev, pullOnceCircle: confirmedCircle }));
      setActiveBrushTarget('pull_ten');
    } else {
      targetName = '抽十次';
      setConfig((prev) => ({ ...prev, pullTenCircle: confirmedCircle }));
    }

    setConfirmationNotice(`✓ 已自动确认「${targetName}」位置: 中心 (${cx}%, ${cy}%), 半径: ${r}%`);
    setTimeout(() => {
      setConfirmationNotice(null);
    }, 3500);

    setDrawnPoints([]);
  };

  const handleAddCard = () => {
    if (!newCardName.trim()) return;
    const newCard: GachaCardItem = {
      id: `card_${Date.now()}`,
      name: newCardName.trim(),
      rarity: newCardRarity,
      image: newCardImage || config.characterImage,
    };
    setConfig((prev) => ({
      ...prev,
      cards: [newCard, ...prev.cards],
    }));
    setNewCardName('');
    setNewCardImage('');
  };

  const handleDeleteCard = (cardId: string) => {
    if (config.cards.length <= 1) return;
    setConfig((prev) => ({
      ...prev,
      cards: prev.cards.filter((c) => c.id !== cardId),
    }));
  };

  return (
    // TRUE FULLSCREEN CONTAINER: 绝对全屏覆盖，无任何外挂顶栏或外部多余边框
    <div
      id="gacha-fullscreen-root"
      className="fixed inset-0 z-[99999] w-screen h-screen bg-black text-neutral-100 flex flex-row select-none font-sans overflow-hidden"
    >
      {/* ========================================================================= */}
      {/* LEFT SIDE: 卡池 (占大头 3/5 ~ 2/3，根据9:16留出充足地方，无任何顶栏挡位置) */}
      {/* ========================================================================= */}
      <div
        id="gacha-left-pool"
        className="w-[62%] h-full flex items-center justify-center p-2 sm:p-4 bg-neutral-950 relative overflow-hidden shrink-0 border-r border-neutral-800/80"
      >
        {/* 9:16 VERTICAL GACHA SCREEN CONTAINER */}
        <div
          id="gacha-vertical-screen"
          className="h-full max-h-full aspect-[9/16] relative overflow-hidden rounded-2xl border border-neutral-800 shadow-2xl bg-neutral-950 flex flex-col justify-between"
          style={{ perspective: '1200px' }}
        >
          {/* ================= MULTI-LAYER GREETING CARD STACK ================= */}
          {/* Layer 1: 底图 (最底层) */}
          {config.bgImage && (
            <img
              src={config.bgImage}
              alt="底图"
              className="absolute inset-0 w-full h-full object-cover z-[1] pointer-events-none"
              referrerPolicy="no-referrer"
            />
          )}

          {/* Layer 2: 卡池人物图 (中间层，双层贺卡立体夹层) */}
          {config.characterImage && (
            <div className="absolute inset-0 z-[2] pointer-events-none flex items-center justify-center overflow-hidden">
              <img
                src={config.characterImage}
                alt="卡池人物"
                className="w-full h-full object-contain filter drop-shadow-[0_15px_30px_rgba(0,0,0,0.85)] scale-95"
                referrerPolicy="no-referrer"
              />
            </div>
          )}

          {/* Layer 3: 免扣边框图 (最上层) */}
          {config.frameImage && (
            <img
              src={config.frameImage}
              alt="免扣边框图"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[3]"
              referrerPolicy="no-referrer"
            />
          )}

          {/* ================= THREE HOT-ZONE BUTTONS (以用户免扣边框图层为准) ================= */}
          {/* 1. 退出抽卡按键热区 */}
          <button
            type="button"
            onClick={() => {
              if (onExit) onExit();
            }}
            title="退出抽卡"
            style={{
              left: `${config.exitCircle.cx}%`,
              top: `${config.exitCircle.cy}%`,
              width: `${config.exitCircle.r * 2}%`,
              height: `${config.exitCircle.r * 2}%`,
              transform: 'translate(-50%, -50%)',
            }}
            className={`absolute z-10 rounded-full cursor-pointer transition active:scale-90 flex items-center justify-center ${
              showHotZoneOutline
                ? 'border-2 border-red-500/70 bg-red-500/20 hover:bg-red-500/40'
                : 'opacity-0 hover:opacity-100 bg-red-500/20'
            }`}
          >
            {showHotZoneOutline && (
              <span className="text-[9px] font-bold text-red-300 drop-shadow">退出</span>
            )}
          </button>

          {/* 2. 抽一次按键热区 */}
          <button
            type="button"
            onClick={() => doPull(1)}
            title="抽一次"
            style={{
              left: `${config.pullOnceCircle.cx}%`,
              top: `${config.pullOnceCircle.cy}%`,
              width: `${config.pullOnceCircle.r * 2}%`,
              height: `${config.pullOnceCircle.r * 2}%`,
              transform: 'translate(-50%, -50%)',
            }}
            className={`absolute z-10 rounded-full cursor-pointer transition active:scale-90 flex items-center justify-center ${
              showHotZoneOutline
                ? 'border-2 border-blue-500/70 bg-blue-500/20 hover:bg-blue-500/40'
                : 'opacity-0 hover:opacity-100 bg-blue-500/20'
            }`}
          >
            {showHotZoneOutline && (
              <span className="text-[9px] font-bold text-blue-200 drop-shadow">单抽</span>
            )}
          </button>

          {/* 3. 抽十次按键热区 */}
          <button
            type="button"
            onClick={() => doPull(10)}
            title="抽十次"
            style={{
              left: `${config.pullTenCircle.cx}%`,
              top: `${config.pullTenCircle.cy}%`,
              width: `${config.pullTenCircle.r * 2}%`,
              height: `${config.pullTenCircle.r * 2}%`,
              transform: 'translate(-50%, -50%)',
            }}
            className={`absolute z-10 rounded-full cursor-pointer transition active:scale-90 flex items-center justify-center ${
              showHotZoneOutline
                ? 'border-2 border-amber-400/80 bg-amber-400/25 hover:bg-amber-400/45 ring-2 ring-amber-400/30'
                : 'opacity-0 hover:opacity-100 bg-amber-400/25'
            }`}
          >
            {showHotZoneOutline && (
              <span className="text-[10px] font-black text-amber-200 drop-shadow">十连</span>
            )}
          </button>

          {/* ================= PULL RESULTS OVERLAY (卡片展示) ================= */}
          {pullResults && (
            <div
              onClick={() => setPullResults(null)}
              className="absolute inset-0 z-20 bg-black/90 backdrop-blur-md p-3 flex flex-col items-center justify-between cursor-pointer animate-fadeIn"
            >
              <div className="w-full flex items-center justify-between pb-2 border-b border-neutral-800 text-xs text-amber-300 font-bold">
                <span>✦ 共鸣结果 ✦</span>
                <span className="text-[10px] text-neutral-400">点击屏幕收起</span>
              </div>

              <div className="flex-1 w-full flex items-center justify-center py-2">
                {pullResults.length === 1 ? (
                  <div className="w-48 aspect-[3/4.2] rounded-2xl overflow-hidden bg-neutral-900 border-2 border-amber-400/80 shadow-2xl flex flex-col justify-between p-2 relative">
                    <img
                      src={pullResults[0].image}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="relative z-10 flex justify-between">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                        pullResults[0].rarity === 'SSR'
                          ? 'bg-amber-400 text-neutral-950'
                          : pullResults[0].rarity === 'SR'
                          ? 'bg-purple-500 text-white'
                          : 'bg-blue-600 text-white'
                      }`}>
                        {pullResults[0].rarity}
                      </span>
                    </div>
                    <div className="relative z-10 bg-black/80 backdrop-blur-sm p-2 rounded-xl border border-white/10">
                      <div className="text-sm font-bold text-white truncate">{pullResults[0].name}</div>
                      {pullResults[0].description && (
                        <div className="text-[10px] text-neutral-300 truncate">{pullResults[0].description}</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-5 gap-1.5 w-full">
                    {pullResults.map((item, idx) => {
                      const isSSR = item.rarity === 'SSR';
                      const isSR = item.rarity === 'SR';
                      return (
                        <div
                          key={idx}
                          className={`aspect-[3/4.2] relative rounded-xl overflow-hidden bg-neutral-900 border flex flex-col justify-between p-1 ${
                            isSSR
                              ? 'border-amber-400 ring-2 ring-amber-400/60 shadow-lg shadow-amber-500/50'
                              : isSR
                              ? 'border-purple-400'
                              : 'border-blue-400/50'
                          }`}
                        >
                          <img
                            src={item.image}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="relative z-10 flex justify-between">
                            <span className={`px-1 rounded text-[8px] font-bold ${
                              isSSR
                                ? 'bg-amber-400 text-neutral-950'
                                : isSR
                                ? 'bg-purple-500 text-white'
                                : 'bg-blue-600 text-white'
                            }`}>
                              {item.rarity}
                            </span>
                          </div>
                          <div className="relative z-10 bg-black/85 backdrop-blur-sm px-1 py-0.5 rounded text-[8px] font-bold text-white truncate text-center">
                            {item.name.split('·')[0]}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="text-center text-[11px] text-neutral-400 py-1">
                点击屏幕任意处返回卡池
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RIGHT SIDE: 聊天地方 (所有设置按钮都在本全屏内部，无外挂菜单栏) */}
      {/* ========================================================================= */}
      <div
        id="gacha-right-chat"
        className="w-[38%] h-full flex flex-col bg-neutral-900 overflow-hidden relative"
      >
        {/* 内置无缝切换栏：在全屏内部随时在【聊天】与【卡池定制】之间切换 */}
        <div className="flex items-center justify-between px-3 py-2 bg-neutral-950/90 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setRightView('chat')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                rightView === 'chat'
                  ? 'bg-amber-500 text-neutral-950 shadow'
                  : 'text-neutral-400 hover:text-white bg-neutral-800/80'
              }`}
            >
              <MessageSquare className="size-3.5" />
              <span>聊天互动</span>
            </button>

            <button
              onClick={() => setRightView('settings')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                rightView === 'settings'
                  ? 'bg-amber-500 text-neutral-950 shadow'
                  : 'text-neutral-400 hover:text-white bg-neutral-800/80'
              }`}
            >
              <Sliders className="size-3.5" />
              <span>卡池设置</span>
            </button>
          </div>

          <button
            onClick={() => setShowHotZoneOutline(!showHotZoneOutline)}
            className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] flex items-center gap-1 cursor-pointer"
            title="显示/隐藏卡池热区圆圈"
          >
            {showHotZoneOutline ? <Eye className="size-3 text-amber-400" /> : <EyeOff className="size-3" />}
            <span>{showHotZoneOutline ? '显圈' : '隐圈'}</span>
          </button>
        </div>

        {/* --------------------------------------------------------------------- */}
        {/* VIEW A: 聊天地方 (用户与角色聊天沟通) */}
        {/* --------------------------------------------------------------------- */}
        {rightView === 'chat' && (
          <div className="flex-1 flex flex-col h-full min-h-0 bg-neutral-900/60">
            {/* Chat Header inside right view */}
            <div className="px-3 py-2 bg-neutral-900/90 border-b border-neutral-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold text-white text-xs">{characterName || '陆沉'}</span>
                <span className="text-[10px] text-neutral-400">卡池实时联络</span>
              </div>
            </div>

            {/* Chat Messages Stream */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatMessages.map((msg) => {
                const isChar = msg.sender === 'character';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isChar ? 'items-start' : 'items-end'}`}
                  >
                    <span className="text-[9px] text-neutral-500 mb-0.5 px-1 font-mono">
                      {isChar ? characterName || '陆沉' : '我'}
                    </span>
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed break-words shadow ${
                        isChar
                          ? 'bg-neutral-800 text-neutral-100 rounded-tl-sm border border-neutral-700/60'
                          : 'bg-amber-500 text-neutral-950 font-medium rounded-tr-sm'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })}
              {isSending && (
                <div className="flex items-center gap-1 text-[10px] text-neutral-400 px-1 italic">
                  <span>{characterName || '陆沉'} 正在回应...</span>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Chat Input Bar */}
            <div className="p-2.5 bg-neutral-950 border-t border-neutral-800 shrink-0">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={`和${characterName || '角色'}聊天...`}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendMessage();
                  }}
                  className="flex-1 px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!chatInput.trim() || isSending}
                  className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-neutral-950 font-bold transition cursor-pointer"
                >
                  <Send className="size-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --------------------------------------------------------------------- */}
        {/* VIEW B: 所有设置都在全屏内 (图层上传、画笔圈选三个按键、卡片与概率) */}
        {/* --------------------------------------------------------------------- */}
        {rightView === 'settings' && (
          <div className="flex-1 flex flex-col h-full min-h-0 bg-neutral-900">
            {/* Sub Tabs */}
            <div className="flex items-center gap-1 px-3 py-2 bg-neutral-950/60 border-b border-neutral-800 shrink-0">
              <button
                onClick={() => setSettingsTab('layers')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  settingsTab === 'layers'
                    ? 'bg-neutral-800 text-amber-400 border border-amber-500/30'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                三大图层
              </button>
              <button
                onClick={() => setSettingsTab('brush')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  settingsTab === 'brush'
                    ? 'bg-neutral-800 text-amber-400 border border-amber-500/30'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                画笔圈选按键
              </button>
              <button
                onClick={() => setSettingsTab('cards')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  settingsTab === 'cards'
                    ? 'bg-neutral-800 text-amber-400 border border-amber-500/30'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                卡片与概率
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {/* TAB 1: 三大图层 (从左往右依次图层往上：底图 -> 卡池人物图 -> 免扣边框图) */}
              {settingsTab === 'layers' && (
                <div className="space-y-4">
                  <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-400 text-[11px] leading-relaxed">
                    从左往右（从底到顶）图层依次往上：
                    <span className="text-amber-400 font-bold"> ① 底图 </span>➔ 
                    <span className="text-amber-400 font-bold"> ② 卡池人物图 </span>➔ 
                    <span className="text-amber-400 font-bold"> ③ 免扣边框图 </span>。
                    双层贺卡立体感，退出与抽卡键以免扣边框为准。
                  </div>

                  {/* 1. 底图 */}
                  <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-300 text-xs">① 底图 (最底层)</span>
                      <label className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-[10.5px] cursor-pointer flex items-center gap-1">
                        <Upload className="size-3" />
                        <span>上传底图</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, (url) => setConfig((p) => ({ ...p, bgImage: url })))}
                        />
                      </label>
                    </div>
                    {config.bgImage && (
                      <div className="w-full h-20 rounded-lg overflow-hidden border border-neutral-800">
                        <img src={config.bgImage} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                    )}
                  </div>

                  {/* 2. 卡池人物图 */}
                  <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-300 text-xs">② 卡池人物图 (中间层)</span>
                      <label className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-[10.5px] cursor-pointer flex items-center gap-1">
                        <Upload className="size-3" />
                        <span>上传人物图</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, (url) => setConfig((p) => ({ ...p, characterImage: url })))}
                        />
                      </label>
                    </div>
                    {config.characterImage && (
                      <div className="w-full h-20 rounded-lg overflow-hidden border border-neutral-800 bg-neutral-950 flex items-center justify-center">
                        <img src={config.characterImage} alt="" className="h-full object-contain" referrerPolicy="no-referrer" />
                      </div>
                    )}
                  </div>

                  {/* 3. 免扣边框图 */}
                  <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-amber-300 text-xs">③ 免扣边框图 (最上层)</span>
                        <p className="text-[10px] text-neutral-400">退出/单抽/十连按钮以此图层为基准</p>
                      </div>
                      <label className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-[10.5px] cursor-pointer flex items-center gap-1">
                        <Upload className="size-3" />
                        <span>上传免扣边框</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, (url) => {
                            setConfig((p) => ({ ...p, frameImage: url }));
                            setSettingsTab('brush');
                          })}
                        />
                      </label>
                    </div>
                    {config.frameImage && (
                      <div className="w-full h-20 rounded-lg overflow-hidden border border-neutral-800 bg-black flex items-center justify-center">
                        <img src={config.frameImage} alt="" className="h-full object-contain" referrerPolicy="no-referrer" />
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => setConfig(DEFAULT_CONFIG)}
                      className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="size-3.5" />
                      <span>恢复默认贺卡预设</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: 画笔圈选三大按键 */}
              {settingsTab === 'brush' && (
                <div className="space-y-3">
                  <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
                    <div className="text-amber-300 font-bold text-xs flex items-center gap-1">
                      <Sparkles className="size-3.5" />
                      <span>画笔画圈自动确认位置</span>
                    </div>
                    <p className="text-[10.5px] text-neutral-400 leading-relaxed">
                      请在下方边框画布上画一个圈。松手后系统将自动算出中心和大小，并绑定为对应的点击热区！
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => setActiveBrushTarget('exit')}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition cursor-pointer flex flex-col items-center ${
                        activeBrushTarget === 'exit'
                          ? 'bg-red-500/20 border-red-500 text-red-300 shadow'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <span>🔴 退出抽卡</span>
                      <span className="text-[9px] opacity-75 font-mono">
                        ({config.exitCircle.cx}%, {config.exitCircle.cy}%)
                      </span>
                    </button>

                    <button
                      onClick={() => setActiveBrushTarget('pull_once')}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition cursor-pointer flex flex-col items-center ${
                        activeBrushTarget === 'pull_once'
                          ? 'bg-blue-500/20 border-blue-500 text-blue-300 shadow'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <span>🔵 抽一次</span>
                      <span className="text-[9px] opacity-75 font-mono">
                        ({config.pullOnceCircle.cx}%, {config.pullOnceCircle.cy}%)
                      </span>
                    </button>

                    <button
                      onClick={() => setActiveBrushTarget('pull_ten')}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition cursor-pointer flex flex-col items-center ${
                        activeBrushTarget === 'pull_ten'
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <span>🟡 抽十次</span>
                      <span className="text-[9px] opacity-75 font-mono">
                        ({config.pullTenCircle.cx}%, {config.pullTenCircle.cy}%)
                      </span>
                    </button>
                  </div>

                  {confirmationNotice && (
                    <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-1.5 animate-fadeIn">
                      <Check className="size-4 shrink-0 text-emerald-400" />
                      <span>{confirmationNotice}</span>
                    </div>
                  )}

                  <div className="w-full aspect-[9/16] max-h-[360px] mx-auto bg-black rounded-xl overflow-hidden border-2 border-dashed border-amber-500/40 relative shadow-inner touch-none cursor-crosshair flex items-center justify-center">
                    <canvas
                      ref={canvasRef}
                      width={360}
                      height={640}
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      className="w-full h-full object-contain block"
                    />
                    <div className="absolute top-2 left-2 pointer-events-none bg-black/70 px-2 py-0.5 rounded text-[9.5px] text-amber-300 font-mono">
                      当前画笔：画「{activeBrushTarget === 'exit' ? '退出' : activeBrushTarget === 'pull_once' ? '单抽' : '十连'}」圈
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: 卡片与概率配置 */}
              {settingsTab === 'cards' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                    <span className="font-bold text-amber-300 text-xs">出货概率设置</span>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-amber-400 mb-0.5 font-bold">SSR (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={Number((config.rates.SSR * 100).toFixed(1))}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                            setConfig((p) => ({ ...p, rates: { ...p.rates, SSR: val / 100 } }));
                          }}
                          className="w-full px-2 py-1 rounded bg-neutral-900 border border-neutral-800 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-purple-400 mb-0.5 font-bold">SR (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={Number((config.rates.SR * 100).toFixed(1))}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                            setConfig((p) => ({ ...p, rates: { ...p.rates, SR: val / 100 } }));
                          }}
                          className="w-full px-2 py-1 rounded bg-neutral-900 border border-neutral-800 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-blue-400 mb-0.5 font-bold">R (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={Number((config.rates.R * 100).toFixed(1))}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                            setConfig((p) => ({ ...p, rates: { ...p.rates, R: val / 100 } }));
                          }}
                          className="w-full px-2 py-1 rounded bg-neutral-900 border border-neutral-800 text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                    <span className="font-bold text-amber-300 text-xs">添加卡片</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="卡片名称..."
                        value={newCardName}
                        onChange={(e) => setNewCardName(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 rounded bg-neutral-900 border border-neutral-800 text-xs text-white"
                      />
                      <select
                        value={newCardRarity}
                        onChange={(e) => setNewCardRarity(e.target.value as any)}
                        className="px-2 py-1.5 rounded bg-neutral-900 border border-neutral-800 text-xs text-white"
                      >
                        <option value="SSR">SSR</option>
                        <option value="SR">SR</option>
                        <option value="R">R</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <label className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[11px] text-neutral-300 cursor-pointer flex items-center gap-1">
                        <Upload className="size-3" />
                        <span>{newCardImage ? '已选图片' : '上传卡面图片'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, (url) => setNewCardImage(url))}
                        />
                      </label>

                      <button
                        onClick={handleAddCard}
                        className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="size-3.5" />
                        <span>添加</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="font-bold text-neutral-300 text-xs">现有卡片 ({config.cards.length})</span>
                    {config.cards.map((card) => (
                      <div
                        key={card.id}
                        className="p-2 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={card.image}
                            alt=""
                            className="size-8 rounded-lg object-cover bg-black shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0">
                            <span className="font-bold text-white text-xs truncate block">{card.name}</span>
                            <span className={`text-[8px] font-bold px-1 rounded ${
                              card.rarity === 'SSR' ? 'bg-amber-400 text-neutral-950' : card.rarity === 'SR' ? 'bg-purple-500 text-white' : 'bg-blue-600 text-white'
                            }`}>{card.rarity}</span>
                          </div>
                        </div>
                        {config.cards.length > 1 && (
                          <button
                            onClick={() => handleDeleteCard(card.id)}
                            className="p-1 rounded text-neutral-500 hover:text-red-400 hover:bg-neutral-800 cursor-pointer"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
