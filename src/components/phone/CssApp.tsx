import React, { useState, useEffect, useRef } from 'react';
import { 
  Check, 
  Download, 
  Upload, 
  Copy, 
  CheckCheck,
  Paintbrush,
  Image as ImageIcon,
  Volume2
} from 'lucide-react';
import { 
  loadCustomCss, 
  saveCustomCss, 
  exportVisualConfig, 
  importVisualConfig 
} from '../../lib/customStore';
import {
  THEME_PRESETS,
  type ThemePalette,
  loadCurrentTheme,
  saveCurrentTheme
} from '../../lib/themeSystem';
import WallpaperApp from './WallpaperApp';
import AmbienceApp from './AmbienceApp';

interface CssAppProps {
  onBgChange?: (newBg: string) => void;
  currentBg?: string;
  initialTab?: 'css' | 'wallpaper' | 'ambience';
}

export default function CssApp({ onBgChange, currentBg, initialTab = 'css' }: CssAppProps) {
  const [activeTab, setActiveTab] = useState<'css' | 'wallpaper' | 'ambience'>(initialTab);
  const [cssCode, setCssCode] = useState('');
  const [currentTheme, setCurrentTheme] = useState<ThemePalette>(() => loadCurrentTheme());
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCssCode(loadCustomCss());
  }, []);

  const handleApplyPreset = () => {
    setCurrentTheme('french_pastel');
    saveCurrentTheme('french_pastel');
    setImportNotice('系统预设「法式轻奢风」已重新装载并生效！');
    setTimeout(() => setImportNotice(null), 3000);
  };

  const handleSaveCss = () => {
    saveCustomCss(cssCode);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Export JSON file
  const handleExportSettings = () => {
    const jsonStr = exportVisualConfig();
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `系统视觉与外观配置_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopySettings = () => {
    const jsonStr = exportVisualConfig();
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = importVisualConfig(content);
        if (success) {
          setCssCode(loadCustomCss());
          setImportNotice('外观配置已成功从 JSON 导入生效！');
        } else {
          setImportNotice('配置文件解析失败，请检查 JSON 数据格式。');
        }
        setTimeout(() => setImportNotice(null), 3500);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="bg-[#c0c0c0] text-black font-sans select-none text-xs flex flex-col h-full">
      {/* 90s Windows Property Sheet Tabs */}
      <div className="flex border-b border-[#808080] gap-1 px-1 pt-1 bg-[#c0c0c0] shrink-0">
        <button
          onClick={() => setActiveTab('css')}
          className={`px-3.5 py-1.5 text-xs flex items-center gap-1.5 transition-none cursor-pointer ${
            activeTab === 'css'
              ? 'bg-[#c0c0c0] font-bold text-black border-t-2 border-l-2 border-r-2 border-t-white border-l-white border-r-[#404040] -mb-[1px] z-10'
              : 'bg-[#a0a0a0] text-[#222] border-t-2 border-l-2 border-r-2 border-t-[#dcdcdc] border-l-[#dcdcdc] border-r-[#606060] hover:bg-[#b0b0b0]'
          }`}
        >
          <Paintbrush className="w-3.5 h-3.5" />
          <span>视觉样式 (CSS)</span>
        </button>

        <button
          onClick={() => setActiveTab('wallpaper')}
          className={`px-3.5 py-1.5 text-xs flex items-center gap-1.5 transition-none cursor-pointer ${
            activeTab === 'wallpaper'
              ? 'bg-[#c0c0c0] font-bold text-black border-t-2 border-l-2 border-r-2 border-t-white border-l-white border-r-[#404040] -mb-[1px] z-10'
              : 'bg-[#a0a0a0] text-[#222] border-t-2 border-l-2 border-r-2 border-t-[#dcdcdc] border-l-[#dcdcdc] border-r-[#606060] hover:bg-[#b0b0b0]'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>壁纸背景 (WALLPAPER)</span>
        </button>

        <button
          onClick={() => setActiveTab('ambience')}
          className={`px-3.5 py-1.5 text-xs flex items-center gap-1.5 transition-none cursor-pointer ${
            activeTab === 'ambience'
              ? 'bg-[#c0c0c0] font-bold text-black border-t-2 border-l-2 border-r-2 border-t-white border-l-white border-r-[#404040] -mb-[1px] z-10'
              : 'bg-[#a0a0a0] text-[#222] border-t-2 border-l-2 border-r-2 border-t-[#dcdcdc] border-l-[#dcdcdc] border-r-[#606060] hover:bg-[#b0b0b0]'
          }`}
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span>氛围白噪 (AUDIO)</span>
        </button>
      </div>

      {/* Tab Body */}
      <div className="flex-1 p-3 bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-[#404040] border-r-[#404040] overflow-y-auto space-y-4">
        
        {/* TAB 1: CSS & SYSTEM PRESETS */}
        {activeTab === 'css' && (
          <div className="space-y-4">
            
            {/* Retro Notification Banner */}
            {importNotice && (
              <div className="p-2 border-2 border-t-[#808080] border-l-[#808080] border-b-white border-r-white bg-[#ffffcc] text-black text-xs flex items-center justify-between font-mono shadow-inner">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#0000a8]">[NOTICE]</span>
                  <span>{importNotice}</span>
                </div>
                <button
                  onClick={() => setImportNotice(null)}
                  className="px-1.5 py-0.5 text-xs font-bold bg-[#c0c0c0] border border-black hover:bg-[#a0a0a0] cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* 1. 系统预设 (System Presets) - Only 法式轻奢风 */}
            <fieldset className="border border-t-[#808080] border-l-[#808080] border-b-white border-r-white p-3 pt-2 bg-[#c0c0c0] relative">
              <legend className="px-1 text-black font-bold text-xs bg-[#c0c0c0] flex items-center gap-1.5">
                <span>系统预设 (System Presets)</span>
              </legend>

              <div className="space-y-2">
                <div className="text-[11px] text-[#222]">
                  当前已装载系统官方预设方案：
                </div>

                {/* The single authentic preset: 法式轻奢风 */}
                <div className="p-3 bg-white border-2 border-t-[#808080] border-l-[#808080] border-b-white border-r-white text-black space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {/* Retro Radio button checked */}
                      <div className="w-4 h-4 rounded-full border-2 border-t-[#808080] border-l-[#808080] border-b-white border-r-white bg-white flex items-center justify-center shrink-0">
                        <div className="w-2 h-2 rounded-full bg-black"></div>
                      </div>
                      <span className="font-bold text-xs text-black">法式轻奢风</span>
                      <span className="px-1.5 py-0.2 text-[9px] bg-[#000080] text-white font-mono font-bold tracking-tight">
                        DEFAULT / ACTIVE
                      </span>
                    </div>

                    <span className="text-[10px] text-[#666] font-mono">French Pastel</span>
                  </div>

                  <p className="text-[11px] text-[#444] leading-relaxed">
                    系统默认法式轻奢微美学主题：柔和奶杏粉与象牙浅色调，精致法式复古排版与微质感气泡，全系统界面与对话功能统一适配生效。
                  </p>

                  {/* Retro Color Palette Chips */}
                  <div className="flex items-center gap-2 pt-1 border-t border-[#dfdfdf]">
                    <span className="text-[10px] font-bold text-[#666]">预设色系:</span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 border border-black bg-[#e07a93] shadow-xs"></div>
                        <span className="text-[9px] font-mono text-[#555]">#E07A93 奶杏粉</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 border border-black bg-[#fff5f6] shadow-xs"></div>
                        <span className="text-[9px] font-mono text-[#555]">#FFF5F6 浅象牙</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 border border-black bg-[#4a3e3d] shadow-xs"></div>
                        <span className="text-[9px] font-mono text-[#555]">#4A3E3D 复古褐</span>
                      </div>
                    </div>
                  </div>

                  {/* Apply / Reload button */}
                  <div className="pt-1 flex justify-end">
                    <button
                      onClick={handleApplyPreset}
                      className="px-3 py-1 bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-[#404040] border-r-[#404040] active:border-t-[#404040] active:border-l-[#404040] active:border-b-white active:border-r-white font-bold text-xs hover:bg-[#d0d0d0] cursor-pointer"
                    >
                      重新载入并应用此预设
                    </button>
                  </div>
                </div>
              </div>
            </fieldset>

            {/* 2. 视觉与布局配置备份与迁移 (Export / Import) */}
            <fieldset className="border border-t-[#808080] border-l-[#808080] border-b-white border-r-white p-3 pt-2 bg-[#c0c0c0]">
              <legend className="px-1 text-black font-bold text-xs bg-[#c0c0c0] flex items-center gap-1.5">
                <span>外观配置备份与迁移 (Config Export/Import)</span>
              </legend>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  onClick={handleExportSettings}
                  className="px-3 py-1.5 bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-[#404040] border-r-[#404040] active:border-t-[#404040] active:border-l-[#404040] active:border-b-white active:border-r-white font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-[#d0d0d0] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>导出配置 (JSON)</span>
                </button>

                <button
                  onClick={handleCopySettings}
                  className="px-3 py-1.5 bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-[#404040] border-r-[#404040] active:border-t-[#404040] active:border-l-[#404040] active:border-b-white active:border-r-white font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-[#d0d0d0] cursor-pointer"
                >
                  {copied ? <CheckCheck className="w-3.5 h-3.5 text-green-700" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? '已复制到剪贴板' : '复制配置代码'}</span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-[#404040] border-r-[#404040] active:border-t-[#404040] active:border-l-[#404040] active:border-b-white active:border-r-white font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-[#d0d0d0] cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>导入配置文件...</span>
                </button>

                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept=".json,application/json" 
                  className="hidden" 
                />
              </div>
            </fieldset>

            {/* 3. 自定义 CSS 样式注入 (Live Custom CSS) */}
            <fieldset className="border border-t-[#808080] border-l-[#808080] border-b-white border-r-white p-3 pt-2 bg-[#c0c0c0] space-y-2.5">
              <legend className="px-1 text-black font-bold text-xs bg-[#c0c0c0] flex items-center gap-1.5">
                <span>自定义 CSS 样式注入 (Live CSS Inject)</span>
              </legend>

              <p className="text-[11px] text-[#333]">
                在此处输入 CSS 代码，点击保存即可实时注入到系统页面中生效：
              </p>

              <textarea
                value={cssCode}
                onChange={(e) => setCssCode(e.target.value)}
                placeholder="/* 在此输入自定义 CSS 规则，例如： */&#10;.chat-bubble { font-weight: bold; }"
                className="w-full h-32 p-2.5 text-xs font-mono border-2 border-t-[#808080] border-l-[#808080] border-b-white border-r-white bg-white text-black placeholder:text-[#888] focus:outline-none resize-none leading-relaxed"
              />

              <div className="flex items-center justify-between pt-1">
                <div className="text-[11px] font-mono">
                  {saved ? (
                    <span className="text-green-800 font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      [OK] CSS 样式已实时注入并持久化保存
                    </span>
                  ) : (
                    <span className="text-[#666]">支持标准 CSS 选择器与样式规则</span>
                  )}
                </div>

                <button
                  onClick={handleSaveCss}
                  className="px-4 py-1.5 bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-[#404040] border-r-[#404040] active:border-t-[#404040] active:border-l-[#404040] active:border-b-white active:border-r-white font-bold text-xs hover:bg-[#d0d0d0] flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>应用并保存 CSS (Apply)</span>
                </button>
              </div>
            </fieldset>

          </div>
        )}

        {/* TAB 2: WALLPAPER */}
        {activeTab === 'wallpaper' && (
          <div>
            <WallpaperApp onBgChange={onBgChange || (() => {})} currentBg={currentBg} />
          </div>
        )}

        {/* TAB 3: AMBIENCE */}
        {activeTab === 'ambience' && (
          <div>
            <AmbienceApp />
          </div>
        )}

      </div>
    </div>
  );
}
