/**
 * 多平台扫码登录中转 API
 *
 * 挂载在 /platform/ 路径下：
 * - GET /platform/qq/qr/create    — 创建 QQ 音乐登录二维码
 * - GET /platform/qq/qr/poll      — 轮询 QQ 音乐扫码状态
 * - GET /platform/kugou/qr/create — 创建酷狗音乐登录二维码（新 API，带 Web 签名）
 * - GET /platform/kugou/qr/poll   — 轮询酷狗音乐扫码状态
 * - GET /platform/qr-display      — 动态二维码展示页（供其他设备打开扫码）
 *
 * 作用：作为移动端（Capacitor）和 QQ/酷狗官方 API 之间的中转，
 * 解决移动端直接调用时可能遇到的 CORS / Set-Cookie 读取问题。
 *
 * QQ 轮询需要携带 qrsig Cookie，否则返回 403。
 */

const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { decryptQrc } = require('qrc-decoder');

const router = express.Router();

function platformCors(req, res, next) {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Platform-Cookie, Cache-Control');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
}

router.use(platformCors);

// ==================== 更新发布信息自动同步（RELEASE_NOTE） ====================

const RELEASE_NOTE_FILE = '/var/www/zephyrus/apks/latest.json';
const RELEASE_NOTE_API =
  'https://api.github.com/repos/cang-dot/zephyrus-player-android/releases/latest';

/**
 * 从 GitHub Releases 拉取最新发布信息，写入服务器 latest.json（供 App 更新检查使用）
 */
async function syncReleaseNote() {
  try {
    const response = await axios.get(RELEASE_NOTE_API, {
      headers: {
        'User-Agent': 'Zephyrus-Player-Gateway',
        ...(process.env.GITHUB_TOKEN ? { Authorization: `token ${process.env.GITHUB_TOKEN}` } : {})
      },
      timeout: 15000,
      validateStatus: () => true
    });
    const release = response.data;
    if (!release?.tag_name || response.status >= 400) {
      throw new Error(`GitHub 返回异常 ${response.status}`);
    }
    const apk = (release.assets || []).find((asset) => String(asset?.name || '').endsWith('.apk'));
    const payload = {
      tag_name: release.tag_name,
      body: release.body || '',
      published_at: release.published_at || '',
      html_url: release.html_url || '',
      assets: [
        {
          name: apk?.name || `zephyrus-player-${release.tag_name}.apk`,
          browser_download_url: 'https://mucang.xyz/zephyrus/apks/zephyrus-player-latest.apk',
          size: apk?.size || 0
        }
      ]
    };
    fs.writeFileSync(RELEASE_NOTE_FILE, JSON.stringify(payload, null, 2));
    console.log(`[platformLogin] RELEASE_NOTE 已同步: ${release.tag_name}`);
    return true;
  } catch (error) {
    console.error('[platformLogin] RELEASE_NOTE 同步失败:', error.message);
    return false;
  }
}

// GET /platform/release-note/sync — 手动触发同步
router.get('/release-note/sync', async (req, res) => {
  const ok = await syncReleaseNote();
  res.json({
    code: ok ? 200 : 500,
    msg: ok ? 'RELEASE_NOTE 已同步' : '同步失败，请查看服务器日志'
  });
});

// 启动后自动同步一次，之后每 30 分钟自动同步
const releaseNoteInitialTimer = setTimeout(() => {
  syncReleaseNote();
}, 3000);
releaseNoteInitialTimer.unref?.();
const releaseNoteSyncTimer = setInterval(
  () => {
    syncReleaseNote();
  },
  30 * 60 * 1000
);
releaseNoteSyncTimer.unref?.();

// ==================== 工具函数 ====================

function md5(str) {
  return crypto.createHash('md5').update(str, 'utf8').digest('hex');
}

function generateMid() {
  return crypto.randomBytes(16).toString('hex');
}

function generateDfid() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function randomUuidFallback() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function cookiePartsFromString(cookie) {
  return String(cookie || '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.includes('='));
}

function setCookiesFromHeader(cookies) {
  const values = Array.isArray(cookies) ? cookies : cookies ? [cookies] : [];
  return values.map((cookie) => cookie.split(';')[0]);
}

function mergeCookieParts(...cookieSources) {
  const cookies = new Map();

  for (const source of cookieSources) {
    for (const part of cookiePartsFromString(source)) {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex > 0) {
        // QQ 常用同名空值 Cookie（如 p_skey=; Expires=...）清除旧值，
        // 跳过空值避免覆盖刚拿到的真实 Cookie。
        const value = part.slice(separatorIndex + 1);
        if (!value) continue;
        cookies.set(part.slice(0, separatorIndex), part);
      }
    }
  }

  return Array.from(cookies.values()).join('; ');
}

function cookieMap(cookie) {
  const result = {};
  for (const part of cookiePartsFromString(cookie)) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex > 0) {
      result[part.slice(0, separatorIndex)] = part.slice(separatorIndex + 1);
    }
  }
  return result;
}

function firstOwnValue(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const entries = Object.entries(value);
  for (const key of keys) {
    const match = entries.find(([candidate]) => candidate.toLowerCase() === key.toLowerCase());
    if (!match) continue;
    const candidate = match[1];
    if (candidate === null || candidate === undefined) continue;
    if (
      typeof candidate === 'string' ||
      typeof candidate === 'number' ||
      typeof candidate === 'boolean'
    ) {
      const text = String(candidate).trim();
      if (text) return text;
    }
  }
  return '';
}

function firstDeepValue(value, keys, depth = 0) {
  if (depth > 5 || value === null || value === undefined) return '';
  const ownValue = firstOwnValue(value, keys);
  if (ownValue) return ownValue;
  if (typeof value !== 'object') return '';

  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    const result = firstDeepValue(child, keys, depth + 1);
    if (result) return result;
  }
  return '';
}

function normalizeImageUrl(value, placeholderSize = '400') {
  if (!value) return '';
  let url = String(value)
    .trim()
    .replace(/\{size\}/gi, placeholderSize);
  if (url.startsWith('//')) url = `https:${url}`;
  if (url.startsWith('http://')) url = `https://${url.slice(7)}`;
  return url;
}

function parsePtuiCallback(payload) {
  const callbackMatch = String(payload || '').match(/ptuiCB\s*\(([\s\S]*?)\)\s*;?/);
  if (!callbackMatch) return null;

  const args = [];
  const argumentPattern = /'((?:\\.|[^'\\])*)'/g;
  let argumentMatch;
  while ((argumentMatch = argumentPattern.exec(callbackMatch[1]))) {
    args.push(argumentMatch[1].replace(/\\(['\\])/g, '$1'));
  }

  const code = Number.parseInt(args[0], 10);
  if (!Number.isFinite(code) || args.length < 3) return null;

  return {
    code,
    redirectUrl: args[2] || '',
    message: args[4] || args[3] || ''
  };
}

// ==================== QQ 会话存储（qrsig -> cookies） ====================

const QQ_SESSION_TTL = 5 * 60 * 1000;
const QQ_SESSION_DIR =
  process.env.ZEPHYRUS_QQ_SESSION_DIR || path.join(os.tmpdir(), 'zephyrus-qq-sessions');
const qqSessionStore = new Map();

function qqSessionFile(qrsig) {
  const fileKey = crypto.createHash('sha256').update(String(qrsig)).digest('hex');
  return path.join(QQ_SESSION_DIR, `${fileKey}.json`);
}

function normalizeQqSession(session) {
  if (!session || typeof session !== 'object') return null;
  const cookie = String(session.cookie || '').trim();
  const createdAt = Number(session.createdAt);
  const updatedAt = Number(session.updatedAt || createdAt);
  if (!cookie || !Number.isFinite(createdAt) || !Number.isFinite(updatedAt)) return null;
  if (Date.now() - createdAt > QQ_SESSION_TTL) return null;
  return { cookie, createdAt, updatedAt };
}

function readQqSession(qrsig) {
  const key = String(qrsig || '').trim();
  if (!key) return null;

  let diskSession = null;
  const filePath = qqSessionFile(key);
  try {
    diskSession = normalizeQqSession(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } catch {
    diskSession = null;
  }

  const memorySession = normalizeQqSession(qqSessionStore.get(key));
  const session =
    diskSession && memorySession
      ? diskSession.updatedAt >= memorySession.updatedAt
        ? diskSession
        : memorySession
      : diskSession || memorySession;

  if (!session) {
    qqSessionStore.delete(key);
    try {
      fs.rmSync(filePath, { force: true });
    } catch {
      return null;
    }
    return null;
  }

  qqSessionStore.set(key, session);
  return session;
}

function saveQqSession(qrsig, session) {
  const key = String(qrsig || '').trim();
  const normalized = normalizeQqSession({
    ...session,
    updatedAt: Date.now()
  });
  if (!key || !normalized) {
    throw new Error('QQ 登录会话无效，请刷新二维码重试');
  }

  qqSessionStore.set(key, normalized);
  try {
    fs.mkdirSync(QQ_SESSION_DIR, { recursive: true, mode: 0o700 });
    fs.writeFileSync(qqSessionFile(key), JSON.stringify(normalized), {
      encoding: 'utf8',
      mode: 0o600
    });
  } catch (error) {
    qqSessionStore.delete(key);
    throw new Error(`QQ 登录会话存储失败: ${error.message}`);
  }
}

function deleteQqSession(qrsig) {
  const key = String(qrsig || '').trim();
  if (!key) return;
  qqSessionStore.delete(key);
  try {
    fs.rmSync(qqSessionFile(key), { force: true });
  } catch {
    return;
  }
}

function cleanupQqSessions() {
  for (const key of qqSessionStore.keys()) readQqSession(key);
  try {
    for (const fileName of fs.readdirSync(QQ_SESSION_DIR)) {
      if (!fileName.endsWith('.json')) continue;
      const filePath = path.join(QQ_SESSION_DIR, fileName);
      try {
        const session = normalizeQqSession(JSON.parse(fs.readFileSync(filePath, 'utf8')));
        if (!session) fs.rmSync(filePath, { force: true });
      } catch {
        fs.rmSync(filePath, { force: true });
      }
    }
  } catch {
    return;
  }
}

const sessionCleanupTimer = setInterval(cleanupQqSessions, 5 * 60 * 1000);
sessionCleanupTimer.unref?.();

router.get('/health', (_req, res) => {
  res.json({
    code: 200,
    data: {
      service: 'zephyrus-music-gateway',
      platforms: ['qq', 'kugou', 'spotify']
    }
  });
});

// ==================== QQ 音乐扫码登录 ====================

const QQ_APPID = '716027609';
const QQ_DAID = '383';
const QQ_PT_3RD_AID = '100497308';
const QQ_REDIRECT = 'https://graph.qq.com/oauth2.0/login_jump';
const QQ_MUSIC_REDIRECT =
  'https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=https://y.qq.com/';
const QQ_JS_VER = '20102616';
const QQ_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const QQ_LYRIC_CACHE_TTL = 6 * 60 * 60 * 1000;
const QQ_LYRIC_MISS_TTL = 5 * 60 * 1000;
const QQ_LYRIC_CACHE_LIMIT = 500;
const QQ_LYRIC_RATE_WINDOW = 60 * 1000;
const QQ_LYRIC_RATE_LIMIT = 30;

const qqLyricCache = new Map();
const qqLyricRateWindows = new Map();

function requestClientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  return forwarded || req.socket?.remoteAddress || 'unknown';
}

function enforceQqLyricRateLimit(req, res) {
  const now = Date.now();
  const key = requestClientIp(req);
  let windowState = qqLyricRateWindows.get(key);
  if (!windowState || now >= windowState.resetAt) {
    windowState = { count: 0, resetAt: now + QQ_LYRIC_RATE_WINDOW };
  }
  windowState.count += 1;
  qqLyricRateWindows.set(key, windowState);
  if (windowState.count <= QQ_LYRIC_RATE_LIMIT) return true;
  res.setHeader('Retry-After', String(Math.max(1, Math.ceil((windowState.resetAt - now) / 1000))));
  res.status(429).json({ code: 429, msg: 'QQ 歌词请求过于频繁，请稍后重试' });
  return false;
}

function getCachedQqLyric(mid) {
  const entry = qqLyricCache.get(mid);
  if (!entry) return undefined;
  if (Date.now() >= entry.expiresAt) {
    qqLyricCache.delete(mid);
    return undefined;
  }
  qqLyricCache.delete(mid);
  qqLyricCache.set(mid, entry);
  return entry.value;
}

function setCachedQqLyric(mid, value) {
  qqLyricCache.delete(mid);
  qqLyricCache.set(mid, {
    value,
    expiresAt: Date.now() + (value ? QQ_LYRIC_CACHE_TTL : QQ_LYRIC_MISS_TTL)
  });
  while (qqLyricCache.size > QQ_LYRIC_CACHE_LIMIT) {
    qqLyricCache.delete(qqLyricCache.keys().next().value);
  }
}

function decodeBase64Lyric(value) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) return '';
  const decoded = Buffer.from(value, 'base64')
    .toString('utf8')
    .replace(/^\uFEFF/, '');
  return /(?:^|\n)\s*(?:<|\[)/.test(decoded) ? decoded : '';
}

function decodeQqLyricField(value, encrypted = false) {
  const text = String(value || '').trim();
  if (!text) return '';
  const looksEncryptedHex = text.length % 2 === 0 && /^[\da-f]+$/i.test(text);
  if (encrypted || looksEncryptedHex) return decryptQrc(text);
  if (/^(?:<|\[)/.test(text)) return text;
  return decodeBase64Lyric(text) || text;
}

function cleanupQqLyricState() {
  const now = Date.now();
  for (const [key, entry] of qqLyricCache) {
    if (now >= entry.expiresAt) qqLyricCache.delete(key);
  }
  for (const [key, windowState] of qqLyricRateWindows) {
    if (now >= windowState.resetAt) qqLyricRateWindows.delete(key);
  }
}

const qqLyricCleanupTimer = setInterval(cleanupQqLyricState, 5 * 60 * 1000);
qqLyricCleanupTimer.unref?.();

let spotifyAccessToken = '';
let spotifyAccessTokenExpiresAt = 0;

async function getSpotifyAccessToken() {
  const configuredToken = process.env.SPOTIFY_ACCESS_TOKEN || '';
  if (configuredToken) return configuredToken;

  const clientId = process.env.SPOTIFY_CLIENT_ID || '';
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';
  if (!clientId || !clientSecret) {
    throw new Error('Spotify 搜索需要配置 SPOTIFY_CLIENT_ID 和 SPOTIFY_CLIENT_SECRET');
  }
  if (spotifyAccessToken && spotifyAccessTokenExpiresAt > Date.now() + 30_000) {
    return spotifyAccessToken;
  }

  const tokenResponse = await axios.post(
    'https://accounts.spotify.com/api/token',
    'grant_type=client_credentials',
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 12000
    }
  );
  if (!tokenResponse.data?.access_token) throw new Error('Spotify access token 获取失败');
  spotifyAccessToken = tokenResponse.data.access_token;
  spotifyAccessTokenExpiresAt = Date.now() + Number(tokenResponse.data.expires_in || 3600) * 1000;
  return spotifyAccessToken;
}

// GET /platform/spotify/search?keyword=xxx&limit=20
router.get('/spotify/search', async (req, res) => {
  const keyword = String(req.query.keyword || req.query.q || '').trim();
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  if (!keyword) return res.json({ code: 200, data: { tracks: [] } });

  try {
    const accessToken = await getSpotifyAccessToken();
    const response = await axios.get('https://api.spotify.com/v1/search', {
      params: { type: 'track', limit, q: keyword },
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 12000
    });
    const tracks = (response.data?.tracks?.items || []).map((track) => ({
      id: String(track.id),
      name: track.name || '',
      artists: (track.artists || []).map((artist) => artist.name || '').filter(Boolean),
      album: track.album?.name || '',
      duration: Number(track.duration_ms) || 0,
      picUrl: track.album?.images?.[0]?.url || '',
      externalUrl: track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`
    }));
    return res.json({ code: 200, data: { tracks } });
  } catch (error) {
    const status = error.response?.status || 502;
    console.error('[platformLogin] Spotify search error:', error.message);
    return res.status(status).json({ code: status, msg: error.message || 'Spotify 搜索失败' });
  }
});

function hash33(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h += (h << 5) + s.charCodeAt(i);
  }
  return h & 0x7fffffff;
}

function qqGtk(cookie) {
  const values = cookieMap(cookie);
  const key =
    values.qqmusic_key || values.p_skey || values.skey || values.p_lskey || values.lskey || '';
  let hash = 5381;
  for (const character of decodeURIComponent(key)) {
    hash += (hash << 5) + character.charCodeAt(0);
  }
  return hash & 0x7fffffff;
}

function normalizeQQUserId(value) {
  const text = String(value || '')
    .trim()
    .replace(/^o(?=\d)/i, '');
  return text;
}

function extractQQOAuthCode(response) {
  const values = [
    response?.headers?.location,
    response?.data?.location,
    response?.data?.redirect_uri,
    response?.data?.redirectUrl,
    response?.data
  ];

  for (const value of values) {
    if (!value) continue;
    let text = (typeof value === 'string' ? value : JSON.stringify(value))
      .replace(/&amp;/gi, '&')
      .replace(/\\u0026/gi, '&');
    for (let attempt = 0; attempt < 3; attempt++) {
      const queryMatch = text.match(/[?&#](?:code|auth_code)=([^&#"'\\\s]+)/i);
      if (queryMatch?.[1]) return decodeURIComponent(queryMatch[1]);
      const bodyMatch = text.match(
        /(?:["']|\\)?(?:code|auth_code)(?:["']|\\)?\s*[:=]\s*(?:["']|\\)?([^&"'\\\s,}]+)/i
      );
      if (bodyMatch?.[1]) return decodeURIComponent(bodyMatch[1]);
      try {
        const decoded = decodeURIComponent(text);
        if (decoded === text) break;
        text = decoded;
      } catch {
        break;
      }
    }
  }
  return '';
}

function createQQLoginFromCookie(cookie, loginData = {}) {
  const values = cookieMap(cookie);
  const userId = normalizeQQUserId(
    firstDeepValue(loginData, ['musicid', 'uin', 'user_id', 'userid']) ||
      values.uin ||
      values.p_uin ||
      values.ptui_loginuin
  );
  const musicKey =
    firstDeepValue(loginData, ['musickey', 'music_key', 'qm_keyst', 'qqmusic_key']) ||
    values.qm_keyst ||
    values.qqmusic_key ||
    values.p_skey ||
    values.skey;

  if (!userId || !musicKey) return null;

  let resultCookie = cookie;
  if (!values.uin) {
    resultCookie = mergeCookieParts(resultCookie, `uin=${userId}`);
  }
  if (!values.qm_keyst && !values.qqmusic_key && !values.p_skey && !values.skey) {
    resultCookie = mergeCookieParts(resultCookie, `qm_keyst=${musicKey}`);
  }

  const avatarUin = userId.replace(/^o/i, '');
  return {
    cookie: resultCookie,
    userInfo: {
      userId,
      nickname:
        firstDeepValue(loginData, ['nickname', 'nickName', 'nick', 'username']) || 'QQ音乐用户',
      avatarUrl: /^\d+$/.test(avatarUin) ? `https://q1.qlogo.cn/g?b=qq&nk=${avatarUin}&s=100` : ''
    }
  };
}

/**
 * 获取 QQ 音乐账号的真实昵称/头像（登录态接口优先，公开主页兜底）
 */
async function fetchQqUserInfo(cookie) {
  const values = cookieMap(cookie);
  const userId = normalizeQQUserId(values.uin || values.p_uin || values.ptui_loginuin || '');
  if (!userId) return null;

  // 1) 登录态接口（含昵称/头像/VIP）
  const key = values.qm_keyst || values.qqmusic_key || values.p_skey || values.skey || '';
  if (key) {
    try {
      const resp = await axios.post(
        'https://u.y.qq.com/cgi-bin/musicu.fcg',
        JSON.stringify({
          comm: { g_tk: 5381, platform: 'yqq', ct: 24, cv: 0 },
          req: {
            module: 'music.UserInfo.userInfoServer',
            method: 'GetLoginUserInfo',
            param: {}
          }
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': QQ_USER_AGENT,
            Referer: 'https://y.qq.com/',
            Cookie: cookie
          },
          timeout: 12000,
          validateStatus: () => true
        }
      );
      const data = resp.data?.req?.data || resp.data?.data;
      const nickname =
        firstDeepValue(data, ['nickname', 'nick', 'user_name']) ||
        firstDeepValue(resp.data, ['nickname', 'nick', 'user_name']);
      if (nickname) {
        return {
          nickname,
          avatarUrl: firstDeepValue(data, ['avatarUrl', 'avatar_url', 'headpic', 'head_pic']) || '',
          vip: Boolean(firstDeepValue(data, ['vip', 'is_vip']))
        };
      }
    } catch (error) {
      console.warn('[platformLogin] QQ GetLoginUserInfo 失败，使用公开主页兜底:', error.message);
    }
  }

  // 2) 公开主页兜底（仅需 uin）
  try {
    const profileResp = await axios.get(
      'https://c6.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg',
      {
        params: { ct: 20, cv: 4747474, cid: 205360838, userid: userId },
        headers: {
          'User-Agent': QQ_USER_AGENT,
          Referer: 'https://y.qq.com/'
        },
        timeout: 12000,
        validateStatus: () => true
      }
    );
    const creator = profileResp.data?.data?.creator;
    if (creator?.nick) {
      return {
        nickname: creator.nick,
        avatarUrl: creator.headpic || '',
        vip: false
      };
    }
  } catch (error) {
    console.warn('[platformLogin] QQ 公开主页信息获取失败:', error.message);
  }

  return null;
}

async function completeQQLogin(redirectUrl, sessionCookie) {
  let redirect;
  try {
    redirect = new URL(redirectUrl);
  } catch {
    throw new Error('QQ 登录回调地址无效，请重新扫码');
  }
  if (redirect.protocol !== 'https:' || redirect.hostname !== 'ssl.ptlogin2.graph.qq.com') {
    throw new Error('QQ 登录回调地址不受信任，请重新扫码');
  }

  // 从 ptqrlogin 回调地址中解析 uin 与 ptsigx，再显式重建 check_sig 请求，
  // 与当前 QQ 音乐 Web 端实际使用的参数保持一致（参照 QQMusicApi-nodejs 架构）。
  const uinMatch = redirectUrl.match(/[?&]uin=([^&]+)/i);
  const ptsigxMatch = redirectUrl.match(/[?&]ptsigx=([^&]+)/i);
  if (!uinMatch?.[1] || !ptsigxMatch?.[1]) {
    throw new Error(`QQ 登录回调缺少 uin/ptsigx 参数，请重新扫码`);
  }
  const checkSigUrl =
    'https://ssl.ptlogin2.graph.qq.com/check_sig' +
    `?uin=${encodeURIComponent(uinMatch[1])}` +
    '&pttype=1&service=ptqrlogin&nodirect=0' +
    `&ptsigx=${encodeURIComponent(ptsigxMatch[1])}` +
    `&s_url=${encodeURIComponent('https://graph.qq.com/oauth2.0/login_jump')}` +
    '&ptlang=2052&ptredirect=100' +
    `&aid=${QQ_APPID}&daid=${QQ_DAID}` +
    '&j_later=0&low_login_hour=0&regmaster=0&pt_login_type=3&pt_aid=0&pt_aaid=16&pt_light=0' +
    `&pt_3rd_aid=${QQ_PT_3RD_AID}`;

  const checkSigResponse = await axios.get(checkSigUrl, {
    headers: {
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'User-Agent': QQ_USER_AGENT,
      Referer: 'https://xui.ptlogin2.qq.com/',
      Cookie: sessionCookie
    },
    maxRedirects: 0,
    validateStatus: () => true
  });
  if (checkSigResponse.status >= 400) {
    throw new Error(`QQ check_sig 请求被拒绝 (${checkSigResponse.status})`);
  }

  const checkSigSetCookie = setCookiesFromHeader(checkSigResponse.headers['set-cookie']).join('; ');
  let graphCookie = mergeCookieParts(sessionCookie, checkSigSetCookie);

  // check_sig 必须返回 p_skey，否则后续 OAuth 授权必然失败。
  const checkSigCookies = cookieMap(graphCookie);
  const pSkey =
    checkSigCookies.p_skey ||
    checkSigCookies.pskey ||
    checkSigCookies['p-skey'] ||
    checkSigCookies.skey ||
    checkSigCookies.ptsigx;
  if (!pSkey) {
    const bodyPreview = String(checkSigResponse.data || '')
      .replace(/\s+/g, ' ')
      .slice(0, 200);
    throw new Error(
      `QQ check_sig 未获取到 p_skey (status=${checkSigResponse.status}, ` +
        `set-cookie=${checkSigSetCookie || '<empty>'}, body=${bodyPreview || '<empty>'})，请重新扫码`
    );
  }

  const authorizeBody = new URLSearchParams({
    response_type: 'code',
    client_id: '100497308',
    redirect_uri: QQ_MUSIC_REDIRECT,
    scope: 'get_user_info,get_app_friends',
    state: 'state',
    switch: '',
    from_ptlogin: '1',
    src: '1',
    update_auth: '1',
    openapi: '1010_1030',
    g_tk: String(qqGtk(graphCookie)),
    auth_time: String(Date.now()),
    ui: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : randomUuidFallback()
  }).toString();

  const authorizeResponse = await axios.post(
    'https://graph.qq.com/oauth2.0/authorize',
    authorizeBody,
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': QQ_USER_AGENT,
        Referer: 'https://xui.ptlogin2.qq.com/',
        Cookie: graphCookie
      },
      maxRedirects: 0,
      validateStatus: () => true
    }
  );

  graphCookie = mergeCookieParts(
    graphCookie,
    setCookiesFromHeader(authorizeResponse.headers['set-cookie']).join('; ')
  );
  const oauthCode = extractQQOAuthCode(authorizeResponse);
  if (!oauthCode) {
    const fallbackLogin = createQQLoginFromCookie(graphCookie);
    if (fallbackLogin) return fallbackLogin;
    const location = String(authorizeResponse.headers?.location || '');
    const bodyPreview = String(authorizeResponse.data || '')
      .replace(/\s+/g, ' ')
      .slice(0, 200);
    throw new Error(
      `QQ OAuth 授权码获取失败 (status=${authorizeResponse.status}, ` +
        `location=${location.slice(0, 200) || '<empty>'}, body=${bodyPreview || '<empty>'})，请重新扫码`
    );
  }

  const musicResponse = await axios.post(
    'https://u.y.qq.com/cgi-bin/musicu.fcg',
    JSON.stringify({
      comm: { g_tk: 5381, platform: 'yqq', ct: 24, cv: 0 },
      req: {
        module: 'QQConnectLogin.LoginServer',
        method: 'QQLogin',
        param: { code: decodeURIComponent(oauthCode) }
      }
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': QQ_USER_AGENT,
        Referer: 'https://y.qq.com/',
        Cookie: graphCookie
      },
      validateStatus: () => true
    }
  );

  if (musicResponse.status < 200 || musicResponse.status >= 300) {
    throw new Error(`QQ 音乐授权接口请求失败 (${musicResponse.status})`);
  }

  const loginData = musicResponse.data;
  let resultCookie = mergeCookieParts(
    graphCookie,
    setCookiesFromHeader(musicResponse.headers['set-cookie']).join('; ')
  );
  const musicKey = firstDeepValue(loginData, ['musickey', 'music_key', 'qm_keyst', 'qqmusic_key']);
  const musicUin = firstDeepValue(loginData, ['musicid', 'uin', 'user_id', 'userid']);
  if (musicKey && !cookieMap(resultCookie).qm_keyst && !cookieMap(resultCookie).qqmusic_key) {
    resultCookie = mergeCookieParts(resultCookie, `qm_keyst=${musicKey}`);
  }
  const normalizedUin = normalizeQQUserId(
    musicUin || cookieMap(resultCookie).uin || cookieMap(resultCookie).ptui_loginuin
  );
  if (normalizedUin && !cookieMap(resultCookie).uin) {
    resultCookie = mergeCookieParts(resultCookie, `uin=${normalizedUin}`);
  }

  const completedLogin = createQQLoginFromCookie(resultCookie, loginData);
  if (!completedLogin) {
    throw new Error('QQ 音乐登录密钥获取失败，请重新扫码');
  }
  // 登录成功后拉取真实昵称/头像
  try {
    const userInfo = await fetchQqUserInfo(completedLogin.cookie);
    if (userInfo) {
      completedLogin.userInfo = {
        ...completedLogin.userInfo,
        ...userInfo
      };
    }
  } catch (error) {
    console.warn('[platformLogin] QQ 用户信息补充失败:', error.message);
  }
  return completedLogin;
}

// GET /platform/qq/qr/create
router.get('/qq/qr/create', async (req, res) => {
  try {
    const t = Math.random().toString(36).substring(2, 10);
    const url = `https://ssl.ptlogin2.qq.com/ptqrshow?appid=${QQ_APPID}&e=2&l=M&s=3&d=72&v=4&t=${t}&daid=${QQ_DAID}&pt_3rd_aid=${QQ_PT_3RD_AID}`;

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': QQ_USER_AGENT,
        Referer: 'https://y.qq.com/'
      },
      maxRedirects: 0,
      validateStatus: () => true
    });

    const setCookies = response.headers['set-cookie'] || [];
    let qrsig = '';

    for (const cookie of setCookies) {
      const match = cookie.match(/qrsig=([^;]+)/);
      if (match) {
        qrsig = match[1];
      }
    }

    if (!qrsig) {
      return res.json({ code: 500, msg: 'QQ 二维码创建失败: 未获取到 qrsig' });
    }

    saveQqSession(qrsig, {
      cookie: setCookiesFromHeader(setCookies).join('; '),
      createdAt: Date.now()
    });

    const base64 = Buffer.from(response.data).toString('base64');

    res.json({
      code: 200,
      data: {
        qrUrl: `data:image/png;base64,${base64}`,
        key: qrsig,
        expiredAt: Date.now() + 2 * 60 * 1000
      }
    });
  } catch (error) {
    console.error('[platformLogin] QQ QR create error:', error.message);
    res.json({ code: 500, msg: `QQ 二维码创建失败: ${error.message}` });
  }
});

// GET /platform/qq/qr/poll?key=xxx
router.get('/qq/qr/poll', async (req, res) => {
  try {
    const qrsig = req.query.key;
    if (!qrsig) {
      return res.json({ code: 400, msg: '缺少 key (qrsig) 参数' });
    }

    const session = readQqSession(qrsig);
    if (!session) {
      return res.json({
        code: 200,
        data: { status: 'expired', message: '登录会话已失效，请刷新二维码重试' }
      });
    }
    const cookieStr = session.cookie;

    const ptqrtoken = hash33(qrsig);
    const time = Date.now();
    const url =
      `https://ssl.ptlogin2.qq.com/ptqrlogin?u1=${encodeURIComponent(QQ_REDIRECT)}` +
      `&ptqrtoken=${ptqrtoken}&ptredirect=0&h=1&t=1&g=1&from_ui=1&ptlang=2052` +
      `&action=0-0-${time}&js_ver=${QQ_JS_VER}&js_type=1&login_sig=&has_onekey=1` +
      `&pt_uistyle=40&aid=${QQ_APPID}&daid=${QQ_DAID}&pt_3rd_aid=${QQ_PT_3RD_AID}`;

    const response = await axios.get(url, {
      headers: {
        'User-Agent': QQ_USER_AGENT,
        Referer: 'https://xui.ptlogin2.qq.com/',
        Cookie: cookieStr
      },
      maxRedirects: 0,
      validateStatus: () => true
    });

    // 处理 403 错误
    if (response.status === 403) {
      return res.json({
        code: 200,
        data: { status: 'error', message: 'QQ 服务器拒绝访问 (403)，请刷新二维码重试' }
      });
    }

    const responseCookie = setCookiesFromHeader(response.headers['set-cookie']).join('; ');
    const mergedSessionCookie = mergeCookieParts(cookieStr, responseCookie);
    saveQqSession(qrsig, {
      cookie: mergedSessionCookie,
      createdAt: session.createdAt
    });

    const text = typeof response.data === 'string' ? response.data : String(response.data);

    const callback = parsePtuiCallback(text);
    if (!callback) {
      return res.json({
        code: 500,
        msg: 'QQ 登录状态解析失败，请刷新二维码重试',
        data: { status: 'error' }
      });
    }

    const { code, redirectUrl, message: messageText } = callback;

    // 66 = 等待扫码, 67 = 已扫码等待确认, 65/68 = 过期, 0 = 登录成功
    if (code === 66) {
      return res.json({ code: 200, data: { status: 'waiting', message: '等待扫码' } });
    }
    if (code === 67) {
      return res.json({
        code: 200,
        data: { status: 'scanned', message: '已扫码，请在手机上确认登录' }
      });
    }
    if (code === 65 || code === 68) {
      deleteQqSession(qrsig);
      return res.json({ code: 200, data: { status: 'expired', message: '二维码已过期' } });
    }

    // 0 = 登录成功
    if (code === 0 && redirectUrl) {
      try {
        const loginResult = await completeQQLogin(redirectUrl, mergedSessionCookie);

        deleteQqSession(qrsig);

        return res.json({
          code: 200,
          data: {
            status: 'success',
            message: 'QQ 音乐登录成功',
            cookie: loginResult.cookie,
            userInfo: loginResult.userInfo
          }
        });
      } catch (error) {
        deleteQqSession(qrsig);
        return res.json({
          code: 500,
          data: { status: 'error', message: `获取 Cookie 失败: ${error.message}` }
        });
      }
    }

    deleteQqSession(qrsig);
    return res.json({
      code: 200,
      data: {
        status: 'error',
        message: messageText || `QQ 登录失败 (${code})`
      }
    });
  } catch (error) {
    console.error('[platformLogin] QQ QR poll error:', error.message);
    res.json({ code: 500, msg: `QQ 轮询失败: ${error.message}` });
  }
});

// ==================== 酷狗音乐扫码登录（新 API，带 Web 签名） ====================

const KUGOU_WEB_SALT = 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt';
const KUGOU_ANDROID_SALT = 'LnT6xpN3khm36zse0QzvmgTZ3waWdRSA';
const KUGOU_SRC_APPID = 2919;
const KUGOU_APPID = 3116;
const KUGOU_CLIENTVER = 11436;
const KUGOU_USER_AGENT = 'Android15-1070-11083-46-0-DiscoveryDRADProtocol-wifi';
const KUGOU_LITE_PUBLIC_KEY =
  '-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDECi0Np2UR87scwrvTr72L6oO01rBbbBPriSDFPxr3Z5syug0O24QyQO8bg27+0+4kBzTBTBOZ/WWU0WryL1JSXRTXLgFVxtzIY41Pe7lPOgsfTCn5kZcvKhYKJesKnnJDNr5/abvTGf+rHG3YRwsCHcQ08/q6ifSioBszvb3QiwIDAQAB\n-----END PUBLIC KEY-----';

let kugouMid = generateMid();
let kugouDfid = generateDfid();

function kugouWebSign(params) {
  const sortedKeys = Object.keys(params).sort();
  let paramsStr = '';
  for (const key of sortedKeys) {
    let val = params[key];
    if (val === null || val === undefined) val = '';
    if (val === true) val = '1';
    if (val === false) val = '0';
    paramsStr += `${key}=${val}`;
  }
  return md5(`${KUGOU_WEB_SALT}${paramsStr}${KUGOU_WEB_SALT}`);
}

function kugouAndroidSign(params, body) {
  const paramsStr = Object.keys(params)
    .sort()
    .map((key) => {
      let value = params[key];
      if (value === null || value === undefined) value = '';
      if (value === true) value = '1';
      if (value === false) value = '0';
      return `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`;
    })
    .join('');
  return md5(`${KUGOU_ANDROID_SALT}${paramsStr}${body}${KUGOU_ANDROID_SALT}`);
}

function getKugouContext(cookie) {
  const values = cookieMap(cookie);
  return {
    values,
    userid: String(values.userid || '').trim(),
    token: String(values.token || '').trim(),
    dfid: String(values.dfid || kugouDfid).trim() || kugouDfid,
    mid: String(values.KUGOU_API_MID || values.mid || kugouMid).trim() || kugouMid
  };
}

async function requestKugouApi(
  cookie,
  path,
  body,
  extraParams = {},
  extraHeaders = {},
  clienttime
) {
  const context = getKugouContext(cookie);
  const requestTime = clienttime || Math.floor(Date.now() / 1000);
  const params = {
    dfid: context.dfid,
    mid: context.mid,
    uuid: '-',
    appid: KUGOU_APPID,
    clientver: KUGOU_CLIENTVER,
    clienttime: requestTime,
    token: context.token,
    userid: context.userid,
    ...extraParams
  };
  const bodyText = body ? JSON.stringify(body) : '';
  params.signature = kugouAndroidSign(params, bodyText);

  return axios.post(`https://gateway.kugou.com${path}`, bodyText, {
    params,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': KUGOU_USER_AGENT,
      dfid: context.dfid,
      clienttime: String(requestTime),
      mid: context.mid,
      Cookie: [
        `dfid=${context.dfid}`,
        `KUGOU_API_MID=${context.mid}`,
        context.token ? `token=${context.token}` : '',
        context.userid ? `userid=${context.userid}` : ''
      ]
        .filter(Boolean)
        .join('; '),
      ...extraHeaders
    },
    timeout: 15000,
    validateStatus: () => true
  });
}

function collectKugouPlaylistItems(value, result = [], depth = 0) {
  if (depth > 6 || value === null || value === undefined) return result;
  if (Array.isArray(value)) {
    for (const item of value) collectKugouPlaylistItems(item, result, depth + 1);
    return result;
  }
  if (typeof value !== 'object') return result;

  const id = firstOwnValue(value, [
    'global_collection_id',
    'globalCollectionId',
    'listid',
    'list_id',
    'specialid',
    'special_id'
  ]);
  const name = firstOwnValue(value, ['listname', 'list_name', 'specialname', 'title', 'name']);
  if (id && name) {
    result.push(value);
    return result;
  }

  for (const child of Object.values(value)) {
    collectKugouPlaylistItems(child, result, depth + 1);
  }
  return result;
}

function normalizeKugouPlaylists(payload, userid = '') {
  const seen = new Set();
  const playlists = [];
  const favorites = [];
  const rawItems = collectKugouPlaylistItems(payload);

  for (const item of rawItems) {
    const id = firstOwnValue(item, [
      'global_collection_id',
      'globalCollectionId',
      'listid',
      'list_id',
      'specialid',
      'special_id',
      'id'
    ]);
    const name = firstOwnValue(item, ['listname', 'list_name', 'specialname', 'title', 'name']);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);

    const ownerId = firstOwnValue(item, [
      'userid',
      'user_id',
      'create_userid',
      'list_create_userid',
      'creator_userid'
    ]);
    const collectType = firstOwnValue(item, ['collect_type', 'collectType']);
    const isFavorite =
      Boolean(firstOwnValue(item, ['is_collect', 'is_collected', 'isFavorite'])) ||
      collectType === '1' ||
      (ownerId && userid && ownerId !== String(userid));
    const coverImgUrl = normalizeImageUrl(
      firstOwnValue(item, ['pic', 'picurl', 'pic_url', 'imgurl', 'cover', 'cover_url', 'image'])
    );
    const normalized = {
      id,
      name,
      description: firstOwnValue(item, ['intro', 'description', 'desc']),
      coverImgUrl,
      picUrl: coverImgUrl,
      trackCount: Number(firstOwnValue(item, ['count', 'filecount', 'song_count', 'total'])) || 0,
      playCount: Number(firstOwnValue(item, ['playcount', 'play_count'])) || 0,
      creator: {
        userId: ownerId || String(userid || ''),
        nickname:
          firstOwnValue(item, ['username', 'user_name', 'nickname', 'nick_name']) || '酷狗用户'
      },
      platform: 'kugou',
      platformId: id,
      globalCollectionId: firstOwnValue(item, ['global_collection_id', 'globalCollectionId']) || id,
      listId: firstOwnValue(item, ['listid', 'list_id']) || id
    };

    if (isFavorite) favorites.push(normalized);
    else playlists.push(normalized);
  }

  return { playlists, favorites };
}

function rawOwnValue(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const entries = Object.entries(value);
  for (const key of keys) {
    const match = entries.find(([candidate]) => candidate.toLowerCase() === key.toLowerCase());
    if (match) return match[1];
  }
  return undefined;
}

function collectKugouSongItems(value, result = [], depth = 0) {
  if (depth > 7 || value === null || value === undefined) return result;
  if (Array.isArray(value)) {
    for (const item of value) collectKugouSongItems(item, result, depth + 1);
    return result;
  }
  if (typeof value !== 'object') return result;

  const songId = firstOwnValue(value, [
    'hash',
    'file_hash',
    'filehash',
    'mixsongid',
    'mix_song_id',
    'audio_id',
    'audioid'
  ]);
  const songName = firstOwnValue(value, ['songname', 'song_name', 'filename', 'file_name', 'name']);
  if (songId && songName) {
    result.push(value);
    return result;
  }

  for (const child of Object.values(value)) {
    collectKugouSongItems(child, result, depth + 1);
  }
  return result;
}

function parseKugouSongLabel(value, splitArtistTitle = true) {
  const label = String(value || '')
    .trim()
    .replace(/\.(?:mp3|flac|wav|m4a|aac|ogg|ape)$/i, '')
    .trim();
  if (!splitArtistTitle) return { name: label, artistNames: [] };

  const parts = label.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (!parts) return { name: label, artistNames: [] };

  const artistNames = parts[1]
    .split(/[,，、/&|]/)
    .map((artist) => artist.trim())
    .filter(Boolean);
  return {
    name: parts[2].trim(),
    artistNames
  };
}

function normalizeKugouSongs(payload, listInfo = {}) {
  const seen = new Set();
  const songs = [];
  const rawItems = collectKugouSongItems(payload);

  for (const item of rawItems) {
    const platformId = firstOwnValue(item, [
      'hash',
      'file_hash',
      'filehash',
      'mixsongid',
      'mix_song_id',
      'audio_id',
      'audioid'
    ]);
    const explicitSongName = firstOwnValue(item, ['songname', 'song_name']);
    const filename = firstOwnValue(item, ['filename', 'file_name', 'name']);
    const rawName = explicitSongName || filename;
    if (!platformId || !rawName || seen.has(platformId)) continue;
    seen.add(platformId);

    const rawArtist = rawOwnValue(item, [
      'singername',
      'singer_name',
      'singer',
      'artist',
      'artists',
      'authors'
    ]);
    const artistNames = Array.isArray(rawArtist)
      ? rawArtist
          .map((artist) =>
            typeof artist === 'string'
              ? artist
              : firstOwnValue(artist, ['name', 'singername', 'singer_name', 'artist'])
          )
          .filter(Boolean)
      : String(rawArtist || '')
          .split(/[,，、/&|]/)
          .map((artist) => artist.trim())
          .filter(Boolean);
    const fallbackArtist = firstDeepValue(item, [
      'singername',
      'singer_name',
      'singer',
      'artist',
      'author'
    ]);
    if (!artistNames.length && fallbackArtist) artistNames.push(fallbackArtist);

    const parsedLabel = parseKugouSongLabel(rawName, !explicitSongName || artistNames.length === 0);
    const name = parsedLabel.name;
    if (!artistNames.length && parsedLabel.artistNames.length) {
      artistNames.push(...parsedLabel.artistNames);
    }

    const albumName = firstOwnValue(item, ['album_name', 'albumname', 'album', 'album_title']);
    const coverImgUrl = normalizeImageUrl(
      firstOwnValue(item, [
        'album_img',
        'album_img_500',
        'album_image',
        'img',
        'pic',
        'picurl',
        'pic_url',
        'cover',
        'cover_url'
      ]) || firstDeepValue(item, ['album_img', 'album_img_500', 'album_image'])
    );
    const rawDuration = Number(
      firstOwnValue(item, ['timelen', 'time_len', 'duration', 'interval', 'dt'])
    );
    const duration = rawDuration > 0 && rawDuration < 1000 ? rawDuration * 1000 : rawDuration;
    const albumId = firstOwnValue(item, ['album_audio_id', 'album_id', 'albumid']) || '0';
    const artists = (artistNames.length ? artistNames : ['未知歌手']).map((artist, index) => ({
      id: index,
      name: artist
    }));
    const album = {
      id: albumId,
      name: albumName || '未知专辑',
      picUrl: coverImgUrl
    };

    songs.push({
      id: `kugou:${platformId}`,
      name,
      picUrl: coverImgUrl,
      ar: artists,
      artists,
      al: album,
      album,
      count: 0,
      dt: duration || 0,
      duration: duration || 0,
      platform: 'kugou',
      platformId: String(platformId),
      source: 'kugou',
      playlistId: listInfo.id || listInfo.listId || ''
    });
  }

  return songs;
}

function rawKugouRsaEncrypt(value) {
  const key = crypto.createPublicKey(KUGOU_LITE_PUBLIC_KEY);
  const keySize = Math.ceil(key.asymmetricKeyDetails.modulusLength / 8);
  const input = Buffer.alloc(keySize);
  const source = Buffer.from(value, 'utf8');
  if (source.length > keySize) throw new Error('酷狗用户信息请求参数过长');
  source.copy(input);
  return crypto
    .publicEncrypt({ key, padding: crypto.constants.RSA_NO_PADDING }, input)
    .toString('hex');
}

async function requestKugouUserInfo(cookie) {
  const context = getKugouContext(cookie);
  if (!context.userid || !context.token) return null;
  const visitTime = Math.floor(Date.now() / 1000);
  const p = rawKugouRsaEncrypt(JSON.stringify({ clienttime: visitTime, token: context.token }));
  const response = await requestKugouApi(
    cookie,
    '/v3/get_my_info',
    {
      visit_time: visitTime,
      userid: context.userid,
      usertype: 1,
      p
    },
    { plat: 1 },
    { 'x-router': 'usercenter.kugou.com' },
    visitTime
  );
  if (response.status < 200 || response.status >= 300) return null;
  return response.data;
}

function normalizeKugouUserInfo(payload, cookie, fallback = {}) {
  const context = getKugouContext(cookie);
  const userId =
    firstDeepValue(payload, ['userid', 'user_id', 'uid', 'id']) ||
    context.userid ||
    fallback.userId ||
    '';
  const nickname =
    firstDeepValue(payload, [
      'nickname',
      'nick_name',
      'nickName',
      'username',
      'user_name',
      'name'
    ]) ||
    fallback.nickname ||
    '酷狗用户';
  const avatarUrl = normalizeImageUrl(
    firstDeepValue(payload, [
      'head_icon',
      'headicon',
      'headIcon',
      'headurl',
      'head_url',
      'avatar',
      'avatar_url',
      'user_img',
      'userimg',
      'pic'
    ]) || fallback.avatarUrl
  );
  const vipType = firstDeepValue(payload, ['vip_type', 'vipType', 'is_vip', 'isVip']);
  return {
    userId: String(userId),
    nickname,
    avatarUrl,
    vip: Boolean(Number(vipType) || vipType === 'true' || vipType === true)
  };
}

function buildKugouDefaultParams() {
  return {
    dfid: kugouDfid,
    mid: kugouMid,
    uuid: '-',
    appid: KUGOU_APPID,
    clientver: KUGOU_CLIENTVER,
    clienttime: Math.floor(Date.now() / 1000),
    userid: 0,
    token: ''
  };
}

// GET /platform/kugou/qr/create
router.get('/kugou/qr/create', async (req, res) => {
  try {
    const defaultParams = buildKugouDefaultParams();
    const params = {
      ...defaultParams,
      appid: 1001,
      type: 1,
      plat: 4,
      qrcode_txt: `https://h5.kugou.com/apps/loginQRCode/html/index.html?appid=${KUGOU_APPID}&`,
      srcappid: KUGOU_SRC_APPID
    };

    params.signature = kugouWebSign(params);

    const url = 'https://login-user.kugou.com/v2/qrcode';
    const response = await axios.get(url, {
      params,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Referer: 'https://www.kugou.com/'
      }
    });

    const json = response.data;

    if (json.status !== 1 || !json.data) {
      return res.json({
        code: 500,
        msg: `酷狗二维码创建失败: ${json.error_msg || JSON.stringify(json)}`
      });
    }

    const qrUrl = `https://h5.kugou.com/apps/loginQRCode/html/index.html?qrcode=${json.data.qrcode}`;

    res.json({
      code: 200,
      data: {
        qrUrl,
        key: json.data.qrcode,
        expiredAt: Date.now() + 5 * 60 * 1000
      }
    });
  } catch (error) {
    console.error('[platformLogin] Kugou QR create error:', error.message);
    res.json({ code: 500, msg: `酷狗二维码创建失败: ${error.message}` });
  }
});

// GET /platform/kugou/qr/poll?key=xxx
router.get('/kugou/qr/poll', async (req, res) => {
  try {
    const key = req.query.key;
    if (!key) {
      return res.json({ code: 400, msg: '缺少 key 参数' });
    }

    const defaultParams = buildKugouDefaultParams();
    const params = {
      ...defaultParams,
      plat: 4,
      srcappid: KUGOU_SRC_APPID,
      qrcode: key
    };

    params.signature = kugouWebSign(params);

    const url = 'https://login-user.kugou.com/v2/get_userinfo_qrcode';
    const response = await axios.get(url, {
      params,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Referer: 'https://www.kugou.com/'
      }
    });

    const json = response.data;

    if (json.status !== 1) {
      return res.json({
        code: 500,
        msg: json.error_msg || `酷狗登录状态查询失败 (error_code: ${json.error_code})`
      });
    }

    const data = json.data;
    const status = data?.status;

    if (status === 1) {
      return res.json({ code: 200, data: { status: 'waiting', message: '等待扫码' } });
    }
    if (status === 2) {
      return res.json({
        code: 200,
        data: { status: 'scanned', message: '已扫码，请在手机上确认登录' }
      });
    }
    if (status === 0) {
      return res.json({ code: 200, data: { status: 'expired', message: '二维码已过期' } });
    }

    if (status === 4) {
      const userid = String(data.userid || '');
      const token = data.token || '';
      const cookieStr = mergeCookieParts(
        `userid=${userid}; token=${token};`,
        `dfid=${data.dfid || kugouDfid}; KUGOU_API_MID=${data.mid || kugouMid}; KUGOU_API_PLATFORM=lite;`
      );
      const userInfo = normalizeKugouUserInfo(data, cookieStr, {
        userId: userid,
        nickname: '酷狗用户'
      });

      return res.json({
        code: 200,
        data: {
          status: 'success',
          message: '酷狗音乐登录成功',
          cookie: cookieStr,
          userInfo
        }
      });
    }

    return res.json({ code: 500, data: { status: 'error', message: `未知状态: ${status}` } });
  } catch (error) {
    console.error('[platformLogin] Kugou QR poll error:', error.message);
    res.json({ code: 500, msg: `酷狗轮询失败: ${error.message}` });
  }
});

function getPlatformCookieFromRequest(req) {
  const value = req.headers['x-platform-cookie'];
  return Array.isArray(value) ? value[0] || '' : String(value || '').trim();
}

// ==================== QQ 音乐签名版业务接口（参照 QQMusicApi-nodejs） ====================

// 2026 年仍生效的 zzc 签名参数（来自仍在维护的 QQMusicapi 实现）
const QQ_SIGN_PART1_INDEXES = [23, 14, 6, 36, 16, 7, 19];
const QQ_SIGN_PART2_INDEXES = [16, 1, 32, 12, 19, 27, 8, 5];
const QQ_SIGN_SCRAMBLE = [
  89, 39, 179, 150, 218, 82, 58, 252, 177, 52, 186, 123, 120, 64, 242, 133, 143, 161, 121, 179
];

function zzcSign(data) {
  const hash = crypto.createHash('sha1').update(JSON.stringify(data)).digest('hex').toUpperCase();

  let part1 = '';
  for (const i of QQ_SIGN_PART1_INDEXES) {
    if (i < hash.length) part1 += hash[i];
  }
  let part2 = '';
  for (const i of QQ_SIGN_PART2_INDEXES) {
    if (i < hash.length) part2 += hash[i];
  }

  const part3Buffer = Buffer.alloc(20);
  for (let i = 0; i < QQ_SIGN_SCRAMBLE.length && i * 2 + 1 < hash.length; i++) {
    const hexValue = parseInt(hash.substring(i * 2, i * 2 + 2), 16);
    part3Buffer[i] = QQ_SIGN_SCRAMBLE[i] ^ hexValue;
  }
  const b64Part = part3Buffer.toString('base64').replace(/[/\\+=]/g, '');
  return `zzc${part1}${b64Part}${part2}`.toLowerCase();
}

/**
 * 签名版 QQ 音乐 API（musics.fcg + zzc sign），与 guowenye/QQMusicApi-nodejs 一致
 */
async function qqSignedApi(cookie, module, method, param = {}) {
  const comm = {
    ct: '11',
    cv: '13.2.5.8',
    v: '13.2.5.8',
    tmeAppID: 'qqmusic',
    format: 'json',
    inCharset: 'utf-8',
    outCharset: 'utf-8'
  };
  const requestKey = `${module}.${method}`;
  const payload = { comm, [requestKey]: { module, method, param } };

  const resp = await axios.post('https://u.y.qq.com/cgi-bin/musics.fcg', payload, {
    params: { sign: zzcSign(payload) },
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': QQ_USER_AGENT,
      Referer: 'https://y.qq.com/',
      Origin: 'https://y.qq.com',
      Cookie: cookie
    },
    timeout: 15000,
    validateStatus: () => true
  });

  const item = resp.data?.[requestKey] || resp.data?.req || resp.data;
  if (item && Number(item.code) !== 0) {
    throw new Error(`QQ 签名接口 ${requestKey} 返回错误码 ${item.code}`);
  }
  return item?.data || resp.data?.data || {};
}

/**
 * QQ 音乐 musicu.fcg 业务接口调用
 */
async function qqMusicApi(cookie, module, method, param = {}) {
  const resp = await axios.post(
    'https://u.y.qq.com/cgi-bin/musicu.fcg',
    JSON.stringify({
      comm: { g_tk: 5381, platform: 'yqq', ct: 24, cv: 0 },
      req: { module, method, param }
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': QQ_USER_AGENT,
        Referer: 'https://y.qq.com/',
        Cookie: cookie
      },
      timeout: 15000,
      validateStatus: () => true
    }
  );
  const req = resp.data?.req || resp.data || {};
  if (Number(req.code) !== 0) {
    throw new Error(`QQ API ${module}.${method} 返回错误码 ${req.code}`);
  }
  return req.data || {};
}

function normalizeQqPlaylist(item, uin, nickname) {
  return {
    // CgiGetDiss 需要用 tid（dirId 是系统分类，拉曲目会失败）
    id: item.tid ?? item.dirId ?? item.dirid ?? item.id ?? item.disstid ?? 0,
    name: item.dirName ?? item.dir_name ?? item.name ?? item.title ?? '',
    coverImgUrl: item.picUrl ?? item.pic_url ?? item.coverImgUrl ?? item.coverUrl ?? '',
    trackCount: item.songNum ?? item.song_num ?? item.songnum ?? item.trackCount ?? 0,
    playCount: item.listenNum ?? item.listen_num ?? item.playCount ?? item.play_count ?? 0,
    creator: { userId: Number(uin) || 0, nickname: nickname || 'QQ音乐用户' }
  };
}

function normalizeQqAlbum(item) {
  return {
    id: item.albumId ?? item.album_id ?? item.mid ?? item.id ?? 0,
    name: item.albumName ?? item.album_name ?? item.name ?? item.title ?? '',
    picUrl: item.picUrl ?? item.pic_url ?? item.coverUrl ?? '',
    size: item.songNum ?? item.song_num ?? item.songnum ?? item.total ?? 0,
    artist: { name: item.singerName ?? item.singer_name ?? item.singername ?? item.artist ?? '' }
  };
}

function normalizeQqSong(item) {
  const platformId = firstOwnValue(item, ['songmid', 'mid', 'song_id', 'songid']);
  if (!platformId) return null;
  const name = firstOwnValue(item, ['songname', 'name', 'title']);
  if (!name) return null;
  const rawSinger = rawOwnValue(item, ['singer', 'singers', 'artist']);
  const artistNames = Array.isArray(rawSinger)
    ? rawSinger
        .map((artist) =>
          typeof artist === 'string'
            ? artist
            : firstOwnValue(artist, ['name', 'singer_name', 'singername'])
        )
        .filter(Boolean)
    : String(rawSinger || '')
        .split(/[,，、/&|]/)
        .map((artist) => artist.trim())
        .filter(Boolean);
  const albumRaw = typeof item.album === 'object' && item.album !== null ? item.album : null;
  const albumMid =
    firstOwnValue(item, ['albummid', 'album_mid']) ||
    (albumRaw ? firstOwnValue(albumRaw, ['mid', 'albummid', 'album_mid']) : '') ||
    '';
  const albumName =
    firstOwnValue(item, ['albumname', 'album_name']) ||
    (albumRaw ? firstOwnValue(albumRaw, ['name', 'title']) : '') ||
    '';
  const album = {
    id: albumMid || '0',
    name: albumName || '未知专辑',
    picUrl: albumMid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albumMid}.jpg` : ''
  };
  const rawDuration = Number(firstOwnValue(item, ['interval', 'duration', 'dt']));
  const duration = rawDuration > 0 && rawDuration < 1000 ? rawDuration * 1000 : rawDuration;
  const artists = (artistNames.length ? artistNames : ['未知歌手']).map((artist, index) => ({
    id: index,
    name: artist
  }));
  return {
    id: `qq:${platformId}`,
    name,
    picUrl: album.picUrl,
    ar: artists,
    artists,
    al: album,
    album,
    count: 0,
    dt: duration || 0,
    duration: duration || 0,
    platform: 'qq',
    platformId: String(platformId),
    source: 'qq'
  };
}

function pickQqList(data, keys) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  for (const key of keys) {
    const value = data[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

/**
 * 拉取 QQ 音乐的创建歌单、收藏歌单、收藏专辑
 */
async function fetchQqAccountCollections(cookie) {
  const values = cookieMap(cookie);
  const uin = normalizeQQUserId(values.uin || values.p_uin || values.ptui_loginuin || '');
  if (!uin) return null;

  const nickname = values.nickname || values.nick || '';
  // 收藏专辑接口通常需要 encrypt_uin，先通过公开主页获取
  let euin = '';
  try {
    const profileResp = await axios.get(
      'https://c6.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg',
      {
        params: { ct: 20, cv: 4747474, cid: 205360838, userid: uin },
        headers: { 'User-Agent': QQ_USER_AGENT, Referer: 'https://y.qq.com/' },
        timeout: 12000,
        validateStatus: () => true
      }
    );
    euin = profileResp.data?.data?.creator?.encrypt_uin || '';
  } catch {
    // 拿不到 euin 时退化为 uin 参数
  }
  const albumParam = euin
    ? { euin, offset: 0, size: 100 }
    : { uin: String(uin), offset: 0, size: 100 };

  const [createdData, favPlaylistData, favAlbumData] = await Promise.allSettled([
    qqSignedApi(cookie, 'music.musicasset.PlaylistBaseRead', 'GetPlaylistByUin', {
      uin: String(uin)
    }),
    qqSignedApi(cookie, 'music.musicasset.PlaylistFavRead', 'CgiGetPlaylistFavInfo', {
      uin: String(uin),
      offset: 0,
      size: 100
    }),
    qqSignedApi(cookie, 'music.musicasset.AlbumFavRead', 'CgiGetAlbumFavInfo', albumParam)
  ]);

  for (const [label, result] of [
    ['created', createdData],
    ['favPlaylists', favPlaylistData],
    ['favAlbums', favAlbumData]
  ]) {
    if (result.status === 'rejected') {
      console.error(`[platformLogin] QQ 拉取${label}失败:`, result.reason?.message);
    }
  }

  const playlists = (
    createdData.status === 'fulfilled'
      ? pickQqList(createdData.value, ['v_playlist', 'v_list', 'playlist', 'list', 'data'])
      : []
  )
    .map((item) => normalizeQqPlaylist(item, uin, nickname))
    .filter((item) => item.id);
  const favorites = (
    favPlaylistData.status === 'fulfilled'
      ? pickQqList(favPlaylistData.value, ['v_list', 'v_playlist', 'playlist', 'list', 'data'])
      : []
  )
    .map((item) => normalizeQqPlaylist(item, uin, nickname))
    .filter((item) => item.id);
  const albums = (
    favAlbumData.status === 'fulfilled'
      ? pickQqList(favAlbumData.value, ['v_list', 'v_album', 'album', 'albumlist', 'list', 'data'])
      : []
  )
    .map(normalizeQqAlbum)
    .filter((item) => item.id);

  console.log(
    `[platformLogin] QQ 账号数据: 创建歌单=${playlists.length} 收藏歌单=${favorites.length} 收藏专辑=${albums.length}`
  );

  return { playlists, favorites, albums };
}

// GET /platform/qq/account/data
router.get('/qq/account/data', async (req, res) => {
  const cookie = getPlatformCookieFromRequest(req);
  const values = cookieMap(cookie);
  const userId = normalizeQQUserId(values.uin || values.p_uin || values.ptui_loginuin || '');
  const key = values.qm_keyst || values.qqmusic_key || values.p_skey || '';
  if (!userId || !key) {
    return res.status(401).json({ code: 401, msg: 'QQ 音乐登录已失效，请重新扫码' });
  }

  const avatarUin = userId.replace(/^o/i, '');
  let nickname = values.nickname || values.nick || 'QQ音乐用户';
  let avatarUrl = /^\d+$/.test(avatarUin) ? `https://q1.qlogo.cn/g?b=qq&nk=${avatarUin}&s=100` : '';
  let vip = false;
  let playlists = [];
  let favorites = [];
  let albums = [];
  try {
    const userInfo = await fetchQqUserInfo(cookie);
    if (userInfo) {
      nickname = userInfo.nickname || nickname;
      avatarUrl = userInfo.avatarUrl || avatarUrl;
      vip = Boolean(userInfo.vip);
    }
    const collections = await fetchQqAccountCollections(cookie);
    if (collections) {
      playlists = collections.playlists;
      favorites = collections.favorites;
      albums = collections.albums;
    }
  } catch (error) {
    console.warn('[platformLogin] QQ 账号数据用户信息补充失败:', error.message);
  }

  return res.json({
    code: 200,
    data: {
      userInfo: {
        userId,
        nickname,
        avatarUrl,
        vip
      },
      playlists,
      favorites,
      albums,
      history: []
    }
  });
});

// GET /platform/qq/playlist/tracks?id=xxx
router.get('/qq/playlist/tracks', async (req, res) => {
  const cookie = getPlatformCookieFromRequest(req);
  const listId = String(req.query.id || req.query.listId || '').trim();
  if (!listId) {
    return res.status(400).json({ code: 400, msg: '缺少 QQ 歌单 ID' });
  }
  try {
    const data = await qqSignedApi(cookie, 'music.srfDissInfo.DissInfo', 'CgiGetDiss', {
      disstid: /^\d+$/.test(listId) ? Number(listId) : listId,
      song_num: 200,
      song_begin: 0,
      userinfo: 1,
      orderlist: 1
    });
    const songs = (data.songlist || []).map(normalizeQqSong).filter(Boolean);
    return res.json({
      code: 200,
      data: {
        playlist: { id: listId, platform: 'qq', trackCount: songs.length },
        songs,
        page: 1,
        pageSize: songs.length
      }
    });
  } catch (error) {
    console.error('[platformLogin] QQ playlist tracks error:', error.message);
    return res.status(502).json({ code: 502, msg: 'QQ 歌单加载失败，请稍后重试' });
  }
});

// GET /platform/qq/search?keyword=xxx&limit=20
router.get('/qq/search', async (req, res) => {
  const keyword = String(req.query.keyword || req.query.q || '').trim();
  const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 20));
  if (!keyword) return res.json({ code: 200, data: { songs: [] } });
  const cookie = getPlatformCookieFromRequest(req);
  try {
    const data = await qqSignedApi(
      cookie,
      'music.search.SearchCgiService',
      'DoSearchForQQMusicDesktop',
      {
        num_per_page: limit,
        page_num: 1,
        query: keyword,
        search_type: 0
      }
    );
    const songs = (data?.body?.song?.list || []).map(normalizeQqSong).filter(Boolean);
    return res.json({ code: 200, data: { songs } });
  } catch (error) {
    console.error('[platformLogin] QQ search error:', error.message);
    return res.status(502).json({ code: 502, msg: 'QQ 搜索服务暂时不可用，请稍后重试' });
  }
});

// GET /platform/kugou/search?keyword=xxx&limit=20
// GET /platform/qq/lyric?mid=xxx
router.get('/qq/lyric', async (req, res) => {
  if (!enforceQqLyricRateLimit(req, res)) return;
  const mid = String(req.query.mid || '').trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(mid)) {
    return res.status(400).json({ code: 400, msg: 'QQ songMID 无效' });
  }

  const cached = getCachedQqLyric(mid);
  if (cached !== undefined) {
    return cached
      ? res.json({ code: 200, data: cached })
      : res.status(404).json({ code: 404, msg: '未找到 QQ 歌词' });
  }

  try {
    const data = await qqSignedApi(
      getPlatformCookieFromRequest(req),
      'music.musichallSong.PlayLyricInfo',
      'GetPlayLyricInfo',
      {
        crypt: 1,
        qrc: 1,
        trans: 1,
        roma: 1,
        type: -1,
        songID: 0,
        songMID: mid
      }
    );
    const encrypted = Number(data.crypt) === 1;
    const rawLyric = firstOwnValue(data, ['lyric', 'lyricContent']);
    if (!rawLyric) {
      setCachedQqLyric(mid, null);
      return res.status(404).json({ code: 404, msg: '未找到 QQ 歌词' });
    }

    const lyric = decodeQqLyricField(rawLyric, encrypted);
    if (!lyric || !/(?:^|\n)\s*(?:<|\[)/.test(lyric)) {
      throw new Error('QQ 主歌词解密结果无效');
    }
    const decodeOptional = (keys) => {
      const raw = firstOwnValue(data, keys);
      if (!raw) return '';
      try {
        return decodeQqLyricField(raw, encrypted);
      } catch {
        return '';
      }
    };
    const payload = {
      platform: 'qq',
      format: Number(data.qrc) === 1 || /^\s*<QrcInfos/i.test(lyric) ? 'qrc' : 'lrc',
      lyric,
      translation: decodeOptional(['trans', 'translation', 'transLyric']),
      romanization: decodeOptional(['roma', 'romanization', 'romaLyric'])
    };
    setCachedQqLyric(mid, payload);
    return res.json({ code: 200, data: payload });
  } catch (error) {
    console.error('[platformLogin] QQ lyric error:', error.message);
    return res.status(502).json({ code: 502, msg: 'QQ 歌词服务暂时不可用，请稍后重试' });
  }
});

router.get('/kugou/search', async (req, res) => {
  const keyword = String(req.query.keyword || req.query.q || '').trim();
  const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 20));
  if (!keyword) return res.json({ code: 200, data: { songs: [] } });
  try {
    const response = await axios.get(
      `http://mobilecdn.kugou.com/api/v3/search/song?keyword=${encodeURIComponent(
        keyword
      )}&page=1&pagesize=${limit}`,
      {
        timeout: 12000,
        validateStatus: () => true
      }
    );
    const list = response.data?.data?.info || [];
    const songs = list
      .map((song) => {
        const hash = firstOwnValue(song, ['hash', 'file_hash', 'filehash']);
        const songName = firstOwnValue(song, ['songname', 'song_name', 'filename']);
        if (!hash || !songName) return null;
        const artistNames = String(
          firstOwnValue(song, ['singername', 'singer_name', 'singer']) || ''
        )
          .split(/[、,/&|]/)
          .map((artist) => artist.trim())
          .filter(Boolean);
        const albumName = firstOwnValue(song, ['album_name', 'albumname', 'album']) || '';
        const albumId = firstOwnValue(song, ['album_id', 'albumid']) || '';
        const rawDuration = Number(firstOwnValue(song, ['duration', 'timelen']));
        const duration = rawDuration > 0 && rawDuration < 1000 ? rawDuration * 1000 : rawDuration;
        const artists = (artistNames.length ? artistNames : ['未知歌手']).map((artist, index) => ({
          id: index,
          name: artist
        }));
        const album = {
          id: albumId || '0',
          name: albumName || '未知专辑',
          picUrl: albumId ? `https://imgessl.kugou.com/stdmusic/150/${albumId}.jpg` : ''
        };
        return {
          id: `kugou:${hash}`,
          name: songName,
          picUrl: album.picUrl,
          ar: artists,
          artists,
          al: album,
          album,
          count: 0,
          dt: duration || 0,
          duration: duration || 0,
          platform: 'kugou',
          platformId: String(hash),
          source: 'kugou'
        };
      })
      .filter(Boolean);
    return res.json({ code: 200, data: { songs } });
  } catch (error) {
    console.error('[platformLogin] Kugou search error:', error.message);
    return res.status(502).json({ code: 502, msg: '酷狗搜索服务暂时不可用，请稍后重试' });
  }
});

// GET /platform/kugou/account/data
router.get('/kugou/account/data', async (req, res) => {
  const cookie = getPlatformCookieFromRequest(req);
  const context = getKugouContext(cookie);
  if (!context.userid || !context.token) {
    return res.status(401).json({ code: 401, msg: '酷狗登录已失效，请重新扫码' });
  }

  try {
    const [playlistResult, profileResult] = await Promise.allSettled([
      requestKugouApi(
        cookie,
        '/v7/get_all_list',
        {
          token: context.token,
          userid: context.userid,
          total_ver: 979,
          type: 2,
          page: 1,
          pagesize: 100
        },
        { plat: 1 },
        { 'x-router': 'cloudlist.service.kugou.com' }
      ),
      requestKugouUserInfo(cookie)
    ]);

    if (playlistResult.status === 'rejected') {
      throw playlistResult.reason;
    }
    const playlistResponse = playlistResult.value;
    const playlistPayload = playlistResponse.data;
    const apiStatus = Number(playlistPayload?.status);
    if (playlistResponse.status < 200 || playlistResponse.status >= 300 || apiStatus !== 1) {
      const errorCode = playlistPayload?.error_code || playlistPayload?.errorCode || 'unknown';
      return res.status(401).json({
        code: 401,
        msg: `酷狗账号数据获取失败 (${errorCode})，请重新登录`
      });
    }

    const normalizedLists = normalizeKugouPlaylists(playlistPayload, context.userid);
    const profilePayload = profileResult.status === 'fulfilled' ? profileResult.value : null;
    const userInfo = normalizeKugouUserInfo(profilePayload, cookie, {
      userId: context.userid,
      nickname: '酷狗用户'
    });

    return res.json({
      code: 200,
      data: {
        userInfo,
        playlists: normalizedLists.playlists,
        favorites: normalizedLists.favorites,
        albums: [],
        history: []
      }
    });
  } catch (error) {
    console.error('[platformLogin] Kugou account data error:', error.message);
    return res.status(502).json({ code: 502, msg: '酷狗账号数据服务暂时不可用，请稍后重试' });
  }
});

// GET /platform/kugou/playlist/tracks?id=xxx
router.get('/kugou/playlist/tracks', async (req, res) => {
  const cookie = getPlatformCookieFromRequest(req);
  const context = getKugouContext(cookie);
  const listId = String(req.query.id || req.query.listId || '').trim();
  if (!context.userid || !context.token) {
    return res.status(401).json({ code: 401, msg: '酷狗登录已失效，请重新扫码' });
  }
  if (!listId) {
    return res.status(400).json({ code: 400, msg: '缺少酷狗歌单 ID' });
  }

  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 100));
  try {
    const response = await requestKugouApi(
      cookie,
      '/v4/get_list_all_file',
      {
        listid: listId,
        userid: context.userid,
        area_code: 1,
        show_relate_goods: 0,
        pagesize: pageSize,
        allplatform: 1,
        show_cover: 1,
        type: 0,
        token: context.token,
        page
      },
      {},
      { 'x-router': 'cloudlist.service.kugou.com' }
    );
    const payload = response.data;
    const apiStatus = Number(payload?.status);
    if (response.status < 200 || response.status >= 300 || (apiStatus !== 1 && apiStatus !== 200)) {
      const errorCode = payload?.error_code || payload?.errorCode || 'unknown';
      return res.status(502).json({ code: 502, msg: `酷狗歌单加载失败 (${errorCode})` });
    }

    const songs = normalizeKugouSongs(payload, { id: listId, listId });
    return res.json({
      code: 200,
      data: {
        playlist: { id: listId, platform: 'kugou', trackCount: songs.length },
        songs,
        page,
        pageSize
      }
    });
  } catch (error) {
    console.error('[platformLogin] Kugou playlist tracks error:', error.message);
    return res.status(502).json({ code: 502, msg: '酷狗歌单服务暂时不可用，请稍后重试' });
  }
});

// ==================== 动态二维码展示页 ====================

// GET /platform/qr-display?platform=qq|kugou
// 供用户在其他设备（电脑/另一台手机）打开，显示二维码供手机扫码
router.get('/qr-display', (req, res) => {
  const platform = req.query.platform === 'kugou' ? 'kugou' : 'qq';
  const platformName = platform === 'qq' ? 'QQ 音乐' : '酷狗音乐';
  const appName = platform === 'qq' ? 'QQ' : '酷狗';

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${platformName} 扫码登录</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #333;
    }
    .container {
      background: #fff;
      border-radius: 24px;
      padding: 40px 32px;
      text-align: center;
      max-width: 380px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    h1 {
      font-size: 22px;
      margin-bottom: 8px;
      color: #1a1a2e;
    }
    .subtitle {
      font-size: 14px;
      color: #666;
      margin-bottom: 24px;
    }
    .qr-box {
      width: 240px;
      height: 240px;
      margin: 0 auto 20px;
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      position: relative;
    }
    .qr-box img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .qr-box.loading::after {
      content: '加载中...';
      position: absolute;
      color: #999;
      font-size: 14px;
    }
    .status {
      font-size: 15px;
      color: #1a1a2e;
      margin-bottom: 12px;
      font-weight: 500;
    }
    .status.scanned { color: #07c160; }
    .status.success { color: #07c160; }
    .status.expired { color: #ff6b35; }
    .status.error { color: #e74c3c; }
    .refresh-btn {
      background: #1a1a2e;
      color: #fff;
      border: none;
      padding: 10px 28px;
      border-radius: 24px;
      font-size: 14px;
      cursor: pointer;
      margin-top: 8px;
      transition: opacity 0.2s;
    }
    .refresh-btn:hover { opacity: 0.85; }
    .hint {
      font-size: 12px;
      color: #999;
      margin-top: 16px;
      line-height: 1.6;
    }
    .success-icon {
      font-size: 48px;
      color: #07c160;
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${platformName} 扫码登录</h1>
    <p class="subtitle">请使用 ${appName} APP 扫描下方二维码</p>
    <div class="qr-box loading" id="qrBox"></div>
    <div class="status" id="status">正在获取二维码...</div>
    <button class="refresh-btn" id="refreshBtn" style="display:none" onclick="loadQr()">刷新二维码</button>
    <p class="hint">提示：请使用 ${appName} APP 的「扫一扫」功能<br>扫描上方二维码完成登录</p>
  </div>

  <script>
    let pollTimer = null;
    let currentKey = '';

    async function loadQr() {
      const qrBox = document.getElementById('qrBox');
      const statusEl = document.getElementById('status');
      const refreshBtn = document.getElementById('refreshBtn');

      qrBox.className = 'qr-box loading';
      qrBox.innerHTML = '';
      statusEl.className = 'status';
      statusEl.textContent = '正在获取二维码...';
      refreshBtn.style.display = 'none';

      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }

      try {
        const resp = await fetch('/platform/${platform}/qr/create?noCache=' + Date.now());
        const json = await resp.json();

        if (json.code !== 200 || !json.data) {
          statusEl.className = 'status error';
          statusEl.textContent = json.msg || '获取二维码失败';
          refreshBtn.style.display = 'inline-block';
          return;
        }

        currentKey = json.data.key;

        // 如果是图片 base64 直接显示，否则用 qrcode.js 生成
        if (json.data.qrUrl.startsWith('data:image/')) {
          qrBox.className = 'qr-box';
          qrBox.innerHTML = '<img src="' + json.data.qrUrl + '" />';
        } else {
          // 动态加载 qrcode 库
          if (!window.QRCode) {
            await new Promise((resolve, reject) => {
              const s = document.createElement('script');
              s.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js';
              s.onload = resolve;
              s.onerror = reject;
              document.head.appendChild(s);
            });
          }
          qrBox.className = 'qr-box';
          const canvas = document.createElement('canvas');
          await QRCode.toCanvas(canvas, json.data.qrUrl, { width: 240, margin: 1 });
          qrBox.innerHTML = '';
          qrBox.appendChild(canvas);
        }

        statusEl.textContent = '请使用 ${appName} APP 扫码';
        startPoll();
      } catch (err) {
        statusEl.className = 'status error';
        statusEl.textContent = '网络错误: ' + err.message;
        refreshBtn.style.display = 'inline-block';
      }
    }

    function startPoll() {
      pollTimer = setInterval(async () => {
        if (!currentKey) return;
        try {
          const resp = await fetch('/platform/${platform}/qr/poll?key=' + encodeURIComponent(currentKey));
          const json = await resp.json();

          if (json.code !== 200 || !json.data) {
            return;
          }

          const statusEl = document.getElementById('status');
          const data = json.data;

          switch (data.status) {
            case 'waiting':
              statusEl.className = 'status';
              statusEl.textContent = '请使用 ${appName} APP 扫码';
              break;
            case 'scanned':
              statusEl.className = 'status scanned';
              statusEl.textContent = '已扫码，请在手机上确认登录';
              break;
            case 'expired':
              statusEl.className = 'status expired';
              statusEl.textContent = '二维码已过期';
              document.getElementById('refreshBtn').style.display = 'inline-block';
              if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
              break;
            case 'success':
              statusEl.className = 'status success';
              statusEl.innerHTML = '<div class="success-icon">✓</div>${platformName} 登录成功！<br><small style="color:#999">请返回 APP 查看</small>';
              if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
              break;
            case 'error':
              statusEl.className = 'status error';
              statusEl.textContent = data.message || '登录失败';
              document.getElementById('refreshBtn').style.display = 'inline-block';
              if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
              break;
          }
        } catch (err) {
          // 轮询失败时静默重试
        }
      }, 3000);
    }

    loadQr();
  </script>
</body>
</html>`;

  res.type('text/html').send(html);
});

module.exports = router;

function createPlatformGatewayApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use('/platform', router);
  app.use((_req, res) => {
    res.status(404).json({ code: 404, msg: 'Gateway route not found' });
  });
  return app;
}

module.exports.createPlatformGatewayApp = createPlatformGatewayApp;
module.exports.parsePtuiCallback = parsePtuiCallback;
module.exports.parseKugouSongLabel = parseKugouSongLabel;
module.exports.normalizeKugouPlaylists = normalizeKugouPlaylists;
module.exports.normalizeKugouSongs = normalizeKugouSongs;
module.exports.normalizeKugouUserInfo = normalizeKugouUserInfo;
module.exports.readQqSession = readQqSession;
module.exports.deleteQqSession = deleteQqSession;
module.exports.mergeCookieParts = mergeCookieParts;
module.exports.extractQQOAuthCode = extractQQOAuthCode;
module.exports.decodeQqLyricField = decodeQqLyricField;
module.exports.enforceQqLyricRateLimit = enforceQqLyricRateLimit;

if (require.main === module) {
  const port = Number(process.env.PORT || process.env.ZEPHYRUS_GATEWAY_PORT || 3050);
  const host = process.env.HOST || '127.0.0.1';
  createPlatformGatewayApp().listen(port, host, () => {
    console.log(`[music-gateway] listening on http://${host}:${port}`);
  });
}
