<template>
  <div
    v-if="placements.length"
    ref="containerRef"
    class="staggered-climax-lyrics"
    :key="lineKey"
    :style="layoutStyle"
  >
    <div
      v-for="row in rows"
      :key="row.row"
      class="staggered-climax-row"
      :style="{ '--row-offset': `${rowOffset(row.row)}px` }"
    >
      <span
        v-for="placement in row.words"
        :key="`${lineKey}:${placement.indexInRow}`"
        class="staggered-climax-word"
        :class="{ revealed: isRevealed(placement.word), active: isActive(placement.word) }"
        :style="wordStyle(placement.indexInRow, row.row, placement.word)"
        >{{ placement.word.text }}</span
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';

import type { ILyricText, IWordData } from '@/types/music';
import {
  arrangeStaggeredWords,
  fitStaggeredTypography,
  resolveStaggeredMaxRows,
  type StaggeredWordPlacement
} from '@/utils/staggeredLyricLayout';

const props = withDefaults(
  defineProps<{
    line: ILyricText | null;
    lineKey: string;
    correctedTime: number;
    fontFamily: string;
    fontSize?: number;
    rowGap?: number;
    offset?: number;
    rotation?: number;
    color?: string;
  }>(),
  {
    fontSize: 48,
    rowGap: 18,
    offset: 14,
    rotation: 5,
    color: 'var(--player-style-lyric-color, #ffffff)'
  }
);

const words = computed<IWordData[]>(() => {
  if (!props.line) return [];
  if (props.line.words?.length) return props.line.words.filter((word) => word.text.trim());
  return props.line.text
    ? [
        {
          text: props.line.text,
          startTime: props.line.startTime || 0,
          duration: props.line.duration || 0
        }
      ]
    : [];
});
const containerRef = ref<HTMLElement | null>(null);
const bounds = reactive({ width: 0, height: 0 });
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  resizeObserver = new ResizeObserver(([entry]) => {
    bounds.width = entry.contentRect.width;
    bounds.height = entry.contentRect.height;
  });
  if (containerRef.value) resizeObserver.observe(containerRef.value);
});
watch(
  containerRef,
  (element, previous) => {
    if (previous) resizeObserver?.unobserve(previous);
    if (element) resizeObserver?.observe(element);
  },
  { flush: 'post' }
);
onBeforeUnmount(() => resizeObserver?.disconnect());

const maxRows = computed(() => resolveStaggeredMaxRows(bounds.width, bounds.height));
const placements = computed(() => arrangeStaggeredWords(words.value, maxRows.value));
const rows = computed(() => {
  const grouped: Array<{ row: number; words: StaggeredWordPlacement<IWordData>[] }> = [];
  for (const placement of placements.value) {
    const row = grouped[placement.row] || { row: placement.row, words: [] };
    row.words.push(placement);
    grouped[placement.row] = row;
  }
  return grouped;
});
const typography = computed(() =>
  fitStaggeredTypography(
    rows.value.map((row) => row.words.map((placement) => placement.word.text)),
    {
      width: bounds.width,
      height: bounds.height,
      requestedFontSize: props.fontSize,
      rowGap: props.rowGap,
      offset: props.offset,
      rotation: props.rotation
    }
  )
);
const layoutStyle = computed(() => ({
  '--staggered-row-gap': `${typography.value.rowGap}px`,
  '--staggered-row-slot': `${typography.value.rowSlotHeight}px`
}));

function isRevealed(word: IWordData) {
  return props.correctedTime * 1000 >= word.startTime;
}
function isActive(word: IWordData) {
  const time = props.correctedTime * 1000;
  return time >= word.startTime && time <= word.startTime + Math.max(1, word.duration);
}
function rowOffset(row: number) {
  return (row % 2 === 0 ? -1 : 1) * typography.value.offset;
}
function wordStyle(indexInRow: number, row: number, word: IWordData) {
  const skew = ((indexInRow + row) % 2 ? 1 : -1) * props.rotation;
  // 逐字过渡时长按分词时长动态计算（25%，90-300ms）：快字不拖尾、慢字不瞬变
  const wordMs = Number(word.duration) || 0;
  const transitionMs = wordMs > 0 ? Math.min(Math.max(wordMs * 0.25, 90), 300) : 180;
  return {
    color: props.color,
    fontFamily: props.fontFamily,
    fontSize: `${typography.value.fontSize}px`,
    '--word-rotation': `${skew}deg`,
    '--word-transition-duration': `${transitionMs}ms`
  };
}
</script>

<style scoped>
.staggered-climax-lyrics {
  position: absolute;
  inset: 14vh 4vw 18vh;
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--staggered-row-gap, 18px);
  overflow: hidden;
  text-align: center;
  pointer-events: none;
}
.staggered-climax-row {
  display: flex;
  align-items: baseline;
  justify-content: center;
  column-gap: 0.08em;
  min-height: var(--staggered-row-slot, 64px);
  max-width: 100%;
  width: 100%;
  flex: 0 0 var(--staggered-row-slot, 64px);
  flex-wrap: nowrap;
  transform: translateY(var(--row-offset));
}
.staggered-climax-word {
  display: inline-block;
  min-width: 1.05em;
  opacity: 0.22;
  font-family: var(--player-style-resolved-font, serif);
  font-weight: var(--player-style-font-weight, 600);
  line-height: 1.08;
  letter-spacing: 0.02em;
  transition:
    opacity var(--word-transition-duration, 180ms) ease,
    transform var(--word-transition-duration, 180ms) ease,
    color var(--word-transition-duration, 180ms) ease;
}
.staggered-climax-word.revealed {
  opacity: 0.78;
}
.staggered-climax-word.active {
  opacity: 1;
  transform: translateY(-0.08em) rotate(var(--word-rotation)) scale(1.08);
}
@media (max-width: 520px) {
  .staggered-climax-lyrics {
    inset-inline: 2vw;
  }
  .staggered-climax-word {
    min-width: 0.9em;
  }
}
@media (prefers-reduced-motion: reduce) {
  .staggered-climax-word {
    transition: none;
    transform: none !important;
  }
}
</style>
