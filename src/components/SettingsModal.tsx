import React, { useState } from 'react';
import { X, Layers, UserCheck } from 'lucide-react';
import CharacterEditor from './CharacterEditor';
import PromptInjectionEditor from './PromptInjectionEditor';

interface Props {
  open: boolean;
  onClose: () => void;
  currentCharacterId: string;
  onEngineReload: () => void;
}

export default function SettingsModal({
  open,
  onClose,
  currentCharacterId,
  onEngineReload,
}: Props) {
  const [activeTab, setActiveTab] = useState<'prompt' | 'character'>('prompt');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in-0 duration-200">
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-4xl lg:max-w-5xl rounded-2xl border border-white/10 bg-[hsl(220_22%_13%)] shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5 bg-[hsl(220_22%_13%)] select-none">
          <div>
            <h2 className="text-sm font-semibold text-white tracking-wide">天枢引擎核心系统控制台</h2>
            <p className="text-[10px] text-white/40 mt-0.5">
              LLM 提示词注入全流程流水线、六维情感自然平复衰减与角色卡深度编辑
            </p>
          </div>
          <button
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/5 bg-black/20 text-xs font-medium px-2 sm:px-4 select-none shrink-0 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('prompt')}
            className={`px-3 sm:px-4 py-2.5 sm:py-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'prompt'
                ? 'border-[hsl(28_85%_62%)] text-white bg-white/[0.02] font-bold'
                : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            <Layers className="size-3.5 text-[hsl(28_85%_62%)] shrink-0" />
            <span>提示词编排 & 实时预览</span>
          </button>
          <button
            onClick={() => setActiveTab('character')}
            className={`px-3 sm:px-4 py-2.5 sm:py-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'character'
                ? 'border-[hsl(28_85%_62%)] text-white bg-white/[0.02] font-bold'
                : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            <UserCheck className="size-3.5 text-[hsl(28_85%_62%)] shrink-0" />
            <span>角色卡档案编辑</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-3.5 sm:p-5 overflow-y-auto min-h-0 bg-black/5 custom-scrollbar">
          {activeTab === 'prompt' && (
            <PromptInjectionEditor
              currentCharacterId={currentCharacterId}
              onUpdated={onEngineReload}
            />
          )}

          {activeTab === 'character' && (
            <CharacterEditor
              currentCharacterId={currentCharacterId}
              onCharacterUpdated={onEngineReload}
            />
          )}
        </div>
      </div>
    </div>
  );
}
