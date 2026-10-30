/**
 * crossfade.ts — Level 1: 等功率淡入淡出 (Equal-power Crossfade)
 *
 * 使用余弦曲线控制音量，确保过渡段总功率恒定，避免音量凹陷。
 *
 *   淡出: gain(t) = cos(π·t / 2)    ← 从 1 → 0
 *   淡入: gain(t) = sin(π·t / 2)    ← 从 0 → 1
 *   两者平方和 = cos² + sin² = 1（功率守恒）
 *
 * 使用 setValueCurveAtTime 写入 Float32Array 曲线，精度高、无抖动。
 */

/**
 * 生成等功率淡入或淡出曲线
 * @param samples 采样点数
 * @param direction 'in' 淡入 | 'out' 淡出
 * @returns Float32Array 曲线
 */
export function equalPowerCurve(samples: number, direction: 'in' | 'out'): Float32Array {
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1);
    const angle = (Math.PI * t) / 2;
    if (direction === 'in') {
      curve[i] = Math.sin(angle);
    } else {
      curve[i] = Math.cos(angle);
    }
  }
  return curve;
}

/**
 * 对两个 GainNode 应用等功率交叉淡入淡出
 *
 * @param ctx AudioContext
 * @param gainOut 淡出的 GainNode（当前歌曲）
 * @param gainIn 淡入的 GainNode（下一首歌）
 * @param startTime 开始时间（AudioContext.currentTime）
 * @param duration 过渡时长（秒）
 * @param volumeScale 音量缩放（0~1），曲线终值/起始值会乘以该系数，
 *                    用于与全局音量保持一致，避免过渡段音量跳变
 */
export function applyEqualPowerCrossfade(
  _ctx: AudioContext,
  gainOut: GainNode,
  gainIn: GainNode,
  startTime: number,
  duration: number,
  volumeScale: number = 1
): void {
  const samples = Math.max(64, Math.ceil(duration * 100));
  const scale = Math.max(0, Math.min(1, volumeScale));

  const curveOut = new Float32Array(samples);
  const curveIn = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1);
    const angle = (Math.PI * t) / 2;
    curveOut[i] = Math.cos(angle) * scale;
    curveIn[i] = Math.sin(angle) * scale;
  }

  // 确保起始值正确
  gainOut.gain.setValueAtTime(scale, startTime);
  gainIn.gain.setValueAtTime(0, startTime);

  // 应用曲线
  gainOut.gain.setValueCurveAtTime(curveOut, startTime, duration);
  gainIn.gain.setValueCurveAtTime(curveIn, startTime, duration);

  // 过渡结束后确保终值精确
  gainOut.gain.setValueAtTime(0, startTime + duration + 0.001);
  gainIn.gain.setValueAtTime(scale, startTime + duration + 0.001);
}

/**
 * together 平台交叉淡化曲线（folia automix 移植，源自 signalAnalysis.buildCrossfadeCurves）
 *
 * 等功率曲线的中段加入平台：两曲各停在 cos(π/4)≈-3dB 一段时间再完成换手，
 * 形成 DJ「出场曲一直在，然后走掉」的听感。平台期两曲功率和仍为 1，
 * 另加中点 -1.5dB 钟形余量防两曲强相关时叠加超限。
 *
 * 进度分段线性重映射（warp）：
 *   u ∈ [0, lead)     线性 0 → 0.5（进场曲逼近换手点）
 *   u ∈ [lead, trail] 恒 0.5（平台段，两曲同电平）
 *   u ∈ (trail, 1]    线性 0.5 → 1（出场曲彻底退出）
 * where lead = pivot·(1-held)，trail = pivot + (1-pivot)·held
 *
 * @param crossover 换手点在过渡中的位置（0.15~0.85，默认 0.5 居中）
 * @param together  平台段占过渡时长的比例（0~0.8，0 = 退化为普通等功率）
 * @param points    采样点数
 * @param volumeScale 音量缩放（0~1），与 applyEqualPowerCrossfade 同语义
 */
export interface TogetherCurves {
  out: Float32Array;
  in: Float32Array;
}

export function buildTogetherCurves(
  crossover = 0.5,
  together = 0,
  points = 128,
  volumeScale = 1
): TogetherCurves {
  const pivot = Math.min(0.85, Math.max(0.15, crossover));
  const held = Math.min(0.8, Math.max(0, together));
  const lead = pivot * (1 - held);
  const trail = pivot + (1 - pivot) * held;

  const out = new Float32Array(points);
  const inCurve = new Float32Array(points);
  const scale = Math.max(0, Math.min(1, volumeScale));
  for (let i = 0; i < points; i++) {
    const u = i / (points - 1);
    // warp：分段线性映射到等功率角度域
    const warped =
      u < lead ? (u / lead) * 0.5 : u <= trail ? 0.5 : 0.5 + ((u - trail) / (1 - trail)) * 0.5;
    const angle = warped * (Math.PI / 2);
    // 中点 -1.5dB 钟形余量（两端 0 中点 1），防平台期双满电平叠加
    const bell = Math.sin(Math.min(1, Math.max(0, u)) * Math.PI);
    const headroom = Math.pow(10, (-1.5 * bell) / 20);
    out[i] = Math.cos(angle) * headroom * scale;
    inCurve[i] = Math.sin(angle) * headroom * scale;
  }
  return { out, in: inCurve };
}

/** 按进度 u ∈ [0,1] 采样曲线（线性插值），mobile setInterval 路径用 */
export function sampleCurve(curve: Float32Array, u: number): number {
  const clamped = Math.min(1, Math.max(0, u));
  const pos = clamped * (curve.length - 1);
  const idx = Math.floor(pos);
  if (idx >= curve.length - 1) return curve[curve.length - 1];
  const frac = pos - idx;
  return curve[idx] * (1 - frac) + curve[idx + 1] * frac;
}

/**
 * 对两个 GainNode 应用 together 平台曲线交叉淡化
 * （buildTogetherCurves 的执行器，写法对齐 applyEqualPowerCrossfade）
 *
 * @returns 是否成功；曲线调度被引擎拒绝时返回 false 由调用方回退等功率
 */
export function applyTogetherCrossfade(
  _ctx: AudioContext,
  gainOut: GainNode,
  gainIn: GainNode,
  startTime: number,
  duration: number,
  curves: TogetherCurves,
  volumeScale: number = 1
): boolean {
  const scale = Math.max(0, Math.min(1, volumeScale));
  // 缩放不能改写曲线本体（mobile 路径复用同一 curves），复制后乘
  const outCurve = Float32Array.from(curves.out, (v) => v * scale);
  const inCurve = Float32Array.from(curves.in, (v) => v * scale);
  try {
    gainOut.gain.setValueAtTime(outCurve[0], startTime);
    gainIn.gain.setValueAtTime(inCurve[0], startTime);
    gainOut.gain.setValueCurveAtTime(outCurve, startTime, duration);
    gainIn.gain.setValueCurveAtTime(inCurve, startTime, duration);
    // 过渡结束后确保终值精确（平台曲线终值 = 0/1）
    gainOut.gain.setValueAtTime(0, startTime + duration + 0.001);
    gainIn.gain.setValueAtTime(scale, startTime + duration + 0.001);
    return true;
  } catch {
    return false;
  }
}

/**
 * 线性淡入淡出（简单备选，不等功率）
 * 总功率在中间会有凹陷（~3dB），但实现最简单
 */
export function applyLinearCrossfade(
  _ctx: AudioContext,
  gainOut: GainNode,
  gainIn: GainNode,
  startTime: number,
  duration: number
): void {
  gainOut.gain.setValueAtTime(1, startTime);
  gainIn.gain.setValueAtTime(0, startTime);

  gainOut.gain.linearRampToValueAtTime(0, startTime + duration);
  gainIn.gain.linearRampToValueAtTime(1, startTime + duration);
}
