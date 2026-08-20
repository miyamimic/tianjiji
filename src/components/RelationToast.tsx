import React, { useEffect, useState } from 'react';
import { 
  subscribeRelationToast, 
  getMentalOpenTierInfo, 
  getPhysicalPhaseInfo, 
  type RelationToastEvent 
} from '../lib/relationEngine';
import { 
  Heart, 
  Sparkles, 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  ShieldCheck, 
} from 'lucide-react';

interface ToastItem extends RelationToastEvent {
  id: string;
}

export default function RelationToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeRelationToast((event) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newItem: ToastItem = { ...event, id };

      setToasts((prev) => [newItem, ...prev.slice(0, 2)]);

      // Auto dismiss after 2400ms for smooth non-blocking feel
      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 2400);

      return () => clearTimeout(timer);
    });

    return () => unsubscribe();
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-1.5 pointer-events-none max-w-[90vw] sm:max-w-sm w-full px-2">
      {toasts.map((toast) => {
        const isMental = toast.type === 'mental' || toast.type === 'both';
        const isPhysical = toast.type === 'physical' || toast.type === 'both';

        const mentalInfo = typeof toast.mentalOpen === 'number' ? getMentalOpenTierInfo(toast.mentalOpen) : null;
        const physicalInfo = typeof toast.physicalPhase === 'number' ? getPhysicalPhaseInfo(toast.physicalPhase) : null;

        const isMentalUp = toast.mentalDirection === 'up' || (typeof toast.mentalDelta === 'number' && toast.mentalDelta > 0);
        const isMentalDown = toast.mentalDirection === 'down' || (typeof toast.mentalDelta === 'number' && toast.mentalDelta < 0);

        const isPhysicalUp = toast.physicalDirection === 'up' || (typeof toast.physicalDelta === 'number' && toast.physicalDelta > 0);
        const isPhysicalDown = toast.physicalDirection === 'down' || (typeof toast.physicalDelta === 'number' && toast.physicalDelta < 0);

        return (
          <div
            key={toast.id}
            className="w-full flex flex-col gap-1.5 animate-in fade-in-0 slide-in-from-top-2 duration-200 pointer-events-auto"
          >
            {/* ---------------- 心理开放度轻量级微浮窗 ---------------- */}
            {isMental && mentalInfo && (
              <>
                {/* 1. 心理开放上升 (日常细微升温 / 默契加深) */}
                {isMentalUp && (
                  <div className="flex items-center justify-between gap-2.5 px-3 py-1.5 rounded-full bg-[hsl(330_50%_12%/0.92)] border border-pink-400/40 text-pink-100 shadow-[0_4px_16px_rgba(244,114,182,0.25)] backdrop-blur-md">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="size-5 rounded-full bg-pink-500/30 border border-pink-400/50 flex items-center justify-center shrink-0 text-pink-200">
                        <Heart className="size-3 fill-pink-400/40 text-pink-200" />
                      </div>
                      <span className="text-[11px] font-semibold text-pink-100 truncate">
                        {toast.message || '默契升温'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px]">
                      <span className="font-bold text-pink-300">
                        {toast.mentalDelta ? `+${toast.mentalDelta}` : '↑'}
                      </span>
                      <span className="text-pink-300/70 bg-pink-500/20 px-1.5 py-0.2 rounded">
                        心防 {toast.mentalOpen}/100
                      </span>
                    </div>
                  </div>
                )}

                {/* 2. 心理开放下降 (微小局促或防备) */}
                {isMentalDown && (
                  <div className="flex items-center justify-between gap-2.5 px-3 py-1.5 rounded-full bg-[hsl(210_50%_12%/0.92)] border border-cyan-400/40 text-cyan-100 shadow-[0_4px_16px_rgba(56,189,248,0.22)] backdrop-blur-md">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="size-5 rounded-full bg-cyan-500/30 border border-cyan-400/50 flex items-center justify-center shrink-0 text-cyan-200">
                        <TrendingDown className="size-3 text-cyan-200" />
                      </div>
                      <span className="text-[11px] font-semibold text-cyan-100 truncate">
                        {toast.message || '微小局促'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px]">
                      <span className="font-bold text-cyan-300">
                        {toast.mentalDelta ? `${toast.mentalDelta}` : '↓'}
                      </span>
                      <span className="text-cyan-300/70 bg-cyan-500/20 px-1.5 py-0.2 rounded">
                        心防 {toast.mentalOpen}/100
                      </span>
                    </div>
                  </div>
                )}

                {/* 3. 无方向变动 (手动同步) */}
                {!isMentalUp && !isMentalDown && (
                  <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/90 backdrop-blur-md text-[11px]">
                    <span className="flex items-center gap-1.5">
                      <Heart className="size-3 text-pink-400" />
                      心理开放度已同步至 {toast.mentalOpen}/100
                    </span>
                  </div>
                )}
              </>
            )}

            {/* ---------------- 身体亲密度阶段推进 ---------------- */}
            {isPhysical && physicalInfo && (
              <div className="flex items-center justify-between gap-2.5 px-3 py-1.5 rounded-full bg-[hsl(270_50%_14%/0.92)] border border-purple-400/40 text-purple-100 shadow-[0_4px_16px_rgba(192,132,252,0.25)] backdrop-blur-md">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Sparkles className="size-3 text-purple-300 shrink-0" />
                  <span className="text-[11px] font-semibold text-purple-100 truncate">
                    身体亲密 Phase {toast.physicalPhase} · {physicalInfo.name.split('（')[0]}
                  </span>
                </div>
                {typeof toast.cooldown === 'number' && toast.cooldown > 0 && (
                  <span className="text-[9px] font-mono text-amber-300 bg-amber-500/20 px-1.5 py-0.2 rounded shrink-0 flex items-center gap-1">
                    <Clock className="size-2.5" /> 冷却 {toast.cooldown}轮
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
