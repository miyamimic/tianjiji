import { useState, useEffect } from 'react';
import {
  ChevronDown,
  Settings,
  PanelRight,
  Check,
  Flame,
  CloudRain,
  Wind,
  Plus,
  Sparkles,
  Heart,
} from 'lucide-react';
import type { Character } from '../data/types';
import { loadCharAvatar } from '../lib/customStore';
import { ambiencePlayer, type AmbienceState } from '../lib/ambiencePlayer';
import CreateCharacterModal from './CreateCharacterModal';
import { LinePuppyMascot, LinePuppyDoodle, FlowerLacePattern, StardewPixelFlower, CuteBlueFishIcon } from './FrenchLacePuppyElements';

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
        className={`fixed top-0 left-0 right-0 z-40 bg-white/70 backdrop-blur-xl border-b border-[#f2d0d9] shadow-sm transition-all duration-300 ${
          !portrait && sidebarOpen ? 'pr-80' : 'pr-0'
        }`}
      >
        {/* Subtle Decorative Floral Lace Ribbon */}
        <div className="absolute inset-x-0 -bottom-1.5 h-1.5 overflow-hidden flex justify-center text-[#e07a93] opacity-40 pointer-events-none">
          <FlowerLacePattern className="w-full h-full object-cover" />
        </div>

        <div className="flex h-14 items-center justify-between pl-14 sm:pl-16 pr-3 md:px-6">
          {/* Left: character info + horizontal avatar switcher + cute puppy mascot */}
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-full bg-gradient-to-br from-[#fcd3de] to-[#f7a8be] flex items-center justify-center text-sm font-serif font-bold text-[#8a3854] shadow-md shadow-[#e07a93]/20 overflow-hidden border-2 border-white shrink-0 relative group">
              {charAvatar ? (
                <img src={charAvatar} alt={currentCharacter.name} className="w-full h-full object-cover" />
              ) : (
                currentCharacter.name.charAt(0)
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                className="flex items-center gap-1.5 h-9 px-2.5 rounded-full bg-white/60 hover:bg-white/90 transition-all border border-[#f2d0d9] hover:border-[#e07a93] active:scale-95 shadow-sm"
              >
                <Heart className="size-4 fill-[#b83d5a] text-[#b83d5a] mr-0.5 shrink-0" />
                <span className="font-serif font-bold text-[#732641] text-[14.5px] tracking-wide [text-shadow:0_1px_2px_rgba(224,122,147,0.3),0_2px_4px_rgba(115,38,65,0.12)]">
                  {currentCharacter.name}
                </span>
                <ChevronDown
                  className={`size-3.5 text-[#998380] transition-transform duration-200 ${
                    dropdownOpen ? 'rotate-180 text-[#e07a93]' : ''
                  }`}
                />
              </button>

              {/* Horizontal character avatar popover bar (French Vintage Lace Card) */}
              {dropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setDropdownOpen(false)}
                  />
                  <div className="absolute top-full left-0 mt-2 z-50 rounded-2xl border-2 border-[#f2d0d9] bg-[#fffafb]/95 shadow-2xl backdrop-blur-2xl p-3.5 min-w-[290px] max-w-[88vw] sm:max-w-md animate-in fade-in-0 zoom-in-95 duration-150 space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] font-serif font-medium text-[#8a3854] px-1 border-b border-[#f2d0d9] pb-1.5">
                      <span className="flex items-center gap-1.5 font-bold">
                        <Sparkles className="size-3 text-[#e07a93]" />
                        切换角色档案与情境
                      </span>
                      <span className="text-[10px] text-[#998380]">已载入 {availableCharacters.length} 位角色</span>
                    </div>

                    <div className="flex items-center gap-3 overflow-x-auto py-1.5 px-1 no-scrollbar">
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
                            className="flex flex-col items-center gap-1.5 group shrink-0 transition-transform active:scale-95 cursor-pointer"
                            title={`${char.name}（本能：${INSTINCT_CN[char.core.instinct_base] || char.core.instinct_base}）`}
                          >
                            <div className="relative">
                              <div
                                className={`size-12 rounded-full overflow-hidden flex items-center justify-center font-serif font-bold text-sm transition-all ${
                                  isSelected
                                    ? 'ring-2 ring-[#e07a93] ring-offset-2 ring-offset-white bg-gradient-to-br from-[#fcd3de] to-[#e07a93] text-white shadow-md shadow-[#e07a93]/30 scale-105'
                                    : 'border-2 border-white bg-[#fcedf1] text-[#8a3854] hover:border-[#f2d0d9] hover:bg-[#fae2ea] group-hover:scale-105 shadow-sm'
                                }`}
                              >
                                {avatar ? (
                                  <img src={avatar} alt={char.name} className="size-full object-cover" />
                                ) : (
                                  char.name.charAt(0)
                                )}
                              </div>
                              {isSelected && (
                                <div className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-[#e07a93] text-white flex items-center justify-center shadow">
                                  <Check className="size-2.5 stroke-[3]" />
                                </div>
                              )}
                            </div>
                            <span
                              className={`text-[11px] max-w-[56px] truncate text-center font-serif transition-colors ${
                                isSelected ? 'font-bold text-[#8a3854]' : 'text-[#998380] group-hover:text-[#4a3e3d]'
                              }`}
                            >
                              {char.name}
                            </span>
                          </button>
                        );
                      })}

                      {/* Divider */}
                      <div className="w-[1px] h-10 bg-[#f2d0d9] shrink-0 mx-0.5" />

                      {/* + 创建新角色按钮 */}
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          setCreateModalOpen(true);
                        }}
                        className="flex flex-col items-center gap-1.5 group shrink-0 transition-transform active:scale-95 cursor-pointer"
                        title="创建新角色"
                      >
                        <div className="size-12 rounded-full border-2 border-dashed border-[#e07a93]/60 hover:border-[#e07a93] bg-[#fcedf1]/60 hover:bg-[#fcedf1] text-[#e07a93] flex items-center justify-center transition-all group-hover:scale-105 shadow-sm">
                          <Plus className="size-5" />
                        </div>
                        <span className="text-[11px] font-serif font-medium text-[#e07a93] whitespace-nowrap">
                          创建角色
                        </span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Cute Blue Fish & LLM status badge */}
            <div className="ml-1 sm:ml-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/80 border border-[#f2d0d9] shadow-xs">
              <CuteBlueFishIcon size={20} className="hidden sm:inline-block" />
              <div
                className={`size-2 rounded-full ${
                  llmReady ? 'bg-emerald-400' : 'bg-[#e6b8c4]'
                } ${llmReady ? 'animate-pulse' : ''}`}
              />
              <span className="text-[10px] font-serif font-medium text-[#8a3854] hidden sm:inline">
                {llmReady ? '灵犀在线' : '本地离线'}
              </span>
            </div>

            {/* Ambient Sound Status Indicator */}
            {ambience.activeSound && (
              <button
                onClick={() => ambiencePlayer.stop()}
                className="ml-1 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#fcedf1] hover:bg-red-50 text-[#8a3854] hover:text-red-500 border border-[#f2d0d9] transition-colors text-[11px] shadow-xs"
                title={`正在播放白噪音：${
                  ambience.activeSound === 'fire' ? '壁炉篝火' : ambience.activeSound === 'rain' ? '夜雨微澜' : '林间清风'
                }（点击关闭）`}
              >
                {ambience.activeSound === 'fire' && <Flame className="size-3 text-amber-500 animate-pulse" />}
                {ambience.activeSound === 'rain' && <CloudRain className="size-3 text-pink-500 animate-bounce" />}
                {ambience.activeSound === 'wind' && <Wind className="size-3 text-teal-500 animate-pulse" />}
                <span className="text-[10px] font-serif hidden md:inline">
                  {ambience.activeSound === 'fire' ? '篝火' : ambience.activeSound === 'rain' ? '夜雨' : '清风'}
                </span>
              </button>
            )}
          </div>

          {/* Right: settings + sidebar toggle */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenSettings}
              className="size-8 sm:size-9 flex items-center justify-center rounded-full bg-white/70 hover:bg-white text-[#998380] hover:text-[#8a3854] border border-[#f2d0d9] transition-all shadow-xs cursor-pointer"
              aria-label="设置"
              title="天机机系统控制台"
            >
              <Settings className="size-4" />
            </button>
            <button
              onClick={onToggleSidebar}
              className={`size-8 sm:size-9 flex items-center justify-center rounded-full border transition-all shadow-xs cursor-pointer ${
                sidebarOpen
                  ? 'bg-[#fcedf1] border-[#e07a93] text-[#e07a93]'
                  : 'bg-white/70 hover:bg-white border-[#f2d0d9] text-[#998380] hover:text-[#8a3854]'
              }`}
              aria-label={sidebarOpen ? '收起侧边栏' : '展开侧边栏'}
              title="情感六维与记忆监控台"
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
