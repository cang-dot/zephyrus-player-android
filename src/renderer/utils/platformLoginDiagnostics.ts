/**
 * 平台登录新链（Folia 移植）的前端纯函数：能力探测、错误分类、续期节奏。
 *
 * 全部无副作用，可单测；网络调用在 api/platformQrApi.ts 与 store 侧。
 */

export type QqLoginChannel = 'qq' | 'wechat' | 'qqmusic';

export interface QqLoginChannels {
  channels: QqLoginChannel[];
  /** sealed=serverless 加密令牌 / stored=服务端会话（常驻网关为此形态） */
  sessionMode: 'sealed' | 'stored' | string;
  configured: boolean;
  features?: Record<string, unknown>;
}

/** 网关 /platform/qq/api/login/channels 的原始响应（qq-music-api 3.3+） */
export interface QqChannelsResponse {
  code?: number;
  data?: {
    channels?: string[];
    sessionMode?: string;
    configured?: boolean;
    features?: Record<string, unknown>;
  };
}

/**
 * 解析 channels 响应 → 登录方式能力。
 * 网关未升级（404/HTML）、501（未配密钥）、任何异常 → null，调用方回退旧登录链。
 */
export function parseQqChannels(raw: unknown): QqLoginChannels | null {
  try {
    const body = raw as QqChannelsResponse;
    if (!body || typeof body !== 'object') return null;
    if (Number(body.code) !== 200 || !body.data) return null;
    const list = Array.isArray(body.data.channels) ? body.data.channels : [];
    const channels = list.filter(
      (c): c is QqLoginChannel => c === 'qq' || c === 'wechat' || c === 'qqmusic'
    );
    if (!channels.length) return null;
    return {
      channels,
      sessionMode: String(body.data.sessionMode || 'stored'),
      configured: body.data.configured !== false,
      features: body.data.features
    };
  } catch {
    return null;
  }
}

/** 登录方式用户文案（三通道语义来自 qq-music-api） */
export const QQ_CHANNEL_LABELS: Record<QqLoginChannel, string> = {
  qq: 'QQ 扫码',
  wechat: '微信扫码',
  qqmusic: 'QQ 音乐 App 扫码'
};

/* ==================== 错误分类 ==================== */

export type PlatformLoginErrorKind =
  | 'device-limit' // 20279：登录设备数超限
  | 'rate-limited' // 登录太频繁（retryAfterMs 存在）
  | 'qr-timeout' // 二维码自然过期（不算失败，静默刷新）
  | 'platform-rejected' // 平台拒绝（账号被封/受限/绑定问题），引用平台原话
  | 'session-expired' // 登录态已失效（需重新扫码）
  | 'network' // 网关不可达/子进程未启
  | 'unknown';

export interface PlatformLoginFailureInput {
  /** HTTP 状态码（可选） */
  status?: number;
  /** 上游错误码（QQ：20279 设备超限等；酷狗 status） */
  upstreamCode?: number | string;
  /** 结构化失败原因（qq-music-api failureReason） */
  failureReason?: string;
  /** 平台给的失败提示原文（failureHint） */
  failureHint?: string;
  /** 频控重试等待毫秒 */
  retryAfterMs?: number;
  /** 原始错误文本（兜底） */
  message?: string;
}

export interface PlatformLoginFailure {
  kind: PlatformLoginErrorKind;
  /** 展示给用户的文案（不含调试细节） */
  userMessage: string;
}

/** 把网关/上游失败映射为用户可读的错误分类（不再透传调试 body） */
export function classifyPlatformLoginFailure(input: PlatformLoginFailureInput): PlatformLoginFailure {
  const code = Number(input.upstreamCode);
  const reason = String(input.failureReason || '');
  const hint = String(input.failureHint || '').trim();
  const raw = String(input.message || '');

  if (code === 20279 || /20279|device.?limit/i.test(raw)) {
    return {
      kind: 'device-limit',
      userMessage:
        '该账号的登录设备数已达上限。请打开 QQ 音乐 App → 设置 → 设备管理，移除不用的设备后重新扫码。'
    };
  }
  if (reason === 'qr-timeout' || /二维码已过期/.test(raw)) {
    return { kind: 'qr-timeout', userMessage: '二维码已过期，正在刷新，请重新扫码。' };
  }
  if (input.retryAfterMs && input.retryAfterMs > 0) {
    const seconds = Math.ceil(input.retryAfterMs / 1000);
    return { kind: 'rate-limited', userMessage: `操作太频繁，请约 ${seconds} 秒后再试。` };
  }
  if (Number(input.status) === 401 || /登录已失效|session.*expired/i.test(raw)) {
    return { kind: 'session-expired', userMessage: '登录状态已失效，请重新扫码。' };
  }
  if (Number(input.status) === 502 || /子进程不可用|ECONNREFUSED/.test(raw)) {
    return { kind: 'network', userMessage: '登录服务暂不可用，请稍后再试。' };
  }
  if (reason === 'upstream-rejected' || hint) {
    return {
      kind: 'platform-rejected',
      userMessage: hint ? `平台拒绝了登录：${hint}` : '平台拒绝了登录，请稍后再试。'
    };
  }
  return { kind: 'unknown', userMessage: '登录失败，请重试。' };
}

/* ==================== 续期节奏 ==================== */

export const SESSION_REFRESH_INTERVAL_MS = 60 * 60 * 1000; // 每小时问一次
export const SESSION_REFRESH_WINDOW_MS = 6 * 60 * 60 * 1000; // 到期 <6h 才真正换新

/**
 * 续期节奏判定（qq-music-api /login/refresh 语义：网关到期 <6h 才换新令牌）。
 * 返回是否应发起本轮续期询问。
 */
export function shouldRefreshSession(
  lastRefreshAt: number | null,
  now: number = Date.now()
): boolean {
  if (lastRefreshAt == null) return true;
  return now - lastRefreshAt >= SESSION_REFRESH_INTERVAL_MS;
}
