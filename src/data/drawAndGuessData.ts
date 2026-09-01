/**
 * drawAndGuessData.ts
 *
 * Question bank (WORD_CATEGORIES), AI character brush profiles & painting personalities (AI_ARTISTS).
 * v4: All pre-drawn hardcoded coordinates and preset dialog banks have been removed in favor of
 * live LLM stroke generation and persona synthesis.
 */
import type { CharacterBrushParams } from '../lib/perfectFreehandHelper';
import { loadSavedCharacters, loadCharAvatar } from '../lib/customStore';

// -------------------------------------------------------------
// Category and Word Bank Definition
// -------------------------------------------------------------
export interface WordCategory {
  id: string;
  name: string;
  emoji: string;
  description: string;
  words: {
    text: string;
    hints: string[];
  }[];
}

export const WORD_CATEGORIES: WordCategory[] = [
  {
    id: 'love',
    name: '恋爱主题',
    emoji: '💖',
    description: '甜蜜悸动、定情信物与浪漫心事',
    words: [
      { text: '爱心', hints: ['代表喜欢', '两瓣圆润', '红色的符号'] },
      { text: '玫瑰花', hints: ['带刺的植物', '情人节常送', '花语是爱情'] },
      { text: '情书', hints: ['写满心意', '装在信封里', '纸短情长'] },
      { text: '钻戒', hints: ['套在无名指', '闪闪发光', '承诺的象征'] },
      { text: '心锁', hints: ['挂在桥边', '需要钥匙开启', '锁住两颗心'] },
      { text: '拥抱', hints: ['温暖的肢体接触', '张开双臂', '融化孤单'] },
    ],
  },
  {
    id: 'animal',
    name: '可爱动物',
    emoji: '🐾',
    description: '毛茸茸与游水飞禽的可爱生灵',
    words: [
      { text: '小鱼', hints: ['生活在水里', '吐泡泡', '会摆动尾鳍'] },
      { text: '猫咪', hints: ['喵喵叫', '喜欢吃鱼', '长着胡须与尖耳朵'] },
      { text: '兔子', hints: ['长长的大耳朵', '红眼睛', '喜欢吃胡萝卜'] },
      { text: '小鸟', hints: ['长着翅膀', '站在枝头', '会叽叽喳喳唱歌'] },
      { text: '蝴蝶', hints: ['两扇斑斓的翅膀', '在花丛中飞舞', '由毛毛虫蜕变'] },
      { text: '企鹅', hints: ['住在南极', '走起路来摇摇晃晃', '穿黑白礼服'] },
    ],
  },
  {
    id: 'food',
    name: '美味食物',
    emoji: '🍰',
    description: '令人垂涎欲滴的珍馐与甜点',
    words: [
      { text: '苹果', hints: ['红彤彤的果实', '砸中牛顿', '带有一片绿叶'] },
      { text: '汉堡', hints: ['快餐主角', '两片面包夹肉和生菜', '多层结构'] },
      { text: '西瓜', hints: ['夏日解暑神器', '红瓤黑籽绿皮', '切成三角形'] },
      { text: '荷包蛋', hints: ['早餐常客', '金黄蛋黄在中间', '蛋白煎得嫩白'] },
      { text: '冰淇淋', hints: ['夏天甜品', '蛋筒托着球状冰霜', '会慢慢融化'] },
      { text: '甜甜圈', hints: ['中间有一个空心圆孔', '裹着彩色糖霜', '油炸面点'] },
    ],
  },
  {
    id: 'daily',
    name: '日常物品',
    emoji: '🎒',
    description: '生活里触手可及的各种陪伴小物',
    words: [
      { text: '太阳', hints: ['挂在天空', '带来光明与温暖', '散发耀眼光芒'] },
      { text: '雨伞', hints: ['下雨天撑开', '带有弯弯的手柄', '遮风挡雨'] },
      { text: '房子', hints: ['遮风避雨的家', '三角形屋顶', '有窗户与门'] },
      { text: '咖啡杯', hints: ['装热饮的瓷器', '带有侧边把手', '飘散袅袅热气'] },
      { text: '气球', hints: ['轻飘飘飞向空中', '系着一根细绳', '容易被针扎破'] },
      { text: '闹钟', hints: ['早晨叫你起床', '圆盘上有指针', '头顶有两个敲击铃铛'] },
    ],
  },
  {
    id: 'idiom',
    name: '成语典故',
    emoji: '📜',
    description: '四字经典成语与意境描摹',
    words: [
      { text: '浑水摸鱼', hints: ['四个字成语', '比喻乘混乱捞取利益', '包含一种水里游的生灵'] },
      { text: '守株待兔', hints: ['四个字成语', '比喻死守狭隘经验不知变通', '包含一种长耳朵动物'] },
      { text: '画龙点睛', hints: ['四个字成语', '在关键处添上精妙一笔', '充满神韵与爱意'] },
      { text: '风和日丽', hints: ['四个字成语', '形容春光明媚暖阳高照', '挂在天空的耀眼存在'] },
      { text: '掌上明珠', hints: ['四个字成语', '比喻极受宠爱与珍视之人', '璀璨闪烁的饰品'] },
      { text: '招蜂引蝶', hints: ['四个字成语', '形容吸引众人的目光', '在花间飞舞的美丽精灵'] },
    ],
  },
];

// -------------------------------------------------------------
// AI Character Brush Parameters & Painting Personalities
// -------------------------------------------------------------
export interface AiArtistCharacter {
  id: string;
  name: string;
  avatar: string;
  title: string;
  tag: string;
  personality: string;
  paintingPersona: string; // Used in LLM Prompt to shape stroke style & dialogue style
  brushParams: CharacterBrushParams;
}

export const AI_ARTISTS: AiArtistCharacter[] = [
  {
    id: 'char_001',
    name: '陆沉',
    avatar: '🍷',
    title: '沉着内敛 · 掌控从容',
    tag: '大师级画风',
    personality: '笔触沉稳流畅，分寸感极强，下笔如有神助。',
    paintingPersona: '大师级，一笔到位。线条少而精准，从容典雅，每笔都有深刻的几何与构图意义。',
    brushParams: {
      thinning: 0.65,
      smoothing: 0.88,
      jitter: 0.03,
      taperStart: 18,
      taperEnd: 16,
      size: 9,
    },
  },
  {
    id: 'char_002',
    name: '阿野',
    avatar: '🐺',
    title: '狂野速写 · 激情随性',
    tag: '狂野写意派',
    personality: '下笔迅猛豪爽，线条充满力量感，略带不羁抖动。',
    paintingPersona: '狂野速写派。笔画粗犷豪放，线条飞扬，手速极快，带有一丝不羁的力量与张力。',
    brushParams: {
      thinning: 0.82,
      smoothing: 0.46,
      jitter: 0.28,
      taperStart: 8,
      taperEnd: 6,
      size: 11,
    },
  },
];

/**
 * Get all available artists dynamically, pulling the real saved character list
 * (including custom characters created in settings) with fallback to default characters.
 */
export function getAllPlayableArtists(): AiArtistCharacter[] {
  const result: AiArtistCharacter[] = [];
  const presetMap = new Map<string, AiArtistCharacter>();
  AI_ARTISTS.forEach((a) => {
    presetMap.set(a.id, a);
    presetMap.set(a.name, a);
  });

  try {
    const saved = loadSavedCharacters();
    if (Array.isArray(saved) && saved.length > 0) {
      saved.forEach((char) => {
        if (char.name === '糊涂酱' || char.name.includes('糊涂')) {
          return;
        }
        const customAvatar = loadCharAvatar(char.character_id);
        const preset = presetMap.get(char.character_id) || presetMap.get(char.name);

        if (preset) {
          result.push({
            ...preset,
            id: char.character_id,
            name: char.name,
            avatar: customAvatar || preset.avatar || '🎨',
            title: preset.title || `${char.name} · 专属画伴`,
            tag: preset.tag || (char.core.values?.[0] ? `${char.core.values[0]}画风` : '专属风格'),
            personality: preset.personality || char.core.values?.join('、') || '',
            paintingPersona:
              preset.paintingPersona ||
              `符合${char.name}性格（${char.core.values?.join('、') || ''}，${char.core.speech_filter}）的独特绘画风格。`,
          });
        } else {
          // User-created Custom Character
          const valuesStr = char.core?.values?.join('、') || '专属个性';
          const filter = char.core?.speech_filter || 'casual';
          const avatar = customAvatar || '🎨';

          let brush = { thinning: 0.5, smoothing: 0.7, jitter: 0.1, taperStart: 10, taperEnd: 10, size: 10 };
          if (filter === 'rough' || char.core?.instinct_base === 'attack') {
            brush = { thinning: 0.8, smoothing: 0.45, jitter: 0.25, taperStart: 6, taperEnd: 6, size: 11 };
          } else if (filter === 'gentle' || filter === 'formal') {
            brush = { thinning: 0.6, smoothing: 0.85, jitter: 0.05, taperStart: 16, taperEnd: 14, size: 9 };
          }

          result.push({
            id: char.character_id,
            name: char.name,
            avatar,
            title: `${char.name} · 专属自创`,
            tag: char.core?.values?.[0] || '自建角色',
            personality: valuesStr,
            paintingPersona: `自建角色「${char.name}」风格：${valuesStr}，说话语调：${filter}。${(char as any).custom_system_prompt || ''}`,
            brushParams: brush,
          });
        }
      });
    }
  } catch (err) {
    console.warn('Failed to load dynamic characters:', err);
  }

  // If no saved characters found, fallback to AI_ARTISTS
  return result.length > 0 ? result : AI_ARTISTS;
}

// -------------------------------------------------------------
// Helper functions for random selection
// -------------------------------------------------------------

/**
 * Randomly pick a secret word for AI to draw
 */
export function getRandomAiSecretWord(
  categoryId?: string,
  excludeWord?: string
): { word: string; category: string; hints: string[] } {
  let catList = WORD_CATEGORIES;
  if (categoryId && categoryId !== 'all') {
    const filtered = WORD_CATEGORIES.filter((c) => c.id === categoryId);
    if (filtered.length > 0) catList = filtered;
  }

  const allCandidates: { word: string; category: string; hints: string[] }[] = [];
  for (const cat of catList) {
    for (const w of cat.words) {
      if (w.text !== excludeWord) {
        allCandidates.push({
          word: w.text,
          category: cat.name,
          hints: w.hints,
        });
      }
    }
  }

  if (allCandidates.length > 0) {
    return allCandidates[Math.floor(Math.random() * allCandidates.length)];
  }

  const defaultCat = WORD_CATEGORIES[0];
  const defaultWord = defaultCat.words[0];
  return {
    word: defaultWord.text,
    category: defaultCat.name,
    hints: defaultWord.hints,
  };
}

/**
 * Randomly pick a word from category or across all categories for player to draw
 */
export function getRandomWord(categoryId?: string): { word: string; category: string; hints: string[] } {
  let catList = WORD_CATEGORIES;
  if (categoryId && categoryId !== 'all') {
    const filtered = WORD_CATEGORIES.filter((c) => c.id === categoryId);
    if (filtered.length > 0) catList = filtered;
  }
  const randomCat = catList[Math.floor(Math.random() * catList.length)];
  const randomItem = randomCat.words[Math.floor(Math.random() * randomCat.words.length)];
  return {
    word: randomItem.text,
    category: randomCat.name,
    hints: randomItem.hints,
  };
}

/**
 * Find AI artist profile by character id or fallback to first available
 */
export function getAiArtistById(charId?: string): AiArtistCharacter {
  const all = getAllPlayableArtists();
  if (!charId) return all[0] || AI_ARTISTS[0];
  const found = all.find((a) => a.id === charId || a.name === charId);
  return found || all[0] || AI_ARTISTS[0];
}
