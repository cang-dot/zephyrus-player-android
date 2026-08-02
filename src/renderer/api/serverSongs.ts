import PinyinMatch from 'pinyin-match';

import { type ClimaxSegment,normalizeClimaxSegments } from '@/api/climax';
import type { Artist, SongResult } from '@/types/music';

/**
 * Zephyrus 云端歌曲 API
 *
 * 从服务器 JSON 文件加载云端托管歌曲（封禁歌曲/独立音乐等）
 * 数据格式：songs.json 列出所有可用歌曲，含音频直链、封面、歌词URL、高潮时段
 */

const API_BASE = 'https://www.mucang.xyz';
const SONGS_JSON_URL = `${API_BASE}/server-music/songs.json`;

/** 云端歌曲数据结构 */
export interface ServerSong {
  id: string;
  name: string;
  artists: string[];
  album: string;
  albumArtist?: string;
  composer?: string;
  genre?: string;
  year?: string;
  track?: string;
  duration: number;
  picUrl: string;
  audioUrl: string;
  lyricsUrl?: string;
  climax?: ClimaxSegment[];
}

/**
 * 判断歌曲是否来自 Zephyrus 云端歌曲库
 */
export function isServerSongResult(item: { id?: unknown; platform?: string }): boolean {
  return item?.platform === 'server' || String(item?.id || '').startsWith('server:');
}

/** 内存缓存 */
let cachedSongs: ServerSong[] | null = null;

/**
 * 加载云端歌曲列表（带内存缓存）
 */
async function loadServerSongs(): Promise<ServerSong[]> {
  if (cachedSongs) return cachedSongs;

  try {
    const res = await fetch(SONGS_JSON_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const songs = (data.songs || []) as Array<
      Omit<ServerSong, 'climax'> & { climax?: ClimaxSegment | ClimaxSegment[] }
    >;
    cachedSongs = songs.map((song) => ({
      ...song,
      picUrl: song.picUrl || '/images/default_cover.png',
      climax: normalizeClimaxSegments(song.climax, song.duration)
    }));
    return cachedSongs;
  } catch (err) {
    console.error('[ServerSongs] 加载云端歌曲列表失败:', err);
    return [];
  }
}

/**
 * 搜索云端歌曲
 * @param keyword 搜索关键词
 * @param limit 最大返回数
 */
export async function searchServerSongs(
  keyword: string,
  limit: number = 20
): Promise<ServerSong[]> {
  if (!keyword?.trim()) return [];

  const all = await loadServerSongs();
  const query = normalizeSearchText(keyword);

  return all
    .map((song) => ({ song, score: scoreServerSong(song, query, keyword.trim()) }))
    .filter((item) => Number.isFinite(item.score))
    .sort((left, right) => left.score - right.score)
    .slice(0, limit)
    .map((item) => item.song);
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '');
}

function subsequenceGap(value: string, query: string): number | null {
  let queryIndex = 0;
  let firstMatch = -1;
  let lastMatch = -1;

  for (let index = 0; index < value.length && queryIndex < query.length; index++) {
    if (value[index] !== query[queryIndex]) continue;
    if (firstMatch < 0) firstMatch = index;
    lastMatch = index;
    queryIndex++;
  }

  if (queryIndex !== query.length) return null;
  return lastMatch - firstMatch + 1 - query.length;
}

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex++) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex++) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
}

function scoreText(value: string, query: string, rawQuery: string): number {
  const normalized = normalizeSearchText(value);
  if (!normalized || !query) return Number.POSITIVE_INFINITY;
  if (normalized === query) return 0;
  if (normalized.startsWith(query)) return 4 + normalized.length - query.length;

  const includesAt = normalized.indexOf(query);
  if (includesAt >= 0) return 12 + includesAt;

  if (PinyinMatch.match(value, rawQuery)) return 30;

  const gap = subsequenceGap(normalized, query);
  if (gap != null) return 48 + gap;

  if (Math.abs(normalized.length - query.length) <= 3) {
    const distance = editDistance(normalized, query);
    const threshold = Math.min(3, Math.max(1, Math.ceil(query.length * 0.3)));
    if (distance <= threshold) return 72 + distance;
  }

  return Number.POSITIVE_INFINITY;
}

function scoreServerSong(song: ServerSong, query: string, rawQuery: string): number {
  const candidates = [
    { value: song.name, weight: 0 },
    ...song.artists.map((artist) => ({ value: artist, weight: 8 })),
    { value: song.album || '', weight: 16 },
    { value: `${song.name}${song.artists.join('')}${song.album || ''}`, weight: 24 }
  ];

  return Math.min(
    ...candidates.map(({ value, weight }) => scoreText(value, query, rawQuery) + weight)
  );
}

export function serverSongToSongResult(song: ServerSong): SongResult {
  const artists: Artist[] = song.artists.map((name, index) => ({
    name,
    id: index,
    picId: 0,
    img1v1Id: 0,
    briefDesc: '',
    picUrl: '',
    img1v1Url: '',
    albumSize: 0,
    alias: [],
    trans: '',
    musicSize: 0,
    topicPerson: 0
  }));
  const picUrl = song.picUrl || '/images/default_cover.png';
  const album = {
    name: song.album || '',
    id: 0,
    type: '',
    size: 0,
    picId: 0,
    blurPicUrl: '',
    companyId: 0,
    pic: 0,
    picUrl,
    publishTime: 0,
    description: '',
    tags: '',
    company: '',
    briefDesc: '',
    artist: artists[0] || ({} as Artist),
    songs: [],
    alias: [],
    status: 0,
    copyrightId: 0,
    commentThreadId: '',
    artists,
    subType: '',
    transName: null,
    onSale: false,
    mark: 0,
    picId_str: ''
  };

  return {
    id: `server:${song.id}`,
    name: song.name,
    picUrl,
    ar: artists,
    artists,
    al: album,
    album,
    count: song.duration,
    dt: song.duration,
    duration: song.duration,
    climaxSegments: normalizeClimaxSegments(song.climax, song.duration),
    platform: 'server',
    platformId: song.id,
    playMusicUrl: song.audioUrl,
    source: 'netease'
  };
}

/**
 * 获取单首云端歌曲详情（含歌词文本）
 */
export async function getServerSongDetail(
  songId: string
): Promise<ServerSong & { lyricsText?: string }> {
  const all = await loadServerSongs();
  const song = all.find((s) => s.id === songId);
  if (!song) throw new Error(`Song not found: ${songId}`);

  // 懒加载歌词文本
  let lyricsText: string | undefined;
  if (song.lyricsUrl) {
    try {
      const res = await fetch(song.lyricsUrl);
      if (res.ok) {
        lyricsText = await res.text();
      }
    } catch {
      // 歌词加载失败不阻塞播放
    }
  }

  return {
    ...song,
    lyricsText,
    // 高潮时段只信任 songs.json 中人工标注的 climax 字段，
    // 不再根据 LRC 重复句推断额外的副歌时段。
    climax: normalizeClimaxSegments(song.climax, song.duration)
  };
}

/**
 * 获取云端同名专辑的全部歌曲（按 track 排序）
 */
export async function getServerAlbumSongs(albumName: string): Promise<SongResult[]> {
  const all = await loadServerSongs();
  return all
    .filter((song) => song.album === albumName)
    .sort((left, right) =>
      String(left.track || '').localeCompare(String(right.track || ''), 'zh-CN', {
        numeric: true
      })
    )
    .map(serverSongToSongResult);
}

/**
 * 清除缓存（用于手动刷新）
 */
export function clearServerSongsCache(): void {
  cachedSongs = null;
}
