import type { EmotionVector } from '../data/types';
import { EMOTION_KEYS, EMOTION_NAMES } from '../data/types';

export function clamp(value: number, lo = 0.0, hi = 1.0): number {
  return Math.max(lo, Math.min(hi, value));
}

export function addEmotion(
  base: EmotionVector,
  delta: Partial<EmotionVector>,
): EmotionVector {
  const result = { ...base };
  for (const k of EMOTION_KEYS) {
    const d = delta[k];
    if (d !== undefined && d !== null) {
      result[k] = clamp(result[k] + d);
    }
  }
  return result;
}

export function scaleEmotion(
  delta: Partial<EmotionVector>,
  scale: number,
): Partial<EmotionVector> {
  const result: Partial<EmotionVector> = {};
  for (const k of EMOTION_KEYS) {
    const v = delta[k];
    if (v !== undefined && v !== null) {
      result[k] = v * scale;
    }
  }
  return result;
}

/**
 * 情绪强度校准系数 (1-5 级)
 * 1 级: 极微弱波澜 (0.25)
 * 2 级: 轻度触动 (0.60)
 * 3 级: 适中标准 (1.00)
 * 4 级: 强烈冲击 (1.45)
 * 5 级: 剧烈破防/极端 (1.90)
 */
export const INTENSITY_FACTORS: Record<number, number> = {
  1: 0.25,
  2: 0.60,
  3: 1.00,
  4: 1.45,
  5: 1.90,
};

export function applyIntensityCalibration(
  delta: Partial<EmotionVector>,
  intensity?: number,
): Partial<EmotionVector> {
  const safeIntensity = Math.max(1, Math.min(5, Math.round(intensity || 3)));
  const factor = INTENSITY_FACTORS[safeIntensity] ?? 1.0;
  return scaleEmotion(delta, factor);
}

/**
 * 多轮情绪追踪与情绪惯性衰减/交叉敏感机制：
 * 1. 连续递增麻木 (Emotional Numbing): 若某情绪（如悲伤/愤怒）连续 3+ 轮递增，第 4 轮增量衰减 (0.45~0.60)
 * 2. 脆弱防线降低 (Sensitization to Warmth/Joy): 在深度悲伤/疲惫或连环受创时，温情/喜悦的触动力度被放大 (1.4~1.7倍)，更容易被细微善意打动
 */
export function processMultiTurnInertia(
  current: EmotionVector,
  rawDelta: Partial<EmotionVector>,
  history: EmotionVector[],
): {
  finalDelta: Partial<EmotionVector>;
  numbedKeys: string[];
  sensitizedKeys: string[];
} {
  const finalDelta: Partial<EmotionVector> = { ...rawDelta };
  const numbedKeys: string[] = [];
  const sensitizedKeys: string[] = [];

  if (!history || history.length < 2) {
    return { finalDelta, numbedKeys, sensitizedKeys };
  }

  // 1. Check continuous increase streaks in history (up to last 4 turns)
  const recent = history.slice(-4);
  for (const k of EMOTION_KEYS) {
    const deltaVal = finalDelta[k];
    if (deltaVal !== undefined && deltaVal > 0) {
      let consecutiveIncreases = 0;
      for (let i = 0; i < recent.length - 1; i++) {
        if (recent[i + 1][k] >= recent[i][k] - 0.02) {
          consecutiveIncreases++;
        }
      }

      // If already high (>=0.6) or 3+ consecutive rounds increasing, apply emotional numbing
      if (consecutiveIncreases >= 2 && current[k] > 0.5) {
        const numbingMultiplier = Math.max(0.4, 1.0 - (consecutiveIncreases - 1) * 0.25);
        finalDelta[k] = deltaVal * numbingMultiplier;
        numbedKeys.push(k);
      }
    }
  }

  // 2. Cross-emotion sensitivity: If sadness is high (>0.55) or fear is high (>0.55),
  // positive warmth / joy signals have lower defense threshold and heightened impact
  const isVulnerable = current.sadness > 0.5 || current.fear > 0.5;
  if (isVulnerable) {
    if (finalDelta.warmth !== undefined && finalDelta.warmth > 0) {
      finalDelta.warmth = finalDelta.warmth * 1.55;
      // Simultaneously accelerates negative emotion relief
      if (finalDelta.sadness === undefined) {
        finalDelta.sadness = -0.12;
      } else if (finalDelta.sadness > 0) {
        finalDelta.sadness = finalDelta.sadness * 0.4;
      }
      sensitizedKeys.push('warmth');
    }

    if (finalDelta.joy !== undefined && finalDelta.joy > 0) {
      finalDelta.joy = finalDelta.joy * 1.45;
      sensitizedKeys.push('joy');
    }
  }

  return { finalDelta, numbedKeys, sensitizedKeys };
}

export function updateEmotionWithInertia(
  current: EmotionVector,
  baseline: EmotionVector,
  inertia: EmotionVector,
  triggerDelta: Partial<EmotionVector>,
): EmotionVector {
  const result = { ...current };
  for (const k of EMOTION_KEYS) {
    const d = triggerDelta[k] ?? 0;
    const target = clamp(baseline[k] + d);
    result[k] = clamp(current[k] * inertia[k] + target * (1 - inertia[k]));
  }
  return result;
}

/**
 * Natural Emotional Calming / Decay Curve:
 * Relaxes elevated negative arousal (anger, fear, sadness) and extreme spikes back toward baseline per turn
 */
export function decayEmotionTowardsBaseline(
  current: EmotionVector,
  baseline: EmotionVector,
  decayRate = 0.12,
): EmotionVector {
  const result = { ...current };
  const rate = Math.max(0, Math.min(0.5, decayRate));
  for (const k of EMOTION_KEYS) {
    const diff = baseline[k] - current[k];
    // Apply smooth exponential relaxation towards resting baseline
    result[k] = clamp(current[k] + diff * rate);
  }
  return result;
}

export function dominantEmotions(
  emotion: EmotionVector,
  count = 2,
): [string, number][] {
  const items = EMOTION_KEYS.map((k) => [k, emotion[k]] as [string, number]);
  items.sort((a, b) => b[1] - a[1]);
  return items.slice(0, count).filter(([, v]) => v > 0.2);
}

export function describeEmotion(emotion: EmotionVector): string {
  const dom = dominantEmotions(emotion, 2);
  const parts: string[] = [];
  for (const [k, v] of dom) {
    const name = EMOTION_NAMES[k as keyof EmotionVector];
    let level: string;
    if (v >= 0.8) level = '非常强烈的';
    else if (v >= 0.6) level = '明显的';
    else if (v >= 0.4) level = '一些';
    else level = '淡淡的';
    parts.push(`${level}${name}`);
  }

  if (parts.length === 0) {
    return '你现在心情很平静，几乎没有明显的情绪波动。';
  }
  if (parts.length === 1) {
    return `你现在感受到${parts[0]}。`;
  }

  if (emotion.desire > 0.5 && emotion.warmth > 0.5) {
    return '你现在心里又暖又痒，欲望和温情交织在一起，有点说不清的感觉。';
  }
  if (emotion.anger > 0.5 && emotion.desire > 0.5) {
    return '你现在有点烦躁，但欲望也在升腾，两种情绪搅在一起让你更想做点什么。';
  }
  if (emotion.joy > 0.5 && emotion.warmth > 0.5) {
    return '你现在心里软乎乎的，带着笑意，整个人都放松下来了。';
  }

  return `你现在主要感受到${parts.join('和')}。`;
}
