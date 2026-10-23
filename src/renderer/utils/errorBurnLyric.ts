/**
 * 错误样式歌词切换的「溶解 / 燃烧」效果纯函数。
 *
 * dissolve（溶解）：每个字同步做边缘溶解（噪声云状 mask 从外缘向中心侵入），
 *   无逐字 delay——全部字同起同止，每字的噪声相位不同使边缘各自不规则；
 * burn（燃烧）：逐字错落蔓延，火从行首扫到行尾（index 步进 + hash 抖动），
 *   灼烧前沿焦边（ember 层由组件渲染）。
 */

export type ErrorLyricTransition = 'default' | 'dissolve' | 'burn';

const BURN_STEP_SEC = 0.045;
const BURN_JITTER_SEC = 0.03;
/** 烧尽动画本体时长（与组件 CSS keyframes 保持一致） */
const DISSOLVE_BODY_SEC = 1.1;
const BURN_BODY_SEC = 0.5;
/** ember 焦边层相对 base 的滞后 */
const EMBER_LAG_SEC = 0.12;

/** 确定性 hash（0~1）：抖动与噪声相位用，禁止 Math.random（重渲染需稳定） */
export function burnHash01(n: number): number {
  let t = (Math.floor(n) + 0x9e3779b9) >>> 0;
  t = Math.imul(t ^ (t >>> 16), 0x45d9f3b);
  t = Math.imul(t ^ (t >>> 16), 0x45d9f3b);
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
}

/** 每字动画 delay（秒）：dissolve 全零同步；burn 行首→行尾错落 */
export function lyricCharDelaySec(mode: ErrorLyricTransition, index: number): number {
  if (mode === 'dissolve') return 0;
  return index * BURN_STEP_SEC + burnHash01(index) * BURN_JITTER_SEC;
}

/** 一次行切换的总时长（秒，含末字 delay 与 ember 滞后），供清理定时器 */
export function burnTotalDurationSec(mode: ErrorLyricTransition, charCount: number): number {
  if (mode === 'dissolve') return DISSOLVE_BODY_SEC + 0.08;
  const lastDelay = charCount > 0 ? lyricCharDelaySec(mode, charCount - 1) : 0;
  return lastDelay + BURN_BODY_SEC + EMBER_LAG_SEC + 0.08;
}

/** 每字噪声相位偏移（px，注入 mask-position）：dissolve/burn 共用，让边缘各字不同 */
export function burnNoiseShiftPx(index: number): number {
  return Math.round((burnHash01(index * 7 + 3) - 0.5) * 120);
}

/**
 * 可平铺灰度噪声 data-URL（mask 的不规则烧边来源）。
 * 模块级生成一次；canvas 不可用（测试环境）时回退 1×1 纯白 PNG——
 * 噪声层退化为全通，烧边变规则但功能不失效。
 */
export function makeBurnNoiseDataUrl(size = 128): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const v = Math.round(burnHash01(i * 13 + 1) * 255);
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  }
}
