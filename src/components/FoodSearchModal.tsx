import { useEffect, useMemo, useRef, useState } from 'react';
import type { FoodItem, MealType, FoodLogEntry } from '../types';
import { MEAL_LABELS } from '../types';
import { searchFoods, calcNutrition, uid, todayStr } from '../lib/foodSearch';
import { saveFoodLog } from '../lib/storage';

interface Props {
  open: boolean;
  onClose: () => void;
  defaultMeal: MealType;
  onAdded: (entry: FoodLogEntry) => void;
}

export default function FoodSearchModal({
  open,
  onClose,
  defaultMeal,
  onAdded,
}: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [grams, setGrams] = useState<number>(100);
  const [mealType, setMealType] = useState<MealType>(defaultMeal);
  const [date, setDate] = useState<string>(todayStr());
  const [saving, setSaving] = useState(false);
  const searchTimer = useRef<number | null>(null);
  const didInitialLoad = useRef(false);

  // 每次打开重置
  useEffect(() => {
    if (open) {
      setMealType(defaultMeal);
      setSelectedFood(null);
      setGrams(100);
      setDate(todayStr());
      if (!didInitialLoad.current) {
        didInitialLoad.current = true;
        // 初始加载一些常见食物
        setLoading(true);
        searchFoods('', { useNetwork: false })
          .then((r) => setResults(r))
          .finally(() => setLoading(false));
      }
    }
  }, [open, defaultMeal]);

  // 搜索防抖
  useEffect(() => {
    if (!open) return;
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    if (query === '') {
      // 空查询：只显示本地常见食物
      searchFoods('', { useNetwork: false }).then((r) => setResults(r));
      return;
    }
    setLoading(true);
    searchTimer.current = window.setTimeout(async () => {
      try {
        const res = await searchFoods(query);
        setResults(res);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    };
  }, [query, open]);

  const previewNutrition = useMemo(() => {
    if (!selectedFood) return null;
    return calcNutrition(selectedFood.nutritionPer100g, grams);
  }, [selectedFood, grams]);

  const handleSelectFood = (item: FoodItem) => {
    setSelectedFood(item);
    setGrams(item.defaultGrams || 100);
  };

  const handleServingPreset = (ratio: number) => {
    if (!selectedFood) return;
    const g = Math.round((selectedFood.defaultGrams || 100) * ratio);
    setGrams(g);
  };

  const handleAdd = async () => {
    if (!selectedFood || !previewNutrition || saving) return;
    if (grams <= 0) {
      alert('份量必须大于 0');
      return;
    }
    setSaving(true);
    try {
      const entry: FoodLogEntry = {
        id: uid(),
        date,
        mealType,
        foodId: selectedFood.id,
        foodName: selectedFood.name,
        brand: selectedFood.brand,
        grams,
        servingLabel:
          selectedFood.defaultGrams &&
          Math.abs(grams - selectedFood.defaultGrams) < 0.5
            ? selectedFood.defaultServing
            : `${grams}g`,
        nutrition: previewNutrition,
        createdAt: Date.now(),
      };
      await saveFoodLog(entry);
      onAdded(entry);
      setSelectedFood(null);
      setQuery('');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-lg font-semibold text-card-foreground">
              添加饮食记录
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              搜索食物（支持在线查询），选择份量后记录到对应餐次
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-accent"
            aria-label="关闭"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* 搜索条 + 餐次选择 */}
        <div className="px-5 pt-4 pb-2 grid grid-cols-1 md:grid-cols-12 gap-3 border-b border-border">
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">日期</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">餐次</label>
            <select
              value={mealType}
              onChange={(e) => setMealType(e.target.value as MealType)}
              className="w-full h-9 px-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
            >
              {(Object.keys(MEAL_LABELS) as MealType[]).map((k) => (
                <option key={k} value={k}>
                  {MEAL_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-8">
            <label className="text-xs text-muted-foreground mb-1 block">
              搜索食物（牛奶 / 苹果 / 肯德基 / 星巴克...）
            </label>
            <div className="relative">
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="输入食物名称，例如: 三元牛奶"
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* 主体：左侧结果列表，右侧详情 */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-border">
          {/* 搜索结果 */}
          <div className="md:col-span-3 overflow-auto p-3 max-h-[45vh] md:max-h-none">
            {loading && (
              <div className="text-center text-sm text-muted-foreground py-6">
                搜索中...
              </div>
            )}
            {!loading && results.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-8">
                没找到“{query}”的热量数据
                <div className="mt-2 text-xs">
                  你可以在下方详情中手动输入食物名称和热量
                </div>
              </div>
            )}
            <ul className="space-y-2">
              {results.map((item) => {
                const cal100 = item.nutritionPer100g.calories;
                const active = selectedFood?.id === item.id;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => handleSelectFood(item)}
                      className={
                        'w-full text-left p-3 rounded-lg border transition-colors ' +
                        (active
                          ? 'bg-primary/10 border-primary/50 ring-1 ring-primary/40'
                          : 'bg-background border-border hover:border-primary/40 hover:bg-accent/40')
                      }
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-foreground text-sm truncate">
                            {item.name}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1 text-xs">
                            {item.brand && (
                              <span className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                                {item.brand}
                              </span>
                            )}
                            {item.category && (
                              <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                {item.category}
                              </span>
                            )}
                            <span
                              className={
                                'px-1.5 py-0.5 rounded ' +
                                (item.source === 'local'
                                  ? 'bg-success/20 text-success'
                                  : 'bg-accent text-accent-foreground')
                              }
                            >
                              {item.source === 'local' ? '本地' : '网络'}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-semibold text-primary">
                            {cal100} <span className="text-xs font-normal text-muted-foreground">kcal/100g</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {item.defaultServing}
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* 份量 & 营养 */}
          <div className="md:col-span-2 p-4 overflow-auto flex flex-col">
            {!selectedFood && (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground text-sm px-4">
                <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center mb-3">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-muted-foreground">
                    <path d="M12 2C9 2 7 4 7 7v2H5a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2v4a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-4h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-2V7c0-3-2-5-5-5Z" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="font-medium text-card-foreground mb-1">选择一种食物</p>
                <p className="text-xs">
                  在左侧搜索并点选食物，然后在这里调整份量，最后保存
                </p>
              </div>
            )}

            {selectedFood && previewNutrition && (
              <div className="flex flex-col h-full">
                <div className="mb-3">
                  <div className="font-semibold text-card-foreground">
                    {selectedFood.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {selectedFood.brand || selectedFood.category || ''}
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-muted-foreground">食用份量（克 / 毫升）</label>
                    <span className="text-xs text-muted-foreground">
                      默认: {selectedFood.defaultServing}
                    </span>
                  </div>
                  <input
                    type="number"
                    min={0.1}
                    step={1}
                    value={grams}
                    onChange={(e) => setGrams(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full h-10 px-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-base font-semibold"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      onClick={() => handleServingPreset(0.5)}
                      className="px-2.5 py-1 text-xs rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    >
                      半份
                    </button>
                    <button
                      onClick={() => handleServingPreset(1)}
                      className="px-2.5 py-1 text-xs rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    >
                      1份
                    </button>
                    <button
                      onClick={() => handleServingPreset(1.5)}
                      className="px-2.5 py-1 text-xs rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    >
                      1.5份
                    </button>
                    <button
                      onClick={() => handleServingPreset(2)}
                      className="px-2.5 py-1 text-xs rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    >
                      2份
                    </button>
                    <button
                      onClick={() => setGrams(100)}
                      className="px-2.5 py-1 text-xs rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    >
                      100g
                    </button>
                  </div>
                </div>

                {/* 营养预览 */}
                <div className="border border-border rounded-xl p-3 bg-background/50 mb-4">
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-xs text-muted-foreground">本份热量</span>
                    <span className="text-2xl font-bold text-primary">
                      {Math.round(previewNutrition.calories)}
                      <span className="text-sm font-normal text-muted-foreground ml-1">
                        kcal
                      </span>
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <Nutrient label="蛋白" value={previewNutrition.protein} unit="g" />
                    <Nutrient label="脂肪" value={previewNutrition.fat} unit="g" />
                    <Nutrient label="碳水" value={previewNutrition.carbs} unit="g" />
                  </div>
                  {previewNutrition.fiber != null || previewNutrition.sugar != null || previewNutrition.sodium != null ? (
                    <div className="grid grid-cols-3 gap-2 text-center mt-2 pt-2 border-t border-border/60">
                      <Nutrient label="纤维" value={previewNutrition.fiber} unit="g" />
                      <Nutrient label="糖" value={previewNutrition.sugar} unit="g" />
                      <Nutrient label="钠" value={previewNutrition.sodium} unit="mg" />
                    </div>
                  ) : null}
                </div>

                <div className="mt-auto">
                  <button
                    onClick={handleAdd}
                    disabled={saving || grams <= 0}
                    className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                  >
                    {saving ? '保存中...' : `记录到 ${MEAL_LABELS[mealType]}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Nutrient({
  label,
  value,
  unit,
}: {
  label: string;
  value?: number;
  unit: string;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold text-card-foreground">
        {value != null ? (value > 10 ? Math.round(value) : value.toFixed(1)) : '-'}
        {value != null ? <span className="text-xs text-muted-foreground ml-0.5 font-normal">{unit}</span> : null}
      </div>
    </div>
  );
}
