<template>
  <article
    :id="itemId"
    class="setting-item"
    :class="[
      `setting-item--${effectiveMode}`,
      { 'is-expanded': expanded, 'is-clickable': clickable },
      customClass
    ]"
    :data-setting-title="title"
    :aria-expanded="effectiveMode === 'expandable' ? expanded : undefined"
    @click="handleRootClick"
  >
    <div class="setting-item-summary">
      <div class="setting-item-copy">
        <div class="setting-item-title">
          <slot name="title">{{ title }}</slot>
        </div>
        <div v-if="description || $slots.description" class="setting-item-desc">
          <slot name="description">{{ description }}</slot>
        </div>
      </div>

      <div
        v-if="effectiveMode === 'direct' && ($slots.action || $slots.default)"
        class="setting-item-direct-control"
      >
        <slot name="action"><slot /></slot>
      </div>
      <div v-else-if="effectiveMode === 'expandable'" class="setting-item-current">
        <slot name="value" />
        <i class="ri-arrow-down-s-line" />
      </div>
    </div>

    <div
      v-if="effectiveMode === 'expandable'"
      class="setting-item-details"
      :aria-hidden="!expanded"
    >
      <div class="setting-item-details-inner">
        <div v-if="$slots.extra" class="setting-item-extra"><slot name="extra" /></div>
        <div v-if="$slots.action || $slots.default" class="setting-item-actions">
          <slot name="action"><slot /></slot>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, inject, provide } from 'vue';

import { SETTING_ACCORDION_KEY } from './settingAccordion';

defineOptions({ name: 'SettingItem' });

interface Props {
  title?: string;
  description?: string;
  clickable?: boolean;
  inline?: boolean;
  customClass?: string;
  mode?: 'direct' | 'expandable';
  itemId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  description: '',
  clickable: false,
  inline: false,
  customClass: '',
  mode: 'expandable',
  itemId: ''
});

const emit = defineEmits<{ click: [event: MouseEvent] }>();
const accordion = inject(SETTING_ACCORDION_KEY, null);
const uid = getCurrentInstance()?.uid ?? Math.round(Math.random() * 100000);
const resolvedId = computed(() => props.itemId || `setting-item-${uid}`);
const effectiveMode = computed(() => (props.clickable ? 'direct' : props.mode));
const expanded = computed(
  () => effectiveMode.value === 'expandable' && accordion?.openItemId.value === resolvedId.value
);
provide('settingItemExpanded', expanded);

const isInteractiveTarget = (target: EventTarget | null) =>
  target instanceof Element &&
  Boolean(target.closest('button, input, select, textarea, [role="switch"], [role="slider"], a'));

const handleRootClick = (event: MouseEvent) => {
  if (props.clickable) {
    emit('click', event);
    return;
  }
  if (effectiveMode.value !== 'expandable' || isInteractiveTarget(event.target)) return;
  accordion?.toggle(resolvedId.value);
};
</script>

<style scoped lang="scss">
.setting-item {
  position: relative;
  overflow: visible;
  border: 0;
  border-radius: 20px;
  background: transparent;
  box-shadow: none;
  color: var(--m-text-primary, var(--d-text-primary));
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  transition:
    border-radius 360ms cubic-bezier(0.32, 0.72, 0, 1),
    background-color 180ms ease,
    box-shadow 260ms ease,
    transform 180ms cubic-bezier(0.32, 0.72, 0, 1);
}

.setting-item.is-expanded {
  z-index: 100;
}

.setting-item-summary {
  display: flex;
  min-height: 72px;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 16px;
}

.setting-item-copy {
  min-width: 0;
  flex: 1;
}
.setting-item-title {
  color: var(--m-text-primary, var(--d-text-primary));
  font-size: 15px;
  font-weight: 650;
}
.setting-item-desc {
  margin-top: 3px;
  color: var(--m-text-secondary, var(--d-text-secondary));
  font-size: 12px;
  line-height: 1.45;
}
.setting-item-direct-control {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
}
.setting-item-current {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 5px;
  color: var(--m-text-secondary);
}
.setting-item-current i {
  font-size: 18px;
  transition: transform 360ms cubic-bezier(0.32, 0.72, 0, 1);
}
.setting-item.is-expanded .setting-item-current i {
  transform: rotate(180deg);
}

.setting-item--expandable {
  cursor: pointer;
}
.setting-item--expandable:active,
.setting-item.is-clickable:active {
  transform: scale(0.988);
}

.setting-item-details {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transform: translate3d(0, -8px, 0);
  transition:
    grid-template-rows 420ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 170ms ease,
    transform 360ms cubic-bezier(0.32, 0.72, 0, 1);
}
.setting-item-details-inner {
  min-height: 0;
  overflow: hidden;
}
.setting-item.is-expanded .setting-item-details-inner {
  overflow: visible;
}

@media (prefers-color-scheme: dark) {
  .setting-item {
    border-color: transparent;
    box-shadow: none;
  }
}
.setting-item.is-expanded .setting-item-details {
  grid-template-rows: 1fr;
  opacity: 1;
  transform: none;
  transition-delay: 0ms, 80ms, 30ms;
}
.setting-item-actions,
.setting-item-extra {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 10px;
  padding: 0 16px 16px;
}
.setting-item-actions {
  justify-content: flex-end;
}

@media (prefers-reduced-motion: reduce) {
  .setting-item,
  .setting-item-details,
  .setting-item-current i {
    transition-duration: 120ms;
  }
}
</style>
