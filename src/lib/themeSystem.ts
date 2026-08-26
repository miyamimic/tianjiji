// Stardew Valley Pastel French / Cute Puppy & Flower Lace Theme System
export type ThemePalette = 'french_pastel' | 'stardew_cottage' | 'puppy_lace' | 'lavender_mist' | 'creamy_peach' | 'midnight_noir';

export interface ThemeConfig {
  id: ThemePalette;
  name: string;
  subname: string;
  description: string;
  isLight: boolean;
  grainIntensity: number; // 0 to 1
  flowerLaceStyle: boolean;
  puppyMascot: boolean;
  bgGradient: string;
  primaryColor: string; // hsl or hex
  cardBg: string;
  borderStyle: string;
  bubbleUser: string;
  bubbleAi: string;
  fontClass: string;
}

export const THEME_STORAGE_KEY = '__tianjiji_theme_config';
export const GRAIN_ACTIVE_KEY = '__tianjiji_grain_active';
export const LACE_EMBOSS_KEY = '__tianjiji_lace_emboss';
export const PUPPY_ELEMENTS_KEY = '__tianjiji_puppy_elements';
export const ART_FONT_KEY = '__tianjiji_art_font_style';

export const THEME_PRESETS: Record<ThemePalette, ThemeConfig> = {
  french_pastel: {
    id: 'french_pastel',
    name: '轻法式浅粉',
    subname: 'French Pastel Rose',
    description: '星露谷浅色系、法式浮雕蕾丝与奶杏蔷薇粉',
    isLight: true,
    grainIntensity: 0.28,
    flowerLaceStyle: true,
    puppyMascot: true,
    bgGradient: 'from-[#fff5f6] via-[#fdf2f4] to-[#f7e8ec]',
    primaryColor: '#e07a93',
    cardBg: 'rgba(255, 255, 255, 0.72)',
    borderStyle: 'border-[#f2d0d9]',
    bubbleUser: 'linear-gradient(135deg, #fce7eb 0%, #f7d4dc 100%)',
    bubbleAi: 'rgba(255, 255, 255, 0.85)',
    fontClass: 'font-serif',
  },
  stardew_cottage: {
    id: 'stardew_cottage',
    name: '星露谷农庄麦香',
    subname: 'Stardew Sun Cottage',
    description: '像素复古浅麦黄、木栅栏雏菊与小狗田园',
    isLight: true,
    grainIntensity: 0.32,
    flowerLaceStyle: true,
    puppyMascot: true,
    bgGradient: 'from-[#fef9eb] via-[#faf2da] to-[#f4e8c5]',
    primaryColor: '#d97706',
    cardBg: 'rgba(255, 253, 245, 0.8)',
    borderStyle: 'border-[#ebd7a0]',
    bubbleUser: 'linear-gradient(135deg, #fef0c7 0%, #fae29c 100%)',
    bubbleAi: 'rgba(255, 255, 255, 0.88)',
    fontClass: 'font-sans',
  },
  puppy_lace: {
    id: 'puppy_lace',
    name: '线条小狗蕾丝',
    subname: 'Puppy & Lace Embroidery',
    description: '可爱线条马尔济斯小狗、花朵浮雕刺绣与奶油白',
    isLight: true,
    grainIntensity: 0.35,
    flowerLaceStyle: true,
    puppyMascot: true,
    bgGradient: 'from-[#faf7f2] via-[#f5ede4] to-[#ede3d5]',
    primaryColor: '#c28564',
    cardBg: 'rgba(255, 255, 255, 0.82)',
    borderStyle: 'border-[#e4d3c2]',
    bubbleUser: 'linear-gradient(135deg, #f5e6d6 0%, #ebd7c1 100%)',
    bubbleAi: 'rgba(255, 255, 255, 0.9)',
    fontClass: 'font-serif',
  },
  lavender_mist: {
    id: 'lavender_mist',
    name: '法式薰衣草雾',
    subname: 'French Lavender Mist',
    description: '浅粉紫薄雾、鸢尾花蕾丝与梦幻像素星光',
    isLight: true,
    grainIntensity: 0.25,
    flowerLaceStyle: true,
    puppyMascot: true,
    bgGradient: 'from-[#f8f5ff] via-[#f1ecfc] to-[#e6def7]',
    primaryColor: '#9366d4',
    cardBg: 'rgba(255, 255, 255, 0.78)',
    borderStyle: 'border-[#dacbf2]',
    bubbleUser: 'linear-gradient(135deg, #ede4fc 0%, #ded0f7 100%)',
    bubbleAi: 'rgba(255, 255, 255, 0.88)',
    fontClass: 'font-serif',
  },
  creamy_peach: {
    id: 'creamy_peach',
    name: '奶油桃粉浮雕',
    subname: 'Creamy Peach Camellia',
    description: '山茶花浮雕边框、蜜桃淡粉与柔美手写艺术字',
    isLight: true,
    grainIntensity: 0.26,
    flowerLaceStyle: true,
    puppyMascot: true,
    bgGradient: 'from-[#fff8f5] via-[#fdede6] to-[#fce0d4]',
    primaryColor: '#e0735b',
    cardBg: 'rgba(255, 255, 255, 0.8)',
    borderStyle: 'border-[#f7ccbd]',
    bubbleUser: 'linear-gradient(135deg, #fee5db 0%, #fad0c0 100%)',
    bubbleAi: 'rgba(255, 255, 255, 0.88)',
    fontClass: 'font-serif',
  },
  midnight_noir: {
    id: 'midnight_noir',
    name: '经典暗夜星空',
    subname: 'Midnight Noir Retro',
    description: '原版沉浸式深夜酒吧与星空暗色调',
    isLight: false,
    grainIntensity: 0.15,
    flowerLaceStyle: false,
    puppyMascot: false,
    bgGradient: 'from-[#10131c] via-[#0d1017] to-[#07090e]',
    primaryColor: '#f97316',
    cardBg: 'rgba(22, 27, 38, 0.7)',
    borderStyle: 'border-white/10',
    bubbleUser: 'linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, rgba(249, 115, 22, 0.05) 100%)',
    bubbleAi: 'rgba(22, 27, 38, 0.7)',
    fontClass: 'font-sans',
  }
};

export function loadCurrentTheme(): ThemePalette {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemePalette;
    if (saved && THEME_PRESETS[saved]) {
      return saved;
    }
  } catch {
    // ignore
  }
  return 'french_pastel'; // Default to modern French Pastel Stardew
}

export function saveCurrentTheme(theme: ThemePalette): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    window.dispatchEvent(new CustomEvent('tianjiji_theme_changed', { detail: { theme } }));
  } catch {
    // ignore
  }
}

export function loadPuppyEnabled(): boolean {
  try {
    const saved = localStorage.getItem(PUPPY_ELEMENTS_KEY);
    return saved !== null ? saved === 'true' : true;
  } catch {
    return true;
  }
}

export function savePuppyEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(PUPPY_ELEMENTS_KEY, String(enabled));
    window.dispatchEvent(new CustomEvent('tianjiji_theme_elements_changed'));
  } catch {
    // ignore
  }
}

export function loadLaceEmbossEnabled(): boolean {
  try {
    const saved = localStorage.getItem(LACE_EMBOSS_KEY);
    return saved !== null ? saved === 'true' : true;
  } catch {
    return true;
  }
}

export function saveLaceEmbossEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(LACE_EMBOSS_KEY, String(enabled));
    window.dispatchEvent(new CustomEvent('tianjiji_theme_elements_changed'));
  } catch {
    // ignore
  }
}

export function loadGrainIntensity(): number {
  try {
    const saved = localStorage.getItem(GRAIN_ACTIVE_KEY);
    if (saved !== null) {
      const num = parseFloat(saved);
      if (!isNaN(num)) return num;
    }
  } catch {
    // ignore
  }
  return 0.3; // Default 30% subtle fine grain noise
}

export function saveGrainIntensity(intensity: number): void {
  try {
    localStorage.setItem(GRAIN_ACTIVE_KEY, String(intensity));
    window.dispatchEvent(new CustomEvent('tianjiji_theme_elements_changed'));
  } catch {
    // ignore
  }
}
