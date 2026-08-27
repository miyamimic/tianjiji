import { ChevronLeft, ChevronRight, Brain, Sparkles, BookMarked, ScanSearch, History, Swords, ChevronDown, ChevronUp, Heart, CheckCircle2, Bookmark, Layers, Trash2, Edit2, Plus, Check, X, RefreshCw } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import EmotionRadar from './EmotionRadar';
import type { EmotionVector, BackgroundThread, TriggeredAnchor, IntentAnalysis, DynamicMemory, EmotionKey } from '../data/types';
import { 
  loadDynamicMemories, 
  loadMemoryDedupEnabled, 
  saveMemoryDedupEnabled, 
  deleteDynamicMemory, 
  updateDynamicMemory, 
  deduplicateDynamicMemories,
  saveDynamicMemory
} from '../lib/customStore';
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
  
  const [dynamicMemories, setDynamicMemories] = useState<DynamicMemory[]>(() =>
    characterId ? loadDynamicMemories(characterId) : []
  );
  const [dedupEnabled, setDedupEnabled] = useState<boolean>(() =>
    characterId ? loadMemoryDedupEnabled(characterId) : true
  );

  // Edit / Add memory states
  const [editingDmId, setEditingDmId] = useState<string | null>(null);
  const [editKw, setEditKw] = useState('');
  const [editEmotion, setEditEmotion] = useState<EmotionKey>('warmth');
  const [editIntensity, setEditIntensity] = useState<number>(3);
  const [editSummary, setEditSummary] = useState('');

  const [isCreatingMemory, setIsCreatingMemory] = useState(false);
  const [newKw, setNewKw] = useState('');
  const [newEmotion, setNewEmotion] = useState<EmotionKey>('warmth');
  const [newIntensity, setNewIntensity] = useState<number>(3);
  const [newSummary, setNewSummary] = useState('');

  useEffect(() => {
    if (!characterId) return;
    setDynamicMemories(loadDynamicMemories(characterId));
    setDedupEnabled(loadMemoryDedupEnabled(characterId));
  }, [characterId]);

  const handleToggleDedup = () => {
    if (!characterId) return;
    const nextVal = !dedupEnabled;
    saveMemoryDedupEnabled(characterId, nextVal);
    setDedupEnabled(nextVal);
  };

  const handleCleanDuplicates = () => {
    if (!characterId) return;
    const cleaned = deduplicateDynamicMemories(characterId);
    setDynamicMemories(cleaned);
  };

  const handleDeleteDm = (id: string) => {
    if (!characterId) return;
    deleteDynamicMemory(characterId, id);
    setDynamicMemories(loadDynamicMemories(characterId));
  };

  const handleStartEdit = (dm: DynamicMemory) => {
    setEditingDmId(dm.id);
    setEditKw(dm.topic_keywords?.join(', ') || '');
    setEditEmotion(dm.emotion_type || 'warmth');
    setEditIntensity(dm.intensity || 3);
    setEditSummary(dm.character_reaction_summary || dm.user_trigger_summary || '');
  };

  const handleSaveEdit = (dm: DynamicMemory) => {
    if (!characterId) return;
    const keywords = editKw
      .split(/[,，/、\s]+/)
      .map((k) => k.trim())
      .filter(Boolean);
    const updated: DynamicMemory = {
      ...dm,
      topic_keywords: keywords.length > 0 ? keywords : ['沉淀记忆'],
      emotion_type: editEmotion,
      intensity: editIntensity,
      character_reaction_summary: editSummary.trim() || dm.character_reaction_summary,
      importance: editIntensity >= 3 ? 0.9 : editIntensity === 2 ? 0.6 : 0.3,
    };
    updateDynamicMemory(characterId, updated);
    setDynamicMemories(loadDynamicMemories(characterId));
    setEditingDmId(null);
  };

  const handleCreateMemory = () => {
    if (!characterId || !newSummary.trim()) return;
    const keywords = newKw
      .split(/[,，/、\s]+/)
      .map((k) => k.trim())
      .filter(Boolean);
    const created: DynamicMemory = {
      id: `dm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      user_trigger_summary: keywords.join(' / ') || '羁绊话题',
      character_reaction_summary: newSummary.trim(),
      emotion_type: newEmotion,
      intensity: newIntensity,
      topic_keywords: keywords.length > 0 ? keywords : ['羁绊沉淀'],
      created_at: Date.now(),
      importance: newIntensity >= 3 ? 0.9 : newIntensity === 2 ? 0.6 : 0.3,
    };
    saveDynamicMemory(characterId, created);
    setDynamicMemories(loadDynamicMemories(characterId));
    setIsCreatingMemory(false);
    setNewKw('');
    setNewSummary('');
    setNewIntensity(3);
  };

  const gameEmotionImpacts = characterId ? loadGameEmotionImpacts(characterId) : [];

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
      {/* Sidebar Chassis */}
      <aside
        className={`${
          overlayMode ? 'absolute' : 'fixed'
        } right-0 top-0 z-[70] h-full w-84 max-w-[92vw] bg-[#fffafb]/95 backdrop-blur-2xl border-l-2 border-[#f2cad4] shadow-2xl transition-transform duration-300 ease-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header with Sub-centered/Left-leaning Retract Button (< + Puppy Heart Pattern + Six-dimension Title) */}
        <div className="flex items-center justify-start pl-7 pr-4 py-3 border-b border-[#f2cad4] bg-white/75 select-none relative">
          <button
            onClick={onToggle}
            className="flex items-center gap-2 px-2 py-1 rounded-xl text-[#732641] hover:bg-[#fae1e8] transition-all cursor-pointer group"
            title="收起六维情绪栏"
            aria-label="收起六维情绪栏"
          >
            <ChevronLeft className="size-4 text-[#b83d5a] group-hover:-translate-x-0.5 transition-transform stroke-[2.5]" />
            <PuppyHeartsDoodle size={22} className="drop-shadow-2xs" />
            <h2 className="text-[14.5px] font-serif font-bold tracking-wider text-[#732641] [text-shadow:0_1px_2px_rgba(224,122,147,0.3),0_2px_4px_rgba(115,38,65,0.12)]">
              六维情绪
            </h2>
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
              <span className="text-[10px] text-[#b83d5a] font-serif bg-[#fae1e8]/70 border border-[#f2cad4]/60 px-2 py-0.5 rounded-full">
                实时自动演化
              </span>
            </div>

            <div className="rounded-xl border border-[#fae1e8] bg-[#fffbfb] p-1.5">
              <EmotionRadar
                emotion={emotion}
                previousEmotion={previousEmotion ?? undefined}
                confirmed={true}
                className="h-[210px] w-full"
              />
            </div>

            {/* 数值进度条 */}
            <div className="space-y-1 pt-1">
              {(['anger', 'fear', 'joy', 'sadness', 'desire', 'warmth'] as const).map((key) => {
                const oldVal = previousEmotion?.[key];
                const diff = oldVal !== undefined ? emotion[key] - oldVal : 0;
                const hasChange = oldVal !== undefined && Math.abs(diff) >= 0.005;
                return (
                  <div key={key} className="flex items-center gap-2 text-[11px] font-serif">
                    <span className="w-9 text-[#785b56] font-medium shrink-0">{EMOTION_CN[key]}</span>
                    <div className="flex-1 h-2 rounded-full bg-[#fae1e8] overflow-hidden border border-[#f2cad4]/50">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#f48fa5] to-[#b83d5a] transition-all duration-500"
                        style={{ width: `${Math.round(emotion[key] * 100)}%` }}
                      />
                    </div>
                    <span className="w-6 text-right text-[#4a3431] font-mono tabular-nums text-[10px] shrink-0">
                      {Math.round(emotion[key] * 100)}
                    </span>
                    <span className="w-9 text-[9px] tabular-nums font-mono text-right shrink-0">
                      {hasChange ? (
                        <span
                          className={diff > 0 ? 'text-rose-600 font-bold' : 'text-emerald-700 font-bold'}
                        >
                          {diff > 0 ? '+' : ''}
                          {diff.toFixed(2)}
                        </span>
                      ) : null}
                    </span>
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

                {/* 记忆去重与新增控制条 */}
                <div className="p-2 rounded-xl bg-[#fae1e8]/40 border border-[#f2cad4]/60 space-y-1.5">
                  <div className="flex items-center justify-between text-[10.5px]">
                    <div className="flex items-center gap-1 text-[#732641] font-semibold">
                      <Layers className="size-3 text-[#b83d5a]" />
                      <span>同内容不叠加</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleCleanDuplicates}
                        className="px-1.5 py-0.5 rounded-md bg-white text-[#732641] hover:bg-[#fce4eb] border border-[#f2cad4] text-[9.5px] font-medium transition cursor-pointer flex items-center gap-0.5"
                        title="立即清理已有重复羁绊记忆"
                      >
                        <RefreshCw className="size-2.5 text-[#b83d5a]" />
                        <span>一键去重</span>
                      </button>
                      <button
                        onClick={handleToggleDedup}
                        className={`w-7 h-4 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                          dedupEnabled ? 'bg-[#b83d5a] justify-end' : 'bg-stone-300 justify-start'
                        }`}
                        title={dedupEnabled ? '已开启不叠加去重' : '已关闭去重'}
                      >
                        <span className="w-3 h-3 rounded-full bg-white shadow-xs block" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-[9.5px] text-[#998380]">
                      {dedupEnabled ? '自动合并相同话题/反应记忆' : '保留每次独立沉淀记录'}
                    </span>
                    <button
                      onClick={() => setIsCreatingMemory(!isCreatingMemory)}
                      className="px-2 py-0.5 rounded-md bg-[#b83d5a] text-white hover:bg-[#9e2f49] text-[10px] font-semibold transition cursor-pointer flex items-center gap-0.5 shadow-2xs"
                    >
                      <Plus className="size-3" />
                      <span>{isCreatingMemory ? '收起新增' : '新增记忆'}</span>
                    </button>
                  </div>

                  {/* 新增记忆表单 */}
                  {isCreatingMemory && (
                    <div className="p-2 rounded-xl bg-white border border-[#f2cad4] space-y-2 mt-1 shadow-xs">
                      <div className="text-[11px] font-bold text-[#732641] flex items-center justify-between border-b border-[#fce4eb] pb-1">
                        <span>手动沉淀羁绊记忆</span>
                        <button
                          onClick={() => setIsCreatingMemory(false)}
                          className="text-[#998380] hover:text-[#732641]"
                        >
                          <X className="size-3" />
                        </button>
                      </div>

                      <div className="space-y-1.5 text-[10.5px]">
                        <div>
                          <label className="text-[#8c7471] font-semibold block mb-0.5">话题关键词 (逗号分隔):</label>
                          <input
                            type="text"
                            value={newKw}
                            onChange={(e) => setNewKw(e.target.value)}
                            placeholder="如：雨天, 承诺, 拥抱"
                            className="w-full px-2 py-1 rounded-lg border border-[#f2cad4] bg-[#fff8fa] text-[11px] text-[#4a3431] focus:outline-none focus:border-[#b83d5a]"
                          />
                        </div>

                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-[#8c7471] font-semibold block mb-0.5">情感倾向:</label>
                            <select
                              value={newEmotion}
                              onChange={(e) => setNewEmotion(e.target.value as EmotionKey)}
                              className="w-full px-1.5 py-1 rounded-lg border border-[#f2cad4] bg-[#fff8fa] text-[10.5px] text-[#4a3431]"
                            >
                              <option value="warmth">温情 (Warmth)</option>
                              <option value="joy">喜悦 (Joy)</option>
                              <option value="desire">欲望 (Desire)</option>
                              <option value="sadness">悲伤 (Sadness)</option>
                              <option value="anger">愤怒 (Anger)</option>
                              <option value="fear">恐惧 (Fear)</option>
                            </select>
                          </div>

                          <div className="w-24">
                            <label className="text-[#8c7471] font-semibold block mb-0.5">记忆级别:</label>
                            <select
                              value={newIntensity}
                              onChange={(e) => setNewIntensity(Number(e.target.value))}
                              className="w-full px-1.5 py-1 rounded-lg border border-[#f2cad4] bg-[#fff8fa] text-[10.5px] text-[#4a3431]"
                            >
                              <option value={3}>SSR ★★★</option>
                              <option value={2}>SR ★★</option>
                              <option value={1}>R ★</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="text-[#8c7471] font-semibold block mb-0.5">角色羁绊反应描写:</label>
                          <textarea
                            value={newSummary}
                            onChange={(e) => setNewSummary(e.target.value)}
                            placeholder="描述角色对此段回忆的专属触动或反应..."
                            className="w-full min-h-[50px] px-2 py-1 rounded-lg border border-[#f2cad4] bg-[#fff8fa] text-[11px] text-[#4a3431] focus:outline-none focus:border-[#b83d5a]"
                          />
                        </div>

                        <button
                          onClick={handleCreateMemory}
                          className="w-full py-1 rounded-lg bg-[#b83d5a] hover:bg-[#9e2f49] text-white text-[11px] font-bold transition flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                        >
                          <Check className="size-3" />
                          保存沉淀记忆
                        </button>
                      </div>
                    </div>
                  )}
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

                {/* 角色动态沉淀记忆 (支持自主编辑与删除) */}
                {filteredDynamicMemories.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-[#b83d5a] flex items-center gap-1">
                      <Heart className="size-3 text-[#b83d5a]" />
                      沉淀羁绊记忆 ({filteredDynamicMemories.length}):
                    </span>
                    {filteredDynamicMemories.map((dm) => {
                      const isSSR = dm.tier === 'SSR';
                      const isSR = dm.tier === 'SR';
                      const isEditingThis = editingDmId === dm.id;

                      if (isEditingThis) {
                        return (
                          <div
                            key={dm.id}
                            className="p-2.5 rounded-xl border border-[#b83d5a] bg-white text-[11px] space-y-2 shadow-sm"
                          >
                            <div className="flex items-center justify-between font-bold text-[#732641] text-[11px] border-b border-[#fce4eb] pb-1">
                              <span>编辑羁绊记忆</span>
                              <button
                                onClick={() => setEditingDmId(null)}
                                className="text-[#998380] hover:text-[#4a3431]"
                              >
                                <X className="size-3" />
                              </button>
                            </div>

                            <div className="space-y-1.5 text-[10.5px]">
                              <div>
                                <label className="text-[#8c7471] font-semibold block mb-0.5">关键词:</label>
                                <input
                                  type="text"
                                  value={editKw}
                                  onChange={(e) => setEditKw(e.target.value)}
                                  className="w-full px-2 py-1 rounded-lg border border-[#f2cad4] bg-[#fff8fa] text-[11px] text-[#4a3431] focus:outline-none focus:border-[#b83d5a]"
                                />
                              </div>

                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <label className="text-[#8c7471] font-semibold block mb-0.5">情绪类型:</label>
                                  <select
                                    value={editEmotion}
                                    onChange={(e) => setEditEmotion(e.target.value as EmotionKey)}
                                    className="w-full px-1.5 py-1 rounded-lg border border-[#f2cad4] bg-[#fff8fa] text-[10.5px] text-[#4a3431]"
                                  >
                                    <option value="warmth">温情</option>
                                    <option value="joy">喜悦</option>
                                    <option value="desire">欲望</option>
                                    <option value="sadness">悲伤</option>
                                    <option value="anger">愤怒</option>
                                    <option value="fear">恐惧</option>
                                  </select>
                                </div>

                                <div className="w-24">
                                  <label className="text-[#8c7471] font-semibold block mb-0.5">级别:</label>
                                  <select
                                    value={editIntensity}
                                    onChange={(e) => setEditIntensity(Number(e.target.value))}
                                    className="w-full px-1.5 py-1 rounded-lg border border-[#f2cad4] bg-[#fff8fa] text-[10.5px] text-[#4a3431]"
                                  >
                                    <option value={3}>SSR ★★★</option>
                                    <option value={2}>SR ★★</option>
                                    <option value={1}>R ★</option>
                                  </select>
                                </div>
                              </div>

                              <div>
                                <label className="text-[#8c7471] font-semibold block mb-0.5">反应描写:</label>
                                <textarea
                                  value={editSummary}
                                  onChange={(e) => setEditSummary(e.target.value)}
                                  className="w-full min-h-[50px] px-2 py-1 rounded-lg border border-[#f2cad4] bg-[#fff8fa] text-[11px] text-[#4a3431] focus:outline-none focus:border-[#b83d5a]"
                                />
                              </div>

                              <div className="flex justify-end gap-1.5 pt-1">
                                <button
                                  onClick={() => setEditingDmId(null)}
                                  className="px-2 py-0.5 rounded-lg bg-stone-100 text-[#665554] hover:bg-stone-200 text-[10.5px] transition cursor-pointer"
                                >
                                  取消
                                </button>
                                <button
                                  onClick={() => handleSaveEdit(dm)}
                                  className="px-3 py-0.5 rounded-lg bg-[#b83d5a] hover:bg-[#9e2f49] text-white text-[10.5px] font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                                >
                                  <Check className="size-3" />
                                  保存
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={dm.id}
                          className={`p-2 rounded-xl text-[11px] text-[#4a3431] space-y-1 transition-all group/item ${
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
                            
                            {/* Actions (Edit & Delete) + Emotion Stars */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-amber-700 font-mono text-[9.5px]">
                                {EMOTION_CN[dm.emotion_type] || dm.emotion_type} {'★'.repeat(dm.intensity || 1)}
                              </span>

                              <div className="opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center gap-0.5">
                                <button
                                  onClick={() => handleStartEdit(dm)}
                                  title="编辑此记忆"
                                  className="p-0.5 rounded text-[#998380] hover:text-[#732641] hover:bg-[#fae1e8] transition cursor-pointer"
                                >
                                  <Edit2 className="size-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteDm(dm.id)}
                                  title="删除此记忆"
                                  className="p-0.5 rounded text-[#998380] hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              </div>
                            </div>
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
