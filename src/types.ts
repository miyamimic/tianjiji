// 体重记录
export interface WeightRecord {
  id: string;
  date: string; // YYYY-MM-DD
  weight: number; // kg
  note?: string;
  createdAt: number;
}

// 餐次类型
export type MealType =
  | 'breakfast' // 早餐
  | 'morningSnack' // 早加餐
  | 'lunch' // 午餐
  | 'afternoonSnack' // 午加餐
  | 'dinner' // 晚餐
  | 'eveningSnack'; // 晚加餐

// 食物营养信息
export interface FoodNutrition {
  calories: number; // 千卡 kcal
  protein?: number; // 克
  fat?: number; // 克
  carbs?: number; // 克
  fiber?: number; // 克
  sugar?: number; // 克
  sodium?: number; // 毫克
}

// 搜索到的食物条目
export interface FoodItem {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  // 默认份量描述 (例如: "一盒 250ml", "一个 150g")
  defaultServing: string;
  // 默认份量克数 (用于换算)
  defaultGrams: number;
  // 每100克/毫升营养
  nutritionPer100g: FoodNutrition;
  // 来源: local 本地数据库 / api 网络搜索
  source: 'local' | 'api';
}

// 饮食记录 (用户吃了什么)
export interface FoodLogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  mealType: MealType;
  foodId: string;
  foodName: string;
  brand?: string;
  // 实际食用份量 (克数)
  grams: number;
  // 记录当时的份量描述
  servingLabel: string;
  // 实际摄入营养
  nutrition: FoodNutrition;
  createdAt: number;
}

// 餐次标签映射
export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: '早餐',
  morningSnack: '早加餐',
  lunch: '午餐',
  afternoonSnack: '午加餐',
  dinner: '晚餐',
  eveningSnack: '晚加餐',
};

// 餐次排序
export const MEAL_ORDER: MealType[] = [
  'breakfast',
  'morningSnack',
  'lunch',
  'afternoonSnack',
  'dinner',
  'eveningSnack',
];
