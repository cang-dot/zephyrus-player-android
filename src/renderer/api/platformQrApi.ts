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

// ==================== 类型定义 ====================

export type LoginPlatform = 'qq' | 'kugou';

export interface QrCreateResult {
  platform: LoginPlatform;
  qrUrl: string;
  key: string;
  expiredAt: number;
  error?: string;
}

export interface QrPollResult {
  platform: LoginPlatform;
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
async function createQrViaServer(platform: LoginPlatform): Promise<QrCreateResult> {
  try {
    const response = await gatewayRequest.get(`/platform/${platform}/qr/create`, {
      params: { noCache: Date.now() }
    });
    const json = response.data;
    if (json.code !== 200 || !json.data) {
      throw new Error(json.msg || `${platform} 二维码创建失败`);
    }
    return {
      platform,
      qrUrl: json.data.qrUrl,
      key: json.data.key,
      expiredAt: json.data.expiredAt
    };
  } catch (error) {
    throw gatewayError(error, `${platform} 二维码创建`);
  }
}

/**
 * 通过服务器中转 API 轮询扫码状态
 * 路由：GET /platform/{platform}/qr/poll?key=xxx
 */
async function pollQrViaServer(platform: LoginPlatform, key: string): Promise<QrPollResult> {
  try {
    const response = await gatewayRequest.get(`/platform/${platform}/qr/poll`, {
      params: { key, noCache: Date.now() }
    });
    const json = response.data;
    if (json.code !== 200 || !json.data) {
      return {
        platform,
        code: json.data?.status === 'expired' ? 'expired' : 'error',
        message: json.data?.message || json.msg || '轮询状态失败'
      };
    }
    const data = json.data;
    return {
      platform,
      code: data.status,
      message: data.message,
      cookie: data.cookie,
      userInfo: data.userInfo
    };
  } catch (error) {
    throw gatewayError(error, `${platform} 登录状态轮询`);
  }
}

// ==================== 统一入口 ====================

/**
 * 创建平台扫码二维码
 * - Electron: 走 IPC
 * - 移动端: 走服务器中转
 */
export async function createPlatformQr(platform: LoginPlatform): Promise<QrCreateResult> {
  // Electron 环境：走 IPC
  if (isElectron && (window as any).api?.platformQrCreate) {
    return (window as any).api.platformQrCreate(platform);
  }

  return createQrViaServer(platform);
}

/**
 * 轮询平台扫码状态
 * - Electron: 走 IPC
 * - 移动端: 走服务器中转
 */
export async function pollPlatformQr(platform: LoginPlatform, key: string): Promise<QrPollResult> {
  // Electron 环境：走 IPC
  if (isElectron && (window as any).api?.platformQrPoll) {
    return (window as any).api.platformQrPoll(platform, key);
  }

  return pollQrViaServer(platform, key);
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
