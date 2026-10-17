<template>
  <teleport to="body">
    <transition name="neon-fade">
      <div
        v-if="isVisible"
        class="neon-mobile-player player-style-surface"
        :class="{
          'player-style-customized': isCustom,
          'player-style-custom-font': customFontActive,
          'player-style-custom-background': customBackgroundActive
        }"
        :style="{
          ...styleVars,
          '--neon-color': neonColor,
          '--neon-bright': neonBright,
          '--neon-dim': neonDim,
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
        <div class="concrete-bg"></div>
        <div class="aged-overlay"></div>
        <div class="ambient-glow" :style="{ opacity: beatGlowOpacity }"></div>

        <div
          class="lyrics-layer"
          v-show="!showFullLyrics || lyricsSwipePreview"
          :style="lyricsUnderlayStyle"
        >
          <div
            class="neon-lyrics"
            :class="{ 'force-nowrap': isCustom && styleCfg.forceNoWrap === true }"
            :style="{ fontSize: lyricFontSize, fontFamily: selectedFontFamily || undefined }"
          >
            <template v-for="(char, i) in currentChars" :key="i">
              <span v-if="char === ' '" class="neon-space">&nbsp;</span>
              <neon-stroke-char
                v-else
                :char="char"
                :color="neonColor"
                :beatSpike="beatSpike"
                :style="{ fontSize: '1em', animationDelay: i * 0.1 + 's' }"
              />
            </template>
          </div>
          <div
            v-if="!hasAnyStrokes && currentText"
            class="fallback-lyrics"
            :class="{ 'force-nowrap': isCustom && styleCfg.forceNoWrap === true }"
            :style="{ color: neonBright }"
          >
            {{ currentText }}
          </div>
        </div>

        <!-- 顶部控件（tap 弹出） -->
        <transition name="ctrl-fade">
          <div v-show="controlsVisible" class="top-controls no-toggle">
            <div class="ctrl-btn" @click="close"><i class="ri-arrow-down-s-line"></i></div>
            <div style="flex: 1"></div>
            <div class="ctrl-btn" @click="showPlayerSettings = true">
              <i class="ri-more-2-fill"></i>
            </div>
          </div>
        </transition>

        <!-- 半透明遮罩 + 滚动歌词（点击歌词时显示） -->
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

        <!-- 底部控件（3秒自动隐藏） -->
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

  <!-- 播放设置弹窗 -->
  <mobile-player-settings v-model:visible="showPlayerSettings" />

  <!-- 歌词海报分享弹窗 -->
  <poster-share-modal
    v-model:visible="showPosterModal"
    :lyrics="selectedLyrics"
    :subject="posterSubject"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import MobileCommentsOverlay from '@/components/comment/MobileCommentsOverlay.vue';
import LyricImmersiveHeader from '@/components/lyric/LyricImmersiveHeader.vue';
import MobileControlsArea from '@/components/lyric/MobileControlsArea.vue';
import MobileScrollingLyrics from '@/components/lyric/MobileScrollingLyrics.vue';
import MobilePlayerSettings from '@/components/player/MobilePlayerSettings.vue';
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
import { lrcArray, nowIndex, playMusic } from '@/hooks/MusicHook';
import { useCoverColor } from '@/hooks/useCoverColor';
import { getStrokes, loadDictionary } from '@/lib/hanziStrokes';
import { drumDetector } from '@/services/drumDetector';
import { usePlayerStore } from '@/store/modules/player';
import { useStyleEngineStore } from '@/store/modules/styleEngine';
import { setCurrentSongId } from '@/utils/emotionalDetector';

import NeonStrokeChar from './NeonStrokeChar.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  background: { type: String, default: '' },
  overlayMode: { type: Boolean, default: false }
});
const emit = defineEmits(['update:modelValue']);

const playerStore = usePlayerStore();
const styleEngine = useStyleEngineStore();
const { primaryColor } = useCoverColor();
const { controlsVisible, handleTapToggle, showControls } = useTapToggle({
  onDoubleClick: () => {
    openLyricsAnimated();
  }
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

// 海报分享
const { showPosterModal, selectedLyrics, posterSubject, handleGeneratePoster } = usePosterShare();
const {
  config: styleCfg,
  styleVars,
  isCustom,
  customBackgroundActive,
  climaxColors,
  selectedFontFamily,
  customFontActive
} = usePlayerStyleAppearance('neon');

// 播放设置弹窗（使用 store 状态，支持返回手势关闭）
const showPlayerSettings = computed({
  get: () => playerStore.playerSettingsVisible,
  set: (val) => playerStore.setPlayerSettingsVisible(val)
});

const isVisible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
});

const neonColor = computed(() =>
  isCustom.value ? climaxColors.value.main : primaryColor.value || '#c9a96e'
);
const neonBright = computed(() => {
  if (isCustom.value) return climaxColors.value.main;
  const rgb = neonColor.value.match(/\d+/g);
  if (!rgb) return '#e8d5a8';
  return `rgb(${Math.min(255, Number(rgb[0]) + 50)}, ${Math.min(255, Number(rgb[1]) + 50)}, ${Math.min(255, Number(rgb[2]) + 50)})`;
});
const neonDim = computed(() => {
  if (isCustom.value) return climaxColors.value.auxiliary;
  const rgb = neonColor.value.match(/\d+/g);
  if (!rgb) return '#5c4a2e';
  return `rgb(${Math.round(Number(rgb[0]) * 0.4)}, ${Math.round(Number(rgb[1]) * 0.4)}, ${Math.round(Number(rgb[2]) * 0.4)})`;
});

const beatSpike = ref(0);
let spikeTimer: ReturnType<typeof setTimeout> | null = null;
let beatUnsubscribe: (() => void) | null = null;
const SPIKE_DURATION = 120;

function subscribeDrumDetector() {
  if (beatUnsubscribe) return;
  beatUnsubscribe = drumDetector.onBeat((info) => {
    const spikeAmount = info.isStrong ? 0.6 : 0.35;
    beatSpike.value = spikeAmount * (0.5 + info.kickEnergy * 0.5);
    if (spikeTimer) clearTimeout(spikeTimer);
    spikeTimer = setTimeout(() => {
      beatSpike.value = 0;
    }, SPIKE_DURATION);
  });
}

const beatGlowOpacity = computed(() => 0.15 + beatSpike.value * 0.25);

const currentText = computed(() => {
  const idx = nowIndex.value;
  if (idx < 0 || idx >= lrcArray.value.length) return '';
  return lrcArray.value[idx]?.text || '';
});
const currentChars = computed(() => Array.from(currentText.value || ''));
const lyricFontSize = computed(() => 'clamp(32px, 10vw, 64px)');

const hasAnyStrokes = ref(false);
async function checkStrokes() {
  await loadDictionary();
  for (const char of currentChars.value) {
    if (/[\u4e00-\u9fff]/.test(char)) {
      const s = getStrokes(char);
      if (s && s.length > 0) {
        hasAnyStrokes.value = true;
        return;
      }
    }
  }
  hasAnyStrokes.value = false;
}
watch(currentText, () => checkStrokes());
// 切歌时重新加载高潮数据 + 同步情感词检测器
watch(
  () => playerStore.currentSong?.id,
  (songId) => {
    if (songId) {
      setCurrentSongId(String(songId));
    }
  },
  { immediate: true }
);

onMounted(() => {
  checkStrokes();
  styleEngine.syncFromPlayerStore();
  styleEngine.syncCoverColors();
  subscribeDrumDetector();
});

onUnmounted(() => {
  if (beatUnsubscribe) {
    beatUnsubscribe();
    beatUnsubscribe = null;
  }
  if (spikeTimer) {
    clearTimeout(spikeTimer);
    spikeTimer = null;
  }
});

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

<style lang="scss" scoped>
.neon-mobile-player {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #1a1814;
}
.concrete-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  background-color: #2a2620;
  background-image:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='512' height='512'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='5' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.22 0 0 0 0 0.20 0 0 0 0 0.16 0 0 0 0.7 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"),
    radial-gradient(circle at 20% 50%, rgba(201, 169, 110, 0.03) 0%, transparent 50%),
    radial-gradient(circle at 80% 50%, rgba(180, 150, 100, 0.02) 0%, transparent 50%);
  background-size:
    512px 512px,
    cover,
    cover;
  background-repeat: repeat, no-repeat, no-repeat;
  filter: brightness(0.5) contrast(1.1) sepia(0.3);
}
.aged-overlay {
  position: absolute;
  inset: 0;
  z-index: 0;
  background:
    radial-gradient(ellipse at 30% 40%, rgba(201, 169, 110, 0.08) 0%, transparent 60%),
    radial-gradient(ellipse at 70% 60%, rgba(180, 140, 80, 0.06) 0%, transparent 50%),
    linear-gradient(135deg, rgba(80, 60, 30, 0.12) 0%, transparent 40%, rgba(60, 40, 20, 0.08) 100%);
  pointer-events: none;
}
.ambient-glow {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: radial-gradient(
    ellipse at center,
    transparent 35%,
    var(--neon-dim) 80%,
    var(--neon-color) 100%
  );
  opacity: 0.15;
  mix-blend-mode: multiply;
  transition: opacity 0.1s var(--m-ease-out, ease-out);
  pointer-events: none;
}
.lyrics-layer {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 20px;
}
.neon-lyrics {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.05em;
  line-height: 1.2;
}
.neon-lyrics.force-nowrap {
  width: max-content;
  max-width: none;
  flex-wrap: nowrap;
  white-space: nowrap;
}
.neon-space {
  display: inline-block;
  width: 0.3em;
}
.fallback-lyrics {
  font-family: 'Noto Serif SC', serif;
  font-weight: 600;
  font-size: clamp(24px, 6vw, 40px);
  text-shadow:
    0 0 3px currentColor,
    0 0 8px var(--neon-dim);
  text-align: center;
  letter-spacing: 0.05em;
}
.fallback-lyrics.force-nowrap {
  width: max-content;
  max-width: none;
  white-space: nowrap;
}

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
    @apply flex items-center justify-center w-10 h-10 rounded-full text-xl;
    color: #f0ece4;
    background: rgba(255, 255, 255, 0.08);
    cursor: pointer;
    transition: transform var(--m-duration-press, 160ms) var(--m-ease-out, ease-out);
    &:active {
      transform: scale(0.97);
    }
  }
}
.bottom-controls {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0 24px calc(var(--safe-area-inset-bottom, 0px) + 32px);
  z-index: 10;
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
      background: var(--neon-color);
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
    @apply flex items-center justify-center rounded-full cursor-pointer;
    background: #333;
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
      background: var(--neon-color);
      i {
        font-size: 24px;
        color: #0a0a0a;
      }
    }
  }
}

.neon-fade-enter-active,
.neon-fade-leave-active {
  transition: opacity 0.3s var(--m-ease-out, ease);
}
.neon-fade-enter-from,
.neon-fade-leave-to {
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
  .ambient-glow {
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
