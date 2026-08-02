/**
 * 多平台扫码登录模块（主进程）
 *
 * 支持：
 * - QQ 音乐扫码登录（QQ 扫码 + 微信扫码）
 * - 酷狗音乐扫码登录
 *
 * 流程：
 * - 创建二维码 → 前端展示
 * - 轮询扫码状态 → 前端显示状态
 * - 登录成功 → 保存 Cookie → 返回用户信息
 */

import crypto from 'crypto';
import { ipcMain } from 'electron';
import fetch from 'node-fetch';

import { setPlatformCookie } from '../multiPlatformSearch';

// ==================== 类型定义 ====================

export type LoginPlatform = 'qq' | 'kugou';

export interface QrCreateResult {
  platform: LoginPlatform;
  qrUrl: string;
  key: string;
  expiredAt: number;
}

export interface QrPollResult {
  platform: LoginPlatform;
  /** 状态码 */
  code: QrStatus;
  /** 状态描述 */
  message: string;
  /** 登录成功时返回的 Cookie */
  cookie?: string;
  /** 登录成功时返回的用户信息 */
  userInfo?: {
    nickname?: string;
    avatarUrl?: string;
    userId?: string;
  };
}

export enum QrStatus {
  Waiting = 'waiting',
  Scanned = 'scanned',
  Success = 'success',
  Expired = 'expired',
  Error = 'error'
}

// ==================== QQ 音乐扫码登录 ====================

/**
 * QQ 音乐二维码登录配置
 */
const QQ_APPID = '716027609';
const QQ_DAID = '383';
const QQ_PT_3RD_AID = '100497308';
const QQ_REDIRECT = 'https://graph.qq.com/oauth2.0/login_jump';
const QQ_MUSIC_REDIRECT =
  'https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=https://y.qq.com/';
const QQ_JS_VER = '20102616';
const QQ_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const QQ_SESSION_TTL = 2 * 60 * 1000;

interface QqQrSession {
  cookie: string;
  createdAt: number;
}

const qqQrSessions = new Map<string, QqQrSession>();

export function parsePtuiCallback(payload: string): {
  code: number;
  redirectUrl: string;
  message: string;
} | null {
  const callbackMatch = String(payload || '').match(/ptuiCB\s*\(([\s\S]*?)\)\s*;?/);
  if (!callbackMatch) return null;

  const args: string[] = [];
  const argumentPattern = /'((?:\\.|[^'\\])*)'/g;
  let argumentMatch: RegExpExecArray | null;
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

/**
 * hash33 算法 — 用于计算 ptqrtoken
 * QQ 登录轮询接口需要此 token
 */
function hash33(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h += (h << 5) + s.charCodeAt(i);
  }
  return h & 0x7fffffff;
}

/**
 * OAuth 授权请求的 ui 参数需要一个随机 UUID（等价于 QQ 音乐 Web 端每次生成的 GUID）
 */
function randomUuid(): string {
  if (typeof (crypto as any).randomUUID === 'function') {
    return (crypto as any).randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 创建 QQ 音乐登录二维码
 * 返回二维码图片 URL（base64）和 qrsig
 */
async function createQQQrCode(): Promise<QrCreateResult> {
  const t = Math.random().toString(36).substring(2, 10);
  const url = `https://ssl.ptlogin2.qq.com/ptqrshow?appid=${QQ_APPID}&e=2&l=M&s=3&d=72&v=4&t=${t}&daid=${QQ_DAID}&pt_3rd_aid=${QQ_PT_3RD_AID}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': QQ_USER_AGENT
    }
  });

  if (!response.ok) {
    throw new Error(`QQ 二维码创建失败: ${response.status}`);
  }

  // 从响应头提取 qrsig cookie
  const setCookies = response.headers.raw()['set-cookie'] || [];
  let qrsig = '';
  for (const cookie of setCookies) {
    const match = cookie.match(/qrsig=([^;]+)/);
    if (match) {
      qrsig = match[1];
      break;
    }
  }

  if (!qrsig) {
    throw new Error('QQ 二维码创建失败: 未获取到 qrsig');
  }

  qqQrSessions.set(qrsig, {
    cookie: setCookiesFromHeader(setCookies).join('; '),
    createdAt: Date.now()
  });

  // 将图片转为 base64
  const buffer = await response.buffer();
  const base64 = `data:image/png;base64,${buffer.toString('base64')}`;

  return {
    platform: 'qq',
    qrUrl: base64,
    key: qrsig,
    expiredAt: Date.now() + 2 * 60 * 1000 // 2 分钟过期
  };
}

/**
 * 轮询 QQ 音乐二维码扫码状态
 */
async function pollQQQrStatus(qrsig: string): Promise<QrPollResult> {
  const session = qqQrSessions.get(qrsig);
  if (session && Date.now() - session.createdAt > QQ_SESSION_TTL) {
    qqQrSessions.delete(qrsig);
  }

  const sessionCookie = qqQrSessions.get(qrsig)?.cookie || `qrsig=${qrsig}`;
  const ptqrtoken = hash33(qrsig);
  const loginSig = '';
  const time = Date.now();
  const url =
    `https://ssl.ptlogin2.qq.com/ptqrlogin?u1=${encodeURIComponent(QQ_REDIRECT)}` +
    `&ptqrtoken=${ptqrtoken}&ptredirect=0&h=1&t=1&g=1&from_ui=1&ptlang=2052` +
    `&action=0-0-${time}&js_ver=${QQ_JS_VER}&js_type=1&login_sig=${loginSig}&has_onekey=1` +
    `&pt_uistyle=40&aid=${QQ_APPID}&daid=${QQ_DAID}&pt_3rd_aid=${QQ_PT_3RD_AID}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': QQ_USER_AGENT,
      Referer: 'https://xui.ptlogin2.qq.com/',
      Cookie: sessionCookie
    }
  });

  const text = await response.text();
  const responseCookie = setCookiesFromHeader(response.headers.raw()['set-cookie'] || []).join(
    '; '
  );
  const mergedSessionCookie = mergeCookieParts(sessionCookie, responseCookie);
  if (qqQrSessions.has(qrsig) && mergedSessionCookie) {
    qqQrSessions.set(qrsig, {
      cookie: mergedSessionCookie,
      createdAt: session?.createdAt || Date.now()
    });
  }

  const callback = parsePtuiCallback(text);
  if (!callback) {
    return {
      platform: 'qq',
      code: QrStatus.Error,
      message: 'QQ 登录状态解析失败，请刷新二维码重试'
    };
  }

  const { code, redirectUrl } = callback;

  // 66 = 等待扫码
  if (code === 66) {
    return {
      platform: 'qq',
      code: QrStatus.Waiting,
      message: '等待扫码'
    };
  }

  // 67 = 已扫码，等待确认
  if (code === 67) {
    return {
      platform: 'qq',
      code: QrStatus.Scanned,
      message: '已扫码，请在手机上确认登录'
    };
  }

  // 65 = 二维码过期
  if (code === 65 || code === 68) {
    qqQrSessions.delete(qrsig);
    return {
      platform: 'qq',
      code: QrStatus.Expired,
      message: '二维码已过期'
    };
  }

  // 0 = 登录成功
  if (code === 0 && redirectUrl) {
    try {
      const loginResult = await completeQQLogin(redirectUrl, mergedSessionCookie);

      qqQrSessions.delete(qrsig);

      // 保存 Cookie
      setPlatformCookie('qq', loginResult.cookie);

      return {
        platform: 'qq',
        code: QrStatus.Success,
        message: 'QQ 音乐登录成功',
        cookie: loginResult.cookie,
        userInfo: loginResult.userInfo
      };
    } catch (error: any) {
      return {
        platform: 'qq',
        code: QrStatus.Error,
        message: `获取 Cookie 失败: ${error.message}`
      };
    }
  }

  return {
    platform: 'qq',
    code: QrStatus.Error,
    message: `未知状态: ${code}`
  };
}

function cookiePartsFromString(cookie: string): string[] {
  return cookie
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.includes('='));
}

function setCookiesFromHeader(cookies: string[]): string[] {
  return cookies.map((cookie) => cookie.split(';')[0]);
}

function mergeCookieParts(...cookieSources: string[]): string {
  const cookies = new Map<string, string>();

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

function cookieMap(cookie: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of cookiePartsFromString(cookie)) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex > 0) {
      result[part.slice(0, separatorIndex)] = part.slice(separatorIndex + 1);
    }
  }
  return result;
}

function firstOwnValue(value: unknown, keys: string[]): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const entries = Object.entries(value as Record<string, unknown>);
  for (const key of keys) {
    const match = entries.find(([candidate]) => candidate.toLowerCase() === key.toLowerCase());
    if (!match || match[1] === null || match[1] === undefined) continue;
    if (typeof match[1] === 'string' || typeof match[1] === 'number') {
      const text = String(match[1]).trim();
      if (text) return text;
    }
  }
  return '';
}

function firstDeepValue(value: unknown, keys: string[], depth = 0): string {
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

function qqGtk(cookie: string): number {
  const values = cookieMap(cookie);
  const key =
    values.qqmusic_key || values.p_skey || values.skey || values.p_lskey || values.lskey || '';
  let hash = 5381;
  let decodedKey = key;
  try {
    decodedKey = decodeURIComponent(key);
  } catch {
    // 使用原始 Cookie 值继续计算。
  }
  for (const character of decodedKey) {
    hash += (hash << 5) + character.charCodeAt(0);
  }
  return hash & 0x7fffffff;
}

function normalizeQQUserId(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/^o(?=\d)/i, '');
}

function extractQQOAuthCode(location: string, body: string): string {
  const values = [location, body];
  for (const value of values) {
    let text = String(value || '')
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

interface QQLoginCompletion {
  cookie: string;
  userInfo: {
    userId: string;
    nickname: string;
    avatarUrl: string;
  };
}

function createQQLoginFromCookie(cookie: string, loginData: any = {}): QQLoginCompletion | null {
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
async function fetchQqUserInfo(cookie: string): Promise<{
  nickname: string;
  avatarUrl: string;
  vip: boolean;
} | null> {
  const values = cookieMap(cookie);
  const userId = normalizeQQUserId(values.uin || values.p_uin || values.ptui_loginuin || '');
  if (!userId) return null;

  const key = values.qm_keyst || values.qqmusic_key || values.p_skey || values.skey || '';
  if (key) {
    try {
      const response = await fetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': QQ_USER_AGENT,
          Referer: 'https://y.qq.com/',
          Cookie: cookie
        },
        body: JSON.stringify({
          comm: { g_tk: 5381, platform: 'yqq', ct: 24, cv: 0 },
          req: {
            module: 'music.UserInfo.userInfoServer',
            method: 'GetLoginUserInfo',
            param: {}
          }
        })
      });
      const text = await response.text();
      let json: any = {};
      try {
        json = JSON.parse(text);
      } catch {
        // 响应非 JSON 时走公开主页兜底
      }
      const data = json.req?.data || json.data;
      const nickname =
        firstDeepValue(data, ['nickname', 'nick', 'user_name']) ||
        firstDeepValue(json, ['nickname', 'nick', 'user_name']);
      if (nickname) {
        return {
          nickname,
          avatarUrl:
            firstDeepValue(data, ['avatarUrl', 'avatar_url', 'headpic', 'head_pic']) || '',
          vip: Boolean(firstDeepValue(data, ['vip', 'is_vip']))
        };
      }
    } catch (error: any) {
      console.warn('[platformLogin] QQ GetLoginUserInfo 失败，使用公开主页兜底:', error.message);
    }
  }

  try {
    const params = new URLSearchParams({
      ct: '20',
      cv: '4747474',
      cid: '205360838',
      userid: userId
    });
    const response = await fetch(
      `https://c6.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg?${params.toString()}`,
      {
        headers: {
          'User-Agent': QQ_USER_AGENT,
          Referer: 'https://y.qq.com/'
        }
      }
    );
    const json: any = await response.json();
    const creator = json?.data?.creator;
    if (creator?.nick) {
      return {
        nickname: creator.nick,
        avatarUrl: creator.headpic || '',
        vip: false
      };
    }
  } catch (error: any) {
    console.warn('[platformLogin] QQ 公开主页信息获取失败:', error.message);
  }

  return null;
}

async function completeQQLogin(
  redirectUrl: string,
  sessionCookie: string
): Promise<QQLoginCompletion> {
  let redirect: URL;
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
    throw new Error('QQ 登录回调缺少 uin/ptsigx 参数，请重新扫码');
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

  const checkSigResponse = await fetch(checkSigUrl, {
    redirect: 'manual',
    headers: {
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'User-Agent': QQ_USER_AGENT,
      Referer: 'https://xui.ptlogin2.qq.com/',
      Cookie: sessionCookie
    }
  });
  if (checkSigResponse.status >= 400) {
    throw new Error(`QQ check_sig 请求被拒绝 (${checkSigResponse.status})`);
  }
  const checkSigSetCookie = setCookiesFromHeader(
    checkSigResponse.headers.raw()['set-cookie'] || []
  ).join('; ');
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
    const bodyPreview = String(checkSigResponse.text ? await checkSigResponse.text() : '')
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
    ui: randomUuid()
  }).toString();
  const authorizeResponse = await fetch('https://graph.qq.com/oauth2.0/authorize', {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': QQ_USER_AGENT,
      Referer: 'https://xui.ptlogin2.qq.com/',
      Cookie: graphCookie
    },
    body: authorizeBody
  });
  if (authorizeResponse.status >= 400) {
    throw new Error(`QQ OAuth 授权请求失败 (${authorizeResponse.status})`);
  }
  graphCookie = mergeCookieParts(
    graphCookie,
    setCookiesFromHeader(authorizeResponse.headers.raw()['set-cookie'] || []).join('; ')
  );

  const location = authorizeResponse.headers.get('location') || '';
  const authorizeBodyText = await authorizeResponse.text();
  const oauthCode = extractQQOAuthCode(location, authorizeBodyText);
  if (!oauthCode) {
    const fallbackLogin = createQQLoginFromCookie(graphCookie);
    if (fallbackLogin) return fallbackLogin;
    const bodyPreview = String(authorizeBodyText).replace(/\s+/g, ' ').slice(0, 200);
    throw new Error(
      `QQ OAuth 授权码获取失败 (status=${authorizeResponse.status}, ` +
        `location=${location.slice(0, 200) || '<empty>'}, body=${bodyPreview || '<empty>'})，请重新扫码`
    );
  }

  const musicResponse = await fetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': QQ_USER_AGENT,
      Referer: 'https://y.qq.com/',
      Cookie: graphCookie
    },
    body: JSON.stringify({
      comm: { g_tk: 5381, platform: 'yqq', ct: 24, cv: 0 },
      req: {
        module: 'QQConnectLogin.LoginServer',
        method: 'QQLogin',
        param: { code: decodeURIComponent(oauthCode) }
      }
    })
  });
  if (musicResponse.status >= 400) {
    throw new Error(`QQ 音乐登录请求失败 (${musicResponse.status})`);
  }
  const musicText = await musicResponse.text();
  let loginData: any = {};
  try {
    loginData = JSON.parse(musicText);
  } catch {
    throw new Error('QQ 音乐登录响应解析失败，请重新扫码');
  }

  let resultCookie = mergeCookieParts(
    graphCookie,
    setCookiesFromHeader(musicResponse.headers.raw()['set-cookie'] || []).join('; ')
  );
  const musicKey = firstDeepValue(loginData, ['musickey', 'music_key', 'qm_keyst', 'qqmusic_key']);
  const musicUin = firstDeepValue(loginData, ['musicid', 'uin', 'user_id', 'userid']);
  const existingCookies = cookieMap(resultCookie);
  if (musicKey && !existingCookies.qm_keyst && !existingCookies.qqmusic_key) {
    resultCookie = mergeCookieParts(resultCookie, `qm_keyst=${musicKey}`);
  }
  const normalizedUin = normalizeQQUserId(
    musicUin || existingCookies.uin || existingCookies.ptui_loginuin
  );
  if (normalizedUin && !existingCookies.uin) {
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
  } catch (error: any) {
    console.warn('[platformLogin] QQ 用户信息补充失败:', error.message);
  }
  return completedLogin;
}

// ==================== 酷狗音乐扫码登录（新 API + Web 签名） ====================
// 旧 API (login.kugou.com) 已废弃，新 API 使用 login-user.kugou.com
// 需要 Web 签名：MD5(salt + sortedKV + salt)

const KUGOU_WEB_SALT = 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt';
const KUGOU_SRC_APPID = 2919;
const KUGOU_APPID = 3116;
const KUGOU_CLIENTVER = 11436;

// 持久化设备身份
const kugouMid = generateKugouMid();
const kugouDfid = generateKugouDfid();

function md5(str: string): string {
  return crypto.createHash('md5').update(str, 'utf8').digest('hex');
}

function generateKugouMid(): string {
  return crypto.randomBytes(16).toString('hex');
}

function generateKugouDfid(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 酷狗 Web 签名：MD5(salt + sortedKV + salt)
 */
function kugouWebSign(params: Record<string, any>): string {
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

/**
 * 构建酷狗默认参数
 */
function buildKugouDefaultParams(): Record<string, any> {
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

/**
 * 构建查询字符串
 */
function buildQueryString(params: Record<string, any>): string {
  return Object.entries(params)
    .map(([k, v]) => {
      let val = v;
      if (val === true) val = '1';
      if (val === false) val = '0';
      if (val === null || val === undefined) val = '';
      return `${encodeURIComponent(k)}=${encodeURIComponent(String(val))}`;
    })
    .join('&');
}

/**
 * 创建酷狗登录二维码
 */
async function createKugouQrCode(): Promise<QrCreateResult> {
  const defaultParams = buildKugouDefaultParams();
  const params: Record<string, any> = {
    ...defaultParams,
    appid: 1001, // 二维码创建用 appid=1001
    type: 1,
    plat: 4,
    qrcode_txt: `https://h5.kugou.com/apps/loginQRCode/html/index.html?appid=${KUGOU_APPID}&`,
    srcappid: KUGOU_SRC_APPID
  };

  // 计算 Web 签名
  params.signature = kugouWebSign(params);

  const url = `https://login-user.kugou.com/v2/qrcode?${buildQueryString(params)}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Referer: 'https://www.kugou.com/'
    }
  });

  const json: any = await response.json();

  if (json.status !== 1 || !json.data) {
    throw new Error(`酷狗二维码创建失败: ${json.error_msg || JSON.stringify(json)}`);
  }

  // 二维码 URL 本地生成
  const qrUrl = `https://h5.kugou.com/apps/loginQRCode/html/index.html?qrcode=${json.data.qrcode}`;

  return {
    platform: 'kugou',
    qrUrl,
    key: json.data.qrcode,
    expiredAt: Date.now() + 5 * 60 * 1000 // 5 分钟过期
  };
}

/**
 * 轮询酷狗二维码扫码状态
 */
async function pollKugouQrStatus(key: string): Promise<QrPollResult> {
  const defaultParams = buildKugouDefaultParams();
  const params: Record<string, any> = {
    ...defaultParams,
    plat: 4,
    srcappid: KUGOU_SRC_APPID,
    qrcode: key
  };

  // 计算 Web 签名
  params.signature = kugouWebSign(params);

  const url = `https://login-user.kugou.com/v2/get_userinfo_qrcode?${buildQueryString(params)}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Referer: 'https://www.kugou.com/'
    }
  });

  const json: any = await response.json();

  if (json.status !== 1) {
    return {
      platform: 'kugou',
      code: QrStatus.Error,
      message: json.error_msg || `酷狗登录状态查询失败 (error_code: ${json.error_code})`
    };
  }

  const status = json.data?.status;

  // 1 = 等待扫码
  if (status === 1) {
    return {
      platform: 'kugou',
      code: QrStatus.Waiting,
      message: '等待扫码'
    };
  }

  // 2 = 已扫码，等待确认
  if (status === 2) {
    return {
      platform: 'kugou',
      code: QrStatus.Scanned,
      message: '已扫码，请在手机上确认登录'
    };
  }

  // 0 = 过期
  if (status === 0) {
    return {
      platform: 'kugou',
      code: QrStatus.Expired,
      message: '二维码已过期'
    };
  }

  // 4 = 登录成功
  if (status === 4) {
    const userid = String(json.data.userid || '');
    const token = json.data.token || '';
    const cookieStr = mergeCookieParts(
      `userid=${userid}; token=${token};`,
      `dfid=${json.data.dfid || kugouDfid}; KUGOU_API_MID=${json.data.mid || kugouMid}; KUGOU_API_PLATFORM=lite;`
    );

    // 保存 Cookie
    setPlatformCookie('kugou', cookieStr);

    return {
      platform: 'kugou',
      code: QrStatus.Success,
      message: '酷狗音乐登录成功',
      cookie: cookieStr,
      userInfo: {
        userId: userid,
        nickname:
          json.data.nickname ||
          json.data.nick_name ||
          json.data.username ||
          json.data.user_name ||
          '酷狗用户',
        avatarUrl:
          json.data.head_icon ||
          json.data.headurl ||
          json.data.head_url ||
          json.data.avatar ||
          json.data.avatar_url ||
          json.data.pic ||
          ''
      }
    };
  }

  return {
    platform: 'kugou',
    code: QrStatus.Error,
    message: `未知状态: ${status}`
  };
}

// ==================== IPC 注册 ====================

/**
 * 初始化平台扫码登录 IPC
 */
export function initializePlatformLogin(): void {
  // 创建二维码
  ipcMain.handle('platform-qr-create', async (_event, platform: LoginPlatform) => {
    try {
      if (platform === 'qq') {
        return await createQQQrCode();
      }
      if (platform === 'kugou') {
        return await createKugouQrCode();
      }
      return { error: `不支持的平台: ${platform}` };
    } catch (error: any) {
      console.error(`[platformLogin] 创建二维码失败:`, error);
      return { error: error.message || '创建二维码失败' };
    }
  });

  // 轮询扫码状态
  ipcMain.handle('platform-qr-poll', async (_event, platform: LoginPlatform, key: string) => {
    try {
      if (platform === 'qq') {
        return await pollQQQrStatus(key);
      }
      if (platform === 'kugou') {
        return await pollKugouQrStatus(key);
      }
      return {
        platform,
        code: QrStatus.Error,
        message: `不支持的平台: ${platform}`
      };
    } catch (error: any) {
      console.error(`[platformLogin] 轮询状态失败:`, error);
      return {
        platform,
        code: QrStatus.Error,
        message: error.message || '轮询状态失败'
      };
    }
  });
}
