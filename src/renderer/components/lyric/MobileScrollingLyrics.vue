<template>
  <div
    ref="rootRef"
    class="scrolling-lyrics amll-scrolling-lyrics"
    :class="[
      config.theme,
      `align-${lyricAlignment}`,
      {
        'select-mode': selectMode,
        'is-interacting': isPointerScrolling,
        'android-lite': androidNative
      }
    ]"
    @click.capture="handleCaptureClick"
    @pointerdown.capture="handlePointerDown"
    @pointermove.capture="handlePointerMove"
    @pointerup.capture="handlePointerEnd"
    @pointercancel.capture="handlePointerCancel"
    @touchend.capture="handleTouchEndCapture"
  >
    <Transition name="lyrics-loading">
      <div
        v-if="showPreparingOverlay && hasSourceLyrics"
        class="lyrics-loading-overlay"
        aria-live="polite"
      >
        <i class="ri-loader-4-line" aria-hidden="true"></i>
      </div>
    </Transition>

    <lyric-player
      v-if="renderAmllPlayer"
      ref="playerRef"
      class="amll-player"
      :lyric-lines="amllLines"
      :current-time="currentTimeMs"
      :disabled="amllDisabled"
      :playing="isPlaying && !amllDisabled"
      align-anchor="center"
      :align-position="0.48"
      :enable-spring="springEnabled"
      :enable-blur="blurEnabled"
      :enable-scale="!androidNative && !reduceMotion"
      :word-fade-width="1"
      :optimize-options="optimizeOptions"
      @line-click="handleLineClick"
      @line-contextmenu="handleLineContextMenu"
    />

    <div v-else-if="hasSourceLyrics" class="lyric-transition-placeholder" aria-hidden="true">
      {{ transitionLyricText }}
    </div>

    <button
      v-else
      type="button"
      class="empty-lyrics"
      :aria-label="t('player.lrc.noLrc')"
      @click.stop="emit('close')"
    >
      {{ t('player.lrc.noLrc') }}
    </button>

    <Transition name="toast">
      <div v-if="toastMsg" class="lyric-toast">
        <i class="ri-information-line"></i>
        <span>{{ toastMsg }}</span>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import '@applemusic-like-lyrics/core/style.css';

import type { LyricLine, LyricLineMouseEvent } from '@applemusic-like-lyrics/core';
import { LyricPlayer, type LyricPlayerRef } from '@applemusic-like-lyrics/vue';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { useLyricSelectionSurface } from '@/composables/useLyricSelectionSurface';
import { useMobilePlayerTransition } from '@/composables/useMobilePlayerTransition';
import { useWordTimedPlayback } from '@/composables/useWordTimedPlayback';
import { sound } from '@/hooks/MusicHook';
import { isAndroidNative } from '@/services/androidNative';
import { registerMobileBackLayer } from '@/services/mobileBackStack';
import { usePlayerStore } from '@/store/modules/player';
import { DEFAULT_LYRIC_CONFIG, type LyricConfig, normalizeLyricAlignment } from '@/types/lyric';
import type { SelectedLyric } from '@/types/share';
import {
  lyricLineText,
  MOBILE_AMLL_OPTIMIZE_OPTIONS,
  providerLyricsToAmll,
  ttmlLyricsToAmll
} from '@/utils/amllLyricAdapter';

let scrollingLyricsInstanceId = 0;

const props = withDefaults(defineProps<{ backCloses?: boolean }>(), {
  backCloses: false
});
const emit = defineEmits<{ close: []; interact: []; generatePoster: [lyrics: SelectedLyric[]] }>();
const { t } = useI18n();
const playerStore = usePlayerStore();
const playback = useWordTimedPlayback();
const lyricSelection = useLyricSelectionSurface();
const playerTransition = useMobilePlayerTransition();
const selectionOwner = Symbol('amll-mobile-scrolling-lyrics');
const playerRef = ref<LyricPlayerRef | null>(null);
const rootRef = ref<HTMLElement | null>(null);
const config = ref<LyricConfig>({ ...DEFAULT_LYRIC_CONFIG });
const reduceMotion = ref(false);
const isIntersecting = ref(true);
const pageVisible = ref(!document.hidden);
const hasMountedPlayer = ref(false);
const showPreparingOverlay = ref(false);
const isPointerScrolling = ref(false);
const selectMode = ref(false);
const selectedSet = ref<Set<number>>(new Set());
const toastMsg = ref('');
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let motionQuery: MediaQueryList | null = null;
let visibilityObserver: IntersectionObserver | null = null;
let longPressTimer: ReturnType<typeof setTimeout> | null = null;
let pointerId: number | null = null;
let pointerStartX = 0;
let pointerStartY = 0;
let longPressTarget: HTMLElement | null = null;
let longPressSourceIndex: number | null = null;
let longPressTriggered = false;
let suppressLineClickUntil = 0;
let mountTimer: ReturnType<typeof setTimeout> | null = null;
let mountIdleCallback = 0;
let unregisterBackLayer: (() => void) | null = null;
const androidNative = isAndroidNative();
const backLayerId = `mobile-scrolling-lyrics-${++scrollingLyricsInstanceId}`;

const optimizeOptions = MOBILE_AMLL_OPTIMIZE_OPTIONS;

const currentTimeMs = computed(() => Math.max(0, Math.round(playback.correctedTime.value * 1000)));
const isPlaying = computed(() => playerStore.isPlaying);
const lyricAlignment = computed(() =>
  normalizeLyricAlignment(config.value.lyricAlignment, config.value.centerLyrics)
);
const transitionSettled = computed(
  () =>
    playerTransition.state.value === 'open' ||
    (playerTransition.state.value === 'idle' && playerStore.musicFull)
);
const amllDisabled = computed(
  () => !transitionSettled.value || !isIntersecting.value || !pageVisible.value
);
const springEnabled = computed(() => !reduceMotion.value);
const blurEnabled = computed(
  () => !androidNative && !reduceMotion.value && !isPointerScrolling.value && !amllDisabled.value
);
const allAmllLines = computed<LyricLine[]>(() => {
  if (playback.usingTtml.value && playback.lyric.value) {
    return ttmlLyricsToAmll(playback.lyric.value);
  }
  return providerLyricsToAmll(playback.displayLines.value);
});
const hasSourceLyrics = computed(
  () => playback.displayLines.value.length > 0 || Boolean(playback.lyric.value?.lines.length)
);
const amllLines = computed(() =>
  allAmllLines.value.map((line) => ({
    ...line,
    translatedLyric: config.value.showTranslation ? line.translatedLyric : '',
    romanLyric: config.value.showRomanization ? line.romanLyric : ''
  }))
);
const renderAmllPlayer = computed(() => hasMountedPlayer.value && amllLines.value.length > 0);
const transitionLyricText = computed(
  () =>
    playback.currentDisplayLine.value?.text ||
    playback.displayLines.value[0]?.text ||
    playback.lyric.value?.lines[0]?.words.map((word) => word.word).join('') ||
    ''
);
const selectableIndices = computed(() =>
  amllLines.value
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => !line.isBG && lyricLineText(line))
    .map(({ index }) => index)
);
const isAllSelected = computed(
  () =>
    selectableIndices.value.length > 0 && selectedSet.value.size === selectableIndices.value.length
);

function loadConfig() {
  try {
    const next = {
      ...DEFAULT_LYRIC_CONFIG,
      ...JSON.parse(localStorage.getItem('music-full-config') || '{}')
    };
    next.lyricAlignment = normalizeLyricAlignment(next.lyricAlignment, next.centerLyrics);
    config.value = next;
  } catch {
    config.value = { ...DEFAULT_LYRIC_CONFIG };
  }
}

type AmllLineHandle = {
  getElement?: () => HTMLElement;
  getLine?: () => { __zephyrusSourceIndex?: number };
};

function getAmllLineHandle(line: LyricLineMouseEvent['line']): AmllLineHandle {
  return line as unknown as AmllLineHandle;
}

function sourceIndexForEvent(event: LyricLineMouseEvent): number {
  return getAmllLineHandle(event.line).getLine?.().__zephyrusSourceIndex ?? event.lineIndex;
}

function elementForEvent(event: LyricLineMouseEvent): HTMLElement | null {
  return getAmllLineHandle(event.line).getElement?.() ?? null;
}

function seekToLine(index: number) {
  const line = amllLines.value[index];
  if (!line || !sound.value) return;
  sound.value.seek(line.startTime / 1000);
  sound.value.play();
  playerRef.value?.lyricPlayer?.resetScroll();
  emit('interact');
}

function handleLineClick(event: LyricLineMouseEvent) {
  event.stopPropagation();
  if (performance.now() < suppressLineClickUntil) return;
  const sourceIndex = sourceIndexForEvent(event);
  if (selectMode.value) {
    toggleSelection(sourceIndex, elementForEvent(event));
    return;
  }
  seekToLine(sourceIndex);
}

function handleLineElementClick(lineElement: HTMLElement) {
  const sourceIndex = sourceIndexForElement(lineElement);
  if (sourceIndex === null) return;
  if (selectMode.value) {
    toggleSelection(sourceIndex, mainLineElementFor(lineElement));
    return;
  }
  seekToLine(sourceIndex);
}

function handleLineContextMenu(event: LyricLineMouseEvent) {
  event.preventDefault();
  event.stopPropagation();
  if (navigator.vibrate) navigator.vibrate(30);
  const sourceIndex = sourceIndexForEvent(event);
  if (!selectMode.value) enterSelectMode(sourceIndex, elementForEvent(event));
  else toggleSelection(sourceIndex, elementForEvent(event));
}

function handleSurfaceClick() {
  if (selectMode.value) exitSelectMode();
  else emit('close');
}

function lyricHitTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const line = target.closest<HTMLElement>('.FmKaba_lyricLine');
  if (!line || !rootRef.value?.contains(line)) return null;
  return line;
}

const lyricTextSelector = '.FmKaba_lyricMainLine, .FmKaba_lyricSubLine';

function isLyricTextTarget(target: EventTarget | null, line: HTMLElement): boolean {
  if (!(target instanceof Element) || target === line) return false;
  const textContainer = target.closest<HTMLElement>(lyricTextSelector);
  return Boolean(textContainer && line.contains(textContainer));
}

function mainLineElementFor(lineElement: HTMLElement): HTMLElement {
  if (!lineElement.classList.contains('FmKaba_lyricBgLine')) return lineElement;
  return (
    lineElement
      .closest<HTMLElement>('.FmKaba_lyricLineWrapper')
      ?.querySelector<HTMLElement>('.FmKaba_lyricLine:not(.FmKaba_lyricBgLine)') || lineElement
  );
}

function handleCaptureClick(event: MouseEvent) {
  if (performance.now() < suppressLineClickUntil) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  const line = lyricHitTarget(event.target);
  if (line) {
    // AMLL rows fill the available width. Only text descendants seek; row
    // padding is the explicit return target for the expanded lyric surface.
    event.preventDefault();
    event.stopPropagation();
    if (isLyricTextTarget(event.target, line)) handleLineElementClick(line);
    else if (!selectMode.value) emit('close');
    return;
  }
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest('.amll-player')) {
    // Keep player-surface clicks from reaching the outer player toggle when
    // AMLL is between DOM rebuilds. The next stable click is handled by AMLL.
    event.stopPropagation();
    return;
  }
  event.stopPropagation();
  handleSurfaceClick();
}

function clearLongPress() {
  if (longPressTimer) clearTimeout(longPressTimer);
  longPressTimer = null;
  pointerId = null;
  longPressTarget = null;
  longPressSourceIndex = null;
  isPointerScrolling.value = false;
}

function handlePointerDown(event: PointerEvent) {
  if (!event.isPrimary) return;
  isPointerScrolling.value = true;
  pointerStartX = event.clientX;
  pointerStartY = event.clientY;
  longPressTriggered = false;
  const targetLine = lyricHitTarget(event.target);
  // Blank row padding is a return target, never a long-press selection target.
  if (!targetLine || !isLyricTextTarget(event.target, targetLine)) {
    clearLongPress();
    return;
  }
  longPressTarget = targetLine;
  longPressSourceIndex = sourceIndexForElement(longPressTarget);
  if (longPressSourceIndex === null) {
    clearLongPress();
    return;
  }
  pointerId = event.pointerId;
  try {
    rootRef.value?.setPointerCapture(event.pointerId);
  } catch {
    // Pointer capture is unavailable in a few embedded WebView versions.
  }
  longPressTimer = setTimeout(() => {
    const sourceIndex = longPressSourceIndex;
    if (sourceIndex === null) return;
    longPressTriggered = true;
    suppressLineClickUntil = performance.now() + 700;
    if (navigator.vibrate) navigator.vibrate(30);
    const currentElement = elementForSourceIndex(sourceIndex);
    if (!selectMode.value) enterSelectMode(sourceIndex, currentElement);
    else toggleSelection(sourceIndex, currentElement);
  }, 520);
}

function handlePointerMove(event: PointerEvent) {
  if (event.pointerId !== pointerId) return;
  if (Math.hypot(event.clientX - pointerStartX, event.clientY - pointerStartY) > 10) {
    if (longPressTimer) clearTimeout(longPressTimer);
    longPressTimer = null;
    longPressTarget = null;
    longPressSourceIndex = null;
  }
}

function handlePointerEnd(event: PointerEvent) {
  if (event.pointerId !== pointerId) return;
  if (!longPressTriggered) {
    releasePointerCapture(event.pointerId);
    clearLongPress();
  } else {
    releasePointerCapture(event.pointerId);
    if (longPressTimer) clearTimeout(longPressTimer);
    longPressTimer = null;
    pointerId = null;
    longPressTarget = null;
    longPressSourceIndex = null;
    isPointerScrolling.value = false;
  }
}

function handlePointerCancel(event: PointerEvent) {
  if (event.pointerId === pointerId) {
    releasePointerCapture(event.pointerId);
    clearLongPress();
  }
}

function releasePointerCapture(id: number) {
  try {
    if (rootRef.value?.hasPointerCapture(id)) rootRef.value.releasePointerCapture(id);
  } catch {
    // Pointer capture may already have been released by the browser.
  }
}

function handleTouchEndCapture(event: TouchEvent) {
  if (!longPressTriggered) return;
  event.preventDefault();
  event.stopPropagation();
  longPressTriggered = false;
}

function enterSelectMode(initialIndex: number, element?: HTMLElement | null) {
  const line = amllLines.value[initialIndex];
  if (!line || line.isBG || !lyricLineText(line)) return;
  selectMode.value = true;
  selectedSet.value = new Set([initialIndex]);
  if (element) element.dataset.lyricSelected = 'true';
  lyricSelection.begin(
    selectionOwner,
    {
      onCancel: exitSelectMode,
      onToggleAll: toggleSelectAll,
      onCopy: handleCopyLyrics,
      onGeneratePoster: handleGeneratePoster
    },
    { selectedCount: 1, allSelected: false }
  );
  playerTransition.setSurfaceMode('controls');
  playerTransition.showControls(false);
  emit('interact');
}

function exitSelectMode() {
  clearSelectionDecorations();
  selectMode.value = false;
  selectedSet.value = new Set();
  lyricSelection.end(selectionOwner);
  playerTransition.showControls();
}

function updateSelectionSurface() {
  lyricSelection.update(selectionOwner, {
    selectedCount: selectedSet.value.size,
    allSelected: isAllSelected.value
  });
}

function currentAmllLineHandles(): AmllLineHandle[] {
  const player = playerRef.value?.lyricPlayer as unknown as {
    currentLyricGroups?: Array<{ mainLine?: AmllLineHandle }>;
  } | null;
  return (player?.currentLyricGroups || [])
    .map((group) => group.mainLine)
    .filter((line): line is AmllLineHandle => Boolean(line));
}

function sourceIndexForElement(element: HTMLElement): number | null {
  const mainElement = mainLineElementFor(element);
  for (const line of currentAmllLineHandles()) {
    if (line.getElement?.() !== mainElement) continue;
    const index = line.getLine?.().__zephyrusSourceIndex;
    return index === undefined ? null : index;
  }
  return null;
}

function elementForSourceIndex(sourceIndex: number): HTMLElement | null {
  for (const line of currentAmllLineHandles()) {
    if (line.getLine?.().__zephyrusSourceIndex === sourceIndex) return line.getElement?.() ?? null;
  }
  return null;
}

function syncSelectionDecorations() {
  for (const line of currentAmllLineHandles()) {
    const index = line.getLine?.().__zephyrusSourceIndex;
    const element = line.getElement?.();
    if (index === undefined || !element) continue;
    if (selectMode.value && selectedSet.value.has(index)) element.dataset.lyricSelected = 'true';
    else delete element.dataset.lyricSelected;
  }
}

function clearSelectionDecorations() {
  for (const line of currentAmllLineHandles()) {
    const element = line.getElement?.();
    if (element) delete element.dataset.lyricSelected;
  }
}

function toggleSelection(index: number, element?: HTMLElement | null) {
  const line = amllLines.value[index];
  if (!line || line.isBG || !lyricLineText(line)) return;
  const next = new Set(selectedSet.value);
  if (next.has(index)) next.delete(index);
  else next.add(index);
  selectedSet.value = next;
  if (element) {
    if (next.has(index)) element.dataset.lyricSelected = 'true';
    else delete element.dataset.lyricSelected;
  }
  updateSelectionSurface();
}

function toggleSelectAll() {
  selectedSet.value = isAllSelected.value ? new Set() : new Set(selectableIndices.value);
  syncSelectionDecorations();
  updateSelectionSurface();
}

function selectedLyrics(): SelectedLyric[] {
  return [...selectedSet.value]
    .sort((a, b) => a - b)
    .map((index) => {
      const line = amllLines.value[index];
      return {
        index,
        text: lyricLineText(line),
        trText: line.translatedLyric || undefined
      };
    });
}

function handleCopyLyrics() {
  const text = selectedLyrics()
    .flatMap((line) => [line.text, line.trText].filter(Boolean))
    .join('\n');
  void navigator.clipboard?.writeText(text);
  exitSelectMode();
}

function handleGeneratePoster() {
  const selected = selectedLyrics();
  const lyrics = selected.slice(0, 12);
  emit('generatePoster', lyrics);
  if (selected.length > lyrics.length) {
    toastMsg.value = t('player.share.lyricsTruncated') || '选中内容过长，已截断至12句';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastMsg.value = ''), 3000);
  }
  exitSelectMode();
}

function handleConfigUpdate() {
  loadConfig();
}

function handleMotionChange(event: MediaQueryListEvent | MediaQueryList) {
  reduceMotion.value = event.matches;
}

function handleVisibilityChange() {
  pageVisible.value = !document.hidden;
}

function cancelDeferredMount() {
  if (mountTimer) clearTimeout(mountTimer);
  mountTimer = null;
  if (mountIdleCallback && 'cancelIdleCallback' in window) {
    window.cancelIdleCallback(mountIdleCallback);
  }
  mountIdleCallback = 0;
}

function mountPlayerWhenIdle() {
  if (!transitionSettled.value || hasMountedPlayer.value) return;
  showPreparingOverlay.value = true;
  // Let the loading surface paint before AMLL creates its lyric tree. One
  // frame is enough; waiting for browser idle can leave the user staring at a
  // blank lyric area for hundreds of milliseconds on a busy Android WebView.
  requestAnimationFrame(() => {
    if (!transitionSettled.value) {
      showPreparingOverlay.value = false;
      return;
    }
    hasMountedPlayer.value = true;
    showPreparingOverlay.value = false;
  });
}

watch(
  transitionSettled,
  (settled) => {
    cancelDeferredMount();
    if (!settled || hasMountedPlayer.value) return;

    // Paint the loading surface first, then mount AMLL on the next frame. The
    // previous Android-specific 320ms delay plus requestIdleCallback made the
    // first lyric view feel unresponsive even when the device was otherwise
    // idle.
    showPreparingOverlay.value = hasSourceLyrics.value;
    mountTimer = setTimeout(
      () => {
        mountTimer = null;
        if (!transitionSettled.value) return;
        mountPlayerWhenIdle();
      },
      androidNative ? 0 : 16
    );
  },
  { immediate: true }
);

onMounted(() => {
  unregisterBackLayer = registerMobileBackLayer({
    id: backLayerId,
    // Keep settings (520) above lyrics, while still taking precedence over
    // the player-level fallback layer (500).
    priority: 510,
    isActive: () => props.backCloses,
    onBack: () => {
      emit('close');
      return true;
    }
  });
  loadConfig();
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  handleMotionChange(motionQuery);
  motionQuery.addEventListener('change', handleMotionChange);
  visibilityObserver = new IntersectionObserver(
    ([entry]) => {
      isIntersecting.value = entry?.isIntersecting ?? true;
    },
    { threshold: 0.01 }
  );
  if (rootRef.value) visibilityObserver.observe(rootRef.value);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('music-full-config-updated', handleConfigUpdate);
});

onBeforeUnmount(() => {
  unregisterBackLayer?.();
  unregisterBackLayer = null;
  cancelDeferredMount();
  if (toastTimer) clearTimeout(toastTimer);
  clearLongPress();
  lyricSelection.end(selectionOwner);
  visibilityObserver?.disconnect();
  motionQuery?.removeEventListener('change', handleMotionChange);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('music-full-config-updated', handleConfigUpdate);
});
</script>

<style scoped>
.scrolling-lyrics {
  position: relative;
  z-index: 10;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  contain: layout paint style;
  touch-action: pan-y;
}

.lyrics-loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--player-style-background, #111) 42%, transparent);
  color: var(--player-ink, #fff);
  pointer-events: none;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.lyrics-loading-overlay i {
  font-size: 28px;
  animation: lyrics-loading-spin 720ms linear infinite;
}

.lyrics-loading-enter-active,
.lyrics-loading-leave-active {
  transition: opacity 160ms ease;
}

.lyrics-loading-enter-from,
.lyrics-loading-leave-to {
  opacity: 0;
}

@keyframes lyrics-loading-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .lyrics-loading-overlay i {
    animation: none;
  }
}

.amll-player {
  width: 100%;
  height: 100%;
  --amll-lp-color: var(
    --player-style-custom-main-color,
    var(--text-color-active, var(--player-ink, #fff))
  );
  --amll-lp-font-size: clamp(20px, 6.5vw, 36px);
  --amll-lp-hover-bg-color: rgba(var(--player-ink-rgb, 255, 255, 255), 0.08);
  --amll-lp-line-width-aspect: 0.9;
}

.lyric-transition-placeholder {
  display: grid;
  width: 100%;
  height: 100%;
  padding: 24px;
  color: var(--player-style-custom-main-color, var(--text-color-active, var(--player-ink, #fff)));
  font-size: clamp(20px, 6.5vw, 36px);
  font-weight: 650;
  opacity: 0.92;
  place-items: center;
}

:deep(.FmKaba_lyricLineWrapper) {
  /* Keep the entire row tappable, including translation and empty padding. */
  pointer-events: auto;
}

:deep(.FmKaba_lyricLine) {
  pointer-events: auto;
}

:deep(.FmKaba_lyricMainLine span),
:deep(.FmKaba_lyricMainLine ruby),
:deep(.FmKaba_lyricMainLine rt) {
  pointer-events: auto;
}

.is-interacting :deep(.FmKaba_lyricLineWrapper),
.is-interacting :deep(.FmKaba_lyricLine),
.is-interacting :deep(.FmKaba_interludeDots) {
  filter: none !important;
  transition: none !important;
}

.align-left :deep(.FmKaba_lyricLineWrapper) {
  align-items: flex-start !important;
}

.align-center :deep(.FmKaba_lyricLineWrapper) {
  align-items: center !important;
}

.align-right :deep(.FmKaba_lyricLineWrapper) {
  align-items: flex-end !important;
}

.align-left :deep(.FmKaba_lyricLine) {
  text-align: left;
  transform-origin: left center;
}

.align-center :deep(.FmKaba_lyricLine) {
  text-align: center;
  transform-origin: center;
}

.align-right :deep(.FmKaba_lyricLine) {
  text-align: right;
  transform-origin: right center;
}

/* AMLL positions interludes independently from lyric lines. The individual
 * translate property composes with AMLL's inline transform, preserving its
 * vertical animation while following the configured horizontal alignment. */
.align-left :deep(.FmKaba_interludeDots) {
  right: auto !important;
  left: 0 !important;
  translate: var(--lyric-line-padding-x, 20px) 0;
}

.align-center :deep(.FmKaba_interludeDots) {
  right: auto !important;
  left: 50% !important;
  translate: -50% 0;
}

.align-right :deep(.FmKaba_interludeDots) {
  right: 0 !important;
  left: auto !important;
  translate: calc(-1 * var(--lyric-line-padding-x, 20px)) 0;
}

.light .amll-player {
  --amll-lp-color: var(--player-style-custom-main-color, var(--text-color-active, #171717));
}

.select-mode .amll-player {
  --amll-lp-hover-bg-color: rgba(var(--accent-color-rgb, 99, 102, 241), 0.18);
}

.select-mode :deep(.FmKaba_lyricLine[data-lyric-selected='true']) {
  border-radius: 0.34em;
  background-color: rgba(var(--player-ink-rgb, 255, 255, 255), 0.14);
  box-shadow: inset 0 0 0 1px rgba(var(--player-ink-rgb, 255, 255, 255), 0.08);
  transition:
    background-color 180ms ease-out,
    box-shadow 180ms ease-out;
}

.select-mode.align-left :deep(.FmKaba_lyricLine[data-lyric-selected='true']::after),
.select-mode.align-right :deep(.FmKaba_lyricLine[data-lyric-selected='true']::after) {
  content: '\2713';
  position: absolute;
  top: 50%;
  display: grid;
  width: 1.15em;
  height: 1.15em;
  border-radius: 50%;
  background: rgba(var(--player-ink-rgb, 255, 255, 255), 0.16);
  color: var(--player-ink, #fff);
  font-size: 0.56em;
  line-height: 1;
  opacity: 0.9;
  transform: translateY(-50%);
  place-items: center;
}

.select-mode.align-left :deep(.FmKaba_lyricLine[data-lyric-selected='true']::after) {
  right: 0.42em;
}

.select-mode.align-right :deep(.FmKaba_lyricLine[data-lyric-selected='true']::after) {
  left: 0.42em;
}

.empty-lyrics {
  display: grid;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--amll-lp-color, var(--player-ink, #fff));
  opacity: 0.48;
  place-items: center;
}

.lyric-toast {
  position: absolute;
  bottom: 18%;
  left: 50%;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: calc(100% - 40px);
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.76);
  color: #fff;
  font-size: 13px;
  transform: translateX(-50%);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 160ms ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
}

@media (orientation: landscape) {
  .amll-player {
    --amll-lp-font-size: clamp(18px, 4.2vw, 32px);
    --amll-lp-line-width-aspect: 0.82;
  }
}

@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active {
    transition: none;
  }
}
</style>
