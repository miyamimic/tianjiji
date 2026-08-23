import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { Send, Sparkles, Loader2, Smile } from 'lucide-react';
import StickerPicker from './StickerPicker';
import type { Sticker } from '../lib/stickerStore';

interface Props {
  onSend: (text: string) => void;
  onSendSticker?: (sticker: Sticker, text?: string) => void;
  onRequestReply: () => void;
  onOpenStickerApp?: () => void;
  disabled?: boolean;
  placeholder?: string;
  llmReady?: boolean;
}

export default function ChatInput({
  onSend,
  onSendSticker,
  onRequestReply,
  onOpenStickerApp,
  disabled = false,
  placeholder = '输入消息...（Enter 发送，点击左侧图标让角色回复）',
  llmReady = false,
}: Props) {
  const [value, setValue] = useState('');
  const [showStickerPicker, setShowStickerPicker] = useState(false);
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

  const handleSelectSticker = (sticker: Sticker) => {
    const trimmed = value.trim();
    if (onSendSticker) {
      onSendSticker(sticker, trimmed);
      setValue('');
    } else {
      onSend(`[表情包: ${sticker.name}] ${trimmed}`);
      setValue('');
    }
    setShowStickerPicker(false);
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
    <div className="relative bg-gradient-to-t from-black/60 to-transparent pt-2 pb-3 px-4">
      <div className="max-w-3xl mx-auto relative">
        
        {/* Sticker Picker Popup */}
        <StickerPicker
          isOpen={showStickerPicker}
          onClose={() => setShowStickerPicker(false)}
          onSelectSticker={handleSelectSticker}
          onOpenFullApp={onOpenStickerApp}
        />

        <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-2 focus-within:border-[hsl(28_85%_62%/0.4)] transition-colors">
          {/* Left Icon: Trigger LLM/Character Response */}
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

          {/* Middle-Right Icon: Sticker Button (Directly Left to Send Button) */}
          <button
            type="button"
            onClick={() => setShowStickerPicker(!showStickerPicker)}
            className={`shrink-0 rounded-xl h-10 w-10 flex items-center justify-center border transition-all cursor-pointer ${
              showStickerPicker
                ? 'border-amber-400 bg-amber-500/20 text-amber-300 ring-2 ring-amber-400/30'
                : 'border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 hover:border-white/20 active:scale-95'
            }`}
            title="选择表情包"
            aria-label="选择表情包"
          >
            <Smile className="size-4.5 text-amber-300/90" />
          </button>

          {/* Right Icon: Pure Send Message Button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={disabled || !value.trim()}
            className="shrink-0 rounded-xl h-10 w-10 flex items-center justify-center bg-[hsl(28_85%_62%)] text-[hsl(28_30%_10%)] hover:bg-[hsl(28_85%_62%/0.9)] disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all shadow-sm cursor-pointer"
            title="发送消息"
            aria-label="发送消息"
          >
            <Send className="size-4" />
          </button>
        </div>
        <p className="mt-1.5 text-center text-xs text-white/25">
          {llmReady ? 'LLM 已连接 · 发送键左侧为表情包库 · 左侧图标触发多段 AI 回复' : '本地演示模式 · 发送键左侧为表情包库 · 左侧图标触发角色回复'}
        </p>
      </div>
    </div>
  );
}
