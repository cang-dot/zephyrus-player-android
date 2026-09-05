<template>
  <!-- 大字歌词（行级溶解 + 抽帧抖动；段落头尾（间奏）整体溶解进出。
       滚动歌词开关与间奏覆盖层由基座处理，这里只在间奏时整体隐藏） -->
  <div class="dissolve-lyrics">
    <transition name="error-stage-dissolve">
      <div v-show="!interludeActive" class="error-lyric-stage">
        <div class="error-lyric-underlay">
          <div class="error-lyric-jitter" :style="jitterStyle">
            <div
              v-if="prevLineText"
              ref="prevLineRef"
              class="error-line error-line-prev"
              :style="{ fontFamily: dissolveFontFamily, color: prevLyricColor }"
            >
              {{ decoratedText(prevLineText) }}
            </div>
            <div
              ref="currLineRef"
              class="error-line error-line-main"
              :class="{ 'force-nowrap': forceNoWrap }"
              :style="{ color: mainLyricColor, fontFamily: dissolveFontFamily }"
            >
              {{ decoratedText(currentLyricText) }}
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
/**
 * DissolveLyrics — “错误”样式歌词渲染器
 *
 * 抽取自 ErrorMobilePlayer.vue 的大字歌词段：
 * - 大字单行 clamp(44px, 11vw, 96px) weight 900
 * - gsap 溶解换行时间线（prev 行同位叠放，blur + opacity）
 * - 常态小幅 RGB 色散 text-shadow（青左红右，以主色通道拆分派生）
 * - 装饰符号 !…!（params.errorDecorMarks，默认关闭）
 * - 抽帧抖动 jitter（90ms interval transform，高潮 ×2.2，climaxEffects.jitter 开关）
 *
 * 视觉：流体背景 / CRT 扫描线 / 噪点 / 超大错误爆发（闪光、撕裂、故障块）属
 * 背景与高潮层，由基座处理，不带入本渲染器。
 */
import gsap from 'gsap';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

import tinycolor from 'tinycolor2';

import { useWordTimedPlayback } from '@/composables/useWordTimedPlayback';
import { useStyleEngineStore } from '@/store/modules/styleEngine';
import { ensureFontLoaded } from '@/utils/fontLoader';

// ==================== Props ====================

const props = defineProps({
  lyricColor: { type: String, default: '#f0ece4' }, // 歌词主色
  accentColor: { type: String, default: '#888888' }, // 封面强调色
  fontFamily: { type: String, default: '' }, // 基座解析好的字体
  params: { type: Object, default: () => ({}) }, // 预设参数
  climaxEffects: { type: Object, default: () => ({}) } // 高潮效果开关
});

/** 预设参数（均可缺省） */
interface DissolveParams {
  /** 歌词抽帧抖动强度 0-1（默认 0.4） */
  errorJitter?: number;
  /** 歌词装饰符号（!…!）开关，默认 false */
  errorDecorMarks?: boolean;
  /** 单行不换行 */
  forceNoWrap?: boolean;
}
const params = computed(() => (props.params ?? {}) as DissolveParams);

/** 样式默认字体：思源宋体（可变字重 200-900），基座未传字体时兜底 */
const ERROR_DEFAULT_FONT_FAMILY = "'ZephyrusNotoSerifSC', 'Noto Serif SC', serif";

/** 系统减弱动画（WebView 将系统"移除动画"映射到此查询），歌词特效据此降级 */
const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const reduceMotion = ref(reduceMotionQuery.matches);
const handleReduceMotionChange = (event: MediaQueryListEvent) => {
  reduceMotion.value = event.matches;
};
reduceMotionQuery.addEventListener('change', handleReduceMotionChange);

const styleEngine = useStyleEngineStore();
const wordPlayback = useWordTimedPlayback();

const interludeActive = computed(() => wordPlayback.interludeState.value.active);
const forceNoWrap = computed(() => params.value.forceNoWrap === true);

const currentLyricText = computed(() => wordPlayback.currentDisplayLine.value?.text || '');

// ==================== 鼓点（驱动抖动幅度） ====================

const beatSpike = ref(0);
let spikeTimer: ReturnType<typeof setTimeout> | null = null;
let drumUnsubscribe: (() => void) | null = null;

onMounted(async () => {
  const { drumDetector } = await import('@/services/drumDetector');
  drumUnsubscribe = drumDetector.onBeat((info) => {
    const spikeAmount = info.isStrong ? 0.5 : 0.28;
    beatSpike.value = spikeAmount * (0.6 + info.kickEnergy * 0.4);
    if (spikeTimer) clearTimeout(spikeTimer);
    spikeTimer = setTimeout(() => {
      beatSpike.value = 0;
    }, 120);
  });
});

// ==================== 抽帧轻微抖动 ====================

/** 抖动开关（基座透传的高潮效果开关，缺省开启） */
const jitterEnabled = computed(() => props.climaxEffects?.jitter !== false);

const jitterOffset = ref({ x: 0, y: 0 });
let jitterTimer: number | null = null;

function jitterTick() {
  if (!jitterEnabled.value) {
    jitterOffset.value = { x: 0, y: 0 };
    return;
  }
  const configured = Number(params.value.errorJitter);
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

// ==================== 大字歌词（溶解换行） ====================

const prevLineText = ref('');
const prevLineRef = ref<HTMLElement | null>(null);
const currLineRef = ref<HTMLElement | null>(null);
const lastLineText = ref('');
let lyricCycleId = 0;
let enterTimeline: gsap.core.Timeline | null = null;
let exitTimeline: gsap.core.Timeline | null = null;

const decoratedText = (text: string) => {
  if (!text) return '';
  return params.value.errorDecorMarks === true ? `!${text}!` : text;
};

/** 主色（基座透传，高潮变色由基座负责） */
const mainLyricColor = computed(() => props.lyricColor);

/** 溶解叠放的上一行：主色 26% 不透明度（原版 rgba(255,255,255,0.26) 以主色派生） */
const prevLyricColor = computed(() => {
  const tiny = tinycolor(props.lyricColor);
  return tiny.isValid() ? tiny.setAlpha(0.26).toRgbString() : 'rgba(255, 255, 255, 0.26)';
});

/**
 * 常态 RGB 色散三色：以主色通道拆分派生（保留原配色逻辑，基准改为 props.lyricColor）
 * 主色为白时与原版完全一致：青 rgba(62,200,184,0.42) / 红 rgba(255,82,82,0.42) / 白晕 6%
 */
const lyricRgb = computed(() => {
  const tiny = tinycolor(props.lyricColor);
  return tiny.isValid() ? tiny.toRgb() : { r: 255, g: 255, b: 255 };
});

/** 色散右影（暖）：保留 R 通道，G/B 压暗 */
const splitWarm = computed(() => {
  const { r, g, b } = lyricRgb.value;
  return `rgba(${Math.round(r)}, ${Math.round(g * 0.32)}, ${Math.round(b * 0.32)}, 0.42)`;
});

/** 色散左影（冷）：压暗 R，保留 G/B 通道 */
const splitCool = computed(() => {
  const { r, g, b } = lyricRgb.value;
  return `rgba(${Math.round(r * 0.24)}, ${Math.round(g * 0.78)}, ${Math.round(b * 0.72)}, 0.42)`;
});

/** 常态微光 */
const splitGlow = computed(() => {
  const { r, g, b } = lyricRgb.value;
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, 0.06)`;
});

const dissolveFontFamily = computed(() => props.fontFamily || ERROR_DEFAULT_FONT_FAMILY);

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

// ==================== 生命周期 ====================

function startIdleTimers() {
  if (!jitterEnabled.value) return;
  if (!jitterTimer) jitterTimer = window.setInterval(jitterTick, 90);
}

function stopIdleTimers() {
  if (jitterTimer) {
    window.clearInterval(jitterTimer);
    jitterTimer = null;
  }
  jitterOffset.value = { x: 0, y: 0 };
}

onMounted(() => {
  if (!props.fontFamily) void ensureFontLoaded('noto-serif-sc');
  if (!reduceMotion.value) startIdleTimers();
});

// 减弱动画：停掉抖动刷新（溶解时间线有统一守卫）
watch(reduceMotion, (reduced) => {
  if (reduced) {
    stopIdleTimers();
  } else {
    startIdleTimers();
  }
});

onUnmounted(() => {
  stopIdleTimers();
  reduceMotionQuery.removeEventListener('change', handleReduceMotionChange);
  if (spikeTimer) clearTimeout(spikeTimer);
  drumUnsubscribe?.();
  enterTimeline?.kill();
  exitTimeline?.kill();
});
</script>

<style lang="scss" scoped>
/* 渲染器根：充满基座 .lyrics-stage（flex 居中的全屏区域）。
   舞台用 flex 居中、不占 transform——抖动的内联 transform 挂在 jitter 层上 */
.dissolve-lyrics {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.error-lyric-stage {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  max-width: none;
  padding: 0 20px;
  pointer-events: none;
}

.error-lyric-underlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: min(92vw, 640px);
  will-change: transform, opacity;
}

.error-lyric-jitter {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  will-change: transform;
}

/* 段落头尾溶解：只动 opacity+blur 的 animation 类 */
.error-stage-dissolve-enter-active {
  animation: error-stage-in 0.42s ease;
}

.error-stage-dissolve-leave-active {
  animation: error-stage-out 0.34s ease forwards;
}

@keyframes error-stage-in {
  from {
    opacity: 0;
    filter: blur(10px);
  }

  to {
    opacity: 1;
    filter: blur(0);
  }
}

@keyframes error-stage-out {
  from {
    opacity: 1;
    filter: blur(0);
  }

  to {
    opacity: 0;
    filter: blur(8px);
  }
}

.error-line {
  width: 100%;
  /* 字体由内联样式控制（基座解析好的字体或思源宋体兜底） */
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
    /* 与主行同位叠放：溶解时新旧两行重叠在原位，
       不挤占布局（此前 prev 在文档流里插在上方，切换呈"滚动轮换"感） */
    position: absolute;
    inset: 0;
    z-index: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.error-line-main {
  position: relative;
  z-index: 1;
  /* 常态小幅 RGB 色散（青左红右，1.5px）：
     色散颜色以主色通道拆分派生，主色为白时与原版（#3EC8B8/#FF5252 方向）一致。
     超大错误爆发期的 --error-rgb-split 放大属高潮层，不在渲染器内 */
  text-shadow:
    calc(-1 * 1.5px) 0 v-bind(splitCool),
    1.5px 0 v-bind(splitWarm),
    0 0 16px v-bind(splitGlow);
  will-change: opacity, filter, transform;
}

@media (prefers-reduced-motion: reduce) {
  .error-stage-dissolve-enter-active,
  .error-stage-dissolve-leave-active {
    animation: none;
  }
}
</style>
