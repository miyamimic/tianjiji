import React, { useState, useRef } from 'react';
import {
  X,
  Plus,
  Trash2,
  Save,
  Download,
  Upload,
  RotateCcw,
  Sparkles,
  Move,
  Sliders,
  Layers,
  Image as ImageIcon,
  MousePointer,
  Check,
  AlertCircle
} from 'lucide-react';
import type { GachaPoolConfig, GachaCard, GachaButton } from '../../../lib/gachaTypes';

interface Props {
  initialConfig: GachaPoolConfig;
  onSave: (newConfig: GachaPoolConfig) => void;
  onClose: () => void;
}

export const GachaPoolEditorModal: React.FC<Props> = ({
  initialConfig,
  onSave,
  onClose,
}) => {
  const [config, setConfig] = useState<GachaPoolConfig>(() => JSON.parse(JSON.stringify(initialConfig)));
  const [activeTab, setActiveTab] = useState<'basic' | 'cards' | 'buttons' | 'cursor'>('basic');
  const [selectedButtonId, setSelectedButtonId] = useState<string | null>(config.buttons[0]?.id || null);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonImportRef = useRef<HTMLInputElement>(null);

  // Quick toast helper
  const showToast = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 2500);
  };

  // Card Handlers
  const handleAddCard = () => {
    const newCard: GachaCard = {
      id: `card_${Date.now()}`,
      name: '新卡牌',
      rarity: 'SSR',
      card_image: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?q=80&w=800&auto=format&fit=crop',
      description: '神秘异界的奇迹力量。',
      featured: false,
    };
    setConfig((prev) => ({
      ...prev,
      cards: [newCard, ...prev.cards],
    }));
  };

  const handleUpdateCard = (index: number, partial: Partial<GachaCard>) => {
    setConfig((prev) => {
      const nextCards = [...prev.cards];
      nextCards[index] = { ...nextCards[index], ...partial };
      return { ...prev, cards: nextCards };
    });
  };

  const handleDeleteCard = (index: number) => {
    if (config.cards.length <= 1) {
      showToast('至少保留一张卡牌');
      return;
    }
    setConfig((prev) => ({
      ...prev,
      cards: prev.cards.filter((_, i) => i !== index),
    }));
  };

  // Button Handlers
  const handleAddButton = () => {
    const newBtn: GachaButton = {
      id: `btn_${Date.now()}`,
      label: '新按钮',
      type: 'custom',
      pullCount: 1,
      position: { x: 0.5, y: 0.8 },
      styleVariant: 'primary',
    };
    setConfig((prev) => ({
      ...prev,
      buttons: [...prev.buttons, newBtn],
    }));
    setSelectedButtonId(newBtn.id);
  };

  const handleUpdateButton = (id: string, partial: Partial<GachaButton>) => {
    setConfig((prev) => ({
      ...prev,
      buttons: prev.buttons.map((b) => (b.id === id ? { ...b, ...partial } : b)),
    }));
  };

  const handleDeleteButton = (id: string) => {
    if (config.buttons.length <= 1) {
      showToast('至少保留一个操作按钮');
      return;
    }
    setConfig((prev) => ({
      ...prev,
      buttons: prev.buttons.filter((b) => b.id !== id),
    }));
    if (selectedButtonId === id) {
      setSelectedButtonId(config.buttons.find((b) => b.id !== id)?.id || null);
    }
  };

  // Banner canvas click to set button coordinate
  const handleBannerCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedButtonId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0.05, Math.min(0.95, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0.05, Math.min(0.95, (e.clientY - rect.top) / rect.height));

    handleUpdateButton(selectedButtonId, {
      position: { x: +x.toFixed(3), y: +y.toFixed(3) },
    });
  };

  // JSON Export & Import
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(config, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `gacha_pool_${config.pool_id || 'config'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('卡池配置 JSON 已导出');
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json && typeof json.pool_name === 'string' && Array.isArray(json.cards)) {
          setConfig(json);
          showToast('卡池配置 JSON 导入成功');
        } else {
          showToast('JSON 格式无效，缺少核心字段');
        }
      } catch (err) {
        showToast('解析 JSON 失败');
      }
    };
    reader.readAsText(file);
  };

  // Save handler
  const handleSaveAll = () => {
    onSave(config);
    showToast('卡池配置已保存');
    setTimeout(() => onClose(), 600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-2 sm:p-4 text-white select-none">
      <div className="bg-stone-900 border border-white/15 rounded-2xl max-w-xl w-full h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-stone-950/80 shrink-0">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">卡池与光标可视化编辑器</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJson}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs flex items-center gap-1"
              title="导出配置 JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">导出</span>
            </button>
            <label
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs flex items-center gap-1 cursor-pointer"
              title="导入配置 JSON"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">导入</span>
              <input
                ref={jsonImportRef}
                type="file"
                accept=".json"
                onChange={handleImportJson}
                className="hidden"
              />
            </label>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-white/10 bg-stone-950/40 text-xs shrink-0 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('basic')}
            className={`px-3 py-1.5 rounded-xl font-medium transition ${
              activeTab === 'basic' ? 'bg-amber-500 text-stone-950 font-bold' : 'text-stone-400 hover:text-white'
            }`}
          >
            卡池与概率
          </button>
          <button
            onClick={() => setActiveTab('cards')}
            className={`px-3 py-1.5 rounded-xl font-medium transition ${
              activeTab === 'cards' ? 'bg-amber-500 text-stone-950 font-bold' : 'text-stone-400 hover:text-white'
            }`}
          >
            卡牌图鉴 ({config.cards.length})
          </button>
          <button
            onClick={() => setActiveTab('buttons')}
            className={`px-3 py-1.5 rounded-xl font-medium transition ${
              activeTab === 'buttons' ? 'bg-amber-500 text-stone-950 font-bold' : 'text-stone-400 hover:text-white'
            }`}
          >
            按钮与画布坐标
          </button>
          <button
            onClick={() => setActiveTab('cursor')}
            className={`px-3 py-1.5 rounded-xl font-medium transition ${
              activeTab === 'cursor' ? 'bg-amber-500 text-stone-950 font-bold' : 'text-stone-400 hover:text-white'
            }`}
          >
            虚拟光标样式
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* TAB 1: BASIC & RATES */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-stone-400">卡池名称</label>
                <input
                  type="text"
                  value={config.pool_name}
                  onChange={(e) => setConfig({ ...config, pool_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-white/10 text-white font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-stone-400">Banner 底图 URL</label>
                <input
                  type="text"
                  value={config.banner_image}
                  onChange={(e) => setConfig({ ...config, banner_image: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-white/10 text-white text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-stone-400">Frame 边框 Overlay URL（可选）</label>
                <input
                  type="text"
                  value={config.frame_overlay || ''}
                  onChange={(e) => setConfig({ ...config, frame_overlay: e.target.value })}
                  placeholder="可留空"
                  className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-white/10 text-white text-xs font-mono"
                />
              </div>

              {/* Spark Config */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-400/30 space-y-3">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>保底机制（井计数设置）</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-stone-400 text-[11px]">保底所需抽数（井计数）</label>
                    <input
                      type="number"
                      min={10}
                      max={300}
                      value={config.spark_count}
                      onChange={(e) => setConfig({ ...config, spark_count: parseInt(e.target.value, 10) || 80 })}
                      className="w-full px-3 py-1.5 rounded-xl bg-stone-950 border border-white/10 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-stone-400 text-[11px]">保底奖励卡牌 ID</label>
                    <select
                      value={config.spark_reward.card_id}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          spark_reward: { ...config.spark_reward, card_id: e.target.value },
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-xl bg-stone-950 border border-white/10 text-white"
                    >
                      {config.cards.map((c) => (
                        <option key={c.id} value={c.id}>
                          [{c.rarity}] {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-stone-400 text-[11px]">保底兑换说明文案</label>
                  <input
                    type="text"
                    value={config.spark_reward.description}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        spark_reward: { ...config.spark_reward, description: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-xl bg-stone-950 border border-white/10 text-white"
                  />
                </div>
              </div>

              {/* Rates Sliders */}
              <div className="p-3 rounded-xl bg-stone-950 border border-white/10 space-y-2.5">
                <span className="font-bold text-stone-200">掉落概率（权重设置）</span>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-amber-400 font-bold">SSR 概率</span>
                      <span className="font-mono">{(config.rates.SSR * 100).toFixed(2)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.005"
                      max="0.2"
                      step="0.001"
                      value={config.rates.SSR}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        const sr = config.rates.SR;
                        setConfig({
                          ...config,
                          rates: { SSR: val, SR: sr, R: Math.max(0, +(1 - val - sr).toFixed(4)) },
                        });
                      }}
                      className="w-full accent-amber-400"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-purple-400 font-bold">SR 概率</span>
                      <span className="font-mono">{(config.rates.SR * 100).toFixed(2)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.02"
                      max="0.5"
                      step="0.005"
                      value={config.rates.SR}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        const ssr = config.rates.SSR;
                        setConfig({
                          ...config,
                          rates: { SSR: ssr, SR: val, R: Math.max(0, +(1 - ssr - val).toFixed(4)) },
                        });
                      }}
                      className="w-full accent-purple-400"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1 text-stone-400">
                      <span>R 概率（自动补足）</span>
                      <span className="font-mono">{(config.rates.R * 100).toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CARDS CATALOG */}
          {activeTab === 'cards' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-stone-400 text-xs">卡牌列表（由 LLM 现场独立生成每次评价）</span>
                <button
                  onClick={handleAddCard}
                  className="px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>添加卡牌</span>
                </button>
              </div>

              <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
                {config.cards.map((card, idx) => (
                  <div
                    key={card.id}
                    className="p-2.5 rounded-xl bg-stone-950 border border-white/10 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <select
                          value={card.rarity}
                          onChange={(e) => handleUpdateCard(idx, { rarity: e.target.value as any })}
                          className={`px-2 py-1 rounded-lg text-xs font-mono font-bold ${
                            card.rarity === 'SSR'
                              ? 'bg-amber-400 text-stone-950'
                              : card.rarity === 'SR'
                              ? 'bg-purple-400 text-stone-950'
                              : 'bg-stone-700 text-white'
                          }`}
                        >
                          <option value="SSR">SSR</option>
                          <option value="SR">SR</option>
                          <option value="R">R</option>
                        </select>
                        <input
                          type="text"
                          value={card.name}
                          onChange={(e) => handleUpdateCard(idx, { name: e.target.value })}
                          className="flex-1 px-2.5 py-1 rounded-lg bg-stone-900 border border-white/10 text-white font-bold text-xs"
                          placeholder="卡牌名称"
                        />
                      </div>
                      <label className="flex items-center gap-1 text-[11px] text-stone-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!card.featured}
                          onChange={(e) => handleUpdateCard(idx, { featured: e.target.checked })}
                          className="rounded accent-amber-500"
                        />
                        <span>UP</span>
                      </label>
                      <button
                        onClick={() => handleDeleteCard(idx)}
                        className="p-1 rounded-lg text-rose-400 hover:bg-rose-500/20"
                        title="删除卡牌"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={card.card_image}
                        onChange={(e) => handleUpdateCard(idx, { card_image: e.target.value })}
                        className="px-2 py-1 rounded-lg bg-stone-900 border border-white/10 text-white text-[11px] font-mono"
                        placeholder="卡牌立绘图片 URL"
                      />
                      <input
                        type="text"
                        value={card.description}
                        onChange={(e) => handleUpdateCard(idx, { description: e.target.value })}
                        className="px-2 py-1 rounded-lg bg-stone-900 border border-white/10 text-white text-[11px]"
                        placeholder="卡牌背景描述（用于LLM评价）"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: BUTTONS & DRAG CANVAS */}
          {activeTab === 'buttons' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-stone-400 text-xs">
                  点击底图预览区域即可将选中按钮设定在对应坐标 (X, Y)
                </span>
                <button
                  onClick={handleAddButton}
                  className="px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>添加按钮</span>
                </button>
              </div>

              {/* Interactive Banner Canvas Preview */}
              <div
                onClick={handleBannerCanvasClick}
                className="relative w-full h-48 sm:h-56 rounded-2xl bg-black overflow-hidden border border-white/20 cursor-crosshair shadow-inner"
              >
                <img
                  src={config.banner_image}
                  alt="Banner preview"
                  className="w-full h-full object-cover opacity-80 pointer-events-none"
                />
                <div className="absolute inset-0 bg-black/30 pointer-events-none" />

                {/* Render All Buttons on the Canvas */}
                {config.buttons.map((btn) => {
                  const isSelected = btn.id === selectedButtonId;
                  return (
                    <div
                      key={btn.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedButtonId(btn.id);
                      }}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 px-2.5 py-1 rounded-xl text-[10px] font-bold shadow-lg transition-transform cursor-pointer ${
                        isSelected
                          ? 'bg-amber-400 text-stone-950 ring-2 ring-white scale-110 z-20'
                          : 'bg-stone-900/90 text-stone-200 border border-white/30 z-10'
                      }`}
                      style={{
                        left: `${btn.position.x * 100}%`,
                        top: `${btn.position.y * 100}%`,
                      }}
                    >
                      <span>{btn.label}</span>
                    </div>
                  );
                })}
              </div>

              {/* Button Configurations List */}
              <div className="space-y-2">
                {config.buttons.map((btn) => {
                  const isSelected = btn.id === selectedButtonId;
                  return (
                    <div
                      key={btn.id}
                      onClick={() => setSelectedButtonId(btn.id)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-400'
                          : 'bg-stone-950 border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={btn.label}
                          onChange={(e) => handleUpdateButton(btn.id, { label: e.target.value })}
                          className="px-2 py-1 rounded-lg bg-stone-900 border border-white/10 text-white font-bold text-xs flex-1"
                        />
                        <select
                          value={btn.type}
                          onChange={(e) =>
                            handleUpdateButton(btn.id, {
                              type: e.target.value as any,
                              pullCount: e.target.value === 'pull_ten' ? 10 : 1,
                            })
                          }
                          className="px-2 py-1 rounded-lg bg-stone-900 border border-white/10 text-white text-xs"
                        >
                          <option value="pull_single">单抽 (1抽)</option>
                          <option value="pull_ten">十连抽 (10抽)</option>
                          <option value="details">卡池详情</option>
                          <option value="history">抽卡记录</option>
                          <option value="custom">自定义动作</option>
                        </select>
                        <div className="text-[10.5px] font-mono text-stone-400">
                          ({btn.position.x}, {btn.position.y})
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteButton(btn.id);
                          }}
                          className="p-1 text-rose-400 hover:bg-rose-500/20 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: CURSOR STYLE */}
          {activeTab === 'cursor' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-stone-950 border border-white/10 space-y-3">
                <span className="font-bold text-stone-200">虚拟光标样式定义</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-stone-400 text-[11px]">指针图案</label>
                    <select
                      value={config.cursor_style?.type || 'arrow'}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          cursor_style: {
                            ...config.cursor_style,
                            type: e.target.value as any,
                            color: config.cursor_style?.color || '#F59E0B',
                            size: config.cursor_style?.size || 24,
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-white/10 text-white"
                    >
                      <option value="arrow">箭头 (默认系统指针)</option>
                      <option value="wand">法杖 (星芒环绕)</option>
                      <option value="paw">猫爪 (肉球微光)</option>
                      <option value="feather">羽毛 (轻灵笔锋)</option>
                      <option value="star">群星 (闪烁金星)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-stone-400 text-[11px]">指针主色调</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="color"
                        value={config.cursor_style?.color || '#F59E0B'}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            cursor_style: {
                              ...config.cursor_style,
                              type: config.cursor_style?.type || 'arrow',
                              color: e.target.value,
                              size: config.cursor_style?.size || 24,
                            },
                          })
                        }
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                      />
                      <span className="text-xs font-mono text-stone-300">
                        {config.cursor_style?.color || '#F59E0B'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="px-4 py-3 border-t border-white/10 bg-stone-950/90 flex items-center justify-between shrink-0">
          {saveToast ? (
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              <span>{saveToast}</span>
            </span>
          ) : (
            <span className="text-[11px] text-stone-500">配置持久化存储于 localStorage</span>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold"
            >
              取消
            </button>
            <button
              onClick={handleSaveAll}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 text-xs font-bold shadow-lg flex items-center gap-1 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>保存配置</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
