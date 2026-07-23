<template>
  <div class="beat-flash-layer" :style="{ opacity: beatSpike }"></div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { nowTime } from '@/hooks/MusicHook';
import { drumDetector } from '@/services/drumDetector';
import { useClimaxStore } from '@/store/modules/climax';

const climaxStore = useClimaxStore();

// 当前是否在高潮段落内
const isInClimax = computed(() => {
  const t = nowTime.value;
  return climaxStore.segments.some((seg) => t >= seg.start && t <= seg.end);
});

// 鼓点闪白
const beatSpike = ref(0);
let spikeTimer: ReturnType<typeof setTimeout> | null = null;
const SPIKE_DURATION = 150;
let unsubscribeBeat: (() => void) | null = null;

function startBeatListening() {
  if (unsubscribeBeat) return;
  drumDetector.start();
  unsubscribeBeat = drumDetector.onBeat((info: any) => {
    beatSpike.value = info.isStrong ? 0.5 : 0.35;
    if (spikeTimer) clearTimeout(spikeTimer);
    spikeTimer = setTimeout(() => {
      beatSpike.value = 0;
    }, SPIKE_DURATION);
  });
}

function stopBeatListening() {
  if (unsubscribeBeat) {
    unsubscribeBeat();
    unsubscribeBeat = null;
  }
  drumDetector.stop();
  beatSpike.value = 0;
  if (spikeTimer) {
    clearTimeout(spikeTimer);
    spikeTimer = null;
  }
}

// 高潮期间启动鼓点检测
watch(
  isInClimax,
  (active) => {
    if (active) {
      startBeatListening();
    } else {
      stopBeatListening();
    }
  },
  { immediate: true }
);

// 切歌时加载高潮段落
watch(
  () => climaxStore.segments,
  () => {
    // climaxStore 自动管理 segments
  }
);

onBeforeUnmount(() => {
  stopBeatListening();
});
</script>

<style scoped>
.beat-flash-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: white;
  pointer-events: none;
  z-index: 5;
}
</style>
