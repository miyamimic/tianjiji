import { useState, useEffect } from 'react';
import { User, ShieldAlert, Heart, MessageSquare, Clipboard, RotateCcw, Check, Sparkles, HelpCircle } from 'lucide-react';
import { loadSavedCharacters, saveCharacterEdit, resetCharactersToDefault, loadUserPromptProfile, saveUserPromptProfile } from '../lib/customStore';
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
  
  // Custom system prompt additions
  const [customPrompt, setCustomPrompt] = useState('');

  // Speech and Actions lists
  const [catchphrases, setCatchphrases] = useState('');
  const [forbiddenPhrases, setForbiddenPhrases] = useState('');
  const [controlActions, setControlActions] = useState('');
  const [touchActions, setTouchActions] = useState('');
  const [forbiddenActions, setForbiddenActions] = useState('');

  // Background Threads
  const [threadContents, setThreadContents] = useState('');

  const [charSaved, setCharSaved] = useState(false);

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
      
      // Load custom instructions (if any custom property exists, or mock it into background thread/values)
      // We will save custom instructions inside a new custom property: `custom_system_prompt` on Character
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

    // Attach custom system prompt
    (updatedChar as any).custom_system_prompt = customPrompt.trim();

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

  return (
    <div className="space-y-6 text-white/90">
      
      {/* 1. User Profile Setup (后主控角色档案) */}
      <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
        <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
          <User className="size-4 text-[hsl(28_85%_62%)]" />
          主控角色档案（你的背景设定 / 提示词发给 LLM）
        </h4>
        <p className="text-[11px] text-white/40 leading-relaxed">
          在这里定义你自己的身份背景、特征或你与角色的关系。此设定会在与 LLM 交互时作为<b>主控人设提示词</b>持久附带，使角色的回复能更加契合你的偏好！
        </p>
        <textarea
          value={userProfile}
          onChange={(e) => setUserProfile(e.target.value)}
          placeholder="例如：一个有点傲娇的学妹，暗恋着学长，平时虽然毒舌但遇到危险时会躲在他身后..."
          className="w-full h-20 p-2.5 text-xs rounded-lg border border-white/10 bg-black/40 text-white placeholder:text-white/20 focus:border-[hsl(28_85%_62%/0.5)] focus:outline-none resize-none leading-relaxed"
        />
        <div className="flex justify-end">
          <button
            onClick={handleSaveUserProfile}
            className="flex items-center gap-1.5 rounded-lg bg-[hsl(28_85%_62%)] hover:bg-[hsl(28_85%_62%/0.9)] px-4 py-1.5 text-xs font-semibold text-[hsl(28_30%_10%)] transition-colors"
          >
            {userProfileSaved ? <Check className="size-3.5 animate-scale-in" /> : null}
            {userProfileSaved ? '主控人设已更新' : '保存主控档案'}
          </button>
        </div>
      </div>

      <div className="border-t border-white/10 pt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
              <Sparkles className="size-4 text-[hsl(28_85%_62%)]" />
              角色卡档案深度编辑
            </h3>
            <p className="text-[11px] text-white/40">在这里，网页上所有的剧情设定和提示词都可以自定义！</p>
          </div>
          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 transition-colors bg-red-400/5 hover:bg-red-400/10 px-2.5 py-1 rounded border border-red-500/10"
          >
            <RotateCcw className="size-3" /> 重置默认角色卡
          </button>
        </div>

        {/* Character Selector tabs */}
        <div className="flex gap-2 p-1 bg-black/20 rounded-lg border border-white/5 mb-4">
          {characters.map((c) => (
            <button
              key={c.character_id}
              onClick={() => handleSwitchEditingCharacter(c.character_id)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                selectedId === c.character_id
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-white/40 hover:text-white/70'
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
                <label className="block text-[11px] text-white/40 mb-1">角色名字 (Name)</label>
                <input
                  type="text"
                  value={charName}
                  onChange={(e) => setCharName(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white focus:outline-none"
                  placeholder="角色名字"
                />
              </div>

              <div>
                <label className="block text-[11px] text-white/40 mb-1">核心价值特质 (Core Values / 逗号隔开)</label>
                <input
                  type="text"
                  value={coreValues}
                  onChange={(e) => setCoreValues(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white focus:outline-none"
                  placeholder="掌控感、分寸感、占有欲..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] text-white/40 mb-1">直觉行为机制 (Instinct Base)</label>
                <select
                  value={instinct}
                  onChange={(e: any) => setInstinct(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-1.5 text-xs text-white focus:outline-none"
                >
                  {Object.entries(INSTINCT_DESCRIPTIONS).map(([k, desc]) => (
                    <option key={k} value={k}>
                      {k.toUpperCase()} ({desc.split('，')[0]})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-white/40 mb-1">口癖/言辞特征 (Speech Filter)</label>
                <select
                  value={speechFilter}
                  onChange={(e: any) => setSpeechFilter(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-1.5 text-xs text-white focus:outline-none"
                >
                  {Object.entries(SPEECH_FILTER_DESCRIPTIONS).map(([k, desc]) => (
                    <option key={k} value={k}>
                      {k.toUpperCase()} ({desc.split('，')[0]})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom Extra LLM System Prompt instructions */}
            <div className="p-3 rounded-xl border border-white/10 bg-white/[0.01] space-y-2">
              <label className="text-[11px] font-semibold text-white/80 block flex items-center gap-1">
                <Clipboard className="size-3.5 text-[hsl(28_85%_62%)]" />
                大模型专属系统提示词 (Extra System Prompt override)
              </label>
              <p className="text-[10px] text-white/40 leading-relaxed">
                这些文本将直接添加进 LLM 的 System Prompt 首部，极其强力地约束大模型的表现方式、背景、口吻或剧情：
              </p>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="例如：你其实是一位隐藏身份的帝国皇子，对主控充满了警惕却又忍不住想靠近。说话时经常夹带占有欲极强的动作..."
                className="w-full h-16 p-2 text-xs rounded-lg border border-white/10 bg-black/40 text-emerald-400 placeholder:text-white/20 focus:outline-none font-mono resize-none leading-normal"
              />
            </div>

            {/* Background threads / Thoughts */}
            <div>
              <label className="block text-[11px] text-white/40 mb-1">
                背景思绪/所处场景 (Background Thoughts / 每行一个)
              </label>
              <textarea
                value={threadContents}
                onChange={(e) => setThreadContents(e.target.value)}
                placeholder="昨晚没睡好，头有点沉&#10;杯子里的威士忌快见底了"
                className="w-full h-16 p-2 text-xs rounded-lg border border-white/10 bg-black/40 text-white placeholder:text-white/20 focus:outline-none font-mono resize-none"
              />
            </div>

            {/* Control & Touch Action Tendencies */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] text-white/40">允许的控制行为 (逗号或、隔开)</label>
                <textarea
                  value={controlActions}
                  onChange={(e) => setControlActions(e.target.value)}
                  className="w-full h-14 p-2 text-xs rounded-lg border border-white/10 bg-black/40 text-white focus:outline-none resize-none leading-relaxed"
                  placeholder="按住肩膀、扣住手腕、拉过来..."
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] text-white/40">允许的亲密接触行为 (逗号或、隔开)</label>
                <textarea
                  value={touchActions}
                  onChange={(e) => setTouchActions(e.target.value)}
                  className="w-full h-14 p-2 text-xs rounded-lg border border-white/10 bg-black/40 text-white focus:outline-none resize-none leading-relaxed"
                  placeholder="轻抚头发、额头相抵、拥入怀里..."
                />
              </div>
            </div>

            {/* Catchphrases and Forbidden */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] text-white/40">特定口头禅 / 常用词 (逗号或、隔开)</label>
                <input
                  type="text"
                  value={catchphrases}
                  onChange={(e) => setCatchphrases(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white focus:outline-none"
                  placeholder="啧、哼、嗯？、行了、过来"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] text-white/40">禁止说的话 / 禁忌词 (逗号或、隔开)</label>
                <input
                  type="text"
                  value={forbiddenPhrases}
                  onChange={(e) => setForbiddenPhrases(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white focus:outline-none"
                  placeholder="对不起、请原谅、我错了"
                />
              </div>
            </div>

            {/* Action buttons */}
            <button
              onClick={handleSaveCharacter}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-[hsl(28_85%_62%)] hover:bg-[hsl(28_85%_62%/0.9)] py-2.5 text-sm font-semibold text-[hsl(28_30%_10%)] transition-colors shadow-lg shadow-[hsl(28_85%_62%/0.15)] mt-3"
            >
              {charSaved ? <Check className="size-4 animate-scale-in" /> : <MessageSquare className="size-4" />}
              {charSaved ? '角色卡与提示词保存并同步成功' : `保存 ${editingChar.name} 角色设定与系统提示词`}
            </button>
          </div>
        )}
      </div>

      {/* Info warning */}
      <div className="rounded-lg border border-white/10 bg-[hsl(222_28%_9%/0.4)] p-3 text-xs leading-relaxed space-y-2 text-white/50">
        <div className="flex items-center gap-1.5 font-semibold text-white/80">
          <HelpCircle className="size-3.5 text-[hsl(28_85%_62%)]" />
          <span>角色编辑如何持久生效？</span>
        </div>
        <p className="text-[11px]">
          1. 修改后，当大模型连接已激活时，您的修改会被转化为<b>定制系统 Prompt 模板</b>实时发给 LLM。<br />
          2. 当使用本地 Mock 演示模式时，修改会重构本地句法引擎（行为倾向和口癖将自动生成）。<br />
          3. 所有修改保存在您的浏览器 localStorage 中，绝不泄露。
        </p>
      </div>

    </div>
  );
}
