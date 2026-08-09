import { useEffect, useRef, useState } from 'react';

/**
 * Animated pixel-art scene overlay on top of the welcome_bg.jpg background.
 *
 * Elements are positioned as fractions of the image dimensions so they
 * stay correct at any viewport size.  Adjust the numbers in `ELEMENTS`
 * to match where things actually sit in your background image.
 */

interface Rect { x: number; y: number; w: number; h: number }

// All coordinates are fractions (0–1) of the image width / height.
const ELEMENTS = {
  window:  { x: 0.04, y: 0.10, w: 0.20, h: 0.42 } as Rect,
  clock:   { x: 0.42, y: 0.14, r: 0.035 } as Rect & { r: number },
  fire:    { x: 0.62, y: 0.50, w: 0.10, h: 0.16 } as Rect,
  glasses: [
    { x: 0.40, y: 0.56, r: 0.012 },
    { x: 0.52, y: 0.57, r: 0.010 },
  ] as { x: number; y: number; r: number }[],
};

type Weather = 'clear' | 'rain';

interface Props {
  weather?: Weather;
}

export default function SceneCanvas({ weather = 'clear' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const weatherRef = useRef(weather);
  weatherRef.current = weather;

  // Load the background image once.
  useEffect(() => {
    const img = new Image();
    img.src = '/welcome_bg.jpg';
    img.onload = () => { imgRef.current = img; setImgLoaded(true); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // --- particle pools ---
    const rainDrops: { x: number; y: number; speed: number; len: number }[] = [];
    for (let i = 0; i < 120; i++) {
      rainDrops.push({
        x: Math.random(), y: Math.random(),
        speed: 0.004 + Math.random() * 0.006,
        len: 0.01 + Math.random() * 0.02,
      });
    }

    const fireParticles: { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color: string }[] = [];

    const ambientParticles: { x: number; y: number; vx: number; vy: number; size: number; opacity: number; hue: number }[] = [];
    for (let i = 0; i < 24; i++) {
      ambientParticles.push({
        x: Math.random(), y: Math.random(),
        vx: (Math.random() - 0.5) * 0.0002,
        vy: -(Math.random() * 0.0003 + 0.0001),
        size: Math.random() * 2 + 1,
        opacity: Math.random() * 0.3 + 0.1,
        hue: 28 + Math.random() * 20,
      });
    }

    let time = 0;
    let raf = 0;

    const animate = () => {
      time += 0.016;
      const w = canvas.width;
      const h = canvas.height;
      const wRef = weatherRef.current;

      ctx.clearRect(0, 0, w, h);

      // --- window rain ---
      if (wRef === 'rain') {
        const win = ELEMENTS.window;
        ctx.save();
        // clip to window area
        ctx.beginPath();
        ctx.rect(win.x * w, win.y * h, win.w * w, win.h * h);
        ctx.clip();

        ctx.fillStyle = 'rgba(180,200,230,0.5)';
        for (const d of rainDrops) {
          d.y += d.speed;
          d.x += 0.0003;
          if (d.y > 1) { d.y = 0; d.x = Math.random(); }
          const px = (win.x + d.x * win.w) * w;
          const py = (win.y + d.y * win.h) * h;
          ctx.fillRect(px, py, 1, d.len * h);
        }
        ctx.restore();

        // window glass fog
        ctx.fillStyle = 'rgba(200,210,230,0.05)';
        ctx.fillRect(win.x * w, win.y * h, win.w * w, win.h * h);
      }

      // --- fireplace fire ---
      const fire = ELEMENTS.fire;
      const fx = (fire.x + fire.w / 2) * w;
      const fy = (fire.y + fire.h) * h;
      const fw = fire.w * w;

      // spawn fire particles
      for (let i = 0; i < 3; i++) {
        const colors = ['#ff6b3a', '#ffaa3a', '#ffdd6a', '#ff8c42'];
        fireParticles.push({
          x: fx + (Math.random() - 0.5) * fw * 0.8,
          y: fy,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -(Math.random() * 1.5 + 0.8),
          life: 0,
          maxLife: 30 + Math.random() * 30,
          size: Math.random() * 3 + 2,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }

      // fire glow
      const glow = ctx.createRadialGradient(fx, fy, 0, fx, fy, fw * 1.5);
      glow.addColorStop(0, 'rgba(255,140,50,0.25)');
      glow.addColorStop(1, 'rgba(255,140,50,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(fx - fw * 1.5, fy - fw * 1.5, fw * 3, fw * 3);

      // update + draw fire particles
      for (let i = fireParticles.length - 1; i >= 0; i--) {
        const p = fireParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy *= 0.98;
        p.life++;
        const alpha = 1 - p.life / p.maxLife;
        if (alpha <= 0) { fireParticles.splice(i, 1); continue; }
        ctx.globalAlpha = alpha * 0.8;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;

      // --- clock hands ---
      const clk = ELEMENTS.clock;
      const cx = clk.x * w;
      const cy = clk.y * h;
      const cr = clk.r * Math.min(w, h);

      const now = new Date();
      const hourAngle = ((now.getHours() % 12 + now.getMinutes() / 60) / 12) * Math.PI * 2 - Math.PI / 2;
      const minuteAngle = ((now.getMinutes() + now.getSeconds() / 60) / 60) * Math.PI * 2 - Math.PI / 2;
      const secondAngle = ((now.getSeconds() + now.getMilliseconds() / 1000) / 60) * Math.PI * 2 - Math.PI / 2;

      // erase the clock face area with the background image so our hands sit on top
      if (imgRef.current) {
        const img = imgRef.current;
        const sx = (clk.x - clk.r) * img.naturalWidth;
        const sy = (clk.y - clk.r) * img.naturalHeight;
        const sw = clk.r * 2 * img.naturalWidth;
        const sh = clk.r * 2 * img.naturalHeight;
        ctx.drawImage(img, sx, sy, sw, sh, cx - cr, cy - cr, cr * 2, cr * 2);
      }

      // pixel-style tick marks
      ctx.strokeStyle = 'rgba(40,30,20,0.6)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * cr * 0.85, cy + Math.sin(a) * cr * 0.85);
        ctx.lineTo(cx + Math.cos(a) * cr * 0.95, cy + Math.sin(a) * cr * 0.95);
        ctx.stroke();
      }

      // hour hand
      ctx.strokeStyle = '#2a1a10';
      ctx.lineWidth = Math.max(2, cr * 0.12);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(hourAngle) * cr * 0.45, cy + Math.sin(hourAngle) * cr * 0.45);
      ctx.stroke();

      // minute hand
      ctx.lineWidth = Math.max(1.5, cr * 0.08);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(minuteAngle) * cr * 0.65, cy + Math.sin(minuteAngle) * cr * 0.65);
      ctx.stroke();

      // second hand (thinner, warm color)
      ctx.strokeStyle = '#8b4513';
      ctx.lineWidth = Math.max(1, cr * 0.04);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(secondAngle) * cr * 0.75, cy + Math.sin(secondAngle) * cr * 0.75);
      ctx.stroke();

      // center dot
      ctx.fillStyle = '#2a1a10';
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1.5, cr * 0.06), 0, Math.PI * 2);
      ctx.fill();

      // --- glass highlights ---
      for (const g of ELEMENTS.glasses) {
        const gx = g.x * w;
        const gy = g.y * h;
        const gr = g.r * Math.min(w, h);
        const sparkle = Math.sin(time * 2 + g.x * 100);
        if (sparkle > 0.7) {
          ctx.fillStyle = `rgba(255,255,255,${sparkle * 0.5})`;
          ctx.fillRect(gx - gr, gy - gr, gr * 2, 1);
          ctx.fillRect(gx, gy - gr, 1, gr * 2);
        }
      }

      // --- ambient warm particles ---
      for (const p of ambientParticles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
        if (p.x < -0.05) p.x = 1.05;
        if (p.x > 1.05) p.x = -0.05;

        const twinkle = 0.7 + Math.sin(time * 2 + p.x * 100) * 0.3;
        const px2 = p.x * w;
        const py2 = p.y * h;
        ctx.fillStyle = `hsla(${p.hue}, 85%, 62%, ${p.opacity * twinkle})`;
        ctx.beginPath();
        ctx.arc(px2, py2, p.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `hsla(${p.hue}, 85%, 62%, ${p.opacity * twinkle * 0.2})`;
        ctx.beginPath();
        ctx.arc(px2, py2, p.size * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [imgLoaded]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
      aria-hidden="true"
    />
  );
}
