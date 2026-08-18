<template>
  <div ref="containerRef" class="splash-container" role="presentation">
    <img class="splash-image" :src="splashImage" alt="" decoding="async" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

import splashImage from '@/assets/splash-launch.png';

const emit = defineEmits<{
  finish: [];
}>();

const containerRef = ref<HTMLElement>();
let finishTimer: number | undefined;

onMounted(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  finishTimer = window.setTimeout(() => emit('finish'), reducedMotion ? 80 : 650);
});

onUnmounted(() => {
  if (finishTimer !== undefined) window.clearTimeout(finishTimer);
});
</script>

<style scoped>
.splash-container {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #ffffff;
  overflow: hidden;
  opacity: 1;
  animation: splash-fade-out 220ms ease-out 430ms forwards;
}

.splash-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
  user-select: none;
  -webkit-user-drag: none;
}

@keyframes splash-fade-out {
  to {
    opacity: 0;
    visibility: hidden;
  }
}

@media (prefers-reduced-motion: reduce) {
  .splash-container {
    animation: none;
  }
}

/* Keep legacy selectors out of the rendered startup surface. */
.splash-left-bar,
.splash-right-bar,
.splash-bottom-bar,
.splash-center {
  display: none;
}

/* Preserve the component's old class names for consumers that still import it. */
.splash-left-text,
.splash-right-title,
.splash-right-author,
.splash-title-zephyrus,
.splash-center-line,
.splash-title-player {
  display: none;
}
</style>
