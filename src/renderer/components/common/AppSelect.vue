<template>
  <button
    type="button"
    class="app-select"
    :class="{ 'is-open': open, 'is-placeholder': !currentLabel }"
    :disabled="disabled"
    role="combobox"
    :aria-expanded="open"
    @click="openSheet"
  >
    <span class="app-select-value">{{ currentLabel || placeholder }}</span>
    <i class="ri-arrow-down-s-line app-select-chevron" />
  </button>

  <Teleport to="body">
    <Transition name="app-select-fade">
      <div v-if="open" class="app-select-overlay" @click="closeSheet" />
    </Transition>
    <Transition name="app-select-rise">
      <div v-if="open" class="app-select-sheet" role="listbox">
        <p v-if="title" class="app-select-title">{{ title }}</p>
        <button
          v-for="option in options"
          :key="String(option.value)"
          type="button"
          class="app-select-row"
          role="option"
          :aria-selected="String(option.value) === String(modelValue)"
          :class="{ 'is-selected': String(option.value) === String(modelValue) }"
          @click="pick(option)"
        >
          <span class="app-select-row-label" :style="optionStyle(option)">{{ option.label }}</span>
          <i
            v-if="String(option.value) === String(modelValue)"
            class="ri-check-line app-select-row-check"
          />
        </button>
        <div class="app-select-pad" aria-hidden="true" />
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { registerMobileBackLayer } from '@/services/mobileBackStack';

/**
 * 自写下拉选择：替代原生 select 元素（安卓 WebView 会弹系统单选列表）。
 * 触发钮行内自绘；选项在底部弹层中单选（ListMoreSheet 范式），
 * 明暗跟随 m 系与 d 系颜色变量，底部预留迷你播放栏安全距离。
 */
defineOptions({ name: 'AppSelect' });

interface AppSelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

const props = defineProps<{
  modelValue: string | number;
  options: AppSelectOption[];
  placeholder?: string;
  /** 弹层标题（可选） */
  title?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string | number] }>();

const open = ref(false);
let backDisposer: (() => void) | null = null;

const currentLabel = computed(
  () => props.options.find((option) => String(option.value) === String(props.modelValue))?.label || ''
);

/** 字体选择等场景希望选项文字用其自身体现，标签以 font-family: 前缀暗示 */
const optionStyle = (option: AppSelectOption) => {
  if (!option.label.startsWith('font-family:')) return undefined;
  return { fontFamily: option.label.slice('font-family:'.length).trim() };
};

const openSheet = () => {
  if (props.disabled) return;
  open.value = true;
};

const closeSheet = () => {
  open.value = false;
};

const pick = (option: AppSelectOption) => {
  if (option.disabled) return;
  emit('update:modelValue', option.value);
  closeSheet();
};

onMounted(() => {
  backDisposer = registerMobileBackLayer({
    id: 'app-select-sheet',
    priority: 880,
    isActive: () => open.value,
    onBack: () => closeSheet()
  });
});

onBeforeUnmount(() => {
  backDisposer?.();
});
</script>

<style lang="scss" scoped>
.app-select {
  display: flex;
  width: 100%;
  min-height: 38px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--m-border, rgba(128, 128, 128, 0.24));
  border-radius: 10px;
  background: var(--m-surface-alt, rgba(128, 128, 128, 0.06));
  color: var(--m-text-primary, var(--d-text-primary, inherit));
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 160ms ease,
    background-color 160ms ease;

  &:active {
    background: var(--m-surface-hover, rgba(128, 128, 128, 0.12));
  }

  &.is-open {
    border-color: var(--accent-color);
  }

  &.is-placeholder {
    color: var(--m-text-muted, var(--d-text-muted, #999));
  }

  &:disabled {
    opacity: 0.55;
    cursor: default;
  }
}

.app-select-value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-select-chevron {
  flex-shrink: 0;
  color: var(--m-text-muted, var(--d-text-muted, #999));
  font-size: 17px;
  transition: transform 200ms cubic-bezier(0.32, 0.72, 0, 1);

  .is-open & {
    transform: rotate(180deg);
  }
}

/* 弹层 */
.app-select-overlay {
  position: fixed;
  inset: 0;
  z-index: 120;
  background: rgba(0, 0, 0, 0.4);
}

.app-select-sheet {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 121;
  max-width: 560px;
  margin: 0 auto;
  /* Teleport 到 body 后取不到布局变量：78px = 迷你播放栏播放态占位 */
  padding: 14px 16px calc(var(--safe-area-inset-bottom, 0px) + 90px);
  border-radius: 24px 24px 0 0;
  background: var(--m-surface, #f7f5f1);
  box-shadow: 0 -12px 40px color-mix(in srgb, var(--m-shadow, #000) 24%, transparent);
}

.app-select-title {
  margin: 2px 4px 10px;
  color: var(--m-text-primary, var(--d-text-primary));
  font-size: 15px;
  font-weight: 700;
}

.app-select-row {
  display: flex;
  width: 100%;
  min-height: 48px;
  align-items: center;
  gap: 10px;
  padding: 10px 6px;
  border-radius: 12px;
  color: var(--m-text-primary, var(--d-text-primary));
  font-size: 14px;
  text-align: left;
  transition: background-color 160ms ease;

  &:active {
    background: var(--m-surface-alt, rgba(128, 128, 128, 0.08));
  }

  &.is-selected {
    color: var(--accent-color);
    font-weight: 700;
  }
}

.app-select-row-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-select-row-check {
  flex-shrink: 0;
  font-size: 18px;
}

.app-select-pad {
  height: 2px;
}

.app-select-fade-enter-active,
.app-select-fade-leave-active {
  transition: opacity 200ms ease;
}

.app-select-fade-enter-from,
.app-select-fade-leave-to {
  opacity: 0;
}

.app-select-rise-enter-active,
.app-select-rise-leave-active {
  transition:
    transform 280ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 220ms ease;
}

.app-select-rise-enter-from,
.app-select-rise-leave-to {
  transform: translateY(102%);
  opacity: 0.4;
}

@media (prefers-reduced-motion: reduce) {
  .app-select-fade-enter-active,
  .app-select-fade-leave-active,
  .app-select-rise-enter-active,
  .app-select-rise-leave-active {
    transition-duration: 80ms;
  }
}
</style>
