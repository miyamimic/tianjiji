import { 
  ChevronLeft, 
  ChevronRight, 
  Brain, 
  Sparkles, 
  BookMarked, 
  ScanSearch, 
  History, 
  Heart, 
  ShieldAlert, 
  ShieldCheck, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  UserCheck,
  Info
} from 'lucide-react';
import EmotionRadar from './EmotionRadar';
import type { EmotionVector, BackgroundThread, TriggeredAnchor, IntentAnalysis, DynamicMemory, Character } from '../data/types';
import { loadDynamicMemories, loadSavedCharacters } from '../lib/customStore';
import {
  loadRelationState,
  saveRelationState,
  getMentalOpenTierInfo,
  getPhysicalPhaseInfo,
  PHYSICAL_PHASES,
  notifyRelationToast,
  MILESTONE_DEFINITIONS,
  getCharacterSensitivity,
  calculateMilestoneImpact,
  toggleMilestoneWithImpact,
  nudgeMentalOpen,
  type RelationState,
  type MilestoneMeta,
} from '../lib/relationEngine';
import { useState, useEffect } from 'react';

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
  positive: 'text-yellow-300',
  negative: 'text-red-300',
  neutral: 'text-white/40',
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

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return `${Math.floor(diff / 86400000)}天前`;
}

export default function Sidebar({
  isOpen,
  onToggle,
  characterId,
  emotion,
  previousEmotion,
  emotionConfirmed,
  onConfirmEmotion,
  threads,
  anchors,
  intent,
  fallback,
  characterName,
  overlayMode = false,
}: Props) {
  const [relation, setRelation] = useState<RelationState>(() => 
    characterId ? loadRelationState(characterId) : { mentalOpen: 15, physicalPhase: 0, intimacyCooldown: 0, milestones: [] }
  );

  const [currentChar, setCurrentChar] = useState<Character | null>(null);

  useEffect(() => {
    if (characterId) {
      setRelation(loadRelationState(characterId));
      const chars = loadSavedCharacters();
      const found = chars.find((c) => c.character_id === characterId) || null;
      setCurrentChar(found);
    }
  }, [characterId, isOpen]);

  const sensitivity = getCharacterSensitivity(currentChar);

  const handleUpdateMental = (val: number) => {
    if (!characterId) return;
    const prev = relation.mentalOpen;
    const next = { ...relation, mentalOpen: val };
    setRelation(next);
    saveRelationState(characterId, next);
    notifyRelationToast({
      type: 'mental',
      mentalOpen: val,
      prevMentalOpen: prev,
      mentalDelta: val - prev,
    });
  };

  const handleNudgeMental = (delta: number) => {
    if (!characterId) return;
    const res = nudgeMentalOpen(characterId, delta);
    setRelation(res);
  };

  const handleUpdatePhysical = (phase: number) => {
    if (!characterId) return;
    const prevPhase = relation.physicalPhase;
    const next = { ...relation, physicalPhase: phase };
    setRelation(next);
    saveRelationState(characterId, next);
    notifyRelationToast({
      type: 'physical',
      physicalPhase: phase,
      prevPhysicalPhase: prevPhase,
      cooldown: relation.intimacyCooldown,
    });
  };

  const handleToggleMilestone = (key: string) => {
    if (!characterId) return;
    const res = toggleMilestoneWithImpact(characterId, key, currentChar);
    setRelation(res.nextState);
  };

  const mentalTier = getMentalOpenTierInfo(relation.mentalOpen);
  const physicalTier = getPhysicalPhaseInfo(relation.physicalPhase);

  // Group milestones
  const emotionalUpMilestones = MILESTONE_DEFINITIONS.filter((m) => m.category === 'emotional_up');
  const conflictDownMilestones = MILESTONE_DEFINITIONS.filter((m) => m.category === 'conflict_down');
  const physicalMilestones = MILESTONE_DEFINITIONS.filter((m) => m.category === 'physical');

  return (
    <>
      {!isOpen && (
        <button
          onClick={onToggle}
          className={`${overlayMode ? 'absolute' : 'fixed'} right-0 top-1/2 z-[60] -translate-y-1/2 bg-[hsl(220_22%_13%/0.8)] backdrop-blur-md border border-white/10 border-r-0 rounded-l-lg p-2 text-white/40 hover:text-white transition-all hover:bg-[hsl(220_22%_13%)]`}
          aria-label="展开调试面板"
        >
          <ChevronLeft className="size-4" />
        </button>
      )}

      <aside
        className={`${overlayMode ? 'absolute' : 'fixed'} right-0 top-0 z-[70] h-full w-84 max-w-[88vw] bg-[hsl(220_22%_13%/0.85)] backdrop-blur-2xl border-l border-white/10 transition-transform duration-300 ease-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'} shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 bg-black/20">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-white">内部状态与关系引擎</h2>
          </div>
          <button
            onClick={onToggle}
            className="rounded-md p-1.5 text-white/40 hover:bg-white/5 hover:text-white cursor-pointer"
            aria-label="收起调试面板"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 p-4">
          {/* Relationship State Engine Card */}
          <div className="p-3.5 rounded-2xl border border-pink-500/30 bg-gradient-to-b from-pink-950/25 via-purple-950/20 to-black/40 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-1.5">
                <Heart className="size-4 text-pink-400 fill-pink-400/20" />
                <span className="text-xs font-bold text-white tracking-wide">关系演化引擎</span>
              </div>
              <span className="text-[10px] text-pink-300 font-mono bg-pink-500/15 px-2 py-0.5 rounded-md border border-pink-500/20">
                {relation.intimacyCooldown > 0 ? `亲密冷静期 (${relation.intimacyCooldown}轮)` : '只读约束·错位演化'}
              </span>
            </div>

            {/* 角色性格与敏感度倍率说明 */}
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-white/80 font-medium flex items-center gap-1">
                  <UserCheck className="size-3 text-cyan-400" />
                  {characterName}的心防特质
                </span>
                <span className="text-cyan-300 font-bold bg-cyan-950/60 border border-cyan-500/30 px-1.5 py-0.5 rounded text-[10px]">
                  {sensitivity.temperamentTitle}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-white/60 font-mono pt-0.5">
                <span className="text-pink-300">破冰吸收率: ×{sensitivity.trustGainMultiplier.toFixed(2)}</span>
                <span className="text-cyan-300">创伤防御惩罚: ×{sensitivity.hurtPenaltyMultiplier.toFixed(2)}</span>
              </div>
              <p className="text-[10px] text-white/60 leading-tight">
                {sensitivity.temperamentDesc}
              </p>
            </div>

            {/* 1. 心理开放度 (Mental Openness) */}
            <div className="space-y-2 p-2.5 rounded-xl bg-pink-950/20 border border-pink-500/20">
              <div className="flex items-center justify-between text-xs">
                <span className="text-pink-200 font-medium flex items-center gap-1">
                  <Heart className="size-3.5 text-pink-400 fill-pink-400/20" />
                  <span>心理开放度</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleNudgeMental(-1)}
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-white/5 hover:bg-white/15 text-pink-200 border border-white/10 active:scale-95 transition-all cursor-pointer"
                    title="细微收敛 -1"
                  >
                    -1
                  </button>
                  <span className="font-mono text-xs font-bold text-pink-300 bg-pink-500/30 px-2 py-0.5 rounded-md border border-pink-500/40">
                    {relation.mentalOpen}/100
                  </span>
                  <button
                    type="button"
                    onClick={() => handleNudgeMental(1)}
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-white/5 hover:bg-white/15 text-pink-200 border border-white/10 active:scale-95 transition-all cursor-pointer"
                    title="细微升温 +1"
                  >
                    +1
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={relation.mentalOpen}
                onChange={(e) => handleUpdateMental(Number(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10 accent-pink-400"
              />
              <div className="flex justify-between text-[9px] text-pink-300/50 font-mono">
                <span>0(心防)</span>
                <span>25(友善)</span>
                <span>50(烦恼)</span>
                <span>75(过往)</span>
                <span>100(脆弱)</span>
              </div>
              <p className="text-[10px] text-pink-200/80 leading-relaxed bg-black/40 p-2 rounded-lg border border-pink-500/15">
                <span className="font-semibold text-pink-300">{mentalTier.name}：</span>
                {mentalTier.promptText}
              </p>
            </div>

            {/* 2. 身体亲密阶段 (Physical Intimacy Phase) */}
            <div className="space-y-2 p-2.5 rounded-xl bg-purple-950/20 border border-purple-500/20">
              <div className="flex items-center justify-between text-xs">
                <span className="text-purple-200 font-medium flex items-center gap-1">
                  <Sparkles className="size-3.5 text-purple-400" />
                  <span>身体亲密度 (Phase {relation.physicalPhase})</span>
                </span>
                <span className="text-[10px] text-purple-300 font-semibold bg-purple-500/20 px-1.5 py-0.5 rounded">
                  {physicalTier.name.split('（')[0]}
                </span>
              </div>
              <div className="grid grid-cols-6 gap-1">
                {[0, 1, 2, 3, 4, 5].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleUpdatePhysical(p)}
                    className={`py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                      relation.physicalPhase === p
                        ? 'border-purple-400 bg-purple-500/35 text-white ring-1 ring-purple-400/50 shadow-sm'
                        : 'border-white/10 bg-black/40 text-white/50 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    P{p}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-purple-200/80 leading-relaxed bg-black/40 p-2 rounded-lg border border-purple-500/15">
                {physicalTier.promptText}
              </p>
            </div>

            {/* 3. 日常细微温存与关系节点 */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/90 font-bold flex items-center gap-1">
                  <BookMarked className="size-3.5 text-pink-400" />
                  日常互动与关系节点
                </span>
                <span className="text-[9px] text-pink-300/70">对话亦会自动细微升温</span>
              </div>

              {/* 🌸 日常细微温存 */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-pink-300 flex items-center gap-1">
                  <TrendingUp className="size-3" />
                  <span>日常细微温存（积极细微波动 ↑）</span>
                </div>
                <div className="space-y-1">
                  {emotionalUpMilestones.map((m) => {
                    const isChecked = relation.milestones.includes(m.key);
                    const impact = calculateMilestoneImpact(m, currentChar);
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => handleToggleMilestone(m.key)}
                        className={`w-full text-left p-2 rounded-xl border transition-all flex items-start justify-between gap-2 cursor-pointer ${
                          isChecked
                            ? 'border-pink-400 bg-pink-950/40 text-pink-100 ring-1 ring-pink-400/40 shadow-sm'
                            : 'border-white/10 bg-black/30 text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-[11px] font-medium">
                            <span className={isChecked ? 'text-pink-400 font-bold' : 'text-white/30'}>
                              {isChecked ? '✓' : '○'}
                            </span>
                            <span className="truncate">{m.label}</span>
                          </div>
                          <p className="text-[9px] text-white/40 truncate mt-0.5">
                            {m.description}
                          </p>
                        </div>
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                          isChecked ? 'bg-pink-500/30 text-pink-200 border border-pink-400/40' : 'bg-white/5 text-pink-300/80'
                        }`}>
                          +{impact.mentalDelta}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 🥀 日常细微波折 */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-semibold text-cyan-300 flex items-center gap-1">
                  <TrendingDown className="size-3" />
                  <span>日常细微波折（温和收敛 ↓）</span>
                </div>
                <div className="space-y-1">
                  {conflictDownMilestones.map((m) => {
                    const isChecked = relation.milestones.includes(m.key);
                    const impact = calculateMilestoneImpact(m, currentChar);
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => handleToggleMilestone(m.key)}
                        className={`w-full text-left p-2 rounded-xl border transition-all flex items-start justify-between gap-2 cursor-pointer ${
                          isChecked
                            ? 'border-cyan-400 bg-cyan-950/40 text-cyan-100 ring-1 ring-cyan-400/40 shadow-sm'
                            : 'border-white/10 bg-black/30 text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-[11px] font-medium">
                            <span className={isChecked ? 'text-cyan-400 font-bold' : 'text-white/30'}>
                              {isChecked ? '✓' : '○'}
                            </span>
                            <span className="truncate">{m.label}</span>
                          </div>
                          <p className="text-[9px] text-white/40 truncate mt-0.5">
                            {m.description}
                          </p>
                        </div>
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                          isChecked ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/40' : 'bg-white/5 text-cyan-300/80'
                        }`}>
                          {impact.mentalDelta}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 💜 身体亲密推进 */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-semibold text-purple-300 flex items-center gap-1">
                  <Sparkles className="size-3" />
                  <span>身体亲密阶段推进</span>
                </div>
                <div className="space-y-1">
                  {physicalMilestones.map((m) => {
                    const isChecked = relation.milestones.includes(m.key);
                    const impact = calculateMilestoneImpact(m, currentChar);
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => handleToggleMilestone(m.key)}
                        className={`w-full text-left p-2 rounded-xl border transition-all flex items-start justify-between gap-2 cursor-pointer ${
                          isChecked
                            ? 'border-purple-400 bg-purple-950/40 text-purple-100 ring-1 ring-purple-400/40 shadow-sm'
                            : 'border-white/10 bg-black/30 text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-[11px] font-medium">
                            <span className={isChecked ? 'text-purple-400 font-bold' : 'text-white/30'}>
                              {isChecked ? '✓' : '○'}
                            </span>
                            <span className="truncate">{m.label}</span>
                          </div>
                          <p className="text-[9px] text-white/40 truncate mt-0.5">
                            {m.description}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-0.5 shrink-0">
                          {typeof m.targetPhysicalPhase === 'number' && (
                            <span className="text-[9px] font-bold text-purple-300 bg-purple-500/20 px-1 py-0.2 rounded border border-purple-400/30">
                              Phase {m.targetPhysicalPhase}
                            </span>
                          )}
                          <span className="text-[9px] font-mono text-pink-300/80">
                            +{impact.mentalDelta}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {relation.intimacyCooldown > 0 && (
              <div className="text-[10px] text-amber-300/90 bg-amber-950/40 border border-amber-500/30 p-2.5 rounded-xl flex items-center gap-2">
                <Clock className="size-3.5 text-amber-400 shrink-0 animate-spin" />
                <span>亲密推进冷静期：角色禁止主动发起亲密，仅响应主控（剩余 {relation.intimacyCooldown} 轮）</span>
              </div>
            )}
          </div>

          {/* Emotion Radar */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Brain className="size-4 text-pink-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white/80">情感雷达</h3>
            </div>
            <EmotionRadar emotion={emotion} />
          </div>

          {/* Background Threads */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="size-4 text-purple-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white/80">后台思维线</h3>
              </div>
              <span className="text-[10px] font-mono text-white/40">{threads.length} 条活跃</span>
            </div>
            {threads.length === 0 ? (
              <p className="text-xs text-white/40 italic">暂无后台潜意识思维</p>
            ) : (
              <div className="space-y-2">
                {threads.map((t, i) => (
                  <div key={i} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs space-y-1">
                    <p className="text-white/80 leading-relaxed">{t.content}</p>
                    <div className="flex items-center justify-between text-[10px] text-white/40">
                      <span>潜意识残留</span>
                      <span className="font-mono">剩余 {t.remaining_turns} 轮</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Triggered Anchors */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ScanSearch className="size-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white/80">触碰的记忆锚点</h3>
              </div>
              <span className="text-[10px] font-mono text-white/40">{anchors.length} 个触发</span>
            </div>
            {anchors.length === 0 ? (
              <p className="text-xs text-white/40 italic">当前对话未激活性格锚点</p>
            ) : (
              <div className="space-y-2">
                {anchors.map((a, i) => (
                  <div key={i} className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs space-y-1">
                    <div className="flex items-center justify-between text-emerald-300 font-medium">
                      <span>触发词: {a.anchor.trigger}</span>
                      <span className="text-[10px] text-emerald-400/60 font-mono">权重 {a.anchor.weight}</span>
                    </div>
                    <p className="text-white/70 text-[11px]">{a.anchor.reaction}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
