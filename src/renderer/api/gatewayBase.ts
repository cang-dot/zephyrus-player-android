/**
 * 渲染层访问网关的统一基址（与 platformQrApi 内的约定保持一致）
 */
const DEFAULT_GATEWAY_URL = 'https://mucang.xyz/zephyrus/api';

export const gatewayBaseURL = (import.meta.env.VITE_MUSIC_GATEWAY || DEFAULT_GATEWAY_URL)
  .replace(/\/+$/, '')
  .replace(/\/platform$/i, '');
