/**
 * 颜色中性化与取色纯函数工具。
 *
 * 灰度封面经 JPEG 压缩 / 服务端缩放后会残留少量色度噪声，取色链路必须把它们
 * 当纯灰处理，否则「黑白封面取出脏暖色」：全局强调色被暖化分支染成卡其、
 * vivid 页面底色随机落在暖偏色桶、播放器主题色被放大成高饱和棕色。
 * 全部为纯函数（无 DOM/依赖），供取色链路与单测共用。
 */
import type { RgbColor } from '@/utils/playerInk';

/**
 * 近灰判定：通道极差小即视为无色相。
 * 暗部按亮度比例放宽（JPEG 色度噪声在暗像素上的绝对值小，但暖黑是真实存在的
 * sepia 调，不能用同一个绝对阈值一刀切）。
 */
export function isNearGray(r: number, g: number, b: number, tol = 14): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min <= Math.max(tol, max * 0.06);
}

/** 近灰像素按 luma 归零色度；彩色像素原样返回 */
export function snapToNeutral(r: number, g: number, b: number): RgbColor {
  if (!isNearGray(r, g, b)) return { r, g, b };
  const luma = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  return { r: luma, g: luma, b: luma };
}

/**
 * 将封面平均色调整为适合 UI 的强调色（原 useCoverColor 内联逻辑，抽出供单测）。
 * 亮度钳制对灰度同样生效；暖化只对真正有色的封面生效——灰度封面保持中性，
 * 避免纯灰输入被染成脏卡其。
 */
export function adjustForAccent(r: number, g: number, b: number): RgbColor {
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  let ar = r;
  let ag = g;
  let ab = b;

  // 如果太暗，提亮
  if (brightness < 100) {
    const factor = 150 / Math.max(brightness, 1);
    ar = Math.min(255, Math.round(r * factor));
    ag = Math.min(255, Math.round(g * factor));
    ab = Math.min(255, Math.round(b * factor));
  }

  // 如果太亮（接近白色），降低亮度
  if (brightness > 220) {
    ar = Math.round(ar * 0.7);
    ag = Math.round(ag * 0.7);
    ab = Math.round(ab * 0.7);
  }

  // 偏暖：增加红色和绿色，减少蓝色（仅对彩色封面）
  if (!isNearGray(ar, ag, ab)) {
    ar = Math.min(255, ar + 15);
    ag = Math.min(255, ag + 10);
    ab = Math.max(0, ab - 20);
  }

  // 确保最低亮度（避免太暗）
  const minBrightness = 80;
  const newBrightness = (ar * 299 + ag * 587 + ab * 114) / 1000;
  if (newBrightness < minBrightness) {
    const factor = minBrightness / Math.max(newBrightness, 1);
    ar = Math.min(255, Math.round(ar * factor));
    ag = Math.min(255, Math.round(ag * factor));
    ab = Math.min(255, Math.round(ab * factor));
  }

  return { r: ar, g: ag, b: ab };
}

/**
 * 灰度封面的播放器主题色决策（saturateHex 的核心，抽出供单测）：
 * - 彩色封面：饱和度拉伸到 ≥0.72，亮度钳制到 [0.42, 0.65]；
 * - 近灰封面且全局强调色有色：借强调色色相（保证烟雾/流体仍有色调）；
 * - 近灰封面且强调色也无色：保持低饱和中性——不能强行上色，否则
 *   tinycolor 对纯灰给出的 hue=0 会把歌词染成高饱和红色。
 */
export function resolveSaturatedHsl(
  hsl: { h: number; s: number; l: number },
  accentHsl: { h: number; s: number } | null
): { h: number; s: number; l: number } {
  const clampL = (l: number) => Math.min(0.65, Math.max(0.42, l));
  if (hsl.s >= 0.08) {
    return { h: hsl.h, s: Math.max(hsl.s, 0.72), l: clampL(hsl.l) };
  }
  if (accentHsl && accentHsl.s >= 0.15) {
    return { h: accentHsl.h, s: 0.72, l: clampL(hsl.l) };
  }
  return { h: hsl.h, s: 0.06, l: clampL(hsl.l) };
}

/**
 * 从 size×size 像素数据里挑外围环带（外缘 1/4）面积最大的颜色桶
 * （vivid 页面底色的取色源，原 pageChrome 内联逻辑，抽出供单测）。
 * 近灰像素先去色度再入桶：JPEG 色度噪声会把灰像素散布到相邻暖偏桶，
 * 「计数最大桶」随机落在暖桶上就是灰度封面的脏底色。
 * 跨域取像素失败由调用方兜底；无有效像素返回 null。
 */
export function pickEdgeDominantColor(data: Uint8ClampedArray | Uint8Array, size: number): RgbColor | null {
  const band = Math.floor(size / 4);
  const buckets = new Map<string, { r: number; g: number; b: number; n: number }>();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inEdge = x < band || x >= size - band || y < band || y >= size - band;
      if (!inEdge) continue;
      const i = (y * size + x) * 4;
      if (data[i + 3] < 125) continue;
      const px = snapToNeutral(data[i], data[i + 1], data[i + 2]);
      const key = `${px.r >> 4}-${px.g >> 4}-${px.b >> 4}`;
      const bucket = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
      bucket.r += px.r;
      bucket.g += px.g;
      bucket.b += px.b;
      bucket.n += 1;
      buckets.set(key, bucket);
    }
  }
  let best: { r: number; g: number; b: number; n: number } | null = null;
  for (const bucket of buckets.values()) {
    if (!best || bucket.n > best.n) best = bucket;
  }
  if (!best || best.n === 0) return null;
  return { r: best.r / best.n, g: best.g / best.n, b: best.b / best.n };
}
