import { useState } from 'react';
import type { MessageSegment, ChatMessage } from '../data/types';
import { History, Clock, Edit2, CornerDownLeft, Plus, AlertCircle, RefreshCw } from 'lucide-react';
import { loadUserAvatar, loadCharAvatar } from '../lib/customStore';

interface Props {
  message: ChatMessage;
  characterName?: string;
  characterId?: string;
  onRollback?: (id: string) => void;
  onEdit?: (id: string, newContent: string) => void;
  onTriggerReply?: (id: string) => void;
  onAddUserMsgOnly?: (id: string, text: string) => void;
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
  onAddUserMsgOnly,
}: Props) {
  const isUser = message.role === 'user';
  const isWarning = message.content.includes('⚠️') || message.content.includes('拦截');

  const [isEditing, setIsEditing] = useState(false);
  const [editVal, setEditVal] = useState(message.content);
  const [isAddingUserMsg, setIsAddingUserMsg] = useState(false);
  const [userMsgVal, setUserMsgVal] = useState('');
  const [showErrorDetail, setShowErrorDetail] = useState(false);

  const charAvatar = loadCharAvatar(characterId);
  const userAvatar = loadUserAvatar();

  const handleSaveEdit = () => {
    if (onEdit && editVal.trim()) {
      onEdit(message.id, editVal);
      setIsEditing(false);
    }
  };

  const handleAddUserMsg = () => {
    if (onAddUserMsgOnly && userMsgVal.trim()) {
      onAddUserMsgOnly(message.id, userMsgVal);
      setIsAddingUserMsg(false);
      setUserMsgVal('');
    }
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
              <div className="space-y-1">
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

              {/* 3. 追加 */}
              {onAddUserMsgOnly && (
                <button
                  onClick={() => setIsAddingUserMsg(!isAddingUserMsg)}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded border transition-all cursor-pointer ${
                    isAddingUserMsg
                      ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                      : 'bg-white/5 hover:bg-white/10 border-white/5 hover:border-white/15 text-white/60 hover:text-white'
                  }`}
                  title="在此气泡后直接插入我的下一句话（不触发AI自动回复）"
                >
                  <Plus className="size-2.5 text-emerald-400" />
                  <span>追加</span>
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

          {/* Inline input for appending user message */}
          {isAddingUserMsg && (
            <div
              className={`mt-1 w-full max-w-[320px] rounded-lg border border-[hsl(28_85%_62%/0.3)] bg-[hsl(222_28%_8%/0.95)] p-2 space-y-1.5 shadow-md ${
                isUser ? 'self-end' : 'self-start'
              }`}
            >
              <p className="text-[9px] text-[hsl(28_85%_62%)] font-medium">
                追加不触发自动回复的发言内容：
              </p>
              <input
                type="text"
                value={userMsgVal}
                onChange={(e) => setUserMsgVal(e.target.value)}
                className="w-full bg-black/40 text-white text-xs rounded p-1 border border-white/10 focus:border-[hsl(28_85%_62%)] focus:outline-none"
                placeholder="在此气泡后直接插入我的发言..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddUserMsg();
                  }
                }}
              />
              <div className="flex gap-1.5 justify-end">
                <button
                  onClick={() => setIsAddingUserMsg(false)}
                  className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] text-white/60 transition cursor-pointer"
                >
                  取消
                </button>
                <button
                  onClick={handleAddUserMsg}
                  className="px-2 py-0.5 rounded bg-[hsl(28_85%_62%/0.8)] hover:bg-[hsl(28_85%_62%)] text-[10px] text-white transition cursor-pointer"
                >
                  追加
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
