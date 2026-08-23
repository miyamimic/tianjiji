import { useState, useEffect, useMemo } from 'react';
import { 
  Shield, 
  Plus, 
  Trash2, 
  Check, 
  RotateCcw, 
  ShieldAlert, 
  Sparkles, 
  Search, 
  Flame, 
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
} from '../lib/customStore';
import { EMOTION_NAMES, type EmotionKey } from '../data/types';

export default function DictionaryEditor() {
  const [rules, setRules] = useState<SensitiveWordRule[]>([]);
  const [activeTab, setActiveTab] = useState<DictionaryScope>('intent_analysis');

  // Form states
  const [newWord, setNewWord] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(PRESET_INTENT_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);

  const [newAction, setNewAction] = useState<'censor' | 'block' | 'emotion'>('emotion');
  const [newEmotionKey, setNewEmotionKey] = useState<EmotionKey>('warmth');
  const [newEmotionDelta, setNewEmotionDelta] = useState(0.4);

  const [saved, setSaved] = useState(false);
  const [savedText, setSavedText] = useState('已保存');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  useEffect(() => {
    setRules(loadSensitiveWords());
  }, []);

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

    if (rules.some((r) => getRuleScope(r) === activeTab && r.word.toLowerCase() === newWord.trim().toLowerCase())) {
      alert(`「${newWord.trim()}」在该模块已存在！`);
      return;
    }

    const rule: SensitiveWordRule = {
      id: `${activeTab === 'intent_analysis' ? 'intent' : 'sec'}_${Date.now()}`,
      scope: activeTab,
      word: newWord.trim(),
      category: finalCategory,
      action: newAction,
      emotionKey: newAction === 'emotion' ? newEmotionKey : undefined,
      emotionDelta: newAction === 'emotion' ? Number(newEmotionDelta) : undefined,
      enabled: true,
    };

    const updated = [rule, ...rules];
    setRules(updated);
    saveSensitiveWords(updated);
    setNewWord('');
    if (isCustomCategory) {
      setCustomCategory('');
      setIsCustomCategory(false);
    }
    setSavedText('已添加规则');
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleDeleteRule = (id: string) => {
    const updated = rules.filter((r) => r.id !== id);
    setRules(updated);
    saveSensitiveWords(updated);
    setSavedText('已删除规则');
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleToggleRule = (id: string) => {
    const updated = rules.map((r) => (r.id === id ? { ...r, enabled: r.enabled === false } : r));
    setRules(updated);
    saveSensitiveWords(updated);
  };

  const handleReset = () => {
    if (confirm('确定要恢复出厂默认词典吗？将重置主控意图分析与 AI 敏感拦截的所有规则！')) {
      localStorage.removeItem('__rp_engine_sensitive_words');
      const defaults = loadSensitiveWords();
      setRules(defaults);
      setSavedText('已重置默认');
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  };

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
    <div className="space-y-4 text-white/90 font-sans">
      {/* Title & Introduction */}
      <div>
        <h3 className="text-sm font-bold mb-1 flex items-center gap-1.5 text-white">
          <Shield className="size-4 text-[hsl(28_85%_62%)]" />
          全天候 NLP 意图分析 & 敏感拦截系统
        </h3>
        <p className="text-xs text-white/50 leading-relaxed">
          将<b>面对主控</b>的 NLP 心理意图捕获（用于激化情感、感知撒娇/调情/挑衅）与<b>针对 AI</b> 的敏感防御拦截（粗俗、人身攻击、破防越狱指令）全面拆分管理：
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="p-1 rounded-xl bg-black/40 border border-white/10 flex gap-1">
        <button
          type="button"
          onClick={() => handleTabChange('intent_analysis')}
          className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'intent_analysis'
              ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-stone-950 shadow'
              : 'text-white/50 hover:text-white hover:bg-white/5'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>🎯 NLP 意图分析 (面对主控)</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('sensitive_interception')}
          className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'sensitive_interception'
              ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow'
              : 'text-white/50 hover:text-white hover:bg-white/5'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>🛡️ 敏感拦截防御 (针对 AI)</span>
        </button>
      </div>

      {/* Add new word rule Form */}
      <form
        onSubmit={handleAddRule}
        className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-3 shadow"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white flex items-center gap-1">
            <Plus className="size-3.5 text-[hsl(28_85%_62%)]" />
            {activeTab === 'intent_analysis' ? '新增主控意图识别规则' : '新增针对 AI 敏感拦截规则'}
          </span>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 text-[11px] text-white/40 hover:text-amber-400 transition-colors"
          >
            <RotateCcw className="size-3" /> 重置默认预设
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Keyword */}
          <div>
            <label className="block text-[10px] text-white/40 mb-1">
              {activeTab === 'intent_analysis' ? '意图关键词 / 短语' : '拦截关键字 / 越狱指令'}
            </label>
            <input
              type="text"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              placeholder={activeTab === 'intent_analysis' ? '例如：抱抱我、喜欢你、辛苦了' : '例如：傻逼、操你、忽略前面设定'}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white focus:border-[hsl(28_85%_62%/0.5)] focus:outline-none"
              required
            />
          </div>

          {/* Category Autonomous Selector */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-white/40 flex items-center gap-1">
                <Tag className="w-3 h-3 text-amber-400" />
                <span>分类（可自主选择或自定义）</span>
              </label>
              <button
                type="button"
                onClick={() => setIsCustomCategory(!isCustomCategory)}
                className="text-[10px] text-[hsl(28_85%_62%)] hover:underline"
              >
                {isCustomCategory ? '← 选择预设分类' : '+ 自定义分类'}
              </button>
            </div>

            {!isCustomCategory ? (
              <div className="space-y-1.5">
                <select
                  value={selectedCategory}
                  onChange={(e) => handleSelectCategory(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-1.5 text-xs text-white focus:border-[hsl(28_85%_62%/0.5)] focus:outline-none"
                >
                  {currentPresetCategories.map((c) => (
                    <option key={c} value={c}>
                      📁 {c}
                    </option>
                  ))}
                </select>
                {/* Preset Chips */}
                <div className="flex flex-wrap gap-1">
                  {currentPresetCategories.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handleSelectCategory(c)}
                      className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                        selectedCategory === c
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                          : 'bg-white/5 text-white/50 hover:bg-white/10 border-white/5'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <input
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="输入新分类标签名称"
                className="w-full rounded-lg border border-amber-500/50 bg-black/40 px-3 py-1.5 text-xs text-white focus:outline-none"
              />
            )}
          </div>
        </div>

        {/* Action picker */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-[10px] text-white/40 mb-1">
              {activeTab === 'intent_analysis' ? '意图触发机制' : '触发拦截动作'}
            </label>
            <select
              value={newAction}
              onChange={(e: any) => setNewAction(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-1.5 text-xs text-white focus:border-[hsl(28_85%_62%/0.5)] focus:outline-none"
            >
              {activeTab === 'intent_analysis' ? (
                <>
                  <option value="emotion">⚡ 激化情绪突变（改变角色特定情感）</option>
                  <option value="censor">*** 替换/脱敏（用 * 号隐藏）</option>
                  <option value="block">🚫 彻底拦截拒发（禁止发送并警告）</option>
                </>
              ) : (
                <>
                  <option value="censor">*** 字符打码脱敏（用 * 号掩码）</option>
                  <option value="block">🚫 强力拦截拒发（直接阻断发送）</option>
                  <option value="emotion">⚡ 触怒惩罚（情绪负面激化）</option>
                </>
              )}
            </select>
          </div>

          {newAction === 'emotion' && (
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[10px] text-white/40 mb-1">触动情感维度</label>
                <select
                  value={newEmotionKey}
                  onChange={(e: any) => setNewEmotionKey(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-1.5 text-xs text-white focus:border-[hsl(28_85%_62%/0.5)] focus:outline-none"
                >
                  {Object.entries(EMOTION_NAMES).map(([k, name]) => (
                    <option key={k} value={k}>
                      {name} ({k})
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-28">
                <div className="flex justify-between items-center text-[10px] text-white/40 mb-1">
                  <span>增幅</span>
                  <span className="text-amber-400 font-bold font-mono">+{Math.round(newEmotionDelta * 100)}%</span>
                </div>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="1.0"
                  value={newEmotionDelta}
                  onChange={(e) => setNewEmotionDelta(Number(e.target.value))}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white text-center focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={!newWord.trim()}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-[hsl(28_85%_62%)] hover:bg-[hsl(28_85%_62%/0.9)] py-2 text-xs font-bold text-[hsl(28_30%_10%)] transition-colors mt-2 disabled:opacity-40 shadow"
        >
          <Plus className="size-3.5" />
          {activeTab === 'intent_analysis' ? '添加至意图分析词库' : '添加至敏感防御规则库'}
        </button>
      </form>

      {/* Rules list with Search and Filter */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap text-xs text-white/40 px-1">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-white/40 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索当前模块词汇或分类..."
                className="w-full pl-8 pr-3 py-1 rounded-lg border border-white/10 bg-black/40 text-white text-xs focus:outline-none"
              />
            </div>
            {allCategoriesInCurrentTab.length > 0 && (
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-2 py-1 rounded-lg border border-white/10 bg-black/60 text-white text-xs focus:outline-none"
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

          <span className="text-white/40 text-xs">
            当前规则: {currentTabRules.length} 条
          </span>
        </div>

        <div className="max-h-[20rem] overflow-y-auto border border-white/10 rounded-xl divide-y divide-white/5 bg-black/20">
          {currentTabRules.length === 0 ? (
            <div className="p-8 text-center text-xs text-white/30 leading-relaxed">
              {searchQuery || filterCategory !== 'all' ? '未找到符合条件的规则项' : '当前模块词库暂无规则'}
            </div>
          ) : (
            currentTabRules.map((rule) => {
              const isEnabled = rule.enabled !== false;
              return (
                <div
                  key={rule.id}
                  className={`flex items-center justify-between p-3 hover:bg-white/[0.02] transition-colors ${
                    !isEnabled ? 'opacity-50' : ''
                  }`}
                >
                  <div className="space-y-1 flex-1 pr-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-white bg-white/5 px-2 py-0.5 rounded border border-white/5">
                        {rule.word}
                      </span>
                      <span className="text-[10px] text-white/60 px-1.5 py-0.2 rounded bg-white/5">
                        {rule.category}
                      </span>

                      {rule.action === 'block' && (
                        <span className="text-[10px] bg-red-500/15 text-red-300 border border-red-500/30 px-1.5 py-0.2 rounded flex items-center gap-0.5 font-medium">
                          <Ban className="size-2.5" /> 拦截拒发
                        </span>
                      )}
                      {rule.action === 'censor' && (
                        <span className="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-medium">
                          * 号打码
                        </span>
                      )}
                      {rule.action === 'emotion' && (
                        <span className="text-[10px] bg-purple-500/15 text-purple-300 border border-purple-500/30 px-1.5 py-0.2 rounded font-medium flex items-center gap-0.5">
                          <Flame className="size-2.5 text-purple-400" />
                          {EMOTION_NAMES[rule.emotionKey || 'warmth']} +{Math.round((rule.emotionDelta || 0.4) * 100)}%
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleRule(rule.id)}
                      className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                        isEnabled
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                          : 'bg-white/5 text-white/40 border-white/10'
                      }`}
                    >
                      {isEnabled ? '生效中' : '已禁用'}
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="size-7 flex items-center justify-center rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-all"
                      title="删除规则"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {saved && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/20 px-3 py-2 text-xs text-green-300 shadow-xl backdrop-blur-md">
          <Check className="size-3.5" /> {savedText}
        </div>
      )}
    </div>
  );
}
