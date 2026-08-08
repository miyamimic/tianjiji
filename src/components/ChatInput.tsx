import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  llmReady?: boolean;
}

export default function ChatInput({
  onSend,
  disabled = false,
  placeholder = '输入消息...（Enter 发送，Shift+Enter 换行）',
  llmReady = false,
}: Props) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [value]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-gradient-to-t from-black/60 to-transparent pt-2 pb-3 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-2 focus-within:border-[hsl(28_85%_62%/0.4)] transition-colors">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="min-h-[40px] max-h-[160px] resize-none flex-1 bg-transparent border-none shadow-none text-sm md:text-base text-white placeholder:text-white/30 focus:outline-none px-2 py-1"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={disabled || !value.trim()}
            className="shrink-0 rounded-xl h-10 w-10 flex items-center justify-center bg-[hsl(28_85%_62%)] text-[hsl(28_30%_10%)] hover:bg-[hsl(28_85%_62%/0.9)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="发送"
          >
            <Send className="size-4" />
          </button>
        </div>
        <p className="mt-1.5 text-center text-xs text-white/25">
          {llmReady ? 'LLM 已连接 · AI 生成回复' : '本地演示模式 · 设置中配置 LLM 接口'}
        </p>
      </div>
    </div>
  );
}
