<template>
  <teleport to="body">
    <transition name="star-chart-page">
      <div
        v-if="isVisible"
        class="star-chart-player player-style-surface"
        :class="{
          'player-style-customized': isCustom,
          'player-style-custom-background': customBackgroundActive
        }"
        :style="{
          ...styleVars,
          '--accent-color': accentColor,
          '--accent-color-rgb': accentColorRgb
        }"
        @click="handleTapToggle"
        @touchstart="onSwipeCloseTouchStart"
        @touchend="onSwipeCloseTouchEnd"
      >
        <transition name="star-chart-header">
          <header v-show="controlsVisible" class="song-header">
            <p class="song-title">{{ songTitle }}</p>
            <p class="song-artist">{{ artistText }}</p>
          </header>
        </transition>

        <transition name="star-chart-controls">
          <div v-show="controlsVisible" class="top-controls no-toggle">
            <button type="button" class="icon-button" aria-label="关闭播放器" @click="close">
              <i class="ri-arrow-down-s-line" />
            </button>
            <button
              type="button"
              class="icon-button"
              aria-label="播放器设置"
              @click="showPlayerSettings = true"
            >
              <i class="ri-more-2-fill" />
            </button>
          </div>
        </transition>

        <transition name="star-chart-chart">
          <main
            v-if="!showFullLyrics"
            ref="chartFrame"
            class="chart-shell"
            :class="{ 'is-playing': isPlaying, 'is-climax': styleEngine.isInClimax }"
          >
            <div class="chart-rotor" aria-hidden="true">
              <canvas ref="chartCanvas" class="chart-canvas" />
              <div class="vinyl-rings" />
            </div>

            <transition name="star-chart-content" mode="out-in">
              <button
                :key="nowIndex"
                type="button"
                class="lyric-focus no-toggle"
                aria-label="打开滚动歌词"
                @click.stop="showFullLyrics = true"
              >
                <span class="lyric-main">{{ currentLyricText }}</span>
                <span v-if="currentTranslation" class="lyric-translation">
                  {{ currentTranslation }}
                </span>
              </button>
            </transition>
          </main>
        </transition>

        <transition name="star-chart-content">
          <button
            v-if="!showFullLyrics"
            type="button"
            class="landscape-lyric no-toggle"
            aria-label="打开滚动歌词"
            @click.stop="showFullLyrics = true"
          >
            <span class="lyric-main">{{ currentLyricText }}</span>
            <span v-if="currentTranslation" class="lyric-translation">
              {{ currentTranslation }}
            </span>
          </button>
        </transition>

        <transition name="star-chart-overlay">
          <div v-if="showFullLyrics" class="lyrics-backdrop" @click="showFullLyrics = false" />
        </transition>
        <transition name="star-chart-overlay">
          <mobile-scrolling-lyrics
            v-if="showFullLyrics"
            class="scrolling-lyrics-overlay"
            @close="showFullLyrics = false"
            @interact="showControls"
            @generatePoster="handleGeneratePoster"
          />
        </transition>

        <mobile-controls-area
          :visible="controlsVisible"
          :is-fullscreen="showFullLyrics"
          @close="showFullLyrics = false"
          @showPlaylist="openPlaylist"
          @interact="showControls"
        />
      </div>
    </transition>
  </teleport>

  <mobile-player-settings v-model:visible="showPlayerSettings" />
  <poster-share-modal v-model:visible="showPosterModal" :lyrics="selectedLyrics" />
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import MobileControlsArea from '@/components/lyric/MobileControlsArea.vue';
import MobileScrollingLyrics from '@/components/lyric/MobileScrollingLyrics.vue';
import MobilePlayerSettings from '@/components/player/MobilePlayerSettings.vue';
import PosterShareModal from '@/components/share/PosterShareModal.vue';
import { usePlayerStyleAppearance } from '@/composables/usePlayerStyleAppearance';
import { usePosterShare } from '@/composables/usePosterShare';
import { useSwipeClose } from '@/composables/useSwipeClose';
import { useTapToggle } from '@/composables/useTapToggle';
import { artistList, lrcArray, nowIndex, playMusic } from '@/hooks/MusicHook';
import { useCoverColor } from '@/hooks/useCoverColor';
import { climaxDetector } from '@/services/climaxDetector';
import { usePlayerStore } from '@/store/modules/player';
import { useStyleEngineStore } from '@/store/modules/styleEngine';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  overlayMode: { type: Boolean, default: false }
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const playerStore = usePlayerStore();
const styleEngine = useStyleEngineStore();
const { primaryColor, primaryColorRgb } = useCoverColor();
const { showPosterModal, selectedLyrics, handleGeneratePoster } = usePosterShare();
const { styleVars, isCustom, customBackgroundActive } = usePlayerStyleAppearance('starChart');
const showFullLyrics = ref(false);
const chartFrame = ref<HTMLElement>();
const chartCanvas = ref<HTMLCanvasElement>();
let resizeObserver: ResizeObserver | undefined;
let renderVersion = 0;
let spectrumFrameId: number | null = null;

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

const { controlsVisible, handleTapToggle, showControls } = useTapToggle({
  onDoubleClick: () => {
    showFullLyrics.value = true;
  }
});

const { onTouchStart: onSwipeCloseTouchStart, onTouchEnd: onSwipeCloseTouchEnd } = useSwipeClose({
  shouldClose: () => !showFullLyrics.value,
  onClose: () => close()
});

const isVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});
const isPlaying = computed(() => playerStore.isPlay);
const showPlayerSettings = computed({
  get: () => playerStore.playerSettingsVisible,
  set: (value) => playerStore.setPlayerSettingsVisible(value)
});
const songTitle = computed(() => playMusic.value?.name || 'Zephyrus');
const artistText = computed(() => artistList.value.map((artist) => artist.name).join(' / '));
const accentColor = computed(() => primaryColor.value || '#a0a0a0');
const accentColorRgb = computed(() => primaryColorRgb.value || '160, 160, 160');
const coverUrl = computed(
  () => playMusic.value?.picUrl || playMusic.value?.al?.picUrl || '/images/default_cover.png'
);
const currentLyricText = computed(() => {
  const lyric = lrcArray.value[nowIndex.value]?.text?.trim();
  return lyric || songTitle.value;
});
const currentTranslation = computed(() => lrcArray.value[nowIndex.value]?.trText?.trim() || '');

function close() {
  isVisible.value = false;
}

function openPlaylist() {
  playerStore.setPlayListDrawerVisible(true);
}

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

function drawPoints(context: CanvasRenderingContext2D, size: number, points: ChartPoint[]) {
  const spectrum = climaxDetector.getFrequencySnapshot(64);
  const energy = Math.min(1, Math.max(0, styleEngine.energyLevel / 2));
  const fallbackPulse = (Math.sin(performance.now() * 0.004) + 1) / 2;

  context.clearRect(0, 0, size, size);
  for (const point of points) {
    // 点阵由内向外映射为高频到低频，避免把频谱方向交给视觉组件猜测。
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

async function renderChart() {
  const canvas = chartCanvas.value;
  const frame = chartFrame.value;
  if (!canvas || !frame || !isVisible.value) return;

  const version = ++renderVersion;
  const size = Math.max(1, Math.min(frame.clientWidth, frame.clientHeight));
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
  if (isVisible.value && !showFullLyrics.value) startSpectrumLoop();
}

function stopSpectrumLoop() {
  if (spectrumFrameId !== null) {
    cancelAnimationFrame(spectrumFrameId);
    spectrumFrameId = null;
  }
}

function renderSpectrumFrame() {
  const canvas = chartCanvas.value;
  if (!canvas || !chartPoints.length || !isVisible.value || showFullLyrics.value) {
    stopSpectrumLoop();
    return;
  }

  const context = canvas.getContext('2d');
  if (context) drawPoints(context, chartSize, chartPoints);
  spectrumFrameId = requestAnimationFrame(renderSpectrumFrame);
}

function startSpectrumLoop() {
  stopSpectrumLoop();
  spectrumFrameId = requestAnimationFrame(renderSpectrumFrame);
}

watch(
  () => [coverUrl.value, isVisible.value],
  async () => {
    await nextTick();
    if (chartFrame.value && resizeObserver) resizeObserver.observe(chartFrame.value);
    renderChart();
  },
  { immediate: true }
);

watch(showFullLyrics, async (visible) => {
  await nextTick();
  if (!visible) {
    renderChart();
    startSpectrumLoop();
  } else {
    stopSpectrumLoop();
  }
});

onMounted(() => {
  styleEngine.syncFromPlayerStore();
  styleEngine.syncCoverColors();
  resizeObserver = new ResizeObserver(() => renderChart());
  if (chartFrame.value) resizeObserver.observe(chartFrame.value);
  void nextTick(() => renderChart());
  startSpectrumLoop();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  stopSpectrumLoop();
  renderVersion++;
});
</script>

<style scoped lang="scss">
.star-chart-player {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: grid;
  place-items: center;
  overflow: hidden;
  color: #f7f7f5;
  background: #050505;
  isolation: isolate;
}

.chart-shell {
  position: relative;
  width: min(78vw, 560px);
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  transform: translateY(-3vh);
}

.chart-rotor {
  position: absolute;
  inset: 0;
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

.lyric-focus {
  position: relative;
  z-index: 3;
  width: 72%;
  min-height: 128px;
  padding: 18px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: inherit;
  border: 0;
  background: transparent;
  text-align: center;
  cursor: pointer;
}

.landscape-lyric {
  display: none;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.lyric-main {
  max-width: 100%;
  font-family: 'Noto Serif SC', 'STSong', serif;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.36;
  letter-spacing: 0;
  overflow-wrap: anywhere;
  text-shadow:
    0 2px 16px #000,
    0 0 4px #000;
  transition: color 360ms var(--m-ease-out, ease-out);
}

.is-climax .lyric-main {
  color: var(--accent-color);
}

.lyric-translation {
  max-width: 100%;
  margin-top: 12px;
  color: rgba(255, 255, 255, 0.64);
  font-size: 14px;
  line-height: 1.55;
  letter-spacing: 0;
  overflow-wrap: anywhere;
  text-shadow: 0 1px 10px #000;
}

.top-controls {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(env(safe-area-inset-top, 0px) + 16px) 20px 0;
}

.icon-button {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  color: #fff;
  background: rgba(18, 18, 18, 0.7);
  backdrop-filter: blur(14px);
  cursor: pointer;
  transition:
    transform 180ms var(--m-ease-out, ease-out),
    background-color 220ms var(--m-ease-out, ease-out),
    border-color 220ms var(--m-ease-out, ease-out);
}

.icon-button i {
  font-size: 22px;
}

.icon-button:active {
  transform: scale(0.94);
  background: rgba(var(--accent-color-rgb), 0.22);
  border-color: rgba(var(--accent-color-rgb), 0.42);
}

.song-header {
  position: absolute;
  top: calc(env(safe-area-inset-top, 0px) + 23px);
  left: 50%;
  z-index: 35;
  width: min(58vw, 420px);
  transform: translateX(-50%);
  text-align: center;
  pointer-events: none;
}

.song-header p {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: 0;
}

.song-title {
  font-size: 14px;
  font-weight: 650;
  color: rgba(255, 255, 255, 0.92);
}

.song-artist {
  margin-top: 3px !important;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.46);
}

.lyrics-backdrop {
  position: absolute;
  inset: 0;
  z-index: 45;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(18px);
}

.scrolling-lyrics-overlay {
  z-index: 50;
}

@keyframes star-chart-spin {
  to {
    transform: rotate(360deg);
  }
}

.star-chart-page-enter-active,
.star-chart-page-leave-active {
  transition:
    opacity 320ms var(--m-ease-out, ease-out),
    transform 420ms var(--m-ease-out, ease-out);
}

.star-chart-page-enter-from,
.star-chart-page-leave-to {
  opacity: 0;
  transform: translateY(18px) scale(0.985);
}

.star-chart-content-enter-active,
.star-chart-content-leave-active {
  transition:
    opacity 260ms var(--m-ease-out, ease-out),
    transform 320ms var(--m-ease-out, ease-out);
}

.star-chart-content-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}

.star-chart-content-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}

.star-chart-chart-enter-active,
.star-chart-chart-leave-active {
  transition:
    opacity 360ms var(--m-ease-out, ease-out),
    transform 460ms var(--m-ease-out, ease-out),
    filter 360ms var(--m-ease-out, ease-out);
}

.star-chart-chart-enter-from,
.star-chart-chart-leave-to {
  opacity: 0;
  transform: scale(0.88) translateY(18px);
  filter: blur(10px);
}

.star-chart-controls-enter-active,
.star-chart-controls-leave-active,
.star-chart-header-enter-active,
.star-chart-header-leave-active,
.star-chart-overlay-enter-active,
.star-chart-overlay-leave-active {
  transition:
    opacity 240ms var(--m-ease-out, ease-out),
    transform 280ms var(--m-ease-out, ease-out);
}

.star-chart-controls-enter-from,
.star-chart-controls-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.star-chart-header-enter-from,
.star-chart-header-leave-to {
  opacity: 0;
  transform: translate(-50%, -8px);
}

.star-chart-overlay-enter-from,
.star-chart-overlay-leave-to {
  opacity: 0;
}

@media (orientation: landscape) {
  .star-chart-player {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: clamp(28px, 8vw, 140px);
    padding: 0 clamp(28px, 8vw, 140px);
  }

  .chart-shell {
    width: min(82vh, 680px);
    flex: 0 0 min(82vh, 680px);
    transform: translateY(0);
  }

  .chart-shell .lyric-focus {
    display: none;
  }

  .landscape-lyric {
    display: flex;
    width: min(34vw, 440px);
    min-height: 128px;
    flex-direction: column;
    justify-content: center;
    padding: 22px 4px;
  }

  .landscape-lyric .lyric-main {
    font-size: clamp(24px, 3vw, 42px);
    text-shadow: 0 2px 18px #000;
  }

  .lyric-main {
    font-size: 24px;
  }

  .lyric-focus {
    width: 76%;
    min-height: 108px;
  }
}

@media (max-width: 380px) {
  .chart-shell {
    width: 84vw;
  }

  .lyric-main {
    font-size: 24px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .chart-rotor {
    animation: none;
  }

  .star-chart-page-enter-active,
  .star-chart-page-leave-active,
  .star-chart-content-enter-active,
  .star-chart-content-leave-active,
  .star-chart-controls-enter-active,
  .star-chart-controls-leave-active,
  .star-chart-header-enter-active,
  .star-chart-header-leave-active,
  .star-chart-overlay-enter-active,
  .star-chart-overlay-leave-active {
    transition-duration: 120ms;
  }
}
</style>
