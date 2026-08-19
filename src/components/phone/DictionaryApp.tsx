import { useState, useEffect } from 'react';
import { ShieldAlert, Plus, Trash2, Check, AlertCircle, RotateCcw } from 'lucide-react';
import { 
  loadSensitiveWords, 
  saveSensitiveWords, 
  DEFAULT_SENSITIVE_WORDS, 
  type SensitiveWordRule 
} from '../../lib/customStore';
import { EMOTION_NAMES, type EmotionKey } from '../../data/types';

export default function DictionaryApp() {
  const [rules, setRules] = useState<SensitiveWordRule[]>([]);
  const [newWord, setNewWord] = useState('');
  const [newCategory, setNewCategory] = useState('粗俗言语');
  const [newAction, setNewAction] = useState<'censor' | 'block' | 'emotion'>('censor');
  const [newEmotionKey, setNewEmotionKey] = useState<EmotionKey>('anger');
  const [newEmotionDelta, setNewEmotionDelta] = useState(0.4);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setRules(loadSensitiveWords());
  }, []);

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.trim()) return;

    const newRule: SensitiveWordRule = {
      id: `sw_${Date.now()}`,
      word: newWord.trim(),
      category: newCategory,
      action: newAction,
      emotionKey: newAction === 'emotion' ? newEmotionKey : undefined,
      emotionDelta: newAction === 'emotion' ? newEmotionDelta : undefined,
    };

    const updated = [newRule, ...rules];
    setRules(updated);
    saveSensitiveWords(updated);
    setNewWord('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDeleteRule = (id: string) => {
    const updated = rules.filter((r) => r.id !== id);
    setRules(updated);
    saveSensitiveWords(updated);
  };

  const handleResetDefaults = () => {
    setRules(DEFAULT_SENSITIVE_WORDS);
    saveSensitiveWords(DEFAULT_SENSITIVE_WORDS);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4 text-xs text-white/90 pb-6 animate-in fade-in-0 duration-200">
      {/* Add Rule Form */}
      <form onSubmit={handleAddRule} className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-white flex items-center gap-1.5 text-xs">
            <Plus className="size-3.5 text-[hsl(28_85%_62%)]" />
            添加拦截/情绪敏感词
          </span>
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white transition-colors"
          >
            <RotateCcw className="size-3" />
            恢复默认词典
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-white/40 block mb-1">拦截词汇</label>
            <input
              type="text"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              placeholder="输入敏感词"
              className="w-full px-2.5 py-1.5 rounded-xl border border-white/10 bg-black/50 text-white focus:outline-none focus:border-[hsl(28_85%_62%/0.5)]"
            />
          </div>
          <div>
            <label className="text-[10px] text-white/40 block mb-1">分类标签</label>
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="分类"
              className="w-full px-2.5 py-1.5 rounded-xl border border-white/10 bg-black/50 text-white focus:outline-none focus:border-[hsl(28_85%_62%/0.5)]"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] text-white/40 block mb-1">触发动作</label>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setNewAction('censor')}
              className={`py-1.5 rounded-lg text-[10px] font-medium border transition-all ${
                newAction === 'censor'
                  ? 'border-[hsl(28_85%_62%)] bg-[hsl(28_85%_62%/0.15)] text-[hsl(28_85%_62%)]'
                  : 'border-white/10 text-white/40'
              }`}
            >
              *** 字符打码
            </button>
            <button
              type="button"
              onClick={() => setNewAction('block')}
              className={`py-1.5 rounded-lg text-[10px] font-medium border transition-all ${
                newAction === 'block'
                  ? 'border-red-500/80 bg-red-500/15 text-red-400'
                  : 'border-white/10 text-white/40'
              }`}
            >
              🚫 绝对拦截
            </button>
            <button
              type="button"
              onClick={() => setNewAction('emotion')}
              className={`py-1.5 rounded-lg text-[10px] font-medium border transition-all ${
                newAction === 'emotion'
                  ? 'border-cyan-500/80 bg-cyan-500/15 text-cyan-300'
                  : 'border-white/10 text-white/40'
              }`}
            >
              ⚡ 情绪突变
            </button>
          </div>
        </div>

        {newAction === 'emotion' && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="text-[10px] text-white/40 block mb-1">激化情绪</label>
              <select
                value={newEmotionKey}
                onChange={(e) => setNewEmotionKey(e.target.value as EmotionKey)}
                className="w-full px-2 py-1 text-xs rounded-xl border border-white/10 bg-black/60 text-white focus:outline-none"
              >
                {Object.entries(EMOTION_NAMES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v} ({k})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-white/40 block mb-1">剧烈增幅 (+{Math.round(newEmotionDelta * 100)}%)</label>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.1"
                value={newEmotionDelta}
                onChange={(e) => setNewEmotionDelta(parseFloat(e.target.value))}
                className="w-full accent-[hsl(28_85%_62%)] h-1.5 bg-white/10 rounded-lg cursor-pointer mt-2"
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={!newWord.trim()}
          className="w-full py-2 rounded-xl bg-[hsl(28_85%_62%)] hover:bg-[hsl(28_85%_62%/0.9)] text-[hsl(28_30%_10%)] font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40"
        >
          {saved ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
          {saved ? '已添加至规则库' : '添加拦截规则'}
        </button>
      </form>

      {/* Rules list */}
      <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] space-y-2">
        <span className="font-semibold text-white flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5">
            <ShieldAlert className="size-3.5 text-[hsl(28_85%_62%)]" />
            现存规则列表 ({rules.length})
          </span>
        </span>

        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center justify-between p-2 rounded-xl border border-white/5 bg-black/40 text-[11px]"
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">{rule.word}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/40">
                  {rule.category}
                </span>
                {rule.action === 'block' && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                    拦截
                  </span>
                )}
                {rule.action === 'censor' && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                    打码
                  </span>
                )}
                {rule.action === 'emotion' && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                    {EMOTION_NAMES[rule.emotionKey || 'anger']} +{Math.round((rule.emotionDelta || 0.4) * 100)}%
                  </span>
                )}
              </div>
              <button
                onClick={() => handleDeleteRule(rule.id)}
                className="text-white/30 hover:text-red-400 transition-colors p-1"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
