/**
 * 主页/全局自定义背景图的持久化：IndexedDB kv。
 * 此前存 localStorage——base64 墙纸几百 KB，叠加既有数据后极易触发
 * QuotaExceededError（且 vueuse 异步 flush 抛错连 toast 都走不到），挪进 IDB 后配额充裕。
 */

const DB_NAME = 'zephyrus-ui-assets';
const STORE = 'kv';
const KEY = 'home-background-image';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('indexedDB open failed'));
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = run(tx.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('indexedDB request failed'));
        tx.oncomplete = () => db.close();
        tx.onabort = () => {
          db.close();
          reject(tx.error || new Error('indexedDB transaction aborted'));
        };
      })
  );
}

export async function getStoredBackgroundImage(): Promise<string> {
  try {
    const value = await withStore<string>('readonly', (store) => store.get(KEY));
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}

export async function storeBackgroundImage(dataUrl: string): Promise<void> {
  await withStore('readwrite', (store) => store.put(dataUrl, KEY));
}

export async function removeStoredBackgroundImage(): Promise<void> {
  await withStore('readwrite', (store) => store.delete(KEY));
}
