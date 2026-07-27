<template>
  <teleport to="body">
    <transition name="rain-mobile-fade">
      <div v-if="isVisible" class="rain-mobile-player" @click="handleTapToggle" @touchstart="onSwipeCloseTouchStart" @touchend="onSwipeCloseTouchEnd">
        <!-- 背景层：封面模糊 + 暗化 -->
        <div class="background-layer">
          <div v-if="playMusic?.picUrl" class="background-cover" :style="backgroundCoverStyle" />
          <div class="background-overlay" :style="backgroundOverlayStyle" />
        </div>

        <!-- 雨水效果层 -->
        <rain-canvas :config="rainConfig" />

        <!-- 顶部：歌名 + 歌手 -->
        <div class="song-header" :class="{ 'song-header-visible': controlsVisible }">
          <div class="song-header-title">{{ songTitle }}</div>
          <div class="song-header-artist">
            <span v-for="(item, index) in artistList" :key="index">
              {{ item.name }}{{ index < artistList.length - 1 ? ' / ' : '' }}
            </span>
          </div>
        </div>

        <!-- 中央：歌词区域 -->
        <div class="lyrics-center" v-show="!showFullLyrics">
          <!-- ===== 竖屏：3D 封面 + 歌词叠加 ===== -->
          <div v-if="!isLandscape" class="portrait-cover-stage">
            <!-- 3D 封面 -->
            <div class="cover-3d-wrapper">
              <div class="cover-3d">
                <img
                  v-if="playMusic?.picUrl"
                  :src="getImgUrl(playMusic.picUrl, '400y400')"
                  class="cover-3d-img"
                  alt="cover"
                />
                <div class="cover-3d-darken"></div>
              </div>
              <!-- 底部反射 -->
              <div class="cover-reflection">
                <img
                  v-if="playMusic?.picUrl"
                  :src="getImgUrl(playMusic.picUrl, '400y400')"
                  class="reflection-img"
                  alt=""
                />
              </div>
            </div>

            <!-- 歌词叠加在封面上 -->
            <div class="cover-lyrics-overlay">
              <transition name="lyric-change" mode="out-in">
                <div :key="nowIndex" class="lyric-line primary-line">
                  {{ currentLine?.text || '' }}
                </div>
              </transition>
              <transition name="translation-fade">
                <div v-if="currentTranslation" class="lyrics-translation">
                  {{ currentTranslation }}
                </div>
              </transition>
            </div>
          </div>

          <!-- ===== 横屏：左右分词歌词 + 中间封面 ===== -->
          <div v-else class="landscape-split-layout">
            <div class="lyric-side left-side">
              <split-lyrics
                v-if="rainConfig.rainLyricMode === 'split'"
                mode="split"
                side="left"
                :currentLine="currentLine"
                :nextLine="nextLine"
                :currentTime="nowTime"
                :words="currentLine?.words"
              />
              <div v-else class="lyric-group">
                <div class="lyric-line primary-line">{{ currentLine?.text || '' }}</div>
              </div>
            </div>

            <div class="cover-container">
              <cover-ripple
                :src="playMusic?.picUrl ? getImgUrl(playMusic.picUrl, '800y800') : ''"
                :size="140"
                :borderRadius="16"
              />
            </div>

            <div class="lyric-side right-side">
              <split-lyrics
                v-if="rainConfig.rainLyricMode === 'split'"
                mode="split"
                side="right"
                :currentLine="currentLine"
                :nextLine="nextLine"
                :currentTime="nowTime"
                :words="currentLine?.words"
              />
              <div v-else class="lyric-group">
                <div v-if="nextLine" class="lyric-line secondary-line">{{ nextLine.text }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 半透明遮罩 + 滚动歌词 -->
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

        <!-- 顶部控件 -->
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

        <!-- 底部控件 -->
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

  <mobile-player-settings v-model:visible="showPlayerSettings" />

  <!-- 歌词海报分享弹窗 -->
  <poster-share-modal v-model:visible="showPosterModal" :lyrics="selectedLyrics" />
</template>

<script setup lang="ts">
/**
 * RainMobilePlayer — 雨夜模式手机端
 *
 * 竖屏：3D 封面（带淋雨暗化） + 歌词叠加 + 底部反射
 * 横屏：左右分词歌词 + 中间封面
 */
import { useWindowSize } from '@vueuse/core';
import { computed, ref } from 'vue';

import CoverRipple from '@/components/lyric/CoverRipple.vue';
import MobileControlsArea from '@/components/lyric/MobileControlsArea.vue';
import MobileScrollingLyrics from '@/components/lyric/MobileScrollingLyrics.vue';
import RainCanvas from '@/components/lyric/RainCanvas.vue';
import SplitLyrics from '@/components/lyric/SplitLyrics.vue';
import MobilePlayerSettings from '@/components/player/MobilePlayerSettings.vue';
import PosterShareModal from '@/components/share/PosterShareModal.vue';
import { usePosterShare } from '@/composables/usePosterShare';
import { useTapToggle } from '@/composables/useTapToggle';
import { useSwipeClose } from '@/composables/useSwipeClose';
import { artistList, lrcArray, nowIndex, nowTime, playMusic } from '@/hooks/MusicHook';
import { usePlayerStore } from '@/store/modules/player';
import { DEFAULT_LYRIC_CONFIG, type LyricConfig } from '@/types/lyric';
import { getImgUrl } from '@/utils';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  overlayMode: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue']);

const playerStore = usePlayerStore();

const { controlsVisible, handleTapToggle, showControls } = useTapToggle({
  onDoubleClick: () => {
    showFullLyrics.value = true;
  }
});

const showFullLyrics = ref(false);
const { onTouchStart: onSwipeCloseTouchStart, onTouchEnd: onSwipeCloseTouchEnd } = useSwipeClose({
  shouldClose: () => !showFullLyrics.value && !isLandscape.value,
  onClose: () => close()
});

// 海报分享
const { showPosterModal, selectedLyrics, handleGeneratePoster } = usePosterShare();

const isVisible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
});

const showPlayerSettings = computed({
  get: () => playerStore.playerSettingsVisible,
  set: (val) => playerStore.setPlayerSettingsVisible(val)
});

// 横竖屏检测
const { width, height } = useWindowSize();
const isLandscape = computed(() => width.value > height.value);

// 配置
const rainConfig = ref<LyricConfig>({ ...DEFAULT_LYRIC_CONFIG });
function loadConfig() {
  const saved = localStorage.getItem('music-full-config');
  if (saved) {
    try {
      rainConfig.value = { ...DEFAULT_LYRIC_CONFIG, ...JSON.parse(saved) };
    } catch {
      rainConfig.value = { ...DEFAULT_LYRIC_CONFIG };
    }
  }
}
loadConfig();

const songTitle = computed(() => playMusic.value?.name || '');

const currentLine = computed(() => {
  const idx = nowIndex.value;
  if (idx < 0 || idx >= lrcArray.value.length) return null;
  return lrcArray.value[idx];
});

const nextLine = computed(() => {
  const idx = nowIndex.value + 1;
  if (idx < 0 || idx >= lrcArray.value.length) return null;
  return lrcArray.value[idx];
});

const currentTranslation = computed(() => currentLine.value?.trText || '');

// 背景样式
const backgroundCoverStyle = computed(() => {
  const picUrl = playMusic.value?.picUrl;
  if (!picUrl) return {};
  return { backgroundImage: `url(${getImgUrl(picUrl, '800y800')})` };
});

const backgroundOverlayStyle = computed(() => {
  const darkness = rainConfig.value.rainBackgroundDarkness ?? 70;
  const opacity = darkness / 100;
  if (darkness >= 100) return { background: '#000000' };
  return {
    background: `linear-gradient(to bottom, rgba(10,10,15,${0.3 + opacity * 0.5}) 0%, rgba(10,10,15,${0.5 + opacity * 0.4}) 50%, rgba(10,10,15,${0.7 + opacity * 0.3}) 100%)`
  };
});

function close() {
  isVisible.value = false;
}
function openPlaylist() {
  playerStore.setPlayListDrawerVisible(true);
}
</script>

<style lang="scss" scoped>
.rain-mobile-player {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #0a0a0f;
  color: #f0ece4;
}

/* ===== 背景层 ===== */
.background-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.background-cover {
  position: absolute;
  inset: -10%;
  background-size: cover;
  background-position: center;
  filter: blur(60px) brightness(0.4) saturate(1.2);
  transform: scale(1.1);
  animation: coverPulse 8s ease-in-out infinite alternate;
}

@keyframes coverPulse {
  0% {
    transform: scale(1.1);
    filter: blur(60px) brightness(0.35) saturate(1.2);
  }
  100% {
    transform: scale(1.15);
    filter: blur(60px) brightness(0.45) saturate(1.4);
  }
}

.background-overlay {
  position: absolute;
  inset: 0;
}

/* ===== 顶部歌名 ===== */
.song-header {
  position: absolute;
  top: calc(var(--safe-area-inset-top, 0px) + 60px);
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 2;
  &.song-header-visible {
    opacity: 1;
  }
}

.song-header-title {
  font-size: 18px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
  margin-bottom: 6px;
  text-shadow: 0 2px 20px rgba(0, 0, 0, 0.5);
}

.song-header-artist {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}

/* ===== 中央歌词区域 ===== */
.lyrics-center {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100px 20px 120px;
  width: 100%;
  flex: 1;
}

/* ===== 竖屏：3D 封面 + 歌词叠加 ===== */
.portrait-cover-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 360px;
  position: relative;
}

.cover-3d-wrapper {
  perspective: 1200px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.cover-3d {
  position: relative;
  width: 260px;
  height: 260px;
  transform: rotateX(12deg);
  transform-style: preserve-3d;
  border-radius: 16px;
  overflow: hidden;
  box-shadow:
    0 20px 50px rgba(0, 0, 0, 0.6),
    0 0 30px rgba(0, 0, 0, 0.3);
}

.cover-3d-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cover-3d-darken {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.35) 0%,
    rgba(0, 0, 0, 0.45) 50%,
    rgba(0, 0, 0, 0.55) 100%
  );
}

/* 底部反射 */
.cover-reflection {
  width: 260px;
  height: 80px;
  overflow: hidden;
  margin-top: -1px;
  opacity: 0.25;
  -webkit-mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.6) 0%, transparent 90%);
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.6) 0%, transparent 90%);
}

.reflection-img {
  width: 100%;
  height: 260px;
  object-fit: cover;
  transform: scaleY(-1);
  filter: blur(2px);
}

/* 歌词叠加在封面上 */
.cover-lyrics-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 5;
  text-align: center;
  width: 100%;
  padding: 0 24px;
  pointer-events: none;
}

/* ===== 横屏：左右分词 ===== */
.landscape-split-layout {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  width: 100%;
  gap: 0;
}

.lyric-side {
  flex: 1;
  max-width: 40%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.left-side {
  text-align: right;
}
.right-side {
  text-align: left;
}

.cover-container {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 20px;
  transform: scale(0.6);
}

/* ===== 歌词样式 ===== */
.lyric-line {
  font-size: clamp(18px, 5.5vw, 32px);
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  line-height: 1.4;
  transition: all 0.3s ease;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);
}

.lyric-line.secondary-line {
  color: rgba(255, 255, 255, 0.45);
  font-size: clamp(14px, 3.5vw, 22px);
}

.lyrics-translation {
  font-size: clamp(12px, 2.5vw, 16px);
  color: rgba(255, 255, 255, 0.5);
  margin-top: 12px;
  font-weight: 400;
}

/* ===== 过渡动画 ===== */
.lyric-change-enter-active,
.lyric-change-leave-active {
  transition: all 0.3s ease;
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
  transition: opacity 0.3s ease;
}
.translation-fade-enter-from,
.translation-fade-leave-to {
  opacity: 0;
}

.rain-mobile-fade-enter-active,
.rain-mobile-fade-leave-active {
  transition: opacity 0.4s ease;
}
.rain-mobile-fade-enter-from,
.rain-mobile-fade-leave-to {
  opacity: 0;
}

.ctrl-fade-enter-active,
.ctrl-fade-leave-active {
  transition: opacity 0.2s ease;
}
.ctrl-fade-enter-from,
.ctrl-fade-leave-to {
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ===== 顶部控件 ===== */
.top-controls {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  padding: calc(var(--safe-area-inset-top, 0px) + 16px) 20px 0;
  z-index: 10;

  .ctrl-btn {
    @apply flex items-center justify-center;
    @apply w-10 h-10 rounded-full;
    @apply text-xl;
    color: #f0ece4;
    background: rgba(255, 255, 255, 0.08);
    cursor: pointer;
    transition: transform 160ms ease-out;
    &:active {
      transform: scale(0.97);
    }
  }
}

/* ===== 滚动歌词遮罩 ===== */
.lyrics-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 8;
  cursor: pointer;
}

.scrolling-lyrics-overlay {
  position: absolute;
  inset: 0;
  z-index: 40;
  color: #fff;
}

/* ===== 减少动画 ===== */
@media (prefers-reduced-motion: reduce) {
  .background-cover {
    animation: none;
  }
  .rain-mobile-fade-enter-active,
  .rain-mobile-fade-leave-active {
    transition: opacity 0.2s ease;
  }
}
</style>
