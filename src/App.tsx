import { useRef, useState } from 'react';
import WeightTracker from './components/WeightTracker';
import MealTracker from './components/MealTracker';
import { exportData, importData } from './lib/storage';
import type { BackupData } from './lib/storage';

type Tab = 'diet' | 'weight' | 'data';

export default function App() {
  const [tab, setTab] = useState<Tab>('diet');
  const [refreshKey, setRefreshKey] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<string>('');

  const bump = () => setRefreshKey((k) => k + 1);

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(
      2,
      '0'
    )}${String(d.getDate()).padStart(2, '0')}`;
    a.download = `饮食追踪备份_${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    setImportMsg('');
    fileRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const text = await f.text();
      const data = JSON.parse(text) as BackupData;
      if (!confirm('导入后将覆盖当前全部数据，确认继续吗？')) return;
      await importData(data);
      setImportMsg('✅ 导入成功！');
      bump();
      setTimeout(() => setImportMsg(''), 3000);
    } catch (err) {
      setImportMsg('❌ 导入失败：' + (err as Error).message);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground overflow-x-hidden">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-30 backdrop-blur-lg bg-background/80 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-xl shadow-lg shadow-primary/20">
              🍎
            </div>
            <div>
              <h1 className="text-base md:text-lg font-bold text-card-foreground">
                饮食热量追踪
              </h1>
              <p className="text-[11px] text-muted-foreground -mt-0.5">
                记录体重 · 六餐热量 · 本地缓存 · 联网查热量
              </p>
            </div>
          </div>

          {/* 标签导航 */}
          <nav className="flex items-center gap-1 p-1 rounded-xl bg-card border border-border">
            <TabBtn
              active={tab === 'diet'}
              onClick={() => setTab('diet')}
              label="🥗 今日饮食"
            />
            <TabBtn
              active={tab === 'weight'}
              onClick={() => setTab('weight')}
              label="⚖️ 体重曲线"
            />
            <TabBtn
              active={tab === 'data'}
              onClick={() => setTab('data')}
              label="💾 数据备份"
            />
          </nav>
        </div>
      </header>

      {/* 内容区 */}
      <main className="max-w-6xl mx-auto px-4 py-6 pb-16">
        {tab === 'diet' && <MealTracker key={`m-${refreshKey}`} onUpdate={bump} />}
        {tab === 'weight' && (
          <WeightTracker key={`w-${refreshKey}`} onUpdate={bump} />
        )}
        {tab === 'data' && (
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2 mb-4">
              <span className="w-1.5 h-6 rounded-full bg-primary inline-block" />
              数据备份与恢复
            </h2>

            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              你的所有数据默认保存在浏览器本地（localStorage + IndexedDB
              双重存储，稳定性更高）。
              为了避免清理浏览器缓存导致记录丢失，强烈建议定期导出备份文件保存到本地。
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="p-5 rounded-xl border border-border bg-background/40">
                <h3 className="font-semibold text-card-foreground mb-2 flex items-center gap-2">
                  <span>📤</span> 导出备份
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  将所有体重记录和饮食记录打包导出为 JSON 文件，可以保存到网盘或硬盘。
                </p>
                <button
                  onClick={handleExport}
                  className="w-full h-10 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
                >
                  导出 JSON 文件
                </button>
              </div>

              <div className="p-5 rounded-xl border border-border bg-background/40">
                <h3 className="font-semibold text-card-foreground mb-2 flex items-center gap-2">
                  <span>📥</span> 导入备份
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  选择之前导出的 JSON 文件进行恢复，将覆盖当前所有记录。
                </p>
                <button
                  onClick={handleImportClick}
                  className="w-full h-10 rounded-lg bg-secondary text-secondary-foreground font-medium hover:opacity-90 transition-opacity border border-border"
                >
                  选择 JSON 导入
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleFile}
                />
                {importMsg && (
                  <p className="mt-2 text-xs text-center text-foreground">
                    {importMsg}
                  </p>
                )}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-dashed border-border text-sm text-muted-foreground leading-relaxed">
              <div className="font-medium text-card-foreground mb-1">
                🔐 关于数据安全
              </div>
              本应用不会上传你的任何个人记录到任何服务器（食物搜索会调用公开营养数据库查询热量，不会包含你的个人信息）。
              所有记录只保存在你自己的浏览器中，因此清除浏览器数据会导致记录丢失，
              <span className="text-primary"> 请一定定期备份导出文件</span>。
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        🍃 希望记录每一天的你，越来越健康。数据保存在本地，请记得定期备份。
      </footer>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={
        'px-3 md:px-4 h-8 text-sm rounded-lg transition-colors whitespace-nowrap ' +
        (active
          ? 'bg-primary text-primary-foreground font-medium shadow-md shadow-primary/20'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent')
      }
    >
      {label}
    </button>
  );
}
