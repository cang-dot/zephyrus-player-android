<template>
  <teleport to="body">
    <transition name="rain-mobile-fade">
      <div
        v-if="isVisible"
        class="rain-mobile-player"
        :class="{ 'no-cover': !rainConfig.rainShowCover }"
        @click="handleTapToggle"
      >
        <!-- 背景层：封面模糊 + 暗化 -->
        <div class="background-layer">
          <div
            v-if="playMusic?.picUrl && rainConfig.rainBackgroundDarkness < 100"
            class="background-cover"
            :style="backgroundCoverStyle"
          />
          <div class="background-overlay" :style="backgroundOverlayStyle" />
        </div>

        <!-- 雨水效果层 -->
        <RainCanvas :config="rainConfig" />

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
          <!-- 显示封面时的布局：左右歌词 + 中间封面 -->
          <template v-if="rainConfig.rainShowCover">
            <div class="lyric-side left-side">
              <SplitLyrics
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

            <!-- 中间封面 -->
            <div class="cover-container">
              <CoverRipple
                :src="playMusic?.picUrl ? getImgUrl(playMusic.picUrl, '800y800') : ''"
                :size="140"
                :borderRadius="16"
              />
            </div>

            <div class="lyric-side right-side">
              <SplitLyrics
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
          </template>

          <!-- 不显示封面时的布局：合并歌词，中间竖光晕 -->
          <template v-else>
            <div class="merged-lyrics">
              <div class="lyric-half left-half">
                <SplitLyrics
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
              
              <!-- 竖光晕分隔线 -->
              <div class="glow-divider"></div>
              
              <div class="lyric-half right-half">
                <SplitLyrics
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
          </template>

          <!-- 翻译歌词 -->
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
          <MobileScrollingLyrics v-if="showFullLyrics" class="scrolling-lyrics-overlay" @close="showFullLyrics = false" @interact="showControls" />
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
        <MobileControlsArea
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
</template>

<script setup lang="ts">
/**
 * RainMobilePlayer — 雨夜模式手机端变体
 *
 * 设计特点：
 * - 深色背景 + 封面模糊暗化（可配置）
 * - Canvas 雨水效果（音频响应）+ 落地水洼
 * - 左右分词歌词 / 两句一组歌词
 * - 中间歌曲封面（可关闭）
 * - 不显示封面时：歌词合并，中间竖光晕分隔
 * - 顶部歌曲信息
 * - 控件自动隐藏
 */
import { computed, ref } from 'vue';

import CoverRipple from '@/components/lyric/CoverRipple.vue';
import MobileControlsArea from '@/components/lyric/MobileControlsArea.vue';
import MobileScrollingLyrics from '@/components/lyric/MobileScrollingLyrics.vue';
import RainCanvas from '@/components/lyric/RainCanvas.vue';
import SplitLyrics from '@/components/lyric/SplitLyrics.vue';
import MobilePlayerSettings from '@/components/player/MobilePlayerSettings.vue';
import { useTapToggle } from '@/composables/useTapToggle';
import { artistList, lrcArray, nowIndex, nowTime, playMusic } from '@/hooks/MusicHook';
import { usePlayerStore } from '@/store/modules/player';
import { DEFAULT_LYRIC_CONFIG, type LyricConfig } from '@/types/lyric';
import { getImgUrl } from '@/utils';

// ==================== Props ====================

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  overlayMode: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue']);

// ==================== Store & Hooks ====================

const playerStore = usePlayerStore();

const { controlsVisible, handleTapToggle, showControls } = useTapToggle({
  onDoubleClick: () => { showFullLyrics.value = true; }
});

// 滚动歌词叠加层
const showFullLyrics = ref(false);

// ==================== 状态 ====================

const isVisible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
});

// 播放设置弹窗
const showPlayerSettings = computed({
  get: () => playerStore.playerSettingsVisible,
  set: (val) => playerStore.setPlayerSettingsVisible(val)
});

// ==================== 配置加载 ====================

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

// ==================== 歌曲信息 ====================

const songTitle = computed(() => playMusic.value?.name || '');

// ==================== 歌词 ====================

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

const currentTranslation = computed(() => {
  return currentLine.value?.trText || '';
});

// ==================== 背景样式 ====================

const backgroundCoverStyle = computed(() => {
  const picUrl = playMusic.value?.picUrl;
  if (!picUrl) return {};
  return {
    backgroundImage: `url(${getImgUrl(picUrl, '800y800')})`
  };
});

// 背景暗化层样式
const backgroundOverlayStyle = computed(() => {
  const darkness = rainConfig.value.rainBackgroundDarkness ?? 70;
  const opacity = darkness / 100;
  
  if (darkness >= 100) {
    return {
      background: '#000000'
    };
  }
  
  return {
    background: `linear-gradient(
      to bottom,
      rgba(10, 10, 15, ${0.3 + opacity * 0.5}) 0%,
      rgba(10, 10, 15, ${0.5 + opacity * 0.4}) 50%,
      rgba(10, 10, 15, ${0.7 + opacity * 0.3}) 100%
    )`
  };
});

// ==================== 播放控制 ====================

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

/* 背景层 */
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

/* 顶部：歌名 + 歌手 */
.song-header {
  position: absolute;
  top: calc(var(--safe-area-inset-top, 0px) + 60px);
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  opacity: 0;
  transition: opacity 0.3s var(--m-ease-out, ease);
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
  letter-spacing: 0.02em;
  text-shadow: 0 2px 20px rgba(0, 0, 0, 0.5);
}

.song-header-artist {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  font-weight: 400;
}

/* 中央：歌词区域 */
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

/* 显示封面时的布局 */
.lyric-side {
  flex: 1;
  max-width: 45%;
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

/* 不显示封面时的合并布局 */
.merged-lyrics {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  width: 100%;
}

.lyric-half {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  text-align: center;
}

.left-half,
.right-half {
  text-align: center;
  justify-content: center;
}

/* 竖光晕分隔线（移动端横向） */
.glow-divider {
  width: 150px;
  height: 2px;
  background: linear-gradient(
    to right,
    transparent 0%,
    rgba(255, 255, 255, 0.3) 20%,
    rgba(255, 255, 255, 0.6) 50%,
    rgba(255, 255, 255, 0.3) 80%,
    transparent 100%
  );
  box-shadow: 
    0 0 20px rgba(255, 255, 255, 0.4),
    0 0 40px rgba(255, 255, 255, 0.2);
  animation: glowPulse 3s ease-in-out infinite alternate;
}

@keyframes glowPulse {
  0% {
    opacity: 0.6;
    box-shadow: 
      0 0 15px rgba(255, 255, 255, 0.3),
      0 0 30px rgba(255, 255, 255, 0.15);
  }
  100% {
    opacity: 1;
    box-shadow: 
      0 0 25px rgba(255, 255, 255, 0.5),
      0 0 50px rgba(255, 255, 255, 0.25);
  }
}

/* 歌词组模式 */
.lyric-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.lyric-line {
  font-size: clamp(20px, 6vw, 40px);
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.4;
  transition: all 0.3s ease;
}

.lyric-line.secondary-line {
  color: rgba(255, 255, 255, 0.5);
  font-size: clamp(16px, 4vw, 28px);
}

/* 翻译 */
.lyrics-translation {
  font-size: clamp(14px, 2vw, 18px);
  color: rgba(255, 255, 255, 0.5);
  margin-top: 24px;
  font-weight: 400;
  text-align: center;
  max-width: 300px;
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
  z-index: 10;

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

/* 过渡动画 */
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
  transition: opacity 0.2s var(--m-ease-out, ease);
}

.ctrl-fade-enter-from,
.ctrl-fade-leave-to {
  opacity: 0;
}

.translation-fade-enter-active,
.translation-fade-leave-active {
  transition: opacity 0.3s var(--m-ease-out, ease);
}

.translation-fade-enter-from,
.translation-fade-leave-to {
  opacity: 0;
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
  z-index: 9;
  color: #fff;
}

/* 减少动画 */
@media (prefers-reduced-motion: reduce) {
  .rain-mobile-fade-enter-active,
  .rain-mobile-fade-leave-active,
  .ctrl-fade-enter-active,
  .ctrl-fade-leave-active,
  .translation-fade-enter-active,
  .translation-fade-leave-active {
    transition: opacity 0.2s ease;
  }

  .background-cover {
    animation: none;
  }

  .glow-divider {
    animation: none;
  }
}
</style>
