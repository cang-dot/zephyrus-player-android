export type PlatformQrStatus = 'waiting' | 'scanned' | 'success' | 'expired' | 'error';
export type PlatformQrProvider = 'qq' | 'wechat' | 'kugou' | 'bilibili';

export function normalizePlatformQrStatus(value: unknown): PlatformQrStatus {
  return value === 'waiting' ||
    value === 'scanned' ||
    value === 'success' ||
    value === 'expired'
    ? value
    : 'error';
}

export function normalizePlatformQrProvider(
  platform: 'qq' | 'kugou' | 'bilibili',
  value: unknown,
  requested: 'qq' | 'wechat' = 'qq'
): PlatformQrProvider {
  if (platform === 'bilibili') return 'bilibili';
  if (platform === 'kugou') return 'kugou';
  if (value === 'wechat' || value === 'qq') return value;
  return requested;
}
