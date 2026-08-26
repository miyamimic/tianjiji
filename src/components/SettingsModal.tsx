import React, { useState } from 'react';
import { X, Layers, UserCheck, Sparkles } from 'lucide-react';
import CharacterEditor from './CharacterEditor';
import PromptInjectionEditor from './PromptInjectionEditor';
import { StardewPixelFlower, LinePuppyMascot } from './FrenchLacePuppyElements';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in-0 duration-200 font-serif">
      <div
        className="absolute inset-0 bg-[#4a3e3d]/40 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-4xl lg:max-w-5xl rounded-3xl border-2 border-[#f2d0d9] bg-[#fffafb] shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#f2d0d9] px-5 py-4 bg-white/80 select-none">
          <div className="flex items-center gap-2">
            <LinePuppyMascot size={28} variant="sparkle" />
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold text-[#4a3e3d] tracking-wide">天机机 · 灵犀核心系统控制台</h2>
                <StardewPixelFlower />
              </div>
              <p className="text-[10px] text-[#998380] mt-0.5">
                提示词分层编排、六维情绪自然平复衰减、视觉空间感知与角色卡深度编辑
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-full bg-[#fcedf1] hover:bg-[#fbdde4] text-[#8a3854] transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#f2d0d9] bg-[#fff5f7]/60 text-xs font-semibold px-2 sm:px-4 select-none shrink-0 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('prompt')}
            className={`px-4 py-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'prompt'
                ? 'border-[#e07a93] text-[#8a3854] bg-white font-bold shadow-xs'
                : 'border-transparent text-[#998380] hover:text-[#4a3e3d]'
            }`}
          >
            <Layers className="size-3.5 text-[#e07a93] shrink-0" />
            <span>提示词编排 & 实时推演预览</span>
          </button>
          <button
            onClick={() => setActiveTab('character')}
            className={`px-4 py-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'character'
                ? 'border-[#e07a93] text-[#8a3854] bg-white font-bold shadow-xs'
                : 'border-transparent text-[#998380] hover:text-[#4a3e3d]'
            }`}
          >
            <UserCheck className="size-3.5 text-[#e07a93] shrink-0" />
            <span>角色卡与人设档案定制</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-3.5 sm:p-5 overflow-y-auto min-h-0 bg-[#fdf8f9]/50 custom-scrollbar">
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
