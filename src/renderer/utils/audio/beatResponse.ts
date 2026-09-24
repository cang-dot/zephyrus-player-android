/**
 * 鼓点响应纯函数工具：自适应基线、加权频谱通量、非对称包络。
 *
 * 密集配器下低频段长期贴顶，「含当前帧的帧数均值 × 倍数」这类判据会失灵——
 * 基线被自己的峰值抬高、动态余量耗尽，冲击再也够不到阈值。这里把
 * 基线 / 通量 / 包络拆成可单测的纯逻辑，供全局鼓点检测器（drumDetector）
 * 与网格背景驱动（MeshGradientBackground）共用。
 */

export interface AdaptiveBaselineOptions {
  /**
   * 基线窗口时长（毫秒）。用时间而不是帧数：Web rAF 约 60fps、安卓注入 20Hz，
   * 同样的 43 帧在两条路径上是 0.7s 与 2.2s，时间窗才能让时间常数一致。
   */
  windowMs?: number;
  /**
   * 分位数（0~1）。高分位（默认 0.75）对孤立峰值不敏感——鼓点瞬间自己
   * 不会进入基线，密集段的持续高电平也只是「新常态」。
   */
  percentile?: number;
  /** 样本数上限，防长时间高帧率下无界增长 */
  maxSamples?: number;
}

/** 时间窗 + 分位数 + 排除当前帧的自适应基线 */
export class AdaptiveBaseline {
  private readonly windowMs: number;
  private readonly percentile: number;
  private readonly maxSamples: number;
  private samples: Array<{ t: number; value: number }> = [];

  constructor(options?: AdaptiveBaselineOptions) {
    this.windowMs = Math.max(100, options?.windowMs ?? 1500);
    this.percentile = Math.min(1, Math.max(0.01, options?.percentile ?? 0.75));
    this.maxSamples = Math.max(8, options?.maxSamples ?? 360);
  }

  get size(): number {
    return this.samples.length;
  }

  /**
   * 用既有历史（不含本次样本）计算基线，然后把本次样本入窗。
   * 历史为空（刚重置/启动）时返回 0，调用方自行用地板值兜底。
   */
  observe(now: number, value: number): number {
    this.prune(now);
    const baseline = this.percentileOf();
    this.samples.push({ t: now, value });
    if (this.samples.length > this.maxSamples) this.samples.shift();
    return baseline;
  }

  reset(): void {
    this.samples = [];
  }

  private prune(now: number): void {
    const cutoff = now - this.windowMs;
    let drop = 0;
    while (drop < this.samples.length && this.samples[drop].t < cutoff) drop++;
    if (drop > 0) this.samples.splice(0, drop);
  }

  private percentileOf(): number {
    if (this.samples.length === 0) return 0;
    const values = this.samples.map((s) => s.value).sort((a, b) => a - b);
    const index = Math.min(values.length - 1, Math.floor(values.length * this.percentile));
    return values[index];
  }
}

export interface FluxBandSplit {
  /** 低频段结束 bin（含），与之相等的索引用低频权重 */
  lowEnd: number;
  /** 中频段结束 bin（含），其后的索引用高频权重 */
  midEnd: number;
}

/**
 * 频段通量权重：低频冲击对鼓点最关键给满权重；密集混音里镲片/嘶声的
 * 帧间波动最碎且 bin 数最多，压低权重避免通量被高频主导。
 */
export const FLUX_BAND_WEIGHTS = { low: 1, mid: 0.7, high: 0.4 } as const;

/**
 * 加权频谱通量：只统计正向变化（能量上升），按频段加权后归一化到与
 * 均值通量同量级（0~1）。输入是 AnalyserNode 的 0~255 字节频谱。
 */
export function weightedSpectralFlux(
  current: ArrayLike<number>,
  previous: ArrayLike<number>,
  bands: FluxBandSplit
): number {
  const len = Math.min(current.length, previous.length);
  if (len === 0) return 0;
  let flux = 0;
  let weightSum = 0;
  for (let i = 0; i < len; i++) {
    const weight =
      i <= bands.lowEnd ? FLUX_BAND_WEIGHTS.low : i <= bands.midEnd ? FLUX_BAND_WEIGHTS.mid : FLUX_BAND_WEIGHTS.high;
    const diff = current[i] - previous[i];
    if (diff > 0) flux += diff * weight;
    weightSum += weight;
  }
  return weightSum > 0 ? flux / (weightSum * 255) : 0;
}

export interface EnvelopeOptions {
  /** 起音时间（毫秒）：目标高于当前值时的趋近速度 */
  attackMs?: number;
  /** 释放时间（毫秒）：目标低于当前值时的趋近速度 */
  releaseMs?: number;
}

/**
 * 一阶非对称包络：快起慢落。把瞬时冲击整形为「顶一下、再缓缓回落」的
 * 可视曲线；对称缓动（如 AMLL 移植曲线的 0.003/ms）会把瞬态抹平。
 */
export class AttackReleaseEnvelope {
  private value = 0;
  private lastAt = 0;
  private readonly attackMs: number;
  private readonly releaseMs: number;

  constructor(options?: EnvelopeOptions) {
    this.attackMs = Math.max(1, options?.attackMs ?? 20);
    this.releaseMs = Math.max(1, options?.releaseMs ?? 160);
  }

  /** 推进一步，返回当前包络值。delta 上限 200ms，防标签页休眠后一步跨过大间隔 */
  step(now: number, target: number): number {
    const delta = this.lastAt > 0 ? Math.min(200, Math.max(0, now - this.lastAt)) : 16;
    this.lastAt = now;
    const tau = target >= this.value ? this.attackMs : this.releaseMs;
    this.value += (target - this.value) * (1 - Math.exp(-delta / tau));
    if (this.value < 1e-4) this.value = 0;
    return this.value;
  }

  reset(): void {
    this.value = 0;
    this.lastAt = 0;
  }
}
