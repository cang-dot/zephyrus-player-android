<template>
  <div ref="mountRef" class="mesh-gradient-bg" aria-hidden="true" />
</template>

<script setup lang="ts">
/**
 * MeshGradientBackground — 音频响应网格渐变背景
 *
 * 渲染器：@applemusic-like-lyrics/core 的 BackgroundRender + MeshGradientRenderer
 * （amll-dev/applemusic-like-lyrics, AGPL-3.0-only，与本项目协议一致）
 * 低频驱动曲线移植自 amll-player（github.com/JoyElliot/amll-player, AGPL-3.0）：
 * packages/player/src/components/LocalMusicContext/index.tsx 的 FFTToLowPassContext
 * （10 帧滑动窗口 + max²/min 迟滞 + 每毫秒 0.3% 缓动），信号源换成本项目
 * audioService.getBandEnergies().low —— 安卓原生注入与 Web/Electron 分析器统一，
 * 无分析数据时为 0，网格退回纯流动、不闪不抖。
 */
import { BackgroundRender, MeshGradientRenderer } from '@applemusic-like-lyrics/core';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { audioService } from '@/services/audioService';
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
  /** 静态模式：画面静止，只在必要时重绘 */
  staticMode?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  coverUrl: '',
  paused: false,
  maxFps: 60,
  renderScale: 1,
  staticMode: false
});

const mountRef = ref<HTMLElement | null>(null);
let background: BackgroundRender<MeshGradientRenderer> | null = null;
let canvasEl: HTMLCanvasElement | null = null;
let intersectionObserver: IntersectionObserver | null = null;
let driverFrame = 0;
let driverLastAt = 0;
let visible = true;
let lastCoverUrl = '';

// ── 低频驱动曲线（上游参数原样保留） ──
const GRADIENT_WINDOW = 10; // 滑动窗口帧数
const HIT_THRESHOLD = 0.35; // max² − min 超过该差值判为鼓点冲击
const EASE_PER_MS = 0.003; // 每毫秒缓动比例
// 上游把 FFT 原始幅度（量级可达数千）按 0.5*log10(a/255 + 1) 半对数压缩；
// 本项目信号源是 0–1 归一化频段能量（即已除以 255 的字节均值），
// 乘 255² 还原到同一幅度量级，压缩后的动态范围才与上游等价
const AMPLITUDE_RESTORE = 255 * 255;

const gradientWindow: number[] = [];
let lowFreqVolume = 0;

function amplitudeToLevel(energy: number): number {
  return 0.5 * Math.log10((energy * AMPLITUDE_RESTORE) / 255 + 1);
}

/** 窗口迟滞：返回本帧的目标音量（预热期返回 0） */
function resolveTargetVolume(level: number): number {
  gradientWindow.push(level);
  if (gradientWindow.length > GRADIENT_WINDOW) gradientWindow.shift();
  if (gradientWindow.length < GRADIENT_WINDOW) return 0;
  let max = 0;
  let min = 1;
  for (const value of gradientWindow) {
    if (value > max) max = value;
    if (value < min) min = value;
  }
  const squaredMax = max * max;
  return squaredMax - min > HIT_THRESHOLD ? squaredMax : min * 0.5 ** 2;
}

function readLowBandEnergy(): number {
  try {
    const low = Number(audioService.getBandEnergies().low);
    return Number.isFinite(low) ? Math.min(1, Math.max(0, low)) : 0;
  } catch {
    return 0;
  }
}

function driverTick(now: number): void {
  if (!isDriving()) {
    driverFrame = 0;
    return;
  }
  driverFrame = requestAnimationFrame(driverTick);
  if (driverLastAt > 0 && shouldSkipMobilePlayerFrame(driverLastAt, now)) return;

  const delta = driverLastAt > 0 ? now - driverLastAt : 16;
  driverLastAt = now;

  const target = resolveTargetVolume(amplitudeToLevel(readLowBandEnergy()));
  lowFreqVolume += (target - lowFreqVolume) * Math.min(1, EASE_PER_MS * delta);
  if (!Number.isFinite(lowFreqVolume)) lowFreqVolume = 0;
  background?.setLowFreqVolume(lowFreqVolume);
}

function isRunning(): boolean {
  return Boolean(background) && !props.paused && visible;
}

/** 静态模式下画面定格，频谱读取也不再需要 */
function isDriving(): boolean {
  return isRunning() && !props.staticMode;
}

function startDriver(): void {
  if (driverFrame || !isDriving()) return;
  driverLastAt = 0;
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

  syncRunState();
});

onBeforeUnmount(() => {
  stopDriver();
  intersectionObserver?.disconnect();
  intersectionObserver = null;
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
