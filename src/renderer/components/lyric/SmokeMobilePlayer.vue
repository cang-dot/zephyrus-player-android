<template>
  <teleport to="body">
    <transition name="smoke-fade">
      <div
        v-if="isVisible"
        class="smoke-mobile-player player-style-surface"
        :style="{
          ...styleVars,
          '--smoke-color': saturatedThemeColor,
          '--smoke-opacity': smokeOpacity,
          '--player-style-resolved-font': fontFamily
        }"
        @click="handleTapToggle"
        @touchstart="onSwipeCloseTouchStart"
        @touchend="onSwipeCloseTouchEnd"
      >
        <smoke-background
          :color="saturatedThemeColor"
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
        <climax-interlude-overlay :state="wordPlayback.interludeState.value" />
        <ttml-word-effect-layer
          v-if="!wordPlayback.interludeState.value.active && !showFullLyrics"
          :auxiliary-tokens="wordPlayback.auxiliaryTokens.value"
          :main-token="wordPlayback.currentMainToken.value"
          :show-drop="showWordDrop"
          :center-auxiliary="isCustom && styleCfg.auxiliaryCenterDisplay === true"
        />
        <div
          class="smoke-lyrics"
          v-show="
            !showFullLyrics &&
            !wordPlayback.interludeState.value.active &&
            !showWordDrop &&
            !showStaggered
          "
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
        <transition name="fade"
          ><div v-if="showFullLyrics" class="lyrics-mask" @click="showFullLyrics = false"></div
        ></transition>
        <transition name="fade"
          ><mobile-scrolling-lyrics
            v-if="showFullLyrics"
            class="scrolling-lyrics-overlay"
            @close="showFullLyrics = false"
            @interact="showControls"
            @generatePoster="handleGeneratePoster"
        /></transition>
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
          @close="showFullLyrics = false"
          @showPlaylist="openPlaylist"
          @interact="showControls"
        />
      </div>
    </transition>
  </teleport>
  <mobile-player-settings v-model:visible="showPlayerSettings" />
  <poster-share-modal v-model:visible="showPosterModal" :lyrics="selectedLyrics" />
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';

import ClimaxInterludeOverlay from '@/components/lyric/ClimaxInterludeOverlay.vue';
import MobileControlsArea from '@/components/lyric/MobileControlsArea.vue';
import MobileScrollingLyrics from '@/components/lyric/MobileScrollingLyrics.vue';
import SmokeBackground from '@/components/lyric/SmokeBackground.vue';
import StaggeredClimaxLyrics from '@/components/lyric/StaggeredClimaxLyrics.vue';
import TtmlWordEffectLayer from '@/components/lyric/TtmlWordEffectLayer.vue';
import MobilePlayerSettings from '@/components/player/MobilePlayerSettings.vue';
import PosterShareModal from '@/components/share/PosterShareModal.vue';
import { usePlayerStyleAppearance } from '@/composables/usePlayerStyleAppearance';
import { usePosterShare } from '@/composables/usePosterShare';
import { useSwipeClose } from '@/composables/useSwipeClose';
import { useTapToggle } from '@/composables/useTapToggle';
import { useWordTimedPlayback } from '@/composables/useWordTimedPlayback';
import { usePlayerStore } from '@/store/modules/player';
import { useStyleEngineStore } from '@/store/modules/styleEngine';

const props = defineProps({ modelValue: { type: Boolean, default: false } });
const emit = defineEmits(['update:modelValue']);
const playerStore = usePlayerStore();
const styleEngine = useStyleEngineStore();
const { controlsVisible, handleTapToggle, showControls } = useTapToggle({
  onDoubleClick: () => (showFullLyrics.value = true)
});
const showFullLyrics = ref(false);
const { onTouchStart: onSwipeCloseTouchStart, onTouchEnd: onSwipeCloseTouchEnd } = useSwipeClose({
  shouldClose: () => !showFullLyrics.value,
  onClose: () => close()
});
const { showPosterModal, selectedLyrics, handleGeneratePoster } = usePosterShare();
const {
  config: styleCfg,
  effects,
  styleVars,
  isCustom,
  selectedFontFamily,
  saturatedThemeColor
} = usePlayerStyleAppearance('smoke');
const wordPlayback = useWordTimedPlayback();
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
});
onUnmounted(() => window.removeEventListener('music-full-config-updated', loadConfig));
const showWordDrop = computed(
  () =>
    !showFullLyrics.value &&
    !wordPlayback.interludeState.value.active &&
    styleEngine.isInClimax &&
    effects.value.wordDrop &&
    wordPlayback.available.value
);
const showStaggered = computed(
  () =>
    !showFullLyrics.value &&
    !wordPlayback.interludeState.value.active &&
    !showWordDrop.value &&
    styleEngine.isInClimax &&
    effects.value.staggered &&
    Boolean(wordPlayback.currentDisplayLine.value?.words?.length)
);
const smokeDensity = computed(() =>
  Math.min(1, Number(styleCfg.value.smokeDensity || 0.58) + styleEngine.energyLevel * 0.2)
);
const smokeChaos = computed(() =>
  Math.min(1, Number(styleCfg.value.smokeChaos || 0.42) + styleEngine.beatFlux * 0.4)
);
const smokeLoudness = computed(() =>
  Math.min(
    1,
    styleEngine.energyLevel * Number(styleCfg.value.smokeLoudnessResponse || 0.72) +
      styleEngine.kickEnergy * 0.3
  )
);
const smokeOpacity = computed(() => Number(styleCfg.value.smokeOpacity || 0.76));
const smokeVignette = computed(() => Number(styleCfg.value.smokeVignette || 0.48));
const fontFamily = computed(
  () => selectedFontFamily.value || "'KaiTi', 'STKaiti', 'Noto Serif SC', serif"
);
function close() {
  isVisible.value = false;
}
function openPlaylist() {
  playerStore.setPlayListDrawerVisible(true);
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
.smoke-lyrics {
  position: relative;
  z-index: 4;
  width: min(92vw, 920px);
  text-align: center;
}
.smoke-lyric-text {
  font-size: clamp(48px, 12vw, 150px);
  line-height: 0.94;
  transform-origin: center;
  text-wrap: balance;
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
</style>
