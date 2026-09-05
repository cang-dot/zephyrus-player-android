<template>
  <div
    v-if="!useTopbar"
    class="glow-tabs"
    :class="{
      'glow-tabs--full': fullWidth,
      'glow-tabs--scroll': scrollable
    }"
  >
    <button
      v-for="tab in tabs"
      :key="tab.key"
      class="glow-tab"
      :class="{ active: String(modelValue) === String(tab.key) }"
      @click="$emit('update:modelValue', tab.key)"
    >
      <div class="glow-tab-radial" />
      <div class="glow-tab-content">
        <i v-if="tab.icon" class="glow-tab-icon" :class="tab.icon" />
        <span class="glow-tab-label">{{ tab.label }}</span>
      </div>
    </button>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  getCurrentInstance,
  inject,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  type Ref,
  watch
} from 'vue';
import { useRoute } from 'vue-router';

import {
  registerMobileTopbarGroup,
  unregisterMobileTopbarGroup
} from '@/composables/useMobileTopbarMenu';
import { isMobile } from '@/utils';
export interface GlowTabItem {
  key: string | number;
  label: string;
  icon?: string;
}

const props = withDefaults(
  defineProps<{
    tabs: GlowTabItem[];
    modelValue: string | number;
    fullWidth?: boolean;
    scrollable?: boolean;
    /** 组件所属页面路径。Tab pager 的四个页面常驻且启动即预挂载相邻页，
     *  挂载/激活时 route.path 可能仍是别的页面，pager 页必须显式声明归属 */
    pagePath?: string;
  }>(),
  {
    fullWidth: false,
    scrollable: false,
    pagePath: ''
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: string | number];
}>();

const route = useRoute();
const instance = getCurrentInstance();
const registryId = `glow-tabs-${instance?.uid ?? Math.random().toString(36).slice(2)}`;
const useTopbar = isMobile;

// 顶栏注册跟随「页面可见性」而非生命周期时机：Tab pager 常驻页不走
// keep-alive 生命周期，onActivated 只在首次挂载时跑一次，若那一刻
// route.path 不是本页（预挂载），注册会落在错误路径且永不修正。
const pagerActivePath = inject<Ref<string> | null>('mobilePagerActivePath', null);
const ownerPath = computed(() => props.pagePath || route.path);
const isVisible = computed(() => {
  const current = pagerActivePath ? pagerActivePath.value : route.path;
  return current === ownerPath.value;
});

const syncTopbar = () => {
  if (!useTopbar.value || !isVisible.value) {
    unregisterMobileTopbarGroup(registryId);
    return;
  }
  registerMobileTopbarGroup({
    id: registryId,
    routePath: ownerPath.value,
    options: props.tabs,
    value: props.modelValue,
    select: (value) => emit('update:modelValue', value)
  });
};

// tabs 内容/选中值/可见性变化都重算注册
watch(() => [props.tabs, props.modelValue, useTopbar.value, isVisible.value], syncTopbar, {
  deep: true
});
onMounted(syncTopbar);
onActivated(syncTopbar);
onDeactivated(() => unregisterMobileTopbarGroup(registryId));
onBeforeUnmount(() => unregisterMobileTopbarGroup(registryId));
</script>

<style lang="scss" scoped>
$spring: cubic-bezier(0.34, 1.56, 0.64, 1);
$smooth: cubic-bezier(0.32, 0.72, 0, 1);

.glow-tabs {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
  border-radius: 9999px;
  background: var(--cover-surface, rgba(128, 128, 128, 0.06));
  border: 1px solid var(--cover-border, rgba(128, 128, 128, 0.1));

  &.glow-tabs--full {
    display: flex;
    width: 100%;

    .glow-tab {
      flex: 1;
      justify-content: center;
    }
  }

  &.glow-tabs--scroll {
    display: flex;
    max-width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;

    &::-webkit-scrollbar {
      display: none;
    }

    .glow-tab {
      flex-shrink: 0;
    }
  }
}

.glow-tab {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  min-width: 32px;
  padding: 0 8px;
  border: none;
  border-radius: 9999px;
  background: transparent;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition:
    padding 240ms $spring,
    min-width 240ms $spring,
    transform 220ms $spring;

  &:active {
    transform: scale(0.97);
  }

  &.active {
    padding: 0 14px;
    min-width: auto;
  }
}

.glow-tab-radial {
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  opacity: 0;
  transform: scale(0.6);
  background: radial-gradient(
    circle,
    rgba(var(--accent-color-rgb, 136, 136, 136), 0.22) 0%,
    rgba(var(--accent-color-rgb, 136, 136, 136), 0.08) 50%,
    transparent 100%
  );
  transition:
    opacity 180ms $smooth,
    transform 240ms $spring;
  pointer-events: none;
}

.glow-tab.active .glow-tab-radial {
  opacity: 1;
  transform: scale(1.1);
}

.glow-tab-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 5px;
}

.glow-tab-icon {
  font-size: 16px;
  color: var(--cover-text-muted, rgba(128, 128, 128, 0.5));
  transition:
    color 180ms $smooth,
    transform 220ms $spring;
}

.glow-tab.active .glow-tab-icon {
  color: var(--accent-color, #888);
  transform: scale(1.15);
}

.glow-tab:hover:not(.active) .glow-tab-icon {
  color: var(--cover-text-primary, rgba(128, 128, 128, 0.8));
  transform: scale(1.05);
}

.glow-tab-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--cover-text-muted, rgba(128, 128, 128, 0.5));
  white-space: nowrap;
  letter-spacing: 0;
  transition:
    color 180ms $smooth,
    font-weight 180ms $smooth;
}

.glow-tab.active .glow-tab-label {
  font-weight: 600;
  color: var(--accent-color, #888);
}

.glow-tab:hover:not(.active) .glow-tab-label {
  color: var(--cover-text-primary, rgba(128, 128, 128, 0.8));
}

@media (prefers-reduced-motion: reduce) {
  .glow-tab,
  .glow-tab-radial,
  .glow-tab-icon,
  .glow-tab-label {
    transition: none;
  }
}
</style>
