<template>
  <div
    class="mobile-controls no-toggle"
    :class="{
      visible,
      'fullscreen-mode': isFullscreen,
      'shared-surface-content': sharedSurface,
      'surface-interaction-active': playerSurfaceFeedback.active.value
    }"
    @click.stop
    @touchstart.stop="emitInteract"
    @touchend.stop
    @mousedown.stop="emitInteract"
  >
    <div class="player-info-row">
      <div
        class="player-info-main"
        :style="infoSwipeStyle"
        @pointerdown="onInfoPointerDown"
        @pointermove="onInfoPointerMove"
        @pointerup="onInfoPointerUp"
        @pointercancel="onInfoPointerCancel"
      >
        <img class="player-info-cover" :src="coverUrl" alt="" />
        <div class="player-info-copy">
          <strong>{{ songTitle }}</strong>
          <span>{{ artistText }}</span>
        </div>
      </div>
      <div class="player-info-actions">
        <button
          type="button"
          class="player-info-action"
          :class="{ active: isFavorite }"
          aria-label="收藏歌曲"
          @click="handleFavorite"
        >
          <i :class="isFavorite ? 'ri-heart-3-fill' : 'ri-heart-3-line'" />
        </button>
        <button
          type="button"
          class="player-info-action"
          aria-label="播放设置"
          @click="handleShowSettings"
        >
          <i class="ri-more-2-fill" />
        </button>
      </div>
    </div>

    <!-- 进度条 -->
    <div class="progress-container">
      <div
        class="apple-style-progress"
        @click="handleProgressBarClick"
        @mousedown="handleMouseDown"
      >
        <div class="progress-track">
          <div class="climax-track" v-if="styleEngine.climaxSegments.length > 0 && allTime > 0">
            <div
              v-for="(seg, i) in styleEngine.climaxSegments"
              :key="'cl-' + i"
              class="climax-segment"
              :class="{ 'climax-active': nowTime >= seg.start && nowTime <= seg.end }"
              :style="{
                left: (seg.start / allTime) * 100 + '%',
                width: Math.max(0.5, ((seg.end - seg.start) / allTime) * 100) + '%'
              }"
            ></div>
          </div>
          <!-- 上一首进度填充：crossfade 期间继续滑到尽头，结束后渐变为轨道色再隐藏 -->
          <div
            v-if="!transitionStore.isCrossfadingUI || !transitionStore.currentSongEnded"
            class="progress-fill"
            :class="{ 'fading-out': transitionStore.currentSongEnded }"
            :style="currentFillStyle"
          ></div>
          <!-- 下一首进度填充：crossfade 期间从左侧正常滑动 -->
          <div
            v-if="transitionStore.isCrossfadingUI"
            class="progress-fill-next"
            :style="nextFillStyle"
          ></div>
          <div
            class="progress-thumb"
            :class="{ active: isThumbDragging }"
            :style="{ left: thumbPosition }"
            @touchstart="handleThumbTouchStart"
            @touchmove="handleThumbTouchMove"
            @touchend="handleThumbTouchEnd"
          ></div>
        </div>
      </div>
      <div class="time-info">
        <span class="current-time">{{ secondToMinute(nowTime) }}</span>
        <span class="total-time">{{ secondToMinute(allTime) }}</span>
      </div>
    </div>

    <!-- 控制按钮 -->
    <div class="control-buttons">
      <div class="side-button" @click="handleTogglePlayMode">
        <i :class="[playModeIcon, { 'intelligence-active': playMode === 3 }]"></i>
      </div>
      <div class="main-button prev" @click="handlePrev">
        <i class="ri-skip-back-fill"></i>
      </div>
      <div class="main-button play-pause" @click="handleTogglePlay">
        <i :class="playIcon"></i>
      </div>
      <div class="main-button next" @click="handleNext">
        <i class="ri-skip-forward-fill"></i>
      </div>
      <div class="side-button" @click="handleShowPlaylist">
        <i class="iconfont icon-list"></i>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';

import { usePlayerSurfaceFeedback } from '@/composables/usePlayerSurfaceFeedback';
import { allTime, artistList, nowTime, pause, play, playMusic, sound } from '@/hooks/MusicHook';
import { usePlayMode } from '@/hooks/usePlayMode';
import { usePlayerStore } from '@/store/modules/player';
import { useStyleEngineStore } from '@/store/modules/styleEngine';
import { useTransitionStore } from '@/store/modules/transition';
import { getImgUrl, secondToMinute } from '@/utils';

const transitionStore = useTransitionStore();

// ==================== Crossfade 进度条动画 ====================

/** 上一首进度填充样式：正常显示 nowTime/allTime */
const currentFillStyle = computed(() => {
  return { width: `${(nowTime.value / Math.max(1, allTime.value)) * 100}%` };
});

/** 下一首进度填充样式：使用 nextAccentColor，宽度跟随 nextProgress */
const nextFillStyle = computed(() => {
  const color = transitionStore.nextAccentColor || '#ffffff';
  return {
    width: `${transitionStore.nextProgress}%`,
    background: color,
    boxShadow: `0 0 8px ${color}80`
  };
});

/** 进度条 thumb 位置：crossfade 时跟随下一首进度 */
const thumbPosition = computed(() => {
  if (transitionStore.isCrossfadingUI) {
    return `${transitionStore.nextProgress}%`;
  }
  return `${(nowTime.value / Math.max(1, allTime.value)) * 100}%`;
});

defineProps<{
  visible?: boolean;
  isFullscreen?: boolean;
  sharedSurface?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  showPlaylist: [];
  showSettings: [];
  interact: [];
}>();

const playerStore = usePlayerStore();
const styleEngine = useStyleEngineStore();
const playerSurfaceFeedback = usePlayerSurfaceFeedback();
const { playMode, playModeIcon, togglePlayMode } = usePlayMode();

const playState = computed(() => playerStore.isPlay);
const playIcon = computed(() => (playState.value ? 'ri-pause-fill' : 'ri-play-fill'));
const songTitle = computed(() => playMusic.value?.name || 'Zephyrus');
const artistText = computed(() => artistList.value.map((artist) => artist.name).join(' / '));
const coverUrl = computed(() =>
  getImgUrl(playMusic.value?.picUrl || '/images/default_cover.png', '100y100')
);
const isFavorite = computed(() =>
  playerStore.favoriteList.some((id) => String(id) === String(playMusic.value?.id))
);

// 播放控制（使用 MusicHook 直接控制音频）
function handleTogglePlay() {
  if (playState.value) {
    pause();
  } else {
    play();
  }
  emitInteract();
}

function handlePrev() {
  playerStore.prevPlay();
  emitInteract();
}

function handleNext() {
  playerStore.nextPlay();
  emitInteract();
}

// —— 歌曲封面与信息横滑切歌：与迷你播放栏同款手势（轴判定/阻尼/投影速度阈值一致） ——
const infoSwipeOffset = ref(0);
const infoSwipeAnimating = ref(false);
const infoSwipeSwitching = ref(false);
let infoPointerId: number | null = null;
let infoStartX = 0;
let infoStartY = 0;
let infoStartTime = 0;
let infoAxis: 'none' | 'horizontal' | 'vertical' = 'none';
let infoSwipeTimer: number | undefined;

const getInfoSwipeLimit = () => Math.min(36, Math.max(28, window.innerWidth * 0.085));
const infoSwipeProgress = computed(() =>
  Math.min(Math.abs(infoSwipeOffset.value) / getInfoSwipeLimit(), 1)
);
const infoSwipeStyle = computed(() => ({
  transform: `translate3d(${infoSwipeOffset.value}px, 0, 0) scale(${1 - infoSwipeProgress.value * 0.012})`,
  opacity: String(1 - infoSwipeProgress.value * 0.12),
  transition: infoSwipeAnimating.value
    ? 'transform 280ms cubic-bezier(0.32, 0.72, 0, 1), opacity 200ms ease'
    : 'none'
}));

const finishInfoSwipeAnimation = () => {
  infoSwipeAnimating.value = true;
  infoSwipeOffset.value = 0;
  if (infoSwipeTimer) window.clearTimeout(infoSwipeTimer);
  infoSwipeTimer = window.setTimeout(() => {
    infoSwipeAnimating.value = false;
    infoSwipeSwitching.value = false;
    infoAxis = 'none';
    infoSwipeTimer = undefined;
  }, 280);
};

const switchTrackWithAnimation = (direction: 'left' | 'right') => {
  infoSwipeSwitching.value = true;
  infoSwipeAnimating.value = true;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    if (direction === 'left') handleNext();
    else handlePrev();
    finishInfoSwipeAnimation();
    return;
  }
  const travel = Math.min(getInfoSwipeLimit() * 1.2, 44);
  const exitOffset = direction === 'left' ? -travel : travel;
  infoSwipeOffset.value = exitOffset;
  if (infoSwipeTimer) window.clearTimeout(infoSwipeTimer);
  infoSwipeTimer = window.setTimeout(() => {
    if (direction === 'left') handleNext();
    else handlePrev();
    infoSwipeAnimating.value = false;
    infoSwipeOffset.value = -exitOffset * 0.42;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => finishInfoSwipeAnimation());
    });
  }, 150);
};

const releaseInfoPointer = (event: PointerEvent) => {
  const target = event.currentTarget as HTMLElement;
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
  infoPointerId = null;
};

const onInfoPointerDown = (event: PointerEvent) => {
  if (!event.isPrimary || infoPointerId !== null) return;
  infoPointerId = event.pointerId;
  infoStartX = event.clientX;
  infoStartY = event.clientY;
  infoStartTime = Date.now();
  infoAxis = 'none';
};

const onInfoPointerMove = (event: PointerEvent) => {
  if (infoPointerId !== event.pointerId || infoSwipeSwitching.value) return;
  const deltaX = event.clientX - infoStartX;
  const deltaY = event.clientY - infoStartY;
  if (infoAxis === 'none' && Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= 8) {
    infoAxis = Math.abs(deltaX) > Math.abs(deltaY) * 1.08 ? 'horizontal' : 'vertical';
  }
  if (infoAxis !== 'horizontal') return;
  if (!(event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId)) {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  event.preventDefault();
  const maxDrag = getInfoSwipeLimit();
  infoSwipeOffset.value = maxDrag * Math.tanh(deltaX / maxDrag);
};

const onInfoPointerUp = (event: PointerEvent) => {
  if (infoPointerId !== event.pointerId) return;
  const deltaX = event.clientX - infoStartX;
  const elapsed = Math.max(1, Date.now() - infoStartTime);
  const projectedX = deltaX + (deltaX / elapsed) * 110;
  const swipeLimit = getInfoSwipeLimit();
  const commitThreshold = Math.min(40, Math.max(32, swipeLimit));
  const projectedThreshold = Math.min(58, Math.max(48, swipeLimit * 1.45));
  const commit =
    infoAxis === 'horizontal' &&
    (Math.abs(deltaX) >= commitThreshold || Math.abs(projectedX) >= projectedThreshold);
  releaseInfoPointer(event);
  if (commit) switchTrackWithAnimation(deltaX < 0 ? 'left' : 'right');
  else finishInfoSwipeAnimation();
};

const onInfoPointerCancel = (event: PointerEvent) => {
  if (infoPointerId !== event.pointerId) return;
  releaseInfoPointer(event);
  finishInfoSwipeAnimation();
};

onBeforeUnmount(() => {
  if (infoSwipeTimer) window.clearTimeout(infoSwipeTimer);
});

function handleTogglePlayMode() {
  togglePlayMode();
  emitInteract();
}

function handleShowPlaylist() {
  playerSurfaceFeedback.pulse();
  emit('showPlaylist');
}

async function handleFavorite() {
  const id = playMusic.value?.id;
  if (id === undefined || id === null) return;
  if (isFavorite.value) await playerStore.removeFromFavorite(id);
  else await playerStore.addToFavorite(id);
  emitInteract();
}

function handleShowSettings() {
  playerSurfaceFeedback.pulse();
  emit('showSettings');
}

function emitInteract() {
  playerSurfaceFeedback.pulse();
  emit('interact');
}

// ==================== 进度条交互 ====================
const isThumbDragging = ref(false);

const seekToRatio = (clientX: number, target: HTMLElement) => {
  const rect = target.closest('.apple-style-progress')?.getBoundingClientRect();
  if (!rect) return;
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  const time = ratio * allTime.value;
  // 使用 sound.seek() 直接控制音频
  if (sound.value) {
    sound.value.seek(time);
  }
  emitInteract();
};

const handleProgressBarClick = (e: MouseEvent) => {
  seekToRatio(e.clientX, e.target as HTMLElement);
};

const handleMouseDown = (e: MouseEvent) => {
  isThumbDragging.value = true;
  seekToRatio(e.clientX, e.target as HTMLElement);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};

const handleMouseMove = (e: MouseEvent) => {
  if (!isThumbDragging.value) return;
  seekToRatio(e.clientX, e.target as HTMLElement);
};

const handleMouseUp = () => {
  isThumbDragging.value = false;
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
};

// 触摸拖拽
const handleThumbTouchStart = (e: TouchEvent) => {
  isThumbDragging.value = true;
  emitInteract();
  e.stopPropagation();
};

const handleThumbTouchMove = (e: TouchEvent) => {
  if (!isThumbDragging.value) return;
  seekToRatio(e.touches[0].clientX, e.target as HTMLElement);
  e.preventDefault();
};

const handleThumbTouchEnd = () => {
  isThumbDragging.value = false;
  emitInteract();
};
</script>

<style scoped lang="scss">
.mobile-controls {
  position: absolute;
  bottom: 0;
  left: 14px;
  right: 14px;
  z-index: 30;
  padding: 14px 16px calc(var(--safe-area-inset-bottom, 0px) + 16px);
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  opacity: 0;
  transition:
    opacity 0.3s ease,
    border-color var(--player-glass-feedback-duration, 220ms) ease,
    background-color var(--player-glass-feedback-duration, 220ms) ease,
    box-shadow var(--player-glass-feedback-duration, 220ms) ease;
  pointer-events: none;

  &.surface-interaction-active {
    background: transparent;
    box-shadow: none;
  }

  &.visible {
    opacity: 1;
    pointer-events: auto;
  }

  &.fullscreen-mode {
    padding-bottom: calc(var(--safe-area-inset-bottom, 0px) + 18px);
  }

  &.shared-surface-content {
    position: relative;
    inset: auto;
    width: 100%;
    padding: 12px 16px 14px;
    border: 0;
    border-radius: inherit;
    background: transparent;
    box-shadow: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}

.player-info-row {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  opacity: clamp(0, calc((var(--player-open-progress, 0) - 0.88) * 9), 1);
  transform: translate3d(0, calc((1 - var(--player-open-progress, 0)) * 16px), 0);
}

.player-info-main {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  /* 横滑切歌手势由指针事件接管，禁用浏览器横向默认行为 */
  touch-action: pan-y;
  will-change: transform;
}

.player-info-cover {
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  border-radius: 10px;
  object-fit: cover;
}

.player-info-copy {
  display: grid;
  min-width: 0;
  gap: 3px;
  text-align: left;
  transform: translate3d(0, calc((1 - var(--player-open-progress, 0)) * 10px), 0);
  transition: transform 180ms ease;
}

.player-info-copy strong,
.player-info-copy span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-info-copy strong {
  color: rgba(var(--player-ink-rgb, 255, 255, 255), 0.96);
  font-size: 16px;
  font-weight: 700;
  transition: color 180ms ease;
}

.player-info-copy span {
  color: rgba(var(--player-ink-rgb, 255, 255, 255), 0.64);
  font-size: 12px;
  transition: color 180ms ease;
}

.player-info-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 2px;
}

.player-info-action {
  display: grid;
  width: 38px;
  height: 38px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: rgba(var(--player-ink-rgb, 255, 255, 255), 0.78);
  font-size: 20px;
  place-items: center;
}

.player-info-action.active {
  color: var(--accent-color, #fff);
}

.player-info-action:active {
  transform: scale(0.9);
}

.progress-container {
  margin-bottom: 10px;
  opacity: clamp(0, calc((var(--player-open-progress, 1) - 0.34) * 2.8), 1);
}

.time-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  opacity: 0.6;
  margin-top: 8px;
}

.apple-style-progress {
  position: relative;
  height: 4px;
  background: rgba(var(--player-ink-rgb, 255, 255, 255), 0.15);
  border-radius: 2px;
  cursor: pointer;
}

.progress-track {
  position: relative;
  width: 100%;
  height: 100%;
}

.progress-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: var(--accent-color, #fff);
  border-radius: 2px;
  transition: width 0.1s linear;
  z-index: 1;

  /* 上一首播放到尽头后：主体色渐变为轨道背景色，然后隐藏 */
  &.fading-out {
    background: rgba(var(--player-ink-rgb, 255, 255, 255), 0.15) !important;
    box-shadow: none;
    transition:
      background 0.6s ease,
      box-shadow 0.6s ease;
  }
}

.progress-fill-next {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  border-radius: 2px;
  z-index: 1;
  pointer-events: none;
  transition: width 0.1s linear;
}

.progress-thumb {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--accent-color, #fff);
  transform: translate(-50%, -50%) scale(0);
  transition: transform 0.2s ease;

  &.active {
    transform: translate(-50%, -50%) scale(1.3);
  }
}

.apple-style-progress:hover .progress-thumb,
.apple-style-progress:active .progress-thumb {
  transform: translate(-50%, -50%) scale(1);
}

.climax-track {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.climax-segment {
  position: absolute;
  top: 0;
  bottom: 0;
  background: rgba(255, 200, 50, 0.35);
  border-radius: 1px;

  &.climax-active {
    background: rgba(255, 200, 50, 0.7);
  }
}

.control-buttons {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  align-items: center;
  justify-items: center;
  gap: 0;
  width: 100%;
  opacity: clamp(0, calc((var(--player-open-progress, 1) - 0.46) * 3), 1);
  transform: translate3d(0, calc((1 - var(--player-open-progress, 1)) * 12px), 0);
}

.side-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 20px;
  color: var(--text-color-active, #fff);
  opacity: 0.7;

  &:active {
    opacity: 1;
  }
}

.main-button {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s ease;
  border-radius: 50%;

  i {
    font-size: 28px;
    color: var(--text-color-active, #fff);
  }

  &.play-pause i {
    font-size: 40px;
  }

  &:active {
    transform: scale(1.1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .mobile-controls {
    transition-duration: 100ms;
  }
}
</style>
