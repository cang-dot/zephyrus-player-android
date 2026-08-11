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
          'panel-playlist': surfaceMode === 'playlist',
          'panel-settings': surfaceMode === 'settings'
        }"
        :style="surfaceStyle"
        @pointerdown="onSurfacePointerDown"
        @pointermove="onSurfacePointerMove"
        @pointerup="onSurfacePointerUp"
        @pointercancel="onSurfacePointerCancel"
      >
        <div class="shared-controls-pane" :style="controlsPaneStyle">
          <mobile-controls-area
            shared-surface
            :visible="controlsShown"
            @show-playlist="openPlaylist"
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
import type { CSSProperties } from 'vue';
import { computed, watch } from 'vue';

import MobileControlsArea from '@/components/lyric/MobileControlsArea.vue';
import { useMobilePlayerTransition } from '@/composables/useMobilePlayerTransition';
import { usePlayerStore } from '@/store/modules/player';

import MobilePlayerSettings from './MobilePlayerSettings.vue';
import PlayingListDrawer from './PlayingListDrawer.vue';

const playerStore = usePlayerStore();
const playerTransition = useMobilePlayerTransition();
const { width: viewportWidth, height: viewportHeight } = useWindowSize();
const isLandscape = useMediaQuery('(orientation: landscape)');

const surfaceMode = computed(() => playerTransition.surfaceMode.value);
const sheetProgress = computed(() => playerTransition.sheetProgress.value);
const panelMounted = computed(
  () => surfaceMode.value !== 'controls' || playerTransition.sheetProgress.value > 0.002
);
const surfaceMounted = computed(
  () => playerStore.musicFull || playerTransition.progress.value > 0.015
);
const controlsShown = computed(
  () => playerTransition.controlsVisible.value && surfaceMode.value === 'controls'
);
const chromeVisibility = computed(() => {
  const progressReveal = Math.min(1, Math.max(0, playerTransition.progress.value / 0.24));
  const controlsReveal =
    surfaceMode.value !== 'controls' || playerTransition.controlsVisible.value ? 1 : 0;
  return progressReveal * controlsReveal;
});

const layerStyle = computed<CSSProperties>(
  () =>
    ({
      '--shared-sheet-progress': String(sheetProgress.value),
      opacity: String(chromeVisibility.value)
    }) as CSSProperties
);

const surfaceStyle = computed<CSSProperties>(() => {
  const sheet = sheetProgress.value;
  const playerProgress = playerTransition.progress.value;
  const landscape = isLandscape.value;
  const baseHeight = 136;
  const targetHeight = landscape
    ? viewportHeight.value - 28
    : Math.min(viewportHeight.value * 0.68, 560);
  const height = baseHeight + (targetHeight - baseHeight) * sheet;
  const fullWidth = viewportWidth.value - 28;
  const targetWidth = landscape ? Math.min(viewportWidth.value * 0.48, 430) : fullWidth;
  const width = fullWidth + (targetWidth - fullWidth) * sheet;
  const safeBottom = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-bottom') || '0'
  );
  const finalLeft = landscape && sheet > 0 ? viewportWidth.value - width - safeBottom - 14 : 14;
  const finalTop = viewportHeight.value - safeBottom - 14 - height;
  const finalRadius = 26 + sheet * 4;
  const fallbackSource = {
    left: 14,
    top: viewportHeight.value - safeBottom - 126,
    width: fullWidth,
    height: 112,
    borderRadius: 32
  };
  const source = playerTransition.sourceRect.value || fallbackSource;
  const morphProgress = Math.min(1, Math.max(0, playerProgress));
  const lerp = (from: number, to: number) => from + (to - from) * morphProgress;
  return {
    top: `${lerp(source.top, finalTop)}px`,
    left: `${lerp(source.left, finalLeft)}px`,
    right: 'auto',
    bottom: 'auto',
    width: `${lerp(source.width, width)}px`,
    height: `${lerp(source.height, height)}px`,
    borderRadius: `${lerp(source.borderRadius, finalRadius)}px`,
    pointerEvents: chromeVisibility.value > 0.02 ? 'auto' : 'none'
  };
});

const controlsPaneStyle = computed<CSSProperties>(() => ({
  opacity: String(
    (1 - sheetProgress.value) *
      Math.min(1, Math.max(0, (playerTransition.progress.value - 0.28) / 0.48))
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

const closePanel = () => {
  if (surfaceMode.value === 'playlist') playerStore.setPlayListDrawerVisible(false);
  playerTransition.setSurfaceMode('controls');
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
  pointer-events: none;
  transition: opacity 180ms ease;
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
  overflow: hidden;
  border: 1px solid color-mix(in srgb, #fff 22%, transparent);
  background: color-mix(in srgb, var(--accent-color, #777) 10%, rgba(18, 18, 20, 0.58));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    0 14px 36px rgba(0, 0, 0, 0.24);
  backdrop-filter: blur(28px) saturate(170%);
  -webkit-backdrop-filter: blur(28px) saturate(170%);
  --m-text-primary: rgba(255, 255, 255, 0.94);
  --m-text-secondary: rgba(255, 255, 255, 0.76);
  --m-text-muted: rgba(255, 255, 255, 0.58);
  --cover-text-primary: rgba(255, 255, 255, 0.94);
  --cover-text-muted: rgba(255, 255, 255, 0.62);
  --d-text-primary: rgba(255, 255, 255, 0.94);
  --d-text-secondary: rgba(255, 255, 255, 0.62);
  --text-color: rgba(255, 255, 255, 0.94);
  color: rgba(255, 255, 255, 0.94);
  transform-origin: right bottom;
  will-change: width, height, border-radius, transform;
  pointer-events: auto;
}

.shared-controls-pane,
.shared-sheet-pane {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  will-change: transform, opacity;
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
  color: rgba(255, 255, 255, 0.9) !important;
}

.shared-sheet-pane :deep(.music-play-list-content .text-gray-500),
.shared-sheet-pane :deep(.music-play-list-content .text-gray-400) {
  color: rgba(255, 255, 255, 0.58) !important;
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
}
</style>
