/**
 * 歌曲结构分析纯函数（自动高潮定位的 DSP 核心，供 structureAnalyzer.worker 调用）。
 * 无 DOM/AudioContext 依赖，可在 Worker 与单测中运行。
 *
 * 算法（滞后自相似重复周期法）：
 *   1. 帧特征：RMS 能量 + 12 维色度（FFT 后按音高类折叠）
 *   2. 滞后相似度轮廓挑周期峰（最多 2 个周期）→ 局部平移相似度高的
 *      时段即「互为重复」的区间对
 *   3. 每对重复的两侧都收为副歌候选（副歌每遍出现都标注），
 *      经能量抑制、重叠去重、合并后输出
 *   4. 无可靠重复时退化为至多 2 个持续高能量区间
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
  for (let i = 0; i < windowSize; i++)
    hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (windowSize - 1));

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
 * 2. 挑选最多 2 个显著周期峰（支持双副歌结构），对每个周期沿时间轴计算
 *    局部平移相似度 localSim(t)（±2s 窗），localSim 高的时段即
 *    「互为重复」的区间对 (t, t+L)；
 * 3. 每对重复的两侧都作为副歌候选（副歌每遍出现都该被标注），
 *    经弱段抑制、跨周期重叠去重后合并相邻、钳制曲长；
 * 4. 无可靠重复 → 能量兜底（平滑能量最长的至多 2 个持续高能量区间）。
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
  const maxLag = Math.min(Math.round((options?.maxLagSec ?? 100) / hopSec), Math.floor(n / 2));
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
  // 平滑后挑周期峰：主峰之外保留次峰（支持一组以上重复结构）
  const smoothed = new Float32Array(maxLag + 1);
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    smoothed[lag] = (lagScores[lag - 1] + lagScores[lag] * 2 + lagScores[lag + 1]) / 4;
  }
  const lags = pickLagPeaks(smoothed, minLag, maxLag, hopSec);
  if (!lags.length) return { segments: [], confidence: 0 };

  const meanEnergyAt = (s: Segment): number => {
    const lo = Math.max(0, Math.floor(s.start / hopSec));
    const hi = Math.min(energy.length, Math.ceil(s.end / hopSec));
    let sum = 0;
    for (let i = lo; i < hi; i++) sum += energy[i];
    return sum / Math.max(1, hi - lo);
  };

  // 2) 每个周期独立计算局部平移相似度 → 高相似 run 成对
  let candidates: Segment[] = [];
  let peakSim = 0;
  for (const [index, lag] of lags.entries()) {
    const { pairs, runPeakSim } = collectRepeatPairs(chroma, n, lag, hopSec);
    // 次周期要求更高的 run 峰值：低分副周期是误检段的主要来源
    if (index > 0 && runPeakSim < 0.85) continue;
    peakSim = Math.max(peakSim, runPeakSim);
    // 3) 每对重复的两侧都收为候选（低能一侧稍后按能量抑制）
    for (const { a, b } of pairs) {
      const aOk = a.start >= 0 && a.end <= duration && a.end - a.start >= minSegmentSec;
      const bOk = b.start >= 0 && b.end <= duration && b.end - b.start >= minSegmentSec;
      if (aOk) candidates.push(expandByEnergy({ ...a }, energy, hopSec, duration));
      if (bOk) candidates.push(expandByEnergy({ ...b }, energy, hopSec, duration));
    }
  }

  // 弱段抑制：明显低于最强段的候选（如被误检的低能前奏重复）不标高潮
  if (candidates.length) {
    let bestEnergy = 0;
    for (const seg of candidates) bestEnergy = Math.max(bestEnergy, meanEnergyAt(seg));
    candidates = candidates.filter((seg) => meanEnergyAt(seg) >= bestEnergy * 0.6);
  }

  // 跨周期去重：起点不同但实质重叠的段只留能量高者
  candidates.sort((x, y) => x.start - y.start);
  const deduped: Segment[] = [];
  for (const seg of candidates) {
    const prev = deduped[deduped.length - 1];
    if (prev) {
      const overlap = Math.min(prev.end, seg.end) - Math.max(prev.start, seg.start);
      if (overlap > 0.5 * Math.min(prev.end - prev.start, seg.end - seg.start)) {
        if (meanEnergyAt(seg) > meanEnergyAt(prev)) deduped[deduped.length - 1] = seg;
        continue;
      }
    }
    deduped.push(seg);
  }
  candidates = normalizeSegments(deduped, duration, minSegmentSec);

  // 保险上限：病态输入下防止段数刷屏
  const MAX_SEGMENTS = 6;
  if (candidates.length > MAX_SEGMENTS) {
    candidates = candidates
      .sort((x, y) => meanEnergyAt(y) - meanEnergyAt(x))
      .slice(0, MAX_SEGMENTS)
      .sort((x, y) => x.start - y.start);
  }

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

  // 4) 能量兜底：无重复特征时取至多 2 个最长持续高能量区间
  const fallbacks = findHighEnergyStretches(energy, hopSec, duration, minSegmentSec, 2);
  return fallbacks.length
    ? { segments: fallbacks, confidence: 0.3 }
    : { segments: [], confidence: 0 };
}

/**
 * 从平滑滞后相似度轮廓挑周期峰：得分降序贪心，主峰之外仅收
 * 得分 ≥ 0.5×主峰的次峰（轮廓按全曲平均，副结构覆盖率低时得分被稀释，
 * 误检由每个周期独立的 0.78 局部相似度阈值兜住），峰间距 ≥ 10s，
 * 最多 2 个周期。
 */
function pickLagPeaks(
  smoothed: Float32Array,
  minLag: number,
  maxLag: number,
  hopSec: number
): number[] {
  const peaks: { lag: number; score: number }[] = [];
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    if (smoothed[lag] >= smoothed[lag - 1] && smoothed[lag] >= smoothed[lag + 1]) {
      peaks.push({ lag, score: smoothed[lag] });
    }
  }
  if (!peaks.length) return [];
  peaks.sort((x, y) => y.score - x.score);
  const topScore = peaks[0].score;
  const minSeparation = Math.max(1, Math.round(10 / hopSec));
  const selected: number[] = [];
  for (const peak of peaks) {
    if (selected.length >= 2) break;
    if (peak.score < topScore * 0.5) break;
    const farEnough = selected.every((s) => Math.abs(s - peak.lag) >= minSeparation);
    if (farEnough) selected.push(peak.lag);
  }
  return selected;
}

/** 单个周期的局部平移相似度 → 高相似 run 对应的重复区间对，及其峰值相似度 */
function collectRepeatPairs(
  chroma: Float32Array[],
  n: number,
  lag: number,
  hopSec: number
): { pairs: { a: Segment; b: Segment }[]; runPeakSim: number } {
  const localSim = new Float32Array(n);
  const halfWin = Math.max(2, Math.round(2 / hopSec));
  for (let i = 0; i < n; i++) {
    if (i + lag >= n) break;
    let sum = 0;
    let count = 0;
    for (let k = -halfWin; k <= halfWin; k++) {
      const j = i + k;
      if (j < 0 || j + lag >= n) continue;
      sum += cosineSim(chroma[j], chroma[j + lag]);
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

  const pairs: { a: Segment; b: Segment }[] = [];
  let runPeakSim = 0;
  let runStart = -1;
  const closeRun = (endExclusive: number) => {
    const len = endExclusive - runStart;
    if (len >= Math.round(6 / hopSec)) {
      const a: Segment = { start: runStart * hopSec, end: endExclusive * hopSec };
      const b: Segment = { start: a.start + lag * hopSec, end: a.end + lag * hopSec };
      pairs.push({ a, b });
      for (let i = runStart; i < endExclusive; i++) runPeakSim = Math.max(runPeakSim, localSim[i]);
    }
    runStart = -1;
  };
  for (let i = 0; i <= n; i++) {
    const high = i < n && localSim[i] >= threshold;
    if (high && runStart < 0) runStart = i;
    if (!high && runStart >= 0) closeRun(i);
  }
  return { pairs, runPeakSim };
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

/** 平滑能量曲线上最长的持续高能量区间（能量兜底，单段便捷封装） */
export function findHighEnergyStretch(
  energy: Float32Array,
  hopSec: number,
  duration: number,
  minSegmentSec: number
): Segment | null {
  const stretches = findHighEnergyStretches(energy, hopSec, duration, minSegmentSec, 1);
  return stretches.length ? stretches[0] : null;
}

/**
 * 平滑能量曲线上最长的至多 maxCount 个持续高能量区间（能量兜底）。
 * 按长度降序收录；与已收录段间隔不足 minSegmentSec 的近邻段丢弃（宁少勿碎）。
 */
export function findHighEnergyStretches(
  energy: Float32Array,
  hopSec: number,
  duration: number,
  minSegmentSec: number,
  maxCount = 2
): Segment[] {
  if (!energy.length) return [];
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

  // 连续超阈区间（允许 <2s 的毛刺缝合）
  const raw: Segment[] = [];
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
        raw.push({ start: start * hopSec, end: (i - gap) * hopSec });
        start = -1;
        gap = 0;
      }
    }
  }
  if (start >= 0) {
    raw.push({
      start: start * hopSec,
      end: Math.min(smooth.length - 1, Math.round(duration / hopSec)) * hopSec
    });
  }

  const valid = raw
    .map((s) => ({ start: Math.max(0, s.start), end: Math.min(duration, s.end) }))
    .filter((s) => s.end - s.start >= minSegmentSec)
    .sort((a, b) => b.end - b.start - (a.end - a.start));

  const kept: Segment[] = [];
  for (const seg of valid) {
    if (kept.length >= maxCount) break;
    // 与已收录段同为互斥区间，只算间隙；间隙不足 minSegmentSec 的近邻丢弃
    const tooClose = kept.some((k) =>
      seg.start >= k.end ? seg.start - k.end < minSegmentSec : k.start - seg.end < minSegmentSec
    );
    if (!tooClose) kept.push({ ...seg });
  }
  return kept.sort((a, b) => a.start - b.start);
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
