import React from 'react';
import { Sparkles, MessageCircle, Heart, Flame } from 'lucide-react';
import type { VirtualCursorState, GachaPoolConfig } from '../../../lib/gachaTypes';

interface Props {
  cursorState: VirtualCursorState;
  cursorStyle?: GachaPoolConfig['cursor_style'];
  characterName: string;
}

export const GachaVirtualCursor: React.FC<Props> = ({
  cursorState,
  cursorStyle,
  characterName,
}) => {
  const { x, y, isClicking, isHovering, activeBubble } = cursorState;

  const styleType = cursorStyle?.type || 'arrow';
  const color = cursorStyle?.color || '#F59E0B';
  const size = cursorStyle?.size || 24;

  // Percentage to absolute css position inside the container
  const leftPercent = Math.max(2, Math.min(98, x * 100));
  const topPercent = Math.max(2, Math.min(98, y * 100));

  return (
    <div
      className="gacha-cursor absolute pointer-events-none select-none z-[100]"
      style={{
        left: `${leftPercent}%`,
        top: `${topPercent}%`,
        transform: `translate(-20%, -20%) scale(${isClicking ? 0.75 : 1})`,
        transition: 'left 0.55s cubic-bezier(0.25, 0.1, 0.25, 1), top 0.55s cubic-bezier(0.25, 0.1, 0.25, 1), transform 0.15s ease-out',
      }}
    >
      {/* Visual Cursor Pointer */}
      <div className="relative flex items-center justify-center">
        {/* Click wave ripple */}
        {isClicking && (
          <div
            className="absolute -inset-3 rounded-full animate-ping pointer-events-none"
            style={{ backgroundColor: color, opacity: 0.6 }}
          />
        )}

        {/* Hover subtle glow */}
        {isHovering && (
          <div
            className="absolute -inset-2 rounded-full blur-sm animate-pulse pointer-events-none"
            style={{ backgroundColor: color, opacity: 0.5 }}
          />
        )}

        {/* Cursor Icon by Type */}
        {styleType === 'arrow' && (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            className="drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] filter transition-transform"
          >
            <path
              d="M3 3L10.07 19.97L12.58 12.58L19.97 10.07L3 3Z"
              fill={color}
              stroke="#000000"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}

        {styleType === 'wand' && (
          <div
            className="flex items-center justify-center p-1 rounded-full bg-stone-950/80 border shadow-lg"
            style={{ borderColor: color }}
          >
            <Sparkles className="w-5 h-5 animate-spin" style={{ color, animationDuration: '4s' }} />
          </div>
        )}

        {styleType === 'paw' && (
          <div className="text-xl drop-shadow-md filter">
            🐾
          </div>
        )}

        {styleType === 'feather' && (
          <div className="text-xl drop-shadow-md filter -rotate-45">
            🪶
          </div>
        )}

        {styleType === 'star' && (
          <div className="text-xl drop-shadow-md filter animate-pulse">
            ⭐
          </div>
        )}

        {/* Small avatar or character mini-tag */}
        <div className="absolute -bottom-4 left-4 whitespace-nowrap px-1.5 py-0.2 rounded-full bg-black/80 border border-white/20 text-[8.5px] font-bold text-white shadow-md flex items-center gap-0.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
          <span>{characterName}</span>
        </div>
      </div>

      {/* Attached Dynamic Speech Bubble */}
      {activeBubble && (
        <div
          className={`gacha-bubble absolute left-4 -top-12 z-[101] min-w-[140px] max-w-[220px] p-2.5 rounded-2xl text-[12px] shadow-2xl backdrop-blur-md transition-all duration-300 pointer-events-none animate-in fade-in zoom-in-95 ${
            activeBubble.type === 'bubble_to_user'
              ? 'bg-gradient-to-br from-amber-950/95 via-stone-900/95 to-amber-900/95 border border-amber-400/80 text-amber-100 shadow-amber-950/50'
              : activeBubble.type === 'bubble_self'
              ? 'bg-gradient-to-br from-purple-950/95 via-stone-900/95 to-slate-900/95 border border-purple-400/60 text-purple-200 shadow-purple-950/50 italic'
              : 'bg-gradient-to-br from-rose-950/95 via-stone-900/95 to-amber-950/95 border border-rose-400/80 text-white shadow-rose-950/50 font-medium'
          }`}
        >
          {/* Bubble Header Tag */}
          <div className="flex items-center justify-between gap-1 pb-1 mb-1 border-b border-white/10 text-[9px] font-bold tracking-wider opacity-90">
            <span className="flex items-center gap-1">
              {activeBubble.type === 'bubble_to_user' ? (
                <>
                  <MessageCircle className="w-2.5 h-2.5 text-amber-400" />
                  <span className="text-amber-300">对你说</span>
                </>
              ) : activeBubble.type === 'bubble_self' ? (
                <>
                  <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                  <span className="text-purple-300">心声</span>
                </>
              ) : (
                <>
                  <Flame className="w-2.5 h-2.5 text-rose-400" />
                  <span className="text-rose-300">卡牌点评</span>
                </>
              )}
            </span>
            <span className="text-[8px] text-white/40 font-mono">LLM</span>
          </div>

          {/* Bubble Text */}
          <p className="leading-relaxed break-words">{activeBubble.text}</p>

          {/* Little tail triangle */}
          <div
            className={`absolute -bottom-1.5 left-3 w-3 h-3 rotate-45 border-r border-b ${
              activeBubble.type === 'bubble_to_user'
                ? 'bg-stone-900 border-amber-400/80'
                : activeBubble.type === 'bubble_self'
                ? 'bg-stone-900 border-purple-400/60'
                : 'bg-stone-900 border-rose-400/80'
            }`}
          />
        </div>
      )}
    </div>
  );
};
