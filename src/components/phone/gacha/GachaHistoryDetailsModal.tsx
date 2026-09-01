import React from 'react';
import { X, Sparkles, History, HelpCircle, Star, Award, RotateCcw } from 'lucide-react';
import type { GachaPoolConfig, GachaHistoryRecord } from '../../../lib/gachaTypes';

interface DetailsProps {
  poolConfig: GachaPoolConfig;
  onClose: () => void;
}

export const GachaDetailsModal: React.FC<DetailsProps> = ({ poolConfig, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
      <div className="bg-stone-900 border border-white/10 rounded-2xl max-w-sm w-full p-4 shadow-2xl flex flex-col max-h-[85vh] text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
          <div className="flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white tracking-wide">
              {poolConfig.pool_name} · 规则详情
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 text-xs">
          {/* Spark Rule */}
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-400/30 space-y-1">
            <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>保底与井机制（Spark Rule）</span>
            </span>
            <p className="text-[11px] text-amber-200/80 leading-relaxed">
              每祈愿 1 次累加 1 点井计数。累计达到 <strong>{poolConfig.spark_count} 抽</strong> 时，将必定触发保底兑换：「<strong>{poolConfig.spark_reward.description}</strong>」。
            </p>
          </div>

          {/* Rates List */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-stone-300">概率公示</span>
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 rounded-xl bg-stone-950 border border-amber-400/40 text-center">
                <div className="text-[10px] font-bold text-amber-400">SSR 稀有</div>
                <div className="text-xs font-mono font-bold text-white">
                  {(poolConfig.rates.SSR * 100).toFixed(2)}%
                </div>
              </div>
              <div className="p-2 rounded-xl bg-stone-950 border border-purple-400/40 text-center">
                <div className="text-[10px] font-bold text-purple-400">SR 卓越</div>
                <div className="text-xs font-mono font-bold text-white">
                  {(poolConfig.rates.SR * 100).toFixed(2)}%
                </div>
              </div>
              <div className="p-2 rounded-xl bg-stone-950 border border-slate-600 text-center">
                <div className="text-[10px] font-bold text-stone-400">R 普通</div>
                <div className="text-xs font-mono font-bold text-white">
                  {(poolConfig.rates.R * 100).toFixed(2)}%
                </div>
              </div>
            </div>
          </div>

          {/* Cards Catalog */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-stone-300">包含卡牌一览</span>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
              {poolConfig.cards.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-2 p-2 rounded-xl bg-stone-950/60 border border-white/5"
                >
                  <img
                    src={c.card_image}
                    alt={c.name}
                    className="w-9 h-9 rounded-lg object-cover border border-white/10 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[8px] font-bold px-1 py-0.2 rounded font-mono ${
                          c.rarity === 'SSR'
                            ? 'bg-amber-400 text-stone-950'
                            : c.rarity === 'SR'
                            ? 'bg-purple-400 text-stone-950'
                            : 'bg-stone-700 text-white'
                        }`}
                      >
                        {c.rarity}
                      </span>
                      <span className="font-bold text-white text-xs truncate">{c.name}</span>
                      {c.featured && (
                        <span className="text-[8px] font-medium px-1 rounded bg-rose-500/20 text-rose-300 border border-rose-400/30">
                          UP
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-white/50 truncate mt-0.5">{c.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-white/10 mt-2">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-white text-xs font-semibold"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

interface HistoryProps {
  historyRecords: GachaHistoryRecord[];
  onClearHistory: () => void;
  onClose: () => void;
}

export const GachaHistoryModal: React.FC<HistoryProps> = ({
  historyRecords,
  onClearHistory,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
      <div className="bg-stone-900 border border-white/10 rounded-2xl max-w-sm w-full p-4 shadow-2xl flex flex-col max-h-[85vh] text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
          <div className="flex items-center gap-1.5">
            <History className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white tracking-wide">祈愿历程记录</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-xs">
          {historyRecords.length === 0 ? (
            <div className="text-center text-white/40 py-10">暂无祈愿记录</div>
          ) : (
            historyRecords.map((rec) => (
              <div
                key={rec.id}
                className="p-2.5 rounded-xl bg-stone-950 border border-white/5 space-y-1.5"
              >
                <div className="flex items-center justify-between text-[10px] text-white/50 border-b border-white/5 pb-1">
                  <span>{new Date(rec.timestamp).toLocaleString()}</span>
                  <span className="font-mono text-amber-300 font-bold">{rec.pullCount} 连祈愿</span>
                </div>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {rec.cards.map((c, i) => (
                    <span
                      key={i}
                      className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-medium ${
                        c.rarity === 'SSR'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40 font-bold'
                          : c.rarity === 'SR'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-400/30'
                          : 'bg-stone-800 text-stone-300'
                      }`}
                    >
                      {c.rarity === 'SSR' ? `✨ ${c.name}` : c.name}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-white/10 mt-2 flex items-center gap-2">
          {historyRecords.length > 0 && (
            <button
              onClick={onClearHistory}
              className="py-2 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs transition"
            >
              清空记录
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-white text-xs font-semibold"
          >
            返回
          </button>
        </div>
      </div>
    </div>
  );
};
