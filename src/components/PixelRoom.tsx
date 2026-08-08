import { useEffect, useRef } from 'react';

interface Props {
  isTyping: boolean;
  weather: 'clear' | 'rain';
  onToggleWeather: () => void;
}

type Px = number;

const SCALE = 4;

function px(v: number): Px {
  return v * SCALE;
}

export default function PixelRoom({ isTyping, weather, onToggleWeather }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const stateRef = useRef({ time: 0, rainDrops: [] as { x: number; y: number; speed: number }[], leaves: [] as { x: number; y: number; rot: number; speed: number }[] });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = w;
      canvas.height = h;
    };
    resize();
    window.addEventListener('resize', resize);

    ctx.imageSmoothingEnabled = false;

    const drops: { x: number; y: number; speed: number }[] = [];
    for (let i = 0; i < 40; i++) {
      drops.push({ x: Math.random() * 300, y: Math.random() * 200, speed: 2 + Math.random() * 3 });
    }

    const leaves: { x: number; y: number; rot: number; speed: number }[] = [];
    for (let i = 0; i < 5; i++) {
      leaves.push({ x: Math.random() * 200, y: Math.random() * 100, rot: 0, speed: 0.3 + Math.random() * 0.5 });
    }

    stateRef.current.rainDrops = drops;
    stateRef.current.leaves = leaves;

    const animate = () => {
      const s = stateRef.current;
      s.time += 0.016;
      const t = s.time;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const w = canvas.width;
      const h = canvas.height;

      // === BACKGROUND WALL ===
      // Warm gradient wall
      const wallGrad = ctx.createLinearGradient(0, 0, 0, h * 0.65);
      wallGrad.addColorStop(0, '#2a1f1a');
      wallGrad.addColorStop(0.5, '#3a2a20');
      wallGrad.addColorStop(1, '#4a3328');
      ctx.fillStyle = wallGrad;
      ctx.fillRect(0, 0, w, h * 0.65);

      // Wall texture - subtle horizontal lines
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      for (let y = 0; y < h * 0.65; y += px(2)) {
        ctx.fillRect(0, y, w, 1);
      }

      // === WINDOW ===
      const winX = w * 0.08;
      const winY = h * 0.1;
      const winW = w * 0.22;
      const winH = h * 0.32;

      // Window frame (dark wood)
      ctx.fillStyle = '#1a1410';
      ctx.fillRect(winX - px(2), winY - px(2), winW + px(4), winH + px(4));

      // Sky / outside view - changes with weather
      const skyGrad = ctx.createLinearGradient(0, winY, 0, winY + winH);
      if (weather === 'rain') {
        skyGrad.addColorStop(0, '#1a1a2e');
        skyGrad.addColorStop(0.6, '#2a2a3e');
        skyGrad.addColorStop(1, '#3a3a4e');
      } else {
        const sunsetShift = Math.sin(t * 0.1) * 5;
        skyGrad.addColorStop(0, `hsl(${25 + sunsetShift}, 40%, 35%)`);
        skyGrad.addColorStop(0.5, `hsl(${35 + sunsetShift}, 55%, 45%)`);
        skyGrad.addColorStop(1, `hsl(${40 + sunsetShift}, 60%, 55%)`);
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(winX, winY, winW, winH);

      // Window cross frame
      ctx.fillStyle = '#1a1410';
      ctx.fillRect(winX + winW / 2 - px(1), winY, px(2), winH);
      ctx.fillRect(winX, winY + winH / 2 - px(1), winW, px(2));

      // Light coming through window - warm glow on floor and wall
      const lightGrad = ctx.createRadialGradient(
        winX + winW / 2, winY + winH * 0.3, 0,
        winX + winW / 2, winY + winH * 0.3, winW * 1.5,
      );
      const lightAlpha = weather === 'rain' ? 0.08 : 0.15;
      lightGrad.addColorStop(0, `rgba(255, 200, 120, ${lightAlpha})`);
      lightGrad.addColorStop(0.5, `rgba(255, 180, 100, ${lightAlpha * 0.5})`);
      lightGrad.addColorStop(1, 'rgba(255, 180, 100, 0)');
      ctx.fillStyle = lightGrad;
      ctx.fillRect(0, 0, w, h * 0.7);

      // Rain on window
      if (weather === 'rain') {
        ctx.strokeStyle = 'rgba(180, 200, 220, 0.4)';
        ctx.lineWidth = 1;
        for (const d of s.rainDrops) {
          d.y += d.speed;
          d.x -= d.speed * 0.3;
          if (d.y > winY + winH || d.x < winX) {
            d.y = winY;
            d.x = winX + Math.random() * winW;
          }
          if (d.x >= winX && d.x <= winX + winW && d.y >= winY && d.y <= winY + winH) {
            ctx.beginPath();
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x - 2, d.y + 8);
            ctx.stroke();
          }
        }
      } else {
        // Floating leaves outside window
        for (const l of s.leaves) {
          l.x += Math.sin(t + l.y * 0.01) * 0.5;
          l.y += l.speed * 0.3;
          l.rot += 0.02;
          if (l.y > winY + winH) {
            l.y = winY;
            l.x = winX + Math.random() * winW;
          }
          if (l.x >= winX && l.x <= winX + winW && l.y >= winY && l.y <= winY + winH) {
            ctx.fillStyle = `hsl(${30 + Math.sin(l.rot) * 20}, 50%, 50%)`;
            ctx.fillRect(l.x, l.y, px(1), px(1));
          }
        }
      }

      // === CLOCK ON WALL ===
      const clockX = w * 0.42;
      const clockY = h * 0.12;
      const clockR = Math.min(w, h) * 0.04;

      // Clock body
      ctx.fillStyle = '#1a1410';
      ctx.beginPath();
      ctx.arc(clockX, clockY, clockR + px(1), 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#3a2a20';
      ctx.beginPath();
      ctx.arc(clockX, clockY, clockR, 0, Math.PI * 2);
      ctx.fill();

      // Clock face
      ctx.fillStyle = '#d4c4a0';
      ctx.beginPath();
      ctx.arc(clockX, clockY, clockR - px(1), 0, Math.PI * 2);
      ctx.fill();

      // Tick marks
      ctx.strokeStyle = '#3a2a20';
      ctx.lineWidth = 1;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(clockX + Math.cos(a) * (clockR - px(2)), clockY + Math.sin(a) * (clockR - px(2)));
        ctx.lineTo(clockX + Math.cos(a) * (clockR - px(1)), clockY + Math.sin(a) * (clockR - px(1)));
        ctx.stroke();
      }

      // Clock hands - actually move with real time
      const now = new Date();
      const hours = now.getHours() % 12;
      const mins = now.getMinutes();
      const secs = now.getSeconds();

      const hourAngle = ((hours + mins / 60) / 12) * Math.PI * 2 - Math.PI / 2;
      const minAngle = ((mins + secs / 60) / 60) * Math.PI * 2 - Math.PI / 2;
      const secAngle = (secs / 60) * Math.PI * 2 - Math.PI / 2;

      ctx.strokeStyle = '#2a1a10';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(clockX, clockY);
      ctx.lineTo(clockX + Math.cos(hourAngle) * clockR * 0.5, clockY + Math.sin(hourAngle) * clockR * 0.5);
      ctx.stroke();

      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(clockX, clockY);
      ctx.lineTo(clockX + Math.cos(minAngle) * clockR * 0.75, clockY + Math.sin(minAngle) * clockR * 0.75);
      ctx.stroke();

      ctx.strokeStyle = '#8b4513';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(clockX, clockY);
      ctx.lineTo(clockX + Math.cos(secAngle) * clockR * 0.8, clockY + Math.sin(secAngle) * clockR * 0.8);
      ctx.stroke();

      // Clock center dot
      ctx.fillStyle = '#2a1a10';
      ctx.beginPath();
      ctx.arc(clockX, clockY, 2, 0, Math.PI * 2);
      ctx.fill();

      // === SHELF with items ===
      const shelfX = w * 0.55;
      const shelfY = h * 0.15;
      ctx.fillStyle = '#2a1a10';
      ctx.fillRect(shelfX, shelfY, w * 0.18, px(2));
      // Bottle on shelf
      ctx.fillStyle = '#4a7a4a';
      ctx.fillRect(shelfX + px(3), shelfY - px(5), px(2), px(5));
      ctx.fillStyle = '#3a5a3a';
      ctx.fillRect(shelfX + px(3), shelfY - px(6), px(2), px(1));
      // Book
      ctx.fillStyle = '#8b3a3a';
      ctx.fillRect(shelfX + px(7), shelfY - px(4), px(2), px(4));
      ctx.fillStyle = '#6b2a2a';
      ctx.fillRect(shelfX + px(7), shelfY - px(4), px(2), px(1));

      // === FLOOR ===
      const floorGrad = ctx.createLinearGradient(0, h * 0.65, 0, h);
      floorGrad.addColorStop(0, '#3a2820');
      floorGrad.addColorStop(0.5, '#2a1a14');
      floorGrad.addColorStop(1, '#1a1008');
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, h * 0.65, w, h * 0.35);

      // Floorboards
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1;
      for (let y = h * 0.65; y < h; y += px(4)) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      // Vertical floorboard seams (offset)
      for (let row = 0; row < 10; row++) {
        const yStart = h * 0.65 + row * px(4);
        const offset = (row % 2) * px(4);
        for (let x = offset; x < w; x += px(12)) {
          ctx.beginPath();
          ctx.moveTo(x, yStart);
          ctx.lineTo(x, yStart + px(4));
          ctx.stroke();
        }
      }

      // Light pool on floor from window
      const floorLight = ctx.createLinearGradient(0, h * 0.65, 0, h * 0.95);
      floorLight.addColorStop(0, `rgba(255, 200, 120, ${weather === 'rain' ? 0.06 : 0.12})`);
      floorLight.addColorStop(1, 'rgba(255, 200, 120, 0)');
      ctx.fillStyle = floorLight;
      ctx.beginPath();
      ctx.moveTo(winX - px(5), h * 0.65);
      ctx.lineTo(winX + winW + px(5), h * 0.65);
      ctx.lineTo(winX + winW + px(15), h * 0.95);
      ctx.lineTo(winX - px(15), h * 0.95);
      ctx.closePath();
      ctx.fill();

      // === BAR COUNTER ===
      const barX = w * 0.3;
      const barY = h * 0.55;
      const barW = w * 0.5;
      const barH = h * 0.12;

      // Counter top
      const counterGrad = ctx.createLinearGradient(0, barY, 0, barY + px(3));
      counterGrad.addColorStop(0, '#5a3a28');
      counterGrad.addColorStop(1, '#4a2a18');
      ctx.fillStyle = counterGrad;
      ctx.fillRect(barX, barY, barW, px(3));

      // Counter front
      ctx.fillStyle = '#3a2418';
      ctx.fillRect(barX, barY + px(3), barW, barH);

      // Counter wood grain
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      for (let i = 0; i < 6; i++) {
        ctx.fillRect(barX + (barW / 6) * i, barY + px(3), 1, barH);
      }

      // === ITEMS ON COUNTER ===
      // Glass with drink (left side)
      const glassX = barX + barW * 0.15;
      const glassY = barY - px(6);
      // Glass body
      ctx.fillStyle = 'rgba(200, 200, 220, 0.3)';
      ctx.fillRect(glassX, glassY, px(3), px(6));
      // Liquid
      ctx.fillStyle = 'rgba(180, 120, 60, 0.7)';
      ctx.fillRect(glassX, glassY + px(2), px(3), px(4));
      // Glass highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(glassX, glassY, px(1), px(6));

      // Steam rising from glass
      const steamPhase = t * 2;
      for (let i = 0; i < 3; i++) {
        const sy = glassY - ((steamPhase * 10 + i * 15) % 30);
        const sx = glassX + px(1) + Math.sin(steamPhase + i) * 3;
        const alpha = Math.max(0, 0.3 - (glassY - sy) / 30);
        if (alpha > 0) {
          ctx.fillStyle = `rgba(200, 200, 200, ${alpha})`;
          ctx.fillRect(sx, sy, px(1), px(1));
        }
      }

      // Ashtray (right side)
      const ashX = barX + barW * 0.75;
      const ashY = barY - px(2);
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(ashX, ashY, px(4), px(2));
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(ashX + px(1), ashY - px(1), px(2), px(1));
      // Cigarette with smoke
      ctx.fillStyle = '#d4c4a0';
      ctx.fillRect(ashX + px(1), ashY - px(2), px(3), px(1));
      ctx.fillStyle = '#ff6b3a';
      ctx.fillRect(ashX + px(4), ashY - px(2), px(1), px(1));

      // Smoke rising
      const smokePhase = t * 1.5;
      for (let i = 0; i < 4; i++) {
        const sy = ashY - px(2) - ((smokePhase * 8 + i * 12) % 40);
        const sx = ashX + px(3) + Math.sin(smokePhase + i * 0.5) * 4;
        const alpha = Math.max(0, 0.25 - (ashY - px(2) - sy) / 40);
        if (alpha > 0) {
          ctx.fillStyle = `rgba(180, 180, 180, ${alpha})`;
          ctx.fillRect(sx, sy, px(1), px(1));
          ctx.fillRect(sx + px(1), sy - px(1), px(1), px(1));
        }
      }

      // === CHARACTER behind bar ===
      const charX = barX + barW * 0.5;
      const charBaseY = barY;

      // Breathing / idle animation
      const breathe = Math.sin(t * 1.5) * 1.5;
      const armOffset = Math.sin(t * 2) * 2; // arm wiping motion

      // Character body (torso) - dark shirt
      ctx.fillStyle = '#2a2a3a';
      ctx.fillRect(charX - px(4), charBaseY - px(10) + breathe, px(8), px(6));

      // Head
      ctx.fillStyle = '#d4a878';
      ctx.fillRect(charX - px(2), charBaseY - px(14) + breathe, px(4), px(4));

      // Hair
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(charX - px(2), charBaseY - px(14) + breathe, px(4), px(2));
      ctx.fillRect(charX - px(3), charBaseY - px(13) + breathe, px(1), px(2));
      ctx.fillRect(charX + px(2), charBaseY - px(13) + breathe, px(1), px(2));

      // Eyes - blink occasionally
      const blinkCycle = Math.floor(t * 0.5) % 6;
      const isBlinking = blinkCycle === 0 && (t * 0.5) % 1 < 0.15;
      if (!isBlinking) {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(charX - px(1), charBaseY - px(12) + breathe, px(1), px(1));
        ctx.fillRect(charX + px(1), charBaseY - px(12) + breathe, px(1), px(1));
      } else {
        ctx.fillStyle = '#d4a878';
        ctx.fillRect(charX - px(1), charBaseY - px(12) + breathe, px(1), px(1));
        ctx.fillRect(charX + px(1), charBaseY - px(12) + breathe, px(1), px(1));
      }

      // Mouth - slight smile
      ctx.fillStyle = '#8b5a3a';
      ctx.fillRect(charX - px(1), charBaseY - px(10) + breathe, px(2), px(1));

      // Arms - wiping a glass motion
      const armY = charBaseY - px(8) + breathe + armOffset;
      ctx.fillStyle = '#2a2a3a';
      // Left arm
      ctx.fillRect(charX - px(6), charBaseY - px(8) + breathe, px(2), px(5));
      // Right arm (wiping)
      ctx.fillRect(charX + px(4), charBaseY - px(8) + breathe, px(2), px(5));
      // Hand
      ctx.fillStyle = '#d4a878';
      ctx.fillRect(charX - px(6), charBaseY - px(3) + breathe, px(2), px(1));
      ctx.fillRect(charX + px(4), charBaseY - px(3) + breathe + armOffset * 0.3, px(2), px(1));

      // Glass being wiped
      ctx.fillStyle = 'rgba(200, 200, 220, 0.4)';
      ctx.fillRect(charX + px(5), charBaseY - px(5) + breathe + armOffset * 0.3, px(2), px(3));

      // If typing, show the character more animated (leaning forward)
      if (isTyping) {
        // Add a slight forward lean indicator - thought bubble
        const bubbleX = charX + px(6);
        const bubbleY = charBaseY - px(18);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fillRect(bubbleX, bubbleY, px(3), px(2));
        ctx.fillRect(bubbleX + px(1), bubbleY - px(1), px(1), px(1));
        // Three dots
        for (let i = 0; i < 3; i++) {
          const dotAlpha = 0.4 + Math.sin(t * 4 + i * 1.5) * 0.3;
          ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, dotAlpha)})`;
          ctx.fillRect(bubbleX + px(1) + i * px(1), bubbleY + px(1), px(1), px(1));
        }
      }

      // === LAMP / HANGING LIGHT ===
      const lampX = w * 0.5;
      const lampY = h * 0.02;
      // Cord
      ctx.strokeStyle = '#1a1410';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(lampX, 0);
      ctx.lineTo(lampX, lampY);
      ctx.stroke();

      // Lamp shade
      ctx.fillStyle = '#3a2818';
      ctx.beginPath();
      ctx.moveTo(lampX - px(4), lampY);
      ctx.lineTo(lampX + px(4), lampY);
      ctx.lineTo(lampX + px(3), lampY + px(4));
      ctx.lineTo(lampX - px(3), lampY + px(4));
      ctx.closePath();
      ctx.fill();

      // Light bulb glow
      const glowPulse = 0.8 + Math.sin(t * 3) * 0.05;
      const lampGlow = ctx.createRadialGradient(lampX, lampY + px(5), 0, lampX, lampY + px(5), px(30));
      lampGlow.addColorStop(0, `rgba(255, 200, 100, ${0.25 * glowPulse})`);
      lampGlow.addColorStop(0.4, `rgba(255, 180, 80, ${0.1 * glowPulse})`);
      lampGlow.addColorStop(1, 'rgba(255, 180, 80, 0)');
      ctx.fillStyle = lampGlow;
      ctx.fillRect(lampX - px(30), lampY, px(60), h * 0.5);

      // Bulb
      ctx.fillStyle = `hsl(45, 90%, ${60 * glowPulse}%)`;
      ctx.fillRect(lampX - px(1), lampY + px(4), px(2), px(2));

      // === AMBIENT PARTICLES (dust motes) ===
      for (let i = 0; i < 8; i++) {
        const moteX = (Math.sin(t * 0.3 + i * 2) * 0.5 + 0.5) * w;
        const moteY = (Math.cos(t * 0.2 + i * 1.5) * 0.3 + 0.3) * h;
        const moteAlpha = 0.15 + Math.sin(t + i) * 0.1;
        ctx.fillStyle = `rgba(255, 220, 150, ${Math.max(0, moteAlpha)})`;
        ctx.fillRect(moteX, moteY, 1, 1);
      }

      // === Vignette ===
      const vignette = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.7);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.4)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);

      animRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [isTyping, weather]);

  return (
    <div className="absolute inset-0 z-0">
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        aria-hidden="true"
      />
      {/* Weather toggle button - subtle, bottom left corner of scene */}
      <button
        onClick={onToggleWeather}
        className="absolute bottom-3 left-3 z-10 rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5 text-xs text-white/50 backdrop-blur-sm hover:bg-black/60 hover:text-white/80 transition-all"
        aria-label="切换天气"
      >
        {weather === 'rain' ? '雨天' : '晴天'}
      </button>
    </div>
  );
}
