import { describe, expect, it } from 'vitest';

import {
  classifyPlatformLoginFailure,
  parseQqChannels,
  shouldRefreshSession,
  SESSION_REFRESH_INTERVAL_MS
} from '@/utils/platformLoginDiagnostics';

describe('parseQqChannels（新链能力探测）', () => {
  it('合法响应 → 三通道能力', () => {
    const parsed = parseQqChannels({
      code: 200,
      data: {
        channels: ['qq', 'wechat', 'qqmusic'],
        sessionMode: 'stored',
        configured: true,
        features: {}
      }
    });
    expect(parsed?.channels).toEqual(['qq', 'wechat', 'qqmusic']);
    expect(parsed?.sessionMode).toBe('stored');
    expect(parsed?.configured).toBe(true);
  });

  it('旧网关（非 JSON/code≠200/无通道）→ null 回退旧链', () => {
    expect(parseQqChannels(null)).toBeNull();
    expect(parseQqChannels({ code: 404 })).toBeNull();
    expect(parseQqChannels({ code: 501 })).toBeNull();
    expect(parseQqChannels({ code: 200, data: { channels: [] } })).toBeNull();
    expect(parseQqChannels({ code: 200, data: { channels: ['unknown'] } })).toBeNull();
  });

  it('未知通道名被过滤，合法通道保留', () => {
    const parsed = parseQqChannels({
      code: 200,
      data: { channels: ['qq', 'future-channel'], sessionMode: 'sealed', configured: true }
    });
    expect(parsed?.channels).toEqual(['qq']);
  });
});

describe('classifyPlatformLoginFailure（错误分类）', () => {
  it('20279 → 设备超限，文案含清理路径', () => {
    const r = classifyPlatformLoginFailure({ upstreamCode: 20279 });
    expect(r.kind).toBe('device-limit');
    expect(r.userMessage).toContain('设备管理');
  });

  it('qr-timeout → 过期（静默刷新语义）', () => {
    expect(classifyPlatformLoginFailure({ failureReason: 'qr-timeout' }).kind).toBe('qr-timeout');
  });

  it('retryAfterMs → 频控秒数', () => {
    const r = classifyPlatformLoginFailure({ retryAfterMs: 30000 });
    expect(r.kind).toBe('rate-limited');
    expect(r.userMessage).toContain('30');
  });

  it('401/失效文案 → session-expired', () => {
    expect(classifyPlatformLoginFailure({ status: 401 }).kind).toBe('session-expired');
  });

  it('failureHint → platform-rejected 引用平台原话', () => {
    const r = classifyPlatformLoginFailure({ failureHint: '账号状态异常' });
    expect(r.kind).toBe('platform-rejected');
    expect(r.userMessage).toContain('账号状态异常');
  });

  it('调试信息不进用户文案', () => {
    const r = classifyPlatformLoginFailure({
      message: 'QQ check_sig 未获取到 p_skey (status=403, set-cookie=..., body=<html>...)'
    });
    expect(r.userMessage).not.toContain('set-cookie');
    expect(r.userMessage).not.toContain('body=');
  });
});

describe('shouldRefreshSession（续期节奏）', () => {
  it('首次（null）→ 立即续期', () => {
    expect(shouldRefreshSession(null)).toBe(true);
  });

  it('间隔内不问，超过 1 小时再问', () => {
    const now = 1_000_000_000;
    expect(shouldRefreshSession(now - 1000, now)).toBe(false);
    expect(shouldRefreshSession(now - SESSION_REFRESH_INTERVAL_MS, now)).toBe(true);
  });
});
