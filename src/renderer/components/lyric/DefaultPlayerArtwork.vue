<template>
  <button
    type="button"
    class="artwork-frame"
    :class="[`mode-${mode}`, { paused: !playing, loading }]"
    :aria-label="`${title} - 切换封面样式`"
    @click="emit('cycle')"
  >
    <img v-if="displayUrl" :src="displayUrl" :alt="`${title} 封面`" class="artwork-image" />
    <img
      v-if="overlayUrl"
      :src="overlayUrl"
      class="artwork-image artwork-crossfade-overlay"
      :class="{ fading: overlayFading }"
      alt=""
    />
    <span v-else-if="!displayUrl" class="artwork-placeholder" aria-hidden="true">
      <i class="ri-music-2-fill"></i>
    </span>
    <span v-if="loading" class="artwork-loading" aria-hidden="true"></span>
  </button>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';

import { appendArtworkRetry } from '@/utils/artwork';

const props = defineProps<{
  source: string;
  title: string;
  mode: 'record' | 'square' | 'full';
  playing: boolean;
}>();

const emit = defineEmits<{ cycle: [] }>();
const displayUrl = ref('');
const loading = ref(false);
// 换歌叠化:旧封面盖在新图上淡出,新图经 decode 就绪后露出
const overlayUrl = ref('');
const overlayFading = ref(false);
let overlayTimer: ReturnType<typeof setTimeout> | null = null;
let requestVersion = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function startCoverCrossfade(oldUrl: string): void {
  if (!oldUrl) return;
  overlayUrl.value = oldUrl;
  overlayFading.value = false;
  if (overlayTimer) clearTimeout(overlayTimer);
  requestAnimationFrame(() => {
    overlayFading.value = true;
  });
  overlayTimer = setTimeout(() => {
    overlayUrl.value = '';
    overlayFading.value = false;
    overlayTimer = null;
  }, 650);
}

function preload(url: string, version: number, attempt = 0): void {
  const candidate = appendArtworkRetry(url, attempt);
  const image = new Image();
  image.decoding = 'async';
  image.onload = async () => {
    try {
      await image.decode();
    } catch {
      // decode 失败不阻断:img 加载成功即可显示
    }
    if (version !== requestVersion) return;
    const previous = displayUrl.value;
    displayUrl.value = candidate;
    loading.value = false;
    if (previous && previous !== candidate) startCoverCrossfade(previous);
  };
  image.onerror = () => {
    if (version !== requestVersion) return;
    if (attempt < 2) {
      retryTimer = setTimeout(() => preload(url, version, attempt + 1), attempt === 0 ? 240 : 560);
      return;
    }
    loading.value = false;
    if (!displayUrl.value) displayUrl.value = '';
  };
  image.src = candidate;
}

watch(
  () => props.source,
  (source) => {
    requestVersion += 1;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    if (overlayTimer) clearTimeout(overlayTimer);
    overlayTimer = null;
    overlayUrl.value = '';
    overlayFading.value = false;
    const url = String(source || '').trim();
    if (!url) {
      displayUrl.value = '';
      loading.value = false;
      return;
    }
    loading.value = true;
    preload(url, requestVersion);
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  requestVersion += 1;
  if (retryTimer) clearTimeout(retryTimer);
  if (overlayTimer) clearTimeout(overlayTimer);
});
</script>

<style scoped>
.artwork-frame {
  position: relative;
  display: block;
  width: min(72vw, 38dvh, 360px);
  max-width: 100%;
  aspect-ratio: 1;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 8px;
  background: rgba(var(--player-ink-rgb, 255, 255, 255), 0.08);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.22);
  color: rgba(var(--player-ink-rgb, 255, 255, 255), 0.42);
  contain: layout paint;
  /* 控件栏可见态的封面挤压:尺寸内联变更时平滑缩放 */
  transition:
    width 350ms cubic-bezier(0.32, 0.72, 0, 1),
    height 350ms cubic-bezier(0.32, 0.72, 0, 1);
}

.artwork-image,
.artwork-placeholder {
  width: 100%;
  height: 100%;
}

.artwork-image {
  display: block;
  object-fit: cover;
  transform: translateZ(0);
}

/* 换歌叠化:旧封面盖在新图上方整体淡出 */
.artwork-crossfade-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 1;
  transition: opacity 500ms ease;
}

.artwork-crossfade-overlay.fading {
  opacity: 0;
}

.artwork-placeholder {
  display: grid;
  font-size: 56px;
  place-items: center;
}

.mode-record {
  padding: 11%;
  border-radius: 50%;
  background: repeating-radial-gradient(circle, #171717 0 3px, #242424 4px 6px);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.28);
}

.mode-record::after {
  position: absolute;
  inset: 46%;
  border-radius: 50%;
  background: #171717;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.38);
  content: '';
}

.mode-record .artwork-image,
.mode-record .artwork-placeholder,
.mode-record .artwork-crossfade-overlay {
  border-radius: 50%;
}

.mode-record:not(.paused) .artwork-image {
  animation: artwork-spin 22s linear infinite;
}

.mode-full {
  width: min(100%, 520px);
  height: min(40dvh, 420px);
  aspect-ratio: auto;
  border-radius: 0;
  box-shadow: none;
}

.mode-full .artwork-image {
  object-fit: contain;
}

.artwork-loading {
  position: absolute;
  right: 12px;
  bottom: 12px;
  width: 18px;
  height: 18px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: artwork-spin 0.8s linear infinite;
}

@keyframes artwork-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .mode-record:not(.paused) .artwork-image,
  .artwork-loading {
    animation: none;
  }

  .artwork-frame {
    transition: none;
  }

  .artwork-crossfade-overlay.fading {
    transition: none;
    opacity: 0;
  }
}
</style>
