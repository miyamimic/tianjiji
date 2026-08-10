import { useEffect, useRef } from 'react';

/**
 * 坐标体系：所有位置用相对舞台宽高的归一化坐标 (0..1)。
 * 画布尺寸 === 父元素（16:9 或 3:2 舞台）尺寸，背景图按 object-cover 铺满舞台。
 */

export type Scene = 'welcome' | 'chat';

// ====== 统一位置常量（相对舞台宽高 0..1） ======
// 坐标来自对应蒙版 PNG 的像素分析（连通域质心 / 包围盒半径）
//
// WELCOME 场景：
//   clock.png      2276×1280  →  cx=0.39648  cy=0.04919  rw=0.02460
//   location-bg.png 2276×1280 →  每个字母下方的实心 pin 质心
const WELCOME = {
  clock: { cx: 0.39648, cy: 0.04919, r: 0.0246 },
  hotspots: {
    A: { cx: 0.219, cy: 0.538 },
    B: { cx: 0.649, cy: 0.588 },
    C: { cx: 0.472, cy: 0.681 },
  } as Record<string, { cx: number; cy: number }>,
};

// CHAT 场景：
//   chat_clock.png    1793×1188  →  cx=0.45971  cy=0.10532  rw=0.04741
//   chat_location.png 1793×1188  →  cx=0.8145   cy=0.5185   （唯一标记质心）
const CHAT = {
  clock: { cx: 0.45971, cy: 0.10532, r: 0.04741 },
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
      ctx.clearRect(0, 0, w, h);

      const sc = sceneRef.current;
      const clockSpec = sc === 'welcome' ? WELCOME.clock : CHAT.clock;

      // ===== 画钟表指针 =====
      drawClock(ctx, clockSpec, w, h);

      // ===== 画呼吸光点 =====
      if (sc === 'welcome') {
        drawPulseDot(ctx, w, h, WELCOME.hotspots.A.cx, WELCOME.hotspots.A.cy, t0, '#ffd36a', '#ff7a2f');
        drawPulseDot(ctx, w, h, WELCOME.hotspots.B.cx, WELCOME.hotspots.B.cy, t0 + 0.6, '#9fffc0', '#2fbf6a');
        drawPulseDot(ctx, w, h, WELCOME.hotspots.C.cx, WELCOME.hotspots.C.cy, t0 + 1.2, '#9fd6ff', '#2f82ff');
      } else {
        drawPulseDot(ctx, w, h, CHAT.back.cx, CHAT.back.cy, t0, '#ffe9a8', '#ff9a3c');
      }

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

// ============ 绘制：钟表（表盘圆 + 时/分/秒针） ============
function drawClock(
  ctx: CanvasRenderingContext2D,
  spec: { cx: number; cy: number; r: number },
  w: number,
  h: number,
) {
  // r 是相对舞台宽度的比例 → 实际像素
  const cx = spec.cx * w;
  const cy = spec.cy * h;
  // r 给的是相对宽度比例，但表盘是正圆。为了竖屏不被极端拉伸，用 min(w,h) 方向参考，
  // 但实际上比例舞台 16:9 或 3:2，w>h，直接用 w 方向即可。
  const r = spec.r * w;
  const now = new Date();

  // 1. 表盘外发光（淡）
  const halo = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.1);
  halo.addColorStop(0, 'rgba(255, 235, 180, 0.22)');
  halo.addColorStop(1, 'rgba(255, 235, 180, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.1, 0, Math.PI * 2);
  ctx.fill();

  // 2. 表盘圈
  ctx.save();
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.strokeStyle = 'rgba(80, 45, 15, 0.85)';
  ctx.fillStyle = 'rgba(255, 246, 220, 0.08)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 3. 12 小时刻度
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

  // 4. 秒针
  const sec = now.getSeconds() + now.getMilliseconds() / 1000;
  const aSec = (sec / 60) * Math.PI * 2 - Math.PI / 2;
  ctx.save();
  ctx.strokeStyle = 'rgba(220, 70, 40, 0.95)';
  ctx.lineWidth = Math.max(1, r * 0.045);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(aSec) * r * 0.18, cy - Math.sin(aSec) * r * 0.18);
  ctx.lineTo(cx + Math.cos(aSec) * r * 0.82, cy + Math.sin(aSec) * r * 0.82);
  ctx.stroke();
  ctx.restore();

  // 5. 分针
  const min = now.getMinutes() + sec / 60;
  const aMin = (min / 60) * Math.PI * 2 - Math.PI / 2;
  ctx.save();
  ctx.strokeStyle = 'rgba(30, 15, 5, 0.9)';
  ctx.lineWidth = Math.max(1.5, r * 0.085);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(aMin) * r * 0.75, cy + Math.sin(aMin) * r * 0.75);
  ctx.stroke();
  ctx.restore();

  // 6. 时针
  const hr = (now.getHours() % 12) + min / 60;
  const aHr = (hr / 12) * Math.PI * 2 - Math.PI / 2;
  ctx.save();
  ctx.strokeStyle = 'rgba(30, 15, 5, 0.95)';
  ctx.lineWidth = Math.max(2, r * 0.115);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(aHr) * r * 0.52, cy + Math.sin(aHr) * r * 0.52);
  ctx.stroke();
  ctx.restore();

  // 7. 中心钉
  ctx.save();
  ctx.fillStyle = 'rgba(30, 15, 5, 0.95)';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ============ 绘制：呼吸光点（核心亮点 + 外层扩散圆环） ============
function drawPulseDot(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cxRel: number,
  cyRel: number,
  phase: number,
  colorInner: string,
  colorOuter: string,
) {
  const cx = cxRel * w;
  const cy = cyRel * h;
  const baseR = Math.min(w, h) * 0.012; // 舞台参考尺寸
  const t = phase;

  // 1. 外层扩散呼吸环（2 个错开的波）
  for (let i = 0; i < 2; i++) {
    const tt = (t + i * 0.5) % 1.6;
    const k = tt / 1.6; // 0→1
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

  // 2. 外层大发光
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

  // 3. 中间实心
  ctx.save();
  ctx.fillStyle = colorInner;
  ctx.shadowColor = hexWithAlpha(colorOuter, 0.9);
  ctx.shadowBlur = baseR * 2.2;
  ctx.beginPath();
  ctx.arc(cx, cy, baseR * (1.0 + 0.12 * Math.sin(t * 3)), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 4. 核心高光（左上小白点）
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
