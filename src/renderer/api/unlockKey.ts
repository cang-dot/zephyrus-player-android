/**
 * 歌曲解锁密钥 API
 *
 * 安全模型：
 * - 站长在服务器后台录入 VIP cookie 并设置口令
 * - 用户输入口令 → 服务器校验 → 客户端只存储口令（永不接触 cookie）
 * - 播放 VIP 歌曲时，客户端带口令请求服务器代理端点
 * - 服务器在服务端拼接 cookie 向网易云发请求，只返回歌曲 URL
 *
 * 服务器地址: https://www.mucang.xyz/api
 */

const API_BASE = 'https://www.mucang.xyz/api';

export interface UnlockKeyStatus {
  valid: boolean;
  message?: string;
  expiresAt?: string;
}

/**
 * 校验口令是否有效
 * POST /api/unlock/verify
 * { token: "口令" } → { valid: true, expiresAt: "2025-12-31" }
 */
export async function verifyUnlockKey(token: string): Promise<UnlockKeyStatus> {
  try {
    const res = await fetch(`${API_BASE}/unlock/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const data = await res.json();
    if (!res.ok) {
      return { valid: false, message: data.error || `HTTP ${res.status}` };
    }
    return {
      valid: Boolean(data.valid),
      message: data.message,
      expiresAt: data.expiresAt
    };
  } catch (err) {
    console.error('[UnlockKey] 校验口令失败:', err);
    return { valid: false, message: '网络错误，请稍后重试' };
  }
}

/**
 * 通过口令在服务器代理获取 VIP 歌曲 URL
 * GET /api/unlock/song/url?id=xxx&level=xxx&token=口令
 * 服务器端拼接 cookie → 请求网易云 → 返回 { url, br, size, ... }
 */
export async function getUnlockSongUrl(
  id: number,
  token: string,
  level: string = 'higher'
): Promise<{ url: string | null; br?: number; size?: number }> {
  try {
    const params = new URLSearchParams({
      id: String(id),
      level,
      token
    });
    const res = await fetch(`${API_BASE}/unlock/song/url?${params}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (!res.ok) {
      console.warn('[UnlockKey] 代理获取歌曲URL失败:', data.error || res.status);
      return { url: null };
    }
    return {
      url: data.url || null,
      br: data.br,
      size: data.size
    };
  } catch (err) {
    console.error('[UnlockKey] 代理请求异常:', err);
    return { url: null };
  }
}

/**
 * 通过口令在服务器代理搜索 VIP 歌曲
 * GET /api/unlock/search?keywords=xxx&limit=30&token=口令
 * 服务器端拼接 cookie → 请求网易云搜索 → 返回带 VIP 标记的结果
 */
export async function getUnlockSearchResults(
  keywords: string,
  token: string,
  limit: number = 30,
  offset: number = 0
): Promise<{ songs: any[]; vipUnlocked: boolean }> {
  try {
    const params = new URLSearchParams({
      keywords,
      limit: String(limit),
      offset: String(offset),
      token
    });
    const res = await fetch(`${API_BASE}/unlock/search?${params}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (!res.ok) {
      console.warn('[UnlockKey] VIP 搜索代理失败:', data.error || res.status);
      return { songs: [], vipUnlocked: false };
    }
    return {
      songs: data.result?.songs || [],
      vipUnlocked: Boolean(data.vipUnlocked)
    };
  } catch (err) {
    console.error('[UnlockKey] VIP 搜索请求异常:', err);
    return { songs: [], vipUnlocked: false };
  }
}

/**
 * 获取服务器解锁系统状态（不需要口令）
 * GET /api/unlock/status
 */
export async function getUnlockStatus(): Promise<{
  tokenConfigured: boolean;
  cookieConfigured: boolean;
  vipSearchEnabled: boolean;
}> {
  try {
    const res = await fetch(`${API_BASE}/unlock/status`);
    const data = await res.json();
    return {
      tokenConfigured: Boolean(data.tokenConfigured),
      cookieConfigured: Boolean(data.cookieConfigured),
      vipSearchEnabled: Boolean(data.vipSearchEnabled)
    };
  } catch (err) {
    console.error('[UnlockKey] 获取解锁状态失败:', err);
    return { tokenConfigured: false, cookieConfigured: false, vipSearchEnabled: false };
  }
}

/**
 * 清除本地存储的口令
 */
export function clearUnlockKey(): void {
  localStorage.removeItem('unlock-key');
}

/**
 * 保存口令到本地
 */
export function saveUnlockKey(token: string): void {
  localStorage.setItem('unlock-key', token);
}

/**
 * 获取本地存储的口令
 */
export function getUnlockKey(): string | null {
  return localStorage.getItem('unlock-key');
}
