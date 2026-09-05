<template>
  <teleport to="body">
    <transition name="lyric-mode-fade">
      <div
        v-if="isVisible"
        class="lyric-mode-player player-style-surface"
        :class="{
          'player-style-customized': isCustom,
          'player-style-custom-font': customFontActive,
          'player-style-custom-background': customBackgroundActive,
          'has-beat-flash': climaxEffects.beatFlash,
          'has-crt': climaxEffects.crt,
          'has-vignette': climaxEffects.vignette,
          'is-climax': styleEngine.isInClimax
        }"
        :style="{
          ...styleVars,
          '--accent-color': accentColor,
          '--accent-color-rgb': accentColorRgb,
          '--player-style-resolved-font': baseFontFamily,
          background: baseBackgroundColor,
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
        <!-- ==================== 背景预设层 ==================== -->
        <component
          :is="backgroundComponent"
          v-if="backgroundComponent"
          class="background-preset-layer"
          :params="backgroundParams"
        />

        <!-- ==================== 高潮效果层 ==================== -->
        <beat-flash-layer v-if="climaxEffects.beatFlash" />
        <div v-if="climaxEffects.flash" class="climax-flash" :class="{ active: climaxFlashOn }"></div>
        <div v-if="climaxEffects.glow" class="climax-glow" :class="{ active: styleEngine.isInClimax }"></div>
        <div v-if="climaxEffects.vignette" class="climax-vignette"></div>

        <ttml-word-effect-layer
          v-if="lyricsUnderlayVisible && !wordPlayback.interludeState.value.active"
          :auxiliary-tokens="wordPlayback.auxiliaryTokens.value"
          :main-token="wordPlayback.currentMainToken.value"
          :show-drop="showWordDrop"
          :climax-shake="styleEngine.isInClimax && wordPlayback.climaxWordShake.value"
          :center-auxiliary="isCustom && styleCfg.auxiliaryCenterDisplay === true"
        />

        <climax-interlude-overlay :state="wordPlayback.interludeState.value" />

        <!-- 顶部:歌名 + 歌手(tap 显示) -->
        <div class="song-header" :class="{ 'song-header-visible': controlsVisible }">
          <div class="song-header-title">{{ songTitle }}</div>
          <div class="song-header-artist">
            <span v-for="(item, index) in artistList" :key="index">
              {{ item.name }}{{ index < artistList.length - 1 ? ' / ' : '' }}
            </span>
          </div>
        </div>

        <!-- 中央:歌词渲染器(按歌词预设) -->
        <div
          class="lyrics-stage"
          v-show="
            (!showFullLyrics || lyricsSwipePreview) &&
            !wordPlayback.interludeState.value.active &&
            !showWordDrop &&
            !showStaggered
          "
          :style="lyricsUnderlayStyle"
        >
          <component
            :is="lyricRendererComponent"
            :lyric-color="lyricColor"
            :accent-color="accentColor"
            :font-family="baseFontFamily"
            :params="lyricParams"
            :climax-effects="climaxEffects"
          />
        </div>

        <staggered-climax-lyrics
          v-if="showStaggered && !wordPlayback.interludeState.value.active"
          :line="wordPlayback.currentDisplayLine.value"
          :line-key="wordPlayback.displayLineKey.value"
          :corrected-time="wordPlayback.correctedTime.value"
          :font-family="baseFontFamily"
          :font-size="styleCfg.staggeredSize"
          :row-gap="styleCfg.staggeredRowGap"
          :offset="styleCfg.staggeredOffset"
          :rotation="styleCfg.staggeredRotation"
          :color="lyricColor"
        />

        <!-- 半透明遮罩 + 滚动歌词(点歌词显示) -->
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

        <!-- 顶部控件(tap 弹出) -->
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

        <!-- 底部控件(3秒自动隐藏) -->
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

  <mobile-player-settings v-model:visible="showPlayerSettings" />

  <poster-share-modal
    v-model:visible="showPosterModal"
    :lyrics="selectedLyrics"
    :subject="posterSubject"
  />
</template>

<script setup lang="ts">
/**
 * LyricModePlayer — 「大字歌词」模式基座
 *
 * 9 种旧样式解构后的预设化容器:背景/歌词/高潮三类预设自由组合。
 * 壳层(手势/控件/遮罩/设置/分享)与 StageMobilePlayer 家族同构。
 */
import { computed, onMounted, onUnmounted, ref, type Component } from 'vue';

import Aurora from '@/components/Aurora.vue';
import BeatFlashLayer from '@/components/lyric/BeatFlashLayer.vue';
import ClimaxInterludeOverlay from '@/components/lyric/ClimaxInterludeOverlay.vue';
import GlitchBackground from '@/components/lyric/GlitchBackground.vue';
import LiquidEther from '@/components/lyric/LiquidEther.vue';
import MobileControlsArea from '@/components/lyric/MobileControlsArea.vue';
import MobileScrollingLyrics from '@/components/lyric/MobileScrollingLyrics.vue';
import RainCanvas from '@/components/lyric/RainCanvas.vue';
import SmokeBackground from '@/components/lyric/SmokeBackground.vue';
import StaggeredClimaxLyrics from '@/components/lyric/StaggeredClimaxLyrics.vue';
import StarChartBackdrop from '@/components/lyric/backdrops/StarChartBackdrop.vue';
import ConcreteBackdrop from '@/components/lyric/backdrops/ConcreteBackdrop.vue';
import Md3Backdrop from '@/components/lyric/backdrops/Md3Backdrop.vue';
import VhsCrackBackdrop from '@/components/lyric/backdrops/VhsCrackBackdrop.vue';
import TtmlWordEffectLayer from '@/components/lyric/TtmlWordEffectLayer.vue';
import MobilePlayerSettings from '@/components/player/MobilePlayerSettings.vue';
import PosterShareModal from '@/components/share/PosterShareModal.vue';
import CalligraphyLyrics from '@/components/lyric/lyricRenderers/CalligraphyLyrics.vue';
import BrushSingleLyrics from '@/components/lyric/lyricRenderers/BrushSingleLyrics.vue';
import DissolveLyrics from '@/components/lyric/lyricRenderers/DissolveLyrics.vue';
import GiantTwoLyrics from '@/components/lyric/lyricRenderers/GiantTwoLyrics.vue';
import NeonStrokeLyrics from '@/components/lyric/lyricRenderers/NeonStrokeLyrics.vue';
import SerifLineLyrics from '@/components/lyric/lyricRenderers/SerifLineLyrics.vue';
import { useLyricSwipeGesture } from '@/composables/useLyricSwipeGesture';
import { useMobilePlayerTransition } from '@/composables/useMobilePlayerTransition';
import { usePlayerStyleAppearance } from '@/composables/usePlayerStyleAppearance';
import { usePosterShare } from '@/composables/usePosterShare';
import { useSwipeClose } from '@/composables/useSwipeClose';
import { useTapToggle } from '@/composables/useTapToggle';
import { useWordTimedPlayback } from '@/composables/useWordTimedPlayback';
import { artistList, playMusic } from '@/hooks/MusicHook';
import { useCoverColor } from '@/hooks/useCoverColor';
import { getClimaxEffects, getLyricPreset } from '@/config/playerPresets';
import { usePlayerStore } from '@/store/modules/player';
import { useStyleEngineStore } from '@/store/modules/styleEngine';

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
const { primaryColor, primaryColorRgb } = useCoverColor();

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
    showFullLyrics.value = true;
    playerStore.setFullLyricsVisible(true);
  },
  onClose: () => {
    showFullLyrics.value = false;
    playerStore.setFullLyricsVisible(false);
  }
});
const { onTouchStart: onSwipeCloseTouchStart, onTouchEnd: onSwipeCloseTouchEnd } = useSwipeClose({
  shouldClose: () => !showFullLyrics.value,
  onClose: () => close()
});

const { showPosterModal, selectedLyrics, posterSubject, handleGeneratePoster } = usePosterShare();
const {
  config: styleCfg,
  effects,
  styleVars,
  isCustom,
  customBackgroundActive,
  climaxColors,
  selectedFontFamily,
  customFontActive
} = usePlayerStyleAppearance('default');
const wordPlayback = useWordTimedPlayback();
const lyricsUnderlayVisible = computed(() => !showFullLyrics.value || lyricsSwipePreview.value);

// ==================== 预设消费 ====================

/** 三类预设 id(music-full-config 顶层,迁移/面板写入) */
function readPresetIds() {
  try {
    const saved = JSON.parse(localStorage.getItem('music-full-config') || '{}');
    backgroundPresetId.value = typeof saved.backgroundPresetId === 'string' ? saved.backgroundPresetId : 'theme-solid';
    lyricPresetId.value = typeof saved.lyricPresetId === 'string' ? saved.lyricPresetId : 'serif-line';
    climaxPresetId.value = typeof saved.climaxPresetId === 'string' ? saved.climaxPresetId : 'none';
    presetParams.value =
      saved.presetParams && typeof saved.presetParams === 'object'
        ? (saved.presetParams as Record<string, unknown>)
        : {};
  } catch {
    backgroundPresetId.value = 'theme-solid';
    lyricPresetId.value = 'serif-line';
    climaxPresetId.value = 'none';
    presetParams.value = {};
  }
}

const backgroundPresetId = ref('theme-solid');
const lyricPresetId = ref('serif-line');
const climaxPresetId = ref('none');
const presetParams = ref<Record<string, unknown>>({});

const climaxEffects = computed(() => getClimaxEffects(climaxPresetId.value));
const lyricParams = computed(() => ({
  ...(getLyricPreset(lyricPresetId.value).params || {}),
  ...(presetParams.value as Record<string, unknown>)
}));
const backgroundParams = computed(() => ({
  ...(backgroundPresetParamsDefaults[backgroundPresetId.value] || {}),
  ...(presetParams.value as Record<string, unknown>)
}));

/** 背景组件的参数默认值(与 playerPresets.ts 的 params 保持一致的运行时兜底) */
const backgroundPresetParamsDefaults: Record<string, Record<string, unknown>> = {
  'cover-blur': { backgroundBlur: 60, backgroundDarkness: 0.4 },
  'stage-dark': { beatFlashIntensity: 0.5 },
  aurora: { auroraSpeed: 0.8 },
  fluid: { fluidPower: 1 },
  glitch: { glitchIntensity: 1 },
  'vhs-crack': { vhsIntensity: 1, crackEnabled: true, newspaperFreq: 500 },
  rain: { rainIntensity: 1, rainSpeed: 1, rainAudioReactive: true },
  smoke: { smokeDensity: 1, smokeChaos: 1, smokeLoudnessResponse: 1, smokeOpacity: 1 },
  md3: { md3Tone: 'auto' }
};

/** 背景预设 → 组件映射(theme-solid/stage-dark 为纯色无组件) */
const backgroundComponent = computed<Component | null>(() => {
  switch (backgroundPresetId.value) {
    case 'aurora':
      return Aurora;
    case 'fluid':
      return LiquidEther;
    case 'glitch':
      return GlitchBackground;
    case 'smoke':
      return SmokeBackground;
    case 'rain':
      return RainCanvas;
    case 'concrete':
      return ConcreteBackdrop;
    case 'vhs-crack':
      return VhsCrackBackdrop;
    case 'starchart':
      return StarChartBackdrop;
    case 'md3':
      return Md3Backdrop;
    default:
      return null;
  }
});

/** 歌词预设 → 渲染器映射 */
const LYRIC_RENDERER_MAP: Record<string, Component> = {
  // amll-scroll 在大字模式下降级为衬线单行(滚动歌词仍由点歌词的遮罩层承载)
  'amll-scroll': SerifLineLyrics,
  'serif-line': SerifLineLyrics,
  'giant-two': GiantTwoLyrics,
  'brush-single': BrushSingleLyrics,
  calligraphy: CalligraphyLyrics,
  'neon-stroke': NeonStrokeLyrics,
  dissolve: DissolveLyrics
};

const lyricRendererComponent = computed<Component>(
  () => LYRIC_RENDERER_MAP[lyricPresetId.value] || SerifLineLyrics
);

// ==================== 公共状态 ====================

const isVisible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
});
const songTitle = computed(() => playMusic.value?.name || '');
const accentColor = computed(() => primaryColor.value || '#888888');
const accentColorRgb = computed(() => primaryColorRgb.value || '136, 136, 136');
const baseFontFamily = computed(
  () => selectedFontFamily.value || "'Noto Serif SC', 'STSong', 'SimSun', serif"
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
    climaxEffects.value.staggered &&
    Boolean(wordPlayback.currentDisplayLine.value?.words?.length)
);

/** 歌词颜色:custom 模式跟随高潮配色;否则仅 color-shift 类预设高潮时变色 */
const lyricColor = computed(() => {
  if (isCustom.value) return climaxColors.value.main;
  if (styleEngine.isInClimax && climaxEffects.value.lyricColor) return accentColor.value;
  return '#f0ece4';
});

/** 底色:自定义背景优先,否则按背景预设给基调色 */
const presetBaseBackgrounds: Record<string, string> = {
  'theme-solid': '',
  'cover-blur': '#101010',
  'stage-dark': '#1a1a1a',
  concrete: '#181614',
  aurora: '#101014',
  fluid: '#000000',
  glitch: '#141414',
  'vhs-crack': '#0c0c0c',
  rain: '#0a0a0f',
  smoke: '#111111',
  starchart: '#050505',
  md3: ''
};
const baseBackgroundColor = computed(() => {
  if (customBackgroundActive.value) return styleVars.value['--player-style-background-color'] || '#111111';
  const preset = presetBaseBackgrounds[backgroundPresetId.value] ?? '#141414';
  if (backgroundPresetId.value === 'theme-solid' || backgroundPresetId.value === 'md3') {
    return playMusic.value?.primaryColor || props.background || '#171717';
  }
  return preset;
});

// 高潮过渡白闪(frenzy 系)
const climaxFlashOn = computed(() => styleEngine.isInClimax && climaxEffects.value.flash);

// ==================== 配置监听 ====================

const showPlayerSettings = computed({
  get: () => playerStore.playerSettingsVisible,
  set: (val) => playerStore.setPlayerSettingsVisible(val)
});

function handleConfigUpdate() {
  readPresetIds();
}

onMounted(() => {
  readPresetIds();
  styleEngine.syncFromPlayerStore?.();
  styleEngine.syncCoverColors?.();
  window.addEventListener('music-full-config-updated', handleConfigUpdate);
});

onUnmounted(() => {
  window.removeEventListener('music-full-config-updated', handleConfigUpdate);
});

// ==================== 播放控制 ====================

function close() {
  useMobilePlayerTransition().close(0, () => {
    isVisible.value = false;
    playerStore.setMusicFull(false);
  });
}

function openPlaylist() {
  playerStore.setPlayListDrawerVisible(true);
}
</script>

<style lang="scss" scoped>
.lyric-mode-player {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  overflow: hidden;
  color: #f0ece4;
  isolation: isolate;

  > * {
    position: relative;
  }
}

/* 背景组件铺满底层 */
.background-preset-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.lyric-mode-player > :not(.background-preset-layer) {
  z-index: 1;
}

/* ==================== 高潮效果层 ==================== */

.climax-flash {
  position: absolute;
  inset: 0;
  z-index: 2;
  background: #fff;
  opacity: 0;
  pointer-events: none;
  transition: opacity 140ms ease;
  mix-blend-mode: overlay;

  &.active {
    opacity: 0.28;
  }
}

.climax-glow {
  position: absolute;
  inset: -10%;
  z-index: 1;
  pointer-events: none;
  opacity: 0;
  transition: opacity 600ms ease;
  background: radial-gradient(ellipse at center, rgba(var(--accent-color-rgb, 255, 255, 255), 0.22), transparent 65%);

  &.active {
    opacity: 1;
  }
}

.climax-vignette {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 52%, rgba(0, 0, 0, 0.55) 100%);
}

/* ==================== 顶部歌名 ==================== */

.song-header {
  position: absolute;
  z-index: 3;
  top: calc(var(--safe-area-inset-top, 0px) + 24px);
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  opacity: 0;
  transition: opacity 0.3s var(--m-ease-out, ease);
  max-width: 86%;

  &.song-header-visible {
    opacity: 1;
  }
}

.song-header-title {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.02em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-header-artist {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
  margin-top: 2px;
}

/* ==================== 歌词舞台 ==================== */

.lyrics-stage {
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 0 20px;
}

/* ==================== 控件 ==================== */

.top-controls {
  position: absolute;
  z-index: 10;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  padding: calc(var(--safe-area-inset-top, 0px) + 16px) 20px 0;

  .ctrl-btn {
    @apply flex h-10 w-10 items-center justify-center rounded-full text-xl;
    color: #f0ece4;
    background: rgba(255, 255, 255, 0.08);
    cursor: pointer;
    transition: transform var(--m-duration-press, 160ms) var(--m-ease-out, ease-out);

    &:active {
      transform: scale(0.97);
    }
  }
}

/* ==================== 过渡 ==================== */

.lyric-mode-fade-enter-active,
.lyric-mode-fade-leave-active {
  transition: opacity 0.3s var(--m-ease-out, ease);
}

.lyric-mode-fade-enter-from,
.lyric-mode-fade-leave-to {
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

@media (prefers-reduced-motion: reduce) {
  .lyric-mode-fade-enter-active,
  .lyric-mode-fade-leave-active,
  .ctrl-fade-enter-active,
  .ctrl-fade-leave-active {
    transition: opacity 0.2s ease;
  }

  .climax-flash,
  .climax-glow {
    transition: none;
  }
}

/* ==================== 遮罩与滚动歌词 ==================== */

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
</style>
