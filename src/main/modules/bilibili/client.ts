/**
 * B 站 API HTTP 客户端（主进程）
 *
 * 固定请求头：自管 Cookie（process.env.BILIBILI_COOKIE）+ 桌面浏览器 UA +
 * Referer/Origin = https://www.bilibili.com（B 站接口与 CDN 都校验来源）。
 * 未登录时 /x/web-interface/nav 会返回 code=-101，该接口需放行（wbi keys 匿名可取）。
 */
import fetch from 'node-fetch';

import { setWbiKeysFetcher } from './wbi';

export const BILIBILI_REFERER = 'https://www.bilibili.com/';
export const BILIBILI_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
export const BILIBILI_API_BASE = 'https://api.bilibili.com';

interface BilibiliResponse<T> {
  code: number;
  message?: string;
  data: T;
}

export interface BilibiliRequestOptions {
  /** 跳过 Cookie（匿名请求） */
  skipCookie?: boolean;
  /** 自定义 Referer（番剧页等场景需要更具体的来源） */
  referer?: string;
  timeoutMs?: number;
}

function currentCookie(): string {
  return process.env.BILIBILI_COOKIE || '';
}

export function bilibiliHeaders(options: BilibiliRequestOptions = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': BILIBILI_UA,
    Referer: options.referer || BILIBILI_REFERER,
    Origin: 'https://www.bilibili.com',
    Accept: 'application/json, text/plain, */*'
  };
  if (!options.skipCookie) {
    const cookie = currentCookie();
    if (cookie) headers.Cookie = cookie;
  }
  return headers;
}

/**
 * 请求 B 站 JSON 接口并解开外层 { code, message, data }
 */
export async function bilibiliGet<T>(
  endpoint: string,
  options: BilibiliRequestOptions & { query?: string } = {}
): Promise<T> {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${BILIBILI_API_BASE}${endpoint}${options.query ? `?${options.query}` : ''}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 12000);
  let payload: BilibiliResponse<T>;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: bilibiliHeaders(options),
      signal: controller.signal as any
    });
    if (!response.ok) {
      throw new Error(`B 站接口请求失败: ${response.status} ${response.statusText}`);
    }
    payload = (await response.json()) as BilibiliResponse<T>;
  } finally {
    clearTimeout(timer);
  }

  // nav 未登录返回 -101，但 wbi_img 仍然可用
  if (payload.code !== 0 && endpoint !== '/x/web-interface/nav') {
    throw new Error(`B 站接口返回异常: code=${payload.code} ${payload.message || ''}`.trim());
  }
  return payload.data;
}

/** 取 wbi_img / sub_url 里的 img_key、sub_key（供 wbi 模块按日缓存） */
async function fetchWbiKeys(): Promise<{ imgKey: string; subKey: string }> {
  const data = await bilibiliGet<{ wbi_img: { img_url: string; sub_url: string } }>(
    '/x/web-interface/nav',
    { skipCookie: false }
  );
  const imgUrl = data?.wbi_img?.img_url || '';
  const subUrl = data?.wbi_img?.sub_url || '';
  const imgKey = imgUrl.slice(imgUrl.lastIndexOf('/') + 1, imgUrl.lastIndexOf('.'));
  const subKey = subUrl.slice(subUrl.lastIndexOf('/') + 1, subUrl.lastIndexOf('.'));
  if (!imgKey || !subKey) {
    throw new Error('未能从 nav 接口解析 wbi keys');
  }
  return { imgKey, subKey };
}

setWbiKeysFetcher(fetchWbiKeys);

/**
 * 请求 B 站 CDN 资源（如字幕 JSON）。B 站 CDN 校验 Referer/UA，必须带自定义头。
 */
export async function bilibiliFetchText(url: string, timeoutMs = 12000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(normalizeUrl(url), {
      headers: bilibiliHeaders({ skipCookie: true }),
      signal: controller.signal as any
    });
    if (!response.ok) {
      throw new Error(`B 站资源请求失败: ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

/** B 站返回的图片/字幕地址常是协议相对（//host/path），补全为 https */
export function normalizeUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('http://')) return url.replace('http://', 'https://');
  return url;
}
