/**
 * 多平台扫码登录 API（渲染进程）
 *
 * - Electron 环境：走 IPC 调用主进程 platformLogin.ts
 * - 移动端（Capacitor）：走服务器中转 API（/platform/{platform}/qr/create|poll）
 *
 * 服务器中转的优势：
 * - 解决 CapacitorHttp 在某些设备上无法读取 Set-Cookie 头的问题
 * - 统一处理 QQ 音乐的 hash33 算法和重定向 Cookie 获取
 * - 酷狗新 API (login-user.kugou.com) 需要 Web 签名，服务器端统一处理
 */

import axios, { type AxiosError } from 'axios';

import type { SongResult } from '@/types/music';
import { isElectron } from '@/utils';
import {
  classifyPlatformLoginFailure,
  parseQqChannels,
  type QqLoginChannels
} from '@/utils/platformLoginDiagnostics';
import { normalizePlatformQrProvider, normalizePlatformQrStatus } from '@/utils/platformQr';

// ==================== 类型定义 ====================

export type LoginPlatform = 'qq' | 'kugou' | 'bilibili';
export type QqLoginProvider = 'qq' | 'wechat';
/** 新链三通道（qq-music-api channels），qqmusic=QQ 音乐 App 通用码（三 App 都能扫） */
export type QqApiChannel = QqLoginProvider | 'qqmusic';

export interface QrCreateResult {
  platform: LoginPlatform;
  provider: QqLoginProvider | 'qqmusic' | 'kugou' | 'bilibili';
  qrUrl: string;
  key: string;
  expiredAt: number;
  error?: string;
}

export interface QrPollResult {
  platform: LoginPlatform;
  provider: QqLoginProvider | 'qqmusic' | 'kugou' | 'bilibili';
  code: 'waiting' | 'scanned' | 'success' | 'expired' | 'error';
  message: string;
  cookie?: string;
  userInfo?: {
    nickname?: string;
    avatarUrl?: string;
    userId?: string;
  };
}

export interface PlatformAccountData {
  userInfo?: {
    userId?: string;
    nickname?: string;
    avatarUrl?: string;
    vip?: boolean;
    vipLabel?: string;
  };
  playlists: any[];
  favorites: any[];
  albums: any[];
  history: any[];
}

export interface PlatformPlaylistTracks {
  playlist?: Record<string, unknown>;
  songs: any[];
  page?: number;
  pageSize?: number;
}

// ==================== 服务器中转 API ====================

const DEFAULT_GATEWAY_URL = 'https://mucang.xyz/zephyrus/api';
const gatewayBaseURL = (import.meta.env.VITE_MUSIC_GATEWAY || DEFAULT_GATEWAY_URL)
  .replace(/\/+$/, '')
  .replace(/\/platform$/i, '');

const gatewayRequest = axios.create({
  baseURL: gatewayBaseURL,
  timeout: 15000
});

function gatewayError(error: unknown, action: string): Error {
  const axiosError = error as AxiosError<{ msg?: string }>;
  const status = axiosError.response?.status;
  const serverMessage = axiosError.response?.data?.msg;

  if (status === 404) {
    return new Error(`扫码网关路由不存在，请检查 VITE_MUSIC_GATEWAY：${gatewayBaseURL}`);
  }
  if (serverMessage) {
    return new Error(serverMessage);
  }
  if (axiosError.code === 'ECONNABORTED') {
    return new Error(`${action}超时，请检查扫码网关连接`);
  }
  return new Error(axiosError.message || `${action}失败`);
}

/**
 * 通过服务器中转 API 创建二维码
 * 路由：GET /platform/{platform}/qr/create
 */
async function createQrViaServer(
  platform: LoginPlatform,
  provider: QqLoginProvider = 'qq'
): Promise<QrCreateResult> {
  try {
    // 哔哩哔哩的路由挂在独立的 /bilibili 前缀下
    const path =
      platform === 'bilibili' ? '/bilibili/qr/create' : `/platform/${platform}/qr/create`;
    const response = await gatewayRequest.get(path, {
      params: { provider: platform === 'qq' ? provider : undefined, noCache: Date.now() }
    });
    const json = response.data;
    if (json.code !== 0 && json.code !== 200) {
      throw new Error(json.msg || `${platform} 二维码创建失败`);
    }
    if (!json.data) {
      throw new Error(`${platform} 二维码创建失败`);
    }
    if (platform === 'qq' && provider === 'wechat' && json.data.provider !== 'wechat') {
      throw new Error('QQ 音乐登录网关版本过旧，未返回微信登录二维码');
    }
    return {
      platform,
      provider: normalizePlatformQrProvider(platform, json.data.provider, provider),
      qrUrl: json.data.qrUrl || json.data.url,
      key: json.data.qrcodeKey || json.data.key,
      expiredAt: json.data.expiredAt || Date.now() + 180000
    };
  } catch (error) {
    throw gatewayError(error, `${platform} 二维码创建`);
  }
}

/**
 * 通过服务器中转 API 轮询扫码状态
 * 路由：GET /platform/{platform}/qr/poll?key=xxx
 */
async function pollQrViaServer(
  platform: LoginPlatform,
  key: string,
  provider: QqLoginProvider = 'qq'
): Promise<QrPollResult> {
  try {
    const path =
      platform === 'bilibili' ? '/bilibili/qr/poll' : `/platform/${platform}/qr/poll`;
    const response = await gatewayRequest.get(path, {
      params: {
        key,
        ...(platform === 'bilibili' ? { qrcodeKey: key } : {}),
        provider: platform === 'qq' ? provider : undefined,
        noCache: Date.now()
      }
    });
    const json = response.data;
    if (json.code !== 0 && json.code !== 200) {
      return {
        platform,
        provider: normalizePlatformQrProvider(platform, json.data?.provider, provider),
        code: 'error',
        message: json.msg || '轮询状态失败'
      };
    }
    const data = json.data;
    if (platform === 'bilibili') {
      return {
        platform,
        provider: 'bilibili' as QqLoginProvider,
        code: normalizePlatformQrStatus(data.status),
        message: '',
        cookie: data.cookie || undefined,
        userInfo: data.userInfo || undefined
      };
    }
    if (json.code !== 200 || !data) {
      return {
        platform,
        provider: normalizePlatformQrProvider(platform, data?.provider, provider),
        code: data?.status === 'expired' ? 'expired' : 'error',
        message: data?.message || json.msg || '轮询状态失败'
      };
    }
    if (platform === 'qq' && provider === 'wechat' && data.provider !== 'wechat') {
      return {
        platform,
        provider,
        code: 'error',
        message: 'QQ 音乐登录网关返回了错误的登录方式，请刷新后重试'
      };
    }
    return {
      platform,
      provider: normalizePlatformQrProvider(platform, data.provider, provider),
      code: normalizePlatformQrStatus(data.status),
      message: data.message,
      cookie: data.cookie,
      userInfo: data.userInfo
    };
  } catch (error) {
    throw gatewayError(error, `${platform} 登录状态轮询`);
  }
}

// ==================== 新链（Folia 移植：qq-music-api / KuGouMusicApi） ====================

/**
 * 探测网关新链能力：GET /platform/qq/api/login/channels。
 * 旧网关（404/HTML）或未配密钥（501）→ null，调用方回退旧自建登录链。
 */
export async function probeQqLoginChannels(): Promise<QqLoginChannels | null> {
  try {
    const response = await gatewayRequest.get('/platform/qq/api/login/channels', {
      timeout: 8000,
      params: { noCache: Date.now() }
    });
    return parseQqChannels(response.data);
  } catch {
    return null;
  }
}

/** 新链 QQ 扫码创建：login/qr/key（qqmusic 通用码）或 login/qr/create（qq/wechat 通道） */
async function createQqApiQr(provider: QqLoginProvider | 'qqmusic'): Promise<QrCreateResult> {
  try {
    const keyRes = await gatewayRequest.get('/platform/qq/api/login/qr/key', {
      timeout: 10000
    });
    const keyData = keyRes.data?.data;
    if (keyRes.data?.code !== 200 || !keyData) {
      throw new Error(keyRes.data?.message || 'qq-music-api 二维码 key 获取失败');
    }
    const qrRes = await gatewayRequest.get('/platform/qq/api/login/qr/create', {
      params: { key: keyData.key, qrimg: true },
      timeout: 10000,
      responseType: 'arraybuffer'
    });
    let qrUrl = '';
    const contentType = String(qrRes.headers?.['content-type'] || '');
    if (contentType.includes('image/')) {
      const base64 = btoa(
        new Uint8Array(qrRes.data).reduce((s, b) => s + String.fromCharCode(b), '')
      );
      qrUrl = `data:${contentType.split(';')[0]};base64,${base64}`;
    } else {
      const json = typeof qrRes.data === 'string' ? JSON.parse(qrRes.data) : qrRes.data;
      qrUrl = json?.data?.qrimg || json?.data?.url || '';
    }
    if (!qrUrl) throw new Error('qq-music-api 二维码生成失败');
    return {
      platform: 'qq',
      provider: provider === 'qqmusic' ? 'qqmusic' : provider,
      qrUrl,
      key: keyData.key,
      expiredAt: Date.now() + 180000
    };
  } catch (error) {
    throw gatewayError(error, 'QQ 新链二维码创建');
  }
}

/** 新链 QQ 轮询：803=确认（携带 sealed/stored 会话），800=过期，661/662 等待/已扫 */
async function pollQqApiQr(
  key: string,
  provider: QqLoginProvider | 'qqmusic'
): Promise<QrPollResult> {
  try {
    const response = await gatewayRequest.get('/platform/qq/api/login/qr/check', {
      params: { key, noCache: Date.now() },
      timeout: 12000
    });
    const json = response.data;
    const code = Number(json?.code);
    const data = json?.data || {};
    if (code === 803) {
      return {
        platform: 'qq',
        provider: provider === 'qqmusic' ? 'qqmusic' : provider,
        code: 'success',
        message: '登录成功',
        // stored 模式下网关持有会话，客户端只拿 cookie 引用（与旧链 cookie 字段同位）
        cookie: data.cookie || data.session || undefined,
        userInfo: data.userInfo || undefined
      };
    }
    if (code === 800) {
      return {
        platform: 'qq',
        provider: provider === 'qqmusic' ? 'qqmusic' : provider,
        code: 'expired',
        message: '二维码已过期'
      };
    }
    if (code === 662) {
      return {
        platform: 'qq',
        provider: provider === 'qqmusic' ? 'qqmusic' : provider,
        code: 'scanned',
        message: '请在手机上确认'
      };
    }
    if (code === 661 || code === 0) {
      return {
        platform: 'qq',
        provider: provider === 'qqmusic' ? 'qqmusic' : provider,
        code: 'waiting',
        message: ''
      };
    }
    // 结构化失败（20279 设备超限等）交给 classifyPlatformLoginFailure
    return {
      platform: 'qq',
      provider: provider === 'qqmusic' ? 'qqmusic' : provider,
      code: 'error',
      message: classifyPlatformLoginFailure({
        upstreamCode: data.upstreamCode ?? code,
        failureReason: data.failureReason,
        failureHint: data.failureHint,
        retryAfterMs: data.retryAfterMs,
        message: json?.message || json?.msg
      }).userMessage
    };
  } catch (error) {
    throw gatewayError(error, 'QQ 新链登录轮询');
  }
}

/** 新链酷狗扫码创建（KuGouMusicApi login/qr/key，返回内嵌二维码图） */
async function createKugouApiQr(): Promise<QrCreateResult> {
  try {
    const response = await gatewayRequest.get('/platform/kugou/api/login/qr/key', {
      timeout: 10000
    });
    const json = response.data;
    if (json?.code !== 200 || !json?.data?.qrcode) {
      throw new Error(json?.msg || '酷狗二维码创建失败');
    }
    return {
      platform: 'kugou',
      provider: 'kugou',
      qrUrl: json.data.qrcode_img || '',
      key: json.data.qrcode,
      expiredAt: Date.now() + 300000
    };
  } catch (error) {
    throw gatewayError(error, '酷狗二维码创建');
  }
}

/** 新链酷狗轮询：qrcodeStatus 1/2/4/0 → waiting/scanned/success/expired */
async function pollKugouApiQr(key: string): Promise<QrPollResult> {
  try {
    const response = await gatewayRequest.get('/platform/kugou/api/login/qr/check', {
      params: { key, noCache: Date.now() },
      timeout: 10000
    });
    const json = response.data;
    if (json?.code !== 200 || !json?.data) {
      throw new Error(json?.msg || '酷狗扫码状态查询失败');
    }
    return {
      platform: 'kugou',
      provider: 'kugou',
      code: normalizePlatformQrStatus(json.data.status),
      message: json.data.status === 'scanned' ? '请在手机上确认' : '',
      cookie: json.data.cookie,
      userInfo: json.data.userInfo
    };
  } catch (error) {
    throw gatewayError(error, '酷狗扫码轮询');
  }
}

/** QQ 登录态续期：POST /platform/qq/api/login/refresh（到期 <6h 时网关换新令牌） */
export async function refreshQqApiSession(
  cookie: string
): Promise<{ refreshed: boolean; cookie?: string }> {
  try {
    const response = await gatewayRequest.post(
      '/platform/qq/api/login/refresh',
      {},
      { headers: { 'X-Platform-Cookie': cookie }, timeout: 15000 }
    );
    const json = response.data;
    if (json?.code !== 200) return { refreshed: false };
    return { refreshed: true, cookie: json.data?.cookie || undefined };
  } catch {
    return { refreshed: false };
  }
}

/** 酷狗登录态续期：GET /platform/kugou/api/login/token/refresh */
export async function refreshKugouApiSession(
  cookie: string
): Promise<{ refreshed: boolean; cookie?: string }> {
  try {
    const response = await gatewayRequest.get('/platform/kugou/api/login/token/refresh', {
      headers: { 'X-Platform-Cookie': cookie },
      timeout: 15000
    });
    const json = response.data;
    if (json?.code !== 200 || !json?.data?.cookie) return { refreshed: false };
    return { refreshed: true, cookie: json.data.cookie };
  } catch {
    return { refreshed: false };
  }
}

/**
 * 新链歌曲播放 URL（qq → getMusicPlay 音质档位回退；kugou → song_url 带 hash）。
 * 返回 null = 新链不可用/失败，调用方回退 unblock 解析链。
 */
export async function fetchPlatformPlayUrlViaApi(
  platform: 'qq' | 'kugou',
  songId: string,
  cookie?: string,
  quality: 'standard' | 'high' | 'lossless' = 'standard'
): Promise<string | null> {
  try {
    if (platform === 'qq') {
      // qq-music-api 音质档位（Folia fallback 表）：flac→320→128 按偏好降档。
      // songmid 是路径参数（/getMusicPlay/:songmid），quality 走 query；
      // 响应形态 data.playUrl[songmid].url（匿名=试听/受限，带会话=完整链接）
      const qualityChain: Record<typeof quality, string[]> = {
        standard: ['128'],
        high: ['320', '128'],
        lossless: ['flac', '320', '128']
      };
      for (const q of qualityChain[quality]) {
        const response = await gatewayRequest.get(
          `/platform/qq/api/getMusicPlay/${encodeURIComponent(songId)}`,
          {
            params: { q },
            headers: cookie ? { 'X-Platform-Cookie': cookie } : undefined,
            timeout: 20000
          }
        );
        const playUrlMap =
          response.data?.data?.playUrl ||
          response.data?.data?.url ||
          response.data?.url;
        const url =
          typeof playUrlMap === 'string'
            ? playUrlMap
            : playUrlMap?.[songId]?.url;
        if (url && typeof url === 'string' && url.startsWith('http')) {
          return url;
        }
      }
      return null;
    }
    // 酷狗：song_url（hash 即 songId）
    const response = await gatewayRequest.get('/platform/kugou/api/song/url', {
      params: { hash: songId },
      headers: cookie ? { 'X-Platform-Cookie': cookie } : undefined,
      timeout: 20000
    });
    const url = response.data?.data?.url;
    if (response.data?.code === 200 && url && typeof url === 'string' && url.startsWith('http')) {
      return url;
    }
    return null;
  } catch {
    return null;
  }
}

// ==================== 统一入口 ====================

/** 新链可用性缓存：一次会话探测一次（qq channels / kugou key 探活） */
let qqApiChannels: QqLoginChannels | null | undefined;
let kugouApiAvailable: boolean | undefined;

/** qq 新链能力（含三通道列表）；探测失败缓存 null 走旧链 */
export async function getQqApiChannels(force = false): Promise<QqLoginChannels | null> {
  if (qqApiChannels === undefined || force) {
    qqApiChannels = await probeQqLoginChannels();
  }
  return qqApiChannels;
}

/** 酷狗新链可用性（网关未升级时 false 走旧链） */
export async function isKugouApiAvailable(force = false): Promise<boolean> {
  if (kugouApiAvailable === undefined || force) {
    try {
      const response = await gatewayRequest.get('/platform/kugou/api/login/qr/key', {
        timeout: 8000
      });
      kugouApiAvailable = response.data?.code === 200;
    } catch {
      kugouApiAvailable = false;
    }
  }
  return kugouApiAvailable;
}

/**
 * 创建平台扫码二维码。
 * 新链优先（qq-music-api / KuGouMusicApi，Folia 移植），探测失败回退旧链：
 * - 旧链 Electron: 走 IPC；移动端: 走服务器中转
 */
export async function createPlatformQr(
  platform: LoginPlatform,
  provider: QqLoginProvider = 'qq'
): Promise<QrCreateResult> {
  if (platform === 'qq') {
    const channels = await getQqApiChannels();
    if (channels && channels.configured) {
      // qqmusic 通用码在后端支持时优先（三 App 都能扫），否则按所选通道
      const useChannel: QqApiChannel = channels.channels.includes('qqmusic')
        ? 'qqmusic'
        : provider;
      return createQqApiQr(useChannel);
    }
  }
  if (platform === 'kugou' && (await isKugouApiAvailable())) {
    return createKugouApiQr();
  }

  // 旧链：Electron 环境：走 IPC
  if (provider !== 'wechat' && isElectron && (window as any).api?.platformQrCreate) {
    return (window as any).api.platformQrCreate(platform, provider);
  }

  return createQrViaServer(platform, provider);
}

/**
 * 轮询平台扫码状态。新链优先，失败回退旧链
 * （provider 值 'qqmusic' 只会出现在新链 key 上——新链创建的 key 走新链轮询）。
 */
export async function pollPlatformQr(
  platform: LoginPlatform,
  key: string,
  provider: QqLoginProvider = 'qq'
): Promise<QrPollResult> {
  if (platform === 'qq') {
    const channels = await getQqApiChannels();
    if (channels && channels.configured) {
      return pollQqApiQr(key, 'qqmusic' as QqApiChannel);
    }
  }
  if (platform === 'kugou' && (await isKugouApiAvailable())) {
    return pollKugouApiQr(key);
  }

  // 旧链：Electron 环境：走 IPC
  if (provider !== 'wechat' && isElectron && (window as any).api?.platformQrPoll) {
    return (window as any).api.platformQrPoll(platform, key, provider);
  }

  return pollQrViaServer(platform, key, provider);
}

/**
 * 拉取已登录平台的账号资料和列表数据。
 * Cookie 只通过请求头传递，不进入 URL 或日志。
 */
export async function fetchPlatformAccountData(
  platform: LoginPlatform,
  cookie: string
): Promise<PlatformAccountData> {
  if (!cookie.trim()) {
    throw new Error(`${platform} 登录凭据为空`);
  }

  try {
    const response = await gatewayRequest.get(`/platform/${platform}/account/data`, {
      headers: {
        'X-Platform-Cookie': cookie,
        'Cache-Control': 'no-cache'
      },
      timeout: 20000,
      params: { noCache: Date.now() }
    });
    const json = response.data;
    if (json.code !== 200 || !json.data) {
      throw new Error(json.msg || `${platform} 账号数据获取失败`);
    }
    return {
      userInfo: json.data.userInfo,
      playlists: Array.isArray(json.data.playlists) ? json.data.playlists : [],
      favorites: Array.isArray(json.data.favorites) ? json.data.favorites : [],
      albums: Array.isArray(json.data.albums) ? json.data.albums : [],
      history: Array.isArray(json.data.history) ? json.data.history : []
    };
  } catch (error) {
    throw gatewayError(error, `${platform} 账号数据加载`);
  }
}

export async function fetchPlatformPlaylistTracks(
  platform: LoginPlatform,
  cookie: string,
  id: string
): Promise<PlatformPlaylistTracks> {
  if (!cookie.trim()) {
    throw new Error(`${platform} 登录凭据为空`);
  }
  if (!id.trim()) {
    throw new Error(`${platform} 歌单 ID 为空`);
  }

  try {
    const response = await gatewayRequest.get(`/platform/${platform}/playlist/tracks`, {
      headers: {
        'X-Platform-Cookie': cookie,
        'Cache-Control': 'no-cache'
      },
      params: { id, noCache: Date.now() },
      timeout: 20000
    });
    const json = response.data;
    if (json.code !== 200 || !json.data) {
      throw new Error(json.msg || `${platform} 歌单加载失败`);
    }
    return {
      playlist: json.data.playlist,
      songs: Array.isArray(json.data.songs) ? json.data.songs : [],
      page: json.data.page,
      pageSize: json.data.pageSize
    };
  } catch (error) {
    throw gatewayError(error, `${platform} 歌单加载`);
  }
}

export interface QqLyricPayload {
  platform: 'qq';
  format: 'qrc' | 'lrc';
  lyric: string;
  translation: string;
  romanization: string;
}

export interface QqAlbumDetail {
  album: {
    id: string;
    name: string;
    picUrl: string;
    artist?: { id?: number | string; name?: string };
  };
  songs: SongResult[];
}

export interface QqSingerSongs {
  artist: {
    id: string;
    mid: string;
    name: string;
    picUrl: string;
    fans?: number;
  };
  songs: SongResult[];
  total?: number;
  hasMore?: boolean;
}

/**
 * QQ 专辑详情 + 曲目（未签名通道，无需登录 Cookie）
 */
export async function fetchQqAlbumDetail(id: string): Promise<QqAlbumDetail> {
  if (!id.trim()) throw new Error('QQ 专辑 ID 为空');
  try {
    const response = await gatewayRequest.get('/platform/qq/album', {
      params: { id, noCache: Date.now() },
      timeout: 20000
    });
    const json = response.data;
    if (json.code !== 200 || !json.data) {
      throw new Error(json.msg || 'QQ 专辑加载失败');
    }
    return {
      album: json.data.album,
      songs: Array.isArray(json.data.songs) ? json.data.songs : []
    };
  } catch (error) {
    throw gatewayError(error, 'QQ 专辑加载');
  }
}

/**
 * QQ 歌手热门歌曲（未签名通道，无需登录 Cookie）
 */
export async function fetchQqSingerHotSongs(
  mid: string,
  limit = 50,
  offset = 0
): Promise<QqSingerSongs> {
  if (!mid.trim()) throw new Error('QQ 歌手 ID 为空');
  try {
    const response = await gatewayRequest.get('/platform/qq/singer/songs', {
      params: { mid, limit, offset, noCache: Date.now() },
      timeout: 20000
    });
    const json = response.data;
    if (json.code !== 200 || !json.data) {
      throw new Error(json.msg || 'QQ 歌手歌曲加载失败');
    }
    return {
      artist: json.data.artist,
      songs: Array.isArray(json.data.songs) ? json.data.songs : [],
      total: json.data.total,
      hasMore: Boolean(json.data.hasMore)
    };
  } catch (error) {
    throw gatewayError(error, 'QQ 歌手歌曲加载');
  }
}

export interface KugouLyricPayload {
  platform: 'kugou';
  format: 'krc';
  lyric: string;
  translation: string;
  romanization: string;
}

function normalizeLyricMatchText(value: unknown): string {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/\.(?:mp3|flac|wav|m4a|aac|ogg|ape)$/i, '')
    .replace(/[\s\-–—_.·•()[\]{}（）【】,，。!！?？:：;'"“”‘’]/g, '');
}

function songArtists(song: SongResult): string[] {
  return (song.ar || song.artists || []).map((artist) => artist.name).filter(Boolean);
}

function lyricMatchScore(source: SongResult, candidate: SongResult): number {
  const sourceTitle = normalizeLyricMatchText(source.name);
  const candidateTitle = normalizeLyricMatchText(candidate.name);
  if (!sourceTitle || sourceTitle !== candidateTitle) return -1;
  let score = 60;

  const sourceArtists = songArtists(source).map(normalizeLyricMatchText);
  const candidateArtists = songArtists(candidate).map(normalizeLyricMatchText);
  if (sourceArtists.length) {
    const matched = sourceArtists.some((artist) =>
      candidateArtists.some(
        (candidateArtist) =>
          candidateArtist === artist ||
          candidateArtist.includes(artist) ||
          artist.includes(candidateArtist)
      )
    );
    if (!matched) return -1;
    score += 25;
  }

  const sourceDuration = Number(source.dt || source.duration || 0);
  const candidateDuration = Number(candidate.dt || candidate.duration || 0);
  if (sourceDuration > 0 && candidateDuration > 0) {
    const difference = Math.abs(sourceDuration - candidateDuration);
    if (difference > 12000) return -1;
    score += difference <= 2500 ? 20 : difference <= 8000 ? 10 : 4;
  }

  const sourceAlbum = normalizeLyricMatchText(source.al?.name || source.album?.name);
  const candidateAlbum = normalizeLyricMatchText(candidate.al?.name || candidate.album?.name);
  if (sourceAlbum && candidateAlbum && sourceAlbum === candidateAlbum) score += 10;
  return score;
}

async function searchGatewayMusic(
  platform: 'qq' | 'kugou',
  song: SongResult
): Promise<SongResult | null> {
  const keyword = [song.name, ...songArtists(song).slice(0, 2)].filter(Boolean).join(' ');
  if (!keyword) return null;
  try {
    const response = await gatewayRequest.get(`/platform/${platform}/search`, {
      params: { keyword, limit: 12, noCache: Date.now() },
      timeout: 12000
    });
    const songs = response.data?.data?.songs;
    if (!Array.isArray(songs)) return null;
    const ranked = (songs as SongResult[])
      .map((candidate) => ({ candidate, score: lyricMatchScore(song, candidate) }))
      .filter((item) => item.score >= 85)
      .sort((left, right) => right.score - left.score);
    return ranked[0]?.candidate || null;
  } catch {
    return null;
  }
}

/**
 * 搜索已登录平台（QQ/酷狗）的音乐，返回可直接播放的 SongResult 列表
 */
export async function searchPlatformMusic(
  platform: 'qq' | 'kugou',
  keyword: string,
  limit = 20
): Promise<SongResult[]> {
  if (!keyword?.trim()) return [];
  const cookie = localStorage.getItem(`platform-cookie-${platform}`) || '';
  if (!cookie.trim()) return [];

  try {
    const response = await gatewayRequest.get(`/platform/${platform}/search`, {
      headers: {
        'X-Platform-Cookie': cookie,
        'Cache-Control': 'no-cache'
      },
      params: { keyword, limit, noCache: Date.now() },
      timeout: 20000
    });
    const json = response.data;
    if (json.code !== 200 || !json.data) {
      throw new Error(json.msg || `${platform} 搜索失败`);
    }
    return Array.isArray(json.data.songs) ? (json.data.songs as SongResult[]) : [];
  } catch (error) {
    throw gatewayError(error, `${platform} 搜索`);
  }
}

/** 获取网关已解密的 QQ 逐字歌词。未找到歌词时返回 null。 */
export async function fetchQqLyric(mid: string): Promise<QqLyricPayload | null> {
  const songMid = String(mid || '').trim();
  if (!songMid) return null;
  const cookie = localStorage.getItem('platform-cookie-qq') || '';

  try {
    const response = await gatewayRequest.get('/platform/qq/lyric', {
      headers: cookie ? { 'X-Platform-Cookie': cookie } : undefined,
      params: { mid: songMid },
      timeout: 12000
    });
    const data = response.data?.data;
    if (response.data?.code !== 200 || !data?.lyric) return null;
    return {
      platform: 'qq',
      format: data.format === 'qrc' ? 'qrc' : 'lrc',
      lyric: String(data.lyric || ''),
      translation: String(data.translation || ''),
      romanization: String(data.romanization || '')
    };
  } catch (error) {
    if ((error as AxiosError).response?.status === 404) return null;
    throw gatewayError(error, 'QQ 歌词加载');
  }
}

export async function fetchMatchedQqLyric(song: SongResult): Promise<QqLyricPayload | null> {
  const matched = await searchGatewayMusic('qq', song);
  return matched?.platformId ? fetchQqLyric(matched.platformId) : null;
}

/** 通过严格元数据匹配获取酷狗 KRC 逐字歌词。 */
export async function fetchKugouLyric(song: SongResult): Promise<KugouLyricPayload | null> {
  const matched =
    song.platform === 'kugou' && song.platformId ? song : await searchGatewayMusic('kugou', song);
  const hash = String(matched?.platformId || '').trim();
  if (!hash) return null;

  try {
    const response = await gatewayRequest.get('/platform/kugou/lyric', {
      params: {
        hash,
        keyword: [song.name, ...songArtists(song).slice(0, 2)].filter(Boolean).join(' '),
        duration: Number(song.dt || song.duration || 0)
      },
      timeout: 15000
    });
    const data = response.data?.data;
    if (response.data?.code !== 200 || !data?.lyric) return null;
    return {
      platform: 'kugou',
      format: 'krc',
      lyric: String(data.lyric || ''),
      translation: String(data.translation || ''),
      romanization: String(data.romanization || '')
    };
  } catch (error) {
    if ((error as AxiosError).response?.status === 404) return null;
    return null;
  }
}
