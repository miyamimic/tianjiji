import type { EmotionVector } from '../data/types';

export interface StickerSnapshot {
  stolenAt: number;
  contextText: string;
  emotionSnapshot?: EmotionVector;
  sourceCharacterId?: string;
  sourceCharacterName?: string;
  stolenBy: 'ai' | 'user';
}

export interface Sticker {
  id: string;
  name: string;
  url: string;
  category: string;
  ownerType: 'user' | 'ai';
  characterId?: string;
  isStolen?: boolean;
  stolenMeta?: StickerSnapshot;
  createdAt: number;
}

const STICKERS_STORAGE_KEY = '__rp_stickers_v1';

// Initial Preset Stickers with high-quality expressive URLs and fallbacks
const INITIAL_PRESET_STICKERS: Sticker[] = [
  // === USER PRESETS ===
  {
    id: 'user_stk_001',
    name: '猫猫疑惑',
    url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=260&h=260&fit=crop&crop=faces&q=80',
    category: '我的收藏',
    ownerType: 'user',
    createdAt: 1700000000000,
  },
  {
    id: 'user_stk_002',
    name: '暗中观察',
    url: 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=260&h=260&fit=crop&crop=faces&q=80',
    category: '我的收藏',
    ownerType: 'user',
    createdAt: 1700000001000,
  },
  {
    id: 'user_stk_003',
    name: '得意洋洋',
    url: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=260&h=260&fit=crop&crop=faces&q=80',
    category: '我的收藏',
    ownerType: 'user',
    createdAt: 1700000002000,
  },
  {
    id: 'user_stk_004',
    name: '给你比心',
    url: 'https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=260&h=260&fit=crop&crop=faces&q=80',
    category: '日常萌系',
    ownerType: 'user',
    createdAt: 1700000003000,
  },
  {
    id: 'user_stk_005',
    name: '破防大哭',
    url: 'https://images.unsplash.com/photo-1548802673-380ab8ebc7b7?w=260&h=260&fit=crop&crop=faces&q=80',
    category: '沙雕斗图',
    ownerType: 'user',
    createdAt: 1700000004000,
  },
  {
    id: 'user_stk_006',
    name: '吃瓜看戏',
    url: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=260&h=260&fit=crop&crop=faces&q=80',
    category: '沙雕斗图',
    ownerType: 'user',
    createdAt: 1700000005000,
  },

  // === CHARACTER PRESETS: 陆沉 (char_001) ===
  {
    id: 'char1_stk_001',
    name: '陆沉·举杯微醺',
    url: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=260&h=260&fit=crop&q=80',
    category: '陆沉专属',
    ownerType: 'ai',
    characterId: 'char_001',
    createdAt: 1700000010000,
  },
  {
    id: 'char1_stk_002',
    name: '陆沉·审视玩味',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=260&h=260&fit=crop&crop=faces&q=80',
    category: '陆沉专属',
    ownerType: 'ai',
    characterId: 'char_001',
    createdAt: 1700000011000,
  },
  {
    id: 'char1_stk_003',
    name: '陆沉·按头轻笑',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=260&h=260&fit=crop&crop=faces&q=80',
    category: '陆沉专属',
    ownerType: 'ai',
    characterId: 'char_001',
    createdAt: 1700000012000,
  },
  {
    id: 'char1_stk_004',
    name: '陆沉·危险逼近',
    url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=260&h=260&fit=crop&crop=faces&q=80',
    category: '陆沉专属',
    ownerType: 'ai',
    characterId: 'char_001',
    createdAt: 1700000013000,
  },

  // === CHARACTER PRESETS: 阿野 (char_002) ===
  {
    id: 'char2_stk_001',
    name: '阿野·不服挑衅',
    url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=260&h=260&fit=crop&crop=faces&q=80',
    category: '阿野专属',
    ownerType: 'ai',
    characterId: 'char_002',
    createdAt: 1700000020000,
  },
  {
    id: 'char2_stk_002',
    name: '阿野·野性咧嘴',
    url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=260&h=260&fit=crop&crop=faces&q=80',
    category: '阿野专属',
    ownerType: 'ai',
    characterId: 'char_002',
    createdAt: 1700000021000,
  },
  {
    id: 'char2_stk_003',
    name: '阿野·抓狂脸红',
    url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=260&h=260&fit=crop&crop=faces&q=80',
    category: '阿野专属',
    ownerType: 'ai',
    characterId: 'char_002',
    createdAt: 1700000022000,
  },
  {
    id: 'char2_stk_004',
    name: '阿野·霸道揉头',
    url: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=260&h=260&fit=crop&crop=faces&q=80',
    category: '阿野专属',
    ownerType: 'ai',
    characterId: 'char_002',
    createdAt: 1700000023000,
  },
];

export function loadAllStickers(): Sticker[] {
  try {
    const raw = localStorage.getItem(STICKERS_STORAGE_KEY);
    if (!raw) {
      saveAllStickers(INITIAL_PRESET_STICKERS);
      return INITIAL_PRESET_STICKERS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return INITIAL_PRESET_STICKERS;
  } catch {
    return INITIAL_PRESET_STICKERS;
  }
}

export function saveAllStickers(stickers: Sticker[]): void {
  try {
    localStorage.setItem(STICKERS_STORAGE_KEY, JSON.stringify(stickers));
    window.dispatchEvent(new CustomEvent('rp_stickers_updated'));
  } catch (err) {
    console.error('Failed to save stickers:', err);
  }
}

export function subscribeStickers(callback: () => void): () => void {
  const handler = () => callback();
  window.addEventListener('rp_stickers_updated', handler);
  return () => window.removeEventListener('rp_stickers_updated', handler);
}

// ================= USER STICKER QUERIES =================

export function getUserStickers(): Sticker[] {
  const all = loadAllStickers();
  return all.filter((s) => s.ownerType === 'user');
}

export function getUserStickerCategories(): string[] {
  const userStickers = getUserStickers();
  const cats = new Set<string>();
  cats.add('全部');
  cats.add('我的收藏');
  
  userStickers.forEach((s) => {
    if (s.category && s.category.trim()) {
      cats.add(s.category.trim());
    }
  });

  return Array.from(cats);
}

// ================= CHARACTER STICKER QUERIES =================

export function getCharacterStickers(characterId: string): Sticker[] {
  const all = loadAllStickers();
  return all.filter((s) => s.ownerType === 'ai' && s.characterId === characterId);
}

export function getCharacterStolenStickers(characterId: string): Sticker[] {
  return getCharacterStickers(characterId).filter((s) => s.isStolen);
}

// ================= ADD / EDIT / DELETE =================

export function addSticker(item: Omit<Sticker, 'id' | 'createdAt'>): Sticker {
  const all = loadAllStickers();
  const newSticker: Sticker = {
    ...item,
    id: `stk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
  };
  all.unshift(newSticker);
  saveAllStickers(all);
  return newSticker;
}

export function updateSticker(id: string, updates: Partial<Sticker>): boolean {
  const all = loadAllStickers();
  const idx = all.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  all[idx] = { ...all[idx], ...updates };
  saveAllStickers(all);
  return true;
}

export function deleteSticker(id: string): boolean {
  const all = loadAllStickers();
  const filtered = all.filter((s) => s.id !== id);
  if (filtered.length !== all.length) {
    saveAllStickers(filtered);
    return true;
  }
  return false;
}

// ================= BATCH IMPORT =================

export function batchImportStickers(
  rawText: string,
  ownerType: 'user' | 'ai',
  characterId?: string,
  defaultCategory = '图床导入'
): { successCount: number; errors: string[] } {
  const lines = rawText.split('\n');
  const all = loadAllStickers();
  let successCount = 0;
  const errors: string[] = [];

  const urlRegex = /(https?:\/\/[^\s,，"']+)/i;

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return;

    // Check for JSON object
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const obj = JSON.parse(trimmed);
        if (obj.url) {
          const name = obj.name || `表情包_${Date.now().toString().slice(-4)}`;
          const category = obj.category || defaultCategory;
          all.unshift({
            id: `stk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            name,
            url: obj.url,
            category,
            ownerType,
            characterId: ownerType === 'ai' ? characterId : undefined,
            createdAt: Date.now(),
          });
          successCount++;
          return;
        }
      } catch {
        // fallback to line parsing
      }
    }

    const urlMatch = trimmed.match(urlRegex);
    if (!urlMatch) {
      errors.push(`第 ${index + 1} 行未识别到有效图片网址: "${trimmed.slice(0, 25)}..."`);
      return;
    }

    const url = urlMatch[1].trim();
    // Name is the remaining text on the line
    let name = trimmed.replace(url, '').replace(/[,，\t]/g, ' ').trim();
    if (!name) {
      // derive name from url filename or generic name
      const filenameMatch = url.split('/').pop()?.split('?')[0]?.split('.')[0];
      name = filenameMatch ? decodeURIComponent(filenameMatch).slice(0, 12) : `导入表情_${successCount + 1}`;
    }

    all.unshift({
      id: `stk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      url,
      category: defaultCategory,
      ownerType,
      characterId: ownerType === 'ai' ? characterId : undefined,
      createdAt: Date.now() + successCount,
    });
    successCount++;
  });

  if (successCount > 0) {
    saveAllStickers(all);
  }

  return { successCount, errors };
}

// ================= STEAL INTERACTIONS =================

/**
 * User steals a sticker from AI
 * Saves it to user's library under category "来自 [characterName]"
 */
export function userStealAiSticker(
  characterId: string,
  characterName: string,
  sticker: { name: string; url: string },
  contextText = ''
): { success: boolean; isNew: boolean; sticker: Sticker } {
  const all = loadAllStickers();
  const categoryName = `来自 ${characterName}`;

  // Check if user already owns this sticker
  const existing = all.find(
    (s) => s.ownerType === 'user' && s.url === sticker.url
  );

  if (existing) {
    return { success: true, isNew: false, sticker: existing };
  }

  const stolenSticker: Sticker = {
    id: `stk_user_stolen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: sticker.name,
    url: sticker.url,
    category: categoryName,
    ownerType: 'user',
    isStolen: true,
    stolenMeta: {
      stolenAt: Date.now(),
      contextText: contextText || '（对话中偷取）',
      sourceCharacterId: characterId,
      sourceCharacterName: characterName,
      stolenBy: 'user',
    },
    createdAt: Date.now(),
  };

  all.unshift(stolenSticker);
  saveAllStickers(all);

  // Dispatch floating celebration event
  window.dispatchEvent(
    new CustomEvent('rp_sticker_stolen_event', {
      detail: {
        by: 'user',
        characterName,
        stickerName: sticker.name,
        stickerUrl: sticker.url,
        message: `✨ 已成功偷取【${characterName}】的表情包「${sticker.name}」！已存入「${categoryName}」分类`,
      },
    })
  );

  return { success: true, isNew: true, sticker: stolenSticker };
}

/**
 * AI steals a sticker from User
 * Saves it to character's library with snapshot of time, user's words, and AI emotion
 */
export function aiStealUserSticker(
  characterId: string,
  characterName: string,
  sticker: { name: string; url: string },
  userContextText: string,
  emotionSnapshot: EmotionVector
): { success: boolean; isNew: boolean; sticker: Sticker } {
  const all = loadAllStickers();

  // Check if AI already owns this sticker
  const existing = all.find(
    (s) => s.ownerType === 'ai' && s.characterId === characterId && s.url === sticker.url
  );

  if (existing) {
    return { success: true, isNew: false, sticker: existing };
  }

  const stolenSticker: Sticker = {
    id: `stk_ai_stolen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: sticker.name,
    url: sticker.url,
    category: '偷自主控',
    ownerType: 'ai',
    characterId,
    isStolen: true,
    stolenMeta: {
      stolenAt: Date.now(),
      contextText: userContextText || '“（发送了表情包）”',
      emotionSnapshot: { ...emotionSnapshot },
      stolenBy: 'ai',
    },
    createdAt: Date.now(),
  };

  all.unshift(stolenSticker);
  saveAllStickers(all);

  // Dispatch toast / notification event
  window.dispatchEvent(
    new CustomEvent('rp_sticker_stolen_event', {
      detail: {
        by: 'ai',
        characterId,
        characterName,
        stickerName: sticker.name,
        stickerUrl: sticker.url,
        emotionSnapshot,
        message: `🐾【${characterName}】被你的表情包戳中，已悄悄存下「${sticker.name}」！`,
      },
    })
  );

  return { success: true, isNew: true, sticker: stolenSticker };
}

export function isStickerStolenByUser(url: string): boolean {
  const all = loadAllStickers();
  return all.some((s) => s.ownerType === 'user' && s.url === url && s.isStolen);
}

export function isStickerStolenByAi(characterId: string, url: string): boolean {
  const all = loadAllStickers();
  return all.some(
    (s) => s.ownerType === 'ai' && s.characterId === characterId && s.url === url
  );
}
