<template>
  <Teleport to="#layout-main">
    <section
      v-if="isVisible"
      id="mobile-drawer-target"
      ref="surfaceRef"
      class="default-player-v2 player-style-surface"
      :class="{
        landscape: isLandscape,
        'lyrics-expanded': lyricsExpanded,
        'custom-background': customBackgroundActive,
        'player-transitioning': playerTransitionBusy
      }"
      :style="{ ...surfaceStyle, ...lyricsSwipeStyle }"
      @click="handleTapToggle"
      @pointerdown.capture="onLyricsSwipePointerDown"
      @pointermove.capture="onLyricsSwipePointerMove"
      @pointerup.capture="onLyricsSwipePointerUp"
      @pointercancel.capture="onLyricsSwipePointerCancel"
      @touchstart="onTouchStart"
      @touchend="onTouchEnd"
    >
      <div v-if="playMusic?.playLoading" class="loading-state" aria-live="polite">
        <i class="ri-loader-4-line"></i>
      </div>

      <main class="player-content">
        <div
          v-if="!lyricsExpanded || lyricsSwipePreview"
          class="artwork-zone"
          :style="lyricsUnderlayStyle"
        >
          <default-player-artwork
            :source="coverUrl"
            :title="playMusic?.name || 'Zephyrus'"
            mode="full"
            :playing="isPlaying"
            :style="artworkTransitionStyle"
          />
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
</template>

<script setup lang="ts">
import { useWindowSize } from '@vueuse/core';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { useLyricSwipeGesture } from '@/composables/useLyricSwipeGesture';
import { useMobilePlayerTransition } from '@/composables/useMobilePlayerTransition';
import { usePlayerStyleAppearance } from '@/composables/usePlayerStyleAppearance';
import { useSwipeClose } from '@/composables/useSwipeClose';
import { useTapToggle } from '@/composables/useTapToggle';
import { lrcArray, playMusic, textColors } from '@/hooks/MusicHook';
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
import MobileScrollingLyrics from './MobileScrollingLyrics.vue';

const props = defineProps<{
  modelValue?: boolean;
  background?: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();
const { t } = useI18n();
const playerStore = usePlayerStore();
const playerTransition = useMobilePlayerTransition();
const { handleTapToggle } = useTapToggle();
const { width, height } = useWindowSize();
const { styleVars, customBackgroundActive, background, backgroundColor } =
  usePlayerStyleAppearance('default');

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
  display: grid;
  min-height: 0;
  padding: 8px 20px 12px;
  place-items: center;
  transition:
    opacity 260ms ease,
    transform 380ms cubic-bezier(0.32, 0.72, 0, 1);
}

.lyrics-zone {
  min-height: 0;
  overflow: hidden;
  transition:
    transform 380ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 260ms ease;
}

.lyrics-zone.expanded {
  grid-row: 1 / -1;
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

.lyrics-expanded .artwork-zone {
  opacity: 0;
  transform: translate3d(0, -18px, 0) scale(0.98);
  pointer-events: none;
}

.shared-controls-spacer {
  height: calc(168px + var(--safe-area-inset-bottom, 0px));
  pointer-events: none;
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

.landscape .shared-controls-spacer {
  height: calc(154px + var(--safe-area-inset-bottom, 0px));
}

.landscape .player-content {
  grid-template-rows: minmax(0, 1fr);
  grid-template-columns: minmax(240px, 42%) minmax(0, 1fr);
  padding: 0 max(18px, var(--safe-area-inset-right, 0px)) 0
    max(18px, var(--safe-area-inset-left, 0px));
}

.landscape .artwork-zone {
  padding: 8px 24px;
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
