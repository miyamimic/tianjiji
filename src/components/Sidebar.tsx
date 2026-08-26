import { ChevronLeft, ChevronRight, Brain, Sparkles, BookMarked, ScanSearch, History, Swords, ChevronDown, ChevronUp, Heart, CheckCircle2, Bookmark } from 'lucide-react';
import React, { useState } from 'react';
import EmotionRadar from './EmotionRadar';
import type { EmotionVector, BackgroundThread, TriggeredAnchor, IntentAnalysis, DynamicMemory } from '../data/types';
import { loadDynamicMemories } from '../lib/customStore';
import { loadGameEmotionImpacts } from '../lib/gameStore';
import { LinePuppyDoodle, PuppyHeartsDoodle, StardewPixelFlower, FrenchCornerLace } from './FrenchLacePuppyElements';

interface Props {
  isOpen: boolean;
  onToggle: () => void;
  characterId?: string;
  emotion: EmotionVector;
  previousEmotion: EmotionVector | null;
  emotionConfirmed: boolean;
  onConfirmEmotion: () => void;
  threads: BackgroundThread[];
  anchors: TriggeredAnchor[];
  intent: IntentAnalysis | null;
  fallback: boolean;
  characterName: string;
  overlayMode?: boolean;
}

const SENTIMENT_LABEL: Record<string, string> = {
  positive: '正向',
  negative: '负向',
  neutral: '中性',
};

const SENTIMENT_COLOR: Record<string, string> = {
  positive: 'text-amber-700 bg-amber-50 border-amber-200',
  negative: 'text-rose-700 bg-rose-50 border-rose-200',
  neutral: 'text-stone-600 bg-stone-50 border-stone-200',
};

const EMOTION_SHORT: Record<string, string> = {
  anger: '怒',
  fear: '惧',
  joy: '喜',
  sadness: '悲',
  desire: '欲',
  warmth: '温',
};

const EMOTION_CN: Record<string, string> = {
  anger: '愤怒',
  fear: '恐惧',
  joy: '喜悦',
  sadness: '悲伤',
  desire: '欲望',
  warmth: '温情',
};

function formatTimeAgo(ts?: number): string {
  if (!ts) return '刚刚';
  const diff = Date.now() - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return `${Math.floor(diff / 86400000)}天前`;
}

export type MemoryTier = 'SSR' | 'SR' | 'R';

export function getAnchorTier(weight: number): MemoryTier {
  if (weight >= 0.8) return 'SSR';
  if (weight >= 0.55) return 'SR';
  return 'R';
}

export function getDynamicMemoryTier(dm: DynamicMemory): MemoryTier {
  const intensity = dm.intensity || 1;
  const importance = (dm as any).importance ?? (intensity >= 3 ? 0.9 : intensity === 2 ? 0.6 : 0.3);
  if (intensity >= 3 || importance >= 0.75) return 'SSR';
  if (intensity >= 2 || importance >= 0.45) return 'SR';
  return 'R';
}

export default function Sidebar({
  isOpen,
  onToggle,
  characterId,
  emotion,
  previousEmotion,
  emotionConfirmed,
  onConfirmEmotion,
  threads = [],
  anchors = [],
  intent,
  fallback,
  characterName,
  overlayMode = false,
}: Props) {
  const [isGameEmotionOpen, setIsGameEmotionOpen] = useState(true);
  const [isMemoryOpen, setIsMemoryOpen] = useState(true);
  const [memoryTierFilter, setMemoryTierFilter] = useState<'ALL' | 'SSR' | 'SR' | 'R'>('ALL');
  const gameEmotionImpacts = characterId ? loadGameEmotionImpacts(characterId) : [];
  const dynamicMemories: DynamicMemory[] = characterId ? loadDynamicMemories(characterId) : [];

  const classifiedAnchors = anchors.map((a) => ({
    ...a,
    tier: getAnchorTier(a.anchor?.weight ?? 0.5),
  }));

  const classifiedDynamicMemories = dynamicMemories.map((dm) => ({
    ...dm,
    tier: getDynamicMemoryTier(dm),
  }));

  const totalSSR = classifiedAnchors.filter((a) => a.tier === 'SSR').length + classifiedDynamicMemories.filter((dm) => dm.tier === 'SSR').length;
  const totalSR = classifiedAnchors.filter((a) => a.tier === 'SR').length + classifiedDynamicMemories.filter((dm) => dm.tier === 'SR').length;
  const totalR = classifiedAnchors.filter((a) => a.tier === 'R').length + classifiedDynamicMemories.filter((dm) => dm.tier === 'R').length;

  const filteredAnchors = memoryTierFilter === 'ALL' 
    ? classifiedAnchors 
    : classifiedAnchors.filter((a) => a.tier === memoryTierFilter);

  const filteredDynamicMemories = memoryTierFilter === 'ALL' 
    ? classifiedDynamicMemories 
    : classifiedDynamicMemories.filter((dm) => dm.tier === memoryTierFilter);

  return (
    <>
      {!isOpen && (
        <button
          onClick={onToggle}
          className={`${
            overlayMode ? 'absolute' : 'fixed'
          } right-0 top-1/2 z-[60] -translate-y-1/2 bg-white/85 backdrop-blur-md border border-[#f2d0d9] border-r-0 rounded-l-2xl p-2 text-[#998380] hover:text-[#b83d5a] transition-all hover:bg-white shadow-md cursor-pointer`}
          aria-label="展开内部状态面板"
        >
          <ChevronLeft className="size-4" />
        </button>
      )}

      {/* Sidebar Chassis */}
      <aside
        className={`${
          overlayMode ? 'absolute' : 'fixed'
        } right-0 top-0 z-[70] h-full w-80 max-w-[88vw] bg-[#fffafb]/95 backdrop-blur-2xl border-l-2 border-[#f2cad4] shadow-2xl transition-transform duration-300 ease-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#f2cad4] px-4 py-3.5 bg-white/70">
          <div className="flex items-center gap-2">
            <PuppyHeartsDoodle size={23} className="drop-shadow-2xs" />
            <h2 className="text-[14.5px] font-serif font-bold tracking-wider text-[#732641] [text-shadow:0_1px_2px_rgba(224,122,147,0.3),0_2px_4px_rgba(115,38,65,0.12)]">
              六维情绪
            </h2>
          </div>
          <button
            onClick={onToggle}
            className="rounded-full p-1 text-[#998380] hover:bg-[#fae1e8] hover:text-[#b83d5a] transition-colors cursor-pointer"
            aria-label="收起面板"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 p-4 custom-scrollbar">
          {/* Emotion Radar */}
          <div className="p-3.5 rounded-2xl border border-[#f2cad4] bg-white/90 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-serif font-bold text-[#732641] flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-[#b83d5a]" />
                情感六维雷达
              </span>
              {!emotionConfirmed && previousEmotion ? (
                <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-bold animate-pulse">
                  待确认
                </span>
              ) : previousEmotion ? (
                <span className="text-[10px] text-[#b83d5a] font-serif">动态演化中</span>
              ) : null}
            </div>

            <div className="rounded-xl border border-[#fae1e8] bg-[#fffbfb] p-1.5">
              <EmotionRadar
                emotion={emotion}
                previousEmotion={previousEmotion ?? undefined}
                confirmed={emotionConfirmed}
                className="h-[210px] w-full"
              />
            </div>

            {/* 未确认时的确认变化提示与按钮 */}
            {!emotionConfirmed && previousEmotion && (
              <div className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/80 space-y-1.5">
                <p className="text-[11px] text-amber-900 font-medium font-serif leading-snug">
                  检测到情感演化变化，是否确认同步？
                </p>
                <button
                  onClick={onConfirmEmotion}
                  className="w-full py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] transition-colors flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                >
                  <CheckCircle2 className="size-3" />
                  <span>确认情绪演化</span>
                </button>
              </div>
            )}

            {/* 数值进度条 */}
            <div className="space-y-1 pt-1">
              {(['anger', 'fear', 'joy', 'sadness', 'desire', 'warmth'] as const).map((key) => {
                const oldVal = previousEmotion?.[key];
                const diff = oldVal !== undefined ? emotion[key] - oldVal : 0;
                const hasChange = oldVal !== undefined && Math.abs(diff) >= 0.005;
                return (
                  <div key={key} className="flex items-center gap-2 text-[11px] font-serif">
                    <span className="w-9 text-[#785b56] font-medium">{EMOTION_CN[key]}</span>
                    <div className="flex-1 h-2 rounded-full bg-[#fae1e8] overflow-hidden border border-[#f2cad4]/50">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#f48fa5] to-[#b83d5a] transition-all duration-500"
                        style={{ width: `${Math.round(emotion[key] * 100)}%` }}
                      />
                    </div>
                    <span className="w-5 text-right text-[#4a3431] font-mono tabular-nums text-[10px]">
                      {Math.round(emotion[key] * 100)}
                    </span>
                    {hasChange && (
                      <span
                        className={`w-9 text-[9px] tabular-nums font-mono ${
                          diff > 0 ? 'text-rose-600 font-bold' : 'text-emerald-700 font-bold'
                        }`}
                      >
                        {diff > 0 ? '+' : ''}
                        {diff.toFixed(2)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* NLP 意图分析 (后端 spaCy + LLM) */}
          <div className="p-3.5 rounded-2xl border border-[#f2cad4] bg-white/90 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-serif font-bold text-[#732641]">
                <ScanSearch className="size-3.5 text-[#b83d5a]" />
                NLP 输入意图分析
              </span>
              {fallback && (
                <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full font-bold">
                  LLM 回退
                </span>
              )}
            </div>

            {!intent ? (
              <div className="p-2.5 rounded-xl border border-dashed border-[#f2cad4] bg-[#fffbfb] text-center text-[11px] font-serif text-[#998380]">
                发送消息后，展示对输入的意图、情感与实体解析
              </div>
            ) : (
              <div className="space-y-1.5 text-xs font-serif">
                <div className="flex items-center justify-between">
                  <span className="text-[#785b56] text-[11px]">意图标签:</span>
                  <span className="font-bold text-[#732641] bg-[#fae1e8] px-2 py-0.5 rounded-md border border-[#f2cad4] text-[11px]">
                    {(intent as any).intentLabel || intent.intent_label || intent.intent || '中性对话'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#785b56] text-[11px]">情感倾向:</span>
                  <span className={`font-semibold text-[10px] px-2 py-0.5 rounded-md border ${SENTIMENT_COLOR[intent.sentiment] || 'text-stone-600'}`}>
                    {SENTIMENT_LABEL[intent.sentiment] || intent.sentiment}
                  </span>
                </div>
                {intent.confidence !== undefined && (
                  <div className="flex items-center justify-between text-[11px] text-[#785b56]">
                    <span>置信度:</span>
                    <span className="font-mono text-[#4a3431] font-semibold">{(intent.confidence * 100).toFixed(0)}%</span>
                  </div>
                )}
                {intent.entities && intent.entities.length > 0 && (
                  <div className="text-[10.5px] text-[#785b56] pt-0.5">
                    <span className="font-semibold text-[#4a3431]">实体识别：</span>
                    <span className="text-[#b83d5a]">{intent.entities.join('、')}</span>
                  </div>
                )}
                {/* 情绪增量 */}
                {((intent as any).emotionDelta || (intent as any).emotion_delta) && (
                  <div className="text-[10.5px] text-[#785b56] pt-0.5">
                    <span className="font-semibold text-[#4a3431]">情绪增量：</span>
                    <span className="font-mono text-[#732641]">
                      {Object.entries((intent as any).emotionDelta || (intent as any).emotion_delta || {})
                        .filter(([, v]) => typeof v === 'number' && v !== 0)
                        .map(([k, v]) => `${EMOTION_SHORT[k] ?? k}${(v as number) > 0 ? '+' : ''}${(v as number).toFixed(2)}`)
                        .join(' ')}
                    </span>
                  </div>
                )}
                {intent.notes && (
                  <p className="text-[10px] text-[#998380] leading-relaxed pt-0.5 bg-[#fff8fa] p-1.5 rounded-lg border border-[#fcedf1]">
                    {intent.notes}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 记忆锚点与情绪记忆联动 */}
          <div className="p-3.5 rounded-2xl border border-[#f2cad4] bg-white/90 shadow-xs space-y-2">
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => setIsMemoryOpen(!isMemoryOpen)}
            >
              <span className="text-xs font-serif font-bold text-[#732641] flex items-center gap-1.5">
                <BookMarked className="size-3.5 text-[#b83d5a]" />
                情绪记忆联动 ({anchors.length + dynamicMemories.length})
              </span>
              {isMemoryOpen ? (
                <ChevronUp className="size-3.5 text-[#732641]" />
              ) : (
                <ChevronDown className="size-3.5 text-[#732641]" />
              )}
            </div>

            {isMemoryOpen && (
              <div className="space-y-2.5 pt-1 font-serif">
                {/* SSR / SR / R Tier Tabs */}
                <div className="flex items-center gap-1 bg-[#fae1e8]/60 p-1 rounded-xl border border-[#f2cad4]/70">
                  <button
                    onClick={() => setMemoryTierFilter('ALL')}
                    className={`flex-1 py-1 px-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer text-center ${
                      memoryTierFilter === 'ALL'
                        ? 'bg-white text-[#732641] shadow-2xs border border-[#f2cad4]'
                        : 'text-[#998380] hover:text-[#732641]'
                    }`}
                  >
                    全部 ({anchors.length + dynamicMemories.length})
                  </button>
                  <button
                    onClick={() => setMemoryTierFilter('SSR')}
                    className={`flex-1 py-1 px-1 rounded-lg text-[10px] font-black transition-all cursor-pointer text-center flex items-center justify-center gap-0.5 ${
                      memoryTierFilter === 'SSR'
                        ? 'bg-gradient-to-r from-amber-400 via-rose-400 to-pink-500 text-white shadow-2xs'
                        : 'text-amber-800 hover:bg-amber-100/50'
                    }`}
                  >
                    <span>SSR</span>
                    <span className="text-[9px] opacity-90">({totalSSR})</span>
                  </button>
                  <button
                    onClick={() => setMemoryTierFilter('SR')}
                    className={`flex-1 py-1 px-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer text-center flex items-center justify-center gap-0.5 ${
                      memoryTierFilter === 'SR'
                        ? 'bg-gradient-to-r from-purple-400 to-pink-400 text-white shadow-2xs'
                        : 'text-purple-800 hover:bg-purple-100/50'
                    }`}
                  >
                    <span>SR</span>
                    <span className="text-[9px] opacity-90">({totalSR})</span>
                  </button>
                  <button
                    onClick={() => setMemoryTierFilter('R')}
                    className={`flex-1 py-1 px-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer text-center flex items-center justify-center gap-0.5 ${
                      memoryTierFilter === 'R'
                        ? 'bg-slate-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100/50'
                    }`}
                  >
                    <span>R</span>
                    <span className="text-[9px] opacity-90">({totalR})</span>
                  </button>
                </div>

                {/* 触发的记忆锚点 */}
                {filteredAnchors.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-[#b83d5a] flex items-center gap-1">
                      <Sparkles className="size-3 text-[#b83d5a]" />
                      记忆锚点触发 ({filteredAnchors.length}):
                    </span>
                    {filteredAnchors.map((a, idx) => {
                      const isSSR = a.tier === 'SSR';
                      const isSR = a.tier === 'SR';
                      return (
                        <div
                          key={idx}
                          className={`p-2 rounded-xl text-[11px] text-[#4a3431] space-y-1 transition-all ${
                            isSSR
                              ? 'border border-amber-300/80 bg-gradient-to-br from-[#fffdf5] via-[#fffbf8] to-[#fff3f6] shadow-xs'
                              : isSR
                              ? 'border border-purple-200/90 bg-gradient-to-br from-[#faf5ff] to-[#fff8fb] shadow-2xs'
                              : 'border border-[#fae1e8] bg-[#fffbfb]'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px]">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[9px] px-1.5 py-0.2 rounded-md font-black tracking-wider shadow-2xs ${
                                  isSSR
                                    ? 'bg-gradient-to-r from-amber-400 to-rose-400 text-white'
                                    : isSR
                                    ? 'bg-gradient-to-r from-purple-400 to-pink-400 text-white'
                                    : 'bg-slate-200 text-slate-700 font-bold'
                                }`}
                              >
                                {a.tier}
                              </span>
                              <span className="font-bold text-[#732641]">「{a.anchor.trigger}」</span>
                            </div>
                            <span className="text-[9.5px] text-[#998380] font-mono">
                              权重 {(a.anchor.weight * 100).toFixed(0)}%
                            </span>
                          </div>
                          <p className="text-[10.5px] text-[#785b56] leading-snug">{a.anchor.reaction}</p>
                          <div className="flex items-center justify-between text-[9px] text-[#b3999e]">
                            <span>记忆锚定</span>
                            <span>{formatTimeAgo(a.triggered_at || (a as any).triggeredAt)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 角色动态沉淀记忆 */}
                {filteredDynamicMemories.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-[#b83d5a] flex items-center gap-1">
                      <Heart className="size-3 text-[#b83d5a]" />
                      沉淀羁绊记忆 ({filteredDynamicMemories.length}):
                    </span>
                    {filteredDynamicMemories.map((dm) => {
                      const isSSR = dm.tier === 'SSR';
                      const isSR = dm.tier === 'SR';
                      return (
                        <div
                          key={dm.id}
                          className={`p-2 rounded-xl text-[11px] text-[#4a3431] space-y-1 transition-all ${
                            isSSR
                              ? 'border border-amber-300/80 bg-gradient-to-br from-[#fffdf5] via-[#fffbf8] to-[#fff3f6] shadow-xs'
                              : isSR
                              ? 'border border-purple-200/90 bg-gradient-to-br from-[#faf5ff] to-[#fff8fb] shadow-2xs'
                              : 'border border-[#fcedf1] bg-[#fffafb]'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px]">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[9px] px-1.5 py-0.2 rounded-md font-black tracking-wider shadow-2xs ${
                                  isSSR
                                    ? 'bg-gradient-to-r from-amber-400 to-rose-400 text-white'
                                    : isSR
                                    ? 'bg-gradient-to-r from-purple-400 to-pink-400 text-white'
                                    : 'bg-slate-200 text-slate-700 font-bold'
                                }`}
                              >
                                {dm.tier}
                              </span>
                              <span className="font-bold text-[#732641]">
                                {dm.topic_keywords?.join(' / ') || '沉淀记忆'}
                              </span>
                            </div>
                            <span className="text-amber-700 font-mono text-[9.5px]">
                              {EMOTION_CN[dm.emotion_type] || dm.emotion_type} {'★'.repeat(dm.intensity || 1)}
                            </span>
                          </div>
                          <p className="text-[10.5px] text-[#785b56] leading-snug">
                            {dm.character_reaction_summary || dm.user_trigger_summary}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {filteredAnchors.length === 0 && filteredDynamicMemories.length === 0 && (
                  <div className="p-3 rounded-xl border border-dashed border-[#f2cad4] bg-[#fffbfb] text-center space-y-1">
                    <p className="text-[11px] text-[#998380]">
                      {memoryTierFilter === 'ALL'
                        ? '对话中触发的记忆与情感沉淀将显示在此'
                        : `暂无 ${memoryTierFilter} 级别的记忆内容`}
                    </p>
                    <p className="text-[9.5px] text-[#b3999e]">
                      可通过深入交谈或触发重要羁绊话题解锁更高阶记忆
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 后台潜意识暗线 */}
          <div className="p-3.5 rounded-2xl border border-[#f2cad4] bg-white/90 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-serif font-bold text-[#732641]">
                <Brain className="size-3.5 text-[#b83d5a]" />
                角色潜意识暗线 ({threads.length})
              </span>
            </div>

            {threads.length > 0 ? (
              <div className="space-y-1.5">
                {threads.map((t, idx) => {
                  const remTurns = t.remaining_turns ?? (t as any).remainingTurns ?? 0;
                  return (
                    <div
                      key={idx}
                      className="p-2 rounded-xl border border-[#fae1e8] bg-[#fffbfb] text-[11px] font-serif text-[#4a3431] space-y-1"
                    >
                      <p className="leading-snug">{t.content}</p>
                      <div className="flex items-center justify-between text-[9.5px] text-[#998380]">
                        <span>剩余 {remTurns} 轮</span>
                        <div className="h-1.5 w-16 rounded-full bg-[#fae1e8] overflow-hidden border border-[#f2cad4]/40">
                          <div
                            className="h-full rounded-full bg-[#b83d5a]"
                            style={{ width: `${Math.min(100, remTurns * 25)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] font-serif text-[#998380] text-center py-1">
                暂无活跃的暗线潜意识
              </p>
            )}
          </div>

          {/* 小游戏交互情感沉淀 */}
          {gameEmotionImpacts.length > 0 && (
            <div className="p-3.5 rounded-2xl border border-[#ebd7a0] bg-[#fefdfa] shadow-xs space-y-2">
              <div
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={() => setIsGameEmotionOpen(!isGameEmotionOpen)}
              >
                <span className="text-xs font-serif font-bold text-[#b45309] flex items-center gap-1.5">
                  <Swords className="size-3.5 text-[#d97706]" />
                  小游戏交互情感沉淀
                </span>
                {isGameEmotionOpen ? (
                  <ChevronUp className="size-3.5 text-[#b45309]" />
                ) : (
                  <ChevronDown className="size-3.5 text-[#b45309]" />
                )}
              </div>

              {isGameEmotionOpen && (
                <div className="space-y-1.5 pt-1">
                  {gameEmotionImpacts.slice(0, 3).map((imp) => (
                    <div
                      key={imp.id}
                      className="p-2 rounded-xl border border-[#ebd7a0]/60 bg-white text-[11px] font-serif text-[#4a3431] space-y-1"
                    >
                      <div className="flex justify-between text-[10px] text-[#998380]">
                        <span className="font-semibold text-[#b45309]">{imp.gameType === 'gomoku' ? '五子棋' : '捉鬼牌'}</span>
                        <span>{formatTimeAgo(imp.timestamp)}</span>
                      </div>
                      <p className="leading-snug">{imp.summary}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部角色信息 */}
        <div className="border-t border-[#f2cad4] px-4 py-3 bg-white/70">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-full bg-[#fae1e8] border border-[#f2cad4] flex items-center justify-center text-xs font-bold text-[#732641]">
              {characterName.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold font-serif text-[#4a3431] truncate">{characterName}</div>
              <div className="text-[10px] text-[#998380]">沉浸式交互就绪</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
