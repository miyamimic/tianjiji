import React, { useEffect, useState } from 'react';
import { outboxQueue, type OutboxQueueState, type OutboxTask } from '@/lib/outboxQueue';
import { backgroundKeepAlive } from '@/lib/backgroundKeepAlive';
import { Loader2, Radio, RefreshCw, X, CheckCircle2, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';

export default function OutboxStatusBar() {
  const [queueState, setQueueState] = useState<OutboxQueueState>(() => outboxQueue.getState());
  const [isKeepAliveActive, setIsKeepAliveActive] = useState<boolean>(() => backgroundKeepAlive.isKeepAliveActive());
  const [showToastCompleted, setShowToastCompleted] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<boolean>(false);

  useEffect(() => {
    const unsubOutbox = outboxQueue.subscribe((state) => {
      setQueueState(state);
    });

    const unsubKeepAlive = backgroundKeepAlive.subscribe((active) => {
      setIsKeepAliveActive(active);
    });

    const unsubCompleted = outboxQueue.onCompleted((task) => {
      setShowToastCompleted(task.characterName);
      setTimeout(() => setShowToastCompleted(null), 3200);
    });

    return () => {
      unsubOutbox();
      unsubKeepAlive();
      unsubCompleted();
    };
  }, []);

  const activeTask = queueState.tasks.find((t) => t.status === 'generating' || t.status === 'retrying') || null;
  const pendingTasks = queueState.tasks.filter((t) => t.status === 'queued' || t.status === 'generating' || t.status === 'retrying');

  // If nothing in flight and no toast, return null
  if (!activeTask && pendingTasks.length === 0 && !showToastCompleted) {
    return null;
  }

  const isRetrying = activeTask?.status === 'retrying';

  return (
    <aside
      aria-label="后台生成状态栏"
      className="fixed top-2.5 left-1/2 -translate-x-1/2 z-[9999] pointer-events-auto max-w-[92vw] w-auto transition-all duration-300 ease-out"
    >
      {/* 1. Main Dynamic Island / Capsule */}
      <div 
        className={`flex flex-col rounded-full backdrop-blur-xl border shadow-2xl transition-all duration-300 ${
          isRetrying
            ? 'bg-amber-950/85 border-amber-500/40 text-amber-200 shadow-amber-950/50'
            : 'bg-black/85 border-white/15 text-white shadow-black/80'
        } px-3.5 py-1.5`}
      >
        <div className="flex items-center gap-2.5 text-[12.5px] font-medium whitespace-nowrap select-none">
          {/* Status Icon */}
          {showToastCompleted && !activeTask ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 animate-bounce" />
          ) : isRetrying ? (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
          ) : (
            <div className="relative flex items-center justify-center shrink-0">
              <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
              <div className="absolute w-1.5 h-1.5 rounded-full bg-amber-300 animate-ping" />
            </div>
          )}

          {/* Text Summary */}
          {showToastCompleted && !activeTask ? (
            <span className="text-emerald-300 font-semibold tracking-wide">
              「{showToastCompleted}」回复已推演完毕
            </span>
          ) : isRetrying ? (
            <span className="text-amber-200">
              网络波动重试中 ({activeTask?.retryCount}/{activeTask?.maxRetries})
            </span>
          ) : (
            <span className="text-white/90">
              「{activeTask?.characterName || '角色'}」构思推演中
            </span>
          )}

          {/* Background Keep-Alive Indicator */}
          {isKeepAliveActive && (
            <span 
              title="iOS音频保活引擎运行中：切换到后台/主屏幕仍保持生成不中断"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10.5px] font-mono tracking-tight"
            >
              <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span>iOS后台保活</span>
            </span>
          )}

          {/* Queue count badge if > 1 */}
          {pendingTasks.length > 1 && (
            <span className="px-1.5 py-0.5 rounded bg-white/10 text-white/70 text-[10px]">
              队列 {pendingTasks.length}
            </span>
          )}

          {/* Actions */}
          {activeTask && (
            <div className="flex items-center gap-1.5 ml-1">
              {isRetrying && (
                <button
                  onClick={() => outboxQueue.retryImmediately(activeTask.id)}
                  className="px-2 py-0.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-medium transition active:scale-95 flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  立即重试
                </button>
              )}

              <button
                onClick={() => outboxQueue.cancelTask(activeTask.id)}
                title="取消生成"
                className="w-5 h-5 rounded-full flex items-center justify-center text-white/50 hover:text-white/90 hover:bg-white/10 active:scale-90 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
