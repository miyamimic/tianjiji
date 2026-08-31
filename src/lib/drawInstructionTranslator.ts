/**
 * drawInstructionTranslator.ts
 *
 * Translates LLM stroke instructions (0-100 relative coordinate system)
 * into Canvas 2D renderable pixel strokes with Catmull-Rom spline interpolation,
 * character brush parameters, and organic jitter.
 */

import { getStrokeOutline, type CharacterBrushParams, type StrokeData } from './perfectFreehandHelper';

export type StrokePrimitiveType = 'curve' | 'circle' | 'line' | 'ellipse' | 'rect';

export interface LlmStrokeInstruction {
  type: StrokePrimitiveType;
  points?: [number, number][];      // 0-100 relative coordinates for 'curve'
  center?: [number, number];        // 0-100 relative coordinates for 'circle' / 'ellipse'
  radius?: number;                  // 0-100 relative radius for 'circle'
  rx?: number;                      // 0-100 relative radius x for 'ellipse'
  ry?: number;                      // 0-100 relative radius y for 'ellipse'
  from?: [number, number];          // 0-100 relative start for 'line'
  to?: [number, number];            // 0-100 relative end for 'line'
  x?: number;                       // 0-100 relative top-left x for 'rect'
  y?: number;                       // 0-100 relative top-left y for 'rect'
  w?: number;                       // 0-100 relative width for 'rect'
  h?: number;                       // 0-100 relative height for 'rect'
  color?: string;                   // hex color, e.g. '#475569'
  thickness?: number;               // scale multiplier for brush size (default 1.0)
  filled?: boolean;
}

export interface LlmDrawingRoundOutput {
  strokes: LlmStrokeInstruction[];
  speech: string;                   // Dialogue line from character
  drawing_quips?: string[];         // Short quips during drawing animation (e.g. "笔锋至此。")
  gameTotalDelta?: Record<string, number>;
}

// -------------------------------------------------------------
// Coordinate Clamping & Validation (5 to 95 range to avoid edges)
// -------------------------------------------------------------
export function clampCoord(val: number, min = 5, max = 95): number {
  if (typeof val !== 'number' || isNaN(val)) return 50;
  return Math.max(min, Math.min(max, val));
}

export function clampPoint(pt: [number, number] | number[]): [number, number] {
  if (!Array.isArray(pt) || pt.length < 2) return [50, 50];
  return [clampCoord(pt[0]), clampCoord(pt[1])];
}

// -------------------------------------------------------------
// Catmull-Rom Spline Interpolation for smooth organic curves
// -------------------------------------------------------------
export function catmullRomInterpolate(
  points: [number, number][],
  segmentsPerSpan = 8
): [number, number][] {
  if (points.length <= 2) return points;

  const result: [number, number][] = [];
  const pts = [points[0], ...points, points[points.length - 1]];

  for (let i = 1; i < pts.length - 2; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2];

    for (let s = 0; s < segmentsPerSpan; s++) {
      const t = s / segmentsPerSpan;
      const t2 = t * t;
      const t3 = t2 * t;

      const x =
        0.5 *
        (2 * p1[0] +
          (-p0[0] + p2[0]) * t +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);

      const y =
        0.5 *
        (2 * p1[1] +
          (-p0[1] + p2[1]) * t +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);

      result.push([x, y]);
    }
  }

  result.push(points[points.length - 1]);
  return result;
}

// -------------------------------------------------------------
// Primitive to Sampled Pixel Points Translator
// Converts relative 0-100 coords to actual canvas pixels (width x height)
// -------------------------------------------------------------
export function translateInstructionToPixelPoints(
  instr: LlmStrokeInstruction,
  canvasWidth: number,
  canvasHeight: number
): { points: [number, number][]; color: string; sizeMultiplier: number; isFilled: boolean } | null {
  const color = instr.color || '#334155';
  const sizeMultiplier = typeof instr.thickness === 'number' && instr.thickness > 0 ? instr.thickness : 1.0;
  const isFilled = !!instr.filled;

  const toPxX = (rx: number) => (clampCoord(rx) / 100) * canvasWidth;
  const toPxY = (ry: number) => (clampCoord(ry) / 100) * canvasHeight;

  if (instr.type === 'curve') {
    if (!instr.points || instr.points.length < 2) return null;
    const rawPxPoints: [number, number][] = instr.points.map((p) => [toPxX(p[0]), toPxY(p[1])]);
    const interpolated = catmullRomInterpolate(rawPxPoints, 6);
    return { points: interpolated, color, sizeMultiplier, isFilled: false };
  }

  if (instr.type === 'circle') {
    const center = instr.center || [50, 50];
    const cx = toPxX(center[0]);
    const cy = toPxY(center[1]);
    const rPx = Math.max(4, ((instr.radius || 10) / 100) * Math.min(canvasWidth, canvasHeight));
    
    // Sample circle circumference
    const steps = Math.max(16, Math.floor(rPx * 1.5));
    const points: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      points.push([cx + Math.cos(angle) * rPx, cy + Math.sin(angle) * rPx]);
    }
    return { points, color, sizeMultiplier, isFilled };
  }

  if (instr.type === 'line') {
    const from = instr.from || [50, 50];
    const to = instr.to || [60, 60];
    const p1: [number, number] = [toPxX(from[0]), toPxY(from[1])];
    const p2: [number, number] = [toPxX(to[0]), toPxY(to[1])];
    
    // Sample intermediate points along line for smooth brush taper
    const dist = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const steps = Math.max(4, Math.floor(dist / 10));
    const points: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      points.push([p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t]);
    }
    return { points, color, sizeMultiplier, isFilled: false };
  }

  if (instr.type === 'ellipse') {
    const center = instr.center || [50, 50];
    const cx = toPxX(center[0]);
    const cy = toPxY(center[1]);
    const rxPx = Math.max(4, ((instr.rx || 12) / 100) * canvasWidth);
    const ryPx = Math.max(4, ((instr.ry || 8) / 100) * canvasHeight);

    const steps = Math.max(20, Math.floor(Math.max(rxPx, ryPx) * 1.5));
    const points: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      points.push([cx + Math.cos(angle) * rxPx, cy + Math.sin(angle) * ryPx]);
    }
    return { points, color, sizeMultiplier, isFilled };
  }

  if (instr.type === 'rect') {
    const x = toPxX(instr.x ?? 40);
    const y = toPxY(instr.y ?? 40);
    const w = ((instr.w ?? 20) / 100) * canvasWidth;
    const h = ((instr.h ?? 20) / 100) * canvasHeight;

    const corners: [number, number][] = [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
      [x, y],
    ];
    return { points: corners, color, sizeMultiplier, isFilled };
  }

  return null;
}

// -------------------------------------------------------------
// Semantic descriptor of drawn strokes for AI Guessing & Hinting
// -------------------------------------------------------------
export function generateStrokeSemanticSummary(
  strokes: Array<{ points: [number, number][]; color?: string; size?: number }>
): string {
  if (!strokes || strokes.length === 0) {
    return '画板目前空无一物，尚无笔迹。';
  }

  const total = strokes.length;
  let minX = 9999, maxX = -9999, minY = 9999, maxY = -9999;
  let totalLength = 0;

  strokes.forEach((s) => {
    s.points.forEach(([x, y]) => {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });
    for (let i = 1; i < s.points.length; i++) {
      totalLength += Math.hypot(s.points[i][0] - s.points[i - 1][0], s.points[i][1] - s.points[i - 1][1]);
    }
  });

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  let region = '中心区域';
  if (centerX < 180) region = '画面左侧';
  else if (centerX > 340) region = '画面右侧';
  else if (centerY < 140) region = '画面上方';
  else if (centerY > 240) region = '画面下方';

  const shapeType = width / height > 1.6 ? '横向延展结构' : height / width > 1.6 ? '纵向立柱结构' : '紧凑圆润/方形轮廓';

  return `画布共绘制了 ${total} 笔，主要分布在${region}，呈现${shapeType}，线条起伏丰富，笔势连贯。`;
}
