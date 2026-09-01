import React, { useEffect, useState } from 'react';
import { Sparkles, FastForward, Loader2 } from 'lucide-react';

interface Props {
  isLlmReady: boolean;
  pullCount: number;
  hasSsr: boolean;
  skipPosition: { x: number; y: number };
  onAnimationEnd: () => void;
  onUserManualSkip?: () => void;
}

export const GachaAnimationStage: React.FC<Props> = ({
  isLlmReady,
  pullCount,
  hasSsr,
  skipPosition,
  onAnimationEnd,
  onUserManualSkip,
}) => {
  const [stage, setStage] = useState<'gathering' | 'burst' | 'converge'>('gathering');
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const t1 = setTimeout(() => setStage('burst'), 3000);
    const t2 = setTimeout(() => setStage('converge'), 8000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // When LLM is ready and at least 6s have elapsed (or max 25s reached), can naturally finish animation
  useEffect(() => {
    if (isLlmReady && secondsElapsed >= 6) {
      const finishTimer = setTimeout(() => {
        onAnimationEnd();
      }, 1000);
      return () => clearTimeout(finishTimer);
    }
  }, [isLlmReady, secondsElapsed, onAnimationEnd]);

  // Skip button percentage coordinate
  const skipLeft = Math.max(5, Math.min(92, skipPosition.x * 100));
  const skipTop = Math.max(5, Math.min(92, skipPosition.y * 100));

  return (
    <div className="absolute inset-0 z-40 bg-black flex flex-col items-center justify-center overflow-hidden select-none">
      {/* Dynamic Cosmic Background Vortex */}
      <div
        className={`absolute inset-0 bg-gradient-to-b transition-all duration-1000 ${
          hasSsr
            ? 'from-amber-950/90 via-purple-950/80 to-stone-950'
            : 'from-purple-950/80 via-blue-950/70 to-stone-950'
        }`}
      />

      {/* Rotating Astrological Summoning Circle */}
      <div className="relative flex items-center justify-center w-64 h-64 sm:w-80 sm:h-80">
        {/* Outer Ring */}
        <div className="absolute inset-0 rounded-full border-2 border-dashed border-amber-400/40 animate-spin" style={{ animationDuration: '24s' }} />
        
        {/* Middle Hexagram & Runes */}
        <div className="absolute inset-4 rounded-full border border-purple-400/50 animate-spin" style={{ animationDuration: '14s', animationDirection: 'reverse' }} />
        <div className="absolute inset-8 rounded-full border border-amber-300/30 animate-pulse" />

        {/* Core Glowing Orb */}
        <div
          className={`w-28 h-28 sm:w-36 sm:h-36 rounded-full flex items-center justify-center shadow-2xl transition-all duration-700 ${
            hasSsr
              ? 'bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 shadow-[0_0_80px_rgba(251,191,36,0.9)] animate-pulse'
              : 'bg-gradient-to-r from-purple-500 via-indigo-300 to-blue-500 shadow-[0_0_60px_rgba(168,85,247,0.7)] animate-pulse'
          }`}
        >
          <Sparkles className={`w-12 h-12 text-white ${hasSsr ? 'text-amber-950 animate-spin' : 'animate-spin'}`} style={{ animationDuration: '6s' }} />
        </div>

        {/* Orbiting Starlight Particles */}
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2.5 h-2.5 rounded-full bg-white shadow-lg animate-ping"
            style={{
              top: `${50 + 40 * Math.sin((i * Math.PI * 2) / 12)}%`,
              left: `${50 + 40 * Math.cos((i * Math.PI * 2) / 12)}%`,
              animationDuration: `${1.2 + (i % 3) * 0.4}s`,
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>

      {/* Atmospheric Stage Text */}
      <div className="relative z-10 mt-8 text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          {hasSsr ? (
            <span className="px-3 py-1 rounded-full bg-amber-500/30 border border-amber-400/60 text-amber-300 text-xs font-bold tracking-widest animate-bounce">
              ✨ 极光显现 · SSR 辉光降临！
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/40 text-purple-200 text-xs font-medium tracking-wider">
              🌠 星辉汇聚 · {pullCount}连祈愿中
            </span>
          )}
        </div>
        <p className="text-[11px] text-white/50 font-mono flex items-center justify-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
          <span>正在现场感应星轨评价 ({secondsElapsed}s)</span>
        </p>
      </div>

      {/* Target Skip Button (for Virtual Cursor to click) */}
      <div
        id="gacha-skip-target-btn"
        className="absolute z-50 pointer-events-auto transition-transform"
        style={{
          left: `${skipLeft}%`,
          top: `${skipTop}%`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <button
          onClick={onUserManualSkip || onAnimationEnd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/90 border border-white/30 hover:border-amber-400 text-white hover:text-amber-300 text-xs font-medium shadow-xl backdrop-blur-md transition-all cursor-pointer group"
          title="点击或由虚拟光标点击跳过动画"
        >
          <FastForward className="w-3.5 h-3.5 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
          <span>跳过动画</span>
        </button>
      </div>
    </div>
  );
};
