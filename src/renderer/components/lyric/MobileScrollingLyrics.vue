<template>
  <div class="scrolling-lyrics" :class="config.theme">
    <!-- 拖动时显示时间指示器 -->
    <transition name="fade">
      <div v-if="isDragging" class="time-indicator">
        {{ currentTimeText }}
      </div>
    </transition>
    <!-- 歌词滚动区（全屏，点击空白关闭） -->
    <div
      ref="scrollerRef"
      class="lyrics-scroller"
      @click="handleEmptyClick"
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
        @click.stop="item.startTime !== -1 ? setAudioTime(index) : null"
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
  lrcArray,
  nowIndex,
  nowTime,
  setAudioTime,
  textColors
} from '@/hooks/MusicHook';
import { DEFAULT_LYRIC_CONFIG, type LyricConfig } from '@/types/lyric';
import { getTextColors } from '@/utils/linearColor';

const { t } = useI18n();

const emit = defineEmits<{ close: []; interact: [] }>();

// 拖动状态
const isDragging = ref(false);
const currentTimeText = ref('');

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// 点击空白区域关闭
function handleEmptyClick() {
  emit('close');
}

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
  isDragging.value = true;
  emit('interact');
};

const handleTouchMove = () => {
  if (!isTouchScrolling.value) return;
  isAutoScrollEnabled.value = false;
  updateTimeIndicator();
};

const handleTouchEnd = () => {
  isTouchScrolling.value = false;
  if (autoScrollTimer) clearTimeout(autoScrollTimer);
  autoScrollTimer = setTimeout(() => {
    isAutoScrollEnabled.value = true;
    isDragging.value = false;
    nextTick(() => scrollToCurrentLyric());
  }, 3000);
};

const handleScroll = () => {
  if (!isTouchScrolling.value) return;
  isAutoScrollEnabled.value = false;
  updateTimeIndicator();
  if (autoScrollTimer) clearTimeout(autoScrollTimer);
  autoScrollTimer = setTimeout(() => {
    isAutoScrollEnabled.value = true;
    isDragging.value = false;
    nextTick(() => scrollToCurrentLyric());
  }, 3000);
};

// 获取当前可视中心歌词的时间
function updateTimeIndicator() {
  if (!scrollerRef.value) return;
  const container = scrollerRef.value;
  const centerY = container.scrollTop + container.clientHeight / 2;
  let closestTime = 0;
  let closestDist = Infinity;
  for (let i = 0; i < lrcArray.value.length; i++) {
    const el = document.getElementById(`msl-lyric-${i}`);
    if (!el) continue;
    const elCenter = el.offsetTop + el.offsetHeight / 2;
    const dist = Math.abs(elCenter - centerY);
    if (dist < closestDist) {
      closestDist = dist;
      const item = lrcArray.value[i];
      closestTime = item.startTime !== -1 ? item.startTime : 0;
    }
  }
  currentTimeText.value = formatTime(closestTime);
}

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

.lyrics-scroller {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  padding: 0 16px;

  /* 顶部和底部渐变遮罩 */
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    black 8%,
    black 92%,
    transparent 100%
  );
  mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    black 8%,
    black 92%,
    transparent 100%
  );
}

.lyrics-padding-top {
  height: 35vh;
  min-height: 200px;
}

.lyrics-padding-bottom {
  height: 65vh;
  min-height: 400px;
}

.lyric-line {
  width: fit-content;
  max-width: 90%;
  margin: 10px auto;
  padding: 6px 12px;
  font-size: 18px;
  font-weight: 500;
  line-height: 1.6;
  opacity: 0.45;
  transition: all 0.3s ease;
  cursor: pointer;
  border-radius: 8px;

  &.now-text {
    opacity: 1;
    font-size: 22px;
    font-weight: 600;
    padding: 10px 16px;
  }

  @media (hover: hover) {
    &.hover-text:hover {
      opacity: 0.8;
    }
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

.time-indicator {
  position: absolute;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  padding: 8px 14px;
  border-radius: 20px;
  z-index: 15;
  pointer-events: none;
  font-variant-numeric: tabular-nums;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
