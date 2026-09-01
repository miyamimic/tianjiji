import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Download,
  Upload,
  Sparkles,
  MousePointer,
  Layers,
  Percent,
  Sliders,
  Check,
  Move,
  Eye,
  Star,
  Sparkle,
} from 'lucide-react';
import {
  type GachaPoolConfig,
  type GachaCard,
  type GachaButton,
  type CursorConfig,
  DEFAULT_GACHA_POOL,
  saveGachaPoolConfig,
  resetGachaPoolConfig,
} from '../../lib/gachaEngine';

interface Props {
  initialConfig: GachaPoolConfig;
  onSave: (newConfig: GachaPoolConfig) => void;
  onClose: () => void;
}

export default function GachaEditor({ initialConfig, onSave, onClose }: Props) {
  const [config, setConfig] = useState<GachaPoolConfig>(() => ({
    ...initialConfig,
    cards: [...initialConfig.cards],
    buttons: [...initialConfig.buttons],
    rates: { ...initialConfig.rates },
    cursor: { ...(initialConfig.cursor || DEFAULT_GACHA_POOL.cursor!) },
  }));

  const [activeTab, setActiveTab] = useState<'pool' | 'cards' | 'buttons' | 'cursor' | 'json'>('pool');
  const [selectedCardId, setSelectedCardId] = useState<string>(config.cards[0]?.id || '');
  const [selectedButtonId, setSelectedButtonId] = useState<string>(config.buttons[0]?.id || '');
  const [jsonInput, setJsonInput] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [importError, setImportError] = useState<string>('');

  // Selected card for detailed editing
  const currentCard = config.cards.find((c) => c.id === selectedCardId) || config.cards[0];
  // Selected button
  const currentButton = config.buttons.find((b) => b.id === selectedButtonId) || config.buttons[0];

  // Save handler
  const handleSaveAll = () => {
    saveGachaPoolConfig(config);
    onSave(config);
    onClose();
  };

  // Reset handler
  const handleResetToDefault = () => {
    if (window.confirm('确认重置为系统默认卡池配置吗？未导出的自定义修改将会丢失。')) {
      const reset = resetGachaPoolConfig();
      setConfig(reset);
      onSave(reset);
      onClose();
    }
  };

  // JSON Export / Import
  const handleExportJson = () => {
    const json = JSON.stringify(config, null, 2);
    navigator.clipboard?.writeText(json);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleApplyJsonImport = () => {
    try {
      setImportError('');
      const parsed = JSON.parse(jsonInput);
      if (!parsed.cards || !parsed.buttons || !parsed.rates) {
        throw new Error('JSON 缺少 cards, buttons 或 rates 必要字段');
      }
      setConfig(parsed);
      alert('卡池配置 JSON 导入成功！记得点击右上角保存。');
    } catch (err: any) {
      setImportError(err?.message || 'JSON 语法错误');
    }
  };

  // Card Operations
  const handleAddCard = () => {
    const newId = `card_custom_${Date.now()}`;
    const newCard: GachaCard = {
      id: newId,
      name: '新卡片角色',
      rarity: 'SSR',
      card_image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=800&auto=format&fit=crop',
      description: '神秘的新伙伴',
      featured: false,
      char_evaluation_pool: ['哇，出了张很特别的新卡！'],
    };
    setConfig((prev) => ({
      ...prev,
      cards: [...prev.cards, newCard],
    }));
    setSelectedCardId(newId);
  };

  const handleDeleteCard = (cardId: string) => {
    if (config.cards.length <= 1) {
      alert('卡池中至少需要保留 1 张卡片');
      return;
    }
    setConfig((prev) => ({
      ...prev,
      cards: prev.cards.filter((c) => c.id !== cardId),
    }));
    if (selectedCardId === cardId) {
      const remaining = config.cards.filter((c) => c.id !== cardId);
      setSelectedCardId(remaining[0]?.id || '');
    }
  };

  const handleUpdateCard = (cardId: string, updates: Partial<GachaCard>) => {
    setConfig((prev) => ({
      ...prev,
      cards: prev.cards.map((c) => (c.id === cardId ? { ...c, ...updates } : c)),
    }));
  };

  // Button operations
  const handleUpdateBtnPos = (btnId: string, x: number, y: number) => {
    setConfig((prev) => ({
      ...prev,
      buttons: prev.buttons.map((b) => (b.id === btnId ? { ...b, position: { x, y } } : b)),
    }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fadeIn select-none">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-stone-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-800 bg-stone-950/80 shrink-0">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Sliders className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">卡池可视化配置器</h3>
              <p className="text-[10px] text-stone-400">底图、卡面、概率、保底井、拖拽按钮与虚拟光标定制</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveAll}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow transition cursor-pointer"
            >
              <Save className="size-3.5" />
              <span>保存配置</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-stone-800 bg-stone-950/40 text-xs shrink-0 overflow-x-auto no-scrollbar">
          {[
            { key: 'pool', label: '卡池基础与保底', icon: Layers },
            { key: 'cards', label: '卡片角色图鉴', icon: Sparkles },
            { key: 'buttons', label: '按钮与坐标', icon: Move },
            { key: 'cursor', label: '虚拟光标外观', icon: MousePointer },
            { key: 'json', label: 'JSON 导入/导出', icon: Download },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
                }`}
              >
                <Icon className="size-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          
          {/* TAB 1: POOL SETTINGS */}
          {activeTab === 'pool' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-stone-300 font-semibold">卡池名称</label>
                <input
                  type="text"
                  value={config.pool_name}
                  onChange={(e) => setConfig({ ...config, pool_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 focus:border-amber-500 focus:outline-none"
                  placeholder="例如：幻境共鸣 · 星辉之誓"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-stone-300 font-semibold">卡池底图 URL (Banner Image)</label>
                <input
                  type="text"
                  value={config.banner_image}
                  onChange={(e) => setConfig({ ...config, banner_image: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 focus:border-amber-500 focus:outline-none"
                  placeholder="https://..."
                />
                {config.banner_image && (
                  <div className="mt-2 w-full h-32 rounded-xl overflow-hidden border border-stone-800 bg-black relative">
                    <img
                      src={config.banner_image}
                      alt="Banner Preview"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2">
                      <span className="text-[10px] text-stone-300">底图实时预览</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-stone-300 font-semibold">保底井抽数 (Spark Count)</label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={config.spark_count}
                    onChange={(e) =>
                      setConfig({ ...config, spark_count: Math.max(1, parseInt(e.target.value) || 13) })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 focus:border-amber-500 focus:outline-none font-mono"
                  />
                  <span className="text-[10px] text-stone-500">达到该抽数时必得当期限定奖励</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-stone-300 font-semibold">保底奖励说明</label>
                  <input
                    type="text"
                    value={config.spark_reward?.description || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        spark_reward: {
                          ...config.spark_reward,
                          description: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Rates */}
              <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-stone-200 flex items-center gap-1.5">
                    <Percent className="size-3.5 text-amber-400" />
                    <span>出卡概率权重设定</span>
                  </span>
                  <span className="text-[10px] text-stone-500">
                    总和: {((config.rates.SSR + config.rates.SR + config.rates.R) * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <div className="text-amber-400 font-bold">SSR 概率</div>
                    <input
                      type="number"
                      step={0.01}
                      min={0.01}
                      max={0.5}
                      value={config.rates.SSR}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          rates: { ...config.rates, SSR: parseFloat(e.target.value) || 0.03 },
                        })
                      }
                      className="w-full mt-1 text-center py-1 rounded bg-black/40 font-mono text-xs text-amber-300 border border-amber-500/20"
                    />
                  </div>

                  <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/30">
                    <div className="text-purple-400 font-bold">SR 概率</div>
                    <input
                      type="number"
                      step={0.01}
                      min={0.05}
                      max={0.8}
                      value={config.rates.SR}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          rates: { ...config.rates, SR: parseFloat(e.target.value) || 0.15 },
                        })
                      }
                      className="w-full mt-1 text-center py-1 rounded bg-black/40 font-mono text-xs text-purple-300 border border-purple-500/20"
                    />
                  </div>

                  <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/30">
                    <div className="text-blue-400 font-bold">R 概率</div>
                    <input
                      type="number"
                      step={0.01}
                      min={0.1}
                      max={0.94}
                      value={config.rates.R}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          rates: { ...config.rates, R: parseFloat(e.target.value) || 0.82 },
                        })
                      }
                      className="w-full mt-1 text-center py-1 rounded bg-black/40 font-mono text-xs text-blue-300 border border-blue-500/20"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CARDS MANAGEMENT */}
          {activeTab === 'cards' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Card List Sidebar */}
              <div className="p-2 rounded-xl bg-stone-950 border border-stone-800 flex flex-col gap-2 max-h-[360px] overflow-y-auto">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-bold text-stone-300">卡片列表 ({config.cards.length})</span>
                  <button
                    onClick={handleAddCard}
                    className="p-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition cursor-pointer"
                    title="添加新卡片"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>

                <div className="space-y-1">
                  {config.cards.map((c) => {
                    const isSel = c.id === selectedCardId;
                    const rarityColor =
                      c.rarity === 'SSR'
                        ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                        : c.rarity === 'SR'
                        ? 'text-purple-400 bg-purple-500/10 border-purple-500/30'
                        : 'text-blue-400 bg-blue-500/10 border-blue-500/30';
                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedCardId(c.id)}
                        className={`p-2 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition ${
                          isSel
                            ? 'bg-amber-500/20 border-amber-500/60 shadow'
                            : 'bg-stone-900/60 border-stone-800 hover:bg-stone-900'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={c.card_image}
                            alt=""
                            className="size-8 rounded-lg object-cover bg-black shrink-0 border border-stone-800"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-stone-100 truncate">{c.name}</div>
                            <span className={`text-[9px] font-mono px-1 py-0.2 rounded border ${rarityColor}`}>
                              {c.rarity} {c.featured ? '· UP' : ''}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCard(c.id);
                          }}
                          className="text-stone-500 hover:text-rose-400 p-1 cursor-pointer"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Card Detailed Editor */}
              {currentCard ? (
                <div className="md:col-span-2 p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-stone-400 text-[11px]">卡片名称</label>
                      <input
                        type="text"
                        value={currentCard.name}
                        onChange={(e) => handleUpdateCard(currentCard.id, { name: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-stone-900 border border-stone-800 text-stone-100 focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-stone-400 text-[11px]">稀有度 & 限定UP</label>
                      <div className="flex items-center gap-2">
                        <select
                          value={currentCard.rarity}
                          onChange={(e) =>
                            handleUpdateCard(currentCard.id, { rarity: e.target.value as any })
                          }
                          className="px-2 py-1.5 rounded-lg bg-stone-900 border border-stone-800 text-stone-100 font-bold"
                        >
                          <option value="SSR">SSR (金色)</option>
                          <option value="SR">SR (紫色)</option>
                          <option value="R">R (蓝色)</option>
                        </select>
                        <label className="flex items-center gap-1 text-[11px] text-amber-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(currentCard.featured)}
                            onChange={(e) =>
                              handleUpdateCard(currentCard.id, { featured: e.target.checked })
                            }
                            className="accent-amber-500"
                          />
                          <span>当期限定 UP</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-stone-400 text-[11px]">卡面图片 URL</label>
                    <input
                      type="text"
                      value={currentCard.card_image}
                      onChange={(e) => handleUpdateCard(currentCard.id, { card_image: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-stone-900 border border-stone-800 text-stone-100 font-mono text-[11px] focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-stone-400 text-[11px]">角色简要描述</label>
                    <input
                      type="text"
                      value={currentCard.description}
                      onChange={(e) => handleUpdateCard(currentCard.id, { description: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-stone-900 border border-stone-800 text-stone-100 focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-stone-400 text-[11px]">
                      预设评价台词池（每行一条，翻开时 Agent 优先选用或参考）
                    </label>
                    <textarea
                      rows={3}
                      value={(currentCard.char_evaluation_pool || []).join('\n')}
                      onChange={(e) =>
                        handleUpdateCard(currentCard.id, {
                          char_evaluation_pool: e.target.value.split('\n').filter((l) => l.trim()),
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-stone-900 border border-stone-800 text-stone-100 focus:border-amber-500 focus:outline-none text-[11px]"
                      placeholder="哇！出了出了！\n手气真好～"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* TAB 3: BUTTON POSITIONING */}
          {activeTab === 'buttons' && (
            <div className="space-y-3">
              <div className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-400 text-[11px]">
                提示：可以在下方卡池底图上直接点击调整所选按钮的位置坐标（百分比坐标，自适应不同屏幕）。
              </div>

              {/* Visual Banner Canvas with Buttons */}
              <div
                className="relative w-full h-56 rounded-xl overflow-hidden border border-stone-800 bg-black cursor-crosshair"
                onClick={(e) => {
                  if (!selectedButtonId) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                  const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
                  handleUpdateBtnPos(selectedButtonId, x, y);
                }}
              >
                <img
                  src={config.banner_image}
                  alt="Banner"
                  className="w-full h-full object-cover pointer-events-none opacity-80"
                  referrerPolicy="no-referrer"
                />

                {/* Render All Buttons on Banner */}
                {config.buttons.map((btn) => {
                  const isSel = btn.id === selectedButtonId;
                  return (
                    <div
                      key={btn.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedButtonId(btn.id);
                      }}
                      style={{ left: `${btn.position.x}%`, top: `${btn.position.y}%` }}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-lg transition cursor-pointer border ${
                        isSel
                          ? 'bg-amber-500 text-stone-950 border-white ring-2 ring-amber-400 scale-110 z-20'
                          : 'bg-black/80 text-stone-200 border-white/20 hover:bg-stone-800 z-10'
                      }`}
                    >
                      {btn.label}
                    </div>
                  );
                })}
              </div>

              {/* Button list editor */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {config.buttons.map((btn) => {
                  const isSel = btn.id === selectedButtonId;
                  return (
                    <div
                      key={btn.id}
                      onClick={() => setSelectedButtonId(btn.id)}
                      className={`p-2.5 rounded-xl border flex flex-col gap-1 cursor-pointer transition ${
                        isSel
                          ? 'bg-amber-500/20 border-amber-500/60'
                          : 'bg-stone-950 border-stone-800 hover:bg-stone-900'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-stone-200">{btn.label}</span>
                        <span className="text-[10px] text-amber-400 font-mono">
                          X:{btn.position.x}% Y:{btn.position.y}%
                        </span>
                      </div>
                      <div className="text-[10px] text-stone-500">ID: {btn.id}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: VIRTUAL CURSOR CUSTOMIZER */}
          {activeTab === 'cursor' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-3">
                <span className="font-semibold text-stone-200 flex items-center gap-1.5">
                  <MousePointer className="size-3.5 text-amber-400" />
                  <span>Agent 虚拟光标样式选择</span>
                </span>

                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center">
                  {[
                    { style: 'default', label: '经典指针', icon: '↗' },
                    { style: 'pointer', label: '纤细手指', icon: '👆' },
                    { style: 'wand', label: '星光魔杖', icon: '🪄' },
                    { style: 'star', label: '闪耀金星', icon: '✨' },
                    { style: 'crosshair', label: '极简准星', icon: '✛' },
                  ].map((cur) => {
                    const isSel = (config.cursor?.style || 'default') === cur.style;
                    return (
                      <button
                        key={cur.style}
                        onClick={() =>
                          setConfig({
                            ...config,
                            cursor: { ...(config.cursor || DEFAULT_GACHA_POOL.cursor!), style: cur.style as any },
                          })
                        }
                        className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition cursor-pointer ${
                          isSel
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                            : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                        }`}
                      >
                        <span className="text-lg">{cur.icon}</span>
                        <span className="text-[10px] font-bold">{cur.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1">
                    <label className="text-stone-400 text-[11px]">光标尺寸 (px)</label>
                    <input
                      type="number"
                      min={16}
                      max={48}
                      value={config.cursor?.size || 24}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          cursor: {
                            ...(config.cursor || DEFAULT_GACHA_POOL.cursor!),
                            size: Math.max(16, Math.min(48, parseInt(e.target.value) || 24)),
                          },
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-stone-900 border border-stone-800 text-stone-100 font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-stone-400 text-[11px]">高光主色调</label>
                    <input
                      type="color"
                      value={config.cursor?.color || '#F59E0B'}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          cursor: {
                            ...(config.cursor || DEFAULT_GACHA_POOL.cursor!),
                            color: e.target.value,
                          },
                        })
                      }
                      className="w-full h-8 rounded-lg bg-stone-900 border border-stone-800 cursor-pointer p-0.5"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: JSON IMPORT / EXPORT */}
          {activeTab === 'json' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-stone-300 font-semibold">卡池配置 JSON 导入 / 导出</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportJson}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs transition cursor-pointer"
                  >
                    {copySuccess ? <Check className="size-3.5 text-emerald-400" /> : <Download className="size-3.5" />}
                    <span>{copySuccess ? '已复制到剪贴板' : '导出/复制 JSON'}</span>
                  </button>
                </div>
              </div>

              <textarea
                rows={10}
                value={jsonInput || JSON.stringify(config, null, 2)}
                onChange={(e) => setJsonInput(e.target.value)}
                className="w-full p-3 rounded-xl bg-stone-950 border border-stone-800 text-stone-300 font-mono text-[11px] focus:border-amber-500 focus:outline-none"
              />

              {importError && (
                <div className="p-2 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs">
                  {importError}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={handleResetToDefault}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 text-xs font-bold transition cursor-pointer"
                >
                  <RotateCcw className="size-3.5" />
                  <span>恢复初始卡池</span>
                </button>

                <button
                  onClick={handleApplyJsonImport}
                  className="flex items-center gap-1 px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold transition cursor-pointer"
                >
                  <Upload className="size-3.5" />
                  <span>应用文本框中的 JSON</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
