/**
 * 歌曲结构分析纯函数（自动高潮定位的 DSP 核心，供 structureAnalyzer.worker 调用）。
 * 无 DOM/AudioContext 依赖，可在 Worker 与单测中运行。
 *
 * 算法（经典 MSA 简化版）：
 *   1. 帧特征：RMS 能量 + 12 维色度（FFT 后按音高类折叠）
 *   2. 新颖度曲线：棋盘核沿时间轴比较相邻两窗的色度相似度 → 段落边界
 *   3. 边界切段后做段描述子（均值色度 + 均值能量）聚类，
 *      副歌 = 重复次数多且能量高的重复段；无可靠重复时退化为持续高能量区间
 */

export interface Segment {
  start: number;
  end: number;
}

/** 帧特征：hopSec 间隔的能量与色度序列 */
export interface FrameFeatures {
  hopSec: number;
  energy: Float32Array;
  chroma: Float32Array[]; // 每帧 12 维（归一化到单位长度）
}

const PITCH_CLASSES = 12;

/* ==================== FFT（迭代 radix-2，供色度提取） ==================== */

/** 就地 FFT；长度必须是 2 的幂。输入实信号时调用方自行共轭对称省略（这里直接复数处理） */
export function fftInPlace(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  if (n <= 1 || (n & (n - 1)) !== 0) return;
  // 位反转置换
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  // 蝶形
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k];
        const ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

/* ==================== 帧特征提取 ==================== */

/**
 * 从 8kHz 单声道 PCM 提取帧特征。
 * windowSec/hopSec 以秒计；返回按时间排序的帧序列。
 */
export function computeFrameFeatures(
  pcm: Float32Array,
  sampleRate: number,
  windowSec = 1.0,
  hopSec = 0.5
): FrameFeatures {
  const windowSize = Math.round(windowSec * sampleRate);
  const hopSize = Math.max(1, Math.round(hopSec * sampleRate));
  const numFrames = Math.max(0, Math.floor((pcm.length - windowSize) / hopSize) + 1);
  const fftSize = 1 << Math.ceil(Math.log2(Math.max(2, windowSize)));
  const halfSpec = fftSize / 2;

  const energy = new Float32Array(numFrames);
  const chroma: Float32Array[] = [];
  const fftRe = new Float32Array(fftSize);
  const fftIm = new Float32Array(fftSize);
  // Hann 窗
  const hann = new Float32Array(windowSize);
  for (let i = 0; i < windowSize; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (windowSize - 1));

  for (let f = 0; f < numFrames; f++) {
    const start = f * hopSize;
    let sumSq = 0;
    for (let i = 0; i < windowSize; i++) {
      const s = pcm[start + i] * hann[i];
      fftRe[i] = s;
      fftIm[i] = 0;
      sumSq += s * s;
    }
    for (let i = windowSize; i < fftSize; i++) {
      fftRe[i] = 0;
      fftIm[i] = 0;
    }
    energy[f] = Math.sqrt(sumSq / windowSize);
    fftInPlace(fftRe, fftIm);

    // 色度：把 60Hz..4kHz 的谱线按音高类折叠
    const c = new Float32Array(PITCH_CLASSES);
    const minHz = 60;
    const maxHz = Math.min(4000, sampleRate / 2 - 100);
    const binHz = sampleRate / fftSize;
    const minBin = Math.max(1, Math.floor(minHz / binHz));
    const maxBin = Math.min(halfSpec - 1, Math.ceil(maxHz / binHz));
    for (let bin = minBin; bin <= maxBin; bin++) {
      const mag = Math.sqrt(fftRe[bin] * fftRe[bin] + fftIm[bin] * fftIm[bin]);
      const hz = bin * binHz;
      // MIDI 音高类：round(69 + 12*log2(hz/440)) mod 12
      const midi = 69 + 12 * Math.log2(hz / 440);
      const pc = ((Math.round(midi) % PITCH_CLASSES) + PITCH_CLASSES) % PITCH_CLASSES;
      c[pc] += mag;
    }
    // 归一化（零向量保持零）
    let norm = 0;
    for (let i = 0; i < PITCH_CLASSES; i++) norm += c[i] * c[i];
    norm = Math.sqrt(norm);
    if (norm > 1e-9) for (let i = 0; i < PITCH_CLASSES; i++) c[i] /= norm;
    chroma.push(c);
  }

  return { hopSec, energy, chroma };
}

/* ==================== 新颖度曲线（棋盘核，直接跨对角比较） ==================== */

/**
 * 新颖度[i] = 1 - cos(前窗均值色度, 后窗均值色度)，半窗长 L 帧。
 * 高峰处为音乐"换了段落"的位置。
 */
export function computeNovelty(features: FrameFeatures, halfWindowSec = 4): Float32Array {
  const { chroma, hopSec } = features;
  const n = chroma.length;
  const L = Math.max(2, Math.round(halfWindowSec / hopSec));
  const novelty = new Float32Array(n);
  // 滑动窗均值色度
  const prefix = new Float32Array((n + 1) * PITCH_CLASSES);
  for (let i = 0; i < n; i++) {
    const c = chroma[i];
    for (let k = 0; k < PITCH_CLASSES; k++) {
      prefix[(i + 1) * PITCH_CLASSES + k] = prefix[i * PITCH_CLASSES + k] + c[k];
    }
  }
  const windowMean = (lo: number, hi: number, out: Float32Array) => {
    const loC = Math.max(0, lo);
    const hiC = Math.min(n, hi);
    const count = Math.max(1, hiC - loC);
    for (let k = 0; k < PITCH_CLASSES; k++) {
      out[k] = (prefix[hiC * PITCH_CLASSES + k] - prefix[loC * PITCH_CLASSES + k]) / count;
    }
  };
  const a = new Float32Array(PITCH_CLASSES);
  const b = new Float32Array(PITCH_CLASSES);
  for (let i = 0; i < n; i++) {
    windowMean(i - L, i, a);
    windowMean(i, i + L, b);
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let k = 0; k < PITCH_CLASSES; k++) {
      dot += a[k] * b[k];
      na += a[k] * a[k];
      nb += b[k] * b[k];
    }
    novelty[i] = 1 - dot / Math.sqrt(Math.max(1e-9, na * nb));
  }
  return novelty;
}

/* ==================== 边界峰值挑选 ==================== */

/**
 * 从新颖度曲线挑边界（秒）：局部极大 + 绝对阈 + 最小间距。
 * 首尾（0 与 duration）不作为边界输出。
 */
export function pickBoundaries(
  novelty: Float32Array,
  hopSec: number,
  duration: number,
  minGapSec = 12
): number[] {
  const n = novelty.length;
  if (n < 3) return [];
  // 绝对阈：均值 + 0.8*标准差
  let mean = 0;
  for (let i = 0; i < n; i++) mean += novelty[i];
  mean /= n;
  let variance = 0;
  for (let i = 0; i < n; i++) variance += (novelty[i] - mean) ** 2;
  const std = Math.sqrt(variance / n);
  const threshold = mean + 0.8 * std;

  const peaks: { time: number; value: number }[] = [];
  for (let i = 1; i < n - 1; i++) {
    if (novelty[i] >= threshold && novelty[i] >= novelty[i - 1] && novelty[i] >= novelty[i + 1]) {
      peaks.push({ time: i * hopSec, value: novelty[i] });
    }
  }
  // 强度优先，贪心保留满足最小间距的峰
  peaks.sort((x, y) => y.value - x.value);
  const kept: number[] = [];
  const minGap = minGapSec;
  for (const peak of peaks) {
    if (peak.time < minGapSec * 0.5 || peak.time > duration - minGapSec * 0.5) continue;
    if (kept.every((t) => Math.abs(t - peak.time) >= minGap)) kept.push(peak.time);
  }
  kept.sort((x, y) => x - y);
  return kept;
}

/* ==================== 段描述子 / 聚类 / 副歌定位 ==================== */

export interface AnalysisResult {
  segments: Segment[];
  confidence: number;
}

function cosineSim(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / Math.sqrt(Math.max(1e-9, na * nb));
}

/**
 * 副歌定位（滞后自相似/重复周期法，对流行乐结构稳健）：
 * 1. 对候选滞后量 L（12s..min(100s, 半曲)）计算整曲色度帧的平移相似度
 *    sim(L) = mean_i cos(chroma[i], chroma[i+L])——副歌每轮周期重复会在
 *    其周期长度处形成相似度峰；
 * 2. 取峰值周期 L*，再沿时间轴计算局部平移相似度 localSim(t)（±2s 窗），
 *    localSim 高的时段即「互为重复」的区间对 (t, t+L*)；
 * 3. 每对取能量更高的一侧为副歌候选，合并相邻、钳制曲长；
 * 4. 无可靠重复 → 能量兜底（平滑能量最长的持续高能量区间）。
 */
export function selectChorusSegments(
  features: FrameFeatures,
  duration: number,
  options?: { minSegmentSec?: number; minLagSec?: number; maxLagSec?: number }
): AnalysisResult {
  const minSegmentSec = options?.minSegmentSec ?? 15;
  const { chroma, energy, hopSec } = features;
  const n = chroma.length;
  if (n < 8) return { segments: [], confidence: 0 };

  const minLag = Math.max(2, Math.round((options?.minLagSec ?? 12) / hopSec));
  const maxLag = Math.min(
    Math.round((options?.maxLagSec ?? 100) / hopSec),
    Math.floor(n / 2)
  );
  if (maxLag <= minLag) return { segments: [], confidence: 0 };

  // 1) 滞后相似度轮廓（步长 2 帧省一半计算）
  const lagScores = new Float32Array(maxLag + 1);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    let count = 0;
    for (let i = 0; i + lag < n; i += 2) {
      sum += cosineSim(chroma[i], chroma[i + lag]);
      count++;
    }
    lagScores[lag] = count ? sum / count : 0;
  }
  // 峰值周期（±1s 邻域内取最大，抑制相邻 lag 抖动）
  let bestLag = -1;
  let bestScore = -Infinity;
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    const smoothed =
      (lagScores[lag - 1] + lagScores[lag] * 2 + lagScores[lag + 1]) / 4;
    if (smoothed > bestScore) {
      bestScore = smoothed;
      bestLag = lag;
    }
  }
  if (bestLag < 0) return { segments: [], confidence: 0 };

  // 2) 局部平移相似度
  const localSim = new Float32Array(n);
  const halfWin = Math.max(2, Math.round(2 / hopSec));
  for (let i = 0; i < n; i++) {
    if (i + bestLag >= n) break;
    let sum = 0;
    let count = 0;
    for (let k = -halfWin; k <= halfWin; k++) {
      const j = i + k;
      if (j < 0 || j + bestLag >= n) continue;
      sum += cosineSim(chroma[j], chroma[j + bestLag]);
      count++;
    }
    localSim[i] = count ? sum / count : 0;
  }
  // 阈值：均值 + 0.6σ，且不低于绝对下限
  let mean = 0;
  for (let i = 0; i < n; i++) mean += localSim[i];
  mean /= n;
  let variance = 0;
  for (let i = 0; i < n; i++) variance += (localSim[i] - mean) ** 2;
  const std = Math.sqrt(variance / n);
  const threshold = Math.max(0.78, mean + 0.6 * std);

  // 3) 高相似时段成对出现 → 每对取能量更高的一侧
  const pairs: { a: Segment; b: Segment }[] = [];
  let runStart = -1;
  for (let i = 0; i <= n; i++) {
    const high = i < n && localSim[i] >= threshold;
    if (high && runStart < 0) runStart = i;
    if (!high && runStart >= 0) {
      const len = i - runStart;
      if (len >= Math.round(6 / hopSec)) {
        const a: Segment = { start: runStart * hopSec, end: i * hopSec };
        const b: Segment = { start: a.start + bestLag * hopSec, end: a.end + bestLag * hopSec };
        pairs.push({ a, b });
      }
      runStart = -1;
    }
  }
  // 尾段未闭合
  if (runStart >= 0 && n - runStart >= Math.round(6 / hopSec)) {
    const a: Segment = { start: runStart * hopSec, end: n * hopSec };
    const b: Segment = { start: a.start + bestLag * hopSec, end: a.end + bestLag * hopSec };
    pairs.push({ a, b });
  }

  const meanEnergyAt = (s: Segment): number => {
    const lo = Math.max(0, Math.floor(s.start / hopSec));
    const hi = Math.min(energy.length, Math.ceil(s.end / hopSec));
    let sum = 0;
    for (let i = lo; i < hi; i++) sum += energy[i];
    return sum / Math.max(1, hi - lo);
  };

  let candidates: Segment[] = [];
  let peakSim = 0;
  for (const { a, b } of pairs) {
    const aOk = a.start >= 0 && a.end <= duration && a.end - a.start >= minSegmentSec;
    const bOk = b.start >= 0 && b.end <= duration && b.end - b.start >= minSegmentSec;
    if (!aOk && !bOk) continue;
    const chosen = !aOk ? b : !bOk ? a : meanEnergyAt(a) >= meanEnergyAt(b) ? a : b;
    candidates.push(expandByEnergy({ start: chosen.start, end: chosen.end }, energy, hopSec, duration));
    // 置信度采样：该段内局部相似度峰值
    const lo = Math.max(0, Math.floor(chosen.start / hopSec));
    const hi = Math.min(n - 1, Math.ceil(chosen.end / hopSec));
    for (let i = lo; i <= hi; i++) peakSim = Math.max(peakSim, localSim[i]);
  }
  candidates = normalizeSegments(candidates, duration, minSegmentSec);

  if (candidates.length) {
    const globalEnergy = energy.reduce((s, v) => s + v, 0) / energy.length;
    const chorusEnergy =
      candidates.reduce((s, seg) => s + meanEnergyAt(seg), 0) / candidates.length;
    const energyMargin = Math.max(
      0,
      Math.min(1, (chorusEnergy - globalEnergy) / (globalEnergy + 1e-9))
    );
    const confidence = Math.max(0.2, Math.min(0.95, peakSim * 0.6 + energyMargin * 0.4));
    return { segments: candidates, confidence };
  }

  // 4) 能量兜底
  const fallback = findHighEnergyStretch(energy, hopSec, duration, minSegmentSec);
  return fallback
    ? { segments: [fallback], confidence: 0.3 }
    : { segments: [], confidence: 0 };
}

/**
 * 重复路径选中的段沿能量向外扩展：副歌的强重复"钩子"往往只有一部分帧
 * 超过局部相似阈值，但整个副歌块的能量都维持在高位——按平滑能量
 * （≥ 段均能×0.8 且 ≥ 全曲均值+0.3σ）向外走，允许 ≤3s 毛刺，单边最多 30s。
 */
function expandByEnergy(
  seg: Segment,
  energy: Float32Array,
  hopSec: number,
  duration: number
): Segment {
  const smoothSpan = Math.max(1, Math.round(3 / hopSec));
  const smooth = new Float32Array(energy.length);
  let running = 0;
  for (let i = 0; i < energy.length; i++) {
    running += energy[i];
    if (i >= smoothSpan) running -= energy[i - smoothSpan];
    smooth[i] = running / Math.min(i + 1, smoothSpan);
  }
  let mean = 0;
  for (let i = 0; i < smooth.length; i++) mean += smooth[i];
  mean /= smooth.length;
  let variance = 0;
  for (let i = 0; i < smooth.length; i++) variance += (smooth[i] - mean) ** 2;
  const std = Math.sqrt(variance / smooth.length);

  const segEnergy = (() => {
    const lo = Math.max(0, Math.floor(seg.start / hopSec));
    const hi = Math.min(energy.length, Math.ceil(seg.end / hopSec));
    let sum = 0;
    for (let i = lo; i < hi; i++) sum += energy[i];
    return sum / Math.max(1, hi - lo);
  })();
  const threshold = Math.max(segEnergy * 0.8, mean + 0.3 * std);
  const maxWalk = Math.round(30 / hopSec);
  const gapTolerance = Math.round(3 / hopSec);

  const expand = (dir: -1 | 1): number => {
    let idx = dir === -1 ? Math.floor(seg.start / hopSec) : Math.ceil(seg.end / hopSec);
    let gap = 0;
    let lastGood = idx;
    for (let step = 0; step < maxWalk; step++) {
      idx += dir;
      if (idx < 0 || idx >= energy.length) break;
      if (smooth[idx] >= threshold) {
        lastGood = idx;
        gap = 0;
      } else {
        gap++;
        if (gap > gapTolerance) break;
      }
    }
    return lastGood;
  };

  const loFrame = expand(-1);
  const hiFrame = expand(1);
  const result: Segment = {
    start: Math.max(0, Math.min(duration, loFrame * hopSec)),
    end: Math.max(0, Math.min(duration, (hiFrame + 1) * hopSec))
  };
  return result.end - result.start >= seg.end - seg.start ? result : seg;
}

/** 平滑能量曲线上最长的持续高能量区间（能量兜底） */
export function findHighEnergyStretch(
  energy: Float32Array,
  hopSec: number,
  duration: number,
  minSegmentSec: number
): Segment | null {
  if (!energy.length) return null;
  const smoothSpan = Math.max(1, Math.round(3 / hopSec));
  const smooth = new Float32Array(energy.length);
  let running = 0;
  for (let i = 0; i < energy.length; i++) {
    running += energy[i];
    if (i >= smoothSpan) running -= energy[i - smoothSpan];
    smooth[i] = running / Math.min(i + 1, smoothSpan);
  }
  let mean = 0;
  for (let i = 0; i < smooth.length; i++) mean += smooth[i];
  mean /= smooth.length;
  let variance = 0;
  for (let i = 0; i < smooth.length; i++) variance += (smooth[i] - mean) ** 2;
  const std = Math.sqrt(variance / smooth.length);
  const threshold = mean + 0.4 * std;

  // 最长连续超阈区间（允许 <2s 的毛刺缝合）
  let best: Segment | null = null;
  let start = -1;
  let gap = 0;
  const maxGap = Math.max(1, Math.round(2 / hopSec));
  for (let i = 0; i < smooth.length; i++) {
    if (smooth[i] >= threshold) {
      if (start < 0) start = i;
      gap = 0;
    } else if (start >= 0) {
      gap++;
      if (gap > maxGap) {
        const end = i - gap;
        if (!best || end - start > best.end - best.start) {
          best = { start: start * hopSec, end: end * hopSec };
        }
        start = -1;
        gap = 0;
      }
    }
  }
  if (start >= 0) {
    const end = Math.min(smooth.length - 1, Math.round(duration / hopSec));
    if (!best || end - start > best.end - best.start) {
      best = { start: start * hopSec, end: end * hopSec };
    }
  }
  if (!best) return null;
  // 钳制到曲长并保证最小段长
  best.end = Math.min(best.end, duration);
  best.start = Math.max(0, best.start);
  if (best.end - best.start < minSegmentSec) return null;
  return best;
}

/* ==================== 归一化 ==================== */

/** 截断到曲长、保证最小段长、合并相邻（间隔 < minSegmentSec*0.4）段 */
export function normalizeSegments(
  input: Segment[],
  duration: number,
  minSegmentSec = 15
): Segment[] {
  const sorted = [...input]
    .map((s) => ({
      start: Math.max(0, Math.min(duration, s.start)),
      end: Math.max(0, Math.min(duration, s.end))
    }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start);

  const merged: Segment[] = [];
  for (const seg of sorted) {
    const prev = merged[merged.length - 1];
    if (prev && seg.start - prev.end < minSegmentSec * 0.4) {
      prev.end = Math.max(prev.end, seg.end);
    } else {
      merged.push({ ...seg });
    }
  }
  const minLen = Math.min(minSegmentSec, duration / 4);
  return merged.filter((s) => s.end - s.start >= Math.min(8, minLen));
}
