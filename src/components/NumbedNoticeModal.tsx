import { ShieldAlert, HeartHandshake, Sparkles, X, Check } from 'lucide-react';
import { EMOTION_NAMES, type EmotionKey } from '../data/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  characterName: string;
  numbedKeys: string[];
  isSensitized?: boolean;
}

export default function NumbedNoticeModal({
  isOpen,
  onClose,
  characterName,
  numbedKeys,
  isSensitized = false,
}: Props) {
  if (!isOpen) return null;

  const numbedNames = numbedKeys.map((k) => EMOTION_NAMES[k as EmotionKey] || k).join('、');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl border border-amber-500/30 bg-[hsl(222_28%_11%/0.95)] shadow-2xl p-6 text-white space-y-4 animate-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="size-4" />
        </button>

        {/* Header with Icon */}
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/10">
            <ShieldAlert className="size-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-1.5">
              <span>心理防御与情绪麻木状态</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-mono font-normal">
                情绪惯性
              </span>
            </h3>
            <p className="text-xs text-white/50">多轮持续冲击引发的自我保护机制</p>
          </div>
        </div>

        {/* Description */}
        <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-xs text-white/80 leading-relaxed">
          <p>
            <span className="font-semibold text-amber-300">「{characterName}」</span>
            在连续多轮对话中经历了【<span className="text-amber-300 font-semibold">{numbedNames}</span>】的持续累积与情绪高压，内心防御机制已生效：
          </p>
        </div>

        {/* Two Effect Cards */}
        <div className="space-y-2.5">
          <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-950/20 space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
              <Sparkles className="size-3.5" />
              <span>1. 情绪麻木与饱和适应（Numbing）</span>
            </div>
            <p className="text-[11px] text-white/60 leading-relaxed">
              连续同向情绪产生钝化与心理疲惫，后续同类情绪的增量将适度减缓，避免失控爆种（符合长久悲伤/愤怒后人会逐渐麻木疲惫的心理真实规律）。
            </p>
          </div>

          <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-950/20 space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-rose-300">
              <HeartHandshake className="size-3.5" />
              <span>2. 脆弱防线削弱与温情敏感（Sensitization）</span>
            </div>
            <p className="text-[11px] text-white/60 leading-relaxed">
              在深度麻木或脆弱重压下，角色的自我防线出现缺口——主控此时给予的【温情】与【喜悦】信号敏感度将提升 1.5 倍，更容易触及并击穿心防！
            </p>
          </div>
        </div>

        {/* Footer Button */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[hsl(28_30%_10%)] font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98]"
          >
            <Check className="size-4" />
            <span>了解并靠近倾听</span>
          </button>
        </div>
      </div>
    </div>
  );
}
