import { useEffect, useRef } from 'react';

interface Props {
  isTyping: boolean;
  weather: 'clear' | 'rain';
  onToggleWeather: () => void;
}

type Px = number;
const SCALE = 4;
function px(v: number): Px { return v * SCALE; }

export default function PixelRoom({ isTyping, weather, onToggleWeather }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const stateRef = useRef({ 
    time: 0, 
    rainDrops: [] as any[], 
    leaves: [] as any[], 
    shelves: [] as any[],
    particles: [] as any[]
  });

  useEffect(() => {
    // initialize states...
    const drops = [];
    for (let i = 0; i < 150; i++) drops.push({ x: Math.random(), y: Math.random(), speed: 2 + Math.random() * 3 });
    const leaves = [];
    for (let i = 0; i < 20; i++) leaves.push({ x: Math.random(), y: Math.random(), speed: 0.3 + Math.random() * 0.5, c: `hsl(${30 + Math.random() * 30}, 50%, 50%)` });
    const shelves = [];
    const colors = ['#2a5a3a', '#5a3a2a', '#6a2a2a', '#6a5a2a'];
    for(let i=0; i<4; i++) {
      const shelf = [];
      const num = 5 + Math.floor(Math.random() * 4);
      let cx = 0;
      for(let j=0; j<num; j++) {
        shelf.push({ x: cx + Math.random() * 0.1, c: colors[Math.floor(Math.random() * colors.length)] });
        cx += 1/num;
      }
      shelves.push(shelf);
    }
    const particles = [];
    for(let i=0; i<15; i++) particles.push({ x: Math.random(), y: Math.random(), speed: 0.1 + Math.random()*0.2, id: i });

    stateRef.current.rainDrops = drops;
    stateRef.current.leaves = leaves;
    stateRef.current.shelves = shelves;
    stateRef.current.particles = particles;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    ctx.imageSmoothingEnabled = false;

    const animate = () => {
      const s = stateRef.current;
      s.time += 0.016;
      const t = s.time;
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      // --- Layer 0: 墙壁 ---
      const wallGrad = ctx.createLinearGradient(0, 0, 0, h * 0.65);
      wallGrad.addColorStop(0, '#4a3a28');
      wallGrad.addColorStop(1, '#3a2a20');
      ctx.fillStyle = wallGrad;
      ctx.fillRect(0, 0, w, h * 0.65);

      ctx.fillStyle = '#1a1008';
      for (let y = 0; y < h * 0.65; y += px(6)) {
        const row = Math.floor(y / px(6));
        const offset = (row % 2) * px(8);
        for (let x = -offset; x < w; x += px(16)) {
          ctx.fillRect(x, y, px(16), px(1)); // horizontal seam
          ctx.fillRect(x, y, px(1), px(6));  // vertical seam
        }
      }

      // --- Layer 1: 窗户 + 窗外 ---
      const winX = w * 0.08, winY = h * 0.08, winW = w * 0.22, winH = h * 0.37;
      
      // 窗框
      ctx.fillStyle = '#1a1410';
      ctx.fillRect(winX - px(4), winY - px(4), winW + px(8), winH + px(8));
      
      // 窗外天空
      const skyGrad = ctx.createLinearGradient(0, winY, 0, winY + winH);
      if (weather === 'clear') {
        skyGrad.addColorStop(0, 'hsl(35, 55%, 50%)');
        skyGrad.addColorStop(1, 'hsl(25, 40%, 35%)');
      } else {
        skyGrad.addColorStop(0, 'hsl(220, 30%, 20%)');
        skyGrad.addColorStop(1, 'hsl(220, 25%, 30%)');
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(winX, winY, winW, winH);

      // 天气特效
      if (weather === 'rain') {
        ctx.fillStyle = 'rgba(180,200,220,0.4)';
        for (const d of s.rainDrops) {
          d.y += d.speed / winH * 2; // scale speed
          if (d.y > 1) { d.y = 0; d.x = Math.random(); }
          ctx.fillRect(winX + d.x * winW, winY + d.y * winH, px(1), px(6));
        }
      } else {
        for (const l of s.leaves) {
          l.y += (l.speed * 1.5) / winH;
          l.x += (Math.sin(t + l.speed * 10) * 0.5) / winW;
          if (l.y > 1) { l.y = 0; l.x = Math.random(); }
          if (l.x >= 0 && l.x <= 1 && l.y >= 0 && l.y <= 1) {
            ctx.fillStyle = l.c;
            ctx.fillRect(winX + l.x * winW, winY + l.y * winH, px(1), px(1));
          }
        }
      }

      // 窗框十字
      ctx.fillStyle = '#1a1410';
      ctx.fillRect(winX + winW / 2 - px(1), winY, px(2), winH);
      ctx.fillRect(winX, winY + winH / 2 - px(1), winW, px(2));

      // --- Layer 2: 墙上时钟 ---
      const clockX = w * 0.42, clockY = h * 0.14;
      ctx.fillStyle = '#1a1410';
      ctx.beginPath(); ctx.arc(clockX, clockY, px(12), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d4c4a0';
      ctx.beginPath(); ctx.arc(clockX, clockY, px(10), 0, Math.PI * 2); ctx.fill();
      
      ctx.lineWidth = px(1);
      ctx.strokeStyle = '#3a2a20';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(clockX + Math.cos(a) * px(8), clockY + Math.sin(a) * px(8));
        ctx.lineTo(clockX + Math.cos(a) * px(10), clockY + Math.sin(a) * px(10));
        ctx.stroke();
      }
      
      const now = new Date();
      const hA = ((now.getHours() % 12 + now.getMinutes() / 60) / 12) * Math.PI * 2 - Math.PI / 2;
      const mA = ((now.getMinutes() + now.getSeconds() / 60) / 60) * Math.PI * 2 - Math.PI / 2;
      const sA = ((now.getSeconds() + now.getMilliseconds() / 1000) / 60) * Math.PI * 2 - Math.PI / 2;
      
      ctx.strokeStyle = '#2a1a10';
      ctx.beginPath(); ctx.moveTo(clockX, clockY); ctx.lineTo(clockX + Math.cos(hA) * px(5), clockY + Math.sin(hA) * px(5)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(clockX, clockY); ctx.lineTo(clockX + Math.cos(mA) * px(7), clockY + Math.sin(mA) * px(7)); ctx.stroke();
      
      ctx.strokeStyle = '#8b4513';
      ctx.lineWidth = Math.max(1, px(0.5));
      ctx.beginPath(); ctx.moveTo(clockX, clockY); ctx.lineTo(clockX + Math.cos(sA) * px(8), clockY + Math.sin(sA) * px(8)); ctx.stroke();
      
      ctx.fillStyle = '#2a1a10';
      ctx.fillRect(clockX - px(1), clockY - px(1), px(2), px(2)); // center dot

      // --- Layer 3: 天花板吊灯 ---
      const lampX = w * 0.5, lampY = h * 0.02;
      ctx.fillStyle = '#1a1410';
      ctx.fillRect(lampX - px(0.5), 0, px(1), lampY);
      
      ctx.fillStyle = '#3a2818';
      ctx.beginPath();
      ctx.moveTo(lampX - px(4), lampY);
      ctx.lineTo(lampX + px(4), lampY);
      ctx.lineTo(lampX + px(3), lampY + px(4));
      ctx.lineTo(lampX - px(3), lampY + px(4));
      ctx.fill();
      
      const bulbAlpha = 60 + Math.sin(t * 3) * 5;
      ctx.fillStyle = `hsl(45, 90%, ${bulbAlpha}%)`;
      ctx.fillRect(lampX - px(1), lampY + px(4), px(2), px(2));
      
      const halo = ctx.createRadialGradient(lampX, lampY + px(5), 0, lampX, lampY + px(5), px(40));
      halo.addColorStop(0, 'rgba(255,200,100,0.25)');
      halo.addColorStop(1, 'rgba(255,200,100,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(lampX - px(40), lampY - px(10), px(80), px(80));

      // --- Layer 4: 右侧酒架 ---
      const shelfX = w * 0.82;
      const shelfY = h * 0.08;
      const shelfW = w * 0.15;
      for (let i = 0; i < 4; i++) {
        const sy = shelfY + i * px(14);
        ctx.fillStyle = '#2a1a10';
        ctx.fillRect(shelfX, sy, shelfW, px(2));
        
        for (const b of s.shelves[i]) {
          const bx = shelfX + b.x * (shelfW - px(3));
          ctx.fillStyle = b.c;
          ctx.fillRect(bx, sy - px(8), px(3), px(8));
          ctx.fillRect(bx + px(1), sy - px(10), px(1), px(2));
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillRect(bx + px(1), sy - px(10), px(1), px(2));
        }
      }

      // --- Layer 5: 壁炉 ---
      const fireX = w * 0.65;
      const fireY = h * 0.45;
      ctx.fillStyle = '#2a1a10';
      ctx.fillRect(fireX - px(10), fireY - px(12), px(20), px(24));
      ctx.fillStyle = '#0a0804';
      ctx.fillRect(fireX - px(7), fireY - px(4), px(14), px(16));
      ctx.fillStyle = '#5a3a1a';
      ctx.fillRect(fireX - px(5), fireY + px(8), px(8), px(2));
      ctx.fillRect(fireX - px(3), fireY + px(10), px(8), px(2));
      
      for (let i = 0; i < 6; i++) {
        const hOffset = Math.sin(t * 4 + i) * px(2);
        ctx.fillStyle = (i % 3 === 0) ? '#ff6b3a' : (i % 3 === 1) ? '#ffaa3a' : '#ffdd6a';
        ctx.fillRect(fireX - px(4) + i * px(1.5), fireY + px(6) - hOffset, px(1.5), px(2));
      }
      
      const fireGlow = ctx.createRadialGradient(fireX, fireY + px(8), 0, fireX, fireY + px(8), px(20));
      fireGlow.addColorStop(0, 'rgba(255,150,50,0.3)');
      fireGlow.addColorStop(1, 'rgba(255,150,50,0)');
      ctx.fillStyle = fireGlow;
      ctx.fillRect(fireX - px(20), fireY - px(12), px(40), px(40));

      // --- Layer 6: 地板 ---
      const floorY = h * 0.65;
      const floorGrad = ctx.createLinearGradient(0, floorY, 0, h);
      floorGrad.addColorStop(0, '#3a2820');
      floorGrad.addColorStop(1, '#1a1008');
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, floorY, w, h * 0.35);

      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      for (let y = floorY; y < h; y += px(4)) {
        ctx.fillRect(0, y, w, px(1));
        const row = Math.floor((y - floorY) / px(4));
        const offset = (row % 2) * px(12);
        for (let x = -offset; x < w; x += px(24)) {
          ctx.fillRect(x, y, px(1), px(4));
        }
      }

      const spotAlpha = weather === 'clear' ? 0.1 : 0.04;
      ctx.fillStyle = `rgba(255,200,120,${spotAlpha})`;
      ctx.beginPath();
      ctx.moveTo(winX, floorY);
      ctx.lineTo(winX + winW, floorY);
      ctx.lineTo(winX + winW + px(20), h);
      ctx.lineTo(winX - px(10), h);
      ctx.fill();

      // --- Layer 7: 吧台 ---
      const barX = w * 0.3, barY = h * 0.55, barW = w * 0.5, barH = h * 0.12;
      const counterTopGrad = ctx.createLinearGradient(0, barY, 0, barY + px(3));
      counterTopGrad.addColorStop(0, '#5a3a28');
      counterTopGrad.addColorStop(1, '#4a2a18');
      ctx.fillStyle = counterTopGrad;
      ctx.fillRect(barX, barY, barW, px(3));
      
      ctx.fillStyle = '#3a2418';
      ctx.fillRect(barX, barY + px(3), barW, barH);
      
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      for (let i = 1; i < 6; i++) {
        ctx.fillRect(barX + (barW / 6) * i, barY + px(3), px(1), barH);
      }

      // --- Layer 8: 吧台物品 ---
      const bX = barX + barW * 0.1;
      ctx.fillStyle = '#6a2a2a';
      ctx.fillRect(bX, barY - px(10), px(3), px(10));
      ctx.fillStyle = '#4a1a1a';
      ctx.fillRect(bX + px(1), barY - px(12), px(1), px(2));

      const gX = barX + barW * 0.4;
      ctx.fillStyle = 'rgba(200,200,220,0.3)';
      ctx.fillRect(gX, barY - px(6), px(3), px(6));
      ctx.fillStyle = 'rgba(180,120,60,0.7)';
      ctx.fillRect(gX, barY - px(4), px(3), px(4));
      
      const steamCycle = t % 1;
      for (let i = 0; i < 3; i++) {
        const sa = Math.max(0, 0.4 - ((steamCycle + i/3)%1));
        ctx.fillStyle = `rgba(200,200,200,${sa})`;
        ctx.fillRect(gX + px(1) + Math.sin(t*2+i)*px(1), barY - px(7) - ((steamCycle+i/3)%1)*px(6), px(1), px(1));
      }

      const ashX = barX + barW * 0.8;
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(ashX, barY - px(2), px(4), px(2));
      ctx.fillStyle = '#d4c4a0';
      ctx.fillRect(ashX + px(1), barY - px(3), px(3), px(1));
      ctx.fillStyle = '#ff6b3a';
      ctx.fillRect(ashX + px(4), barY - px(3), px(1), px(1));
      
      const smokeCycle = (t / 0.6) % 1;
      for (let i = 0; i < 4; i++) {
        const sa = Math.max(0, 0.25 - ((smokeCycle + i/4)%1));
        ctx.fillStyle = `rgba(180,180,180,${sa})`;
        ctx.fillRect(ashX + px(4) + Math.sin(t*3+i)*px(1), barY - px(4) - ((smokeCycle+i/4)%1)*px(8), px(1), px(1));
      }

      ctx.fillStyle = '#3a2418';
      ctx.fillRect(barX + barW * 0.9, barY + px(2), px(3), px(3));
      ctx.fillRect(barX + barW * 0.9 + px(3), barY + px(3), px(1), px(1));

      // --- Layer 9: 角色（酒保） ---
      const charX = barX + barW * 0.6;
      const charY = barY; // Base align with counter
      const charBreath = Math.sin(t * 2) * px(0.5);
      
      ctx.fillStyle = '#2a2a3a';
      ctx.fillRect(charX - px(6), charY - px(10) + charBreath, px(12), px(10));
      
      ctx.fillStyle = '#c49868'; // neck/chest
      ctx.fillRect(charX - px(1.5), charY - px(12) + charBreath, px(3), px(2));
      ctx.fillRect(charX - px(1.5), charY - px(10) + charBreath, px(3), px(2)); // chest V
      
      ctx.fillStyle = '#d4a878';
      ctx.fillRect(charX - px(1), charY - px(10) + charBreath, px(2), px(1)); // collarbone
      
      ctx.fillRect(charX - px(3), charY - px(18) + charBreath, px(6), px(6)); // face
      
      ctx.fillStyle = '#c49868';
      ctx.fillRect(charX - px(4), charY - px(16) + charBreath, px(1), px(2)); // ear L
      ctx.fillRect(charX + px(3), charY - px(16) + charBreath, px(1), px(2)); // ear R
      
      ctx.fillStyle = '#b48860';
      ctx.fillRect(charX - px(0.5), charY - px(15) + charBreath, px(1), px(1)); // nose
      
      ctx.fillStyle = '#8b5a3a';
      ctx.fillRect(charX - px(1), charY - px(13.5) + charBreath, px(2), px(1)); // mouth
      
      ctx.fillStyle = '#1a1a1a';
      if (Math.random() > 0.98) {
        ctx.fillRect(charX - px(2.5), charY - px(16) + charBreath, px(2), px(1));
        ctx.fillRect(charX + px(0.5), charY - px(16) + charBreath, px(2), px(1));
      } else {
        ctx.fillRect(charX - px(2), charY - px(16) + charBreath, px(1), px(1));
        ctx.fillRect(charX + px(1), charY - px(16) + charBreath, px(1), px(1));
      }
      
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(charX - px(5), charY - px(23) + charBreath, px(10), px(5)); // hair top
      ctx.fillRect(charX - px(5), charY - px(18) + charBreath, px(2), px(3)); // hair side L
      ctx.fillRect(charX + px(3), charY - px(18) + charBreath, px(2), px(3)); // hair side R
      ctx.fillRect(charX - px(3), charY - px(18) + charBreath, px(6), px(1)); // bangs
      
      ctx.fillStyle = '#2a2a3a';
      ctx.fillRect(charX - px(8), charY - px(10) + charBreath, px(2), px(8)); // L arm
      
      const wipe = Math.sin(t * 2) * px(3);
      ctx.fillRect(charX + px(6), charY - px(10) + charBreath, px(2), px(4)); // R upper arm
      ctx.fillRect(charX + px(6) + wipe, charY - px(6) + charBreath, px(2), px(4)); // R lower arm
      
      ctx.fillStyle = '#d4a878';
      ctx.fillRect(charX - px(8), charY - px(2) + charBreath, px(2), px(2)); // L hand
      ctx.fillRect(charX + px(6) + wipe, charY - px(2) + charBreath, px(2), px(2)); // R hand
      
      ctx.fillStyle = '#e0e0e0';
      ctx.fillRect(charX + px(5) + wipe, charY - px(1) + charBreath, px(4), px(1)); // cloth

      // --- Layer 10: 前景物品 ---
      const tableX = w * 0.15, tableY = h * 0.8;
      ctx.fillStyle = '#5a3a28';
      ctx.fillRect(tableX - px(12), tableY - px(5), px(4), px(10));
      ctx.fillRect(tableX - px(8), tableY, px(6), px(2));
      ctx.fillRect(tableX - px(8), tableY + px(2), px(1), px(6));
      ctx.fillRect(tableX - px(4), tableY + px(2), px(1), px(6));
      
      ctx.fillStyle = '#4a2a18';
      ctx.fillRect(tableX, tableY, px(16), px(2));
      ctx.fillStyle = '#2a1a10';
      ctx.fillRect(tableX + px(7), tableY + px(2), px(2), px(8));

      // --- Layer 11: 环境粒子 ---
      for (const p of s.particles) {
        p.y -= p.speed / h;
        p.x += Math.sin(t + p.id) * 0.001;
        if (p.y < 0) { p.y = 1; p.x = Math.random(); }
        ctx.fillStyle = `rgba(255, 220, 180, ${Math.max(0, 0.2 * Math.sin(t*2 + p.id))})`;
        ctx.fillRect(p.x * w, p.y * h, px(0.5), px(0.5));
      }

      // --- Layer 12: 暗角 ---
      const vignette = ctx.createRadialGradient(w/2, h/2, w*0.3, w/2, h/2, w*0.7);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.5)');
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
    <div className="absolute inset-0 z-0 pointer-events-none">
      <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />
      <button
        onClick={onToggleWeather}
        className="absolute bottom-3 left-3 z-10 rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5 text-xs text-white/50 backdrop-blur-sm hover:bg-black/60 hover:text-white/80 transition-all cursor-pointer pointer-events-auto"
        aria-label="切换天气"
      >
        {weather === 'rain' ? '雨天' : '晴天'}
      </button>
    </div>
  );
}

