import type { MessageSegment, ChatMessage } from '../data/types';
import { History, Clock, ArrowLeftRight } from 'lucide-react';

interface Props {
  message: ChatMessage;
  characterName?: string;
  onRollback?: (id: string) => void;
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

export default function ChatBubble({ message, characterName, onRollback }: Props) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex flex-col items-end gap-1 px-2 group">
        <div className="flex justify-end gap-3 w-full">
          {/* Main Bubble Content */}
          <div className="max-w-[78%] space-y-1">
            <div className="rounded-2xl rounded-tr-sm px-4 py-3 bg-gradient-to-l from-[hsl(28_85%_62%/0.15)] to-[hsl(28_85%_62%/0.06)] border border-[hsl(28_85%_62%/0.25)] backdrop-blur-md shadow-lg shadow-black/10 transition-all duration-300 hover:border-[hsl(28_85%_62%/0.4)]">
              <div className="space-y-1.5">
                {message.segments.map((s, i) => renderSegment(s, i))}
              </div>
            </div>
          </div>

          {/* User Avatar */}
          <div className="size-9 shrink-0 rounded-full flex items-center justify-center bg-[hsl(217_18%_18%)] text-white/80 text-xs font-semibold border border-white/10 shadow-md">
            我
          </div>
        </div>

        {/* Action/Meta Bar */}
        <div className="flex items-center gap-3 pr-12 text-[10px] text-white/30 h-5 mt-0.5 select-none">
          <span className="flex items-center gap-1">
            <Clock className="size-3 text-white/20" />
            {formatTime(message.timestamp)}
          </span>

          {onRollback && (
            <button
              onClick={() => onRollback(message.id)}
              className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/5 hover:bg-[hsl(28_85%_62%/0.25)] hover:text-white border border-white/5 hover:border-[hsl(28_85%_62%/0.5)] text-[10px] text-white/50 transition-all shadow-md group/btn cursor-pointer"
              title="回溯引擎到此消息时的情绪、线程和快照状态"
            >
              <History className="size-3 text-white/40 group-hover/btn:text-[hsl(28_85%_62%)] group-hover/btn:rotate-[-45deg] transition-all duration-300" />
              <span>回溯至此</span>
              {message.snapshot ? (
                <span className="text-[9px] text-white/25 group-hover/btn:text-white/60 pl-1 border-l border-white/10 ml-1">
                  {Object.entries(message.snapshot.emotion)
                    .map(([k, v]) => `${EMOTION_SHORT[k]}${Math.round(v * 100)}`)
                    .slice(0, 3)
                    .join(' ')}
                </span>
              ) : (
                <span className="text-[9px] text-white/25 group-hover/btn:text-white/60 pl-1 border-l border-white/10 ml-1">
                  初始基准
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    );
  }

  // System alert warning bubbles
  const isWarning = message.content.includes('⚠️') || message.content.includes('拦截');

  return (
    <div className="flex flex-col items-start gap-1 px-2 group">
      <div className="flex justify-start gap-3 w-full">
        {/* Avatar */}
        <div className={`size-9 shrink-0 rounded-full bg-gradient-to-br ${isWarning ? 'from-red-500 to-red-600 text-white' : 'from-[hsl(28_85%_62%)] to-[hsl(28_85%_62%/0.6)] text-[hsl(28_30%_10%)]'} flex items-center justify-center text-sm font-bold ring-2 ring-[hsl(28_85%_62%/0.3)] shadow-lg shadow-[hsl(28_85%_62%/0.15)]`}>
          {isWarning ? '警' : (characterName || '?').charAt(0)}
        </div>

        {/* Content Bubble */}
        <div className="max-w-[78%] space-y-1">
          {characterName && !isWarning && (
            <div className="text-[11px] text-white/40 pl-1 font-medium tracking-wide select-none">{characterName}</div>
          )}
          <div className={`rounded-2xl rounded-tl-sm px-4 py-3 bg-gradient-to-r ${isWarning ? 'from-red-500/10 to-red-500/5 border-red-500/30' : 'from-[hsl(220_22%_13%/0.7)] to-[hsl(220_22%_13%/0.45)] border-white/10'} border backdrop-blur-md text-white shadow-lg shadow-black/10 transition-all duration-300 hover:border-white/20`}>
            <div className="space-y-1.5">
              {message.segments.map((s, i) => renderSegment(s, i))}
            </div>
          </div>
        </div>
      </div>

      {/* Action/Meta Bar */}
      {!isWarning && (
        <div className="flex items-center gap-3 pl-12 text-[10px] text-white/30 h-5 mt-0.5 select-none">
          <span className="flex items-center gap-1">
            <Clock className="size-3 text-white/20" />
            {formatTime(message.timestamp)}
          </span>

          {onRollback && (
            <button
              onClick={() => onRollback(message.id)}
              className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/5 hover:bg-[hsl(28_85%_62%/0.25)] hover:text-white border border-white/5 hover:border-[hsl(28_85%_62%/0.5)] text-[10px] text-white/50 transition-all shadow-md group/btn cursor-pointer"
              title="回溯引擎到此消息时的情绪、线程和快照状态"
            >
              <History className="size-3 text-white/40 group-hover/btn:text-[hsl(28_85%_62%)] group-hover/btn:rotate-[-45deg] transition-all duration-300" />
              <span>回溯至此</span>
              {message.snapshot ? (
                <span className="text-[9px] text-white/25 group-hover/btn:text-white/60 pl-1 border-l border-white/10 ml-1">
                  {Object.entries(message.snapshot.emotion)
                    .map(([k, v]) => `${EMOTION_SHORT[k]}${Math.round(v * 100)}`)
                    .slice(0, 3)
                    .join(' ')}
                </span>
              ) : (
                <span className="text-[9px] text-white/25 group-hover/btn:text-white/60 pl-1 border-l border-white/10 ml-1">
                  初始基准
                </span>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
