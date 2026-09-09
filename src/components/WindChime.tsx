import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  X, 
  ChevronLeft, 
  Wifi, 
  Battery, 
  Sparkles, 
  User, 
  Image as ImageIcon, 
  Bot, 
  Music, 
  ShieldAlert, 
  Palette,
  Gamepad2,
  Database,
  GripVertical,
  RotateCcw,
  Check,
  ArrowLeft,
  ArrowRight,
  Move
} from 'lucide-react';
import RetroComputer from './phone/RetroComputer';
import type { GameLobbySubApp } from './phone/GameLobbyApp';
import type { LlmConfig } from '../lib/llm';
import { 
  subscribeGameInvite, 
  getPendingGameInvite, 
  playInviteVoiceNotification,
  loadActiveGameSession,
  loadActiveGhostCardSession,
  type GameInvitation,
  type GomokuMatchRecord 
} from '../lib/gameStore';
import {
  loadPhoneAppsOrder,
  savePhoneAppsOrder,
  loadWindChimePosition,
  loadWindChimeCordLength,
  type WindChimePosition,
} from '../lib/customStore';
import type { Character, EmotionVector } from '../data/types';

interface Props {
  onBgChange: (newBg: string) => void;
  currentBg?: string;
  currentCharacterId?: string;
  characterName?: string;
  character?: Character;
  currentEmotionSnapshot?: EmotionVector;
  onEngineReload?: () => void;
  onConfigChange?: (config: LlmConfig) => void;
  forceOpenApp?: AppId | null;
  forceOpenSubApp?: GameLobbySubApp | null;
  onClearForceOpenApp?: () => void;
  onGameFinished?: (
    summary: string, 
    rawRecord: any, 
    applyEmotionDelta?: boolean, 
    customDelta?: Partial<EmotionVector>
  ) => void;
  onApplyGameEmotionDelta?: (delta: Partial<EmotionVector>, summary: string) => void;
  onInGameChat?: (
    userInput: string,
    matchContext: { moveCount: number; playerColor: 'B' | 'W'; currentTurn: 'B' | 'W' },
    chatHistory?: Array<{ sender: 'user' | 'character' | 'system'; text: string }>
  ) => Promise<{ reply: string; tactic: 'aggressive' | 'defensive' | 'gentle' | 'balanced' } | string>;
  onRejectGameInvite?: (invite: GameInvitation) => void;
}

export type AppId = 'game_lobby' | 'backup' | 'persona' | 'wallpaper' | 'llm' | 'ambience' | 'dictionary' | 'css';

const APPS: Array<{
  id: AppId;
  name: string;
  subtitle: string;
  icon: React.ElementType;
  gradient: string;
  badge?: string;
}> = [
  {
    id: 'game_lobby',
    name: '游戏大厅',
    subtitle: '你画我猜·捉鬼牌·五子棋',
    icon: Gamepad2,
    gradient: 'from-amber-500 via-purple-600 to-rose-600',
    badge: '娱乐',
  },
  {
    id: 'backup',
    name: '数据备份',
    subtitle: '分文件与恢复',
    icon: Database,
    gradient: 'from-rose-500 via-pink-600 to-red-500',
    badge: '安全',
  },
  {
    id: 'persona',
    name: '人设档案',
    subtitle: '立绘与人设',
    icon: User,
    gradient: 'from-amber-500 to-orange-600',
    badge: '视觉',
  },
  {
    id: 'wallpaper',
    name: '背景装扮',
    subtitle: '换背景壁纸',
    icon: ImageIcon,
    gradient: 'from-blue-500 to-indigo-600',
  },
  {
    id: 'llm',
    name: '模型算力',
    subtitle: '抓取与接口',
    icon: Bot,
    gradient: 'from-emerald-500 to-teal-600',
    badge: '算力',
  },
  {
    id: 'ambience',
    name: '氛围白噪',
    subtitle: '雨声与壁炉',
    icon: Music,
    gradient: 'from-rose-500 to-pink-600',
  },
  {
    id: 'dictionary',
    name: '拦截词典',
    subtitle: '敏感与激化',
    icon: ShieldAlert,
    gradient: 'from-purple-500 to-violet-600',
  },
  {
    id: 'css',
    name: '视觉工坊',
    subtitle: '滤镜与CSS',
    icon: Palette,
    gradient: 'from-cyan-500 to-blue-600',
  },
];

const DEFAULT_CORD_LENGTH = 50; // default resting length in px

export default function WindChime({
  onBgChange,
  currentBg,
  currentCharacterId = 'char_001',
  characterName = '角色',
  character,
  currentEmotionSnapshot,
  onEngineReload,
  onConfigChange,
  forceOpenApp,
  forceOpenSubApp,
  onClearForceOpenApp,
  onGameFinished,
  onApplyGameEmotionDelta,
  onInGameChat,
  onRejectGameInvite,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeApp, setActiveApp] = useState<AppId | null>(null);

  // Phone Apps Order & Customization State
  const defaultAppIds = useMemo(() => APPS.map(a => a.id), []);
  const [appOrder, setAppOrder] = useState<string[]>(() => loadPhoneAppsOrder(defaultAppIds));
  const [isArranging, setIsArranging] = useState(false);
  const [draggedAppId, setDraggedAppId] = useState<string | null>(null);
  const [dragOverAppId, setDragOverAppId] = useState<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingAppRef = useRef(false);

  // Sync / Sort Apps based on current appOrder
  const sortedApps = useMemo(() => {
    const map = new Map(APPS.map(a => [a.id, a]));
    const result: typeof APPS = [];
    appOrder.forEach(id => {
      const found = map.get(id as AppId);
      if (found) result.push(found);
    });
    // Append any missing apps
    APPS.forEach(a => {
      if (!result.some(r => r.id === a.id)) {
        result.push(a);
      }
    });
    return result;
  }, [appOrder]);

  // Drag and Drop handlers for App Icons
  const handleAppDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedAppId(id);
    isDraggingAppRef.current = true;
  };

  const handleAppDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverAppId !== targetId) {
      setDragOverAppId(targetId);
    }
  };

  const handleAppDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = draggedAppId || e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetId) {
      setDraggedAppId(null);
      setDragOverAppId(null);
      setTimeout(() => { isDraggingAppRef.current = false; }, 100);
      return;
    }

    setAppOrder(prev => {
      const copy = [...prev];
      const fromIdx = copy.indexOf(sourceId);
      const toIdx = copy.indexOf(targetId);
      if (fromIdx !== -1 && toIdx !== -1) {
        const [item] = copy.splice(fromIdx, 1);
        copy.splice(toIdx, 0, item);
        savePhoneAppsOrder(copy);
        playChimeTinkle(0.7);
        return copy;
      }
      return prev;
    });

    setDraggedAppId(null);
    setDragOverAppId(null);
    setTimeout(() => { isDraggingAppRef.current = false; }, 100);
  };

  const handleAppDragEnd = () => {
    setDraggedAppId(null);
    setDragOverAppId(null);
    setTimeout(() => { isDraggingAppRef.current = false; }, 100);
  };

  // Move App by step (for button click on mobile / arrange mode)
  const handleShiftApp = (id: string, direction: 'left' | 'right', e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setAppOrder(prev => {
      const copy = [...prev];
      const idx = copy.indexOf(id);
      if (idx === -1) return prev;
      const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= copy.length) return prev;
      const temp = copy[idx];
      copy[idx] = copy[targetIdx];
      copy[targetIdx] = temp;
      savePhoneAppsOrder(copy);
      playChimeTinkle(0.6);
      return copy;
    });
  };

  // Reset to default app order
  const handleResetAppOrder = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setAppOrder(defaultAppIds);
    savePhoneAppsOrder(defaultAppIds);
    playChimeTinkle(0.9);
  };

  // Long press handler for touch mobile to trigger arrange mode
  const handleTouchStart = () => {
    longPressTimerRef.current = setTimeout(() => {
      setIsArranging(true);
      playChimeTinkle(0.5);
    }, 450);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Pending Game Invitation State
  const [pendingInvite, setPendingInvite] = useState<GameInvitation | null>(() => getPendingGameInvite());
  const [isChimeShaking, setIsChimeShaking] = useState(false);
  const lastProcessedInviteIdRef = useRef<string | null>(null);

  // Dynamic Rope Length & Position State
  const [windChimePos, setWindChimePos] = useState<WindChimePosition>(() => loadWindChimePosition());
  const [baseCordLength, setBaseCordLength] = useState<number>(() => loadWindChimeCordLength());
  const [cordLength, setCordLength] = useState(() => loadWindChimeCordLength());
  const [isDragging, setIsDragging] = useState(false);
  const dragStartYRef = useRef(0);
  const startCordLengthRef = useRef(50);
  const hasPlayedPullSoundRef = useRef(false);
  const chimeRef = useRef<HTMLDivElement>(null);

  // Sync layout changes
  useEffect(() => {
    const handleLayoutChange = () => {
      setWindChimePos(loadWindChimePosition());
      const newLen = loadWindChimeCordLength();
      setBaseCordLength(newLen);
      setCordLength(newLen);
      setAppOrder(loadPhoneAppsOrder(defaultAppIds));
    };
    window.addEventListener('windchime_layout_change', handleLayoutChange);
    return () => window.removeEventListener('windchime_layout_change', handleLayoutChange);
  }, [defaultAppIds]);

  // Real-time status bar time
  const [currentTime, setCurrentTime] = useState('23:59');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      setCurrentTime(`${h}:${m}`);
    };
    updateClock();
    const timer = setInterval(updateClock, 30000);
    return () => clearInterval(timer);
  }, []);

  // Subscribe to game invitations for shaking & voice prompt
  useEffect(() => {
    const unsub = subscribeGameInvite((invite) => {
      setPendingInvite(invite);
      if (invite && invite.id !== lastProcessedInviteIdRef.current) {
        lastProcessedInviteIdRef.current = invite.id;

        // 1. Wind chime shakes left and right
        setIsChimeShaking(true);
        setTimeout(() => {
          setIsChimeShaking(false);
        }, 1600);

        // 2. Play two-tone chime & female voice: "您有新的游戏邀请。"
        playInviteVoiceNotification();
      }
    });
    return unsub;
  }, []);

  // Handle external force open (e.g. clicking "开始" on invite modal)
  useEffect(() => {
    if (forceOpenApp) {
      setIsOpen(true);
      setActiveApp(forceOpenApp);
      if (onClearForceOpenApp) {
        onClearForceOpenApp();
      }
    }
  }, [forceOpenApp, onClearForceOpenApp]);

  // Audio synthesis for the wind chime
  const playChimeTinkle = (intensity = 1) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;

      [1480, 2200, 2960, 3700, 4400].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq + (Math.random() * 50 - 25), now + i * 0.04);
        gain.gain.setValueAtTime((0.06 * intensity) / (i + 1), now + i * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9 + i * 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.04);
        osc.stop(now + 1.2);
      });
    } catch {
      // ignore
    }
  };

  // Pointer drag event handlers with native PointerCapture for ultra-smooth pulling
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    hasPlayedPullSoundRef.current = false;
    dragStartYRef.current = e.clientY;
    startCordLengthRef.current = cordLength;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const deltaY = e.clientY - dragStartYRef.current;
    const newLen = Math.max(35, Math.min(340, startCordLengthRef.current + deltaY));
    setCordLength(newLen);

    if (deltaY > 18 && !hasPlayedPullSoundRef.current) {
      playChimeTinkle(0.9);
      hasPlayedPullSoundRef.current = true;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const pulledDistance = cordLength - baseCordLength;
    const totalTravel = Math.abs(cordLength - startCordLengthRef.current);

    if (pulledDistance > 20 || totalTravel > 15 || totalTravel < 4) {
      if (!hasPlayedPullSoundRef.current) {
        playChimeTinkle(1.1);
      }
      setIsOpen(true);
      setCordLength(Math.max(baseCordLength, Math.min(130, cordLength)));
    } else {
      setCordLength(baseCordLength);
    }
  };

  return (
    <>
      {/* ================= 1. HANGING WIND CHIME (RESTORED TO TOP LEFT) ================= */}
      <div 
        className={`fixed top-0 left-2.5 sm:left-3.5 z-40 select-none flex flex-col items-center pointer-events-auto cursor-grab active:cursor-grabbing transition-all duration-300 ${
          isChimeShaking ? 'animate-chime-swing' : ''
        }`}
        title="下拉风铃绳索，开启手机控制台"
      >
        {/* Top Ceiling Mounting Ring */}
        <div className="w-3.5 h-1.5 bg-gradient-to-b from-amber-300 via-amber-200 to-amber-500 rounded-b-md shadow-sm border border-amber-200/80" />

        {/* Dynamic Elastic Silken Rope */}
        <div 
          className="w-[1.5px] bg-gradient-to-b from-rose-400 via-rose-300 to-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.35)] transition-[height] duration-75 origin-top relative"
          style={{ height: `${cordLength}px` }}
        />

        {/* Sakura Glass Wind Chime Bell Body & Striker */}
        <div 
          ref={chimeRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={() => {
            if (!isOpen) {
              playChimeTinkle(0.8);
              setIsOpen(true);
            }
          }}
          className={`flex flex-col items-center -mt-0.5 group touch-none transition-transform duration-150 relative ${
            isDragging ? 'scale-110' : 'hover:scale-105'
          }`}
        >
          {/* Active Invitation Badge on the Bell */}
          {pendingInvite && (
            <div className="absolute -top-1 -right-1 size-3 bg-red-500 rounded-full ring-2 ring-pink-200 shadow-md animate-ping z-20" />
          )}
          {pendingInvite && (
            <div className="absolute -top-1 -right-1 size-3 bg-red-500 rounded-full ring-2 ring-pink-200 shadow-md flex items-center justify-center text-[7px] text-white font-bold z-20">
              !
            </div>
          )}

          {/* Transparent Round Glass Sakura Wind Chime (精美像素风圆玻璃樱花风铃与纯粉渐变手札) */}
          <div className="relative w-9 flex flex-col items-center">
            {/* Round Crystal Glass Bell Dome with Cherry Blossom Bouquet Inside */}
            <svg 
              viewBox="0 0 36 34" 
              className="w-9 h-[34px] drop-shadow-[0_4px_12px_rgba(244,114,182,0.35)] overflow-visible select-none"
            >
              <defs>
                {/* Translucent Round Glass Dome Gradient */}
                <radialGradient id="roundGlassDome" cx="40%" cy="35%" r="65%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
                  <stop offset="30%" stopColor="#fff0f5" stopOpacity="0.35" />
                  <stop offset="75%" stopColor="#ffe4ec" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#ffd1dc" stopOpacity="0.55" />
                </radialGradient>

                {/* Glass Highlight Shine */}
                <linearGradient id="glassTopGlare" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0.1" />
                </linearGradient>

                {/* Sakura Petal Soft Radial Gradient */}
                <radialGradient id="sakuraPetalGrad" cx="50%" cy="40%" r="60%">
                  <stop offset="0%" stopColor="#ff5277" />
                  <stop offset="45%" stopColor="#ff758f" />
                  <stop offset="85%" stopColor="#ffa6b9" />
                  <stop offset="100%" stopColor="#ffd8e2" />
                </radialGradient>
              </defs>

              {/* Top Metal Cap Loop / Bead Connector */}
              <rect x="16.5" y="0.5" width="3" height="2.5" rx="1" fill="#d8b4c0" stroke="#f0d5df" strokeWidth="0.5" />

              {/* Round Glass Outer Shell */}
              <circle
                cx="18"
                cy="17"
                r="14"
                fill="url(#roundGlassDome)"
                stroke="#fce7ee"
                strokeWidth="0.9"
              />

              {/* Bottom Opening Rim Double-Ring Lip */}
              <ellipse 
                cx="18" 
                cy="28.5" 
                rx="10.5" 
                ry="2" 
                fill="rgba(255, 235, 242, 0.45)" 
                stroke="#ffffff" 
                strokeWidth="0.8" 
              />
              <ellipse 
                cx="18" 
                cy="28.5" 
                rx="8" 
                ry="1.2" 
                fill="none" 
                stroke="rgba(255, 192, 203, 0.5)" 
                strokeWidth="0.5" 
              />

              {/* Top-Left Crisp Specular Crescent Highlight on Glass */}
              <path
                d="M9 10 C12 6, 17 5, 22 6 C17 6.5, 12 9, 9 14 C8 11.5, 8.5 10.5, 9 10 Z"
                fill="url(#glassTopGlare)"
              />

              {/* Inside Glass: Green Branch & Stems */}
              <path
                d="M13 19 Q16 16 23 14 M17 17 Q20 19 25 18"
                fill="none"
                stroke="#6b8e23"
                strokeWidth="0.9"
                strokeLinecap="round"
                opacity="0.85"
              />

              {/* Inside Glass: Blooming Sakura Flower 1 (Large Center Bloom) */}
              <g transform="translate(19, 15) scale(0.68)">
                {/* 5 Petals */}
                <path d="M0 0 C-3 -6, -5 -8, 0 -11 C5 -8, 3 -6, 0 0 Z" fill="url(#sakuraPetalGrad)" />
                <path d="M0 0 C6 -3, 8 -5, 11 0 C8 5, 6 3, 0 0 Z" fill="url(#sakuraPetalGrad)" />
                <path d="M0 0 C3 6, 5 8, 0 11 C-5 8, -3 6, 0 0 Z" fill="url(#sakuraPetalGrad)" />
                <path d="M0 0 C-6 3, -8 5, -11 0 C-8 -5, -6 -3, 0 0 Z" fill="url(#sakuraPetalGrad)" />
                <path d="M0 0 C-5 -5, -7 -7, -2 -10 C2 -8, 1 -5, 0 0 Z" fill="url(#sakuraPetalGrad)" />
                {/* Core Pistil */}
                <circle cx="0" cy="0" r="1.8" fill="#d90429" />
                <circle cx="0" cy="0" r="0.8" fill="#fff" />
              </g>

              {/* Inside Glass: Sakura Flower 2 (Upper Right Bloom) */}
              <g transform="translate(23, 11) scale(0.48) rotate(22)">
                <path d="M0 0 C-3 -5, -4 -7, 0 -9 C4 -7, 3 -5, 0 0 Z" fill="url(#sakuraPetalGrad)" />
                <path d="M0 0 C5 -3, 7 -4, 9 0 C7 4, 5 3, 0 0 Z" fill="url(#sakuraPetalGrad)" />
                <path d="M0 0 C3 5, 4 7, 0 9 C-4 7, -3 5, 0 0 Z" fill="url(#sakuraPetalGrad)" />
                <path d="M0 0 C-5 3, -7 4, -9 0 C-7 -4, -5 -3, 0 0 Z" fill="url(#sakuraPetalGrad)" />
                <circle cx="0" cy="0" r="1.5" fill="#d90429" />
              </g>

              {/* Inside Glass: Left Blossom Cluster & Drifting Petals */}
              <g transform="translate(12, 16) scale(0.42) rotate(-35)">
                <path d="M0 0 C-3 -5, -4 -7, 0 -9 C4 -7, 3 -5, 0 0 Z" fill="url(#sakuraPetalGrad)" opacity="0.9" />
                <path d="M0 0 C5 -3, 7 -4, 9 0 C7 4, 5 3, 0 0 Z" fill="url(#sakuraPetalGrad)" opacity="0.9" />
                <circle cx="0" cy="0" r="1.2" fill="#d90429" />
              </g>
              <circle cx="10" cy="20" r="1.1" fill="#ffa8ba" opacity="0.8" />
              <circle cx="26" cy="18" r="1.2" fill="#ff758f" opacity="0.85" />
              <circle cx="21" cy="22" r="1" fill="#ffccd8" opacity="0.85" />

              {/* Central Glass Clapper Rod (垂直中心琉璃棒) */}
              <line x1="18" y1="4" x2="18" y2="30" stroke="rgba(255,255,255,0.9)" strokeWidth="1.2" />
              <line x1="17.7" y1="4" x2="17.7" y2="30" stroke="rgba(255,182,193,0.7)" strokeWidth="0.6" />

              {/* Clapper Glass Bead Clapper (琉璃粉色击响珠) */}
              <circle cx="18" cy="24" r="2.2" fill="#ff758f" stroke="#ffffff" strokeWidth="0.7" />
              <circle cx="17.3" cy="23.3" r="0.7" fill="#ffffff" />

              {/* Bottom Metal Hook Ring */}
              <circle cx="18" cy="31.5" r="1.2" fill="none" stroke="#c099a8" strokeWidth="0.8" />
            </svg>

            {/* Connecting Cord to Tanzaku */}
            <div className="w-[1.2px] h-2.5 bg-rose-300 shadow-xs -mt-0.5" />

            {/* Pure Pink Gradient Tanzaku (纯粉色渐变和风手札 / 短册) */}
            <div className="relative w-5 h-16 rounded-xs border border-[#f0a8bc] shadow-[0_4px_14px_rgba(244,114,182,0.3)] bg-gradient-to-b from-[#ffe5ed] via-[#fba5bb] to-[#e8819a] flex flex-col items-center justify-between p-0.5 animate-tanzaku-sway group-hover:rotate-4 transition-transform duration-200 cursor-pointer overflow-hidden">
              {/* Top Center Hanging Metal Eyelet & Knot */}
              <div className="w-1.5 h-1.5 rounded-full border border-rose-400 bg-white/70 shadow-2xs flex items-center justify-center mt-0.5">
                <div className="w-0.5 h-0.5 rounded-full bg-rose-600" />
              </div>

              {/* Painted Pixel Sakura Motifs on the Pure Pink Gradient Slip */}
              <div className="w-full flex-1 relative pointer-events-none">
                {/* Upper Subtle Sakura Blossom Watermark */}
                <div className="absolute top-1.5 left-0.5 opacity-60">
                  <div className="relative size-3">
                    <div className="absolute inset-0 m-auto size-1.5 rounded-full bg-white/80" />
                    <div className="absolute -top-0.5 left-1 size-1 rounded-full bg-white/70" />
                    <div className="absolute -bottom-0.5 left-1 size-1 rounded-full bg-white/70" />
                    <div className="absolute top-1 -left-0.5 size-1 rounded-full bg-white/70" />
                    <div className="absolute top-1 -right-0.5 size-1 rounded-full bg-white/70" />
                  </div>
                </div>

                {/* Middle Drifting Petals */}
                <div className="absolute top-6 right-1 size-1 rounded-full bg-white/65 rotate-12" />
                <div className="absolute top-8 left-1 size-0.5 rounded-full bg-rose-200/80" />

                {/* Lower Sakura Cluster Watermark */}
                <div className="absolute bottom-1 right-0.5 opacity-70">
                  <div className="relative size-3">
                    <div className="absolute inset-0 m-auto size-1.5 rounded-full bg-white/80" />
                    <div className="absolute -top-0.5 left-1 size-1 rounded-full bg-white/75" />
                    <div className="absolute -bottom-0.5 left-1 size-1 rounded-full bg-white/75" />
                    <div className="absolute top-1 -left-0.5 size-1 rounded-full bg-white/75" />
                    <div className="absolute top-1 -right-0.5 size-1 rounded-full bg-white/75" />
                    <div className="absolute inset-0 m-auto size-0.5 rounded-full bg-rose-700/60" />
                  </div>
                </div>
              </div>

              {/* Bottom Edge Delicate Accent */}
              <div className="w-3 h-[1px] bg-rose-200/50 mb-0.5" />
            </div>
          </div>

          {/* Real-time Stretch Drag Hint */}
          {isDragging && (
            <div className="absolute top-full mt-2.5 whitespace-nowrap bg-black/90 text-[10px] text-pink-200 font-medium px-2.5 py-1 rounded-full border border-pink-400/40 backdrop-blur-md shadow-2xl animate-fade-in pointer-events-none">
              {cordLength > 80 ? '松开进入终端电脑 🖥️' : '继续向下拉动风铃绳索...'}
            </div>
          )}
        </div>
      </div>

      {/* ================= 2. POP-UP RETRO DESKTOP COMPUTER INTERFACE ================= */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md overflow-y-auto p-2 sm:p-4 animate-in fade-in-0 duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <RetroComputer
            onClose={() => setIsOpen(false)}
            onBgChange={onBgChange}
            currentBg={currentBg}
            currentCharacterId={currentCharacterId}
            characterName={characterName}
            character={character}
            currentEmotionSnapshot={currentEmotionSnapshot}
            onEngineReload={onEngineReload}
            onConfigChange={onConfigChange}
            forceOpenApp={activeApp}
            forceOpenSubApp={forceOpenSubApp}
            onClearForceOpenApp={() => {
              setActiveApp(null);
              if (onClearForceOpenApp) onClearForceOpenApp();
            }}
            onGameFinished={onGameFinished}
            onApplyGameEmotionDelta={onApplyGameEmotionDelta}
            onInGameChat={onInGameChat}
            onRejectGameInvite={onRejectGameInvite}
            pendingInvite={pendingInvite}
          />
        </div>
      )}

    </>
  );
}
