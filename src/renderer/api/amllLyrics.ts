/** AMLL TTML DataBase client with cache and mirror fallback. */

import { parseTtml, type TtmlLyric } from '@/services/ttmlParser';
import type { SongResult } from '@/types/music';

export type AmllPlatform = 'netease' | 'qq' | 'spotify' | 'appleMusic';

export interface AmllSongSource {
  platform: AmllPlatform;
  songId: string;
}

const RAW_BASE = 'https://raw.githubusercontent.com/amll-dev/amll-ttml-db/refs/heads/main';
const JSDELIVR_BASE = 'https://cdn.jsdelivr.net/gh/amll-dev/amll-ttml-db@main';
const COMMUNITY_MIRROR_BASE = 'https://amlldb.bikonoo.com';
const DB_NAME = 'zephyrus-cache';
const STORE_NAME = 'amll-ttml';
const DB_VERSION = 2;

const PLATFORM_FOLDERS: Record<AmllPlatform, string> = {
  netease: 'ncm-lyrics',
  qq: 'qq-lyrics',
  spotify: 'spotify-lyrics',
  appleMusic: 'am-lyrics'
};

let dbInstance: IDBDatabase | null = null;

function normalizePlatform(platform?: string): AmllPlatform | null {
  const value = String(platform || '').toLowerCase();
  if (value === 'netease' || value === 'ncm' || value === '163') return 'netease';
  if (value === 'qq' || value === 'tencent') return 'qq';
  if (value === 'spotify') return 'spotify';
  if (value === 'apple' || value === 'applemusic' || value === 'apple_music' || value === 'am') {
    return 'appleMusic';
  }
  return null;
}

export function resolveAmllSource(
  song: Pick<SongResult, 'id' | 'platform' | 'platformId'>
): AmllSongSource | null {
  const platform = normalizePlatform(song.platform || 'netease');
  if (!platform) return null;
  const songId = platform === 'netease' ? song.platformId || song.id : song.platformId;
  if (songId === undefined || songId === null || String(songId).trim() === '') return null;
  return { platform, songId: String(songId) };
}

function openDb(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'));

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };
    request.onerror = () => reject(request.error || new Error('Failed to open lyric cache'));
  });
}

async function getCached(key: string): Promise<TtmlLyric | null> {
  try {
    const database = await openDb();
    return await new Promise((resolve) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve((request.result as TtmlLyric | undefined) || null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function setCached(key: string, value: TtmlLyric): Promise<void> {
  try {
    const database = await openDb();
    await new Promise<void>((resolve) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
  } catch {
    // Cache failures must never prevent playback.
  }
}

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    const text = await response.text();
    return text.includes('<tt') ? text : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

function sourceUrls(source: AmllSongSource): string[] {
  const folder = PLATFORM_FOLDERS[source.platform];
  const id = encodeURIComponent(source.songId);
  const mirrorPath =
    source.platform === 'netease' ? `ncm-lyrics/${id}.ttml` : `${folder}/${id}.ttml`;
  return [
    `${RAW_BASE}/${folder}/${id}.ttml`,
    `${JSDELIVR_BASE}/${folder}/${id}.ttml`,
    `${COMMUNITY_MIRROR_BASE}/${mirrorPath}`
  ];
}

export async function getAmllLyric(
  songId: string | number,
  platform: string = 'netease'
): Promise<TtmlLyric | null> {
  const normalized = normalizePlatform(platform);
  if (!normalized) return null;
  const source: AmllSongSource = { platform: normalized, songId: String(songId) };
  const cacheKey = `${source.platform}:${source.songId}`;
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  for (const url of sourceUrls(source)) {
    const xml = await fetchText(url);
    if (!xml) continue;
    const parsed = parseTtml(xml);
    if (!parsed || parsed.lines.length === 0) continue;
    parsed.source = url;
    await setCached(cacheKey, parsed);
    return parsed;
  }
  return null;
}

export async function getAmllLyricForSong(
  song: Pick<SongResult, 'id' | 'platform' | 'platformId'>
): Promise<TtmlLyric | null> {
  const source = resolveAmllSource(song);
  return source ? getAmllLyric(source.songId, source.platform) : null;
}

export function preloadAmllLyric(song: Pick<SongResult, 'id' | 'platform' | 'platformId'>): void {
  void getAmllLyricForSong(song).catch(() => undefined);
}

export async function clearAmllCache(
  songId: string | number,
  platform: string = 'netease'
): Promise<void> {
  const normalized = normalizePlatform(platform);
  if (!normalized) return;
  try {
    const database = await openDb();
    database
      .transaction(STORE_NAME, 'readwrite')
      .objectStore(STORE_NAME)
      .delete(`${normalized}:${String(songId)}`);
  } catch {
    // Ignore unavailable storage.
  }
}
