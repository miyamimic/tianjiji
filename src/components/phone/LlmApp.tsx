import { useState, useEffect } from 'react';
import { Bot, Sparkles, RefreshCw, Key, Globe, Check, AlertCircle, CheckCircle2, Eye } from 'lucide-react';
import { loadLlmConfig, saveLlmConfig, fetchAvailableModels, callLlm, type LlmConfig } from '../../lib/llm';

interface Props {
  onConfigChange?: (config: LlmConfig) => void;
}

export default function LlmApp({ onConfigChange }: Props) {
  const [config, setConfig] = useState<LlmConfig>({
    baseUrl: '',
    apiKey: '',
    model: 'gpt-4o-mini',
  });

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    const loaded = loadLlmConfig();
    setConfig(loaded);
  }, []);

  const handleFetchModels = async () => {
    if (!config.baseUrl.trim() || !config.apiKey.trim()) {
      setFetchError('请先填写 Base URL 和 API Key');
      return;
    }

    setIsFetchingModels(true);
    setFetchError(null);

    try {
      const models = await fetchAvailableModels(config.baseUrl, config.apiKey);
      setAvailableModels(models);
      if (models.length > 0 && !models.includes(config.model)) {
        const preferred = models.find((m) => m.includes('gpt-4o') || m.includes('claude-3') || m.includes('gemini') || m.includes('deepseek')) || models[0];
        setConfig((prev) => ({ ...prev, model: preferred }));
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : '抓取模型失败');
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleSave = () => {
    saveLlmConfig(config);
    onConfigChange?.(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    if (!config.baseUrl || !config.apiKey || !config.model) {
      setTestResult({ ok: false, msg: '请先填写完整配置' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await callLlm(config, [
        { role: 'system', content: 'You are a test ping.' },
        { role: 'user', content: 'Say "pong"' },
      ]);
      setTestResult({ ok: true, msg: `连接成功！响应: "${res.slice(0, 30)}..."` });
    } catch (err) {
      setTestResult({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4 text-xs text-white/90 pb-6 animate-in fade-in-0 duration-200">
      <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] space-y-3.5">
        <span className="font-semibold text-white flex items-center gap-1.5 text-xs">
          <Bot className="size-3.5 text-[hsl(28_85%_62%)]" />
          大模型与视觉多模态接入
        </span>

        {/* Base URL */}
        <div className="space-y-1">
          <label className="text-[10px] text-white/50 flex items-center gap-1">
            <Globe className="size-3" />
            API Base URL (兼容 OpenAI 规范)
          </label>
          <input
            type="text"
            value={config.baseUrl}
            onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
            placeholder="https://api.openai.com/v1"
            className="w-full px-3 py-1.5 text-xs rounded-xl border border-white/10 bg-black/50 text-white placeholder:text-white/20 focus:outline-none focus:border-[hsl(28_85%_62%/0.5)] font-mono"
          />
        </div>

        {/* API Key */}
        <div className="space-y-1">
          <label className="text-[10px] text-white/50 flex items-center gap-1">
            <Key className="size-3" />
            API Key (密钥仅在本地浏览器加密使用)
          </label>
          <input
            type="password"
            value={config.apiKey}
            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
            placeholder="sk-..."
            className="w-full px-3 py-1.5 text-xs rounded-xl border border-white/10 bg-black/50 text-white placeholder:text-white/20 focus:outline-none focus:border-[hsl(28_85%_62%/0.5)] font-mono"
          />
        </div>

        {/* Model Fetcher */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-white/50 flex items-center gap-1">
              <Sparkles className="size-3 text-[hsl(28_85%_62%)]" />
              当前生效模型
            </label>
            <button
              type="button"
              onClick={handleFetchModels}
              disabled={isFetchingModels || !config.baseUrl.trim()}
              className="flex items-center gap-1 text-[10px] text-[hsl(28_85%_62%)] hover:text-white transition-colors bg-[hsl(28_85%_62%/0.12)] px-2 py-0.5 rounded-lg border border-[hsl(28_85%_62%/0.25)] disabled:opacity-40"
            >
              <RefreshCw className={`size-2.5 ${isFetchingModels ? 'animate-spin' : ''}`} />
              一键抓取可用模型
            </button>
          </div>

          {availableModels.length > 0 ? (
            <select
              value={config.model}
              onChange={(e) => setConfig({ ...config, model: e.target.value })}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-white/10 bg-black/60 text-white focus:outline-none focus:border-[hsl(28_85%_62%/0.5)] font-mono"
            >
              {availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={config.model}
              onChange={(e) => setConfig({ ...config, model: e.target.value })}
              placeholder="gpt-4o-mini / gpt-4o / claude-3-5-sonnet"
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-white/10 bg-black/50 text-white placeholder:text-white/20 focus:outline-none focus:border-[hsl(28_85%_62%/0.5)] font-mono"
            />
          )}

          {fetchError && (
            <p className="text-[10px] text-red-400 flex items-center gap-1">
              <AlertCircle className="size-3 shrink-0" />
              {fetchError}
            </p>
          )}
        </div>

        {/* Vision Multi-modal indicator */}
        <div className="p-2.5 rounded-xl border border-white/10 bg-black/30 flex items-start gap-2">
          <Eye className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-white/50 leading-relaxed">
            支持 <b>多模态视觉识别</b>。配置如 gpt-4o, gpt-4o-mini 或兼容 Vision 的模型即可自动识别主控与角色头像中的发色、衣着与神态！
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleTest}
            disabled={testing}
            className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            {testing ? <RefreshCw className="size-3 animate-spin" /> : null}
            {testing ? '测试中...' : '测试连接'}
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 rounded-xl bg-[hsl(28_85%_62%)] hover:bg-[hsl(28_85%_62%/0.9)] text-[hsl(28_30%_10%)] font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-[hsl(28_85%_62%/0.15)]"
          >
            {saved ? <Check className="size-3.5" /> : null}
            {saved ? '已保存' : '保存模型配置'}
          </button>
        </div>

        {testResult && (
          <div
            className={`p-2.5 rounded-xl border text-[11px] flex items-center gap-1.5 ${
              testResult.ok
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                : 'border-red-500/20 bg-red-500/10 text-red-300'
            }`}
          >
            {testResult.ok ? (
              <CheckCircle2 className="size-3.5 shrink-0" />
            ) : (
              <AlertCircle className="size-3.5 shrink-0" />
            )}
            <span className="truncate">{testResult.msg}</span>
          </div>
        )}
      </div>
    </div>
  );
}
