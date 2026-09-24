/**
 * 鼓点检测器 (DrumDetector)
 *
 * 通过分析音频信号的频谱变化（spectral flux）和低频能量突变，
 * 实时检测鼓点（kick/snare）并估算 BPM。
 *
 * 原理:
 *   1. 频谱通量 (Spectral Flux): 相邻帧频谱的正向差异之和（低/中/高频段加权，
 *      压制密集镲片对通量的主导）
 *   2. 低频能量检测: 60~200Hz（kick drum）还原成线性幅度后取 RMS——
 *      字节频谱是 dB 压缩域，直接平均会把 +10dB 的底鼓压成 1.2 倍的假差异
 *   3. 自适应阈值: 时间窗 + 分位数基线（排除当前帧）——密集配器下低频长期
 *      贴顶时基线不会被自己的峰值抬高，Web 60fps 与安卓 20Hz 注入的时间常数也一致
 *   4. 抗贴顶: 分析链路串 12dB 衰减并把 maxDecibels 抬到 -10dBFS，
 *      密集混音的低频不再钉死在 255（见 connect）
 *   5. 冷却期: 防止同一个鼓点被重复检测
 *   6. BPM 估算: 统计鼓点间隔的中位数
 *
 * 用法:
 *   import { drumDetector } from '@/services/drumDetector';
 *   drumDetector.connect(audioContext, sourceNode);
 *   drumDetector.start();
 *   drumDetector.onBeat((info) => console.log('鼓点!', info.bpm));
 */

import { AdaptiveBaseline, weightedSpectralFlux } from '@/utils/audio/beatResponse';

/** AnalyserNode 字节域的下/上沿（dB）。上沿抬到 -10dBFS 给密集混音留动态余量 */
const ANALYSER_MIN_DB = -100;
const ANALYSER_MAX_DB = -10;
/** 分析专用衰减（≈-12dB）：只影响检测，不影响输出音量；判据全是相对倍率 */
const ANALYSIS_TRIM_GAIN = 0.25;
/** 通量基线地板：静音段底噪不该触发「突增」 */
const FLUX_BASELINE_FLOOR = 0.002;
/** 低频基线地板（线性 RMS 域） */
const KICK_BASELINE_FLOOR = 0.004;
/**
 * 低频通路饱和判定：基线 RMS 持续高于此值（安卓伪频谱 low 被 ×3 封顶后恒定）
 * 时，1.8× 倍率判据数学上不可达，直接禁用 kick 通路、只认通量兜底。
 */
const KICK_SATURATED_BASE = 0.6;
/** 线性 RMS → 对外 kickEnergy 的标定增益，保持与旧字节域观感连续（消费者都是 a + kick*b 的加成形式） */
const KICK_ENERGY_GAIN = 2.2;

/** 鼓点检测配置 */
export interface DrumDetectorConfig {
  /** FFT 大小，必须为 2 的幂，默认 1024 */
  fftSize?: number;
  /** 时间平滑常数 (0~1)，默认 0.3（较低值 = 更灵敏） */
  smoothingTimeConstant?: number;
  /** 频谱通量阈值倍数（超过滚动均值的倍数才触发），默认 1.5 */
  fluxThresholdMultiplier?: number;
  /** 低频能量阈值倍数，默认 1.8 */
  kickThresholdMultiplier?: number;
  /** 鼓点冷却时间（毫秒），防止重复检测，默认 100ms */
  cooldownMs?: number;
  /** 基线窗口时长（毫秒），默认 1500。用时间而不是帧数，两条数据路径的时间常数才一致 */
  baselineWindowMs?: number;
  /** 基线分位数（0~1），默认 0.75。高分位对孤立峰值不敏感 */
  baselinePercentile?: number;
  /** 基线样本数上限（防无界增长），默认 360（≈1.5s @240fps 的 2.4 倍余量） */
  rollingWindowSize?: number;
  /** 每 N 帧分析一次，默认 1（每帧都分析以保证精度） */
  analysisInterval?: number;
  /** BPM 估算的最小间隔（毫秒），默认 250（对应 240 BPM） */
  minBeatIntervalMs?: number;
  /** BPM 估算的最大间隔（毫秒），默认 1500（对应 40 BPM） */
  maxBeatIntervalMs?: number;
  /** BPM 平滑窗口大小（最近 N 个间隔），默认 12 */
  bpmWindowSize?: number;
}

/** 鼓点事件信息 */
export interface BeatInfo {
  /** 估算的 BPM */
  bpm: number;
  /** 当前频谱通量（频段加权，0~1） */
  flux: number;
  /** 低频能量（60~200Hz 线性 RMS × 标定增益，0~1） */
  kickEnergy: number;
  /** 是否为强拍（能量特别高） */
  isStrong: boolean;
  /** 当前时间戳 (ms) */
  timestamp: number;
}

/** 鼓点回调 */
export type BeatCallback = (info: BeatInfo) => void;

/**
 * DrumDetector 鼓点检测器
 */
class DrumDetector {
  // ==================== 公开状态 ====================

  /** 当前 BPM */
  public bpm = 0;

  /** 当前频谱通量 */
  public flux = 0;

  /** 当前低频能量 */
  public kickEnergy = 0;

  /** 是否正在检测 */
  public running = false;

  // ==================== 内部状态 ====================

  private context: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private upstreamNode: AudioNode | null = null;
  /** 分析专用衰减节点（仅串联在本检测器的 analyser 之前，不影响输出链路） */
  private trimGain: GainNode | null = null;

  /** 频域数据缓冲区 */
  private frequencyData: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  /** 上一帧的频域数据（用于计算频谱通量） */
  private prevFrequencyData: Float32Array = new Float32Array(0);

  /** 通量基线（时间窗 + 分位 + 排除当前帧） */
  private fluxBaseline = new AdaptiveBaseline();
  /** 低频能量基线 */
  private kickBaseline = new AdaptiveBaseline();
  /** 鼓点间隔历史（毫秒） */
  private beatIntervals: number[] = [];
  /** 上一次鼓点时间戳 */
  private lastBeatTime = 0;
  /** 上次冷却结束时间 */
  private cooldownEndTime = 0;

  private animationFrameId: number | null = null;
  private frameIndex = 0;

  private externalMode = false;
  private beatCallbacks: BeatCallback[] = [];

  private config: Required<DrumDetectorConfig>;

  constructor(config?: DrumDetectorConfig) {
    this.config = {
      fftSize: config?.fftSize ?? 1024,
      smoothingTimeConstant: config?.smoothingTimeConstant ?? 0.3,
      fluxThresholdMultiplier: config?.fluxThresholdMultiplier ?? 1.5,
      kickThresholdMultiplier: config?.kickThresholdMultiplier ?? 1.8,
      cooldownMs: config?.cooldownMs ?? 100,
      baselineWindowMs: config?.baselineWindowMs ?? 1500,
      baselinePercentile: config?.baselinePercentile ?? 0.75,
      rollingWindowSize: config?.rollingWindowSize ?? 360,
      analysisInterval: config?.analysisInterval ?? 1,
      minBeatIntervalMs: config?.minBeatIntervalMs ?? 250,
      maxBeatIntervalMs: config?.maxBeatIntervalMs ?? 1500,
      bpmWindowSize: config?.bpmWindowSize ?? 12
    };
    this.rebuildBaselines();
  }

  // ==================== 公共接口 ====================

  /**
   * 连接到音频图谱
   */
  public connect(audioContext: AudioContext, sourceNode: AudioNode): void {
    this.context = audioContext;
    this.upstreamNode = sourceNode;

    // 分析专用衰减：字节域原标定(-100~-30dB)在密集混音下低频贴顶，
    // 先降 12dB 再把 maxDecibels 抬到 -10dBFS，等效满刻度 ≈ +2dBFS，
    // 真实信号永不触顶；判据全是相对倍率，绝对电平下降不影响触发
    this.trimGain = audioContext.createGain();
    this.trimGain.gain.value = ANALYSIS_TRIM_GAIN;

    this.analyserNode = this.context.createAnalyser();
    this.analyserNode.fftSize = this.config.fftSize;
    this.analyserNode.smoothingTimeConstant = this.config.smoothingTimeConstant;
    this.analyserNode.minDecibels = ANALYSER_MIN_DB;
    this.analyserNode.maxDecibels = ANALYSER_MAX_DB;

    this.frequencyData = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.prevFrequencyData = new Float32Array(this.analyserNode.frequencyBinCount);

    this.upstreamNode.connect(this.trimGain);
    this.trimGain.connect(this.analyserNode);
  }

  /**
   * 断开连接
   */
  public disconnect(): void {
    this.stop();

    if (this.analyserNode && this.trimGain) {
      try {
        this.trimGain.disconnect(this.analyserNode);
      } catch {
        /* 忽略：节点已断开时可安全跳过 */
      }
    }
    if (this.upstreamNode && this.trimGain) {
      try {
        this.upstreamNode.disconnect(this.trimGain);
      } catch {
        /* 忽略：节点已断开时可安全跳过 */
      }
    }

    this.analyserNode = null;
    this.upstreamNode = null;
    this.trimGain = null;
    this.context = null;
  }

  /**
   * 启动检测
   */
  public start(): void {
    if (this.animationFrameId !== null) return;
    if (!this.analyserNode) {
      // 无 Web Audio 图(安卓原生注入模式)时回落外部模式,保证 stop 后可重启
      if (this.externalMode) {
        this.startExternal();
        return;
      }
      // 网页端流媒体直通路径(探测未通过/尚未建图)没有分析节点,静默待命即可,
      // 后续歌曲建图成功时会重新 connect+start
      console.debug('[DrumDetector] 未连接 Web Audio 图，待命中（建图后自动启动）');
      return;
    }

    this.startExternal();
    this.analysisLoop();
  }

  /**
   * 外部数据模式:无 Web Audio 图谱时(安卓原生 ExoPlayer)由
   * ingestBands() 按固定节奏喂数据,检测管线与 AnalyserNode 路径完全一致。
   */
  public startExternal(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.externalMode = true;
    this.running = true;
    this.frameIndex = 0;
    this.fluxBaseline.reset();
    this.kickBaseline.reset();
    this.beatIntervals = [];
    this.lastBeatTime = 0;
    this.cooldownEndTime = 0;
    this.bpm = 0;

    if (this.frequencyData.length === 0) {
      this.frequencyData = new Uint8Array(512);
      this.prevFrequencyData = new Float32Array(512);
    }
  }

  /**
   * 注入一帧外部频段数据(low/mid/high 均 0~1),可选原生精确 BPM 与原生 onset 强度。
   * 三频段合成伪频谱帧后走与 AnalyserNode 路径相同的通量/低频/鼓点判定；
   * 原生 onset（基于未饱和的原始低通幅度）存在时优先采信——伪频谱的 low 被
   * ×3 封顶后没有动态余量，JS 侧判据在密集配器下会失灵。
   */
  public ingestBands(
    bands: { low: number; mid: number; high: number },
    nativeBpm?: number,
    nativeBeat?: number
  ): void {
    if (!this.running || !this.externalMode) return;
    const data = this.frequencyData;
    if (data.length === 0) return;

    // 低频段占 bin 1~10、中频 11~120、高频 121~末尾(48kHz/FFT1024 量级),
    // 段内轻微梯度避免完全平坦导致通量恒为 0
    const fill = (from: number, to: number, level: number) => {
      const clamped = Math.max(0, Math.min(1, level));
      for (let i = from; i <= to; i++) {
        data[i] = Math.round(clamped * 255 * (0.8 + 0.2 * Math.abs(Math.sin(i * 1.7))));
      }
    };
    fill(1, Math.min(10, data.length - 1), bands.low);
    fill(11, Math.min(120, data.length - 1), bands.mid);
    fill(121, data.length - 1, bands.high);
    data[0] = data[1];

    this.processFrame(nativeBpm, nativeBeat);
  }

  /**
   * 停止检测
   *
   * 外部注入模式(安卓原生分析)是全局共享数据源:组件级「停止聆听」
   * 应退订自身 onBeat 回调,而不是杀掉喂数管线——这里只停
   * AnalyserNode 路径,外部模式保持运行,stop 后可经 start() 重启。
   */
  public stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (!this.externalMode) {
      this.running = false;
    }
  }

  /**
   * 注册鼓点回调
   * @returns 取消注册函数
   */
  public onBeat(callback: BeatCallback): () => void {
    this.beatCallbacks.push(callback);
    return () => {
      this.beatCallbacks = this.beatCallbacks.filter((cb) => cb !== callback);
    };
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<DrumDetectorConfig>): void {
    Object.assign(this.config, config);
    if (
      config.baselineWindowMs !== undefined ||
      config.baselinePercentile !== undefined ||
      config.rollingWindowSize !== undefined
    ) {
      this.rebuildBaselines();
    }
  }

  // ==================== 内部方法 ====================

  private analysisLoop = (): void => {
    this.animationFrameId = requestAnimationFrame(this.analysisLoop);

    this.frameIndex++;
    if (this.frameIndex % this.config.analysisInterval !== 0) return;
    if (!this.analyserNode) return;

    // 读取频域数据
    this.analyserNode.getByteFrequencyData(this.frequencyData);
    this.processFrame();
  };

  /** 通量/低频/鼓点判定核心:AnalyserNode 与外部注入两条路径共用 */
  private processFrame(nativeBpm?: number, nativeBeat?: number): void {
    // 计算频谱通量（频段加权）
    const spectralFlux = this.calculateSpectralFlux(this.frequencyData);

    // 计算低频能量 (kick drum: ~60-200Hz，线性 RMS)
    const kickEnergy = this.calculateKickEnergy(this.frequencyData);

    // 自适应基线：时间窗 + 分位 + 不含当前帧。
    // 密集配器下低频长期贴顶时基线不会被自己的峰值抬高；
    // 地板值防止静音段的底噪把「突增」判据轻松击穿。
    const now = performance.now();
    const fluxBase = Math.max(this.fluxBaseline.observe(now, spectralFlux), FLUX_BASELINE_FLOOR);
    const kickBaseRaw = this.kickBaseline.observe(now, kickEnergy);
    // 低频通路饱和（如安卓伪频谱 low 被 ×3 封顶后恒定）时基线恒在高位，
    // 倍率判据数学上不可达——置 Infinity 禁用 kick 通路，只认通量兜底
    const kickBase =
      kickBaseRaw > KICK_SATURATED_BASE ? Infinity : Math.max(kickBaseRaw, KICK_BASELINE_FLOOR);

    this.flux = spectralFlux;
    this.kickEnergy = kickEnergy;

    // 检测鼓点
    const nativeOnset = (nativeBeat ?? 0) > 0;
    const fluxSpike = spectralFlux > fluxBase * this.config.fluxThresholdMultiplier;
    const kickSpike = kickEnergy > kickBase * this.config.kickThresholdMultiplier;
    const cooldownOk = now >= this.cooldownEndTime;

    // 鼓点判定：原生 onset（安卓，基于未饱和的原始低通幅度）优先采信；
    // 否则频谱通量突增 AND (低频突增 OR 频谱通量特别强)
    const isBeat =
      cooldownOk && (nativeOnset || (fluxSpike && (kickSpike || spectralFlux > fluxBase * 2.5)));

    if (isBeat) {
      // 计算间隔（用于 BPM 估算）
      if (this.lastBeatTime > 0) {
        const interval = now - this.lastBeatTime;
        if (
          interval >= this.config.minBeatIntervalMs &&
          interval <= this.config.maxBeatIntervalMs
        ) {
          this.beatIntervals.push(interval);
          if (this.beatIntervals.length > this.config.bpmWindowSize) {
            this.beatIntervals.shift();
          }
          this.bpm = this.estimateBPM(this.beatIntervals);
        }
      }

      this.lastBeatTime = now;
      this.cooldownEndTime = now + this.config.cooldownMs;

      const isStrong = nativeOnset
        ? (nativeBeat as number) >= 2.2
        : kickEnergy > kickBase * 2.2 || spectralFlux > fluxBase * 3;

      const info: BeatInfo = {
        bpm: this.bpm,
        flux: spectralFlux,
        kickEnergy,
        isStrong,
        timestamp: now
      };

      this.beatCallbacks.forEach((cb) => {
        try {
          cb(info);
        } catch (e) {
          console.error('[DrumDetector] 回调出错:', e);
        }
      });
    }

    if (nativeBpm && nativeBpm > 0) {
      // 原生侧已算好 BPM(频域自相关,比间隔中位数稳),直接采用
      this.bpm = nativeBpm;
    }

    // 存储当前帧数据用于下一帧的频谱通量计算
    for (let i = 0; i < this.frequencyData.length; i++) {
      this.prevFrequencyData[i] = this.frequencyData[i];
    }
  }

  /**
   * 计算频谱通量 (Spectral Flux，频段加权)
   *
   * 公式: SF = Σ w[i]·max(0, X[n] - X[n-1]) / (Σw·255)
   * 只计算正向变化（能量增加），忽略衰减。低频段权重满、高频段压到 0.4，
   * 避免密集混音里镲片/嘶声的碎波动主导通量。
   */
  private calculateSpectralFlux(data: Uint8Array): number {
    if (data.length === 0) return 0;
    // 外部注入模式无 AudioContext，按 48kHz 量级折算 bin
    const sampleRate = this.context?.sampleRate ?? 48000;
    const binResolution = sampleRate / (data.length * 2);
    const lowEnd = Math.max(1, Math.floor(250 / binResolution));
    const midEnd = Math.min(data.length - 1, Math.ceil(4000 / binResolution));
    return weightedSpectralFlux(data, this.prevFrequencyData, { lowEnd, midEnd });
  }

  /**
   * 计算低频能量 (Kick Drum 频段，线性 RMS)
   *
   * Kick drum 的主要频率范围: 60~200Hz（bin 范围按采样率折算）。
   * 字节频谱是 dB 压缩域（minDb~maxDb 映射 0~255），直接平均会把 +10dB 的
   * 底鼓压成 1.2 倍的假差异、1.8× 倍率判据永远够不到；先还原线性幅度再取
   * 均方根，鼓点的 +8~15dB 才体现为 2.5~5 倍的能量跳变。
   * 输出乘 KICK_ENERGY_GAIN：保持与旧字节域观感连续（消费者都是 a + kick*b 的加成形式）。
   */
  private calculateKickEnergy(data: Uint8Array): number {
    // 外部注入模式无 AudioContext,按 48kHz 量级折算 bin
    const sampleRate = this.context?.sampleRate ?? 48000;
    if (data.length === 0) return 0;
    const binResolution = sampleRate / (data.length * 2); // 每个 bin 对应的 Hz
    const lowBin = Math.max(1, Math.floor(60 / binResolution));
    const highBin = Math.min(data.length - 1, Math.ceil(200 / binResolution));

    const dbSpan = ANALYSER_MAX_DB - ANALYSER_MIN_DB;
    let sumSquares = 0;
    let count = 0;
    for (let i = lowBin; i <= highBin; i++) {
      const db = (data[i] / 255) * dbSpan + ANALYSER_MIN_DB;
      const linear = 10 ** (db / 20);
      sumSquares += linear * linear;
      count++;
    }

    const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0;
    return Math.min(1, rms * KICK_ENERGY_GAIN);
  }

  /** 按当前配置重建基线实例（构造与 updateConfig 共用） */
  private rebuildBaselines(): void {
    this.fluxBaseline = new AdaptiveBaseline({
      windowMs: this.config.baselineWindowMs,
      percentile: this.config.baselinePercentile,
      maxSamples: this.config.rollingWindowSize
    });
    this.kickBaseline = new AdaptiveBaseline({
      windowMs: this.config.baselineWindowMs,
      percentile: this.config.baselinePercentile,
      maxSamples: this.config.rollingWindowSize
    });
  }

  /**
   * BPM 估算
   *
   * 使用最近 N 个鼓点间隔的中位数来估算 BPM，
   * 中位数比平均值更能抵抗异常值（偶发的漏检/误检）。
   */
  private estimateBPM(intervals: number[]): number {
    if (intervals.length < 2) return 0;

    // 取中位数
    const sorted = [...intervals].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const medianMs = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

    // ms → BPM
    return Math.round(60000 / medianMs);
  }

  /**
   * 获取三频段能量数据（供 Level 3 频域拼接和 UI 频谱可视化使用）
   *
   * 低频 (20-250Hz): 贝斯/底鼓
   * 中频 (250-4000Hz): 人声/旋律
   * 高频 (4000-20000Hz): 镲片/空气感
   */
  public getBandEnergies(): { low: number; mid: number; high: number } {
    if (this.frequencyData.length === 0) {
      return { low: 0, mid: 0, high: 0 };
    }

    const sampleRate = this.context?.sampleRate ?? 48000;
    const binResolution = sampleRate / (this.frequencyData.length * 2);

    const lowStart = Math.max(1, Math.floor(20 / binResolution));
    const lowEnd = Math.min(this.frequencyData.length - 1, Math.ceil(250 / binResolution));
    const midEnd = Math.min(this.frequencyData.length - 1, Math.ceil(4000 / binResolution));
    const highEnd = Math.min(this.frequencyData.length - 1, Math.ceil(20000 / binResolution));

    const avgRange = (start: number, end: number): number => {
      let sum = 0;
      let count = 0;
      for (let i = start; i <= end; i++) {
        sum += this.frequencyData[i];
        count++;
      }
      return count > 0 ? sum / count / 255 : 0;
    };

    return {
      low: avgRange(lowStart, lowEnd),
      mid: avgRange(lowEnd + 1, midEnd),
      high: avgRange(midEnd + 1, highEnd)
    };
  }
}

/** 全局单例 */
export const drumDetector = new DrumDetector({
  fftSize: 1024,
  smoothingTimeConstant: 0.3,
  fluxThresholdMultiplier: 1.5,
  kickThresholdMultiplier: 1.8,
  cooldownMs: 100,
  baselineWindowMs: 1500,
  baselinePercentile: 0.75,
  rollingWindowSize: 360,
  analysisInterval: 1,
  minBeatIntervalMs: 250,
  maxBeatIntervalMs: 1500,
  bpmWindowSize: 12
});

export default drumDetector;
