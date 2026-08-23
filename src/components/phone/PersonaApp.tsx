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
  Clipboard,
  Swords,
  Download,
  FileText,
  FileJson,
  Plus
} from 'lucide-react';
import { 
  exportCharacterToJson, 
  exportCharacterToDocx, 
  exportAllCharactersToJson, 
  importCharacterFromJson, 
  importCharacterFromDocxOrText 
} from '../../lib/characterIO';
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
  saveCharVisualDesc,
  loadCharMinBubbles,
  saveCharMinBubbles,
  loadCharGomokuRank,
  saveCharGomokuRank,
  type GomokuRank
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
  const [minBubbles, setMinBubbles] = useState<number>(1);
  const [gomokuRank, setGomokuRank] = useState<GomokuRank>('gold');
  const [catchphrases, setCatchphrases] = useState('');
  const [forbiddenPhrases, setForbiddenPhrases] = useState('');
  const [controlActions, setControlActions] = useState('');
  const [touchActions, setTouchActions] = useState('');
  const [charSaved, setCharSaved] = useState(false);
  const [analyzingCharVision, setAnalyzingCharVision] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [charIoNotice, setCharIoNotice] = useState<string | null>(null);

  const charFileRef = useRef<HTMLInputElement>(null);
  const importCharFileRef = useRef<HTMLInputElement>(null);

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
    setMinBubbles(loadCharMinBubbles(c.character_id));
    setGomokuRank(loadCharGomokuRank(c.character_id));
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
    saveCharMinBubbles(editingChar.character_id, minBubbles);
    saveCharGomokuRank(editingChar.character_id, gomokuRank);
    saveCharAvatar(editingChar.character_id, charAvatar);
    saveCharVisualDesc(editingChar.character_id, charVisualDesc);

    const updatedList = loadSavedCharacters();
    setCharacters(updatedList);
    setCharSaved(true);
    onEngineReload?.();
    setTimeout(() => setCharSaved(false), 2000);
  };

  // Export handlers
  const handleExportDocx = async () => {
    if (!editingChar) return;
    try {
      setIsExportingDocx(true);
      await exportCharacterToDocx(editingChar);
      setCharIoNotice(`已成功生成并下载《${editingChar.name}》的 Word 档案 (.docx)！`);
    } catch (err: any) {
      setCharIoNotice(`Word 文档生成失败：${err?.message || err}`);
    } finally {
      setIsExportingDocx(false);
      setTimeout(() => setCharIoNotice(null), 3500);
    }
  };

  const handleExportJson = () => {
    if (!editingChar) return;
    try {
      exportCharacterToJson(editingChar);
      setCharIoNotice(`已成功导出《${editingChar.name}》的 JSON 档案！`);
    } catch (err: any) {
      setCharIoNotice(`导出失败：${err?.message || err}`);
    }
    setTimeout(() => setCharIoNotice(null), 3000);
  };

  const handleExportAll = () => {
    try {
      exportAllCharactersToJson(characters);
      setCharIoNotice(`已成功打包导出全部 ${characters.length} 位角色档案合集！`);
    } catch (err: any) {
      setCharIoNotice(`导出失败：${err?.message || err}`);
    }
    setTimeout(() => setCharIoNotice(null), 3000);
  };

  // Import file handler (supports .docx, .json, .txt)
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        const res = importCharacterFromJson(text);
        const refreshed = loadSavedCharacters();
        setCharacters(refreshed);
        if (res.characters.length > 0) {
          const first = res.characters[0];
          setSelectedCharId(first.character_id);
          loadCharData(first);
        }
        setCharIoNotice(`成功导入 ${res.importedCount} 位角色档案！`);
      } else if (file.name.endsWith('.docx') || file.name.endsWith('.txt')) {
        const imported = await importCharacterFromDocxOrText(file);
        const refreshed = loadSavedCharacters();
        setCharacters(refreshed);
        setSelectedCharId(imported.character_id);
        loadCharData(imported);
        setCharIoNotice(`成功解析并导入《${imported.name}》角色档案！`);
      } else {
        setCharIoNotice('不支持的文件格式，请上传 .docx 或 .json 角色档案！');
      }
      onEngineReload?.();
    } catch (err: any) {
      setCharIoNotice(`导入失败：${err?.message || err}`);
    } finally {
      if (importCharFileRef.current) importCharFileRef.current.value = '';
      setTimeout(() => setCharIoNotice(null), 3500);
    }
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
          {/* IO Feedback Banner */}
          {charIoNotice && (
            <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-[11px] flex items-center justify-between shadow-lg animate-in fade-in-0 duration-150">
              <span>{charIoNotice}</span>
              <button 
                onClick={() => setCharIoNotice(null)}
                className="text-amber-300 hover:text-white ml-2 text-xs font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* Export / Import Character Archive Toolbar */}
          <div className="p-3 rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-950/40 via-stone-900/60 to-black/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-300 flex items-center gap-1.5 text-xs">
                <FileText className="size-3.5 text-amber-400" />
                角色档案导入 / 导出 (Word DOCX & JSON)
              </span>
              <span className="text-[9px] text-amber-300/70 font-mono">Portable Persona</span>
            </div>
            <p className="text-[10px] text-white/60 leading-relaxed">
              支持导出为标准排版的 Microsoft Word (.docx) 档案卡、或多角色 JSON 配置文件，随时备份与迁移。
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
              <button
                type="button"
                onClick={handleExportDocx}
                disabled={isExportingDocx || !editingChar}
                className="p-1.5 rounded-xl border border-amber-400/40 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-semibold text-[10px] transition-all flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs"
                title="生成并下载角色 Word 档案卡"
              >
                <FileText className="size-3 text-amber-300" />
                <span>{isExportingDocx ? '生成 Word 中...' : '导出 Word 档案'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportJson}
                disabled={!editingChar}
                className="p-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 font-medium text-[10px] transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                title="导出单角色 JSON 格式"
              >
                <FileJson className="size-3 text-emerald-400" />
                <span>导出 JSON</span>
              </button>

              <button
                type="button"
                onClick={handleExportAll}
                className="p-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 font-medium text-[10px] transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                title="导出全部已保存角色合集"
              >
                <Download className="size-3 text-cyan-300" />
                <span>打包导出全部</span>
              </button>

              <button
                type="button"
                onClick={() => importCharFileRef.current?.click()}
                className="p-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 font-medium text-[10px] transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                title="导入 .docx / .json 角色档案"
              >
                <Upload className="size-3 text-purple-300" />
                <span>导入角色档案</span>
              </button>

              <input
                ref={importCharFileRef}
                type="file"
                accept=".docx,.json,.txt,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleImportFile}
                className="hidden"
              />
            </div>
          </div>

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

                {/* Min Reply Bubbles Selector */}
                <div className="p-2.5 rounded-xl border border-white/10 bg-black/30 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-white/90">每次最少回复气泡数</span>
                    <span className="font-mono text-[hsl(28_85%_62%)] font-bold bg-[hsl(28_85%_62%/0.15)] px-2 py-0.5 rounded">
                      至少 {minBubbles} 条
                    </span>
                  </div>
                  <p className="text-[9px] text-white/40">
                    要求 LLM 每次回复必须将动作与台词拆分输出为至少 N 个独立的连续气泡 JSON。
                  </p>
                  <div className="grid grid-cols-5 gap-1 pt-0.5">
                    {[1, 2, 3, 4, 5].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setMinBubbles(cnt)}
                        className={`py-1.5 text-[10px] font-bold rounded-lg border transition-all ${
                          minBubbles === cnt
                            ? 'border-[hsl(28_85%_62%)] bg-[hsl(28_85%_62%/0.2)] text-[hsl(28_85%_62%)]'
                            : 'border-white/10 bg-black/40 text-white/40 hover:text-white/80'
                        }`}
                      >
                        {cnt} 条
                      </button>
                    ))}
                  </div>
                </div>

                {/* Gomoku Rank Selector */}
                <div className="p-2.5 rounded-xl border border-white/10 bg-black/30 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-white/90 flex items-center gap-1">
                      <Swords className="size-3 text-amber-400" />
                      五子棋对局等级上限
                    </span>
                    <span className="font-bold text-amber-300 bg-amber-500/15 border border-amber-400/30 px-2 py-0.5 rounded text-[10px]">
                      {gomokuRank === 'bronze' ? '青铜段位' : gomokuRank === 'silver' ? '白银段位' : gomokuRank === 'gold' ? '黄金段位' : '王者段位'}
                    </span>
                  </div>
                  <p className="text-[9px] text-white/40">
                    约束角色进攻杀伤力的上限天花板（不干涉保守/稳健选点与 LLM 自主策略意图）。
                  </p>
                  <div className="grid grid-cols-4 gap-1 pt-0.5">
                    {[
                      { key: 'bronze', label: '青铜', sub: '上限×0.6' },
                      { key: 'silver', label: '白银', sub: '上限×0.8' },
                      { key: 'gold', label: '黄金', sub: '无封顶' },
                      { key: 'master', label: '王者', sub: '上限×1.2' },
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setGomokuRank(item.key as GomokuRank)}
                        className={`py-1 text-[10px] font-bold rounded-lg border transition-all flex flex-col items-center ${
                          gomokuRank === item.key
                            ? 'border-amber-400 bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/40'
                            : 'border-white/10 bg-black/40 text-white/40 hover:text-white/80'
                        }`}
                      >
                        <span>{item.label}</span>
                        <span className="text-[8px] font-normal opacity-70 scale-90">{item.sub}</span>
                      </button>
                    ))}
                  </div>
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
