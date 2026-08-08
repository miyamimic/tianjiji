import type { IntentAnalysis, EmotionVector } from '../data/types';
import { EMOTION_KEYS } from '../data/types';

// ────────────────────────────────────────────────────────────
//  Emotion logic — from the CHARACTER's perspective.
//  emotion_delta is NEVER a mirror of the user's emotion.
//  It is "how the character's inner state changes when facing this input."
// ────────────────────────────────────────────────────────────

type Signal = {
  id: string;
  label: string;
  // Returns 0–1 confidence this signal is present in the input
  match: (text: string, ctx: MatchContext) => number;
  // Character's internal emotion shift
  delta: Partial<EmotionVector>;
  notes: string;
};

type MatchContext = {
  hasProfanity: boolean;
  hasFlirtation: boolean;
  hasSelfHarm: boolean;
  hasLeaving: boolean;
  hasApology: boolean;
  hasAffection: boolean;
  hasWeakness: boolean;
  hasColdness: boolean;
  hasRational: boolean;
  hasProvocation: boolean;
  hasRejection: boolean;
  hasComplaining: boolean;
};

// ── Signal detectors ──

const PROFANITY_WORDS = ['操', '他妈', '草', '靠', '日', '卧槽', '我去', '妈的', 'shit', 'fuck', 'damn'];
const FLIRTATION_WORDS = ['胸肌', '肩膀', '腰', '耳朵', '后颈', '靠近', '贴', '亲', '吻', '抱', '摸', '腿', '嘴唇', '喘', '暧昧', '挑逗', '勾引', '性感', '好看', '心动', '心跳', '脸红', '害羞'];
const SELFHARM_WORDS = ['想死', '不想活', '自残', '割腕', '跳楼', '结束自己', '活不下去', '没意义', '消失算了', '解脱'];
const LEAVING_WORDS = ['走了', '离开', '分手', '结束', '再见', '拜拜', '不联系', '拉黑', '删了', '走了算了', '散了', '不要你了'];
const APOLOGY_WORDS = ['对不起', '抱歉', '我错了', '道歉', '是我的错', '怪我', '不该', '不好意思', '原谅'];
const AFFECTION_WORDS = ['想你', '想见你', '爱你', '喜欢你', '在乎你', '舍不得', '等你', '乖', '宝宝', '宝贝', '离不开', '需要你', '在意你'];
const WEAKNESS_WORDS = ['疼', '痛', '难受', '委屈', '哭', '累', '撑不住', '害怕', '怕', '紧张', '无助', '孤单', '冷', '受伤', '生病', '不舒服', '难过', '崩溃', 'emo', '破防'];
const COLDNESS_WORDS = ['随便', '无所谓', '别碰我', '别管我', '不用了', '随便你', '你走吧', '别烦我', '滚开', '不用管', '不想说', '别问了', '沉默', '冷战', '不回', '已读不回'];
const RATIONAL_WORDS = ['为什么', '原因', '分析', '逻辑', '道理', '因为', '所以', '既然', '不过', '但是从', '客观', '理性', '事实', '实际上', '本质上'];
const PROVOCATION_WORDS = ['你凭什么', '你管得着', '你算什么', '关你屁事', '关你什么事', '你有什么资格', '你算老几', '少管我', '你以为你是谁', '你算个屁', '你算什么东西', '你配吗'];
const REJECTION_WORDS = ['不行', '不要', '不能', '做不到', '走开', '别这样', '停下来', '放开', '拒绝', '不愿意', '不可以', '别碰', '停下'];
const COMPLAINING_WORDS = ['加班', '老板', '作业', '考试', '累死', '烦死', '气死', '坑', '无语', '离谱', '绝了', '服了', '受不了', '崩溃了', '好烦', '好累', '好气', '吐槽', '抱怨'];

function containsAny(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

function countMatches(text: string, words: string[]): number {
  let n = 0;
  for (const w of words) if (text.includes(w)) n++;
  return n;
}

function buildContext(text: string): MatchContext {
  return {
    hasProfanity: containsAny(text, PROFANITY_WORDS),
    hasFlirtation: containsAny(text, FLIRTATION_WORDS),
    hasSelfHarm: containsAny(text, SELFHARM_WORDS),
    hasLeaving: containsAny(text, LEAVING_WORDS),
    hasApology: containsAny(text, APOLOGY_WORDS),
    hasAffection: containsAny(text, AFFECTION_WORDS),
    hasWeakness: containsAny(text, WEAKNESS_WORDS),
    hasColdness: containsAny(text, COLDNESS_WORDS),
    hasRational: containsAny(text, RATIONAL_WORDS),
    hasProvocation: containsAny(text, PROVOCATION_WORDS),
    hasRejection: containsAny(text, REJECTION_WORDS),
    hasComplaining: containsAny(text, COMPLAINING_WORDS),
  };
}

// ── The signal table — each entry is "what the character feels" ──

const SIGNALS: Signal[] = [
  // Self-harm / danger → fear↑↑, warmth↑, sadness↑
  {
    id: 'self_harm',
    label: '危险倾向',
    match: (_t, ctx) => (ctx.hasSelfHarm ? 1.0 : 0),
    delta: { fear: 0.45, warmth: 0.35, sadness: 0.25, anger: -0.1 },
    notes: '用户表现出危险倾向，角色感到恐惧和心疼',
  },
  // Threatening to leave → fear↑, sadness↑, joy↓
  {
    id: 'leaving',
    label: '要离开/结束',
    match: (_t, ctx) => (ctx.hasLeaving ? 0.9 : 0),
    delta: { fear: 0.3, sadness: 0.35, joy: -0.2, warmth: -0.1 },
    notes: '用户说要走，角色害怕失去',
  },
  // Directly provoking the character → anger↑ (NOT profanity alone)
  {
    id: 'provoke_character',
    label: '挑衅角色',
    match: (_t, ctx) => (ctx.hasProvocation ? 0.95 : 0),
    delta: { anger: 0.4, joy: -0.1 },
    notes: '用户直接挑衅角色人格，角色愤怒',
  },
  // Rejecting character's goodwill → anger↑, joy↓
  {
    id: 'reject_goodwill',
    label: '拒绝角色',
    match: (_t, ctx) => (ctx.hasRejection && !ctx.hasProvocation ? 0.7 : 0),
    delta: { anger: 0.25, joy: -0.15, desire: -0.1 },
    notes: '用户拒绝角色的善意，角色有些受挫和恼火',
  },
  // Apologizing → anger↓, warmth↑
  {
    id: 'apologize',
    label: '道歉认错',
    match: (_t, ctx) => (ctx.hasApology ? 0.85 : 0),
    delta: { anger: -0.25, warmth: 0.2, sadness: -0.1 },
    notes: '用户道歉，角色的怒气消解',
  },
  // Showing affection → joy↑, warmth↑, desire slight↑, fear↓
  {
    id: 'affection',
    label: '示爱/亲昵',
    match: (_t, ctx) => (ctx.hasAffection ? 0.9 : 0),
    delta: { joy: 0.3, warmth: 0.35, desire: 0.1, fear: -0.15, sadness: -0.1 },
    notes: '用户表达想念/喜欢，角色心里暖了',
  },
  // Flirting / physical approach → desire↑, joy↑, warmth slight↑
  {
    id: 'flirt',
    label: '挑逗/暧昧',
    match: (_t, ctx) => (ctx.hasFlirtation ? 0.85 : 0),
    delta: { desire: 0.35, joy: 0.15, warmth: 0.1 },
    notes: '用户挑逗/暧昧，角色欲望上升',
  },
  // Showing weakness → warmth↑, fear slight↑ (worry), anger↓
  {
    id: 'weakness',
    label: '示弱/求助',
    match: (_t, ctx) => (ctx.hasWeakness && !ctx.hasSelfHarm ? 0.8 : 0),
    delta: { warmth: 0.4, fear: 0.1, anger: -0.15, desire: 0.05 },
    notes: '用户示弱求助，角色心疼，想保护',
  },
  // Cold violence / stonewalling → warmth↓, sadness↑, joy↓, desire↓
  {
    id: 'coldness',
    label: '冷暴力',
    match: (_t, ctx) => (ctx.hasColdness && !ctx.hasRejection ? 0.75 : 0),
    delta: { warmth: -0.3, sadness: 0.2, joy: -0.2, desire: -0.15 },
    notes: '用户冷暴力，角色感到被推开',
  },
  // Venting / complaining about life (NOT at character) → warmth slight↑, no anger
  {
    id: 'venting',
    label: '吐槽/发泄情绪',
    match: (text, ctx) => {
      if (ctx.hasProvocation) return 0;
      if (ctx.hasProfanity && !ctx.hasProvocation && !ctx.hasSelfHarm) return 0.6;
      if (ctx.hasComplaining && !ctx.hasSelfHarm) return 0.5;
      return 0;
    },
    delta: { warmth: 0.1, anger: 0.0 },
    notes: '用户在发泄情绪（不是针对角色），角色想安抚，不愤怒',
  },
  // Rational discussion → no emotion change
  {
    id: 'rational',
    label: '理性讨论',
    match: (_t, ctx) => (ctx.hasRational && !ctx.hasAffection && !ctx.hasWeakness && !ctx.hasProvocation ? 0.5 : 0),
    delta: {},
    notes: '理性讨论，角色情绪无明显波动',
  },
];

// ── Intent classification ──

function classifyIntent(text: string, ctx: MatchContext): { intent: string; label: string } {
  if (ctx.hasSelfHarm) return { intent: 'crisis', label: '危险/自伤倾向' };
  if (ctx.hasLeaving) return { intent: 'leaving', label: '要离开/结束' };
  if (ctx.hasProvocation) return { intent: 'provoke', label: '挑衅角色' };
  if (ctx.hasApology) return { intent: 'apologize', label: '道歉认错' };
  if (ctx.hasAffection) return { intent: 'affection', label: '示爱/亲昵' };
  if (ctx.hasFlirtation) return { intent: 'flirt', label: '挑逗/暧昧' };
  if (ctx.hasWeakness) return { intent: 'hurt', label: '示弱/求助' };
  if (ctx.hasColdness) return { intent: 'cold', label: '冷暴力' };
  if (ctx.hasRejection) return { intent: 'refuse', label: '拒绝角色' };
  if (ctx.hasProfanity || ctx.hasComplaining) return { intent: 'venting', label: '吐槽/发泄' };
  if (ctx.hasRational) return { intent: 'rational', label: '理性讨论' };
  return { intent: 'neutral', label: '中性/闲聊' };
}

function classifySentiment(ctx: MatchContext): string {
  if (ctx.hasSelfHarm || ctx.hasLeaving || ctx.hasColdness) return 'negative';
  if (ctx.hasAffection || ctx.hasFlirtation || ctx.hasApology) return 'positive';
  if (ctx.hasProvocation || ctx.hasRejection) return 'negative';
  if (ctx.hasProfanity || ctx.hasComplaining) return 'negative';
  return 'neutral';
}

// ── Entity extraction (for display only) ──

function extractEntities(text: string): string[] {
  const all = [
    ...PROFANITY_WORDS, ...FLIRTATION_WORDS, ...SELFHARM_WORDS,
    ...LEAVING_WORDS, ...APOLOGY_WORDS, ...AFFECTION_WORDS,
    ...WEAKNESS_WORDS, ...COLDNESS_WORDS, ...PROVOCATION_WORDS,
    ...REJECTION_WORDS, ...COMPLAINING_WORDS,
  ];
  const found: string[] = [];
  const seen = new Set<string>();
  for (const w of all) {
    if (text.includes(w) && !seen.has(w)) {
      seen.add(w);
      found.push(w);
    }
  }
  return found;
}

// ── Main entry ──

export function analyzeIntent(text: string): IntentAnalysis {
  const ctx = buildContext(text);
  const { intent, label } = classifyIntent(text, ctx);
  const sentiment = classifySentiment(ctx);
  const entities = extractEntities(text);

  const delta: Partial<EmotionVector> = {};
  const matchedNotes: string[] = [];

  for (const signal of SIGNALS) {
    const conf = signal.match(text, ctx);
    if (conf > 0) {
      for (const k of EMOTION_KEYS) {
        const v = signal.delta[k];
        if (v !== undefined && v !== 0) {
          const scaled = v * conf;
          delta[k] = Math.round(((delta[k] ?? 0) + scaled) * 10000) / 10000;
        }
      }
      if (conf >= 0.4) matchedNotes.push(signal.notes);
    }
  }

  // Clean up near-zero values
  for (const k of EMOTION_KEYS) {
    if (delta[k] !== undefined && Math.abs(delta[k]!) < 0.005) {
      delete delta[k];
    }
  }

  const hasChange = Object.keys(delta).length > 0;
  let notes = '基于角色视角的情绪推断';
  if (matchedNotes.length > 0) {
    notes += '；' + matchedNotes.join('；');
  } else if (!hasChange) {
    notes += '；无明显情绪触发';
  }

  return {
    intent,
    intent_label: label,
    emotion_delta: delta,
    entities,
    sentiment,
    confidence: hasChange ? 0.55 + Math.min(0.3, matchedNotes.length * 0.1) : 0.3,
    notes,
  };
}

export function clampEmotionDelta(delta: Partial<EmotionVector>): Partial<EmotionVector> {
  const result: Partial<EmotionVector> = {};
  for (const k of EMOTION_KEYS) {
    const v = delta[k];
    if (v !== undefined && v !== null) {
      result[k] = Math.max(-0.3, Math.min(0.5, v));
    }
  }
  return result;
}
