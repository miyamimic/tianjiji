import React, { useState, useEffect } from 'react';
import { Smile, Sparkles, X, Heart, User, Bot, ChevronUp, ChevronDown } from 'lucide-react';
import { getUserStickers, getCharacterStickers, type Sticker } from '../lib/stickerStore';

interface Props {
  currentCharacterId?: string;
  characterName?: string;
  onSelectSticker: (sticker: Sticker) => void;
  disabled?: boolean;
  compact?: boolean;
}

export default function InGameStickerBar({
  currentCharacterId = 'char_001',
  characterName = '角色',
  onSelectSticker,
  disabled = false,
  compact = false,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'user' | 'char'>('user');
  const [userStickers, setUserStickers] = useState<Sticker[]>(() => getUserStickers());
  const [charStickers, setCharStickers] = useState<Sticker[]>(() => getCharacterStickers(currentCharacterId));

  // Keep stickers in sync
  useEffect(() => {
    const update = () => {
      setUserStickers(getUserStickers());
      setCharStickers(getCharacterStickers(currentCharacterId));
    };
    window.addEventListener('rp_stickers_updated', update);
    return () => window.removeEventListener('rp_stickers_updated', update);
  }, [currentCharacterId]);

  const displayedStickers = activeTab === 'user' ? userStickers : charStickers;

  return (
    <div className="relative w-full">
      {/* Expanded Sticker Tray / Drawer */}
      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-1.5 p-2 bg-stone-900/95 backdrop-blur-md border border-amber-500/30 rounded-2xl shadow-2xl z-30 animate-in fade-in-0 slide-in-from-bottom-2 duration-150 flex flex-col max-h-56">
          {/* Header & Tabs */}
          <div className="flex items-center justify-between pb-1.5 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('user')}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 transition ${
                  activeTab === 'user'
                    ? 'bg-amber-500 text-stone-950 shadow-sm'
                    : 'bg-white/5 text-stone-300 hover:bg-white/10'
                }`}
              >
                <User className="size-3" />
                <span>我的表情 ({userStickers.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('char')}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 transition ${
                  activeTab === 'char'
                    ? 'bg-pink-500 text-white shadow-sm'
                    : 'bg-white/5 text-stone-300 hover:bg-white/10'
                }`}
              >
                <Bot className="size-3" />
                <span>{characterName}表情 ({charStickers.length})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition"
              title="收起表情栏"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {/* Stickers Grid */}
          <div className="flex-1 overflow-y-auto pt-2 grid grid-cols-4 sm:grid-cols-6 gap-2 no-scrollbar">
            {displayedStickers.length === 0 ? (
              <div className="col-span-full py-4 text-center text-xs text-white/40">
                暂无该分类表情包
              </div>
            ) : (
              displayedStickers.map((sticker) => (
                <button
                  key={sticker.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onSelectSticker(sticker);
                    setIsOpen(false);
                  }}
                  className="group relative flex flex-col items-center p-1 rounded-xl bg-white/5 hover:bg-amber-500/20 border border-white/10 hover:border-amber-400/50 transition-all cursor-pointer active:scale-95 text-center"
                  title={sticker.name}
                >
                  <div className="size-12 rounded-lg overflow-hidden bg-black/40 flex items-center justify-center p-0.5">
                    <img
                      src={sticker.url}
                      alt={sticker.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover rounded-md group-hover:scale-110 transition-transform duration-200"
                    />
                  </div>
                  <span className="text-[9.5px] text-stone-300 group-hover:text-amber-200 mt-1 truncate max-w-full font-medium">
                    {sticker.name}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Quick Sticker Horizontal Ribbon & Toggle Button */}
      <div className="flex items-center gap-1.5 py-1">
        {/* Toggle Tray Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer active:scale-95 ${
            isOpen
              ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-1 ring-amber-400/40'
              : 'bg-white/5 hover:bg-white/10 border-white/10 text-stone-300 hover:text-white'
          }`}
          title="展开/收起表情栏"
        >
          <Smile className="size-3.5 text-amber-400" />
          <span className="text-[11px]">表情包</span>
          {isOpen ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />}
        </button>

        {/* Quick Horizontal Preview Carousel */}
        <div className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {userStickers.slice(0, 6).map((sticker) => (
            <button
              key={sticker.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectSticker(sticker)}
              className="shrink-0 flex items-center gap-1 px-1.5 py-1 rounded-lg bg-black/40 hover:bg-amber-500/20 border border-white/10 hover:border-amber-400/40 text-[10.5px] text-stone-300 hover:text-amber-200 transition active:scale-95 cursor-pointer"
              title={`发送表情：${sticker.name}`}
            >
              <img
                src={sticker.url}
                alt=""
                referrerPolicy="no-referrer"
                className="size-4.5 rounded object-cover"
              />
              <span className="max-w-[50px] truncate">{sticker.name}</span>
            </button>
          ))}
          {userStickers.length > 6 && (
            <button
              type="button"
              onClick={() => {
                setActiveTab('user');
                setIsOpen(true);
              }}
              className="shrink-0 text-[10px] text-amber-400/80 hover:text-amber-300 px-1.5 py-1 rounded bg-white/5 border border-white/5 hover:border-white/20 transition"
            >
              更多...
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
