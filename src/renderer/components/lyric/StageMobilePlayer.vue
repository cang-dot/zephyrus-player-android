<template>
  <teleport to="body">
    <transition name="stage-mobile-fade">
      <div
        v-if="isVisible"
        class="stage-mobile-player"
        :style="{
          '--accent-color': accentColor,
          '--accent-color-rgb': accentColorRgb,
          background: backgroundColor
        }"
        @click="handleTapToggle"
        @touchstart="onSwipeCloseTouchStart"
        @touchend="onSwipeCloseTouchEnd"
      >
        <!-- 鼓点闪白（高潮时段） -->
        <beat-flash-layer />

        <!-- 顶部：歌名 + 歌手 -->
        <div class="song-header" :class="{ 'song-header-visible': controlsVisible }">
          <div class="song-header-title">{{ songTitle }}</div>
          <div class="song-header-artist">
            <span v-for="(item, index) in artistList" :key="index">
              {{ item.name }}{{ index < artistList.length - 1 ? ' / ' : '' }}
            </span>
          </div>
        </div>

        <!-- 中央：歌词 + 翻译（点击切换滚动歌词） -->
        <div class="lyrics-center" v-show="!showFullLyrics">
          <transition name="lyric-change" mode="out-in">
            <div :key="nowIndex" class="lyrics-main" :style="lyricStyle">
              {{ currentLyricText }}
            </div>
          </transition>
          <transition name="translation-fade">
            <div v-if="currentTranslation" class="lyrics-translation">
              {{ currentTranslation }}
            </div>
          </transition>
        </div>

        <!-- 半透明遮罩 + 滚动歌词（点击歌词时显示） -->
        <transition name="fade">
          <div v-if="showFullLyrics" class="lyrics-mask" @click="showFullLyrics = false"></div>
        </transition>
        <transition name="fade">
          <mobile-scrolling-lyrics
            v-if="showFullLyrics"
            class="scrolling-lyrics-overlay"
            @close="showFullLyrics = false"
            @interact="showControls"
            @generatePoster="handleGeneratePoster"
          />
        </transition>

        <!-- 顶部控件（tap 弹出） -->
        <transition name="ctrl-fade">
          <div v-show="controlsVisible" class="top-controls no-toggle">
            <div class="ctrl-btn" @click="close">
              <i class="ri-arrow-down-s-line"></i>
            </div>
            <div style="flex: 1"></div>
            <div class="ctrl-btn" @click="showPlayerSettings = true">
              <i class="ri-more-2-fill"></i>
            </div>
          </div>
        </transition>

        <!-- 底部控件（3秒自动隐藏） -->
        <mobile-controls-area
          :visible="controlsVisible"
          :is-fullscreen="showFullLyrics"
          @close="showFullLyrics = false"
          @showPlaylist="openPlaylist"
          @interact="showControls"
        />
      </div>
    </transition>
  </teleport>

  <!-- 播放设置弹窗 -->
  <mobile-player-settings v-model:visible="showPlayerSettings" />

  <!-- 歌词海报分享弹窗 -->
  <poster-share-modal v-model:visible="showPosterModal" :lyrics="selectedLyrics" />
</template>

<script setup lang="ts">
/**
 * StageMobilePlayer — 舞台模式手机端变体
 *
 * 设计来源：code (6).html — Lyrics View
 * - 深色背景 + 居中大字歌词
 * - 顶部歌名（serif）+ 歌手
 * - 中央歌词（Cormorant Garamond, clamp 32-56px）
 * - 下方翻译（clamp 14-18px, 300 weight）
 * - 音频响应：高潮时文字使用强调色
 */
import tinycolor from 'tinycolor2';
import { computed, onMounted, ref, watch } from 'vue';

import BeatFlashLayer from '@/components/lyric/BeatFlashLayer.vue';
import MobileControlsArea from '@/components/lyric/MobileControlsArea.vue';
import MobileScrollingLyrics from '@/components/lyric/MobileScrollingLyrics.vue';
import MobilePlayerSettings from '@/components/player/MobilePlayerSettings.vue';
import PosterShareModal from '@/components/share/PosterShareModal.vue';
import { usePosterShare } from '@/composables/usePosterShare';
import { useStyleCustomConfig } from '@/composables/useStyleCustomConfig';
import { useTapToggle } from '@/composables/useTapToggle';
import { useSwipeClose } from '@/composables/useSwipeClose';
import { artistList, lrcArray, nowIndex, nowTime, playMusic, sound } from '@/hooks/MusicHook';
import { useCoverColor } from '@/hooks/useCoverColor';
import { usePlayerStore } from '@/store/modules/player';
import { useStyleEngineStore } from '@/store/modules/styleEngine';
import { secondToMinute } from '@/utils';

// ==================== Props ====================

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  background: { type: String, default: '' },
  overlayMode: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue']);

// ==================== Store & Hooks ====================

const playerStore = usePlayerStore();
const styleEngine = useStyleEngineStore();
const { primaryColor, primaryColorRgb, averageColor } = useCoverColor();

const { controlsVisible, handleTapToggle, showControls } = useTapToggle({
  onDoubleClick: () => {
    showFullLyrics.value = true;
  }
});

// 滚动歌词叠加层
const showFullLyrics = ref(false);
const { onTouchStart: onSwipeCloseTouchStart, onTouchEnd: onSwipeCloseTouchEnd } = useSwipeClose({
  shouldClose: () => !showFullLyrics.value,
  onClose: () => close()
});

// 海报分享
const { showPosterModal, selectedLyrics, handleGeneratePoster } = usePosterShare();
const controlsRef = ref();
const { config: styleCfg } = useStyleCustomConfig('stage');

// ==================== 高潮数据加载 ====================
// 舞台样式需要 styleEngine 持有 climax segments 才能驱动 isInClimax + 进度条高潮段落标注。
// 不在此处加载会导致进度条上没有高潮背景颜色，且 isInClimax 永远为 false。
watch(
  () => playerStore.currentSong?.id,
  (songId) => {
    if (songId) styleEngine.loadClimaxData(String(songId));
  },
  { immediate: true }
);

onMounted(() => {
  styleEngine.syncFromPlayerStore();
  styleEngine.syncCoverColors();
  if (playerStore.currentSong?.id) {
    styleEngine.loadClimaxData(String(playerStore.currentSong.id));
  }
});

// 播放设置弹窗（使用 store 状态，支持返回手势关闭）
const showPlayerSettings = computed({
  get: () => playerStore.playerSettingsVisible,
  set: (val) => playerStore.setPlayerSettingsVisible(val)
});

// ==================== 状态 ====================

const isVisible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
});

const isPlaying = computed(() => playerStore.isPlay);
const currentTime = computed(() => nowTime.value);
const duration = computed(() => (playMusic.value?.dt || playMusic.value?.duration || 0) / 1000);
const progressPercent = computed(() => {
  if (!duration.value) return 0;
  return (currentTime.value / duration.value) * 100;
});

// ==================== 歌曲信息 ====================

const songTitle = computed(() => playMusic.value?.name || '');
const accentColor = computed(() => primaryColor.value || '#888888');
const accentColorRgb = computed(() => primaryColorRgb.value || '136, 136, 136');

// ==================== 歌词 ====================

const currentLyricText = computed(() => {
  const idx = nowIndex.value;
  if (idx < 0 || idx >= lrcArray.value.length) return '';
  return lrcArray.value[idx]?.text || '';
});

const currentTranslation = computed(() => {
  const idx = nowIndex.value;
  if (idx < 0 || idx >= lrcArray.value.length) return '';
  return (lrcArray.value[idx] as any)?.trText || '';
});

// ==================== 音频响应 ====================

/**
 * 歌词颜色：高潮时切换为强调色
 */
const lyricColor = computed(() => {
  if (styleEngine.isInClimax) return accentColor.value;
  return '#f0ece4';
});

/**
 * 歌词字号：根据能量水平微调
 * 基础 clamp(32px, 5vw, 56px)，高能量时略大
 */
const lyricStyle = computed(() => ({
  color: lyricColor.value,
  fontSize: 'clamp(32px, 5vw, 56px)',
  ...(styleCfg.value.customFontFamily ? { fontFamily: styleCfg.value.customFontFamily } : {})
}));

/**
 * 背景：保持深色底，高潮时仅通过文字颜色变化体现
 */
const backgroundColor = computed(() => {
  return '#1a1a1a';
});

// ==================== 播放控制 ====================

function close() {
  isVisible.value = false;
}

function handlePrev() {
  playerStore.prevPlay();
}

function handleNext() {
  playerStore.nextPlay();
}

function handlePlayPause() {
  playerStore.setPlay(playMusic.value);
}

function openPlaylist() {
  playerStore.setPlayListDrawerVisible(true);
}

function handleSeek(e: MouseEvent) {
  const target = e.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  const seekTime = percent * duration.value;
  if (sound.value) {
    sound.value.seek(seekTime);
    nowTime.value = seekTime;
  }
}

function formatTime(seconds: number): string {
  return secondToMinute(seconds);
}
</script>

<style lang="scss" scoped>
.stage-mobile-player {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  overflow: hidden;
  background: #1a1a1a;
  color: #f0ece4;
}

/* 顶部：歌名 + 歌手 */
.song-header {
  position: absolute;
  top: calc(var(--safe-area-inset-top, 0px) + 24px);
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  opacity: 0;
  transition: opacity 0.3s var(--m-ease-out, ease);

  &.song-header-visible {
    opacity: 1;
  }
}

.song-header-title {
  font-family: var(--m-font-serif, 'Cormorant Garamond', serif);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.song-header-artist {
  font-size: 12px;
  color: #666;
  margin-top: 2px;
}

/* 中央：歌词 + 翻译 */
.lyrics-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 20px;
  max-width: 800px;
}

.lyrics-main {
  font-family:
    'Noto Serif SC', 'STSong', 'SimSun', var(--m-font-serif, 'Cormorant Garamond'), serif;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.01em;
  transition: color 0.3s var(--m-ease-out, ease);
  will-change: color;
}

.lyrics-translation {
  font-size: clamp(14px, 2vw, 18px);
  color: #666;
  margin-top: 16px;
  font-weight: 300;
}

/* 顶部控件 */
.top-controls {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  padding: calc(var(--safe-area-inset-top, 0px) + 16px) 20px 0;

  .ctrl-btn {
    @apply flex items-center justify-center;
    @apply w-10 h-10 rounded-full;
    @apply text-xl;
    color: #f0ece4;
    background: rgba(255, 255, 255, 0.08);
    cursor: pointer;
    transition: transform var(--m-duration-press, 160ms) var(--m-ease-out, ease-out);

    &:active {
      transform: scale(0.97);
    }
  }
}

/* 底部控件 */
.bottom-controls {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0 24px calc(var(--safe-area-inset-bottom, 0px) + 32px);
}

.progress-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;

  .time-text {
    font-size: 12px;
    color: #666;
    flex-shrink: 0;
    min-width: 36px;
  }

  .progress-bar-bg {
    flex: 1;
    height: 2px;
    background: #333;
    border-radius: 1px;
    position: relative;
    cursor: pointer;

    .progress-bar-fill {
      position: absolute;
      left: 0;
      top: 0;
      height: 100%;
      background: #888;
      border-radius: 1px;
      transition: width 0.1s linear;
    }

    .climax-track {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 1;
    }
    .climax-segment {
      position: absolute;
      top: 0;
      bottom: 0;
      height: 100%;
      background: rgba(255, 200, 50, 0.35);
      border-radius: 1px;
      transition: background 0.2s ease;
      &.climax-active {
        background: rgba(255, 200, 50, 0.7);
      }
    }
  }
}

.control-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;

  .ctrl-btn {
    @apply flex items-center justify-center;
    @apply rounded-full;
    @apply cursor-pointer;
    background: #444;
    width: 42px;
    height: 42px;
    transition: transform var(--m-duration-press, 160ms) var(--m-ease-out, ease-out);

    i {
      font-size: 18px;
      color: #f0ece4;
    }

    &:active {
      transform: scale(0.97);
    }

    &.play-btn {
      width: 52px;
      height: 52px;
      background: #666;

      i {
        font-size: 24px;
      }
    }

    &.small {
      width: 36px;
      height: 36px;

      i {
        font-size: 16px;
      }
    }
  }
}

/* 歌词切换过渡 */
.lyric-change-enter-active,
.lyric-change-leave-active {
  transition:
    opacity 0.3s var(--m-ease-out, ease),
    transform 0.3s var(--m-ease-out, ease);
}

.lyric-change-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.lyric-change-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.translation-fade-enter-active,
.translation-fade-leave-active {
  transition: opacity 0.3s var(--m-ease-out, ease);
}

.translation-fade-enter-from,
.translation-fade-leave-to {
  opacity: 0;
}

/* 过渡动画 */
.stage-mobile-fade-enter-active,
.stage-mobile-fade-leave-active {
  transition: opacity 0.3s var(--m-ease-out, ease);
}

.stage-mobile-fade-enter-from,
.stage-mobile-fade-leave-to {
  opacity: 0;
}

.ctrl-fade-enter-active,
.ctrl-fade-leave-active {
  transition: opacity 0.2s var(--m-ease-out, ease);
}

.ctrl-fade-enter-from,
.ctrl-fade-leave-to {
  opacity: 0;
}

/* 减少动画 */
@media (prefers-reduced-motion: reduce) {
  .lyric-change-enter-active,
  .lyric-change-leave-active,
  .translation-fade-enter-active,
  .translation-fade-leave-active,
  .stage-mobile-fade-enter-active,
  .stage-mobile-fade-leave-active,
  .ctrl-fade-enter-active,
  .ctrl-fade-leave-active {
    transition: opacity 0.2s ease;
  }

  .lyrics-main {
    transition: none;
  }
}

/* 半透明遮罩 */
.lyrics-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 8;
  cursor: pointer;
}

/* 滚动歌词叠加层 */
.scrolling-lyrics-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  color: #fff;
}
</style>
