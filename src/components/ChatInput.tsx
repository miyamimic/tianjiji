import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { Send, Sparkles, Loader2, Heart } from 'lucide-react';
import { LinePuppyMascot, StardewPixelFlower, FlowerLacePattern } from './FrenchLacePuppyElements';

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
  placeholder = '轻柔细语...（Enter 发送，点击左侧小狗灵犀催促回复）',
  llmReady = false,
}: Props) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [value]);

  const handleSend = () => {
    if (isSubmittingRef.current || disabled) return;
    const trimmed = value.trim();
    if (!trimmed) return;

    isSubmittingRef.current = true;
    setValue('');
    onSend(trimmed);

    setTimeout(() => {
      isSubmittingRef.current = false;
    }, 350);
  };

  const handleTriggerReply = () => {
    if (isSubmittingRef.current || disabled) return;
    isSubmittingRef.current = true;

    const trimmed = value.trim();
    if (trimmed) {
      setValue('');
      onSend(trimmed);
    }
    onRequestReply();

    setTimeout(() => {
      isSubmittingRef.current = false;
    }, 450);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative bg-gradient-to-t from-[#fdf6f7]/95 via-[#fdf6f7]/80 to-transparent pt-3 pb-3 px-3 sm:px-4">
      <div className="max-w-3xl mx-auto relative">
        {/* French Emboss & Lace Border Chassis */}
        <div className="flex items-end gap-2 rounded-2xl border-2 border-[#f2d0d9] bg-white/90 backdrop-blur-md p-2 focus-within:border-[#e07a93] transition-all shadow-[0_4px_20px_rgba(224,122,147,0.12)]">
          {/* Left Icon: Trigger LLM / Character Response with Little Line Puppy mascot */}
          <button
            type="button"
            onClick={handleTriggerReply}
            disabled={disabled}
            className={`shrink-0 rounded-xl h-10 w-10 flex items-center justify-center border transition-all relative group cursor-pointer ${
              disabled
                ? 'border-[#f2d0d9] bg-stone-100 text-stone-300 cursor-not-allowed'
                : 'border-[#f2d0d9] bg-[#fff0f3] text-[#e07a93] hover:bg-[#ffe5ec] hover:border-[#e07a93] active:scale-95 shadow-xs'
            }`}
            title="让角色心有灵犀，主动回复"
            aria-label="让角色回复"
          >
            {disabled ? (
              <Loader2 className="size-4 animate-spin text-[#e07a93]" />
            ) : (
              <>
                <LinePuppyMascot size={26} variant="snuggle" className="group-hover:scale-110 transition-transform" />
                <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-[#e07a93] ring-2 ring-white animate-pulse" />
              </>
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
            className="min-h-[40px] max-h-[160px] resize-none flex-1 bg-transparent border-none shadow-none text-sm md:text-base text-[#4a3e3d] placeholder:text-[#b39e9c] font-serif focus:outline-none px-2 py-1 leading-relaxed"
            rows={1}
          />

          {/* Right Icon: Pure Send Message Button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={disabled || !value.trim()}
            className="shrink-0 rounded-xl h-10 w-10 flex items-center justify-center bg-gradient-to-br from-[#f898ad] to-[#e07a93] text-white hover:from-[#f788a0] hover:to-[#d46580] disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all shadow-md shadow-[#e07a93]/20 cursor-pointer"
            title="发送消息"
            aria-label="发送消息"
          >
            <Send className="size-4" />
          </button>
        </div>

        {/* Footer Subtext with Artistic Typography */}
        <p className="mt-1.5 text-center text-xs font-serif text-[#998380] flex items-center justify-center gap-1.5">
          <StardewPixelFlower />
          <span>{llmReady ? '灵犀链路已连接 · 支持星露谷法式多段情感推演' : '本地剧场模式 · 点击小狗唤醒角色回复'}</span>
          <StardewPixelFlower />
        </p>
      </div>
    </div>
  );
}
