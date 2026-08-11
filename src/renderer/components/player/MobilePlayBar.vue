<template>
  <div
    class="mobile-play-bar"
    :class="[
      setAnimationClass('animate__fadeInUp'),
      playerStore.musicFull ? 'play-bar-expanded' : 'play-bar-mini',
      shouldShowMobileMenu ? 'is-menu-show' : 'is-menu-hide',
      isCompactNav && shouldShowMobileMenu ? 'compact-nav' : '',
      idleCollapsed && !playerStore.musicFull ? 'idle-collapsed' : '',
      playlistSurfaceMounted && !playerStore.musicFull ? 'playlist-mounted' : '',
      playlistSurfaceExpanded && !playerStore.musicFull ? 'playlist-open' : ''
    ]"
    :style="{
      color: playerStore.musicFull
        ? textColors.theme === 'dark'
          ? '#ffffff'
          : '#ffffff'
        : settingsStore.theme === 'dark'
          ? '#ffffff'
          : '#000000'
    }"
  >
    <!-- 迷你模式 - musicFull 为 false 时显示 -->
    <div
      v-if="!playerStore.musicFull"
      class="mobile-mini-controls"
      :class="{
        'is-swipe-active': miniSwipeAxis === 'horizontal' || miniSwipeSwitching,
        'is-swipe-animating': miniSwipeAnimating
      }"
      :style="miniSwipeStyle"
      @click.capture="onMiniClickCapture"
      @pointerdown="onMiniPointerDown"
      @pointermove="onMiniPointerMove"
      @pointerup="onMiniPointerUp"
      @pointercancel="onMiniPointerCancel"
    >
      <!-- 歌曲信息 -->
      <div class="mini-song-info" :style="miniSongInfoStyle" @click="onMiniSongInfoClick">
        <n-image
          :src="getImgUrl(playMusic?.picUrl, '100y100')"
          class="mini-song-cover"
          lazy
          preview-disabled
          @click.stop="setMusicFull"
        />
        <div class="mini-song-text">
          <n-ellipsis line-clamp="1">
            <span class="mini-song-title">{{ playMusic.name }}</span>
            <span class="mx-2 text-gray-500 dark:text-gray-400">-</span>
            <span
              class="mini-song-artist"
              v-for="(artists, artistsindex) in artistList"
              :key="artistsindex"
            >
              {{ artists.name }}{{ artistsindex < artistList.length - 1 ? ' / ' : '' }}
            </span>
          </n-ellipsis>
        </div>
      </div>

      <div class="mini-playback-controls" :style="miniPlaybackControlsStyle" @pointerdown.stop>
        <div class="mini-control-btn play" role="button" tabindex="0" @click.stop="playMusicEvent">
          <i class="iconfont icon" :class="play ? 'icon-stop' : 'icon-play'"></i>
        </div>
        <i
          class="iconfont icon-list mini-list-icon"
          role="button"
          tabindex="0"
          @click.stop="openPlayListDrawer"
        ></i>
      </div>
    </div>

    <!-- 全屏播放器 -->
    <music-full-wrapper
      ref="MusicFullRef"
      v-model="playerSurfaceVisible"
      :background="background"
    />
  </div>
</template>

<script lang="ts" setup>
import type { CSSProperties, Ref } from 'vue';
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue';

import MusicFullWrapper from '@/components/lyric/MusicFullWrapper.vue';
import { useMobilePlayerTransition } from '@/composables/useMobilePlayerTransition';
import { artistList, playMusic, textColors } from '@/hooks/MusicHook';
import { usePlayerStore } from '@/store/modules/player';
import { useSettingsStore } from '@/store/modules/settings';
import { getImgUrl, setAnimationClass } from '@/utils';
import { shouldOpenMobilePlayer } from '@/utils/mobileGestureThresholds';

const shouldShowMobileMenu = inject('shouldShowMobileMenu') as Ref<boolean>;
const isCompactNav = inject('isCompactNav', ref(false)) as Ref<boolean>;
const playlistSurfaceMounted = inject('playlistSurfaceMounted', ref(false)) as Ref<boolean>;
const playlistSurfaceExpanded = inject('playlistSurfaceExpanded', ref(false)) as Ref<boolean>;
const emit = defineEmits<{
  (event: 'idle-collapse-change', collapsed: boolean): void;
}>();

const playerStore = usePlayerStore();
const settingsStore = useSettingsStore();
const idleCollapsed = ref(false);
const playerTransition = useMobilePlayerTransition();
let miniLongPressTimer: ReturnType<typeof setTimeout> | undefined;
let miniLongPressTriggered = false;
let miniPointerStartedCollapsed = false;

// 是否播放
const play = computed(() => playerStore.isPlay);
// 背景颜色
const background = ref('#000');

// 播放控制
function handleNext() {
  return playerStore.nextPlay();
}

function handlePrev() {
  return playerStore.prevPlay();
}

// 全屏播放器引用
const MusicFullRef = ref<any>(null);
const playerSurfaceVisible = computed({
  get: () => playerStore.musicFull || playerTransition.progress.value > 0.015,
  set: (visible: boolean) => {
    if (!visible && playerStore.musicFull) {
      playerTransition.setSurfaceMode('controls');
      playerStore.setMusicFull(false);
      playerTransition.animateTo(0);
    }
  }
});

const openMusicFull = (initialVelocity = 0) => {
  idleCollapsed.value = false;
  playerTransition.setDragging(Math.max(0.016, playerTransition.progress.value));
  playerStore.setMusicFull(true);
  requestAnimationFrame(() => playerTransition.animateTo(1, initialVelocity));
  settingsStore.showArtistDrawer = false;
};

// 设置 musicFull
const setMusicFull = () => {
  idleCollapsed.value = false;
  if (playerStore.musicFull) {
    playerStore.setMusicFull(false);
    playerTransition.animateTo(0);
    return;
  }
  openMusicFull(1.2);
};

const onMiniSongInfoClick = () => {
  if (miniLongPressTriggered) {
    miniLongPressTriggered = false;
    return;
  }
  if (miniPointerStartedCollapsed || idleCollapsed.value) {
    miniPointerStartedCollapsed = false;
    idleCollapsed.value = false;
    return;
  }
  setMusicFull();
};

watch(
  () => playerStore.musicFull,
  (_newVal) => {
    // 状态栏样式更新已在 Web 环境中禁用
  }
);

// 打开播放列表抽屉
const openPlayListDrawer = () => {
  idleCollapsed.value = false;
  playerStore.setPlayListDrawerVisible(true);
};

// 播放暂停按钮事件
const playMusicEvent = async () => {
  try {
    playerStore.setPlay(playMusic.value);
  } catch (error) {
    console.error('播放出错:', error);
    playerStore.nextPlay();
  }
};

// 迷你播放栏滑动切歌：先跟手移动，提交后旧内容滑出、新内容从反方向滑入。
const miniSwipeOffset = ref(0);
const miniSwipeAnimating = ref(false);
const miniSwipeSwitching = ref(false);
const miniSwipeAxis = ref<'none' | 'horizontal' | 'vertical'>('none');
const miniVerticalOffset = ref(0);
const suppressMiniClick = ref(false);
// Keep the gesture compact so a track change reads as a nudge, not a displaced bar.
const getMiniSwipeLimit = () => Math.min(36, Math.max(28, window.innerWidth * 0.085));
const miniSwipeProgress = computed(() =>
  Math.min(Math.abs(miniSwipeOffset.value) / getMiniSwipeLimit(), 1)
);
const miniSwipeStyle = computed(() => ({
  transform: `translate3d(${miniSwipeOffset.value}px, ${miniVerticalOffset.value}px, 0) scale(${1 - miniSwipeProgress.value * 0.012})`,
  opacity: String(1 - miniSwipeProgress.value * 0.12),
  '--mini-swipe-rotation': `${miniSwipeOffset.value * 0.018}deg`,
  '--mini-swipe-content-shift': `${miniSwipeOffset.value * 0.05}px`
}));
const miniSongInfoStyle = computed(() => {
  const progress = playerTransition.progress.value;
  return {
    opacity: String(1 - progress),
    transform: `translate3d(0, ${-progress * 8}px, 0) scale(${1 - progress * 0.025})`,
    transformOrigin: 'center center',
    pointerEvents: progress > 0.1 ? ('none' as const) : undefined
  };
});
const miniPlaybackControlsStyle = computed<CSSProperties>(() => ({
  opacity: String(1 - playerTransition.progress.value),
  transform: `translate3d(0, ${playerTransition.progress.value * 12}px, 0)`,
  pointerEvents: playerTransition.progress.value > 0.1 ? 'none' : undefined
}));

let miniPointerStartX = 0;
let miniPointerStartY = 0;
let miniPointerStartTime = 0;
let miniPointerActive = false;
let miniPointerId: number | null = null;
let verticalSamples: Array<{ y: number; time: number }> = [];
let miniSwipeTimer: ReturnType<typeof setTimeout> | undefined;
let miniClickTimer: ReturnType<typeof setTimeout> | undefined;

const setMiniClickSuppressed = () => {
  suppressMiniClick.value = true;
  if (miniClickTimer) clearTimeout(miniClickTimer);
  miniClickTimer = setTimeout(() => {
    suppressMiniClick.value = false;
    miniClickTimer = undefined;
  }, 360);
};

const onMiniClickCapture = (event: MouseEvent) => {
  if (!suppressMiniClick.value) return;
  event.preventDefault();
  event.stopPropagation();
  suppressMiniClick.value = false;
};

const onMiniPointerDown = (event: PointerEvent) => {
  if (
    miniSwipeSwitching.value ||
    !event.isPrimary ||
    (event.button !== 0 && event.pointerType === 'mouse')
  ) {
    return;
  }
  miniPointerStartX = event.clientX;
  miniPointerStartY = event.clientY;
  miniPointerStartTime = Date.now();
  miniPointerActive = true;
  miniPointerId = event.pointerId;
  miniSwipeAxis.value = 'none';
  miniSwipeAnimating.value = false;
  miniVerticalOffset.value = 0;
  miniPointerStartedCollapsed = idleCollapsed.value;
  verticalSamples = [{ y: event.clientY, time: performance.now() }];
  miniLongPressTriggered = false;
  if (idleCollapsed.value) {
    miniLongPressTimer = setTimeout(() => {
      if (!miniPointerActive || miniSwipeAxis.value !== 'none') return;
      miniLongPressTriggered = true;
      setMiniClickSuppressed();
      openMusicFull(1.1);
      idleCollapsed.value = false;
      if (navigator.vibrate) navigator.vibrate(8);
    }, 520);
  }
};

const onMiniPointerMove = (event: PointerEvent) => {
  if (!miniPointerActive || miniSwipeSwitching.value || event.pointerId !== miniPointerId) return;
  const deltaX = event.clientX - miniPointerStartX;
  const deltaY = event.clientY - miniPointerStartY;

  if (miniSwipeAxis.value === 'none' && Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= 8) {
    miniSwipeAxis.value = Math.abs(deltaX) > Math.abs(deltaY) * 1.08 ? 'horizontal' : 'vertical';
    if (miniLongPressTimer) {
      clearTimeout(miniLongPressTimer);
      miniLongPressTimer = undefined;
    }
  }
  if (miniSwipeAxis.value === 'vertical') {
    if (!(event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId)) {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    setMiniClickSuppressed();
    const now = performance.now();
    verticalSamples.push({ y: event.clientY, time: now });
    verticalSamples = verticalSamples.filter((sample) => now - sample.time <= 100);
    if (deltaY < 0 && !miniPointerStartedCollapsed) {
      const progress = Math.min(1, Math.max(0, -deltaY / Math.max(240, window.innerHeight * 0.68)));
      const first = verticalSamples[0];
      const velocity =
        verticalSamples.length > 1
          ? (verticalSamples[verticalSamples.length - 1].y - first.y) /
            Math.max(1, now - first.time)
          : 0;
      playerTransition.setDragging(progress, (velocity * 1000) / Math.max(1, window.innerHeight));
      miniVerticalOffset.value = 0;
    } else {
      miniVerticalOffset.value = Math.max(-42, Math.min(42, deltaY));
    }
    return;
  }
  if (miniSwipeAxis.value !== 'horizontal') return;

  if (!(event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId)) {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  event.preventDefault();
  setMiniClickSuppressed();
  const maxDrag = getMiniSwipeLimit();
  miniSwipeOffset.value = maxDrag * Math.tanh(deltaX / maxDrag);
};

const finishMiniSwipeAnimation = () => {
  miniSwipeAnimating.value = true;
  miniSwipeOffset.value = 0;
  miniVerticalOffset.value = 0;
  if (miniSwipeTimer) clearTimeout(miniSwipeTimer);
  miniSwipeTimer = setTimeout(() => {
    miniSwipeAnimating.value = false;
    miniSwipeSwitching.value = false;
    miniSwipeAxis.value = 'none';
    miniSwipeTimer = undefined;
  }, 280);
};

const switchTrackWithAnimation = (direction: 'left' | 'right') => {
  setMiniClickSuppressed();
  miniSwipeSwitching.value = true;
  miniSwipeAnimating.value = true;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    if (direction === 'left') handleNext();
    else handlePrev();
    finishMiniSwipeAnimation();
    return;
  }

  const travel = Math.min(getMiniSwipeLimit() * 1.2, 44);
  const exitOffset = direction === 'left' ? -travel : travel;
  miniSwipeOffset.value = exitOffset;

  if (miniSwipeTimer) clearTimeout(miniSwipeTimer);
  miniSwipeTimer = setTimeout(() => {
    if (direction === 'left') handleNext();
    else handlePrev();

    miniSwipeAnimating.value = false;
    miniSwipeOffset.value = -exitOffset * 0.42;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => finishMiniSwipeAnimation());
    });
  }, 150);
};

const releaseMiniPointer = (event: PointerEvent) => {
  const target = event.currentTarget as HTMLElement;
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
  miniPointerId = null;
};

const onMiniPointerUp = (event: PointerEvent) => {
  if (!miniPointerActive || event.pointerId !== miniPointerId) return;
  const deltaX = event.clientX - miniPointerStartX;
  const deltaY = event.clientY - miniPointerStartY;
  const elapsed = Math.max(1, Date.now() - miniPointerStartTime);
  const projectedX = deltaX + (deltaX / elapsed) * 110;
  const swipeLimit = getMiniSwipeLimit();
  const commitThreshold = Math.min(40, Math.max(32, swipeLimit));
  const projectedThreshold = Math.min(58, Math.max(48, swipeLimit * 1.45));
  const commit =
    miniSwipeAxis.value === 'horizontal' &&
    (Math.abs(deltaX) >= commitThreshold || Math.abs(projectedX) >= projectedThreshold);

  releaseMiniPointer(event);
  miniPointerActive = false;
  if (miniLongPressTimer) {
    clearTimeout(miniLongPressTimer);
    miniLongPressTimer = undefined;
  }
  const verticalCommit = miniSwipeAxis.value === 'vertical' && Math.abs(deltaY) > 34;
  if (commit) switchTrackWithAnimation(deltaX < 0 ? 'left' : 'right');
  else if (verticalCommit && miniPointerStartedCollapsed && deltaY < 0) {
    idleCollapsed.value = false;
    if (navigator.vibrate) navigator.vibrate(8);
    finishMiniSwipeAnimation();
  } else if (verticalCommit && !miniPointerStartedCollapsed && deltaY < 0) {
    idleCollapsed.value = false;
    const velocity =
      verticalSamples.length > 1
        ? (verticalSamples[verticalSamples.length - 1].y - verticalSamples[0].y) /
          Math.max(1, verticalSamples[verticalSamples.length - 1].time - verticalSamples[0].time)
        : 0;
    const shouldOpen = shouldOpenMobilePlayer(playerTransition.progress.value, -velocity);
    if (shouldOpen) playerStore.setMusicFull(true);
    playerTransition.animateTo(shouldOpen ? 1 : 0, -velocity);
    if (navigator.vibrate) navigator.vibrate(8);
    finishMiniSwipeAnimation();
  } else if (verticalCommit && !miniPointerStartedCollapsed && deltaY > 0) {
    idleCollapsed.value = true;
    if (navigator.vibrate) navigator.vibrate(8);
    finishMiniSwipeAnimation();
  } else {
    if (playerTransition.state.value === 'dragging') playerTransition.animateTo(0);
    finishMiniSwipeAnimation();
  }
};

const onMiniPointerCancel = (event: PointerEvent) => {
  if (!miniPointerActive || event.pointerId !== miniPointerId) return;
  releaseMiniPointer(event);
  miniPointerActive = false;
  if (miniLongPressTimer) {
    clearTimeout(miniLongPressTimer);
    miniLongPressTimer = undefined;
  }
  if (playerTransition.state.value === 'dragging') playerTransition.animateTo(0);
  finishMiniSwipeAnimation();
};

onBeforeUnmount(() => {
  if (miniSwipeTimer) clearTimeout(miniSwipeTimer);
  if (miniClickTimer) clearTimeout(miniClickTimer);
  if (miniLongPressTimer) clearTimeout(miniLongPressTimer);
});

watch(
  () => playerStore.musicFull,
  (isFull) => {
    if (isFull) {
      idleCollapsed.value = false;
      if (playerTransition.state.value === 'idle' && playerTransition.progress.value < 1) {
        playerTransition.setDragging(Math.max(0.016, playerTransition.progress.value));
        playerTransition.animateTo(1, 1);
      } else if (playerTransition.progress.value >= 1) {
        playerTransition.markOpen();
      }
    } else if (playerTransition.progress.value > 0) {
      playerTransition.animateTo(0);
    }
  }
);

watch(
  () => [shouldShowMobileMenu.value, playerStore.playListDrawerVisible],
  ([menuVisible, drawerVisible]) => {
    if (!menuVisible || drawerVisible) idleCollapsed.value = false;
  }
);

watch(idleCollapsed, (collapsed) => emit('idle-collapse-change', collapsed), { immediate: true });

watch(
  () => playerStore.playMusic,
  async () => {
    background.value = playMusic.value.backgroundColor as string;
  },
  { immediate: true, deep: true }
);
</script>

<style lang="scss" scoped>
.mobile-play-bar {
  @apply fixed bottom-[76px] left-0 w-full flex flex-col;
  z-index: 100000;
  animation-duration: 0.3s !important;
  /* 统一弹簧过渡 — 位置、宽度、高度、边距全部平滑形变，不创建新对象 */
  transition:
    bottom 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
    right 0.42s cubic-bezier(0.32, 0.72, 0, 1),
    left 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
    width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
    height 0.42s cubic-bezier(0.32, 0.72, 0, 1),
    max-width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
    min-width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
    border-radius 0.42s cubic-bezier(0.32, 0.72, 0, 1),
    border-color 0.22s ease,
    background-color 0.3s ease,
    box-shadow 0.32s ease;
  will-change: transform, opacity;

  &.is-menu-show {
    bottom: calc(var(--safe-area-inset-bottom, 0px) + 60px);
  }

  &.is-menu-show .mobile-mini-controls {
    width: 100%;
    height: 48px;
    margin: 0;
    padding: 0 8px 0 4px;
    border-color: transparent;
    background: transparent;
    box-shadow: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
  &.is-menu-hide {
    bottom: calc(var(--safe-area-inset-bottom, 0px) + 8px);
  }

  /* 独立出现时由播放栏自身提供有色毛玻璃表面，兼容 WebView 的弱 backdrop-filter。 */
  &.is-menu-hide.play-bar-mini:not(.playlist-open) .mobile-mini-controls {
    background:
      linear-gradient(
        145deg,
        rgba(255, 255, 255, 0.18),
        rgba(var(--accent-color-rgb, 136, 136, 136), 0.12)
      ),
      color-mix(in srgb, var(--cover-surface, rgba(24, 24, 28, 0.78)) 86%, transparent);
    border-color: color-mix(in srgb, var(--accent-color, #888) 24%, rgba(255, 255, 255, 0.22));
    box-shadow:
      0 10px 30px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.24),
      inset 0 -1px 0 rgba(0, 0, 0, 0.08);
    backdrop-filter: blur(30px) saturate(180%);
    -webkit-backdrop-filter: blur(30px) saturate(180%);
  }

  &.play-bar-expanded {
    @apply bg-transparent;
    height: auto;
    max-height: 230px;
    background: linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0) 0%,
      rgba(0, 0, 0, 0.5) 20%,
      rgba(0, 0, 0, 0.8) 80%,
      rgba(0, 0, 0, 0.9) 100%
    );
  }

  &.play-bar-mini {
    @apply h-14 py-0;
    transition:
      bottom 0.42s cubic-bezier(0.22, 0.8, 0.2, 1),
      left 0.42s cubic-bezier(0.22, 0.8, 0.2, 1),
      width 0.42s cubic-bezier(0.22, 0.8, 0.2, 1),
      height 0.42s cubic-bezier(0.32, 0.72, 0, 1),
      max-width 0.42s cubic-bezier(0.22, 0.8, 0.2, 1),
      min-width 0.42s cubic-bezier(0.22, 0.8, 0.2, 1),
      border-radius 0.42s cubic-bezier(0.32, 0.72, 0, 1),
      border-color 0.22s ease,
      background-color 0.3s ease,
      box-shadow 0.32s ease,
      transform 0.42s cubic-bezier(0.22, 0.8, 0.2, 1),
      opacity 0.28s ease;
  }

  /* 有底栏时播放栏保持底部锚点；无底栏时它本身形变为播放列表玻璃表面。 */
  &.playlist-mounted.play-bar-mini {
    z-index: 100000;
  }

  &.playlist-mounted.play-bar-mini.is-menu-hide {
    right: 0;
    bottom: calc(var(--safe-area-inset-bottom, 0px) + 8px);
    left: 0;
    width: 100%;
    height: 56px;
    overflow: hidden;
    border: 1px solid transparent;
    border-radius: 28px;
    background: transparent;
    box-shadow: none;
  }

  &.playlist-open.play-bar-mini.is-menu-hide {
    right: 12px;
    bottom: calc(var(--safe-area-inset-bottom, 0px) + 12px);
    left: 12px;
    width: calc(100% - 24px);
    height: min(62dvh, 500px);
    min-height: 310px;
    border-color: var(--m-glass-border);
    border-radius: 32px;
    background: var(--m-glass-bg);
    box-shadow:
      0 18px 48px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.22);
    backdrop-filter: blur(30px) saturate(175%);
    -webkit-backdrop-filter: blur(30px) saturate(175%);
  }

  &.playlist-mounted.play-bar-mini.is-menu-hide .mobile-mini-controls {
    position: absolute;
    right: 3px;
    bottom: 3px;
    left: 3px;
    z-index: 3;
    width: auto;
    height: 48px;
    margin: 0;
  }

  &.playlist-open.play-bar-mini.is-menu-hide .mobile-mini-controls {
    border-color: transparent;
    background: transparent;
    box-shadow: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }

  // 进度条
  .music-progress-bar {
    @apply flex items-center justify-between px-4 py-2 relative z-10;

    .current-time,
    .total-time {
      @apply text-xs text-white opacity-80;
    }

    .progress-wrapper {
      @apply flex-1 mx-3 flex flex-col items-center;

      .progress-slider {
        @apply w-full;

        :deep(.n-slider) {
          --n-rail-height: 3px;
          --n-rail-color: rgba(255, 255, 255, 0.15);
          --n-rail-color-dark: rgba(255, 255, 255, 0.15);
          --n-fill-color: var(--accent-color);
          --n-handle-size: 0px;
          --n-handle-color: var(--accent-color);

          &:hover {
            --n-handle-size: 10px;
          }

          .n-slider-rail {
            @apply rounded-full !important;
          }

          .n-slider-fill {
            @apply rounded-full !important;
            box-shadow: 0 0 4px rgba(30, 215, 96, 0.5);
          }

          .n-slider-handle {
            @apply transition-all duration-200;
            opacity: 0;
            box-shadow: 0 0 4px rgba(255, 255, 255, 0.7);
          }

          &:hover .n-slider-handle,
          &:active .n-slider-handle {
            opacity: 1;
          }
        }
      }

      .quality-label {
        @apply text-xs text-white opacity-70 mt-1;
      }
    }
  }

  // 主控区
  .player-controls {
    @apply flex items-center justify-between px-8 py-3 relative z-10 pb-8;

    .control-btn {
      @apply flex items-center justify-center cursor-pointer transition;

      i {
        @apply text-white transition-all;
      }

      &.like i {
        @apply text-2xl;
      }

      &.prev i,
      &.next i {
        @apply text-3xl;
      }

      &.play-pause {
        @apply w-12 h-12 rounded-full flex items-center justify-center;
        background: rgba(255, 255, 255, 0.2);

        i {
          @apply text-4xl;
        }
      }

      &.list i {
        @apply text-2xl;
      }

      .like-active {
        @apply text-red-500;
      }
    }
  }

  // 迷你模式样式
  .mobile-mini-controls {
    @apply flex items-center justify-between pr-4 mx-3 h-12 rounded-full shadow-lg;
    --mini-swipe-duration: 0ms;
    --mini-swipe-opacity-duration: 0ms;
    --mini-swipe-ease: cubic-bezier(0.22, 0.84, 0.24, 1.08);
    background: var(--m-glass-bg);
    border: 1px solid var(--m-glass-border);
    backdrop-filter: blur(24px) saturate(165%);
    -webkit-backdrop-filter: blur(24px) saturate(165%);
    touch-action: none;
    user-select: none;
    /* 内部元素形变过渡 — 与外层同步 */
    transition:
      transform var(--mini-swipe-duration) var(--mini-swipe-ease),
      opacity var(--mini-swipe-opacity-duration) ease,
      margin 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
      height 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
      padding 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
      gap 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
      background 0.5s ease,
      border 0.5s ease;

    &.is-swipe-animating {
      --mini-swipe-duration: 250ms;
      --mini-swipe-opacity-duration: 200ms;
    }

    @media (prefers-reduced-motion: reduce) {
      &.is-swipe-animating {
        --mini-swipe-duration: 180ms;
        --mini-swipe-opacity-duration: 180ms;
        --mini-swipe-ease: ease-out;
      }
    }

    .mini-song-info {
      @apply flex items-center flex-1 min-w-0 cursor-pointer;
      transition: flex 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);

      .mini-song-cover {
        width: 40px;
        height: 40px;
        margin: 4px;
        flex: 0 0 auto;
        overflow: hidden;
        border-radius: 50%;
        border: 4px solid color-mix(in srgb, var(--accent-color) 18%, transparent);
        transition:
          width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
          height 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
          border-width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
          transform 180ms ease-out;
        transform: rotate(var(--mini-swipe-rotation, 0deg));

        :deep(.n-image-img),
        :deep(img) {
          width: 100%;
          height: 100%;
          border-radius: inherit;
          object-fit: cover;
        }
      }

      .mini-song-text {
        @apply ml-3 min-w-0 flex-1 flex items-center;
        overflow: hidden;
        transform: translate3d(var(--mini-swipe-content-shift, 0px), 0, 0);
        transition:
          opacity 0.3s ease,
          max-width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
          transform 180ms ease-out;

        .mini-song-title {
          @apply text-sm font-medium;
          color: var(--m-text-primary, #2c2c2c);
        }

        .mini-song-artist {
          @apply text-xs;
          color: var(--m-text-muted, #9a9590);
        }
      }
    }

    .mini-playback-controls {
      @apply flex items-center;
      transition: gap 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);

      .mini-control-btn {
        @apply flex items-center justify-center cursor-pointer transition;

        &.play {
          @apply w-9 h-9 rounded-full flex items-center justify-center mr-2;
          transition:
            width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
            height 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
            margin 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);

          .iconfont {
            @apply text-xl transition;
            color: var(--accent-color);
          }
        }
      }

      .mini-list-icon {
        @apply text-xl p-1 transition cursor-pointer;
        color: var(--m-text-secondary, #6b6560);

        &:active {
          color: var(--accent-color);
        }
      }
    }
  }

  /* ═══ 紧凑模式覆盖 — 直接复制底栏的精确位置和高度参数 ═══ */
  &.compact-nav {
    /* 直接复制 .mobile-glow-nav-wrap 的定位参数 */
    bottom: calc(var(--safe-area-inset-bottom, 0px) + var(--mobile-dock-gap, 12px)) !important;
    left: var(--mobile-dock-inset, 12px) !important;
    right: auto !important;
    transform: none !important;
    width: auto !important;
    max-width: calc(45vw - 6px);
    min-width: 130px;
    /* 覆盖 h-14 (56px) — 与底栏高度完全一致 */
    height: auto !important;
    padding: 0 !important;
  }

  /* 直接复制 .mobile-glow-nav 的样式参数 */
  &.compact-nav .mobile-mini-controls {
    margin: 0 !important;
    width: 100%;
    /* 底栏高度 = padding(4+4) + item(36px) + border(1+1) = 46px */
    height: 46px;
    /* 直接复制底栏的 padding */
    padding: 4px 6px;
    gap: 2px;
    justify-content: center !important;
    /* 直接复制 .mobile-glow-nav 的视觉参数 */
    border-radius: 9999px;
    background: var(--cover-surface, rgba(20, 20, 22, 0.72));
    backdrop-filter: blur(28px) saturate(180%);
    -webkit-backdrop-filter: blur(28px) saturate(180%);
    border: 1px solid var(--cover-border, rgba(255, 255, 255, 0.08));
    box-shadow:
      0 6px 24px rgba(0, 0, 0, 0.25),
      0 1px 4px rgba(0, 0, 0, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }

  /* 紧凑模式隐藏歌名文字（通过 opacity+max-width 平滑过渡） */
  &.compact-nav .mobile-mini-controls .mini-song-info .mini-song-text {
    opacity: 0;
    max-width: 0;
    margin-left: 0 !important;
    pointer-events: none;
  }

  &.compact-nav .mobile-mini-controls .mini-song-info {
    flex: 0 0 auto !important;
  }

  &.compact-nav .mobile-mini-controls .mini-song-info .mini-song-cover {
    width: 36px !important;
    height: 36px !important;
    border-width: 3px !important;
    border-color: var(--cover-border, rgba(255, 255, 255, 0.08)) !important;
  }

  &.compact-nav .mobile-mini-controls .mini-playback-controls .mini-control-btn.play {
    width: 36px !important;
    height: 36px !important;
    margin-right: 0 !important;
  }

  &.compact-nav .mobile-mini-controls .mini-playback-controls .mini-control-btn.play .iconfont {
    font-size: 18px !important;
    color: var(--accent-color, #fff) !important;
  }

  &.compact-nav .mobile-mini-controls .mini-playback-controls .mini-list-icon {
    font-size: 18px !important;
    padding: 4px !important;
    color: var(--cover-text-muted, rgba(255, 255, 255, 0.5)) !important;
  }

  /* The same mini-player node contracts into the cover beside the bottom navigation. */
  &.idle-collapsed {
    left: auto !important;
    right: var(--mobile-dock-inset, 12px) !important;
    bottom: calc(var(--safe-area-inset-bottom, 0px) + var(--mobile-dock-gap, 12px)) !important;
    width: 50px !important;
    min-width: 50px !important;
    max-width: 50px !important;
    height: 50px !important;
    padding: 0 !important;
  }

  &.idle-collapsed .mobile-mini-controls {
    width: 50px !important;
    height: 50px !important;
    margin: 0 !important;
    padding: 0 !important;
    gap: 0 !important;
    overflow: hidden;
    border-radius: 50%;
    background: transparent;
    border: 0;
    box-shadow: none;
  }

  &.idle-collapsed .mobile-mini-controls .mini-song-info {
    flex: 0 0 50px !important;
    width: 50px !important;
    height: 50px !important;
  }

  &.idle-collapsed .mobile-mini-controls .mini-song-info .mini-song-cover {
    width: 44px !important;
    height: 44px !important;
    margin: 3px;
    border-width: 1px !important;
    border-color: transparent !important;
    border-radius: 50% !important;
  }

  &.idle-collapsed .mini-song-text,
  &.idle-collapsed .mini-playback-controls {
    opacity: 0;
    max-width: 0;
    margin: 0 !important;
    overflow: hidden;
    pointer-events: none;
  }

  @media (prefers-reduced-motion: reduce) {
    transition:
      opacity 160ms ease,
      width 160ms ease,
      left 160ms ease,
      right 160ms ease !important;

    .mobile-mini-controls,
    .mini-song-info,
    .mini-song-cover,
    .mini-song-text,
    .mini-playback-controls {
      transition-duration: 160ms !important;
      transition-timing-function: ease-out !important;
    }
  }
}

.mobile-play-list-container {
  height: 60vh;
  width: 90vw;
  max-width: 400px;
  @apply relative rounded-t-2xl overflow-hidden;

  .mobile-play-list-back {
    backdrop-filter: blur(20px);
    @apply absolute top-0 left-0 w-full h-full;
    @apply bg-light dark:bg-black bg-opacity-90;
  }

  .mobile-play-list-item {
    @apply px-3 py-1;
  }
}
</style>
