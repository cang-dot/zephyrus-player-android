<template>
  <Teleport to="body">
    <Transition name="more-sheet-fade">
      <div v-if="visible" class="list-more-sheet-overlay" @click.stop="close" />
    </Transition>
    <Transition name="more-sheet-slide">
      <div v-if="visible" class="list-more-sheet" role="dialog" :aria-label="title">
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
    </Transition>
  </Teleport>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

import type { MobileTopbarAction } from '@/composables/useMobileTopbarMenu';

const props = withDefaults(
  defineProps<{
    visible: boolean;
    actions: MobileTopbarAction[];
    title?: string;
  }>(),
  { title: '' }
);

const emit = defineEmits<{ 'update:visible': [value: boolean] }>();

const activeActionId = ref<string | null>(null);
const activeOptions = computed(() => {
  const action = props.actions.find((item) => item.id === activeActionId.value);
  return action?.options?.length ? action : null;
});

watch(
  () => props.visible,
  (open) => {
    if (!open) activeActionId.value = null;
  }
);

function close() {
  emit('update:visible', false);
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
  left: 10px;
  right: 10px;
  bottom: calc(var(--safe-area-inset-bottom, 0px) + 10px);
  z-index: 301;
  max-height: min(70dvh, 560px);
  overflow-y: auto;
  border-radius: 20px;
  padding: 6px 6px 0;
  background: var(--m-surface-container, var(--m-card, #1d1b19));
  box-shadow: var(--m-elevation-3, 0 8px 32px rgba(0, 0, 0, 0.35));
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

.more-sheet-slide-enter-active,
.more-sheet-slide-leave-active {
  transition:
    transform 240ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 180ms ease;
}

.more-sheet-slide-enter-from,
.more-sheet-slide-leave-to {
  transform: translateY(24px);
  opacity: 0;
}
</style>
