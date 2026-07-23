<template>
  <div class="scrolling-lyrics" :class="config.theme">
    <!-- 顶部歌曲信息 -->
    <div class="lyrics-header">
      <div class="song-title" v-html="playMusic?.name"></div>
      <div class="artist-name">
        <span v-for="(item, index) in artistList" :key="index">
          {{ item.name }}{{ index < artistList.length - 1 ? ' / ' : '' }}
        </span>
      </div>
    </div>

    <!-- 歌词滚动区 -->
    <div
      ref="scrollerRef"
      class="lyrics-scroller"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
      @scroll="handleScroll"
    >
      <div class="lyrics-padding-top"></div>
      <div v-if="!supportAutoScroll" class="lyric-line no-scroll-tip">
        <span>{{ t('player.lrc.noAutoScroll') }}</span>
      </div>
      <div
        v-for="(item, index) in lrcArray"
        :key="index"
        :id="`msl-lyric-${index}`"
        class="lyric-line"
        :class="{
          'now-text': index === nowIndex,
          'hover-text': item.text && item.startTime !== -1
        }"
        @click="item.startTime !== -1 ? setAudioTime(index) : null"
      >
        <div v-if="item.hasWordByWord && item.words && item.words.length > 0" class="word-by-word-lyric">
          <template v-for="(word, wordIndex) in item.words" :key="wordIndex">
            <span class="lyric-word" :style="getWordStyle(index, wordIndex, word)">
              {{ word.text }} </span
            ><span class="lyric-word" v-if="word.space">&nbsp;</span></template
          >
        </div>
        <span v-else :style="getLrcStyle(index)">{{ item.text }}</span>
        <div v-if="config.showTranslation && item.trText" class="translation">
          {{ item.trText }}
        </div>
      </div>
      <div class="lyrics-padding-bottom"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
  correctionTime,
  artistList,
  lrcArray,
  nowIndex,
  nowTime,
  playMusic,
  setAudioTime,
  textColors
} from '@/hooks/MusicHook';
import { DEFAULT_LYRIC_CONFIG, type LyricConfig } from '@/types/lyric';
import { getTextColors } from '@/utils/linearColor';

const { t } = useI18n();

// 歌词配置
const config = ref<LyricConfig>(DEFAULT_LYRIC_CONFIG);
function loadConfig() {
  const saved = localStorage.getItem('music-full-config');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      config.value = { ...DEFAULT_LYRIC_CONFIG, ...parsed };
    } catch {
      // ignore
    }
  }
}
loadConfig();

// 滚动控制
const scrollerRef = ref<HTMLElement | null>(null);
const isAutoScrollEnabled = ref(true);
const isTouchScrolling = ref(false);
const touchStartY = ref(0);
let autoScrollTimer: ReturnType<typeof setTimeout> | null = null;

const supportAutoScroll = computed(() => {
  return lrcArray.value.length > 0 && lrcArray.value[0].startTime !== -1;
});

// 自动滚动到当前歌词
function scrollToCurrentLyric(immediate = false) {
  if (!isAutoScrollEnabled.value || !scrollerRef.value) return;

  const el = document.getElementById(`msl-lyric-${nowIndex.value}`);
  if (!el) return;

  const container = scrollerRef.value;
  const containerHeight = container.clientHeight;
  const elTop = el.offsetTop;
  const elHeight = el.offsetHeight;
  const targetScroll = elTop - containerHeight / 2 + elHeight / 2;

  if (immediate) {
    container.scrollTop = targetScroll;
  } else {
    container.scrollTo({ top: targetScroll, behavior: 'smooth' });
  }
}

// 监听歌词索引变化
watch(nowIndex, () => {
  if (isAutoScrollEnabled.value) {
    nextTick(() => scrollToCurrentLyric());
  }
});

// 触摸事件
const handleTouchStart = (e: TouchEvent) => {
  touchStartY.value = e.touches[0].clientY;
  isTouchScrolling.value = true;
};

const handleTouchMove = () => {
  if (!isTouchScrolling.value) return;
  isAutoScrollEnabled.value = false;
};

const handleTouchEnd = () => {
  isTouchScrolling.value = false;
  if (autoScrollTimer) clearTimeout(autoScrollTimer);
  autoScrollTimer = setTimeout(() => {
    isAutoScrollEnabled.value = true;
    nextTick(() => scrollToCurrentLyric());
  }, 3000);
};

const handleScroll = () => {
  if (!isTouchScrolling.value) return;
  isAutoScrollEnabled.value = false;
  if (autoScrollTimer) clearTimeout(autoScrollTimer);
  autoScrollTimer = setTimeout(() => {
    isAutoScrollEnabled.value = true;
    nextTick(() => scrollToCurrentLyric());
  }, 3000);
};

// 逐字歌词样式
const getWordStyle = (lineIndex: number, _wordIndex: number, word: any) => {
  const colors = textColors.value || getTextColors();
  if (lineIndex !== nowIndex.value) {
    return {
      color: colors.primary,
      transition: 'color 0.3s ease',
      backgroundImage: 'none',
      WebkitTextFillColor: 'initial'
    };
  }
  const currentTime = (nowTime.value + correctionTime.value) * 1000;
  const wordStartTime = word.startTime;
  const wordEndTime = word.startTime + word.duration;

  if (currentTime >= wordStartTime && currentTime < wordEndTime) {
    const progress = Math.min((currentTime - wordStartTime) / word.duration, 1);
    const progressPercent = Math.round(progress * 100);
    return {
      backgroundImage: `linear-gradient(to right, ${colors.active} 0%, ${colors.active} ${progressPercent}%, ${colors.primary} ${progressPercent}%, ${colors.primary} 100%)`,
      backgroundClip: 'text',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      textShadow: `0 0 8px ${colors.active}40`,
      transition: 'all 0.1s ease'
    };
  } else if (currentTime >= wordEndTime) {
    return {
      color: colors.active,
      WebkitTextFillColor: 'initial',
      transition: 'none'
    };
  }
  return {
    color: colors.primary,
    WebkitTextFillColor: 'initial',
    transition: 'none'
  };
};

// 从 MusicHook 获取 getLrcStyle
import { getLrcStyle } from '@/hooks/MusicHook';

onBeforeUnmount(() => {
  if (autoScrollTimer) clearTimeout(autoScrollTimer);
});
</script>

<style scoped lang="scss">
.scrolling-lyrics {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  position: relative;
  z-index: 10;

  &.light {
    color: #333;
  }
  &.dark {
    color: #fff;
  }
}

.lyrics-header {
  text-align: center;
  padding: 20px 16px 8px;
  flex-shrink: 0;

  .song-title {
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .artist-name {
    font-size: 13px;
    opacity: 0.6;
  }
}

.lyrics-scroller {
  flex: 1;
  overflow-y: auto;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  padding: 0 16px;
}

.lyrics-padding-top {
  height: 70px;
  min-height: 70px;
}

.lyrics-padding-bottom {
  height: 150px;
  min-height: 150px;
}

.lyric-line {
  padding: 12px 8px;
  text-align: center;
  font-size: 18px;
  font-weight: 500;
  line-height: 1.6;
  opacity: 0.5;
  transition: all 0.3s ease;
  cursor: pointer;

  &.now-text {
    opacity: 1;
    font-size: 22px;
    font-weight: 600;
    padding: 16px 8px;
  }

  &.hover-text:hover {
    opacity: 0.8;
  }
}

.translation {
  font-size: 14px;
  opacity: 0.6;
  margin-top: 4px;
}

.word-by-word-lyric {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;

  .lyric-word {
    transition: all 0.1s ease;
  }
}

.no-scroll-tip {
  opacity: 0.3;
  font-size: 14px;
  text-align: center;
}
</style>
