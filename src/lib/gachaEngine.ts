// Fengling AI Gacha Simulator Engine (v4)
// JS Mechanical Layer: Probability, Spark Pity, Click Rhythm Parser, Sound FX, Configuration Manager

export type GachaRarity = 'SSR' | 'SR' | 'R';

export interface GachaCard {
  id: string;
  name: string;
  rarity: GachaRarity;
  card_image: string;
  description: string;
  featured?: boolean;
}

export interface GachaButton {
  id: string;
  label: string;
  cost?: number;
  position: { x: number; y: number }; // 0-100 percentage coordinates
}

export interface CursorConfig {
  style: 'default' | 'pointer' | 'wand' | 'star' | 'crosshair' | 'custom';
  custom_image?: string;
  size: number;
  color?: string;
}

export interface GachaRates {
  SSR: number;
  SR: number;
  R: number;
}

export interface SparkReward {
  card_id: string;
  description: string;
}

export interface GachaPoolConfig {
  pool_id: string;
  pool_name: string;
  banner_image: string;
  frame_overlay?: string;
  spark_count: number;
  spark_reward: SparkReward;
  rates: GachaRates;
  cards: GachaCard[];
  buttons: GachaButton[];
  cursor?: CursorConfig;
}

export interface ClickHabitProfile {
  skip_click_position: { x: number; y: number }; // Normalized 0-1
  click_rhythm: string;
  random_tap: boolean;
  wait_for_user_reply: boolean;
  tap_while_talking: boolean;
  evaluation_timing: 'on_flip' | 'after_all';
}

export interface GachaPullItem {
  id: string;
  card: GachaCard;
  pull_number: number;
  is_spark: boolean;
  timestamp: number;
  flipped: boolean;
  evaluation?: string;
}

export interface ParsedRhythm {
  moveDurationSec: number;
  clickIntervalMs: number;
  isVariable: boolean;
}

export const GACHA_CONFIG_STORAGE_KEY = 'fengling_gacha_config';
export const GACHA_HISTORY_STORAGE_KEY = 'fengling_gacha_history';

// ============================================================================
// Default Pool Configuration (Clean mechanical cards without preset templates)
// ============================================================================

export const DEFAULT_GACHA_POOL: GachaPoolConfig = {
  pool_id: 'limited_2026_fengling',
  pool_name: '幻境共鸣 · 星辉之誓',
  banner_image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1000&auto=format&fit=crop',
  frame_overlay: '',
  spark_count: 200,
  spark_reward: {
    card_id: 'card_ssr_01',
    description: '200抽内必得限定UP角色【夜蔷薇·莉莉丝】（井机制）',
  },
  rates: {
    SSR: 0.03,
    SR: 0.15,
    R: 0.82,
  },
  cursor: {
    style: 'default',
    size: 24,
    color: '#F59E0B',
  },
  cards: [
    {
      id: 'card_ssr_01',
      name: '夜蔷薇 · 莉莉丝',
      rarity: 'SSR',
      card_image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=800&auto=format&fit=crop',
      description: '暗黑系玫瑰女王，限定UP专属角色',
      featured: true,
    },
    {
      id: 'card_ssr_02',
      name: '星辰咏者 · 塞莱斯蒂',
      rarity: 'SSR',
      card_image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop',
      description: '游历星海的古老歌姬，常驻SSR',
      featured: false,
    },
    {
      id: 'card_sr_01',
      name: '绯红之刃 · 艾伦',
      rarity: 'SR',
      card_image: 'https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=800&auto=format&fit=crop',
      description: '敏捷的炎之剑士，SR核心输出',
      featured: false,
    },
    {
      id: 'card_sr_02',
      name: '银月神官 · 菲娜',
      rarity: 'SR',
      card_image: 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?q=80&w=800&auto=format&fit=crop',
      description: '纯洁的月之守护者，SR辅助',
      featured: false,
    },
    {
      id: 'card_r_01',
      name: '见习骑士 · 罗伊',
      rarity: 'R',
      card_image: 'https://images.unsplash.com/photo-1514539079130-25950c84af65?q=80&w=800&auto=format&fit=crop',
      description: '充满干劲的王国见习骑士',
      featured: false,
    },
    {
      id: 'card_r_02',
      name: '森林射手 · 罗宾',
      rarity: 'R',
      card_image: 'https://images.unsplash.com/photo-1511447333015-45b65e60f6d5?q=80&w=800&auto=format&fit=crop',
      description: '穿梭于林木间的年轻游侠',
      featured: false,
    },
    {
      id: 'card_r_03',
      name: '学徒法师 · 露露',
      rarity: 'R',
      card_image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=800&auto=format&fit=crop',
      description: '偶尔会炸膛的俏皮魔法学徒',
      featured: false,
    },
  ],
  buttons: [
    { id: 'pool_detail', label: '卡池详情', position: { x: 14, y: 94 } },
    { id: 'pull_once', label: '共鸣一次', cost: 1, position: { x: 34, y: 86 } },
    { id: 'pull_ten', label: '共鸣十次', cost: 10, position: { x: 66, y: 86 } },
    { id: 'pull_history', label: '抽卡记录', position: { x: 50, y: 94 } },
    { id: 'rate_info', label: '概率说明', position: { x: 74, y: 94 } },
    { id: 'custom', label: '自定义', position: { x: 89, y: 94 } },
  ],
};

// ============================================================================
// Configuration Store & Persistence
// ============================================================================

export function loadGachaPoolConfig(): GachaPoolConfig {
  try {
    const raw = localStorage.getItem(GACHA_CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.cards && parsed.rates && parsed.buttons) {
        const sparkCount = parsed.spark_count === 13 ? 200 : (parsed.spark_count || 200);
        return {
          ...DEFAULT_GACHA_POOL,
          ...parsed,
          spark_count: sparkCount,
          cursor: { ...DEFAULT_GACHA_POOL.cursor, ...parsed.cursor },
        };
      }
    }
  } catch (err) {
    console.warn('Failed to load gacha pool config from localStorage, using default:', err);
  }
  return DEFAULT_GACHA_POOL;
}

export function saveGachaPoolConfig(config: GachaPoolConfig): void {
  try {
    localStorage.setItem(GACHA_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Failed to save gacha pool config to localStorage:', err);
  }
}

export function resetGachaPoolConfig(): GachaPoolConfig {
  try {
    localStorage.removeItem(GACHA_CONFIG_STORAGE_KEY);
  } catch (e) {
    // ignore
  }
  return DEFAULT_GACHA_POOL;
}

// ============================================================================
// Probability & Pull Engine (Pure JS mechanical layer)
// ============================================================================

export function executeGachaPull(
  pool: GachaPoolConfig,
  count: number,
  currentSpark: number,
  totalPullsSoFar: number
): {
  items: GachaPullItem[];
  newSparkCount: number;
  sparkTriggered: boolean;
  featuredObtained: boolean;
} {
  const items: GachaPullItem[] = [];
  let spark = currentSpark;
  let sparkTriggered = false;
  let featuredObtained = false;

  const ssrCards = pool.cards.filter((c) => c.rarity === 'SSR');
  const srCards = pool.cards.filter((c) => c.rarity === 'SR');
  const rCards = pool.cards.filter((c) => c.rarity === 'R');

  const featuredSsr = ssrCards.find((c) => c.featured) || ssrCards[0] || pool.cards[0];

  for (let i = 0; i < count; i++) {
    const pullNumber = totalPullsSoFar + i + 1;
    spark += 1;

    let pickedCard: GachaCard;
    let isSparkPull = false;

    // Check Spark (井机制)
    if (spark >= pool.spark_count) {
      pickedCard = featuredSsr;
      isSparkPull = true;
      sparkTriggered = true;
      spark = 0; // Reset spark after spark reward
    } else {
      // Standard Weighted Pull
      const rand = Math.random();
      const ssrThreshold = pool.rates.SSR;
      const srThreshold = ssrThreshold + pool.rates.SR;

      if (rand < ssrThreshold && ssrCards.length > 0) {
        // Roll SSR: 50% rate-up for featured if exists
        if (featuredSsr && Math.random() < 0.5) {
          pickedCard = featuredSsr;
        } else {
          pickedCard = ssrCards[Math.floor(Math.random() * ssrCards.length)];
        }
        spark = 0; // SSR resets spark counter!
      } else if (rand < srThreshold && srCards.length > 0) {
        pickedCard = srCards[Math.floor(Math.random() * srCards.length)];
      } else if (rCards.length > 0) {
        pickedCard = rCards[Math.floor(Math.random() * rCards.length)];
      } else {
        pickedCard = pool.cards[Math.floor(Math.random() * pool.cards.length)];
      }
    }

    if (pickedCard.rarity === 'SSR' && pickedCard.featured) {
      featuredObtained = true;
    }

    items.push({
      id: `pull_${Date.now()}_${pullNumber}_${Math.random().toString(36).slice(2, 6)}`,
      card: pickedCard,
      pull_number: pullNumber,
      is_spark: isSparkPull,
      timestamp: Date.now(),
      flipped: false,
    });
  }

  return {
    items,
    newSparkCount: spark,
    sparkTriggered,
    featuredObtained,
  };
}

// ============================================================================
// Click Rhythm Parser (JS Mechanical Layer)
// Maps LLM free-text rhythm descriptions to exact interval & duration numbers
// ============================================================================

export function parseClickRhythm(rhythmText?: string): ParsedRhythm {
  if (!rhythmText || typeof rhythmText !== 'string') {
    return { moveDurationSec: 0.6, clickIntervalMs: 800, isVariable: false };
  }

  const text = rhythmText.toLowerCase();

  // 1. 急不可耐 / 连点 / 急性子
  if (/急|连点|狂点|飞快|迅速|迫不及待|急迫|急促/.test(text)) {
    return { moveDurationSec: 0.3, clickIntervalMs: 200, isVariable: false };
  }

  // 2. 磨磨蹭蹭 / 慢吞吞 / 犹豫 / 慎重
  if (/慢|磨|犹豫|慎重|缓缓|拖延|端详|沉思|仔细/.test(text)) {
    return { moveDurationSec: 1.0, clickIntervalMs: 1500, isVariable: false };
  }

  // 3. 忽快忽慢 / 随性 / 变化
  if (/忽快忽慢|随性|无常|时快时慢|变奏|捉摸不透/.test(text)) {
    return {
      moveDurationSec: 0.5,
      clickIntervalMs: Math.floor(Math.random() * (2000 - 300 + 1)) + 300,
      isVariable: true,
    };
  }

  // 4. 正常 / 普通 / 稳健
  return { moveDurationSec: 0.6, clickIntervalMs: 800, isVariable: false };
}

// ============================================================================
// Web Audio Sound Synthesizers (Rich immersive audio FX)
// ============================================================================

export function playGachaButtonSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(720, now + 0.08);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  } catch (e) {
    // ignore
  }
}

export function playCardFlipSound(rarity: GachaRarity = 'R') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (rarity === 'SSR') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
      osc.frequency.setValueAtTime(1046.5, now + 0.24); // C6
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (rarity === 'SR') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now); // A4
      osc.frequency.setValueAtTime(554.37, now + 0.1); // C#5
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(480, now + 0.06);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    }
  } catch (e) {
    // ignore
  }
}

export function playSsrSparkleSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const chords = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    chords.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      gain.gain.setValueAtTime(0.15, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.6);
    });
  } catch (e) {
    // ignore
  }
}

export function playBubblePopSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.05);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  } catch (e) {
    // ignore
  }
}
