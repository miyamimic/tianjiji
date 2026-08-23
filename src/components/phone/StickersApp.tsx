import React, { useState, useEffect, useMemo } from 'react';
import { 
  Smile, 
  Sparkles, 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Clock, 
  Heart, 
  User, 
  Bot, 
  ExternalLink,
  MessageSquare,
  Activity,
  Layers,
  ChevronRight,
  Info
} from 'lucide-react';
import { 
  getUserStickers, 
  getUserStickerCategories, 
  getCharacterStickers, 
  deleteSticker, 
  updateSticker, 
  batchImportStickers,
  subscribeStickers,
  type Sticker,
  type StickerSnapshot
} from '../../lib/stickerStore';
import { getSavedCharacters } from '../../data/characters';
import { EMOTION_NAMES, type EmotionKey } from '../../data/types';
import { loadCharAvatar } from '../../lib/customStore';

interface Props {
  currentCharacterId?: string;
}

export default function StickersApp({ currentCharacterId = 'char_001' }: Props) {
  const [activeTab, setActiveTab] = useState<'user' | 'ai'>('user');
  const [userCategory, setUserCategory] = useState<string>('全部');
  const [selectedCharId, setSelectedCharId] = useState<string>(currentCharacterId);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  
  // Batch Import state
  const [showBatchModal, setShowBatchModal] = useState<boolean>(false);
  const [importText, setImportText] = useState<string>('');
  const [importCategory, setImportCategory] = useState<string>('');
  const [importTarget, setImportTarget] = useState<'user' | 'ai'>('user');
  const [importResult, setImportResult] = useState<string | null>(null);

  // Snapshot Inspection Modal
  const [inspectSticker, setInspectSticker] = useState<Sticker | null>(null);

  // Edit sticker modal
  const [editingSticker, setEditingSticker] = useState<Sticker | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');

  const [tick, setTick] = useState(0);

  useEffect(() => {
    const unsub = subscribeStickers(() => {
      setTick((t) => t + 1);
    });
    return unsub;
  }, []);

  const characters = useMemo(() => {
    return getSavedCharacters();
  }, []);

  const userStickers = useMemo(() => {
    return getUserStickers();
  }, [tick]);

  const userCategories = useMemo(() => {
    return getUserStickerCategories();
  }, [userStickers]);

  const charStickers = useMemo(() => {
    return getCharacterStickers(selectedCharId);
  }, [selectedCharId, tick]);

  const currentChar = useMemo(() => {
    return characters.find((c) => c.character_id === selectedCharId) || characters[0];
  }, [characters, selectedCharId]);

  // Filtered lists
  const filteredUserStickers = useMemo(() => {
    return userStickers.filter((s) => {
      if (userCategory !== '全部' && s.category !== userCategory) return false;
      if (searchKeyword.trim()) {
        const kw = searchKeyword.trim().toLowerCase();
        const matchName = s.name.toLowerCase().includes(kw);
        const matchCat = s.category?.toLowerCase().includes(kw);
        const matchSource = s.stolenMeta?.sourceCharacterName?.toLowerCase().includes(kw);
        if (!matchName && !matchCat && !matchSource) return false;
      }
      return true;
    });
  }, [userStickers, userCategory, searchKeyword]);

  const filteredCharStickers = useMemo(() => {
    return charStickers.filter((s) => {
      if (searchKeyword.trim()) {
        const kw = searchKeyword.trim().toLowerCase();
        const matchName = s.name.toLowerCase().includes(kw);
        const matchCat = s.category?.toLowerCase().includes(kw);
        const matchCtx = s.stolenMeta?.contextText?.toLowerCase().includes(kw);
        if (!matchName && !matchCat && !matchCtx) return false;
      }
      return true;
    });
  }, [charStickers, searchKeyword]);

  const handleExecuteBatchImport = () => {
    if (!importText.trim()) return;
    const targetCategory = importCategory.trim() || (importTarget === 'user' ? '图床导入' : `${currentChar.name}专属`);
    const res = batchImportStickers(
      importText,
      importTarget,
      importTarget === 'ai' ? selectedCharId : undefined,
      targetCategory
    );

    if (res.successCount > 0) {
      setImportResult(`🎉 成功导入 ${res.successCount} 个表情包！`);
      setImportText('');
      setTimeout(() => {
        setImportResult(null);
        setShowBatchModal(false);
      }, 1200);
    } else {
      setImportResult(`⚠️ 未识别到有效图片链接，请检查格式`);
    }
  };

  const handleFillSample = () => {
    const sample = `猫猫疑惑 https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=260&h=260&fit=crop&q=80
暗中观察 https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=260&h=260&fit=crop&q=80
得意洋洋 https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=260&h=260&fit=crop&q=80`;
    setImportText(sample);
  };

  const handleSaveEdit = () => {
    if (!editingSticker) return;
    updateSticker(editingSticker.id, {
      name: editName.trim() || editingSticker.name,
      category: editCategory.trim() || editingSticker.category,
    });
    setEditingSticker(null);
  };

  const formatTimestamp = (ts?: number) => {
    if (!ts) return '未知时间';
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-3 pb-8 text-stone-200 animate-in fade-in duration-200">
      
      {/* Top Banner & Main Tabs (主控 / AI 角色) */}
      <div className="p-3.5 rounded-3xl bg-gradient-to-br from-stone-900 via-stone-900 to-stone-950 border border-white/10 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-2xl bg-gradient-to-br from-pink-500 via-rose-500 to-amber-500 flex items-center justify-center text-white shadow-md">
              <Smile className="size-4.5" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>表情包工坊</span>
                <span className="text-[9px] text-amber-300 font-normal bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.2 rounded-full">
                  双向偷表情
                </span>
              </h2>
              <p className="text-[10px] text-stone-400">
                支持图床一键批量导入、角色私有库与偷表情回忆快照
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setImportTarget(activeTab);
              setImportCategory(activeTab === 'user' ? '图床导入' : `${currentChar?.name || ''}专属`);
              setShowBatchModal(true);
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-stone-950 font-bold text-xs shadow-md transition active:scale-95 cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>一键导入</span>
          </button>
        </div>

        {/* Dual Primary Tabs: 主控表情包 VS AI 角色表情包 */}
        <div className="grid grid-cols-2 p-1 bg-black/50 rounded-2xl border border-white/5">
          <button
            onClick={() => setActiveTab('user')}
            className={`py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'user'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-stone-950 shadow-md'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <User className="size-3.5" />
            <span>主控表情包 ({userStickers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'ai'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <Bot className="size-3.5" />
            <span>AI 角色表情包</span>
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-stone-400" />
        <input
          type="text"
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          placeholder={activeTab === 'user' ? '搜索主控表情包 / 来源角色...' : `搜索 ${currentChar.name} 的表情包 / 偷取情境...`}
          className="w-full bg-stone-900/90 border border-white/10 rounded-2xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
        />
        {searchKeyword && (
          <button
            onClick={() => setSearchKeyword('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* ================= USER STICKERS TAB ================= */}
      {activeTab === 'user' && (
        <div className="space-y-3">
          {/* User Categories Horizontal Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {userCategories.map((cat) => {
              const isActive = userCategory === cat;
              const isStolenCat = cat.startsWith('来自 ');
              const count = cat === '全部' ? userStickers.length : userStickers.filter((s) => s.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setUserCategory(cat)}
                  className={`px-3 py-1 rounded-xl text-xs font-medium whitespace-nowrap transition cursor-pointer flex items-center gap-1 shrink-0 ${
                    isActive
                      ? isStolenCat
                        ? 'bg-purple-600 text-white font-bold ring-1 ring-purple-400 shadow-sm'
                        : 'bg-[hsl(28_85%_62%)] text-stone-950 font-bold shadow-sm'
                      : 'bg-stone-900/90 hover:bg-stone-800 text-stone-300 border border-white/5'
                  }`}
                >
                  {isStolenCat && <Sparkles className="size-3 text-purple-200" />}
                  <span>{cat}</span>
                  <span className="text-[10px] opacity-70 font-mono">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Stolen from AI highlight notice if on stolen category */}
          {userCategory.startsWith('来自 ') && (
            <div className="p-2.5 rounded-2xl bg-purple-950/40 border border-purple-500/30 flex items-center justify-between text-xs text-purple-200">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-purple-300 shrink-0" />
                <span>
                  以下为你从【{userCategory.replace('来自 ', '')}】处成功偷取的表情包
                </span>
              </div>
              <span className="text-[10px] text-purple-300/70 font-mono">已归档</span>
            </div>
          )}

          {/* User Stickers Grid */}
          {filteredUserStickers.length === 0 ? (
            <div className="py-12 text-center rounded-3xl bg-stone-900/40 border border-white/5 space-y-2.5">
              <Smile className="size-10 mx-auto text-stone-600" />
              <p className="text-xs text-stone-400">
                {searchKeyword ? '没有找到符合关键词的表情包' : '该分类下还没有表情包'}
              </p>
              <button
                onClick={() => {
                  setImportTarget('user');
                  setImportCategory(userCategory === '全部' ? '图床导入' : userCategory);
                  setShowBatchModal(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>一键导入图床表情</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {filteredUserStickers.map((stk) => {
                const isStolen = stk.isStolen;
                const sourceCharName = stk.stolenMeta?.sourceCharacterName;
                return (
                  <div
                    key={stk.id}
                    className="group relative rounded-2xl bg-stone-900/80 border border-white/10 hover:border-amber-400/50 p-2 flex flex-col space-y-1.5 transition duration-150 hover:shadow-lg shadow-md"
                  >
                    {/* Stolen Pill Badge */}
                    {isStolen && (
                      <button
                        onClick={() => setInspectSticker(stk)}
                        className="absolute -top-2 -left-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-extrabold text-[8px] px-1.5 py-0.5 rounded-full shadow-md border border-purple-300/60 flex items-center gap-0.5 z-10 hover:scale-105 transition cursor-pointer"
                        title="点击查看偷取回忆快照"
                      >
                        <Sparkles className="size-2 text-purple-200" />
                        <span>{sourceCharName ? `来自${sourceCharName}` : '偷自AI'}</span>
                      </button>
                    )}

                    {/* Image Box */}
                    <div 
                      onClick={() => setInspectSticker(stk)}
                      className="w-full aspect-square rounded-xl overflow-hidden bg-black/50 border border-white/5 relative cursor-pointer group-hover:scale-[1.02] transition"
                    >
                      <img
                        src={stk.url}
                        alt={stk.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    {/* Name & Category */}
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-bold text-white truncate group-hover:text-amber-300">
                        {stk.name}
                      </span>
                      <span className="text-[9px] text-stone-500 truncate shrink-0 max-w-[60px]">
                        {stk.category}
                      </span>
                    </div>

                    {/* Action buttons (Edit & Delete) */}
                    <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px]">
                      <button
                        onClick={() => setInspectSticker(stk)}
                        className="text-stone-400 hover:text-amber-300 transition flex items-center gap-0.5 cursor-pointer"
                      >
                        <Info className="size-3" />
                        <span>详情</span>
                      </button>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setEditingSticker(stk);
                            setEditName(stk.name);
                            setEditCategory(stk.category);
                          }}
                          className="text-stone-500 hover:text-white transition p-0.5 cursor-pointer"
                          title="编辑名称与分类"
                        >
                          <Edit3 className="size-3" />
                        </button>
                        <button
                          onClick={() => deleteSticker(stk.id)}
                          className="text-stone-500 hover:text-rose-400 transition p-0.5 cursor-pointer"
                          title="删除表情包"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= AI CHARACTER STICKERS TAB ================= */}
      {activeTab === 'ai' && (
        <div className="space-y-3">
          {/* Character Selector Pills */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            {characters.map((char) => {
              const isSelected = selectedCharId === char.character_id;
              const avatar = loadCharAvatar(char.character_id);
              const totalCount = getCharacterStickers(char.character_id).length;
              const stolenCount = getCharacterStickers(char.character_id).filter((s) => s.isStolen).length;

              return (
                <button
                  key={char.character_id}
                  onClick={() => setSelectedCharId(char.character_id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border transition cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-purple-950/60 border-purple-500/80 text-white shadow-md ring-1 ring-purple-400/50'
                      : 'bg-stone-900/80 hover:bg-stone-800/90 border-white/10 text-stone-300'
                  }`}
                >
                  <div className="size-6 rounded-full overflow-hidden bg-purple-500/20 border border-purple-300/30 flex items-center justify-center text-[10px] font-bold text-purple-200 shrink-0">
                    {avatar ? (
                      <img src={avatar} alt={char.name} className="w-full h-full object-cover" />
                    ) : (
                      char.name.charAt(0)
                    )}
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold leading-tight flex items-center gap-1">
                      <span>{char.name}</span>
                      {stolenCount > 0 && (
                        <span className="text-[9px] text-amber-300 bg-amber-500/20 px-1 rounded-full font-mono">
                          偷了{stolenCount}
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] text-stone-400 font-mono">
                      共 {totalCount} 个表情
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Character Library Stats / Header info */}
          <div className="p-3 rounded-2xl bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-stone-900/60 border border-purple-500/30 flex items-center justify-between text-xs">
            <div className="space-y-0.5">
              <div className="font-bold text-white flex items-center gap-1.5">
                <Bot className="size-3.5 text-purple-300" />
                <span>{currentChar.name} 的专属表情包库</span>
              </div>
              <p className="text-[10px] text-purple-200/70">
                角色将在回复时根据当前心情自动调用或发送这些表情包
              </p>
            </div>
            <button
              onClick={() => {
                setImportTarget('ai');
                setImportCategory(`${currentChar.name}专属`);
                setShowBatchModal(true);
              }}
              className="px-2.5 py-1 rounded-xl bg-purple-600/80 hover:bg-purple-500 text-white font-bold text-[11px] shadow transition cursor-pointer flex items-center gap-1 shrink-0"
            >
              <Plus className="size-3" />
              <span>导入角色表情</span>
            </button>
          </div>

          {/* AI Stickers Grid */}
          {filteredCharStickers.length === 0 ? (
            <div className="py-12 text-center rounded-3xl bg-stone-900/40 border border-white/5 space-y-2.5">
              <Bot className="size-10 mx-auto text-stone-600" />
              <p className="text-xs text-stone-400">
                {searchKeyword ? '没有找到符合关键词的角色表情包' : `${currentChar.name} 暂无表情包`}
              </p>
              <button
                onClick={() => {
                  setImportTarget('ai');
                  setImportCategory(`${currentChar.name}专属`);
                  setShowBatchModal(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>为 {currentChar.name} 导入表情包</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {filteredCharStickers.map((stk) => {
                const isStolen = stk.isStolen;

                return (
                  <div
                    key={stk.id}
                    className={`group relative rounded-2xl p-2 flex flex-col space-y-1.5 transition duration-150 shadow-md ${
                      isStolen
                        ? 'bg-gradient-to-b from-purple-950/70 via-stone-900 to-stone-950 border border-purple-400/60 ring-1 ring-purple-500/30 hover:border-purple-300'
                        : 'bg-stone-900/80 border border-white/10 hover:border-white/20'
                    }`}
                  >
                    {/* Special Glowing Badge: 🐾 偷自主控 */}
                    {isStolen && (
                      <button
                        onClick={() => setInspectSticker(stk)}
                        className="absolute -top-2 -left-1 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-stone-950 font-extrabold text-[8px] px-1.5 py-0.5 rounded-full shadow-lg border border-amber-200 flex items-center gap-0.5 z-10 animate-bounce hover:scale-105 transition cursor-pointer"
                        title="点击查看偷取回忆与当时AI心情快照"
                      >
                        <Sparkles className="size-2 text-stone-950" />
                        <span>🐾 偷自主控</span>
                      </button>
                    )}

                    {/* Image Box */}
                    <div 
                      onClick={() => setInspectSticker(stk)}
                      className="w-full aspect-square rounded-xl overflow-hidden bg-black/50 border border-white/5 relative cursor-pointer group-hover:scale-[1.02] transition"
                    >
                      <img
                        src={stk.url}
                        alt={stk.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    {/* Name & Category */}
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-bold text-white truncate group-hover:text-purple-300">
                        {stk.name}
                      </span>
                      <span className="text-[9px] text-stone-500 truncate shrink-0 max-w-[60px]">
                        {isStolen ? '偷来自主控' : stk.category}
                      </span>
                    </div>

                    {/* Action buttons (Inspect Snapshot / Delete) */}
                    <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px]">
                      <button
                        onClick={() => setInspectSticker(stk)}
                        className="text-purple-300 hover:text-purple-100 transition flex items-center gap-0.5 cursor-pointer font-medium"
                      >
                        <Activity className="size-3 text-purple-400" />
                        <span>{isStolen ? '心情快照' : '详情'}</span>
                      </button>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setEditingSticker(stk);
                            setEditName(stk.name);
                            setEditCategory(stk.category);
                          }}
                          className="text-stone-500 hover:text-white transition p-0.5 cursor-pointer"
                          title="编辑名称"
                        >
                          <Edit3 className="size-3" />
                        </button>
                        <button
                          onClick={() => deleteSticker(stk.id)}
                          className="text-stone-500 hover:text-rose-400 transition p-0.5 cursor-pointer"
                          title="删除表情包"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= BATCH IMPORT MODAL ================= */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-stone-900 border border-white/20 p-4 space-y-3 shadow-2xl text-stone-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center text-stone-950">
                  <Plus className="size-4" />
                </div>
                <h3 className="text-sm font-bold text-white">一键批量导入表情包</h3>
              </div>
              <button
                onClick={() => setShowBatchModal(false)}
                className="p-1 rounded-full text-stone-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Target selector (主控 VS 指定角色) */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-stone-300">导入目标表情库：</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setImportTarget('user');
                    setImportCategory('图床导入');
                  }}
                  className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1 ${
                    importTarget === 'user'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-stone-950 border-white/10 text-stone-400 hover:text-white'
                  }`}
                >
                  <User className="size-3.5" />
                  <span>主控表情包库</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportTarget('ai');
                    setImportCategory(`${currentChar?.name || ''}专属`);
                  }}
                  className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1 ${
                    importTarget === 'ai'
                      ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                      : 'bg-stone-950 border-white/10 text-stone-400 hover:text-white'
                  }`}
                >
                  <Bot className="size-3.5" />
                  <span>{currentChar?.name || 'AI'} 专属表情库</span>
                </button>
              </div>
            </div>

            {/* Category Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-stone-300">归属分类名称：</label>
              <input
                type="text"
                value={importCategory}
                onChange={(e) => setImportCategory(e.target.value)}
                placeholder="例如：日常萌宠、沙雕梗图、傲娇专属等"
                className="w-full bg-stone-950 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Multiline Textarea */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-stone-300">
                  粘贴表情包文本（一行一个）：
                </label>
                <button
                  type="button"
                  onClick={handleFillSample}
                  className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                >
                  填入示例数据
                </button>
              </div>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={5}
                placeholder={`格式说明：每行粘贴一个表情包的名字和图片URL，中间用空格或逗号隔开。\n例如：\n猫猫探头 https://example.com/cat.png\n委屈巴巴 https://example.com/cry.jpg\n得意洋洋 https://example.com/smug.webp`}
                className="w-full bg-stone-950 border border-white/15 rounded-xl p-2.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 font-mono resize-none leading-relaxed"
              />
            </div>

            {importResult && (
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 text-xs font-bold text-center">
                {importResult}
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-stone-300 cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleExecuteBatchImport}
                disabled={!importText.trim()}
                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-stone-950 font-bold text-xs shadow-md disabled:opacity-40 cursor-pointer"
              >
                确认一键导入
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= STICKER SNAPSHOT & DETAIL MODAL ================= */}
      {inspectSticker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-stone-900 border border-white/20 p-4 space-y-3.5 shadow-2xl text-stone-200">
            
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-amber-400" />
                <h3 className="text-xs font-bold text-white">表情包详情与回忆快照</h3>
              </div>
              <button
                onClick={() => setInspectSticker(null)}
                className="p-1 rounded-full text-stone-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Center Preview */}
            <div className="flex flex-col items-center space-y-2">
              <div className="size-32 rounded-2xl overflow-hidden bg-black/50 border border-white/10 shadow-xl relative">
                <img
                  src={inspectSticker.url}
                  alt={inspectSticker.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="text-center">
                <h4 className="text-sm font-bold text-white">{inspectSticker.name}</h4>
                <p className="text-[10px] text-stone-400">分类：{inspectSticker.category}</p>
              </div>
            </div>

            {/* Stolen Memory Snapshot Card */}
            {inspectSticker.isStolen && inspectSticker.stolenMeta ? (
              <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-950/50 via-stone-950 to-stone-950 border border-purple-500/40 space-y-2 text-xs">
                <div className="flex items-center justify-between font-bold text-purple-200">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="size-3 text-purple-300" />
                    <span>
                      {inspectSticker.stolenMeta.stolenBy === 'ai'
                        ? '🐾 AI 偷取时刻快照'
                        : '✨ 主控偷取回忆'}
                    </span>
                  </span>
                  <span className="text-[9px] text-stone-400 font-mono flex items-center gap-1">
                    <Clock className="size-2.5" />
                    {formatTimestamp(inspectSticker.stolenMeta.stolenAt)}
                  </span>
                </div>

                {/* Accompanying Context Words */}
                <div className="p-2 rounded-xl bg-black/50 border border-white/5 space-y-0.5">
                  <span className="text-[9px] text-stone-400 font-medium">当时对话语境 / 台词：</span>
                  <p className="text-xs text-white/90 italic">
                    {inspectSticker.stolenMeta.contextText || '“（无附带文字）”'}
                  </p>
                </div>

                {/* Emotion Snapshot (if AI stole it) */}
                {inspectSticker.stolenMeta.emotionSnapshot && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[10px] font-medium text-stone-300">
                      <span className="flex items-center gap-1">
                        <Activity className="size-3 text-pink-400" />
                        <span>偷取时 {currentChar.name} 的心情状态：</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
                      {(Object.keys(EMOTION_NAMES) as EmotionKey[]).map((k) => {
                        const val = inspectSticker.stolenMeta?.emotionSnapshot?.[k] ?? 0;
                        const pct = Math.round(val * 100);
                        return (
                          <div
                            key={k}
                            className="p-1 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between px-1.5"
                          >
                            <span className="text-stone-400">{EMOTION_NAMES[k]}</span>
                            <span className={`font-bold ${pct > 50 ? 'text-amber-300' : 'text-stone-300'}`}>
                              {pct}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-black/40 border border-white/5 text-xs text-stone-400 text-center">
                <span>此表情包为手动导入或系统预设表情</span>
              </div>
            )}

            <button
              onClick={() => setInspectSticker(null)}
              className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white font-bold transition cursor-pointer"
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {/* ================= EDIT STICKER MODAL ================= */}
      {editingSticker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-xs rounded-3xl bg-stone-900 border border-white/20 p-4 space-y-3 shadow-2xl text-stone-200">
            <h3 className="text-xs font-bold text-white">编辑表情包信息</h3>
            
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400">表情包名称：</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-stone-950 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-stone-400">分类名称：</label>
              <input
                type="text"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full bg-stone-950 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingSticker(null)}
                className="px-3 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-stone-400 cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs cursor-pointer"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
