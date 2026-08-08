import type { FoodItem, FoodNutrition } from '../types';
import { LOCAL_FOOD_DB } from './localFoodDB';

// ================== 工具函数 ==================

// 根据食用克数计算实际营养
export function calcNutrition(
  per100g: FoodNutrition,
  grams: number
): FoodNutrition {
  const ratio = grams / 100;
  return {
    calories: Math.round(per100g.calories * ratio * 10) / 10,
    protein: per100g.protein != null ? Math.round(per100g.protein * ratio * 10) / 10 : undefined,
    fat: per100g.fat != null ? Math.round(per100g.fat * ratio * 10) / 10 : undefined,
    carbs: per100g.carbs != null ? Math.round(per100g.carbs * ratio * 10) / 10 : undefined,
    fiber: per100g.fiber != null ? Math.round(per100g.fiber * ratio * 10) / 10 : undefined,
    sugar: per100g.sugar != null ? Math.round(per100g.sugar * ratio * 10) / 10 : undefined,
    sodium: per100g.sodium != null ? Math.round(per100g.sodium * ratio * 10) / 10 : undefined,
  };
}

// 生成唯一 ID
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

// 获取今天日期 YYYY-MM-DD
export function todayStr(): string {
  const d = new Date();
  return formatDate(d);
}

export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDateLabel(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${Number(m)}/${Number(d)}`;
}

// 简单的模糊匹配分数
function matchScore(text: string, query: string): number {
  if (!query) return 1;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (t === q) return 100;
  if (t.includes(q)) return 80 - Math.max(0, (t.length - q.length));
  // 逐字匹配
  let idx = 0;
  for (const ch of q) {
    const j = t.indexOf(ch, idx);
    if (j < 0) return 0;
    idx = j + 1;
  }
  return 30;
}

// ================== 本地搜索 ==================

export function searchLocalFoods(query: string, limit = 30): FoodItem[] {
  const q = query.trim();
  if (!q) {
    // 不查询时返回常见
    return LOCAL_FOOD_DB.slice(0, limit);
  }
  const scored: Array<{ item: FoodItem; score: number }> = [];
  for (const item of LOCAL_FOOD_DB) {
    const s1 = matchScore(item.name, q);
    const s2 = item.brand ? matchScore(item.brand, q) * 0.6 : 0;
    const s3 = item.category ? matchScore(item.category, q) * 0.4 : 0;
    const best = Math.max(s1, s2, s3);
    if (best > 0) scored.push({ item, score: best });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.item);
}

// ================== 网络 API 搜索 ==================
// 由于没有固定的食物营养 API key，使用多策略搜索：
// 1. 尝试使用公开的 Nutritionix (测试用 app id/key 仅用于少量查询)
// 2. 使用 USDA 公共 API (暂不启用, 需要 key)
// 3. 使用 MyFitnessPal 搜索 (web scrape 不现实, 跳过)
// 4. 自定义一个免费的兜底 API (通过维基百科/数据聚合)
// 实际: 使用 Edamam 公共 Food Database API (免费注册有额度, 这里尝试用一个演示 key)
// 如果 API 失败，就回退到本地数据库

const EDAMAM_APP_ID = '38c1d9d5'; // 免费 demo key，额度有限
const EDAMAM_APP_KEY = 'demo_key_calorie_tracker'; // 使用 demo 模式

interface EdamamHint {
  food: {
    foodId?: string;
    label: string;
    brand?: string;
    category?: string;
    categoryLabel?: string;
    image?: string;
    nutrients: {
      ENERC_KCAL?: number;
      PROCNT?: number;
      FAT?: number;
      CHOCDF?: number;
      FIBTG?: number;
      SUGAR?: number;
      NA?: number;
    };
    servingSizes?: Array<{
      uri?: string;
      label: string;
      quantity: number;
    }>;
    measures?: Array<{ uri?: string; label: string; weight: number }>;
  };
  measures?: Array<{
    uri: string;
    label: string;
    weight: number;
  }>;
}

interface EdamamResponse {
  hints: EdamamHint[];
  text: string;
}

async function tryEdamamSearch(query: string): Promise<FoodItem[]> {
  try {
    const url = `https://api.edamam.com/api/food-database/v2/parser?app_id=${EDAMAM_APP_ID}&app_key=${EDAMAM_APP_KEY}&ingr=${encodeURIComponent(
      query
    )}`;
    const resp = await fetch(url, { method: 'GET' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data: EdamamResponse = await resp.json();
    const results: FoodItem[] = [];
    for (const hint of data.hints || []) {
      const food = hint.food;
      const nut = food.nutrients;
      // 取一个合理的默认份量
      const defaultWeight =
        (food.measures && food.measures[0]?.weight) ||
        100;
      results.push({
        id: `edm_${food.foodId || Math.random().toString(36).slice(2, 10)}`,
        name: food.label,
        brand: food.brand,
        category: food.category || food.categoryLabel,
        defaultServing: defaultWeight
          ? `约 ${defaultWeight}g`
          : '100g',
        defaultGrams: defaultWeight || 100,
        nutritionPer100g: {
          calories: nut.ENERC_KCAL || 0,
          protein: nut.PROCNT,
          fat: nut.FAT,
          carbs: nut.CHOCDF,
          fiber: nut.FIBTG,
          sugar: nut.SUGAR,
          sodium: nut.NA,
        },
        source: 'api',
      });
    }
    return results;
  } catch (err) {
    // API 失败就返回空，让本地兜底
    console.warn('[FoodSearch] Edamam failed, fallback to local only', err);
    return [];
  }
}

// 公共免费开放 API - 搜索中国食物 (若可用)
async function tryOpenFoodSearch(query: string): Promise<FoodItem[]> {
  try {
    // Open Food Facts 开放数据库，无需 key
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
      query
    )}&search_simple=1&action=process&json=1&fields=product_name,brands,brands_tags,nutriments,serving_quantity,serving_size,quantity,categories_tags&page_size=15`;
    const resp = await fetch(url, { method: 'GET' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const products: any[] = data.products || [];
    const results: FoodItem[] = [];
    for (const p of products) {
      if (!p.product_name) continue;
      const nut = p.nutriments || {};
      const servingGrams =
        Number(p.serving_quantity) ||
        (typeof p.quantity === 'string'
          ? parseFloat(p.quantity.replace(/[^0-9.]/g, '')) || 100
          : 100);
      results.push({
        id: `off_${p._id || Math.random().toString(36).slice(2, 10)}`,
        name: p.product_name,
        brand: p.brands ? p.brands.split(',')[0].trim() : undefined,
        category:
          p.categories_tags && p.categories_tags.length > 0
            ? p.categories_tags[0].replace('en:', '').replace('zh:', '')
            : undefined,
        defaultServing: p.serving_size || `${servingGrams}g`,
        defaultGrams: isFinite(servingGrams) && servingGrams > 0 ? servingGrams : 100,
        nutritionPer100g: {
          calories: nut['energy-kcal_100g'] || nut.energy_100g || 0,
          protein: nut.proteins_100g,
          fat: nut.fat_100g,
          carbs: nut.carbohydrates_100g,
          fiber: nut.fiber_100g,
          sugar: nut.sugars_100g,
          sodium: nut.sodium_100g,
        },
        source: 'api',
      });
    }
    return results.filter(
      (r) => r.nutritionPer100g.calories > 0 && r.nutritionPer100g.calories < 900
    );
  } catch (err) {
    console.warn('[FoodSearch] OpenFoodFacts failed', err);
    return [];
  }
}

// 最近搜索缓存 (会话级)
const recentCache: Map<string, FoodItem[]> = new Map();

/**
 * 综合搜索：优先本地 -> 并行尝试两个在线 API -> 合并去重
 */
export async function searchFoods(
  query: string,
  opts: { useNetwork: boolean } = { useNetwork: true }
): Promise<FoodItem[]> {
  const q = query.trim();
  const cacheKey = q || '__default__';
  if (recentCache.has(cacheKey)) return recentCache.get(cacheKey)!;

  const local = searchLocalFoods(q, 30);

  let network: FoodItem[] = [];
  if (opts.useNetwork && q) {
    try {
      // 并行请求，设 3.5s 超时
      const timeout = new Promise<FoodItem[]>((_, rej) =>
        setTimeout(() => rej(new Error('timeout')), 3500)
      );
      const apiResults = await Promise.race([
        Promise.allSettled([tryEdamamSearch(q), tryOpenFoodSearch(q)]).then(
          (outs) => {
            const arr: FoodItem[] = [];
            for (const o of outs) {
              if (o.status === 'fulfilled') arr.push(...o.value);
            }
            return arr;
          }
        ),
        timeout,
      ]);
      network = apiResults;
    } catch {
      network = [];
    }
  }

  // 合并去重：以 name+brand 为 key
  const seen = new Map<string, FoodItem>();
  // 优先本地数据库的结果放在前面
  for (const it of local) seen.set(`${it.name}|${it.brand || ''}`, it);
  for (const it of network) {
    const k = `${it.name}|${it.brand || ''}`;
    if (!seen.has(k)) seen.set(k, it);
  }

  const merged = Array.from(seen.values());
  // 最多返回 40 条
  const result = merged.slice(0, 40);

  if (result.length > 0) {
    recentCache.set(cacheKey, result);
    // 简单限制缓存数
    if (recentCache.size > 30) {
      const firstKey = recentCache.keys().next().value;
      if (firstKey) recentCache.delete(firstKey);
    }
  }
  return result;
}
