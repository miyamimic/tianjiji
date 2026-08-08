import { useState, useEffect } from 'react';
import { X, Cloud, Eye, EyeOff, Check, AlertCircle, Palette, Shield, User } from 'lucide-react';
import { loadLlmConfig, saveLlmConfig, isLlmConfigured, type LlmConfig } from '../lib/llm';
import CssEditor from './CssEditor';
import DictionaryEditor from './DictionaryEditor';
import CharacterEditor from './CharacterEditor';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfigChange?: (config: LlmConfig) => void;
  currentCharacterId: string;
  onEngineReload: () => void;
}

export default function SettingsModal({
  open,
  onClose,
  onConfigChange,
  currentCharacterId,
  onEngineReload,
}: Props) {
  const [config, setConfig] = useState<LlmConfig>(loadLlmConfig());
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');

  // Active Tab: 'llm' | 'character' | 'dictionary' | 'css'
  const [activeTab, setActiveTab] = useState<'llm' | 'character' | 'dictionary' | 'css'>('llm');

  useEffect(() => {
    if (open) {
      setConfig(loadLlmConfig());
      setSaved(false);
      setTestResult('idle');
      setTestError('');
    }
  }, [open]);

  if (!open) return null;

  const configured = isLlmConfigured(config);

  const handleSave = () => {
    saveLlmConfig(config);
    setSaved(true);
    onConfigChange?.(config);
    onEngineReload();
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    if (!isLlmConfigured(config)) return;
    setTesting(true);
    setTestResult('idle');
    setTestError('');
    try {
      const url = config.baseUrl.replace(/\/$/, '') + '/chat/completions';
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: '说"好的"两个字' }],
          max_tokens: 10,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text.slice(0, 200)}`);
      }
      const data = await res.json();
      if (data?.choices?.[0]?.message?.content) {
        setTestResult('success');
      } else {
        throw new Error('返回格式异常');
      }
    } catch (e) {
      setTestResult('error');
      setTestError(e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-white/10 bg-[hsl(220_22%_13%)] shadow-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-[hsl(220_22%_13%)] select-none">
          <div>
            <h2 className="text-base font-semibold text-white tracking-wide">天枢引擎自定义控制台</h2>
            <p className="text-[10px] text-white/40 mt-0.5">定制个性化角色设定、拦截机制及 CSS 视觉样式</p>
          </div>
          <button
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex border-b border-white/5 bg-black/10 text-xs font-medium px-4 overflow-x-auto select-none shrink-0 no-scrollbar">
          <button
            onClick={() => setActiveTab('llm')}
            className={`px-4 py-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'llm'
                ? 'border-[hsl(28_85%_62%)] text-white bg-white/[0.02]'
                : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            <Cloud className="size-3.5" />
            LLM 接口配置
          </button>
          <button
            onClick={() => setActiveTab('character')}
            className={`px-4 py-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'character'
                ? 'border-[hsl(28_85%_62%)] text-white bg-white/[0.02]'
                : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            <User className="size-3.5" />
            人设与主控档案
          </button>
          <button
            onClick={() => setActiveTab('dictionary')}
            className={`px-4 py-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'dictionary'
                ? 'border-[hsl(28_85%_62%)] text-white bg-white/[0.02]'
                : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            <Shield className="size-3.5" />
            前置拦截词典
          </button>
          <button
            onClick={() => setActiveTab('css')}
            className={`px-4 py-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'css'
                ? 'border-[hsl(28_85%_62%)] text-white bg-white/[0.02]'
                : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            <Palette className="size-3.5" />
            CSS 视觉注入
          </button>
        </div>

        {/* Scrollable Content Container */}
        <div className="flex-1 p-5 overflow-y-auto min-h-0 bg-black/5">
          {activeTab === 'llm' && (
            <div className="space-y-6">
              {/* LLM Configuration */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Cloud className="size-4 text-[hsl(28_85%_62%)]" />
                  <h3 className="text-sm font-medium text-white">LLM 接口配置</h3>
                  {configured ? (
                    <span className="ml-auto text-xs text-green-400 flex items-center gap-1 bg-green-400/5 px-2 py-0.5 rounded border border-green-500/10">
                      <Check className="size-3" /> 已配置
                    </span>
                  ) : (
                    <span className="ml-auto text-xs text-white/40">未配置（使用本地演示模式）</span>
                  )}
                </div>

                <div className="space-y-3">
                  {/* Base URL */}
                  <div>
                    <label className="block text-xs text-white/50 mb-1.5">
                      API 地址（OpenAI 兼容 / 中转站）
                    </label>
                    <input
                      type="text"
                      value={config.baseUrl}
                      onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                      placeholder="https://api.openai.com/v1"
                      className="w-full rounded-lg border border-white/10 bg-[hsl(222_28%_9%/0.5)] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[hsl(28_85%_62%/0.5)] focus:outline-none transition-colors"
                    />
                    <p className="mt-1 text-[11px] text-white/30">
                      填写到 /v1 即可，程序会自动拼接 /chat/completions
                    </p>
                  </div>

                  {/* API Key */}
                  <div>
                    <label className="block text-xs text-white/50 mb-1.5">API Key</label>
                    <div className="relative">
                      <input
                        type={showKey ? 'text' : 'password'}
                        value={config.apiKey}
                        onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                        placeholder="sk-..."
                        className="w-full rounded-lg border border-white/10 bg-[hsl(222_28%_9%/0.5)] px-3 py-2 pr-10 text-sm text-white placeholder:text-white/30 focus:border-[hsl(28_85%_62%/0.5)] focus:outline-none transition-colors"
                      />
                      <button
                        onClick={() => setShowKey((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                      >
                        {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Model */}
                  <div>
                    <label className="block text-xs text-white/50 mb-1.5">模型名称</label>
                    <input
                      type="text"
                      value={config.model}
                      onChange={(e) => setConfig({ ...config, model: e.target.value })}
                      placeholder="gpt-4o-mini"
                      className="w-full rounded-lg border border-white/10 bg-[hsl(222_28%_9%/0.5)] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[hsl(28_85%_62%/0.5)] focus:outline-none transition-colors"
                    />
                    <p className="mt-1 text-[11px] text-white/30">
                      常用：gpt-4o-mini, gpt-4o, gpt-3.5-turbo 等，中转站可填对应模型名
                    </p>
                  </div>

                  {/* Test & Save buttons */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleTest}
                      disabled={!configured || testing}
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-sm text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {testing ? '测试中...' : '测试连接'}
                    </button>
                    <button
                      onClick={handleSave}
                      className="flex items-center gap-1.5 rounded-lg bg-[hsl(28_85%_62%)] hover:bg-[hsl(28_85%_62%/0.9)] px-3 py-2 text-sm font-medium text-[hsl(28_30%_10%)] transition-colors"
                    >
                      {saved ? <Check className="size-3.5" /> : null}
                      {saved ? '已保存' : '保存'}
                    </button>
                  </div>

                  {/* Test result */}
                  {testResult === 'success' && (
                    <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-400">
                      <Check className="size-3.5" />
                      连接成功，LLM 接口正常
                    </div>
                  )}
                  {testResult === 'error' && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
                      <div className="flex items-center gap-2 text-xs text-red-400 mb-1">
                        <AlertCircle className="size-3.5" />
                        连接失败
                      </div>
                      <p className="text-[11px] text-red-300/70 break-all">{testError}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Info section */}
              <div className="pt-4 border-t border-white/10">
                <div className="rounded-lg border border-white/10 bg-[hsl(222_28%_9%/0.4)] p-3">
                  <p className="text-xs text-white/50 leading-relaxed">
                    配置后，角色回复将使用真实 LLM 生成。未配置时自动使用本地规则引擎（Mock 模式）作为演示。
                    所有配置仅保存在本地浏览器中，不会上传。
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'character' && (
            <CharacterEditor
              currentCharacterId={currentCharacterId}
              onCharacterUpdated={onEngineReload}
            />
          )}

          {activeTab === 'dictionary' && (
            <DictionaryEditor />
          )}

          {activeTab === 'css' && (
            <CssEditor />
          )}
        </div>
      </div>
    </div>
  );
}
