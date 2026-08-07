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
          <span class="select-count">{{ selectedSet.size }}</span>
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
        v-for="(item, index) in displayLyrics"
        :key="index"
        :id="`msl-lyric-${index}`"
        class="lyric-line"
        :class="{
          'now-text': index === displayIndex,
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

        <span
          v-if="item.hasWordByWord && item.words && item.words.length > 0"
          class="timed-lyric-line"
        >
          <span class="timed-lyric-base" :style="getTimedLineBaseStyle()">{{ item.text }}</span>
          <span
            class="timed-lyric-active"
            aria-hidden="true"
            :style="getTimedLineActiveStyle(index, item)"
            >{{ item.text }}</span
          >
        </span>
        <span v-else :style="getLineStyle(index)">{{ item.text }}</span>
        <div v-if="config.showTranslation && item.trText" class="translation">
          {{ item.trText }}
        </div>
        <div v-if="config.showRomanization && item.romaText" class="romanization">
          {{ item.romaText }}
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

    <!-- 截断提示 Toast -->
    <Transition name="toast">
      <div v-if="toastMsg" class="lyric-toast">
        <i class="ri-information-line"></i>
        <span>{{ toastMsg }}</span>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { useWordTimedPlayback } from '@/composables/useWordTimedPlayback';
import { sound, textColors } from '@/hooks/MusicHook';
import { DEFAULT_LYRIC_CONFIG, type LyricConfig } from '@/types/lyric';
import type { ILyricText } from '@/types/music';
import type { SelectedLyric } from '@/types/share';
import { getTextColors } from '@/utils/linearColor';
import { getTimedLyricLineProgress } from '@/utils/timedLyricProgress';

const { t } = useI18n();
const wordPlayback = useWordTimedPlayback();
const displayLyrics = wordPlayback.displayLines;
const displayTimes = wordPlayback.displayTimes;
const displayIndex = wordPlayback.displayIndex;
const correctedTime = wordPlayback.correctedTime;

const emit = defineEmits<{ close: []; interact: []; generatePoster: [lyrics: SelectedLyric[]] }>();

// ==================== 多选模式 ====================
const POSTER_MAX_LYRICS = 12; // 海报最多展示的歌词行数
const selectMode = ref(false);
const selectedSet = ref<Set<number>>(new Set());

// 长按检测
let longPressTimer: ReturnType<typeof setTimeout> | null = null;
const longPressThreshold = 500; // 500ms
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
    selectedSet.value.add(index);
    selectedSet.value = new Set(selectedSet.value); // 触发响应式
  }
}

/** 全选/取消全选 */
const isAllSelected = computed(() => {
  const validLines = displayLyrics.value.filter((l) => l.text && l.text.trim());
  return validLines.length > 0 && selectedSet.value.size >= validLines.length;
});

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedSet.value = new Set();
  } else {
    const indices: number[] = [];
    for (let i = 0; i < displayLyrics.value.length; i++) {
      if (displayLyrics.value[i].text && displayLyrics.value[i].text.trim()) {
        indices.push(i);
      }
    }
    selectedSet.value = new Set(indices);
  }
}

/** 处理歌词点击 */
function seekToLyric(index: number) {
  const currentSound = sound.value;
  const seekTime = displayTimes.value[index];
  if (!currentSound || !Number.isFinite(seekTime)) return;
  currentSound.seek(seekTime);
  currentSound.play();
}

function handleLyricClick(index: number, item: ILyricText) {
  if (selectMode.value) {
    if (item.text && item.text.trim()) {
      toggleSelection(index);
    }
    return;
  }
  // 非选择模式：点击跳转播放
  if (item.startTime !== -1) {
    seekToLyric(index);
  }
}

/** 歌词行触摸开始 - 检测长按 */
function handleLyricTouchStart(index: number, item: ILyricText, e: TouchEvent) {
  if (selectMode.value) return;
  if (!item.text || !item.text.trim()) return;

  longPressStartX = e.touches[0].clientX;
  longPressStartY = e.touches[0].clientY;

  if (longPressTimer) clearTimeout(longPressTimer);
  longPressTimer = setTimeout(() => {
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
    const item = displayLyrics.value[index];
    if (item) {
      lines.push(item.text);
      if (config.value.showTranslation && item.trText) {
        lines.push(item.trText);
      }
      if (config.value.showRomanization && item.romaText) {
        lines.push(item.romaText);
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
    const item = displayLyrics.value[index];
    if (item) {
      lyrics.push({
        index,
        text: item.text,
        trText: item.trText || undefined
      });
    }
  }
  // 超过海报最大行数时截断
  if (lyrics.length > POSTER_MAX_LYRICS) {
    const truncated = lyrics.slice(0, POSTER_MAX_LYRICS);
    emit('generatePoster', truncated);
    // 提示用户已截断
    if (navigator.vibrate) navigator.vibrate([20, 50, 20]);
    // 使用 toast 提示（通过 emit interact 保持选择模式，然后退出）
    showToast(t('player.share.lyricsTruncated') || `选中内容过长，已截断至${POSTER_MAX_LYRICS}句`);
  } else {
    emit('generatePoster', lyrics);
  }
  exitSelectMode();
}

/** 简易 toast 提示 */
let toastTimer: ReturnType<typeof setTimeout> | null = null;
const toastMsg = ref('');
function showToast(msg: string) {
  toastMsg.value = msg;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastMsg.value = '';
  }, 3000);
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
    seekToLyric(closestIndex.value);
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
  return displayLyrics.value.length > 0 && Number.isFinite(displayTimes.value[0]);
});

// 自动滚动到当前歌词
function scrollToCurrentLyric(immediate = false) {
  if (!isAutoScrollEnabled.value || !scrollerRef.value) return;

  const el = document.getElementById(`msl-lyric-${displayIndex.value}`);
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
watch(displayIndex, () => {
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
  for (let i = 0; i < displayLyrics.value.length; i++) {
    const el = document.getElementById(`msl-lyric-${i}`);
    if (!el) continue;
    const elCenter = el.offsetTop + el.offsetHeight / 2;
    const dist = Math.abs(elCenter - centerY);
    if (dist < closestDist) {
      closestDist = dist;
      closestIndex.value = i;
      closestTime = displayTimes.value[i] || 0;
    }
  }
  currentTimeText.value = formatTime(closestTime);
}

const getTimedLineBaseStyle = () => {
  const colors = textColors.value || getTextColors();
  return { color: colors.primary };
};

const getTimedLineActiveStyle = (lineIndex: number, item: ILyricText) => {
  const colors = textColors.value || getTextColors();
  const progress =
    lineIndex === displayIndex.value && item.words
      ? getTimedLyricLineProgress(item.words, correctedTime.value * 1000)
      : 0;
  const hiddenPercent = Math.max(0, 100 - progress * 100);
  return {
    color: colors.active,
    clipPath: `inset(0 ${hiddenPercent}% 0 0)`,
    WebkitClipPath: `inset(0 ${hiddenPercent}% 0 0)`,
    textShadow: `0 0 8px ${colors.active}40`
  };
};

const getLineStyle = (lineIndex: number) => {
  if (lineIndex !== displayIndex.value) return {};
  const colors = textColors.value || getTextColors();
  const start = displayTimes.value[lineIndex] || 0;
  const itemDuration = (displayLyrics.value[lineIndex]?.duration || 0) / 1000;
  const end = displayTimes.value[lineIndex + 1] ?? start + Math.max(itemDuration, 1);
  const progress = Math.min(
    Math.max((correctedTime.value - start) / Math.max(end - start, 0.001), 0),
    1
  );
  const progressPercent = Math.round(progress * 100);
  return {
    backgroundImage: `linear-gradient(to right, ${colors.active} ${progressPercent}%, ${colors.primary} ${progressPercent}%)`,
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent'
  };
};

onBeforeUnmount(() => {
  if (autoScrollTimer) clearTimeout(autoScrollTimer);
  if (longPressTimer) clearTimeout(longPressTimer);
  if (toastTimer) clearTimeout(toastTimer);
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

.translation,
.romanization {
  font-size: 14px;
  opacity: 0.6;
  margin-top: 4px;
}

.timed-lyric-line {
  position: relative;
  display: inline-grid;
  max-width: 100%;
  place-items: center;
  text-align: center;
}

.timed-lyric-base,
.timed-lyric-active {
  grid-area: 1 / 1;
  max-width: 100%;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.timed-lyric-active {
  pointer-events: none;
  transition: clip-path 50ms linear;
  will-change: clip-path;
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

/* ===== Toast 提示 ===== */
.lyric-toast {
  position: absolute;
  bottom: 120px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 20px;
  background: rgba(20, 20, 25, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  color: #fff;
  font-size: 13px;
  z-index: 30;
  white-space: nowrap;
  max-width: 90%;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}
</style>
