/**
 * Spotify Web API 服务
 *
 * 提供：搜索曲库、获取用户歌单、获取歌单曲目、播放控制
 * 所有请求自动携带有效的 access_token（通过 spotifyAuth 模块获取）
 */

import { getValidAccessToken } from './spotifyAuth';

import type { Artist, SongResult } from '@/types/music';

const API_BASE = 'https://api.spotify.com/v1';

// ==================== 请求封装 ====================

async function spotifyFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error('Spotify 未登录');
  }

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (response.status === 401) {
    throw new Error('Spotify 授权已过期，请重新登录');
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    throw new Error(`Spotify API 速率限制，请 ${retryAfter || '几秒'} 后重试`);
  }

  return response;
}

async function spotifyGetJSON<T>(path: string): Promise<T> {
  const response = await spotifyFetch(path);
  if (response.status === 204) return null as T;
  return response.json() as Promise<T>;
}

async function spotifyPutJSON(path: string, body?: unknown): Promise<void> {
  await spotifyFetch(path, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined
  });
}

async function spotifyPostJSON(path: string, body?: unknown): Promise<void> {
  await spotifyFetch(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined
  });
}

// ==================== 类型定义 ====================

export interface SpotifyUser {
  id: string;
  display_name: string;
  email: string;
  product: 'free' | 'premium';
  images: { url: string; width: number; height: number }[];
  followers: { total: number };
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  images: { url: string; width: number; height: number }[];
  owner: { id: string; display_name: string };
  tracks: { href: string; total: number };
  external_urls: { spotify: string };
  public: boolean;
}

export interface SpotifyTrackItem {
  id: string;
  name: string;
  duration_ms: number;
  uri: string;
  external_urls: { spotify: string };
  preview_url: string | null;
  artists: { id: string; name: string; external_urls: { spotify: string } }[];
  album: {
    id: string;
    name: string;
    images: { url: string; width: number; height: number }[];
  };
}

export interface SpotifyPlaylistTrack {
  added_at: string;
  track: SpotifyTrackItem | null;
}

// ==================== 用户信息 ====================

export async function getCurrentUser(): Promise<SpotifyUser> {
  return spotifyGetJSON<SpotifyUser>('/me');
}

// ==================== 搜索 ====================

export async function searchTracks(query: string, limit = 20, offset = 0): Promise<SongResult[]> {
  if (!query.trim()) return [];

  const params = new URLSearchParams({
    q: query,
    type: 'track',
    limit: String(limit),
    offset: String(offset)
  });

  const data = await spotifyGetJSON<{
    tracks: { items: SpotifyTrackItem[] };
  }>(`/search?${params}`);

  return data.tracks.items.map(trackToSongResult);
}

// ==================== 歌单 ====================

export async function getUserPlaylists(limit = 50, offset = 0): Promise<SpotifyPlaylist[]> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset)
  });

  const data = await spotifyGetJSON<{
    items: SpotifyPlaylist[];
    total: number;
    next: string | null;
  }>(`/me/playlists?${params}`);

  return data.items || [];
}

export async function getPlaylistTracks(playlistId: string, limit = 100, offset = 0): Promise<SongResult[]> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset)
  });

  const data = await spotifyGetJSON<{
    items: SpotifyPlaylistTrack[];
    total: number;
    next: string | null;
  }>(`/playlists/${playlistId}/tracks?${params}`);

  return (data.items || [])
    .filter((item) => item.track !== null)
    .map((item) => trackToSongResult(item.track!));
}

// ==================== 播放控制 ====================

/**
 * 开始/恢复播放
 * @param trackUri Spotify track URI (e.g. "spotify:track:xxxxx")，不传则恢复当前播放
 * @param positionMs 起始位置（毫秒）
 */
export async function startPlayback(trackUri?: string, positionMs = 0): Promise<void> {
  const body = trackUri
    ? { uris: [trackUri], position_ms: positionMs }
    : { position_ms: positionMs };

  await spotifyPutJSON('/me/player/play', body);
}

/** 暂停播放 */
export async function pausePlayback(): Promise<void> {
  await spotifyPutJSON('/me/player/pause');
}

/** 跳到下一首 */
export async function skipToNext(): Promise<void> {
  await spotifyPostJSON('/me/player/next');
}

/** 跳到上一首 */
export async function skipToPrevious(): Promise<void> {
  await spotifyPostJSON('/me/player/previous');
}

/** 设置播放位置（毫秒） */
export async function seekToPosition(positionMs: number): Promise<void> {
  await spotifyPutJSON(`/me/player/seek?position_ms=${positionMs}`);
}

/** 设置音量 (0-100) */
export async function setVolume(volumePercent: number): Promise<void> {
  await spotifyPutJSON(`/me/player/volume?volume_percent=${volumePercent}`);
}

// ==================== 收藏 ====================

/** 获取用户收藏的歌曲 */
export async function getSavedTracks(limit = 50, offset = 0): Promise<SongResult[]> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset)
  });

  const data = await spotifyGetJSON<{
    items: { added_at: string; track: SpotifyTrackItem }[];
  }>(`/me/tracks?${params}`);

  return (data.items || []).map((item) => trackToSongResult(item.track));
}

/** 检查用户是否已收藏某些歌曲 */
export async function checkSavedTracks(trackIds: string[]): Promise<boolean[]> {
  if (!trackIds.length) return [];
  const params = new URLSearchParams({ ids: trackIds.join(',') });
  const data = await spotifyGetJSON<boolean[]>(`/me/tracks/contains?${params}`);
  return data;
}

// ==================== 工具函数 ====================

/** 将 Spotify Track 转换为应用的 SongResult 格式 */
function trackToSongResult(track: SpotifyTrackItem): SongResult {
  const artists: Artist[] = track.artists.map((a) => ({
    name: a.name,
    id: 0,
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

  const picUrl = track.album.images?.[0]?.url || '';
  const album = {
    name: track.album.name,
    id: 0,
    type: '',
    size: 0,
    picId: 0,
    blurPicUrl: picUrl,
    companyId: 0,
    pic: 0,
    picUrl,
    publishTime: 0,
    description: '',
    tags: '',
    company: '',
    briefDesc: '',
    artist: artists[0] || artists[0],
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
    id: `spotify:${track.id}`,
    name: track.name,
    picUrl,
    ar: artists,
    artists,
    al: album,
    album,
    count: track.duration_ms / 1000,
    duration: track.duration_ms / 1000,
    platform: 'spotify',
    platformId: track.id,
    externalUrl: track.external_urls.spotify,
    previewUrl: track.preview_url,
    spotifyUri: track.uri
  } as SongResult & { previewUrl: string | null; spotifyUri: string };
}
