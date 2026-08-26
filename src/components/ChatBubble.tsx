import { useState, useEffect } from 'react';
import type { MessageSegment, ChatMessage, StickerMeta } from '../data/types';
import { History, Clock, Edit2, CornerDownLeft, AlertCircle, RefreshCw, RotateCcw, Star, Sparkles, Check, Smile, Info } from 'lucide-react';
import { loadUserAvatar, loadCharAvatar } from '../lib/customStore';
import { userStealAiSticker, isStickerStolenByUser, subscribeStickers } from '../lib/stickerStore';

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

function SpeechSegment({ text }: { text: string }) {
  return <p className="whitespace-pre-wrap leading-relaxed text-white/95 text-[14px] font-normal">{text}</p>;
}

function ActionSegment({ text }: { text: string }) {
  const clean = text.replace(/^[（(]|[\n）)]$/g, '').trim();
  return (
    <p className="whitespace-pre-wrap italic leading-relaxed text-[hsl(28_88%_64%)] text-[13.5px] font-medium my-0.5 select-text">
      （{clean}）
    </p>
  );
}

function ThoughtSegment({ text }: { text: string }) {
  const clean = text.replace(/^\*+|\*+$/g, '').replace(/^[（(]|[）)]$/g, '').trim();
  return (
    <div className="my-1.5 pl-2.5 pr-2 py-0.5 border-l-2 border-indigo-400/40 bg-indigo-500/10 rounded-r text-[13px] text-indigo-200/80 italic select-text flex items-baseline gap-1">
      <span className="text-[11px] not-italic text-indigo-300/60 shrink-0 select-none">💭 [心声]</span>
      <p className="whitespace-pre-wrap leading-relaxed font-light">
        *{clean}*
      </p>
    </div>
  );
}

function renderSegment(seg: MessageSegment, idx: number) {
  const key = `${seg.type}-${idx}`;
  switch (seg.type) {
    case 'action':
      return <ActionSegment key={key} text={seg.text} />;
    case 'thought':
      return <ThoughtSegment key={key} text={seg.text} />;
    case 'speech':
    default:
      return <SpeechSegment key={key} text={seg.text} />;
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
    <div className={`flex flex-col gap-1 px-2 w-full group ${isUser ? 'items-end' : 'items-start'}`}>
      <div className={`flex gap-2.5 w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
        {/* Avatar for character */}
        {!isUser && (
          <div className={`size-8 shrink-0 rounded-full overflow-hidden bg-gradient-to-br ${isWarning ? 'from-red-500 to-red-600 text-white' : 'from-[hsl(28_85%_62%)] to-[hsl(28_85%_62%/0.6)] text-[hsl(28_30%_10%)]'} flex items-center justify-center text-xs font-bold ring-2 ring-[hsl(28_85%_62%/0.2)] shadow-md border border-white/20`}>
            {charAvatar && !isWarning ? (
              <img src={charAvatar} alt={characterName || 'char'} className="w-full h-full object-cover" />
            ) : isWarning ? (
              '警'
            ) : (
              (characterName || '?').charAt(0)
            )}
          </div>
        )}

        {/* Content Column (Contains Name, Bubble, Actions, and Error Notice) */}
        <div className={`max-w-[85%] flex flex-col space-y-1 ${isUser ? 'items-end' : 'items-start'}`}>
          {!isUser && characterName && !isWarning && (
            <div className="text-[10px] text-white/40 pl-1 select-none font-medium">
              {characterName}
            </div>
          )}

          {/* Main Chat Bubble */}
          <div
            className={`rounded-xl px-3.5 py-2.5 border backdrop-blur-sm shadow-md transition-all duration-200 ${
              isUser
                ? 'rounded-tr-none bg-gradient-to-l from-[hsl(28_85%_62%/0.12)] to-[hsl(28_85%_62%/0.04)] border-[hsl(28_85%_62%/0.2)] hover:border-[hsl(28_85%_62%/0.35)]'
                : isWarning
                ? 'rounded-tl-none bg-red-950/20 border-red-500/20 text-red-200'
                : 'rounded-tl-none bg-[hsl(220_22%_13%/0.6)] border-white/5 hover:border-white/10'
            }`}
          >
            {isEditing ? (
              <div className="space-y-2 py-1 min-w-[200px] md:min-w-[320px]">
                <textarea
                  value={editVal}
                  onChange={(e) => setEditVal(e.target.value)}
                  className="w-full min-h-[80px] bg-black/50 text-white text-[13px] rounded-lg p-2 border border-white/15 focus:border-[hsl(28_85%_62%)] focus:outline-none focus:ring-1 focus:ring-[hsl(28_85%_62%)]"
                  placeholder="编辑此气泡对话内容..."
                />
                <div className="flex gap-1.5 justify-end">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/15 text-xs text-white/80 transition cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="px-2 py-0.5 rounded bg-[hsl(28_85%_62%/0.8)] hover:bg-[hsl(28_85%_62%)] text-xs text-white transition cursor-pointer"
                  >
                    保存
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Sticker rendering if message has a sticker */}
                {message.sticker && (
                  <div className="space-y-1.5 pt-0.5 pb-1">
                    <div className="relative group/sticker inline-block">
                      {/* Stolen indicator badge on sticker card */}
                      {message.sticker.isStolen && (
                        <div className="absolute -top-2 -left-1.5 z-10 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-extrabold text-[8.5px] px-1.5 py-0.5 rounded-full shadow-md border border-purple-300/60 flex items-center gap-0.5 animate-pulse">
                          <Sparkles className="size-2 text-purple-200" />
                          <span>
                            {message.sticker.stolenMeta?.sourceCharacterName
                              ? `来自 ${message.sticker.stolenMeta.sourceCharacterName}`
                              : !isUser ? '偷你的表情' : '偷自AI'}
                          </span>
                        </div>
                      )}

                      {/* Sticker Image Container */}
                      <div className="w-36 sm:w-44 aspect-square rounded-2xl overflow-hidden bg-black/50 border border-white/15 shadow-lg relative flex items-center justify-center">
                        <img
                          src={message.sticker.url}
                          alt={message.sticker.name}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                          referrerPolicy="no-referrer"
                        />
                      </div>

                      {/* Sticker Name Bar */}
                      <div className="mt-1 flex items-center justify-between gap-1 text-[10.5px]">
                        <span className="font-bold text-white/90 truncate max-w-[110px]">
                          {message.sticker.name}
                        </span>

                        {/* If AI sent this sticker: User can Steal It! */}
                        {!isUser && (
                          <button
                            type="button"
                            onClick={handleStealSticker}
                            disabled={isStolenAlready}
                            className={`px-2 py-0.5 rounded-lg text-[9.5px] font-bold flex items-center gap-1 transition shadow-sm cursor-pointer ${
                              isStolenAlready
                                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 cursor-default'
                                : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 active:scale-95'
                            }`}
                            title={isStolenAlready ? '已在你的表情包库中' : '将此表情包偷到你的主控表情库'}
                          >
                            {isStolenAlready ? (
                              <>
                                <Check className="size-2.5" />
                                <span>已偷取</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="size-2.5" />
                                <span>偷表情</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Text Segments */}
                {message.segments.map((s, i) => renderSegment(s, i))}
              </div>
            )}
          </div>

          {/* Action Row — 4 concise buttons: 编辑 回溯 追加 回复此句 */}
          {!isWarning && (
            <div
              className={`flex flex-wrap items-center gap-1.5 text-[10px] select-none text-white/40 pt-0.5 w-full ${
                isUser ? 'justify-end' : 'justify-start'
              }`}
            >
              {/* If User: Show timestamp first on the left side of the right-aligned cluster */}
              {isUser && (
                <span className="flex items-center gap-0.5 text-white/25 mr-0.5">
                  <Clock className="size-2.5 text-white/20" />
                  {formatTime(message.timestamp)}
                </span>
              )}

              {/* 1. 编辑 (Starts flush left for character) */}
              {onEdit && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 transition-all cursor-pointer text-white/60 hover:text-white"
                  title="修改此气泡的内容"
                >
                  <Edit2 className="size-2.5 text-blue-400" />
                  <span>编辑</span>
                </button>
              )}

              {/* 2. 回溯 */}
              {onRollback && (
                <button
                  onClick={() => onRollback(message.id)}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 hover:bg-[hsl(28_85%_62%/0.12)] border border-white/5 hover:border-[hsl(28_85%_62%/0.25)] transition-all cursor-pointer text-white/60 hover:text-white group/btn"
                  title="回溯整个引擎状态到发送该气泡时的历史快照"
                >
                  <History className="size-2.5 text-white/40 group-hover/btn:text-[hsl(28_85%_62%)] group-hover/btn:rotate-[-45deg] transition-all duration-200" />
                  <span>回溯</span>
                </button>
              )}

              {/* 3. 刷新 / 重roll */}
              {onReroll && (
                <button
                  onClick={() => setIsRerolling(!isRerolling)}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded border transition-all cursor-pointer ${
                    isRerolling
                      ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                      : 'bg-white/5 hover:bg-white/10 border-white/5 hover:border-white/15 text-white/60 hover:text-white'
                  }`}
                  title="刷新重新生成此条回复（支持打分反馈或直接纯净重roll）"
                >
                  <RefreshCw className={`size-2.5 text-amber-400 ${isRerolling ? 'rotate-180 transition-transform duration-300' : ''}`} />
                  <span>刷新</span>
                </button>
              )}

              {/* 4. 回复此句 */}
              {onTriggerReply && (
                <button
                  onClick={() => onTriggerReply(message.id)}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[hsl(28_85%_62%/0.08)] hover:bg-[hsl(28_85%_62%/0.2)] border border-[hsl(28_85%_62%/0.15)] hover:border-[hsl(28_85%_62%/0.35)] text-[hsl(28_85%_62%)] hover:text-white transition-all cursor-pointer"
                  title="以这句话为情感基准，触发角色进行接续回复"
                >
                  <CornerDownLeft className="size-2.5" />
                  <span>回复此句</span>
                </button>
              )}

              {/* If Character: Show timestamp AFTER "回复此句" on the right side of the buttons */}
              {!isUser && (
                <span className="flex items-center gap-0.5 text-white/25 ml-1">
                  <Clock className="size-2.5 text-white/20" />
                  {formatTime(message.timestamp)}
                </span>
              )}
            </div>
          )}

          {/* Inline Reroll & Scoring Panel */}
          {isRerolling && (
            <div
              className={`mt-1.5 w-full max-w-[340px] rounded-xl border border-amber-500/30 bg-[hsl(222_28%_8%/0.97)] p-3 space-y-2.5 shadow-xl backdrop-blur-md ${
                isUser ? 'self-end' : 'self-start'
              }`}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                <div className="flex items-center gap-1.5 text-xs text-amber-300 font-medium">
                  <RefreshCw className="size-3 text-amber-400" />
                  <span>重新生成回复 (重roll)</span>
                </div>
                <button
                  onClick={() => setIsRerolling(false)}
                  className="text-white/40 hover:text-white text-xs px-1 cursor-pointer"
                  title="关闭"
                >
                  ✕
                </button>
              </div>

              {/* Mode 1: 直接重roll (Direct clean reroll without injection) */}
              <div className="p-2 rounded-lg bg-white/5 border border-white/5 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-white/90">直接重roll</span>
                  <span className="text-[9.5px] text-white/40">纯净重新生成 · 不注入提示</span>
                </div>
                <button
                  onClick={() => {
                    onReroll?.(message.id);
                    setIsRerolling(false);
                  }}
                  className="w-full py-1.5 px-2 rounded-lg bg-gradient-to-r from-amber-500/15 to-orange-500/15 hover:from-amber-500/25 hover:to-orange-500/25 border border-amber-500/30 hover:border-amber-400/50 text-amber-200 text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-[0.98]"
                >
                  <RotateCcw className="size-3 text-amber-400" />
                  <span>直接重roll（不注入额外提示）</span>
                </button>
              </div>

              {/* Mode 2: 打分反馈重roll (Score & Reason injection) */}
              <div className="p-2.5 rounded-lg bg-white/5 border border-white/5 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-white/90">打分反馈重roll</span>
                  <span className="text-[9.5px] text-amber-400/80">发送评分与原因给模型</span>
                </div>

                {/* Star/Score Selector (1 - 5) */}
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[10px] text-white/50">满意度评分:</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRerollScore(star)}
                        className={`p-0.5 rounded transition cursor-pointer ${
                          rerollScore >= star ? 'text-amber-400 scale-110' : 'text-white/20 hover:text-white/40'
                        }`}
                        title={`${star} 分`}
                      >
                        <Star className="size-3.5 fill-current" />
                      </button>
                    ))}
                    <span className="text-[10.5px] text-amber-300 font-mono ml-1 font-medium">{rerollScore}分</span>
                  </div>
                </div>

                {/* Quick Feedback Tags */}
                <div className="space-y-1">
                  <span className="text-[9.5px] text-white/40">快捷调整建议:</span>
                  <div className="flex flex-wrap gap-1">
                    {['情绪太生硬', '缺少动作心理', '不够贴合人设', '太冷淡了', '想要更宠溺', '直入主题少废话'].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setRerollReason((prev) => (prev ? `${prev}，${tag}` : tag));
                        }}
                        className="px-1.5 py-0.5 rounded text-[9px] bg-white/5 hover:bg-amber-500/15 border border-white/10 hover:border-amber-400/30 text-white/70 hover:text-amber-200 transition cursor-pointer"
                      >
                        +{tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Text Input for Reason */}
                <textarea
                  value={rerollReason}
                  onChange={(e) => setRerollReason(e.target.value)}
                  placeholder="输入评分原因或调整要求（例如：语气更温柔一点、多写心理独白...）"
                  className="w-full bg-black/40 text-white text-xs rounded-lg p-2 border border-white/10 focus:border-amber-500 focus:outline-none min-h-[46px] placeholder:text-white/25"
                />

                {/* Submit Rated Reroll */}
                <button
                  onClick={() => {
                    onReroll?.(message.id, {
                      score: rerollScore,
                      reason: rerollReason,
                    });
                    setIsRerolling(false);
                  }}
                  className="w-full py-1.5 px-2 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-stone-950 font-bold text-xs flex items-center justify-center gap-1.5 transition shadow cursor-pointer active:scale-[0.98]"
                >
                  <Sparkles className="size-3 text-stone-950" />
                  <span>提交评分并重roll</span>
                </button>
              </div>
            </div>
          )}

          {/* If LLM API Error occurred, show transparent banner with detail toggle and retry */}
          {message.llmError && (
            <div className="mt-1 w-full p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200/90 text-xs space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="size-3.5 text-amber-400 shrink-0" />
                  <span className="font-medium text-[11px]">模型请求未成功，已使用本地引擎回复</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowErrorDetail(!showErrorDetail)}
                    className="text-[10px] text-amber-300/80 hover:text-amber-200 underline cursor-pointer"
                  >
                    {showErrorDetail ? '收起原因' : '查看报错原因'}
                  </button>
                  {onTriggerReply && (
                    <button
                      onClick={() => onTriggerReply(message.id)}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-[10px] text-amber-200 transition cursor-pointer"
                    >
                      <RefreshCw className="size-2.5" />
                      <span>重试</span>
                    </button>
                  )}
                </div>
              </div>
              {showErrorDetail && (
                <div className="p-1.5 rounded bg-black/40 text-[10px] font-mono text-amber-300/80 break-all select-text border border-amber-500/10">
                  {message.llmError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Avatar for user */}
        {isUser && (
          <div className="size-8 shrink-0 rounded-full overflow-hidden flex items-center justify-center bg-[hsl(217_18%_18%)] text-white/70 text-xs font-semibold border border-white/20 shadow-sm">
            {userAvatar ? (
              <img src={userAvatar} alt="我" className="w-full h-full object-cover" />
            ) : (
              '我'
            )}
          </div>
        )}
      </div>
    </div>
  );
}
