<template>
  <div class="source-accordion" :class="{ expanded }">
    <button type="button" class="source-accordion-trigger" @click="expanded = !expanded">
      <platform-logo
        v-if="activeSource?.platform"
        :platform="activeSource.platform"
        :size="16"
        color="rgba(var(--page-chrome-ink-rgb, 255, 255, 255), 0.9)"
      />
      <i v-else class="ri-stack-line source-accordion-icon" />
      <span class="source-accordion-label">{{ activeSource?.label ?? '' }}</span>
      <span v-if="totalCount > 0" class="source-accordion-count">{{ totalCount }}</span>
      <i class="ri-arrow-down-s-line source-accordion-arrow" />
    </button>
    <div class="source-accordion-body">
      <div class="source-accordion-inner">
        <button
          v-for="source in sources"
          :key="source.key"
          type="button"
          class="source-option"
          :class="{ active: String(source.key) === String(modelValue) }"
          @click="select(source)"
        >
          <platform-logo
            v-if="source.platform"
            :platform="source.platform"
            :size="15"
            color="rgba(var(--page-chrome-ink-rgb, 255, 255, 255), 0.85)"
          />
          <i v-else class="ri-stack-line source-option-icon" />
          <span class="source-option-label">{{ source.label }}</span>
          <span v-if="source.count" class="source-option-count">{{ source.count }}</span>
          <i
            v-if="String(source.key) === String(modelValue)"
            class="ri-check-line source-option-check"
          />
        </button>

        <!-- 本地来源的二级子页签：歌曲/歌手/专辑（原顶栏胶囊子页签迁入） -->
        <div v-if="isLocal" class="local-sub-tabs">
          <button
            v-for="tab in localTabs"
            :key="tab.key"
            type="button"
            class="local-sub-tab"
            :class="{ active: String(localTab) === String(tab.key) }"
            @click="emit('update:localTab', tab.key)"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import PlatformLogo from '@/components/common/PlatformLogo.vue';

export interface SourceAccordionItem {
  key: string | number;
  label: string;
  platform?: string;
  count?: number;
}

const props = withDefaults(
  defineProps<{
    sources: SourceAccordionItem[];
    modelValue: string | number;
    /** 本地来源的二级子页签（仅 modelValue==='local' 时渲染） */
    localTabs?: SourceAccordionItem[];
    localTab?: string | number;
    /** 当前库内条目总数（收起态展示） */
    totalCount?: number;
  }>(),
  {
    localTabs: () => [],
    localTab: '',
    totalCount: 0
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: string | number];
  'update:localTab': [value: string | number];
}>();

const expanded = ref(false);

const activeSource = computed(() =>
  props.sources.find((source) => String(source.key) === String(props.modelValue))
);
const isLocal = computed(() => String(props.modelValue) === 'local');

function select(source: SourceAccordionItem) {
  emit('update:modelValue', source.key);
  if (String(source.key) !== 'local') expanded.value = false;
}
</script>

<style lang="scss" scoped>
.source-accordion {
  margin: 0 16px 12px;
  border-radius: 14px;
  background: rgba(var(--page-chrome-ink-rgb, 255, 255, 255), 0.07);
  border: 1px solid rgba(var(--page-chrome-ink-rgb, 255, 255, 255), 0.08);
  overflow: hidden;
}

.source-accordion-trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 11px 14px;
  border: 0;
  background: transparent;
  color: rgba(var(--page-chrome-ink-rgb, 255, 255, 255), 0.92);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;

  .source-accordion-icon {
    font-size: 17px;
  }

  .source-accordion-label {
    flex: 1;
    min-width: 0;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .source-accordion-count {
    font-size: 12px;
    font-weight: 400;
    color: rgba(var(--page-chrome-ink-rgb, 255, 255, 255), 0.5);
  }

  .source-accordion-arrow {
    font-size: 18px;
    transition: transform 260ms cubic-bezier(0.32, 0.72, 0, 1);
  }
}

.source-accordion.expanded .source-accordion-arrow {
  transform: rotate(180deg);
}

/* 仓内手风琴标准：grid-rows 0fr→1fr */
.source-accordion-body {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 420ms cubic-bezier(0.32, 0.72, 0, 1);
}

.source-accordion.expanded .source-accordion-body {
  grid-template-rows: 1fr;
}

.source-accordion-inner {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 0 8px;
}

.source-accordion.expanded .source-accordion-inner {
  padding-bottom: 8px;
}

.source-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: rgba(var(--page-chrome-ink-rgb, 255, 255, 255), 0.82);
  font-size: 14px;
  cursor: pointer;
  text-align: left;

  .source-option-icon {
    font-size: 16px;
  }

  .source-option-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .source-option-count {
    font-size: 12px;
    color: rgba(var(--page-chrome-ink-rgb, 255, 255, 255), 0.45);
  }

  .source-option-check {
    color: var(--accent-color, #888);
  }

  &.active {
    background: color-mix(in srgb, var(--accent-color, #888) 14%, transparent);
    color: rgba(var(--page-chrome-ink-rgb, 255, 255, 255), 0.95);
  }

  &:active {
    transform: scale(0.99);
  }
}

.local-sub-tabs {
  display: flex;
  gap: 8px;
  padding: 6px 10px 8px;

  .local-sub-tab {
    padding: 5px 14px;
    border: 0;
    border-radius: 999px;
    background: rgba(var(--page-chrome-ink-rgb, 255, 255, 255), 0.08);
    color: rgba(var(--page-chrome-ink-rgb, 255, 255, 255), 0.65);
    font-size: 12px;
    cursor: pointer;

    &.active {
      background: color-mix(in srgb, var(--accent-color, #888) 20%, transparent);
      color: var(--accent-color, #fff);
    }
  }
}
</style>
