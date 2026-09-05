<template>
  <Teleport to="#layout-main" :disabled="embedded">
    <section
      v-if="isVisible"
      id="mobile-drawer-target"
      ref="surfaceRef"
      class="default-player-v2 player-style-surface"
      :class="{
        landscape: isLandscape,
        'lyrics-expanded': lyricsExpanded,
        'custom-background': customBackgroundActive,
        'player-transitioning': playerTransitionBusy,
        'controls-docked': controlsDocked,
        'cover-hidden': coverHidden
      }"
      :style="{ ...surfaceStyle, ...lyricsSwipeStyle }"
      @click="handleTapToggle"
      @pointerdown.capture="gatedSwipePointerDown"
      @pointermove.capture="gatedSwipePointerMove"
      @pointerup.capture="gatedSwipePointerUp"
      @pointercancel.capture="gatedSwipePointerCancel"
      @touchstart="onTouchStart"
      @touchend="onTouchEnd"
    >
      <!-- 背景预设层(none/aurora/fluid,颜色从封面主色派生) -->
      <div v-if="backgroundPreset !== 'none'" class="background-preset-layer" aria-hidden="true">
        <aurora
          v-if="backgroundPreset === 'aurora'"
          :color-stops="auroraColorStops"
          :amplitude="1"
          :blend="0.5"
          :speed="0.6"
        />
        <liquid-ether
          v-else-if="backgroundPreset === 'fluid'"
          :colors="fluidColors"
          :mouse-force="24"
          :cursor-size="110"
          :auto-demo="true"
          :auto-speed="0.8"
          :auto-intensity="0.6"
          :auto-resume-delay="400"
          :auto-ramp-duration="0.5"
          :resolution="0.4"
          :dt="0.012"
          :iterations-poisson="16"
          :bfecc="false"
          :max-pixel-ratio="1.5"
          :max-fps="30"
          :paused="reduceMotion || playerTransitionBusy"
        />
      </div>

      <div v-if="playMusic?.playLoading" class="loading-state" aria-live="polite">
        <i class="ri-loader-4-line"></i>
      </div>

      <main class="player-content">
        <div
          v-if="(!lyricsExpanded || lyricsSwipePreview) && !coverHidden"
          class="artwork-zone"
          :style="[lyricsUnderlayStyle, artworkZoneStyle]"
        >
          <div
            class="artwork-preview-trigger"
            @click.capture="handleArtworkClick"
            @pointerdown="coverGesture.onPointerDown"
            @pointermove="coverGesture.onPointerMove"
            @pointerup="coverGesture.onPointerUp"
            @pointercancel="coverGesture.onPointerCancel"
            @contextmenu="coverGesture.onContextMenu"
          >
            <default-player-artwork
              :source="coverUrl"
              :title="playMusic?.name || 'Zephyrus'"
              mode="full"
              :playing="isPlaying"
              :style="[artworkTransitionStyle, artworkFrameStyle]"
            />
          </div>
          <div v-if="showTrackInfo" class="artwork-info">
            <strong class="artwork-info-name">{{ playMusic?.name || 'Zephyrus' }}</strong>
            <span v-if="artistText" class="artwork-info-artist">{{ artistText }}</span>
          </div>
        </div>

        <div
          v-if="!config.hideLyrics"
          class="lyrics-zone"
          :class="{ expanded: lyricsExpanded || lyricsSwipePreview }"
          :style="lyricsSwipePreview ? lyricsOverlayStyle : undefined"
          @dblclick.stop="toggleLyricsExpanded"
        >
          <mobile-scrolling-lyrics
            v-if="lrcArray.length"
            class="default-scrolling-lyrics"
            :active="true"
            :back-closes="lyricsExpanded"
            @close="handleLyricsSurfaceClose"
            @interact="playerTransition.showControls()"
          />
          <button v-else type="button" class="empty-lyrics" @click.stop="toggleLyricsExpanded">
            {{ t('player.lrc.noLrc') }}
          </button>
        </div>
      </main>

      <div class="shared-controls-spacer" aria-hidden="true"></div>
    </section>
  </Teleport>

  <cover-preview-modal
    v-model:visible="coverGesture.visible.value"
    :src="coverUrl"
    :title="playMusic?.name || ''"
  />
</template>

<script setup lang="ts">
import { useWindowSize } from '@vueuse/core';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import Aurora from '@/components/Aurora.vue';
import CoverPreviewModal from '@/components/player/CoverPreviewModal.vue';
import { useCoverPreviewGesture } from '@/composables/useCoverPreviewGesture';
import { useLyricSwipeGesture } from '@/composables/useLyricSwipeGesture';
import { useMobilePlayerTransition } from '@/composables/useMobilePlayerTransition';
import { usePlayerStyleAppearance } from '@/composables/usePlayerStyleAppearance';
import { useStyleCustomConfig } from '@/composables/useStyleCustomConfig';
import { useSwipeClose } from '@/composables/useSwipeClose';
import { useTapToggle } from '@/composables/useTapToggle';
import { artistList, lrcArray, playMusic, textColors } from '@/hooks/MusicHook';
import { usePlayerStore } from '@/store/modules/player';
import { DEFAULT_LYRIC_CONFIG, type LyricConfig } from '@/types/lyric';
import { getImgUrl } from '@/utils';
import { normalizeArtworkUrl, resolveArtworkSource } from '@/utils/artwork';
import { getTextColors } from '@/utils/linearColor';
import {
  choosePlayerInkTone,
  parseRepresentativeCssColor,
  playerInkVariables
} from '@/utils/playerInk';

import DefaultPlayerArtwork from './DefaultPlayerArtwork.vue';
import LiquidEther from './LiquidEther.vue';
import MobileScrollingLyrics from './MobileScrollingLyrics.vue';

const props = defineProps<{
  modelValue?: boolean;
  background?: string;
  /** 内嵌预览模式：禁用 Teleport，渲染在挂载位置（引导页小窗口预览用） */
  embedded?: boolean;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();
const { t } = useI18n();
const playerStore = usePlayerStore();
const playerTransition = useMobilePlayerTransition();
const { handleTapToggle } = useTapToggle();
const coverGesture = useCoverPreviewGesture(computed(() => coverUrl.value));

function handleArtworkClick(event: MouseEvent) {
  coverGesture.consumeSuppressedClick(event);
}
const { width, height } = useWindowSize();
const { styleVars, customBackgroundActive, background, backgroundColor } =
  usePlayerStyleAppearance('default');
const { config: styleCustom } = useStyleCustomConfig('default');

// ── 默认样式自定义项(封面大小/对齐、歌名作者、背景预设) ──
const showTrackInfo = computed(() => styleCustom.value.showTrackInfo !== false);
const artworkSize = computed(() =>
  Math.min(100, Math.max(60, Number(styleCustom.value.artworkSize) || 88))
);
const artworkAlign = computed(() => {
  const value = String(styleCustom.value.artworkAlign);
  return (['start', 'center', 'end'].includes(value) ? value : 'center') as
    | 'start'
    | 'center'
    | 'end';
});
const backgroundPreset = computed(() => {
  const value = String(styleCustom.value.backgroundPreset);
  return (['none', 'aurora', 'fluid'].includes(value) ? value : 'none') as
    | 'none'
    | 'aurora'
    | 'fluid';
});
const reduceMotion = ref(
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
);

const artistText = computed(() => artistList.value.map((artist) => artist.name).join(' / '));

const ALIGN_INNER: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end'
};
const ALIGN_TEXT: Record<string, string> = { start: 'left', center: 'center', end: 'right' };
const artworkZoneStyle = computed(() => ({
  '--artwork-align-inner': ALIGN_INNER[artworkAlign.value],
  '--artwork-text-align': ALIGN_TEXT[artworkAlign.value]
}));
const artworkFrameStyle = computed(() => {
  // mode-full 画布是非正方形(width 100%/520、height 40dvh、aspect auto),
  // 图片 contain 居中会在浅色背景上露出灰边;锁定正方形让 frame 紧贴封面。
  // 横屏分栏高度充裕,基准比竖屏更大
  const base = isLandscape.value ? 'min(40vw, 52dvh, 460px)' : 'min(82vw, 42dvh, 400px)';
  const side = `calc(${base} * ${artworkSize.value / 100})`;
  return { width: side, height: side, aspectRatio: '1' };
});

function rgbToHex(r: number, g: number, b: number) {
  const channel = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}
const themeRgb = computed(
  () => parseRepresentativeCssColor(resolvedBackgroundColor.value) || { r: 23, g: 23, b: 23 }
);
const auroraColorStops = computed(() => {
  const { r, g, b } = themeRgb.value;
  const mix = (t: number, tr: number, tg: number, tb: number) =>
    rgbToHex(r + (tr - r) * t, g + (tg - g) * t, b + (tb - b) * t);
  return [mix(0.55, 0, 0, 0), rgbToHex(r, g, b), mix(0.5, 255, 255, 255)];
});
const fluidColors = computed(() => {
  const { r, g, b } = themeRgb.value;
  return ['#000000', rgbToHex(r, g, b), '#ffffff'];
});

const surfaceRef = ref<HTMLElement | null>(null);
const config = ref<LyricConfig>({ ...DEFAULT_LYRIC_CONFIG });
const lyricsExpanded = ref(false);
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
  isOpen: () => lyricsExpanded.value,
  onOpen: () => commitLyricsExpanded(true),
  onClose: () => commitLyricsExpanded(false)
});
const isLandscape = computed(() => width.value > height.value);
const isPlaying = computed(() => playerStore.isPlay);

// ── 控制条下滑隐藏时,播放器内容容器同步下滑 ──
// 与 MobilePlayerBottomSurface 的 dock 同源(controlsVisible/sheetProgress),
// 「常显控件」设置下不生效
const surfacePinned = ref(false);
const refreshSurfacePinned = () => {
  try {
    const raw = localStorage.getItem('music-full-config');
    surfacePinned.value = raw ? JSON.parse(raw).alwaysShowPlayerControls === true : false;
  } catch {
    surfacePinned.value = false;
  }
};
refreshSurfacePinned();
window.addEventListener('music-full-config-updated', refreshSurfacePinned);
onBeforeUnmount(() => {
  window.removeEventListener('music-full-config-updated', refreshSurfacePinned);
});
const controlsDocked = computed(
  () =>
    !surfacePinned.value &&
    !playerTransition.controlsVisible.value &&
    playerTransition.sheetProgress.value < 0.02
);

// 经典模式「隐藏封面」:歌词铺满全屏、信息置顶,侧滑唤起/收起歌词手势禁用
const coverHidden = computed(() => config.value.hideCoverClassic === true);
const gatedSwipePointerDown = (e: PointerEvent) => {
  if (coverHidden.value) return;
  onLyricsSwipePointerDown(e);
};
const gatedSwipePointerMove = (e: PointerEvent) => {
  if (coverHidden.value) return;
  onLyricsSwipePointerMove(e);
};
const gatedSwipePointerUp = (e: PointerEvent) => {
  if (coverHidden.value) return;
  onLyricsSwipePointerUp(e);
};
const gatedSwipePointerCancel = (e: PointerEvent) => {
  if (coverHidden.value) return;
  onLyricsSwipePointerCancel(e);
};
const playerTransitionBusy = computed(
  () =>
    playerTransition.state.value === 'dragging' ||
    playerTransition.state.value === 'opening' ||
    playerTransition.state.value === 'closing'
);
const coverUrl = computed(() =>
  getImgUrl(normalizeArtworkUrl(resolveArtworkSource(playMusic.value)), '500y500')
);
const originalBackground = computed(
  () => playMusic.value?.primaryColor || props.background || '#171717'
);
const resolvedBackgroundColor = computed(() =>
  customBackgroundActive.value ? backgroundColor.value : originalBackground.value
);
const ink = computed(() => {
  const rgb = parseRepresentativeCssColor(resolvedBackgroundColor.value) || { r: 23, g: 23, b: 23 };
  return playerInkVariables(choosePlayerInkTone(rgb));
});
const surfaceStyle = computed(() => ({
  ...styleVars.value,
  '--default-player-background': customBackgroundActive.value
    ? background.value
    : originalBackground.value,
  '--player-ink': ink.value.color,
  '--player-ink-rgb': ink.value.rgb,
  '--text-color-active': ink.value.color,
  '--text-color-primary': `rgba(${ink.value.rgb}, 0.68)`
}));
const artworkTransitionStyle = computed(() => {
  const source = playerTransition.sourceRect.value;
  const progress = playerTransition.progress.value;
  if (!source || progress >= 0.999) return {};
  const targetSize = Math.min(window.innerWidth * 0.72, window.innerHeight * 0.38, 360);
  const targetX = window.innerWidth / 2;
  const targetY = window.innerHeight * 0.32;
  const sourceX = source.left + source.width / 2;
  const sourceY = source.top + source.height / 2;
  const scale = source.width / Math.max(1, targetSize);
  return {
    transform: `translate3d(${(sourceX - targetX) * (1 - progress)}px, ${(sourceY - targetY) * (1 - progress)}px, 0) scale(${scale + (1 - scale) * progress})`,
    transformOrigin: 'center center',
    willChange: 'transform'
  };
});

const isVisible = computed({
  get: () => props.modelValue !== false,
  set: (value: boolean) => emit('update:modelValue', value)
});

function loadConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem('music-full-config') || '{}');
    config.value = { ...DEFAULT_LYRIC_CONFIG, ...saved };
  } catch {
    config.value = { ...DEFAULT_LYRIC_CONFIG, mobileCoverStyle: 'square' };
  }
}

function closePlayer() {
  playerTransition.close(0, () => {
    isVisible.value = false;
    playerStore.setMusicFull(false);
  });
}

function commitLyricsExpanded(value: boolean) {
  lyricsExpanded.value = value;
  playerStore.setFullLyricsVisible(value);
  playerTransition.showControls();
}

function setLyricsExpanded(value: boolean) {
  if (value) openLyricsAnimated();
  else closeLyricsAnimated();
}

function toggleLyricsExpanded() {
  // 隐藏封面时歌词恒为全屏,不再切换展开态
  if (coverHidden.value) return;
  setLyricsExpanded(!lyricsExpanded.value);
}

function handleLyricsSurfaceClose() {
  if (lyricsExpanded.value) setLyricsExpanded(false);
}

function handleBack() {
  if (lyricsExpanded.value) setLyricsExpanded(false);
  else closePlayer();
}

const { onTouchStart, onTouchEnd } = useSwipeClose({
  shouldClose: () => !lyricsExpanded.value && !isLandscape.value,
  onClose: closePlayer
});

function handleConfigUpdate() {
  loadConfig();
}

watch(
  resolvedBackgroundColor,
  (color) => {
    textColors.value = getTextColors(color);
  },
  { immediate: true }
);
watch(
  () => playerStore.fullLyricsVisible,
  (visible) => {
    if (!visible) lyricsExpanded.value = false;
  }
);
watch(isVisible, (visible) => {
  if (!visible) setLyricsExpanded(false);
});

onMounted(() => {
  loadConfig();
  document.body.classList.add('default-player-active');
  window.dispatchEvent(new Event('default-player-style-changed'));
  window.addEventListener('music-full-config-updated', handleConfigUpdate);
});
onBeforeUnmount(() => {
  playerStore.setFullLyricsVisible(false);
  window.removeEventListener('music-full-config-updated', handleConfigUpdate);
  document.body.classList.remove('default-player-active');
  window.dispatchEvent(new Event('default-player-style-changed'));
});
</script>

<style scoped>
.default-player-v2 {
  position: absolute;
  inset: 0;
  z-index: 9998;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  width: 100%;
  min-height: 100dvh;
  overflow: hidden;
  background: var(--default-player-background, #171717);
  color: var(--player-ink, #fff);
  font-family: var(--player-style-font-family, inherit);
  isolation: isolate;
  contain: strict;
}

.default-player-v2::before {
  position: absolute;
  inset: 0;
  z-index: -1;
  background: var(--player-style-background, transparent);
  filter: blur(var(--player-style-background-blur, 0))
    brightness(var(--player-style-background-brightness, 1));
  content: '';
  pointer-events: none;
}

.default-player-v2.player-transitioning::before {
  filter: none;
}

.player-content {
  display: grid;
  grid-template-rows: minmax(168px, 58%) minmax(100px, 42%);
  min-height: 0;
  overflow: hidden;
  transition: grid-template-rows 380ms cubic-bezier(0.32, 0.72, 0, 1);
}

.artwork-zone {
  /* 显式锁定第一格:歌词层手势预览时显式跨满网格,若封面区靠自动放置
     会被挤进网格外的隐式行(屏幕下方),出现"封面掉到下面"的错乱 */
  grid-row: 1;
  grid-column: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 0;
  align-items: var(--artwork-align-inner, center);
  justify-content: center;
  /* 底部留白略大,让封面+文字的视觉重心整体上移 */
  padding: 12px 20px max(32px, 5%);
  transition:
    opacity 260ms ease,
    transform 380ms cubic-bezier(0.32, 0.72, 0, 1),
    padding-bottom 350ms cubic-bezier(0.32, 0.72, 0, 1);
}

.artwork-preview-trigger {
  min-height: 0;
}

.artwork-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 100%;
  padding: 0 4px;
  text-align: var(--artwork-text-align, center);
  pointer-events: none;
}

.artwork-info-name {
  overflow: hidden;
  font-size: clamp(20px, 2.8vh, 26px);
  font-weight: 700;
  color: var(--player-ink, #fff);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.artwork-info-artist {
  overflow: hidden;
  font-size: 14px;
  color: rgba(var(--player-ink-rgb, 255, 255, 255), 0.62);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.background-preset-layer {
  position: absolute;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}

.background-preset-layer > * {
  width: 100%;
  height: 100%;
}

.lyrics-zone {
  min-height: 0;
  overflow: hidden;
  transition:
    transform 380ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 260ms ease,
    padding-bottom 350ms cubic-bezier(0.32, 0.72, 0, 1);
}

.lyrics-zone.expanded {
  grid-row: 1 / -1;
  /* 横屏单行多列:歌词展开时也要横跨全部列,否则仍被锁在右列与封面同屏 */
  grid-column: 1 / -1;
}

.default-scrolling-lyrics {
  width: 100%;
  height: 100%;
}

.empty-lyrics {
  display: grid;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: rgba(var(--player-ink-rgb, 255, 255, 255), 0.48);
  place-items: center;
}

.lyrics-expanded .player-content {
  grid-template-rows: minmax(0, 1fr);
}

/* ==================== 隐藏封面(歌词铺满全屏 + 信息置顶) ==================== */

.cover-hidden .player-content {
  grid-template-rows: minmax(0, 1fr);
}

.cover-hidden .lyrics-zone {
  grid-row: 1 / -1;
  grid-column: 1 / -1;
  /* 顶部让出置顶信息条 */
  padding-top: calc(var(--safe-area-inset-top, 0px) + 64px);
}

.cover-hidden .song-header {
  z-index: 5;
  opacity: 1;
  top: calc(var(--safe-area-inset-top, 0px) + 14px);
}

.lyrics-expanded .artwork-zone {
  opacity: 0;
  transform: translate3d(0, -18px, 0) scale(0.98);
  pointer-events: none;
}

.shared-controls-spacer {
  height: calc(168px + var(--safe-area-inset-bottom, 0px));
  transition: height 350ms cubic-bezier(0.32, 0.72, 0, 1);
  pointer-events: none;
}

/* 控制条下滑隐藏:底部占位同步塌陷,内容(封面/歌词)整体下滑重新居中 */
.controls-docked .shared-controls-spacer {
  height: var(--safe-area-inset-bottom, 0px);
}

.loading-state {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: grid;
  background: rgba(0, 0, 0, 0.18);
  font-size: 32px;
  place-items: center;
}

.loading-state i {
  animation: player-loading-spin 0.8s linear infinite;
}

.landscape {
  grid-template-rows: minmax(0, 1fr) auto;
}

/* 横屏:歌词容器吃满全屏高度,底部改由歌词区内部预留控制条悬浮空间 */
.landscape .shared-controls-spacer {
  height: 0;
}

.landscape .lyrics-zone {
  padding-bottom: calc(96px + var(--safe-area-inset-bottom, 0px));
}

.landscape .artwork-zone {
  padding-bottom: calc(96px + var(--safe-area-inset-bottom, 0px));
}

/* 横屏 + 控件隐藏:预留的控制条悬浮空间释放,歌词/封面下移吃满高度 */
.landscape.controls-docked .lyrics-zone {
  padding-bottom: max(16px, 2%);
}

.landscape.controls-docked .artwork-zone {
  padding-bottom: max(24px, 3%);
}

.landscape .player-content {
  grid-template-rows: minmax(0, 1fr);
  grid-template-columns: minmax(240px, 42%) minmax(0, 1fr);
  padding: 0 max(18px, var(--safe-area-inset-right, 0px)) 0
    max(18px, var(--safe-area-inset-left, 0px));
}

.landscape .artwork-zone {
  padding-top: 8px;
  padding-left: 24px;
  padding-right: 24px;
}

.landscape.lyrics-expanded .player-content {
  grid-template-columns: minmax(0, 1fr);
}

@keyframes player-loading-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .player-content,
  .artwork-zone,
  .lyrics-zone {
    transition: opacity 160ms ease;
  }

  .loading-state i {
    transition: none;
    animation: none;
  }
}
</style>
