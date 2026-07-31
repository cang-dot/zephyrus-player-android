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

import { isElectron } from '@/utils';
import request from '@/utils/request';

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

// ==================== 服务器中转 API ====================

/**
 * 通过服务器中转 API 创建二维码
 * 路由：GET /platform/{platform}/qr/create
 */
async function createQrViaServer(platform: LoginPlatform): Promise<QrCreateResult> {
  const response = await request.get(`/platform/${platform}/qr/create`, {
    params: { noCache: 1 }
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
}

/**
 * 通过服务器中转 API 轮询扫码状态
 * 路由：GET /platform/{platform}/qr/poll?key=xxx
 */
async function pollQrViaServer(platform: LoginPlatform, key: string): Promise<QrPollResult> {
  const response = await request.get(`/platform/${platform}/qr/poll`, {
    params: { key, noCache: 1 }
  });
  const json = response.data;
  if (json.code !== 200 || !json.data) {
    return { platform, code: 'error', message: json.msg || '轮询状态失败' };
  }
  const data = json.data;
  return {
    platform,
    code: data.status,
    message: data.message,
    cookie: data.cookie,
    userInfo: data.userInfo
  };
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
