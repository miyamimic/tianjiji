import { useState } from 'react';
import type { MessageSegment, ChatMessage } from '../data/types';
import { History, Clock, Edit2, CornerDownLeft, Plus, Check, X } from 'lucide-react';

interface Props {
  message: ChatMessage;
  characterName?: string;
  onRollback?: (id: string) => void;
  onEdit?: (id: string, newContent: string) => void;
  onTriggerReply?: (id: string) => void;
  onAddUserMsgOnly?: (id: string, text: string) => void;
}

const EMOTION_SHORT: Record<string, string> = {
  anger: '怒',
  fear: '惧',
  joy: '喜',
  sadness: '悲',
  desire: '欲',
  warmth: '温',
};

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function SpeechSegment({ text }: { text: string }) {
  return <p className="whitespace-pre-wrap leading-relaxed text-white/95 text-[14px]">{text}</p>;
}

function ActionSegment({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-wrap italic leading-relaxed text-[hsl(28_85%_62%)] text-[14px] font-medium my-0.5">
      {text}
    </p>
  );
}

function ThoughtSegment({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-white/45 font-light pl-3 border-l border-white/10 my-1">
      *（{text}）*
    </p>
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
          <div className={`size-8 shrink-0 rounded-full bg-gradient-to-br ${isWarning ? 'from-red-500 to-red-600 text-white' : 'from-[hsl(28_85%_62%)] to-[hsl(28_85%_62%/0.6)] text-[hsl(28_30%_10%)]'} flex items-center justify-center text-xs font-bold ring-2 ring-[hsl(28_85%_62%/0.2)] shadow-md`}>
            {isWarning ? '警' : (characterName || '?').charAt(0)}
          </div>
        )}

        {/* Content Bubble */}
        <div className="max-w-[85%] space-y-0.5">
          {!isUser && characterName && !isWarning && (
            <div className="text-[10px] text-white/40 pl-1 select-none font-medium">
              {characterName}
            </div>
          )}

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
        </div>

        {/* Avatar for user */}
        {isUser && (
          <div className="size-8 shrink-0 rounded-full flex items-center justify-center bg-[hsl(217_18%_18%)] text-white/70 text-xs font-semibold border border-white/10 shadow-sm">
            我
          </div>
        )}
      </div>

      {/* Meta Bar & Actions: ALWAYS VISIBLE beneath the bubble */}
      {!isWarning && (
        <div className={`flex flex-col w-full ${isUser ? 'items-end pr-10' : 'items-start pl-10'} gap-1.5 mt-0.5`}>
          {/* Action Row */}
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] select-none text-white/40">
            {/* Timestamp */}
            <span className="flex items-center gap-0.5 text-white/25 mr-1.5">
              <Clock className="size-2.5 text-white/20" />
              {formatTime(message.timestamp)}
            </span>

            {/* 1. Quick Edit Content */}
            {onEdit && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 transition-all cursor-pointer text-white/60"
                title="修改当前气泡的对话文本"
              >
                <Edit2 className="size-2.5 text-blue-400" />
                <span>编辑气泡</span>
              </button>
            )}

            {/* 2. Rollback to This State */}
            {onRollback && (
              <button
                onClick={() => onRollback(message.id)}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 hover:bg-[hsl(28_85%_62%/0.12)] border border-white/5 hover:border-[hsl(28_85%_62%/0.25)] transition-all cursor-pointer text-white/60 group/btn"
                title="回溯整个引擎状态到发送该气泡时的历史快照"
              >
                <History className="size-2.5 text-white/40 group-hover/btn:text-[hsl(28_85%_62%)] group-hover/btn:rotate-[-45deg] transition-all duration-200" />
                <span>回溯至此</span>
                {message.snapshot ? (
                  <span className="text-[8px] text-white/30 pl-1 border-l border-white/10 ml-0.5">
                    {Object.entries(message.snapshot.emotion)
                      .map(([k, v]) => `${EMOTION_SHORT[k]}${Math.round(v * 100)}`)
                      .slice(0, 3)
                      .join(' ')}
                  </span>
                ) : (
                  <span className="text-[8px] text-white/30 pl-1 border-l border-white/10 ml-0.5">初始</span>
                )}
              </button>
            )}

            {/* 3. Insert user message only */}
            {onAddUserMsgOnly && (
              <button
                onClick={() => setIsAddingUserMsg(!isAddingUserMsg)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded border transition-all cursor-pointer ${
                  isAddingUserMsg
                    ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                    : 'bg-white/5 hover:bg-white/10 border-white/5 hover:border-white/15 text-white/60'
                }`}
                title="在此气泡后直接插入我的下一句话（不触发AI自动回复，可形成连续发言）"
              >
                <Plus className="size-2.5 text-emerald-400" />
                <span>追加我发言</span>
              </button>
            )}

            {/* 4. Trigger character reply to this sentence */}
            {onTriggerReply && (
              <button
                onClick={() => onTriggerReply(message.id)}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-[hsl(28_85%_62%/0.08)] hover:bg-[hsl(28_85%_62%/0.2)] border border-[hsl(28_85%_62%/0.15)] hover:border-[hsl(28_85%_62%/0.35)] text-[hsl(28_85%_62%)] hover:text-white transition-all cursor-pointer"
                title="强制让角色在此处重新进行一轮推演与回复（即使该对话已被回溯或被编辑）"
              >
                <CornerDownLeft className="size-2.5" />
                <span>角色回复此句</span>
              </button>
            )}
          </div>

          {/* Inline input for appending user message */}
          {isAddingUserMsg && (
            <div className="mt-1 w-full max-w-[320px] rounded-lg border border-[hsl(28_85%_62%/0.3)] bg-[hsl(222_28%_8%/0.95)] p-2 space-y-1.5 shadow-md">
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
        </div>
      )}
    </div>
  );
}
