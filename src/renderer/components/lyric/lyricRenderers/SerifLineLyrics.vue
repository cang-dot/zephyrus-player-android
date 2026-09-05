<template>
  <!-- 中央：当前行歌词 + 翻译 + 罗马音（滚动歌词切换、歌词层滑动位移由基座处理） -->
  <div class="serif-line-lyrics">
    <div class="lyrics-center" :class="{ 'force-nowrap': forceNoWrap }">
      <transition name="lyric-change" mode="out-in">
        <div :key="wordPlayback.displayLineKey.value" class="lyrics-main" :style="lyricStyle">
          {{ currentLyricText }}
        </div>
      </transition>
      <transition name="translation-fade">
        <div
          v-if="showTranslation && currentTranslation"
          class="lyrics-translation"
          :style="{ color: auxiliaryColor }"
        >
          {{ currentTranslation }}
        </div>
      </transition>
      <transition name="translation-fade">
        <div
          v-if="showRomanization && currentRomanization"
          class="lyrics-romanization"
          :style="{ color: auxiliaryColor }"
        >
          {{ currentRomanization }}
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * SerifLineLyrics — 舞台样式歌词渲染器
 *
 * 抽取自 StageMobilePlayer.vue 的 lyrics-center 区块：
 * - serif 衬线大字单行（clamp 32-56px, weight 700）
 * - 下方翻译 / 罗马音（clamp 14-18px, 300 weight）
 * - 行切换（lyric-change）与翻译淡入（translation-fade）过渡
 *
 * 颜色 / 字体由基座透传：主色 props.lyricColor，附属文本按主色低不透明度派生。
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';

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
interface SerifParams {
  /** 单行不换行 */
  forceNoWrap?: boolean;
  /** 显式覆盖翻译/罗马音显隐（缺省时读全局歌词配置） */
  showTranslation?: boolean;
  showRomanization?: boolean;
}
const params = computed(() => (props.params ?? {}) as SerifParams);

const wordPlayback = useWordTimedPlayback();

// ==================== 歌词 ====================

const currentLyricText = computed(() => {
  return wordPlayback.currentDisplayLine.value?.text || '';
});

const currentTranslation = computed(() => {
  return wordPlayback.currentDisplayLine.value?.trText || '';
});

const currentRomanization = computed(() => {
  return wordPlayback.currentDisplayLine.value?.romaText || '';
});

// ==================== 翻译/罗马音显隐 ====================
// 与原版一致读全局歌词配置（music-full-config），params 可显式覆盖

const lyricDisplayConfig = ref({ showTranslation: true, showRomanization: false });

function loadLyricDisplayConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem('music-full-config') || '{}');
    lyricDisplayConfig.value = {
      showTranslation: saved.showTranslation ?? true,
      showRomanization: saved.showRomanization ?? false
    };
  } catch {
    lyricDisplayConfig.value = { showTranslation: true, showRomanization: false };
  }
}

onMounted(() => {
  loadLyricDisplayConfig();
  window.addEventListener('music-full-config-updated', loadLyricDisplayConfig);
});

onUnmounted(() => {
  window.removeEventListener('music-full-config-updated', loadLyricDisplayConfig);
});

const showTranslation = computed(
  () => params.value.showTranslation ?? lyricDisplayConfig.value.showTranslation
);

const showRomanization = computed(
  () => params.value.showRomanization ?? lyricDisplayConfig.value.showRomanization
);

// ==================== 视觉 ====================

const forceNoWrap = computed(() => params.value.forceNoWrap === true);

/**
 * 附属文本颜色：主色 62% 不透明度派生
 * （原版固定 #666，改为以基座传入的主色派生，保证任意主色下保持弱化层级）
 */
const auxiliaryColor = computed(() => {
  const tiny = tinycolor(props.lyricColor);
  return tiny.isValid() ? tiny.setAlpha(0.62).toRgbString() : props.lyricColor;
});

/**
 * 歌词样式：serif 字体 clamp(32px, 5vw, 56px) weight 700（原版视觉）
 */
const lyricStyle = computed(() => ({
  color: props.lyricColor,
  fontSize: 'clamp(32px, 5vw, 56px)',
  fontFamily:
    props.fontFamily ||
    "'Noto Serif SC', 'STSong', 'SimSun', var(--m-font-serif, 'Cormorant Garamond'), serif"
}));
</script>

<style lang="scss" scoped>
/* 渲染器根：充满基座 .lyrics-stage（flex 居中的全屏区域） */
.serif-line-lyrics {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

/* 中央：歌词 + 翻译 */
.lyrics-center {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 20px;
  max-width: 800px;

  &.force-nowrap {
    width: max-content;
    max-width: none;
    padding-inline: 0;

    .lyrics-main {
      white-space: nowrap;
    }
  }
}

/* 字体由 lyricStyle 内联控制（基座解析好的字体或 serif 兜底） */
.lyrics-main {
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.01em;
  transition: color 0.3s var(--m-ease-out, ease);
  will-change: color;
}

.lyrics-translation,
.lyrics-romanization {
  font-size: clamp(14px, 2vw, 18px);
  margin-top: 16px;
  font-weight: 300;
}

/* 歌词切换过渡 */
.lyric-change-enter-active,
.lyric-change-leave-active {
  transition:
    opacity 0.3s var(--m-ease-out, ease),
    transform 0.3s var(--m-ease-out, ease);
}

.lyric-change-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.lyric-change-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.translation-fade-enter-active,
.translation-fade-leave-active {
  transition: opacity 0.3s var(--m-ease-out, ease);
}

.translation-fade-enter-from,
.translation-fade-leave-to {
  opacity: 0;
}

/* 减少动画 */
@media (prefers-reduced-motion: reduce) {
  .lyric-change-enter-active,
  .lyric-change-leave-active,
  .translation-fade-enter-active,
  .translation-fade-leave-active {
    transition: opacity 0.2s ease;
  }

  .lyrics-main {
    transition: none;
  }
}
</style>
