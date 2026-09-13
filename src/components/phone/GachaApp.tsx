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
  Palette,
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

  // 6 calibrated button circles based on frame layer
  exitCircle: CircleButtonArea;     // 退出抽卡
  pullOnceCircle: CircleButtonArea; // 抽一次
  pullTenCircle: CircleButtonArea;  // 抽十次
  detailsCircle: CircleButtonArea;  // 卡池详情
  historyCircle: CircleButtonArea;  // 抽卡记录
  customCircle: CircleButtonArea;   // 自定义卡池

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

  <!-- Pull 1 Button Circle Placeholder on Frame (Bottom Left) - Moved up to 656 -->
  <g id="frame-pull-once" filter="url(#shadow)">
    <circle cx="130" cy="656" r="36" fill="#1c1917" stroke="url(#gold)" stroke-width="3" />
    <circle cx="130" cy="656" r="31" fill="#292524" />
    <text x="130" y="653" fill="#fef08a" font-size="13" font-weight="bold" font-family="sans-serif" text-anchor="middle">单抽</text>
    <text x="130" y="670" fill="#a8a29e" font-size="10" font-family="sans-serif" text-anchor="middle">1 抽</text>
  </g>

  <!-- Pull 10 Button Circle Placeholder on Frame (Bottom Right) - Moved up to 656 -->
  <g id="frame-pull-ten" filter="url(#shadow)">
    <circle cx="320" cy="656" r="38" fill="url(#gold)" stroke="#fef08a" stroke-width="3" />
    <circle cx="320" cy="656" r="33" fill="#ca8a04" />
    <text x="320" y="653" fill="#0c0a09" font-size="14" font-weight="900" font-family="sans-serif" text-anchor="middle">十连</text>
    <text x="320" y="670" fill="#451a03" font-size="10" font-weight="bold" font-family="sans-serif" text-anchor="middle">必得 SR</text>
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

  // Initial calibrated buttons on frame - Moved up to cy: 82.0
  exitCircle: { cx: 12.2, cy: 6.9, r: 6.5 },
  pullOnceCircle: { cx: 28.9, cy: 82.0, r: 9.0 },
  pullTenCircle: { cx: 71.1, cy: 82.0, r: 9.5 },
  detailsCircle: { cx: 20.0, cy: 94.0, r: 8.0 },
  historyCircle: { cx: 50.0, cy: 94.0, r: 8.0 },
  customCircle: { cx: 80.0, cy: 94.0, r: 8.0 },

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

  // Dialogue Modals State
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [pullHistory, setPullHistory] = useState<GachaCardItem[]>([]);
  const [customSubView, setCustomSubView] = useState<'menu' | 'brush' | 'settings'>('menu');

  // Right Side View: always 'chat' for the bare dialogue layout
  const [rightView] = useState<'chat'>('chat');
  const [settingsTab, setSettingsTab] = useState<'layers' | 'brush' | 'cards'>('layers');

  // Auto-migrate old cy coordinates upwards if they are still at the very bottom
  useEffect(() => {
    if (config.pullOnceCircle.cy > 88.0 || config.pullTenCircle.cy > 88.0) {
      setConfig((prev) => ({
        ...prev,
        pullOnceCircle: { ...prev.pullOnceCircle, cy: 82.0 },
        pullTenCircle: { ...prev.pullTenCircle, cy: 82.0 },
      }));
    }
  }, [config.pullOnceCircle.cy, config.pullTenCircle.cy]);

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
  const [activeBrushTarget, setActiveBrushTarget] = useState<'exit' | 'pull_once' | 'pull_ten' | 'details' | 'history' | 'custom'>('exit');
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
    setPullHistory((prev) => [...results, ...prev]);

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

    // Render circles and user drawn paths immediately as a fallback so the canvas is never blank
    drawCirclesAndStrokes(ctx, width, height);

    if (config.frameImage) {
      const img = new Image();
      // Only set crossOrigin if it is an external URL (not local and not data-url)
      if (config.frameImage.startsWith('http') && !config.frameImage.includes(window.location.host)) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        drawCirclesAndStrokes(ctx, width, height);
      };
      img.src = config.frameImage;
      if (img.complete) {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        drawCirclesAndStrokes(ctx, width, height);
      }
    }
  }, [config.frameImage, config.exitCircle, config.pullOnceCircle, config.pullTenCircle, config.detailsCircle, config.historyCircle, config.customCircle, drawnPoints, activeBrushTarget]);

  const drawCirclesAndStrokes = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const targets = [
      { key: 'exit', circle: config.exitCircle, color: '#ef4444', label: '退出' },
      { key: 'pull_once', circle: config.pullOnceCircle, color: '#3b82f6', label: '单抽' },
      { key: 'pull_ten', circle: config.pullTenCircle, color: '#eab308', label: '十连' },
      { key: 'details', circle: config.detailsCircle, color: '#10b981', label: '详情' },
      { key: 'history', circle: config.historyCircle, color: '#a855f7', label: '记录' },
      { key: 'custom', circle: config.customCircle, color: '#ec4899', label: '自定义' },
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
          : activeBrushTarget === 'pull_ten'
          ? '#eab308'
          : activeBrushTarget === 'details'
          ? '#10b981'
          : activeBrushTarget === 'history'
          ? '#a855f7'
          : '#ec4899';
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
    const timer = setTimeout(() => {
      redrawCanvas();
    }, 50);
    return () => clearTimeout(timer);
  }, [redrawCanvas, customSubView]);

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

    let targetName = '退出键';
    if (activeBrushTarget === 'exit') {
      targetName = '退出键';
      setConfig((prev) => ({ ...prev, exitCircle: confirmedCircle }));
      setActiveBrushTarget('pull_once');
    } else if (activeBrushTarget === 'pull_once') {
      targetName = '单抽键';
      setConfig((prev) => ({ ...prev, pullOnceCircle: confirmedCircle }));
      setActiveBrushTarget('pull_ten');
    } else if (activeBrushTarget === 'pull_ten') {
      targetName = '十连键';
      setConfig((prev) => ({ ...prev, pullTenCircle: confirmedCircle }));
      setActiveBrushTarget('details');
    } else if (activeBrushTarget === 'details') {
      targetName = '卡池详情';
      setConfig((prev) => ({ ...prev, detailsCircle: confirmedCircle }));
      setActiveBrushTarget('history');
    } else if (activeBrushTarget === 'history') {
      targetName = '抽卡记录';
      setConfig((prev) => ({ ...prev, historyCircle: confirmedCircle }));
      setActiveBrushTarget('custom');
    } else if (activeBrushTarget === 'custom') {
      targetName = '自定义卡池';
      setConfig((prev) => ({ ...prev, customCircle: confirmedCircle }));
      setActiveBrushTarget('exit');
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
      className="absolute inset-0 w-full h-full bg-neutral-950 text-neutral-100 flex flex-row select-none font-sans overflow-hidden"
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

          {/* Layer 3: 卡池人物图 (最上层) */}
          {config.characterImage && (
            <div className="absolute inset-0 z-[3] pointer-events-none flex items-center justify-center overflow-hidden">
              <img
                src={config.characterImage}
                alt="卡池人物"
                className="w-full h-full object-contain filter drop-shadow-[0_15px_30px_rgba(0,0,0,0.85)] scale-95"
                referrerPolicy="no-referrer"
              />
            </div>
          )}

          {/* Layer 2: 免扣边框图 (中间层) */}
          {config.frameImage && (
            <img
              src={config.frameImage}
              alt="免扣边框图"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[2]"
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

          {/* 4. 卡池详情按键热区 */}
          <button
            type="button"
            onClick={() => setShowDetailsModal(true)}
            title="卡池详情"
            style={{
              left: `${config.detailsCircle.cx}%`,
              top: `${config.detailsCircle.cy}%`,
              width: `${config.detailsCircle.r * 2}%`,
              height: `${config.detailsCircle.r * 2}%`,
              transform: 'translate(-50%, -50%)',
            }}
            className={`absolute z-10 rounded-full cursor-pointer transition active:scale-90 flex items-center justify-center ${
              showHotZoneOutline
                ? 'border-2 border-emerald-500/70 bg-emerald-500/20 hover:bg-emerald-500/40'
                : 'opacity-0 hover:opacity-100 bg-emerald-500/20'
            }`}
          >
            {showHotZoneOutline && (
              <span className="text-[9.5px] font-bold text-emerald-200 drop-shadow">详情</span>
            )}
          </button>

          {/* 5. 抽卡记录按键热区 */}
          <button
            type="button"
            onClick={() => setShowHistoryModal(true)}
            title="抽卡记录"
            style={{
              left: `${config.historyCircle.cx}%`,
              top: `${config.historyCircle.cy}%`,
              width: `${config.historyCircle.r * 2}%`,
              height: `${config.historyCircle.r * 2}%`,
              transform: 'translate(-50%, -50%)',
            }}
            className={`absolute z-10 rounded-full cursor-pointer transition active:scale-90 flex items-center justify-center ${
              showHotZoneOutline
                ? 'border-2 border-purple-500/70 bg-purple-500/20 hover:bg-purple-500/40'
                : 'opacity-0 hover:opacity-100 bg-purple-500/20'
            }`}
          >
            {showHotZoneOutline && (
              <span className="text-[9.5px] font-bold text-purple-200 drop-shadow">记录</span>
            )}
          </button>

          {/* 6. 自定义配置中心按键热区 */}
          <button
            type="button"
            onClick={() => {
              setCustomSubView('menu');
              setShowCustomModal(true);
            }}
            title="自定义卡池"
            style={{
              left: `${config.customCircle.cx}%`,
              top: `${config.customCircle.cy}%`,
              width: `${config.customCircle.r * 2}%`,
              height: `${config.customCircle.r * 2}%`,
              transform: 'translate(-50%, -50%)',
            }}
            className={`absolute z-10 rounded-full cursor-pointer transition active:scale-90 flex items-center justify-center ${
              showHotZoneOutline
                ? 'border-2 border-pink-500/70 bg-pink-500/20 hover:bg-pink-500/40'
                : 'opacity-0 hover:opacity-100 bg-pink-500/20'
            }`}
          >
            {showHotZoneOutline && (
              <span className="text-[9.5px] font-bold text-pink-200 drop-shadow">自定义</span>
            )}
          </button>

          {/* ================= PULL RESULTS OVERLAY (卡片展示) ================= */}
          {pullResults && (
            <div
              onClick={() => setPullResults(null)}
              className="absolute inset-0 z-20 bg-black/95 backdrop-blur-md p-3 flex flex-col items-center justify-between cursor-pointer animate-fadeIn"
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
      {/* RIGHT SIDE: 仅留对话聊天 (字号小2个尺寸，无多余头部、切换标签或设置按钮) */}
      {/* ========================================================================= */}
      <div
        id="gacha-right-chat"
        className="flex-1 h-full flex flex-col bg-neutral-900 overflow-hidden relative"
      >
        {/* Chat Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {chatMessages.map((msg) => {
            const isChar = msg.sender === 'character';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isChar ? 'items-start' : 'items-end'} w-full`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-xl text-[10px] leading-relaxed break-words shadow-sm ${
                    isChar
                      ? 'bg-neutral-800 text-neutral-100 rounded-tl-none border border-neutral-700/40'
                      : 'bg-amber-500 text-neutral-950 font-medium rounded-tr-none'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })}
          {isSending && (
            <div className="flex items-center gap-1.5 text-[9px] text-neutral-400 px-1 italic">
              <span className="size-1 bg-neutral-400 rounded-full animate-bounce" />
              <span>正在回应...</span>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Chat Input Bar */}
        <div className="p-3 bg-neutral-950 border-t border-neutral-850 shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder={`和${characterName || '角色'}聊天...`}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendMessage();
              }}
              className="flex-1 px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-855 text-[11px] text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!chatInput.trim() || isSending}
              className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-neutral-950 font-bold transition cursor-pointer"
            >
              <Send className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DIALOG MODALS POPUPS SECTION (使用 absolute 相对全面屏绝对定位，不超出 CRT 框且不溢出) */}
      {/* ========================================================================= */}

      {/* 1. 自定义卡池与机位标定 Modal */}
      {showCustomModal && (
        <div className="absolute inset-0 z-40 bg-black/95 backdrop-blur-sm flex items-center justify-center p-2 animate-fadeIn">
          <div className="w-[94%] h-[94%] max-w-[330px] max-h-[580px] bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-neutral-200 relative">
            
            {/* 1.1 MENU SELECTION SCREEN */}
            {customSubView === 'menu' && (
              <div className="flex-1 flex flex-col p-4 justify-between overflow-y-auto">
                <div className="space-y-4">
                  {/* Title & Decorative */}
                  <div className="text-center py-1 border-b border-neutral-800">
                    <span className="text-amber-400 font-black tracking-wider text-xs flex items-center justify-center gap-1.5">
                      <Sparkles className="size-4" />
                      <span>自定义配置中心</span>
                    </span>
                  </div>
 
                  {/* Options Cards */}
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setCustomSubView('brush')}
                      className="w-full text-left p-3 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-amber-500 hover:bg-neutral-900/60 transition-all duration-200 cursor-pointer group flex items-start gap-3 shadow-md"
                    >
                      <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:scale-105 transition-transform shrink-0">
                        <Palette className="size-5" />
                      </div>
                      <div className="space-y-0.5">
                        <span className="font-bold text-xs text-neutral-100 group-hover:text-amber-300 transition-colors">🎨 1. 画圈圈选按键位置 (画笔标定)</span>
                        <p className="text-[9.5px] text-neutral-400 leading-relaxed">
                          用画笔在屏幕画圈，系统自动绑定对准您的退出、单抽、十连及详情、记录、自定义热区。
                        </p>
                      </div>
                    </button>
 
                    <button
                      type="button"
                      onClick={() => setCustomSubView('settings')}
                      className="w-full text-left p-3 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-amber-500 hover:bg-neutral-900/60 transition-all duration-200 cursor-pointer group flex items-start gap-3 shadow-md"
                    >
                      <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:scale-105 transition-transform shrink-0">
                        <Upload className="size-5" />
                      </div>
                      <div className="space-y-0.5">
                        <span className="font-bold text-xs text-neutral-100 group-hover:text-amber-300 transition-colors">⚙️ 2. 卡池素材与卡片配置 (图片/概率)</span>
                        <p className="text-[9.5px] text-neutral-400 leading-relaxed">
                          上传三层背景图层，设定SSR/SR/R出货概率，向卡池中添加、删除您的卡片角色立绘。
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
 
                {/* Big Close Button at Menu Bottom */}
                <div className="pt-4 border-t border-neutral-850 flex flex-col gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowCustomModal(false)}
                    className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs text-center shadow-lg hover:scale-[1.01] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>退出并返回聊天</span>
                  </button>
                </div>
              </div>
            )}
 
            {/* 1.2 BRUSH DRAW VIEW (Only when 'brush' is selected) */}
            {customSubView === 'brush' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header with Back and Direct Close */}
                <div className="flex items-center justify-between px-3 py-2 bg-neutral-950 border-b border-neutral-800 shrink-0">
                  <button
                    type="button"
                    onClick={() => setCustomSubView('menu')}
                    className="text-amber-400 hover:text-white text-[11px] font-bold px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 cursor-pointer transition-all flex items-center gap-1"
                  >
                    <span>⬅ 返回菜单</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCustomModal(false)}
                    className="text-white hover:text-neutral-100 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 cursor-pointer transition-all shadow-md shrink-0"
                  >
                    直接关闭
                  </button>
                </div>
 
                {/* Paintbrush Draw Interface */}
                <div className="flex-1 overflow-y-auto p-3 flex flex-col space-y-2.5">
                  <div className="p-2 rounded-xl bg-neutral-950 border border-neutral-850 shrink-0 text-center">
                    <span className="text-amber-300 font-bold text-xs block">🎨 1. 画笔画圈定位热区</span>
                    <p className="text-[9.5px] text-neutral-400 leading-relaxed mt-0.5">
                      在下方画布上画圈。松手后系统将自动算出中心和大小，并绑定为对应的点击热区！
                    </p>
                  </div>
 
                  <div className="grid grid-cols-3 gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveBrushTarget('exit')}
                      className={`py-1 px-1 rounded-lg text-[9px] font-bold border transition cursor-pointer flex flex-col items-center justify-center ${
                        activeBrushTarget === 'exit'
                          ? 'bg-red-500/20 border-red-500 text-red-300 shadow-sm'
                          : 'bg-neutral-950 border-neutral-850 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <span>🔴 退出键</span>
                      <span className="text-[7.5px] opacity-75 font-mono mt-0.5">
                        ({config.exitCircle.cx}%, {config.exitCircle.cy}%)
                      </span>
                    </button>
 
                    <button
                      type="button"
                      onClick={() => setActiveBrushTarget('pull_once')}
                      className={`py-1 px-1 rounded-lg text-[9px] font-bold border transition cursor-pointer flex flex-col items-center justify-center ${
                        activeBrushTarget === 'pull_once'
                          ? 'bg-blue-500/20 border-blue-500 text-blue-300 shadow-sm'
                          : 'bg-neutral-950 border-neutral-850 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <span>🔵 单抽键</span>
                      <span className="text-[7.5px] opacity-75 font-mono mt-0.5">
                        ({config.pullOnceCircle.cx}%, {config.pullOnceCircle.cy}%)
                      </span>
                    </button>
 
                    <button
                      type="button"
                      onClick={() => setActiveBrushTarget('pull_ten')}
                      className={`py-1 px-1 rounded-lg text-[9px] font-bold border transition cursor-pointer flex flex-col items-center justify-center ${
                        activeBrushTarget === 'pull_ten'
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                          : 'bg-neutral-950 border-neutral-850 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <span>🟡 十连键</span>
                      <span className="text-[7.5px] opacity-75 font-mono mt-0.5">
                        ({config.pullTenCircle.cx}%, {config.pullTenCircle.cy}%)
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveBrushTarget('details')}
                      className={`py-1 px-1 rounded-lg text-[9px] font-bold border transition cursor-pointer flex flex-col items-center justify-center ${
                        activeBrushTarget === 'details'
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                          : 'bg-neutral-950 border-neutral-850 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <span>🟢 详情键</span>
                      <span className="text-[7.5px] opacity-75 font-mono mt-0.5">
                        ({config.detailsCircle.cx}%, {config.detailsCircle.cy}%)
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveBrushTarget('history')}
                      className={`py-1 px-1 rounded-lg text-[9px] font-bold border transition cursor-pointer flex flex-col items-center justify-center ${
                        activeBrushTarget === 'history'
                          ? 'bg-purple-500/20 border-purple-500 text-purple-300 shadow-sm'
                          : 'bg-neutral-950 border-neutral-850 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <span>🟣 记录键</span>
                      <span className="text-[7.5px] opacity-75 font-mono mt-0.5">
                        ({config.historyCircle.cx}%, {config.historyCircle.cy}%)
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveBrushTarget('custom')}
                      className={`py-1 px-1 rounded-lg text-[9px] font-bold border transition cursor-pointer flex flex-col items-center justify-center ${
                        activeBrushTarget === 'custom'
                          ? 'bg-pink-500/20 border-pink-500 text-pink-300 shadow-sm'
                          : 'bg-neutral-950 border-neutral-850 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <span>🌸 自定义键</span>
                      <span className="text-[7.5px] opacity-75 font-mono mt-0.5">
                        ({config.customCircle.cx}%, {config.customCircle.cy}%)
                      </span>
                    </button>
                  </div>
 
                  {confirmationNotice && (
                    <div className="p-1.5 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-[9px] flex items-center gap-1 shrink-0 animate-fadeIn justify-center">
                      <Check className="size-3 text-emerald-400 shrink-0" />
                      <span>{confirmationNotice}</span>
                    </div>
                  )}
 
                  <div className="flex-1 w-full aspect-[9/16] min-h-[260px] max-w-[240px] mx-auto bg-black rounded-xl overflow-hidden border border-neutral-800 relative touch-none cursor-crosshair">
                    <canvas
                      ref={canvasRef}
                      width={360}
                      height={640}
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      className="w-full h-full object-contain block"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 1.3 SETTINGS & UPLOADS VIEW (Only when 'settings' is selected) */}
            {customSubView === 'settings' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header with Back and Direct Close */}
                <div className="flex items-center justify-between px-4 py-3 bg-neutral-950 border-b border-neutral-800 shrink-0">
                  <button
                    type="button"
                    onClick={() => setCustomSubView('menu')}
                    className="text-amber-400 hover:text-white text-xs font-bold px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 cursor-pointer transition-all flex items-center gap-1"
                  >
                    <span>⬅ 返回菜单</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCustomModal(false)}
                    className="text-white hover:text-neutral-100 text-xs font-bold px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 cursor-pointer transition-all shadow-md shrink-0"
                  >
                    直接关闭
                  </button>
                </div>

                {/* Upload & Pool Config Fields */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                  {/* 1. 三大图层上传 */}
                  <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                    <span className="font-bold text-amber-300 text-[11px] block">🖼️ 1. 上传底图、立绘与免扣边框</span>

                    {/* ① 底图 */}
                    <div className="flex items-center justify-between gap-2 border-b border-neutral-850 pb-2.5">
                      <div className="min-w-0">
                        <span className="font-bold text-white text-[10.5px]">① 底图 (最底层)</span>
                      </div>
                      <label className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-[10px] cursor-pointer flex items-center gap-1 transition shrink-0">
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

                    {/* ② 人物立绘 */}
                    <div className="flex items-center justify-between gap-2 border-b border-neutral-850 pb-2.5">
                      <div className="min-w-0">
                        <span className="font-bold text-white text-[10.5px]">② 角色立绘 (中间层)</span>
                      </div>
                      <label className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-[10px] cursor-pointer flex items-center gap-1 transition shrink-0">
                        <Upload className="size-3" />
                        <span>上传立绘</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, (url) => setConfig((p) => ({ ...p, characterImage: url })))}
                        />
                      </label>
                    </div>

                    {/* ③ 免扣边框 */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-bold text-white text-[10.5px]">③ 免扣边框 (最上层)</span>
                      </div>
                      <label className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-[10px] cursor-pointer flex items-center gap-1 transition shrink-0">
                        <Upload className="size-3" />
                        <span>上传边框</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, (url) => setConfig((p) => ({ ...p, frameImage: url })))}
                        />
                      </label>
                    </div>
                  </div>

                  {/* 2. 出货概率与概率分配 */}
                  <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                    <span className="font-bold text-amber-300 text-[11px] block">📈 2. 出货概率百分比配置</span>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[9px] text-amber-400 mb-0.5 font-bold">SSR (%)</label>
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
                          className="w-full px-2 py-1 rounded bg-neutral-900 border border-neutral-850 text-[11px] text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-purple-400 mb-0.5 font-bold">SR (%)</label>
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
                          className="w-full px-2 py-1 rounded bg-neutral-900 border border-neutral-850 text-[11px] text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-blue-400 mb-0.5 font-bold">R (%)</label>
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
                          className="w-full px-2 py-1 rounded bg-neutral-900 border border-neutral-850 text-[11px] text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3. 添加新卡片到卡池 */}
                  <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2.5">
                    <span className="font-bold text-amber-300 text-[11px] block">🃏 3. 向卡池添加自定义卡片</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="卡片名称..."
                        value={newCardName}
                        onChange={(e) => setNewCardName(e.target.value)}
                        className="flex-1 px-2.5 py-1 rounded bg-neutral-900 border border-neutral-850 text-[11px] text-white"
                      />
                      <select
                        value={newCardRarity}
                        onChange={(e) => setNewCardRarity(e.target.value as any)}
                        className="px-2 py-1 rounded bg-neutral-900 border border-neutral-850 text-[11px] text-white"
                      >
                        <option value="SSR">SSR</option>
                        <option value="SR">SR</option>
                        <option value="R">R</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <label className="px-2.5 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-[10px] text-neutral-300 cursor-pointer flex items-center gap-1 transition">
                        <Upload className="size-3 animate-pulse" />
                        <span>{newCardImage ? '已选择卡面' : '上传卡面'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, (url) => setNewCardImage(url))}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={handleAddCard}
                        className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition shadow-sm"
                      >
                        <Plus className="size-3.5" />
                        <span>确认添加</span>
                      </button>
                    </div>
                  </div>

                  {/* 4. 现有卡片列表 */}
                  <div className="space-y-2">
                    <span className="font-bold text-neutral-300 text-[11px] block">📦 现有卡片 ({config.cards.length})</span>
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-0.5">
                      {config.cards.map((card) => (
                        <div
                          key={card.id}
                          className="p-1.5 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <img
                              src={card.image}
                              alt=""
                              className="size-7 rounded-lg object-cover bg-black shrink-0"
                              referrerPolicy="no-referrer"
                            />
                            <div className="min-w-0">
                              <span className="font-bold text-white text-[11px] truncate block">{card.name}</span>
                              <span className={`text-[7px] font-bold px-1 rounded ${
                                card.rarity === 'SSR' ? 'bg-amber-400 text-neutral-950' : card.rarity === 'SR' ? 'bg-purple-500 text-white' : 'bg-blue-600 text-white'
                              }`}>{card.rarity}</span>
                            </div>
                          </div>
                          {config.cards.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteCard(card.id)}
                              className="p-1 rounded text-neutral-500 hover:text-red-400 hover:bg-neutral-800 cursor-pointer transition"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Reset button */}
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('确认恢复默认预设卡池吗？')) {
                          setConfig(DEFAULT_CONFIG);
                        }
                      }}
                      className="px-2.5 py-1 rounded bg-neutral-950 hover:bg-neutral-850 text-neutral-500 hover:text-white text-[9.5px] flex items-center gap-1 cursor-pointer transition border border-neutral-855"
                    >
                      <RotateCcw className="size-3" />
                      <span>恢复默认预设</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* 2. 卡池详情 Modal */}
      {showDetailsModal && (
        <div className="absolute inset-0 z-40 bg-black/95 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="w-full h-full max-h-[85vh] max-w-sm bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-4 flex flex-col overflow-hidden text-neutral-200 relative">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800 shrink-0">
              <span className="font-bold text-amber-300 text-sm">✦ 卡池详情与概率 ✦</span>
              <button
                type="button"
                onClick={() => setShowDetailsModal(false)}
                className="text-white hover:text-neutral-100 text-xs font-bold px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 cursor-pointer transition-all shadow-md"
              >
                关闭
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-0.5">
              {/* Rate info */}
              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-850 space-y-1 text-center shrink-0">
                <span className="text-[10px] text-neutral-400">出货概率分布</span>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="p-1.5 rounded bg-neutral-900 border border-amber-500/20">
                    <span className="block text-[10px] text-amber-400 font-bold">SSR</span>
                    <span className="text-xs text-white font-bold">{(config.rates.SSR * 100).toFixed(1)}%</span>
                  </div>
                  <div className="p-1.5 rounded bg-neutral-900 border border-purple-500/20">
                    <span className="block text-[10px] text-purple-400 font-bold">SR</span>
                    <span className="text-xs text-white font-bold">{(config.rates.SR * 100).toFixed(1)}%</span>
                  </div>
                  <div className="p-1.5 rounded bg-neutral-900 border border-blue-500/20">
                    <span className="block text-[10px] text-blue-400 font-bold">R</span>
                    <span className="text-xs text-white font-bold">{(config.rates.R * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* Grouped card list */}
              <div className="space-y-2.5">
                {['SSR', 'SR', 'R'].map((rarity) => {
                  const items = config.cards.filter((c) => c.rarity === rarity);
                  if (items.length === 0) return null;
                  return (
                    <div key={rarity} className="space-y-1">
                      <span className={`text-[10px] font-black tracking-wider px-1.5 py-0.5 rounded ${
                        rarity === 'SSR'
                          ? 'text-amber-400 bg-amber-950/45'
                          : rarity === 'SR'
                          ? 'text-purple-400 bg-purple-950/45'
                          : 'text-blue-400 bg-blue-950/45'
                      }`}>
                        {rarity} 级共鸣对象 ({items.length})
                      </span>
                      <div className="grid grid-cols-1 gap-1.5 pl-1">
                        {items.map((item) => (
                          <div key={item.id} className="flex items-center gap-2.5 p-1.5 rounded-lg bg-neutral-950/50 hover:bg-neutral-950 transition-all border border-neutral-850">
                            <img src={item.image} alt="" className="size-8 rounded object-cover shrink-0" referrerPolicy="no-referrer" />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white leading-tight truncate">{item.name}</div>
                              {item.description && <div className="text-[9px] text-neutral-400 truncate">{item.description}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. 抽卡记录 Modal */}
      {showHistoryModal && (
        <div className="absolute inset-0 z-40 bg-black/95 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="w-full h-full max-h-[85vh] max-w-sm bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-4 flex flex-col overflow-hidden text-neutral-200 relative">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800 shrink-0">
              <span className="font-bold text-amber-300 text-sm">✦ 历史共鸣抽卡记录 ✦</span>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="text-white hover:text-neutral-100 text-xs font-bold px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 cursor-pointer transition-all shadow-md"
              >
                关闭
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2 space-y-1.5 pr-0.5">
              {pullHistory.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-neutral-500 text-xs italic">
                  暂无共鸣历史，赶快去抽卡吧！
                </div>
              ) : (
                pullHistory.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-neutral-950 border border-neutral-850"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`px-1 rounded text-[8px] font-black shrink-0 ${
                        item.rarity === 'SSR'
                          ? 'bg-amber-400 text-neutral-950'
                          : item.rarity === 'SR'
                          ? 'bg-purple-500 text-white'
                          : 'bg-blue-600 text-white'
                      }`}>
                        {item.rarity}
                      </span>
                      <span className="text-xs text-white truncate font-medium">{item.name}</span>
                    </div>
                    <span className="text-[9px] text-neutral-500 shrink-0 font-mono">
                      第 {pullHistory.length - idx} 次共鸣
                    </span>
                  </div>
                ))
              )}
            </div>

            {pullHistory.length > 0 && (
              <div className="pt-2 border-t border-neutral-800 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setPullHistory([])}
                  className="px-2.5 py-1 text-[10px] bg-red-900/40 hover:bg-red-900/60 text-red-300 hover:text-red-200 rounded cursor-pointer transition"
                >
                  清空记录
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
