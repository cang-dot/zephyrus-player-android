<template>
  <div class="relative inline-block" :class="widthClass" ref="wrapperRef">
    <button
      :disabled="disabled"
      class="flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-1.5 text-sm transition-all duration-200 select-none disabled:opacity-50 disabled:cursor-not-allowed"
      :class="
        isOpen
          ? 'border-[var(--accent-color)] bg-white dark:bg-neutral-900 ring-2 ring-primary ring-opacity-20'
          : 'border-neutral-200 bg-neutral-50 hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:border-neutral-600'
      "
      @click="toggle"
    >
      <span
        class="truncate"
        :class="selectedLabel ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-400'"
      >
        {{ selectedLabel || placeholder }}
      </span>
      <i
        class="ri-arrow-down-s-line text-base text-neutral-400 transition-transform duration-200 flex-shrink-0"
        :class="{ 'rotate-180': isOpen }"
      />
    </button>

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 -translate-y-1 scale-[0.98]"
        enter-to-class="opacity-100 translate-y-0 scale-100"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100 translate-y-0 scale-100"
        leave-to-class="opacity-0 -translate-y-1 scale-[0.98]"
      >
        <div
          v-if="isOpen"
          ref="dropdownRef"
          class="fixed min-w-[160px] overflow-hidden rounded-xl border border-black/5 bg-white/95 shadow-md dark:border-transparent dark:bg-neutral-900/95 dark:shadow-black/30"
          :style="dropdownStyle"
          @click.stop
        >
          <div class="max-h-[240px] overflow-y-auto py-1 [scrollbar-width:thin]">
            <div
              v-for="opt in options"
              :key="String(opt.value)"
              class="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors"
              :class="
                opt.value === modelValue
                  ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)] font-medium'
                  : 'text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800'
              "
              @click="select(opt.value)"
            >
              <span class="truncate flex-1">{{ opt.label }}</span>
              <i
                v-if="opt.value === modelValue"
                class="ri-check-line text-[var(--accent-color)] text-base flex-shrink-0"
              />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { CSSProperties } from 'vue';
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

defineOptions({ name: 'SSelect' });

type OptionValue = string | number | boolean;

const props = withDefaults(
  defineProps<{
    modelValue?: OptionValue;
    options?: { label: string; value: OptionValue }[];
    placeholder?: string;
    disabled?: boolean;
    width?: string;
  }>(),
  {
    modelValue: undefined,
    options: () => [],
    placeholder: '',
    disabled: false,
    width: 'w-40'
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: OptionValue];
}>();

const isOpen = ref(false);
const wrapperRef = ref<HTMLElement | null>(null);
const dropdownRef = ref<HTMLElement | null>(null);
const dropdownPosition = ref<'bottom' | 'top'>('bottom');
const dropdownStyle = ref<CSSProperties>({});

const widthClass = computed(() => props.width);

const selectedLabel = computed(() => {
  const opt = props.options.find((o) => o.value === props.modelValue);
  return opt?.label ?? '';
});

const toggle = () => {
  if (props.disabled) return;
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    nextTick(checkDropdownPosition);
  }
};

const select = (value: OptionValue) => {
  emit('update:modelValue', value);
  isOpen.value = false;
};

const checkDropdownPosition = () => {
  if (!wrapperRef.value) return;
  const rect = wrapperRef.value.getBoundingClientRect();
  const menuHeight = Math.min(240, Math.max(44, props.options.length * 42 + 8));
  const gap = 6;
  const spaceBelow = window.innerHeight - rect.bottom - 12;
  dropdownPosition.value = spaceBelow < menuHeight + gap ? 'top' : 'bottom';
  const width = Math.min(window.innerWidth - 24, Math.max(160, rect.width));
  const left = Math.min(window.innerWidth - width - 12, Math.max(12, rect.left));
  const top =
    dropdownPosition.value === 'top'
      ? Math.max(12, rect.top - menuHeight - gap)
      : Math.min(window.innerHeight - menuHeight - 12, rect.bottom + gap);
  dropdownStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
    width: `${width}px`,
    zIndex: 100500,
    transformOrigin: dropdownPosition.value === 'top' ? 'bottom center' : 'top center'
  };
};

const onClickOutside = (e: MouseEvent) => {
  if (
    wrapperRef.value &&
    !wrapperRef.value.contains(e.target as Node) &&
    !dropdownRef.value?.contains(e.target as Node)
  ) {
    isOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', onClickOutside);
  window.addEventListener('resize', checkDropdownPosition);
  window.addEventListener('scroll', checkDropdownPosition, true);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside);
  window.removeEventListener('resize', checkDropdownPosition);
  window.removeEventListener('scroll', checkDropdownPosition, true);
});
</script>
