import React, { useState, useEffect, useRef } from 'react';
import { 
  Palette, 
  Check, 
  Sparkles, 
  Sliders, 
  Download, 
  Upload, 
  Copy, 
  RotateCcw, 
  Layers, 
  LayoutGrid, 
  Move,
  FileJson,
  CheckCheck,
  Heart,
  Dog,
  Flower2
} from 'lucide-react';
import { 
  loadCustomCss, 
  saveCustomCss, 
  loadScreenFilter, 
  saveScreenFilter, 
  loadWindChimePosition, 
  saveWindChimePosition, 
  loadWindChimeCordLength, 
  saveWindChimeCordLength, 
  loadPhoneAppsOrder, 
  savePhoneAppsOrder, 
  exportVisualConfig, 
  importVisualConfig,
  type WindChimePosition
} from '../../lib/customStore';
import {
  THEME_PRESETS,
  type ThemePalette,
  loadCurrentTheme,
  saveCurrentTheme,
  loadPuppyEnabled,
  savePuppyEnabled,
  loadLaceEmbossEnabled,
  saveLaceEmbossEnabled,
  loadGrainIntensity,
  saveGrainIntensity
} from '../../lib/themeSystem';
import { LinePuppyMascot, StardewPixelFlower, FlowerLacePattern } from '../FrenchLacePuppyElements';

export default function CssApp() {
  const [cssCode, setCssCode] = useState('');
  const [screenFilter, setScreenFilter] = useState<'none' | 'warm' | 'cool' | 'vintage' | 'crt'>('none');
  const [windChimePos, setWindChimePos] = useState<WindChimePosition>('right');
  const [cordLength, setCordLength] = useState(50);
  
  // French Stardew Theme Elements State
  const [currentTheme, setCurrentTheme] = useState<ThemePalette>(() => loadCurrentTheme());
  const [puppyEnabled, setPuppyEnabled] = useState<boolean>(() => loadPuppyEnabled());
  const [laceEnabled, setLaceEnabled] = useState<boolean>(() => loadLaceEmbossEnabled());
  const [grainVal, setGrainVal] = useState<number>(() => loadGrainIntensity());

  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCssCode(loadCustomCss());
    setScreenFilter(loadScreenFilter());
    setWindChimePos(loadWindChimePosition());
    setCordLength(loadWindChimeCordLength());
  }, []);

  const handleSelectTheme = (themeId: ThemePalette) => {
    setCurrentTheme(themeId);
    saveCurrentTheme(themeId);
    setImportNotice(`已切换为「${THEME_PRESETS[themeId].name}」法式星露谷主题！`);
    setTimeout(() => setImportNotice(null), 2500);
  };

  const handleTogglePuppy = () => {
    const next = !puppyEnabled;
    setPuppyEnabled(next);
    savePuppyEnabled(next);
  };

  const handleToggleLace = () => {
    const next = !laceEnabled;
    setLaceEnabled(next);
    saveLaceEmbossEnabled(next);
  };

  const handleChangeGrain = (val: number) => {
    setGrainVal(val);
    saveGrainIntensity(val);
    document.documentElement.style.setProperty('--grain-opacity', String(val));
  };

  const handleSaveCss = () => {
    saveCustomCss(cssCode);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleApplyFilter = (filter: 'none' | 'warm' | 'cool' | 'vintage' | 'crt') => {
    setScreenFilter(filter);
    saveScreenFilter(filter);
    const existing = document.getElementById('windchime-screen-filter');
    if (existing) existing.remove();

    if (filter === 'none') return;

    const overlay = document.createElement('div');
    overlay.id = 'windchime-screen-filter';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '40';
    overlay.style.transition = 'all 0.5s ease';

    if (filter === 'warm') {
      overlay.style.backgroundColor = 'rgba(255, 170, 50, 0.07)';
      overlay.style.backdropFilter = 'sepia(15%) contrast(102%)';
    } else if (filter === 'cool') {
      overlay.style.backgroundColor = 'rgba(50, 140, 255, 0.06)';
      overlay.style.backdropFilter = 'hue-rotate(15deg) contrast(105%)';
    } else if (filter === 'vintage') {
      overlay.style.backgroundColor = 'rgba(180, 120, 70, 0.1)';
      overlay.style.backdropFilter = 'sepia(35%) contrast(110%) brightness(95%)';
    } else if (filter === 'crt') {
      overlay.style.background = 'repeating-linear-gradient(0deg, rgba(0,0,0,0.15), rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px)';
      overlay.style.backdropFilter = 'contrast(120%)';
    }

    document.body.appendChild(overlay);
  };

  // Export JSON file
  const handleExportSettings = () => {
    const jsonStr = exportVisualConfig();
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `法式星露谷视觉与布局配置_${new Date().toISOString().slice(0, 10)}.json`;
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
          const filter = loadScreenFilter();
          setScreenFilter(filter);
          handleApplyFilter(filter);
          setWindChimePos(loadWindChimePosition());
          setCordLength(loadWindChimeCordLength());
          setImportNotice('视觉工坊与法式排布配置已成功导入生效！');
        } else {
          setImportNotice('配置文件解析失败，请检查 JSON 格式是否正确。');
        }
        setTimeout(() => setImportNotice(null), 3500);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-4 text-xs text-[#4a3e3d] pb-6 animate-in fade-in-0 duration-200 font-serif">
      {/* Notice Banner */}
      {importNotice && (
        <div className="p-3 rounded-2xl bg-[#fff0f3] border-2 border-[#f2d0d9] text-[#8a3854] text-[11px] flex items-center justify-between shadow-md animate-in fade-in-0 duration-150">
          <div className="flex items-center gap-1.5 font-bold">
            <Sparkles className="size-3.5 text-[#e07a93]" />
            <span>{importNotice}</span>
          </div>
          <button 
            onClick={() => setImportNotice(null)}
            className="text-[#e07a93] hover:text-[#8a3854] ml-2 text-xs font-bold font-sans cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. French Pastel & Stardew Theme Preset Chooser */}
      <div className="p-4 rounded-2xl border-2 border-[#f2d0d9] bg-white/90 shadow-sm space-y-3 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="font-bold text-[#8a3854] flex items-center gap-1.5 text-xs">
            <StardewPixelFlower />
            法式轻奢 & 星露谷浅色系风格调色盘
          </span>
          <span className="text-[10px] text-[#e07a93] font-mono">Pixel Pastel</span>
        </div>
        <p className="text-[10px] text-[#998380] leading-relaxed">
          精选法式浅粉、雏菊麦香、浮雕蕾丝与线条小狗微美学主题，全系统一键同步。
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {Object.values(THEME_PRESETS).map((t) => {
            const isSelected = currentTheme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => handleSelectTheme(t.id)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                  isSelected
                    ? 'border-2 border-[#e07a93] bg-[#fff0f3] shadow-md ring-2 ring-[#e07a93]/20'
                    : 'border-[#f2d0d9] bg-white hover:bg-[#fffbfb] text-[#4a3e3d]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="font-bold text-xs flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.primaryColor }} />
                    <span className={isSelected ? 'text-[#8a3854]' : 'text-[#4a3e3d]'}>{t.name}</span>
                  </div>
                  {isSelected && <Check className="size-3 text-[#e07a93] stroke-[3]" />}
                </div>
                <div className="text-[10px] text-[#998380] leading-tight">{t.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Fine Grain Noise & Puppy / Lace Feature Toggles */}
      <div className="p-4 rounded-2xl border-2 border-[#f2d0d9] bg-white/90 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="font-bold text-[#8a3854] flex items-center gap-1.5 text-xs">
            <LinePuppyMascot size={22} variant="sparkle" />
            线条小狗与花朵浮雕蕾丝质感细节
          </span>
        </div>

        {/* Puppy Toggle */}
        <div className="flex items-center justify-between p-2.5 rounded-xl border border-[#fcedf1] bg-[#fffbfb]">
          <div className="space-y-0.5">
            <div className="font-semibold text-[11px] text-[#4a3e3d] flex items-center gap-1">
              <span>线条马尔济斯小狗陪伴吉祥物</span>
            </div>
            <p className="text-[9px] text-[#998380]">在顶部状态栏与聊天回复触发灵犀小狗</p>
          </div>
          <button
            onClick={handleTogglePuppy}
            className={`px-3 py-1 rounded-full text-[10px] font-bold transition cursor-pointer ${
              puppyEnabled ? 'bg-[#e07a93] text-white shadow-xs' : 'bg-stone-200 text-stone-500'
            }`}
          >
            {puppyEnabled ? '已开启' : '已关闭'}
          </button>
        </div>

        {/* Flower Lace Toggle */}
        <div className="flex items-center justify-between p-2.5 rounded-xl border border-[#fcedf1] bg-[#fffbfb]">
          <div className="space-y-0.5">
            <div className="font-semibold text-[11px] text-[#4a3e3d]">花朵浮雕蕾丝边框 (Floral Lace Emboss)</div>
            <p className="text-[9px] text-[#998380]">为对话气泡与顶栏注入法式精致花边装饰</p>
          </div>
          <button
            onClick={handleToggleLace}
            className={`px-3 py-1 rounded-full text-[10px] font-bold transition cursor-pointer ${
              laceEnabled ? 'bg-[#e07a93] text-white shadow-xs' : 'bg-stone-200 text-stone-500'
            }`}
          >
            {laceEnabled ? '已开启' : '已关闭'}
          </button>
        </div>

        {/* Fine Grain Noise Slider */}
        <div className="space-y-1.5 pt-1 border-t border-[#f2d0d9]">
          <div className="flex items-center justify-between text-[11px] text-[#4a3e3d]">
            <span>细颗粒胶片噪点强度 (Film Grain Noise)</span>
            <span className="text-[10px] text-[#e07a93] font-mono">{Math.round(grainVal * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={0.8}
            step={0.05}
            value={grainVal}
            onChange={(e) => handleChangeGrain(parseFloat(e.target.value))}
            className="w-full h-2 bg-[#fcedf1] rounded-lg appearance-none cursor-pointer accent-[#e07a93]"
          />
          <div className="flex justify-between text-[9px] text-[#998380]">
            <span>柔和纯净 (0%)</span>
            <span>经典法式 (35%)</span>
            <span>浓郁复古 (80%)</span>
          </div>
        </div>
      </div>

      {/* 3. Export & Import Toolbar */}
      <div className="p-3.5 rounded-2xl border-2 border-[#f2d0d9] bg-gradient-to-br from-[#fff7f8] via-white to-[#fff0f3] shadow-sm space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="font-bold text-[#8a3854] flex items-center gap-1.5 text-xs">
            <Download className="size-3.5 text-[#e07a93]" />
            视觉与布局配置备份与迁移
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
          <button
            onClick={handleExportSettings}
            className="p-2 rounded-xl border border-[#e07a93]/40 bg-[#fff0f3] hover:bg-[#ffe5ec] text-[#8a3854] font-semibold text-[11px] transition-all flex items-center justify-center gap-1.5 shadow-xs active:scale-95 cursor-pointer"
          >
            <Download className="size-3.5 text-[#e07a93]" />
            <span>导出配置 (JSON)</span>
          </button>

          <button
            onClick={handleCopySettings}
            className="p-2 rounded-xl border border-[#f2d0d9] bg-white hover:bg-stone-50 text-[#4a3e3d] font-medium text-[11px] transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
          >
            {copied ? <CheckCheck className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5 text-[#998380]" />}
            <span>{copied ? '已复制' : '复制配置代码'}</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-xl border border-[#f2d0d9] bg-white hover:bg-stone-50 text-[#4a3e3d] font-medium text-[11px] transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer col-span-2 sm:col-span-1"
          >
            <Upload className="size-3.5 text-[#e07a93]" />
            <span>导入配置文件</span>
          </button>

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".json,application/json" 
            className="hidden" 
          />
        </div>
      </div>

      {/* 4. Live Custom CSS */}
      <div className="p-4 rounded-2xl border-2 border-[#f2d0d9] bg-white/90 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-bold text-[#8a3854] flex items-center gap-1.5 text-xs">
            <Palette className="size-3.5 text-[#e07a93]" />
            自定义 CSS 样式注入 (Live Inject)
          </span>
        </div>

        <textarea
          value={cssCode}
          onChange={(e) => setCssCode(e.target.value)}
          placeholder="/* 在此输入自定义 CSS */&#10;.chat-bubble { backdrop-filter: blur(16px); }"
          className="w-full h-32 p-2.5 text-xs font-mono rounded-xl border border-[#f2d0d9] bg-[#fffbfb] text-[#4a3e3d] placeholder:text-[#b3a19e] focus:outline-none focus:border-[#e07a93] resize-none leading-relaxed"
        />

        <button
          onClick={handleSaveCss}
          className="w-full py-2 rounded-xl bg-gradient-to-br from-[#f898ad] to-[#e07a93] hover:from-[#f788a0] hover:to-[#d46580] text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-[#e07a93]/20 cursor-pointer"
        >
          {saved ? <Check className="size-3.5" /> : null}
          {saved ? 'CSS 已实时注入并生效' : '应用自定义 CSS 样式'}
        </button>
      </div>
    </div>
  );
}
