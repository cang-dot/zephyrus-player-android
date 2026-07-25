<template>
  <Teleport to="body">
    <Transition name="font-selector">
      <div v-if="visible" class="font-selector-overlay" @click.self="close">
        <div class="font-selector-sheet">
          <!-- 拖拽条 -->
          <div class="drag-handle">
            <div class="drag-bar"></div>
          </div>

          <!-- 标题 -->
          <div class="sheet-header">
            <h3>选择字体</h3>
            <button @click="close" class="close-btn">
              <i class="ri-close-line"></i>
            </button>
          </div>

          <!-- 字体列表 -->
          <div class="font-list">
            <button
              v-for="font in fonts"
              :key="font.id"
              class="font-item"
              :class="{ active: selectedId === font.id }"
              @click="select(font.id)"
            >
              <div class="font-preview" :style="getPreviewStyle(font)">
                {{ previewText }}
              </div>
              <div class="font-info">
                <div class="font-name">{{ font.name }}</div>
                <div class="font-usage">{{ font.usage }}</div>
              </div>
              <i v-if="selectedId === font.id" class="ri-check-line font-check"></i>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { BUILTIN_FONTS, type FontDef } from '@/types/share';
import { ensureFontLoaded, getFontFamily } from '@/utils/fontLoader';

// Props
const props = defineProps<{
  selectedId: string;
}>();

// Emits
const emit = defineEmits<{
  (e: 'select', fontId: string): void;
  (e: 'close'): void;
}>();

const visible = ref(true);
const fonts = ref<FontDef[]>(BUILTIN_FONTS);
const previewText = '雨夜听歌';

// 预加载所有字体
onMounted(async () => {
  await Promise.all(BUILTIN_FONTS.map((f) => ensureFontLoaded(f.id).catch(() => null)));
});

function getPreviewStyle(font: FontDef): Record<string, string> {
  return {
    fontFamily: getFontFamily(font.id)
  };
}

function select(fontId: string) {
  emit('select', fontId);
}

function close() {
  visible.value = false;
  emit('close');
}
</script>

<style scoped lang="scss">
.font-selector-overlay {
  position: fixed;
  inset: 0;
  z-index: 100001;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.font-selector-sheet {
  width: 100%;
  max-width: 500px;
  max-height: 70vh;
  background: rgba(18, 18, 24, 0.95);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border-radius: 24px 24px 0 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.drag-handle {
  display: flex;
  justify-content: center;
  padding: 10px 0 6px;

  .drag-bar {
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.25);
  }
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 20px 16px;

  h3 {
    font-size: 18px;
    font-weight: 700;
    color: #fff;
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.7);
    font-size: 18px;
  }
}

.font-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 2px;
  }
}

.font-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid transparent;
  transition: all 0.2s;

  &.active {
    background: rgba(var(--accent-color-rgb, 99, 102, 241), 0.12);
    border-color: rgba(var(--accent-color-rgb, 99, 102, 241), 0.3);
  }

  &:active {
    transform: scale(0.98);
  }
}

.font-preview {
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  color: rgba(255, 255, 255, 0.9);
  overflow: hidden;
  line-height: 1.2;
  text-align: center;
}

.font-info {
  flex: 1;
  text-align: left;
}

.font-name {
  font-size: 15px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 3px;
}

.font-usage {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

.font-check {
  font-size: 22px;
  color: rgba(var(--accent-color-rgb, 99, 102, 241), 1);
  flex-shrink: 0;
}

/* 过渡动画 */
.font-selector-enter-active,
.font-selector-leave-active {
  transition: opacity 0.3s ease;
}

.font-selector-enter-active .font-selector-sheet,
.font-selector-leave-active .font-selector-sheet {
  transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
}

.font-selector-enter-from,
.font-selector-leave-to {
  opacity: 0;
}

.font-selector-enter-from .font-selector-sheet,
.font-selector-leave-to .font-selector-sheet {
  transform: translateY(100%);
}
</style>
