import type { WeightRecord, FoodLogEntry } from '../types';

// ==================== IndexedDB 封装 ====================
const DB_NAME = 'CalorieTrackerDB';
const DB_VERSION = 1;

const STORE_WEIGHTS = 'weights';
const STORE_FOOD_LOGS = 'foodLogs';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_WEIGHTS)) {
        const store = db.createObjectStore(STORE_WEIGHTS, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_FOOD_LOGS)) {
        const store = db.createObjectStore(STORE_FOOD_LOGS, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('mealType', 'mealType', { unique: false });
      }
    };
  });
}

function tx<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const req = work(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

// ==================== localStorage Key 常量 ====================
const LS_WEIGHTS = 'ct_weights_v1';
const LS_FOOD_LOGS = 'ct_foodlogs_v1';
const LS_META = 'ct_meta_v1';

interface Meta {
  lastSyncAt: number;
}

function loadLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveLS<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded, ignore */
  }
}

// ==================== 权重记录 ====================
export async function saveWeight(record: WeightRecord): Promise<void> {
  // 1. localStorage
  const all = loadLS<WeightRecord[]>(LS_WEIGHTS, []);
  const idx = all.findIndex((r) => r.date === record.date);
  if (idx >= 0) all[idx] = record;
  else all.push(record);
  all.sort((a, b) => a.date.localeCompare(b.date));
  saveLS(LS_WEIGHTS, all);

  // 2. IndexedDB (best effort)
  try {
    const db = await openDB();
    await tx(db, STORE_WEIGHTS, 'readwrite', (s) => s.put(record));
  } catch {
    /* ignore */
  }

  // 3. meta
  saveLS<Meta>(LS_META, { lastSyncAt: Date.now() });
}

export async function deleteWeight(id: string): Promise<void> {
  const all = loadLS<WeightRecord[]>(LS_WEIGHTS, []);
  const filtered = all.filter((r) => r.id !== id);
  saveLS(LS_WEIGHTS, filtered);
  try {
    const db = await openDB();
    await tx(db, STORE_WEIGHTS, 'readwrite', (s) => s.delete(id));
  } catch {
    /* ignore */
  }
}

export async function getAllWeights(): Promise<WeightRecord[]> {
  // 优先 localStorage
  const ls = loadLS<WeightRecord[]>(LS_WEIGHTS, []);
  if (ls.length > 0) return ls;
  // 回退 IndexedDB
  try {
    const db = await openDB();
    const all = await tx<WeightRecord[]>(db, STORE_WEIGHTS, 'readonly', (s) =>
      s.getAll()
    );
    all.sort((a, b) => a.date.localeCompare(b.date));
    // 同步回 localStorage
    saveLS(LS_WEIGHTS, all);
    return all;
  } catch {
    return [];
  }
}

// ==================== 饮食记录 ====================
export async function saveFoodLog(entry: FoodLogEntry): Promise<void> {
  const all = loadLS<FoodLogEntry[]>(LS_FOOD_LOGS, []);
  all.push(entry);
  saveLS(LS_FOOD_LOGS, all);
  try {
    const db = await openDB();
    await tx(db, STORE_FOOD_LOGS, 'readwrite', (s) => s.put(entry));
  } catch {
    /* ignore */
  }
}

export async function deleteFoodLog(id: string): Promise<void> {
  const all = loadLS<FoodLogEntry[]>(LS_FOOD_LOGS, []);
  const filtered = all.filter((r) => r.id !== id);
  saveLS(LS_FOOD_LOGS, filtered);
  try {
    const db = await openDB();
    await tx(db, STORE_FOOD_LOGS, 'readwrite', (s) => s.delete(id));
  } catch {
    /* ignore */
  }
}

export async function getAllFoodLogs(): Promise<FoodLogEntry[]> {
  const ls = loadLS<FoodLogEntry[]>(LS_FOOD_LOGS, []);
  if (ls.length > 0) return ls;
  try {
    const db = await openDB();
    const all = await tx<FoodLogEntry[]>(db, STORE_FOOD_LOGS, 'readonly', (s) =>
      s.getAll()
    );
    saveLS(LS_FOOD_LOGS, all);
    return all;
  } catch {
    return [];
  }
}

// ==================== 导出/导入 (用于备份) ====================
export interface BackupData {
  version: 1;
  exportedAt: number;
  weights: WeightRecord[];
  foodLogs: FoodLogEntry[];
}

export function exportData(): BackupData {
  return {
    version: 1,
    exportedAt: Date.now(),
    weights: loadLS<WeightRecord[]>(LS_WEIGHTS, []),
    foodLogs: loadLS<FoodLogEntry[]>(LS_FOOD_LOGS, []),
  };
}

export async function importData(data: BackupData): Promise<void> {
  if (!data || data.version !== 1) throw new Error('备份数据格式不正确');
  saveLS(LS_WEIGHTS, data.weights);
  saveLS(LS_FOOD_LOGS, data.foodLogs);
  // 同步写入 IndexedDB
  try {
    const db = await openDB();
    for (const w of data.weights) {
      await tx(db, STORE_WEIGHTS, 'readwrite', (s) => s.put(w));
    }
    for (const f of data.foodLogs) {
      await tx(db, STORE_FOOD_LOGS, 'readwrite', (s) => s.put(f));
    }
  } catch {
    /* ignore */
  }
}
