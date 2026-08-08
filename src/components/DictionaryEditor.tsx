import { useState, useEffect } from 'react';
import { Shield, Plus, Trash2, Check, RotateCcw, AlertTriangle, ShieldAlert } from 'lucide-react';
import { loadSensitiveWords, saveSensitiveWords, type SensitiveWordRule } from '../lib/customStore';
import { EMOTION_NAMES } from '../data/types';

export default function DictionaryEditor() {
  const [rules, setRules] = useState<SensitiveWordRule[]>([]);
  const [newWord, setNewWord] = useState('');
  const [newCategory, setNewCategory] = useState('自定义词汇');
  const [newAction, setNewAction] = useState<'censor' | 'block' | 'emotion'>('censor');
  const [newEmotionKey, setNewEmotionKey] = useState<'anger' | 'fear' | 'joy' | 'sadness' | 'desire' | 'warmth'>('anger');
  const [newEmotionDelta, setNewEmotionDelta] = useState(0.5);

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setRules(loadSensitiveWords());
  }, []);

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.trim()) return;

    // Check duplicate
    if (rules.some((r) => r.word.toLowerCase() === newWord.trim().toLowerCase())) {
      alert('该拦截词已存在！');
      return;
    }

    const rule: SensitiveWordRule = {
      id: `sw_${Date.now()}`,
      word: newWord.trim(),
      category: newCategory.trim() || '自定义词汇',
      action: newAction,
      emotionKey: newAction === 'emotion' ? newEmotionKey : undefined,
      emotionDelta: newAction === 'emotion' ? Number(newEmotionDelta) : undefined,
    };

    const updated = [rule, ...rules];
    setRules(updated);
    saveSensitiveWords(updated);
    setNewWord('');
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleDeleteRule = (id: string) => {
    const updated = rules.filter((r) => r.id !== id);
    setRules(updated);
    saveSensitiveWords(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleReset = () => {
    if (confirm('确定要恢复出厂默认拦截词典吗？所有自定义的拦截规则都会丢失！')) {
      localStorage.removeItem('__rp_engine_sensitive_words');
      const defaults = loadSensitiveWords();
      setRules(defaults);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  };

  return (
    <div className="space-y-5 text-white/90">
      <div>
        <h3 className="text-sm font-semibold mb-1 flex items-center gap-1.5 text-white">
          <Shield className="size-4 text-[hsl(28_85%_62%)]" />
          全天候 NLP 敏感拦截词典
        </h3>
        <p className="text-xs text-white/40 leading-relaxed">
          抢在任何 LLM 大模型处理前进行极其快速的<b>高精度前置检测</b>。你可以自定义拦截词以及对应的响应机制，从而精细控制对话边界或制作极具戏剧性的人物性格：
        </p>
      </div>

      {/* Add new word rule Form */}
      <form
        onSubmit={handleAddRule}
        className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-3"
      >
        <span className="text-xs font-semibold text-white/80 block">新增前置拦截规则：</span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-white/40 mb-1">拦截关键字</label>
            <input
              type="text"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              placeholder="例如：傻逼、退钱、垃圾"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white focus:border-[hsl(28_85%_62%/0.5)] focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] text-white/40 mb-1">词组分类</label>
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="例如：粗俗、敏感、角色禁忌"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white focus:border-[hsl(28_85%_62%/0.5)] focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-[10px] text-white/40 mb-1">触发拦截动作</label>
            <select
              value={newAction}
              onChange={(e: any) => setNewAction(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-1.5 text-xs text-white focus:border-[hsl(28_85%_62%/0.5)] focus:outline-none appearance-none"
            >
              <option value="censor">替换/脱敏（用 * 号隐藏）</option>
              <option value="block">彻底拦截（禁止发送并给出系统警告）</option>
              <option value="emotion">触怒情绪（大幅改变角色特定情感）</option>
            </select>
          </div>

          {newAction === 'emotion' && (
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[10px] text-white/40 mb-1">改变的情感</label>
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
              <div className="w-24">
                <label className="block text-[10px] text-white/40 mb-1">偏移度 delta</label>
                <input
                  type="number"
                  step="0.1"
                  min="-1.0"
                  max="1.0"
                  value={newEmotionDelta}
                  onChange={(e) => setNewEmotionDelta(Number(e.target.value))}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white text-center focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        <button
          type="submit"
          className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-[hsl(28_85%_62%)] hover:bg-[hsl(28_85%_62%/0.9)] py-2 text-xs font-semibold text-[hsl(28_30%_10%)] transition-colors mt-2"
        >
          <Plus className="size-3.5" />
          添加至本地词典库
        </button>
      </form>

      {/* Rules list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-white/40 select-none px-1">
          <span>拦截词列表 ({rules.length} 个项目)</span>
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-[11px] text-red-400/70 hover:text-red-400 transition-colors"
          >
            <RotateCcw className="size-3" /> 重置默认
          </button>
        </div>

        <div className="max-h-[22rem] overflow-y-auto border border-white/10 rounded-xl divide-y divide-white/5 bg-black/20">
          {rules.length === 0 ? (
            <div className="p-8 text-center text-xs text-white/30 leading-relaxed">
              您的字典库为空，所有词汇将畅通无阻。
            </div>
          ) : (
            rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between p-3 hover:bg-white/[0.02] transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-white bg-white/5 px-2 py-0.5 rounded border border-white/5">
                      {rule.word}
                    </span>
                    <span className="text-[10px] text-white/40 px-1.5 py-0.2 rounded bg-white/5">
                      {rule.category}
                    </span>
                    {rule.action === 'block' && (
                      <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                        <ShieldAlert className="size-2.5" /> 拦截拒绝
                      </span>
                    )}
                    {rule.action === 'censor' && (
                      <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.2 rounded">
                        * 号替换
                      </span>
                    )}
                    {rule.action === 'emotion' && (
                      <span className="text-[10px] bg-purple-500/10 text-purple-400 px-1.5 py-0.2 rounded">
                        情绪变动 ({EMOTION_NAMES[rule.emotionKey!] || rule.emotionKey} {rule.emotionDelta! >= 0 ? `+${rule.emotionDelta}` : rule.emotionDelta})
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteRule(rule.id)}
                  className="size-7 flex items-center justify-center rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/5 transition-all"
                  title="删除规则"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {saved && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/15 px-3 py-2 text-xs text-green-400 shadow-xl backdrop-blur-md animate-slide-in">
          <Check className="size-3.5" /> 拦截字典已更新
        </div>
      )}
    </div>
  );
}
