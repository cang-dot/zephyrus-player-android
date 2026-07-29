<template>
  <div ref="containerRef" class="segment-slider">
    <!-- Sliding indicator -->
    <div
      class="segment-indicator"
      :style="indicatorStyle"
    />
    <!-- Tab buttons -->
    <button
      v-for="(tab, index) in tabs"
      :key="tab.key"
      ref="itemRefsArr"
      class="segment-item"
      :class="{ active: String(modelValue) === String(tab.key) }"
      @click="$emit('update:modelValue', tab.key)"
    >
      <span class="segment-label">{{ tab.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

export interface SegmentTabItem {
  key: string | number;
  label: string;
}

const props = withDefaults(defineProps<{
  tabs: SegmentTabItem[];
  modelValue: string | number;
}>(), {});

defineEmits<{
  'update:modelValue': [value: string | number];
}>();

const containerRef = ref<HTMLElement | null>(null);
const itemRefsArr = ref<HTMLElement[]>([]);

const activeIndex = computed(() =>
  props.tabs.findIndex(t => String(t.key) === String(props.modelValue))
);

const indicatorStyle = ref<Record<string, string | number>>({
  transform: 'translateX(0px) scaleX(0)',
  opacity: 0,
});

const updateIndicator = () => {
  nextTick(() => {
    const container = containerRef.value;
    if (!container || props.tabs.length === 0) return;

    const idx = activeIndex.value;
    if (idx < 0) return;

    const containerWidth = container.clientWidth;
    const padding = 3; // matches CSS padding
    const innerWidth = containerWidth - padding * 2;
    const segmentWidth = innerWidth / props.tabs.length;
    const translateX = padding + segmentWidth * idx;

    indicatorStyle.value = {
      transform: `translateX(${translateX}px) scaleX(${segmentWidth})`,
      opacity: 1,
    };
  });
};

const onResize = () => updateIndicator();

onMounted(() => {
  updateIndicator();
  window.addEventListener('resize', onResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
});

watch(() => props.modelValue, () => updateIndicator());
watch(() => props.tabs, () => updateIndicator(), { deep: true });
</script>

<style lang="scss" scoped>
$spring: cubic-bezier(0.34, 1.56, 0.64, 1);
$smooth: cubic-bezier(0.32, 0.72, 0, 1);

.segment-slider {
  position: relative;
  display: flex;
  align-items: center;
  padding: 3px;
  border-radius: 9999px;
  background: var(--cover-surface, rgba(128, 128, 128, 0.08));
  border: 1px solid var(--cover-border, rgba(128, 128, 128, 0.1));
}

.segment-indicator {
  position: absolute;
  top: 3px;
  left: 0;
  height: calc(100% - 6px);
  border-radius: 9999px;
  background: var(--cover-surface-active, rgba(128, 128, 128, 0.15));
  transform-origin: left center;
  transition: transform 0.5s $spring,
              opacity 0.3s ease;
  pointer-events: none;
  z-index: 0;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 9999px;
    background: radial-gradient(
      ellipse at center,
      rgba(var(--accent-color-rgb, 136, 136, 136), 0.15) 0%,
      transparent 70%
    );
  }

  /* 辉光层 — 强调色柔和发光 */
  &::before {
    content: '';
    position: absolute;
    inset: -2px -4px;
    border-radius: 9999px;
    background: radial-gradient(
      ellipse at center,
      rgba(var(--accent-color-rgb, 136, 136, 136), 0.35) 0%,
      rgba(var(--accent-color-rgb, 136, 136, 136), 0.12) 40%,
      transparent 75%
    );
    filter: blur(6px);
    opacity: 0.8;
    pointer-events: none;
    z-index: -1;
  }
}

.segment-item {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 30px;
  border: none;
  border-radius: 9999px;
  background: transparent;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.3s $spring;

  &:active {
    transform: scale(0.92);
  }
}

.segment-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--cover-text-muted, rgba(128, 128, 128, 0.5));
  white-space: nowrap;
  letter-spacing: 0.01em;
  transition: color 0.35s $smooth,
              font-weight 0.35s $smooth;
}

.segment-item.active .segment-label {
  font-weight: 600;
  color: var(--accent-color, #888);
  text-shadow: 0 0 8px rgba(var(--accent-color-rgb, 136, 136, 136), 0.4);
}

.segment-item:hover:not(.active) .segment-label {
  color: var(--cover-text-primary, rgba(128, 128, 128, 0.8));
}

@media (prefers-reduced-motion: reduce) {
  .segment-indicator,
  .segment-item,
  .segment-label {
    transition: none;
  }
}
</style>
