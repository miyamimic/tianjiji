import React from 'react';
import { Sparkles, Star, Award, CheckCircle2, ChevronRight } from 'lucide-react';
import type { PulledCardInstance } from '../../../lib/gachaTypes';

interface Props {
  pulledCards: PulledCardInstance[];
  onCardClick: (index: number) => void;
  onFinishReveal: () => void;
  allFlipped: boolean;
  summaryBubble?: string;
}

export const GachaCardRevealStage: React.FC<Props> = ({
  pulledCards,
  onCardClick,
  onFinishReveal,
  allFlipped,
  summaryBubble,
}) => {
  const isTenPull = pulledCards.length > 1;

  return (
    <div className="absolute inset-0 z-30 bg-stone-950/95 flex flex-col justify-between p-3 select-none overflow-y-auto no-scrollbar">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold text-white tracking-wider">
            {isTenPull ? '✨ 十连祈愿结果揭晓' : '✨ 祈愿结果揭晓'}
          </span>
        </div>
        <span className="text-[10px] text-white/50 font-mono">
          已翻开 {pulledCards.filter((c) => c.isFlipped).length} / {pulledCards.length}
        </span>
      </div>

      {/* Cards Grid */}
      <div
        className={`flex-1 grid gap-2.5 my-2 items-center justify-center ${
          isTenPull ? 'grid-cols-5 grid-rows-2' : 'grid-cols-1 max-w-[200px] mx-auto'
        }`}
      >
        {pulledCards.map((inst, idx) => {
          const { card, isFlipped, isSparkReward } = inst;
          const isSSR = card.rarity === 'SSR';
          const isSR = card.rarity === 'SR';

          return (
            <div
              key={inst.instanceId}
              id={`gacha-result-card-${idx}`}
              onClick={() => onCardClick(idx)}
              className={`relative aspect-[3/4.2] rounded-xl cursor-pointer transition-all duration-500 perspective-1000 ${
                isTenPull ? 'w-full' : 'w-44'
              }`}
              style={{ perspective: '1000px' }}
            >
              <div
                className={`relative w-full h-full rounded-xl transition-transform duration-500 transform-style-3d shadow-lg ${
                  isFlipped ? 'rotate-y-0' : 'rotate-y-180'
                }`}
                style={{
                  transformStyle: 'preserve-3d',
                  transform: isFlipped ? 'rotateY(0deg)' : 'rotateY(180deg)',
                }}
              >
                {/* ---------------- CARD FRONT (FACE UP) ---------------- */}
                <div
                  className={`absolute inset-0 rounded-xl overflow-hidden backface-hidden flex flex-col justify-between p-1.5 border ${
                    isSSR
                      ? 'border-amber-400 bg-gradient-to-b from-amber-950 via-stone-900 to-amber-950 shadow-[0_0_20px_rgba(251,191,36,0.6)]'
                      : isSR
                      ? 'border-purple-400 bg-gradient-to-b from-purple-950 via-stone-900 to-indigo-950 shadow-purple-500/30'
                      : 'border-slate-600 bg-gradient-to-b from-stone-800 to-stone-900'
                  }`}
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  {/* Card Background Image */}
                  <img
                    src={card.card_image}
                    alt={card.name}
                    className="absolute inset-0 w-full h-full object-cover opacity-70"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-transparent to-black/40" />

                  {/* Top Rarity Badge */}
                  <div className="relative z-10 flex items-center justify-between">
                    <span
                      className={`text-[8.5px] font-black px-1.5 py-0.2 rounded-md font-mono ${
                        isSSR
                          ? 'bg-amber-400 text-stone-950 shadow-md animate-pulse'
                          : isSR
                          ? 'bg-purple-400 text-stone-950'
                          : 'bg-stone-600 text-white'
                      }`}
                    >
                      {card.rarity}
                    </span>
                    {isSparkReward && (
                      <span className="text-[7.5px] font-bold px-1 py-0.2 rounded bg-rose-500 text-white shadow">
                        井兑换
                      </span>
                    )}
                  </div>

                  {/* Bottom Card Title & Motif */}
                  <div className="relative z-10 text-center">
                    <h5
                      className={`font-bold leading-tight line-clamp-1 ${
                        isTenPull ? 'text-[9.5px]' : 'text-xs'
                      } ${isSSR ? 'text-amber-300 drop-shadow' : isSR ? 'text-purple-200' : 'text-stone-200'}`}
                    >
                      {card.name}
                    </h5>
                  </div>
                </div>

                {/* ---------------- CARD BACK (FACE DOWN) ---------------- */}
                <div
                  className="absolute inset-0 rounded-xl overflow-hidden backface-hidden bg-gradient-to-br from-indigo-950 via-stone-900 to-purple-950 border border-amber-400/40 flex flex-col items-center justify-center p-2 shadow-md hover:border-amber-400 transition-colors"
                  style={{
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                  }}
                >
                  <div className="w-8 h-8 rounded-full border border-amber-400/60 flex items-center justify-center mb-1">
                    <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                  </div>
                  <span className="text-[8px] font-bold text-amber-300/80 tracking-widest uppercase">
                    PULL #{idx + 1}
                  </span>
                  <div className="absolute inset-x-2 bottom-1 h-0.5 bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Summary Bar & Action Button */}
      <div className="shrink-0 pt-2 border-t border-white/10 space-y-2">
        {summaryBubble && (
          <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-xs text-stone-300 leading-relaxed italic">
            "{summaryBubble}"
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-white/40">
            {allFlipped ? '全部卡牌已揭示完成' : '光标正在逐张翻牌，亦可点击翻面'}
          </span>
          <button
            id="gacha-confirm-reveal-btn"
            onClick={onFinishReveal}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1 cursor-pointer ${
              allFlipped
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 hover:scale-105'
                : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
            }`}
          >
            <span>{allFlipped ? '收下卡牌继续' : '全部直接翻开'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
