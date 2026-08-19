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
