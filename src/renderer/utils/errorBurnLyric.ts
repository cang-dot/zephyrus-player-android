/**
 * 错误样式歌词切换的「溶解 / 燃烧」效果纯函数。
 *
 * dissolve（溶解）：每个字同步做块状碎裂崩解——密度梯度块状噪声 mask
 *   滚动一个周期，字以块为单位碎裂消失（任意中间帧整字均匀碎块化），
 *   无逐字 delay，每字的噪声相位不同使碎裂图案各异；
 * burn（燃烧）：逐字错落蔓延，火从行首扫到行尾（index 步进 + hash 抖动），
 *   灼烧前沿焦边（ember 层由组件渲染）。
 */

export type ErrorLyricTransition = 'default' | 'dissolve' | 'burn';

const BURN_STEP_SEC = 0.045;
const BURN_JITTER_SEC = 0.03;
/** 溶解动画本体时长（与组件 CSS keyframes 保持一致） */
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

/** 每字噪声相位偏移（px，注入 mask-position）：dissolve/burn 共用，让碎裂图案各字不同 */
export function burnNoiseShiftPx(index: number): number {
  return Math.round((burnHash01(index * 7 + 3) - 0.5) * 120);
}

/**
 * 溶解 mask 用的云状密度梯度噪声 data-URL（模块级生成一次）。
 * 设计：可平铺的平滑 fbm 噪声（2 倍频周期 value noise）叠加对角密度
 * 梯度——等值线是不规则的云形而非几何圆；mask 沿对角滚动一个 tile
 * 周期 = 阈值推进，任意中间帧字的消失边缘都是噪声云状（修复旧实现
 * 「radial 圈主导裁剪」的观感）。
 * canvas 不可用（测试环境）时回退 1×1 纯白 PNG——mask 全通退化为无溶解。
 */
export function makeBurnNoiseDataUrl(size = 160): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    const img = ctx.createImageData(size, size);
    // 周期 value noise：格点 hash 以 tile 为周期取模 → 平铺无缝
    const noiseAt = (fx: number, fy: number, cells: number, salt: number): number => {
      const wrap = (n: number) => ((n % cells) + cells) % cells;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fx - x0;
      const ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx);
      const sy = ty * ty * (3 - 2 * ty);
      const h = (i: number, j: number) =>
        burnHash01(wrap(i) * 73 + wrap(j) * 179 + salt);
      const a = h(x0, y0);
      const b = h(x0 + 1, y0);
      const c = h(x0, y0 + 1);
      const d = h(x0 + 1, y0 + 1);
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const n =
          noiseAt(u * 5, v * 5, 5, 11) * 0.62 + noiseAt(u * 11, v * 11, 11, 29) * 0.38;
        const diag = (u + v) / 2;
        // 云噪声与对角梯度各半；再做 smoothstep 对比整形——mask 大部分区域
        // 纯黑/纯白（字实心 / 消失），只有窄带是云状过渡：滚动时是「侵蚀」
        // 而非整字半透明的雾状淡入
        const raw = Math.max(0, Math.min(1, n * 0.58 + diag * 0.42));
        const t = Math.max(0, Math.min(1, (raw - 0.42) / 0.16));
        const shaped = t * t * (3 - 2 * t);
        const gray = Math.round(shaped * 255);
        const i = (y * size + x) * 4;
        img.data[i] = gray;
        img.data[i + 1] = gray;
        img.data[i + 2] = gray;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  }
}
