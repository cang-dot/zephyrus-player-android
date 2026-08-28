<template>
  <n-drawer
    v-model:show="isVisible"
    :destroy-on-close="true"
    height="100%"
    placement="bottom"
    :style="{ background: playerStore.playMusic.primaryColor || background }"
    :to="`#layout-main`"
    :z-index="9998"
  >
    <div
      id="mobile-drawer-target"
      class="player-style-surface"
      :style="{ ...styleVars, ...lyricsSwipeStyle }"
      ref="drawerTargetRef"
      @click="handleTapToggle"
      @pointerdown.capture="onLyricsSwipePointerDown"
      @pointermove.capture="onLyricsSwipePointerMove"
      @pointerup.capture="onLyricsSwipePointerUp"
      @pointercancel.capture="onLyricsSwipePointerCancel"
      @touchstart="onDrawerTouchStart"
      @touchend="onDrawerTouchEnd"
      :class="[
        config.theme,
        `cover-style-${config.mobileCoverStyle}`,
        { 'is-landscape': isLandscape },
        { 'is-dark': isDark },
        {
          'player-style-customized': isCustom,
          'player-style-custom-font': customFontActive,
          'player-style-custom-background': customBackgroundActive
        }
      ]"
    >
      <!-- 顶部控制按钮 -->
      <div v-if="playMusic?.playLoading" class="loading-overlay">
        <i class="ri-loader-4-line loading-icon"></i>
      </div>
      <div
        v-show="controlsVisible"
        class="control-btn absolute left-5 no-toggle"
        @click="closeMusicFull"
      >
        <i class="ri-arrow-down-s-line"></i>
      </div>

      <!-- 右上角设置按钮 -->
      <div
        v-show="controlsVisible"
        class="control-btn absolute right-5 flex items-center gap-2 no-toggle"
        :class="[hasSleepTimerActive ? '!w-auto !px-2' : '']"
      >
        <!-- 定时器倒计时显示 -->
        <div
          v-if="hasSleepTimerActive"
          class="flex items-center gap-1 px-2 py-1 rounded-full bg-black/30 backdrop-blur-sm text-xs text-white/90"
          @click="showPlayerSettings = true"
        >
          <i class="ri-timer-line text-[var(--accent-color-light)]"></i>
          <span class="font-medium tabular-nums">{{ sleepTimerDisplayText }}</span>
        </div>
        <div @click="showPlayerSettings = true">
          <i class="ri-more-2-fill"></i>
        </div>
      </div>

      <!-- 播放设置弹窗 -->
      <mobile-player-settings v-model:visible="showPlayerSettings" />

      <cover-preview-modal
        v-model:visible="coverPreviewVisible"
        :src="previewCoverUrl"
        :title="playMusic.name"
      />

      <!-- 全屏歌词页面 - 竖屏模式下（与其他样式共用的滚动歌词组件） -->
      <Transition name="lyrics-surface">
        <div
          v-if="(showFullLyrics || lyricsSwipePreview) && !isLandscape"
          class="fullscreen-lyrics"
          :class="[
            config.theme,
            config.lyricSwipeDirection === 'right'
              ? 'lyrics-surface-from-left'
              : 'lyrics-surface-from-right'
          ]"
          :style="lyricsOverlayStyle"
        >
          <div class="fullscreen-header">
            <button
              type="button"
              class="fullscreen-back no-toggle"
              aria-label="返回播放器"
              @click.stop="closeFullLyrics"
            >
              <i class="ri-arrow-down-s-line"></i>
            </button>
            <div class="song-title" v-html="playMusic.name"></div>
            <div class="artist-name">
              <span v-for="(item, index) in artistList" :key="index">
                {{ item.name }}{{ index < artistList.length - 1 ? ' / ' : '' }}
              </span>
            </div>
          </div>

          <mobile-scrolling-lyrics
            class="fullscreen-lyrics-body"
            :back-closes="showFullLyrics"
            :active="showFullLyrics || lyricsSwipePreview"
            @close="closeFullLyrics"
          />
        </div>
      </Transition>

      <!-- 主要内容区域 - 竖屏模式下的普通布局 -->
      <div
        v-show="!showFullLyrics || lyricsSwipePreview"
        class="ios-layout-container"
        :style="lyricsUnderlayStyle"
      >
        <!-- 封面区域 -->
        <div
          class="cover-container"
          :class="{
            'record-style': config.mobileCoverStyle === 'record',
            'square-style': config.mobileCoverStyle === 'square',
            'full-style': config.mobileCoverStyle === 'full',
            paused: !play
          }"
          @click="cycleCoverStyle"
          @pointerdown="startCoverLongPress"
          @pointerup="cancelCoverLongPress"
          @pointercancel="cancelCoverLongPress"
          @contextmenu.prevent="openCoverPreview"
        >
          <div class="img-wrapper">
            <img
              v-if="coverImageUrl"
              :key="coverImageUrl"
              :src="coverImageUrl"
              alt=""
              decoding="async"
              class="cover-image"
              :class="{ 'full-blend': config.mobileCoverStyle === 'full' }"
              @load="handleCoverLoad"
              @error="handleCoverError"
            />
            <div v-else class="cover-placeholder" aria-hidden="true">
              <i class="ri-music-2-fill"></i>
            </div>
          </div>
        </div>

        <div class="px-2 flex-1 flex flex-col justify-around w-[85%]">
          <!-- 歌曲信息 -->
          <div class="song-info">
            <div class="song-title-container">
              <h1 class="song-title" v-html="playMusic.name"></h1>
            </div>
            <p class="song-artist">
              <span
                v-for="(item, index) in artistList"
                :key="index"
                class="artist-name"
                @click="handleArtistClick(item.id)"
              >
                {{ item.name }}
                {{ index < artistList.length - 1 ? ' / ' : '' }}
              </span>
            </p>
            <div class="favorite-icon" @click="toggleFavorite">
              <i class="ri-heart-3-fill" :class="{ favorite: isFavorite }"></i>
            </div>
          </div>

          <!-- 歌词区域：与其他样式共用的滚动歌词组件 -->
          <div class="lyrics-container" v-if="!config.hideLyrics" @click="showFullLyricScreen">
            <mobile-scrolling-lyrics
              v-if="lrcArray.length > 0 && !showFullLyrics && !lyricsSwipePreview"
              class="embedded-lyrics"
              :active="!showFullLyrics && !lyricsSwipePreview"
            />
            <div v-else class="no-lyrics">
              {{ t('player.lrc.noLrc') }}
            </div>
          </div>
        </div>
      </div>

      <!-- 横屏模式布局 -->
      <div v-if="isLandscape" class="landscape-layout">
        <!-- 左侧封面和进度条 -->
        <div class="landscape-left-section">
          <div
            class="landscape-cover-container cover-container"
            :class="{
              'record-style': config.mobileCoverStyle === 'record',
              'square-style': config.mobileCoverStyle === 'square',
              'full-style': config.mobileCoverStyle === 'full',
              paused: !play
            }"
            @click="cycleCoverStyle"
            @pointerdown="startCoverLongPress"
            @pointerup="cancelCoverLongPress"
            @pointercancel="cancelCoverLongPress"
            @contextmenu.prevent="openCoverPreview"
          >
            <div class="img-wrapper">
              <img
                v-if="coverImageUrl"
                :key="`landscape-${coverImageUrl}`"
                :src="coverImageUrl"
                alt=""
                decoding="async"
                class="cover-image"
                :class="{ 'full-blend': config.mobileCoverStyle === 'full' }"
                @load="handleCoverLoad"
                @error="handleCoverError"
              />
              <div v-else class="cover-placeholder" aria-hidden="true">
                <i class="ri-music-2-fill"></i>
              </div>
            </div>
          </div>

          <!-- 左侧进度条 -->
          <div class="landscape-progress-container">
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
                <div
                  v-for="(marker, index) in climaxMarkerStyles"
                  :key="`landscape-climax-${index}`"
                  class="climax-progress-marker"
                  :style="marker"
                ></div>
                <div
                  v-if="!transitionStore.isCrossfadingUI || !transitionStore.currentSongEnded"
                  class="progress-fill"
                  :class="{ 'fading-out': transitionStore.currentSongEnded }"
                  :style="currentFillStyle"
                ></div>
                <div
                  v-if="transitionStore.isCrossfadingUI"
                  class="progress-fill-next"
                  :style="nextFillStyle"
                ></div>
                <div
                  class="progress-thumb"
                  :class="{ active: isThumbDragging || isMouseDragging }"
                  :style="{ left: thumbPosition }"
                  @touchstart="handleThumbTouchStart"
                  @touchmove="handleThumbTouchMove"
                  @touchend="handleThumbTouchEnd"
                  @mousedown="handleMouseDown"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧歌词区域 -->
        <div class="landscape-lyrics-section">
          <!-- 歌曲信息放置在顶部 -->
          <div class="landscape-song-info">
            <div class="flex flex-col flex-1">
              <h1 class="song-title" v-html="playMusic.name"></h1>
              <p class="song-artist">
                <span
                  v-for="(item, index) in artistList"
                  :key="index"
                  class="artist-name"
                  @click="handleArtistClick(item.id)"
                >
                  {{ item.name }}{{ index < artistList.length - 1 ? ' / ' : '' }}
                </span>
              </p>
            </div>
            <div class="favorite-icon landscape" @click="toggleFavorite">
              <i class="ri-heart-3-fill" :class="{ favorite: isFavorite }"></i>
            </div>
          </div>

          <!-- 歌词滚动区域（与其他样式共用的滚动歌词组件） -->
          <mobile-scrolling-lyrics class="landscape-lyrics-body" :active="isLandscape" />
        </div>

        <!-- 横屏底栏：左侧歌曲信息，右侧完整控制 -->
        <div
          v-show="controlsVisible"
          class="landscape-control-bar no-toggle"
          :class="{ 'is-visible': controlsVisible }"
          @click.stop
        >
          <div class="bar-song-info">
            <img
              v-if="coverImageUrl"
              :src="coverImageUrl"
              alt=""
              decoding="async"
              @pointerdown.stop="startCoverLongPress"
              @pointerup.stop="cancelCoverLongPress"
              @pointercancel.stop="cancelCoverLongPress"
              @contextmenu.prevent="openCoverPreview"
            />
            <div class="song-meta">
              <span class="name" v-html="playMusic.name"></span>
              <span class="artist">{{ artistList.map((item) => item.name).join(' / ') }}</span>
            </div>
          </div>

          <div class="bar-controls">
            <button type="button" aria-label="收藏" @click="toggleFavorite">
              <i class="ri-heart-3-fill" :class="{ favorite: isFavorite }"></i>
            </button>
            <button type="button" :aria-label="playModeText" @click="togglePlayMode">
              <i :class="[playModeIcon, { 'intelligence-active': playMode === 3 }]"></i>
            </button>
            <div class="transport">
              <button type="button" aria-label="上一首" @click="prevSong">
                <i class="ri-skip-back-fill"></i>
              </button>
              <button type="button" class="primary" aria-label="播放暂停" @click="togglePlay">
                <i :class="playIcon"></i>
              </button>
              <button type="button" aria-label="下一首" @click="nextSong">
                <i class="ri-skip-forward-fill"></i>
              </button>
            </div>
            <button
              type="button"
              aria-label="播放列表"
              @click="playerStore.setPlayListDrawerVisible(true)"
            >
              <i class="ri-list-unordered"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- 竖屏模式的控制区域 -->
      <div
        v-if="!isLandscape"
        class="unified-controls"
        :class="{ 'fullscreen-mode': showFullLyrics }"
      >
        <!-- 进度条 (苹果风格) -->
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
              <div
                v-for="(marker, index) in climaxMarkerStyles"
                :key="`portrait-climax-${index}`"
                class="climax-progress-marker"
                :style="marker"
              ></div>
              <div
                v-if="!transitionStore.isCrossfadingUI || !transitionStore.currentSongEnded"
                class="progress-fill"
                :class="{ 'fading-out': transitionStore.currentSongEnded }"
                :style="currentFillStyle"
              ></div>
              <div
                v-if="transitionStore.isCrossfadingUI"
                class="progress-fill-next"
                :style="nextFillStyle"
              ></div>
              <div
                class="progress-thumb"
                :class="{ active: isThumbDragging || isMouseDragging }"
                :style="{ left: thumbPosition }"
                @touchstart="handleThumbTouchStart"
                @touchmove="handleThumbTouchMove"
                @touchend="handleThumbTouchEnd"
                @mousedown="handleMouseDown"
              ></div>
            </div>
          </div>
        </div>

        <!-- 控制按钮 -->
        <div class="control-buttons">
          <!-- 返回按钮，仅在全屏歌词模式下显示 -->
          <div v-if="showFullLyrics" class="back-button" @click.stop="closeFullLyrics">
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
          <div class="side-button" @click="showPlaylist">
            <i class="iconfont icon-list"></i>
          </div>
        </div>
      </div>
    </div>
  </n-drawer>
</template>

<script setup lang="ts">
import { useWindowSize } from '@vueuse/core';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import MobilePlayerSettings from '@/components/player/MobilePlayerSettings.vue';
import { useLyricSwipeGesture } from '@/composables/useLyricSwipeGesture';
import { useMobilePlayerTransition } from '@/composables/useMobilePlayerTransition';
import { usePlayerStyleAppearance } from '@/composables/usePlayerStyleAppearance';
import { useSwipeClose } from '@/composables/useSwipeClose';
import { useTapToggle } from '@/composables/useTapToggle';
import {
  allTime,
  artistList,
  lrcArray,
  nowTime,
  playMusic,
  sound,
  textColors
} from '@/hooks/MusicHook';
import { useArtist } from '@/hooks/useArtist';
import { usePlayMode } from '@/hooks/usePlayMode';
import { audioService } from '@/services/audioService';
import { usePlayerStore } from '@/store/modules/player';
import { useStyleEngineStore } from '@/store/modules/styleEngine';
import { useTransitionStore } from '@/store/modules/transition';
import { DEFAULT_LYRIC_CONFIG, LyricConfig } from '@/types/lyric';
import { getImgUrl, secondToMinute } from '@/utils';
import { appendArtworkRetry, normalizeArtworkUrl, resolveArtworkSource } from '@/utils/artwork';
import { getHoverBackgroundColor, getTextColors } from '@/utils/linearColor';
import { showBottomToast } from '@/utils/shortcutToast';

import MobileScrollingLyrics from './MobileScrollingLyrics.vue';

const { t } = useI18n();
const playerStore = usePlayerStore();
const styleEngine = useStyleEngineStore();
const transitionStore = useTransitionStore();
const { styleVars, isCustom, customBackgroundActive, customFontActive } =
  usePlayerStyleAppearance('default');

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

const climaxMarkerStyles = computed(() => {
  const duration = Math.max(0, allTime.value);
  if (!duration) return [];
  return styleEngine.climaxSegments.map((segment) => {
    const start = Math.max(0, Math.min(duration, segment.start));
    const end = Math.max(start, Math.min(duration, segment.end));
    return {
      left: `${(start / duration) * 100}%`,
      width: `${Math.max(0.5, ((end - start) / duration) * 100)}%`
    };
  });
});

// 播放控制相关
const play = computed(() => playerStore.isPlay);
const playIcon = computed(() => (play.value ? 'ri-pause-fill' : 'ri-play-fill'));

const coverRetryAttempt = ref(0);
const coverLoadFailed = ref(false);
const coverPreviewVisible = ref(false);
let coverRetryTimer: ReturnType<typeof setTimeout> | null = null;
let coverLongPressTimer: ReturnType<typeof setTimeout> | null = null;
const coverSource = computed(() => normalizeArtworkUrl(resolveArtworkSource(playMusic.value)));
const coverImageUrl = computed(() => {
  if (!coverSource.value || coverLoadFailed.value) return '';
  return appendArtworkRetry(getImgUrl(coverSource.value, '500y500'), coverRetryAttempt.value);
});
const previewCoverUrl = computed(() =>
  coverSource.value ? getImgUrl(coverSource.value, '1000y1000') : ''
);

function startCoverLongPress() {
  cancelCoverLongPress();
  coverLongPressTimer = setTimeout(openCoverPreview, 500);
}

function cancelCoverLongPress() {
  if (coverLongPressTimer) clearTimeout(coverLongPressTimer);
  coverLongPressTimer = null;
}

function openCoverPreview() {
  cancelCoverLongPress();
  if (previewCoverUrl.value) coverPreviewVisible.value = true;
}

watch(coverSource, () => {
  if (coverRetryTimer) clearTimeout(coverRetryTimer);
  if (coverLongPressTimer) clearTimeout(coverLongPressTimer);
  coverRetryTimer = null;
  coverRetryAttempt.value = 0;
  coverLoadFailed.value = false;
});

const handleCoverLoad = () => {
  coverLoadFailed.value = false;
};

const handleCoverError = () => {
  if (coverRetryTimer) return;
  if (coverRetryAttempt.value >= 2) {
    coverLoadFailed.value = true;
    return;
  }
  coverRetryTimer = setTimeout(
    () => {
      coverRetryTimer = null;
      coverRetryAttempt.value += 1;
    },
    coverRetryAttempt.value === 0 ? 250 : 600
  );
};

// 播放设置弹窗
const showPlayerSettings = ref(false);

// 定时器相关
const sleepTimerRefresh = ref(0);
let sleepTimerInterval: ReturnType<typeof setInterval> | null = null;

const hasSleepTimerActive = computed(() => playerStore.hasSleepTimerActive);

const sleepTimerDisplayText = computed(() => {
  void sleepTimerRefresh.value; // 触发响应式更新

  const timer = playerStore.sleepTimer;
  if (timer.type === 'time' && timer.endTime) {
    const remaining = Math.max(0, timer.endTime - Date.now());
    const totalSeconds = Math.floor(remaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  if (timer.type === 'songs' && timer.remainingSongs) {
    return `${timer.remainingSongs}首`;
  }
  if (timer.type === 'end') {
    return '列表结束';
  }
  return '';
});

// 启动/停止定时器刷新
watch(
  hasSleepTimerActive,
  (active) => {
    if (active && playerStore.sleepTimer.type === 'time') {
      if (!sleepTimerInterval) {
        sleepTimerInterval = setInterval(() => {
          sleepTimerRefresh.value = Date.now();
        }, 1000);
      }
    } else {
      if (sleepTimerInterval) {
        clearInterval(sleepTimerInterval);
        sleepTimerInterval = null;
      }
    }
  },
  { immediate: true }
);

// 播放模式
const { playMode, playModeIcon, playModeText, togglePlayMode: togglePlayModeBase } = usePlayMode();
// 打开播放列表
const showPlaylist = () => {
  playerStore.setPlayListDrawerVisible(true);
};

// 喜欢歌曲
const isFavorite = computed(() => {
  return playerStore.favoriteList.includes(playMusic.value.id as number);
});

const toggleFavorite = () => {
  if (isFavorite.value) {
    playerStore.removeFromFavorite(playMusic.value.id as number);
  } else {
    playerStore.addToFavorite(playMusic.value.id as number);
  }
};

// 歌词全屏控制（滚动与触摸交互由通用滚动歌词组件自行管理）
const showFullLyrics = ref(false);
const {
  style: lyricsSwipeStyle,
  overlayStyle: lyricsOverlayStyle,
  underlayStyle: lyricsUnderlayStyle,
  previewing: lyricsSwipePreview,
  onPointerDown: onLyricsSwipePointerDown,
  onPointerMove: onLyricsSwipePointerMove,
  onPointerUp: onLyricsSwipePointerUp,
  onPointerCancel: onLyricsSwipePointerCancel,
  animateOpen: openLyricsAnimated,
  animateClose: closeLyricsAnimated
} = useLyricSwipeGesture({
  isOpen: () => showFullLyrics.value,
  onOpen: () => commitShowFullLyrics(),
  onClose: () => commitCloseFullLyrics()
});

// 下滑关闭手势
const drawerTargetRef = ref<HTMLElement | null>(null);
const { onTouchStart: onDrawerTouchStart, onTouchEnd: onDrawerTouchEnd } = useSwipeClose({
  shouldClose: () => !showFullLyrics.value && !isLandscape.value,
  onClose: () => closeMusicFull()
});

// 横屏检测相关
const { width, height } = useWindowSize();
const isLandscape = computed(() => width.value > height.value);

// 显示全屏歌词
const commitShowFullLyrics = () => {
  showFullLyrics.value = true;
  playerStore.setFullLyricsVisible(true);
};

const commitCloseFullLyrics = () => {
  showFullLyrics.value = false;
  playerStore.setFullLyricsVisible(false);
};

const showFullLyricScreen = () => openLyricsAnimated();
const closeFullLyrics = () => closeLyricsAnimated();

watch(
  () => playerStore.fullLyricsVisible,
  (visible) => {
    if (!visible) showFullLyrics.value = false;
  }
);

// 封面样式循环切换
const cycleCoverStyle = () => {
  const styles = ['record', 'square', 'full'];
  const currentIdx = styles.indexOf(config.value.mobileCoverStyle);
  const nextIdx = (currentIdx + 1) % styles.length;
  config.value.mobileCoverStyle = styles[nextIdx] as 'record' | 'square' | 'full';

  // 添加动画反馈
  const container = document.querySelector('.cover-container');
  if (container) {
    container.classList.add('style-changing');
    setTimeout(() => {
      container.classList.remove('style-changing');
    }, 500);
  }
};

// 进度条相关
const isThumbDragging = ref(false);
const progressContainerWidth = ref(0);

// 鼠标拖动进度条相关变量
const isMouseDragging = ref(false);

// 处理进度条点击
const handleProgressBarClick = (e: MouseEvent) => {
  if (!sound.value) return;

  e.stopPropagation(); // 阻止事件冒泡
  const progressBar = e.currentTarget as HTMLElement;
  const rect = progressBar.getBoundingClientRect();
  const offsetX = e.clientX - rect.left;
  progressContainerWidth.value = rect.width;

  const percentage = offsetX / rect.width;
  const newTime = Math.max(0, Math.min(percentage * allTime.value, allTime.value));

  audioService.seek(newTime);
  nowTime.value = newTime;
};

// 鼠标按下事件
const handleMouseDown = (e: MouseEvent) => {
  if (e.button !== 0) return; // 只处理左键点击

  e.preventDefault();
  e.stopPropagation();
  isMouseDragging.value = true;

  // 立即更新位置
  const progressBar = (e.currentTarget as HTMLElement).closest(
    '.apple-style-progress'
  ) as HTMLElement;
  if (progressBar) {
    const rect = progressBar.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, offsetX / rect.width));
    const newTime = percentage * allTime.value;

    nowTime.value = newTime;
  }

  // 添加全局鼠标事件监听
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};

// 鼠标移动事件
const handleMouseMove = (e: MouseEvent) => {
  if (!isMouseDragging.value || !sound.value) return;

  e.preventDefault();

  // 查找当前视图中的进度条元素
  const progressBar = isLandscape.value
    ? document.querySelector('.landscape-left-section .apple-style-progress')
    : document.querySelector('.unified-controls .apple-style-progress');

  if (!progressBar) return;

  const rect = (progressBar as HTMLElement).getBoundingClientRect();
  const offsetX = e.clientX - rect.left;
  const percentage = Math.max(0, Math.min(1, offsetX / rect.width));
  const newTime = percentage * allTime.value;

  nowTime.value = newTime;
};

// 鼠标释放事件
const handleMouseUp = (e: MouseEvent) => {
  if (!isMouseDragging.value || !sound.value) return;

  e.preventDefault();

  // 释放时跳转到指定位置
  audioService.seek(nowTime.value);

  isMouseDragging.value = false;

  // 移除全局事件监听
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
};

// 处理滑块拖动
const handleThumbTouchStart = (e: TouchEvent) => {
  e.preventDefault(); // 阻止默认行为
  e.stopPropagation(); // 阻止事件冒泡
  isThumbDragging.value = true;

  // 获取进度条宽度
  const target = e.currentTarget as HTMLElement;
  const progressBar = target.parentElement?.parentElement as HTMLElement;
  if (progressBar) {
    progressContainerWidth.value = progressBar.getBoundingClientRect().width;
  }
};

const handleThumbTouchMove = (e: TouchEvent) => {
  if (!isThumbDragging.value || !sound.value) return;

  e.preventDefault(); // 阻止默认行为

  const touch = e.touches[0];
  const target = e.currentTarget as HTMLElement;
  const progressBar = target.parentElement?.parentElement as HTMLElement;
  const rect = progressBar.getBoundingClientRect();
  const offsetX = touch.clientX - rect.left;

  // 计算百分比并限制在0-1之间
  const percentage = Math.max(0, Math.min(1, offsetX / rect.width));
  const newTime = percentage * allTime.value;

  // 实时更新UI，但不频繁seek
  nowTime.value = newTime;
};

const handleThumbTouchEnd = (e: TouchEvent) => {
  if (!isThumbDragging.value || !sound.value) return;

  e.preventDefault(); // 阻止默认行为
  e.stopPropagation(); // 阻止事件冒泡

  // 拖动结束时执行seek操作
  audioService.seek(nowTime.value);
  isThumbDragging.value = false;
};

// 背景相关
const isDark = ref(false);
const config = ref<LyricConfig>({ ...DEFAULT_LYRIC_CONFIG });

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  background: {
    type: String,
    default: ''
  }
});

const themeMusic = {
  light: 'linear-gradient(to bottom, #ffffff, #f5f5f5)',
  dark: 'linear-gradient(to bottom, #1a1a1a, #000000)'
};

const emit = defineEmits(['update:modelValue']);

const isVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

// 设置文字颜色
const setTextColors = (background: string) => {
  if (!background) {
    textColors.value = getTextColors();
    document.documentElement.style.setProperty('--hover-bg-color', getHoverBackgroundColor(false));
    document.documentElement.style.setProperty('--text-color-primary', textColors.value.primary);
    document.documentElement.style.setProperty('--text-color-active', textColors.value.active);
    document.documentElement.style.setProperty('--bg-color', 'rgba(25, 25, 25, 1)');
    return;
  }

  // 更新文字颜色
  textColors.value = getTextColors(background);
  isDark.value = textColors.value.active === '#000000';

  document.documentElement.style.setProperty(
    '--hover-bg-color',
    getHoverBackgroundColor(isDark.value)
  );
  document.documentElement.style.setProperty('--text-color-primary', textColors.value.primary);
  document.documentElement.style.setProperty('--text-color-active', textColors.value.active);

  // 解析背景颜色用于封面融合
  let bgColor = playerStore.playMusic.primaryColor || 'rgba(25, 25, 25, 1)';

  document.documentElement.style.setProperty('--bg-color', bgColor);
};

const targetBackground = computed(() => {
  if (config.value.theme !== 'default') {
    return themeMusic[config.value.theme] || props.background;
  }
  return props.background;
});

// 监听目标背景变化并更新文字颜色
watch(
  targetBackground,
  (newBg) => {
    if (newBg) {
      setTextColors(newBg);
    }
  },
  { immediate: true }
);

// 组件卸载时清理动画
onBeforeUnmount(() => {
  playerStore.setFullLyricsVisible(false);
  if (coverRetryTimer) clearTimeout(coverRetryTimer);
  // 清理鼠标事件监听
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
});

const { navigateToArtist } = useArtist();

const handleArtistClick = (id: number) => {
  isVisible.value = false;
  navigateToArtist(id);
};

// 播放控制功能
const togglePlay = () => {
  try {
    playerStore.setPlay(playMusic.value);
  } catch (error) {
    console.error('播放出错:', error);
  }
};

const nextSong = () => {
  playerStore.nextPlay();
};

const prevSong = () => {
  playerStore.prevPlay();
};

const togglePlayMode = () => {
  togglePlayModeBase();
  showBottomToast(playModeText.value);
};

const closeMusicFull = () => {
  useMobilePlayerTransition().close(0, () => {
    isVisible.value = false;
    playerStore.setMusicFull(false);
  });
};

const { controlsVisible, handleTapToggle } = useTapToggle();

// 加载保存的配置
onMounted(() => {
  const savedConfig = localStorage.getItem('music-full-config');
  if (savedConfig) {
    config.value = { ...config.value, ...JSON.parse(savedConfig) };
  }
});

// 当显示状态变化时，更新封面与背景融合效果
watch(isVisible, (newVal) => {
  if (newVal) {
    // 播放器显示时，重新设置背景颜色
    if (targetBackground.value) {
      setTextColors(targetBackground.value);
    }
  } else {
    showFullLyrics.value = false;
    playerStore.setFullLyricsVisible(false);
  }
});
</script>

<style scoped lang="scss">
#mobile-drawer-target {
  @apply top-0 left-0 absolute overflow-hidden flex flex-col w-full h-full;
  animation-duration: 300ms;

  // 通用控制按钮样式
  .main-button {
    @apply flex items-center justify-center cursor-pointer transition-all duration-200 rounded-full;

    i {
      @apply text-2xl;
      color: var(--text-color-active);
    }

    &.play-pause {
      i {
        @apply text-4xl;
      }
    }

    &:hover {
      transform: scale(1.05);
    }

    &:active {
      transform: scale(0.95);
    }
  }

  // 通用进度条样式
  .apple-style-progress {
    @apply relative flex items-center cursor-pointer;
    touch-action: none; // 确保触摸事件正常工作

    .progress-track {
      @apply relative w-full h-2 bg-white bg-opacity-20 rounded-full;

      .climax-progress-marker {
        position: absolute;
        top: -2px;
        z-index: 2;
        height: calc(100% + 4px);
        min-width: 2px;
        border-radius: 999px;
        background: var(--accent-color, #ff7068);
        box-shadow: 0 0 7px color-mix(in srgb, var(--accent-color, #ff7068) 70%, transparent);
        opacity: 0.85;
        pointer-events: none;
      }

      .progress-fill {
        @apply absolute top-0 left-0 h-full bg-white rounded-full;
        box-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
        z-index: 1;
        transition: width 0.1s linear;

        /* 上一首播放到尽头后：主体色渐变为轨道背景色，然后隐藏 */
        &.fading-out {
          background: rgba(255, 255, 255, 0.15) !important;
          box-shadow: none;
          transition:
            background 0.6s ease,
            box-shadow 0.6s ease;
        }
      }

      .progress-fill-next {
        @apply absolute top-0 left-0 h-full rounded-full;
        z-index: 1;
        pointer-events: none;
        transition: width 0.1s linear;
      }

      .progress-thumb {
        @apply absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-white;
        box-shadow: 0 0 8px rgba(255, 255, 255, 0.6);
        z-index: 3;
        transition: transform 0.15s ease-out;

        &.active {
          transform: translate(-50%, -50%) scale(1.3);
          box-shadow: 0 0 12px rgba(255, 255, 255, 0.9);
        }

        &:active {
          transform: translate(-50%, -50%) scale(1.3);
        }
      }
    }
  }

  // 通用唱片样式
  .record-style-common {
    @apply rounded-full overflow-hidden relative;
    aspect-ratio: 1/1;

    &::before {
      content: '';
      @apply absolute top-0 left-0 w-full h-full rounded-full z-10;
      background: radial-gradient(
        circle at center,
        transparent 38%,
        rgba(0, 0, 0, 0.15) 38%,
        rgba(0, 0, 0, 0.15) 39%,
        rgba(255, 255, 255, 0.1) 39%,
        rgba(255, 255, 255, 0.1) 39.5%,
        rgba(0, 0, 0, 0.08) 39.5%,
        rgba(0, 0, 0, 0.08) 40.5%,
        rgba(0, 0, 0, 0.2) 40.5%,
        rgba(0, 0, 0, 0.2) 41.5%,
        rgba(0, 0, 0, 0.6) 41.5%,
        rgba(0, 0, 0, 0.6) 100%
      );
      pointer-events: none;
      animation: spin 20s linear infinite;
      animation-play-state: running;
    }

    &::after {
      content: '';
      @apply absolute w-6 h-6 rounded-full bg-gray-900 z-20;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.4);
    }

    &.paused {
      &::before,
      &::after {
        animation-play-state: paused;
      }
    }

    .img-wrapper {
      @apply rounded-full overflow-hidden border-solid border-black z-0;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);

      &::after {
        content: '';
        @apply absolute top-0 left-0 w-full h-full rounded-full z-[2];
        background: linear-gradient(
          135deg,
          rgba(255, 255, 255, 0.05) 0%,
          rgba(255, 255, 255, 0) 50%,
          rgba(0, 0, 0, 0.05) 100%
        );
        pointer-events: none;
      }
    }

    .cover-image {
      @apply w-full h-full rounded-full border-[2px] border-gray-900;
      display: block;
      object-fit: cover;
      animation: spin 20s linear infinite;
      animation-play-state: running;
    }

    .cover-placeholder {
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
      border-radius: inherit;
      color: var(--text-color-primary);
      background: rgba(0, 0, 0, 0.12);
      font-size: clamp(32px, 10vw, 72px);
      opacity: 0.42;
    }

    &.paused .cover-image {
      animation-play-state: paused;
    }
  }

  // 通用时间显示样式
  .time-info {
    @apply flex justify-between items-center mb-2;

    .current-time,
    .total-time {
      @apply text-sm;
      color: var(--text-color-primary);
      opacity: 0.8;
    }
  }

  // 通用收藏按钮样式
  .favorite-icon {
    @apply cursor-pointer transition-all duration-200;

    i {
      @apply text-xl;
      color: var(--text-color-primary);

      &.favorite {
        @apply text-red-500 !important;
      }
    }

    &:hover {
      transform: scale(1.1);
    }

    &:active {
      transform: scale(0.9);
    }

    &.landscape {
      i {
        @apply text-3xl;
      }
    }
  }

  // 通用歌曲信息样式
  .song-info-common {
    @apply z-[9995];

    .song-title {
      @apply font-bold line-clamp-1;
      color: var(--text-color-active);
    }

    .song-artist {
      @apply font-medium line-clamp-1;
      color: var(--text-color-primary);
      opacity: 0.9;

      .artist-name {
        @apply cursor-pointer;

        &:hover {
          @apply underline;
        }
      }
    }
  }

  // 横屏模式布局
  &.is-landscape {
    .landscape-layout {
      @apply flex flex-row w-full h-full overflow-hidden px-8 gap-4;

      // 左侧区域
      .landscape-left-section {
        @apply h-full flex flex-col items-center justify-start pt-5 px-2 relative;
        width: min(32vw, 300px);

        // 封面
        .landscape-cover-container {
          @apply flex-shrink-0 mx-auto mb-3 z-[9995];
          width: min(24vw, 210px);

          &.record-style {
            @extend .record-style-common;

            .img-wrapper {
              @apply border-[20px];
              width: 90%;
              height: 90%;
            }
          }
        }

        // 左侧进度条
        .landscape-progress-container {
          @apply mt-0 mb-2 px-2 w-full max-w-md;

          .apple-style-progress {
            height: 48px; // 增加高度使更容易点击

            .progress-thumb {
              @apply w-5 h-5;
            }
          }
        }
      }

      // 右侧区域
      .landscape-lyrics-section {
        @apply h-full flex-1 flex flex-col relative min-h-0 overflow-hidden;

        // 歌曲信息
        .landscape-song-info {
          @apply flex justify-between items-center pt-5 z-[9995] px-4;
          @extend .song-info-common;

          .song-title {
            @apply text-2xl mb-1;
          }

          .song-artist {
            @apply text-base;
          }
        }

        // 歌词滚动区域（通用滚动歌词组件，自带遮罩与内边距）
        .landscape-lyrics-body {
          @apply h-full w-full min-h-0;
          box-sizing: border-box;
          padding-bottom: var(--landscape-control-height, 64px);
          pointer-events: auto;
        }
      }

      // 控件栏覆盖整个横屏宽度；隐藏时 v-show 移除布局且不拦截歌词点击。
      .landscape-control-bar {
        --landscape-control-height: clamp(56px, 10vh, 64px);
        position: absolute;
        right: 0;
        bottom: 0;
        left: 0;
        z-index: 10000;
        display: grid;
        grid-template-columns: minmax(180px, 42%) minmax(0, 1fr);
        align-items: center;
        gap: 14px;
        height: var(--landscape-control-height);
        padding: 7px calc(env(safe-area-inset-right, 0px) + 16px)
          calc(7px + env(safe-area-inset-bottom, 0px)) 16px;
        background: linear-gradient(to top, rgba(0, 0, 0, 0.72), rgba(0, 0, 0, 0.12));
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        pointer-events: none;

        &.is-visible {
          pointer-events: auto;
        }

        .bar-song-info,
        .bar-controls button {
          display: flex;
          align-items: center;
          border: 0;
          color: var(--text-color-active, #fff);
        }

        .bar-song-info {
          min-width: 0;
          gap: 11px;

          img {
            width: 40px;
            height: 40px;
            flex-shrink: 0;
            border-radius: 9px;
            object-fit: cover;
          }

          .song-meta {
            display: flex;
            min-width: 0;
            flex-direction: column;
            gap: 3px;
          }

          .name,
          .artist {
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
          }

          .name {
            font-size: 14px;
            font-weight: 700;
          }
          .artist {
            font-size: 11px;
            opacity: 0.72;
          }
        }

        .bar-controls {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 7px;
          min-width: 0;

          button {
            width: 36px;
            height: 36px;
            justify-content: center;
            font-size: 19px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.13);
            cursor: pointer;
          }

          .favorite i.favorite {
            color: var(--accent-color-light, #ff7068);
          }

          .transport {
            display: flex;
            align-items: center;
            gap: 5px;

            .primary {
              width: 46px;
              height: 46px;
              margin: 0 2px;
              font-size: 25px;
              background: rgba(255, 255, 255, 0.22);
            }
          }
        }
      }
    }
  }

  // 竖屏模式布局
  &:not(.is-landscape) {
    .ios-layout-container {
      @apply flex flex-col items-center justify-between w-full h-full pt-10;
      padding-bottom: 180px; // 为控制区域留出空间

      // 封面样式
      .cover-container {
        @apply relative mb-6 transition-all duration-500 border-gray-900 z-[9995];

        &.style-changing {
          animation: styleChange 0.5s ease;
        }

        &.record-style {
          @extend .record-style-common;
          @apply w-72 h-72;

          .img-wrapper {
            @apply border-[40px];
            width: 90%;
            height: 90%;
          }
        }
      }

      // 歌曲信息
      .song-info {
        @apply flex flex-col items-center mb-5 w-full z-[9995];
        @extend .song-info-common;

        .song-title-container {
          @apply w-full text-center;

          .song-title {
            @apply text-2xl inline-block;
          }
        }

        .song-artist {
          @apply text-base mb-2;
        }

        .ri-heart-3-fill {
          @apply text-2xl;
        }
      }
    }

    // 统一控制区域
    .unified-controls {
      @apply fixed bottom-0 left-0 right-0 px-6 pt-6 pb-6;
      background: linear-gradient(to top, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0) 100%);
      height: 230px;
      pointer-events: auto;
      z-index: 10000 !important;

      .progress-container {
        @apply w-full mb-6;

        .apple-style-progress {
          height: 40px;

          .progress-thumb {
            @apply w-4 h-4;
          }
        }
      }

      .control-buttons {
        @apply flex items-center justify-between w-full px-4;

        .side-button {
          @apply w-10 h-10 flex items-center justify-center cursor-pointer transition-all duration-200;

          i {
            @apply text-2xl;
            color: var(--text-color-primary);

            &.intelligence-active {
              @apply text-[var(--accent-color)];
            }
          }

          &:hover {
            i {
              color: var(--text-color-active);
            }
          }
        }

        .main-button {
          @apply w-14 h-14;

          i {
            @apply text-3xl;
          }

          &.play-pause {
            @apply w-16 h-16 bg-white/15 rounded-full backdrop-blur-sm;

            i {
              @apply text-4xl;
            }
          }

          &:hover:not(.play-pause) {
            i {
              color: var(--text-color-active);
            }
          }

          &.play-pause:hover {
            @apply bg-white/30;
          }
        }
      }
    }
  }
}

// 旋转动画
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

// 加载动画
.loading-overlay {
  @apply absolute top-0 left-0 w-full h-full flex items-center justify-center;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 9999999999;

  .loading-icon {
    font-size: 36px;
    color: white;
    animation: spin 1s linear infinite;
  }
}

// 根据封面样式调整容器布局
#mobile-drawer-target.cover-style-record {
  .ios-layout-container .cover-container {
    @apply mt-4;
  }
}

#mobile-drawer-target.cover-style-full {
  .ios-layout-container {
    @apply pt-0;
  }
}

// 过渡动画
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes styleChange {
  0% {
    opacity: 0.7;
    transform: scale(0.95);
  }
  50% {
    opacity: 0.9;
    transform: scale(1.03);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes clickPulse {
  0% {
    opacity: 0.5;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes pulse {
  0% {
    opacity: 0.9;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.9;
  }
}

.favorite-icon {
  @apply cursor-pointer transition-all duration-200;

  i {
    @apply text-xl;
    color: var(--text-color-primary);

    &.favorite {
      @apply text-red-500 !important;
    }
  }

  &:hover {
    transform: scale(1.1);
  }

  &:active {
    transform: scale(0.9);
  }

  &.landscape {
    @apply mt-2;
    i {
      @apply text-2xl;
    }
  }
}

// 歌曲标题容器样式
.song-title-container {
  @apply w-full flex items-center justify-center relative;

  .song-title {
    @apply text-center text-2xl font-bold max-w-[80%] truncate;
    color: var(--text-color-active);
  }
}

// 通用歌词样式
.lyric-line {
  @apply cursor-pointer transition-all duration-300 font-medium;
  font-weight: 500;
  letter-spacing: var(--lyric-letter-spacing, 0);
  line-height: var(--lyric-line-height, 1.6);
  color: var(--text-color-primary);
  opacity: 0.8;

  &.no-scroll-tip {
    @apply text-base opacity-60 cursor-default py-2;
    color: var(--text-color-primary);
    font-weight: normal;

    span {
      padding-right: 0;
    }
  }

  span {
    background-clip: text !important;
    -webkit-background-clip: text !important;
  }

  &.now-text {
    @apply font-medium py-4;
    color: var(--text-color-active);
    opacity: 1;
  }

  &.clicked {
    animation: clickPulse 0.3s ease-in-out;
  }

  .translation,
  .romanization {
    @apply font-normal opacity-70 mt-1 text-base;
  }

  // 逐字歌词样式
  .word-by-word-lyric {
    @apply flex flex-wrap justify-center;

    .lyric-word {
      @apply inline-block;
      font-weight: inherit;
      font-size: inherit;
      letter-spacing: inherit;
      line-height: inherit;
      cursor: inherit;
      position: relative;
      padding-right: 0 !important;

      &:hover {
        background-color: rgba(255, 255, 255, 0.1);
      }
    }
  }
}

// 全屏歌词相关样式
.fullscreen-lyrics {
  @apply flex flex-col w-full h-full relative;
  z-index: 10001;

  &.light {
    background: linear-gradient(to bottom, #ffffff, #f5f5f5);
  }

  &.dark {
    background: linear-gradient(to bottom, #1a1a1a, #000000);
  }

  /* 通用滚动歌词组件在默认样式的竖屏全屏页中占满剩余空间 */
  .fullscreen-lyrics-body {
    flex: 1 1 auto;
    min-height: 0;
  }

  .fullscreen-header {
    @apply pt-16 pb-4 px-6 flex flex-col items-center fixed top-0 left-0 w-full z-10;
    background: linear-gradient(to bottom, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0) 100%);
    pointer-events: auto;

    .fullscreen-back {
      position: absolute;
      top: calc(var(--safe-area-inset-top, 0px) + 16px);
      left: 20px;
      display: grid;
      width: 40px;
      height: 40px;
      border: 0;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.16);
      color: var(--text-color-active);
      font-size: 24px;
      place-items: center;
    }

    .song-title {
      @apply text-xl font-semibold text-center mb-1 max-w-full line-clamp-1;
      color: var(--text-color-active);
    }

    .artist-name {
      @apply text-sm text-opacity-80 text-center;
      color: var(--text-color-primary);
    }
  }

  .lyrics-scroller {
    @apply flex-1 overflow-y-auto px-4;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
    mask-image: linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%);
    -webkit-mask-image: linear-gradient(
      to bottom,
      transparent 0%,
      black 10%,
      black 90%,
      transparent 100%
    );
    padding-top: 100px;
    padding-bottom: 200px;
    margin-bottom: 180px;
    margin-top: 90px;

    .lyrics-padding-top {
      height: 70px;
      min-height: 70px;
    }

    .lyrics-padding-bottom {
      height: 150px;
      min-height: 150px;
    }

    .lyric-line {
      @apply px-6 py-4 text-center;
      font-size: var(--lyric-font-size, 22px);

      span {
        padding-right: 10px;
      }
    }

    .now-text {
      @apply text-2xl;
    }
  }
}

.lyrics-surface-enter-active,
.lyrics-surface-leave-active {
  transition:
    opacity 320ms ease,
    transform 380ms cubic-bezier(0.32, 0.72, 0, 1);
  will-change: opacity, transform;
}

.lyrics-surface-enter-from {
  opacity: 0;
}

.lyrics-surface-leave-to {
  opacity: 0;
}

.lyrics-surface-from-left.lyrics-surface-enter-from,
.lyrics-surface-from-left.lyrics-surface-leave-to {
  transform: translate3d(-100%, 0, 0);
}

.lyrics-surface-from-right.lyrics-surface-enter-from,
.lyrics-surface-from-right.lyrics-surface-leave-to {
  transform: translate3d(100%, 0, 0);
}

@media (prefers-reduced-motion: reduce) {
  .lyrics-surface-enter-active,
  .lyrics-surface-leave-active {
    transition: opacity 160ms ease;
  }

  .lyrics-surface-enter-from,
  .lyrics-surface-leave-to {
    transform: none;
  }
}

// 必要的控制按钮样式
.control-btn {
  @apply w-9 h-9 flex items-center justify-center rounded cursor-pointer transition-all duration-300 z-[9999];
  background: rgba(142, 142, 142, 0.192);
  backdrop-filter: blur(12px);
  top: calc(var(--safe-area-inset-top, 0) + 20px);

  i {
    @apply text-xl;
    color: var(--text-color-active);
  }

  &:hover {
    background: rgba(126, 121, 121, 0.2);
    i {
      opacity: 1;
    }
  }
}

#mobile-drawer-target {
  // 横屏模式下的歌词样式
  &.is-landscape {
    .landscape-lyrics-section {
      .landscape-lyrics-scroller {
        .lyrics-padding-top {
          height: 30px;
          min-height: 30px;
        }

        .lyrics-padding-bottom {
          height: 100px;
          min-height: 100px;
        }

        .lyric-line {
          @apply px-4 py-3 text-left;
          font-size: 26px;
        }

        .now-text {
          @apply text-3xl;
        }
      }
    }

    .word-by-word-lyric {
      @apply justify-start;
    }
  }

  // 竖屏全屏歌词模式下，控制区域降低层级，让歌词覆盖在上面
  .unified-controls {
    &.fullscreen-mode {
      z-index: 10000 !important;
      background: linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0) 100%);
    }

    .back-button {
      @apply absolute top-4 left-1/2 -translate-x-1/2 w-10 h-10 flex items-center justify-center bg-black bg-opacity-30 rounded-2xl;

      i {
        @apply text-4xl;
        color: var(--text-color-primary);
      }
    }
  }

  .ios-layout-container {
    .lyrics-container {
      @apply w-full flex-grow min-h-[140px] flex flex-col items-stretch mb-6 overflow-hidden cursor-pointer;

      :deep(.embedded-lyrics) {
        @apply w-full flex-1 min-h-0;
      }

      .no-lyrics {
        @apply text-center text-base opacity-60;
        color: var(--text-color-primary);
      }
    }
  }
}

.cover-container {
  // 方形封面样式
  &.square-style {
    @apply w-[85%] shadow-2xl shadow-black/50 rounded-xl overflow-hidden mt-8 aspect-square;

    .cover-image {
      @apply w-full h-full;
      transition: transform 0.3s ease-out;

      &:active {
        transform: scale(0.95);
      }
    }
  }

  // 全屏封面样式
  &.full-style {
    @apply w-full max-h-[50vh] relative overflow-hidden;

    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 40%;
      background: linear-gradient(
        transparent,
        var(--bg-color, rgba(25, 25, 25, 1)) 70%,
        var(--bg-color, rgba(25, 25, 25, 1))
      );
      z-index: 1;
      pointer-events: none;
    }

    .cover-image {
      @apply w-full h-auto shadow-lg;

      &.full-blend {
        mix-blend-mode: luminosity;
      }
    }
  }
}

.is-dark {
  .square-style {
    @apply shadow-2xl shadow-black/50;
  }
}
</style>
