import React, { useState, useEffect, useRef } from 'react';
import { 
  User, 
  ShieldAlert, 
  Heart, 
  MessageSquare, 
  Clipboard, 
  RotateCcw, 
  Check, 
  Sparkles, 
  HelpCircle, 
  Layers, 
  Swords,
  Download,
  Upload,
  FileText,
  FileJson
} from 'lucide-react';
import { 
  loadSavedCharacters, 
  saveCharacterEdit, 
  resetCharactersToDefault, 
  loadUserPromptProfile, 
  saveUserPromptProfile,
  loadCharMinBubbles,
  saveCharMinBubbles,
  loadCharGomokuRank,
  saveCharGomokuRank,
  type GomokuRank
} from '../lib/customStore';
import { 
  exportCharacterToJson, 
  exportCharacterToDocx, 
  exportAllCharactersToJson, 
  importCharacterFromJson, 
  importCharacterFromDocxOrText 
} from '../lib/characterIO';
import type { Character, CharacterCore } from '../data/types';
import { INSTINCT_DESCRIPTIONS, SPEECH_FILTER_DESCRIPTIONS } from '../data/types';

interface Props {
  currentCharacterId: string;
  onCharacterUpdated: () => void;
}

export default function CharacterEditor({ currentCharacterId, onCharacterUpdated }: Props) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedId, setSelectedId] = useState(currentCharacterId);
  const [editingChar, setEditingChar] = useState<Character | null>(null);

  // User Profile State (主控角色档案)
  const [userProfile, setUserProfile] = useState('');
  const [userProfileSaved, setUserProfileSaved] = useState(false);

  // Character edit fields
  const [charName, setCharName] = useState('');
  const [coreValues, setCoreValues] = useState('');
  const [instinct, setInstinct] = useState<'attack' | 'avoid' | 'freeze' | 'fawn' | 'observe'>('observe');
  const [speechFilter, setSpeechFilter] = useState<'rough' | 'gentle' | 'formal' | 'casual'>('casual');
  
  // Custom system prompt additions & min bubbles
  const [customPrompt, setCustomPrompt] = useState('');
  const [minBubbles, setMinBubbles] = useState<number>(1);
  const [gomokuRank, setGomokuRank] = useState<GomokuRank>('gold');

  // Speech and Actions lists
  const [catchphrases, setCatchphrases] = useState('');
  const [forbiddenPhrases, setForbiddenPhrases] = useState('');
  const [controlActions, setControlActions] = useState('');
  const [touchActions, setTouchActions] = useState('');
  const [forbiddenActions, setForbiddenActions] = useState('');

  // Background Threads
  const [threadContents, setThreadContents] = useState('');

  const [charSaved, setCharSaved] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [ioNotice, setIoNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load characters and user profile
  useEffect(() => {
    const list = loadSavedCharacters();
    setCharacters(list);
    setUserProfile(loadUserPromptProfile());
    
    const current = list.find((c) => c.character_id === selectedId) || list[0];
    if (current) {
      setEditingChar(current);
      // Bind form states
      setCharName(current.name);
      setCoreValues(current.core.values.join('、'));
      setInstinct(current.core.instinct_base);
      setSpeechFilter(current.core.speech_filter);
      setMinBubbles(loadCharMinBubbles(current.character_id));
      setGomokuRank(loadCharGomokuRank(current.character_id));
      
      // Load custom instructions
      setCustomPrompt((current as any).custom_system_prompt || '');

      setCatchphrases(current.speech.catchphrases.join('、'));
      setForbiddenPhrases(current.speech.forbidden_phrases.join('、'));
      
      setControlActions(current.action_tendency.control_actions.join('、'));
      setTouchActions(current.action_tendency.touch_actions.join('、'));
      setForbiddenActions(current.action_tendency.forbidden_actions.join('、'));

      setThreadContents(current.background_threads.active.map((t) => t.content).join('\n'));
    }
  }, [selectedId]);

  const handleSwitchEditingCharacter = (id: string) => {
    setSelectedId(id);
  };

  // Save Character Changes
  const handleSaveCharacter = () => {
    if (!editingChar) return;

    const threadsList = threadContents
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => ({
        content: line,
        remaining_turns: 3,
      }));

    const updatedChar: Character = {
      ...editingChar,
      name: charName.trim(),
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
        forbidden_actions: forbiddenActions.split(/[、,，]/).map((v) => v.trim()).filter((v) => v.length > 0),
      },
      background_threads: {
        active: threadsList,
      },
    };

    // Attach custom system prompt & min bubbles
    (updatedChar as any).custom_system_prompt = customPrompt.trim();
    saveCharMinBubbles(editingChar.character_id, minBubbles);
    saveCharGomokuRank(editingChar.character_id, gomokuRank);

    saveCharacterEdit(updatedChar);
    
    // Refresh local list
    const updatedList = loadSavedCharacters();
    setCharacters(updatedList);
    setCharSaved(true);
    
    // Notify the engine to reload state
    onCharacterUpdated();
    
    setTimeout(() => setCharSaved(false), 2000);
  };

  // Save User Persona Profile (主控角色档案)
  const handleSaveUserProfile = () => {
    saveUserPromptProfile(userProfile);
    setUserProfileSaved(true);
    // Notify the engine to reload prompt if needed
    onCharacterUpdated();
    setTimeout(() => setUserProfileSaved(false), 2000);
  };

  const handleResetDefaults = () => {
    if (confirm('确定要恢复出厂默认角色配置吗？您当前所做的一切角色修改都将丢失！')) {
      resetCharactersToDefault();
      onCharacterUpdated();
      // Reload page state
      const list = loadSavedCharacters();
      setCharacters(list);
      setSelectedId(currentCharacterId);
      setCharSaved(true);
      setTimeout(() => setCharSaved(false), 2000);
    }
  };

  // Character IO handlers
  const handleExportDocx = async () => {
    if (!editingChar) return;
    try {
      setIsExportingDocx(true);
      await exportCharacterToDocx(editingChar);
      setIoNotice(`已成功生成并下载《${editingChar.name}》的 Word 档案卡 (.docx)！`);
    } catch (err: any) {
      setIoNotice(`Word 文档生成失败：${err?.message || err}`);
    } finally {
      setIsExportingDocx(false);
      setTimeout(() => setIoNotice(null), 3500);
    }
  };

  const handleExportJson = () => {
    if (!editingChar) return;
    try {
      exportCharacterToJson(editingChar);
      setIoNotice(`已成功导出《${editingChar.name}》的 JSON 档案！`);
    } catch (err: any) {
      setIoNotice(`导出失败：${err?.message || err}`);
    }
    setTimeout(() => setIoNotice(null), 3000);
  };

  const handleExportAll = () => {
    try {
      exportAllCharactersToJson(characters);
      setIoNotice(`已成功打包导出全部 ${characters.length} 位角色档案！`);
    } catch (err: any) {
      setIoNotice(`导出失败：${err?.message || err}`);
    }
    setTimeout(() => setIoNotice(null), 3000);
  };

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
          setSelectedId(first.character_id);
        }
        setIoNotice(`成功导入 ${res.importedCount} 位角色档案！`);
      } else if (file.name.endsWith('.docx') || file.name.endsWith('.txt')) {
        const imported = await importCharacterFromDocxOrText(file);
        const refreshed = loadSavedCharacters();
        setCharacters(refreshed);
        setSelectedId(imported.character_id);
        setIoNotice(`成功解析并导入《${imported.name}》角色档案！`);
      } else {
        setIoNotice('不支持的文件格式，请上传 .docx 或 .json 角色档案！');
      }
      onCharacterUpdated();
    } catch (err: any) {
      setIoNotice(`导入失败：${err?.message || err}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setIoNotice(null), 3500);
    }
  };

  return (
    <div className="space-y-6 text-[#4a3431] font-serif">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-[#732641] flex items-center gap-1.5">
              <Sparkles className="size-4 text-[#e07a93]" />
              角色卡档案深度编辑 (Character Profile Studio)
            </h3>
            <p className="text-xs text-[#998380]">支持自定义核心人设、言辞口癖与思维动作，并可无缝导入导出 Word DOCX 和 JSON 档案！</p>
          </div>
          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-1 text-[11px] text-[#b83d5a] hover:text-[#912440] transition-colors bg-[#fae1e8]/60 hover:bg-[#fbdde4] px-3 py-1.5 rounded-xl border border-[#f2cad4] cursor-pointer"
          >
            <RotateCcw className="size-3" /> 重置默认角色卡
          </button>
        </div>

        {/* IO Notice Feedback */}
        {ioNotice && (
          <div className="p-3 mb-3 rounded-2xl bg-[#fff0f3] border border-[#f2cad4] text-[#732641] text-xs flex items-center justify-between shadow-sm">
            <span className="font-semibold">{ioNotice}</span>
            <button onClick={() => setIoNotice(null)} className="text-[#b83d5a] hover:text-[#732641] text-xs font-bold px-1.5 cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {/* Character Import / Export Action Bar */}
        <div className="p-3.5 mb-4 rounded-2xl border border-[#f2cad4] bg-[#fff5f7] space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[#732641] flex items-center gap-1.5 text-xs">
              <FileText className="size-3.5 text-[#e07a93]" />
              角色档案导入 / 导出 (Word DOCX & JSON)
            </span>
            <span className="text-[10px] text-[#998380] font-mono">Archive Portable</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={handleExportDocx}
              disabled={isExportingDocx || !editingChar}
              className="p-2 rounded-xl border border-[#f2cad4] bg-white hover:bg-[#fae1e8]/60 text-[#732641] font-semibold text-[11px] transition-all flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs"
              title="生成并下载角色 Word 档案卡"
            >
              <FileText className="size-3 text-[#e07a93]" />
              <span>{isExportingDocx ? '生成 Word 中...' : '导出 Word 档案 (.docx)'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportJson}
              disabled={!editingChar}
              className="p-2 rounded-xl border border-[#f2cad4] bg-white hover:bg-[#fae1e8]/60 text-[#732641] font-semibold text-[11px] transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer shadow-xs"
              title="导出当前角色为 JSON 档案"
            >
              <FileJson className="size-3 text-[#3a8462]" />
              <span>导出 JSON 档案</span>
            </button>

            <button
              type="button"
              onClick={handleExportAll}
              className="p-2 rounded-xl border border-[#f2cad4] bg-white hover:bg-[#fae1e8]/60 text-[#732641] font-semibold text-[11px] transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer shadow-xs"
              title="导出全部已保存角色合集"
            >
              <Download className="size-3 text-[#2d7d9a]" />
              <span>打包导出全部</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-xl border border-[#f2cad4] bg-white hover:bg-[#fae1e8]/60 text-[#732641] font-semibold text-[11px] transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer shadow-xs"
              title="上传 .docx / .json 角色档案"
            >
              <Upload className="size-3 text-[#874ca5]" />
              <span>导入角色档案</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.json,.txt,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>
        </div>

        {/* Character Selector tabs */}
        <div className="flex gap-1.5 p-1 bg-[#fff5f7] rounded-xl border border-[#f2d0d9] mb-4">
          {characters.map((c) => (
            <button
              key={c.character_id}
              onClick={() => handleSwitchEditingCharacter(c.character_id)}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                selectedId === c.character_id
                  ? 'bg-white text-[#732641] shadow-xs border border-[#f2cad4]'
                  : 'text-[#998380] hover:text-[#4a3431]'
              }`}
            >
              {c.name} 的档案编辑
            </button>
          ))}
        </div>

        {editingChar && (
          <div className="space-y-4">
            {/* Character Base Profile Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#785b56] mb-1">角色名字 (Name)</label>
                <input
                  type="text"
                  value={charName}
                  onChange={(e) => setCharName(e.target.value)}
                  className="w-full rounded-xl border border-[#f2cad4] bg-white px-3 py-2 text-xs text-[#4a3431] placeholder:text-[#bda49f] focus:outline-none focus:border-[#e07a93] focus:ring-1 focus:ring-[#e07a93]/30"
                  placeholder="角色名字"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#785b56] mb-1">核心价值特质 (Core Values / 逗号隔开)</label>
                <input
                  type="text"
                  value={coreValues}
                  onChange={(e) => setCoreValues(e.target.value)}
                  className="w-full rounded-xl border border-[#f2cad4] bg-white px-3 py-2 text-xs text-[#4a3431] placeholder:text-[#bda49f] focus:outline-none focus:border-[#e07a93] focus:ring-1 focus:ring-[#e07a93]/30"
                  placeholder="掌控感、分寸感、占有欲..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#785b56] mb-1">直觉行为机制 (Instinct Base)</label>
                <select
                  value={instinct}
                  onChange={(e: any) => setInstinct(e.target.value)}
                  className="w-full rounded-xl border border-[#f2cad4] bg-white px-3 py-2 text-xs text-[#4a3431] focus:outline-none focus:border-[#e07a93] focus:ring-1 focus:ring-[#e07a93]/30 cursor-pointer"
                >
                  {Object.entries(INSTINCT_DESCRIPTIONS).map(([k, desc]) => (
                    <option key={k} value={k}>
                      {k.toUpperCase()} ({desc.split('，')[0]})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#785b56] mb-1">口癖/言辞特征 (Speech Filter)</label>
                <select
                  value={speechFilter}
                  onChange={(e: any) => setSpeechFilter(e.target.value)}
                  className="w-full rounded-xl border border-[#f2cad4] bg-white px-3 py-2 text-xs text-[#4a3431] focus:outline-none focus:border-[#e07a93] focus:ring-1 focus:ring-[#e07a93]/30 cursor-pointer"
                >
                  {Object.entries(SPEECH_FILTER_DESCRIPTIONS).map(([k, desc]) => (
                    <option key={k} value={k}>
                      {k.toUpperCase()} ({desc.split('，')[0]})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Min Reply Bubbles Configuration (单次最少回复气泡数) */}
            <div className="p-3.5 rounded-2xl border border-[#f2cad4] bg-white/80 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#732641] flex items-center gap-1.5">
                  <Layers className="size-3.5 text-[#e07a93]" />
                  单次最少回复气泡数 (分句 JSON 条数)
                </label>
                <span className="text-xs font-mono font-bold text-[#732641] bg-[#fae1e8] border border-[#f2cad4] px-2.5 py-0.5 rounded-lg">
                  至少 {minBubbles} 条连续气泡
                </span>
              </div>
              <p className="text-[11px] text-[#998380] leading-relaxed">
                要求该角色在回复时，必须将台词、心理活动、肢体描写拆分并连发至少 N 个独立的气泡，打造极具沉浸感的分句对话体验。
              </p>
              <div className="grid grid-cols-5 gap-1.5 pt-1">
                {[1, 2, 3, 4, 5].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setMinBubbles(count)}
                    className={`py-2 px-1 text-xs font-semibold rounded-xl border transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                      minBubbles === count
                        ? 'border-[#e07a93] bg-[#fff0f3] text-[#732641] ring-1 ring-[#e07a93]/40 shadow-xs font-bold'
                        : 'border-[#f2cad4] bg-white hover:bg-[#fff5f7] text-[#785b56]'
                    }`}
                  >
                    <span>{count} 条</span>
                    <span className="text-[9px] font-normal opacity-70">
                      {count === 1 ? '单句' : count === 2 ? '动作+句' : count === 3 ? '连发3句' : count === 4 ? '多句连发' : '长篇连发'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Gomoku Skill Level / Rank Configuration (五子棋对局棋力等级) */}
            <div className="p-3.5 rounded-2xl border border-[#f2cad4] bg-white/80 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#732641] flex items-center gap-1.5">
                  <Swords className="size-3.5 text-[#e07a93]" />
                  五子棋角色实力等级 (实力天花板)
                </label>
                <span className="text-xs font-bold text-[#732641] bg-[#fae1e8] border border-[#f2cad4] px-2.5 py-0.5 rounded-lg">
                  {gomokuRank === 'bronze' ? '青铜段位' : gomokuRank === 'silver' ? '白银段位' : gomokuRank === 'gold' ? '黄金段位' : '王者段位'}
                </span>
              </div>
              <p className="text-[11px] text-[#998380] leading-relaxed">
                作为角色进攻杀伤力的上限天花板（仅约束 aggressive 原始算力分数，不限制 LLM 自主选择保守/进攻策略）。
              </p>
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {[
                  { key: 'bronze', label: '青铜', sub: '上限×0.6 (克制攻势)' },
                  { key: 'silver', label: '白银', sub: '上限×0.8 (常规业余)' },
                  { key: 'gold', label: '黄金', sub: '无封顶 (标准高手)' },
                  { key: 'master', label: '王者', sub: '上限×1.2 (杀招凌厉)' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setGomokuRank(item.key as GomokuRank)}
                    className={`py-2 px-1 text-xs font-semibold rounded-xl border transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                      gomokuRank === item.key
                        ? 'border-[#e07a93] bg-[#fff0f3] text-[#732641] ring-1 ring-[#e07a93]/40 shadow-xs font-bold'
                        : 'border-[#f2cad4] bg-white hover:bg-[#fff5f7] text-[#785b56]'
                    }`}
                  >
                    <span>{item.label}</span>
                    <span className="text-[8.5px] font-normal opacity-70 scale-90">{item.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Extra LLM System Prompt instructions */}
            <div className="p-3.5 rounded-2xl border border-[#f2cad4] bg-white/80 space-y-2 shadow-xs">
              <label className="text-xs font-bold text-[#732641] block flex items-center gap-1.5">
                <Clipboard className="size-3.5 text-[#e07a93]" />
                大模型专属系统提示词 (Extra System Prompt override)
              </label>
              <p className="text-[11px] text-[#998380] leading-relaxed">
                这些文本将直接添加进 LLM 的 System Prompt 首部，极其强力地约束大模型的表现方式、背景、口吻或剧情：
              </p>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="例如：你其实是一位隐藏身份的帝国皇子，对主控充满了警惕却又忍不住想靠近。说话时经常夹带占有欲极强的动作..."
                className="w-full h-18 p-2.5 text-xs rounded-xl border border-[#f2cad4] bg-[#fffafb] text-[#4a3431] placeholder:text-[#bda49f] focus:outline-none focus:border-[#e07a93] focus:ring-1 focus:ring-[#e07a93]/30 font-sans resize-none leading-normal"
              />
            </div>

            {/* Background threads / Thoughts */}
            <div>
              <label className="block text-xs font-semibold text-[#785b56] mb-1">
                背景思绪/所处场景 (Background Thoughts / 每行一个)
              </label>
              <textarea
                value={threadContents}
                onChange={(e) => setThreadContents(e.target.value)}
                placeholder="昨晚没睡好，头有点沉&#10;杯子里的威士忌快见底了"
                className="w-full h-18 p-2.5 text-xs rounded-xl border border-[#f2cad4] bg-white text-[#4a3431] placeholder:text-[#bda49f] focus:outline-none focus:border-[#e07a93] focus:ring-1 focus:ring-[#e07a93]/30 font-sans resize-none"
              />
            </div>

            {/* Control & Touch Action Tendencies */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#785b56]">允许的控制行为 (逗号或、隔开)</label>
                <textarea
                  value={controlActions}
                  onChange={(e) => setControlActions(e.target.value)}
                  className="w-full h-16 p-2.5 text-xs rounded-xl border border-[#f2cad4] bg-white text-[#4a3431] placeholder:text-[#bda49f] focus:outline-none focus:border-[#e07a93] focus:ring-1 focus:ring-[#e07a93]/30 resize-none leading-relaxed"
                  placeholder="按住肩膀、扣住手腕、拉过来..."
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#785b56]">允许的亲密接触行为 (逗号或、隔开)</label>
                <textarea
                  value={touchActions}
                  onChange={(e) => setTouchActions(e.target.value)}
                  className="w-full h-16 p-2.5 text-xs rounded-xl border border-[#f2cad4] bg-white text-[#4a3431] placeholder:text-[#bda49f] focus:outline-none focus:border-[#e07a93] focus:ring-1 focus:ring-[#e07a93]/30 resize-none leading-relaxed"
                  placeholder="轻抚头发、额头相抵、拥入怀里..."
                />
              </div>
            </div>

            {/* Catchphrases and Forbidden */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#785b56]">特定口头禅 / 常用词 (逗号或、隔开)</label>
                <input
                  type="text"
                  value={catchphrases}
                  onChange={(e) => setCatchphrases(e.target.value)}
                  className="w-full rounded-xl border border-[#f2cad4] bg-white px-3 py-2 text-xs text-[#4a3431] placeholder:text-[#bda49f] focus:outline-none focus:border-[#e07a93] focus:ring-1 focus:ring-[#e07a93]/30"
                  placeholder="啧、哼、嗯？、行了、过来"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#785b56]">禁止说的话 / 禁忌词 (逗号或、隔开)</label>
                <input
                  type="text"
                  value={forbiddenPhrases}
                  onChange={(e) => setForbiddenPhrases(e.target.value)}
                  className="w-full rounded-xl border border-[#f2cad4] bg-white px-3 py-2 text-xs text-[#4a3431] placeholder:text-[#bda49f] focus:outline-none focus:border-[#e07a93] focus:ring-1 focus:ring-[#e07a93]/30"
                  placeholder="对不起、请原谅、我错了"
                />
              </div>
            </div>

            {/* Action buttons */}
            <button
              onClick={handleSaveCharacter}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#d95b77] to-[#b83d5a] hover:from-[#c94d6a] hover:to-[#a73550] py-2.5 text-sm font-bold text-white transition-all shadow-md shadow-[#b83d5a]/20 mt-3 cursor-pointer"
            >
              {charSaved ? <Check className="size-4 animate-scale-in" /> : <MessageSquare className="size-4" />}
              {charSaved ? '角色卡与提示词保存并同步成功' : `保存 ${editingChar.name} 角色设定与系统提示词`}
            </button>
          </div>
        )}
      </div>

      {/* Info warning */}
      <div className="rounded-2xl border border-[#f2d0d9] bg-[#fffafb] p-4 text-xs leading-relaxed space-y-2 text-[#785b56] shadow-xs">
        <div className="flex items-center gap-1.5 font-bold text-[#732641]">
          <HelpCircle className="size-3.5 text-[#e07a93]" />
          <span>角色编辑如何持久生效？</span>
        </div>
        <p className="text-[11px] text-[#998380]">
          1. 修改后，当大模型连接已激活时，您的修改会被转化为<b>定制系统 Prompt 模板</b>实时发给 LLM。<br />
          2. 当使用本地 Mock 演示模式时，修改会重构本地句法引擎（行为倾向和口癖将自动生成）。<br />
          3. 所有修改保存在您的浏览器 localStorage 中，绝不泄露。
        </p>
      </div>

    </div>
  );
}
