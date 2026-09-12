<template>
  <div
    class="mobile-play-bar"
    :class="[
      setAnimationClass('animate__fadeInUp'),
      'play-bar-mini',
      playerStore.musicFull ? 'player-active' : '',
      playerTransition.state.value === 'opening' || playerTransition.state.value === 'closing'
        ? 'player-transitioning'
        : '',
      playerTransition.state.value === 'dragging' ? 'player-transitioning' : '',
      miniUsesMenuAnchor ? 'is-menu-show' : 'is-menu-hide',
      idleCollapsed && !playerStore.musicFull ? 'idle-collapsed' : '',
      playlistSurfaceMounted && !playerStore.musicFull ? 'playlist-mounted' : '',
      playlistSurfaceExpanded && !playerStore.musicFull ? 'playlist-open' : '',
      playlistSongSheetActive && !playerStore.musicFull ? 'song-sheet-open' : ''
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
    <div
      class="mobile-mini-controls"
      :class="{
        'is-swipe-active': miniSwipeAxis === 'horizontal' || miniSwipeSwitching,
        'is-swipe-animating': miniSwipeAnimating
      }"
      :style="miniSwipeStyle"
      :aria-hidden="playerTransition.progress.value > 0.98"
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
          @click.stop="onMiniCoverClick"
          @pointerdown.stop="startCoverLongPress"
          @pointerup.stop="cancelCoverLongPress"
          @pointercancel.stop="cancelCoverLongPress"
        />
        <div class="mini-song-text">
          <span class="mini-song-title">{{ playMusic.name }}</span>
          <span class="mini-song-separator">-</span>
          <span class="mini-song-artist">
            <template v-for="(artists, artistsindex) in artistList" :key="artistsindex">
              {{ artists.name }}{{ artistsindex < artistList.length - 1 ? ' / ' : '' }}
            </template>
          </span>
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
      v-if="playerSurfaceRendered"
      ref="MusicFullRef"
      v-model="playerSurfaceVisible"
      :background="background"
    />

    <cover-preview-modal
      v-model:visible="coverPreviewVisible"
      :src="previewCoverUrl"
      :title="playMusic?.name || ''"
    />
  </div>
</template>

<script lang="ts" setup>
import type { CSSProperties, Ref } from 'vue';
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import MusicFullWrapper from '@/components/lyric/MusicFullWrapper.vue';
import CoverPreviewModal from '@/components/player/CoverPreviewModal.vue';
import { useMobilePlayerTransition } from '@/composables/useMobilePlayerTransition';
import { artistList, playMusic, textColors } from '@/hooks/MusicHook';
import { usePlayerStore } from '@/store/modules/player';
import { useSettingsStore } from '@/store/modules/settings';
import { getImgUrl, setAnimationClass } from '@/utils';
import { shouldOpenMobilePlayer } from '@/utils/mobileGestureThresholds';

const shouldShowMobileMenu = inject('shouldShowMobileMenu') as Ref<boolean>;
const playlistSurfaceMounted = inject('playlistSurfaceMounted', ref(false)) as Ref<boolean>;
const playlistSurfaceExpanded = inject('playlistSurfaceExpanded', ref(false)) as Ref<boolean>;
const playlistSongSheetActive = inject('playlistSongSheetActive', ref(false)) as Ref<boolean>;
const capturePlayerTransitionOrigin = inject<() => void>('capturePlayerTransitionOrigin', () => {});
const transitionStartedWithMenu = inject(
  'playerTransitionStartedWithMenu',
  ref(false)
) as Ref<boolean>;
const emit = defineEmits<{
  (event: 'idle-collapse-change', collapsed: boolean): void;
}>();

const playerStore = usePlayerStore();
const settingsStore = useSettingsStore();
const idleCollapsed = ref(false);
const playerTransition = useMobilePlayerTransition();
const miniUsesMenuAnchor = computed(
  () =>
    shouldShowMobileMenu.value ||
    (transitionStartedWithMenu.value && playerTransition.state.value !== 'idle')
);
const coverPreviewVisible = ref(false);
let coverLongPressTimer: ReturnType<typeof setTimeout> | undefined;
const previewCoverUrl = computed(() =>
  playMusic.value?.picUrl ? getImgUrl(playMusic.value.picUrl, '1000y1000') : ''
);

function startCoverLongPress() {
  cancelCoverLongPress();
  coverLongPressTimer = setTimeout(() => {
    if (previewCoverUrl.value) {
      miniLongPressTriggered = true;
      coverPreviewVisible.value = true;
    }
  }, 500);
}

function cancelCoverLongPress() {
  if (coverLongPressTimer) clearTimeout(coverLongPressTimer);
  coverLongPressTimer = undefined;
}
let miniLongPressTriggered = false;
let miniLongPressTimer: ReturnType<typeof setTimeout> | undefined;
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
  get: () => playerStore.musicFull || playerTransition.state.value !== 'idle',
  set: (visible: boolean) => {
    if (!visible && playerStore.musicFull) {
      // Player implementations emit modelValue=false from the completion
      // callback of this same close transition. Do not restart the spring.
      if (playerTransition.state.value === 'closing' || playerTransition.progress.value <= 0.002) {
        playerStore.setMusicFull(false);
        return;
      }
      playerTransition.setSurfaceMode('controls');
      playerTransition.close(0, () => playerStore.setMusicFull(false));
    }
  }
});

// Keep exactly one full-player instance during a transition, then release it
// after the closing spring reaches its source surface.
const playerSurfaceRendered = computed(
  () => playerStore.musicFull || playerTransition.state.value !== 'idle'
);

let playerOpenFrame = 0;
let playerOpenGeneration = 0;
const openMusicFull = async (initialVelocity = 0) => {
  const generation = ++playerOpenGeneration;
  if (playerOpenFrame) cancelAnimationFrame(playerOpenFrame);
  playerOpenFrame = 0;
  transitionStartedWithMenu.value = shouldShowMobileMenu.value;
  capturePlayerTransitionOrigin();
  playerTransition.setDragging(Math.max(0.016, playerTransition.progress.value));
  playerStore.setMusicFull(true);
  await nextTick();
  playerOpenFrame = requestAnimationFrame(() => {
    playerOpenFrame = 0;
    if (generation === playerOpenGeneration && playerStore.musicFull) {
      playerTransition.animateTo(1, initialVelocity);
    }
  });
  settingsStore.showArtistDrawer = false;
};

// 设置 musicFull
const setMusicFull = () => {
  if (playerStore.musicFull) {
    playerOpenGeneration += 1;
    if (playerOpenFrame) cancelAnimationFrame(playerOpenFrame);
    playerOpenFrame = 0;
    playerTransition.close(0, () => playerStore.setMusicFull(false));
    return;
  }
  openMusicFull(1.2);
};

const onMiniSongInfoClick = () => {
  if (miniLongPressTriggered) {
    miniLongPressTriggered = false;
    return;
  }
  // 收起态点击封面/信息 = 直接打开播放界面(退出后由 openMusicFull 不重置收起态保证还原)
  miniPointerStartedCollapsed = false;
  idleCollapsed.value = false;
  setMusicFull();
};

const onMiniCoverClick = () => {
  idleCollapsed.value = false;
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
const miniVerticalGestureBlocked = ref(false);
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
  pointerEvents: playerTransition.progress.value > 0.08 ? ('none' as const) : undefined,
  '--mini-swipe-rotation': `${miniSwipeOffset.value * 0.018}deg`,
  '--mini-swipe-content-shift': `${miniSwipeOffset.value * 0.05}px`,
  '--mini-swipe-stretch': String(1 + miniSwipeProgress.value * 0.08),
  '--mini-swipe-glow-x': `${miniSwipeOffset.value * 0.7}px`,
  '--mini-swipe-glow-opacity': String(miniSwipeProgress.value * 0.32)
}));
// 当前播放器样式是否 default:决定迷你信息行的 morph 目标
// default → 中心大封面/大标题接管;其余样式 → 底部控制区信息行接管
const playerStyleIsDefault = ref(true);
const refreshPlayerStyle = () => {
  try {
    const raw = localStorage.getItem('music-full-config');
    playerStyleIsDefault.value = ((raw ? JSON.parse(raw).playerStyle : 'default') || 'default') === 'default';
  } catch {
    playerStyleIsDefault.value = true;
  }
};
refreshPlayerStyle();
onMounted(() => window.addEventListener('music-full-config-updated', refreshPlayerStyle));
onBeforeUnmount(() => window.removeEventListener('music-full-config-updated', refreshPlayerStyle));

// 转场期迷你行 morph:
// default:原地不动,与大封面/大标题(p=0 起精确覆盖迷你行位置)交叉淡化——
//          淡出窗口与全屏层 reveal(--player-surface-reveal 起点 0.035)同步;
// 其余样式:飞向底部控制区信息行落点,0.86-0.98 与接管行(零位移)同窗交叉,
//          观感即同一元素变形重排,无接力感。
const miniSongInfoStyle = computed(() => {
  const progress = playerTransition.progress.value;
  if (progress <= 0.001) return {} as CSSProperties;
  if (playerStyleIsDefault.value) {
    return {
      opacity: String(1 - Math.min(1, Math.max(0, (progress - 0.035) / 0.265))),
      pointerEvents: 'none' as const,
      zIndex: 4
    } as CSSProperties;
  }
  const source = playerTransition.identitySourceRect.value;
  const safeBottom = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-bottom') || '0'
  );
  const landscape = window.matchMedia('(orientation: landscape)').matches;
  const controlHeight = landscape ? 96 : 168;
  const targetLeft = 30;
  const targetTop = window.innerHeight - safeBottom - 14 - controlHeight + 12;
  const translateX = source ? (targetLeft - source.left) * progress : 0;
  const translateY = source ? (targetTop - source.top) * progress : -progress * 82;
  const handoff = Math.min(1, Math.max(0, (progress - 0.86) / 0.12));
  return {
    '--identity-progress': String(progress),
    '--identity-cover-size': `${40 + progress * 4}px`,
    '--identity-cover-radius': `${20 - progress * 10}px`,
    '--identity-cover-border': `${4 * (1 - progress)}px`,
    opacity: String(1 - handoff),
    transform: `translate3d(${translateX}px, ${translateY}px, 0)`,
    transformOrigin: 'left center',
    zIndex: 4,
    pointerEvents: 'none' as const
  } as CSSProperties;
});
const miniPlaybackControlsStyle = computed<CSSProperties>(() => ({
  opacity: String(1 - Math.min(1, Math.max(0, (playerTransition.progress.value - 0.12) / 0.42))),
  transform: `translate3d(0, ${playerTransition.progress.value * 18}px, 0)`,
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
  miniVerticalGestureBlocked.value = false;
  miniSwipeAnimating.value = false;
  miniVerticalOffset.value = 0;
  miniPointerStartedCollapsed = idleCollapsed.value;
  verticalSamples = [{ y: event.clientY, time: performance.now() }];
  miniLongPressTriggered = false;
  capturePlayerTransitionOrigin();
};

const onMiniPointerMove = (event: PointerEvent) => {
  if (!miniPointerActive || miniSwipeSwitching.value || event.pointerId !== miniPointerId) return;
  const deltaX = event.clientX - miniPointerStartX;
  const deltaY = event.clientY - miniPointerStartY;

  if (miniSwipeAxis.value === 'none' && Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= 8) {
    const isVertical = Math.abs(deltaY) >= Math.abs(deltaX) * 1.08;
    if (isVertical && !shouldShowMobileMenu.value && deltaY > 0) {
      miniVerticalGestureBlocked.value = true;
      miniSwipeAxis.value = 'none';
      if (miniLongPressTimer) {
        clearTimeout(miniLongPressTimer);
        miniLongPressTimer = undefined;
      }
      return;
    }
    miniSwipeAxis.value = isVertical ? 'vertical' : 'horizontal';
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
  const verticalCommit =
    !miniVerticalGestureBlocked.value &&
    miniSwipeAxis.value === 'vertical' &&
    Math.abs(deltaY) > 34 &&
    (shouldShowMobileMenu.value || deltaY < 0);
  if (commit) switchTrackWithAnimation(deltaX < 0 ? 'left' : 'right');
  else if (verticalCommit && miniPointerStartedCollapsed && deltaY < 0) {
    // 收起态上滑 = 展开为展开态底栏(弹性拉伸,封面滑到最左、信息控件展开)
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
    if (shouldOpen) playerTransition.animateTo(1, -velocity);
    else playerTransition.close(-velocity);
    if (navigator.vibrate) navigator.vibrate(8);
    finishMiniSwipeAnimation();
  } else if (verticalCommit && !miniPointerStartedCollapsed && deltaY > 0) {
    idleCollapsed.value = true;
    if (navigator.vibrate) navigator.vibrate(8);
    finishMiniSwipeAnimation();
  } else {
    if (playerTransition.state.value === 'dragging') playerTransition.close();
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
  if (playerTransition.state.value === 'dragging') playerTransition.close();
  finishMiniSwipeAnimation();
};

onBeforeUnmount(() => {
  playerOpenGeneration += 1;
  if (playerOpenFrame) cancelAnimationFrame(playerOpenFrame);
  playerTransition.cancelAllAnimations(true);
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
    } else if (playerTransition.progress.value > 0 && playerTransition.state.value !== 'closing') {
      playerTransition.close();
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
  will-change: auto;

  &.player-transitioning {
    will-change: transform, opacity;
  }

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

  &.player-active {
    pointer-events: none;
  }

  &.player-active .mobile-mini-controls {
    pointer-events: none;
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

  &.playlist-open.play-bar-mini.is-menu-hide.song-sheet-open {
    height: min(48dvh, 430px);
    min-height: 280px;
  }

  /* 无底栏页面进入播放界面时，迷你栏自身的玻璃与有底栏页面的底栏行为
     一致：随转场进度渐隐，避免与形变中的播放器表面叠出双重玻璃。 */
  &.player-active.is-menu-hide:not(.playlist-open) .mobile-mini-controls {
    --mini-glass-fade: clamp(0, calc(1 - var(--player-open-progress, 0) * 3), 1);
    border-color: color-mix(
      in srgb,
      color-mix(in srgb, var(--accent-color, #888) 24%, rgba(255, 255, 255, 0.22))
        calc(var(--mini-glass-fade) * 100%),
      transparent
    );
    background:
      linear-gradient(
        145deg,
        rgba(255, 255, 255, calc(0.18 * var(--mini-glass-fade))),
        rgba(var(--accent-color-rgb, 136, 136, 136), calc(0.12 * var(--mini-glass-fade)))
      ),
      color-mix(
        in srgb,
        var(--cover-surface, rgba(24, 24, 28, 0.78)) calc(var(--mini-glass-fade) * 100%),
        transparent
      );
    box-shadow:
      0 10px 30px rgba(0, 0, 0, calc(0.2 * var(--mini-glass-fade))),
      inset 0 1px 0 rgba(255, 255, 255, calc(0.24 * var(--mini-glass-fade))),
      inset 0 -1px 0 rgba(0, 0, 0, calc(0.08 * var(--mini-glass-fade)));
    backdrop-filter: blur(calc(30px * var(--mini-glass-fade)))
      saturate(calc(100% + 80% * var(--mini-glass-fade)));
    -webkit-backdrop-filter: blur(calc(30px * var(--mini-glass-fade)))
      saturate(calc(100% + 80% * var(--mini-glass-fade)));
  }

  &.player-active.playlist-open.play-bar-mini.is-menu-hide {
    --mini-glass-fade: clamp(0, calc(1 - var(--player-open-progress, 0) * 3), 1);
    border-color: color-mix(
      in srgb,
      var(--m-glass-border) calc(var(--mini-glass-fade) * 100%),
      transparent
    );
    background: color-mix(
      in srgb,
      var(--m-glass-bg) calc(var(--mini-glass-fade) * 100%),
      transparent
    );
    box-shadow:
      0 18px 48px rgba(0, 0, 0, calc(0.2 * var(--mini-glass-fade))),
      inset 0 1px 0 rgba(255, 255, 255, calc(0.22 * var(--mini-glass-fade)));
    backdrop-filter: blur(calc(30px * var(--mini-glass-fade)))
      saturate(calc(100% + 75% * var(--mini-glass-fade)));
    -webkit-backdrop-filter: blur(calc(30px * var(--mini-glass-fade)))
      saturate(calc(100% + 75% * var(--mini-glass-fade)));
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
    position: relative;
    isolation: isolate;
    --mini-swipe-duration: 0ms;
    --mini-swipe-opacity-duration: 0ms;
    --mini-swipe-ease: cubic-bezier(0.22, 0.84, 0.24, 1.08);
    background: var(--m-glass-bg);
    border: 1px solid var(--m-glass-border);
    backdrop-filter: var(--m-glass-filter, blur(30px) saturate(175%));
    -webkit-backdrop-filter: var(--m-glass-filter, blur(30px) saturate(175%));
    touch-action: none;
    user-select: none;
    &::after {
      position: absolute;
      z-index: -1;
      inset: -8px 10%;
      border-radius: inherit;
      background: color-mix(in srgb, var(--accent-color, #fff) 48%, transparent);
      content: '';
      opacity: var(--mini-swipe-glow-opacity, 0);
      filter: blur(16px);
      pointer-events: none;
      transform: translate3d(var(--mini-swipe-glow-x, 0px), 0, 0)
        scaleX(var(--mini-swipe-stretch, 1));
      transition:
        opacity 180ms ease,
        transform 80ms linear;
    }
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

    // 仅展示迷你栏的路由不把纵向触摸交给收起手势，允许页面继续处理下滑。
    &.play-bar-mini.is-menu-hide:not(.player-active) .mobile-mini-controls {
      touch-action: pan-y;
    }

    .mini-song-info {
      @apply flex items-center flex-1 min-w-0 cursor-pointer;
      transition: flex 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);

      .player-transitioning &.play-bar-mini .mini-song-cover,
      &.player-transitioning .mini-song-cover {
        transition: none !important;
      }

      .mini-song-cover {
        width: var(--identity-cover-size, 40px);
        height: var(--identity-cover-size, 40px);
        margin: 4px;
        flex: 0 0 auto;
        overflow: hidden;
        border-radius: var(--identity-cover-radius, 50%);
        border: var(--identity-cover-border, 4px) solid
          color-mix(in srgb, var(--accent-color) 18%, transparent);
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
        @apply ml-3 min-w-0 flex-1;
        display: flex;
        align-items: center;
        gap: 8px;
        overflow: hidden;
        transform: translate3d(var(--mini-swipe-content-shift, 0px), 0, 0);
        transition:
          opacity 0.3s ease,
          max-width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
          transform 180ms ease-out;

        .mini-song-title {
          @apply text-sm font-medium;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: calc(14px + var(--identity-progress, 0) * 2px);
          color: color-mix(
            in srgb,
            var(--m-text-primary, #2c2c2c) calc((1 - var(--identity-progress, 0)) * 100%),
            rgba(255, 255, 255, 0.96)
          );
          transition:
            color 180ms ease,
            font-size 180ms ease,
            transform 180ms ease;
        }

        .mini-song-separator {
          flex: 0 0 auto;
          color: color-mix(in srgb, var(--m-text-muted, #9a9590) 70%, transparent);
          opacity: calc(1 - var(--player-open-progress, 0) * 2.4);
          transition: opacity 180ms ease;
        }

        .mini-song-artist {
          @apply text-xs;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 12px;
          color: color-mix(
            in srgb,
            var(--m-text-muted, #9a9590) calc((1 - var(--identity-progress, 0)) * 100%),
            rgba(255, 255, 255, 0.64)
          );
          transform: translate3d(
            var(--identity-artist-shift-x, 0),
            var(--identity-artist-shift-y, 0),
            0
          );
          transition:
            color 180ms ease,
            font-size 180ms ease,
            transform 180ms ease;
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
    background: var(--m-glass-bg);
    border: 1px solid var(--m-glass-border);
    backdrop-filter: var(--m-glass-filter, blur(30px) saturate(175%));
    -webkit-backdrop-filter: var(--m-glass-filter, blur(30px) saturate(175%));
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
