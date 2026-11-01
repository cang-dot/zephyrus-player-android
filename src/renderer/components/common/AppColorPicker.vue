<template>
  <button
    type="button"
    class="app-color-picker"
    :disabled="disabled"
    role="button"
    :aria-label="title"
    @click="openSheet"
  >
    <span class="app-color-swatch" :style="{ background: modelValue || '#888888' }" />
    <span class="app-color-value">{{ (modelValue || '').toUpperCase() || '——' }}</span>
    <i class="ri-arrow-down-s-line app-color-chevron" />
  </button>

  <Teleport to="body">
    <Transition name="acp-fade">
      <div v-if="open" class="acp-overlay" @click="closeSheet" />
    </Transition>
    <Transition name="acp-rise">
      <div v-if="open" class="acp-sheet" role="dialog">
        <p v-if="title" class="acp-title">{{ title }}</p>

        <div class="acp-preview">
          <span class="acp-preview-block" :style="{ background: modelValue || '#888888' }" />
          <span class="acp-preview-arrow"><i class="ri-arrow-right-line" /></span>
          <span class="acp-preview-block" :style="{ background: draft }" />
          <input
            v-model="hexInput"
            class="acp-hex"
            type="text"
            maxlength="7"
            spellcheck="false"
            @keyup.enter="applyHexInput"
            @blur="applyHexInput"
          />
        </div>

        <div class="acp-palette">
          <button
            v-for="preset in PRESET_COLORS"
            :key="preset"
            type="button"
            class="acp-preset"
            :style="{ background: preset }"
            :class="{ 'is-current': preset.toLowerCase() === draft.toLowerCase() }"
            @click="applyColor(preset)"
          />
        </div>

        <div class="acp-sliders">
          <label class="acp-slider-row">
            <span>色相</span>
            <input v-model.number="hsl.h" type="range" min="0" max="360" step="1" />
          </label>
          <label class="acp-slider-row">
            <span>饱和</span>
            <input v-model.number="hsl.s" type="range" min="0" max="100" step="1" />
          </label>
          <label class="acp-slider-row">
            <span>亮度</span>
            <input v-model.number="hsl.l" type="range" min="0" max="100" step="1" />
          </label>
        </div>

        <div class="acp-actions">
          <button type="button" class="acp-cancel" @click="closeSheet">取消</button>
          <button type="button" class="acp-confirm" @click="confirm">确定</button>
        </div>
        <div class="acp-pad" aria-hidden="true" />
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts" setup>
import { nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';

import { registerMobileBackLayer } from '@/services/mobileBackStack';
import { hexToHsl, hslToHex, normalizeHex } from '@/utils/colorPickerMath';

/**
 * 自写取色器：替代原生 input[type=color]（安卓 WebView 弹系统取色对话框）。
 * 弹层内提供预设色板 + HSL 滑杆 + HEX 输入；「确定」提交，「取消」还原。
 * 颜色以 #rrggbb 小写透传，与原生 color input 的取值口径一致。
 *
 * 关键约束（此前三处会导致「一点开颜色就变」）：
 * 1. HSL 保存浮点，不做整数取整——取整后再转回 hex 会漂移 1-3/通道；
 * 2. 由 hex 反填滑杆时用 syncing 闸门，避免滑杆 watcher 把近似值回写；
 * 3. 打开弹层不 emit，取消时还原打开瞬间的快照（而非可能已被改动的 props）。
 */
defineOptions({ name: 'AppColorPicker' });

const props = defineProps<{
  modelValue: string;
  title?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string]; change: [value: string] }>();

const PRESET_COLORS = [
  '#ffffff',
  '#c9c2b7',
  '#9a9590',
  '#55524e',
  '#1c1b1a',
  '#000000',
  '#ea402f',
  '#fb7299',
  '#e86aa6',
  '#f5a623',
  '#f8d477',
  '#7ba05b',
  '#4caf7d',
  '#37a0a8',
  '#5a8dd6',
  '#7c5cff',
  '#a05ccc',
  '#8e6e5a'
];

const open = ref(false);
const draft = ref(props.modelValue || '#888888');
const hexInput = ref(props.modelValue || '#888888');
const hsl = reactive({ h: 0, s: 0, l: 50 });
let openedValue = props.modelValue || '#888888';
let backDisposer: (() => void) | null = null;
/** 由 hex 反填滑杆期间为 true，阻断滑杆 watcher 的近似回写 */
let syncing = false;

// ---------- 同步 ----------
watch(
  () => props.modelValue,
  (value) => {
    if (open.value) return;
    draft.value = value || '#888888';
    hexInput.value = value || '#888888';
  }
);

/** 由 hex 反填滑杆：同步期间禁用回写，等一帧后恢复 */
function syncHslFromHex(hex: string) {
  const next = hexToHsl(hex);
  syncing = true;
  hsl.h = next.h;
  hsl.s = next.s;
  hsl.l = next.l;
  void nextTick(() => {
    syncing = false;
  });
}

function emitColor(value: string) {
  emit('update:modelValue', value);
  emit('change', value);
}

// 滑杆变化 → 生成 hex（仅用户操作触发）
watch(
  () => hsl,
  () => {
    if (syncing || !open.value) return;
    const next = hslToHex(hsl.h, hsl.s, hsl.l);
    if (next === draft.value) return;
    draft.value = next;
    hexInput.value = next;
    // 与原生 input 的实时行为一致：调色过程持续上抛
    emitColor(next);
  },
  { deep: true }
);

const applyColor = (color: string) => {
  const normalized = normalizeHex(color);
  if (!normalized) return;
  draft.value = normalized;
  hexInput.value = normalized;
  syncHslFromHex(normalized);
  emitColor(normalized);
};

const applyHexInput = () => {
  const normalized = normalizeHex(hexInput.value);
  if (!normalized) {
    hexInput.value = draft.value;
    return;
  }
  applyColor(normalized);
};

const confirm = () => {
  const normalized = normalizeHex(hexInput.value);
  if (normalized) {
    draft.value = normalized;
    emitColor(normalized);
  } else {
    emitColor(draft.value);
  }
  open.value = false;
};

const openSheet = () => {
  if (props.disabled) return;
  openedValue = props.modelValue || '#888888';
  draft.value = openedValue;
  hexInput.value = openedValue;
  syncHslFromHex(openedValue);
  open.value = true;
};

const closeSheet = () => {
  // 取消：还原为打开瞬间的取值（打开后未提交的实时改动一并撤销）
  emitColor(openedValue);
  draft.value = openedValue;
  hexInput.value = openedValue;
  open.value = false;
};

onMounted(() => {
  backDisposer = registerMobileBackLayer({
    id: 'app-color-picker',
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
.app-color-picker {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  border: 1px solid var(--m-border, rgba(128, 128, 128, 0.24));
  border-radius: 999px;
  background: var(--m-surface-alt, rgba(128, 128, 128, 0.06));
  cursor: pointer;

  &:active {
    background: var(--m-surface-hover, rgba(128, 128, 128, 0.12));
  }

  &:disabled {
    opacity: 0.55;
    cursor: default;
  }
}

.app-color-swatch {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  border: 1px solid rgba(128, 128, 128, 0.35);
  border-radius: 50%;
}

.app-color-value {
  color: var(--m-text-secondary, var(--d-text-secondary, inherit));
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.app-color-chevron {
  color: var(--m-text-muted, var(--d-text-muted, #999));
  font-size: 15px;
}

/* 弹层 */
.acp-overlay {
  position: fixed;
  inset: 0;
  z-index: 100201;
  background: rgba(0, 0, 0, 0.4);
}

.acp-sheet {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 100202;
  max-width: 560px;
  margin: 0 auto;
  /* Teleport 到 body 后取不到布局变量：78px = 迷你播放栏播放态占位 */
  padding: 14px 16px calc(var(--safe-area-inset-bottom, 0px) + 90px);
  border-radius: 24px 24px 0 0;
  background: var(--m-surface, #f7f5f1);
  box-shadow: 0 -12px 40px color-mix(in srgb, var(--m-shadow, #000) 24%, transparent);
}

.acp-title {
  margin: 2px 4px 10px;
  color: var(--m-text-primary, var(--d-text-primary));
  font-size: 15px;
  font-weight: 700;
}

.acp-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.acp-preview-block {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 12px;
}

.acp-preview-arrow {
  color: var(--m-text-muted, var(--d-text-muted, #999));
  font-size: 16px;
}

.acp-hex {
  flex: 1;
  min-width: 0;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--m-border, rgba(128, 128, 128, 0.24));
  border-radius: 10px;
  background: transparent;
  color: var(--m-text-primary, var(--d-text-primary));
  font-family: ui-monospace, monospace;
  font-size: 14px;
  outline: none;

  &:focus {
    border-color: var(--accent-color);
  }
}

.acp-palette {
  display: grid;
  grid-template-columns: repeat(9, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.acp-preset {
  aspect-ratio: 1;
  width: 100%;
  border: 1px solid rgba(128, 128, 128, 0.25);
  border-radius: 8px;

  &.is-current {
    box-shadow: 0 0 0 2px var(--accent-color);
  }
}

.acp-sliders {
  display: grid;
  gap: 8px;
  margin-bottom: 14px;
}

.acp-slider-row {
  display: flex;
  align-items: center;
  gap: 12px;

  span {
    width: 32px;
    flex-shrink: 0;
    color: var(--m-text-secondary, var(--d-text-secondary));
    font-size: 12px;
  }

  input[type='range'] {
    flex: 1;
    min-width: 0;
  }
}

.acp-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;

  button {
    min-height: 42px;
    border: 0;
    border-radius: 999px;
    font-size: 14px;
    font-weight: 700;
  }
}

.acp-cancel {
  border: 1px solid var(--m-border, rgba(128, 128, 128, 0.3)) !important;
  background: transparent !important;
  color: var(--m-text-secondary, var(--d-text-secondary)) !important;
}

.acp-confirm {
  background: var(--accent-color);
  color: #fff;
}

.acp-pad {
  height: 2px;
}

.acp-fade-enter-active,
.acp-fade-leave-active {
  transition: opacity 200ms ease;
}

.acp-fade-enter-from,
.acp-fade-leave-to {
  opacity: 0;
}

.acp-rise-enter-active,
.acp-rise-leave-active {
  transition:
    transform 280ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 220ms ease;
}

.acp-rise-enter-from,
.acp-rise-leave-to {
  transform: translateY(102%);
  opacity: 0.4;
}

@media (prefers-reduced-motion: reduce) {
  .acp-fade-enter-active,
  .acp-fade-leave-active,
  .acp-rise-enter-active,
  .acp-rise-leave-active {
    transition-duration: 80ms;
  }
}
</style>
