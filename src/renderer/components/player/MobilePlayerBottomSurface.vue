<template>
  <Teleport to="body">
    <div v-if="surfaceMounted" class="shared-player-bottom-layer" :style="layerStyle">
      <button
        v-if="panelMounted"
        type="button"
        class="shared-player-scrim"
        aria-label="关闭"
        :style="{ opacity: String(sheetProgress * 0.18) }"
        @click="closePanel"
      />

      <section
        class="shared-player-bottom-surface no-toggle"
        :class="{
          'panel-open': panelMounted,
          'controls-mode': !panelMounted,
          'panel-playlist': surfaceMode === 'playlist',
          'panel-settings': surfaceMode === 'settings',
          'surface-interaction-active': playerSurfaceFeedback.active.value,
          'lyric-selection-mode': lyricSelection.active.value,
          'source-dock': transitionStartedWithMenu,
          'source-mini': !transitionStartedWithMenu,
          'player-transitioning':
            playerTransition.state.value === 'dragging' ||
            playerTransition.state.value === 'opening' ||
            playerTransition.state.value === 'closing'
        }"
        :style="surfaceStyle"
        @pointerdown="onSurfacePointerDown"
        @pointermove="onSurfacePointerMove"
        @pointerup="onSurfacePointerUp"
        @pointercancel="onSurfacePointerCancel"
        @click="playerSurfaceFeedback.pulse()"
      >
        <div class="shared-controls-pane" :style="controlsPaneStyle">
          <div v-if="lyricSelection.active.value" class="lyric-selection-actions">
            <button
              type="button"
              aria-label="复制歌词"
              title="复制歌词"
              :disabled="lyricSelection.selectedCount.value === 0"
              @click="lyricSelection.copy()"
            >
              <i class="ri-file-copy-line" />
            </button>
            <button
              type="button"
              class="primary"
              aria-label="生成海报"
              title="生成海报"
              :disabled="lyricSelection.selectedCount.value === 0"
              @click="openPosterFromSelection"
            >
              <i class="ri-image-edit-line" />
            </button>
          </div>
          <mobile-controls-area
            v-else
            shared-surface
            :visible="controlsShown"
            @show-playlist="openPlaylist"
            @show-settings="openSettings"
            @interact="playerTransition.resetControlsHideTimer"
          />
        </div>

        <div v-if="panelMounted" class="shared-sheet-pane" :style="sheetPaneStyle">
          <playing-list-drawer v-if="surfaceMode === 'playlist'" embedded />
          <mobile-player-settings
            v-if="surfaceMode === 'settings'"
            embedded
            :visible="true"
            @update:visible="(visible) => !visible && closePanel()"
          />
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useMediaQuery, useWindowSize } from '@vueuse/core';
import type { CSSProperties, Ref } from 'vue';
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import MobileControlsArea from '@/components/lyric/MobileControlsArea.vue';
import { useControlsDock } from '@/composables/useControlsDock';
import { useLyricSelectionSurface } from '@/composables/useLyricSelectionSurface';
import { useMobilePlayerTransition } from '@/composables/useMobilePlayerTransition';
import { useMobileSongActionSurface } from '@/composables/useMobileSongActionSurface';
import { usePlayerSurfaceFeedback } from '@/composables/usePlayerSurfaceFeedback';
import { usePosterTransitionOrigin } from '@/composables/usePosterTransitionOrigin';
import { registerMobileBackLayer } from '@/services/mobileBackStack';
import { usePlayerStore } from '@/store/modules/player';
import {
  choosePlayerInkTone,
  parseRepresentativeCssColor,
  type PlayerInkTone,
  playerInkVariables,
  type RgbColor
} from '@/utils/playerInk';

import MobilePlayerSettings from './MobilePlayerSettings.vue';
import PlayingListDrawer from './PlayingListDrawer.vue';

const playerStore = usePlayerStore();
const playerTransition = useMobilePlayerTransition();
const transitionStartedWithMenu = inject(
  'playerTransitionStartedWithMenu',
  ref(false)
) as Ref<boolean>;
const playerSurfaceFeedback = usePlayerSurfaceFeedback();
const lyricSelection = useLyricSelectionSurface();
const songActionSurface = useMobileSongActionSurface();
const posterTransitionOrigin = usePosterTransitionOrigin();
const { width: viewportWidth, height: viewportHeight } = useWindowSize();
const isLandscape = useMediaQuery('(orientation: landscape)');
const safeBottomInset = ref(0);
const updateSafeBottomInset = () => {
  safeBottomInset.value = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-bottom') || '0'
  );
};
let unregisterSurfaceBackLayer: (() => void) | undefined;
let styleColorFrame = 0;
const styleBackgroundColor = ref<RgbColor>({ r: 17, g: 17, b: 17 });
const refreshStyleBackgroundColor = () => {
  void nextTick(() => {
    if (styleColorFrame) cancelAnimationFrame(styleColorFrame);
    styleColorFrame = requestAnimationFrame(() => {
      styleColorFrame = 0;
      const surfaces = Array.from(document.querySelectorAll<HTMLElement>('.player-style-surface'));
      const surface = surfaces.reverse().find((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      if (!surface) return;
      const styles = getComputedStyle(surface);
      const candidates = [
        styles.getPropertyValue('--player-style-background-color'),
        styles.getPropertyValue('--player-style-background'),
        styles.getPropertyValue('--bg-color'),
        styles.backgroundColor
      ];
      const color = candidates.map(parseRepresentativeCssColor).find(Boolean);
      if (color) styleBackgroundColor.value = color;
    });
  });
};
onMounted(() => {
  updateSafeBottomInset();
  refreshStyleBackgroundColor();
  window.addEventListener('music-full-config-updated', refreshStyleBackgroundColor);
  unregisterSurfaceBackLayer = registerMobileBackLayer({
    id: 'player-shared-surface-panel',
    priority: 620,
    isActive: () => playerStore.musicFull && surfaceMode.value !== 'controls',
    onBack: closePanel
  });
});
onBeforeUnmount(() => {
  unregisterSurfaceBackLayer?.();
  window.removeEventListener('music-full-config-updated', refreshStyleBackgroundColor);
  if (styleColorFrame) cancelAnimationFrame(styleColorFrame);
  if (songSheetFrame) cancelAnimationFrame(songSheetFrame);
});
watch([viewportWidth, viewportHeight], updateSafeBottomInset);
watch(
  () => [
    playerStore.musicFull,
    playerStore.currentSong?.id,
    playerStore.currentSong?.primaryColor,
    playerTransition.state.value
  ],
  refreshStyleBackgroundColor,
  { flush: 'post' }
);
const surfaceMode = computed(() => playerTransition.surfaceMode.value);
const sheetProgress = computed(() => playerTransition.sheetProgress.value);
const panelMounted = computed(
  () => surfaceMode.value !== 'controls' || playerTransition.sheetProgress.value > 0.002
);
const surfaceMounted = computed(
  () =>
    lyricSelection.active.value || playerStore.musicFull || playerTransition.state.value !== 'idle'
);
const controlsShown = computed(
  () => playerTransition.controlsVisible.value && surfaceMode.value === 'controls'
);

// ==================== 控件下移贴底（default 样式共享容器路径） ====================

const surfacePinned = ref(false);
const refreshSurfacePinned = () => {
  try {
    const raw = localStorage.getItem('music-full-config');
    const cfg = raw ? JSON.parse(raw) : {};
    surfacePinned.value = cfg.alwaysShowPlayerControls === true;
  } catch {
    surfacePinned.value = false;
  }
};
window.addEventListener('music-full-config-updated', refreshSurfacePinned);
refreshSurfacePinned();
onBeforeUnmount(() => {
  window.removeEventListener('music-full-config-updated', refreshSurfacePinned);
});

const surfaceDock = useControlsDock(
  () =>
    document.querySelector<HTMLElement>(
      '.shared-player-bottom-surface .apple-style-progress'
    ),
  {
    hidden: () => surfaceMode.value === 'controls' && !playerTransition.controlsVisible.value,
    enabled: () => !surfacePinned.value && !lyricSelection.active.value
  }
);
const surfaceDocked = computed(
  () => surfaceDock.dockActive.value && playerTransition.sheetProgress.value < 0.02
);

// 容器由 v-if 控制挂载，播放器打开后进度条才存在，需要重新测量基准位置
watch(
  () => playerStore.musicFull,
  (open) => {
    if (open) void nextTick(() => surfaceDock.scheduleMeasure());
  }
);

const chromeVisibility = computed(() => {
  if (lyricSelection.active.value) return 1;
  const transitionState = playerTransition.state.value;
  const progressReveal = Math.min(1, Math.max(0, playerTransition.progress.value / 0.08));
  if (
    transitionState === 'dragging' ||
    transitionState === 'opening' ||
    transitionState === 'closing'
  ) {
    return progressReveal;
  }
  // dock 状态下控件位移到进度条贴底而非消失，整层保持可见
  const controlsReveal = surfaceDocked.value
    ? 1
    : surfaceMode.value !== 'controls' || playerTransition.controlsVisible.value
      ? 1
      : 0;
  return progressReveal * controlsReveal;
});

const inkTone = ref<PlayerInkTone>(choosePlayerInkTone(styleBackgroundColor.value));
watch(styleBackgroundColor, (color) => {
  inkTone.value = choosePlayerInkTone(color, inkTone.value);
});
const ink = computed(() => playerInkVariables(inkTone.value));
const layerStyle = computed<CSSProperties>(
  () =>
    ({
      '--shared-sheet-progress': String(sheetProgress.value),
      '--player-ink': ink.value.color,
      '--player-ink-rgb': ink.value.rgb,
      '--player-icon-color': `rgba(${ink.value.rgb}, 0.94)`,
      '--player-progress-color': `rgba(${ink.value.rgb}, 0.92)`,
      '--player-interactive-border': `rgba(${ink.value.rgb}, 0.28)`,
      opacity: String(chromeVisibility.value)
    }) as CSSProperties
);

const surfaceStyle = computed<CSSProperties>(() => {
  const sheet = sheetProgress.value;
  const playerProgress = lyricSelection.active.value ? 1 : playerTransition.progress.value;
  const landscape = isLandscape.value;
  const controlHeight = lyricSelection.active.value ? 88 : landscape ? 96 : 168;
  const basePanelHeight = landscape
    ? viewportHeight.value - 28
    : Math.min(viewportHeight.value * 0.68, 560);
  // While the song action sheet is open the glass container hugs the compact
  // panel instead of keeping the full playlist height below it.
  const songSheetPanelHeight = landscape
    ? basePanelHeight
    : Math.min(viewportHeight.value * 0.52, 470);
  const panelHeight =
    basePanelHeight + (songSheetPanelHeight - basePanelHeight) * songSheetCollapse.value;
  const height = controlHeight + (panelHeight - controlHeight) * sheet;
  const fullWidth = viewportWidth.value - 28;
  const panelWidth = landscape ? Math.min(viewportWidth.value * 0.48, 430) : fullWidth;
  const width = fullWidth + (panelWidth - fullWidth) * sheet;
  const safeBottom = safeBottomInset.value;
  const finalLeft = landscape && sheet > 0 ? viewportWidth.value - width - safeBottom - 14 : 14;
  const finalTop = viewportHeight.value - safeBottom - 14 - height;
  const finalRadius = 26 + sheet * 4;
  return {
    '--player-open-progress': String(playerProgress),
    top: `${finalTop}px`,
    left: `${finalLeft}px`,
    right: 'auto',
    bottom: 'auto',
    width: `${width}px`,
    height: `${height}px`,
    borderRadius: `${finalRadius}px`,
    transform: surfaceDocked.value
      ? `translate3d(0, ${surfaceDock.dockShift.value}px, 0)`
      : 'none',
    pointerEvents: chromeVisibility.value > 0.02 ? 'auto' : 'none'
  };
});

const controlsPaneStyle = computed<CSSProperties>(() => ({
  opacity: lyricSelection.active.value
    ? '1'
    : String(
        (1 - sheetProgress.value) *
          Math.min(1, Math.max(0, (playerTransition.progress.value - 0.12) / 0.56))
      ),
  transform: `translate3d(0, ${-10 * sheetProgress.value}px, 0)`,
  pointerEvents: sheetProgress.value < 0.05 ? 'auto' : 'none'
}));
const sheetPaneStyle = computed<CSSProperties>(() => ({
  opacity: String(sheetProgress.value),
  transform: `translate3d(0, ${14 * (1 - sheetProgress.value)}px, 0)`,
  pointerEvents: sheetProgress.value > 0.95 ? 'auto' : 'none'
}));

const openPlaylist = () => {
  playerStore.setPlayListDrawerVisible(true);
  playerTransition.setSurfaceMode('playlist');
};

const openSettings = () => {
  playerTransition.setSurfaceMode('settings');
};

const closePlayer = () => {
  playerTransition.close(0, () => playerStore.setMusicFull(false));
};

const closePanel = () => {
  if (surfaceMode.value === 'playlist') playerStore.setPlayListDrawerVisible(false);
  playerTransition.setSurfaceMode('controls');
};

const songSheetActive = computed(
  () => surfaceMode.value === 'playlist' && songActionSurface.visible.value
);
const songSheetCollapse = ref(0);
let songSheetFrame = 0;
const animateSongSheetCollapse = (target: 0 | 1) => {
  if (songSheetFrame) cancelAnimationFrame(songSheetFrame);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    songSheetCollapse.value = target;
    songSheetFrame = 0;
    return;
  }
  let value = songSheetCollapse.value;
  let speed = 0;
  let previous = performance.now();
  const tick = (now: number) => {
    const dt = Math.min(0.032, Math.max(0.001, (now - previous) / 1000));
    previous = now;
    speed += (-420 * (value - target) - 38 * speed) * dt;
    value += speed * dt;
    songSheetCollapse.value = Math.min(1, Math.max(0, value));
    if (Math.abs(value - target) < 0.004 && Math.abs(speed) < 0.04) {
      songSheetCollapse.value = target;
      songSheetFrame = 0;
      return;
    }
    songSheetFrame = requestAnimationFrame(tick);
  };
  songSheetFrame = requestAnimationFrame(tick);
};
watch(songSheetActive, (active) => animateSongSheetCollapse(active ? 1 : 0));

const openPosterFromSelection = (event: MouseEvent) => {
  posterTransitionOrigin.capture(event.currentTarget as Element);
  lyricSelection.generatePoster();
};

watch(
  () => [playerStore.playListDrawerVisible, playerStore.musicFull] as const,
  ([visible, musicFull]) => {
    if (!musicFull) return;
    if (visible) playerTransition.setSurfaceMode('playlist');
    else if (surfaceMode.value === 'playlist') playerTransition.setSurfaceMode('controls');
  },
  { immediate: true }
);

let pointerId: number | null = null;
let pointerStartY = 0;
let pointerStartProgress = 1;
let pointerStartedAt = 0;

const onSurfacePointerDown = (event: PointerEvent) => {
  if (
    !panelMounted.value ||
    !event.isPrimary ||
    (event.target as Element).closest('button, input, textarea, select, [role="slider"]')
  ) {
    return;
  }
  const surface = event.currentTarget as HTMLElement;
  const rect = surface.getBoundingClientRect();
  if (event.clientY > rect.top + 64) return;
  pointerId = event.pointerId;
  pointerStartY = event.clientY;
  pointerStartProgress = sheetProgress.value;
  pointerStartedAt = performance.now();
  surface.setPointerCapture(event.pointerId);
};

const onSurfacePointerMove = (event: PointerEvent) => {
  if (pointerId !== event.pointerId) return;
  event.preventDefault();
  const delta = Math.max(0, event.clientY - pointerStartY);
  playerTransition.setSheetProgress(
    pointerStartProgress - delta / Math.max(240, window.innerHeight * 0.5)
  );
};

const releasePointer = (event: PointerEvent) => {
  const target = event.currentTarget as HTMLElement;
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
  pointerId = null;
};

const onSurfacePointerUp = (event: PointerEvent) => {
  if (pointerId !== event.pointerId) return;
  const delta = Math.max(0, event.clientY - pointerStartY);
  const velocity = delta / Math.max(1, performance.now() - pointerStartedAt);
  releasePointer(event);
  if (sheetProgress.value < 0.72 || velocity > 0.55) closePanel();
  else playerTransition.animateSheet(1);
};

const onSurfacePointerCancel = (event: PointerEvent) => {
  if (pointerId !== event.pointerId) return;
  releasePointer(event);
  playerTransition.animateSheet(1);
};
</script>

<style scoped lang="scss">
.shared-player-bottom-layer {
  position: fixed;
  inset: 0;
  z-index: 100100;
  overflow: visible;
  pointer-events: none;
  transition:
    opacity 180ms ease,
    color 220ms ease;
}

.shared-player-top-controls {
  position: absolute;
  top: calc(var(--safe-area-inset-top, 0px) + 10px);
  right: 14px;
  left: 14px;
  z-index: 4;
  display: flex;
  justify-content: space-between;
  opacity: 0;
  transform: translate3d(0, -8px, 0);
  transition:
    opacity 180ms ease,
    transform 220ms cubic-bezier(0.32, 0.72, 0, 1);
  pointer-events: none;
}

.shared-player-top-controls.visible {
  opacity: 1;
  transform: translate3d(0, 0, 0);
  pointer-events: auto;
}

.shared-player-top-controls button {
  display: grid;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgba(var(--player-ink-rgb, 255, 255, 255), 0.1);
  color: var(--player-icon-color, var(--player-ink, #fff));
  font-size: 24px;
  place-items: center;
}

.shared-player-top-controls button:active {
  transform: scale(0.92);
}

.shared-player-scrim {
  position: absolute;
  inset: 0;
  border: 0;
  background: #000;
  pointer-events: auto;
}

.shared-player-bottom-surface {
  position: absolute;
  right: 14px;
  left: 14px;
  bottom: calc(var(--safe-area-inset-bottom, 0px) + 14px);
  display: grid;
  overflow: visible;
  border: 1px solid var(--player-glass-border, rgba(255, 255, 255, 0.1));
  background: var(--player-glass-background, rgba(18, 18, 20, 0.2));
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.08);
  backdrop-filter: var(--player-glass-filter, blur(12px) saturate(145%));
  -webkit-backdrop-filter: var(--player-glass-filter, blur(12px) saturate(145%));
  --m-text-primary: rgba(var(--player-ink-rgb, 255, 255, 255), 0.94);
  --m-text-secondary: rgba(var(--player-ink-rgb, 255, 255, 255), 0.76);
  --m-text-muted: rgba(var(--player-ink-rgb, 255, 255, 255), 0.58);
  --cover-text-primary: rgba(var(--player-ink-rgb, 255, 255, 255), 0.94);
  --cover-text-muted: rgba(var(--player-ink-rgb, 255, 255, 255), 0.62);
  --d-text-primary: rgba(var(--player-ink-rgb, 255, 255, 255), 0.94);
  --d-text-secondary: rgba(var(--player-ink-rgb, 255, 255, 255), 0.62);
  --text-color: rgba(var(--player-ink-rgb, 255, 255, 255), 0.94);
  color: rgba(var(--player-ink-rgb, 255, 255, 255), 0.94);
  transform-origin: right bottom;
  contain: layout style;
  will-change: transform, opacity;
  pointer-events: auto;
  isolation: isolate;
  transition:
    border-color var(--player-glass-feedback-duration, 220ms) ease,
    background-color var(--player-glass-feedback-duration, 220ms) ease,
    box-shadow var(--player-glass-feedback-duration, 220ms) ease,
    transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
}

.shared-player-bottom-surface.player-transitioning {
  border-color: transparent;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  transition: none;
}

.shared-player-bottom-surface.controls-mode:not(.player-transitioning) {
  border-color: transparent;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.shared-player-bottom-surface.controls-mode.player-transitioning {
  border-color: transparent;
}

.shared-player-bottom-surface.surface-interaction-active {
  border-color: var(--player-glass-border-active, rgba(255, 255, 255, 0.38));
  background: var(--player-glass-background-active, rgba(24, 24, 26, 0.28));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    0 10px 22px rgba(0, 0, 0, 0.14);
}

@supports not (backdrop-filter: blur(1px)) {
  .shared-player-bottom-surface {
    background: var(--player-glass-background-fallback, rgba(24, 24, 26, 0.52));
  }
}

.lyric-selection-actions {
  display: grid;
  width: 100%;
  height: 100%;
  grid-template-columns: 1fr 1fr;
  align-items: end;
  gap: 10px;
  padding: 8px 0 0;
}

.lyric-selection-actions button {
  display: grid;
  min-width: 0;
  width: 52px;
  height: 52px;
  justify-self: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: rgba(255, 255, 255, 0.94);
  font-size: 25px;
  place-items: center;
}

.lyric-selection-actions button.primary {
  background: transparent;
  color: color-mix(in srgb, var(--accent-color, #fff) 72%, #fff);
}

.lyric-selection-actions button:disabled {
  opacity: 0.38;
}

.shared-controls-pane,
.shared-sheet-pane {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: stretch;
  will-change: transform, opacity;
  z-index: 1;
}

.shared-sheet-pane {
  align-items: stretch;
}

.shared-sheet-pane :deep(.playlist-panel.embedded) {
  inset: 0 !important;
}

.shared-sheet-pane :deep(.playlist-panel.embedded .playlist-panel-content) {
  height: calc(100% - 42px);
}

.shared-sheet-pane :deep(.playlist-panel-header .title),
.shared-sheet-pane :deep(.playlist-panel-header .action-btn),
.shared-sheet-pane :deep(.playlist-panel-header .close-btn),
.shared-sheet-pane :deep(.music-play-list-content),
.shared-sheet-pane :deep(.music-play-list-content .text-gray-800),
.shared-sheet-pane :deep(.music-play-list-content .dark\:text-gray-200) {
  color: rgba(var(--player-ink-rgb, 255, 255, 255), 0.9) !important;
}

.shared-sheet-pane :deep(.music-play-list-content .text-gray-500),
.shared-sheet-pane :deep(.music-play-list-content .text-gray-400) {
  color: rgba(var(--player-ink-rgb, 255, 255, 255), 0.58) !important;
}

@media (orientation: landscape) {
  .shared-player-bottom-surface {
    right: calc(var(--safe-area-inset-right, 0px) + 14px);
    left: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .shared-player-bottom-layer {
    transition-duration: 160ms;
  }

  .shared-player-bottom-surface {
    transition-duration: 100ms;
  }

  .shared-player-top-controls {
    transition: opacity 100ms linear;
    transform: none;
  }
}
</style>
