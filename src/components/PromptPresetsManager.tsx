import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BookmarkCheck,
  Sparkles,
  Plus,
  RotateCcw,
  Trash2,
  Copy,
  Check,
  CheckCheck,
  FileText,
  Download,
  Upload,
  Search,
  Layers,
  ArrowRight,
  Edit3,
  MessageSquare,
  Shield,
  Info,
  X,
  Sliders,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  loadPromptPresets,
  getActivePromptPresetId,
  setActivePromptPresetId,
  applyPromptPreset,
  saveCurrentLayersAsPreset,
  deletePromptPreset,
  hasDeletedBuiltinPromptPresets,
  restoreBuiltinPromptPresets,
  updatePromptPreset,
  duplicatePromptPreset,
  importPresetsFromJson,
  loadPromptLayers,
  type PromptPreset,
  type PromptLayer,
} from '../lib/customStore';

interface Props {
  currentCharacterId: string;
  onUpdated: () => void;
  onNavigateToPipeline: () => void;
}

export default function PromptPresetsManager({
  currentCharacterId,
  onUpdated,
  onNavigateToPipeline,
}: Props) {
  const [presets, setPresets] = useState<PromptPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string>('preset-standard');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('preset-standard');
  const [inspectExpanded, setInspectExpanded] = useState<boolean>(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'builtin' | 'custom' | 'active'>('all');

  // Modals
  const [showNewPresetModal, setShowNewPresetModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDesc, setNewPresetDesc] = useState('');

  const [editingPreset, setEditingPreset] = useState<PromptPreset | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // Toast / notice
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  };

  // Load presets
  const reloadData = () => {
    const all = loadPromptPresets();
    const activeId = getActivePromptPresetId();
    setPresets(all);
    setActivePresetId(activeId);
    if (!all.some((p) => p.id === selectedPresetId)) {
      setSelectedPresetId(activeId);
    }
  };

  useEffect(() => {
    reloadData();
    const handleChanged = () => reloadData();
    window.addEventListener('rp_engine_prompt_presets_changed', handleChanged);
    window.addEventListener('rp_engine_prompt_layers_changed', handleChanged);
    return () => {
      window.removeEventListener('rp_engine_prompt_presets_changed', handleChanged);
      window.removeEventListener('rp_engine_prompt_layers_changed', handleChanged);
    };
  }, []);

  // Filtered list
  const filteredPresets = useMemo(() => {
    return presets.filter((p) => {
      if (filterType === 'builtin' && !p.isBuiltin) return false;
      if (filterType === 'custom' && p.isBuiltin) return false;
      if (filterType === 'active' && p.id !== activePresetId) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchDesc = p.description ? p.description.toLowerCase().includes(q) : false;
      const matchLayer = p.layers.some(
        (l) => l.name.toLowerCase().includes(q) || l.content.toLowerCase().includes(q)
      );
      return matchName || matchDesc || matchLayer;
    });
  }, [presets, filterType, searchQuery, activePresetId]);

  const activePreset = useMemo(() => {
    return presets.find((p) => p.id === activePresetId) || presets[0];
  }, [presets, activePresetId]);

  const selectedPreset = useMemo(() => {
    return presets.find((p) => p.id === selectedPresetId) || activePreset;
  }, [presets, selectedPresetId, activePreset]);

  // Actions
  const handleApplyPreset = (preset: PromptPreset) => {
    applyPromptPreset(preset);
    setActivePresetId(preset.id);
    setSelectedPresetId(preset.id);
    showToast(`已成功应用预设【${preset.name}】！`);
    onUpdated();
  };

  const handleApplyAndEdit = (preset: PromptPreset) => {
    applyPromptPreset(preset);
    setActivePresetId(preset.id);
    setSelectedPresetId(preset.id);
    onUpdated();
    onNavigateToPipeline();
  };

  const handleDelete = (id: string, name: string, isBuiltin?: boolean) => {
    const msg = isBuiltin
      ? `确定要删除内置预设【${name}】吗？删除后可随时点击右上角“恢复内置推荐”找回。`
      : `确定要删除自定义预设【${name}】吗？此操作不可撤销。`;
    if (window.confirm(msg)) {
      deletePromptPreset(id);
      showToast(`已删除预设【${name}】`);
      reloadData();
      onUpdated();
    }
  };

  const handleDuplicate = (id: string) => {
    const duplicated = duplicatePromptPreset(id);
    if (duplicated) {
      showToast(`已基于方案复制生成新预设【${duplicated.name}】！`);
      reloadData();
      setSelectedPresetId(duplicated.id);
    }
  };

  const handleRestoreBuiltins = () => {
    restoreBuiltinPromptPresets();
    showToast('已恢复所有被删除的内置推荐预设！');
    reloadData();
    onUpdated();
  };

  const handleSaveCurrentAsNew = () => {
    if (!newPresetName.trim()) {
      showToast('请输入预设名称');
      return;
    }
    const created = saveCurrentLayersAsPreset(newPresetName.trim(), newPresetDesc.trim());
    showToast(`新预设【${created.name}】已保存并设为当前生效！`);
    setShowNewPresetModal(false);
    setNewPresetName('');
    setNewPresetDesc('');
    reloadData();
    onUpdated();
  };

  const handleStartEdit = (preset: PromptPreset) => {
    setEditingPreset(preset);
    setEditName(preset.name);
    setEditDesc(preset.description || '');
  };

  const handleSaveEdit = () => {
    if (!editingPreset || !editName.trim()) return;
    updatePromptPreset(editingPreset.id, {
      name: editName.trim(),
      description: editDesc.trim(),
    });
    showToast(`已更新预设【${editName.trim()}】信息！`);
    setEditingPreset(null);
    reloadData();
    onUpdated();
  };

  const handleExportAll = () => {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      activePresetId,
      presets,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `提示词预设方案库_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('已导出所有预设方案 JSON！');
  };

  const handleExportSingle = (preset: PromptPreset) => {
    const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `提示词预设_${preset.name}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`已导出预设【${preset.name}】！`);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const res = importPresetsFromJson(content);
        if (res.success) {
          showToast(`成功导入 ${res.count} 个提示词预设！`);
          reloadData();
          onUpdated();
        } else {
          showToast(res.error || '导入失败');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-4 font-sans select-none animate-in fade-in-50 duration-200">
      {/* Toast Notice */}
      {notice && (
        <div className="fixed top-5 right-5 z-50 px-4 py-2 rounded-2xl bg-[#732641] text-white text-xs font-bold shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Sparkles size={14} className="text-[#fed7aa]" />
          <span>{notice}</span>
        </div>
      )}

      {/* Hero: Active Preset Card & Quick Navigation */}
      <div className="relative overflow-hidden rounded-3xl p-4 sm:p-5 bg-gradient-to-r from-[#fff0f4] via-[#fcebf0] to-[#fff5f8] border-2 border-[#f2cad4] shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="size-11 sm:size-12 rounded-2xl bg-[#b83d5a] text-white flex items-center justify-center shrink-0 shadow-md">
              <BookmarkCheck size={24} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#dcfce7] text-emerald-800 border border-[#86efac]">
                  当前生效方案
                </span>
                {activePreset?.isBuiltin && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#fae1e8] text-[#8c243e] border border-[#f2cad4]">
                    内置推荐
                  </span>
                )}
                <h2 className="text-base sm:text-lg font-black text-[#4a3431] truncate">
                  {activePreset?.name || '默认方案'}
                </h2>
              </div>
              <p className="text-xs text-[#785b56] mt-1 leading-relaxed line-clamp-2">
                {activePreset?.description || '当前对话运行时正在遵循该方案配置的提示词图层。'}
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-[#732641] font-mono font-medium">
                <span>📦 包含 {activePreset?.layers?.length || 0} 个图层</span>
                <span>•</span>
                <span>
                  🟢 启用 {activePreset?.layers?.filter((l) => l.enabled).length || 0} 层
                </span>
                <span>•</span>
                <span>
                  System: {activePreset?.layers?.filter((l) => l.role === 'system').length || 0}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto shrink-0 pt-2 md:pt-0">
            <button
              type="button"
              onClick={onNavigateToPipeline}
              className="px-4 py-2.5 rounded-2xl bg-[#b83d5a] hover:bg-[#a0314c] text-white text-xs font-bold flex items-center gap-2 transition-all shadow-sm active:scale-95 cursor-pointer"
              title="前往第 2 栏【提示词编排】修改各图层参数与详细提示词"
            >
              <Layers size={15} />
              <span>进入编排深度微调</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Top Toolbar: Search, Filters & Bulk Actions */}
      <div className="p-3.5 sm:p-4 rounded-3xl bg-white border border-[#f2cad4] shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#b83d5a]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索提示词预设方案（按名称、场景特点或包含的提示词规则）..."
              className="w-full pl-8 pr-8 py-2 rounded-xl bg-[#fffafb] border border-[#f2cad4] text-xs text-[#4a3431] focus:outline-none focus:border-[#b83d5a] placeholder:text-[#a89094]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-0.5 cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {hasDeletedBuiltinPromptPresets() && (
              <button
                type="button"
                onClick={handleRestoreBuiltins}
                className="px-3 py-1.5 rounded-xl border border-[#f2cad4] bg-[#fff5f7] hover:bg-[#fae1e8] text-[#732641] font-semibold text-xs flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-2xs"
                title="一键恢复所有已被删除的内置推荐预设"
              >
                <RotateCcw size={13} className="text-[#b83d5a]" />
                <span>恢复内置预设</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setNewPresetName('');
                setNewPresetDesc('');
                setShowNewPresetModal(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-[#b83d5a] hover:bg-[#a0314c] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <Plus size={14} />
              <span>存当前为新预设</span>
            </button>

            <button
              type="button"
              onClick={handleExportAll}
              className="px-2.5 py-1.5 rounded-xl border border-[#f2cad4] bg-[#fae1e8] hover:bg-[#f7d0dc] text-[#732641] font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
              title="导出所有预设方案为 JSON 文件"
            >
              <Download size={13} className="text-[#b83d5a]" />
              <span className="hidden sm:inline">导出全部</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1.5 rounded-xl border border-[#f2cad4] bg-[#fae1e8] hover:bg-[#f7d0dc] text-[#732641] font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
              title="从外部 JSON 文件导入预设"
            >
              <Upload size={13} className="text-[#b83d5a]" />
              <span className="hidden sm:inline">导入预设</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 custom-scrollbar">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterType === 'all'
                ? 'bg-[#b83d5a] text-white shadow-2xs'
                : 'bg-[#fae1e8] text-[#732641] hover:bg-[#f7d0dc]'
            }`}
          >
            全部方案 ({presets.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('builtin')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterType === 'builtin'
                ? 'bg-[#8c243e] text-white shadow-2xs'
                : 'bg-[#fae1e8] text-[#8c243e] hover:bg-[#f7d0dc]'
            }`}
          >
            内置推荐 ({presets.filter((p) => p.isBuiltin).length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('custom')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterType === 'custom'
                ? 'bg-[#ea580c] text-white shadow-2xs'
                : 'bg-[#ffedd5] text-[#9a3412] hover:bg-[#fed7aa]'
            }`}
          >
            用户自定义 ({presets.filter((p) => !p.isBuiltin).length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('active')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterType === 'active'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-[#dcfce7] text-emerald-800 hover:bg-[#bbf7d0]'
            }`}
          >
            当前生效方案
          </button>
        </div>
      </div>

      {/* Preset Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredPresets.map((preset) => {
          const isActive = preset.id === activePresetId;
          const isSelected = preset.id === selectedPresetId;
          const enabledLayerCount = preset.layers.filter((l) => l.enabled).length;

          return (
            <div
              key={preset.id}
              onClick={() => setSelectedPresetId(preset.id)}
              className={`relative rounded-3xl border-2 p-4 transition-all cursor-pointer flex flex-col justify-between ${
                isActive
                  ? 'bg-[#fff5f8] border-[#b83d5a] shadow-md ring-2 ring-[#b83d5a]/20'
                  : isSelected
                    ? 'bg-white border-[#e07a93] shadow-xs'
                    : 'bg-[#fffdfd] border-[#f2cad4] hover:border-[#e098a8] hover:shadow-2xs'
              }`}
            >
              <div>
                {/* Header Row: Badges & Actions */}
                <div className="flex items-center justify-between gap-1.5 mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isActive ? (
                      <span className="px-2 py-0.5 rounded-lg bg-[#b83d5a] text-white text-[10px] font-bold flex items-center gap-1 shrink-0">
                        <Check size={11} /> 当前已生效
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-lg bg-[#fae1e8] text-[#732641] text-[10px] font-semibold shrink-0">
                        待启用
                      </span>
                    )}

                    {preset.isBuiltin ? (
                      <span className="px-1.5 py-0.5 rounded-md bg-[#fae1e8] text-[#8c243e] text-[9px] font-mono shrink-0">
                        内置
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded-md bg-[#ffedd5] text-[#9a3412] text-[9px] font-mono shrink-0">
                        自定义
                      </span>
                    )}
                  </div>

                  {/* Card Tool Actions */}
                  <div
                    className="flex items-center gap-1 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {!preset.isBuiltin && (
                      <button
                        type="button"
                        onClick={() => handleStartEdit(preset)}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-[#b83d5a] hover:bg-[#fae1e8] transition-colors cursor-pointer"
                        title="编辑方案名称与描述"
                      >
                        <Edit3 size={13} />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDuplicate(preset.id)}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-[#b83d5a] hover:bg-[#fae1e8] transition-colors cursor-pointer"
                      title="以此预设为蓝本复制生成新方案"
                    >
                      <Copy size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExportSingle(preset)}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-[#b83d5a] hover:bg-[#fae1e8] transition-colors cursor-pointer"
                      title="导出此预设为 JSON"
                    >
                      <Download size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(preset.id, preset.name, preset.isBuiltin)}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
                      title={
                        preset.isBuiltin
                          ? `删除内置预设【${preset.name}】（可随时一键恢复）`
                          : `删除自定义预设【${preset.name}】`
                      }
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Preset Title */}
                <h3 className="text-sm font-bold text-[#4a3431] flex items-center gap-1.5">
                  <BookmarkCheck
                    size={15}
                    className={isActive ? 'text-[#b83d5a]' : 'text-stone-400'}
                  />
                  <span className="truncate">{preset.name}</span>
                </h3>

                {/* Description */}
                <p className="text-xs text-[#785b56] mt-1.5 leading-relaxed line-clamp-3">
                  {preset.description || '无补充描述'}
                </p>
              </div>

              {/* Card Footer: Layer stats and Apply CTA */}
              <div className="mt-4 pt-3 border-t border-[#f2cad4] space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-mono text-[#a0522d]">
                  <span className="flex items-center gap-1">
                    <Layers size={12} className="text-[#b83d5a]" />
                    {preset.layers.length} 个图层 ({enabledLayerCount} 启用)
                  </span>
                  <span className="text-[10px] text-stone-400">
                    {preset.layers.filter((l) => l.role === 'system').length} System ·{' '}
                    {preset.layers.filter((l) => l.role === 'user').length} User
                  </span>
                </div>

                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {isActive ? (
                    <button
                      type="button"
                      onClick={() => onNavigateToPipeline()}
                      className="flex-1 py-1.5 rounded-xl bg-[#fae1e8] hover:bg-[#f7d0dc] text-[#732641] font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <Layers size={13} />
                      <span>正在使用 · 前往编排</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className="flex-1 py-1.5 rounded-xl bg-[#b83d5a] hover:bg-[#a0314c] text-white font-bold text-xs flex items-center justify-center gap-1 transition-all shadow-xs active:scale-95 cursor-pointer"
                    >
                      <Check size={13} />
                      <span>一键应用此预设</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleApplyAndEdit(preset)}
                    className="px-2.5 py-1.5 rounded-xl border border-[#f2cad4] bg-white hover:bg-[#fff5f7] text-[#785b56] hover:text-[#4a3431] text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    title="应用并跳转至提示词编排"
                  >
                    <ExternalLink size={12} />
                    <span>深入微调</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Preset Layer Architecture Inspector */}
      {selectedPreset && (
        <div className="rounded-3xl border border-[#f2cad4] bg-[#fffafb] shadow-xs overflow-hidden mt-6">
          <div
            onClick={() => setInspectExpanded(!inspectExpanded)}
            className="flex items-center justify-between p-4 bg-[#fff0f4] border-b border-[#f2cad4] cursor-pointer hover:bg-[#fcebf0] transition-colors select-none"
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-white border border-[#f2cad4] text-[#b83d5a]">
                <Layers size={16} />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-[#4a3431] flex items-center gap-2">
                  <span>预设图层结构透视：【{selectedPreset.name}】</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#fae1e8] text-[#732641] font-mono">
                    共 {selectedPreset.layers.length} 层
                  </span>
                </h4>
                <p className="text-[10px] text-[#785b56]">
                  在应用前清晰预览该方案内包含的各图层角色、生效指令与心理/动作/语言规范。
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {selectedPreset.id !== activePresetId && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleApplyPreset(selectedPreset);
                  }}
                  className="px-3 py-1 rounded-xl bg-[#b83d5a] hover:bg-[#a0314c] text-white text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                >
                  应用此方案
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleApplyAndEdit(selectedPreset);
                }}
                className="px-3 py-1 rounded-xl bg-white border border-[#f2cad4] text-[#732641] hover:bg-[#fff5f7] text-xs font-bold transition-all active:scale-95 cursor-pointer"
              >
                前往编排微调
              </button>
              <div className="text-stone-400 p-1">
                {inspectExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>
          </div>

          {inspectExpanded && (
            <div className="p-4 space-y-2.5">
              {selectedPreset.layers.map((layer, index) => (
                <div
                  key={layer.id || index}
                  className={`rounded-2xl border p-3 text-xs transition-all ${
                    layer.enabled
                      ? 'bg-white border-[#f2cad4]'
                      : 'bg-[#faf5f6] border-[#eed4dc] opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-lg bg-[#fae1e8] text-[#732641] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg ${
                          layer.role === 'system'
                            ? 'bg-[#fae1e8] text-[#8c243e]'
                            : layer.role === 'user'
                              ? 'bg-[#ffedd5] text-[#9a3412]'
                              : 'bg-[#f3e8ff] text-[#6b21a8]'
                        }`}
                      >
                        {layer.role.toUpperCase()}
                      </span>
                      <span className="font-bold text-[#4a3431] truncate">{layer.name}</span>
                    </div>

                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                        layer.enabled
                          ? 'bg-[#dcfce7] text-emerald-800'
                          : 'bg-[#f3e8ff] text-stone-500'
                      }`}
                    >
                      {layer.enabled ? '生效中' : '未启用'}
                    </span>
                  </div>

                  {layer.description && (
                    <div className="text-[10px] text-[#785b56] mb-1.5 flex items-center gap-1">
                      <Info size={11} className="text-[#b83d5a] shrink-0" />
                      <span>{layer.description}</span>
                    </div>
                  )}

                  <div className="font-mono text-[11px] text-[#5c4441] bg-[#fffbfb] p-2.5 rounded-xl border border-[#f5dbe2] leading-relaxed line-clamp-4">
                    {layer.type === 'history_context'
                      ? `【历史消息注入窗口】提取最近 ${layer.historyLimit ?? 12} 条对话往来打包注入模型。`
                      : layer.content || '（暂无提示词文本内容）'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Save Current Layers As New Preset */}
      {showNewPresetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl border-2 border-[#f2cad4] p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#f2cad4] pb-3">
              <h3 className="text-sm font-bold text-[#4a3431] flex items-center gap-2">
                <BookmarkCheck size={16} className="text-[#b83d5a]" />
                存当前编排为新方案预设
              </h3>
              <button
                type="button"
                onClick={() => setShowNewPresetModal(false)}
                className="p-1 rounded-full text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#4a3431] mb-1">预设方案名称 *</label>
                <input
                  type="text"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder="例如：高甜双向互动流、黑化病娇压迫感..."
                  className="w-full px-3 py-2 rounded-xl bg-[#fffafb] border border-[#f2cad4] focus:outline-none focus:border-[#b83d5a]"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#4a3431] mb-1">方案特点描述 (可选)</label>
                <textarea
                  rows={3}
                  value={newPresetDesc}
                  onChange={(e) => setNewPresetDesc(e.target.value)}
                  placeholder="描述该方案的描写风格、心理活动深度、台词特点或适用剧情阶段..."
                  className="w-full px-3 py-2 rounded-xl bg-[#fffafb] border border-[#f2cad4] focus:outline-none focus:border-[#b83d5a]"
                />
              </div>

              <div className="p-3 rounded-2xl bg-[#fff0f4] border border-[#f2cad4] text-[11px] text-[#785b56]">
                💡 系统将打包当前正在使用的全部提示词图层（包含开关状态与文字内容），保存为独立方案供随时无缝切换。
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#f2cad4]">
              <button
                type="button"
                onClick={() => setShowNewPresetModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-[#785b56] hover:bg-[#fff5f7] transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveCurrentAsNew}
                className="px-4 py-2 rounded-xl bg-[#b83d5a] hover:bg-[#a0314c] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                保存新预设
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Preset Info */}
      {editingPreset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl border-2 border-[#f2cad4] p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#f2cad4] pb-3">
              <h3 className="text-sm font-bold text-[#4a3431] flex items-center gap-2">
                <Edit3 size={16} className="text-[#b83d5a]" />
                编辑预设方案信息
              </h3>
              <button
                type="button"
                onClick={() => setEditingPreset(null)}
                className="p-1 rounded-full text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#4a3431] mb-1">方案名称 *</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#fffafb] border border-[#f2cad4] focus:outline-none focus:border-[#b83d5a]"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#4a3431] mb-1">方案特点描述</label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#fffafb] border border-[#f2cad4] focus:outline-none focus:border-[#b83d5a]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#f2cad4]">
              <button
                type="button"
                onClick={() => setEditingPreset(null)}
                className="px-4 py-2 rounded-xl text-xs text-[#785b56] hover:bg-[#fff5f7] transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-2 rounded-xl bg-[#b83d5a] hover:bg-[#a0314c] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                保存修改
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
