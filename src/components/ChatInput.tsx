import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { Send, Sparkles, Loader2 } from 'lucide-react';

interface Props {
  onSend: (text: string) => void;
  onRequestReply: () => void;
  disabled?: boolean;
  placeholder?: string;
  llmReady?: boolean;
}

export default function ChatInput({
  onSend,
  onRequestReply,
  disabled = false,
  placeholder = '输入消息...（Enter 发送，点击左侧图标让角色回复）',
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

  const handleTriggerReply = () => {
    if (disabled) return;
    const trimmed = value.trim();
    if (trimmed) {
      onSend(trimmed);
      setValue('');
    }
    onRequestReply();
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
          {/* Left Icon: Trigger LLM/Character Response (No text label) */}
          <button
            type="button"
            onClick={handleTriggerReply}
            disabled={disabled}
            className={`shrink-0 rounded-xl h-10 w-10 flex items-center justify-center border transition-all ${
              disabled
                ? 'border-white/5 bg-white/5 text-white/30 cursor-not-allowed'
                : 'border-[hsl(28_85%_62%/0.4)] bg-[hsl(28_85%_62%/0.12)] text-[hsl(28_85%_62%)] hover:bg-[hsl(28_85%_62%/0.25)] hover:border-[hsl(28_85%_62%/0.7)] active:scale-95'
            }`}
            title="让角色回复"
            aria-label="让角色回复"
          >
            {disabled ? (
              <Loader2 className="size-4 animate-spin text-[hsl(28_85%_62%)]" />
            ) : (
              <Sparkles className="size-4.5" />
            )}
          </button>

          {/* Text Area */}
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

          {/* Right Icon: Pure Send Message Button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={disabled || !value.trim()}
            className="shrink-0 rounded-xl h-10 w-10 flex items-center justify-center bg-[hsl(28_85%_62%)] text-[hsl(28_30%_10%)] hover:bg-[hsl(28_85%_62%/0.9)] disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all shadow-sm"
            title="发送消息"
            aria-label="发送消息"
          >
            <Send className="size-4" />
          </button>
        </div>
        <p className="mt-1.5 text-center text-xs text-white/25">
          {llmReady ? 'LLM 已连接 · 左侧图标触发多段 AI 回复 · 发送键仅投递消息' : '本地演示模式 · 左侧图标触发角色回复'}
        </p>
      </div>
    </div>
  );
}
