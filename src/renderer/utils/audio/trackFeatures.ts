/**
 * trackFeatures.ts — 歌曲首尾段特征检测（folia automix 移植）
 *
 * 接法选择器（transitionChooser）的证据来源。全部从 8kHz 单声道 PCM
 * （decodeToMono8k 输出）离线计算，阈值集中导出便于单测与调参。
 *
 * 证据语义与 folia transitionChooser 对齐：
 *   - introSilenceSec     新歌前导静音长度：beatCut 需要一个可等待的静音窗
 *   - startsHot           新歌开场即满能量（vs 渐入式 intro）
 *   - endsHot             当前曲末段仍在高电平（热收尾）；false = 自然衰减
 *   - outroSlopeDbPerSec  当前曲尾段 RMS 斜率：≤ -1.5 dB/s 视为自带淡出
 */

export interface IntroFeatures {
  /** 前导静音长度（秒），整段皆静音时等于分析窗全长 */
  introSilenceSec: number;
  /** 开场即满能量：前导静音结束后首个 0.5s 窗与后段参考窗的落差小于阈值 */
  startsHot: boolean;
}

export interface OutroFeatures {
  /** true = 末段仍在响（热收尾/截断）；false = 自然衰减 */
  endsHot: boolean;
  /** 尾段 RMS 斜率（dB/s，负 = 衰减），最小二乘回归 */
  outroSlopeDbPerSec: number;
}

export const TRACK_FEATURE_THRESHOLDS = {
  /** 分析帧长（秒） */
  frameSec: 0.05,
  /** 前导静音判定阈值（dBFS） */
  silenceDb: -50,
  /** 开场判定窗：前导静音结束后参与首个电平比较的窗长（秒） */
  introProbeSec: 0.5,
  /** startsHot 判定：开场窗比后段参考窗弱不超过该值（dB）即视为热开场 */
  hotFallbackDb: 6,
  /** 后段参考窗：首段分析窗内取末尾这段作能量参考（秒） */
  introReferenceSec: 4,
  /** endsHot 判定：末 0.5s 均值比斜率窗前半段均值衰减不超过该值视为仍在响（dB） */
  endsHotDb: 3,
  /** folia 阈值：尾段斜率 ≤ 该值视为自带制作淡出（dB/s） */
  selfFadeSlopeDbPerSec: -1.5,
  /** 智能接法开启时，outro 实时监测需要积累的最短历史（秒） */
  outroMonitorWindowSec: 15
} as const;

const MIN_ANALYZE_SEC = 2;

function frameRmsDb(pcm: Float32Array, start: number, frameLen: number): number {
  let sum = 0;
  const end = Math.min(pcm.length, start + frameLen);
  for (let i = start; i < end; i++) sum += pcm[i] * pcm[i];
  const rms = Math.sqrt(sum / Math.max(1, end - start));
  return 20 * Math.log10(Math.max(rms, 1e-6));
}

/** 帧级 dB 序列（50ms 一帧） */
function frameDbSeries(pcm: Float32Array, sampleRate: number): { db: number[]; frameLen: number } {
  const frameLen = Math.max(1, Math.round(TRACK_FEATURE_THRESHOLDS.frameSec * sampleRate));
  const db: number[] = [];
  for (let start = 0; start + frameLen <= pcm.length; start += frameLen) {
    db.push(frameRmsDb(pcm, start, frameLen));
  }
  return { db, frameLen };
}

/**
 * 首段特征：输入下一首歌头部 PCM（≤ 约 10s）。
 * 解码失败/数据过短时调用方应缓存 null（chooser 走 plainBlend 兜底）。
 */
export function analyzeIntro(pcm: Float32Array, sampleRate: number): IntroFeatures {
  const empty: IntroFeatures = { introSilenceSec: 0, startsHot: false };
  if (!pcm || pcm.length < Math.round(MIN_ANALYZE_SEC * sampleRate)) return empty;

  const { db } = frameDbSeries(pcm, sampleRate);
  if (db.length === 0) return empty;

  // 前导静音：从 0 起连续低于阈值的帧
  let introFrames = 0;
  while (introFrames < db.length && db[introFrames] < TRACK_FEATURE_THRESHOLDS.silenceDb) {
    introFrames++;
  }
  const introSilenceSec = introFrames * TRACK_FEATURE_THRESHOLDS.frameSec;

  // 整段皆静音：无「开场」可言，避免探测窗与参考窗比较时误判热开场
  if (introFrames >= db.length) {
    return { introSilenceSec, startsHot: false };
  }

  // 开场即热：开场探测窗 vs 后段参考窗（段内相对量，无需全曲参考）
  const th = TRACK_FEATURE_THRESHOLDS;
  const probeFrames = Math.max(1, Math.round(th.introProbeSec / th.frameSec));
  const refFrames = Math.max(1, Math.round(th.introReferenceSec / th.frameSec));
  const probeStart = Math.min(introFrames, Math.max(0, db.length - probeFrames));
  const refStart = Math.max(probeStart + 1, db.length - refFrames);

  let probeSum = 0;
  for (let i = probeStart; i < Math.min(db.length, probeStart + probeFrames); i++) {
    probeSum += Math.pow(10, db[i] / 10);
  }
  let refSum = 0;
  let refCount = 0;
  for (let i = refStart; i < db.length; i++) {
    refSum += Math.pow(10, db[i] / 10);
    refCount++;
  }
  const probeDb = 10 * Math.log10(Math.max(probeSum / probeFrames, 1e-12));
  const refDb = refCount > 0 ? 10 * Math.log10(Math.max(refSum / refCount, 1e-12)) : probeDb;

  return {
    introSilenceSec,
    startsHot: probeDb > refDb - th.hotFallbackDb
  };
}

/**
 * 尾段特征：输入当前曲尾部 PCM（≤ 约 30s）。
 * 实时监测路径（播放中电平历史）与离线路径共用本函数输出结构。
 */
export function analyzeOutro(pcm: Float32Array, sampleRate: number): OutroFeatures {
  const empty: OutroFeatures = { endsHot: true, outroSlopeDbPerSec: 0 };
  if (!pcm || pcm.length < Math.round(MIN_ANALYZE_SEC * sampleRate)) return empty;

  const { db } = frameDbSeries(pcm, sampleRate);
  if (db.length === 0) return empty;

  const th = TRACK_FEATURE_THRESHOLDS;
  // 斜率：最后 15s 的最小二乘回归
  const slopeFrames = Math.min(db.length, Math.round(15 / th.frameSec));
  const slopeStart = db.length - slopeFrames;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < slopeFrames; i++) {
    const x = i * th.frameSec;
    const y = db[slopeStart + i];
    sx += x;
    sy += y;
    sxx += x * x;
    sxy += x * y;
  }
  const denominator = slopeFrames * sxx - sx * sx;
  const outroSlopeDbPerSec =
    Math.abs(denominator) < 1e-9 ? 0 : (slopeFrames * sxy - sx * sy) / denominator;

  // endsHot：末 0.5s 与斜率窗前半段均值比较
  const tailFrames = Math.max(1, Math.round(0.5 / th.frameSec));
  const headFrames = Math.max(1, Math.round(slopeFrames / 2));
  let tailSum = 0;
  for (let i = db.length - tailFrames; i < db.length; i++) {
    tailSum += Math.pow(10, db[i] / 10);
  }
  let headSum = 0;
  for (let i = slopeStart; i < slopeStart + headFrames; i++) {
    headSum += Math.pow(10, db[i] / 10);
  }
  const tailDb = 10 * Math.log10(Math.max(tailSum / tailFrames, 1e-12));
  const headDb = 10 * Math.log10(Math.max(headSum / headFrames, 1e-12));

  return {
    endsHot: tailDb > headDb - th.endsHotDb,
    outroSlopeDbPerSec
  };
}

/**
 * 从实时 RMS 历史（{秒偏移, dB} 序列）构建尾段特征。
 * 用于播放中监测路径：当前曲的音频无法按帧 Range 取回（容器尾字节不可独立解码），
 * 改在播放中持续记录输出电平，触发前用最近窗口回归。
 * 样本间距不均（interval 抖动）时按时间加权意义近似为等距处理，误差可忽略。
 */
export function outroFeaturesFromHistory(
  historyDb: readonly number[],
  sampleIntervalSec: number
): OutroFeatures | null {
  const th = TRACK_FEATURE_THRESHOLDS;
  const needFrames = Math.round(th.outroMonitorWindowSec / sampleIntervalSec);
  if (historyDb.length < Math.max(8, Math.round(needFrames * 0.6))) return null;

  const slopeCount = Math.min(historyDb.length, Math.round(15 / sampleIntervalSec));
  const slopeStart = historyDb.length - slopeCount;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < slopeCount; i++) {
    const x = i * sampleIntervalSec;
    const y = historyDb[slopeStart + i];
    sx += x;
    sy += y;
    sxx += x * x;
    sxy += x * y;
  }
  const denominator = slopeCount * sxx - sx * sx;
  const outroSlopeDbPerSec =
    Math.abs(denominator) < 1e-9 ? 0 : (slopeCount * sxy - sx * sy) / denominator;

  const tailCount = Math.max(1, Math.round(2 / sampleIntervalSec));
  const headCount = Math.max(1, Math.round(slopeCount / 2));
  const avg = (from: number, count: number): number => {
    let sum = 0;
    let n = 0;
    for (let i = Math.max(0, from); i < Math.min(historyDb.length, from + count); i++) {
      sum += Math.pow(10, historyDb[i] / 10);
      n++;
    }
    return 10 * Math.log10(Math.max(sum / Math.max(1, n), 1e-12));
  };
  const tailDb = avg(historyDb.length - tailCount, tailCount);
  const headDb = avg(slopeStart, headCount);

  return {
    endsHot: tailDb > headDb - th.endsHotDb,
    outroSlopeDbPerSec
  };
}
