/**
 * 哔哩哔哩（渲染层）
 *
 * 三端分流：
 * - Electron：走主进程 IPC（主进程直接请求 + 由 webRequest 注入 Referer/UA/CORS，可直连）
 * - Web / Android：浏览器无法自定义 Referer，播放地址统一经自有网关中转
 *   （网关注入 Referer/UA 后流式转发，见 server-bilibili.js）
 */
import axios from 'axios';

import type { Artist, SongResult } from '@/types/music';
import { isElectron } from '@/utils';

import { gatewayBaseURL } from './gatewayBase';

export interface BilibiliVideoInfo {
  bvid: string;
  aid: number;
  cid: number;
  title: string;
  picUrl: string;
  durationMs: number;
  author: string;
  authorId: number;
  pages: { cid: number; page: number; part: string; durationMs: number }[];
}

export interface BilibiliStream {
  url: string;
  kind: 'dash' | 'mp4';
  quality: number;
  expireAt: number;
  videoTracks?: { id: number; url: string; width: number; height: number; bandwidth: number }[];
}

export interface BilibiliSubtitleTrack {
  id: string;
  lan: string;
  lanDoc: string;
  url: string;
}

export interface BilibiliSubtitleLine {
  from: number;
  to: number;
  content: string;
}

export interface BilibiliSubtitlePayload {
  tracks: BilibiliSubtitleTrack[];
  picked: BilibiliSubtitleTrack | null;
  lines: BilibiliSubtitleLine[];
}

const gateway = axios.create({ baseURL: gatewayBaseURL, timeout: 20000 });

/** 是否处于"需要网关中转"的环境（Web / Android WebView） */
export const needsGatewayProxy = (): boolean => !isElectron;

const cidCache = new Map<string, number>();

function unwrap<T>(payload: { data?: T; error?: string } | undefined): T {
  if (!payload) throw new Error('B 站接口无响应');
  if (payload.error) throw new Error(payload.error);
  if (payload.data === undefined || payload.data === null) throw new Error('B 站接口返回空数据');
  return payload.data;
}

// ==================== 视频信息 ====================

export async function getBilibiliVideoInfo(bvid: string): Promise<BilibiliVideoInfo> {
  if (isElectron && window.api?.bilibiliVideoInfo) {
    return unwrap<BilibiliVideoInfo>(await window.api.bilibiliVideoInfo(bvid));
  }
  const { data } = await gateway.get<{ data: BilibiliVideoInfo }>('/bilibili/video-info', {
    params: { bvid }
  });
  return data.data;
}

/** 播放/字幕都需要 cid；搜索结果里拿不到，这里补齐并缓存 */
export async function ensureBilibiliCid(song: Pick<SongResult, 'platformId' | 'bilibiliCid'>): Promise<number> {
  if (song.bilibiliCid) return song.bilibiliCid;
  const bvid = String(song.platformId || '');
  if (!bvid) throw new Error('缺少 bvid');
  const cached = cidCache.get(bvid);
  if (cached) return cached;
  const info = await getBilibiliVideoInfo(bvid);
  if (!info.cid) throw new Error('未能获取视频 cid');
  cidCache.set(bvid, info.cid);
  return info.cid;
}

// ==================== 取流 ====================

export async function getBilibiliStream(params: {
  bvid: string;
  cid: number;
  kind?: 'audio' | 'video';
}): Promise<BilibiliStream> {
  if (isElectron && window.api?.bilibiliStream) {
    return unwrap<BilibiliStream>(await window.api.bilibiliStream(params));
  }
  const { data } = await gateway.get<{ data: BilibiliStream }>('/bilibili/playurl', {
    params
  });
  return data.data;
}

/** 把 B 站直链转成当前环境可直接播放的地址（Web/Android 走网关中转） */
export function toPlayableUrl(streamUrl: string): string {
  if (!needsGatewayProxy()) return streamUrl;
  return toGatewayProxyUrl(streamUrl);
}

/**
 * 任意 B 站域内资源（封面/字幕/音视频）的网关中转地址。
 * 用于需要 CORS 或会被 Referer 防盗链拦截的场景（如封面取色）。
 * 非 Web/Android 环境直接返回原地址（Electron 由主进程注入请求头）。
 */
export function toGatewayProxyUrl(resourceUrl: string): string {
  if (!resourceUrl) return resourceUrl;
  if (!needsGatewayProxy()) return resourceUrl;
  return `${gatewayBaseURL}/bilibili/stream?url=${encodeURIComponent(resourceUrl)}`;
}

/** 音频模式的完整取流：补齐 cid → 取音频轨 → 换成本环境可播地址 */
export async function getBilibiliAudioUrl(
  song: Pick<SongResult, 'platformId' | 'bilibiliCid'>
): Promise<{ url: string; expireAt: number }> {
  const cid = await ensureBilibiliCid(song);
  const stream = await getBilibiliStream({ bvid: String(song.platformId || ''), cid, kind: 'audio' });
  return { url: toPlayableUrl(stream.url), expireAt: stream.expireAt };
}

// ==================== 字幕 ====================

export async function getBilibiliSubtitle(params: {
  bvid: string;
  cid: number;
  /** 指定字幕语言（如 'ai-zh'）；不传则自动选中文优先 */
  lan?: string;
}): Promise<BilibiliSubtitlePayload> {
  if (isElectron && window.api?.bilibiliSubtitle) {
    return unwrap<BilibiliSubtitlePayload>(await window.api.bilibiliSubtitle(params));
  }
  const { data } = await gateway.get<{ data: BilibiliSubtitlePayload }>('/bilibili/subtitle', {
    params
  });
  return data.data;
}

/** 按歌曲取字幕（自动补 cid）；无字幕/未登录时返回空 */
export async function getBilibiliSubtitleForSong(song: SongResult): Promise<BilibiliSubtitlePayload> {
  if (song.platform !== 'bilibili' || !song.platformId) {
    return { tracks: [], picked: null, lines: [] };
  }
  const cid = await ensureBilibiliCid(song);
  return getBilibiliSubtitle({ bvid: String(song.platformId), cid });
}

// ==================== 搜索（Web/Android 走网关）====================

function toArtists(name: string): Artist[] {
  return [
    {
      name,
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
    }
  ];
}

interface GatewaySearchItem {
  bvid: string;
  aid: number;
  title: string;
  picUrl: string;
  durationMs: number;
  author: string;
  authorId: number;
  playCount: number;
  url: string;
}

/** 非 Electron 环境下经网关搜索 B 站视频，返回与原生搜索一致的 SongResult */
export async function searchBilibiliViaGateway(
  keyword: string,
  limit = 20
): Promise<SongResult[]> {
  const { data } = await gateway.get<{ data: GatewaySearchItem[] }>('/bilibili/search', {
    params: { keyword, limit }
  });
  const items = data?.data || [];
  return items.map((item) => {
    const artists = toArtists(item.author);
    const album = {
      name: '哔哩哔哩',
      picUrl: item.picUrl,
      artists,
      artist: artists[0]
    } as any;
    return {
      id: `bilibili:${item.bvid}`,
      name: item.title,
      // 封面统一走网关中转：hdslb 图床拒绝带外域 Referer（403），
      // 中转后的地址在 Web/Android 可直接加载，且画布不污染（主题色可提取）
      picUrl: toGatewayProxyUrl(item.picUrl),
      ar: artists,
      artists,
      al: album,
      album,
      count: item.durationMs,
      duration: item.durationMs,
      platform: 'bilibili',
      platformId: item.bvid,
      externalUrl: item.url,
      isVideo: true,
      source: 'netease'
    } as SongResult;
  });
}

// ==================== 收藏夹（需 B 站登录）====================

export interface BilibiliFavFolder {
  id: number;
  title: string;
  /** 该文件夹是否已包含目标视频 */
  favState: number;
  mediaCount: number;
}

/** 取当前 B 站账号的 Cookie（Web/Android 从账号 store；Electron 走主进程 env） */
async function activeBilibiliCookie(): Promise<string> {
  if (isElectron) return '';
  try {
    const { usePlatformAccountsStore } = await import('@/store/modules/platformAccounts');
    const store = usePlatformAccountsStore();
    const bilibiliAccounts = store.accounts.filter((account) => account.platform === 'bilibili');
    const active =
      bilibiliAccounts.find((account) => account.accountId === store.activeAccountId) ||
      bilibiliAccounts[0];
    return active?.cookie || '';
  } catch {
    return '';
  }
}

/** 列出收藏夹及目标视频的收藏状态 */
export async function getBilibiliFavFolders(song: SongResult): Promise<BilibiliFavFolder[]> {
  const bvid = String(song.platformId || '');
  if (!bvid) throw new Error('缺少 bvid');
  if (isElectron && window.api?.bilibiliFavFolders) {
    return unwrap<BilibiliFavFolder[]>(await window.api.bilibiliFavFolders(bvid));
  }
  const cookie = await activeBilibiliCookie();
  const { data } = await gateway.get<{ data: BilibiliFavFolder[] }>('/bilibili/fav/folders', {
    params: { bvid },
    headers: cookie ? { 'X-Platform-Cookie': cookie } : {}
  });
  return data.data;
}

async function dealBilibiliFavoriteRequest(
  bvid: string,
  addIds: number[],
  delIds: number[]
): Promise<void> {
  if (isElectron && window.api?.bilibiliFavDeal) {
    unwrap<boolean>(await window.api.bilibiliFavDeal({ bvid, addIds, delIds }));
    return;
  }
  const cookie = await activeBilibiliCookie();
  const { data } = await gateway.post<{ data: boolean }>('/bilibili/fav/deal', { bvid, addIds, delIds }, {
    headers: cookie ? { 'X-Platform-Cookie': cookie } : {}
  });
  if (!data.data) throw new Error('收藏操作失败');
}

/**
 * 切换 B 站收藏：已收藏则从所有包含它的文件夹移出；未收藏则加入第一个收藏夹。
 * @returns 切换后的收藏状态
 */
export async function toggleBilibiliFavorite(song: SongResult): Promise<boolean> {
  const bvid = String(song.platformId || '');
  if (!bvid) throw new Error('缺少 bvid');
  const folders = await getBilibiliFavFolders(song);
  if (!folders.length) throw new Error('没有可用的收藏夹');

  const favoritedFolders = folders.filter((folder) => folder.favState === 1);
  if (favoritedFolders.length) {
    await dealBilibiliFavoriteRequest(bvid, [], favoritedFolders.map((folder) => folder.id));
    markLocalBilibiliFav(bvid, false);
    return false;
  }
  await dealBilibiliFavoriteRequest(bvid, [folders[0].id], []);
  markLocalBilibiliFav(bvid, true);
  return true;
}

/** 查询 B 站收藏状态（本地缓存，供红心初始态） */
export function readLocalBilibiliFav(bvid: string): boolean {
  try {
    return localStorage.getItem(`bilibili-fav-local:${bvid}`) === '1';
  } catch {
    return false;
  }
}

function markLocalBilibiliFav(bvid: string, favorited: boolean): void {
  try {
    localStorage.setItem(`bilibili-fav-local:${bvid}`, favorited ? '1' : '0');
  } catch {
    /* 忽略 */
  }
}

/**
 * 收藏动作的 B 站同步（尽力而为）：由 favorite store 在哔哩哔哩条目的
 * 收藏/取消收藏时调用；未登录时静默跳过（本地收藏列表仍然生效）。
 */
export async function syncBilibiliFavorite(bvid: string, favorited: boolean): Promise<void> {
  const folders = await getBilibiliFavFolders({ platformId: bvid } as SongResult);
  if (!folders.length) throw new Error('哔哩哔哩未登录');
  const favoritedFolders = folders.filter((folder) => folder.favState === 1);
  if (favorited && !favoritedFolders.length) {
    await dealBilibiliFavoriteRequest(bvid, [folders[0].id], []);
    markLocalBilibiliFav(bvid, true);
    return;
  }
  if (!favorited && favoritedFolders.length) {
    await dealBilibiliFavoriteRequest(bvid, [], favoritedFolders.map((folder) => folder.id));
    markLocalBilibiliFav(bvid, false);
  }
}

// ==================== 歌单列表 TAB（B 站收藏夹→歌单卡片）====================

/** 账号数据：收藏夹映射为歌单格式（供 /list TAB 使用） */
export async function fetchBilibiliAccountData(cookie: string): Promise<{
  userInfo: { userId: string; nickname: string; avatarUrl: string; vip: boolean };
  playlists: { id: number; name: string; coverImgUrl: string; trackCount: number; userId: string }[];
}> {
  if (isElectron && window.api?.bilibiliAccountData) {
    return unwrap(await window.api.bilibiliAccountData(cookie));
  }
  const { data } = await gateway.get<{ data: any }>('/bilibili/account/data', {
    headers: cookie ? { 'X-Platform-Cookie': cookie } : {}
  });
  return data.data;
}

/** 收藏夹内视频列表 */
export async function fetchBilibiliPlaylistTracks(
  cookie: string,
  folderId: string,
  page = 1
): Promise<{
  playlist: { id: number; name: string; coverImgUrl: string; trackCount: number };
  songs: GatewaySearchItem[];
}> {
  if (isElectron && window.api?.bilibiliPlaylistTracks) {
    return unwrap(await window.api.bilibiliPlaylistTracks(cookie, folderId, page));
  }
  const { data } = await gateway.get<{ data: any }>('/bilibili/playlist/tracks', {
    params: { id: folderId, page },
    headers: cookie ? { 'X-Platform-Cookie': cookie } : {}
  });
  return data.data;
}

// ==================== 评论（旧接口，匿名可读）====================

export interface BilibiliCommentItem {
  rpid: number;
  oid: number;
  nickname: string;
  avatarUrl: string;
  content: string;
  ctime: number;
  likedCount: number;
  replies: { rpid: number; nickname: string; avatarUrl: string; content: string; ctime: number }[];
}

/** 获取 B 站视频评论 */
export async function fetchBilibiliComments(
  oid: number,
  pn = 1
): Promise<{ total: number; replies: BilibiliCommentItem[] }> {
  if (isElectron && window.api?.bilibiliComments) {
    return unwrap(await window.api.bilibiliComments(oid, pn));
  }
  const { data } = await gateway.get<{ data: { total: number; replies: BilibiliCommentItem[] } }>(
    '/bilibili/comments',
    { params: { oid, pn } }
  );
  return data.data;
}

// ==================== 链接解析 ====================

/** 打开外部链接（Electron / Android 原生 / 浏览器三通道） */
export function openExternalUrl(url: string): void {
  if (!url) return;
  if (window.api?.openExternal) {
    void window.api.openExternal(url);
    return;
  }
  const androidNative = (window as any).AndroidNative;
  if (typeof androidNative !== 'undefined' && androidNative?.openExternal) {
    androidNative.openExternal(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function resolveBilibiliBvid(input: string): Promise<string | null> {
  if (isElectron && window.api?.bilibiliResolveBvid) {
    return unwrap<string | null>(await window.api.bilibiliResolveBvid(input));
  }
  const { data } = await gateway.get<{ data: string | null }>('/bilibili/resolve', {
    params: { input }
  });
  return data?.data ?? null;
}
