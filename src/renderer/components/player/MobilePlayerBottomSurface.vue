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
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import MobileControlsArea from '@/components/lyric/MobileControlsArea.vue';
import { useLyricSelectionSurface } from '@/composables/useLyricSelectionSurface';
import { useMobilePlayerTransition } from '@/composables/useMobilePlayerTransition';
import { usePlayerSurfaceFeedback } from '@/composables/usePlayerSurfaceFeedback';
import { usePosterTransitionOrigin } from '@/composables/usePosterTransitionOrigin';
import { registerMobileBackLayer } from '@/services/mobileBackStack';
import { usePlayerStore } from '@/store/modules/player';

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
onMounted(() => {
  updateSafeBottomInset();
  unregisterSurfaceBackLayer = registerMobileBackLayer({
    id: 'player-shared-surface-panel',
    priority: 620,
    isActive: () => playerStore.musicFull && surfaceMode.value !== 'controls',
    onBack: closePanel
  });
});
onBeforeUnmount(() => unregisterSurfaceBackLayer?.());
watch([viewportWidth, viewportHeight], updateSafeBottomInset);

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
  const playerProgress = lyricSelection.active.value ? 1 : playerTransition.progress.value;
  const landscape = isLandscape.value;
  const controlHeight = lyricSelection.active.value ? 88 : landscape ? 154 : 168;
  const panelHeight = landscape
    ? viewportHeight.value - 28
    : Math.min(viewportHeight.value * 0.68, 560);
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
    transform: 'none',
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

const closePanel = () => {
  if (surfaceMode.value === 'playlist') playerStore.setPlayListDrawerVisible(false);
  playerTransition.setSurfaceMode('controls');
};

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
  overflow: visible;
  border: 1px solid var(--player-glass-border, rgba(255, 255, 255, 0.1));
  background: var(--player-glass-background, rgba(18, 18, 20, 0.2));
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.08);
  backdrop-filter: var(--player-glass-filter, blur(12px) saturate(145%));
  -webkit-backdrop-filter: var(--player-glass-filter, blur(12px) saturate(145%));
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
  contain: layout style;
  will-change: transform, opacity;
  pointer-events: auto;
  isolation: isolate;
  transition:
    border-color var(--player-glass-feedback-duration, 220ms) ease,
    background-color var(--player-glass-feedback-duration, 220ms) ease,
    box-shadow var(--player-glass-feedback-duration, 220ms) ease;
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

  .shared-player-bottom-surface {
    transition-duration: 100ms;
  }
}
</style>
