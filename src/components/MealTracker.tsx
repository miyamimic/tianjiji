import { useEffect, useMemo, useState } from 'react';
import type { FoodLogEntry, MealType, FoodNutrition } from '../types';
import { MEAL_LABELS, MEAL_ORDER } from '../types';
import { getAllFoodLogs, deleteFoodLog } from '../lib/storage';
import { todayStr } from '../lib/foodSearch';
import FoodSearchModal from './FoodSearchModal';

interface Props {
  onUpdate?: () => void;
}

// 合并营养统计
function sumNutrition(a: FoodNutrition, b: FoodNutrition): FoodNutrition {
  return {
    calories: a.calories + b.calories,
    protein: (a.protein || 0) + (b.protein || 0),
    fat: (a.fat || 0) + (b.fat || 0),
    carbs: (a.carbs || 0) + (b.carbs || 0),
    fiber: (a.fiber || 0) + (b.fiber || 0),
    sugar: (a.sugar || 0) + (b.sugar || 0),
    sodium: (a.sodium || 0) + (b.sodium || 0),
  };
}

const EMPTY_NUT: FoodNutrition = { calories: 0 };

export default function MealTracker({ onUpdate }: Props) {
  const [allLogs, setAllLogs] = useState<FoodLogEntry[]>([]);
  const [activeDate, setActiveDate] = useState<string>(todayStr());
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMeal, setModalMeal] = useState<MealType>('breakfast');
  const [targetCal, setTargetCal] = useState<number>(1800);

  // 加载目标
  useEffect(() => {
    const t = Number(localStorage.getItem('ct_target_cal'));
    if (t && t > 0) setTargetCal(t);
  }, []);
  useEffect(() => {
    localStorage.setItem('ct_target_cal', String(targetCal));
  }, [targetCal]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const list = await getAllFoodLogs();
      setAllLogs(list);
      setLoading(false);
    })();
  }, []);

  const dateLogs = useMemo(
    () => allLogs.filter((l) => l.date === activeDate),
    [allLogs, activeDate]
  );

  const grouped = useMemo(() => {
    const m: Record<MealType, FoodLogEntry[]> = {
      breakfast: [],
      morningSnack: [],
      lunch: [],
      afternoonSnack: [],
      dinner: [],
      eveningSnack: [],
    };
    for (const l of dateLogs) {
      m[l.mealType] = m[l.mealType] || [];
      m[l.mealType].push(l);
    }
    for (const k of MEAL_ORDER) {
      m[k].sort((a, b) => a.createdAt - b.createdAt);
    }
    return m;
  }, [dateLogs]);

  const mealNutrition = useMemo(() => {
    const m: Record<MealType, FoodNutrition> = {
      breakfast: { calories: 0 },
      morningSnack: { calories: 0 },
      lunch: { calories: 0 },
      afternoonSnack: { calories: 0 },
      dinner: { calories: 0 },
      eveningSnack: { calories: 0 },
    };
    for (const k of MEAL_ORDER) {
      for (const log of grouped[k]) {
        m[k] = sumNutrition(m[k], log.nutrition);
      }
    }
    return m;
  }, [grouped]);

  const dailyNutrition = useMemo(() => {
    let total = EMPTY_NUT;
    for (const k of MEAL_ORDER) {
      total = sumNutrition(total, mealNutrition[k]);
    }
    return total;
  }, [mealNutrition]);

  const calPct = Math.min(100, Math.round((dailyNutrition.calories / targetCal) * 100));

  const openAddFor = (mt: MealType) => {
    setModalMeal(mt);
    setModalOpen(true);
  };

  const handleAdded = (entry: FoodLogEntry) => {
    setAllLogs((prev) => [...prev, entry]);
    onUpdate?.();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除这条记录？')) return;
    await deleteFoodLog(id);
    setAllLogs((prev) => prev.filter((l) => l.id !== id));
    onUpdate?.();
  };

  const shiftDate = (delta: number) => {
    const d = new Date(activeDate);
    d.setDate(d.getDate() + delta);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setActiveDate(`${y}-${m}-${day}`);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
          <span className="w-1.5 h-6 rounded-full bg-primary inline-block" />
          饮食记录
        </h2>

        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftDate(-1)}
            className="h-8 w-8 rounded-md bg-accent hover:bg-accent/70 flex items-center justify-center text-foreground"
            title="前一天"
          >
            ‹
          </button>
          <input
            type="date"
            value={activeDate}
            onChange={(e) => setActiveDate(e.target.value)}
            className="h-8 px-3 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            onClick={() => shiftDate(1)}
            className="h-8 w-8 rounded-md bg-accent hover:bg-accent/70 flex items-center justify-center text-foreground"
            title="后一天"
          >
            ›
          </button>
          <button
            onClick={() => setActiveDate(todayStr())}
            className="h-8 px-3 rounded-md bg-secondary text-secondary-foreground text-xs hover:opacity-90"
          >
            今天
          </button>
        </div>
      </div>

      {/* 当日总览 */}
      <div className="mb-5 p-4 rounded-xl bg-gradient-to-br from-primary/10 via-accent to-background border border-border">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <div>
              <div className="text-xs text-muted-foreground">今日摄入</div>
              <div className="text-3xl font-bold text-card-foreground mt-0.5">
                {Math.round(dailyNutrition.calories)}
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  / {targetCal} kcal
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">蛋白: </span>
              <span className="font-semibold text-card-foreground">
                {Math.round(dailyNutrition.protein || 0)}g
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">脂肪: </span>
              <span className="font-semibold text-card-foreground">
                {Math.round(dailyNutrition.fat || 0)}g
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">碳水: </span>
              <span className="font-semibold text-card-foreground">
                {Math.round(dailyNutrition.carbs || 0)}g
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-muted-foreground">目标</label>
              <input
                type="number"
                value={targetCal}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v > 0) setTargetCal(v);
                }}
                className="w-20 h-7 px-2 rounded-md bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
          </div>
        </div>

        {/* 进度条 */}
        <div className="mt-3 h-3 rounded-full bg-secondary overflow-hidden">
          <div
            className={
              'h-full transition-all duration-500 ' +
              (calPct >= 110
                ? 'bg-destructive'
                : calPct >= 90
                ? 'bg-warning'
                : 'bg-primary')
            }
            style={{ width: `${Math.min(100, calPct)}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>
            {calPct < 100
              ? `还差 ${Math.round(targetCal - dailyNutrition.calories)} kcal 达标`
              : `已超过 ${Math.round(dailyNutrition.calories - targetCal)} kcal`}
          </span>
          <span>{calPct}%</span>
        </div>
      </div>

      {/* 餐次 */}
      {loading ? (
        <div className="text-center text-sm text-muted-foreground py-10">加载中...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {MEAL_ORDER.map((mt) => (
            <MealSection
              key={mt}
              type={mt}
              entries={grouped[mt]}
              nutrition={mealNutrition[mt]}
              onAdd={() => openAddFor(mt)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <FoodSearchModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultMeal={modalMeal}
        onAdded={handleAdded}
      />
    </div>
  );
}

function MealSection({
  type,
  entries,
  nutrition,
  onAdd,
  onDelete,
}: {
  type: MealType;
  entries: FoodLogEntry[];
  nutrition: FoodNutrition;
  onAdd: () => void;
  onDelete: (id: string) => void;
}) {
  const iconMap: Record<MealType, string> = {
    breakfast: '🌅',
    morningSnack: '☕',
    lunch: '☀️',
    afternoonSnack: '🍵',
    dinner: '🌙',
    eveningSnack: '🌌',
  };

  return (
    <div className="border border-border rounded-xl p-4 bg-background/40 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{iconMap[type]}</span>
          <div>
            <div className="font-semibold text-card-foreground">
              {MEAL_LABELS[type]}
            </div>
            <div className="text-xs text-muted-foreground">
              {entries.length} 项 · {Math.round(nutrition.calories)} kcal
            </div>
          </div>
        </div>
        <button
          onClick={onAdd}
          className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 flex items-center gap-1"
        >
          <span>+</span>
          <span className="hidden sm:inline">添加</span>
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="py-5 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg flex-1">
          还没有记录 ·{' '}
          <button onClick={onAdd} className="text-primary hover:underline">
            现在添加
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => (
            <li
              key={e.id}
              className="flex items-start justify-between gap-3 p-2.5 rounded-lg bg-card border border-border/70 hover:border-primary/40 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-medium text-card-foreground truncate">
                    {e.foodName}
                  </span>
                  {e.brand && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground shrink-0">
                      {e.brand}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {e.servingLabel}（{e.grams}g）
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  <span className="text-primary font-semibold">
                    {Math.round(e.nutrition.calories)} kcal
                  </span>
                  {e.nutrition.protein != null && (
                    <span>蛋白 {e.nutrition.protein.toFixed(1)}g</span>
                  )}
                  {e.nutrition.fat != null && (
                    <span>脂肪 {e.nutrition.fat.toFixed(1)}g</span>
                  )}
                  {e.nutrition.carbs != null && (
                    <span>碳水 {e.nutrition.carbs.toFixed(1)}g</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => onDelete(e.id)}
                className="shrink-0 text-xs text-destructive hover:underline mt-1"
              >
                删除
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
