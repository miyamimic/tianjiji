import { useState, useEffect } from 'react';
import {
  Bot,
  Sparkles,
  RefreshCw,
  Key,
  Globe,
  Check,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldCheck,
  Radio,
  Bookmark,
  Plus,
  Trash2,
  CheckSquare,
} from 'lucide-react';
import {
  loadLlmConfig,
  saveLlmConfig,
  fetchAvailableModels,
  callLlm,
  loadLlmPresets,
  saveLlmPresets,
  loadCachedAvailableModels,
  saveCachedAvailableModels,
  type LlmConfig,
  type LlmPreset,
} from '../../lib/llm';

interface Props {
  onConfigChange?: (config: LlmConfig) => void;
}

export default function LlmApp({ onConfigChange }: Props) {
  // 1. 同步加载当前持久化的第三方配置，确保绝对无空白帧或被清空
  const [config, setConfig] = useState<LlmConfig>(() => loadLlmConfig());
  const [showApiKey, setShowApiKey] = useState(false);

  // 2. 纯用户自定义预设列表（绝无任何系统硬编码预设）
  const [presets, setPresets] = useState<LlmPreset[]>(() => loadLlmPresets());
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [newPresetName, setNewPresetName] = useState('');
  const [isSavingPresetModal, setIsSavingPresetModal] = useState(false);

  // 3. 动态抓取的第三方模型列表（若点击“抓取可用模型”）
  const [availableModels, setAvailableModels] = useState<string[]>(() => loadCachedAvailableModels());
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // 4. 反馈状态
  const [saved, setSaved] = useState(false);
  const [saveToastMsg, setSaveToastMsg] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // 监听外部配置变更事件，保持完全同步
  useEffect(() => {
    const handleSavedEvent = (e: Event) => {
      const customEvt = e as CustomEvent<LlmConfig>;
      if (customEvt.detail) {
        setConfig(customEvt.detail);
      }
    };
    window.addEventListener('rp_engine_llm_config_saved', handleSavedEvent);
    return () => window.removeEventListener('rp_engine_llm_config_saved', handleSavedEvent);
  }, []);

  // 从当前第三方接口抓取其支持的模型列表
  const handleFetchModels = async () => {
    const cleanUrl = config.baseUrl.trim();
    const cleanKey = config.apiKey.trim();

    if (!cleanUrl) {
      setFetchError('请先填写第三方 Base URL');
      return;
    }

    setIsFetchingModels(true);
    setFetchError(null);

    try {
      const models = await fetchAvailableModels(cleanUrl, cleanKey);
      setAvailableModels(models);
      saveCachedAvailableModels(models);
      if (models.length > 0 && !config.model.trim()) {
        setConfig((prev) => ({ ...prev, model: models[0] }));
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : '抓取模型列表失败，请确认中转站地址与 Key 是否正确');
    } finally {
      setIsFetchingModels(false);
    }
  };

  // 保存配置：保留输入内容，写入持久化存储，显示清晰反馈
  const handleSave = () => {
    const cleanBase = config.baseUrl.trim();
    const cleanKey = config.apiKey.trim();
    const cleanModel = config.model.trim() || 'gpt-4o-mini';

    const cleanConfig: LlmConfig = {
      baseUrl: cleanBase,
      apiKey: cleanKey,
      model: cleanModel,
    };

    // 确保输入框内容保持最新修整后的值，绝不变空白
    setConfig(cleanConfig);
    saveLlmConfig(cleanConfig);
    onConfigChange?.(cleanConfig);

    setSaved(true);
    setSaveToastMsg(`✅ 配置已保存生效：${cleanModel}`);
    setTimeout(() => {
      setSaved(false);
    }, 2500);
    setTimeout(() => {
      setSaveToastMsg(null);
    }, 4000);
  };

  // 将当前填写的第三方配置存为自定义预设
  const handleSaveAsPreset = () => {
    if (!newPresetName.trim()) return;
    const newPreset: LlmPreset = {
      id: `custom_${Date.now()}`,
      name: newPresetName.trim(),
      baseUrl: config.baseUrl.trim(),
      apiKey: config.apiKey.trim(),
      model: config.model.trim() || 'gpt-4o-mini',
      note: '用户自定义第三方 OpenAI 接口预设',
    };

    const updated = [...presets, newPreset];
    setPresets(updated);
    saveLlmPresets(updated);
    setSelectedPresetId(newPreset.id);
    setNewPresetName('');
    setIsSavingPresetModal(false);
    setSaveToastMsg(`⭐ 已成功将配置存为预设【${newPreset.name}】！`);
    setTimeout(() => setSaveToastMsg(null), 3000);
  };

  // 应用已保存的自定义预设
  const handleApplyPreset = (preset: LlmPreset) => {
    setSelectedPresetId(preset.id);
    const newConfig: LlmConfig = {
      baseUrl: preset.baseUrl,
      apiKey: preset.apiKey !== undefined && preset.apiKey !== '' ? preset.apiKey : config.apiKey,
      model: preset.model,
    };
    setConfig(newConfig);
    saveLlmConfig(newConfig);
    onConfigChange?.(newConfig);
    setFetchError(null);
    setTestResult(null);
    setSaveToastMsg(`已载入预设【${preset.name}】并已立即生效`);
    setTimeout(() => setSaveToastMsg(null), 3000);
  };

  // 删除自定义预设
  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = presets.filter((p) => p.id !== id);
    setPresets(updated);
    saveLlmPresets(updated);
    if (selectedPresetId === id) {
      setSelectedPresetId('');
    }
  };

  // 测试与第三方 OpenAI 接口的连通性
  const handleTest = async () => {
    const cleanConfig: LlmConfig = {
      baseUrl: config.baseUrl.trim(),
      apiKey: config.apiKey.trim(),
      model: config.model.trim() || 'gpt-4o-mini',
    };

    if (!cleanConfig.baseUrl || !cleanConfig.apiKey || !cleanConfig.model) {
      setTestResult({ ok: false, msg: '请先填写完整 Base URL、API Key 与模型名称' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await callLlm(
        cleanConfig,
        [
          { role: 'system', content: 'You are a test ping assistant.' },
          { role: 'user', content: 'Ping test. Reply with: pong' },
        ],
        { timeoutMs: 15000 }
      );
      setTestResult({
        ok: true,
        msg: `连接成功！响应: "${res.trim().slice(0, 45)}..."`,
      });
    } catch (err) {
      setTestResult({
        ok: false,
        msg: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4 text-xs text-white/90 pb-6 animate-in fade-in-0 duration-200 font-sans">
      {/* 提示条 / Toast */}
      {saveToastMsg && (
        <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-[11px] flex items-center gap-2 shadow-md animate-in fade-in slide-in-from-top-1">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
          <span className="truncate">{saveToastMsg}</span>
        </div>
      )}

      {/* 1. 用户自定义预设功能区（支持添加、快速切换、删除自己的中转站预设） */}
      <div className="p-3.5 rounded-2xl border border-white/10 bg-white/[0.04] space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-white flex items-center gap-1.5 text-xs">
            <Bookmark className="size-3.5 text-[hsl(28_85%_62%)]" />
            自定义接口预设 (保存与切换)
          </span>
          <button
            type="button"
            onClick={() => setIsSavingPresetModal(!isSavingPresetModal)}
            className="flex items-center gap-1 text-[10px] text-[hsl(28_85%_62%)] hover:text-white transition-colors bg-[hsl(28_85%_62%/0.12)] px-2.5 py-1 rounded-lg border border-[hsl(28_85%_62%/0.25)] cursor-pointer"
          >
            <Plus className="size-2.5" />
            存为新预设
          </button>
        </div>

        {/* 存为新预设输入弹窗 */}
        {isSavingPresetModal && (
          <div className="p-3 rounded-xl bg-black/70 border border-[hsl(28_85%_62%/0.3)] space-y-2 animate-in fade-in duration-150">
            <span className="text-[11px] text-white/80 font-medium block">
              将当前 Base URL、Key 与模型保存为新预设：
            </span>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="预设名称，如：主力中转站-4o / 备用API"
                className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-white/20 bg-black text-white focus:outline-none focus:border-[hsl(28_85%_62%)] font-sans"
              />
              <button
                type="button"
                onClick={handleSaveAsPreset}
                disabled={!newPresetName.trim()}
                className="px-3 py-1.5 bg-[hsl(28_85%_62%)] text-[hsl(28_30%_10%)] font-semibold text-xs rounded-lg hover:bg-[hsl(28_85%_62%/0.9)] disabled:opacity-40 transition cursor-pointer"
              >
                确认保存
              </button>
              <button
                type="button"
                onClick={() => setIsSavingPresetModal(false)}
                className="px-2.5 py-1.5 bg-white/10 text-white/70 text-xs rounded-lg hover:bg-white/20 transition cursor-pointer"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* 预设列表 */}
        {presets.length > 0 ? (
          <div className="space-y-1.5">
            <span className="text-[10px] text-white/50 block">点击即可一键载入已存的第三方接口配置：</span>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
              {presets.map((preset) => {
                const isSelected = selectedPresetId === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => handleApplyPreset(preset)}
                    className={`group relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[hsl(28_85%_62%/0.25)] border-[hsl(28_85%_62%)] text-white font-medium shadow-xs'
                        : 'bg-black/40 hover:bg-black/60 border-white/10 text-white/80 hover:border-white/25'
                    }`}
                    title={`BaseURL: ${preset.baseUrl} | 模型: ${preset.model}`}
                  >
                    <span className="truncate max-w-[140px]">{preset.name}</span>
                    <button
                      type="button"
                      onClick={(e) => handleDeletePreset(preset.id, e)}
                      className="opacity-40 hover:opacity-100 hover:text-red-400 p-0.5 transition ml-1"
                      title="删除此预设"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-[10.5px] text-white/45 leading-relaxed bg-black/20 p-2.5 rounded-xl border border-white/5">
            暂无已保存的预设。输入第三方 OpenAI 接口与模型后，可随时点击上方【存为新预设】保存多个中转站配置，以便随时一键切换。
          </p>
        )}
      </div>

      {/* 2. 第三方 OpenAI 接口接入表单 */}
      <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] space-y-3.5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-white flex items-center gap-1.5 text-xs">
            <Bot className="size-3.5 text-[hsl(28_85%_62%)]" />
            第三方 OpenAI 接口配置
          </span>
          <span className="text-[10px] text-white/40 font-mono">
            {config.baseUrl ? '已配置' : '未连接'}
          </span>
        </div>

        {/* Base URL */}
        <div className="space-y-1">
          <label className="text-[10px] text-white/60 flex items-center gap-1">
            <Globe className="size-3 text-amber-400/80" />
            第三方 API Base URL (兼容 OpenAI 规范)
          </label>
          <input
            type="text"
            value={config.baseUrl}
            onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
            placeholder="例如：https://api.your-relay.com/v1"
            className="w-full px-3 py-2 text-xs rounded-xl border border-white/10 bg-black/60 text-white placeholder:text-white/20 focus:outline-none focus:border-[hsl(28_85%_62%/0.7)] font-mono"
          />
        </div>

        {/* API Key */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-white/60 flex items-center gap-1">
              <Key className="size-3 text-emerald-400/80" />
              API Key (保存在本地浏览器，不外传)
            </label>
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="text-[10px] text-white/40 hover:text-white/80 flex items-center gap-1 transition cursor-pointer"
            >
              {showApiKey ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
              {showApiKey ? '隐藏' : '显示'}
            </button>
          </div>
          <input
            type={showApiKey ? 'text' : 'password'}
            value={config.apiKey}
            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
            placeholder="sk-..."
            className="w-full px-3 py-2 text-xs rounded-xl border border-white/10 bg-black/60 text-white placeholder:text-white/20 focus:outline-none focus:border-[hsl(28_85%_62%/0.7)] font-mono"
          />
        </div>

        {/* 模型名称输入 (Model Name) */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-white/60 flex items-center gap-1">
              <Sparkles className="size-3 text-[hsl(28_85%_62%)]" />
              模型名称 (Model)
            </label>
            <button
              type="button"
              onClick={handleFetchModels}
              disabled={isFetchingModels || !config.baseUrl.trim()}
              className="flex items-center gap-1 text-[10px] text-[hsl(28_85%_62%)] hover:text-white transition-colors bg-[hsl(28_85%_62%/0.12)] px-2.5 py-0.5 rounded-lg border border-[hsl(28_85%_62%/0.25)] disabled:opacity-40 cursor-pointer"
            >
              <RefreshCw className={`size-2.5 ${isFetchingModels ? 'animate-spin' : ''}`} />
              {isFetchingModels ? '抓取中...' : '抓取可用模型'}
            </button>
          </div>

          {/* 始终提供直接可编辑文本输入框，绝不锁死或变空白 */}
          <input
            type="text"
            value={config.model}
            onChange={(e) => setConfig({ ...config, model: e.target.value })}
            placeholder="例如：gpt-4o / claude-3-5-sonnet / deepseek-chat"
            className="w-full px-3 py-2 text-xs rounded-xl border border-white/10 bg-black/60 text-white placeholder:text-white/20 focus:outline-none focus:border-[hsl(28_85%_62%/0.7)] font-mono"
          />

          {/* 若抓取到了该第三方接口的模型列表，提供快捷点击填入 */}
          {availableModels.length > 0 && (
            <div className="pt-1 space-y-1">
              <span className="text-[9.5px] text-white/40 block">该中转站支持的模型（点击填入）：</span>
              <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pr-1">
                {availableModels.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setConfig((prev) => ({ ...prev, model: m }))}
                    className={`px-2 py-0.5 rounded-lg text-[9.5px] font-mono border transition-colors cursor-pointer ${
                      config.model === m
                        ? 'bg-[hsl(28_85%_62%/0.3)] border-[hsl(28_85%_62%)] text-white font-medium'
                        : 'bg-white/5 hover:bg-white/15 border-white/10 text-white/70'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}

          {fetchError && (
            <p className="text-[10px] text-red-400 flex items-center gap-1 pt-1">
              <AlertCircle className="size-3 shrink-0" />
              {fetchError}
            </p>
          )}
        </div>

        {/* 视觉多模态提示 */}
        <div className="p-2.5 rounded-xl border border-white/10 bg-black/30 flex items-start gap-2">
          <Eye className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-white/60 leading-relaxed">
            若您的第三方接口模型支持 Vision 视觉感知（如 <code>gpt-4o</code> 等），将自动解析您与角色的头像外观特征，在聊天中感知画面！
          </p>
        </div>

        {/* 操作按钮区 */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
          >
            {testing ? <RefreshCw className="size-3 animate-spin" /> : null}
            {testing ? '测试连接中...' : '测试连接'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className={`flex-1 py-2.5 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer ${
              saved
                ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                : 'bg-[hsl(28_85%_62%)] hover:bg-[hsl(28_85%_62%/0.9)] text-[hsl(28_30%_10%)] shadow-[hsl(28_85%_62%/0.15)]'
            }`}
          >
            {saved ? <Check className="size-3.5" /> : <CheckSquare className="size-3.5" />}
            {saved ? '已保存生效' : '保存模型配置'}
          </button>
        </div>

        {/* 测试结果 */}
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

      {/* 3. 202 + Outbox 离线异步队列 & iOS 防中断保活状态 */}
      <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-white flex items-center gap-1.5 text-xs">
            <ShieldCheck className="size-3.5 text-emerald-400" />
            202 + Outbox 异步队列 & iOS 防中断保活
          </span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono flex items-center gap-1">
            <Radio className="size-2.5 animate-pulse" />
            已激活
          </span>
        </div>

        <p className="text-[11px] text-white/60 leading-relaxed">
          采用轻量级 <b>202 Accepted + Outbox</b> 离线持久化队列与 <b>Web Audio API 无损静音保活</b> 技术。切屏或锁屏时不被系统挂起，自动指数退避重试。
        </p>
      </div>
    </div>
  );
}
