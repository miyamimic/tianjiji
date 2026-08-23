import { useState, useEffect, useMemo } from 'react';
import { 
  ShieldAlert, 
  Plus, 
  Trash2, 
  Check, 
  RotateCcw, 
  Sparkles, 
  ShieldCheck, 
  Search, 
  SlidersHorizontal,
  Flame,
  Heart,
  Ban,
  Tag
} from 'lucide-react';
import { 
  loadSensitiveWords, 
  saveSensitiveWords, 
  DEFAULT_SENSITIVE_WORDS, 
  PRESET_INTENT_CATEGORIES,
  PRESET_INTERCEPTION_CATEGORIES,
  getRuleScope,
  type SensitiveWordRule, 
  type DictionaryScope 
} from '../../lib/customStore';
import { EMOTION_NAMES, type EmotionKey } from '../../data/types';

export default function DictionaryApp() {
  const [rules, setRules] = useState<SensitiveWordRule[]>([]);
  const [activeTab, setActiveTab] = useState<DictionaryScope>('intent_analysis');
  
  // Form State
  const [newWord, setNewWord] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(PRESET_INTENT_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  
  const [newAction, setNewAction] = useState<'censor' | 'block' | 'emotion'>('emotion');
  const [newEmotionKey, setNewEmotionKey] = useState<EmotionKey>('warmth');
  const [newEmotionDelta, setNewEmotionDelta] = useState(0.4);
  const [saved, setSaved] = useState(false);
  const [savedText, setSavedText] = useState('已保存设置');

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  useEffect(() => {
    setRules(loadSensitiveWords());
  }, []);

  // When switching tabs, auto-set default category & action
  const handleTabChange = (tab: DictionaryScope) => {
    setActiveTab(tab);
    if (tab === 'intent_analysis') {
      setSelectedCategory(PRESET_INTENT_CATEGORIES[0]);
      setNewAction('emotion');
      setNewEmotionKey('warmth');
    } else {
      setSelectedCategory(PRESET_INTERCEPTION_CATEGORIES[0]);
      setNewAction('censor');
    }
    setIsCustomCategory(false);
    setCustomCategory('');
    setFilterCategory('all');
  };

  const currentPresetCategories = activeTab === 'intent_analysis'
    ? PRESET_INTENT_CATEGORIES
    : PRESET_INTERCEPTION_CATEGORIES;

  const handleSelectCategory = (cat: string) => {
    if (cat === '__custom__') {
      setIsCustomCategory(true);
    } else {
      setIsCustomCategory(false);
      setSelectedCategory(cat);
    }
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.trim()) return;

    const finalCategory = isCustomCategory ? (customCategory.trim() || '自定义分类') : selectedCategory;

    // Check duplicate in current scope
    if (rules.some((r) => getRuleScope(r) === activeTab && r.word.toLowerCase() === newWord.trim().toLowerCase())) {
      alert(`「${newWord.trim()}」在该模块中已存在！`);
      return;
    }

    const newRule: SensitiveWordRule = {
      id: `${activeTab === 'intent_analysis' ? 'intent' : 'sec'}_${Date.now()}`,
      scope: activeTab,
      word: newWord.trim(),
      category: finalCategory,
      action: newAction,
      emotionKey: newAction === 'emotion' ? newEmotionKey : undefined,
      emotionDelta: newAction === 'emotion' ? newEmotionDelta : undefined,
      enabled: true,
    };

    const updated = [newRule, ...rules];
    setRules(updated);
    saveSensitiveWords(updated);
    setNewWord('');
    if (isCustomCategory) {
      setCustomCategory('');
      setIsCustomCategory(false);
    }
    setSavedText('已添加新规则');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDeleteRule = (id: string) => {
    const updated = rules.filter((r) => r.id !== id);
    setRules(updated);
    saveSensitiveWords(updated);
  };

  const handleToggleRule = (id: string) => {
    const updated = rules.map((r) => (r.id === id ? { ...r, enabled: r.enabled === false } : r));
    setRules(updated);
    saveSensitiveWords(updated);
  };

  const handleResetDefaults = () => {
    if (confirm('确定恢复出厂预设词典吗？将同时重置意图分析与敏感拦截词条。')) {
      setRules(DEFAULT_SENSITIVE_WORDS);
      saveSensitiveWords(DEFAULT_SENSITIVE_WORDS);
      setSavedText('已恢复出厂词典');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  // Filter rules for current tab
  const currentTabRules = useMemo(() => {
    return rules.filter((r) => {
      const scope = getRuleScope(r);
      if (scope !== activeTab) return false;
      if (filterCategory !== 'all' && r.category !== filterCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return r.word.toLowerCase().includes(q) || r.category.toLowerCase().includes(q);
      }
      return true;
    });
  }, [rules, activeTab, filterCategory, searchQuery]);

  const allCategoriesInCurrentTab = useMemo(() => {
    const set = new Set<string>();
    for (const r of rules) {
      if (getRuleScope(r) === activeTab) {
        set.add(r.category);
      }
    }
    return Array.from(set);
  }, [rules, activeTab]);

  return (
    <div className="space-y-3.5 text-xs text-stone-100 pb-8 select-none font-sans">
      {/* 1. Top Scope Tab Switcher */}
      <div className="p-1 rounded-2xl bg-stone-900 border border-stone-800 flex gap-1 shadow-inner">
        <button
          type="button"
          onClick={() => handleTabChange('intent_analysis')}
          className={`flex-1 py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'intent_analysis'
              ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-stone-950 shadow-md shadow-amber-500/20'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>🎯 NLP 意图分析 (面对主控)</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('sensitive_interception')}
          className={`flex-1 py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'sensitive_interception'
              ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-md shadow-rose-500/20'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>🛡️ 敏感拦截防御 (针对 AI)</span>
        </button>
      </div>

      {/* Scope Explanation Header */}
      <div className="px-3 py-2 rounded-xl bg-stone-900/60 border border-stone-800/80 text-[11px] text-stone-400 leading-relaxed">
        {activeTab === 'intent_analysis' ? (
          <p className="flex items-center gap-1 text-amber-300/90 font-medium">
            <span>💡 <b>面对主控输入</b>：实时感知并捕获玩家的调情、撒娇、施压、窥探等心理意图，激化角色对应情绪波动与微反应。</span>
          </p>
        ) : (
          <p className="flex items-center gap-1 text-rose-300/90 font-medium">
            <span>🛡️ <b>针对 AI 防御</b>：在 LLM 大模型生成前实施前置高精度安全过滤，杜绝粗俗秽语、人身攻击与破防越狱指令。</span>
          </p>
        )}
      </div>

      {/* 2. Add Rule Card */}
      <form onSubmit={handleAddRule} className="p-3.5 rounded-2xl border border-stone-800 bg-stone-900/80 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-bold text-stone-100 flex items-center gap-1.5 text-xs">
            <Plus className={`w-4 h-4 ${activeTab === 'intent_analysis' ? 'text-amber-400' : 'text-rose-400'}`} />
            {activeTab === 'intent_analysis' ? '新增主控意图识别词条' : '新增 AI 敏感拦截防御词条'}
          </span>
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1 text-[10px] text-stone-400 hover:text-amber-300 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            恢复默认预设
          </button>
        </div>

        {/* Input word */}
        <div>
          <label className="text-[10px] text-stone-400 font-medium block mb-1">
            {activeTab === 'intent_analysis' ? '意图关键词 / 短语' : '敏感违规词 / 越狱指令'}
          </label>
          <input
            type="text"
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            placeholder={activeTab === 'intent_analysis' ? '例如：抱抱我、喜欢你、真没用、辛苦了' : '例如：傻逼、操你、忽略所有设定'}
            className="w-full px-3 py-2 rounded-xl border border-stone-700 bg-stone-950 text-stone-100 focus:outline-none focus:border-amber-500 text-xs shadow-inner"
            required
          />
        </div>

        {/* Category Autonomous Selector (预设分类自主选择) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] text-stone-400 font-medium flex items-center gap-1">
              <Tag className="w-3 h-3 text-amber-400" />
              <span>分类标签（支持点击自主选择或自定义）</span>
            </label>
            <button
              type="button"
              onClick={() => setIsCustomCategory(!isCustomCategory)}
              className="text-[10px] text-amber-400 hover:underline"
            >
              {isCustomCategory ? '← 选择预设分类' : '+ 输入自定义分类'}
            </button>
          </div>

          {!isCustomCategory ? (
            <div className="space-y-2">
              {/* Preset Chips */}
              <div className="flex flex-wrap gap-1.5">
                {currentPresetCategories.map((cat) => {
                  const isSelected = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleSelectCategory(cat)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                        isSelected
                          ? activeTab === 'intent_analysis'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/60 font-bold shadow-sm'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/60 font-bold shadow-sm'
                          : 'bg-stone-800/80 text-stone-300 hover:bg-stone-700 border border-stone-700/60'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>

              {/* Select Dropdown */}
              <select
                value={selectedCategory}
                onChange={(e) => handleSelectCategory(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-stone-700 bg-stone-950 text-stone-200 text-xs focus:outline-none"
              >
                {currentPresetCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    📁 {cat}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <input
              type="text"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="输入新的自定义分类名称（例如：私人暗号、特定梗）"
              className="w-full px-3 py-2 rounded-xl border border-amber-500/50 bg-stone-950 text-stone-100 focus:outline-none text-xs"
            />
          )}
        </div>

        {/* Action Trigger Selector */}
        <div>
          <label className="text-[10px] text-stone-400 font-medium block mb-1">
            {activeTab === 'intent_analysis' ? '感知触发反应机制' : '安全拦截执行动作'}
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {activeTab === 'intent_analysis' ? (
              <>
                <button
                  type="button"
                  onClick={() => setNewAction('emotion')}
                  className={`py-2 px-1 rounded-xl text-[11px] font-bold border transition-all flex items-center justify-center gap-1 ${
                    newAction === 'emotion'
                      ? 'border-amber-400 bg-amber-500/20 text-amber-300 shadow'
                      : 'border-stone-800 bg-stone-950 text-stone-400'
                  }`}
                >
                  <Flame className="w-3 h-3 text-amber-400" />
                  <span>激化情绪波动</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewAction('censor')}
                  className={`py-2 px-1 rounded-xl text-[11px] font-bold border transition-all flex items-center justify-center gap-1 ${
                    newAction === 'censor'
                      ? 'border-stone-400 bg-stone-700/40 text-stone-200 shadow'
                      : 'border-stone-800 bg-stone-950 text-stone-400'
                  }`}
                >
                  <span>*** 字符脱敏</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewAction('block')}
                  className={`py-2 px-1 rounded-xl text-[11px] font-bold border transition-all flex items-center justify-center gap-1 ${
                    newAction === 'block'
                      ? 'border-rose-500 bg-rose-500/20 text-rose-300 shadow'
                      : 'border-stone-800 bg-stone-950 text-stone-400'
                  }`}
                >
                  <Ban className="w-3 h-3 text-rose-400" />
                  <span>拒发警示</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setNewAction('censor')}
                  className={`py-2 px-1 rounded-xl text-[11px] font-bold border transition-all flex items-center justify-center gap-1 ${
                    newAction === 'censor'
                      ? 'border-amber-400 bg-amber-500/20 text-amber-300 shadow'
                      : 'border-stone-800 bg-stone-950 text-stone-400'
                  }`}
                >
                  <span>*** 字符打码</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewAction('block')}
                  className={`py-2 px-1 rounded-xl text-[11px] font-bold border transition-all flex items-center justify-center gap-1 ${
                    newAction === 'block'
                      ? 'border-rose-500 bg-rose-500/20 text-rose-300 shadow'
                      : 'border-stone-800 bg-stone-950 text-stone-400'
                  }`}
                >
                  <Ban className="w-3 h-3 text-rose-400" />
                  <span>🚫 强力拦截拒发</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewAction('emotion')}
                  className={`py-2 px-1 rounded-xl text-[11px] font-bold border transition-all flex items-center justify-center gap-1 ${
                    newAction === 'emotion'
                      ? 'border-purple-400 bg-purple-500/20 text-purple-300 shadow'
                      : 'border-stone-800 bg-stone-950 text-stone-400'
                  }`}
                >
                  <Flame className="w-3 h-3 text-purple-400" />
                  <span>触怒惩罚</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Emotion key & delta picker if emotion action */}
        {newAction === 'emotion' && (
          <div className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-stone-400 block mb-1">触动情感维度</label>
                <select
                  value={newEmotionKey}
                  onChange={(e) => setNewEmotionKey(e.target.value as EmotionKey)}
                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-stone-700 bg-stone-900 text-stone-100 focus:outline-none"
                >
                  {Object.entries(EMOTION_NAMES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v} ({k})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center text-[10px] text-stone-400 mb-1">
                  <span>情感偏移增幅</span>
                  <span className="text-amber-400 font-bold font-mono">+{Math.round(newEmotionDelta * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.1"
                  value={newEmotionDelta}
                  onChange={(e) => setNewEmotionDelta(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 h-1.5 bg-stone-800 rounded-lg cursor-pointer mt-2"
                />
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={!newWord.trim()}
          className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 shadow-md ${
            activeTab === 'intent_analysis'
              ? 'bg-amber-500 hover:bg-amber-400 text-stone-950'
              : 'bg-rose-600 hover:bg-rose-500 text-white'
          }`}
        >
          {saved ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{saved ? savedText : activeTab === 'intent_analysis' ? '添加至意图分析词库' : '添加至敏感防御规则库'}</span>
        </button>
      </form>

      {/* 3. Search & Filter Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索当前模块词汇或分类..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-stone-800 bg-stone-900 text-stone-200 text-xs focus:outline-none focus:border-stone-600"
          />
        </div>

        {allCategoriesInCurrentTab.length > 0 && (
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-2 py-1.5 rounded-xl border border-stone-800 bg-stone-900 text-stone-300 text-xs focus:outline-none"
          >
            <option value="all">全部分类 ({allCategoriesInCurrentTab.length})</option>
            {allCategoriesInCurrentTab.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* 4. Rules List Card */}
      <div className="p-3.5 rounded-2xl border border-stone-800 bg-stone-900/80 shadow space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-stone-200">
          <span className="flex items-center gap-1.5">
            {activeTab === 'intent_analysis' ? (
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            )}
            {activeTab === 'intent_analysis' ? '已配置意图分析规则' : '已配置敏感拦截防御规则'} ({currentTabRules.length})
          </span>
        </div>

        {currentTabRules.length === 0 ? (
          <div className="py-6 text-center text-xs text-stone-500 leading-relaxed">
            {searchQuery || filterCategory !== 'all' ? '未找到符合条件的规则项' : '当前模块词库暂无规则，可点击上方添加'}
          </div>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {currentTabRules.map((rule) => {
              const isEnabled = rule.enabled !== false;
              return (
                <div
                  key={rule.id}
                  className={`flex items-center justify-between p-2 rounded-xl border transition-all text-xs ${
                    isEnabled
                      ? 'border-stone-800 bg-stone-950/80'
                      : 'border-stone-800/40 bg-stone-950/30 opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0 pr-2">
                    <span className="font-bold text-stone-100 truncate">{rule.word}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700">
                      {rule.category}
                    </span>

                    {rule.action === 'block' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold">
                        🚫 拦截拒发
                      </span>
                    )}
                    {rule.action === 'censor' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                        *** 打码脱敏
                      </span>
                    )}
                    {rule.action === 'emotion' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold flex items-center gap-0.5">
                        <Flame className="w-2.5 h-2.5" />
                        {EMOTION_NAMES[rule.emotionKey || 'warmth']} +{Math.round((rule.emotionDelta || 0.4) * 100)}%
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleRule(rule.id)}
                      className={`text-[10px] px-2 py-0.5 rounded-lg border transition-colors ${
                        isEnabled
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                          : 'bg-stone-800 text-stone-400 border-stone-700 hover:bg-stone-700'
                      }`}
                    >
                      {isEnabled ? '启用中' : '已禁用'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-1 rounded-lg text-stone-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="删除规则"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
