<template>
  <section class="artists-section">
    <!-- Loading Skeleton -->
    <div v-if="loading" class="artists-scroll flex gap-6 md:gap-8 overflow-x-hidden pb-4">
      <div v-for="i in 8" :key="i" class="flex flex-col items-center gap-3">
        <div class="h-20 w-20 md:h-24 md:w-24 lg:h-28 lg:w-28 skeleton-shimmer rounded-full" />
        <div class="h-3 w-16 skeleton-shimmer rounded-lg" />
      </div>
    </div>

    <!-- Artists Horizontal Scroll (Optimized with snap points) -->
    <div
      v-else
      class="artists-scroll-wrap relative"
      style="margin-left: calc(var(--page-pl) * -1); margin-right: calc(var(--page-pr) * -1)"
    >
      <div
        ref="scrollContainer"
        class="artists-scroll overflow-x-auto overflow-y-hidden pt-2"
        style="padding-left: var(--page-pl); padding-right: var(--page-pr)"
        @wheel="handleWheel"
      >
        <div class="artists-track flex gap-6 md:gap-8 lg:gap-10">
          <div
            v-for="(item, index) in artists"
            :key="item.id"
            class="artist-item animate-item group flex flex-shrink-0 snap-start flex-col items-center gap-3 md:gap-4 cursor-pointer"
            :style="{ animationDelay: calculateAnimationDelay(index, 0.04) }"
            @click="navigateToArtist(item.id)"
          >
            <!-- Artist Avatar -->
            <div
              class="artist-avatar relative h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28 lg:h-32 lg:w-32 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800 shadow-lg transition-all duration-500 group-hover:scale-110 group-hover:shadow-2xl group-hover:shadow-primary/20"
            >
              <img
                :src="getImgUrl(item.picUrl, '300y300')"
                class="h-full w-full object-cover grayscale-[0.15] transition-all duration-700 group-hover:grayscale-0 group-hover:brightness-110"
                loading="lazy"
                :alt="item.name"
              />
              <!-- Gradient Overlay on Hover -->
              <div
                class="absolute inset-0 bg-gradient-to-tr from-primary/30 via-primary/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              />
            </div>

            <!-- Artist Name -->
            <span
              class="artist-name text-xs sm:text-sm md:text-base font-semibold text-neutral-700 dark:text-neutral-300 transition-all duration-300 group-hover:text-[var(--accent-color)] dark:group-hover:text-white group-hover:scale-105"
            >
              {{ item.name }}
            </span>
          </div>
        </div>
      </div>

    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { getHotSinger } from '@/api/home';
import { useArtist } from '@/hooks/useArtist';
import { calculateAnimationDelay, getImgUrl, isMobile } from '@/utils';

const props = defineProps<{
  title: string;
  limit?: number;
}>();

const { navigateToArtist } = useArtist();
const artists = ref<any[]>([]);
const loading = ref(true);
const scrollContainer = ref<HTMLElement | null>(null);

const fetchArtists = async () => {
  try {
    const { data } = await getHotSinger({ offset: 0, limit: props.limit || 10 });
    if (data.code === 200) {
      artists.value = data.artists.slice(0, props.limit || 10);
    }
  } catch (error) {
    console.error('Failed to fetch hot artists:', error);
  } finally {
    loading.value = false;
  }
};

// Enhanced horizontal scroll with wheel support
const handleWheel = (e: WheelEvent) => {
  if (isMobile.value) return;
  if (!scrollContainer.value) return;

  // Prevent default vertical scroll
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    e.preventDefault();
    scrollContainer.value.scrollBy({
      left: e.deltaY,
      behavior: 'auto'
    });
  }
};

// Lifecycle
onMounted(() => {
  fetchArtists();
});
</script>

<style scoped>
/* 优化水平滚动 */
.artists-scroll {
  /* Hide scrollbar while maintaining functionality */
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }

  /* Smooth scroll behavior */
  scroll-behavior: smooth;

  /* Enable snap scrolling for better UX */
  scroll-snap-type: x proximity;

  /* Enable momentum scrolling on iOS */
  -webkit-overflow-scrolling: touch;

  /* Optimize for touch */
  touch-action: pan-x pan-y;
}

.artists-track {
  /* Ensure proper width for scrolling */
  min-width: min-content;
}

.artist-item {
  /* Snap alignment */
  scroll-snap-align: start;
  scroll-snap-stop: normal;
}
</style>
