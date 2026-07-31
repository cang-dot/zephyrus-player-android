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
const QQ_DAID = '384';
const QQ_REDIRECT = 'https://y.qq.com/portal';
const QQ_SESSION_TTL = 2 * 60 * 1000;

interface QqQrSession {
  cookie: string;
  createdAt: number;
}

const qqQrSessions = new Map<string, QqQrSession>();

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
 * 创建 QQ 音乐登录二维码
 * 返回二维码图片 URL（base64）和 qrsig
 */
async function createQQQrCode(): Promise<QrCreateResult> {
  const t = Math.random().toString(36).substring(2, 10);
  const url = `https://ssl.ptlogin2.qq.com/ptqrshow?appid=${QQ_APPID}&e=2&l=M&s=3&d=72&v=4&t=${t}&daid=${QQ_DAID}&pt_3rd_aid=0`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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
    `&action=0-0-${time}&js_ver=10275&js_type=1&login_sig=${loginSig}` +
    `&pt_uistyle=40&aid=${QQ_APPID}&daid=${QQ_DAID}&pt_3rd_aid=0`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Referer: 'https://y.qq.com/',
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

  // 解析 ptuiCB('code', 'status', 'redirectUrl', '0', 'message', '');
  const match = text.match(
    /ptuiCB\('(\d+)',\s*'[^']*',\s*'([^']*)',\s*'[^']*',\s*'([^']*)',\s*'[^']*'\)/
  );
  if (!match) {
    return {
      platform: 'qq',
      code: QrStatus.Error,
      message: 'QQ 登录状态解析失败'
    };
  }

  const [, codeStr, redirectUrl] = match;
  const code = parseInt(codeStr, 10);

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
  if (code === 65) {
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
      // 跟随重定向获取 Cookie
      const cookieResponse = await fetch(redirectUrl, {
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Referer: 'https://y.qq.com/',
          Cookie: mergedSessionCookie
        }
      });

      const setCookies = cookieResponse.headers.raw()['set-cookie'] || [];
      const resultCookie = mergeCookieParts(
        mergedSessionCookie,
        setCookiesFromHeader(setCookies).join('; ')
      );
      const uin = resultCookie.match(/(?:^|;\s*)uin=([^;]+)/)?.[1] || '';

      qqQrSessions.delete(qrsig);

      // 保存 Cookie
      setPlatformCookie('qq', resultCookie);

      return {
        platform: 'qq',
        code: QrStatus.Success,
        message: 'QQ 音乐登录成功',
        cookie: resultCookie,
        userInfo: {
          userId: uin,
          nickname: 'QQ音乐用户',
          avatarUrl: ''
        }
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
        cookies.set(part.slice(0, separatorIndex), part);
      }
    }
  }

  return Array.from(cookies.values()).join('; ');
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
    const cookieStr = `userid=${userid}; token=${token};`;

    // 保存 Cookie
    setPlatformCookie('kugou', cookieStr);

    return {
      platform: 'kugou',
      code: QrStatus.Success,
      message: '酷狗音乐登录成功',
      cookie: cookieStr,
      userInfo: {
        userId: userid,
        nickname: json.data.nickname || '酷狗用户',
        avatarUrl: json.data.head_icon || ''
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
