import type {
  GachaPoolConfig,
  GachaCard,
  GachaButton,
  ClickTarget,
  ClickHabitProfile,
  PulledCardInstance,
  GachaHistoryRecord
} from './gachaTypes';
import { DEFAULT_GACHA_POOL } from './defaultGachaPool';

const GACHA_POOL_STORAGE_KEY = '__rp_gacha_pool_config_v4';
const GACHA_HISTORY_STORAGE_KEY = '__rp_gacha_history_v4';

// -------------------------------------------------------------
// 1. Config Persistence & Storage
// -------------------------------------------------------------

export function loadGachaPoolConfig(): GachaPoolConfig {
  try {
    const raw = localStorage.getItem(GACHA_POOL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.pool_name === 'string' && Array.isArray(parsed.cards)) {
        return sanitizeGachaPoolConfig(parsed);
      }
    }
  } catch (err) {
    console.warn('[GachaEngine] Load pool config failed, using default:', err);
  }
  return DEFAULT_GACHA_POOL;
}

export function saveGachaPoolConfig(config: GachaPoolConfig): void {
  try {
    const sanitized = sanitizeGachaPoolConfig(config);
    localStorage.setItem(GACHA_POOL_STORAGE_KEY, JSON.stringify(sanitized));
  } catch (err) {
    console.error('[GachaEngine] Save pool config failed:', err);
  }
}

export function resetGachaPoolConfig(): GachaPoolConfig {
  try {
    localStorage.removeItem(GACHA_POOL_STORAGE_KEY);
  } catch {}
  return DEFAULT_GACHA_POOL;
}

export function sanitizeGachaPoolConfig(raw: any): GachaPoolConfig {
  const fallback = DEFAULT_GACHA_POOL;
  const rates = raw?.rates || fallback.rates;
  const ssrRate = typeof rates.SSR === 'number' && !isNaN(rates.SSR) ? Math.max(0.001, Math.min(0.5, rates.SSR)) : 0.018;
  const srRate = typeof rates.SR === 'number' && !isNaN(rates.SR) ? Math.max(0.01, Math.min(0.8, rates.SR)) : 0.132;
  const rRate = Math.max(0.01, +(1 - ssrRate - srRate).toFixed(4));

  const rawCards = Array.isArray(raw?.cards) && raw.cards.length > 0 ? raw.cards : fallback.cards;
  const cards: GachaCard[] = rawCards.map((c: any, idx: number) => ({
    id: String(c.id || `card_${idx}_${Date.now()}`),
    name: String(c.name || `神秘卡牌 #${idx + 1}`),
    rarity: (c.rarity === 'SSR' || c.rarity === 'SR' || c.rarity === 'R' ? c.rarity : 'R') as any,
    card_image: String(c.card_image || fallback.cards[0].card_image),
    description: String(c.description || '一张充满未知光彩的卡牌。'),
    featured: Boolean(c.featured),
  }));

  const rawButtons = Array.isArray(raw?.buttons) && raw.buttons.length > 0 ? raw.buttons : fallback.buttons;
  const buttons: GachaButton[] = rawButtons.map((b: any, idx: number) => ({
    id: String(b.id || `btn_${idx}`),
    label: String(b.label || `操作 ${idx + 1}`),
    type: b.type || 'custom',
    pullCount: typeof b.pullCount === 'number' ? b.pullCount : (b.id?.includes('10') ? 10 : 1),
    position: {
      x: typeof b.position?.x === 'number' ? Math.max(0, Math.min(1, b.position.x)) : 0.5,
      y: typeof b.position?.y === 'number' ? Math.max(0, Math.min(1, b.position.y)) : 0.5,
    },
    styleVariant: b.styleVariant || 'primary',
  }));

  return {
    pool_id: String(raw?.pool_id || fallback.pool_id),
    pool_name: String(raw?.pool_name || fallback.pool_name),
    banner_image: String(raw?.banner_image || fallback.banner_image),
    frame_overlay: String(raw?.frame_overlay || ''),
    spark_count: typeof raw?.spark_count === 'number' && raw.spark_count > 0 ? Math.round(raw.spark_count) : fallback.spark_count,
    spark_reward: {
      card_id: String(raw?.spark_reward?.card_id || fallback.spark_reward.card_id),
      description: String(raw?.spark_reward?.description || fallback.spark_reward.description),
    },
    rates: {
      SSR: ssrRate,
      SR: srRate,
      R: rRate,
    },
    cards,
    buttons,
    cursor_style: {
      type: raw?.cursor_style?.type || 'arrow',
      color: raw?.cursor_style?.color || '#F59E0B',
      size: typeof raw?.cursor_style?.size === 'number' ? raw.cursor_style.size : 24,
    },
  };
}

// -------------------------------------------------------------
// 2. Gacha Execution Engine (JS Mechanical Layer)
// -------------------------------------------------------------

export interface ExecutePullResult {
  pulledCards: PulledCardInstance[];
  newSparkCount: number;
  isSparkTriggered: boolean;
  totalSsrCountInPull: number;
}

export function executeGachaPull(
  poolConfig: GachaPoolConfig,
  pullCount: number,
  currentSparkCount: number
): ExecutePullResult {
  const ssrCards = poolConfig.cards.filter((c) => c.rarity === 'SSR');
  const srCards = poolConfig.cards.filter((c) => c.rarity === 'SR');
  const rCards = poolConfig.cards.filter((c) => c.rarity === 'R');

  // Fallback safe arrays if some rarities have 0 cards
  const safeSsr = ssrCards.length > 0 ? ssrCards : poolConfig.cards;
  const safeSr = srCards.length > 0 ? srCards : poolConfig.cards;
  const safeR = rCards.length > 0 ? rCards : poolConfig.cards;

  const pulledCards: PulledCardInstance[] = [];
  let newSparkCount = currentSparkCount;
  let isSparkTriggered = false;
  let totalSsrCountInPull = 0;

  for (let i = 0; i < pullCount; i++) {
    newSparkCount += 1;
    let chosenCard: GachaCard;
    let isSparkReward = false;

    // Check spark threshold (井计数)
    if (newSparkCount >= poolConfig.spark_count) {
      isSparkTriggered = true;
      isSparkReward = true;
      newSparkCount = 0; // reset spark count
      const rewardCard = poolConfig.cards.find((c) => c.id === poolConfig.spark_reward.card_id) || safeSsr[0];
      chosenCard = rewardCard;
      totalSsrCountInPull++;
    } else {
      const rand = Math.random();
      if (rand < poolConfig.rates.SSR) {
        // Roll SSR
        chosenCard = pickWeightedCard(safeSsr);
        totalSsrCountInPull++;
      } else if (rand < poolConfig.rates.SSR + poolConfig.rates.SR) {
        // Roll SR
        chosenCard = pickWeightedCard(safeSr);
      } else {
        // Roll R
        chosenCard = pickWeightedCard(safeR);
      }
    }

    pulledCards.push({
      instanceId: `card_inst_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      card: chosenCard,
      pullIndex: i,
      isSparkReward,
      isFlipped: false,
    });
  }

  return {
    pulledCards,
    newSparkCount,
    isSparkTriggered,
    totalSsrCountInPull,
  };
}

function pickWeightedCard(cards: GachaCard[]): GachaCard {
  if (cards.length === 1) return cards[0];
  const featured = cards.filter((c) => c.featured);
  // Featured cards have 5x weight
  if (featured.length > 0 && Math.random() < 0.6) {
    return featured[Math.floor(Math.random() * featured.length)];
  }
  return cards[Math.floor(Math.random() * cards.length)];
}

// -------------------------------------------------------------
// 3. Rhythm & Hesitation Text Parsers
// -------------------------------------------------------------

export function parseClickRhythmMs(rhythmText: string): number {
  if (!rhythmText) return 800;
  const t = rhythmText.toLowerCase();

  if (t.includes('急') || t.includes('狂') || t.includes('暴') || t.includes('极快') || t.includes('闪电') || t.includes('连点')) {
    return 220;
  }
  if (t.includes('快') || t.includes('利落') || t.includes('迫不及待') || t.includes('迅速')) {
    return 400;
  }
  if (t.includes('慢') || t.includes('迟疑') || t.includes('沉重') || t.includes('紧张') || t.includes('龟速')) {
    return 1500;
  }
  if (t.includes('从容') || t.includes('优雅') || t.includes('稳') || t.includes('平缓')) {
    return 950;
  }
  if (t.includes('犹豫') || t.includes('纠结') || t.includes('深呼吸')) {
    return 1800;
  }

  const numMatch = rhythmText.match(/\d+/);
  if (numMatch) {
    const parsed = parseInt(numMatch[0], 10);
    if (!isNaN(parsed) && parsed >= 100 && parsed <= 5000) {
      return parsed;
    }
  }

  return 800;
}

// -------------------------------------------------------------
// 4. Anti-Hallucination Target Validation
// -------------------------------------------------------------

export function validateAndSanitizeClickTarget(
  target: any,
  poolConfig: GachaPoolConfig
): ClickTarget {
  if (!target || typeof target !== 'object') {
    // Default safe blank position
    return { type: 'blank', position: { x: 0.5, y: 0.5 } };
  }

  if (target.type === 'button') {
    const buttonId = String(target.button_id || '');
    const exists = poolConfig.buttons.some((b) => b.id === buttonId);
    if (exists) {
      return { type: 'button', button_id: buttonId };
    }
    // If button does not exist, check if first button is available
    if (poolConfig.buttons.length > 0) {
      return { type: 'button', button_id: poolConfig.buttons[0].id };
    }
    return { type: 'blank', position: { x: 0.5, y: 0.5 } };
  }

  if (target.type === 'blank') {
    const rawPos = target.position;
    const x = typeof rawPos?.x === 'number' && !isNaN(rawPos.x) ? Math.max(0, Math.min(1, rawPos.x)) : 0.5;
    const y = typeof rawPos?.y === 'number' && !isNaN(rawPos.y) ? Math.max(0, Math.min(1, rawPos.y)) : 0.5;
    return { type: 'blank', position: { x, y } };
  }

  return { type: 'blank', position: { x: 0.5, y: 0.5 } };
}

export function getDefaultClickHabitProfile(): ClickHabitProfile {
  return {
    skip_click_position: { x: 0.88, y: 0.08 },
    click_rhythm: '正常',
    random_tap: false,
    wait_for_user_reply: false,
    tap_while_talking: true,
    evaluation_timing: 'on_flip',
  };
}

// -------------------------------------------------------------
// 5. Pull History Storage
// -------------------------------------------------------------

export function loadGachaHistory(): GachaHistoryRecord[] {
  try {
    const raw = localStorage.getItem(GACHA_HISTORY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function appendGachaHistory(record: GachaHistoryRecord): void {
  try {
    const list = loadGachaHistory();
    list.unshift(record);
    // Keep max 100 pull history records
    localStorage.setItem(GACHA_HISTORY_STORAGE_KEY, JSON.stringify(list.slice(0, 100)));
  } catch (err) {
    console.warn('[GachaEngine] Append history failed:', err);
  }
}

export function clearGachaHistory(): void {
  try {
    localStorage.removeItem(GACHA_HISTORY_STORAGE_KEY);
  } catch {}
}
