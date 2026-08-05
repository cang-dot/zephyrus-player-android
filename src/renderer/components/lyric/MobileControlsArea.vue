<template>
  <div
    class="mobile-controls no-toggle"
    :class="{ visible: visible, 'fullscreen-mode': isFullscreen }"
    @click.stop
    @touchstart.stop="emitInteract"
    @touchend.stop
    @mousedown.stop="emitInteract"
  >
    <!-- 进度条 -->
    <div class="progress-container">
      <div class="time-info">
        <span class="current-time">{{ secondToMinute(nowTime) }}</span>
        <span class="total-time">{{ secondToMinute(allTime) }}</span>
      </div>
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
    </div>

    <!-- 控制按钮 -->
    <div class="control-buttons">
      <div v-if="isFullscreen" class="back-button" @click.stop="$emit('close')">
        <i class="ri-arrow-down-s-line"></i>
      </div>
      <div class="side-button" @click="togglePlayMode">
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
      <div class="side-button" @click="$emit('showPlaylist')">
        <i class="iconfont icon-list"></i>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { allTime, nowTime, pause, play, sound } from '@/hooks/MusicHook';
import { usePlayMode } from '@/hooks/usePlayMode';
import { useStyleEngineStore } from '@/store/modules/styleEngine';
import { usePlayerStore } from '@/store/modules/player';
import { useTransitionStore } from '@/store/modules/transition';
import { secondToMinute } from '@/utils';

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
    boxShadow: `0 0 8px ${color}80`,
  };
});

/** 进度条 thumb 位置：crossfade 时跟随下一首进度 */
const thumbPosition = computed(() => {
  if (transitionStore.isCrossfadingUI) {
    return `${transitionStore.nextProgress}%`;
  }
  return `${(nowTime.value / Math.max(1, allTime.value)) * 100}%`;
});

const props = defineProps<{
  visible?: boolean;
  isFullscreen?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  showPlaylist: [];
  interact: [];
}>();

const playerStore = usePlayerStore();
const styleEngine = useStyleEngineStore();
const { playMode, playModeIcon, togglePlayMode } = usePlayMode();

const playState = computed(() => playerStore.isPlay);
const playIcon = computed(() => (playState.value ? 'ri-pause-fill' : 'ri-play-fill'));

// 播放控制（使用 MusicHook 直接控制音频）
function handleTogglePlay() {
  if (playState.value) {
    pause();
  } else {
    play();
  }
  emit('interact');
}

function handlePrev() {
  playerStore.prevPlay();
  emit('interact');
}

function handleNext() {
  playerStore.nextPlay();
  emit('interact');
}

function emitInteract() {
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
  emit('interact');
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
  left: 0;
  right: 0;
  z-index: 30;
  padding: 0 24px calc(env(safe-area-inset-bottom, 0px) + 32px);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;

  &.visible {
    opacity: 1;
    pointer-events: auto;
  }

  &.fullscreen-mode {
    padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 40px);
  }
}

.progress-container {
  margin-bottom: 16px;
}

.time-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  opacity: 0.6;
  margin-bottom: 8px;
}

.apple-style-progress {
  position: relative;
  height: 4px;
  background: rgba(255, 255, 255, 0.15);
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
    background: rgba(255, 255, 255, 0.15) !important;
    box-shadow: none;
    transition: background 0.6s ease, box-shadow 0.6s ease;
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
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
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

.back-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 24px;
  color: var(--text-color-active, #fff);
}
</style>
