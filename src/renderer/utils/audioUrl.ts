/**
 * Web 环境音频 URL 规范化。
 *
 * 网易云 CDN（*.music.126.net）常返回 http:// 地址，在 HTTPS 页面上会被
 * 混合内容策略拦截导致无法播放；该系列 CDN 本身支持 HTTPS，直接升级协议。
 * 其余解析源域名原样返回，交给既有的失败兜底链处理。
 */
const HTTPS_UPGRADABLE_HOST = /(^|\.)music\.126\.net$/i;

export function normalizeAudioUrl(url: string | null | undefined): string | null | undefined {
  if (!url || typeof url !== 'string') return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' && HTTPS_UPGRADABLE_HOST.test(parsed.hostname)) {
      return url.replace(/^http:/i, 'https:');
    }
  } catch {
    // 非法 URL 原样返回
  }
  return url;
}
