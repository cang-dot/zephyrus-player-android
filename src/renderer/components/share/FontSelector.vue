<template>
  <div ref="fontListRef" class="font-list" role="listbox" aria-label="选择字体">
    <button
      v-if="allowDefault"
      type="button"
      class="font-item"
      :class="{ active: !selectedId }"
      role="option"
      :aria-selected="!selectedId"
      @click="select('')"
    >
      <span class="font-preview default-font-preview">默认</span>
      <span class="font-info">
        <span class="font-name">{{ defaultLabel }}</span>
        <span class="font-usage">保留当前样式的内置字体</span>
      </span>
      <i v-if="!selectedId" class="ri-check-line font-check" />
    </button>
    <button
      v-for="font in fonts"
      :key="font.id"
      type="button"
      class="font-item"
      :class="{ active: selectedId === font.id }"
      :data-font-id="font.id"
      :data-license-url="getFontLicenseUrl(font.id)"
      role="option"
      :aria-selected="selectedId === font.id"
      @click="select(font.id)"
    >
      <span class="font-preview" :style="getPreviewStyle(font)">{{ previewText }}</span>
      <span class="font-info">
        <span class="font-name">{{ font.name }}</span>
        <span class="font-usage">{{ font.usage }}{{ font.license ? ' · OFL' : '' }}</span>
      </span>
      <i v-if="selectedId === font.id" class="ri-check-line font-check" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

import { BUILTIN_FONTS, type FontDef } from '@/types/share';
import { ensureFontLoaded, getFontFamily, getFontLicenseUrl } from '@/utils/fontLoader';

const props = withDefaults(
  defineProps<{
    selectedId: string;
    allowDefault?: boolean;
    defaultLabel?: string;
  }>(),
  { allowDefault: false, defaultLabel: '默认字体' }
);

const emit = defineEmits<{ select: [fontId: string] }>();
const fonts = BUILTIN_FONTS;
const previewText = '雨夜听歌';
const fontListRef = ref<HTMLElement | null>(null);
let previewObserver: IntersectionObserver | null = null;

onMounted(async () => {
  await nextTick();
  if (props.selectedId) void ensureFontLoaded(props.selectedId);
  previewObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const fontId = (entry.target as HTMLElement).dataset.fontId;
        if (fontId) void ensureFontLoaded(fontId);
        previewObserver?.unobserve(entry.target);
      });
    },
    { root: fontListRef.value, rootMargin: '80px 0px' }
  );
  fontListRef.value?.querySelectorAll<HTMLElement>('[data-font-id]').forEach((element) => {
    previewObserver?.observe(element);
  });
});

onBeforeUnmount(() => previewObserver?.disconnect());

function getPreviewStyle(font: FontDef): Record<string, string> {
  return { fontFamily: getFontFamily(font.id) };
}

function select(fontId: string) {
  emit('select', fontId);
}
</script>

<style scoped lang="scss">
.font-list {
  display: grid;
  max-height: min(300px, 42dvh);
  gap: 5px;
  padding: 3px 5px 6px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}

.font-item {
  display: grid;
  min-width: 0;
  grid-template-columns: 42px minmax(0, 1fr) 18px;
  align-items: center;
  gap: 9px;
  padding: 8px;
  border: 1px solid transparent;
  border-radius: 14px;
  background: color-mix(in srgb, #fff 5%, transparent);
  color: rgba(255, 255, 255, 0.9);
  text-align: left;
  transition:
    transform 160ms cubic-bezier(0.22, 1, 0.36, 1),
    background-color 180ms ease,
    border-color 180ms ease;
}

.font-item.active {
  border-color: color-mix(in srgb, var(--accent-color) 42%, transparent);
  background: color-mix(in srgb, var(--accent-color) 17%, transparent);
}

.font-item:active {
  transform: scale(0.985);
}

.font-preview {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  overflow: hidden;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.07);
  font-size: 15px;
  line-height: 1.1;
  text-align: center;
}

.font-info {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.font-name,
.font-usage {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.font-name {
  font-size: 13px;
  font-weight: 650;
}

.font-usage {
  color: rgba(255, 255, 255, 0.46);
  font-size: 10px;
}

.font-check {
  color: var(--accent-color);
  font-size: 17px;
}
</style>
