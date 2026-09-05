<template>
  <div
    class="star-chart-backdrop"
    :class="{ 'is-playing': isPlaying, 'is-climax': styleEngine.isInClimax }"
    :style="{ '--accent-color-rgb': accentColorRgb }"
  >
    <div class="chart-rotor" aria-hidden="true" :style="rotorStyle">
      <canvas ref="chartCanvas" class="chart-canvas" />
      <div class="vinyl-rings" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { playMusic } from '@/hooks/MusicHook';
import { useCoverColor } from '@/hooks/useCoverColor';
import { climaxDetector } from '@/services/climaxDetector';
import { usePlayerStore } from '@/store/modules/player';
import { useStyleEngineStore } from '@/store/modules/styleEngine';
import { shouldSkipMobilePlayerFrame } from '@/utils/mobilePlayerPerformance';
import { acquirePlayerResource } from '@/utils/playerResourceDiagnostics';

/**
 * 封面点阵星盘背景预设
 *
 * 抽取自 StarChartPlayer.vue 的 chart-shell/chart-rotor 层：
 * - 封面 144px 居中采样 → 圆盘点阵（drawImageDots）
 * - 无封面时按曲名 hash 伪随机生成 fallback 点阵（drawFallback）
 * - chart-rotor 28s 线性旋转（播放中才转动，与原版一致）
 * - drawPoints 以 climaxDetector.getFrequencySnapshot(64) 频谱驱动点半径，
 *   叠加 styleEngine.energyLevel 能量增益
 * - is-climax 根类：canvas 提亮（saturate(1) / brightness(1.12)）
 * 背景铺满父容器，星盘居中放大出血（直径 = 容器短边 × 1.25）。
 */

interface StarChartBackdropParams {
  /** 预留参数位（当前无可调参数），保持与其它背景预设的统一 props 接口 */
  [key: string]: unknown;
}

// 与其它背景预设统一声明 params（noUnusedLocals：脚本内未读取时不绑定）
defineProps({
  params: { type: Object as PropType<StarChartBackdropParams>, default: () => ({}) }
});

const playerStore = usePlayerStore();
const styleEngine = useStyleEngineStore();
const { primaryColorRgb } = useCoverColor();

const rootRef = ref<HTMLElement | null>(null);
const chartCanvas = ref<HTMLCanvasElement | null>(null);

const isPlaying = computed(() => playerStore.isPlay);
const accentColorRgb = computed(() => primaryColorRgb.value || '160, 160, 160');
const songTitle = computed(() => playMusic.value?.name || 'Zephyrus');
const coverUrl = computed(
  () => playMusic.value?.picUrl || playMusic.value?.al?.picUrl || '/images/default_cover.png'
);

// ==================== 容器测量与星盘尺寸 ====================

const containerW = ref(0);
const containerH = ref(0);
const DISC_SCALE = 1.25;

const discSize = computed(() => {
  const w = containerW.value;
  const h = containerH.value;
  if (!w || !h) return 0;
  return Math.round(Math.min(w, h) * DISC_SCALE);
});

const rotorStyle = computed(() =>
  discSize.value ? { width: `${discSize.value}px`, height: `${discSize.value}px` } : {}
);

// ==================== 点阵数据（搬移自 StarChartPlayer.vue） ====================

interface ChartPoint {
  x: number;
  y: number;
  radius: number;
  radialPosition: number;
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

const chartPoints: ChartPoint[] = [];
let chartSize = 0;
let renderVersion = 0;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (/^https?:/i.test(url)) image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** 无封面 fallback：hash 伪随机点阵 */
function drawFallback(size: number, seedText: string): ChartPoint[] {
  const points: ChartPoint[] = [];
  const radius = size * 0.48;
  const center = size / 2;
  const gap = Math.max(6, size / 48);
  const seed = hashText(seedText);

  for (let y = gap / 2; y < size; y += gap) {
    for (let x = gap / 2; x < size; x += gap) {
      const distance = Math.hypot(x - center, y - center);
      if (distance > radius) continue;
      const noise = Math.abs(Math.sin((x * 12.9898 + y * 78.233 + seed) * 0.01));
      const wave = (Math.sin(distance * 0.08 + seed * 0.001) + 1) / 2;
      const dotRadius = 0.45 + noise * wave * gap * 0.34;
      points.push({
        x,
        y,
        radius: dotRadius,
        radialPosition: Math.min(1, distance / radius),
        red: 210,
        green: 210,
        blue: 210,
        alpha: 0.24 + noise * 0.6
      });
    }
  }
  return points;
}

/** 封面 144px 采样转圆盘点阵 */
function drawImageDots(size: number, image: HTMLImageElement): ChartPoint[] {
  const points: ChartPoint[] = [];
  const sampleCanvas = document.createElement('canvas');
  const sampleSize = 144;
  sampleCanvas.width = sampleSize;
  sampleCanvas.height = sampleSize;
  const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true });
  if (!sampleContext) throw new Error('Canvas context unavailable');

  const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = (image.naturalWidth - sourceSize) / 2;
  const sourceY = (image.naturalHeight - sourceSize) / 2;
  sampleContext.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    sampleSize,
    sampleSize
  );
  const pixels = sampleContext.getImageData(0, 0, sampleSize, sampleSize).data;
  const radius = size * 0.48;
  const center = size / 2;
  const gap = Math.max(5.5, size / 52);

  for (let y = gap / 2; y < size; y += gap) {
    for (let x = gap / 2; x < size; x += gap) {
      if (Math.hypot(x - center, y - center) > radius) continue;
      const sampleX = Math.min(sampleSize - 1, Math.floor((x / size) * sampleSize));
      const sampleY = Math.min(sampleSize - 1, Math.floor((y / size) * sampleSize));
      const offset = (sampleY * sampleSize + sampleX) * 4;
      const red = pixels[offset];
      const green = pixels[offset + 1];
      const blue = pixels[offset + 2];
      const alpha = pixels[offset + 3] / 255;
      const luminance = (red * 0.299 + green * 0.587 + blue * 0.114) / 255;
      const dotRadius = 0.4 + Math.pow(luminance, 1.25) * gap * 0.42;

      points.push({
        x,
        y,
        radius: dotRadius,
        radialPosition: Math.min(1, Math.hypot(x - center, y - center) / radius),
        red: Math.max(48, red),
        green: Math.max(48, green),
        blue: Math.max(48, blue),
        alpha: Math.max(0.2, alpha * (0.35 + luminance * 0.65))
      });
    }
  }
  return points;
}

/** 频谱驱动点半径：点阵由内向外映射为高频到低频 */
function drawPoints(context: CanvasRenderingContext2D, size: number, points: ChartPoint[]) {
  const spectrum = climaxDetector.getFrequencySnapshot(64);
  const energy = Math.min(1, Math.max(0, styleEngine.energyLevel / 2));
  const fallbackPulse = (Math.sin(performance.now() * 0.004) + 1) / 2;

  context.clearRect(0, 0, size, size);
  for (const point of points) {
    const frequencyPosition = 1 - point.radialPosition;
    const spectrumIndex = Math.min(
      spectrum.length - 1,
      Math.max(0, Math.round(frequencyPosition * (spectrum.length - 1)))
    );
    const amplitude = spectrum.length ? spectrum[spectrumIndex] : fallbackPulse * 0.12;
    const dotRadius = point.radius * (1 + amplitude * (0.72 + energy * 0.48));

    context.fillStyle = `rgba(${point.red}, ${point.green}, ${point.blue}, ${point.alpha})`;
    context.beginPath();
    context.arc(point.x, point.y, dotRadius, 0, Math.PI * 2);
    context.fill();
  }
}

// ==================== 渲染与频谱循环 ====================

let spectrumFrameId: number | null = null;
let releaseCanvasLoop: (() => void) | null = null;
let lastSpectrumRenderAt = 0;
let pageVisible = !document.hidden;

async function renderChart() {
  const canvas = chartCanvas.value;
  const size = discSize.value;
  if (!canvas || !size) return;

  const version = ++renderVersion;
  const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(size * pixelRatio);
  canvas.height = Math.round(size * pixelRatio);
  const context = canvas.getContext('2d');
  if (!context) return;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  chartSize = size;
  chartPoints.length = 0;

  try {
    const image = await loadImage(coverUrl.value);
    if (version !== renderVersion) return;
    chartPoints.push(...drawImageDots(size, image));
  } catch {
    if (version !== renderVersion) return;
    chartPoints.push(...drawFallback(size, `${songTitle.value}:${coverUrl.value}`));
  }

  drawPoints(context, chartSize, chartPoints);
  startSpectrumLoop();
}

function stopSpectrumLoop() {
  if (spectrumFrameId !== null) {
    cancelAnimationFrame(spectrumFrameId);
    spectrumFrameId = null;
  }
  releaseCanvasLoop?.();
  releaseCanvasLoop = null;
}

function renderSpectrumFrame() {
  const canvas = chartCanvas.value;
  if (!canvas || !chartPoints.length || !pageVisible) {
    stopSpectrumLoop();
    return;
  }

  const now = performance.now();
  if (shouldSkipMobilePlayerFrame(lastSpectrumRenderAt, now)) {
    spectrumFrameId = requestAnimationFrame(renderSpectrumFrame);
    return;
  }
  lastSpectrumRenderAt = now;

  const context = canvas.getContext('2d');
  if (context) drawPoints(context, chartSize, chartPoints);
  spectrumFrameId = requestAnimationFrame(renderSpectrumFrame);
}

function startSpectrumLoop() {
  stopSpectrumLoop();
  if (!pageVisible) return;
  releaseCanvasLoop = acquirePlayerResource('canvas-loop');
  spectrumFrameId = requestAnimationFrame(renderSpectrumFrame);
}

function handlePageVisibility() {
  pageVisible = !document.hidden;
  if (pageVisible) startSpectrumLoop();
  else stopSpectrumLoop();
}

// ==================== 生命周期与响应 ====================

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  styleEngine.syncFromPlayerStore();
  styleEngine.syncCoverColors();
  if (rootRef.value) {
    containerW.value = rootRef.value.clientWidth;
    containerH.value = rootRef.value.clientHeight;
    resizeObserver = new ResizeObserver(() => {
      if (!rootRef.value) return;
      containerW.value = rootRef.value.clientWidth;
      containerH.value = rootRef.value.clientHeight;
    });
    resizeObserver.observe(rootRef.value);
  }
  document.addEventListener('visibilitychange', handlePageVisibility);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  stopSpectrumLoop();
  renderVersion++;
  document.removeEventListener('visibilitychange', handlePageVisibility);
});

// 封面 / 星盘尺寸变化：重建点阵
watch([coverUrl, discSize], async () => {
  await nextTick();
  renderChart();
});
</script>

<style lang="scss" scoped>
.star-chart-backdrop {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: #050505;
  isolation: isolate;
}

.chart-rotor {
  position: relative;
  border-radius: 50%;
  overflow: hidden;
  animation: star-chart-spin 28s linear infinite;
  animation-play-state: paused;
  will-change: transform;
}

.is-playing .chart-rotor {
  animation-play-state: running;
}

.chart-canvas {
  width: 100%;
  height: 100%;
  display: block;
  opacity: 0.9;
  filter: saturate(0.72) brightness(0.88);
  transition:
    opacity 420ms var(--m-ease-out, ease-out),
    filter 420ms var(--m-ease-out, ease-out);
}

/* 高潮提亮（原版 is-climax 逻辑） */
.is-climax .chart-canvas {
  opacity: 1;
  filter: saturate(1) brightness(1.12);
}

.vinyl-rings {
  position: absolute;
  inset: 2.2%;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    inset 0 0 0 12px rgba(0, 0, 0, 0.1),
    inset 0 0 42px rgba(0, 0, 0, 0.48),
    0 0 36px rgba(var(--accent-color-rgb), 0.12);
  transition: box-shadow 420ms var(--m-ease-out, ease-out);
}

.is-climax .vinyl-rings {
  box-shadow:
    inset 0 0 0 12px rgba(0, 0, 0, 0.08),
    inset 0 0 42px rgba(0, 0, 0, 0.36),
    0 0 52px rgba(var(--accent-color-rgb), 0.24);
}

@keyframes star-chart-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .chart-rotor {
    animation: none;
  }
}
</style>
