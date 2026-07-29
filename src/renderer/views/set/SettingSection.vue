<template>
  <div :id="id" :ref="setRef" class="mb-6 scroll-mt-20">
    <!-- 设置项列表 -->
    <div class="space-y-px">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { type ComponentPublicInstance } from 'vue';

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

// 暴露 ref 给父组件
const setRef = (el: Element | ComponentPublicInstance | null) => {
  emit('ref', el as Element | null);
};
</script>
