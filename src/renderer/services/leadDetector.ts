/**
 * leadDetector — 主奏声部检测（太阳耀斑背景的「耀丝」信号源）。
 *
 * 「主奏」不预设音区：前奏贝斯 solo 时主奏在低频、全奏段主唱/lead 在中高频。
 * 判据三件套（全部为相对量，绝对电平无关）：
 *   1. 四带起音通量：带内谱通量（正跳变=新音符进入）减慢包络、除滚动中位数基线；
 *   2. 频谱熵判稀疏：低熵（编曲稀疏，solo/前奏）→ 允许主导带自由竞争；
 *      高熵（全奏）→ 固定中高频带（主唱/lead 先验）；
 *   3. 主导带竞争滞回：候选带需持续 ~1.5s 显著胜出才切换，防止频繁跳带。
 *
 * 输出 leadLevel（主导带活跃度 0~1）/ leadOnset（起音脉冲，衰减包络）/
 * leadBand（0=低频 1=中低 2=中高 3=高），消费端按带调制流体形态
 * （低频=大墨团慢卷，中高频=细丝撕裂）。
 *
 * 两条数据路径：
 *   - Web Audio（桌面/网页·本地文件）：connect(context, node) 自建 AnalyserNode
 *     （fft 2048，低频带才有足够 bin 做通量），rAF 限 30fps 读取；
 *   - 外部注入（安卓原生）：ingestLead(mid, high) 50ms 推送段均能，
 *     降级为两带竞争（无全谱熵，跳过稀疏门控）。
 */
import { drumDetector } from '@/services/drumDetector';

/* ==================== 带定义与纯函数（可单测） ==================== */

export interface LeadBandRange {
  name: string;
  startBin: number;
  endBin: number;
}

export const LEAD_BAND_COUNT = 4;

/** fft 2048 @ 48kHz → bin ≈ 11.72Hz，frequencyBinCount 1024 */
export function buildBandRanges(binHz: number, binCount: number): LeadBandRange[] {
  const range = (minHz: number, maxHz: number): LeadBandRange => ({
    name: '',
    startBin: Math.max(1, Math.floor(minHz / binHz)),
    endBin: Math.min(binCount, Math.ceil(maxHz / binHz))
  });
  return [
    { ...range(80, 250), name: 'low' },
    { ...range(250, 1200), name: 'lowmid' },
    { ...range(1200, 5500), name: 'lead' },
    { ...range(5500, 11000), name: 'air' }
  ];
}

/** 带内线性能量均值（密度而非总量，窄带低频与宽带中高可比） */
export function computeBandEnergies(specDb: Float32Array, ranges: LeadBandRange[]): Float32Array {
  const out = new Float32Array(ranges.length);
  for (let b = 0; b < ranges.length; b++) {
    const { startBin, endBin } = ranges[b];
    let sum = 0;
    let n = 0;
    for (let i = startBin; i < endBin; i++) {
      const db = Number.isFinite(specDb[i]) ? specDb[i] : -120;
      sum += Math.pow(10, db / 10);
      n++;
    }
    out[b] = n ? sum / n : 0;
  }
  return out;
}

/** 带内逐 bin 谱通量（线性域正跳变均值 = 新能量进入） */
export function computeBandFlux(
  prevLin: Float32Array,
  curLin: Float32Array,
  ranges: LeadBandRange[]
): Float32Array {
  const out = new Float32Array(ranges.length);
  for (let b = 0; b < ranges.length; b++) {
    const { startBin, endBin } = ranges[b];
    let sum = 0;
    let n = 0;
    for (let i = startBin; i < endBin; i++) {
      sum += Math.max(0, curLin[i] - prevLin[i]);
      n++;
    }
    out[b] = n ? sum / n : 0;
  }
  return out;
}

/** 频谱熵（归一化到 0~1，按 4 带均匀分布为 1）：低熵=能量集中=编曲稀疏 */
export function computeEntropy(bandEnergies: Float32Array): number {
  let total = 0;
  for (let i = 0; i < bandEnergies.length; i++) total += bandEnergies[i];
  if (total <= 1e-12) return 1;
  let h = 0;
  for (let i = 0; i < bandEnergies.length; i++) {
    const p = bandEnergies[i] / total;
    if (p > 1e-12) h -= p * Math.log(p);
  }
  return h / Math.log(bandEnergies.length);
}

export interface LeadFrame {
  /** 主导带 0=低频 1=中低 2=中高 3=高 */
  band: number;
  /** 主导带起音脉冲 0~1（触发置 1 后按 τ≈0.18s 衰减） */
  onset: number;
  /** 主导带活跃度 0~1（平滑） */
  level: number;
}

/**
 * 主导带跟踪器（纯 JS，无 Web Audio 依赖，可单测）。
 * feed(dt, flux[4], entropy) 逐帧推进，返回当前主奏帧。
 */
export class LeaderBandTracker {
  /** 熵低于此值视为编曲稀疏，允许主导带自由竞争 */
  private sparseEntropy: number;
  /** 切带所需的活动度优势倍率 */
  private switchRatio: number;
  /** 切带需持续胜出的时长（秒） */
  private switchHoldSec: number;
  /** 起音判定：通量超基线倍数 */
  private onsetRatio: number;

  private slowFlux = new Float32Array(LEAD_BAND_COUNT);
  private activity = new Float32Array(LEAD_BAND_COUNT);
  private medianBase = new Float32Array(LEAD_BAND_COUNT).fill(1e-9);
  private history: Float32Array[] = [];
  private historyLimit = 90; // ~3s @30fps
  private medianRecalcEvery = 15;
  private frameCount = 0;
  private band = 2;
  private candidateBand = 2;
  private candidateHold = 0;
  private onset = 0;
  private level = 0;

  constructor(opts?: {
    sparseEntropy?: number;
    switchRatio?: number;
    switchHoldSec?: number;
    onsetRatio?: number;
  }) {
    this.sparseEntropy = opts?.sparseEntropy ?? 0.75;
    this.switchRatio = opts?.switchRatio ?? 1.35;
    this.switchHoldSec = opts?.switchHoldSec ?? 1.5;
    this.onsetRatio = opts?.onsetRatio ?? 2.2;
  }

  /** 单测注入口：直接改写主导带（跳过滞回预热） */
  forceBand(band: number): void {
    this.band = band;
    this.candidateBand = band;
    this.candidateHold = 0;
  }

  /**
   * 逐帧推进。
   * energies = 各带线性能量（与 flux 同量纲来源），用于弱带压制：
   * 归一化通量对幅度不敏感（自适应基线的代价），若不加权，响度极低的
   * 微弱周期信号会与真正的主奏带平等竞争——按能量比开方加权后，
   * 只有能量上站得住的带才可能成为主导。
   */
  feed(dt: number, flux: Float32Array, entropy: number, energies: Float32Array): LeadFrame {
    const smooth = 1 - Math.exp(-Math.max(1e-4, dt) / 0.6);
    for (let b = 0; b < LEAD_BAND_COUNT; b++) {
      this.slowFlux[b] += (flux[b] - this.slowFlux[b]) * smooth;
    }

    // 滚动中位数基线（对偶发起音稳健）：环形历史，定期重算
    const snapshot = new Float32Array(flux);
    this.history.push(snapshot);
    if (this.history.length > this.historyLimit) this.history.shift();
    this.frameCount++;
    if (this.frameCount % this.medianRecalcEvery === 0) {
      for (let b = 0; b < LEAD_BAND_COUNT; b++) {
        const col = this.history.map((f) => f[b]).sort((x, y) => x - y);
        this.medianBase[b] = Math.max(1e-9, col[Math.floor(col.length / 2)]);
      }
    }

    // 归一通量（减慢包络、除中位数基线）。
    // 钳制上限：长期静默的带基线为 0，第一声会把 fluxNorm 推到天文数字
    // 独占 argmax；静默后起音本就是强 onset，钳到 30 与正常峰值同量级。
    // 再乘绝对能量权重 sqrt(E/maxE)：微弱周期信号不得与主奏带平等竞争
    let maxEnergy = 0;
    for (let b = 0; b < LEAD_BAND_COUNT; b++) {
      maxEnergy = Math.max(maxEnergy, energies[b]);
    }
    const fluxNorm = new Float32Array(LEAD_BAND_COUNT);
    for (let b = 0; b < LEAD_BAND_COUNT; b++) {
      const energyWeight = maxEnergy > 1e-12 ? Math.sqrt(energies[b] / maxEnergy) : 0;
      fluxNorm[b] = Math.min(
        30,
        Math.max(0, flux[b] - this.slowFlux[b]) / Math.max(this.medianBase[b], 1e-9)
      ) * energyWeight;
    }

    // 活动度（2s EMA）
    const actSmooth = 1 - Math.exp(-Math.max(1e-4, dt) / 2);
    for (let b = 0; b < LEAD_BAND_COUNT; b++) {
      this.activity[b] += (fluxNorm[b] - this.activity[b]) * actSmooth;
    }

    // 主导带决策：稀疏→自由竞争，否则固定中高频；滞回防抖
    let candidate = this.band;
    if (entropy < this.sparseEntropy) {
      let best = 0;
      for (let b = 1; b < LEAD_BAND_COUNT; b++) {
        if (this.activity[b] > this.activity[best]) best = b;
      }
      candidate = best;
    } else {
      candidate = 2;
    }
    if (candidate !== this.band) {
      if (candidate !== this.candidateBand) {
        this.candidateBand = candidate;
        this.candidateHold = 0;
      }
      this.candidateHold += dt;
      const dominant =
        this.activity[candidate] > this.activity[this.band] * this.switchRatio ||
        this.activity[this.band] < 1e-6;
      if (this.candidateHold >= this.switchHoldSec && dominant) {
        this.band = candidate;
        this.candidateHold = 0;
      }
    } else {
      this.candidateBand = this.band;
      this.candidateHold = 0;
    }

    // 起音脉冲（先衰减旧值再触发，触发帧返回 1）+ 活跃度
    this.onset = Math.max(0, this.onset - dt / 0.18);
    if (fluxNorm[this.band] > this.onsetRatio) this.onset = 1;
    const levelTarget = Math.min(1, fluxNorm[this.band] * 0.4);
    this.level += (levelTarget - this.level) * (1 - Math.exp(-Math.max(1e-4, dt) / 0.15));

    return { band: this.band, onset: this.onset, level: this.level };
  }
}

/* ==================== 检测器（Web Audio / 外部双路径） ==================== */

const FFT_SIZE = 2048;
const LOOP_FPS = 30;

class LeadDetector {
  private analyserNode: AnalyserNode | null = null;
  private upstreamNode: AudioNode | null = null;
  private specDb: Float32Array<ArrayBuffer> | null = null;
  private prevLin: Float32Array | null = null;
  private curLin: Float32Array | null = null;
  private ranges: LeadBandRange[] = [];
  private tracker = new LeaderBandTracker();
  private rafId: number | null = null;
  private lastTick = 0;
  private externalMode = false;
  private lastExternal: [number, number] = [0, 0];

  leadLevel = 0;
  leadOnset = 0;
  leadBand = 2;

  /** 挂到音频图谱（与 drumDetector 同源不同宿：各自的 AnalyserNode 标定独立） */
  connect(context: AudioContext, sourceNode: AudioNode): void {
    if (this.analyserNode && this.upstreamNode === sourceNode) return;
    this.disconnect();
    this.upstreamNode = sourceNode;
    this.analyserNode = context.createAnalyser();
    this.analyserNode.fftSize = FFT_SIZE;
    this.analyserNode.smoothingTimeConstant = 0.5;
    sourceNode.connect(this.analyserNode);
    const binCount = this.analyserNode.frequencyBinCount;
    this.specDb = new Float32Array(binCount);
    this.prevLin = new Float32Array(binCount);
    this.curLin = new Float32Array(binCount);
    this.ranges = buildBandRanges(context.sampleRate / FFT_SIZE, binCount);
  }

  disconnect(): void {
    this.stop();
    if (this.analyserNode && this.upstreamNode) {
      try {
        this.upstreamNode.disconnect(this.analyserNode);
      } catch {
        /* 节点已断开时可安全跳过 */
      }
    }
    this.analyserNode = null;
    this.upstreamNode = null;
  }

  start(): void {
    if (this.rafId !== null || !this.analyserNode || this.externalMode) return;
    this.lastTick = 0;
    this.rafId = requestAnimationFrame(this.loop);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private loop = (now: number): void => {
    this.rafId = requestAnimationFrame(this.loop);
    const minInterval = 1000 / LOOP_FPS;
    if (now - this.lastTick < minInterval - 1) return;
    const dt = this.lastTick > 0 ? Math.min(0.2, (now - this.lastTick) / 1000) : minInterval / 1000;
    this.lastTick = now;

    const analyser = this.analyserNode;
    if (!analyser || !this.specDb || !this.prevLin || !this.curLin || !this.ranges.length) return;
    analyser.getFloatFrequencyData(this.specDb);
    for (let i = 0; i < this.specDb.length; i++) {
      const db = Number.isFinite(this.specDb[i]) ? this.specDb[i] : -120;
      this.curLin[i] = Math.pow(10, Math.max(-120, db) / 10);
    }
    const flux = computeBandFlux(this.prevLin, this.curLin, this.ranges);
    const energies = computeBandEnergies(this.specDb, this.ranges);
    const entropy = computeEntropy(energies);
    this.prevLin.set(this.curLin);

    const frame = this.tracker.feed(dt, flux, entropy, energies);
    this.applyFrame(frame);
  };

  /** 安卓原生路径：50ms 推送 mid/high 段均能（0~1），降级为两带竞争 */
  startExternal(): void {
    this.externalMode = true;
    this.stop();
  }

  ingestLead(mid: number, high: number): void {
    if (!this.externalMode) return;
    const dt = 0.05;
    // 段均能正差分 → 伪四带通量（low 不可得置 0；lowmid 借 mid、lead/air 借 high）
    const dMid = Math.max(0, mid - this.lastExternal[0]) / dt;
    const dHigh = Math.max(0, high - this.lastExternal[1]) / dt;
    this.lastExternal = [mid, high];
    const flux = new Float32Array([0, dMid * 0.6, dHigh, dHigh * 0.4]);
    const energies = new Float32Array([0, mid, high, high * 0.5]);
    const frame = this.tracker.feed(dt, flux, computeEntropy(energies), energies);
    this.applyFrame(frame);
  }

  private applyFrame(frame: LeadFrame): void {
    this.leadBand = frame.band;
    this.leadOnset = frame.onset;
    this.leadLevel = frame.level;
  }

  snapshot(): LeadFrame {
    return { band: this.leadBand, onset: this.leadOnset, level: this.leadLevel };
  }
}

export const leadDetector = new LeadDetector();

/**
 * 收敛 audioService 多处重复的检测器挂接：drumDetector + leadDetector
 * 一起挂到同一源节点（Web Audio 一源多宿，各 AnalyserNode 标定独立）。
 */
export function connectAnalysisNodes(context: AudioContext, sourceNode: AudioNode): void {
  drumDetector.connect(context, sourceNode);
  leadDetector.connect(context, sourceNode);
  leadDetector.start();
}

export function disconnectAnalysisNodes(): void {
  leadDetector.disconnect();
  drumDetector.disconnect();
}
