<template>
  <div class="scrolling-lyrics" :class="[config.theme, { 'select-mode': selectMode }]">
    <!-- 拖动时显示时间指示器 -->
    <transition name="fade">
      <div
        v-if="isDragging && !selectMode"
        class="time-indicator"
        @click.stop="handleTimeIndicatorClick"
      >
        {{ currentTimeText }}
      </div>
    </transition>

    <!-- 选择模式提示 -->
    <transition name="slide-down">
      <div v-if="selectMode" class="select-mode-header">
        <button class="select-cancel-btn" @click="exitSelectMode">
          <i class="ri-close-line"></i>
        </button>
        <span class="select-hint">
          {{ t('player.share.selectLyrics') || '选择歌词' }}
          <span class="select-count">{{ selectedSet.size }}/10</span>
        </span>
        <button class="select-all-btn" @click="toggleSelectAll">
          {{
            isAllSelected
              ? t('player.share.deselectAll') || '取消全选'
              : t('player.share.selectAll') || '全选'
          }}
        </button>
      </div>
    </transition>

    <!-- 歌词滚动区（全屏，点击空白关闭） -->
    <div
      ref="scrollerRef"
      class="lyrics-scroller"
      :class="{ 'select-scroller': selectMode }"
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
          'hover-text': item.text && item.startTime !== -1,
          selected: selectedSet.has(index),
          selectable: selectMode && item.text && item.text.trim()
        }"
        @click.stop="handleLyricClick(index, item)"
        @touchstart.passive="handleLyricTouchStart(index, item, $event)"
        @touchend="handleLyricTouchEnd"
        @touchmove="handleLyricTouchMove"
      >
        <!-- 选择模式的复选框 -->
        <div v-if="selectMode && item.text && item.text.trim()" class="lyric-checkbox">
          <i
            :class="
              selectedSet.has(index) ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'
            "
          ></i>
        </div>

        <div
          v-if="item.hasWordByWord && item.words && item.words.length > 0"
          class="word-by-word-lyric"
        >
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

    <!-- 底部操作栏（选择模式） -->
    <transition name="slide-up">
      <div v-if="selectMode" class="select-action-bar">
        <div class="action-row">
          <button
            class="action-btn copy-btn"
            :disabled="selectedSet.size === 0"
            @click="handleCopyLyrics"
          >
            <i class="ri-file-copy-line"></i>
            <span>{{ t('player.share.copyLyrics') || '复制歌词' }}</span>
          </button>
          <button
            class="action-btn generate-btn"
            :disabled="selectedSet.size === 0"
            @click="handleGeneratePoster"
          >
            <i class="ri-image-edit-line"></i>
            <span>{{ t('player.share.generatePoster') || '生成海报' }}</span>
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
  correctionTime,
  lrcArray,
  lrcTimeArray,
  nowIndex,
  nowTime,
  setAudioTime,
  textColors
} from '@/hooks/MusicHook';
import { DEFAULT_LYRIC_CONFIG, type LyricConfig } from '@/types/lyric';
import type { SelectedLyric } from '@/types/share';
import { getTextColors } from '@/utils/linearColor';

const { t } = useI18n();

const emit = defineEmits<{ close: []; interact: []; generatePoster: [lyrics: SelectedLyric[]] }>();

// ==================== 多选模式 ====================
const MAX_SELECTION = 10;
const selectMode = ref(false);
const selectedSet = ref<Set<number>>(new Set());

// 长按检测
let longPressTimer: ReturnType<typeof setTimeout> | null = null;
const longPressThreshold = 500; // 500ms
let longPressTriggered = false;
let longPressStartX = 0;
let longPressStartY = 0;

/** 进入选择模式并预选某行 */
function enterSelectMode(initialIndex: number) {
  selectMode.value = true;
  selectedSet.value = new Set();
  if (initialIndex >= 0) {
    selectedSet.value.add(initialIndex);
  }
  emit('interact');
}

/** 退出选择模式 */
function exitSelectMode() {
  selectMode.value = false;
  selectedSet.value = new Set();
}

/** 切换某行选中状态 */
function toggleSelection(index: number) {
  if (selectedSet.value.has(index)) {
    selectedSet.value.delete(index);
    selectedSet.value = new Set(selectedSet.value); // 触发响应式
  } else {
    if (selectedSet.value.size >= MAX_SELECTION) return;
    selectedSet.value.add(index);
    selectedSet.value = new Set(selectedSet.value); // 触发响应式
  }
}

/** 全选/取消全选 */
const isAllSelected = computed(() => {
  const validLines = lrcArray.value.filter((l) => l.text && l.text.trim());
  return (
    validLines.length > 0 && selectedSet.value.size >= Math.min(validLines.length, MAX_SELECTION)
  );
});

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedSet.value = new Set();
  } else {
    const indices: number[] = [];
    for (let i = 0; i < lrcArray.value.length && indices.length < MAX_SELECTION; i++) {
      if (lrcArray.value[i].text && lrcArray.value[i].text.trim()) {
        indices.push(i);
      }
    }
    selectedSet.value = new Set(indices);
  }
}

/** 处理歌词点击 */
function handleLyricClick(index: number, item: any) {
  if (selectMode.value) {
    if (item.text && item.text.trim()) {
      toggleSelection(index);
    }
    return;
  }
  // 非选择模式：点击跳转播放
  if (item.startTime !== -1) {
    setAudioTime(index);
  }
}

/** 歌词行触摸开始 - 检测长按 */
function handleLyricTouchStart(index: number, item: any, e: TouchEvent) {
  if (selectMode.value) return;
  if (!item.text || !item.text.trim()) return;

  longPressTriggered = false;
  longPressStartX = e.touches[0].clientX;
  longPressStartY = e.touches[0].clientY;

  if (longPressTimer) clearTimeout(longPressTimer);
  longPressTimer = setTimeout(() => {
    longPressTriggered = true;
    // 震动反馈
    if (navigator.vibrate) navigator.vibrate(30);
    enterSelectMode(index);
  }, longPressThreshold);
}

/** 歌词行触摸移动 - 取消长按检测 */
function handleLyricTouchMove(e: TouchEvent) {
  if (selectMode.value) return;
  if (!longPressTimer) return;

  const moveX = Math.abs(e.touches[0].clientX - longPressStartX);
  const moveY = Math.abs(e.touches[0].clientY - longPressStartY);
  // 移动超过阈值则取消长按
  if (moveX > 10 || moveY > 10) {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }
}

/** 歌词行触摸结束 */
function handleLyricTouchEnd() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

/** 复制选中的歌词 */
function handleCopyLyrics() {
  const sortedIndices = Array.from(selectedSet.value).sort((a, b) => a - b);
  const lines: string[] = [];
  for (const index of sortedIndices) {
    const item = lrcArray.value[index];
    if (item) {
      lines.push(item.text);
      if (config.value.showTranslation && item.trText) {
        lines.push(item.trText);
      }
    }
  }
  const text = lines.join('\n');
  navigator.clipboard
    ?.writeText(text)
    .then(() => {
      if (navigator.vibrate) navigator.vibrate(20);
    })
    .catch(() => {
      // Fallback for environments without clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    });
  exitSelectMode();
}

/** 生成海报 */
function handleGeneratePoster() {
  const lyrics: SelectedLyric[] = [];
  // 按索引排序
  const sortedIndices = Array.from(selectedSet.value).sort((a, b) => a - b);
  for (const index of sortedIndices) {
    const item = lrcArray.value[index];
    if (item) {
      lyrics.push({
        index,
        text: item.text,
        trText: item.trText || undefined
      });
    }
  }
  emit('generatePoster', lyrics);
  exitSelectMode();
}

// ==================== 拖动 & 滚动逻辑 ====================

const isDragging = ref(false);
const currentTimeText = ref('');
const closestIndex = ref(-1);

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// 点击时间指示器跳转
function handleTimeIndicatorClick() {
  if (closestIndex.value >= 0) {
    setAudioTime(closestIndex.value);
  }
}

// 点击空白区域关闭
function handleEmptyClick() {
  if (selectMode.value) {
    exitSelectMode();
    return;
  }
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
  if (isAutoScrollEnabled.value && !selectMode.value) {
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
    if (!selectMode.value) nextTick(() => scrollToCurrentLyric());
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
    if (!selectMode.value) nextTick(() => scrollToCurrentLyric());
  }, 3000);
};

// 获取当前可视中心歌词的时间
function updateTimeIndicator() {
  if (!scrollerRef.value) return;
  const container = scrollerRef.value;
  const centerY = container.scrollTop + container.clientHeight / 2;
  let closestTime = 0;
  let closestDist = Infinity;
  closestIndex.value = -1;
  for (let i = 0; i < lrcArray.value.length; i++) {
    const el = document.getElementById(`msl-lyric-${i}`);
    if (!el) continue;
    const elCenter = el.offsetTop + el.offsetHeight / 2;
    const dist = Math.abs(elCenter - centerY);
    if (dist < closestDist) {
      closestDist = dist;
      closestIndex.value = i;
      // lrcTimeArray 是秒，formatTime 需要秒
      closestTime = lrcTimeArray.value[i] || 0;
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
  if (longPressTimer) clearTimeout(longPressTimer);
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
  mask-image: linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%);

  &.select-scroller {
    padding-top: 60px;
    padding-bottom: 100px;
    -webkit-mask-image: none;
    mask-image: none;
  }
}

.lyrics-padding-top {
  height: 50vh;
}

.lyrics-padding-bottom {
  height: 50vh;
}

.select-mode .lyrics-padding-top,
.select-mode .lyrics-padding-bottom {
  height: 20px;
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
  display: flex;
  align-items: center;
  gap: 8px;

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

  /* 选择模式样式 */
  &.selectable {
    opacity: 0.7;
    &:active {
      opacity: 0.5;
    }
  }

  &.selected {
    opacity: 1;
    background: rgba(var(--accent-color-rgb, 99, 102, 241), 0.15);
    border-radius: 12px;
  }
}

.lyric-checkbox {
  flex-shrink: 0;
  font-size: 22px;
  color: rgba(var(--accent-color-rgb, 99, 102, 241), 1);

  .ri-checkbox-blank-circle-line {
    color: rgba(255, 255, 255, 0.4);
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
  cursor: pointer;
  font-variant-numeric: tabular-nums;

  &:active {
    background: rgba(0, 0, 0, 0.8);
  }
}

/* ===== 选择模式顶部栏 ===== */
.select-mode-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(var(--safe-area-inset-top, 0px) + 12px) 16px 12px;
  background: rgba(15, 15, 20, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  z-index: 20;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.select-cancel-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 20px;
  flex-shrink: 0;

  &:active {
    transform: scale(0.95);
  }
}

.select-hint {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 8px;
}

.select-count {
  font-size: 13px;
  color: rgba(var(--accent-color-rgb, 99, 102, 241), 1);
  background: rgba(var(--accent-color-rgb, 99, 102, 241), 0.15);
  padding: 2px 10px;
  border-radius: 10px;
}

.select-all-btn {
  font-size: 14px;
  color: rgba(var(--accent-color-rgb, 99, 102, 241), 1);
  padding: 6px 14px;
  border-radius: 16px;
  background: rgba(var(--accent-color-rgb, 99, 102, 241), 0.12);
  flex-shrink: 0;

  &:active {
    transform: scale(0.95);
  }
}

/* ===== 底部操作栏 ===== */
.select-action-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px 20px calc(var(--safe-area-inset-bottom, 0px) + 20px);
  background: rgba(15, 15, 20, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  z-index: 20;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.action-row {
  display: flex;
  gap: 12px;
}

.action-btn {
  flex: 1;
  height: 52px;
  border-radius: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  transition: all 0.2s ease;

  &:active {
    transform: scale(0.98);
  }
}

.copy-btn {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &:active:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
  }
}

.generate-btn {
  background: linear-gradient(
    135deg,
    rgba(var(--accent-color-rgb, 99, 102, 241), 1),
    rgba(var(--accent-color-rgb, 99, 102, 241), 0.8)
  );
  color: #fff;

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

/* ===== 过渡动画 ===== */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(100%);
}
</style>
