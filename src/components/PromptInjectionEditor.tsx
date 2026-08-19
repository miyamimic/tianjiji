import React, { useState, useEffect } from 'react';
import { 
  Code2, 
  Sparkles, 
  Eye, 
  User, 
  HeartHandshake, 
  Layers, 
  RotateCcw, 
  Check, 
  Activity, 
  HelpCircle,
  FileJson
} from 'lucide-react';
import { 
  loadStructuredJsonPrompt, 
  saveStructuredJsonPrompt, 
  DEFAULT_STRUCTURED_JSON_PROMPT,
  loadCustomSystemPrompt,
  saveCustomSystemPrompt,
  loadEmotionDecayRate,
  saveEmotionDecayRate,
  loadUserPromptProfile,
  loadCharVisualDesc,
  loadUserVisualDesc
} from '../lib/customStore';
import { buildSystemPrompt } from '../lib/llm';
import { getCharacterById } from '../data/characters';
import { loadSavedCharacters } from '../lib/customStore';

interface Props {
  currentCharacterId: string;
  onUpdated: () => void;
}

export default function PromptInjectionEditor({ currentCharacterId, onUpdated }: Props) {
  const [structuredPrompt, setStructuredPrompt] = useState(loadStructuredJsonPrompt());
  const [customPrompt, setCustomPrompt] = useState(loadCustomSystemPrompt());
  const [decayRate, setDecayRate] = useState(loadEmotionDecayRate());
  
  const [saved, setSaved] = useState(false);
  const [activeLayer, setActiveLayer] = useState<number>(1);
  const [previewOpen, setPreviewOpen] = useState(false);

  const characters = loadSavedCharacters();
  const currentChar = characters.find(c => c.character_id === currentCharacterId) || characters[0];
  const charVisual = loadCharVisualDesc(currentCharacterId);
  const userPersona = loadUserPromptProfile();
  const userVisual = loadUserVisualDesc();

  useEffect(() => {
    setStructuredPrompt(loadStructuredJsonPrompt());
    setCustomPrompt(loadCustomSystemPrompt());
    setDecayRate(loadEmotionDecayRate());
  }, [currentCharacterId]);

  const handleSave = () => {
    saveStructuredJsonPrompt(structuredPrompt);
    saveCustomSystemPrompt(customPrompt);
    saveEmotionDecayRate(decayRate);
    setSaved(true);
    onUpdated();
    setTimeout(() => setSaved(false), 2000);
  };

  const handleResetStructuredPrompt = () => {
    setStructuredPrompt(DEFAULT_STRUCTURED_JSON_PROMPT);
    saveStructuredJsonPrompt(DEFAULT_STRUCTURED_JSON_PROMPT);
    setSaved(true);
    onUpdated();
    setTimeout(() => setSaved(false), 2000);
  };

  // Generate assembled prompt preview
  const assembledPrompt = buildSystemPrompt(
    currentChar?.name || '角色',
    'anger: 10%, fear: 5%, joy: 20%, sadness: 5%, desire: 15%, warmth: 30%',
    {
      characterCore: currentChar ? `核心特质: ${currentChar.core.values.join('、')}\n直觉本能: ${currentChar.core.instinct_base}\n语言风格: ${currentChar.core.speech_filter}` : '',
      charVisual: charVisual || '(未设置角色视觉外貌)',
      userPersona: userPersona || '(默认主控探访者档案)',
      userVisual: userVisual || '(未设置主控视觉外貌)',
      backgroundThreads: currentChar?.background_threads.active.map(t => t.content),
    }
  );

  return (
    <div className="space-y-5 text-white/90 animate-in fade-in-0 duration-200">
      
      {/* Header Info */}
      <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 flex items-start justify-between">
        <div className="space-y-0.5">
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Layers className="size-4 text-[hsl(28_85%_62%)]" />
            LLM 提示词分层与系统深度注入架构
          </h3>
          <p className="text-[11px] text-white/50 leading-relaxed max-w-xl">
            所有注入给大模型的上下文均被严格划分为六大系统层级。包含强制 JSON 输出规范、双向视觉多模态、六维情感变化 Delta 及情感平复衰减曲线。
          </p>
        </div>

        <button
          onClick={() => setPreviewOpen(!previewOpen)}
          className="flex items-center gap-1 text-[11px] text-[hsl(28_85%_62%)] hover:text-amber-300 bg-[hsl(28_85%_62%/0.1)] px-2.5 py-1 rounded-lg border border-[hsl(28_85%_62%/0.3)] transition-colors shrink-0"
        >
          <Code2 className="size-3" />
          {previewOpen ? '收起完整 Prompt' : '实时预览组装 Prompt'}
        </button>
      </div>

      {/* Live Assembled Prompt Preview Drawer */}
      {previewOpen && (
        <div className="p-3.5 rounded-xl bg-black/60 border border-white/15 space-y-2 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between text-[11px] text-white/60">
            <span className="font-mono flex items-center gap-1 text-amber-300">
              <FileJson className="size-3.5" /> 实时汇编 System Prompt 注入全文：
            </span>
            <span className="text-[10px] text-white/40 font-mono">
              {assembledPrompt.length} 字符 · 自动注入
            </span>
          </div>
          <pre className="p-3 rounded-lg bg-black/80 text-[11px] text-white/80 font-mono leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap select-all border border-white/5 custom-scrollbar">
            {assembledPrompt}
          </pre>
        </div>
      )}

      {/* Layer Navigation Tabs */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 p-1 bg-black/40 rounded-xl border border-white/5 text-[11px] select-none">
        {[
          { num: 1, title: 'JSON规范' },
          { num: 2, title: '角色特质' },
          { num: 3, title: '视觉多模态' },
          { num: 4, title: '主控人设' },
          { num: 5, title: '情感衰减' },
          { num: 6, title: '自定义补充' },
        ].map((l) => (
          <button
            key={l.num}
            onClick={() => setActiveLayer(l.num)}
            className={`py-1.5 px-2 rounded-lg font-medium transition-all text-center ${
              activeLayer === l.num
                ? 'bg-[hsl(28_85%_62%/0.2)] text-[hsl(28_85%_62%)] border border-[hsl(28_85%_62%/0.4)] shadow-xs font-semibold'
                : 'text-white/40 hover:text-white/70 hover:bg-white/5'
            }`}
          >
            L{l.num} {l.title}
          </button>
        ))}
      </div>

      {/* Layer Detail Panels */}
      <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] min-h-[220px]">
        
        {/* Layer 1: Structured Output JSON Protocol */}
        {activeLayer === 1 && (
          <div className="space-y-3 animate-in fade-in-0 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <FileJson className="size-4 text-[hsl(28_85%_62%)]" />
                <span>Layer 1: 强制结构化 JSON 输出协议 (返回格式与情绪 Delta 规范)</span>
              </div>
              <button
                onClick={handleResetStructuredPrompt}
                className="text-[10px] text-white/40 hover:text-white flex items-center gap-1 transition-colors"
                title="恢复官方默认 JSON 输出提示词"
              >
                <RotateCcw className="size-3" /> 恢复默认协议
              </button>
            </div>
            <p className="text-[11px] text-white/50 leading-relaxed">
              要求 LLM 输出标准 JSON 格式 <code className="text-amber-300 font-mono">{`{ reply, emotion_delta, action, thought, triggered_memory }`}</code>。引擎解析后统一实时驱动六维心理雷达与记忆槽，防止情绪系统失控或跳出人设。
            </p>
            <textarea
              value={structuredPrompt}
              onChange={(e) => setStructuredPrompt(e.target.value)}
              className="w-full h-44 p-3 text-xs font-mono rounded-lg border border-white/10 bg-black/50 text-white placeholder:text-white/20 focus:border-[hsl(28_85%_62%/0.5)] focus:outline-none resize-none leading-relaxed custom-scrollbar"
              placeholder="编写 JSON 格式输出约束规范..."
            />
          </div>
        )}

        {/* Layer 2: Character Core & Traits */}
        {activeLayer === 2 && (
          <div className="space-y-3 animate-in fade-in-0 duration-150">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <Sparkles className="size-4 text-[hsl(28_85%_62%)]" />
              <span>Layer 2: 角色核心特质与口癖（根据当前角色动态装配）</span>
            </div>
            <p className="text-[11px] text-white/50 leading-relaxed">
              当前角色「{currentChar.name}」的性格参数、本能机制及口癖约束。可在右上角「角色卡档案深度编辑」或手机人设中进行字段级修改。
            </p>
            <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-2 text-xs">
              <div className="flex justify-between border-b border-white/5 pb-1.5">
                <span className="text-white/40">核心价值观</span>
                <span className="text-white/90 font-medium">{currentChar.core.values.join('、')}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1.5">
                <span className="text-white/40">直觉反应机制</span>
                <span className="text-amber-300 font-mono">{currentChar.core.instinct_base.toUpperCase()}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1.5">
                <span className="text-white/40">语言口癖</span>
                <span className="text-white/80">{currentChar.speech.catchphrases.join('、') || '无固定口癖'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">禁用词汇</span>
                <span className="text-red-300">{currentChar.speech.forbidden_phrases.join('、') || '无'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Layer 3: Dual Multimodal Visual Perception */}
        {activeLayer === 3 && (
          <div className="space-y-3 animate-in fade-in-0 duration-150">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <Eye className="size-4 text-[hsl(28_85%_62%)]" />
              <span>Layer 3: 双向多模态视觉感知（AI 视觉识图结果注入）</span>
            </div>
            <p className="text-[11px] text-white/50 leading-relaxed">
              当在风铃手机中上传角色或主控头像后，大模型视觉接口会自动提炼外貌与神态特征并注入 System Prompt：
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-1">
                <span className="text-[11px] font-bold text-amber-300">角色自身视觉形体：</span>
                <p className="text-[11px] text-white/70 leading-relaxed">
                  {charVisual || '暂未上传自定义角色立绘（使用预设形象特征）'}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-1">
                <span className="text-[11px] font-bold text-amber-300">主控用户外貌特征：</span>
                <p className="text-[11px] text-white/70 leading-relaxed">
                  {userVisual || '暂未上传主控用户头像（使用预设气质描写）'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Layer 4: User Persona & Relationship */}
        {activeLayer === 4 && (
          <div className="space-y-3 animate-in fade-in-0 duration-150">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <User className="size-4 text-[hsl(28_85%_62%)]" />
              <span>Layer 4: 主控角色背景档案（用于匹配关系和心理）</span>
            </div>
            <p className="text-[11px] text-white/50 leading-relaxed">
              你在风铃手机「人设档案」中定义的主控身份背景与性格设定。作为恒定上下文引导角色对你的态度与互动张力：
            </p>
            <div className="p-3 rounded-lg bg-black/40 border border-white/5 text-xs text-white/80 leading-relaxed">
              {userPersona || '一个有些敏感、寻求关怀并试图在这里获得真实情感互动的探访者。'}
            </div>
          </div>
        )}

        {/* Layer 5: Emotion Natural Decay & Memory */}
        {activeLayer === 5 && (
          <div className="space-y-4 animate-in fade-in-0 duration-150">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <Activity className="size-4 text-[hsl(28_85%_62%)]" />
              <span>Layer 5: 情感中枢与随轮数自然衰减平复曲线 (Emotion Natural Decay)</span>
            </div>
            <p className="text-[11px] text-white/50 leading-relaxed">
              真实人类在被激怒或产生情绪波动后，情绪不会永远停留在峰值。情绪引擎会在每轮对话中，将六维情绪向平静基准线施加平滑的衰减平复曲线。
            </p>

            <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-white">每轮自然平复衰减速率 (Decay Rate)</span>
                  <p className="text-[10px] text-white/40">数值越大，角色情绪平复得越快；设为 0 时情绪不衰减</p>
                </div>
                <span className="text-xs font-mono font-bold text-[hsl(28_85%_62%)]">
                  {Math.round(decayRate * 100)}% / 轮
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="0.30"
                step="0.01"
                value={decayRate}
                onChange={(e) => setDecayRate(parseFloat(e.target.value))}
                className="w-full accent-[hsl(28_85%_62%)] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-white/30 font-mono">
                <span>0% (无衰减)</span>
                <span>12% (推荐平衡)</span>
                <span>30% (快速平复)</span>
              </div>
            </div>
          </div>
        )}

        {/* Layer 6: Custom Extra System Prompt */}
        {activeLayer === 6 && (
          <div className="space-y-3 animate-in fade-in-0 duration-150">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <Code2 className="size-4 text-[hsl(28_85%_62%)]" />
              <span>Layer 6: 自定义全局系统提示词补充 (Custom System Overrides)</span>
            </div>
            <p className="text-[11px] text-white/50 leading-relaxed">
              在这里可以自由追加任意世界观设定、对话风格规则或专属指令。该内容将无缝拼接在 System Prompt 最底部注入给 LLM：
            </p>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="例如：请在对话中多使用古风文雅词句，偶尔使用文言句式；在夜晚对话时语气要更低沉温柔..."
              className="w-full h-36 p-3 text-xs rounded-lg border border-white/10 bg-black/50 text-white placeholder:text-white/20 focus:border-[hsl(28_85%_62%/0.5)] focus:outline-none resize-none leading-relaxed custom-scrollbar"
            />
          </div>
        )}

      </div>

      {/* Save Button Bar */}
      <div className="flex items-center justify-between pt-2 border-t border-white/10">
        <span className="text-[11px] text-white/40">
          所有提示词与衰减参数均在本地即时生效并持久化存储
        </span>
        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 rounded-lg bg-[hsl(28_85%_62%)] hover:bg-[hsl(28_85%_62%/0.9)] px-5 py-2 text-xs font-semibold text-[hsl(28_30%_10%)] transition-colors shadow-lg active:scale-95"
        >
          {saved ? <Check className="size-3.5" /> : null}
          {saved ? '系统注入设定已更新' : '保存提示词与注入配置'}
        </button>
      </div>

    </div>
  );
}
