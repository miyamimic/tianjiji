import React, { useState, useRef, useEffect } from 'react';
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
  Home
} from 'lucide-react';
import PersonaApp from './phone/PersonaApp';
import WallpaperApp from './phone/WallpaperApp';
import LlmApp from './phone/LlmApp';
import AmbienceApp from './phone/AmbienceApp';
import DictionaryApp from './phone/DictionaryApp';
import CssApp from './phone/CssApp';
import type { LlmConfig } from '../lib/llm';

interface Props {
  onBgChange: (newBg: string) => void;
  currentBg?: string;
  currentCharacterId?: string;
  onEngineReload?: () => void;
  onConfigChange?: (config: LlmConfig) => void;
}

type AppId = 'persona' | 'wallpaper' | 'llm' | 'ambience' | 'dictionary' | 'css';

const APPS: Array<{
  id: AppId;
  name: string;
  subtitle: string;
  icon: React.ElementType;
  gradient: string;
  badge?: string;
}> = [
  {
    id: 'persona',
    name: '人设档案',
    subtitle: '主控立绘与视觉感知',
    icon: User,
    gradient: 'from-amber-500 to-orange-600',
    badge: 'AI视觉',
  },
  {
    id: 'wallpaper',
    name: '背景装扮',
    subtitle: '自定义chat_bg壁纸',
    icon: ImageIcon,
    gradient: 'from-blue-500 to-indigo-600',
  },
  {
    id: 'llm',
    name: '模型算力',
    subtitle: '一键抓取与多模态',
    icon: Bot,
    gradient: 'from-emerald-500 to-teal-600',
    badge: '模型抓取',
  },
  {
    id: 'ambience',
    name: '氛围白噪',
    subtitle: '壁炉雨声声学合成',
    icon: Music,
    gradient: 'from-rose-500 to-pink-600',
  },
  {
    id: 'dictionary',
    name: '拦截词典',
    subtitle: '敏感过滤与情绪激化',
    icon: ShieldAlert,
    gradient: 'from-purple-500 to-violet-600',
  },
  {
    id: 'css',
    name: '视觉工坊',
    subtitle: '滤镜调色与CSS注入',
    icon: Palette,
    gradient: 'from-cyan-500 to-blue-600',
  },
];

const DEFAULT_CORD_LENGTH = 50; // default resting length in px

export default function WindChime({
  onBgChange,
  currentBg,
  currentCharacterId = 'char_001',
  onEngineReload,
  onConfigChange,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeApp, setActiveApp] = useState<AppId | null>(null);

  // Dynamic Rope Length State (px)
  const [cordLength, setCordLength] = useState(DEFAULT_CORD_LENGTH);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartYRef = useRef(0);
  const startCordLengthRef = useRef(DEFAULT_CORD_LENGTH);
  const hasPlayedPullSoundRef = useRef(false);
  const chimeRef = useRef<HTMLDivElement>(null);

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
        gain.gain.setValueAtTime(0.06 * intensity / (i + 1), now + i * 0.04);
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
    // Allow dragging rope from 35px up to 360px
    const newLen = Math.max(35, Math.min(340, startCordLengthRef.current + deltaY));
    setCordLength(newLen);

    // Play chime sound only when actually pulled down
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

    const pulledDistance = cordLength - DEFAULT_CORD_LENGTH;
    const totalTravel = Math.abs(cordLength - startCordLengthRef.current);

    // If pulled down noticeably or clicked, enter the phone interface!
    if (pulledDistance > 20 || totalTravel > 15 || totalTravel < 4) {
      if (!hasPlayedPullSoundRef.current) {
        playChimeTinkle(1.1);
      }
      setIsOpen(true);
      setCordLength(Math.max(DEFAULT_CORD_LENGTH, Math.min(130, cordLength)));
    } else {
      // Smoothly return to resting position
      setCordLength(DEFAULT_CORD_LENGTH);
    }
  };

  return (
    <>
      {/* ================= 1. HANGING WIND CHIME ON THE LEFT EDGE ================= */}
      <div 
        className="fixed top-0 left-2.5 sm:left-3.5 z-40 select-none flex flex-col items-center pointer-events-auto cursor-grab active:cursor-grabbing"
        title="下拉风铃绳索，开启手机控制台"
      >
        {/* Top Ceiling Mounting Ring */}
        <div className="w-3.5 h-2 bg-gradient-to-b from-amber-600 via-amber-400 to-amber-700 rounded-b-md shadow-md border border-amber-300/60" />

        {/* Dynamic Elastic Silken Rope (Clean, continuous silk thread without scale marks) */}
        <div 
          className="w-[2px] bg-gradient-to-b from-amber-300 via-amber-400 to-amber-200 shadow-[0_0_8px_rgba(245,158,11,0.6)] transition-[height] duration-75 origin-top relative"
          style={{ height: `${cordLength}px` }}
        />

        {/* Wind Chime Bell Body & Striker (Attached to the bottom of the stretched rope) */}
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
          className={`flex flex-col items-center -mt-0.5 group touch-none transition-transform duration-150 ${
            isDragging ? 'scale-110' : 'hover:scale-105 hover:rotate-3'
          }`}
        >
          {/* Crystal Bell Cap */}
          <div className="relative w-6 h-4.5 bg-gradient-to-b from-amber-200/95 via-amber-500 to-amber-800 rounded-t-full border border-amber-200/80 shadow-[0_4px_12px_rgba(245,158,11,0.5)] flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white/80 shadow-inner" />
          </div>

          {/* Bell Rim */}
          <div className="w-7 h-1 bg-amber-100/90 rounded-full shadow-sm" />

          {/* Central Suspended Clapper & Glass Bead */}
          <div className="w-[1.5px] h-3.5 bg-amber-300/80" />
          <div className="w-3 h-3 rounded-full bg-gradient-to-tr from-amber-400 via-yellow-100 to-white border border-white/80 shadow-[0_0_8px_rgba(255,255,255,0.8)] animate-pulse" />

          {/* Silk Cord Connecting to Paper Slip */}
          <div className="w-[1.5px] h-2.5 bg-amber-300/80" />

          {/* Paper Wind Catcher / Poetry Slip (短册 / 纸笺) */}
          <div className="w-4 h-9 bg-gradient-to-b from-amber-50 via-amber-100 to-amber-200/90 rounded-b-sm border border-amber-300/70 shadow-lg flex flex-col items-center justify-between p-1 transform -rotate-3 group-hover:rotate-6 transition-transform duration-200 cursor-pointer">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500/80 shadow-xs" />
            <span className="text-[8px] text-amber-950 font-serif font-bold tracking-tighter leading-none scale-90 select-none">
              灵犀
            </span>
            <div className="w-2 h-[1px] bg-amber-400/40" />
          </div>

          {/* Real-time Stretch Drag Hint */}
          {isDragging && (
            <div className="absolute top-full mt-2.5 whitespace-nowrap bg-black/90 text-[10px] text-amber-300 font-medium px-2.5 py-1 rounded-full border border-amber-400/40 backdrop-blur-md shadow-2xl animate-fade-in pointer-events-none">
              {cordLength > 80 ? '松开拉开灵犀手机 📱' : '继续向下拉动绳索...'}
            </div>
          )}
        </div>
      </div>

      {/* ================= 2. POP-UP MINI SMARTPHONE INTERFACE ================= */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in-0 duration-200">
          
          {/* Backdrop click to close */}
          <div className="absolute inset-0" onClick={() => setIsOpen(false)} />

          {/* Smartphone Chassis Window */}
          <div className="relative w-full max-w-[390px] h-[660px] max-h-[92vh] bg-gradient-to-b from-[hsl(222_30%_12%)] via-[hsl(222_35%_8%)] to-[hsl(222_40%_5%)] rounded-[42px] border-[3px] border-white/20 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_40px_rgba(245,158,11,0.15)] flex flex-col overflow-hidden ring-1 ring-black/80 z-10 animate-in zoom-in-95 duration-200">
            
            {/* Top Speaker / Dynamic Island Notch & Status Bar */}
            <div className="relative pt-3 px-6 pb-2 flex items-center justify-between text-white/80 select-none shrink-0 border-b border-white/5 bg-black/20">
              {/* Clock */}
              <span className="text-[12px] font-semibold tracking-wider text-white">
                {currentTime}
              </span>

              {/* Dynamic Island Pill */}
              <div className="absolute left-1/2 -translate-x-1/2 top-2.5 w-24 h-5 bg-black rounded-full border border-white/10 flex items-center justify-center gap-1.5 px-2 shadow-inner">
                <div className="size-2 rounded-full bg-amber-400/90 animate-pulse" />
                <span className="text-[8px] text-white/60 font-mono tracking-tighter">灵犀 OS</span>
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
              <div className="flex items-center justify-between px-4 py-2 bg-black/40 border-b border-white/10 shrink-0">
                <button
                  onClick={() => setActiveApp(null)}
                  className="flex items-center gap-1 text-xs font-semibold text-[hsl(28_85%_62%)] hover:text-amber-300 transition-colors py-1 px-2 rounded-lg bg-white/5"
                >
                  <ChevronLeft className="size-4" />
                  <span>返回桌面</span>
                </button>

                <span className="text-xs font-bold text-white tracking-wide">
                  {APPS.find((a) => a.id === activeApp)?.name}
                </span>

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>
            )}

            {/* Smartphone Screen Body */}
            <div className="flex-1 overflow-y-auto px-4 py-3 no-scrollbar">
              
              {/* ========== HOME SCREEN (APP GRID) ========== */}
              {!activeApp ? (
                <div className="space-y-4 pt-1 animate-in fade-in-0 duration-200 select-none">
                  {/* Home Greeting & Status Widget */}
                  <div className="p-3.5 rounded-3xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 shadow-md space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="size-4 text-[hsl(28_85%_62%)]" />
                        <span className="text-xs font-bold text-white">灵犀角色终端控制台</span>
                      </div>
                      <span className="text-[10px] text-amber-300/80 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full font-mono">
                        ONLINE
                      </span>
                    </div>
                    <p className="text-[11px] text-white/50 leading-relaxed">
                      已为你整合全部人设卡立绘、大模型多模态视觉识别、壁纸装扮与白噪音合成器。点击下方软件图标快速配置。
                    </p>
                  </div>

                  {/* App Grid */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    {APPS.map((app) => {
                      const Icon = app.icon;
                      return (
                        <button
                          key={app.id}
                          onClick={() => setActiveApp(app.id)}
                          className="group relative flex flex-col items-start p-3.5 rounded-3xl bg-black/40 hover:bg-white/[0.06] border border-white/10 hover:border-[hsl(28_85%_62%/0.4)] transition-all duration-200 text-left shadow-lg hover:shadow-[hsl(28_85%_62%/0.1)] active:scale-95"
                        >
                          {/* App Badge */}
                          {app.badge && (
                            <span className="absolute top-2.5 right-2.5 text-[8px] font-bold text-amber-950 bg-[hsl(28_85%_62%)] px-1.5 py-0.5 rounded-full shadow-sm">
                              {app.badge}
                            </span>
                          )}

                          {/* App Icon Square */}
                          <div className={`p-2.5 rounded-2xl bg-gradient-to-br ${app.gradient} shadow-md group-hover:scale-105 transition-transform duration-200 mb-2.5`}>
                            <Icon className="size-5 text-white" />
                          </div>

                          <div className="space-y-0.5">
                            <h4 className="text-xs font-bold text-white group-hover:text-[hsl(28_85%_62%)] transition-colors">
                              {app.name}
                            </h4>
                            <p className="text-[10px] text-white/40 leading-tight">
                              {app.subtitle}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* ========== IN-APP DETAIL VIEW ========== */
                <div className="animate-in fade-in-0 duration-200 pt-1">
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
