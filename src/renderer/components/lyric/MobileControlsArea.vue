<template>
  <div class="mobile-controls" :class="{ visible: visible, 'fullscreen-mode': isFullscreen }">
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
          <div class="climax-track" v-if="climaxStore.hasSegments && allTime > 0">
            <div
              v-for="(seg, i) in climaxStore.segments"
              :key="'cl-' + i"
              class="climax-segment"
              :class="{ 'climax-active': nowTime >= seg.start && nowTime <= seg.end }"
              :style="{
                left: (seg.start / allTime) * 100 + '%',
                width: Math.max(0.5, ((seg.end - seg.start) / allTime) * 100) + '%'
              }"
            ></div>
          </div>
          <div
            class="progress-fill"
            :style="{ width: `${(nowTime / Math.max(1, allTime)) * 100}%` }"
          ></div>
          <div
            class="progress-thumb"
            :class="{ active: isThumbDragging }"
            :style="{ left: `${(nowTime / Math.max(1, allTime)) * 100}%` }"
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
      <div class="main-button prev" @click="prevSong">
        <i class="ri-skip-back-fill"></i>
      </div>
      <div class="main-button play-pause" @click="togglePlay">
        <i :class="playIcon"></i>
      </div>
      <div class="main-button next" @click="nextSong">
        <i class="ri-skip-forward-fill"></i>
      </div>
      <div class="side-button" @click="$emit('showPlaylist')">
        <i class="iconfont icon-list"></i>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';

import { allTime, nowTime } from '@/hooks/MusicHook';
import { usePlayMode } from '@/hooks/usePlayMode';
import { useClimaxStore } from '@/store/modules/climax';
import { usePlayerStore } from '@/store/modules/player';
import { secondToMinute } from '@/utils';

defineProps<{
  isFullscreen?: boolean;
}>();

defineEmits<{
  close: [];
  showPlaylist: [];
}>();

const playerStore = usePlayerStore();
const climaxStore = useClimaxStore();
const { playMode, playModeIcon, togglePlayMode } = usePlayMode();

const play = computed(() => playerStore.isPlay);
const playIcon = computed(() => (play.value ? 'ri-pause-fill' : 'ri-play-fill'));

// 播放控制
const togglePlay = () => playerStore.setPlay(!play.value);
const prevSong = () => playerStore.prevPlay();
const nextSong = () => playerStore.nextPlay();

// ==================== 3秒自动隐藏 ====================
const visible = ref(true);
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function showControls() {
  visible.value = true;
  resetHideTimer();
}

function hideControls() {
  visible.value = false;
}

function resetHideTimer() {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    visible.value = false;
  }, 3000);
}

// 暴露给父组件调用
defineExpose({ showControls, hideControls, visible });

// 初始显示，3秒后隐藏
resetHideTimer();

onBeforeUnmount(() => {
  if (hideTimer) clearTimeout(hideTimer);
});

// ==================== 进度条交互 ====================
const isThumbDragging = ref(false);
let dragStartX = 0;
let dragStartTime = 0;

const handleProgressBarClick = (e: MouseEvent) => {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const ratio = (e.clientX - rect.left) / rect.width;
  playerStore.setNowTime(ratio * allTime.value);
};

const handleMouseDown = (e: MouseEvent) => {
  isThumbDragging.value = true;
  dragStartX = e.clientX;
  dragStartTime = nowTime.value;
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  showControls();
};

const handleMouseMove = (e: MouseEvent) => {
  if (!isThumbDragging.value) return;
  const rect = (e.target as HTMLElement)?.closest('.apple-style-progress')?.getBoundingClientRect();
  if (!rect) return;
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  playerStore.setNowTime(ratio * allTime.value);
};

const handleMouseUp = () => {
  isThumbDragging.value = false;
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
  showControls();
};

// 触摸拖拽
const handleThumbTouchStart = (e: TouchEvent) => {
  isThumbDragging.value = true;
  showControls();
  e.stopPropagation();
};

const handleThumbTouchMove = (e: TouchEvent) => {
  if (!isThumbDragging.value) return;
  const rect = (e.target as HTMLElement)?.closest('.apple-style-progress')?.getBoundingClientRect();
  if (!rect) return;
  const ratio = Math.max(0, Math.min(1, (e.touches[0].clientX - rect.left) / rect.width));
  playerStore.setNowTime(ratio * allTime.value);
  e.preventDefault();
};

const handleThumbTouchEnd = () => {
  isThumbDragging.value = false;
  showControls();
};
</script>

<style scoped lang="scss">
.mobile-controls {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 20;
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
