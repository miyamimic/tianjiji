import React, { useState, useRef } from 'react';
import { Image as ImageIcon, Upload, RotateCcw, Check, Sparkles } from 'lucide-react';
import { loadCustomChatBg, saveCustomChatBg, removeCustomChatBg } from '../../lib/customStore';

interface Props {
  onBgChange: (newBg: string) => void;
  currentBg?: string;
}

const PRESET_BGS = [
  { id: 'default', name: '默认', url: '/https://i.postimg.cc/9fkRGTM0/chat-bg.jpg' },
  { id: 'rain', name: '夜雨微澜', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200&auto=format&fit=crop' },
  { id: 'lounge', name: '暮色沉醉酒馆', url: 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?q=80&w=1200&auto=format&fit=crop' },
  { id: 'cyber', name: '赛博霓虹窗景', url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=1200&auto=format&fit=crop' },
  { id: 'kyoto', name: '静夜和风纸窗', url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop' },
];

export default function WallpaperApp({ onBgChange, currentBg }: Props) {
  const [customUrl, setCustomUrl] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePresetSelect = (url: string) => {
    saveCustomChatBg(url);
    onBgChange(url);
    setUploadSuccess(true);
    setTimeout(() => setUploadSuccess(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        saveCustomChatBg(dataUrl);
        onBgChange(dataUrl);
        setUploadSuccess(true);
        setTimeout(() => setUploadSuccess(false), 2000);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl.trim()) return;
    saveCustomChatBg(customUrl.trim());
    onBgChange(customUrl.trim());
    setCustomUrl('');
    setUploadSuccess(true);
    setTimeout(() => setUploadSuccess(false), 2000);
  };

  const handleReset = () => {
    removeCustomChatBg();
    onBgChange('/chat_bg.png');
    setUploadSuccess(true);
    setTimeout(() => setUploadSuccess(false), 2000);
  };

  return (
    <div className="space-y-4 text-xs text-white/90 pb-6 animate-in fade-in-0 duration-200">
      {/* Upload local image card */}
      <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-white flex items-center gap-1.5 text-xs">
            <Upload className="size-3.5 text-[hsl(28_85%_62%)]" />
            上传自定义背景图 (chat_bg)
          </span>
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white transition-colors"
          >
            <RotateCcw className="size-3" />
            还原默认壁纸
          </button>
        </div>

        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-white/20 hover:border-[hsl(28_85%_62%/0.6)] bg-black/40 rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 group"
        >
          <div className="p-2 rounded-full bg-white/5 group-hover:bg-[hsl(28_85%_62%/0.1)] transition-colors">
            <ImageIcon className="size-5 text-white/60 group-hover:text-[hsl(28_85%_62%)]" />
          </div>
          <p className="text-[11px] text-white/80 font-medium">点击上传手机本地图片 / 壁纸</p>
          <p className="text-[9px] text-white/40">支持 JPG, PNG, WEBP (自动持久化保存)</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {/* URL Input */}
        <form onSubmit={handleUrlSubmit} className="flex gap-2">
          <input
            type="url"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="或粘贴网络图片 URL (https://...)"
            className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-white/10 bg-black/50 text-white placeholder:text-white/30 focus:outline-none focus:border-[hsl(28_85%_62%/0.5)]"
          />
          <button
            type="submit"
            disabled={!customUrl.trim()}
            className="px-3 py-1.5 text-xs rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium disabled:opacity-30 transition-colors"
          >
            应用
          </button>
        </form>

        {uploadSuccess && (
          <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium animate-in fade-in-0 duration-200">
            <Check className="size-3.5" />
            <span>背景装扮已实时同步更换！</span>
          </div>
        )}
      </div>

      {/* Atmospheric Wallpaper Presets */}
      <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] space-y-3">
        <span className="font-semibold text-white flex items-center gap-1.5 text-xs">
          <Sparkles className="size-3.5 text-[hsl(28_85%_62%)]" />
          精选氛围壁纸预设
        </span>
        <div className="grid grid-cols-2 gap-2.5">
          {PRESET_BGS.map((preset) => {
            const isSelected = currentBg === preset.url || (!currentBg && preset.id === 'default');
            return (
              <button
                key={preset.id}
                onClick={() => handlePresetSelect(preset.url)}
                className={`group relative rounded-xl overflow-hidden border text-left transition-all aspect-[16/10] ${
                  isSelected
                    ? 'border-[hsl(28_85%_62%)] ring-2 ring-[hsl(28_85%_62%/0.4)] shadow-lg'
                    : 'border-white/10 hover:border-white/30'
                }`}
              >
                <img
                  src={preset.url}
                  alt={preset.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-2">
                  <span className="text-[10px] font-semibold text-white flex items-center justify-between w-full">
                    {preset.name}
                    {isSelected && <Check className="size-3 text-[hsl(28_85%_62%)] shrink-0" />}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
