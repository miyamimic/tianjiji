/**
 * perfectFreehandHelper.ts
 *
 * Integrates Steve Ruiz's perfect-freehand algorithm with Canvas 2D polygon rendering.
 * Provides fallback implementation in case CDN is unreachable, and adds custom character brush
 * parameters (thinning, smoothing, jitter, taperStart, taperEnd).
 */

export interface CharacterBrushParams {
  thinning: number;   // 粗细波动 (-1 to 1)
  smoothing: number;  // 轨迹平滑 (0 to 1)
  jitter: number;     // 手绘抖动 (0 to 1)
  taperStart: number; // 起笔尖锋 (pixels or ratio)
  taperEnd: number;   // 收笔尖锋 (pixels or ratio)
  size?: number;      // 基础笔触大小 (默认 10)
}

export interface StrokeData {
  points: [number, number][]; // 实际像素坐标序列
  color: string;              // hex 颜色值
  duration: number;           // 该笔画绘制耗时 ms (回放控制)
  size?: number;
}

// -------------------------------------------------------------
// Core Perfect-Freehand Algorithm (Self-contained implementation)
// Matches https://github.com/steveruizok/perfect-freehand
// -------------------------------------------------------------

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

function hypot(x: number, y: number) {
  return Math.hypot(x, y);
}

function sub(a: [number, number], b: [number, number]): [number, number] {
  return [a[0] - b[0], a[1] - b[1]];
}

function add(a: [number, number], b: [number, number]): [number, number] {
  return [a[0] + b[0], a[1] + b[1]];
}

function mul(a: [number, number], n: number): [number, number] {
  return [a[0] * n, a[1] * n];
}

function div(a: [number, number], n: number): [number, number] {
  return [a[0] / n, a[1] / n];
}

function per(a: [number, number]): [number, number] {
  return [a[1], -a[0]];
}

function dot(a: [number, number], b: [number, number]): number {
  return a[0] * b[0] + a[1] * b[1];
}

function uni(a: [number, number]): [number, number] {
  const d = hypot(a[0], a[1]);
  return d === 0 ? [0, 0] : div(a, d);
}

function lr(a: [number, number], b: [number, number], t: number): [number, number] {
  return add(a, mul(sub(b, a), t));
}

function rot(point: [number, number], center: [number, number], angle: number): [number, number] {
  const s = Math.sin(angle);
  const c = Math.cos(angle);
  const px = point[0] - center[0];
  const py = point[1] - center[1];
  return [px * c - py * s + center[0], px * s + py * c + center[1]];
}

interface StrokePointInternal {
  point: [number, number];
  pressure: number;
  distance: number;
  vector: [number, number];
  runningLength: number;
}

function getStrokePointsInternal(
  rawPoints: (number[] | { x: number; y: number; pressure?: number })[],
  options: { size?: number; smoothing?: number; streamline?: number; jitter?: number } = {}
): StrokePointInternal[] {
  if (rawPoints.length === 0) return [];
  const size = options.size ?? 12;
  const streamline = options.streamline ?? 0.5;
  const smoothing = options.smoothing ?? 0.5;
  const jitter = options.jitter ?? 0;

  // Convert points to [x, y, pressure]
  const pts: [number, number, number][] = rawPoints.map((p) => {
    let x: number, y: number, pr: number;
    if (Array.isArray(p)) {
      x = p[0];
      y = p[1];
      pr = p[2] !== undefined ? p[2] : 0.5;
    } else {
      x = p.x;
      y = p.y;
      pr = p.pressure !== undefined ? p.pressure : 0.5;
    }
    // Apply organic jitter if configured
    if (jitter > 0) {
      const jMag = jitter * (size * 0.4);
      x += (Math.random() - 0.5) * jMag;
      y += (Math.random() - 0.5) * jMag;
    }
    return [x, y, pr];
  });

  if (pts.length === 1) {
    pts.push([pts[0][0] + 1, pts[0][1] + 1, pts[0][2]]);
  }

  const tRate = 0.15 + (1 - streamline) * 0.85;
  const strokePoints: StrokePointInternal[] = [];
  let prev = {
    point: [pts[0][0], pts[0][1]] as [number, number],
    pressure: pts[0][2] >= 0 ? pts[0][2] : 0.5,
    vector: [1, 1] as [number, number],
    distance: 0,
    runningLength: 0,
  };
  strokePoints.push(prev);

  let totalDist = 0;
  for (let i = 1; i < pts.length; i++) {
    const cur = pts[i];
    const pt = lr(prev.point, [cur[0], cur[1]], tRate);
    const dist = hypot(pt[0] - prev.point[0], pt[1] - prev.point[1]);
    totalDist += dist;
    const vec = uni(sub(pt, prev.point));
    const sp: StrokePointInternal = {
      point: pt,
      pressure: cur[2] >= 0 ? cur[2] : 0.5,
      vector: vec,
      distance: dist,
      runningLength: totalDist,
    };
    strokePoints.push(sp);
    prev = sp;
  }

  return strokePoints;
}

function getStrokeOutlineInternal(
  pts: StrokePointInternal[],
  options: {
    size?: number;
    thinning?: number;
    smoothing?: number;
    taperStart?: number;
    taperEnd?: number;
  } = {}
): [number, number][] {
  if (pts.length === 0) return [];
  const size = options.size ?? 12;
  const thinning = options.thinning ?? 0.5;
  const taperStart = options.taperStart ?? 0;
  const taperEnd = options.taperEnd ?? 0;

  const totalLength = pts[pts.length - 1].runningLength;
  const leftPts: [number, number][] = [];
  const rightPts: [number, number][] = [];

  for (let i = 0; i < pts.length; i++) {
    const curr = pts[i];
    const sLen = curr.runningLength;
    let radius = size / 2;

    // Apply thinning based on pressure
    if (thinning) {
      radius = (size * (0.5 - curr.pressure * (0.5 - thinning))) / 2;
    }

    // Apply start taper
    if (taperStart > 0 && sLen < taperStart) {
      const taperProgress = Math.max(0.01, sLen / taperStart);
      radius *= taperProgress * (2 - taperProgress); // ease-out
    }

    // Apply end taper
    if (taperEnd > 0 && totalLength - sLen < taperEnd) {
      const endDist = totalLength - sLen;
      const taperProgress = Math.max(0.01, endDist / taperEnd);
      radius *= taperProgress * (2 - taperProgress);
    }

    radius = Math.max(0.8, radius);

    const normal = per(curr.vector);
    const offset = mul(normal, radius);

    leftPts.push(sub(curr.point, offset));
    rightPts.push(add(curr.point, offset));
  }

  // Round caps at start and end
  const startCap: [number, number][] = [];
  const p0 = pts[0].point;
  const r0 = size / 2;
  for (let step = 1; step < 8; step++) {
    const angle = (Math.PI * step) / 8;
    startCap.push(rot(leftPts[0], p0, angle));
  }

  const endCap: [number, number][] = [];
  const pLast = pts[pts.length - 1].point;
  for (let step = 1; step < 8; step++) {
    const angle = (Math.PI * step) / 8;
    endCap.push(rot(rightPts[rightPts.length - 1], pLast, angle));
  }

  return [...leftPts, ...endCap, ...rightPts.reverse(), ...startCap];
}

/**
 * Main function to compute stroke outline polygon
 * Prefers window.perfectFreehand if loaded via CDN, otherwise seamlessly uses built-in pure math.
 */
export function getStrokeOutline(
  rawPoints: [number, number][],
  params: CharacterBrushParams
): [number, number][] {
  if (!rawPoints || rawPoints.length === 0) return [];
  const size = params.size ?? 10;
  const thinning = params.thinning ?? 0.5;
  const smoothing = params.smoothing ?? 0.5;
  const jitter = params.jitter ?? 0;
  const taperStart = params.taperStart ?? 0;
  const taperEnd = params.taperEnd ?? 0;

  // Apply jitter directly to coordinates before stroke calculation
  const pointsWithJitter: [number, number][] = rawPoints.map(([x, y]) => {
    if (jitter <= 0) return [x, y];
    const offset = (Math.random() - 0.5) * jitter * (size * 0.4);
    return [x + offset, y + offset];
  });

  // Try global perfectFreehand if available
  const win = typeof window !== 'undefined' ? (window as any) : null;
  if (win && win.perfectFreehand && typeof win.perfectFreehand.getStroke === 'function') {
    try {
      const outline = win.perfectFreehand.getStroke(pointsWithJitter, {
        size,
        thinning,
        smoothing,
        streamline: smoothing,
        start: { taper: taperStart, cap: true },
        end: { taper: taperEnd, cap: true },
        simulatePressure: true,
      });
      if (outline && outline.length > 0) {
        return outline as [number, number][];
      }
    } catch {
      // fallback to internal
    }
  }

  // Fallback to internal pure math implementation
  const strokePoints = getStrokePointsInternal(pointsWithJitter, {
    size,
    smoothing,
    streamline: smoothing,
    jitter: 0, // already applied
  });
  return getStrokeOutlineInternal(strokePoints, {
    size,
    thinning,
    smoothing,
    taperStart,
    taperEnd,
  });
}

/**
 * Render outline points as a closed filled smooth path on Canvas 2D
 */
export function renderStrokeToCanvas(
  ctx: CanvasRenderingContext2D,
  outline: [number, number][],
  color: string,
  isEraser: boolean = false
) {
  if (!outline || outline.length === 0) return;

  ctx.save();
  if (isEraser) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = color;
  }

  ctx.beginPath();
  const len = outline.length;
  if (len < 3) {
    ctx.arc(outline[0][0], outline[0][1], 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // Draw smooth quadratic spline through outline points
  ctx.moveTo(outline[0][0], outline[0][1]);
  for (let i = 0; i < len; i++) {
    const p0 = outline[i];
    const p1 = outline[(i + 1) % len];
    const midX = (p0[0] + p1[0]) / 2;
    const midY = (p0[1] + p1[1]) / 2;
    ctx.quadraticCurveTo(p0[0], p0[1], midX, midY);
  }

  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// -------------------------------------------------------------
// Interactive Web Audio Sound Effects (Synthesized on the fly)
// -------------------------------------------------------------
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playSound(type: 'draw' | 'correct' | 'wrong' | 'complete' | 'click') {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (type === 'click') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'draw') {
      // Soft brush whoosh
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.08);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'correct') {
      // Joyful 3-tone arpeggio (C5 -> E5 -> G5)
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.09;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.12, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.3);
      });
    } else if (type === 'wrong') {
      // Cute gentle double bump
      const freqs = [260, 210];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.12;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.1, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.18);
      });
    } else if (type === 'complete') {
      // Sparkling completion chime
      const freqs = [587.33, 880.0, 1174.66];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.12;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.14, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.4);
      });
    }
  } catch {
    // Audio context may be restricted by browser policy
  }
}
