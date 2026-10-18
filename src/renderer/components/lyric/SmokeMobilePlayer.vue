<template>
  <teleport to="body">
    <transition name="smoke-fade">
      <div
        v-if="isVisible"
        class="smoke-mobile-player player-style-surface"
        :class="{
          'player-style-customized': isCustom,
          'player-style-custom-font': customFontActive,
          'player-style-custom-background': customBackgroundActive
        }"
        :style="{
          ...styleVars,
          '--smoke-color': smokeColor,
          '--smoke-opacity': smokeOpacity,
          '--player-style-resolved-font': fontFamily,
          ...lyricsSwipeStyle
        }"
        @click="handleTapToggle"
        @pointerdown.capture="
          onLyricsSwipePointerDown($event);
          commentsSwipe.onPointerDown($event);
        "
        @pointermove.capture="
          onLyricsSwipePointerMove($event);
          commentsSwipe.onPointerMove($event);
        "
        @pointerup.capture="
          onLyricsSwipePointerUp($event);
          commentsSwipe.onPointerUp($event);
        "
        @pointercancel.capture="
          onLyricsSwipePointerCancel($event);
          commentsSwipe.onPointerCancel($event);
        "
        @touchstart="onSwipeCloseTouchStart"
        @touchend="onSwipeCloseTouchEnd"
      >
        <smoke-background
          :color="smokeColor"
          :density="smokeDensity"
          :chaos="smokeChaos"
          :loudness="smokeLoudness"
          :opacity="smokeOpacity"
          :reduced-motion="reducedMotion"
        />
        <div
          class="smoke-vignette"
          :style="{ opacity: styleEngine.isInClimax ? smokeVignette : 0 }"
        ></div>
        <div
          class="smoke-climax-glow"
          :style="{
            '--smoke-climax-glow-color': smokeClimaxGlowColor,
            opacity: styleEngine.isInClimax ? 1 : 0
          }"
        ></div>
        <climax-interlude-overlay :state="wordPlayback.interludeState.value" />
        <ttml-word-effect-layer
          v-if="lyricsUnderlayVisible && !wordPlayback.interludeState.value.active"
          :auxiliary-tokens="wordPlayback.auxiliaryTokens.value"
          :main-token="wordPlayback.currentMainToken.value"
          :show-drop="showWordDrop"
          :climax-shake="styleEngine.isInClimax && wordPlayback.climaxWordShake.value"
          :center-auxiliary="isCustom && styleCfg.auxiliaryCenterDisplay === true"
        />
        <div
          class="smoke-lyrics"
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
            class="smoke-lyric-text"
            :style="{
              color: 'var(--player-style-lyric-color)',
              fontFamily,
              fontWeight: styleCfg.fontWeight,
              transform: `scaleX(${styleCfg.smokeFontStretch || 1.18})`
            }"
          >
            {{ currentText }}
          </div>
          <div v-if="showTranslation && currentTranslation" class="smoke-translation">
            {{ currentTranslation }}
          </div>
        </div>
        <staggered-climax-lyrics
          v-if="showStaggered && !wordPlayback.interludeState.value.active"
          :line="wordPlayback.currentDisplayLine.value"
          :line-key="wordPlayback.displayLineKey.value"
          :corrected-time="wordPlayback.correctedTime.value"
          :font-family="fontFamily"
          :font-size="styleCfg.staggeredSize"
          :row-gap="styleCfg.staggeredRowGap"
          :offset="styleCfg.staggeredOffset"
          :rotation="styleCfg.staggeredRotation"
          color="var(--player-style-lyric-color)"
        />
        <div
          v-show="showFullLyrics || lyricsSwipePreview || risePreviewing"
          class="lyrics-mask"
          :style="riseMaskStyle || lyricsBackdropStyle"
          @click="closeImmersive()"
        ></div>
        <mobile-comments-overlay :gesture="commentsSwipe" />
        <div
          v-show="showFullLyrics || lyricsSwipePreview || risePreviewing"
          class="scrolling-lyrics-overlay"
          :style="riseOverlayStyle || lyricsOverlayStyle"
        >
          <mobile-scrolling-lyrics
            v-if="immersiveSurfaceMode === 'lyrics'"
            class="scrolling-lyrics-content"
            :back-closes="showFullLyrics"
            :active="showFullLyrics || lyricsSwipePreview || risePreviewing"
            @close="closeImmersive"
            @interact="showControls"
            @generatePoster="handleGeneratePoster"
          />
          <!-- 沉浸态内容区替换：设置/播放列表就地取代歌词区（按钮为切换型，带显隐动画） -->
          <Transition name="ip-surface">
            <div
              v-if="showFullLyrics && immersiveSurfaceMode === 'settings'"
              class="immersive-panel"
              :style="panelSurfaceVars"
            >
              <mobile-player-settings
                embedded
                :visible="true"
                @update:visible="toggleImmersiveSurface('settings')"
              />
            </div>
          </Transition>
          <Transition name="ip-surface">
            <div
              v-if="showFullLyrics && immersiveSurfaceMode === 'playlist'"
              class="immersive-panel"
              :style="panelSurfaceVars"
            >
              <immersive-playlist-panel />
            </div>
          </Transition>
          <!-- 沉浸歌词顶部栏：让位顶部关闭条，显隐随控件栏 -->
          <div
            class="immersive-header-wrap"
            :class="{
              'header-hidden':
                showFullLyrics && immersiveSurfaceMode === 'settings'
            }"
            :style="immersiveHeaderDragStyle"
            @pointerdown="immersiveHeaderCollapse.onHeaderPointerDown"
            @pointermove="immersiveHeaderCollapse.onHeaderPointerMove"
            @pointerup="immersiveHeaderCollapse.onHeaderPointerUp"
            @pointercancel="immersiveHeaderCollapse.onHeaderPointerCancel"
          >
            <lyric-immersive-header
              :cover-url="playMusic?.picUrl || ''"
              :title="playMusic?.name || 'Zephyrus'"
              :progress="immersiveProgress"
              :settings-active="immersiveSurfaceMode === 'settings'"
              entrance="rise"
              @show-settings="toggleImmersiveSurface('settings')"
            />
          </div>
        </div>
        <transition name="ctrl-fade"
          ><div v-show="controlsVisible" class="top-controls no-toggle">
            <button class="ctrl-btn" @click.stop="close">
              <i class="ri-arrow-down-s-line"></i>
            </button>
            <div class="spacer"></div>
            <button class="ctrl-btn" @click.stop="showPlayerSettings = true">
              <i class="ri-more-2-fill"></i>
            </button></div
        ></transition>
        <mobile-controls-area
          :visible="controlsVisible"
          :is-fullscreen="showFullLyrics"
          @close="closeImmersive"
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
import { computed, onMounted, onUnmounted, ref } from 'vue';

import MobileCommentsOverlay from '@/components/comment/MobileCommentsOverlay.vue';
import ClimaxInterludeOverlay from '@/components/lyric/ClimaxInterludeOverlay.vue';
import LyricImmersiveHeader from '@/components/lyric/LyricImmersiveHeader.vue';
import MobileControlsArea from '@/components/lyric/MobileControlsArea.vue';
import MobileScrollingLyrics from '@/components/lyric/MobileScrollingLyrics.vue';
import SmokeBackground from '@/components/lyric/SmokeBackground.vue';
import StaggeredClimaxLyrics from '@/components/lyric/StaggeredClimaxLyrics.vue';
import TtmlWordEffectLayer from '@/components/lyric/TtmlWordEffectLayer.vue';
import MobilePlayerSettings from '@/components/player/MobilePlayerSettings.vue';
import ImmersivePlaylistPanel from '@/components/player/ImmersivePlaylistPanel.vue';
import PosterShareModal from '@/components/share/PosterShareModal.vue';
import { useCommentsPage } from '@/composables/useCommentsPage';
import {
  immersiveSurfaceMode,
  toggleImmersiveSurface,
  useStyleImmersiveHeaderCollapse,
  useStyleImmersiveLyrics
} from '@/composables/useImmersiveLyrics';
import { useLyricSwipeGesture } from '@/composables/useLyricSwipeGesture';
import { useMobilePlayerTransition } from '@/composables/useMobilePlayerTransition';
import { usePlayerStyleAppearance } from '@/composables/usePlayerStyleAppearance';
import { usePosterShare } from '@/composables/usePosterShare';
import { useSwipeClose } from '@/composables/useSwipeClose';
import { useTapToggle } from '@/composables/useTapToggle';
import { useWordTimedPlayback } from '@/composables/useWordTimedPlayback';
import { playMusic } from '@/hooks/MusicHook';
import { audioService } from '@/services/audioService';
import { usePlayerStore } from '@/store/modules/player';
import { useStyleEngineStore } from '@/store/modules/styleEngine';
import { ensureFontLoaded } from '@/utils/fontLoader';

const props = defineProps({ modelValue: { type: Boolean, default: false } });
const emit = defineEmits(['update:modelValue']);
const playerStore = usePlayerStore();
const styleEngine = useStyleEngineStore();
const { controlsVisible, handleTapToggle, showControls } = useTapToggle({
  onDoubleClick: () => openLyricsAnimated()
});
const commentsSwipe = useCommentsPage();
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
  animateOpen: openLyricsAnimated
} = useLyricSwipeGesture({
  isOpen: () => showFullLyrics.value,
  suppressed: () => playerStore.fullCommentsVisible,
  onOpen: () => {
    showFullLyrics.value = true;
    playerStore.setFullLyricsVisible(true);
    showControls();
  },
  onClose: () => {
    resetOnGestureClose();
    showFullLyrics.value = false;
    playerStore.setFullLyricsVisible(false);
  }
});
// 沉浸歌词 rise 路径：信息栏上拉手势经共享模块调起，关闭下沉镜像；横滑路径保持现状
const {
  risePreviewing,
  immersiveProgress,
  riseOverlayStyle,
  riseMaskStyle,
  closeImmersive,
  resetOnGestureClose
} = useStyleImmersiveLyrics({
  showFullLyrics,
  openAnimated: openLyricsAnimated,
  swipePreviewing: () => lyricsSwipePreview.value
});
const immersiveHeaderCollapse = useStyleImmersiveHeaderCollapse(closeImmersive);
const immersiveHeaderDragStyle = computed(() =>
  immersiveHeaderCollapse.dragOffset.value > 0
    ? { transform: `translate3d(0, ${immersiveHeaderCollapse.dragOffset.value.toFixed(1)}px, 0)` }
    : undefined
);
// 沉浸面板几何：控件栏可见时夹在顶栏（safe+66 起 44px 高）与底部控件栏之间，
// 控件栏隐藏后才扩展到全屏；渐隐截断只保留边缘小截
const panelSurfaceVars = computed(() => ({
  '--ip-inset-top': controlsVisible.value ? 'calc(var(--safe-area-inset-top, 0px) + 120px)' : '0px',
  '--ip-inset-bottom': controlsVisible.value
    ? 'calc(var(--safe-area-inset-bottom, 0px) + 170px)'
    : '0px',
  '--ip-fade-top': controlsVisible.value ? '18px' : '24px',
  '--ip-fade-bottom': controlsVisible.value ? '18px' : '24px'
}));
const { onTouchStart: onSwipeCloseTouchStart, onTouchEnd: onSwipeCloseTouchEnd } = useSwipeClose({
  shouldClose: () => !showFullLyrics.value && !playerStore.fullCommentsVisible,
  onClose: () => close()
});
const { showPosterModal, selectedLyrics, posterSubject, handleGeneratePoster } = usePosterShare();
const {
  config: styleCfg,
  effects,
  styleVars,
  isCustom,
  customBackgroundActive,
  customFontActive,
  selectedFontFamily,
  saturatedThemeColor
} = usePlayerStyleAppearance('smoke');
const wordPlayback = useWordTimedPlayback();
const lyricsUnderlayVisible = computed(() => !showFullLyrics.value || lyricsSwipePreview.value);
const showPlayerSettings = computed({
  get: () => playerStore.playerSettingsVisible,
  set: (value) => playerStore.setPlayerSettingsVisible(value)
});
const isVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});
const currentText = computed(() => wordPlayback.currentDisplayLine.value?.text || '');
const currentTranslation = computed(() => wordPlayback.currentDisplayLine.value?.trText || '');
const showTranslation = ref(true);
const reducedMotion = ref(false);
const loadConfig = () => {
  try {
    const saved = JSON.parse(localStorage.getItem('music-full-config') || '{}');
    showTranslation.value = saved.showTranslation ?? true;
    reducedMotion.value = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    // localStorage may be unavailable in a restricted WebView.
  }
};
onMounted(() => {
  loadConfig();
  window.addEventListener('music-full-config-updated', loadConfig);
  styleEngine.syncFromPlayerStore();
  styleEngine.syncCoverColors();
  // 默认字体为马善政毛笔楷书：提前注册 FontFace，首帧即可生效
  void ensureFontLoaded('ma-shan-zheng');
});
onUnmounted(() => window.removeEventListener('music-full-config-updated', loadConfig));
const showWordDrop = computed(
  () =>
    lyricsUnderlayVisible.value &&
    !wordPlayback.interludeState.value.active &&
    styleEngine.isInClimax &&
    effects.value.wordDrop &&
    wordPlayback.available.value
);
const showStaggered = computed(
  () =>
    lyricsUnderlayVisible.value &&
    !wordPlayback.interludeState.value.active &&
    !showWordDrop.value &&
    styleEngine.isInClimax &&
    effects.value.staggered &&
    Boolean(wordPlayback.currentDisplayLine.value?.words?.length)
);
const smokeDensity = computed(() =>
  Math.min(1, Number(styleCfg.value.smokeDensity || 1) + styleEngine.energyLevel * 0.2)
);
const smokeChaos = computed(() =>
  Math.min(1, Number(styleCfg.value.smokeChaos || 1) + styleEngine.beatFlux * 0.4)
);
const smokeLoudness = computed(() =>
  Math.min(
    1,
    Math.max(styleEngine.energyLevel, audioService.getLoudness()) *
      Number(styleCfg.value.smokeLoudnessResponse || 1) +
      Math.max(styleEngine.kickEnergy, audioService.getBandEnergies().low) * 0.3
  )
);
const smokeOpacity = computed(() => Number(styleCfg.value.smokeOpacity || 1));
const smokeVignette = computed(() => Number(styleCfg.value.smokeVignette || 0.48));
const smokeColor = computed(() =>
  !isCustom.value || styleCfg.value.smokeFollowThemeColor !== false
    ? saturatedThemeColor.value
    : styleCfg.value.smokeCustomColor || '#5fffd0'
);
const smokeClimaxGlowColor = computed(() =>
  !isCustom.value || styleCfg.value.smokeGlowFollowThemeColor !== false
    ? saturatedThemeColor.value
    : styleCfg.value.smokeGlowCustomColor || '#ff765f'
);
const fontFamily = computed(
  () =>
    selectedFontFamily.value ||
    // 默认字体：马善政毛笔楷书（未自定义时生效，见 STYLE_SPECIFIC_DEFAULTS.smoke）
    "'ZephyrusMaShanZheng', 'KaiTi', 'STKaiti', 'Noto Serif SC', serif"
);
function close() {
  useMobilePlayerTransition().close(0, () => {
    isVisible.value = false;
    playerStore.setMusicFull(false);
  });
}
function openPlaylist() {
  // 歌词页内：就地切换为队列面板；其他分页（封面/评论）：先跳转歌词页再打开
  if (showFullLyrics.value) {
    toggleImmersiveSurface('playlist');
    return;
  }
  if (playerStore.fullCommentsVisible) playerStore.setFullCommentsVisible(false);
  openLyricsAnimated();
  toggleImmersiveSurface('playlist');
}
</script>

<style scoped>
.smoke-mobile-player {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #111;
  color: #fff;
}
.smoke-vignette {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: radial-gradient(circle, transparent 42%, rgba(0, 0, 0, 0.86) 100%);
}
.smoke-climax-glow {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background: radial-gradient(
    ellipse at center,
    transparent 48%,
    color-mix(in srgb, var(--smoke-climax-glow-color, #fff) 12%, transparent) 72%,
    color-mix(in srgb, var(--smoke-climax-glow-color, #fff) 52%, transparent) 100%
  );
  box-shadow: inset 0 0 clamp(42px, 11vw, 120px) clamp(8px, 2.5vw, 28px)
    color-mix(in srgb, var(--smoke-climax-glow-color, #fff) 38%, transparent);
  transition: opacity 240ms ease-out;
}
.smoke-lyrics {
  position: relative;
  z-index: 4;
  width: min(92vw, 920px);
  text-align: center;
}
.smoke-lyrics.force-nowrap {
  width: max-content;
  max-width: none;
}
.smoke-lyric-text {
  font-size: clamp(48px, 12vw, 150px);
  line-height: 0.94;
  transform-origin: center;
  text-wrap: balance;
}
.smoke-lyrics.force-nowrap .smoke-lyric-text {
  white-space: nowrap;
  text-wrap: nowrap;
}
.smoke-translation {
  margin-top: 18px;
  font-size: clamp(14px, 2.8vw, 24px);
  opacity: 0.7;
}
.top-controls {
  position: absolute;
  z-index: 10;
  inset: 0 0 auto;
  display: flex;
  gap: 12px;
  padding: calc(var(--safe-area-inset-top, 0px) + 16px) 20px 0;
}
.spacer {
  flex: 1;
}
.ctrl-btn {
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 50%;
  color: #fff;
  background: rgba(0, 0, 0, 0.2);
}
.lyrics-mask,
.scrolling-lyrics-overlay {
  position: absolute;
  inset: 0;
  z-index: 40;
}
@media (prefers-reduced-motion: reduce) {
  .smoke-climax-glow {
    transition: none;
  }
}
</style>
