<template>
  <teleport to="body">
    <transition name="error-mobile-fade">
      <div
        v-if="isVisible"
        class="error-mobile-player player-style-surface"
        :class="{
          'player-style-customized': isCustom,
          'player-style-custom-font': customFontActive,
          'player-style-custom-background': customBackgroundActive
        }"
        :style="{
          ...styleVars,
          ...lyricsSwipeStyle,
          '--error-glow-color': saturatedThemeColor || '#ffffff',
          '--error-rgb-split': `${rgbSplitPx}px`,
          '--player-style-resolved-font': errorFontFamily,
          background: backgroundColor
        }"
        @click="handleTapToggle"
        @pointerdown.capture="onLyricsSwipePointerDown"
        @pointermove.capture="onLyricsSwipePointerMove"
        @pointerup.capture="onLyricsSwipePointerUp"
        @pointercancel.capture="onLyricsSwipePointerCancel"
        @touchstart="onSwipeCloseTouchStart"
        @touchend="onSwipeCloseTouchEnd"
      >
        <!-- 高速流体背景（黑底 + 高饱和主题色纹理）；减弱动画时静止 -->
        <div class="error-fluid-layer no-toggle">
          <liquid-ether
            :colors="fluidColors"
            :mouse-force="fluidMouseForce"
            :cursor-size="110"
            :auto-demo="true"
            :auto-speed="1"
            :auto-intensity="fluidAutoIntensity"
            :auto-resume-delay="400"
            :auto-ramp-duration="0.5"
            :resolution="0.4"
            :dt="0.012"
            :iterations-poisson="16"
            :bfecc="false"
            :max-pixel-ratio="1.5"
            :max-fps="30"
            :paused="reduceMotion"
          />
        </div>

        <!-- CRT 扫描线（纯亮度调制，不偏色） -->
        <div v-if="effects.crt" class="error-scanlines"></div>

        <!-- 抽帧式白色噪点 -->
        <canvas ref="noiseCanvasRef" class="error-noise" aria-hidden="true"></canvas>

        <!-- 烟雾式高潮边缘光 -->
        <div v-if="edgeGlowEnabled" class="error-edge-glow" :class="{ active: styleEngine.isInClimax }"></div>

        <!-- 高潮超大错误：整帧暖纸白负片闪 -->
        <div class="error-flash" :style="flashStyle"></div>

        <!-- 高潮超大错误：水平撕裂 + 边缘故障块（《一家之主》式） -->
        <div v-if="tearBars.length" class="error-tear" aria-hidden="true">
          <div
            v-for="(bar, i) in tearBars"
            :key="`tb-${i}`"
            class="tear-bar"
            :style="{
              top: bar.top,
              left: bar.left,
              width: bar.width,
              height: bar.height,
              background: bar.color,
              opacity: bar.opacity
            }"
          ></div>
        </div>
        <div
          v-for="(block, i) in blockRects"
          :key="`gb-${i}`"
          class="glitch-block"
          :style="{
            top: block.top,
            bottom: block.bottom,
            left: block.left,
            width: block.width,
            height: block.height,
            background: block.bg
          }"
          aria-hidden="true"
        ></div>

        <ttml-word-effect-layer
          v-if="lyricsUnderlayVisible && !wordPlayback.interludeState.value.active"
          :auxiliary-tokens="wordPlayback.auxiliaryTokens.value"
          :main-token="wordPlayback.currentMainToken.value"
          :show-drop="false"
          :climax-shake="false"
          :center-auxiliary="isCustom && styleCfg.auxiliaryCenterDisplay === true"
        />

        <climax-interlude-overlay :state="wordPlayback.interludeState.value" />

        <!-- 大字歌词（溶解入场出场 + 抽帧轻微抖动）；间奏或滚动歌词打开时隐藏 -->
        <div
          v-show="lyricsUnderlayVisible && !wordPlayback.interludeState.value.active"
          class="error-lyric-stage"
          :style="lyricsUnderlayStyle"
        >
          <div class="error-lyric-jitter" :style="jitterStyle">
            <div
              v-if="prevLineText"
              ref="prevLineRef"
              class="error-line error-line-prev"
              :style="{ fontFamily: errorFontFamily }"
            >
              {{ decoratedText(prevLineText) }}
            </div>
            <div
              ref="currLineRef"
              class="error-line error-line-main"
              :class="{
                'force-nowrap': isCustom && styleCfg.forceNoWrap === true,
                negative: negativeLine
              }"
              :style="{ color: mainLyricColor, fontFamily: errorFontFamily }"
            >
              {{ decoratedText(currentLyricText) }}
            </div>
          </div>
        </div>

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

        <!-- 底部控件（自动隐藏时下移贴底） -->
        <mobile-controls-area
          :visible="controlsVisible"
          :is-fullscreen="showFullLyrics"
          @close="closeLyricsAnimated"
          @showPlaylist="openPlaylist"
          @show-settings="showPlayerSettings = true"
          @interact="showControls"
        />

        <photosensitivity-warning
          v-model:visible="warningVisible"
          @confirm="warningVisible = false"
          @decline="handleWarningDecline"
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
 * ErrorMobilePlayer — “错误”样式播放器
 *
 * 视觉：黑底高速流体（高饱和主题色纹理）+ CRT 扫描线 + 抽帧白色噪点 + 高潮错误闪烁
 * 歌词：大字单行白色，高潮切主题色；溶解式入场出场 + 抽帧轻微抖动
 */
import gsap from 'gsap';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

import ClimaxInterludeOverlay from '@/components/lyric/ClimaxInterludeOverlay.vue';
import LiquidEther from '@/components/lyric/LiquidEther.vue';
import MobileControlsArea from '@/components/lyric/MobileControlsArea.vue';
import MobileScrollingLyrics from '@/components/lyric/MobileScrollingLyrics.vue';
import PhotosensitivityWarning from '@/components/lyric/PhotosensitivityWarning.vue';
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
import { usePlayerStore } from '@/store/modules/player';
import { useStyleEngineStore } from '@/store/modules/styleEngine';
import { acquirePlayerResource } from '@/utils/playerResourceDiagnostics';
import { ensureFontLoaded } from '@/utils/fontLoader';

const PHOTOSENSITIVITY_ACK_KEY = 'photosensitivity-warning-acked';

/** 系统减弱动画（WebView 将系统"移除动画"映射到此查询），全样式特效据此降级 */
const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const reduceMotion = ref(reduceMotionQuery.matches);
const handleReduceMotionChange = (event: MediaQueryListEvent) => {
  reduceMotion.value = event.matches;
};
reduceMotionQuery.addEventListener('change', handleReduceMotionChange);

/** 样式默认字体：思源宋体（可变字重 200-900），自定义面板中选择其他字体会覆盖 */
const ERROR_DEFAULT_FONT_FAMILY = "'ZephyrusNotoSerifSC', 'Noto Serif SC', serif";

function writePlayerStyleConfig(styleKey: string): void {
  try {
    const raw = localStorage.getItem('music-full-config');
    const cfg = raw ? JSON.parse(raw) : {};
    cfg.playerStyle = styleKey;
    localStorage.setItem('music-full-config', JSON.stringify(cfg));
    window.dispatchEvent(new Event('music-full-config-updated'));
  } catch {
    // 配置损坏时保持现状
  }
}

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

const { showPosterModal, selectedLyrics, handleGeneratePoster } = usePosterShare();
const {
  config: styleCfg,
  effects,
  styleVars,
  isCustom,
  customBackgroundActive,
  backgroundColor,
  selectedFontFamily,
  customFontActive,
  saturatedThemeColor
} = usePlayerStyleAppearance('error');
const wordPlayback = useWordTimedPlayback();
const lyricsUnderlayVisible = computed(() => !showFullLyrics.value || lyricsSwipePreview.value);

watch(
  () => playerStore.fullLyricsVisible,
  (visible) => {
    if (!visible && showFullLyrics.value) closeLyricsAnimated();
  }
);

onMounted(() => {
  styleEngine.syncFromPlayerStore();
  styleEngine.syncCoverColors();
  void ensureFontLoaded('noto-serif-sc');
});

// ==================== 显隐与关闭 ====================

const isVisible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
});

const showPlayerSettings = computed({
  get: () => playerStore.playerSettingsVisible,
  set: (val) => playerStore.setPlayerSettingsVisible(val)
});

function close() {
  useMobilePlayerTransition().close(0, () => {
    isVisible.value = false;
    playerStore.setMusicFull(false);
  });
}

function openPlaylist() {
  playerStore.setPlayListDrawerVisible(true);
}

// ==================== 光敏性癫痫警告 ====================

const warningVisible = ref(false);

onMounted(() => {
  if (!localStorage.getItem(PHOTOSENSITIVITY_ACK_KEY)) warningVisible.value = true;
});

function handleWarningDecline() {
  warningVisible.value = false;
  writePlayerStyleConfig('default');
}

// ==================== 流体背景 ====================

const fluidPulse = ref(0);

const fluidColors = computed(() => ['#000000', saturatedThemeColor.value || '#ff2a2a', '#ffffff']);

const fluidPower = computed(() => {
  const configured = Number(styleCfg.value.errorFluidPower);
  return Number.isFinite(configured) && configured > 0 ? configured : 1;
});

const fluidMouseForce = computed(() => {
  const climaxBoost = styleEngine.isInClimax ? 14 : 0;
  return Math.round((18 + climaxBoost + fluidPulse.value * 22) * fluidPower.value);
});

const fluidAutoIntensity = computed(() => {
  const climaxBoost = styleEngine.isInClimax ? 1.4 : 0;
  return (3.2 + climaxBoost) * fluidPower.value;
});

// ==================== 鼓点（驱动抖动与流体脉冲） ====================

const beatSpike = ref(0);
let spikeTimer: ReturnType<typeof setTimeout> | null = null;
let drumUnsubscribe: (() => void) | null = null;
let releaseTimerResource: (() => void) | null = null;

onMounted(async () => {
  const { drumDetector } = await import('@/services/drumDetector');
  drumUnsubscribe = drumDetector.onBeat((info) => {
    const spikeAmount = info.isStrong ? 0.5 : 0.28;
    beatSpike.value = spikeAmount * (0.6 + info.kickEnergy * 0.4);
    // 强拍对齐：高潮段内的强拍立即触发一次超大错误，让爆点压在节奏上
    if (info.isStrong && styleEngine.isInClimax) triggerMegaGlitch(0.85);
    if (spikeTimer) clearTimeout(spikeTimer);
    spikeTimer = setTimeout(() => {
      beatSpike.value = 0;
    }, 120);
  });
});

// ==================== 抽帧轻微抖动 ====================

const jitterOffset = ref({ x: 0, y: 0 });
let jitterTimer: number | null = null;

function jitterTick() {
  const configured = Number(styleCfg.value.errorJitter);
  const base = Number.isFinite(configured) ? Math.min(1, Math.max(0, configured)) : 0.4;
  if (base <= 0.02) {
    jitterOffset.value = { x: 0, y: 0 };
    return;
  }
  const climaxMul = styleEngine.isInClimax ? 2.2 : 1;
  const amp = base * 2.2 * climaxMul + beatSpike.value * 1.2;
  jitterOffset.value = {
    x: (Math.random() * 2 - 1) * amp,
    y: (Math.random() * 2 - 1) * amp
  };
}

const jitterStyle = computed(() => ({
  transform: `translate3d(${jitterOffset.value.x.toFixed(2)}px, ${jitterOffset.value.y.toFixed(2)}px, 0)`
}));

// ==================== 白色噪点（抽帧跳变） ====================

const noiseCanvasRef = ref<HTMLCanvasElement | null>(null);
let noiseTimer: number | null = null;

function paintNoise() {
  const canvas = noiseCanvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const configured = Number(styleCfg.value.errorNoise);
  const intensity = Number.isFinite(configured) ? Math.min(1, Math.max(0, configured)) : 0.5;
  const { width, height } = canvas;
  if (!width || !height) return;
  ctx.clearRect(0, 0, width, height);
  if (intensity <= 0.02) return;
  // 老电视雪花：细小（1px 为主）、稀疏、逐次刷新随机闪烁的白色颗粒，
  // 是蒙在整幅画面上的辅助层，而不是铺满的背景
  const count = Math.round(((width * height) / 9000) * (0.4 + intensity * 1.6));
  for (let i = 0; i < count; i++) {
    const size = Math.random() < 0.82 ? 1 : 2;
    ctx.fillStyle = `rgba(255, 255, 255, ${(0.12 + Math.random() * 0.55).toFixed(2)})`;
    ctx.fillRect(Math.random() * width, Math.random() * height, size, size);
  }
}

function resizeNoiseCanvas() {
  const canvas = noiseCanvasRef.value;
  if (!canvas) return;
  // 用 CSS 像素分辨率：颗粒保持细小，不放大成像素方块
  canvas.width = Math.max(2, window.innerWidth);
  canvas.height = Math.max(2, window.innerHeight);
  paintNoise();
}

// ==================== 高潮超大错误爆发（《一家之主》式） ====================

const flashOpacity = ref(0);
const flashColor = ref('#e6e3dc');
const negativeLine = ref(false);
const rgbSplitPx = ref(1.5);
interface TearBar {
  top: string;
  left: string;
  width: string;
  height: string;
  color: string;
  opacity: string;
}
interface GlitchBlock {
  top: string;
  bottom: string;
  left: string;
  width: string;
  height: string;
  bg: string;
}
const tearBars = ref<TearBar[]>([]);
const blockRects = ref<GlitchBlock[]>([]);
let glitchTimer: ReturnType<typeof setTimeout> | null = null;
let glitchResetTimer: ReturnType<typeof setTimeout> | null = null;
let lastMegaAt = 0;

const TEAR_COLORS = ['#3ec8b8', '#ff5a5a', '#f2efe9', '#9d8cff'];

function clearGlitchTimers() {
  if (glitchTimer) clearTimeout(glitchTimer);
  if (glitchResetTimer) clearTimeout(glitchResetTimer);
  glitchTimer = null;
  glitchResetTimer = null;
}

function resetMegaState() {
  flashOpacity.value = 0;
  negativeLine.value = false;
  rgbSplitPx.value = 1.5;
  tearBars.value = [];
  blockRects.value = [];
}

function showTearAndBlocks(strength: number) {
  const bars: TearBar[] = [];
  const barCount = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < barCount; i++) {
    bars.push({
      top: `${(8 + Math.random() * 82).toFixed(1)}%`,
      left: `${(Math.random() * 36 - 18).toFixed(1)}%`,
      width: `${(45 + Math.random() * 60).toFixed(0)}%`,
      height: `${2 + Math.floor(Math.random() * 5)}px`,
      color: TEAR_COLORS[Math.floor(Math.random() * TEAR_COLORS.length)],
      opacity: (0.28 + Math.random() * 0.5 * (0.5 + strength)).toFixed(2)
    });
  }
  tearBars.value = bars;

  const blocks: GlitchBlock[] = [];
  const blockCount = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < blockCount; i++) {
    const fromTop = Math.random() < 0.5;
    blocks.push({
      top: fromTop ? `${(Math.random() * 12).toFixed(1)}%` : 'auto',
      bottom: fromTop ? 'auto' : `${(Math.random() * 12).toFixed(1)}%`,
      left: `${(Math.random() * 70).toFixed(1)}%`,
      width: `${(12 + Math.random() * 22).toFixed(0)}vw`,
      height: `${8 + Math.random() * 20}px`,
      bg: Math.random() < 0.5 ? '#1d1d1f' : '#f2efe9'
    });
  }
  blockRects.value = blocks;
}

/**
 * 一次「超大错误」爆发：暖纸白负片闪 + 歌词转青 + 大幅 RGB 色散
 * + 水平撕裂 + 边缘故障块，约 120-270ms 后复位。
 */
function triggerMegaGlitch(scale = 1) {
  if (reduceMotion.value) return;
  const configured = Number(styleCfg.value.errorFlash);
  const strength = Number.isFinite(configured) ? Math.min(1, Math.max(0, configured)) : 0.6;
  if (strength <= 0.02) return;
  const now = performance.now();
  if (now - lastMegaAt < 220) return;
  lastMegaAt = now;

  flashColor.value = '#e6e3dc';
  flashOpacity.value = Math.min(1, (0.5 + Math.random() * 0.3) * (0.45 + strength) * scale);
  negativeLine.value = true;
  rgbSplitPx.value = 6 + Math.random() * 4;
  fluidPulse.value = 0.5 + strength * 0.5;
  showTearAndBlocks(strength);

  if (glitchResetTimer) clearTimeout(glitchResetTimer);
  glitchResetTimer = setTimeout(() => {
    resetMegaState();
    fluidPulse.value = 0;
  }, 120 + Math.random() * 150);
}

function scheduleMega() {
  if (!styleEngine.isInClimax) return;
  triggerMegaGlitch(1);
  glitchTimer = setTimeout(scheduleMega, 420 + Math.random() * 520);
}

watch(
  () => styleEngine.isInClimax,
  (inClimax, was) => {
    if (inClimax === was) return;
    clearGlitchTimers();
    if (inClimax) {
      triggerMegaGlitch(1.25);
      glitchTimer = setTimeout(scheduleMega, 380);
    } else {
      resetMegaState();
      fluidPulse.value = 0;
    }
  }
);

const flashStyle = computed(() => ({
  opacity: String(flashOpacity.value),
  background: flashColor.value
}));

// ==================== 大字歌词（溶解 + 抽帧抖动） ====================

const prevLineText = ref('');
const prevLineRef = ref<HTMLElement | null>(null);
const currLineRef = ref<HTMLElement | null>(null);
const lastLineText = ref('');
let lyricCycleId = 0;
let enterTimeline: gsap.core.Timeline | null = null;
let exitTimeline: gsap.core.Timeline | null = null;

const currentLyricText = computed(() => wordPlayback.currentDisplayLine.value?.text || '');

const decoratedText = (text: string) => {
  if (!text) return '';
  return isCustom.value && styleCfg.value.errorDecorMarks === true ? `!${text}!` : text;
};

const mainLyricColor = computed(() => {
  if (isCustom.value) {
    if (styleEngine.isInClimax && effects.value.lyricColor) return saturatedThemeColor.value;
    return styleCfg.value.lyricColor || '#ffffff';
  }
  if (styleEngine.isInClimax && effects.value.lyricColor) return saturatedThemeColor.value;
  return '#ffffff';
});

const errorFontFamily = computed(
  () => selectedFontFamily.value || ERROR_DEFAULT_FONT_FAMILY
);

watch(
  () => wordPlayback.displayLineKey.value,
  () => {
    const nextText = currentLyricText.value;
    if (nextText === lastLineText.value) return;
    const oldText = lastLineText.value;
    lastLineText.value = nextText;
    lyricCycleId += 1;
    const cycle = lyricCycleId;
    enterTimeline?.kill();
    exitTimeline?.kill();
    if (reduceMotion.value || !nextText) {
      prevLineText.value = '';
      if (currLineRef.value) {
        currLineRef.value.style.opacity = nextText ? '1' : '0';
        currLineRef.value.style.filter = 'none';
        currLineRef.value.style.transform = 'none';
      }
      return;
    }
    prevLineText.value = oldText;
    nextTick(() => {
      if (cycle !== lyricCycleId || !currLineRef.value) return;
      if (prevLineText.value && prevLineRef.value) {
        exitTimeline = gsap.timeline({
          onComplete: () => {
            if (cycle === lyricCycleId) prevLineText.value = '';
          }
        });
        exitTimeline.to(prevLineRef.value, {
          opacity: 0,
          filter: 'blur(8px)',
          y: -10,
          duration: 0.4,
          ease: 'power1.in'
        });
      }
      enterTimeline = gsap.timeline();
      enterTimeline.fromTo(
        currLineRef.value,
        { opacity: 0, filter: 'blur(7px)', y: 10 },
        { opacity: 1, filter: 'blur(0px)', y: 0, duration: 0.42, ease: 'power2.out' }
      );
    });
  }
);

// ==================== 边缘光 ====================

const edgeGlowEnabled = computed(() => styleCfg.value.errorEdgeGlow !== false);

// ==================== 生命周期 ====================

function startIdleTimers() {
  if (!jitterTimer) jitterTimer = window.setInterval(jitterTick, 90);
  if (!noiseTimer) noiseTimer = window.setInterval(paintNoise, 100);
}

function stopIdleTimers() {
  if (jitterTimer) {
    window.clearInterval(jitterTimer);
    jitterTimer = null;
  }
  if (noiseTimer) {
    window.clearInterval(noiseTimer);
    noiseTimer = null;
  }
  jitterOffset.value = { x: 0, y: 0 };
}

onMounted(() => {
  releaseTimerResource = acquirePlayerResource('timer');
  resizeNoiseCanvas();
  window.addEventListener('resize', resizeNoiseCanvas);
  if (!reduceMotion.value) startIdleTimers();
});

// 减弱动画：停掉抖动与噪点刷新（流体由 paused prop 停止，爆发调度有统一守卫）
watch(reduceMotion, (reduced) => {
  if (reduced) {
    stopIdleTimers();
    resetMegaState();
    clearGlitchTimers();
  } else {
    startIdleTimers();
    if (styleEngine.isInClimax) glitchTimer = setTimeout(scheduleMega, 380);
  }
});

onUnmounted(() => {
  stopIdleTimers();
  window.removeEventListener('resize', resizeNoiseCanvas);
  reduceMotionQuery.removeEventListener('change', handleReduceMotionChange);
  clearGlitchTimers();
  if (spikeTimer) clearTimeout(spikeTimer);
  drumUnsubscribe?.();
  releaseTimerResource?.();
  releaseTimerResource = null;
  enterTimeline?.kill();
  exitTimeline?.kill();
});
</script>

<style lang="scss" scoped>
.error-mobile-player {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #000;
}

.error-fluid-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
}

/* 扫描线：普通半透明压暗（不用 mix-blend-mode，避免 WebView 强制混合合成） */
.error-scanlines {
  position: absolute;
  inset: 0;
  z-index: 3;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.18) 0px,
    rgba(0, 0, 0, 0.18) 1px,
    transparent 1px,
    transparent 3px
  );
  pointer-events: none;
}

/* 老电视雪花噪点：细颗粒稀疏白点，叠在歌词之上的辅助层（100ms 抽帧刷新） */
.error-noise {
  position: absolute;
  inset: 0;
  z-index: 12;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

/* 烟雾式边缘光 */
.error-edge-glow {
  position: absolute;
  inset: 0;
  z-index: 6;
  background: radial-gradient(
    circle at 50% 50%,
    transparent 52%,
    color-mix(in srgb, var(--error-glow-color, #fff) 10%, transparent) 76%,
    color-mix(in srgb, var(--error-glow-color, #fff) 48%, transparent) 100%
  );
  box-shadow: inset 0 0 clamp(42px, 11vw, 120px) color-mix(in srgb, var(--error-glow-color, #fff) 34%, transparent);
  opacity: 0;
  transition: opacity 0.6s ease;
  pointer-events: none;

  &.active {
    opacity: 1;
  }
}

.error-flash {
  position: absolute;
  inset: 0;
  z-index: 15;
  opacity: 0;
  transition: opacity 60ms linear;
  pointer-events: none;
}

.error-lyric-stage {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: min(92vw, 640px);
  transform: translate(-50%, -50%);
  will-change: transform;
}

.error-lyric-jitter {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  will-change: transform;
}

.error-line {
  width: 100%;
  font-family: var(--m-font-art, 'Inter', sans-serif);
  font-size: clamp(44px, 11vw, 96px);
  font-weight: 900;
  line-height: 1.04;
  letter-spacing: -0.02em;
  text-align: center;
  text-wrap: balance;
  overflow-wrap: break-word;

  &.force-nowrap {
    white-space: nowrap;
    overflow: visible;
  }

  &.error-line-prev {
    color: rgba(255, 255, 255, 0.26);
  }
}

.error-line-main {
  color: #fff;
  /* 常态小幅 RGB 色散（青左红右），超大错误爆发时 --error-rgb-split 被放大到 6-10px */
  text-shadow:
    calc(-1 * var(--error-rgb-split, 1.5px)) 0 rgba(62, 200, 184, 0.42),
    var(--error-rgb-split, 1.5px) 0 rgba(255, 82, 82, 0.42),
    0 0 16px rgba(255, 255, 255, 0.06);
  will-change: opacity, filter, transform;

  /* 负片帧：白字转青（#3EC8B8 方向），对应《一家之主》glitch 帧的反色观感 */
  &.negative {
    filter: invert(1) hue-rotate(140deg);
  }
}

/* 水平撕裂条与边缘故障块：仅超大错误爆发期间存在（120-270ms） */
.error-tear {
  position: absolute;
  inset: 0;
  z-index: 14;
  overflow: hidden;
  pointer-events: none;
}

.tear-bar {
  position: absolute;
}

.glitch-block {
  position: absolute;
  z-index: 14;
  pointer-events: none;
}

/* 顶部控件 */
.top-controls {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  padding: calc(var(--safe-area-inset-top, 0px) + 16px) 20px 0;

  .ctrl-btn {
    @apply flex items-center justify-center;
    @apply w-10 h-10 rounded-full;
    @apply text-xl;
    color: rgba(255, 255, 255, 0.9);
    background: rgba(255, 255, 255, 0.08);
    cursor: pointer;
    transition: transform var(--m-duration-press, 160ms) var(--m-ease-out, ease-out);

    &:active {
      transform: scale(0.97);
    }
  }
}

/* 半透明遮罩 */
.lyrics-mask {
  position: absolute;
  inset: 0;
  z-index: 8;
  background: rgba(0, 0, 0, 0.55);
  cursor: pointer;
}

.scrolling-lyrics-overlay {
  position: absolute;
  inset: 0;
  z-index: 40;
  color: #fff;
}

.scrolling-lyrics-content {
  width: 100%;
  height: 100%;
}

/* 过渡动画 */
/* 进出场用 CSS animation 而非 transition：根元素内联的歌词手势样式
   带 transition: none，会把类上的 opacity 过渡覆盖成瞬间完成 */
.error-mobile-fade-enter-active {
  animation: error-player-in 0.32s cubic-bezier(0.32, 0.72, 0, 1);
}

.error-mobile-fade-leave-active {
  animation: error-player-out 0.26s ease forwards;
}

@keyframes error-player-in {
  from {
    opacity: 0;
    transform: scale(0.985);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes error-player-out {
  from {
    opacity: 1;
  }

  to {
    opacity: 0;
  }
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
  .error-mobile-fade-enter-active,
  .error-mobile-fade-leave-active {
    animation: none;
  }

  .ctrl-fade-enter-active,
  .ctrl-fade-leave-active {
    transition: opacity 0.2s ease;
  }
}
</style>
