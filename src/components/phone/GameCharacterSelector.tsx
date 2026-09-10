import React, { useState } from 'react';
import { Users, Check, Sparkles, X, ChevronDown, Trophy, Swords } from 'lucide-react';
import { getSavedCharacters, getCharacterById, MOCK_CHARACTERS } from '../../data/characters';
import { loadCharAvatar, loadCharGomokuRank } from '../../lib/customStore';
import type { Character } from '../../data/types';

interface Props {
  selectedCharacterId: string;
  onSelectCharacter: (characterId: string) => void;
  title?: string;
  compact?: boolean;
  retro?: boolean;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function GameCharacterSelector({
  selectedCharacterId,
  onSelectCharacter,
  title = '选择对战伙伴',
  compact = false,
  retro = false,
  defaultOpen = false,
  isOpen: externalIsOpen,
  onClose,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalOpen;
  const setIsOpen = (val: boolean) => {
    setInternalOpen(val);
    if (!val && onClose) onClose();
  };
  const characters = getSavedCharacters();
  const currentChar = getCharacterById(selectedCharacterId) || characters[0] || MOCK_CHARACTERS[0];
  const currentAvatar = loadCharAvatar(currentChar.character_id);
  const currentRank = loadCharGomokuRank(currentChar.character_id);

  const getRankBadge = (rank: string) => {
    if (retro) {
      return (
        <span className="px-1 bg-[#00aaaa] text-black font-bold text-[9px]">
          [{rank === 'master' ? '王者' : rank === 'gold' ? '黄金' : rank === 'silver' ? '白银' : '青铜'}]
        </span>
      );
    }
    switch (rank) {
      case 'master':
        return <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-400/30 text-[9.5px]">王者</span>;
      case 'gold':
        return <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[9.5px]">黄金</span>;
      case 'silver':
        return <span className="px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-300 border border-slate-400/30 text-[9.5px]">白银</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-400/30 text-[9.5px]">青铜</span>;
    }
  };

  if (retro) {
    return (
      <>
        {/* Retro Turbo Vision Trigger */}
        <div className="flex items-center justify-between p-2 bg-[#000080] border-2 border-t-[#00ffff] border-l-[#00ffff] border-b-[#000000] border-r-[#000000] font-mono text-white shadow-[2px_2px_0px_#000000]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="size-8 overflow-hidden bg-black border border-[#00ffff] shrink-0">
              {currentAvatar ? (
                <img src={currentAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-[#ffff55]">
                  {currentChar.name.charAt(0)}
                </div>
              )}
            </div>
            <div className="min-w-0 text-left">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-[#ffff55] truncate">{currentChar.name}</span>
                {getRankBadge(currentRank)}
              </div>
              <p className="text-[9.5px] text-[#aaaaaa] truncate">
                {currentChar.core?.values?.slice(0, 2).join(' · ') || '对弈伙伴'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="px-2 py-1 bg-[#c0c0c0] hover:bg-white text-black font-bold text-xs border-t border-l border-white border-b-2 border-r-2 border-black shadow-[2px_2px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer shrink-0"
          >
            [ 切换伙伴 F2 ]
          </button>
        </div>

        {/* Retro Character Modal */}
        {isOpen && (
          <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-3 animate-in fade-in-0 duration-100 font-mono">
            <div className="bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black shadow-[6px_6px_0px_#000000] max-w-sm w-full flex flex-col max-h-[85vh]">
              {/* Title Bar */}
              <div className="bg-[#0000a8] text-[#ffff55] px-2 py-1 flex items-center justify-between font-bold text-xs border-b border-black">
                <span>[■] {title} · SELECT [▲]</span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-1.5 py-0.5 bg-[#c0c0c0] text-black hover:bg-red-600 hover:text-white font-bold text-[10px] border border-black shadow-[1px_1px_0px_#000] cursor-pointer"
                >
                  [X]
                </button>
              </div>

              {/* Character List */}
              <div className="p-2 overflow-y-auto space-y-1.5 flex-1 bg-[#000080]">
                {characters.map((c) => {
                  const avatar = loadCharAvatar(c.character_id);
                  const rank = loadCharGomokuRank(c.character_id);
                  const isSelected = c.character_id === selectedCharacterId;

                  return (
                    <div
                      key={c.character_id}
                      onClick={() => {
                        onSelectCharacter(c.character_id);
                        setIsOpen(false);
                      }}
                      className={`p-2 border flex items-center justify-between cursor-pointer font-mono ${
                        isSelected
                          ? 'bg-[#00aaaa] text-black border-[#ffff55] font-bold shadow-[2px_2px_0px_#000]'
                          : 'bg-[#000054] hover:bg-[#0000aa] text-white border-black'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="size-8 bg-black border border-white shrink-0 overflow-hidden">
                          {avatar ? (
                            <img src={avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="flex items-center justify-center h-full text-xs font-bold text-yellow-300">
                              {c.name.charAt(0)}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 text-left">
                          <div className="text-xs truncate font-bold">
                            {c.name} {isSelected && '◄ (当前)'}
                          </div>
                          <div className="text-[10px] opacity-80 truncate">
                            [{rank}] {c.core?.values?.slice(0, 2).join(' / ') || '伙伴'}
                          </div>
                        </div>
                      </div>
                      <div className="text-[10px] font-bold shrink-0">
                        {isSelected ? '[已选定]' : '[选择]'}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="p-1.5 bg-[#c0c0c0] border-t border-black flex items-center justify-between text-[10px] text-black font-bold">
                <span>切换后自动加载独立心智与战绩</span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-2 py-0.5 bg-[#d4d4d4] hover:bg-white text-black border border-black shadow-[1px_1px_0px_#000] cursor-pointer"
                >
                  [Esc 关闭]
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {/* Trigger Button */}
      {compact ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-white/10 hover:bg-white/20 border border-amber-500/30 hover:border-amber-400/60 text-xs text-white transition active:scale-95 cursor-pointer shadow-sm"
          title="点击切换对弈/对战角色"
        >
          <div className="size-5 rounded-full overflow-hidden bg-amber-500/30 ring-1 ring-amber-400/50 shrink-0">
            {currentAvatar ? (
              <img src={currentAvatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] flex items-center justify-center h-full font-bold text-amber-200">
                {currentChar.name.charAt(0)}
              </span>
            )}
          </div>
          <span className="font-semibold text-amber-200 truncate max-w-[70px]">{currentChar.name}</span>
          <ChevronDown className="size-3 text-amber-400/80" />
        </button>
      ) : (
        <div className="flex items-center justify-between p-2.5 rounded-2xl bg-black/40 border border-amber-500/30 hover:border-amber-400/60 transition shadow-inner">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-9 rounded-full overflow-hidden bg-amber-500/20 border border-amber-400/50 shrink-0 relative">
              {currentAvatar ? (
                <img src={currentAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-amber-300">
                  {currentChar.name.charAt(0)}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-amber-100 truncate">{currentChar.name}</span>
                {getRankBadge(currentRank)}
              </div>
              <p className="text-[10.5px] text-white/50 truncate">
                {currentChar.core?.values?.slice(0, 3).join(' · ') || '专属对弈伙伴'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-xs font-semibold text-amber-200 hover:text-white transition active:scale-95 cursor-pointer shrink-0"
          >
            <Users className="size-3.5 text-amber-400" />
            <span>切换对手</span>
          </button>
        </div>
      )}

      {/* Character Selection Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in-0 duration-150">
          <div className="bg-stone-900 border border-amber-500/40 rounded-2xl max-w-sm w-full p-4 shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                  <Swords className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{title}</h3>
                  <p className="text-[10px] text-white/50">选择与谁进行对弈或心理博弈</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto py-3 space-y-2 no-scrollbar">
              {characters.map((c) => {
                const avatar = loadCharAvatar(c.character_id);
                const rank = loadCharGomokuRank(c.character_id);
                const isSelected = c.character_id === selectedCharacterId;

                return (
                  <div
                    key={c.character_id}
                    onClick={() => {
                      onSelectCharacter(c.character_id);
                      setIsOpen(false);
                    }}
                    className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer active:scale-[0.98] ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-400 text-amber-100 ring-1 ring-amber-400/50 shadow-md'
                        : 'bg-white/5 hover:bg-white/10 border-white/10 text-stone-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-10 rounded-full overflow-hidden bg-black/40 border border-white/15 shrink-0">
                        {avatar ? (
                          <img src={avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-bold text-amber-300">
                            {c.name.charAt(0)}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-white truncate">{c.name}</span>
                          {getRankBadge(rank)}
                        </div>
                        <p className="text-[10.5px] text-white/50 truncate">
                          {c.core?.values?.slice(0, 3).join(' · ') || '专属角色'}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 pl-2">
                      {isSelected ? (
                        <div className="size-6 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center shadow">
                          <Check className="size-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <span className="text-[11px] text-white/40 group-hover:text-white/70">选择</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer hint */}
            <div className="pt-2 border-t border-white/10 text-center text-[10px] text-white/40 shrink-0">
              切换对手后，将自动加载该角色的对局记录与独立心智状态
            </div>
          </div>
        </div>
      )}
    </>
  );
}
