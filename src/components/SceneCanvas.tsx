import { useEffect, useRef } from 'react';
import {
  BG_OBJECT_POS,
  BG_SIZE,
  computeCoverFit,
  isPortraitViewport,
  type FitRect,
} from '@/lib/stageFit';

export type Scene = 'welcome' | 'chat';

// ====== 统一位置常量（相对"背景图像素"的比例，0..1）======
// 坐标来自对应蒙版 PNG 的像素分析（连通域质心 / 包围盒半径）
// 这些坐标与舞台容器形状无关：无论横屏 contain 还是竖屏 cover，都先做 fit 映射再使用。
//
// WELCOME 场景：背景图 welcome_bg.png 2276×1280
//   clock.png      2276×1280  →  cx=0.39648  cy=0.04919  rw=0.02460  (rw 相对背景图宽)
//   location-bg.png 2276×1280 →  每个字母下方的实心 pin 质心
const WELCOME = {
  clock: { cx: 0.39648, cy: 0.04919, rw: 0.0246 },
  hotspots: {
    A: { cx: 0.219, cy: 0.538 },
    B: { cx: 0.649, cy: 0.588 },
    C: { cx: 0.472, cy: 0.681 },
  } as Record<string, { cx: number; cy: number }>,
};

// CHAT 场景：背景图 chat_bg.png 1793×1188
//   chat_clock.png    1793×1188  →  cx=0.45971  cy=0.10532  rw=0.04741
//   chat_location.png 1793×1188  →  cx=0.8145   cy=0.5185   （唯一标记质心）
const CHAT = {
  clock: { cx: 0.45971, cy: 0.10532, rw: 0.04741 },
  back: { cx: 0.8145, cy: 0.5185 },
};

interface Props {
  scene: Scene;
}

export default function SceneCanvas({ scene }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const parent = canvas.parentElement;
      canvas.width = parent ? parent.clientWidth : window.innerWidth;
      canvas.height = parent ? parent.clientHeight : window.innerHeight;
    };
    resize();

    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    window.addEventListener('resize', resize);

    let raf = 0;
    let t0 = 0;

    const animate = () => {
      t0 += 0.016;
      const w = canvas.width;
      const h = canvas.height;
      const sc = sceneRef.current;
      const portrait = isPortraitViewport(w, h);
      const bg = BG_SIZE[sc];
      const pos = BG_OBJECT_POS[sc];

      // fitRect: 复现背景 img 的 object-fit 行为
      //   - landscape：舞台比例 = 图片比例 → fit 实际上 scale=1、off=0，坐标原样
      //   - portrait：图片 cover → scale>1、off 为负/正，按 object-position 偏移
      //   注意：landscape 时我们的舞台是按图片比例居中的，所以也走 cover-fit 公式（结果是 1:1 对齐）
      const fit: FitRect = computeCoverFit(bg.w, bg.h, w, h, pos.x, pos.y);

      ctx.clearRect(0, 0, w, h);

      const clockSpec = sc === 'welcome' ? WELCOME.clock : CHAT.clock;
      const mappedClock = (() => {
        const p = fit.mapUV(clockSpec.cx, clockSpec.cy);
        // rw 是相对背景图宽度的比例；cover 后背景图宽度 = bg.w * fit.scale → 真实像素半径
        const pxR = clockSpec.rw * bg.w * fit.scale;
        return { cx: p.x, cy: p.y, r: pxR };
      })();

      // ===== 画钟表指针 =====
      if (sc === 'welcome') {
        drawClock(ctx, mappedClock, w, h, { style: 'full' });
      } else {
        drawClock(ctx, mappedClock, w, h, { style: 'handsOnly' });
      }

      // ===== 画呼吸光点 =====
      const pulseBase = (u: number, v: number) => {
        const p = fit.mapUV(u, v);
        // 光点 baseR 取图片 drawW/drawH 的较小者的百分比 → 横屏/竖屏视觉大小一致
        const refDim = Math.min(fit.drawW, fit.drawH);
        return { cx: p.x, cy: p.y, baseR: refDim * 0.011 };
      };
      if (sc === 'welcome') {
        const a = pulseBase(WELCOME.hotspots.A.cx, WELCOME.hotspots.A.cy);
        const b = pulseBase(WELCOME.hotspots.B.cx, WELCOME.hotspots.B.cy);
        const c = pulseBase(WELCOME.hotspots.C.cx, WELCOME.hotspots.C.cy);
        drawPulseDot(ctx, a.cx, a.cy, a.baseR, t0, '#ffd36a', '#ff7a2f');
        drawPulseDot(ctx, b.cx, b.cy, b.baseR, t0 + 0.6, '#9fffc0', '#2fbf6a');
        drawPulseDot(ctx, c.cx, c.cy, c.baseR, t0 + 1.2, '#9fd6ff', '#2f82ff');
      } else if (!portrait) {
        const b = pulseBase(CHAT.back.cx, CHAT.back.cy);
        drawPulseDot(ctx, b.cx, b.cy, b.baseR, t0, '#ffe9a8', '#ff9a3c');
      }
      // （横屏/竖屏均忽略越界绘制；Canvas 超出会自动被裁，不阻塞 raf）

      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      aria-hidden="true"
    />
  );
}

// ============ 绘制：钟表 ============
// 输入 spec.cx/cy/r 已经是 Canvas 像素坐标（通过 cover-fit 映射后）
function drawClock(
  ctx: CanvasRenderingContext2D,
  spec: { cx: number; cy: number; r: number },
  _w: number,
  _h: number,
  opts: { style: 'full' | 'handsOnly' },
) {
  const cx = spec.cx;
  const cy = spec.cy;
  const r = spec.r;
  const now = new Date();

  if (opts.style === 'full') {
    const halo = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.1);
    halo.addColorStop(0, 'rgba(255, 235, 180, 0.22)');
    halo.addColorStop(1, 'rgba(255, 235, 180, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.strokeStyle = 'rgba(80, 45, 15, 0.85)';
    ctx.fillStyle = 'rgba(255, 246, 220, 0.08)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const isMajor = i % 3 === 0;
      const inner = r * (isMajor ? 0.68 : 0.78);
      const outer = r * 0.9;
      ctx.save();
      ctx.strokeStyle = isMajor ? 'rgba(60, 30, 10, 0.9)' : 'rgba(60, 30, 10, 0.6)';
      ctx.lineWidth = Math.max(1, r * (isMajor ? 0.09 : 0.05));
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
      ctx.stroke();
      ctx.restore();
    }
  }

  const handsOnly = opts.style === 'handsOnly';
  const sec = now.getSeconds() + now.getMilliseconds() / 1000;
  const aSec = (sec / 60) * Math.PI * 2 - Math.PI / 2;
  ctx.save();
  ctx.strokeStyle = handsOnly ? 'rgba(200, 50, 30, 0.92)' : 'rgba(220, 70, 40, 0.95)';
  ctx.lineWidth = Math.max(1, handsOnly ? Math.min(1.6, r * 0.018) : r * 0.045);
  ctx.lineCap = 'round';
  const secLen = handsOnly ? 0.72 : 0.82;
  const secTail = handsOnly ? 0.15 : 0.18;
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(aSec) * r * secTail, cy - Math.sin(aSec) * r * secTail);
  ctx.lineTo(cx + Math.cos(aSec) * r * secLen, cy + Math.sin(aSec) * r * secLen);
  ctx.stroke();
  ctx.restore();

  const min = now.getMinutes() + sec / 60;
  const aMin = (min / 60) * Math.PI * 2 - Math.PI / 2;
  ctx.save();
  ctx.strokeStyle = handsOnly ? 'rgba(40, 22, 10, 0.92)' : 'rgba(30, 15, 5, 0.9)';
  ctx.lineWidth = Math.max(1, handsOnly ? Math.min(2.2, r * 0.028) : r * 0.085);
  ctx.lineCap = 'round';
  const minLen = handsOnly ? 0.60 : 0.75;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(aMin) * r * minLen, cy + Math.sin(aMin) * r * minLen);
  ctx.stroke();
  ctx.restore();

  const hr = (now.getHours() % 12) + min / 60;
  const aHr = (hr / 12) * Math.PI * 2 - Math.PI / 2;
  ctx.save();
  ctx.strokeStyle = handsOnly ? 'rgba(40, 22, 10, 0.95)' : 'rgba(30, 15, 5, 0.95)';
  ctx.lineWidth = Math.max(1.5, handsOnly ? Math.min(3, r * 0.038) : r * 0.115);
  ctx.lineCap = 'round';
  const hrLen = handsOnly ? 0.42 : 0.52;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(aHr) * r * hrLen, cy + Math.sin(aHr) * r * hrLen);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = handsOnly ? 'rgba(40, 22, 10, 0.9)' : 'rgba(30, 15, 5, 0.95)';
  ctx.beginPath();
  ctx.arc(cx, cy, r * (handsOnly ? 0.055 : 0.12), 0, Math.PI * 2);
  ctx.fill();
  if (handsOnly) {
    ctx.fillStyle = 'rgba(255, 240, 210, 0.95)';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.018, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ============ 绘制：呼吸光点 ============
// 输入 cx/cy/baseR 已经是 Canvas 像素（cover-fit 后）
function drawPulseDot(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  baseR: number,
  phase: number,
  colorInner: string,
  colorOuter: string,
) {
  const t = phase;

  for (let i = 0; i < 2; i++) {
    const tt = (t + i * 0.5) % 1.6;
    const k = tt / 1.6;
    const radius = baseR * (1.2 + k * 4.2);
    const alpha = Math.max(0, 1 - k) * 0.55;
    ctx.save();
    ctx.strokeStyle = colorOuter;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = Math.max(1, baseR * 0.55);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  const outerR = baseR * (2.0 + 0.4 * Math.sin(t * 2));
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, outerR * 3.5);
  glow.addColorStop(0, hexWithAlpha(colorOuter, 0.35));
  glow.addColorStop(0.4, hexWithAlpha(colorOuter, 0.10));
  glow.addColorStop(1, hexWithAlpha(colorOuter, 0));
  ctx.save();
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, outerR * 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = colorInner;
  ctx.shadowColor = hexWithAlpha(colorOuter, 0.9);
  ctx.shadowBlur = baseR * 2.2;
  ctx.beginPath();
  ctx.arc(cx, cy, baseR * (1.0 + 0.12 * Math.sin(t * 3)), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.beginPath();
  ctx.arc(cx - baseR * 0.25, cy - baseR * 0.3, baseR * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function hexWithAlpha(hex: string, alpha: number) {
  if (hex.startsWith('#') && hex.length === 7) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return hex;
}
