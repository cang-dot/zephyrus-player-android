import type { ILyric } from '@/types/music';

interface ProviderLyricCacheEntry {
  cachedAt: number;
  lyric: ILyric;
  schemaVersion: 1;
}

const DB_NAME = 'zephyrus-provider-lyrics';
const STORE_NAME = 'lyrics';
const DB_VERSION = 1;
const CACHE_TTL_MS = 10 * 24 * 60 * 60 * 1000;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('逐字歌词缓存不可用'));
  });
  return dbPromise;
}

export async function readProviderLyricCache(
  key: string
): Promise<{ lyric: ILyric; fresh: boolean } | null> {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const database = await openDatabase();
    const cached = await new Promise<ProviderLyricCacheEntry | undefined>((resolve) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result as ProviderLyricCacheEntry | undefined);
      request.onerror = () => resolve(undefined);
    });
    if (cached?.schemaVersion !== 1 || !cached.lyric?.lrcArray?.length) return null;
    return {
      lyric: cached.lyric,
      fresh: Date.now() - cached.cachedAt < CACHE_TTL_MS
    };
  } catch {
    return null;
  }
}

export async function writeProviderLyricCache(key: string, lyric: ILyric): Promise<void> {
  if (typeof indexedDB === 'undefined' || !lyric.lrcArray.length) return;
  try {
    const database = await openDatabase();
    await new Promise<void>((resolve) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction
        .objectStore(STORE_NAME)
        .put(
          { schemaVersion: 1, cachedAt: Date.now(), lyric } satisfies ProviderLyricCacheEntry,
          key
        );
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
  } catch {
    // 缓存失败不能影响播放。
  }
}
