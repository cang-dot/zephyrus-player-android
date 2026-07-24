<template>
  <transition name="rain-fade">
    <div
      v-if="isVisible"
      class="rain-player"
      :class="{ 'overlay-mode': overlayMode, 'no-cover': !rainConfig.rainShowCover }"
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

      <!-- 通用控件（左上关闭 + 右上设置/全屏） -->
      <PlayerControls
        v-if="!overlayMode"
        v-show="controlsVisible"
        :isFullScreen="isFullScreen"
        :showStyleSwitch="false"
        theme="dark"
        class="no-toggle"
        @close="closePlayer"
        @toggleFullscreen="toggleFullScreen"
      />

      <!-- 顶部：歌曲信息（仿照舞台样式） -->
      <transition name="info-fade">
        <div v-show="controlsVisible" class="song-info-top">
          <div class="song-name">{{ playMusic?.name }}</div>
          <div class="song-artist">
            <span v-for="(item, index) in artistList" :key="index" class="artist-name">
              {{ item.name }}{{ index < artistList.length - 1 ? ' / ' : '' }}
            </span>
          </div>
        </div>
      </transition>

      <!-- 中央区域：歌词 + 封面 -->
      <div class="main-content" v-show="controlsVisible || !isMobile">
        <!-- 显示封面时的布局：左右歌词 + 中间封面 -->
        <template v-if="rainConfig.rainShowCover">
          <!-- 左侧歌词 -->
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
              :size="280"
              :borderRadius="24"
            />
          </div>

          <!-- 右侧歌词 -->
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
      </div>

      <!-- 翻译歌词 -->
      <transition name="translation-fade">
        <div
          v-if="currentTranslation && controlsVisible"
          class="translation-text"
        >
          {{ currentTranslation }}
        </div>
      </transition>
    </div>
  </transition>
</template>

<script setup lang="ts">
/**
 * RainPlayer - 雨夜模式播放器（PC端）
 *
 * 设计特点：
 * - 深色背景 + 封面模糊暗化（可配置）
 * - Canvas 雨水效果（音频响应）+ 落地水洼
 * - 左右分词歌词 / 两句一组歌词
 * - 中间歌曲封面（可关闭）
 * - 不显示封面时：歌词合并，中间竖光晕分隔
 * - 顶部歌曲信息（仿照舞台样式）
 * - 控件自动隐藏
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { artistList, lrcArray, nowIndex, nowTime, playMusic } from '@/hooks/MusicHook';
import { usePlayerStore } from '@/store/modules/player';
import { DEFAULT_LYRIC_CONFIG, type LyricConfig } from '@/types/lyric';
import { getImgUrl, isMobile } from '@/utils';

import CoverRipple from './CoverRipple.vue';
import PlayerControls from './PlayerControls.vue';
import RainCanvas from './RainCanvas.vue';
import SplitLyrics from './SplitLyrics.vue';

interface Props {
  modelValue: boolean;
  overlayMode?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  overlayMode: false
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const playerStore = usePlayerStore();

// ==================== 可见性控制 ====================

const isVisible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
});

function closePlayer() {
  isVisible.value = false;
}

// ==================== 控件显隐控制 ====================

const controlsVisible = ref(!isMobile.value);
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function handleTapToggle(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (target?.closest('.no-toggle')) return;

  if (isMobile.value) {
    controlsVisible.value = !controlsVisible.value;
    resetHideTimer();
  }
}

function resetHideTimer() {
  if (!isMobile.value) return;
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    controlsVisible.value = false;
  }, 3000);
}

function onMouseMove() {
  if (!isMobile.value) {
    controlsVisible.value = true;
    resetHideTimer();
  }
}

// ==================== 全屏控制 ====================

const isFullScreen = ref(false);

async function toggleFullScreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      isFullScreen.value = true;
    } else {
      await document.exitFullscreen();
      isFullScreen.value = false;
    }
  } catch (e) {
    console.error('全屏切换失败:', e);
  }
}

function handleFullScreenChange() {
  isFullScreen.value = !!document.fullscreenElement;
}

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

// 监听配置变化
function handleConfigUpdate() {
  loadConfig();
}

// ==================== 歌词数据 ====================

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

// ==================== 生命周期 ====================

onMounted(() => {
  window.addEventListener('music-full-config-updated', handleConfigUpdate);
  document.addEventListener('fullscreenchange', handleFullScreenChange);
  document.addEventListener('mousemove', onMouseMove);

  if (isMobile.value) {
    resetHideTimer();
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('music-full-config-updated', handleConfigUpdate);
  document.removeEventListener('fullscreenchange', handleFullScreenChange);
  document.removeEventListener('mousemove', onMouseMove);

  if (hideTimer) {
    clearTimeout(hideTimer);
  }

  if (document.fullscreenElement) {
    document.exitFullscreen();
  }
});
</script>

<style scoped>
.rain-player {
  position: fixed;
  inset: 0;
  z-index: 9998;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #0a0a0f;
  cursor: default;
}

/* Overlay 模式 */
.rain-player.overlay-mode {
  position: absolute;
  z-index: 1;
  pointer-events: none;
}

.rain-player.overlay-mode .main-content,
.rain-player.overlay-mode .song-info-top {
  pointer-events: none;
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

/* 顶部歌曲信息（仿照舞台样式） */
.song-info-top {
  position: absolute;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  z-index: 2;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.song-name {
  font-size: clamp(20px, 3vw, 32px);
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
  margin-bottom: 8px;
  letter-spacing: 0.02em;
  text-shadow: 0 2px 20px rgba(0, 0, 0, 0.5);
}

.song-artist {
  font-size: clamp(14px, 1.8vw, 18px);
  color: rgba(255, 255, 255, 0.6);
  font-weight: 400;
}

.artist-name {
  transition: color 0.3s ease;
}

.artist-name:hover {
  color: rgba(255, 255, 255, 0.9);
}

/* 主内容区 */
.main-content {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 1400px;
  padding: 0 40px;
  flex: 1;
  pointer-events: none;
}

/* 显示封面时的布局 */
.lyric-side {
  flex: 1;
  max-width: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
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
  margin: 0 60px;
  pointer-events: auto;
}

/* 不显示封面时的合并布局 */
.merged-lyrics {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  max-width: 900px;
}

.lyric-half {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 40px;
}

.left-half {
  text-align: right;
  justify-content: flex-end;
}

.right-half {
  text-align: left;
  justify-content: flex-start;
}

/* 竖光晕分隔线 */
.glow-divider {
  width: 2px;
  height: 200px;
  background: linear-gradient(
    to bottom,
    transparent 0%,
    rgba(255, 255, 255, 0.3) 20%,
    rgba(255, 255, 255, 0.6) 50%,
    rgba(255, 255, 255, 0.3) 80%,
    transparent 100%
  );
  box-shadow: 
    0 0 20px rgba(255, 255, 255, 0.4),
    0 0 40px rgba(255, 255, 255, 0.2),
    0 0 60px rgba(255, 255, 255, 0.1);
  animation: glowPulse 3s ease-in-out infinite alternate;
}

@keyframes glowPulse {
  0% {
    opacity: 0.6;
    box-shadow: 
      0 0 15px rgba(255, 255, 255, 0.3),
      0 0 30px rgba(255, 255, 255, 0.15),
      0 0 45px rgba(255, 255, 255, 0.08);
  }
  100% {
    opacity: 1;
    box-shadow: 
      0 0 25px rgba(255, 255, 255, 0.5),
      0 0 50px rgba(255, 255, 255, 0.25),
      0 0 75px rgba(255, 255, 255, 0.12);
  }
}

/* 歌词组模式 */
.lyric-group {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.lyric-line {
  font-size: clamp(24px, 3vw, 40px);
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.4;
  transition: all 0.3s ease;
}

.lyric-line.secondary-line {
  color: rgba(255, 255, 255, 0.5);
  font-size: clamp(20px, 2.5vw, 32px);
}

/* 翻译 */
.translation-text {
  position: absolute;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  font-size: clamp(16px, 2vw, 22px);
  color: rgba(255, 255, 255, 0.5);
  font-weight: 400;
  text-align: center;
  max-width: 600px;
  transition: opacity 0.3s ease;
  z-index: 2;
}

/* 过渡动画 */
.rain-fade-enter-active,
.rain-fade-leave-active {
  transition: opacity 0.4s ease;
}

.rain-fade-enter-from,
.rain-fade-leave-to {
  opacity: 0;
}

.info-fade-enter-active,
.info-fade-leave-active {
  transition: opacity 0.3s ease;
}

.info-fade-enter-from,
.info-fade-leave-to {
  opacity: 0;
}

.translation-fade-enter-active,
.translation-fade-leave-active {
  transition: opacity 0.3s ease;
}

.translation-fade-enter-from,
.translation-fade-leave-to {
  opacity: 0;
}

/* 响应式 */
@media (max-width: 1024px) {
  .main-content {
    padding: 0 20px;
  }

  .cover-container {
    margin: 0 30px;
    transform: scale(0.8);
  }

  .lyric-half {
    padding: 0 20px;
  }
}

@media (max-width: 768px) {
  .main-content {
    flex-direction: column;
    gap: 20px;
    padding: 100px 20px 120px;
  }

  .lyric-side {
    max-width: 100%;
    text-align: center;
  }

  .left-side,
  .right-side {
    text-align: center;
  }

  .cover-container {
    margin: 0;
    transform: scale(0.6);
    order: -1;
  }

  .merged-lyrics {
    flex-direction: column;
    gap: 20px;
  }

  .lyric-half {
    padding: 0;
    text-align: center;
    justify-content: center;
  }

  .left-half,
  .right-half {
    text-align: center;
    justify-content: center;
  }

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
  }

  .song-info-top {
    top: 60px;
  }

  .translation-text {
    bottom: 80px;
  }
}
</style>
