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
  CheckCheck
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

export default function CssApp() {
  const [cssCode, setCssCode] = useState('');
  const [screenFilter, setScreenFilter] = useState<'none' | 'warm' | 'cool' | 'vintage' | 'crt'>('none');
  const [windChimePos, setWindChimePos] = useState<WindChimePosition>('right');
  const [cordLength, setCordLength] = useState(50);
  
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pastedJson, setPastedJson] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCssCode(loadCustomCss());
    setScreenFilter(loadScreenFilter());
    setWindChimePos(loadWindChimePosition());
    setCordLength(loadWindChimeCordLength());
  }, []);

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

  const handleChangePosition = (pos: WindChimePosition) => {
    setWindChimePos(pos);
    saveWindChimePosition(pos);
  };

  const handleChangeCordLength = (len: number) => {
    setCordLength(len);
    saveWindChimeCordLength(len);
  };

  const handleResetDesktopOrder = () => {
    const defaultOrder = ['stickers', 'ghost_card', 'game', 'persona', 'wallpaper', 'llm', 'ambience', 'dictionary', 'css'];
    savePhoneAppsOrder(defaultOrder);
    window.dispatchEvent(new CustomEvent('windchime_layout_change'));
    setImportNotice('已恢复手机桌面默认应用排布！');
    setTimeout(() => setImportNotice(null), 3000);
  };

  // Export JSON file
  const handleExportSettings = () => {
    const jsonStr = exportVisualConfig();
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `视觉工坊与风铃布局配置_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Copy JSON
  const handleCopySettings = () => {
    const jsonStr = exportVisualConfig();
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Import from file
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
          setImportNotice('视觉工坊与风铃排布配置已成功导入生效！');
        } else {
          setImportNotice('配置文件解析失败，请检查 JSON 格式是否正确。');
        }
        setTimeout(() => setImportNotice(null), 3500);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Import from paste
  const handleApplyPastedJson = () => {
    if (!pastedJson.trim()) return;
    const success = importVisualConfig(pastedJson.trim());
    if (success) {
      setCssCode(loadCustomCss());
      const filter = loadScreenFilter();
      setScreenFilter(filter);
      handleApplyFilter(filter);
      setWindChimePos(loadWindChimePosition());
      setCordLength(loadWindChimeCordLength());
      setImportNotice('视觉工坊与风铃排布配置已成功导入生效！');
      setShowPasteModal(false);
      setPastedJson('');
    } else {
      setImportNotice('JSON 格式错误，无法导入。');
    }
    setTimeout(() => setImportNotice(null), 3500);
  };

  return (
    <div className="space-y-4 text-xs text-white/90 pb-6 animate-in fade-in-0 duration-200">
      {/* Notice Banner */}
      {importNotice && (
        <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-[11px] flex items-center justify-between shadow-lg animate-in fade-in-0 duration-150">
          <span>{importNotice}</span>
          <button 
            onClick={() => setImportNotice(null)}
            className="text-amber-300 hover:text-white ml-2 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. Export & Import Toolbar (Top Highlight) */}
      <div className="p-3.5 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/40 via-stone-900/60 to-black/60 shadow-lg space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="font-bold text-amber-300 flex items-center gap-1.5 text-xs">
            <Download className="size-3.5 text-amber-400" />
            视觉与布局配置备份与迁移
          </span>
          <span className="text-[10px] text-amber-300/60 font-mono">v2.0 Sync</span>
        </div>
        <p className="text-[10px] text-white/60 leading-relaxed">
          可将当前的风铃位置、桌面拖动排布、滤镜与自定义 CSS 样式一键导出为 JSON 文件备份，或导入至其他设备。
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
          {/* Export JSON Button */}
          <button
            onClick={handleExportSettings}
            className="p-2 rounded-xl border border-amber-400/40 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-semibold text-[11px] transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
          >
            <Download className="size-3.5 text-amber-300" />
            <span>导出设置 (JSON)</span>
          </button>

          {/* Copy to Clipboard */}
          <button
            onClick={handleCopySettings}
            className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 font-medium text-[11px] transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
          >
            {copied ? <CheckCheck className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5 text-white/60" />}
            <span>{copied ? '已复制到剪贴板' : '复制配置代码'}</span>
          </button>

          {/* Import JSON Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 font-medium text-[11px] transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer col-span-2 sm:col-span-1"
          >
            <Upload className="size-3.5 text-cyan-300" />
            <span>导入设置文件</span>
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

      {/* 2. Phone Apps Drag & Desktop Layout Settings */}
      <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-white flex items-center gap-1.5 text-xs">
            <Move className="size-3.5 text-[hsl(28_85%_62%)]" />
            手机桌面图标拖拽排布 (Desktop App Icons Layout)
          </span>
          <button
            onClick={handleResetDesktopOrder}
            className="px-2.5 py-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RotateCcw className="size-3" />
            <span>恢复默认排布</span>
          </button>
        </div>

        <p className="text-[10px] text-white/60 leading-relaxed">
          📱 灵犀手机桌面内的所有软件卡片（如五子棋、捉鬼牌、人设卡、视觉工坊等）支持直接长按、拖拽或点击左右箭头自由排列，排布将实时自动保存。
        </p>

        {/* Resting Cord Length Slider */}
        <div className="space-y-1.5 pt-1 border-t border-white/5">
          <div className="flex items-center justify-between text-[11px] text-white/70">
            <span>风铃绳索下垂手感长度</span>
            <span className="text-[10px] text-amber-300 font-mono">{cordLength}px</span>
          </div>
          <input
            type="range"
            min={35}
            max={110}
            step={5}
            value={cordLength}
            onChange={(e) => handleChangeCordLength(parseInt(e.target.value, 10))}
            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-400"
          />
          <div className="flex justify-between text-[9px] text-white/30">
            <span>紧凑 (35px)</span>
            <span>默认 (50px)</span>
            <span>舒缓 (110px)</span>
          </div>
        </div>
      </div>

      {/* 3. Screen color atmosphere filters */}
      <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] space-y-3">
        <span className="font-semibold text-white flex items-center gap-1.5 text-xs">
          <Sparkles className="size-3.5 text-[hsl(28_85%_62%)]" />
          全屏视觉滤镜与电影色调
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { id: 'none', name: '原片质感', desc: '无附加滤镜' },
            { id: 'warm', name: '暖阳琥珀', desc: '暖色温情调' },
            { id: 'cool', name: '冷调清霜', desc: '微凉月夜感' },
            { id: 'vintage', name: '复古胶片', desc: '老电影噪波' },
            { id: 'crt', name: '赛博光栅', desc: 'CRT扫描线' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => handleApplyFilter(f.id as any)}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                screenFilter === f.id
                  ? 'border-[hsl(28_85%_62%)] bg-[hsl(28_85%_62%/0.15)] text-[hsl(28_85%_62%)] font-semibold'
                  : 'border-white/10 bg-black/40 hover:bg-white/5 text-white/70'
              }`}
            >
              <div className="text-[11px]">{f.name}</div>
              <div className="text-[9px] text-white/40">{f.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 4. Live Custom CSS */}
      <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-white flex items-center gap-1.5 text-xs">
            <Palette className="size-3.5 text-[hsl(28_85%_62%)]" />
            自定义 CSS 样式注入 (Live Inject)
          </span>
        </div>
        <p className="text-[10px] text-white/40 leading-relaxed">
          可直接注入任意 CSS 样式，例如修改气泡圆角、字体、光晕或微动效。
        </p>

        <textarea
          value={cssCode}
          onChange={(e) => setCssCode(e.target.value)}
          placeholder="/* 在此输入自定义 CSS */&#10;.chat-bubble { backdrop-filter: blur(16px); }"
          className="w-full h-36 p-2.5 text-xs font-mono rounded-xl border border-white/10 bg-black/60 text-emerald-400 placeholder:text-white/20 focus:outline-none focus:border-[hsl(28_85%_62%/0.5)] resize-none leading-relaxed"
        />

        <button
          onClick={handleSaveCss}
          className="w-full py-2 rounded-xl bg-[hsl(28_85%_62%)] hover:bg-[hsl(28_85%_62%/0.9)] text-[hsl(28_30%_10%)] font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-[hsl(28_85%_62%/0.15)] cursor-pointer"
        >
          {saved ? <Check className="size-3.5" /> : null}
          {saved ? 'CSS 已实时注入并生效' : '应用自定义 CSS 样式'}
        </button>
      </div>
    </div>
  );
}
