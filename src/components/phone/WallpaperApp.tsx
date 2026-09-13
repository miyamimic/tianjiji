import React, { useState, useRef } from 'react';
import { Image as ImageIcon, Upload, RotateCcw, Check, Sparkles } from 'lucide-react';
import { loadCustomChatBg, saveCustomChatBg, removeCustomChatBg } from '../../lib/customStore';

interface Props {
  onBgChange: (newBg: string) => void;
  currentBg?: string;
}

const PRESET_BGS = [
  {
    id: 'sakura_candle_arch',
    name: '🌸 浪漫花海烛光拱门',
    url: '/chat_bg.png',
    isSpecial: true,
  },
  {
    id: 'default',
    name: '原版壁炉吧台',
    url: '/chat_bg_bar.png',
  },
  {
    id: 'rain',
    name: '夜雨微澜',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200&auto=format&fit=crop',
  },
  {
    id: 'lounge',
    name: '暮色沉醉酒馆',
    url: 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?q=80&w=1200&auto=format&fit=crop',
  },
  {
    id: 'cyber',
    name: '赛博霓虹窗景',
    url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=1200&auto=format&fit=crop',
  },
  {
    id: 'kyoto',
    name: '静夜和风纸窗',
    url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop',
  },
];

export default function WallpaperApp({ onBgChange, currentBg }: Props) {
  const [customUrl, setCustomUrl] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        saveCustomChatBg(dataUrl);
        onBgChange(dataUrl);
        setUploadSuccess(true);
        setTimeout(() => setUploadSuccess(false), 2500);
      }
    };
    reader.readAsDataURL(file);
  };

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
    <div className="space-y-4 text-xs text-black font-sans select-none">
      {/* 1. 自定义壁纸上传 */}
      <fieldset className="border border-t-[#808080] border-l-[#808080] border-b-white border-r-white p-3 pt-2 bg-[#c0c0c0] space-y-3">
        <legend className="px-1 text-black font-bold text-xs bg-[#c0c0c0] flex items-center justify-between gap-2">
          <span>专属背景壁纸 (Custom Wallpaper)</span>
        </legend>

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[#333]">上传本地图片或指定外链作为主背景：</span>
          <button
            onClick={handleReset}
            className="px-2 py-0.5 bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-[#404040] border-r-[#404040] active:border-t-[#404040] active:border-l-[#404040] active:border-b-white active:border-r-white font-bold text-[10px] flex items-center gap-1 hover:bg-[#d0d0d0] cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>还原默认壁纸</span>
          </button>
        </div>

        {/* Drop zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 p-3 text-center cursor-pointer transition-none flex flex-col items-center justify-center gap-1 bg-white ${
            dragOver
              ? 'border-black bg-[#ffffcc]'
              : 'border-t-[#808080] border-l-[#808080] border-b-white border-r-white hover:bg-[#f5f5f5]'
          }`}
        >
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-[#0000a8]" />
            <span className="font-bold text-xs text-black">点击选择图片 或 拖放文件至此</span>
          </div>
          <p className="text-[10px] text-[#666]">支持 PNG / JPG / WEBP 等高分辨率图像，原画质呈现</p>
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
            placeholder="或输入图片网络外链 URL (https://...)"
            className="flex-1 px-2.5 py-1 text-xs border-2 border-t-[#808080] border-l-[#808080] border-b-white border-r-white bg-white text-black placeholder:text-[#888] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!customUrl.trim()}
            className="px-3 py-1 bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-[#404040] border-r-[#404040] active:border-t-[#404040] active:border-l-[#404040] active:border-b-white active:border-r-white font-bold text-xs disabled:opacity-50 hover:bg-[#d0d0d0] cursor-pointer"
          >
            应用外链
          </button>
        </form>

        {uploadSuccess && (
          <div className="p-1.5 border-2 border-t-[#808080] border-l-[#808080] border-b-white border-r-white bg-[#ffffcc] text-green-900 font-bold font-mono text-[11px] flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-green-700" />
            <span>[OK] 壁纸设置已实时同步更新！</span>
          </div>
        )}
      </fieldset>

      {/* 2. 预设壁纸库 */}
      <fieldset className="border border-t-[#808080] border-l-[#808080] border-b-white border-r-white p-3 pt-2 bg-[#c0c0c0] space-y-2.5">
        <legend className="px-1 text-black font-bold text-xs bg-[#c0c0c0] flex items-center gap-1.5">
          <span>精选预设壁纸库 (Preset Wallpapers)</span>
        </legend>

        <p className="text-[11px] text-[#333]">单击下列任意预设壁纸即可一键切换：</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PRESET_BGS.map((preset) => {
            const isSelected =
              currentBg === preset.url ||
              (!currentBg && preset.id === 'sakura_candle_arch') ||
              (currentBg === '/chat_bg.png' && preset.id === 'sakura_candle_arch');

            return (
              <button
                key={preset.id}
                onClick={() => handlePresetSelect(preset.url)}
                className={`group relative text-left transition-none aspect-[16/10] p-1 bg-[#c0c0c0] cursor-pointer ${
                  isSelected
                    ? 'border-2 border-t-black border-l-black border-b-white border-r-white ring-1 ring-blue-700'
                    : 'border-2 border-t-white border-l-white border-b-[#404040] border-r-[#404040] hover:bg-[#d0d0d0]'
                }`}
              >
                <div className="w-full h-full relative overflow-hidden border border-[#808080]">
                  <img
                    src={preset.url}
                    alt={preset.name}
                    className="w-full h-full object-cover"
                  />
                  {preset.isSpecial && (
                    <div className="absolute top-1 right-1 px-1 text-[8px] font-mono font-bold bg-[#000080] text-white">
                      专属原图
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-black/75 p-1 flex items-center justify-between text-[9px] font-bold text-white">
                    <span className="truncate">{preset.name}</span>
                    {isSelected && <Check className="w-3 h-3 text-yellow-300 shrink-0" />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
