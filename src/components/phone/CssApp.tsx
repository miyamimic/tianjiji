import React, { useState, useEffect } from 'react';
import { Palette, Check, Sparkles, Sliders } from 'lucide-react';
import { loadCustomCss, saveCustomCss } from '../../lib/customStore';

export default function CssApp() {
  const [cssCode, setCssCode] = useState('');
  const [screenFilter, setScreenFilter] = useState<'none' | 'warm' | 'cool' | 'vintage' | 'crt'>('none');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setCssCode(loadCustomCss());
  }, []);

  const handleSaveCss = () => {
    saveCustomCss(cssCode);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleApplyFilter = (filter: 'none' | 'warm' | 'cool' | 'vintage' | 'crt') => {
    setScreenFilter(filter);
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

  return (
    <div className="space-y-4 text-xs text-white/90 pb-6 animate-in fade-in-0 duration-200">
      {/* Screen color atmosphere filters */}
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
              className={`p-2.5 rounded-xl border text-left transition-all ${
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

      {/* Live Custom CSS */}
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
          className="w-full py-2 rounded-xl bg-[hsl(28_85%_62%)] hover:bg-[hsl(28_85%_62%/0.9)] text-[hsl(28_30%_10%)] font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-[hsl(28_85%_62%/0.15)]"
        >
          {saved ? <Check className="size-3.5" /> : null}
          {saved ? 'CSS 已实时注入并生效' : '应用自定义 CSS 样式'}
        </button>
      </div>
    </div>
  );
}
