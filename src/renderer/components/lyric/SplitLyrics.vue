<template>
  <div class="split-lyrics" :class="[`mode-${mode}`]">
    <!-- 模式 A: 左右分词 -->
    <template v-if="mode === 'split'">
      <!-- 只显示左边 -->
      <template v-if="side === 'left'">
        <div class="lyric-column left-column single-side">
          <span
            v-for="(word, index) in leftWords"
            :key="`left-${index}`"
            class="lyric-word"
            :class="{ active: isWordActive(index, 'left') }"
          >
            {{ word }}
          </span>
        </div>
      </template>
      
      <!-- 只显示右边 -->
      <template v-else-if="side === 'right'">
        <div class="lyric-column right-column single-side">
          <span
            v-for="(word, index) in rightWords"
            :key="`right-${index}`"
            class="lyric-word"
            :class="{ active: isWordActive(index, 'right') }"
          >
            {{ word }}
          </span>
        </div>
      </template>
      
      <!-- 显示两边（中间有分隔线） -->
      <template v-else>
        <div class="lyric-column left-column">
          <span
            v-for="(word, index) in leftWords"
            :key="`left-${index}`"
            class="lyric-word"
            :class="{ active: isWordActive(index, 'left') }"
          >
            {{ word }}
          </span>
        </div>
        <div class="lyric-divider"></div>
        <div class="lyric-column right-column">
          <span
            v-for="(word, index) in rightWords"
            :key="`right-${index}`"
            class="lyric-word"
            :class="{ active: isWordActive(index, 'right') }"
          >
            {{ word }}
          </span>
        </div>
      </template>
    </template>

    <!-- 模式 B: 两句一组 -->
    <template v-else>
      <div class="lyric-pair">
        <div
          class="lyric-line primary-line"
          :class="{ active: true }"
        >
          {{ currentLine?.text || '' }}
        </div>
        <div
          v-if="nextLine"
          class="lyric-line secondary-line"
        >
          {{ nextLine.text }}
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * SplitLyrics - 左右分词歌词组件
 *
 * 支持两种模式：
 * 1. split: 将当前歌词按词分割，左右两列显示
 * 2. group: 同时显示当前行和下一行，当前行高亮
 * 
 * 新增 side 属性：
 * - 'left': 只显示左边部分
 * - 'right': 只显示右边部分
 * - undefined: 显示两边（中间有分隔线）
 */
import { computed } from 'vue';

import type { ILyricText } from '@/types/music';

interface Props {
  mode: 'split' | 'group';
  side?: 'left' | 'right';
  currentLine: ILyricText | null;
  nextLine: ILyricText | null;
  currentTime: number;
  words?: Array<{
    text: string;
    startTime: number;
    duration: number;
  }>;
}

const props = defineProps<Props>();

// 分词函数
function splitIntoWords(text: string): string[] {
  if (!text) return [];

  // 中文按字分割，英文按单词分割
  const words: string[] = [];
  let currentWord = '';

  for (const char of text) {
    // 中文字符直接作为一个词
    if (/[\u4e00-\u9fa5]/.test(char)) {
      if (currentWord) {
        words.push(currentWord);
        currentWord = '';
      }
      words.push(char);
    }
    // 空格分隔英文单词
    else if (char === ' ') {
      if (currentWord) {
        words.push(currentWord);
        currentWord = '';
      }
    }
    // 标点符号单独成词
    else if (/[，。！？、；：""''（）【】《》]/.test(char)) {
      if (currentWord) {
        words.push(currentWord);
        currentWord = '';
      }
      words.push(char);
    }
    // 其他字符（英文、数字）累积
    else {
      currentWord += char;
    }
  }

  // 处理最后一个词
  if (currentWord) {
    words.push(currentWord);
  }

  return words.filter(w => w.trim());
}

// 模式 A: 左右分词
const allWords = computed(() => {
  if (!props.currentLine?.text) return [];
  return splitIntoWords(props.currentLine.text);
});

const leftWords = computed(() => {
  const words = allWords.value;
  const mid = Math.ceil(words.length / 2);
  return words.slice(0, mid);
});

const rightWords = computed(() => {
  const words = allWords.value;
  const mid = Math.ceil(words.length / 2);
  return words.slice(mid);
});

// 判断词是否正在播放（如果有逐字时间信息）
function isWordActive(index: number, column: 'left' | 'right'): boolean {
  if (!props.words || props.words.length === 0) {
    // 没有逐字信息，整句都认为是激活的
    return true;
  }

  const currentTimeMs = props.currentTime * 1000;

  // 计算实际词索引
  let wordIndex = index;
  if (column === 'right') {
    wordIndex += leftWords.value.length;
  }

  const word = props.words[wordIndex];
  if (!word) return false;

  return currentTimeMs >= word.startTime &&
         currentTimeMs < word.startTime + word.duration;
}
</script>

<style scoped>
.split-lyrics {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

/* 模式 A: 左右分词 */
.mode-split {
  flex-direction: row;
}

.lyric-column {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  max-width: 400px;
  font-size: clamp(24px, 4vw, 48px);
  font-weight: 600;
  line-height: 1.6;
}

.lyric-column.single-side {
  max-width: 100%;
}

.left-column {
  justify-content: flex-end;
  text-align: right;
}

.right-column {
  justify-content: flex-start;
  text-align: left;
}

.lyric-divider {
  width: 2px;
  height: 80px;
  background: linear-gradient(
    to bottom,
    transparent,
    rgba(255, 255, 255, 0.3),
    transparent
  );
  flex-shrink: 0;
}

.lyric-word {
  color: rgba(255, 255, 255, 0.5);
  transition: all 0.3s ease;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
}

.lyric-word.active {
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
}

/* 模式 B: 两句一组 */
.mode-group {
  flex-direction: column;
  gap: 1rem;
}

.lyric-pair {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  text-align: center;
}

.lyric-line {
  font-size: clamp(28px, 5vw, 56px);
  font-weight: 600;
  line-height: 1.4;
  transition: all 0.3s ease;
  max-width: 800px;
}

.lyric-line.primary-line {
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 0 30px rgba(255, 255, 255, 0.2);
}

.lyric-line.secondary-line {
  color: rgba(255, 255, 255, 0.4);
  font-size: clamp(20px, 3vw, 36px);
}

/* 响应式 */
@media (max-width: 768px) {
  .split-lyrics {
    gap: 1rem;
    padding: 1rem;
  }

  .lyric-column {
    max-width: 45%;
    font-size: clamp(18px, 5vw, 32px);
  }

  .lyric-column.single-side {
    max-width: 100%;
  }

  .lyric-divider {
    height: 60px;
  }

  .lyric-line {
    font-size: clamp(20px, 6vw, 40px);
  }

  .lyric-line.secondary-line {
    font-size: clamp(16px, 4vw, 28px);
  }
}
</style>
