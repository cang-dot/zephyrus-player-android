/**
 * 落雪音乐 HTTP 请求处理（主进程）
 * 绕过渲染进程的 CORS 限制
 */

import { ipcMain } from 'electron';
import fetch, { type RequestInit } from 'node-fetch';

interface LxHttpRequest {
  url: string;
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    form?: Record<string, string>;
    formData?: Record<string, string>;
    timeout?: number;
  };
  requestId: string;
}

interface LxHttpResponse {
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: any;
}

// 取消控制器映射
const abortControllers = new Map<string, AbortController>();

/**
 * 校验请求地址是否安全，禁止访问内网地址（防止 SSRF）
 * 仅允许 http/https 协议，且目标主机不能是本地/私网/链路本地地址
 */
function assertSafeUrl(urlStr: string): void {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new Error('无效的请求地址');
  }

  // 仅允许 http/https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('仅允许 http/https 协议的请求地址');
  }

  // IPv6 地址的 hostname 带方括号，统一去掉后判断
  const hostname = parsed.hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');

  // 禁止访问内网地址（字面量判断）
  const isPrivate =
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    hostname === '0.0.0.0' ||
    hostname === '::' ||
    hostname === '::1' ||
    hostname.startsWith('127.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('169.254.') ||
    // IPv6 唯一本地地址 fc00::/7（fc/fd 开头）与链路本地地址 fe80::/10
    /^f[cd]/.test(hostname) ||
    /^fe[89ab]/.test(hostname) ||
    // 172.16.0.0/12 私网段
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);

  if (isPrivate) {
    throw new Error('禁止访问内网地址');
  }
}

/**
 * 初始化 HTTP 请求处理
 */
export const initLxMusicHttp = () => {
  // 处理 HTTP 请求
  ipcMain.handle(
    'lx-music-http-request',
    async (_, request: LxHttpRequest): Promise<LxHttpResponse> => {
      const { url, options, requestId } = request;
      const controller = new AbortController();
      abortControllers.set(requestId, controller);

      try {
        // 校验目标地址，防止访问内网（SSRF）
        assertSafeUrl(url);

        const fetchOptions: RequestInit = {
          method: options.method || 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            ...(options.headers || {})
          },
          signal: controller.signal
        };

        // 处理请求体
        if (options.body) {
          fetchOptions.body = options.body;
        } else if (options.form) {
          const formData = new URLSearchParams(options.form);
          fetchOptions.body = formData.toString();
          fetchOptions.headers = {
            ...fetchOptions.headers,
            'Content-Type': 'application/x-www-form-urlencoded'
          };
        } else if (options.formData) {
          // node-fetch 的 FormData 需要特殊处理
          const FormData = (await import('form-data')).default;
          const formData = new FormData();
          for (const [key, value] of Object.entries(options.formData)) {
            formData.append(key, value);
          }
          fetchOptions.body = formData as any;
          // FormData 会自动设置 Content-Type
        }

        // 设置超时
        const timeout = options.timeout || 30000;
        const timeoutId = setTimeout(() => {
          console.warn(`[LxMusicHttp] 请求超时: ${url}`);
          controller.abort();
        }, timeout);

        const response = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);

        // 读取响应体
        const rawBody = await response.text();

        // 尝试解析 JSON
        let parsedBody: any = rawBody;
        const contentType = response.headers.get('content-type') || '';
        if (
          contentType.includes('application/json') ||
          rawBody.startsWith('{') ||
          rawBody.startsWith('[')
        ) {
          try {
            parsedBody = JSON.parse(rawBody);
          } catch {
            // 解析失败则使用原始字符串
          }
        }

        // 转换 headers 为普通对象
        const headers: Record<string, string | string[]> = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });

        const result: LxHttpResponse = {
          statusCode: response.status,
          headers,
          body: parsedBody
        };

        return result;
      } catch (error: any) {
        console.error(`[LxMusicHttp] 请求失败: ${url}`, error.message);
        throw error;
      } finally {
        // 清理取消控制器
        abortControllers.delete(requestId);
      }
    }
  );

  // 处理请求取消
  ipcMain.handle('lx-music-http-cancel', (_, requestId: string) => {
    const controller = abortControllers.get(requestId);
    if (controller) {
      controller.abort();
      abortControllers.delete(requestId);
    }
  });
};

/**
 * 清理所有正在进行的请求
 */
export const cleanupLxMusicHttp = () => {
  for (const [_requestId, controller] of abortControllers.entries()) {
    controller.abort();
  }
  abortControllers.clear();
};
