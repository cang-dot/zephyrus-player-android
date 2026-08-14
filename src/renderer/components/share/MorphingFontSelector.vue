<template>
  <div ref="rootRef" class="font-morph" :class="{ expanded: open }">
    <div class="font-morph-surface">
      <button type="button" class="font-morph-trigger" :aria-expanded="open" @click="open = !open">
        <i class="ri-font-size-2" />
        <span>{{ label }}</span>
        <i class="ri-arrow-down-s-line disclosure" />
      </button>
      <div class="font-morph-body" :aria-hidden="!open">
        <div class="font-morph-body-inner">
          <font-selector
            :selected-id="selectedId"
            :allow-default="allowDefault"
            :default-label="defaultLabel"
            @select="select"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onClickOutside } from '@vueuse/core';
import { getCurrentInstance, onBeforeUnmount, onMounted, ref } from 'vue';

import FontSelector from '@/components/share/FontSelector.vue';
import { registerMobileBackLayer } from '@/services/mobileBackStack';

withDefaults(
  defineProps<{
    selectedId: string;
    label: string;
    allowDefault?: boolean;
    defaultLabel?: string;
  }>(),
  { allowDefault: false, defaultLabel: '默认字体' }
);

const emit = defineEmits<{ select: [fontId: string] }>();
const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);
const instanceId = getCurrentInstance()?.uid ?? Math.round(Math.random() * 1_000_000);
let unregisterBackLayer: (() => void) | undefined;

onMounted(() => {
  unregisterBackLayer = registerMobileBackLayer({
    id: `font-selector-${instanceId}`,
    priority: 1000,
    isActive: () => open.value,
    onBack: () => {
      open.value = false;
    }
  });
});

onBeforeUnmount(() => unregisterBackLayer?.());

onClickOutside(rootRef, () => {
  open.value = false;
});

function select(fontId: string) {
  emit('select', fontId);
  open.value = false;
}
</script>

<style scoped lang="scss">
.font-morph {
  position: relative;
  z-index: 1;
  width: min(154px, 42vw);
  height: 36px;
  flex: 0 1 min(154px, 42vw);
  overflow: visible;
}

.font-morph-surface {
  position: absolute;
  top: 0;
  right: 0;
  width: 100%;
  max-height: 36px;
  border: 1px solid color-mix(in srgb, #fff 15%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent-color) 9%, rgba(38, 38, 42, 0.96));
  box-shadow: 0 0 0 transparent;
  overflow: hidden;
  transform-origin: top right;
  transition:
    width 360ms cubic-bezier(0.2, 0.82, 0.2, 1),
    max-height 360ms cubic-bezier(0.2, 0.82, 0.2, 1),
    border-radius 360ms cubic-bezier(0.2, 0.82, 0.2, 1),
    box-shadow 280ms ease,
    background-color 280ms ease;
}

.font-morph.expanded {
  z-index: 60;
}

.font-morph.expanded .font-morph-surface {
  width: min(248px, calc(100vw - 92px));
  max-height: min(264px, 36dvh);
  border-radius: 18px;
  background: color-mix(in srgb, var(--accent-color) 11%, rgba(24, 24, 28, 0.96));
  box-shadow: 0 16px 42px rgba(0, 0, 0, 0.34);
}

.font-morph-trigger {
  display: grid;
  width: 100%;
  min-height: 36px;
  grid-template-columns: 18px minmax(0, 1fr) 18px;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  color: rgba(255, 255, 255, 0.78);
  text-align: left;
}

.font-morph-trigger span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.disclosure {
  transition: transform 280ms cubic-bezier(0.2, 0.82, 0.2, 1);
}

.expanded .disclosure {
  transform: rotate(180deg);
}

.font-morph-body {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition:
    grid-template-rows 360ms cubic-bezier(0.2, 0.82, 0.2, 1),
    opacity 160ms ease;
}

.expanded .font-morph-body {
  grid-template-rows: 1fr;
  opacity: 1;
  transition:
    grid-template-rows 380ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 180ms 90ms ease;
}

.font-morph-body-inner {
  min-height: 0;
  overflow: hidden;
}

.font-morph-body-inner :deep(.font-list) {
  max-height: min(212px, calc(36dvh - 44px));
}

@media (prefers-reduced-motion: reduce) {
  .font-morph,
  .font-morph-surface,
  .font-morph-body,
  .disclosure {
    transition-duration: 120ms;
  }
}
</style>
