import type { MessageSegment, ChatMessage } from '../data/types';
import { History, Pencil, X, Check } from 'lucide-react';
import { useState } from 'react';

interface Props {
  message: ChatMessage;
  characterName?: string;
  onRollback?: (id: string) => void;
  onEdit?: (id: string, newContent: string) => void;
}

const EMOTION_SHORT: Record<string, string> = {
  anger: '怒',
  fear: '惧',
  joy: '喜',
  sadness: '悲',
  desire: '欲',
  warmth: '温',
};

function SpeechSegment({ text }: { text: string }) {
  return <p className="whitespace-pre-wrap leading-relaxed text-white/90 text-[14px]">{text}</p>;
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
    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-white/40 font-light pl-3 border-l border-white/5 my-1">
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

export default function ChatBubble({ message, characterName, onRollback, onEdit }: Props) {
  const isUser = message.role === 'user';
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);

  const handleSaveEdit = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== message.content && onEdit) {
      onEdit(message.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(message.content);
    setIsEditing(false);
  };

  if (isUser) {
    return (
      <div className="flex flex-col items-end gap-2 px-2">
        <div className="flex justify-end gap-3 w-full">
          {/* Main Bubble Content - 宽度从 78% 调整到 65% */}
          <div className="max-w-[65%] space-y-1">
            <div className="rounded-2xl rounded-tr-sm px-4 py-3 bg-gradient-to-l from-[hsl(28_85%_62%/0.2)] to-[hsl(28_85%_62%/0.08)] border border-[hsl(28_85%_62%/0.35)] backdrop-blur-md shadow-lg shadow-black/10 transition-all duration-300">
              {isEditing ? (
                <div className="space-y-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full bg-black/30 border border-[hsl(28_85%_62%/0.4)] rounded-lg px-3 py-2 text-[14px] text-white focus:outline-none focus:border-[hsl(28_85%_62%)] resize-none min-h-[80px]"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={handleCancelEdit}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 text-xs transition-colors"
                    >
                      <X className="size-3" /> 取消
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[hsl(28_85%_62%)] hover:bg-[hsl(28_85%_62%/0.9)] text-[hsl(28_30%_10%)] text-xs font-medium transition-colors"
                    >
                      <Check className="size-3" /> 保存并重算
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {message.segments.map((s, i) => renderSegment(s, i))}
                </div>
              )}
            </div>

            {/* Action Bar - 紧贴气泡，按钮清晰可见，无需hover */}
            {!isEditing && (
              <div className="flex items-center gap-1.5 justify-end mt-1">
                {onEdit && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 hover:bg-[hsl(28_85%_62%/0.3)] hover:text-white border border-white/15 hover:border-[hsl(28_85%_62%/0.5)] text-[11px] text-white/70 transition-all shadow-md cursor-pointer"
                    title="修改此条消息（保存后将从该条开始重新计算后续对话）"
                  >
                    <Pencil className="size-3.5" />
                    <span>修改</span>
                  </button>
                )}

                {onRollback && (
                  <button
                    onClick={() => onRollback(message.id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 hover:bg-[hsl(28_85%_62%/0.3)] hover:text-white border border-white/15 hover:border-[hsl(28_85%_62%/0.5)] text-[11px] text-white/70 transition-all shadow-md cursor-pointer"
                    title="回溯引擎到此消息时的情绪、线程和快照状态"
                  >
                    <History className="size-3.5" />
                    <span>回溯至此</span>
                    {message.snapshot && (
                      <span className="text-[10px] text-white/50 pl-1 border-l border-white/20 ml-1">
                        {Object.entries(message.snapshot.emotion)
                          .map(([k, v]) => `${EMOTION_SHORT[k]}${Math.round(v * 100)}`)
                          .slice(0, 2)
                          .join(' ')}
                      </span>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* User Avatar */}
          <div className="size-9 shrink-0 rounded-full flex items-center justify-center bg-[hsl(217_18%_18%)] text-white/80 text-xs font-semibold border border-white/10 shadow-md">
            我
          </div>
        </div>
      </div>
    );
  }

  // System alert warning bubbles
  const isWarning = message.content.includes('⚠️') || message.content.includes('拦截');

  return (
    <div className="flex flex-col items-start gap-2 px-2">
      <div className="flex justify-start gap-3 w-full">
        {/* Avatar */}
        <div className={`size-9 shrink-0 rounded-full bg-gradient-to-br ${isWarning ? 'from-red-500 to-red-600 text-white' : 'from-[hsl(28_85%_62%)] to-[hsl(28_85%_62%/0.6)] text-[hsl(28_30%_10%)]'} flex items-center justify-center text-sm font-bold ring-2 ring-[hsl(28_85%_62%/0.3)] shadow-lg shadow-[hsl(28_85%_62%/0.15)]`}>
          {isWarning ? '警' : (characterName || '?').charAt(0)}
        </div>

        {/* Content Bubble - 宽度从 78% 调整到 65% */}
        <div className="max-w-[65%] space-y-1">
          {characterName && !isWarning && (
            <div className="text-[11px] text-white/60 pl-1 font-medium tracking-wide select-none">{characterName}</div>
          )}
          <div className={`rounded-2xl rounded-tl-sm px-4 py-3 bg-gradient-to-r ${isWarning ? 'from-red-500/10 to-red-500/5 border-red-500/30' : 'from-[hsl(220_22%_13%/0.85)] to-[hsl(220_22%_13%/0.6)] border-white/15'} border backdrop-blur-md text-white shadow-lg shadow-black/10 transition-all duration-300`}>
            <div className="space-y-1.5">
              {message.segments.map((s, i) => renderSegment(s, i))}
            </div>
          </div>

          {/* Action Bar - 紧贴气泡，按钮清晰可见，无需hover */}
          {!isWarning && (
            <div className="flex items-center gap-1.5 mt-1">
              {onRollback && (
                <button
                  onClick={() => onRollback(message.id)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 hover:bg-[hsl(28_85%_62%/0.3)] hover:text-white border border-white/15 hover:border-[hsl(28_85%_62%/0.5)] text-[11px] text-white/70 transition-all shadow-md cursor-pointer"
                  title="回溯引擎到此消息时的情绪、线程和快照状态"
                >
                  <History className="size-3.5" />
                  <span>回溯至此</span>
                  {message.snapshot && (
                    <span className="text-[10px] text-white/50 pl-1 border-l border-white/20 ml-1">
                      {Object.entries(message.snapshot.emotion)
                        .map(([k, v]) => `${EMOTION_SHORT[k]}${Math.round(v * 100)}`)
                        .slice(0, 2)
                        .join(' ')}
                    </span>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
