import { useState, useEffect } from 'react';
import { Eye, Check, RefreshCw, Palette, HelpCircle } from 'lucide-react';
import { loadCustomCss, saveCustomCss } from '../lib/customStore';

const CSS_PRESETS = [
  {
    name: '赛博霓虹深红 (默认偏爱)',
    description: '增强橘红色发光和深色边框，极具赛博温情风格',
    css: `/* 赛博霓虹深红 */
:root {
  --color-primary: hsl(15 90% 60%);
  --color-ring: hsl(15 90% 60%);
}
.chat-scroll {
  background: rgba(10, 5, 15, 0.15) !important;
}
input, textarea {
  border-color: rgba(249, 115, 22, 0.3) !important;
}
input:focus, textarea:focus {
  border-color: rgba(249, 115, 22, 0.8) !important;
  box-shadow: 0 0 12px rgba(249, 115, 22, 0.25) !important;
}`,
  },
  {
    name: '极简专注于文字对话',
    description: '隐藏像素屋背景，采用纯净夜空深色背景，适合沉浸阅读',
    css: `/* 极简专注于文字对话 */
canvas {
  display: none !important;
}
.chat-scroll {
  background: hsl(222 28% 7%) !important;
}
.relative.h-screen {
  background-color: hsl(222 28% 7%) !important;
}`,
  },
  {
    name: '初音未来幻彩绿',
    description: '将整套界面的主色调和光晕替换为清透的极光青绿色',
    css: `/* 初音未来幻彩绿 */
:root {
  --color-primary: hsl(174 85% 50%);
  --color-ring: hsl(174 85% 50%);
}
.msg-enter-user {
  border-left: 2px solid hsl(174 85% 50%) !important;
}
button {
  transition: all 0.2s;
}
button:hover {
  text-shadow: 0 0 8px hsl(174 85% 50%) !important;
}`,
  },
  {
    name: '梦幻极光深紫',
    description: '高雅神秘的紫罗兰光影色调，提升欲望与隐秘感',
    css: `/* 梦幻极光深紫 */
:root {
  --color-primary: hsl(270 85% 65%);
  --color-ring: hsl(270 85% 65%);
}
.chat-scroll {
  background: rgba(20, 10, 30, 0.2) !important;
}
.msg-enter-char {
  background: rgba(139, 92, 246, 0.05) !important;
  border-right: 2px solid hsl(270 85% 65%) !important;
}`,
  },
  {
    name: '像素复古绿幕 (Terminal)',
    description: '全终端绿荧光字体风格，带来早期计算机黑客般的体验',
    css: `/* 像素复古绿幕 */
* {
  font-family: 'Press Start 2P', 'Noto Sans SC', monospace !important;
  color: #33ff33 !important;
  text-shadow: 0 0 4px rgba(51, 255, 51, 0.4) !important;
}
input, textarea {
  background: #000000 !important;
  border: 1px solid #33ff33 !important;
}
div, section, footer {
  border-color: #33ff33 !important;
}
.bg-black\\/30, .bg-white\\/5 {
  background: rgba(0, 0, 0, 0.8) !important;
}`,
  },
];

export default function CssEditor() {
  const [css, setCss] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setCss(loadCustomCss());
  }, []);

  const handleSave = () => {
    saveCustomCss(css);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const applyPreset = (presetCss: string) => {
    const combined = css.trim() ? `${css}\n\n${presetCss}` : presetCss;
    setCss(combined);
    saveCustomCss(combined);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleClear = () => {
    if (confirm('确定要清空所有自定义 CSS 代码并还原默认样式吗？')) {
      setCss('');
      saveCustomCss('');
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  };

  return (
    <div className="space-y-5 text-white/90">
      <div>
        <h3 className="text-sm font-semibold mb-1 flex items-center gap-1.5 text-white">
          <Palette className="size-4 text-[hsl(28_85%_62%)]" />
          自由前端 CSS 代码注入
        </h3>
        <p className="text-xs text-white/40 leading-relaxed">
          在这里，你可以任意编写 CSS 代码，所有样式都会<b>实时应用</b>到本网页上。你可以利用它来定制字体颜色、调整气泡样式，甚至可以通过重写 <code>background-image</code> 替换任何背景或角色图片！
        </p>
      </div>

      {/* Editor Textarea */}
      <div className="relative rounded-xl border border-white/10 bg-black/40 overflow-hidden font-mono">
        <div className="flex items-center justify-between px-3.5 py-1.5 bg-white/5 border-b border-white/10 text-xs text-white/50 select-none">
          <span>custom-styles.css</span>
          <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded">CSS 代码模式</span>
        </div>
        <textarea
          value={css}
          onChange={(e) => setCss(e.target.value)}
          placeholder="/* 在此输入自定义 CSS 样式 */&#10;body {&#10;  /* 示例：调整整页背景色 */&#10;}&#10;.msg-enter-char {&#10;  font-size: 15px; /* 调大角色说话字号 */&#10;}"
          className="w-full h-56 p-4 text-xs bg-transparent text-emerald-400 placeholder:text-white/20 focus:outline-none resize-y leading-relaxed font-mono"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2.5">
        <button
          onClick={handleSave}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[hsl(28_85%_62%)] hover:bg-[hsl(28_85%_62%/0.9)] py-2 text-sm font-semibold text-[hsl(28_30%_10%)] transition-colors shadow-lg shadow-[hsl(28_85%_62%/0.15)]"
        >
          {saved ? <Check className="size-4 animate-scale-in" /> : <Eye className="size-4" />}
          {saved ? '样式已实时应用' : '保存并实时应用样式'}
        </button>
        <button
          onClick={handleClear}
          className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-medium text-white/60 hover:text-white transition-colors"
        >
          重置默认
        </button>
      </div>

      {/* Presets and Snippets */}
      <div className="space-y-3 pt-3 border-t border-white/10">
        <div className="flex items-center gap-1">
          <RefreshCw className="size-3.5 text-white/50" />
          <h4 className="text-xs font-semibold text-white/70">快速导入常用视觉预设：</h4>
        </div>
        <div className="grid grid-cols-1 gap-2.5">
          {CSS_PRESETS.map((preset) => (
            <div
              key={preset.name}
              className="flex items-start justify-between p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-all group"
            >
              <div className="space-y-1 pr-4">
                <span className="text-xs font-medium text-white group-hover:text-[hsl(28_85%_62%)] transition-colors">
                  {preset.name}
                </span>
                <p className="text-[11px] text-white/40 leading-relaxed">{preset.description}</p>
              </div>
              <button
                onClick={() => applyPreset(preset.css)}
                className="shrink-0 px-2.5 py-1 rounded bg-white/5 hover:bg-[hsl(28_85%_62%/0.15)] hover:text-[hsl(28_85%_62%)] text-[10px] text-white/60 font-semibold border border-white/5 transition-all select-none"
              >
                + 导入并合并
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Quick cheatsheet */}
      <div className="rounded-lg border border-white/10 bg-[hsl(222_28%_9%/0.4)] p-3 text-xs leading-relaxed space-y-2.5">
        <div className="flex items-center gap-1.5 font-semibold text-white/80">
          <HelpCircle className="size-3.5 text-[hsl(28_85%_62%)]" />
          <span>天枢专属 CSS 样式表对照：</span>
        </div>
        <ul className="list-disc pl-4 space-y-1 text-white/40 text-[11px]">
          <li><code>.chat-scroll</code> - 聊天对话框的可滚动区域</li>
          <li><code>.msg-enter-user</code> / <code>.msg-enter-char</code> - 用户 / 角色消息气泡外部包围盒</li>
          <li><code>canvas</code> - 像素屋背景所使用的 Canvas 元素</li>
          <li><code>:root</code> 变量 - 包含 <code>--color-primary</code>（主色调橘红），<code>--color-background</code>（整页暗黑底色）</li>
        </ul>
      </div>
    </div>
  );
}
