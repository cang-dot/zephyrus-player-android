<template>
  <teleport to="body">
    <transition name="star-chart-page">
      <div
        v-if="isVisible"
        class="star-chart-player player-style-surface"
        :class="{
          'player-style-customized': isCustom,
          'player-style-custom-font': customFontActive,
          'player-style-custom-background': customBackgroundActive
        }"
        :style="{
          ...styleVars,
          '--accent-color': accentColor,
          '--accent-color-rgb': accentColorRgb,
          ...lyricsSwipeStyle
        }"
        @click="handleTapToggle"
        @pointerdown.capture="onLyricsSwipePointerDown"
        @pointermove.capture="onLyricsSwipePointerMove"
        @pointerup.capture="onLyricsSwipePointerUp"
        @pointercancel.capture="onLyricsSwipePointerCancel"
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
            v-show="!showFullLyrics || lyricsSwipePreview"
            ref="chartFrame"
            class="chart-shell"
            :class="{ 'is-playing': isPlaying, 'is-climax': styleEngine.isInClimax }"
            :style="lyricsUnderlayStyle"
          >
            <div
              class="chart-rotor"
              aria-hidden="true"
              @pointerdown="startCoverLongPress"
              @pointerup="cancelCoverLongPress"
              @pointercancel="cancelCoverLongPress"
              @contextmenu.prevent="openCoverPreview"
            >
              <canvas ref="chartCanvas" class="chart-canvas" />
            </div>

            <transition name="star-chart-content" mode="out-in">
              <button
                :key="lyricBlockStart"
                type="button"
                class="lyric-block no-toggle"
                aria-label="打开滚动歌词"
                @click.stop="openLyricsAnimated"
              >
                <span
                  v-for="(line, i) in lyricBlockLines"
                  :key="`l${i}`"
                  class="lyric-block-line"
                  >{{ line }}</span
                >
                <span
                  v-for="(line, i) in lyricBlockTranslations"
                  :key="`t${i}`"
                  class="lyric-block-line lyric-block-translation"
                  >{{ line }}</span
                >
              </button>
            </transition>
          </main>
        </transition>

        <transition name="star-chart-content">
          <button
            v-show="!showFullLyrics || lyricsSwipePreview"
            type="button"
            class="landscape-lyric lyric-block no-toggle"
            aria-label="打开滚动歌词"
            @click.stop="openLyricsAnimated"
            :style="lyricsUnderlayStyle"
          >
            <span
              v-for="(line, i) in lyricBlockLines"
              :key="`l${i}`"
              class="lyric-block-line"
              >{{ line }}</span
            >
            <span
              v-for="(line, i) in lyricBlockTranslations"
              :key="`t${i}`"
              class="lyric-block-line lyric-block-translation"
              >{{ line }}</span
            >
          </button>
        </transition>

        <div
          v-show="showFullLyrics || lyricsSwipePreview"
          class="lyrics-backdrop"
          :style="lyricsBackdropStyle"
          @click="closeLyricsAnimated"
        />
        <div
          v-show="showFullLyrics || lyricsSwipePreview"
          class="scrolling-lyrics-overlay"
          :style="lyricsOverlayStyle"
        >
          <mobile-scrolling-lyrics
            class="scrolling-lyrics-content"
            :back-closes="showFullLyrics"
            :active="showFullLyrics || lyricsSwipePreview"
            @close="closeLyricsAnimated"
            @interact="showControls"
            @generatePoster="handleGeneratePoster"
          />
        </div>

        <mobile-controls-area
          :visible="controlsVisible"
          :is-fullscreen="showFullLyrics"
          @close="closeLyricsAnimated"
          @showPlaylist="openPlaylist"
          @show-settings="showPlayerSettings = true"
          @interact="showControls"
        />
      </div>
    </transition>
  </teleport>

  <mobile-player-settings v-model:visible="showPlayerSettings" />
  <cover-preview-modal
    v-model:visible="coverPreviewVisible"
    :src="previewCoverUrl"
    :title="songTitle"
  />
  <poster-share-modal
    v-model:visible="showPosterModal"
    :lyrics="selectedLyrics"
    :subject="posterSubject"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import MobileControlsArea from '@/components/lyric/MobileControlsArea.vue';
import MobileScrollingLyrics from '@/components/lyric/MobileScrollingLyrics.vue';
import CoverPreviewModal from '@/components/player/CoverPreviewModal.vue';
import MobilePlayerSettings from '@/components/player/MobilePlayerSettings.vue';
import PosterShareModal from '@/components/share/PosterShareModal.vue';
import { useLyricSwipeGesture } from '@/composables/useLyricSwipeGesture';
import { useMobilePlayerTransition } from '@/composables/useMobilePlayerTransition';
import { usePlayerStyleAppearance } from '@/composables/usePlayerStyleAppearance';
import { usePosterShare } from '@/composables/usePosterShare';
import { useSwipeClose } from '@/composables/useSwipeClose';
import { useTapToggle } from '@/composables/useTapToggle';
import { artistList, lrcArray, nowIndex, playMusic } from '@/hooks/MusicHook';
import { useCoverColor } from '@/hooks/useCoverColor';
import { ensureFontLoaded } from '@/utils/fontLoader';
import { useStyleCustomConfig } from '@/composables/useStyleCustomConfig';
import { usePlayerStore } from '@/store/modules/player';
import { useStyleEngineStore } from '@/store/modules/styleEngine';
import { shouldSkipMobilePlayerFrame } from '@/utils/mobilePlayerPerformance';
import { acquirePlayerResource } from '@/utils/playerResourceDiagnostics';

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
const { showPosterModal, selectedLyrics, posterSubject, handleGeneratePoster } = usePosterShare();
const { styleVars, isCustom, customBackgroundActive, customFontActive } =
  usePlayerStyleAppearance('starChart');
const showFullLyrics = ref(false);
const {
  style: lyricsSwipeStyle,
  overlayStyle: lyricsOverlayStyle,
  underlayStyle: lyricsUnderlayStyle,
  backdropStyle: lyricsBackdropStyle,
  previewing: lyricsSwipePreview,
  onPointerDown: onLyricsSwipePointerDown,
  onPointerMove: onLyricsSwipePointerMove,
  onPointerUp: onLyricsSwipePointerUp,
  onPointerCancel: onLyricsSwipePointerCancel,
  animateOpen: openLyricsAnimated,
  animateClose: closeLyricsAnimated
} = useLyricSwipeGesture({
  isOpen: () => showFullLyrics.value,
  onOpen: () => {
    showFullLyrics.value = true;
    playerStore.setFullLyricsVisible(true);
  },
  onClose: () => {
    showFullLyrics.value = false;
    playerStore.setFullLyricsVisible(false);
  }
});
const chartFrame = ref<HTMLElement>();
const chartCanvas = ref<HTMLCanvasElement>();
let resizeObserver: ResizeObserver | undefined;
let renderVersion = 0;
let spectrumFrameId: number | null = null;
let pageVisible = !document.hidden;
let releaseCanvasLoop: (() => void) | null = null;
let lastSpectrumRenderAt = 0;

interface TrailStar {
  orbit: number;
  angle: number;
  speed: number;
  magnitude: number;
  trail: number;
  twinkle: number;
  alpha: number;
  tint: number;
}

const trailStars: TrailStar[] = [];
let starTints: Array<[number, number, number]> = [];
let chartSize = 0;
let starFieldSeed = 1;
let starSpeed = 1;
let lastStarFrameAt = 0;
const STAR_BASE_SPEED = 0.055;

function seededRandom(): number {
  starFieldSeed = (starFieldSeed + 0x6d2b79f5) | 0;
  let t = Math.imul(starFieldSeed ^ (starFieldSeed >>> 15), 1 | starFieldSeed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const { controlsVisible, handleTapToggle, showControls } = useTapToggle({
  onDoubleClick: () => {
    openLyricsAnimated();
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
const coverPreviewVisible = ref(false);
let coverLongPressTimer: ReturnType<typeof setTimeout> | null = null;
const previewCoverUrl = computed(() => coverUrl.value);

function startCoverLongPress() {
  cancelCoverLongPress();
  coverLongPressTimer = setTimeout(() => {
    if (previewCoverUrl.value) coverPreviewVisible.value = true;
  }, 500);
}

function cancelCoverLongPress() {
  if (coverLongPressTimer) clearTimeout(coverLongPressTimer);
  coverLongPressTimer = null;
}

function openCoverPreview() {
  cancelCoverLongPress();
  if (previewCoverUrl.value) coverPreviewVisible.value = true;
}
// ── 楷体文本块歌词:按 N 行切块,整块竖排右起展示 ──
const { config: starStyleCustom } = useStyleCustomConfig('starChart');
const blockLineCount = computed(() => {
  const value = Number(starStyleCustom.value.starBlockLines);
  return Number.isFinite(value) ? Math.min(6, Math.max(2, Math.round(value))) : 4;
});
const lyricBlockStart = computed(() => {
  const index = nowIndex.value;
  if (index < 0) return 0;
  return Math.floor(index / blockLineCount.value) * blockLineCount.value;
});
const lyricBlockLines = computed(() => {
  if (!lrcArray.value.length) return [songTitle.value];
  const lines: string[] = [];
  const start = lyricBlockStart.value;
  for (let i = start; i < start + blockLineCount.value && i < lrcArray.value.length; i++) {
    const text = lrcArray.value[i]?.text?.trim();
    if (text) lines.push(text);
  }
  return lines.length ? lines : [songTitle.value];
});
const lyricBlockTranslations = computed(() => {
  const out: string[] = [];
  const start = lyricBlockStart.value;
  for (let i = start; i < start + blockLineCount.value && i < lrcArray.value.length; i++) {
    const tr = lrcArray.value[i]?.trText?.trim();
    if (tr) out.push(tr);
  }
  return out;
});

function close() {
  useMobilePlayerTransition().close(0, () => {
    isVisible.value = false;
    playerStore.setMusicFull(false);
  });
}

function openPlaylist() {
  playerStore.setPlayListDrawerVisible(true);
}

onBeforeUnmount(cancelCoverLongPress);

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

/** 封面随机位置采样 24 色,作为星点的轻微偏色源 */
function sampleCoverTints(image: HTMLImageElement) {
  try {
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 32;
    sampleCanvas.height = 32;
    const context = sampleCanvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    const source = Math.min(image.naturalWidth, image.naturalHeight);
    context.drawImage(
      image,
      (image.naturalWidth - source) / 2,
      (image.naturalHeight - source) / 2,
      source,
      source,
      0,
      0,
      32,
      32
    );
    const pixels = context.getImageData(0, 0, 32, 32).data;
    starTints = [];
    for (let i = 0; i < 24; i++) {
      const offset = Math.floor(seededRandom() * 1024) * 4;
      starTints.push([pixels[offset], pixels[offset + 1], pixels[offset + 2]]);
    }
  } catch {
    starTints = [];
  }
}

/** 生成星轨星场:轨道半径中带密、随机差速、拖尾弧长随机;相邻星共享 tint 形成局部偏色 */
function buildStarField(size: number, seedText: string) {
  trailStars.length = 0;
  starFieldSeed = hashText(seedText) || 1;
  const count = Math.round(Math.min(560, Math.max(320, size * 1.25)));
  for (let i = 0; i < count; i++) {
    trailStars.push({
      orbit: 0.14 + Math.pow(seededRandom(), 0.82) * 0.6,
      angle: seededRandom() * Math.PI * 2,
      speed: 0.6 + seededRandom() * 0.8,
      magnitude: 0.5 + seededRandom() * 1.1,
      trail: 0.05 + seededRandom() * 0.13,
      twinkle: seededRandom() * Math.PI * 2,
      alpha: 0.35 + seededRandom() * 0.55,
      tint: starTints.length ? Math.floor(seededRandom() * starTints.length) : -1
    });
  }
}

function drawStarField(context: CanvasRenderingContext2D, size: number, dt: number) {
  context.clearRect(0, 0, size, size);
  // 播放全速旋转,暂停缓停
  const targetSpeed = isPlaying.value ? 1 : 0.12;
  starSpeed += (targetSpeed - starSpeed) * Math.min(1, dt * 2.4);

  const center = size / 2;
  const maxRadius = size * 0.72;
  const now = performance.now();
  const segments = 8;

  for (const star of trailStars) {
    star.angle += STAR_BASE_SPEED * star.speed * starSpeed * dt;
    const orbitRadius = star.orbit * maxRadius;
    const twinkle = 0.78 + 0.22 * Math.sin(now * 0.0016 + star.twinkle);
    const alpha = star.alpha * twinkle;
    const head = star.angle;
    const tint = star.tint >= 0 ? starTints[star.tint] : null;
    // 白 92% + 封面采样色 8%
    const red = tint ? Math.round(255 * 0.92 + tint[0] * 0.08) : 255;
    const green = tint ? Math.round(255 * 0.92 + tint[1] * 0.08) : 255;
    const blue = tint ? Math.round(255 * 0.92 + tint[2] * 0.08) : 255;

    let x = center + Math.cos(head) * orbitRadius;
    let y = center + Math.sin(head) * orbitRadius;
    for (let seg = 1; seg <= segments; seg++) {
      const angle = head - (star.trail * seg) / segments;
      const nextX = center + Math.cos(angle) * orbitRadius;
      const nextY = center + Math.sin(angle) * orbitRadius;
      const fade = 1 - seg / segments;
      context.strokeStyle = `rgba(${red}, ${green}, ${blue}, ${(alpha * fade * 0.85).toFixed(3)})`;
      context.lineWidth = star.magnitude * (0.35 + fade * 0.65);
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(nextX, nextY);
      context.stroke();
      x = nextX;
      y = nextY;
    }
    context.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
    context.beginPath();
    context.arc(x, y, star.magnitude * 0.9, 0, Math.PI * 2);
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
    sampleCoverTints(image);
  } catch {
    if (version !== renderVersion) return;
    starTints = [];
  }
  buildStarField(size, `${songTitle.value}:${coverUrl.value}`);

  if (context) drawStarField(context, chartSize, 0.016);
  lastStarFrameAt = performance.now();
  if (isVisible.value && !showFullLyrics.value) startSpectrumLoop();
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
  if (!canvas || !chartPoints.length || !isVisible.value || showFullLyrics.value || !pageVisible) {
    stopSpectrumLoop();
    return;
  }

  const now = performance.now();
  if (shouldSkipMobilePlayerFrame(lastStarFrameAt, now)) {
    spectrumFrameId = requestAnimationFrame(renderSpectrumFrame);
    return;
  }
  const dt = Math.min(0.05, Math.max(0.001, (now - lastStarFrameAt) / 1000));
  lastStarFrameAt = now;

  const context = canvas.getContext('2d');
  if (context) drawStarField(context, chartSize, dt);
  spectrumFrameId = requestAnimationFrame(renderSpectrumFrame);
}

function startSpectrumLoop() {
  stopSpectrumLoop();
  if (!pageVisible || !isVisible.value || showFullLyrics.value) return;
  releaseCanvasLoop = acquirePlayerResource('canvas-loop');
  spectrumFrameId = requestAnimationFrame(renderSpectrumFrame);
}

function handlePageVisibility() {
  pageVisible = !document.hidden;
  if (pageVisible && isVisible.value && !showFullLyrics.value) startSpectrumLoop();
  if (!pageVisible) stopSpectrumLoop();
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
  // 默认楷体(马善政毛笔楷书):提前注册 FontFace,首帧即可生效
  void ensureFontLoaded('ma-shan-zheng');
  styleEngine.syncFromPlayerStore();
  styleEngine.syncCoverColors();
  resizeObserver = new ResizeObserver(() => renderChart());
  if (chartFrame.value) resizeObserver.observe(chartFrame.value);
  void nextTick(() => renderChart());
  document.addEventListener('visibilitychange', handlePageVisibility);
  if (pageVisible && !showFullLyrics.value) startSpectrumLoop();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  stopSpectrumLoop();
  renderVersion++;
  document.removeEventListener('visibilitychange', handlePageVisibility);
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
  overflow: hidden;
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

.lyric-block {
  position: relative;
  z-index: 3;
  height: min(44dvh, 400px);
  max-width: 76%;
  padding: 26px 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  border: 0;
  background: transparent;
  cursor: pointer;
  /* 竖排右起:一列一句,书法字帖式文本块 */
  writing-mode: vertical-rl;
}

.landscape-lyric {
  display: none;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.lyric-block-line {
  display: block;
  font-family: var(--player-style-font-family, 'ZephyrusMaShanZheng', 'Noto Serif SC', 'STKai', 'KaiTi', serif);
  font-size: clamp(19px, 2.7dvh, 24px);
  font-weight: 500;
  line-height: 2.05;
  letter-spacing: 0.16em;
  color: rgba(255, 255, 255, 0.88);
  max-height: 100%;
  overflow: hidden;
  text-shadow:
    0 2px 14px #000,
    0 0 4px #000;
}

.lyric-block-line:not(:first-child) {
  margin-top: 14px;
}

.lyric-block-translation {
  font-size: clamp(12px, 1.7dvh, 14px);
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.5);
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

.scrolling-lyrics-content {
  width: 100%;
  height: 100%;
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

  .chart-shell .lyric-block {
    display: none;
  }

  .landscape-lyric.lyric-block {
    display: flex;
    width: min(30vw, 380px);
    height: auto;
    max-height: 64dvh;
    justify-content: center;
    padding: 20px 24px;
  }

  .landscape-lyric .lyric-block-line {
    font-size: clamp(17px, 2.2vw, 22px);
  }
}

@media (max-width: 380px) {
  .chart-shell {
    width: 84vw;
  }

  .lyric-block-line {
    font-size: 18px;
  }
}

@media (prefers-reduced-motion: reduce) {
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
