<template>
  <Transition name="climax-interlude" mode="out-in">
    <div v-if="active" :key="state.key" class="climax-interlude-overlay" aria-hidden="true">
      <img v-if="state.coverUrl" class="climax-interlude-cover" :src="state.coverUrl" alt="" />
      <div class="climax-interlude-title">{{ state.title }}</div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import type { useWordTimedPlayback } from '@/composables/useWordTimedPlayback';

const props = defineProps<{
  state: ReturnType<typeof useWordTimedPlayback>['interludeState']['value'];
}>();

const active = computed(() => props.state.active && Boolean(props.state.title));
</script>

<style scoped>
.climax-interlude-overlay {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: grid;
  place-items: center;
  overflow: hidden;
  pointer-events: none;
}
.climax-interlude-cover {
  position: absolute;
  width: min(62vw, 62vh, 420px);
  height: min(62vw, 62vh, 420px);
  object-fit: cover;
  opacity: 0.16;
  filter: saturate(0.85) contrast(0.9);
  border-radius: 8px;
}
.climax-interlude-title {
  position: relative;
  max-width: 86vw;
  padding: 16px;
  color: var(--player-style-lyric-color, currentColor);
  font-family: var(--player-style-resolved-font, inherit);
  font-size: clamp(38px, 10vw, 112px);
  font-weight: var(--player-style-font-weight, 700);
  line-height: 1.05;
  text-align: center;
  text-wrap: balance;
}
.climax-interlude-enter-active,
.climax-interlude-leave-active {
  transition:
    opacity 260ms ease,
    transform 260ms ease;
}
.climax-interlude-enter-from,
.climax-interlude-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
@media (prefers-reduced-motion: reduce) {
  .climax-interlude-enter-active,
  .climax-interlude-leave-active {
    transition: opacity 140ms linear;
  }
}
</style>
