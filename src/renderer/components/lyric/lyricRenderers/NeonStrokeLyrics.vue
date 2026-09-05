<template>
  <!-- 霓虹描边逐字歌词（滚动歌词切换、歌词层滑动位移由基座处理） -->
  <div class="lyrics-layer">
    <div
      class="neon-lyrics"
      :class="{ 'force-nowrap': forceNoWrap }"
      :style="{ fontSize: lyricFontSize, fontFamily: neonFontFamily }"
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
      :class="{ 'force-nowrap': forceNoWrap }"
      :style="{ color: neonBright }"
    >
      {{ currentText }}
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * NeonStrokeLyrics — 霓虹样式歌词渲染器
 *
 * 抽取自 NeonMobilePlayer.vue 的歌词段：
 * - 霓虹描边逐字渲染（NeonStrokeChar SVG 笔画组件循环）
 * - 无笔划 fallback 静态大字（衬线 + 霓虹光晕）
 * - clamp(32px, 10vw, 64px)
 *
 * 注意：本样式原为行级数据源（lrcArray/nowIndex）而非逐字时间轴，
 * 为保持原视觉节奏，数据源原样保留。
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import NeonStrokeChar from '@/components/lyric/NeonStrokeChar.vue';
import { lrcArray, nowIndex } from '@/hooks/MusicHook';
import { getStrokes, loadDictionary } from '@/lib/hanziStrokes';
import { drumDetector } from '@/services/drumDetector';

// ==================== Props ====================

const props = defineProps({
  lyricColor: { type: String, default: '#f0ece4' }, // 歌词主色
  accentColor: { type: String, default: '#888888' }, // 封面强调色（霓虹主色基准）
  fontFamily: { type: String, default: '' }, // 基座解析好的字体
  params: { type: Object, default: () => ({}) }, // 预设参数
  climaxEffects: { type: Object, default: () => ({}) } // 高潮效果开关
});

/** 预设参数（均可缺省） */
interface NeonParams {
  /** 单行不换行 */
  forceNoWrap?: boolean;
}
const params = computed(() => (props.params ?? {}) as NeonParams);

// ==================== 霓虹颜色派生（基于封面强调色） ====================

/** 霓虹主色：原版取封面主色，改用基座透传的强调色 */
const neonColor = computed(() => props.accentColor || '#c9a96e');

/** 亮色：各通道 +50（原版派生逻辑） */
const neonBright = computed(() => {
  const rgb = neonColor.value.match(/\d+/g);
  if (!rgb) return '#e8d5a8';
  return `rgb(${Math.min(255, Number(rgb[0]) + 50)}, ${Math.min(255, Number(rgb[1]) + 50)}, ${Math.min(255, Number(rgb[2]) + 50)})`;
});

/** 暗色：各通道 ×0.4（原版派生逻辑，用于 fallback 光晕） */
const neonDim = computed(() => {
  const rgb = neonColor.value.match(/\d+/g);
  if (!rgb) return '#5c4a2e';
  return `rgb(${Math.round(Number(rgb[0]) * 0.4)}, ${Math.round(Number(rgb[1]) * 0.4)}, ${Math.round(Number(rgb[2]) * 0.4)})`;
});

// ==================== 鼓点脉冲（驱动笔画微缩放） ====================

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

// ==================== 行级歌词数据源（原样保留 lrcArray/nowIndex） ====================

const currentText = computed(() => {
  const idx = nowIndex.value;
  if (idx < 0 || idx >= lrcArray.value.length) return '';
  return lrcArray.value[idx]?.text || '';
});
const currentChars = computed(() => Array.from(currentText.value || ''));
const lyricFontSize = computed(() => 'clamp(32px, 10vw, 64px)');

const forceNoWrap = computed(() => params.value.forceNoWrap === true);

const neonFontFamily = computed(() => props.fontFamily || undefined);

// ==================== 笔划可用性检测（决定 fallback） ====================

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

onMounted(() => {
  checkStrokes();
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
</script>

<style lang="scss" scoped>
/* 渲染器根：充满基座 .lyrics-stage（flex 居中的全屏区域） */
.lyrics-layer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  overflow: hidden;
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
    0 0 8px v-bind(neonDim);
  text-align: center;
  letter-spacing: 0.05em;
}
.fallback-lyrics.force-nowrap {
  width: max-content;
  max-width: none;
  white-space: nowrap;
}
</style>
