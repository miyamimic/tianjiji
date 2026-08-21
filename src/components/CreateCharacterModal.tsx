import React, { useState, useRef } from 'react';
import { 
  X, 
  Sparkles, 
  Upload, 
  Check, 
  User, 
  Layers, 
  ShieldAlert, 
  MessageSquare,
  Eye,
  Camera
} from 'lucide-react';
import { createCustomCharacter, type CreateCharacterInput } from '../lib/customStore';
import { INSTINCT_DESCRIPTIONS, SPEECH_FILTER_DESCRIPTIONS, type Character } from '../data/types';
import { loadLlmConfig, analyzeVisualAvatar } from '../lib/llm';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCharacterCreated: (newChar: Character) => void;
}

export default function CreateCharacterModal({ isOpen, onClose, onCharacterCreated }: Props) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [visualDesc, setVisualDesc] = useState('');
  const [instinct, setInstinct] = useState<'attack' | 'avoid' | 'freeze' | 'fawn' | 'observe'>('observe');
  const [speechFilter, setSpeechFilter] = useState<'rough' | 'gentle' | 'formal' | 'casual'>('casual');
  const [valuesStr, setValuesStr] = useState('掌控感、敏锐、深情');
  const [catchphrasesStr, setCatchphrasesStr] = useState('嗯、有意思、过来');
  const [forbiddenPhrasesStr, setForbiddenPhrasesStr] = useState('对不起嘛、求求你、我不行');
  const [customPrompt, setCustomPrompt] = useState('');
  const [minBubbles, setMinBubbles] = useState<number>(2);
  const [analyzingVision, setAnalyzingVision] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const dataUrl = evt.target?.result as string;
      if (dataUrl) {
        setAvatar(dataUrl);
        // Automatic visual recognition
        setAnalyzingVision(true);
        try {
          const config = loadLlmConfig();
          const desc = await analyzeVisualAvatar(config, dataUrl, 'character', name || '新角色');
          setVisualDesc(desc);
        } catch {
          // ignore
        } finally {
          setAnalyzingVision(false);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const charName = name.trim() || '新角色';
    const values = valuesStr
      .split(/[、,，]/)
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
    const catchphrases = catchphrasesStr
      .split(/[、,，]/)
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
    const forbiddenPhrases = forbiddenPhrasesStr
      .split(/[、,，]/)
      .map((v) => v.trim())
      .filter((v) => v.length > 0);

    const input: CreateCharacterInput = {
      name: charName,
      avatar: avatar || undefined,
      instinct_base: instinct,
      speech_filter: speechFilter,
      values: values.length > 0 ? values : ['独特魅力', '独立个性'],
      catchphrases: catchphrases.length > 0 ? catchphrases : undefined,
      forbidden_phrases: forbiddenPhrases.length > 0 ? forbiddenPhrases : undefined,
      custom_system_prompt: customPrompt.trim() || undefined,
      min_bubbles: minBubbles,
    };

    const newChar = createCustomCharacter(input);
    onCharacterCreated(newChar);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in-0 duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-white/15 bg-[hsl(222_28%_11%)] p-5 text-white shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="size-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="size-8 rounded-full bg-[hsl(28_85%_62%/0.2)] flex items-center justify-center text-[hsl(28_85%_62%)]">
            <Sparkles className="size-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">创建新角色档案</h2>
            <p className="text-xs text-white/40">设定角色的本能直觉、语言风格与专属心理提示词</p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          {/* Avatar and Name */}
          <div className="flex items-center gap-4 p-3 rounded-xl border border-white/10 bg-white/[0.02]">
            <div className="relative group shrink-0">
              <div className="size-16 rounded-full bg-gradient-to-br from-[hsl(28_85%_62%)] to-[hsl(28_85%_62%/0.5)] overflow-hidden flex items-center justify-center text-xl font-bold text-[hsl(28_30%_10%)] border-2 border-white/20 shadow-md">
                {avatar ? (
                  <img src={avatar} alt="Avatar" className="size-full object-cover" />
                ) : (
                  <span>{name.trim() ? name.trim().charAt(0) : '?'}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-white text-[10px]"
              >
                <Camera className="size-4 mb-0.5" />
                <span>换立绘</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>

            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium text-white/80 block">
                角色名字 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：沈星回 / 顾夜白 / 塞壬"
                className="w-full px-3 py-1.5 rounded-lg border border-white/10 bg-black/40 text-sm text-white focus:border-[hsl(28_85%_62%/0.6)] focus:outline-none"
              />
              <p className="text-[10px] text-white/40">
                {analyzingVision ? '✨ 正在自动识别立绘特征...' : '点击左侧头像可上传角色专属立绘/头像图片'}
              </p>
            </div>
          </div>

          {/* Instinct and Speech Filter */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-white/70 block">直觉反应机制 (Instinct)</label>
              <select
                value={instinct}
                onChange={(e: any) => setInstinct(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-white/10 bg-black/60 text-xs text-white focus:outline-none"
              >
                {Object.entries(INSTINCT_DESCRIPTIONS).map(([k, desc]) => (
                  <option key={k} value={k}>
                    {k.toUpperCase()} ({desc.slice(0, 4)})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-white/70 block">语言说话风格 (Speech)</label>
              <select
                value={speechFilter}
                onChange={(e: any) => setSpeechFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-white/10 bg-black/60 text-xs text-white focus:outline-none"
              >
                {Object.entries(SPEECH_FILTER_DESCRIPTIONS).map(([k, desc]) => (
                  <option key={k} value={k}>
                    {k.toUpperCase()} ({desc.slice(0, 4)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Core Values */}
          <div className="space-y-1.5">
            <label className="text-xs text-white/70 block">核心人格特质 / 标签 (顿号或逗号隔开)</label>
            <input
              type="text"
              value={valuesStr}
              onChange={(e) => setValuesStr(e.target.value)}
              placeholder="掌控感、分寸感、占有欲、口是心非"
              className="w-full px-3 py-1.5 rounded-lg border border-white/10 bg-black/40 text-xs text-white focus:outline-none"
            />
          </div>

          {/* Catchphrases & Forbidden Phrases (Individualized per character) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-white/70 block flex items-center justify-between">
                <span>个性口癖习惯 (Catchphrases)</span>
              </label>
              <input
                type="text"
                value={catchphrasesStr}
                onChange={(e) => setCatchphrasesStr(e.target.value)}
                placeholder="例如：啧、过来、切、小家伙"
                className="w-full px-2.5 py-1.5 rounded-lg border border-white/10 bg-black/40 text-xs text-white focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-white/70 block flex items-center justify-between">
                <span>人设违禁词 (Forbidden)</span>
              </label>
              <input
                type="text"
                value={forbiddenPhrasesStr}
                onChange={(e) => setForbiddenPhrasesStr(e.target.value)}
                placeholder="例如：对不起嘛、求求你、我不行"
                className="w-full px-2.5 py-1.5 rounded-lg border border-red-500/20 bg-black/40 text-xs text-red-200 placeholder:text-red-300/30 focus:outline-none"
              />
            </div>
          </div>

          {/* Narrative Paragraph Requirement Notice */}
          <div className="p-3 rounded-xl border border-white/10 bg-white/[0.02] space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white/90 flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-[hsl(28_85%_62%)]" />
                单条沉浸文段标准（动作 + 台词 ≥ 100 字）
              </span>
              <span className="font-mono text-[hsl(28_85%_62%)] font-bold bg-[hsl(28_85%_62%/0.15)] px-2 py-0.5 rounded text-[10px]">
                单条完整段落
              </span>
            </div>
            <p className="text-[10px] text-white/40 leading-relaxed">
              严格分离三要素：thought 仅记录纯心理（不计入字数/不写动作台词）；reply 输出包含（动作细节）与"对话台词"的丰满文段。
            </p>
          </div>

          {/* Custom LLM Prompt Override */}
          <div className="space-y-1.5">
            <label className="text-xs text-white/70 block flex items-center justify-between">
              <span>专属系统提示词 / 剧情设定 (Extra System Prompt)</span>
              <span className="text-[10px] text-white/30">可选</span>
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="例如：你表面上是高傲冷峻的财阀执行官，实际上对主控怀有深入骨髓的执念。说话时语气低沉克制，偶尔带有霸道而隐秘的关心..."
              className="w-full h-20 p-2.5 text-xs rounded-xl border border-white/10 bg-black/50 text-white focus:border-[hsl(28_85%_62%/0.6)] focus:outline-none resize-none leading-relaxed"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-lg bg-[hsl(28_85%_62%)] hover:bg-[hsl(28_85%_62%/0.9)] text-[hsl(28_30%_10%)] transition-colors shadow-lg shadow-[hsl(28_85%_62%/0.2)]"
            >
              <Check className="size-3.5" />
              立即创建并切换
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
