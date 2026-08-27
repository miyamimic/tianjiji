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
  GripVertical,
  RotateCcw,
  Check,
  ArrowLeft,
  ArrowRight,
  Move
} from 'lucide-react';
import PersonaApp from './phone/PersonaApp';
import WallpaperApp from './phone/WallpaperApp';
import LlmApp from './phone/LlmApp';
import AmbienceApp from './phone/AmbienceApp';
import DictionaryApp from './phone/DictionaryApp';
import CssApp from './phone/CssApp';
import GameLobbyApp, { type GameLobbySubApp } from './phone/GameLobbyApp';
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

export type AppId = 'game_lobby' | 'persona' | 'wallpaper' | 'llm' | 'ambience' | 'dictionary' | 'css';

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
    subtitle: '捉鬼牌·五子棋·表情',
    icon: Gamepad2,
    gradient: 'from-amber-500 via-purple-600 to-rose-600',
    badge: '娱乐',
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

          {/* Transparent Glass Bell Dome with Painted Sakura Motif (透明玻璃樱花风铃) */}
          <div className="relative w-8 h-6 flex items-center justify-center">
            {/* Ultra-realistic Glass Bell SVG */}
            <svg 
              viewBox="0 0 32 24" 
              className="w-full h-full drop-shadow-[0_4px_10px_rgba(255,182,193,0.45)] overflow-visible"
            >
              <defs>
                {/* Transparent Crystal Glass Gradient */}
                <linearGradient id="sakuraGlassBody" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.65" />
                  <stop offset="25%" stopColor="#ffeef2" stopOpacity="0.25" />
                  <stop offset="70%" stopColor="#fff5f7" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#ffd8e2" stopOpacity="0.45" />
                </linearGradient>

                {/* Curved Specular Glare Highlight */}
                <linearGradient id="sakuraGlare" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0.1" />
                </linearGradient>

                {/* Sakura Petal Color Gradient */}
                <radialGradient id="sakuraPetalPink" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ff4d79" />
                  <stop offset="55%" stopColor="#ff85a2" />
                  <stop offset="100%" stopColor="#ffccd8" />
                </radialGradient>
              </defs>

              {/* Glass Dome Outline & Translucent Body */}
              <path
                d="M4 22 C4 9, 10 2, 16 2 C22 2, 28 9, 28 22 C24 23.5, 8 23.5, 4 22 Z"
                fill="url(#sakuraGlassBody)"
                stroke="rgba(255, 255, 255, 0.9)"
                strokeWidth="0.85"
              />

              {/* Glass Rim Highlight Bottom Lip */}
              <ellipse 
                cx="16" 
                cy="22" 
                rx="12" 
                ry="1.8" 
                fill="rgba(255, 240, 245, 0.4)" 
                stroke="rgba(255, 255, 255, 0.85)" 
                strokeWidth="0.75" 
              />

              {/* Top Left Glossy Light Reflection Curve */}
              <path
                d="M8 6 C10 3.5, 13 3, 15 3 C13.5 4, 11 5, 9.5 9 C8.5 12, 8 16, 7 19 C6.5 15, 6.8 9.5, 8 6 Z"
                fill="url(#sakuraGlare)"
              />

              {/* Right Edge Subtle Glass Specular Accent */}
              <path
                d="M23 5 C24.5 7, 25.5 10, 25.5 15 C24.8 12, 24 8, 23 5 Z"
                fill="#ffffff"
                opacity="0.6"
              />

              {/* Painted Sakura Blossom Motif 1 (Center-Left Blooming Flower) */}
              <g transform="translate(13.5, 12.5) scale(0.62) rotate(12)">
                {/* 5 Petals */}
                <path d="M0 0 C-2.5 -5, -4 -7, 0 -9 C4 -7, 2.5 -5, 0 0 Z" fill="url(#sakuraPetalPink)" opacity="0.92" />
                <path d="M0 0 C5 -2.5, 7 -4, 9 0 C7 4, 5 2.5, 0 0 Z" fill="url(#sakuraPetalPink)" opacity="0.92" />
                <path d="M0 0 C2.5 5, 4 7, 0 9 C-4 7, -2.5 5, 0 0 Z" fill="url(#sakuraPetalPink)" opacity="0.92" />
                <path d="M0 0 C-5 2.5, -7 4, -9 0 C-7 -4, -5 -2.5, 0 0 Z" fill="url(#sakuraPetalPink)" opacity="0.92" />
                <path d="M0 0 C-4 -4, -6 -6, -2 -8 C1 -7, 0 -4, 0 0 Z" fill="url(#sakuraPetalPink)" opacity="0.85" />
                {/* Flower Center Stamen & Core */}
                <circle cx="0" cy="0" r="1.6" fill="#e11d48" />
                <circle cx="0" cy="0" r="0.7" fill="#fff" />
              </g>

              {/* Painted Sakura Blossom Motif 2 (Small Drifting Petals & Buds) */}
              <g transform="translate(21, 8) scale(0.4) rotate(40)">
                <path d="M0 0 C-3 -4, -3 -6, 0 -7 C3 -6, 3 -4, 0 0 Z" fill="url(#sakuraPetalPink)" opacity="0.88" />
                <circle cx="0" cy="0" r="1" fill="#e11d48" />
              </g>
              <g transform="translate(8.5, 16.5) scale(0.35) rotate(-25)">
                <path d="M0 0 C-2.5 -4, -2.5 -6, 0 -7 C2.5 -6, 2.5 -4, 0 0 Z" fill="#ff758f" opacity="0.85" />
              </g>
              <g transform="translate(19.5, 17.5) scale(0.3) rotate(65)">
                <path d="M0 0 C-2 -3, -2 -5, 0 -6 C2 -5, 2 -3, 0 0 Z" fill="#ff99b0" opacity="0.8" />
              </g>
            </svg>

            {/* Suspended Crystal Clapper Bead Visible Inside Glass Dome */}
            <div className="absolute inset-x-0 top-1 bottom-1 flex flex-col items-center justify-between pointer-events-none">
              <div className="w-[1px] h-3 bg-rose-400/80" />
              {/* Pink Glass Clapper Bead (琉璃粉珠) */}
              <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-rose-500 via-pink-300 to-white shadow-[0_0_6px_rgba(244,63,94,0.7)] ring-1 ring-white/90 animate-pulse" />
              <div className="w-[1px] h-1.5 bg-rose-400/80" />
            </div>
          </div>

          {/* Crimson Silk Cord & Top Knot Connecting to Tanzaku */}
          <div className="w-[1.5px] h-2.5 bg-rose-400/90" />
          <div className="w-1.5 h-1.5 rounded-full bg-rose-600 shadow-xs ring-1 ring-rose-200" />
          <div className="w-[1.5px] h-1.5 bg-rose-400/90" />

          {/* Japanese Sakura Poetry Tanzaku Paper Slip (短册 / 樱花笺) */}
          <div className="w-4 h-9 bg-gradient-to-b from-[#fffafb] via-[#ffeef2] to-[#ffdce5] rounded-b-xs border border-[#f7b6c8] shadow-[0_4px_12px_rgba(224,122,147,0.25)] flex flex-col items-center justify-between py-1 px-0.5 animate-tanzaku-sway group-hover:rotate-6 transition-transform duration-200 cursor-pointer">
            {/* Top Red Hole & Sakura Petal Icon */}
            <div className="w-1 h-1 rounded-full bg-rose-500 shadow-xs" />
            
            {/* Vertical Calligraphy Seal */}
            <span className="text-[7.5px] text-[#732641] font-serif font-bold tracking-tighter leading-none scale-90 select-none">
              灵犀
            </span>

            {/* Bottom Sakura Blossom Accent on Slip */}
            <div className="flex flex-col items-center gap-0.5">
              <div className="w-2 h-[1px] bg-rose-300/60" />
              <div className="size-1.5 rounded-full bg-rose-400/80" />
            </div>
          </div>

          {/* Real-time Stretch Drag Hint */}
          {isDragging && (
            <div className="absolute top-full mt-2.5 whitespace-nowrap bg-black/90 text-[10px] text-pink-200 font-medium px-2.5 py-1 rounded-full border border-pink-400/40 backdrop-blur-md shadow-2xl animate-fade-in pointer-events-none">
              {cordLength > 80 ? '松开拉开灵犀手机 📱' : '继续向下拉动风铃绳索...'}
            </div>
          )}
        </div>
      </div>

      {/* ================= 2. POP-UP SMARTPHONE / GAME INTERFACE ================= */}
      {isOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md animate-in fade-in-0 duration-200 ${
            activeApp === 'game_lobby' ? 'p-0 sm:p-3' : 'p-3 sm:p-6'
          }`}
        >
          {/* Backdrop click to close */}
          <div className="absolute inset-0" onClick={() => setIsOpen(false)} />

          {/* Chassis Window */}
          <div
            className={`relative w-full transition-all duration-300 ${
              activeApp === 'game_lobby'
                ? 'max-w-full sm:max-w-[480px] h-full sm:h-[94vh] sm:max-h-[860px] sm:rounded-[36px] rounded-none bg-gradient-to-b from-[#1c1917] via-[#141210] to-[#0c0a09] border-0 sm:border-[2px] sm:border-amber-500/30'
                : 'max-w-[390px] h-[660px] max-h-[92vh] rounded-[42px] bg-gradient-to-b from-[hsl(222_30%_12%)] via-[hsl(222_35%_8%)] to-[hsl(222_40%_5%)] border-[3px] border-white/20'
            } shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_40px_rgba(245,158,11,0.15)] flex flex-col overflow-hidden ring-1 ring-black/80 z-10 animate-in zoom-in-95 duration-200`}
          >
            {/* Top Speaker / Dynamic Island Notch & Status Bar */}
            <div className="relative pt-2.5 px-5 pb-2 flex items-center justify-between text-white/80 select-none shrink-0 border-b border-white/5 bg-black/30">
              {/* Clock */}
              <span className="text-[12px] font-semibold tracking-wider text-white">
                {currentTime}
              </span>

              {/* Dynamic Island Pill */}
              <div className="absolute left-1/2 -translate-x-1/2 top-2 w-24 h-5 bg-black rounded-full border border-white/10 flex items-center justify-center gap-1.5 px-2 shadow-inner">
                <div className="size-2 rounded-full bg-amber-400/90 animate-pulse" />
                <span className="text-[8px] text-white/60 font-mono tracking-tighter">
                  {activeApp === 'game_lobby' ? '游戏大厅' : '灵犀 OS'}
                </span>
                <div className="size-1.5 rounded-full bg-white/20" />
              </div>

              {/* Status Icons */}
              <div className="flex items-center gap-2 text-white/70">
                <span className="text-[9px] font-bold">5G</span>
                <Wifi className="size-3" />
                <div className="flex items-center gap-0.5">
                  <Battery className="size-3.5" />
                  <span className="text-[9px]">99%</span>
                </div>
              </div>
            </div>

            {/* In-App Header (If an App is opened) */}
            {activeApp && (
              <div className="flex items-center justify-between px-3.5 py-2 bg-black/40 border-b border-white/10 shrink-0">
                <button
                  onClick={() => setActiveApp(null)}
                  className="flex items-center gap-1 text-xs font-semibold text-[hsl(28_85%_62%)] hover:text-amber-300 transition-colors py-1 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer"
                >
                  <ChevronLeft className="size-4" />
                  <span>{activeApp === 'game_lobby' ? '退出大厅' : '返回桌面'}</span>
                </button>

                <span className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                  {activeApp === 'game_lobby' ? (
                    <>
                      <Gamepad2 className="size-3.5 text-amber-400" />
                      <span>游戏大厅 · {characterName}</span>
                    </>
                  ) : (
                    APPS.find((a) => a.id === activeApp)?.name
                  )}
                </span>

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="关闭"
                >
                  <X className="size-4" />
                </button>
              </div>
            )}

            {/* Smartphone Screen Body */}
            <div
              className={`flex-1 overflow-y-auto ${
                activeApp === 'game_lobby' ? 'px-2.5 sm:px-3.5 py-2' : 'px-4 py-3'
              } no-scrollbar`}
            >
              
              {/* ========== HOME SCREEN (3-COLUMNS APP GRID) ========== */}
              {!activeApp ? (
                <div className="space-y-3.5 pt-1 animate-in fade-in-0 duration-200 select-none">
                  {/* Home Greeting & Status Widget */}
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 shadow-md space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-[hsl(28_85%_62%)]" />
                        <span className="text-xs font-bold text-white">灵犀控制中心</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {/* Arrange Mode Toggle Button */}
                        <button
                          onClick={() => {
                            setIsArranging(!isArranging);
                            playChimeTinkle(0.6);
                          }}
                          className={`px-2 py-0.5 rounded-full text-[9px] font-medium flex items-center gap-1 transition-all ${
                            isArranging
                              ? 'bg-amber-400 text-amber-950 font-bold shadow-md shadow-amber-500/20 ring-1 ring-amber-300'
                              : 'bg-white/10 hover:bg-white/20 text-white/80 border border-white/10'
                          }`}
                          title={isArranging ? '完成桌面图标排列' : '自定义调整图标位置'}
                        >
                          {isArranging ? (
                            <>
                              <Check className="size-2.5" />
                              <span>完成</span>
                            </>
                          ) : (
                            <>
                              <Move className="size-2.5 text-amber-300" />
                              <span>排列图标</span>
                            </>
                          )}
                        </button>

                        {/* Reset App Order Button */}
                        {isArranging && (
                          <button
                            onClick={handleResetAppOrder}
                            className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                            title="恢复默认图标顺序"
                          >
                            <RotateCcw className="size-2.5" />
                          </button>
                        )}

                        <span className="text-[9px] text-amber-300/80 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full font-mono">
                          ONLINE
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-white/50 leading-tight">
                      <span>
                        {isArranging 
                          ? '✨ 拖拽卡片或点击左右箭头调整桌面顺序' 
                          : '💡 拖拽卡片或长按图标可自定义排列顺序'}
                      </span>
                    </div>
                  </div>

                  {/* Pending Game Invitation Banner on Home Screen */}
                  {pendingInvite && (
                    <button
                      onClick={() => setActiveApp('game_lobby')}
                      className="w-full p-2.5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-rose-500/20 border border-amber-400/40 flex items-center justify-between text-left shadow-lg hover:border-amber-400/70 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-xl bg-[hsl(28_85%_62%)] text-amber-950">
                          <Gamepad2 className="size-4 animate-bounce" />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-amber-200 group-hover:text-white transition-colors">
                            {pendingInvite.characterName} 邀你游戏对决
                          </p>
                          <p className="text-[9px] text-amber-300/70">
                            {pendingInvite.gameType === 'ghost_card' ? '🃏 捉鬼牌纸牌对决' : '♟️ 五子棋对弈'} · 点击前往大厅赴约
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-amber-950 bg-[hsl(28_85%_62%)] px-2 py-1 rounded-lg shadow-sm">
                        赴约
                      </span>
                    </button>
                  )}

                  {/* 3-Column Phone App Grid (Draggable & Reorderable) */}
                  <div className="grid grid-cols-3 gap-2.5 pt-1">
                    {sortedApps.map((app, index) => {
                      const Icon = app.icon;
                      const isGameLobbyWithInvite = app.id === 'game_lobby' && !!pendingInvite;
                      const activeGomokuSession = app.id === 'game_lobby' ? loadActiveGameSession(currentCharacterId) : null;
                      const activeGhostSession = app.id === 'game_lobby' ? loadActiveGhostCardSession(currentCharacterId) : null;
                      const hasPausedGomoku = !!activeGomokuSession && activeGomokuSession.moveHistory.length > 0;
                      const hasPausedGhost = !!activeGhostSession && (activeGhostSession.userHand.length > 0 || activeGhostSession.charHand.length > 0);

                      const isSelfDragging = draggedAppId === app.id;
                      const isDropTarget = dragOverAppId === app.id;

                      return (
                        <div
                          key={app.id}
                          draggable
                          onDragStart={(e) => handleAppDragStart(e, app.id)}
                          onDragOver={(e) => handleAppDragOver(e, app.id)}
                          onDrop={(e) => handleAppDrop(e, app.id)}
                          onDragEnd={handleAppDragEnd}
                          onTouchStart={handleTouchStart}
                          onTouchEnd={handleTouchEnd}
                          onClick={() => {
                            if (!isArranging && !isDraggingAppRef.current) {
                              setActiveApp(app.id);
                            }
                          }}
                          className={`group relative flex flex-col items-center p-2.5 rounded-2xl transition-all duration-200 text-center shadow-md cursor-pointer select-none ${
                            isSelfDragging
                              ? 'opacity-30 scale-90 border-dashed border-2 border-amber-400 bg-amber-950/30 ring-2 ring-amber-400/40'
                              : isDropTarget
                              ? 'scale-105 border-2 border-amber-400 bg-amber-950/40 shadow-lg shadow-amber-500/30 ring-2 ring-amber-300'
                              : isArranging
                              ? 'bg-white/[0.07] border border-amber-400/50 hover:border-amber-400 shadow-md ring-1 ring-amber-400/20'
                              : 'bg-black/40 hover:bg-white/[0.08] border border-white/10 hover:border-[hsl(28_85%_62%/0.4)] hover:shadow-[hsl(28_85%_62%/0.15)] active:scale-95'
                          }`}
                        >
                          {/* Arrange Mode: Reorder Left / Right Quick Control Buttons on Mobile */}
                          {isArranging && (
                            <div className="absolute -top-1.5 inset-x-1 flex items-center justify-between z-20 pointer-events-auto">
                              <button
                                disabled={index === 0}
                                onClick={(e) => handleShiftApp(app.id, 'left', e)}
                                className="size-5 rounded-full bg-neutral-900 border border-amber-400/80 text-amber-300 flex items-center justify-center disabled:opacity-20 hover:bg-amber-400 hover:text-black transition-all shadow-md active:scale-90"
                                title="向左移动"
                              >
                                <ArrowLeft className="size-3" />
                              </button>
                              <button
                                disabled={index === sortedApps.length - 1}
                                onClick={(e) => handleShiftApp(app.id, 'right', e)}
                                className="size-5 rounded-full bg-neutral-900 border border-amber-400/80 text-amber-300 flex items-center justify-center disabled:opacity-20 hover:bg-amber-400 hover:text-black transition-all shadow-md active:scale-90"
                                title="向右移动"
                              >
                                <ArrowRight className="size-3" />
                              </button>
                            </div>
                          )}

                          {/* Badge (e.g. AI视觉, 新邀请, 暂停中) */}
                          {!isArranging && (app.badge || isGameLobbyWithInvite || hasPausedGomoku || hasPausedGhost) && (
                            <span
                              className={`absolute -top-1 -right-1 text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-md z-10 ${
                                isGameLobbyWithInvite
                                  ? 'bg-red-500 text-white animate-pulse'
                                  : hasPausedGomoku || hasPausedGhost
                                  ? 'bg-amber-500 text-amber-950 font-bold'
                                  : 'text-amber-950 bg-[hsl(28_85%_62%)]'
                              }`}
                            >
                              {isGameLobbyWithInvite
                                ? '新邀约'
                                : hasPausedGomoku
                                ? `棋局(${activeGomokuSession?.moveHistory.length}手)`
                                : hasPausedGhost
                                ? `牌局(${activeGhostSession?.turnCount}轮)`
                                : app.badge}
                            </span>
                          )}

                          {/* App Icon (Squircle shape) */}
                          <div
                            className={`size-12 rounded-2xl bg-gradient-to-br ${app.gradient} shadow-md group-hover:scale-105 transition-transform duration-200 flex items-center justify-center mb-1.5 ring-1 ring-white/20 relative`}
                          >
                            <Icon className="size-6 text-white drop-shadow-sm" />
                            {isArranging && (
                              <div className="absolute inset-0 rounded-2xl bg-black/20 flex items-center justify-center">
                                <GripVertical className="size-4 text-white/90 drop-shadow-md" />
                              </div>
                            )}
                          </div>

                          {/* App Label & Subtitle */}
                          <div className="space-y-0.5 w-full">
                            <h4 className="text-[11.5px] font-bold text-white group-hover:text-[hsl(28_85%_62%)] transition-colors truncate">
                              {app.name}
                            </h4>
                            <p className="text-[9px] text-white/40 leading-none truncate scale-95">
                              {app.subtitle}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* ========== IN-APP DETAIL VIEW ========== */
                <div className="animate-in fade-in-0 duration-200 pt-1">
                  {activeApp === 'game_lobby' && (
                    <GameLobbyApp
                      currentCharacterId={currentCharacterId}
                      characterName={characterName}
                      character={character}
                      currentEmotionSnapshot={currentEmotionSnapshot}
                      onGameFinished={onGameFinished}
                      onApplyGameEmotionDelta={onApplyGameEmotionDelta}
                      onInGameChat={onInGameChat}
                      onRejectGameInvite={onRejectGameInvite}
                      onExitLobby={() => setActiveApp(null)}
                    />
                  )}
                  {activeApp === 'persona' && (
                    <PersonaApp
                      currentCharacterId={currentCharacterId}
                      onEngineReload={onEngineReload}
                    />
                  )}
                  {activeApp === 'wallpaper' && (
                    <WallpaperApp
                      onBgChange={onBgChange}
                      currentBg={currentBg}
                    />
                  )}
                  {activeApp === 'llm' && (
                    <LlmApp onConfigChange={onConfigChange} />
                  )}
                  {activeApp === 'ambience' && <AmbienceApp />}
                  {activeApp === 'dictionary' && <DictionaryApp />}
                  {activeApp === 'css' && <CssApp />}
                </div>
              )}
            </div>

            {/* Bottom Smartphone Navigation / Home Indicator Bar */}
            <div className="pt-2 pb-3 px-6 bg-black/40 border-t border-white/5 flex items-center justify-center shrink-0">
              <button
                onClick={() => {
                  if (activeApp) {
                    setActiveApp(null);
                  } else {
                    setIsOpen(false);
                  }
                }}
                className="w-32 h-1 bg-white/40 hover:bg-white/80 rounded-full transition-all active:scale-95 cursor-pointer"
                title={activeApp ? '返回桌面' : '关闭手机'}
              />
            </div>

          </div>
        </div>
      )}
    </>
  );
}
