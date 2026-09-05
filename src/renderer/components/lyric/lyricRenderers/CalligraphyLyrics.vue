<template>
  <!-- 书法逐字符歌词 + 高潮重点词大字（报纸闪、背景噪点属高潮/背景层，由基座处理） -->
  <div class="lyrics-layer">
    <template v-if="!isIntro && keywordEffectEnabled && isInClimax && climaxDisplayKeywords.length > 0">
      <div class="climax-keywords" :class="{ 'force-nowrap': forceNoWrap }">
        <span
          v-for="(kw, i) in climaxDisplayKeywords"
          :key="i"
          class="keyword-char"
          :style="{
            color: charColor,
            fontSize: climaxFontSizePx,
            fontWeight: eerieFontWeightValue
          }"
          >{{ kw.text }}</span
        >
      </div>
    </template>
    <template v-else-if="!isIntro && currentChars.length > 0">
      <div class="calligraphy-line" :class="{ 'force-nowrap': forceNoWrap }">
        <span
          v-for="(charData, i) in currentChars"
          :key="i"
          class="calligraphy-char"
          :style="{
            fontSize: charData.size + 'px',
            color: charColor,
            marginLeft: charData.margin + 'px',
            marginRight: charData.margin + 'px',
            fontWeight: eerieFontWeightValue
          }"
          >{{ charData.char }}</span
        >
      </div>
    </template>
    <div v-else class="lyrics-empty"></div>
  </div>
</template>

<script setup lang="ts">
/**
 * CalligraphyLyrics — 诡异样式歌词渲染器
 *
 * 抽取自 EerieMobilePlayer.vue 的书法歌词段：
 * - 逐字符渲染：按正弦分布的正弦字号（首尾小、中间大）
 * - KaiTi 书法字体映射
 * - 高潮重点词 keyword 大字（keywordSize + 发光 pulse 动画）
 * - 词源逻辑原样：优先服务器重点词，降级到本地情感词检测
 * （报纸闪 newspaper-flash 不带入，属高潮层）
 */
import { computed, ref, watch } from 'vue';

import { useWordTimedPlayback } from '@/composables/useWordTimedPlayback';
import { usePlayerStore } from '@/store/modules/player';
import { useStyleEngineStore } from '@/store/modules/styleEngine';
import { getClimaxWordCandidates, setCurrentSongId } from '@/utils/emotionalDetector';

// ==================== 署名类歌词检测（参考 SmartMixService）====================
const ATTRIBUTION_KEYWORDS: readonly string[] = [
  // 多字关键词
  '作词',
  '作曲',
  '编曲',
  '填词',
  '谱曲',
  '制作人',
  '监制',
  '统筹',
  '企划',
  '吉他',
  '贝斯',
  '鼓',
  '键盘',
  '钢琴',
  '小提琴',
  '大提琴',
  '萨克斯',
  '笛子',
  '二胡',
  '琵琶',
  '古筝',
  '和声',
  '伴唱',
  '合唱',
  '童声',
  '混音',
  '母带',
  '录音',
  '后期',
  '编曲混音',
  '录音室',
  '录音棚',
  '混音棚',
  '出品',
  '出品人',
  '出品方',
  '发行',
  '发行公司',
  '唱片公司',
  '版权',
  '著作权',
  '制作公司',
  '工作室',
  '厂牌',
  '感谢',
  '鸣谢',
  '致谢',
  '特别感谢',
  '献给',
  '谨以此歌',
  'lyrics',
  'composed',
  'arranged',
  'produced',
  'mixed',
  'mastered',
  'guitar',
  'bass',
  'drums',
  'keyboard',
  'piano',
  'violin',
  'vocal',
  'vocals',
  'backing vocal',
  'choir',
  'recording',
  'mixing',
  'mastering',
  'recording studio',
  'mixing studio',
  'presented by',
  'released by',
  'record label',
  'copyright',
  'all rights reserved',
  'production company',
  'studio',
  'label',
  'thanks to',
  'acknowledgments',
  'dedicated to',
  'special thanks',
  'goodbye',
  'goodnight',
  'thank you',
  'thanks for listening',
  'to be continued',
  // 单字简写（LRC 歌词中常见的署名行格式："词：xxx"、"曲：xxx"）
  '词',
  '曲',
  '编',
  '唱',
  '制',
  '监',
  '混',
  '录',
  '配',
  '奏',
  '伴'
];

function isAttributionLyric(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return ATTRIBUTION_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

// ==================== Props ====================

const props = defineProps({
  lyricColor: { type: String, default: '#f0ece4' }, // 歌词主色
  accentColor: { type: String, default: '#888888' }, // 封面强调色（书法字色基准）
  fontFamily: { type: String, default: '' }, // 基座解析好的字体
  params: { type: Object, default: () => ({}) }, // 预设参数
  climaxEffects: { type: Object, default: () => ({}) } // 高潮效果开关
});

/** 预设参数（均可缺省，默认值照原代码） */
interface CalligraphyParams {
  /** 高潮重点词字号（px） */
  keywordSize?: number;
  /** 逐字符最大字号（px） */
  eerieMaxFontSize?: number;
  /** 逐字符最小字号（px） */
  eerieMinFontSize?: number;
  /** 歌词整体缩放（50~200，对应 0.5x~2.0x） */
  eerieLyricScale?: number;
  /** 字体粗细（100~900） */
  eerieFontWeight?: number;
  /** 书法字体族（KaiTi/STKaiti/FangSong/SimSun/LiSu/YouYuan 或自定义） */
  eerieFontFamily?: string;
  /** 单行不换行 */
  forceNoWrap?: boolean;
}
const params = computed(() => (props.params ?? {}) as CalligraphyParams);

const playerStore = usePlayerStore();
const styleEngine = useStyleEngineStore();
const wordPlayback = useWordTimedPlayback();

// ==================== 参数解析 ====================

/** 数值参数兜底：非法或非正数时使用默认值 */
function numParam(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const eerieMaxFontSize = computed(() => numParam(params.value.eerieMaxFontSize, 44));
const eerieMinFontSize = computed(() => numParam(params.value.eerieMinFontSize, 28));
// 歌词整体缩放（50~200，对应 0.5x~2.0x）
const eerieLyricScale = computed(() => numParam(params.value.eerieLyricScale, 100) / 100);
// 字体粗细（100~900）
const eerieFontWeightValue = computed(() => numParam(params.value.eerieFontWeight, 700));
// 高潮重点词字号（px）
const climaxFontSizePx = computed(() => `${numParam(params.value.keywordSize, 32)}px`);

const forceNoWrap = computed(() => params.value.forceNoWrap === true);

// 高潮重点词效果开关（基座透传的高潮效果开关，缺省开启）
const keywordEffectEnabled = computed(() => props.climaxEffects?.keyword !== false);

// ==================== 书法字体映射 ====================

const calligraphyFontFamily = computed(() => {
  if (props.fontFamily) return props.fontFamily;
  const f = String(params.value.eerieFontFamily || 'KaiTi');
  const fallbacks: Record<string, string> = {
    KaiTi: "'KaiTi', 'STKaiti', 'Noto Serif SC', serif",
    STKaiti: "'STKaiti', 'KaiTi', 'Noto Serif SC', serif",
    FangSong: "'FangSong', 'STFangsong', 'Noto Serif SC', serif",
    SimSun: "'SimSun', 'STSong', serif",
    LiSu: "'LiSu', 'STLiti', serif",
    YouYuan: "'YouYuan', 'STXihei', sans-serif"
  };
  return fallbacks[f] || `${f}, 'KaiTi', serif`;
});

// ==================== 逐字符正弦字号分布 ====================

const currentChars = computed(() => {
  const text = wordPlayback.currentDisplayLine.value?.text || '';
  if (!text) return [];
  const chars = Array.from(text);
  const n = chars.length;
  if (n === 0) return [];
  const scale = eerieLyricScale.value;
  const maxSize = eerieMaxFontSize.value * scale;
  const minSize = eerieMinFontSize.value * scale;
  return chars.map((char, i) => {
    const ratio = n === 1 ? 1 : 1 - Math.sin(Math.PI * (i / (n - 1)));
    const size = minSize + (maxSize - minSize) * ratio;
    return { char, size, margin: -size * 0.08 };
  });
});

// ==================== 前奏（署名行）检测 ====================

const isInClimax = computed(() => styleEngine.isInClimax);

const isIntro = computed(() => {
  const idx = wordPlayback.displayIndex.value;
  if (idx < 0) return true;
  for (let i = 0; i <= idx && i < wordPlayback.displayLines.value.length; i++) {
    const text = wordPlayback.displayLines.value[i]?.text || '';
    if (!isAttributionLyric(text)) return false;
  }
  return true;
});

// ==================== 高潮重点词 ====================
// 优先服务器重点词，降级到本地情感词检测（参考 FrenzyLyrics）
// 高潮阶段强制每句选择不同的词汇，避免重复

const climaxDisplayKeywords = ref<{ text: string }[]>([]);
const usedClimaxKeywords = new Set<string>();

/**
 * 自定义情感词典：读全局歌词配置（music-full-config）顶层的 frenzyEmotionalDict
 * （原代码从 Song.lyric 读取，但该字段实际定义在 DEFAULT_LYRIC_CONFIG 顶层）
 */
function loadCustomEmotionalDict(): string[] | undefined {
  try {
    const saved = JSON.parse(localStorage.getItem('music-full-config') || '{}');
    const dict = saved.frenzyEmotionalDict;
    return Array.isArray(dict) && dict.length > 0 ? (dict as string[]) : undefined;
  } catch {
    return undefined;
  }
}

function updateClimaxDisplayKeywords() {
  // 优先服务器重点词
  const serverKeywords = styleEngine.currentLineKeywords;
  if (serverKeywords && serverKeywords.length > 0) {
    climaxDisplayKeywords.value = serverKeywords.map((kw) => ({ text: kw.text }));
    return;
  }

  // 降级到本地情感词检测：获取全部候选词，选择第一个未使用的
  const text = wordPlayback.currentDisplayLine.value?.text || '';
  if (!text) {
    climaxDisplayKeywords.value = [];
    return;
  }

  const customDict = loadCustomEmotionalDict();
  const candidates = getClimaxWordCandidates(text, customDict);
  if (candidates.length === 0) {
    climaxDisplayKeywords.value = [];
    return;
  }

  // 选择第一个未使用过的候选词
  let selected = candidates.find((c) => !usedClimaxKeywords.has(c));
  if (!selected) {
    // 所有候选词都已使用过，重置已使用列表并重新选择第一个
    usedClimaxKeywords.clear();
    selected = candidates[0];
  }
  usedClimaxKeywords.add(selected);
  climaxDisplayKeywords.value = [{ text: selected }];
}

// 切歌时同步情感词检测器
watch(
  () => playerStore.currentSong?.id,
  (songId) => {
    if (songId) {
      setCurrentSongId(String(songId));
    }
  },
  { immediate: true }
);

// 切歌时清空已使用列表
watch(
  () => playerStore.currentSong?.id,
  () => {
    usedClimaxKeywords.clear();
    climaxDisplayKeywords.value = [];
  }
);

// 高潮状态下歌词行变化时，重新选择关键词
watch(
  [wordPlayback.displayIndex, isInClimax],
  () => {
    if (isInClimax.value) {
      updateClimaxDisplayKeywords();
    } else {
      climaxDisplayKeywords.value = [];
    }
  },
  { immediate: true }
);

// 切歌词时同步重点词到 styleEngine
watch(
  wordPlayback.displayIndex,
  (idx) => {
    styleEngine.updateCurrentLineKeywords(idx);
  },
  { immediate: true }
);

// ==================== 字色 ====================

/** 书法字/重点词颜色：原版取封面主色，改用基座透传的强调色 */
const charColor = computed(() => props.accentColor);
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
.calligraphy-line {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  max-width: 100%;
}
.calligraphy-line.force-nowrap,
.climax-keywords.force-nowrap {
  width: max-content;
  max-width: none;
  flex-wrap: nowrap;
  white-space: nowrap;
}
.calligraphy-char {
  font-family: v-bind(calligraphyFontFamily);
  line-height: 1.1;
  filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.5));
  transition: color 0.3s var(--m-ease-out, ease);
  text-shadow: 0 0 2px currentColor;
}
.climax-keywords {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.1em;
  width: 100%;
}
.keyword-char {
  font-family: v-bind(calligraphyFontFamily);
  line-height: 1;
  text-shadow:
    0 0 20px currentColor,
    0 0 4px currentColor;
  animation: keyword-pulse 0.8s var(--m-ease-out, ease) infinite alternate;
}
@keyframes keyword-pulse {
  to {
    text-shadow:
      0 0 30px currentColor,
      0 0 8px currentColor;
  }
}
.lyrics-empty {
  width: 1px;
  height: 1px;
}

@media (prefers-reduced-motion: reduce) {
  .keyword-char {
    animation: none;
  }
}
</style>
