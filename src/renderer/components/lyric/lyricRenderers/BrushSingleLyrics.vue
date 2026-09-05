<template>
  <!-- 超大毛笔单行 + 翻译（滚动歌词切换、歌词层滑动位移由基座处理） -->
  <div class="brush-single-lyrics">
    <div class="smoke-lyrics" :class="{ 'force-nowrap': forceNoWrap }">
      <div
        class="smoke-lyric-text"
        :style="{
          color: lyricColor,
          fontFamily: brushFontFamily,
          fontWeight: brushWeight,
          transform: `scaleX(${smokeFontStretch})`
        }"
      >
        {{ currentText }}
      </div>
      <div
        v-if="showTranslation && currentTranslation"
        class="smoke-translation"
        :style="{ color: lyricColor }"
      >
        {{ currentTranslation }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * BrushSingleLyrics — 烟雾样式歌词渲染器
 *
 * 抽取自 SmokeMobilePlayer.vue 的 smoke-lyrics 区块：
 * - 超大毛笔单行（clamp 48-150px, line-height 0.94, text-wrap balance）
 * - scaleX(smokeFontStretch) 横向拉伸（默认 1.18）
 * - 下方翻译（clamp 14-24px, opacity 0.7）
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';

import { useWordTimedPlayback } from '@/composables/useWordTimedPlayback';
import { ensureFontLoaded } from '@/utils/fontLoader';

// ==================== Props ====================

const props = defineProps({
  lyricColor: { type: String, default: '#f0ece4' }, // 歌词主色
  accentColor: { type: String, default: '#888888' }, // 封面强调色
  fontFamily: { type: String, default: '' }, // 基座解析好的字体（毛笔字体）
  params: { type: Object, default: () => ({}) }, // 预设参数
  climaxEffects: { type: Object, default: () => ({}) } // 高潮效果开关
});

/** 预设参数（均可缺省） */
interface BrushParams {
  /** 毛笔字横向拉伸倍率，默认 1.18 */
  smokeFontStretch?: number;
  /** 字重（缺省时交给字体本身） */
  fontWeight?: number;
  /** 单行不换行 */
  forceNoWrap?: boolean;
  /** 显式覆盖翻译显隐（缺省时读全局歌词配置） */
  showTranslation?: boolean;
}
const params = computed(() => (props.params ?? {}) as BrushParams);

const wordPlayback = useWordTimedPlayback();

// ==================== 歌词 ====================

const currentText = computed(() => wordPlayback.currentDisplayLine.value?.text || '');
const currentTranslation = computed(() => wordPlayback.currentDisplayLine.value?.trText || '');

// ==================== 翻译显隐 ====================
// 与原版一致读全局歌词配置（music-full-config），params 可显式覆盖

const localShowTranslation = ref(true);

function loadConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem('music-full-config') || '{}');
    localShowTranslation.value = saved.showTranslation ?? true;
  } catch {
    // localStorage may be unavailable in a restricted WebView.
  }
}

onMounted(() => {
  loadConfig();
  window.addEventListener('music-full-config-updated', loadConfig);
  // 默认字体为马善政毛笔楷书：提前注册 FontFace，首帧即可生效（基座未传字体时兜底）
  if (!props.fontFamily) void ensureFontLoaded('ma-shan-zheng');
});

onUnmounted(() => window.removeEventListener('music-full-config-updated', loadConfig));

const showTranslation = computed(() => params.value.showTranslation ?? localShowTranslation.value);

// ==================== 视觉 ====================

const forceNoWrap = computed(() => params.value.forceNoWrap === true);

/** 字体：基座解析好的毛笔字体优先，缺省回退马善政毛笔楷书 */
const brushFontFamily = computed(
  () => props.fontFamily || "'ZephyrusMaShanZheng', 'KaiTi', 'STKaiti', 'Noto Serif SC', serif"
);

const brushWeight = computed(() => {
  const n = Number(params.value.fontWeight);
  return Number.isFinite(n) && n > 0 ? n : undefined;
});

/** 横向拉伸倍率（默认 1.18，与原版一致） */
const smokeFontStretch = computed(() => {
  const n = Number(params.value.smokeFontStretch);
  return Number.isFinite(n) && n > 0 ? n : 1.18;
});
</script>

<style scoped>
/* 渲染器根：充满基座 .lyrics-stage（flex 居中的全屏区域） */
.brush-single-lyrics {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.smoke-lyrics {
  position: relative;
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
</style>
