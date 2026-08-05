/**
 * Spotify OAuth 2.0 PKCE 认证模块
 *
 * PKCE (Proof Key for Code Exchange) 流程：
 * 1. 生成 code_verifier（随机字符串）和 code_challenge（SHA256 + Base64URL）
 * 2. 打开浏览器让用户授权
 * 3. Spotify 回调到 zephyrus://auth/callback?code=xxx
 * 4. 用 code + code_verifier 换取 access_token / refresh_token
 * 5. 后续用 refresh_token 续期
 */

// ==================== 配置 ====================

const CLIENT_ID = 'ce146b8d4abf493480f07cae71ebc681';
const REDIRECT_URI = 'zephyrus://auth/callback';
const SCOPES = [
  'user-read-private',
  'user-read-email',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'user-modify-playback-state',
  'user-read-playback-state',
  'streaming',
  'user-top-read',
  'user-read-recently-played'
].join(' ');

const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';

// ==================== Token 存储 ====================

const STORAGE_KEY = 'spotify-tokens';

export interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp (ms)
  tokenType: string;
  scope: string;
}

function loadTokens(): SpotifyTokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SpotifyTokens;
  } catch {
    return null;
  }
}

function saveTokens(tokens: SpotifyTokens): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

function clearTokens(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ==================== PKCE 工具函数 ====================

/** 生成高熵随机字符串作为 code_verifier（43-128 字符） */
function generateCodeVerifier(): string {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

/** 将 code_verifier 用 SHA-256 哈希后 Base64URL 编码，得到 code_challenge */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64URLEncode(new Uint8Array(digest));
}

/** Base64URL 编码（无 padding） */
function base64URLEncode(bytes: Uint8Array): string {
  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ==================== 认证流程 ====================

/** 暂存 PKCE code_verifier，等回调时使用 */
let pendingVerifier: string | null = null;

/**
 * 启动 Spotify 授权流程
 * 生成 PKCE 参数并打开浏览器让用户登录
 */
export async function startSpotifyAuth(): Promise<void> {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);

  // 暂存 verifier 到 sessionStorage（防止页面刷新丢失）
  sessionStorage.setItem('spotify-code-verifier', verifier);
  pendingVerifier = verifier;

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES,
    show_dialog: 'true'
  });

  const authUrl = `${AUTH_ENDPOINT}?${params.toString()}`;

  // 在移动端通过 Android Native 打开外部浏览器
  // 在桌面端/Electron 用 window.open
  if (typeof (window as any).AndroidNative !== 'undefined' && (window as any).AndroidNative.openExternal) {
    (window as any).AndroidNative.openExternal(authUrl);
  } else if (window.api?.openExternal) {
    void window.api.openExternal(authUrl);
  } else {
    window.open(authUrl, '_blank', 'noopener,noreferrer');
  }
}

/**
 * 处理 Spotify OAuth 回调
 * 从回调 URL 中提取 code，用 code + verifier 换取 token
 */
export async function handleSpotifyCallback(callbackUrl: string): Promise<boolean> {
  try {
    const url = new URL(callbackUrl);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      console.error('[Spotify Auth] 授权失败:', error);
      return false;
    }

    if (!code) {
      console.error('[Spotify Auth] 回调中没有 code 参数');
      return false;
    }

    // 从 sessionStorage 恢复 verifier
    const verifier = pendingVerifier || sessionStorage.getItem('spotify-code-verifier');
    if (!verifier) {
      console.error('[Spotify Auth] 找不到 code_verifier');
      return false;
    }

    // 清理暂存
    sessionStorage.removeItem('spotify-code-verifier');
    pendingVerifier = null;

    // 用 code 换 token
    const tokens = await exchangeCodeForToken(code, verifier);
    saveTokens(tokens);
    console.log('[Spotify Auth] 授权成功，token 已保存');
    return true;
  } catch (error) {
    console.error('[Spotify Auth] 处理回调失败:', error);
    return false;
  }
}

/** 用 authorization code 换取 access_token */
async function exchangeCodeForToken(code: string, verifier: string): Promise<SpotifyTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: verifier
  });

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    tokenType: data.token_type,
    scope: data.scope
  };
}

/** 用 refresh_token 续期 access_token */
async function refreshAccessToken(refreshToken: string): Promise<SpotifyTokens> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID
  });

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken, // Spotify 可能返回新的 refresh_token
    expiresAt: Date.now() + data.expires_in * 1000,
    tokenType: data.token_type,
    scope: data.scope
  };
}

/**
 * 获取有效的 access_token（自动续期）
 * @returns access_token 或 null（未登录/续期失败）
 */
export async function getValidAccessToken(): Promise<string | null> {
  const tokens = loadTokens();
  if (!tokens) return null;

  // 如果 token 还有 5 分钟以上有效期，直接用
  const bufferMs = 5 * 60 * 1000;
  if (Date.now() < tokens.expiresAt - bufferMs) {
    return tokens.accessToken;
  }

  // 尝试续期
  try {
    const newTokens = await refreshAccessToken(tokens.refreshToken);
    saveTokens(newTokens);
    return newTokens.accessToken;
  } catch (error) {
    console.error('[Spotify Auth] 续期失败，需要重新登录:', error);
    clearTokens();
    return null;
  }
}

/** 检查是否已登录 */
export function isSpotifyLoggedIn(): boolean {
  const tokens = loadTokens();
  return !!tokens?.accessToken;
}

/** 登出 */
export function spotifyLogout(): void {
  clearTokens();
  sessionStorage.removeItem('spotify-code-verifier');
  pendingVerifier = null;
}

/** 获取当前 token 信息（用于 UI 显示） */
export function getSpotifyTokens(): SpotifyTokens | null {
  return loadTokens();
}
