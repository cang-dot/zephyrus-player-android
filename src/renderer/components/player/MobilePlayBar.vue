<template>
  <div
    ref="playBarRef"
    class="mobile-play-bar"
    :class="[
      setAnimationClass('animate__fadeInUp'),
      isExpanded ? 'play-bar-expanded' : 'play-bar-mini',
      shouldShowMobileMenu ? 'is-menu-show' : 'is-menu-hide',
      isCompactNav && shouldShowMobileMenu ? 'compact-nav' : ''
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
    <div v-if="!isExpanded" class="mobile-mini-controls">
      <!-- 歌曲信息 -->
      <div class="mini-song-info" @click="setMusicFull">
        <n-image
          :src="getImgUrl(playMusic?.picUrl, '100y100')"
          class="mini-song-cover"
          lazy
          preview-disabled
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

      <div class="mini-playback-controls">
        <div class="mini-control-btn play" @click="playMusicEvent">
          <i class="iconfont icon" :class="play ? 'icon-stop' : 'icon-play'"></i>
        </div>
        <i class="iconfont icon-list mini-list-icon" @click="openPlayListDrawer"></i>
      </div>
    </div>

    <!-- 全屏播放器：迷你播放栏放大铺满全屏 / 关闭反向缩小 -->
    <Transition @enter="onPlayerEnter" @leave="onPlayerLeave">
      <music-full-wrapper
        v-if="playerStore.musicFull"
        v-model="playerStore.musicFull"
        :background="background"
      />
    </Transition>
  </div>
</template>

<script lang="ts" setup>
import { useSwipe } from '@vueuse/core';
import type { Ref } from 'vue';
import { computed, inject, onMounted, ref, watch } from 'vue';

import MusicFullWrapper from '@/components/lyric/MusicFullWrapper.vue';
import { artistList, playMusic, textColors } from '@/hooks/MusicHook';
import { usePlayerStore } from '@/store/modules/player';
import { useSettingsStore } from '@/store/modules/settings';
import { getImgUrl, setAnimationClass } from '@/utils';

const shouldShowMobileMenu = inject('shouldShowMobileMenu') as Ref<boolean>;
const isCompactNav = inject('isCompactNav', ref(false)) as Ref<boolean>;

const playerStore = usePlayerStore();
const settingsStore = useSettingsStore();

// 是否播放
const play = computed(() => playerStore.isPlay);
// 全屏播放器背景色（跟随当前歌曲封面主色）
const background = ref('#000');
// 播放器开合状态：关闭时延迟到缩小动画结束再恢复迷你形态
const isExpanded = ref(false);

// 播放器开合形变动画：用 WAAPI 直接动画迷你播放栏本体，
// fill:none 结束后不残留 transform（残留会形成 containing block，导致内容错位/点击失效）
let morphFallbackTimer: number | null = null;

const clearMorphFallback = () => {
  if (morphFallbackTimer) {
    window.clearTimeout(morphFallbackTimer);
    morphFallbackTimer = null;
  }
};

const onPlayerEnter = (_el: Element, done: () => void) => {
  clearMorphFallback();
  isExpanded.value = true;
  const bar = playBarRef.value;
  if (!bar) return done();
  bar.animate(
    [
      {
        transform: 'scale(0.18)',
        opacity: 0.92,
        borderRadius: '24px',
        offset: 0
      },
      {
        transform: 'scale(1)',
        opacity: 1,
        borderRadius: '0px',
        offset: 1
      }
    ],
    {
      duration: 340,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'none'
    }
  );
  done();
};

const onPlayerLeave = (_el: Element, done: () => void) => {
  clearMorphFallback();
  const bar = playBarRef.value;
  if (!bar) return done();
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearMorphFallback();
    isExpanded.value = false;
    done();
  };
  const animation = bar.animate(
    [
      {
        transform: 'scale(1)',
        opacity: 1,
        borderRadius: '0px',
        offset: 0
      },
      {
        transform: 'scale(0.18)',
        opacity: 0.92,
        borderRadius: '24px',
        offset: 1
      }
    ],
    {
      duration: 300,
      easing: 'cubic-bezier(0.55, 0, 0.55, 0.2)',
      fill: 'both'
    }
  );
  animation.onfinish = finish;
  morphFallbackTimer = window.setTimeout(finish, 400);
};

watch(
  () => playerStore.musicFull,
  (visible) => {
    if (visible) isExpanded.value = true;
  }
);

// 播放控制
function handleNext() {
  playerStore.nextPlay();
}

function handlePrev() {
  playerStore.prevPlay();
}

// 设置 musicFull
const setMusicFull = () => {
  playerStore.setMusicFull(!playerStore.musicFull);
  if (playerStore.musicFull) {
    settingsStore.showArtistDrawer = false;
  }
};

watch(
  () => playerStore.musicFull,
  (_newVal) => {
    // 状态栏样式更新已在 Web 环境中禁用
  }
);

watch(
  () => playerStore.playMusic,
  (song) => {
    background.value = song?.backgroundColor || '#000';
  },
  { immediate: true, deep: true }
);

// 打开播放列表抽屉
const openPlayListDrawer = () => {
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

// 滑动切歌
const playBarRef = ref<HTMLElement | null>(null);
onMounted(() => {
  if (playBarRef.value) {
    const { direction } = useSwipe(playBarRef, {
      onSwipeEnd: () => {
        if (direction.value === 'left') handleNext();
        if (direction.value === 'right') handlePrev();
      },
      threshold: 30
    });
  }
});
</script>

<style lang="scss" scoped>
.mobile-play-bar {
  @apply fixed bottom-[76px] left-0 w-full flex flex-col;
  z-index: 100000;
  animation-duration: 0.3s !important;
  /* 统一弹簧过渡 — 位置、宽度、高度、边距全部平滑形变，不创建新对象 */
  transition:
    bottom 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
    left 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
    width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
    max-width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
    min-width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);

  &.is-menu-show {
    bottom: calc(var(--safe-area-inset-bottom, 0px) + 60px);
  }
  &.is-menu-hide {
    bottom: calc(var(--safe-area-inset-bottom, 0px) + 8px);
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
    background: var(--m-surface, #eae6df);
    /* 内部元素形变过渡 — 与外层同步 */
    transition:
      margin 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
      height 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
      padding 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
      gap 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
      background 0.5s ease,
      border 0.5s ease;

    .mini-song-info {
      @apply flex items-center flex-1 min-w-0 cursor-pointer;
      transition: flex 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);

      .mini-song-cover {
        @apply w-12 h-12 rounded-full;
        border: 8px solid var(--m-surface-alt, #e0dbd3);
        transition:
          width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
          height 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
          border-width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      .mini-song-text {
        @apply ml-3 min-w-0 flex-1 flex items-center;
        transition:
          opacity 0.3s ease,
          max-width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        overflow: hidden;

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
    bottom: calc(var(--safe-area-inset-bottom, 0px) + 8px) !important;
    left: 12px !important;
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

/* ═══ 全屏播放器过渡：迷你播放栏放大铺满全屏 / 关闭反向缩小 ═══ */
.mobile-play-bar.play-bar-expanded {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100dvh;
  max-height: none;
  bottom: 0;
  z-index: 100001;
  background: transparent;
  pointer-events: auto;
}

/* 默认样式 n-drawer 的自带滑入会与形变动画冲突，进入侧禁用；退出侧保留兜底 */
.mobile-play-bar :deep(.slide-in-from-bottom-transition-enter-active),
.mobile-play-bar :deep(.slide-in-from-bottom-transition-enter-from),
.mobile-play-bar :deep(.slide-in-from-bottom-transition-enter-to) {
  transition: none !important;
  transform: none !important;
}
</style>
