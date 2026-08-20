import { useState, useEffect } from 'react';
import { 
  X, 
  Heart, 
  Sparkles, 
  Flame, 
  Clock, 
  Plus, 
  Trash2, 
  RotateCcw, 
  ShieldCheck, 
  Lock,
  ChevronRight
} from 'lucide-react';
import { 
  loadRelationState, 
  saveRelationState, 
  getMentalOpenTierInfo, 
  getPhysicalPhaseInfo, 
  PHYSICAL_PHASES, 
  MENTAL_OPEN_TIERS,
  PRESET_MILESTONES,
  addMilestone,
  removeMilestone,
  notifyRelationToast,
  type RelationState 
} from '../lib/relationEngine';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  characterId: string;
  characterName: string;
}

export default function RelationControlModal({ isOpen, onClose, characterId, characterName }: Props) {
  const [relation, setRelation] = useState<RelationState>(() => loadRelationState(characterId));
  const [customMilestone, setCustomMilestone] = useState('');

  useEffect(() => {
    if (isOpen && characterId) {
      setRelation(loadRelationState(characterId));
    }
  }, [isOpen, characterId]);

  if (!isOpen) return null;

  const currentMentalTier = getMentalOpenTierInfo(relation.mentalOpen);
  const currentPhysicalPhase = getPhysicalPhaseInfo(relation.physicalPhase);

  const handleMentalChange = (val: number) => {
    const updated = { ...relation, mentalOpen: val };
    setRelation(updated);
    saveRelationState(characterId, updated);
    notifyRelationToast({
      type: 'mental',
      mentalOpen: val,
    });
  };

  const handlePhysicalChange = (phase: number) => {
    const updated = { ...relation, physicalPhase: phase };
    setRelation(updated);
    saveRelationState(characterId, updated);
    notifyRelationToast({
      type: 'physical',
      physicalPhase: phase,
      cooldown: updated.intimacyCooldown,
    });
  };

  const handleTogglePresetMilestone = (key: string) => {
    if (relation.milestones.includes(key)) {
      const updated = removeMilestone(characterId, key);
      setRelation(updated);
    } else {
      const updated = addMilestone(characterId, key);
      setRelation(updated);
      if (key === 'first_sex' || key === 'stable_intimacy') {
        notifyRelationToast({
          type: 'physical',
          physicalPhase: relation.physicalPhase,
          cooldown: 5,
        });
      }
    }
  };

  const handleAddCustomMilestone = () => {
    if (!customMilestone.trim()) return;
    const updated = addMilestone(characterId, customMilestone.trim());
    setRelation(updated);
    setCustomMilestone('');
  };

  const handleResetCooldown = () => {
    const updated = { ...relation, intimacyCooldown: 0 };
    setRelation(updated);
    saveRelationState(characterId, updated);
    notifyRelationToast({
      type: 'physical',
      physicalPhase: relation.physicalPhase,
      cooldown: 0,
    });
  };

  const handleSetCooldown = (rounds: number) => {
    const updated = { ...relation, intimacyCooldown: rounds };
    setRelation(updated);
    saveRelationState(characterId, updated);
    notifyRelationToast({
      type: 'physical',
      physicalPhase: relation.physicalPhase,
      cooldown: rounds,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in-0 duration-200">
      <div className="relative w-full max-w-xl rounded-2xl border border-white/15 bg-[hsl(222_28%_11%)] p-5 text-white shadow-2xl overflow-y-auto max-h-[90vh] space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/30 flex items-center justify-center">
              <Heart className="size-5 text-pink-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                关系状态引擎
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/70 font-normal">
                  与「{characterName}」的专属关系
                </span>
              </h2>
              <p className="text-xs text-white/50">
                严格人工受控 · 心理防御度与身体亲密度独立错位
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Core Constraint Notice Banner */}
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200/90 text-xs space-y-1">
          <div className="font-semibold flex items-center gap-1.5 text-amber-300">
            <ShieldCheck className="size-4" />
            绝对核心约束：状态数值由您全权控制
          </div>
          <p className="text-[11px] text-amber-200/70 leading-relaxed">
            LLM 仅只读访问行为边界约束，绝对禁止擅自修改任何状态数值或里程碑。一切阶段演进、心理破防或剧情打标均由您手动操作。
          </p>
        </div>

        {/* 1. 心理开放度 (Mental Openness: 0-100) */}
        <div className="p-4 rounded-xl border border-pink-500/20 bg-gradient-to-br from-pink-950/20 to-transparent space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-pink-200 flex items-center gap-2">
              <Heart className="size-4 text-pink-400 fill-pink-400/20" />
              心理开放度（内心防御程度）
            </label>
            <span className="font-mono text-sm font-bold text-pink-300 bg-pink-500/20 px-2.5 py-0.5 rounded-lg border border-pink-500/30">
              {relation.mentalOpen} / 100
            </span>
          </div>

          {/* Slider */}
          <div className="space-y-1">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={relation.mentalOpen}
              onChange={(e) => handleMentalChange(Number(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10 accent-pink-400"
            />
            <div className="flex justify-between text-[10px] text-white/35 font-mono">
              <span>0 (深重防御)</span>
              <span>25 (表层友善)</span>
              <span>50 (小烦恼)</span>
              <span>75 (分享经历)</span>
              <span>100 (坦露自卑脆弱)</span>
            </div>
          </div>

          {/* Current Tier Description & Prompt preview */}
          <div className="p-2.5 rounded-lg bg-black/30 border border-pink-500/15 space-y-1">
            <div className="text-xs font-semibold text-pink-300">
              当前层级：{currentMentalTier.name}
            </div>
            <p className="text-[11px] text-pink-200/80 leading-relaxed">
              💡 注入大模型行为约束：{currentMentalTier.promptText}
            </p>
          </div>
        </div>

        {/* 2. 身体亲密阶段 (Physical Intimacy Phase: 0-5) */}
        <div className="p-4 rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-950/20 to-transparent space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-purple-200 flex items-center gap-2">
              <Sparkles className="size-4 text-purple-400" />
              身体亲密阶段（0~5 阶段）
            </label>
            <span className="font-mono text-sm font-bold text-purple-300 bg-purple-500/20 px-2.5 py-0.5 rounded-lg border border-purple-500/30">
              Phase {relation.physicalPhase} · {currentPhysicalPhase.name.split('（')[0]}
            </span>
          </div>

          {/* Phase selector buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PHYSICAL_PHASES.map((p) => (
              <button
                key={p.phase}
                type="button"
                onClick={() => handlePhysicalChange(p.phase)}
                className={`p-2.5 text-left rounded-xl border transition-all cursor-pointer ${
                  relation.physicalPhase === p.phase
                    ? 'border-purple-400 bg-purple-500/25 text-white shadow-md shadow-purple-500/10 ring-1 ring-purple-400'
                    : 'border-white/10 bg-white/[0.02] text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-300">
                    Phase {p.phase}
                  </span>
                  {relation.physicalPhase === p.phase && (
                    <span className="size-2 rounded-full bg-purple-400" />
                  )}
                </div>
                <div className="text-xs font-medium text-white/90 truncate mt-0.5">
                  {p.name}
                </div>
                <div className="text-[10px] text-white/40 truncate mt-0.5">
                  {p.shortDesc}
                </div>
              </button>
            ))}
          </div>

          {/* Current Phase Prompt preview */}
          <div className="p-2.5 rounded-lg bg-black/30 border border-purple-500/15 space-y-1">
            <div className="text-xs font-semibold text-purple-300">
              当前阶段约束：{currentPhysicalPhase.name}
            </div>
            <p className="text-[11px] text-purple-200/80 leading-relaxed">
              💡 注入大模型行为约束：{currentPhysicalPhase.promptText}
            </p>
          </div>
        </div>

        {/* 3. 亲密冷却计数器 (Intimacy Cooldown) */}
        <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-amber-400" />
              <span className="text-xs font-semibold text-white/90">
                亲密冷却计数器 (对话轮次)
              </span>
            </div>
            <div className="flex items-center gap-2">
              {relation.intimacyCooldown > 0 ? (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono text-xs font-bold border border-amber-500/30">
                  冷却中：剩余 {relation.intimacyCooldown} 轮
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 text-xs border border-emerald-500/20">
                  无冷却约束
                </span>
              )}
            </div>
          </div>

          <p className="text-[11px] text-white/50 leading-relaxed">
            防止 AI 频繁主动调情。冷却生效时强制约束：
            <span className="text-amber-200/80">「角色不允许主动发起亲密、调情、性话题，仅能够回应主控主动动作」</span>。
            每轮对话完成后自动 -1。
          </p>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleResetCooldown}
              disabled={relation.intimacyCooldown === 0}
              className="px-3 py-1 text-xs rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
            >
              清空重置 (0 轮)
            </button>
            <button
              onClick={() => handleSetCooldown(5)}
              className="px-3 py-1 text-xs rounded-lg border border-amber-500/30 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 transition cursor-pointer"
            >
              重置为标准冷却 (5 轮)
            </button>
          </div>
        </div>

        {/* 4. 关键剧情里程碑打标 (Milestones) */}
        <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white/90">
              已发生剧情里程碑标记
            </span>
            <span className="text-[11px] text-white/40">
              共 {relation.milestones.length} 个
            </span>
          </div>

          {/* Preset milestone pills */}
          <div className="flex flex-wrap gap-1.5">
            {PRESET_MILESTONES.map((m) => {
              const active = relation.milestones.includes(m.key);
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => handleTogglePresetMilestone(m.key)}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-all cursor-pointer ${
                    active
                      ? m.category === 'physical'
                        ? 'border-purple-400 bg-purple-500/20 text-purple-200 font-semibold'
                        : 'border-pink-400 bg-pink-500/20 text-pink-200 font-semibold'
                      : 'border-white/10 bg-black/40 text-white/40 hover:text-white/70 hover:border-white/20'
                  }`}
                >
                  {active ? '✓ ' : '+ '}
                  {m.label}
                  {m.triggerCooldown && active && ' (触发5轮冷却)'}
                </button>
              );
            })}
          </div>

          {/* Custom milestones list */}
          {relation.milestones.filter((m) => !PRESET_MILESTONES.some((p) => p.key === m)).length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-white/5">
              {relation.milestones
                .filter((m) => !PRESET_MILESTONES.some((p) => p.key === m))
                .map((m) => (
                  <span
                    key={m}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border border-white/15 bg-white/5 text-white/80"
                  >
                    <span>{m}</span>
                    <button
                      onClick={() => handleTogglePresetMilestone(m)}
                      className="text-white/40 hover:text-red-400 cursor-pointer"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
            </div>
          )}

          {/* Add custom milestone input */}
          <div className="flex gap-2 pt-1">
            <input
              type="text"
              value={customMilestone}
              onChange={(e) => setCustomMilestone(e.target.value)}
              placeholder="输入自定义事件标签（例如：一起淋雨回家、初次见家长）..."
              className="flex-1 bg-black/40 text-white text-xs rounded-lg px-3 py-2 border border-white/10 focus:border-[hsl(28_85%_62%)] focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCustomMilestone();
                }
              }}
            />
            <button
              onClick={handleAddCustomMilestone}
              className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition cursor-pointer"
            >
              追加事件
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
          <span className="text-white/40">
            所有改动已实时保存并在下一轮对话生效
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-pink-500/80 to-purple-500/80 hover:from-pink-500 hover:to-purple-500 text-white font-semibold shadow-lg shadow-pink-500/20 transition cursor-pointer"
          >
            完成并返回
          </button>
        </div>
      </div>
    </div>
  );
}
