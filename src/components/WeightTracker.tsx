import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { WeightRecord } from '../types';
import { getAllWeights, saveWeight, deleteWeight } from '../lib/storage';
import { formatDateLabel, todayStr, uid } from '../lib/foodSearch';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

interface Props {
  onUpdate?: () => void;
}

export default function WeightTracker({ onUpdate }: Props) {
  const [records, setRecords] = useState<WeightRecord[]>([]);
  const [date, setDate] = useState<string>(todayStr());
  const [weight, setWeight] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitLock, setSubmitLock] = useState(false);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const list = await getAllWeights();
      setRecords(list);
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    if (records.length === 0)
      return { latest: null, min: null, max: null, delta: null };
    const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
    const latest = sorted[sorted.length - 1].weight;
    const weights = sorted.map((r) => r.weight);
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const delta = sorted.length >= 2 ? latest - sorted[0].weight : 0;
    return { latest, min, max, delta };
  }, [records]);

  const chartData = useMemo(() => {
    const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
    return {
      labels: sorted.map((r) => formatDateLabel(r.date)),
      datasets: [
        {
          label: '体重 (kg)',
          data: sorted.map((r) => r.weight),
          borderColor: 'hsl(28 85% 62%)',
          backgroundColor: 'hsla(28, 85%, 62%, 0.18)',
          fill: true,
          tension: 0.35,
          pointBackgroundColor: 'hsl(28 85% 62%)',
          pointBorderColor: 'hsl(222 28% 9%)',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };
  }, [records]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: false,
        },
        tooltip: {
          backgroundColor: 'hsl(220 22% 13%)',
          titleColor: 'hsl(210 15% 90%)',
          bodyColor: 'hsl(210 15% 90%)',
          borderColor: 'hsl(217 12% 22%)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (ctx: any) => `${ctx.parsed.y} kg`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'hsl(217 12% 22% / 0.4)' },
          ticks: { color: 'hsl(217 10% 55%)', maxRotation: 0, autoSkipPadding: 20 },
        },
        y: {
          grid: { color: 'hsl(217 12% 22% / 0.4)' },
          ticks: {
            color: 'hsl(217 10% 55%)',
            callback: (v: any) => `${v}kg`,
          },
          suggestedMin: stats.min != null ? Math.floor(stats.min - 1) : 40,
          suggestedMax: stats.max != null ? Math.ceil(stats.max + 1) : 100,
        },
      },
    }),
    [stats.min, stats.max]
  );

  const handleAdd = async () => {
    const w = parseFloat(weight);
    if (!w || w < 10 || w > 500) {
      alert('请输入正确的体重（千克）');
      return;
    }
    if (!date) return;
    if (submitLock) return;
    setSubmitLock(true);
    try {
      const existingIdx = records.findIndex((r) => r.date === date);
      const rec: WeightRecord = {
        id: existingIdx >= 0 ? records[existingIdx].id : uid(),
        date,
        weight: w,
        note: note.trim() || undefined,
        createdAt: existingIdx >= 0 ? records[existingIdx].createdAt : Date.now(),
      };
      await saveWeight(rec);
      // 更新本地
      setRecords((prev) => {
        const next = [...prev];
        const idx = next.findIndex((r) => r.date === date);
        if (idx >= 0) next[idx] = rec;
        else next.push(rec);
        next.sort((a, b) => a.date.localeCompare(b.date));
        return next;
      });
      setWeight('');
      setNote('');
      onUpdate?.();
    } finally {
      setSubmitLock(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除这条记录吗？')) return;
    await deleteWeight(id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
    onUpdate?.();
  };

  const reverseList = useMemo(
    () => [...records].sort((a, b) => b.date.localeCompare(a.date)),
    [records]
  );

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
          <span className="w-1.5 h-6 rounded-full bg-primary inline-block" />
          体重记录
        </h2>
        {stats.latest != null && (
          <div className="text-sm text-muted-foreground flex items-center gap-3">
            <span>
              最新：<span className="text-primary font-semibold">{stats.latest}</span> kg
            </span>
            {stats.delta != null && (
              <span
                className={
                  stats.delta < 0
                    ? 'text-success'
                    : stats.delta > 0
                    ? 'text-warning'
                    : 'text-muted-foreground'
                }
              >
                {stats.delta > 0 ? '+' : ''}
                {stats.delta.toFixed(1)} kg
              </span>
            )}
          </div>
        )}
      </div>

      {/* 输入框 */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-5">
        <div className="md:col-span-3">
          <label className="text-xs text-muted-foreground mb-1 block">日期</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full h-10 px-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="md:col-span-3">
          <label className="text-xs text-muted-foreground mb-1 block">体重 (kg)</label>
          <input
            type="number"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="例如: 58.3"
            className="w-full h-10 px-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="md:col-span-4">
          <label className="text-xs text-muted-foreground mb-1 block">备注 (可选)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例如: 早起空腹"
            className="w-full h-10 px-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="md:col-span-2 flex items-end">
          <button
            onClick={handleAdd}
            disabled={submitLock || !weight}
            className="w-full h-10 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            记录
          </button>
        </div>
      </div>

      {/* 图表 */}
      <div className="mb-4">
        {loading ? (
          <div className="h-60 flex items-center justify-center text-muted-foreground">
            加载中...
          </div>
        ) : records.length === 0 ? (
          <div className="h-60 flex flex-col items-center justify-center text-muted-foreground border border-dashed border-border rounded-lg">
            <p className="mb-1">暂无体重记录</p>
            <p className="text-xs">记录第一次体重，开始你的健康追踪吧</p>
          </div>
        ) : (
          <div className="h-64 w-full">
            <Line ref={chartRef} data={chartData} options={chartOptions} />
          </div>
        )}
      </div>

      {/* 记录列表 */}
      {reverseList.length > 0 && (
        <div className="mt-4 border-t border-border pt-4 max-h-56 overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-xs">
              <tr>
                <th className="text-left py-2 px-2 font-medium">日期</th>
                <th className="text-right py-2 px-2 font-medium">体重</th>
                <th className="text-left py-2 px-2 font-medium hidden md:table-cell">备注</th>
                <th className="text-right py-2 px-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {reverseList.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-border/60 hover:bg-accent/30 transition-colors"
                >
                  <td className="py-2 px-2 text-card-foreground">{r.date}</td>
                  <td className="py-2 px-2 text-right font-medium text-primary">
                    {r.weight} kg
                  </td>
                  <td className="py-2 px-2 text-muted-foreground hidden md:table-cell truncate max-w-xs">
                    {r.note || '-'}
                  </td>
                  <td className="py-2 px-2 text-right">
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-xs text-destructive hover:underline"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
