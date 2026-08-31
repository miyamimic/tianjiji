import React, { useState } from 'react';
import { X, Layers, UserCheck, Sparkles, BookmarkCheck, Database } from 'lucide-react';
import CharacterEditor from './CharacterEditor';
import PromptInjectionEditor from './PromptInjectionEditor';
import PromptPresetsManager from './PromptPresetsManager';
import DataBackupModal from './DataBackupModal';
import { StardewPixelFlower, LinePuppyMascot } from './FrenchLacePuppyElements';

interface Props {
  open: boolean;
  onClose: () => void;
  currentCharacterId: string;
  onEngineReload: () => void;
  defaultTab?: 'presets' | 'prompt' | 'character' | 'backup';
}

export default function SettingsModal({
  open,
  onClose,
  currentCharacterId,
  onEngineReload,
  defaultTab = 'presets',
}: Props) {
  const [activeTab, setActiveTab] = useState<'presets' | 'prompt' | 'character' | 'backup'>(defaultTab);

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
                本地存储管理、全量/单项分文件备份与导入恢复、提示词预设方案库与角色卡定制
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
          {/* Tab 1: 提示词预设 */}
          <button
            onClick={() => setActiveTab('presets')}
            className={`px-4 py-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'presets'
                ? 'border-[#e07a93] text-[#8a3854] bg-white font-bold shadow-xs'
                : 'border-transparent text-[#998380] hover:text-[#4a3e3d]'
            }`}
          >
            <BookmarkCheck className="size-3.5 text-[#e07a93] shrink-0" />
            <span>提示词预设方案</span>
          </button>

          {/* Tab 2: 提示词编排 */}
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

          {/* Tab 3: 角色卡 */}
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

          {/* Tab 4: 数据备份与恢复 */}
          <button
            onClick={() => setActiveTab('backup')}
            className={`px-4 py-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'backup'
                ? 'border-[#e07a93] text-[#8a3854] bg-white font-bold shadow-xs'
                : 'border-transparent text-[#998380] hover:text-[#4a3e3d]'
            }`}
          >
            <Database className="size-3.5 text-[#e07a93] shrink-0" />
            <span>数据备份与导入恢复</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-3.5 sm:p-5 overflow-y-auto min-h-0 bg-[#fdf8f9]/50 custom-scrollbar">
          {activeTab === 'presets' && (
            <PromptPresetsManager
              currentCharacterId={currentCharacterId}
              onUpdated={onEngineReload}
              onNavigateToPipeline={() => setActiveTab('prompt')}
            />
          )}

          {activeTab === 'prompt' && (
            <PromptInjectionEditor
              currentCharacterId={currentCharacterId}
              onUpdated={onEngineReload}
              onNavigateToPresets={() => setActiveTab('presets')}
            />
          )}

          {activeTab === 'character' && (
            <CharacterEditor
              currentCharacterId={currentCharacterId}
              onCharacterUpdated={onEngineReload}
            />
          )}

          {activeTab === 'backup' && (
            <DataBackupModal
              currentCharacterId={currentCharacterId}
              onDataImported={onEngineReload}
            />
          )}
        </div>
      </div>
    </div>
  );
}
