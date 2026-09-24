<template>
  <div ref="mountRef" class="mesh-gradient-bg" aria-hidden="true" />
</template>

<script setup lang="ts">
/**
 * MeshGradientBackground — 音频响应网格渐变背景
 *
 * 渲染器：@applemusic-like-lyrics/core 的 BackgroundRender + MeshGradientRenderer
 * （amll-dev/applemusic-like-lyrics, AGPL-3.0-only，与本项目协议一致）
 *
 * 驱动的骨架（冲击/稳态双分支 + 包络缓动）移植自 amll-player
 * （github.com/JoyElliot/amll-player, AGPL-3.0，作者 JoyElliot 授权使用第一方代码），
 * 但输入与量纲已重做：上游曲线的 0.35 绝对阈值按字节频谱标定，在其浮点 FFT
 * 管线里恒不成立，在密集配器下也会因低频贴顶失去动态余量。现状为双层驱动：
 *   1. 连续层（呼吸）：Web/Electron 建图成功时自建专用 AnalyserNode 挂在混音
 *      节点上（只读，不影响输出），取 40~120Hz 频带相对突出度（对分位基线）；
 *      安卓直通 / Web 直通时降级为三频段能量的相对量。
 *   2. 事件层（冲击）：drumDetector.onBeat 强弱拍触发脉冲，快起慢落。
 * 输出量纲对齐 core 的 ÷10 换算（setLowFreqVolume(1) ≈ 20% 缩放），
 * 不再是上游那条恒输出 ≈0.001、视觉上等于零的曲线。
 */
import { BackgroundRender, MeshGradientRenderer } from '@applemusic-like-lyrics/core';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { audioService } from '@/services/audioService';
import { drumDetector } from '@/services/drumDetector';
import { AdaptiveBaseline, AttackReleaseEnvelope } from '@/utils/audio/beatResponse';
import { shouldSkipMobilePlayerFrame } from '@/utils/mobilePlayerPerformance';

interface Props {
  /** 封面地址，作网格即呈现的色源纹理 */
  coverUrl?: string;
  /** 外部暂停（减弱动画 / 形变期）：停渲染 + 停读频谱 */
  paused?: boolean;
  /** 渲染帧率上限 */
  maxFps?: number;
  /** 渲染倍率：0.25–2，越低越省电 */
  renderScale?: number;
  /** 静态模式：画面静止，低频驱动不再引起变化 */
  staticMode?: boolean;
  /** 鼓点响应灵敏度 0–2，默认 1 */
  beatResponse?: number;
}

const props = withDefaults(defineProps<Props>(), {
  coverUrl: '',
  paused: false,
  maxFps: 60,
  renderScale: 1,
  staticMode: false,
  beatResponse: 1
});

const mountRef = ref<HTMLElement | null>(null);
let background: BackgroundRender<MeshGradientRenderer> | null = null;
let canvasEl: HTMLCanvasElement | null = null;
let intersectionObserver: IntersectionObserver | null = null;
let driverFrame = 0;
let driverLastAt = 0;
let visible = true;
let lastCoverUrl = '';

// ── 音频响应驱动常量 ──
/** 呼吸/脉冲合成权重：脉冲（可感知的节拍）为主，呼吸垫底避免完全静止 */
const BASE_WEIGHT = 0.35;
const PULSE_WEIGHT = 0.65;
const PULSE_STRONG = 0.9;
const PULSE_NORMAL = 0.5;
/** 脉冲峰值保持时长，之后进入释放段 */
const PULSE_HOLD_MS = 40;
/** 频带比基线高出这么多 dB 时呼吸打满 */
const PROMINENCE_FULL_DB = 9;
/** 输出上限：core 内部 ÷10，1.6 ≈ 32% 缩放峰值 */
const VOLUME_CEILING = 1.6;

// 连续层：40~120Hz 频带的 dB 均值对 1.2s 分位基线的突出度
let bandBaseline = new AdaptiveBaseline({ windowMs: 1200, percentile: 0.75 });
const bandEnvelope = new AttackReleaseEnvelope({ attackMs: 25, releaseMs: 140 });
// 降级路径（无自建 analyser）：三频段 low 的相对量，窗口放宽到 2s
const fallbackBaseline = new AdaptiveBaseline({ windowMs: 2000, percentile: 0.75 });
// 事件层：强弱拍脉冲，快起慢落
const pulseEnvelope = new AttackReleaseEnvelope({ attackMs: 20, releaseMs: 180 });
let pulseTarget = 0;
let pulseHoldUntil = 0;

// 自建分析节点（切歌会重建混音节点，用引用比对检测重挂）
let mixAnalyser: AnalyserNode | null = null;
let attachedMixNode: GainNode | null = null;
let floatSpectrum: Float32Array<ArrayBuffer> | null = null;
let unsubscribeBeat: (() => void) | null = null;
let frameCount = 0;

function beatSensitivity(): number {
  const value = Number(props.beatResponse);
  return Number.isFinite(value) ? Math.min(2, Math.max(0, value)) : 1;
}

function readLowBandEnergy(): number {
  try {
    const low = Number(audioService.getBandEnergies().low);
    return Number.isFinite(low) ? Math.min(1, Math.max(0, low)) : 0;
  } catch {
    return 0;
  }
}

/** 混音节点可能在切歌/建图时被重建，低频检查引用变化后重挂分析节点 */
function ensureAnalyser(): void {
  if (frameCount % 60 !== 0) return;
  const mixNode = audioService.getMixNode();
  if (mixNode === attachedMixNode) return;
  detachAnalyser();
  const ctx = audioService.getAudioContext();
  if (!ctx || !mixNode) return;
  try {
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    // 平滑压低，保住瞬态；dB 量程与 drumDetector 同标定（-100 ~ -10）
    analyser.smoothingTimeConstant = 0.15;
    analyser.minDecibels = -100;
    analyser.maxDecibels = -10;
    mixNode.connect(analyser);
    mixAnalyser = analyser;
    attachedMixNode = mixNode;
    floatSpectrum = new Float32Array(analyser.frequencyBinCount);
    bandBaseline.reset();
  } catch (error) {
    console.warn('[MeshGradientBackground] 自建分析节点失败，降级为频段相对量', error);
    mixAnalyser = null;
    attachedMixNode = null;
    floatSpectrum = null;
  }
}

function detachAnalyser(): void {
  if (mixAnalyser && attachedMixNode) {
    try {
      attachedMixNode.disconnect(mixAnalyser);
    } catch {
      /* 节点已断开时可安全跳过 */
    }
  }
  mixAnalyser = null;
  attachedMixNode = null;
  floatSpectrum = null;
}

/**
 * 连续层：返回呼吸分量（0.1~0.45）。
 * 用「相对突出度」而非绝对能量——密集配器把低频抬成新常态后，
 * 基线同步抬高，只有真正的冲击才贡献呼吸量。
 */
function readBaseLevel(now: number): number {
  if (mixAnalyser && floatSpectrum) {
    mixAnalyser.getFloatFrequencyData(floatSpectrum);
    const sampleRate = audioService.getAudioContext()?.sampleRate ?? 48000;
    const binHz = sampleRate / (floatSpectrum.length * 2);
    const lowBin = Math.max(1, Math.floor(40 / binHz));
    const highBin = Math.min(floatSpectrum.length - 1, Math.ceil(120 / binHz));
    let db = 0;
    let count = 0;
    for (let i = lowBin; i <= highBin; i++) {
      // 静音帧是 -Infinity，钳到量程外一点避免污染均值
      db += Math.max(-140, floatSpectrum[i]);
      count++;
    }
    db = count > 0 ? db / count : -140;
    const baselineDb = bandBaseline.observe(now, db);
    const prominence = Math.max(0, Math.min(1, (db - baselineDb) / PROMINENCE_FULL_DB));
    return 0.1 + prominence * 0.35;
  }

  // 降级：三频段 low 的相对量（安卓伪频谱/Web 直通时贴顶，绝对值无信息）
  const low = readLowBandEnergy();
  const baselineLow = fallbackBaseline.observe(now, low);
  const ratio =
    baselineLow > 0.05
      ? Math.max(0, Math.min(1, (low - baselineLow) / Math.max(0.1, baselineLow)))
      : 0;
  return 0.1 + ratio * 0.35;
}

function driverTick(now: number): void {
  if (!isDriving()) {
    driverFrame = 0;
    return;
  }
  driverFrame = requestAnimationFrame(driverTick);
  if (driverLastAt > 0 && shouldSkipMobilePlayerFrame(driverLastAt, now)) return;

  frameCount++;
  ensureAnalyser();

  if (now >= pulseHoldUntil) pulseTarget = 0;
  const pulse = pulseEnvelope.step(now, pulseTarget);
  const base = bandEnvelope.step(now, readBaseLevel(now));
  const volume = Math.min(
    VOLUME_CEILING,
    beatSensitivity() * (BASE_WEIGHT * base + PULSE_WEIGHT * pulse)
  );
  if (!Number.isFinite(volume)) return;
  background?.setLowFreqVolume(volume);
}

function isRunning(): boolean {
  return Boolean(background) && !props.paused && visible;
}

/** 静态模式下画面定格，频谱读取与事件脉冲也不再需要 */
function isDriving(): boolean {
  return isRunning() && !props.staticMode;
}

function startDriver(): void {
  if (driverFrame || !isDriving()) return;
  driverLastAt = 0;
  frameCount = 0;
  bandBaseline.reset();
  fallbackBaseline.reset();
  bandEnvelope.reset();
  pulseEnvelope.reset();
  pulseTarget = 0;
  driverFrame = requestAnimationFrame(driverTick);
}

function stopDriver(): void {
  if (driverFrame) cancelAnimationFrame(driverFrame);
  driverFrame = 0;
}

function syncRunState(): void {
  if (!background) return;
  if (isRunning()) {
    background.resume();
  } else {
    background.pause();
  }
  if (isDriving()) startDriver();
  else stopDriver();
}

function subscribeBeats(): void {
  if (unsubscribeBeat) return;
  // 无分析图时静默待命（Web 直通路径），建图成功后事件自然到来
  drumDetector.start();
  unsubscribeBeat = drumDetector.onBeat((info) => {
    pulseTarget = info.isStrong ? PULSE_STRONG : PULSE_NORMAL;
    pulseHoldUntil = performance.now() + PULSE_HOLD_MS;
  });
}

function unsubscribeFromBeats(): void {
  unsubscribeBeat?.();
  unsubscribeBeat = null;
}

function applyOptions(): void {
  if (!background) return;
  background.setFPS(props.maxFps);
  background.setRenderScale(props.renderScale);
  background.setStaticMode(props.staticMode);
}

async function syncCover(url: string): Promise<void> {
  if (!background || !url || url === lastCoverUrl) return;
  lastCoverUrl = url;
  try {
    await background.setAlbum(url);
  } catch (error) {
    // 跨域封面取不到时渲染器自行退回无封面渐变，这里只留一条线索
    console.warn('[MeshGradientBackground] 封面纹理加载失败', error);
  }
}

onMounted(() => {
  const container = mountRef.value;
  if (!container) return;
  try {
    background = BackgroundRender.new(MeshGradientRenderer);
    canvasEl = background.getElement();
    canvasEl.style.width = '100%';
    canvasEl.style.height = '100%';
    canvasEl.style.display = 'block';
    container.appendChild(canvasEl);
  } catch (error) {
    // WebGL 不可用（老设备 / 被限制）：静默降级为上层自有背景色
    console.warn('[MeshGradientBackground] WebGL 初始化失败，回退静态背景', error);
    background = null;
    canvasEl = null;
    return;
  }

  applyOptions();
  void syncCover(props.coverUrl);

  intersectionObserver = new IntersectionObserver(
    (entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      visible = entry.isIntersecting;
      syncRunState();
    },
    { threshold: 0 }
  );
  intersectionObserver.observe(container);

  subscribeBeats();
  syncRunState();
});

onBeforeUnmount(() => {
  stopDriver();
  unsubscribeFromBeats();
  intersectionObserver?.disconnect();
  intersectionObserver = null;
  detachAnalyser();
  lastCoverUrl = '';
  try {
    background?.dispose();
  } catch (error) {
    console.warn('[MeshGradientBackground] 释放失败', error);
  }
  canvasEl?.remove();
  background = null;
  canvasEl = null;
});

watch(
  () => props.paused,
  () => syncRunState()
);
watch(
  () => [props.maxFps, props.renderScale, props.staticMode] as const,
  () => {
    applyOptions();
    syncRunState();
  }
);
watch(
  () => props.coverUrl,
  (url) => void syncCover(url)
);
</script>

<style scoped>
.mesh-gradient-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
</style>
