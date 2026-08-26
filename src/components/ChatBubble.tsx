import { useState, useEffect, useRef } from 'react';
import type { MessageSegment, ChatMessage, StickerMeta } from '../data/types';
import { History, Clock, Edit2, CornerDownLeft, AlertCircle, RefreshCw, Star, Sparkles, Check, Smile, Info, Heart, Zap } from 'lucide-react';
import { loadUserAvatar, loadCharAvatar } from '../lib/customStore';
import { userStealAiSticker, isStickerStolenByUser, subscribeStickers } from '../lib/stickerStore';
import { FrenchCornerLace, LinePuppyMascot, StardewPixelFlower, ClockRollbackIcon } from './FrenchLacePuppyElements';

interface Props {
  message: ChatMessage;
  characterName?: string;
  characterId?: string;
  onRollback?: (id: string) => void;
  onEdit?: (id: string, newContent: string) => void;
  onTriggerReply?: (id: string) => void;
  onReroll?: (id: string, feedback?: { score?: number; reason?: string }) => void;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function SpeechSegment({ text, isUser }: { text: string; isUser?: boolean }) {
  return (
    <p className={`whitespace-pre-wrap leading-relaxed text-[14.5px] font-qingkong ${isUser ? 'text-[#361a0f] font-medium' : 'text-[#2a2423] font-normal'}`}>
      {text}
    </p>
  );
}

function ActionSegment({ text }: { text: string }) {
  const clean = text.replace(/^[（(]|[\n）)]$/g, '').replace(/^[(（]|[\n)）]$/g, '').trim();
  return (
    <p className="whitespace-pre-wrap not-italic font-medium font-sans leading-relaxed text-[#d78b9b] text-[13.5px] my-0.5 select-text">
      {clean}
    </p>
  );
}

function ThoughtSegment({ text }: { text: string }) {
  const clean = text.replace(/^\*+|\*+$/g, '').replace(/^[（(]|[）)]$/g, '').trim();
  return (
    <p className="whitespace-pre-wrap italic font-nanchankeben font-normal leading-relaxed text-[#69573e] bg-[#eed9d9] [border-style:groove] text-[13px] my-0.5 select-text px-1.5 py-0.5 rounded-sm">
      *{clean}*
    </p>
  );
}

function renderSegment(seg: MessageSegment, idx: number, isUser?: boolean) {
  const key = `${seg.type}-${idx}`;
  switch (seg.type) {
    case 'action':
      return <ActionSegment key={key} text={seg.text} />;
    case 'thought':
      return <ThoughtSegment key={key} text={seg.text} />;
    case 'speech':
    default:
      return <SpeechSegment key={key} text={seg.text} isUser={isUser} />;
  }
}

export default function ChatBubble({
  message,
  characterName,
  characterId = 'char_001',
  onRollback,
  onEdit,
  onTriggerReply,
  onReroll,
}: Props) {
  const isUser = message.role === 'user';
  const isWarning = message.content.includes('⚠️') || message.content.includes('拦截');

  const [isEditing, setIsEditing] = useState(false);
  const [editVal, setEditVal] = useState(message.content);
  const [isRerolling, setIsRerolling] = useState(false);
  const [rerollScore, setRerollScore] = useState<number>(3);
  const [rerollReason, setRerollReason] = useState<string>('');
  const [showErrorDetail, setShowErrorDetail] = useState(false);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);

  const [isStolenAlready, setIsStolenAlready] = useState(() => {
    if (!message.sticker) return false;
    return isStickerStolenByUser(message.sticker.url);
  });

  useEffect(() => {
    if (!message.sticker) return;
    const unsub = subscribeStickers(() => {
      setIsStolenAlready(isStickerStolenByUser(message.sticker!.url));
    });
    return unsub;
  }, [message.sticker]);

  const charAvatar = loadCharAvatar(characterId);
  const userAvatar = loadUserAvatar();

  const lastRerollClickRef = useRef<number>(0);

  const handleRerollClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = Date.now();
    if (now - lastRerollClickRef.current < 450) {
      // 连续点两次刷新：自动不评分直接roll
      lastRerollClickRef.current = 0;
      setIsRerolling(false);
      if (onReroll) {
        onReroll(message.id);
      }
    } else {
      lastRerollClickRef.current = now;
      setIsRerolling((v) => !v);
    }
  };

  const handleSaveEdit = () => {
    if (onEdit && editVal.trim()) {
      onEdit(message.id, editVal);
      setIsEditing(false);
    }
  };

  const handleStealSticker = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!message.sticker) return;
    userStealAiSticker(characterId, characterName || '角色', message.sticker, message.content);
    setIsStolenAlready(true);
  };

  return (
    <div className={`flex flex-col gap-1 px-1 sm:px-2 w-full group ${isUser ? 'items-end' : 'items-start'}`}>
      <div className={`flex gap-2.5 w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
        {/* Avatar for character */}
        {!isUser && (
          <div className={`size-9 shrink-0 rounded-full overflow-hidden bg-gradient-to-br ${
            isWarning 
              ? 'from-rose-400 to-rose-600 text-white' 
              : 'from-[#fcd3de] to-[#f7a8be] text-[#8a3854]'
          } flex items-center justify-center text-xs font-serif font-bold ring-2 ring-white shadow-md border border-[#f2d0d9] relative`}>
            {charAvatar && !isWarning ? (
              <img src={charAvatar} alt={characterName || 'char'} className="w-full h-full object-cover" />
            ) : isWarning ? (
              '警'
            ) : (
              (characterName || '?').charAt(0)
            )}
          </div>
        )}

        {/* Content Column */}
        <div className={`max-w-[88%] sm:max-w-[82%] flex flex-col space-y-1 ${isUser ? 'items-end' : 'items-start'}`}>
          {!isUser && characterName && !isWarning && (
            <div className="text-[11px] text-[#998380] pl-1 select-none font-serif font-semibold flex items-center gap-1">
              <span>{characterName}</span>
              <StardewPixelFlower />
            </div>
          )}

          {/* Main Chat Bubble (French Vintage Lace & Stardew Light Theme) */}
          <div
            className={`relative rounded-2xl px-4 py-3 border shadow-sm transition-all duration-200 ${
              isUser
                ? 'rounded-tr-none bg-gradient-to-br from-[#fef2f4] to-[#fce4eb] border-[#f2c6d2] text-[#4a3e3d] shadow-[0_2px_12px_rgba(224,122,147,0.1)]'
                : isWarning
                ? 'rounded-tl-none bg-rose-50 border-rose-200 text-rose-800'
                : 'rounded-tl-none bg-white/90 backdrop-blur-md border-[#f2d0d9] text-[#3d3130] shadow-[0_4px_16px_rgba(0,0,0,0.03)]'
            }`}
          >
            {/* Delicate Corner Lace Accent on AI Bubble */}
            {!isUser && !isWarning && (
              <FrenchCornerLace position="top-right" className="absolute top-0 right-0 text-[#e07a93] opacity-35" />
            )}

            {isEditing ? (
              <div className="space-y-2 py-1 min-w-[200px] md:min-w-[320px]">
                <textarea
                  value={editVal}
                  onChange={(e) => setEditVal(e.target.value)}
                  className="w-full min-h-[80px] bg-white text-[#4a3e3d] text-[13px] rounded-xl p-2.5 border-2 border-[#e07a93] focus:outline-none shadow-inner"
                  placeholder="编辑此气泡对话内容..."
                />
                <div className="flex gap-1.5 justify-end">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-xs text-[#665554] transition cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="px-3 py-1 rounded-lg bg-[#e07a93] hover:bg-[#d46580] text-xs font-semibold text-white transition flex items-center gap-1 shadow-sm cursor-pointer"
                  >
                    <Check className="size-3" />
                    保存修改
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {/* Segments Rendering */}
                {message.segments && message.segments.length > 0 ? (
                  message.segments.map((seg, i) => renderSegment(seg, i, isUser))
                ) : (
                  <p className="whitespace-pre-wrap leading-relaxed text-[14px]">
                    {message.content}
                  </p>
                )}

                {/* Sticker Attachment */}
                {message.sticker && (
                  <div className="pt-2 pb-1 flex flex-col items-start gap-1">
                    <div className="relative group/stk inline-block rounded-2xl overflow-hidden border border-[#f2d0d9] bg-white p-1.5 shadow-sm">
                      <img
                        src={message.sticker.url}
                        alt={message.sticker.name || 'sticker'}
                        className="max-h-36 max-w-[200px] object-contain rounded-xl"
                      />
                      {!isUser && (
                        <button
                          onClick={handleStealSticker}
                          disabled={isStolenAlready}
                          className={`absolute bottom-2 right-2 px-2 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1 backdrop-blur-md shadow transition-all ${
                            isStolenAlready
                              ? 'bg-emerald-500/80 text-white'
                              : 'bg-black/60 text-white hover:bg-[#e07a93]'
                          }`}
                        >
                          {isStolenAlready ? (
                            <>
                              <Check className="size-2.5" />
                              已收藏
                            </>
                          ) : (
                            <>
                              <Smile className="size-2.5" />
                              存为表情
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Timestamp & Interactive Utilities Toolbar (Rollback, Edit, Reroll) */}
          <div className="flex items-center gap-1.5 text-[10.5px] text-[#4a3431] font-semibold px-1 select-none font-serif">
            <span className="text-[#4a3431]">{formatTime(message.timestamp)}</span>

            {/* Quick Action Tools visible on hover or always accessible */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ml-1.5">
              {/* Rollback */}
              {onRollback && (
                <button
                  onClick={() => onRollback(message.id)}
                  title="回档至此轮对话"
                  className="p-1 rounded-md bg-[#fae1e8]/70 hover:bg-[#f2cad4] text-[#4a3431] hover:text-[#732641] transition cursor-pointer border border-[#f2cad4]/60 shadow-2xs"
                >
                  <ClockRollbackIcon size={14} className="text-[#4a3431] group-hover/btn:text-[#732641]" />
                </button>
              )}

              {/* Edit */}
              {onEdit && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  title="编辑此条消息"
                  className="p-1 rounded-md bg-[#fae1e8]/70 hover:bg-[#f2cad4] text-[#4a3431] hover:text-[#732641] transition cursor-pointer border border-[#f2cad4]/60 shadow-2xs"
                >
                  <Edit2 className="size-3.5 stroke-[2.2]" />
                </button>
              )}

              {/* Reroll for AI response */}
              {!isUser && onReroll && (
                <button
                  onClick={handleRerollClick}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setIsRerolling(false);
                    onReroll(message.id);
                  }}
                  title="连续点击两次刷新可直接重roll，或单击打开评分面板"
                  className="p-1 rounded-md bg-[#fae1e8]/70 hover:bg-[#f2cad4] text-[#4a3431] hover:text-[#732641] transition cursor-pointer border border-[#f2cad4]/60 shadow-2xs"
                >
                  <RefreshCw className="size-3.5 stroke-[2.2]" />
                </button>
              )}

              {/* Manual Trigger Reply */}
              {isUser && onTriggerReply && (
                <button
                  onClick={() => onTriggerReply(message.id)}
                  title="以此条消息重新请求回复"
                  className="p-1 rounded-md bg-[#fae1e8]/70 hover:bg-[#f2cad4] text-[#4a3431] hover:text-[#732641] transition cursor-pointer border border-[#f2cad4]/60 shadow-2xs"
                >
                  <CornerDownLeft className="size-3.5 stroke-[2.2]" />
                </button>
              )}
            </div>
          </div>

          {/* Reroll Feedback Drawer */}
          {isRerolling && !isUser && onReroll && (
            <div className="w-full mt-1.5 p-3 rounded-2xl border border-[#f2cad4] bg-[#fffafb] shadow-md space-y-2.5 text-xs text-[#4a3431] font-serif animate-in fade-in-0 duration-150">
              <div className="flex items-center justify-between font-bold text-[#4a3431] border-b border-[#fce4eb] pb-1.5">
                <span className="flex items-center gap-1.5 text-[#4a3431]">
                  <RefreshCw className="size-3 text-[#b83d5a]" />
                  重新推演生成 (连续双击刷新可直接roll)
                </span>
                <button
                  onClick={() => setIsRerolling(false)}
                  className="text-[#998380] hover:text-[#4a3431] font-sans text-xs px-1"
                >
                  ✕
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-[#4a3431]">满意度评分:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((score) => (
                    <button
                      key={score}
                      onClick={() => setRerollScore(score)}
                      className={`p-1 rounded-md transition ${
                        rerollScore >= score ? 'text-[#e67e22]' : 'text-[#e5d5d8]'
                      }`}
                    >
                      <Star className="size-3.5 fill-current" />
                    </button>
                  ))}
                </div>
              </div>

              <input
                type="text"
                value={rerollReason}
                onChange={(e) => setRerollReason(e.target.value)}
                placeholder="可选指导（例如：多一些细腻动作描写/更温柔一点）"
                className="w-full px-2.5 py-1.5 rounded-xl border border-[#f2cad4] bg-[#fff5f7] text-xs text-[#4a3431] placeholder:text-[#b3a19e] focus:outline-none focus:border-[#b83d5a]"
              />

              <div className="flex items-center justify-between gap-1.5 pt-1">
                <button
                  onClick={() => {
                    onReroll(message.id);
                    setIsRerolling(false);
                  }}
                  className="px-2.5 py-1 rounded-xl bg-[#fae1e8] hover:bg-[#f7d0dc] text-[#732641] font-semibold text-[11px] flex items-center gap-1 transition cursor-pointer border border-[#f2cad4]"
                  title="跳过评分与指导，直接重新roll一条"
                >
                  <Zap className="size-3 text-[#b83d5a]" />
                  <span>不评分直接roll</span>
                </button>

                <div className="flex gap-1.5">
                  <button
                    onClick={() => setIsRerolling(false)}
                    className="px-2.5 py-1 rounded-xl bg-[#fcedf1] text-[#785b56] hover:text-[#4a3431] text-[11px] transition cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => {
                      onReroll(message.id, { score: rerollScore, reason: rerollReason });
                      setIsRerolling(false);
                    }}
                    className="px-3 py-1 rounded-xl bg-[#b83d5a] hover:bg-[#a0314c] text-white text-[11px] font-bold flex items-center gap-1 shadow-sm transition cursor-pointer"
                  >
                    <RefreshCw className="size-3" />
                    <span>带评分刷新</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Avatar for user */}
        {isUser && (
          <div className="size-9 shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-[#fed7aa] to-[#f97316] text-[#7c2d12] flex items-center justify-center text-xs font-serif font-bold ring-2 ring-white shadow-md border border-[#fed7aa]">
            {userAvatar ? (
              <img src={userAvatar} alt="user" className="w-full h-full object-cover" />
            ) : (
              '主'
            )}
          </div>
        )}
      </div>
    </div>
  );
}
