<template>
  <teleport to="body">
    <transition name="frenzy-mobile-fade">
      <div
        v-if="isVisible"
        class="frenzy-mobile-player player-style-surface"
        :class="{
          'player-style-customized': isCustom,
          'player-style-custom-font': customFontActive,
          'player-style-custom-background': customBackgroundActive
        }"
        :style="{
          ...styleVars,
          '--text-dark': textColorDark,
          '--text-gray': textColorGray,
          '--player-style-resolved-font': frenzyFontFamily,
          background: backgroundColor,
          ...lyricsSwipeStyle
        }"
        @click="handleTapToggle"
        @pointerdown.capture="onLyricsSwipePointerDown"
        @pointermove.capture="onLyricsSwipePointerMove"
        @pointerup.capture="onLyricsSwipePointerUp"
        @pointercancel.capture="onLyricsSwipePointerCancel"
        @touchstart="onSwipeCloseTouchStart"
        @touchend="onSwipeCloseTouchEnd"
      >
        <!-- CRT 故障背景层 -->
        <glitch-background
          baseColor="#f5f5f5"
          accentColor="#d0d0d0"
          :intensity="glitchIntensity"
          :crtIntensity="crtIntensity"
          :speed="0.8"
          :showScanlines="effects.crt"
        />

        <!-- 高潮过渡闪光 -->
        <div v-if="effects.crt" class="climax-flash" :style="climaxFlashStyle"></div>

        <!-- 四角装饰圆点 -->
        <div class="corner-dot tl"></div>
        <div class="corner-dot tr"></div>
        <div class="corner-dot bl"></div>
        <div class="corner-dot br"></div>

        <ttml-word-effect-layer
          v-if="lyricsUnderlayVisible && !wordPlayback.interludeState.value.active"
          :auxiliary-tokens="wordPlayback.auxiliaryTokens.value"
          :main-token="wordPlayback.currentMainToken.value"
          :show-drop="showWordDrop"
          :center-auxiliary="isCustom && styleCfg.auxiliaryCenterDisplay === true"
        />

        <climax-interlude-overlay :state="wordPlayback.interludeState.value" />

        <!-- 巨字歌词（点击切换滚动歌词） -->
        <div
          class="giant-text-container"
          :class="{ 'force-nowrap': isCustom && styleCfg.forceNoWrap === true }"
          v-show="
            (!showFullLyrics || lyricsSwipePreview) &&
            !wordPlayback.interludeState.value.active &&
            !showWordDrop &&
            !showStaggered
          "
          :style="lyricsUnderlayStyle"
        >
          <div
            class="giant-text line-1"
            :style="{
              fontSize: fontSizePx,
              color: 'var(--text-dark)',
              fontFamily: frenzyFontFamily
            }"
          >
            {{ isCustom && styleCfg.forceNoWrap ? currentLyricText : lyricPart1 }}
          </div>
          <div
            v-if="!(isCustom && styleCfg.forceNoWrap)"
            class="giant-text line-2"
            :style="{
              fontSize: fontSizePx,
              color: 'var(--text-gray)',
              fontFamily: frenzyFontFamily
            }"
          >
            {{ lyricPart2 }}
          </div>
        </div>

        <staggered-climax-lyrics
          v-if="showStaggered && !wordPlayback.interludeState.value.active"
          :line="wordPlayback.currentDisplayLine.value"
          :line-key="wordPlayback.displayLineKey.value"
          :corrected-time="wordPlayback.correctedTime.value"
          :font-family="frenzyFontFamily"
          :font-size="styleCfg.staggeredSize"
          :row-gap="styleCfg.staggeredRowGap"
          :offset="styleCfg.staggeredOffset"
          :rotation="styleCfg.staggeredRotation"
          :color="textColorDark"
        />

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

        <!-- 半透明遮罩 + 滚动歌词（点击歌词时显示） -->
        <div
          v-show="showFullLyrics || lyricsSwipePreview"
          class="lyrics-mask"
          :style="lyricsBackdropStyle"
          @click="closeLyricsAnimated"
        ></div>
        <div
          v-show="showFullLyrics || lyricsSwipePreview"
          class="scrolling-lyrics-overlay"
          :style="lyricsOverlayStyle"
        >
          <mobile-scrolling-lyrics
            class="scrolling-lyrics-content"
            :back-closes="showFullLyrics"
            :active="showFullLyrics || lyricsSwipePreview"
            @close="closeLyricsAnimated"
            @interact="showControls"
            @generatePoster="handleGeneratePoster"
          />
        </div>

        <!-- 底部控件（3秒自动隐藏） -->
        <mobile-controls-area
          :visible="controlsVisible"
          :is-fullscreen="showFullLyrics"
          @close="closeLyricsAnimated"
          @showPlaylist="openPlaylist"
          @show-settings="showPlayerSettings = true"
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
 * FrenzyMobilePlayer — 狂躁模式手机端变体
 *
 * 设计来源：code (1).html — "Chasing Golden"
 * - 浅色背景 + 两行巨字
 * - 第一行深色，第二行灰色
 * - Inter 900，uppercase，超大字号
 * - 四角圆点装饰
 * - 音频响应：鼓点时字号脉冲/颜色切换
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import ClimaxInterludeOverlay from '@/components/lyric/ClimaxInterludeOverlay.vue';
import GlitchBackground from '@/components/lyric/GlitchBackground.vue';
import MobileControlsArea from '@/components/lyric/MobileControlsArea.vue';
import MobileScrollingLyrics from '@/components/lyric/MobileScrollingLyrics.vue';
import StaggeredClimaxLyrics from '@/components/lyric/StaggeredClimaxLyrics.vue';
import TtmlWordEffectLayer from '@/components/lyric/TtmlWordEffectLayer.vue';
import MobilePlayerSettings from '@/components/player/MobilePlayerSettings.vue';
import PosterShareModal from '@/components/share/PosterShareModal.vue';
import { useLyricSwipeGesture } from '@/composables/useLyricSwipeGesture';
import { useMobilePlayerTransition } from '@/composables/useMobilePlayerTransition';
import { usePlayerStyleAppearance } from '@/composables/usePlayerStyleAppearance';
import { usePosterShare } from '@/composables/usePosterShare';
import { useSwipeClose } from '@/composables/useSwipeClose';
import { useTapToggle } from '@/composables/useTapToggle';
import { useWordTimedPlayback } from '@/composables/useWordTimedPlayback';
import { artistList, nowTime, playMusic, sound } from '@/hooks/MusicHook';
import { useCoverColor } from '@/hooks/useCoverColor';
import { audioService } from '@/services/audioService';
import { drumDetector } from '@/services/drumDetector';
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
const { primaryColor, averageColor } = useCoverColor();

const { controlsVisible, handleTapToggle, showControls } = useTapToggle({
  onDoubleClick: () => {
    openLyricsAnimated();
  }
});

const showFullLyrics = ref(false);
const {
  style: lyricsSwipeStyle,
  overlayStyle: lyricsOverlayStyle,
  underlayStyle: lyricsUnderlayStyle,
  backdropStyle: lyricsBackdropStyle,
  previewing: lyricsSwipePreview,
  onPointerDown: onLyricsSwipePointerDown,
  onPointerMove: onLyricsSwipePointerMove,
  onPointerUp: onLyricsSwipePointerUp,
  onPointerCancel: onLyricsSwipePointerCancel,
  animateOpen: openLyricsAnimated,
  animateClose: closeLyricsAnimated
} = useLyricSwipeGesture({
  isOpen: () => showFullLyrics.value,
  onOpen: () => {
    openLyricsAnimated();
  },
  onClose: () => {
    showFullLyrics.value = false;
  }
});
const { onTouchStart: onSwipeCloseTouchStart, onTouchEnd: onSwipeCloseTouchEnd } = useSwipeClose({
  shouldClose: () => !showFullLyrics.value,
  onClose: () => close()
});

// 海报分享
const { showPosterModal, selectedLyrics, handleGeneratePoster } = usePosterShare();
const controlsRef = ref();
const {
  config: styleCfg,
  effects,
  styleVars,
  isCustom,
  customBackgroundActive,
  selectedFontFamily,
  customFontActive
} = usePlayerStyleAppearance('frenzy');
const wordPlayback = useWordTimedPlayback();
const lyricsUnderlayVisible = computed(() => !showFullLyrics.value || lyricsSwipePreview.value);

onMounted(() => {
  styleEngine.syncFromPlayerStore();
  styleEngine.syncCoverColors();
});

// ==================== 鼓点检测 ====================
const beatSpike = ref(0);
let spikeTimer: ReturnType<typeof setTimeout> | null = null;
const SPIKE_DURATION = 120;

onMounted(() => {
  const unsubscribe = drumDetector.onBeat((info) => {
    const spikeAmount = info.isStrong ? 0.45 : 0.25;
    beatSpike.value = spikeAmount * (0.6 + info.kickEnergy * 0.4);

    if (spikeTimer) clearTimeout(spikeTimer);
    spikeTimer = setTimeout(() => {
      beatSpike.value = 0;
    }, SPIKE_DURATION);
  });

  onUnmounted(() => {
    unsubscribe();
    if (spikeTimer) clearTimeout(spikeTimer);
  });
});

// ==================== 故障强度 ====================
const glitchIntensity = computed(() => {
  const baseIntensity = 0.15;
  const energyBoost = styleEngine.energyLevel * 0.15;
  const climaxBoost = styleEngine.isInClimax ? 0.3 : 0;
  const base = Math.min(1.0, baseIntensity + energyBoost + climaxBoost);
  const spike = styleEngine.isInClimax ? beatSpike.value : beatSpike.value * 0.3;
  return Math.min(1.0, base + spike);
});

// ==================== CRT 老电视失真 ====================
const crtIntensityCurrent = ref(0);
let crtTarget = 0;
let crtRafId = 0;
let crtPageVisible = true;
const CRT_FADE_SPEED = 0.04;

// The CRT/glitch layer belongs to the player surface and must keep running
// while the lyric surface slides over it.
const crtAnimationActive = computed(() => true);

function stopCrtAnimation() {
  if (crtRafId) cancelAnimationFrame(crtRafId);
  crtRafId = 0;
}

function startCrtAnimation() {
  if (crtRafId || !crtPageVisible || !crtAnimationActive.value) return;
  crtRafId = requestAnimationFrame(crtAnimate);
}

function crtAnimate() {
  if (!crtPageVisible || !crtAnimationActive.value) {
    crtRafId = 0;
    return;
  }
  const diff = crtTarget - crtIntensityCurrent.value;
  if (Math.abs(diff) < 0.01) {
    crtIntensityCurrent.value = crtTarget;
    crtRafId = 0;
    return;
  }
  crtIntensityCurrent.value += diff * CRT_FADE_SPEED;
  crtRafId = requestAnimationFrame(crtAnimate);
}

const crtIntensity = computed(() => {
  if (!effects.value.crt) return 0;
  const beatBoost = styleEngine.isInClimax ? beatSpike.value * 0.4 : 0;
  return Math.min(1.0, crtIntensityCurrent.value + beatBoost);
});

watch(
  () => [styleEngine.isInClimax, effects.value.crt, crtAnimationActive.value] as const,
  ([inClimax, enabled]) => {
    crtTarget = inClimax && enabled ? 0.6 : 0;
    if (crtAnimationActive.value) startCrtAnimation();
    else stopCrtAnimation();
  },
  { immediate: true }
);

function handleCrtPageVisibility() {
  crtPageVisible = !document.hidden;
  if (crtPageVisible) startCrtAnimation();
  else stopCrtAnimation();
}

onMounted(() => document.addEventListener('visibilitychange', handleCrtPageVisibility));

// ==================== 高潮过渡闪光 ====================
const climaxFlashOpacity = ref(0);
const climaxFlashHue = ref(0);
let flashTimer: ReturnType<typeof setTimeout> | null = null;
let flashTimer2: ReturnType<typeof setTimeout> | null = null;

const climaxFlashStyle = computed(() => ({
  opacity: climaxFlashOpacity.value,
  filter: `hue-rotate(${climaxFlashHue.value}deg)`,
  mixBlendMode: 'overlay' as const
}));

watch(
  () => styleEngine.isInClimax,
  (newVal, oldVal) => {
    if (newVal === oldVal) return;

    if (newVal) {
      climaxFlashOpacity.value = 0.7;
      climaxFlashHue.value = 200;
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        climaxFlashOpacity.value = 0;
        climaxFlashHue.value = 0;
      }, 180);
    } else {
      climaxFlashOpacity.value = 0.5;
      climaxFlashHue.value = 30;
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        climaxFlashOpacity.value = 0;
        climaxFlashHue.value = 0;
      }, 200);
      if (flashTimer2) clearTimeout(flashTimer2);
      flashTimer2 = setTimeout(() => {
        climaxFlashOpacity.value = 0.3;
        climaxFlashHue.value = -20;
        if (flashTimer) clearTimeout(flashTimer);
        flashTimer = setTimeout(() => {
          climaxFlashOpacity.value = 0;
          climaxFlashHue.value = 0;
        }, 120);
      }, 250);
    }
  }
);

onUnmounted(() => {
  if (flashTimer) clearTimeout(flashTimer);
  if (flashTimer2) clearTimeout(flashTimer2);
  stopCrtAnimation();
  document.removeEventListener('visibilitychange', handleCrtPageVisibility);
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
const frenzyFontFamily = computed(
  () => selectedFontFamily.value || "var(--m-font-art, 'Inter', sans-serif)"
);
const showWordDrop = computed(
  () =>
    lyricsUnderlayVisible.value &&
    styleEngine.isInClimax &&
    effects.value.wordDrop &&
    wordPlayback.available.value
);
const showStaggered = computed(
  () =>
    lyricsUnderlayVisible.value &&
    !showWordDrop.value &&
    styleEngine.isInClimax &&
    effects.value.staggered &&
    Boolean(wordPlayback.currentDisplayLine.value?.words?.length)
);

// ==================== 巨字歌词拆分 ====================

/**
 * 获取当前歌词行并拆分为两部分
 * 规则：
 * 1. 优先在空格/逗号/顿号处拆分
 * 2. 如果没有自然分隔，在中间字符处拆分
 * 3. 只有一部分时，第二行为空
 */
const currentLyricParts = computed(() => {
  const text = wordPlayback.currentDisplayLine.value?.text || '';
  if (!text) return ['', ''];

  // 尝试在自然分隔处拆分
  const separators = [' ', '，', ',', '、', '；', ';', ''];
  for (const sep of separators) {
    const pos = text.indexOf(sep);
    if (pos > 0 && pos < text.length - 1) {
      return [text.slice(0, pos).trim(), text.slice(pos + 1).trim()];
    }
  }

  // 没有分隔符：在中间拆分
  const mid = Math.floor(text.length / 2);
  return [text.slice(0, mid), text.slice(mid)];
});

const lyricPart1 = computed(() => currentLyricParts.value[0] || '');
const lyricPart2 = computed(() => currentLyricParts.value[1] || '');
const currentLyricText = computed(() => wordPlayback.currentDisplayLine.value?.text || '');

// ==================== 音频响应视觉 ====================

/**
 * 鼓点时字号脉冲放大
 * 基础字号 clamp(80px, 14vw, 160px)，鼓点时增加 5-10%
 */
const fontSizePx = computed(() => {
  const size = styleCfg.value.giantSize;
  const base = size ? `${size}px` : 'clamp(80px, 14vw, 160px)';
  // 鼓点命中时脉冲（通过 CSS scale 实现，不改变 font-size 避免重排）
  return base;
});

/**
 * 颜色：高潮时切换为强调色
 */
const textColorDark = computed(() => {
  if (isCustom.value) {
    return styleEngine.isInClimax && effects.value.lyricColor
      ? styleCfg.value.frenzyClimaxMainColor
      : styleCfg.value.frenzyNormalMainColor;
  }
  if (styleEngine.isInClimax && effects.value.lyricColor) return primaryColor.value;
  return '#1a1a1a';
});

const textColorGray = computed(() => {
  if (isCustom.value) {
    return styleEngine.isInClimax && effects.value.lyricColor
      ? styleCfg.value.frenzyClimaxAuxiliaryColor
      : styleCfg.value.frenzyNormalAuxiliaryColor;
  }
  if (styleEngine.isInClimax && effects.value.lyricColor) return averageColor.value;
  return '#6b6b6b';
});

/**
 * 背景：由 GlitchBackground 提供，设为透明避免遮挡 WebGL 层
 */
const backgroundColor = computed(() => 'transparent');

// ==================== 播放控制 ====================

function close() {
  useMobilePlayerTransition().close(0, () => {
    isVisible.value = false;
    playerStore.setMusicFull(false);
  });
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
    audioService.seek(seekTime);
    nowTime.value = seekTime;
  }
}

function formatTime(seconds: number): string {
  return secondToMinute(seconds);
}
</script>

<style lang="scss" scoped>
.frenzy-mobile-player {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #f5f5f5;
}

/* CRT 闪光层 */
.climax-flash {
  position: absolute;
  inset: 0;
  background: white;
  pointer-events: none;
  z-index: 15;
  transition: opacity 0.15s ease-out;
}

/* 确保 GlitchBackground 在歌词和控件之下 */
.frenzy-mobile-player :deep(.glitch-bg-container) {
  z-index: 0;
}

/* 巨字和控件在 glitch 之上 */
.giant-text-container,
.top-controls,
.bottom-controls,
.corner-dot {
  position: absolute;
  z-index: 10;
}

.giant-text-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 20px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);

  &.force-nowrap {
    width: max-content;
    max-width: none;
    flex-direction: row;
    padding: 0;
    white-space: nowrap;
  }
}

/* 四角圆点装饰 */
.corner-dot {
  position: absolute;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #ccc;
  transition: background 0.3s var(--m-ease-out, ease);

  &.tl {
    top: 20px;
    left: 20px;
  }
  &.tr {
    top: 20px;
    right: 20px;
  }
  &.bl {
    bottom: 20px;
    left: 20px;
  }
  &.br {
    bottom: 20px;
    right: 20px;
  }
}

/* 巨字样式 */
.giant-text {
  font-family: var(--m-font-art, 'Inter', sans-serif);
  font-weight: 900;
  line-height: 0.95;
  letter-spacing: -0.03em;
  text-transform: uppercase;
  text-align: center;
  transition: color 0.3s var(--m-ease-out, ease);
  /* 鼓点脉冲：用 scale 而非 font-size 避免重排 */
  transform: scale(1);
  will-change: transform, color;
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
    color: #1a1a1a;
    background: rgba(0, 0, 0, 0.05);
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
    color: #999;
    flex-shrink: 0;
    min-width: 36px;
  }

  .progress-bar-bg {
    flex: 1;
    height: 2px;
    background: #ddd;
    border-radius: 1px;
    position: relative;
    cursor: pointer;

    .progress-bar-fill {
      position: absolute;
      left: 0;
      top: 0;
      height: 100%;
      background: #1a1a1a;
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
  gap: 20px;

  .ctrl-btn {
    @apply flex items-center justify-center;
    @apply rounded-full;
    @apply cursor-pointer;
    background: #ddd;
    width: 42px;
    height: 42px;
    transition: transform var(--m-duration-press, 160ms) var(--m-ease-out, ease-out);

    i {
      font-size: 18px;
      color: #1a1a1a;
    }

    &:active {
      transform: scale(0.97);
    }

    &.play-btn {
      width: 56px;
      height: 56px;
      background: #999;

      i {
        font-size: 24px;
        color: #fff;
      }
    }
  }
}

/* 过渡动画 */
.frenzy-mobile-fade-enter-active,
.frenzy-mobile-fade-leave-active {
  transition: opacity 0.3s var(--m-ease-out, ease);
}

.frenzy-mobile-fade-enter-from,
.frenzy-mobile-fade-leave-to {
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
  .giant-text {
    transition: none;
  }
  .frenzy-mobile-fade-enter-active,
  .frenzy-mobile-fade-leave-active,
  .ctrl-fade-enter-active,
  .ctrl-fade-leave-active {
    transition: opacity 0.2s ease;
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

.scrolling-lyrics-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  color: #fff;
}

.scrolling-lyrics-content {
  width: 100%;
  height: 100%;
}
</style>
