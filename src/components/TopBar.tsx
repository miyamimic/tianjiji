import { useState, useEffect } from 'react';
import {
  ChevronDown,
  Settings,
  PanelRight,
  Check,
  RotateCcw,
  X,
  Flame,
  CloudRain,
  Wind,
  Volume2,
  VolumeX,
  Plus,
  Sparkles,
} from 'lucide-react';
import type { Character } from '../data/types';
import { loadCharAvatar } from '../lib/customStore';
import { ambiencePlayer, type AmbienceState } from '../lib/ambiencePlayer';
import CreateCharacterModal from './CreateCharacterModal';

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
  portrait?: boolean;
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
  portrait = false,
}: Props) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [ambience, setAmbience] = useState<AmbienceState>(() => ambiencePlayer.getState());
  const charAvatar = loadCharAvatar(currentCharacter.character_id);

  useEffect(() => {
    const unsub = ambiencePlayer.subscribe((state) => {
      setAmbience(state);
    });
    return unsub;
  }, []);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-40 bg-black/30 backdrop-blur-md border-b border-white/5 transition-all duration-300 ${(!portrait && sidebarOpen) ? 'pr-80' : 'pr-0'}`}
      >
        <div className="flex h-14 items-center justify-between pl-14 sm:pl-16 pr-4 md:px-6">
          {/* Left: character info + horizontal avatar switcher */}
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-full bg-gradient-to-br from-[hsl(28_85%_62%)] to-[hsl(28_85%_62%/0.6)] flex items-center justify-center text-sm font-bold text-[hsl(28_30%_10%)] shadow-lg shadow-[hsl(28_85%_62%/0.2)] overflow-hidden border border-white/20 shrink-0">
              {charAvatar ? (
                <img src={charAvatar} alt={currentCharacter.name} className="w-full h-full object-cover" />
              ) : (
                currentCharacter.name.charAt(0)
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                className="flex items-center gap-1.5 h-9 px-2.5 rounded-xl hover:bg-white/10 transition-all border border-transparent hover:border-white/10 active:scale-95"
              >
                <span className="font-semibold text-white drop-shadow text-sm">{currentCharacter.name}</span>
                <ChevronDown className={`size-3.5 text-white/50 transition-transform duration-200 ${dropdownOpen ? 'rotate-180 text-[hsl(28_85%_62%)]' : ''}`} />
              </button>

              {/* Horizontal character avatar popover bar (横的小框横着罗列角色) */}
              {dropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setDropdownOpen(false)}
                  />
                  <div className="absolute top-full left-0 mt-2 z-50 rounded-2xl border border-white/15 bg-[hsl(222_28%_11%/0.95)] shadow-2xl backdrop-blur-2xl p-3 min-w-[280px] max-w-[88vw] sm:max-w-md animate-in fade-in-0 zoom-in-95 duration-150 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-medium text-white/50 px-1 border-b border-white/10 pb-1.5">
                      <span className="flex items-center gap-1">
                        <Sparkles className="size-3 text-[hsl(28_85%_62%)]" />
                        切换角色档案
                      </span>
                      <span className="text-[10px] text-white/40">已载入 {availableCharacters.length} 位角色</span>
                    </div>

                    <div className="flex items-center gap-3 overflow-x-auto py-1 px-1 no-scrollbar">
                      {availableCharacters.map((char) => {
                        const avatar = loadCharAvatar(char.character_id);
                        const isSelected = char.character_id === currentCharacter.character_id;
                        return (
                          <button
                            key={char.character_id}
                            onClick={() => {
                              onSwitchCharacter(char.character_id);
                              setDropdownOpen(false);
                            }}
                            className="flex flex-col items-center gap-1.5 group shrink-0 transition-transform active:scale-95"
                            title={`${char.name}（本能：${INSTINCT_CN[char.core.instinct_base] || char.core.instinct_base}）`}
                          >
                            <div className="relative">
                              <div
                                className={`size-12 rounded-full overflow-hidden flex items-center justify-center font-bold text-sm transition-all ${
                                  isSelected
                                    ? 'ring-2 ring-[hsl(28_85%_62%)] ring-offset-2 ring-offset-[hsl(222_28%_11%)] bg-gradient-to-br from-[hsl(28_85%_62%)] to-[hsl(28_85%_62%/0.7)] text-[hsl(28_30%_10%)] shadow-lg shadow-[hsl(28_85%_62%/0.35)] scale-105'
                                    : 'border border-white/15 bg-white/5 text-white/70 hover:border-white/40 hover:bg-white/10 group-hover:scale-105'
                                }`}
                              >
                                {avatar ? (
                                  <img src={avatar} alt={char.name} className="size-full object-cover" />
                                ) : (
                                  char.name.charAt(0)
                                )}
                              </div>
                              {isSelected && (
                                <div className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-[hsl(28_85%_62%)] text-[hsl(28_30%_10%)] flex items-center justify-center shadow">
                                  <Check className="size-2.5 stroke-[3]" />
                                </div>
                              )}
                            </div>
                            <span
                              className={`text-[11px] max-w-[56px] truncate text-center transition-colors ${
                                isSelected ? 'font-semibold text-white' : 'text-white/60 group-hover:text-white'
                              }`}
                            >
                              {char.name}
                            </span>
                          </button>
                        );
                      })}

                      {/* Divider */}
                      <div className="w-[1px] h-10 bg-white/10 shrink-0 mx-0.5" />

                      {/* + 创建新角色按钮 */}
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          setCreateModalOpen(true);
                        }}
                        className="flex flex-col items-center gap-1.5 group shrink-0 transition-transform active:scale-95 cursor-pointer"
                        title="创建新角色"
                      >
                        <div className="size-12 rounded-full border-2 border-dashed border-[hsl(28_85%_62%/0.6)] hover:border-[hsl(28_85%_62%)] bg-[hsl(28_85%_62%/0.1)] hover:bg-[hsl(28_85%_62%/0.25)] text-[hsl(28_85%_62%)] flex items-center justify-center transition-all group-hover:scale-105 shadow-sm">
                          <Plus className="size-5" />
                        </div>
                        <span className="text-[11px] font-medium text-[hsl(28_85%_62%)] whitespace-nowrap">
                          创建角色
                        </span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* LLM status indicator */}
            <div className="ml-1 sm:ml-2 flex items-center gap-1.5">
              <div className={`size-2 rounded-full ${llmReady ? 'bg-green-400' : 'bg-white/20'} ${llmReady ? 'animate-pulse' : ''}`} />
              <span className="text-xs text-white/40 hidden sm:inline">
                {llmReady ? 'LLM' : '本地'}
              </span>
            </div>

            {/* Ambient Sound Status Indicator */}
            {ambience.activeSound && (
              <button
                onClick={() => ambiencePlayer.stop()}
                className="ml-1 sm:ml-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 hover:bg-red-500/20 text-white/80 hover:text-red-300 border border-white/10 transition-colors text-[11px]"
                title={`正在播放白噪音：${
                  ambience.activeSound === 'fire' ? '壁炉篝火' : ambience.activeSound === 'rain' ? '夜雨微澜' : '林间清风'
                }（点击关闭）`}
              >
                {ambience.activeSound === 'fire' && <Flame className="size-3 text-amber-400 animate-pulse" />}
                {ambience.activeSound === 'rain' && <CloudRain className="size-3 text-cyan-400 animate-bounce" />}
                {ambience.activeSound === 'wind' && <Wind className="size-3 text-emerald-400 animate-pulse" />}
                <span className="text-[10px] hidden md:inline">
                  {ambience.activeSound === 'fire' ? '篝火' : ambience.activeSound === 'rain' ? '夜雨' : '清风'}
                </span>
              </button>
            )}
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

      {/* Create Character Modal Dialog */}
      <CreateCharacterModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCharacterCreated={(newChar) => {
          onSwitchCharacter(newChar.character_id);
        }}
      />
    </>
  );
}

