import { useEffect, useRef } from 'react';
 
/**
* SceneCanvas — ONLY draws particle / dynamic EFFECTS on top.
* The background image is rendered by <img> in App.tsx.  We NEVER
* redraw walls / floors / the bar / characters here — they all come
* from the user's original welcome_bg.png.
*
* Coordinates are 0–1 fractions of the canvas so they scale correctly
* on any screen.  Tweak ELEMENTS to match where things sit on YOUR
* background image.
*/
 
interface Rect { x: number; y: number; w: number; h: number }
type Weather = 'clear' | 'rain';
 
// --- ELEMENT POSITIONS (0–1 fraction of canvas) ---
// Adjust these numbers to match YOUR actual welcome_bg.png layout.
// These are just rough starting estimates for a 16:9 bar scene.
const ELEMENTS = {
window:   { x: 0.03, y: 0.08, w: 0.22, h: 0.40 } as Rect,   // left window
clock:    { x: 0.45, y: 0.16, r: 0.032 } as Rect & { r: number }, // wall clock
fire:     { x: 0.70, y: 0.42, w: 0.13, h: 0.20 } as Rect,   // fireplace
bottles:  { x: 0.85, y: 0.10, w: 0.14, h: 0.28 } as Rect,   // bottle shelf right
glasses: [                                                      // bar counter glasses
{ x: 0.56, y: 0.58, r: 0.010 },
{ x: 0.61, y: 0.59, r: 0.010 },
{ x: 0.66, y: 0.58, r: 0.010 },
] as { x: number; y: number; r: number }[],
cup:      { x: 0.30, y: 0.55, w: 0.05, h: 0.05 } as Rect,   // cup with steam
person:   { x: 0.72, y: 0.28, w: 0.14, h: 0.32 } as Rect,   // bartender area
};
 
interface Props { weather?: Weather }
 
export default function SceneCanvas({ weather = 'clear' }: Props) {
const canvasRef = useRef<HTMLCanvasElement>(null);
const weatherRef = useRef(weather);
weatherRef.current = weather;
 
useEffect(() => {
const canvas = canvasRef.current;
if (!canvas) return;
const ctx = canvas.getContext('2d');
if (!ctx) return;
 
const resize = () => {
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
ctx.imageSmoothingEnabled = true;
};
resize();
window.addEventListener('resize', resize);
 
// ----- particle pools -----
const rainDrops: { x: number; y: number; speed: number; len: number }[] = [];
for (let i = 0; i < 140; i++) {
rainDrops.push({
x: Math.random(), y: Math.random(),
speed: 0.005 + Math.random() * 0.007,
len: 0.012 + Math.random() * 0.022,
});
}
 
const leaves: { x: number; y: number; rot: number; rotSpeed: number; fall: number; drift: number; c: string }[] = [];
for (let i = 0; i < 18; i++) {
leaves.push({
x: Math.random(), y: Math.random(),
rot: Math.random() * Math.PI * 2,
rotSpeed: (Math.random() - 0.5) * 0.02,
fall: 0.002 + Math.random() * 0.002,
drift: (Math.random() - 0.5) * 0.001,
c: `hsl(${30 + Math.random() * 30}, 60%, ${45 + Math.random() * 15}%)`,
});
}
 
const fireParticles: { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color: string }[] = [];
 
const bottleHighlights: { x: number; y: number; baseX: number; next: number }[] = [];
for (let i = 0; i < 7; i++) {
const bx = ELEMENTS.bottles.x + (0.1 + Math.random() * 0.8) * ELEMENTS.bottles.w;
const by = ELEMENTS.bottles.y + (0.1 + Math.random() * 0.8) * ELEMENTS.bottles.h;
bottleHighlights.push({ x: bx, y: by, baseX: bx, next: Math.random() * 5 });
}
 
const cupSteams: { x: number; y: number; life: number; maxLife: number; size: number }[] = [];
 
const ambientParticles: { x: number; y: number; vx: number; vy: number; size: number; opacity: number; hue: number }[] = [];
for (let i = 0; i < 28; i++) {
ambientParticles.push({
x: Math.random(), y: Math.random(),
vx: (Math.random() - 0.5) * 0.00018,
vy: -(Math.random() * 0.00025 + 0.00008),
size: Math.random() * 2.5 + 1,
opacity: Math.random() * 0.3 + 0.12,
hue: 28 + Math.random() * 22,
});
}
 
let time = 0;
let raf = 0;
let lightningUntil = 0;  // timestamp when lightning effect ends
 
const animate = () => {
time += 0.016;
const w = canvas.width;
const h = canvas.height;
const wr = weatherRef.current;
 
// ======= CLEAR ONLY — background comes from the <img> tag! =======
ctx.clearRect(0, 0, w, h);
 
// ======= RAIN (inside window clip) =======
const win = ELEMENTS.window;
const wx = win.x * w, wy = win.y * h, ww = win.w * w, wh = win.h * h;
 
if (wr === 'rain') {
ctx.save();
ctx.beginPath();
ctx.rect(wx, wy, ww, wh);
ctx.clip();
 
ctx.fillStyle = 'rgba(190, 210, 235, 0.55)';
for (const d of rainDrops) {
d.y += d.speed;
d.x += 0.0004;
if (d.y > 1) { d.y = 0; d.x = Math.random(); }
const px = wx + d.x * ww;
const py = wy + d.y * wh;
ctx.fillRect(px, py, 1, d.len * h);
}
// window fog
ctx.fillStyle = 'rgba(210, 220, 240, 0.06)';
ctx.fillRect(wx, wy, ww, wh);
ctx.restore();
 
// Lightning
if (time > lightningUntil) {
// small chance to trigger a new strike
if (Math.random() < 0.003) {
lightningUntil = time + 0.12 + Math.random() * 0.08;
}
} else {
// lightning flash overlay
const strength = Math.random() * 0.25 + 0.15;
ctx.fillStyle = `rgba(230, 235, 255, ${strength})`;
ctx.fillRect(wx, wy, ww, wh);
// outside the window also gets some glow
ctx.fillStyle = `rgba(230, 235, 255, ${strength * 0.3})`;
ctx.fillRect(0, 0, w, h);
}
} else {
// ======= SUNNY: floating leaves in window + light beam =======
ctx.save();
ctx.beginPath();
ctx.rect(wx, wy, ww, wh);
ctx.clip();
 
for (const l of leaves) {
l.y += l.fall;
l.x += Math.sin(time + l.rot) * 0.0005 + l.drift;
l.rot += l.rotSpeed;
if (l.y > 1) { l.y = -0.05; l.x = Math.random(); }
if (l.x > 1.05) l.x = -0.05;
if (l.x < -0.05) l.x = 1.05;
const lx = wx + l.x * ww;
const ly = wy + l.y * wh;
ctx.save();
ctx.translate(lx, ly);
ctx.rotate(l.rot);
ctx.fillStyle = l.c;
ctx.fillRect(-2, -1, 4, 2);
ctx.restore();
}
// soft sun beam
const beam = ctx.createLinearGradient(wx + ww * 0.2, wy, wx + ww * 0.9, wy + wh);
beam.addColorStop(0, 'rgba(255, 230, 160, 0.12)');
beam.addColorStop(1, 'rgba(255, 230, 160, 0)');
ctx.fillStyle = beam;
ctx.fillRect(wx, wy, ww, wh);
ctx.restore();
}
 
// ======= FIREPLACE — fire particles + warm glow =======
const fire = ELEMENTS.fire;
const fx = (fire.x + fire.w / 2) * w;
const fy = (fire.y + fire.h) * h;
const fw = fire.w * w;
 
// spawn fire particles
for (let i = 0; i < 4; i++) {
const colors = ['#ff6b3a', '#ffaa3a', '#ffdd6a', '#ff8c42', '#ff5522'];
fireParticles.push({
x: fx + (Math.random() - 0.5) * fw * 0.85,
y: fy,
vx: (Math.random() - 0.5) * 0.45,
vy: -(Math.random() * 1.8 + 0.9),
life: 0,
maxLife: 32 + Math.random() * 30,
size: Math.random() * 3 + 2,
color: colors[Math.floor(Math.random() * colors.length)],
});
}
// fire glow (breathing)
const breath = 0.85 + Math.sin(time * 3) * 0.15;
const glow = ctx.createRadialGradient(fx, fy, 0, fx, fy, fw * 1.8);
glow.addColorStop(0, `rgba(255, 150, 55, ${0.3 * breath})`);
glow.addColorStop(0.5, `rgba(255, 120, 40, ${0.12 * breath})`);
glow.addColorStop(1, 'rgba(255, 120, 40, 0)');
ctx.fillStyle = glow;
ctx.fillRect(fx - fw * 2, fy - fw * 2, fw * 4, fw * 4);
 
// draw + update fire particles
for (let i = fireParticles.length - 1; i >= 0; i--) {
const p = fireParticles[i];
p.x += p.vx;
p.y += p.vy;
p.vy *= 0.985;
p.life++;
const alpha = 1 - p.life / p.maxLife;
if (alpha <= 0) { fireParticles.splice(i, 1); continue; }
ctx.globalAlpha = alpha * 0.85;
ctx.fillStyle = p.color;
ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
}
ctx.globalAlpha = 1;
 
// ======= CLOCK HANDS =======
const clk = ELEMENTS.clock;
const cx = clk.x * w;
const cy = clk.y * h;
const cr = clk.r * Math.min(w, h);
const now = new Date();
const hourAngle = ((now.getHours() % 12 + now.getMinutes() / 60) / 12) * Math.PI * 2 - Math.PI / 2;
const minuteAngle = ((now.getMinutes() + now.getSeconds() / 60) / 60) * Math.PI * 2 - Math.PI / 2;
const secondAngle = ((now.getSeconds() + now.getMilliseconds() / 1000) / 60) * Math.PI * 2 - Math.PI / 2;
 
// tick marks (very subtle — just accent the 12 major ticks on the existing face)
ctx.strokeStyle = 'rgba(40, 30, 20, 0.55)';
ctx.lineWidth = Math.max(1, cr * 0.05);
for (let i = 0; i < 12; i++) {
const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
ctx.beginPath();
ctx.moveTo(cx + Math.cos(a) * cr * 0.88, cy + Math.sin(a) * cr * 0.88);
ctx.lineTo(cx + Math.cos(a) * cr * 0.98, cy + Math.sin(a) * cr * 0.98);
ctx.stroke();
}
 
// hour hand
ctx.strokeStyle = '#2a1a10';
ctx.lineWidth = Math.max(2.5, cr * 0.13);
ctx.lineCap = 'round';
ctx.beginPath();
ctx.moveTo(cx, cy);
ctx.lineTo(cx + Math.cos(hourAngle) * cr * 0.48, cy + Math.sin(hourAngle) * cr * 0.48);
ctx.stroke();
 
// minute hand
ctx.lineWidth = Math.max(1.8, cr * 0.085);
ctx.beginPath();
ctx.moveTo(cx, cy);
ctx.lineTo(cx + Math.cos(minuteAngle) * cr * 0.68, cy + Math.sin(minuteAngle) * cr * 0.68);
ctx.stroke();
 
// second hand
ctx.strokeStyle = '#a0521d';
ctx.lineWidth = Math.max(1, cr * 0.045);
ctx.beginPath();
ctx.moveTo(cx, cy);
ctx.lineTo(cx + Math.cos(secondAngle) * cr * 0.78, cy + Math.sin(secondAngle) * cr * 0.78);
ctx.stroke();
 
// center dot
ctx.fillStyle = '#2a1a10';
ctx.beginPath();
ctx.arc(cx, cy, Math.max(1.8, cr * 0.06), 0, Math.PI * 2);
ctx.fill();
 
// tick sparkle every second
if (now.getMilliseconds() < 60) {
const secAngle = (now.getSeconds() / 60) * Math.PI * 2 - Math.PI / 2;
const sx = cx + Math.cos(secAngle) * cr * 0.92;
const sy = cy + Math.sin(secAngle) * cr * 0.92;
ctx.fillStyle = 'rgba(255, 230, 180, 0.9)';
ctx.fillRect(sx - 1, sy - 1, 2, 2);
}
 
// ======= BOTTLE SHELF — highlights =======
for (const b of bottleHighlights) {
b.next -= 0.016;
if (b.next <= 0) {
// flash a highlight for ~0.6s starting now; set next in 2–8s
b.next = 2 + Math.random() * 6;
}
// the highlight is on for the first 0.6s of each cycle — figure progress
const cycleDuration = 2.6; // approx
const t = (cycleDuration - b.next) % cycleDuration;
if (t < 0.6) {
const intensity = 1 - t / 0.6;
const bx = b.x * w;
const by = b.y * h;
ctx.fillStyle = `rgba(255, 255, 255, ${intensity * 0.9})`;
ctx.fillRect(bx - 2, by - 3, 2, 6);
ctx.fillStyle = `rgba(255, 255, 255, ${intensity * 0.4})`;
ctx.fillRect(bx - 1, by - 4, 1, 8);
}
}
 
// ======= BAR GLASSES — sparkles + bubbles + subtle glow =======
for (const g of ELEMENTS.glasses) {
const gx = g.x * w;
const gy = g.y * h;
const gr = g.r * Math.min(w, h);
 
// subtle glass glow
const gGlow = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr * 5);
gGlow.addColorStop(0, 'rgba(255, 250, 230, 0.18)');
gGlow.addColorStop(1, 'rgba(255, 250, 230, 0)');
ctx.fillStyle = gGlow;
ctx.fillRect(gx - gr * 5, gy - gr * 5, gr * 10, gr * 10);
 
// sparkle (cross-shaped)
const sparkle = Math.sin(time * 2 + g.x * 100);
if (sparkle > 0.7) {
const a = (sparkle - 0.7) / 0.3;
ctx.fillStyle = `rgba(255, 255, 255, ${a * 0.6})`;
ctx.fillRect(gx - gr * 2, gy - 0.5, gr * 4, 1);
ctx.fillRect(gx - 0.5, gy - gr * 2, 1, gr * 4);
}
 
// occasional bubble
if (Math.random() < 0.03) {
ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
const bSize = Math.random() * 1.5 + 0.8;
ctx.fillRect(gx + (Math.random() - 0.5) * gr * 2, gy - Math.random() * gr * 2, bSize, bSize);
}
}
 
// ======= CUP STEAM =======
const cup = ELEMENTS.cup;
const cupCx = (cup.x + cup.w / 2) * w;
const cupTop = cup.y * h;
// spawn new steam particle
if (Math.random() < 0.5) {
cupSteams.push({
x: cupCx + (Math.random() - 0.5) * cup.w * w * 0.5,
y: cupTop,
life: 0,
maxLife: 70 + Math.random() * 30,
size: Math.random() * 3 + 2,
});
}
for (let i = cupSteams.length - 1; i >= 0; i--) {
const s = cupSteams[i];
s.life++;
s.y -= 0.6;
s.x += Math.sin(s.life * 0.1) * 0.3;
s.size *= 1.01;
const alpha = 1 - s.life / s.maxLife;
if (alpha <= 0) { cupSteams.splice(i, 1); continue; }
ctx.fillStyle = `rgba(230, 230, 230, ${alpha * 0.25})`;
ctx.beginPath();
ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
ctx.fill();
}
 
// ======= PERSON — subtle hair sway particles + blinking eyes =======
const p = ELEMENTS.person;
// particles along the hair edges
if (Math.random() < 0.3) {
ambientParticles.push({
x: p.x + Math.random() * p.w,
y: p.y + Math.random() * p.h * 0.2,
vx: (Math.random() - 0.5) * 0.0003,
vy: -(Math.random() * 0.00015 + 0.00005),
size: 1,
opacity: 0.35,
hue: 15 + Math.random() * 10, // dark hair-ish
});
}
 
// ======= AMBIENT WARM FLOATING PARTICLES =======
for (const ap of ambientParticles) {
ap.x += ap.vx;
ap.y += ap.vy;
if (ap.y < -0.05) { ap.y = 1.05; ap.x = Math.random(); }
if (ap.x < -0.05) ap.x = 1.05;
if (ap.x > 1.05) ap.x = -0.05;
const twinkle = 0.7 + Math.sin(time * 2 + ap.x * 100) * 0.3;
const px2 = ap.x * w;
const py2 = ap.y * h;
// core
ctx.fillStyle = `hsla(${ap.hue}, 85%, 62%, ${ap.opacity * twinkle})`;
ctx.beginPath();
ctx.arc(px2, py2, ap.size, 0, Math.PI * 2);
ctx.fill();
// halo
ctx.fillStyle = `hsla(${ap.hue}, 85%, 62%, ${ap.opacity * twinkle * 0.18})`;
ctx.beginPath();
ctx.arc(px2, py2, ap.size * 3, 0, Math.PI * 2);
ctx.fill();
}
 
// ======= LIGHT CAMERA SHAKE =======
// (we don't actually shift the canvas — we'd need to drawImage for that —
//  instead apply a super subtle global translation tint to particle draws
//  next time.  Skipping for now to keep the overlay clean.)
 
// ======= VIGNETTE + warm overlay =======
const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
vg.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
ctx.fillStyle = vg;
ctx.fillRect(0, 0, w, h);
 
// overall warm tint (very subtle)
ctx.fillStyle = 'rgba(255, 180, 100, 0.035)';
ctx.fillRect(0, 0, w, h);
 
raf = requestAnimationFrame(animate);
};
animate();
 
return () => {
cancelAnimationFrame(raf);
window.removeEventListener('resize', resize);
};
}, []);
 
return (
<canvas
ref={canvasRef}
className="pointer-events-none fixed inset-0 z-0 h-full w-full"
aria-hidden="true"
/>
);
}
