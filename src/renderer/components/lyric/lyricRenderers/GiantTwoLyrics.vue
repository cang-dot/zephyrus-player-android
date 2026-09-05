<template>
  <!-- 巨字歌词（两行拆分；滚动歌词切换、歌词层滑动位移由基座处理） -->
  <div class="giant-two-lyrics">
    <div class="giant-text-container" :class="{ 'force-nowrap': forceNoWrap }">
      <div
        class="giant-text line-1"
        :style="{
          fontSize: fontSizePx,
          color: textColorDark,
          fontFamily: giantFontFamily
        }"
      >
        {{ forceNoWrap ? currentLyricText : lyricPart1 }}
      </div>
      <div
        v-if="!forceNoWrap"
        class="giant-text line-2"
        :style="{
          fontSize: fontSizePx,
          color: textColorGray,
          fontFamily: giantFontFamily
        }"
      >
        {{ lyricPart2 }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * GiantTwoLyrics — 狂躁样式歌词渲染器
 *
 * 抽取自 FrenzyMobilePlayer.vue 的巨字歌词段：
 * - 两行巨字：第一行深色、第二行灰色（原版 #1a1a1a/#6b6b6b，改以主色不透明度派生）
 * - Inter 900 / uppercase / line-height 0.95 / 超大字号
 * - 「不,要相信…」类拆行逻辑原样保留（优先自然分隔，否则中间拆分）
 */
import { computed } from 'vue';

import tinycolor from 'tinycolor2';

import { useWordTimedPlayback } from '@/composables/useWordTimedPlayback';

// ==================== Props ====================

const props = defineProps({
  lyricColor: { type: String, default: '#f0ece4' }, // 歌词主色
  accentColor: { type: String, default: '#888888' }, // 封面强调色
  fontFamily: { type: String, default: '' }, // 基座解析好的字体
  params: { type: Object, default: () => ({}) }, // 预设参数
  climaxEffects: { type: Object, default: () => ({}) } // 高潮效果开关
});

/** 预设参数（均可缺省） */
interface GiantParams {
  /** 巨字字号基准（px），默认 80 → clamp(80px, 14vw, 160px) 与原版一致 */
  giantSize?: number;
  /** 单行不换行（整行渲染，不拆两行） */
  forceNoWrap?: boolean;
}
const params = computed(() => (props.params ?? {}) as GiantParams);

const wordPlayback = useWordTimedPlayback();

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

// ==================== 视觉 ====================

const forceNoWrap = computed(() => params.value.forceNoWrap === true);

const giantFontFamily = computed(
  () => props.fontFamily || "var(--m-font-art, 'Inter', sans-serif)"
);

/**
 * 字号基准：按 giantSize 等比换算 clamp 的三档
 * giantSize=80 时与原版完全一致：clamp(80px, 14vw, 160px)
 */
const giantSizeValue = computed(() => {
  const n = Number(params.value.giantSize);
  return Number.isFinite(n) && n > 0 ? n : 80;
});

const fontSizePx = computed(() => {
  const size = giantSizeValue.value;
  return `clamp(${size}px, ${((size / 80) * 14).toFixed(3)}vw, ${size * 2}px)`;
});

/**
 * 双色派生：原版深底上的深/灰双字（#1a1a1a/#6b6b6b）
 * 改为以基座传入的主色按 90% / 45% 不透明度近似
 */
function deriveLyricTone(color: string, alpha: number): string {
  const tiny = tinycolor(color);
  return tiny.isValid() ? tiny.setAlpha(alpha).toRgbString() : color;
}

const textColorDark = computed(() => deriveLyricTone(props.lyricColor, 0.9));
const textColorGray = computed(() => deriveLyricTone(props.lyricColor, 0.45));
</script>

<style lang="scss" scoped>
/* 渲染器根：充满基座 .lyrics-stage（flex 居中的全屏区域） */
.giant-two-lyrics {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.giant-text-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 20px;
  text-align: center;

  &.force-nowrap {
    width: max-content;
    max-width: none;
    flex-direction: row;
    padding: 0;
    white-space: nowrap;
  }
}

/* 巨字样式 */
.giant-text {
  font-weight: 900;
  line-height: 0.95;
  letter-spacing: -0.03em;
  text-transform: uppercase;
  text-align: center;
  transition: color 0.3s var(--m-ease-out, ease);
  will-change: color;
}

@media (prefers-reduced-motion: reduce) {
  .giant-text {
    transition: none;
  }
}
</style>
