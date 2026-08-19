import React, { useState, useEffect, useRef } from 'react';
import { 
  User, 
  Sparkles, 
  Upload, 
  Check, 
  RotateCcw, 
  Eye, 
  MessageSquare, 
  HelpCircle,
  Camera,
  RefreshCw,
  Sliders,
  ShieldAlert,
  Clipboard
} from 'lucide-react';
import { 
  loadSavedCharacters, 
  saveCharacterEdit, 
  resetCharactersToDefault, 
  loadUserPromptProfile, 
  saveUserPromptProfile,
  loadUserAvatar,
  saveUserAvatar,
  loadUserVisualDesc,
  saveUserVisualDesc,
  loadCharAvatar,
  saveCharAvatar,
  loadCharVisualDesc,
  saveCharVisualDesc
} from '../../lib/customStore';
import { loadLlmConfig, analyzeVisualAvatar } from '../../lib/llm';
import type { Character } from '../../data/types';
import { INSTINCT_DESCRIPTIONS, SPEECH_FILTER_DESCRIPTIONS } from '../../data/types';

interface Props {
  currentCharacterId?: string;
  onEngineReload?: () => void;
}

export default function PersonaApp({ currentCharacterId = 'char_001', onEngineReload }: Props) {
  const [subTab, setSubTab] = useState<'user' | 'character'>('user');
  
  // User Profile State
  const [userProfile, setUserProfile] = useState('');
  const [userAvatar, setUserAvatar] = useState('');
  const [userVisualDesc, setUserVisualDesc] = useState('');
  const [userSaved, setUserSaved] = useState(false);
  const [analyzingUserVision, setAnalyzingUserVision] = useState(false);
  const userFileRef = useRef<HTMLInputElement>(null);

  // Character Cards State
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharId, setSelectedCharId] = useState(currentCharacterId);
  const [editingChar, setEditingChar] = useState<Character | null>(null);
  
  const [charAvatar, setCharAvatar] = useState('');
  const [charVisualDesc, setCharVisualDesc] = useState('');
  const [charName, setCharName] = useState('');
  const [coreValues, setCoreValues] = useState('');
  const [instinct, setInstinct] = useState<'attack' | 'avoid' | 'freeze' | 'fawn' | 'observe'>('observe');
  const [speechFilter, setSpeechFilter] = useState<'rough' | 'gentle' | 'formal' | 'casual'>('casual');
  const [customPrompt, setCustomPrompt] = useState('');
  const [catchphrases, setCatchphrases] = useState('');
  const [forbiddenPhrases, setForbiddenPhrases] = useState('');
  const [controlActions, setControlActions] = useState('');
  const [touchActions, setTouchActions] = useState('');
  const [charSaved, setCharSaved] = useState(false);
  const [analyzingCharVision, setAnalyzingCharVision] = useState(false);
  const charFileRef = useRef<HTMLInputElement>(null);

  // Load initial data
  useEffect(() => {
    setUserProfile(loadUserPromptProfile());
    setUserAvatar(loadUserAvatar());
    setUserVisualDesc(loadUserVisualDesc());

    const chars = loadSavedCharacters();
    setCharacters(chars);
    const target = chars.find((c) => c.character_id === selectedCharId) || chars[0];
    if (target) {
      loadCharData(target);
    }
  }, [selectedCharId]);

  const loadCharData = (c: Character) => {
    setEditingChar(c);
    setCharName(c.name);
    setCharAvatar(loadCharAvatar(c.character_id));
    setCharVisualDesc(loadCharVisualDesc(c.character_id));
    setCoreValues(c.core.values.join('、'));
    setInstinct(c.core.instinct_base);
    setSpeechFilter(c.core.speech_filter);
    setCustomPrompt((c as any).custom_system_prompt || '');
    setCatchphrases(c.speech.catchphrases.join('、'));
    setForbiddenPhrases(c.speech.forbidden_phrases.join('、'));
    setControlActions(c.action_tendency.control_actions.join('、'));
    setTouchActions(c.action_tendency.touch_actions.join('、'));
  };

  // User Avatar Upload
  const handleUserAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const dataUrl = evt.target?.result as string;
      if (dataUrl) {
        setUserAvatar(dataUrl);
        saveUserAvatar(dataUrl);
        // Automatically trigger AI vision analysis
        triggerUserVisionAnalysis(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  // AI Vision Analysis for User
  const triggerUserVisionAnalysis = async (imgData?: string) => {
    const targetImg = imgData || userAvatar;
    if (!targetImg) return;
    setAnalyzingUserVision(true);
    try {
      const config = loadLlmConfig();
      const desc = await analyzeVisualAvatar(config, targetImg, 'user', '主控');
      setUserVisualDesc(desc);
      saveUserVisualDesc(desc);
      onEngineReload?.();
    } finally {
      setAnalyzingUserVision(false);
    }
  };

  // Save User Profile
  const handleSaveUserProfile = () => {
    saveUserPromptProfile(userProfile);
    saveUserAvatar(userAvatar);
    saveUserVisualDesc(userVisualDesc);
    setUserSaved(true);
    onEngineReload?.();
    setTimeout(() => setUserSaved(false), 2000);
  };

  // Character Avatar Upload
  const handleCharAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingChar) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const dataUrl = evt.target?.result as string;
      if (dataUrl) {
        setCharAvatar(dataUrl);
        saveCharAvatar(editingChar.character_id, dataUrl);
        // Automatically trigger AI vision analysis
        triggerCharVisionAnalysis(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  // AI Vision Analysis for Character
  const triggerCharVisionAnalysis = async (imgData?: string) => {
    if (!editingChar) return;
    const targetImg = imgData || charAvatar;
    if (!targetImg) return;
    setAnalyzingCharVision(true);
    try {
      const config = loadLlmConfig();
      const desc = await analyzeVisualAvatar(config, targetImg, 'character', editingChar.name);
      setCharVisualDesc(desc);
      saveCharVisualDesc(editingChar.character_id, desc);
      onEngineReload?.();
    } finally {
      setAnalyzingCharVision(false);
    }
  };

  // Save Character Changes
  const handleSaveCharacter = () => {
    if (!editingChar) return;

    const updatedChar: Character = {
      ...editingChar,
      name: charName.trim() || editingChar.name,
      core: {
        values: coreValues.split(/[、,，]/).map((v) => v.trim()).filter((v) => v.length > 0),
        instinct_base: instinct,
        speech_filter: speechFilter,
      },
      speech: {
        catchphrases: catchphrases.split(/[、,，]/).map((v) => v.trim()).filter((v) => v.length > 0),
        forbidden_phrases: forbiddenPhrases.split(/[、,，]/).map((v) => v.trim()).filter((v) => v.length > 0),
      },
      action_tendency: {
        ...editingChar.action_tendency,
        control_actions: controlActions.split(/[、,，]/).map((v) => v.trim()).filter((v) => v.length > 0),
        touch_actions: touchActions.split(/[、,，]/).map((v) => v.trim()).filter((v) => v.length > 0),
      },
    };

    (updatedChar as any).custom_system_prompt = customPrompt.trim();

    saveCharacterEdit(updatedChar);
    saveCharAvatar(editingChar.character_id, charAvatar);
    saveCharVisualDesc(editingChar.character_id, charVisualDesc);

    const updatedList = loadSavedCharacters();
    setCharacters(updatedList);
    setCharSaved(true);
    onEngineReload?.();
    setTimeout(() => setCharSaved(false), 2000);
  };

  return (
    <div className="space-y-4 text-xs text-white/90 pb-6">
      {/* Sub tabs: User Persona vs Character Cards */}
      <div className="flex p-1 bg-black/40 rounded-xl border border-white/10 select-none">
        <button
          onClick={() => setSubTab('user')}
          className={`flex-1 py-1.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
            subTab === 'user'
              ? 'bg-[hsl(28_85%_62%)] text-[hsl(28_30%_10%)] font-semibold shadow-md'
              : 'text-white/50 hover:text-white'
          }`}
        >
          <User className="size-3.5" />
          主控人设与相貌
        </button>
        <button
          onClick={() => setSubTab('character')}
          className={`flex-1 py-1.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
            subTab === 'character'
              ? 'bg-[hsl(28_85%_62%)] text-[hsl(28_30%_10%)] font-semibold shadow-md'
              : 'text-white/50 hover:text-white'
          }`}
        >
          <Sparkles className="size-3.5" />
          角色卡与立绘设定
        </button>
      </div>

      {/* ================= USER PERSONA TAB ================= */}
      {subTab === 'user' && (
        <div className="space-y-3.5 animate-in fade-in-0 duration-200">
          {/* Avatar Upload & Visual Recognition Card */}
          <div className="p-3.5 rounded-2xl border border-white/10 bg-white/[0.03] space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white flex items-center gap-1.5 text-xs">
                <Camera className="size-3.5 text-[hsl(28_85%_62%)]" />
                主控头像与视觉识别
              </span>
              {userAvatar && (
                <button
                  onClick={() => {
                    setUserAvatar('');
                    setUserVisualDesc('');
                    saveUserAvatar('');
                    saveUserVisualDesc('');
                    onEngineReload?.();
                  }}
                  className="text-[10px] text-white/40 hover:text-red-400"
                >
                  清除头像
                </button>
              )}
            </div>

            <div className="flex gap-3.5 items-center">
              <div 
                onClick={() => userFileRef.current?.click()}
                className="relative size-16 rounded-2xl border-2 border-dashed border-white/20 bg-black/40 overflow-hidden flex items-center justify-center cursor-pointer hover:border-[hsl(28_85%_62%/0.6)] transition-all group shrink-0"
              >
                {userAvatar ? (
                  <img src={userAvatar} alt="User Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-white/40 group-hover:text-white/70">
                    <Upload className="size-5" />
                    <span className="text-[9px]">上传头像</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera className="size-4 text-white" />
                </div>
              </div>

              <input
                ref={userFileRef}
                type="file"
                accept="image/*"
                onChange={handleUserAvatarUpload}
                className="hidden"
              />

              <div className="flex-1 space-y-1.5">
                <p className="text-[10px] text-white/50 leading-relaxed">
                  上传你的主控专属照片或动漫头像。大模型将<b>自动视觉识别</b>你的外貌、发型、穿搭与气质，并在对话中随时产生画面感知！
                </p>
                {userAvatar && (
                  <button
                    type="button"
                    onClick={() => triggerUserVisionAnalysis()}
                    disabled={analyzingUserVision}
                    className="flex items-center gap-1 text-[10px] text-[hsl(28_85%_62%)] bg-[hsl(28_85%_62%/0.12)] hover:bg-[hsl(28_85%_62%/0.25)] border border-[hsl(28_85%_62%/0.3)] px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`size-2.5 ${analyzingUserVision ? 'animate-spin' : ''}`} />
                    {analyzingUserVision ? 'AI 正在深度解析五官与穿搭...' : '重新智能识别外貌'}
                  </button>
                )}
              </div>
            </div>

            {/* Visual Description Output / Editor */}
            <div className="space-y-1 pt-1">
              <label className="text-[11px] font-medium text-white/70 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Eye className="size-3 text-emerald-400" />
                  AI 视觉解析特征（已融入模型感知）：
                </span>
              </label>
              <textarea
                value={userVisualDesc}
                onChange={(e) => setUserVisualDesc(e.target.value)}
                placeholder="上传头像后将自动分析外貌特征，你也可以在此手动微调修改..."
                className="w-full h-16 p-2 rounded-xl border border-white/10 bg-black/50 text-[11px] text-emerald-300 placeholder:text-white/20 focus:border-[hsl(28_85%_62%/0.5)] focus:outline-none resize-none leading-relaxed font-mono"
              />
            </div>
          </div>

          {/* User Persona Text Profile */}
          <div className="p-3.5 rounded-2xl border border-white/10 bg-white/[0.03] space-y-2">
            <label className="text-[11px] font-semibold text-white block flex items-center gap-1.5">
              <User className="size-3.5 text-[hsl(28_85%_62%)]" />
              主控背景与剧情设定（系统提示词注入）
            </label>
            <p className="text-[10px] text-white/40 leading-relaxed">
              在这里定义你的性格特征、与角色的羁绊关系等，将作为 System Prompt 约束角色态度。
            </p>
            <textarea
              value={userProfile}
              onChange={(e) => setUserProfile(e.target.value)}
              placeholder="例如：一个有点敏感、习惯在深夜探访酒馆的探访者，对他的过往有些好奇..."
              className="w-full h-20 p-2.5 rounded-xl border border-white/10 bg-black/50 text-white placeholder:text-white/20 focus:border-[hsl(28_85%_62%/0.5)] focus:outline-none resize-none leading-relaxed"
            />
          </div>

          <button
            onClick={handleSaveUserProfile}
            className="w-full py-2.5 rounded-xl bg-[hsl(28_85%_62%)] hover:bg-[hsl(28_85%_62%/0.9)] text-[hsl(28_30%_10%)] font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-[hsl(28_85%_62%/0.2)]"
          >
            {userSaved ? <Check className="size-4" /> : null}
            {userSaved ? '主控档案已保存并同步' : '保存主控档案与视觉设定'}
          </button>
        </div>
      )}

      {/* ================= CHARACTER TAB ================= */}
      {subTab === 'character' && (
        <div className="space-y-3.5 animate-in fade-in-0 duration-200">
          {/* Character Selector */}
          <div className="flex gap-1.5 p-1 bg-black/40 rounded-xl border border-white/10 overflow-x-auto no-scrollbar">
            {characters.map((c) => (
              <button
                key={c.character_id}
                onClick={() => {
                  setSelectedCharId(c.character_id);
                  loadCharData(c);
                }}
                className={`flex-1 min-w-[70px] py-1.5 rounded-lg text-xs font-medium transition-all truncate ${
                  selectedCharId === c.character_id
                    ? 'bg-white/15 text-white font-semibold shadow'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {editingChar && (
            <>
              {/* Character Avatar & Vision Analysis */}
              <div className="p-3.5 rounded-2xl border border-white/10 bg-white/[0.03] space-y-3">
                <span className="font-semibold text-white flex items-center gap-1.5 text-xs">
                  <Camera className="size-3.5 text-[hsl(28_85%_62%)]" />
                  {editingChar.name} 的立绘头像与视觉识别
                </span>

                <div className="flex gap-3.5 items-center">
                  <div 
                    onClick={() => charFileRef.current?.click()}
                    className="relative size-16 rounded-2xl border-2 border-dashed border-white/20 bg-black/40 overflow-hidden flex items-center justify-center cursor-pointer hover:border-[hsl(28_85%_62%/0.6)] transition-all group shrink-0"
                  >
                    {charAvatar ? (
                      <img src={charAvatar} alt={editingChar.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-white/40 group-hover:text-white/70">
                        <Upload className="size-5" />
                        <span className="text-[9px]">上传立绘</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Camera className="size-4 text-white" />
                    </div>
                  </div>

                  <input
                    ref={charFileRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCharAvatarUpload}
                    className="hidden"
                  />

                  <div className="flex-1 space-y-1.5">
                    <p className="text-[10px] text-white/50 leading-relaxed">
                      支持自定义角色的视觉立绘。大模型将识别其发色、眼眸深浅、穿搭与神态，使扮演更自洽。
                    </p>
                    {charAvatar && (
                      <button
                        type="button"
                        onClick={() => triggerCharVisionAnalysis()}
                        disabled={analyzingCharVision}
                        className="flex items-center gap-1 text-[10px] text-[hsl(28_85%_62%)] bg-[hsl(28_85%_62%/0.12)] hover:bg-[hsl(28_85%_62%/0.25)] border border-[hsl(28_85%_62%/0.3)] px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={`size-2.5 ${analyzingCharVision ? 'animate-spin' : ''}`} />
                        {analyzingCharVision ? '正在解析角色立绘...' : '重新识别角色外貌'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Character Visual Desc */}
                <div className="space-y-1 pt-1">
                  <label className="text-[11px] font-medium text-white/70 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Eye className="size-3 text-cyan-400" />
                      角色自身视觉形象（LLM 记忆注入）：
                    </span>
                  </label>
                  <textarea
                    value={charVisualDesc}
                    onChange={(e) => setCharVisualDesc(e.target.value)}
                    placeholder="上传立绘后自动识别，或在此手动输入外貌形象细节..."
                    className="w-full h-16 p-2 rounded-xl border border-white/10 bg-black/50 text-[11px] text-cyan-300 placeholder:text-white/20 focus:border-[hsl(28_85%_62%/0.5)] focus:outline-none resize-none leading-relaxed font-mono"
                  />
                </div>
              </div>

              {/* Character Attributes */}
              <div className="p-3.5 rounded-2xl border border-white/10 bg-white/[0.03] space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] text-white/40 block mb-1">角色名字</label>
                    <input
                      type="text"
                      value={charName}
                      onChange={(e) => setCharName(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-white/10 bg-black/40 text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/40 block mb-1">直觉机制</label>
                    <select
                      value={instinct}
                      onChange={(e: any) => setInstinct(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-white/10 bg-black/60 text-white focus:outline-none"
                    >
                      {Object.entries(INSTINCT_DESCRIPTIONS).map(([k, desc]) => (
                        <option key={k} value={k}>
                          {k.toUpperCase()} ({desc.slice(0, 4)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-white/40 block mb-1">核心价值特质 (顿号隔开)</label>
                  <input
                    type="text"
                    value={coreValues}
                    onChange={(e) => setCoreValues(e.target.value)}
                    placeholder="掌控感、分寸感、占有欲"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-white/10 bg-black/40 text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-white/40 block mb-1">专属系统提示词 (Extra System Prompt)</label>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="例如：对主控有着隐藏的情愫与占有欲，说话时习惯低笑并靠近..."
                    className="w-full h-16 p-2 rounded-xl border border-white/10 bg-black/50 text-white focus:outline-none resize-none leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] text-white/40 block mb-1">常用口癖 / 词汇</label>
                    <input
                      type="text"
                      value={catchphrases}
                      onChange={(e) => setCatchphrases(e.target.value)}
                      placeholder="啧、过来、嗯？"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-white/10 bg-black/40 text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/40 block mb-1">禁忌短语</label>
                    <input
                      type="text"
                      value={forbiddenPhrases}
                      onChange={(e) => setForbiddenPhrases(e.target.value)}
                      placeholder="对不起、我错了"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-white/10 bg-black/40 text-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleSaveCharacter}
                className="w-full py-2.5 rounded-xl bg-[hsl(28_85%_62%)] hover:bg-[hsl(28_85%_62%/0.9)] text-[hsl(28_30%_10%)] font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-[hsl(28_85%_62%/0.2)]"
              >
                {charSaved ? <Check className="size-4" /> : null}
                {charSaved ? `${editingChar.name} 设定已同步生效` : `保存 ${editingChar.name} 角色卡与设定`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
