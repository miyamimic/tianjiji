import { useState, useEffect, useMemo } from 'react';
import { 
  Smile, 
  Search, 
  Plus, 
  X, 
  Sparkles, 
  ExternalLink, 
  Check, 
  Clock, 
  User as UserIcon,
  HelpCircle
} from 'lucide-react';
import { 
  getUserStickers, 
  getUserStickerCategories, 
  subscribeStickers,
  batchImportStickers,
  type Sticker 
} from '../lib/stickerStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectSticker: (sticker: Sticker) => void;
  onOpenFullApp?: () => void;
}

export default function StickerPicker({
  isOpen,
  onClose,
  onSelectSticker,
  onOpenFullApp,
}: Props) {
  const [stickers, setStickers] = useState<Sticker[]>(() => getUserStickers());
  const [activeCategory, setActiveCategory] = useState<string>('全部');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [showBatchImport, setShowBatchImport] = useState<boolean>(false);
  const [importText, setImportText] = useState<string>('');
  const [importCategory, setImportCategory] = useState<string>('图床导入');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      setStickers(getUserStickers());
    };
    update();
    const unsub = subscribeStickers(update);
    return unsub;
  }, []);

  const categories = useMemo(() => {
    return getUserStickerCategories();
  }, [stickers]);

  const filteredStickers = useMemo(() => {
    return stickers.filter((s) => {
      // Category filter
      if (activeCategory !== '全部' && s.category !== activeCategory) {
        return false;
      }
      // Search keyword
      if (searchKeyword.trim()) {
        const kw = searchKeyword.trim().toLowerCase();
        const matchName = s.name.toLowerCase().includes(kw);
        const matchCat = s.category?.toLowerCase().includes(kw);
        const matchChar = s.stolenMeta?.sourceCharacterName?.toLowerCase().includes(kw);
        if (!matchName && !matchCat && !matchChar) return false;
      }
      return true;
    });
  }, [stickers, activeCategory, searchKeyword]);

  const handleBatchImport = () => {
    if (!importText.trim()) return;
    const res = batchImportStickers(importText, 'user', undefined, importCategory.trim() || '图床导入');
    if (res.successCount > 0) {
      setImportStatus(`✅ 成功导入 ${res.successCount} 个表情包！`);
      setImportText('');
      setTimeout(() => {
        setImportStatus(null);
        setShowBatchImport(false);
      }, 1200);
    } else {
      setImportStatus(`❌ 导入失败，请检查每行是否包含有效的图片链接`);
    }
  };

  const handleFillSample = () => {
    const sample = `猫猫探头 https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=260&h=260&fit=crop&q=80
委屈巴巴 https://images.unsplash.com/photo-1548802673-380ab8ebc7b7?w=260&h=260&fit=crop&q=80
暗中观察 https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=260&h=260&fit=crop&q=80`;
    setImportText(sample);
  };

  if (!isOpen) return null;

  return (
    <div className="absolute bottom-full mb-2.5 right-0 left-0 max-w-xl mx-auto z-40 animate-in fade-in-0 zoom-in-95 duration-200">
      <div className="rounded-3xl border border-white/20 bg-stone-900/95 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_30px_rgba(245,158,11,0.15)] flex flex-col max-h-[380px] sm:max-h-[420px] overflow-hidden text-stone-200">
        
        {/* Header bar */}
        <div className="px-4 py-2.5 bg-black/40 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-lg bg-[hsl(28_85%_62%/0.2)] border border-[hsl(28_85%_62%/0.4)] flex items-center justify-center text-[hsl(28_85%_62%)]">
              <Smile className="size-3.5" />
            </div>
            <span className="text-xs font-bold text-white tracking-wide">
              主控表情包库
            </span>
            <span className="text-[10px] text-stone-400 font-mono bg-white/5 px-1.5 py-0.5 rounded-full border border-white/5">
              {stickers.length} 个
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {onOpenFullApp && (
              <button
                type="button"
                onClick={onOpenFullApp}
                className="flex items-center gap-1 px-2 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-[10px] font-medium border border-white/10 transition cursor-pointer"
                title="打开完整表情包管理"
              >
                <Sparkles className="size-2.5 text-amber-400" />
                <span>表情包工坊</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowBatchImport(!showBatchImport)}
              className={`flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-medium border transition cursor-pointer ${
                showBatchImport
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/70 hover:text-white'
              }`}
            >
              <Plus className="size-3" />
              <span>导入</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-full text-stone-400 hover:text-white hover:bg-white/10 transition cursor-pointer ml-1"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Quick Batch Import Drawer */}
        {showBatchImport && (
          <div className="p-3 bg-stone-950/90 border-b border-amber-500/30 space-y-2 text-xs shrink-0 animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                <Sparkles className="size-3 text-amber-400" />
                <span>批量一键导入表情包（支持图床 URL）</span>
              </span>
              <button
                type="button"
                onClick={handleFillSample}
                className="text-[10px] text-amber-400/80 hover:text-amber-300 underline cursor-pointer"
              >
                填入示例
              </button>
            </div>
            <p className="text-[10px] text-stone-400">
              每行格式：<code className="text-amber-200 bg-white/5 px-1 rounded">表情名 https://图片链接</code> 或直接粘贴多行
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={importCategory}
                onChange={(e) => setImportCategory(e.target.value)}
                placeholder="分类名（默认：图床导入）"
                className="w-1/3 bg-stone-900 border border-white/15 rounded-xl px-2.5 py-1 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
              />
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={2}
                placeholder="例如：\n猫猫开心 https://i.imgur.com/xxx.png\n傲娇表情 https://..."
                className="flex-1 bg-stone-900 border border-white/15 rounded-xl p-2 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 resize-none font-mono"
              />
            </div>
            <div className="flex items-center justify-between pt-1">
              {importStatus ? (
                <span className="text-[11px] font-medium text-amber-300">
                  {importStatus}
                </span>
              ) : (
                <span className="text-[9px] text-stone-500">
                  支持 jpg / png / gif / webp / svg 各种图床与公开链接
                </span>
              )}
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowBatchImport(false)}
                  className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] text-stone-400 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleBatchImport}
                  disabled={!importText.trim()}
                  className="px-3 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-stone-950 font-bold text-[11px] shadow-sm disabled:opacity-40 cursor-pointer"
                >
                  一键导入
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search & Category Tabs */}
        <div className="px-3 pt-2.5 pb-1.5 space-y-2 bg-stone-950/40 shrink-0 border-b border-white/5">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-stone-400" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="搜索表情包名称 / 角色来源..."
              className="w-full bg-stone-900/90 border border-white/10 rounded-xl pl-7 pr-3 py-1 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[hsl(28_85%_62%)]"
            />
            {searchKeyword && (
              <button
                type="button"
                onClick={() => setSearchKeyword('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-stone-400 hover:text-white"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Category Pills (Horizontally scrollable) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {categories.map((cat) => {
              const isActive = activeCategory === cat;
              const isStolenCategory = cat.startsWith('来自 ');
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-medium whitespace-nowrap transition cursor-pointer flex items-center gap-1 shrink-0 ${
                    isActive
                      ? isStolenCategory
                        ? 'bg-purple-600/90 text-white font-bold shadow-sm ring-1 ring-purple-400'
                        : 'bg-[hsl(28_85%_62%)] text-stone-950 font-bold shadow-sm'
                      : 'bg-white/5 hover:bg-white/10 text-stone-300 border border-white/5'
                  }`}
                >
                  {isStolenCategory && <Sparkles className="size-2.5 text-purple-200" />}
                  <span>{cat}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sticker Grid List */}
        <div className="flex-1 overflow-y-auto p-3 chat-scroll">
          {filteredStickers.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <Smile className="size-8 mx-auto text-stone-600" />
              <p className="text-xs text-stone-400">
                {searchKeyword ? '没有找到匹配的表情包' : '该分类下暂无表情包'}
              </p>
              <button
                type="button"
                onClick={() => setShowBatchImport(true)}
                className="text-xs text-amber-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="size-3" />
                <span>点击导入图床表情包</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {filteredStickers.map((sticker) => {
                const isStolen = sticker.isStolen;
                const sourceChar = sticker.stolenMeta?.sourceCharacterName;

                return (
                  <button
                    key={sticker.id}
                    type="button"
                    onClick={() => {
                      onSelectSticker(sticker);
                      onClose();
                    }}
                    className="group relative flex flex-col items-center p-1.5 rounded-2xl bg-stone-800/60 hover:bg-stone-700/80 border border-white/10 hover:border-amber-400/60 hover:shadow-lg hover:shadow-amber-500/10 active:scale-95 transition-all duration-150 cursor-pointer"
                  >
                    {/* Stolen Badge */}
                    {isStolen && (
                      <div className="absolute -top-1.5 -left-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-extrabold text-[8px] px-1.5 py-0.2 rounded-full shadow-md border border-purple-300/60 flex items-center gap-0.5 z-10 animate-pulse">
                        <Sparkles className="size-2 text-purple-200" />
                        <span>{sourceChar ? `偷自${sourceChar}` : '偷来'}</span>
                      </div>
                    )}

                    {/* Image Square Container */}
                    <div className="w-full aspect-square rounded-xl overflow-hidden bg-black/40 border border-white/5 relative group-hover:scale-[1.03] transition-transform duration-150 flex items-center justify-center">
                      <img
                        src={sticker.url}
                        alt={sticker.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          // Fallback on image load error
                          const target = e.currentTarget;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.innerHTML = `<div class="text-[10px] text-stone-500 text-center p-1 font-bold">🖼️<br/>${sticker.name}</div>`;
                          }
                        }}
                      />
                    </div>

                    {/* Sticker Name Pill */}
                    <span className="mt-1 text-[10.5px] font-medium text-stone-300 group-hover:text-amber-300 truncate w-full text-center leading-tight">
                      {sticker.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Hint */}
        <div className="px-3.5 py-1.5 bg-black/50 border-t border-white/5 flex items-center justify-between text-[10px] text-stone-500 shrink-0">
          <span>💡 点击表情包立即发送到对话</span>
          <span>支持在对话中偷取 AI 角色发送的表情包</span>
        </div>

      </div>
    </div>
  );
}
