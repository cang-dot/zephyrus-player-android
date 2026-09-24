<template>
  <Teleport to="body">
    <Transition name="more-sheet-fade">
      <div v-if="visible" class="list-more-sheet-overlay" @click.stop="close" />
    </Transition>
    <div
      v-if="visible"
      ref="sheetRef"
      class="list-more-sheet"
      :class="{ closing }"
      role="dialog"
      :aria-label="title"
    >
      <div class="list-more-sheet-handle" aria-hidden="true" />
      <!-- 一级：动作列表 -->
      <template v-if="!activeOptions">
        <p v-if="title" class="list-more-sheet-title">{{ title }}</p>
        <button
          v-for="action in actions"
          :key="action.id"
          type="button"
          class="list-more-row"
          @click="runAction(action)"
        >
          <i :class="action.icon" aria-hidden="true" />
          <span class="list-more-row-label">{{ action.label }}</span>
          <i v-if="action.options?.length" class="ri-arrow-right-s-line list-more-row-arrow" />
        </button>
      </template>
      <!-- 二级：选项列表（排序、加入歌单等） -->
      <template v-else>
        <button type="button" class="list-more-row list-more-sub-header" @click="backToRoot">
          <i class="ri-arrow-left-s-line" aria-hidden="true" />
          <span class="list-more-row-label">{{ activeOptions.label }}</span>
        </button>
        <button
          v-for="option in activeOptions.options"
          :key="option.key"
          type="button"
          class="list-more-row"
          @click="runOption(option)"
        >
          <span class="list-more-row-label">{{ option.label }}</span>
          <i
            v-if="String(option.key) === String(activeOptions.value)"
            class="ri-check-line list-more-row-check"
            aria-hidden="true"
          />
        </button>
      </template>
      <div class="list-more-sheet-pad" aria-hidden="true" />
    </div>
  </Teleport>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref, watch } from 'vue';

import type { MobileTopbarAction } from '@/composables/useMobileTopbarMenu';

const props = withDefaults(
  defineProps<{
    visible: boolean;
    actions: MobileTopbarAction[];
    title?: string;
    /** 触发胶囊的矩形：菜单由它形变展开/缩回（不传则退化为普通浮现） */
    origin?: { x: number; y: number; w: number; h: number } | null;
  }>(),
  { title: '', origin: null }
);

const emit = defineEmits<{ 'update:visible': [value: boolean] }>();

const sheetRef = ref<HTMLElement | null>(null);
const closing = ref(false);
const activeActionId = ref<string | null>(null);
const activeOptions = computed(() => {
  const action = props.actions.find((item) => item.id === activeActionId.value);
  return action?.options?.length ? action : null;
});

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** 胶囊 → 菜单的 FLIP 逆变换（右上映射） */
function applyFlip(el: HTMLElement, opacity: string) {
  const origin = props.origin;
  if (!origin) return false;
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height || origin.w <= 0 || origin.h <= 0) return false;
  const sx = Math.max(0.05, origin.w / rect.width);
  const sy = Math.max(0.05, origin.h / rect.height);
  const dx = origin.x + origin.w - (rect.x + rect.width);
  const dy = origin.y - rect.y;
  el.style.transition = 'none';
  el.style.transformOrigin = 'top right';
  el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
  el.style.opacity = opacity;
  return true;
}

function playOpenFlip() {
  const el = sheetRef.value;
  if (!el) return;
  if (prefersReducedMotion() || !applyFlip(el, '0.35')) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.transition = 'transform 260ms cubic-bezier(0.32, 0.72, 0, 1), opacity 200ms ease';
      el.style.transform = '';
      el.style.opacity = '';
    });
  });
}

watch(
  () => props.visible,
  (open) => {
    if (open) {
      activeActionId.value = null;
      closing.value = false;
      void nextTick(playOpenFlip);
    }
  },
  { immediate: true }
);

function close() {
  if (closing.value) return;
  const el = sheetRef.value;
  if (!el || prefersReducedMotion() || !props.origin) {
    emit('update:visible', false);
    return;
  }
  // 缩回触发胶囊后再卸载
  closing.value = true;
  const rect = el.getBoundingClientRect();
  const sx = Math.max(0.05, props.origin.w / rect.width);
  const sy = Math.max(0.05, props.origin.h / rect.height);
  const dx = props.origin.x + props.origin.w - (rect.x + rect.width);
  const dy = props.origin.y - rect.y;
  el.style.transformOrigin = 'top right';
  el.style.transition = 'transform 180ms cubic-bezier(0.32, 0.72, 0, 1), opacity 160ms ease';
  el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
  el.style.opacity = '0';
  setTimeout(() => {
    closing.value = false;
    emit('update:visible', false);
  }, 190);
}

function runAction(action: MobileTopbarAction) {
  if (action.options?.length) {
    activeActionId.value = action.id;
    return;
  }
  action.run();
  close();
}

function backToRoot() {
  activeActionId.value = null;
}

function runOption(option: { key: string | number; label: string }) {
  activeOptions.value?.select?.(option.key);
  close();
}
</script>

<style lang="scss" scoped>
.list-more-sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 300;
  background: rgba(0, 0, 0, 0.42);
}

.list-more-sheet {
  position: fixed;
  top: calc(var(--safe-area-inset-top, 0px) + 60px);
  right: 12px;
  z-index: 301;
  width: min(78vw, 320px);
  max-height: min(64dvh, 520px);
  overflow-y: auto;
  border-radius: 20px;
  padding: 6px 6px 0;
  transform-origin: top right;
  background: color-mix(
    in srgb,
    var(--page-chrome-bg, var(--m-surface-container, var(--m-card, #1d1b19))) 88%,
    rgba(var(--page-chrome-ink-rgb, 23, 23, 26), 0.45) 12%
  );
  box-shadow: var(--m-elevation-3, 0 8px 32px rgba(0, 0, 0, 0.35));
  color: rgba(var(--page-chrome-ink-rgb, 23, 23, 26), 0.92);
  --d-text-primary: rgba(var(--page-chrome-ink-rgb, 23, 23, 26), 0.92);
  --d-text-secondary: rgba(var(--page-chrome-ink-rgb, 23, 23, 26), 0.55);
}

.list-more-sheet-handle {
  width: 38px;
  height: 4px;
  margin: 6px auto 4px;
  border-radius: 2px;
  background: rgba(var(--page-chrome-ink-rgb, 128, 128, 128), 0.28);
}

.list-more-sheet-title {
  margin: 2px 14px 8px;
  font-size: 13px;
  color: var(--d-text-secondary, rgba(255, 255, 255, 0.55));
}

.list-more-row {
  @apply flex items-center w-full;
  gap: 12px;
  padding: 13px 14px;
  border: 0;
  background: transparent;
  color: var(--d-text-primary, rgba(255, 255, 255, 0.92));
  font-size: 15px;
  cursor: pointer;
  text-align: left;

  i {
    font-size: 19px;
  }

  &:active {
    background: var(--d-surface-hover, rgba(255, 255, 255, 0.06));
  }
}

.list-more-sub-header {
  color: var(--d-text-secondary, rgba(255, 255, 255, 0.6));
  font-size: 13px;
}

.list-more-row-label {
  @apply flex-1 min-w-0 truncate;
}

.list-more-row-arrow,
.list-more-row-check {
  color: var(--d-text-secondary, rgba(255, 255, 255, 0.5));
}

.list-more-sheet-pad {
  height: 8px;
}

.more-sheet-fade-enter-active,
.more-sheet-fade-leave-active {
  transition: opacity 180ms ease;
}

.more-sheet-fade-enter-from,
.more-sheet-fade-leave-to {
  opacity: 0;
}

.list-more-sheet.closing {
  pointer-events: none;
}
</style>
