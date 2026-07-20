<template>
  <div
    ref="scrollContainer"
    class="cover-scroll-row relative overflow-x-auto overflow-y-hidden"
    style="
      margin-left: calc(var(--page-pl, 1rem) * -1);
      margin-right: calc(var(--page-pr, 1rem) * -1);
      padding-left: var(--page-pl, 1rem);
      padding-right: var(--page-pr, 1rem);
    "
  >
    <div class="cover-track flex gap-3">
      <div
        v-for="(item, index) in items"
        :key="`${item.id}-${index}`"
        class="cover-card pressable flex flex-shrink-0 snap-start flex-col"
        @click="emit('item-click', item)"
      >
        <!-- 封面 -->
        <div class="cover-wrap relative overflow-hidden rounded-xl">
          <img
            v-if="item.cover"
            :src="getImgUrl(item.cover, '300y300')"
            :alt="item.name"
            class="cover-img"
            loading="lazy"
          />
          <div v-else class="cover-placeholder">
            <i class="ri-disc-line text-3xl text-[var(--accent-color)] opacity-40" />
          </div>
          <!-- 常驻播放按钮（触屏无 hover，必须可见） -->
          <button
            v-if="showPlayButton"
            class="cover-play-btn"
            @click.stop="emit('item-play', item)"
          >
            <i class="ri-play-fill" />
          </button>
        </div>
        <!-- 常驻文字信息 -->
        <div class="cover-text">
          <p class="cover-name">{{ item.name }}</p>
          <p v-if="item.subtitle" class="cover-subtitle">{{ item.subtitle }}</p>
        </div>
      </div>
    </div>

    <!-- 边缘渐变提示 -->
    <div
      class="scroll-fade-left pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[var(--m-bg,#fff)] to-transparent transition-opacity duration-300"
      :class="showLeftFade ? 'opacity-100' : 'opacity-0'"
    />
    <div
      class="scroll-fade-right pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--m-bg,#fff)] to-transparent transition-opacity duration-300"
      :class="showRightFade ? 'opacity-100' : 'opacity-0'"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { getImgUrl } from '@/utils';

export interface CoverScrollItem {
  id: number | string;
  name: string;
  subtitle?: string;
  cover?: string;
  [key: string]: any;
}

withDefaults(
  defineProps<{
    items: CoverScrollItem[];
    showPlayButton?: boolean;
  }>(),
  {
    showPlayButton: true
  }
);

const emit = defineEmits<{
  (e: 'item-click', item: CoverScrollItem): void;
  (e: 'item-play', item: CoverScrollItem): void;
}>();

const scrollContainer = ref<HTMLElement | null>(null);
const showLeftFade = ref(false);
const showRightFade = ref(false);

const updateScrollIndicators = () => {
  if (!scrollContainer.value) return;
  const { scrollLeft, scrollWidth, clientWidth } = scrollContainer.value;
  showLeftFade.value = scrollLeft > 20;
  showRightFade.value = scrollLeft < scrollWidth - clientWidth - 20;
};

onMounted(() => {
  setTimeout(updateScrollIndicators, 100);
  scrollContainer.value?.addEventListener('scroll', updateScrollIndicators, { passive: true });
});
</script>

<style scoped>
.cover-scroll-row {
  scrollbar-width: none;
  -ms-overflow-style: none;
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x pan-y;

  &::-webkit-scrollbar {
    display: none;
  }
}

.cover-track {
  min-width: min-content;
}

.cover-card {
  width: 140px;
  cursor: pointer;
  user-select: none;
  scroll-snap-align: start;
  scroll-snap-stop: normal;
}

.cover-wrap {
  width: 140px;
  height: 140px;
  background: var(--m-surface, rgba(128, 128, 128, 0.1));
  box-shadow: 0 2px 10px var(--m-shadow, rgba(0, 0, 0, 0.06));
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    135deg,
    rgba(var(--accent-color-rgb, 136, 136, 136), 0.15),
    rgba(var(--accent-color-rgb, 136, 136, 136), 0.05)
  );
  pointer-events: none;
}

.cover-play-btn {
  position: absolute;
  right: 8px;
  bottom: 8px;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-color, #888);
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  transition: transform 160ms cubic-bezier(0.23, 1, 0.32, 1);

  i {
    margin-left: 1px;
  }

  &:active {
    transform: scale(0.88);
  }
}

.cover-text {
  margin-top: 8px;
  min-width: 0;
}

.cover-name {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--m-text-primary, #2c2c2c);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.cover-subtitle {
  margin-top: 2px;
  font-size: 11px;
  line-height: 1.3;
  color: var(--m-text-muted, #9a9590);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
