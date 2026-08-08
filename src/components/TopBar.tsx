import { useState } from 'react';
import {
  ChevronDown,
  Settings,
  PanelRight,
  Check,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import type { Character } from '../data/types';

interface Props {
  currentCharacter: Character;
  availableCharacters: Character[];
  onSwitchCharacter: (id: string) => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  onClearHistory: () => void;
  onResetEmotion: () => void;
  onOpenSettings: () => void;
  llmReady: boolean;
}

const INSTINCT_CN: Record<string, string> = {
  attack: '攻击',
  avoid: '回避',
  freeze: '冻结',
  fawn: '讨好',
  observe: '观察',
};

export default function TopBar({
  currentCharacter,
  availableCharacters,
  onSwitchCharacter,
  onToggleSidebar,
  sidebarOpen,
  onClearHistory,
  onResetEmotion,
  onOpenSettings,
  llmReady,
}: Props) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 bg-black/30 backdrop-blur-md border-b border-white/5 transition-all duration-300 ${sidebarOpen ? 'pr-80' : 'pr-0'}`}
    >
      <div className="flex h-14 items-center justify-between px-4 md:px-6">
        {/* Left: character info + switch */}
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-full bg-gradient-to-br from-[hsl(28_85%_62%)] to-[hsl(28_85%_62%/0.6)] flex items-center justify-center text-sm font-bold text-[hsl(28_30%_10%)] shadow-lg shadow-[hsl(28_85%_62%/0.2)]">
            {currentCharacter.name.charAt(0)}
          </div>

          <div className="relative">
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              className="flex items-center gap-1 h-9 px-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <span className="font-semibold text-white drop-shadow">{currentCharacter.name}</span>
              <ChevronDown className="size-4 text-white/40" />
            </button>

            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setDropdownOpen(false)}
                />
                <div className="absolute top-full left-0 mt-1 z-50 w-56 rounded-lg border border-white/10 bg-[hsl(220_22%_13%)] shadow-xl overflow-hidden">
                  <div className="px-3 py-2 text-xs font-medium text-white/40 border-b border-white/10">
                    切换角色
                  </div>
                  {availableCharacters.map((char) => (
                    <button
                      key={char.character_id}
                      onClick={() => {
                        onSwitchCharacter(char.character_id);
                        setDropdownOpen(false);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
                    >
                      <div className="size-6 shrink-0 rounded-full bg-[hsl(28_85%_62%/0.2)] flex items-center justify-center text-xs font-semibold text-[hsl(28_85%_62%)]">
                        {char.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white">{char.name}</div>
                        <div className="text-xs text-white/40 truncate">
                          本能：{INSTINCT_CN[char.core.instinct_base]}
                        </div>
                      </div>
                      {char.character_id === currentCharacter.character_id && (
                        <Check className="size-4 text-[hsl(28_85%_62%)]" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* LLM status indicator */}
          <div className="ml-2 flex items-center gap-1.5">
            <div className={`size-2 rounded-full ${llmReady ? 'bg-green-400' : 'bg-white/20'} ${llmReady ? 'animate-pulse' : ''}`} />
            <span className="text-xs text-white/40 hidden sm:inline">
              {llmReady ? 'LLM' : '本地'}
            </span>
          </div>
        </div>

        {/* Right: settings + sidebar toggle */}
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenSettings}
            className="size-9 flex items-center justify-center rounded-lg hover:bg-white/5 text-white/60 hover:text-white transition-colors"
            aria-label="设置"
          >
            <Settings className="size-4" />
          </button>
          <button
            onClick={onToggleSidebar}
            className={`size-9 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors ${sidebarOpen ? 'text-[hsl(28_85%_62%)]' : 'text-white/60 hover:text-white'}`}
            aria-label={sidebarOpen ? '收起侧边栏' : '展开侧边栏'}
          >
            <PanelRight className="size-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
