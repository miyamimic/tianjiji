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
// Semantic & Geometric Vision Analysis for AI Guessing & Hinting
// -------------------------------------------------------------
function getColorNameZh(hex?: string): string {
  if (!hex) return '墨黑';
  const h = hex.toLowerCase();
  if (h.includes('f43f5e') || h.includes('ef4444') || h.includes('dc2626') || h.includes('red') || h.includes('e11d48')) return '鲜红色';
  if (h.includes('f97316') || h.includes('orange') || h.includes('ea580c')) return '活力橙色';
  if (h.includes('eab308') || h.includes('facc15') || h.includes('yellow') || h.includes('ca8a04')) return '明黄色';
  if (h.includes('22c55e') || h.includes('16a34a') || h.includes('green') || h.includes('10b981')) return '翠绿色';
  if (h.includes('06b6d4') || h.includes('cyan') || h.includes('0ea5e9')) return '青天蓝';
  if (h.includes('3b82f6') || h.includes('2563eb') || h.includes('blue')) return '蔚蓝色';
  if (h.includes('8b5cf6') || h.includes('a855f7') || h.includes('purple')) return '梦幻紫色';
  if (h.includes('ec4899') || h.includes('f472b6') || h.includes('pink')) return '粉樱色';
  if (h.includes('78350f') || h.includes('92400e') || h.includes('854d0e') || h.includes('amber')) return '棕褐色';
  if (h.includes('ffffff') || h.includes('f8fafc')) return '纯白色';
  return '墨黑炭灰色';
}

export function generateStrokeSemanticSummary(
  strokes: Array<{ points: [number, number][]; color?: string; size?: number }>
): string {
  if (!strokes || strokes.length === 0) {
    return '画板目前空无一物，尚无笔迹。';
  }

  const totalStrokes = strokes.length;
  let minX = 99999, maxX = -99999, minY = 99999, maxY = -99999;
  let totalLength = 0;
  const colorsUsed = new Set<string>();

  interface StrokeMeta {
    points: [number, number][];
    color: string;
    isLoop: boolean;
    aspect: number;
    cx: number;
    cy: number;
    w: number;
    h: number;
    len: number;
  }

  const strokeMetas: StrokeMeta[] = [];

  strokes.forEach((s) => {
    if (!s.points || s.points.length < 2) return;
    const colorZh = getColorNameZh(s.color);
    colorsUsed.add(colorZh);

    let sMinX = 99999, sMaxX = -99999, sMinY = 99999, sMaxY = -99999;
    let sLen = 0;

    for (let i = 0; i < s.points.length; i++) {
      const [x, y] = s.points[i];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      if (x < sMinX) sMinX = x;
      if (x > sMaxX) sMaxX = x;
      if (y < sMinY) sMinY = y;
      if (y > sMaxY) sMaxY = y;

      if (i > 0) {
        const seg = Math.hypot(s.points[i][0] - s.points[i - 1][0], s.points[i][1] - s.points[i - 1][1]);
        sLen += seg;
        totalLength += seg;
      }
    }

    const sw = Math.max(1, sMaxX - sMinX);
    const sh = Math.max(1, sMaxY - sMinY);
    const diag = Math.hypot(sw, sh);
    const startPt = s.points[0];
    const endPt = s.points[s.points.length - 1];
    const endDist = Math.hypot(endPt[0] - startPt[0], endPt[1] - startPt[1]);
    const isLoop = s.points.length >= 6 && endDist < diag * 0.28;

    strokeMetas.push({
      points: s.points,
      color: colorZh,
      isLoop,
      aspect: sw / sh,
      cx: (sMinX + sMaxX) / 2,
      cy: (sMinY + sMaxY) / 2,
      w: sw,
      h: sh,
      len: sLen,
    });
  });

  const totalWidth = Math.max(1, maxX - minX);
  const totalHeight = Math.max(1, maxY - minY);
  const globalAspect = totalWidth / totalHeight;

  // Spatial features decomposition
  const topCutoff = minY + totalHeight * 0.35;
  const bottomCutoff = minY + totalHeight * 0.65;

  const topStrokes = strokeMetas.filter((s) => s.cy < topCutoff);
  const midStrokes = strokeMetas.filter((s) => s.cy >= topCutoff && s.cy <= bottomCutoff);
  const bottomStrokes = strokeMetas.filter((s) => s.cy > bottomCutoff);
  const closedLoops = strokeMetas.filter((s) => s.isLoop);

  const features: string[] = [];

  // Overall shape
  if (globalAspect > 1.8) {
    features.push('整体呈横向扁平宽长延展布局');
  } else if (globalAspect < 0.55) {
    features.push('整体呈纵向修长高挑站立布局');
  } else {
    features.push('整体比例匀称，呈居中饱满轮廓');
  }

  // Loops & Bodies
  if (closedLoops.length > 0) {
    features.push(`包含 ${closedLoops.length} 个闭合环形/圈形主体轮廓`);
  }

  // Top region
  if (topStrokes.length > 0) {
    const hasSmallTop = topStrokes.some((s) => s.w < totalWidth * 0.4 && s.h < totalHeight * 0.4);
    if (hasSmallTop) {
      features.push('顶部有突出的精致小构件（类似耳朵/角/花瓣/叶柄/帽子）');
    }
  }

  // Bottom region
  if (bottomStrokes.length > 0) {
    const hasHorizontalBase = bottomStrokes.some((s) => s.aspect > 2.0);
    const hasVerticalLegs = bottomStrokes.some((s) => s.aspect < 0.5);
    if (hasHorizontalBase) {
      features.push('底部有横向平稳托底/地平线/底座');
    } else if (hasVerticalLegs) {
      features.push('底部有支撑立柱/支腿/轮轴特征');
    }
  }

  const colorsList = Array.from(colorsUsed).join('、') || '黑色';

  return `【画作视觉几何解析报告】
- 笔迹规模：共 ${totalStrokes} 笔，总笔长约 ${Math.round(totalLength)} 像素。
- 用色构成：使用了 ${colorsList}。
- 构图特征：${features.join('；')}。
- 笔触密度：${totalStrokes <= 3 ? '简炼素描骨架' : totalStrokes <= 7 ? '结构分明且细节初具' : '笔法丰富细腻、层次饱满'}。`;
}
