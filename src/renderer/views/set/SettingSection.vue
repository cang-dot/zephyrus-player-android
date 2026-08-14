<template>
  <div :id="id" :ref="setRef" class="setting-section mb-6 scroll-mt-20">
    <!-- 设置项列表 -->
    <div class="setting-section-list">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { type ComponentPublicInstance, provide, ref } from 'vue';

import { SETTING_ACCORDION_KEY } from './settingAccordion';

defineOptions({
  name: 'SettingSection'
});

interface Props {
  /** 分组 ID，用于导航定位 */
  id?: string;
  /** 分组标题 */
  title?: string;
  /** 分组描述 */
  description?: string;
}

withDefaults(defineProps<Props>(), {
  id: '',
  title: '',
  description: ''
});

const emit = defineEmits<{
  ref: [el: Element | null];
}>();

const openItemId = ref<string | null>(null);
provide(SETTING_ACCORDION_KEY, {
  openItemId,
  toggle: (itemId) => {
    openItemId.value = openItemId.value === itemId ? null : itemId;
  }
});

// 暴露 ref 给父组件
const setRef = (el: Element | ComponentPublicInstance | null) => {
  emit('ref', el as Element | null);
};
</script>

<style scoped>
.setting-section-list {
  position: relative;
  z-index: 0;
  display: grid;
  gap: 0;
  padding: 4px;
  overflow: visible;
  border-radius: 26px;
  background: color-mix(in srgb, var(--cover-surface, var(--m-surface)) 72%, transparent);
}
.setting-section-list :deep(.setting-item.is-expanded) {
  z-index: 1000;
}
.setting-section-list :deep(.setting-item) {
  border-radius: 20px;
}
.setting-section-list :deep(.setting-item + .setting-item)::before {
  position: absolute;
  top: 0;
  right: 16px;
  left: 16px;
  height: 1px;
  background: color-mix(in srgb, var(--m-text-primary) 8%, transparent);
  content: '';
}
.setting-section-list :deep(.setting-item.is-expanded)::before {
  opacity: 0;
}
</style>
