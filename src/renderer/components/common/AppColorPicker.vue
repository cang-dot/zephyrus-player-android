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
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';

import { registerMobileBackLayer } from '@/services/mobileBackStack';

/**
 * 自写取色器：替代原生 input[type=color]（安卓 WebView 弹系统取色对话框）。
 * 弹层内提供预设色板 + HSL 滑杆 + HEX 输入；「确定」提交，「取消」还原。
 * 颜色以 #rrggbb 小写透传，与原生 color input 的取值口径一致。
 */
defineOptions({ name: 'AppColorPicker' });

const props = defineProps<{
  modelValue: string;
  title?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string]; change: [value: string] }>();

const PRESET_COLORS = [
  '#ffffff', '#c9c2b7', '#9a9590', '#55524e', '#1c1b1a', '#000000',
  '#ea402f', '#fb7299', '#e86aa6', '#f5a623', '#f8d477', '#7ba05b',
  '#4caf7d', '#37a0a8', '#5a8dd6', '#7c5cff', '#a05ccc', '#8e6e5a'
];

const open = ref(false);
const draft = ref(props.modelValue || '#888888');
const hexInput = ref(props.modelValue || '#888888');
const hsl = reactive({ h: 0, s: 0, l: 50 });
let backDisposer: (() => void) | null = null;

// ---------- hex <-> hsl ----------
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex: string): [number, number, number] | null {
  const normalized = hex.trim().replace(/^#/, '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16)
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const rgb = hexToRgb(hex);
  if (!rgb) return { h: 0, s: 0, l: 50 };
  const [r255, g255, b255] = rgb.map((v) => v / 255);
  const max = Math.max(r255, g255, b255);
  const min = Math.min(r255, g255, b255);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r255) h = ((g255 - b255) / d + (g255 < b255 ? 6 : 0)) * 60;
    else if (max === g255) h = ((b255 - r255) / d + 2) * 60;
    else h = ((r255 - g255) / d + 4) * 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// ---------- 同步 ----------
watch(
  () => props.modelValue,
  (value) => {
    if (open.value) return;
    draft.value = value || '#888888';
    hexInput.value = value || '#888888';
  }
);

// 弹层内 draft 变化（滑杆）→ 同步 hex 输入
watch(
  () => hsl,
  () => {
    if (!open.value) return;
    draft.value = hslToHex(hsl.h, hsl.s, hsl.l);
    hexInput.value = draft.value;
    // 与原生 input 的实时行为一致：调色过程持续上抛
    emit('update:modelValue', draft.value);
    emit('change', draft.value);
  },
  { deep: true }
);

const applyColor = (color: string) => {
  draft.value = color;
  hexInput.value = color;
  Object.assign(hsl, hexToHsl(color));
  emit('update:modelValue', draft.value);
  emit('change', draft.value);
};

const applyHexInput = () => {
  const rgb = hexToRgb(hexInput.value);
  if (!rgb) {
    hexInput.value = draft.value;
    return;
  }
  applyColor(rgbToHex(rgb[0], rgb[1], rgb[2]));
};

const confirm = () => {
  applyHexInput();
  emit('update:modelValue', draft.value);
  emit('change', draft.value);
  closeSheet();
};

const openSheet = () => {
  if (props.disabled) return;
  draft.value = props.modelValue || '#888888';
  hexInput.value = draft.value;
  Object.assign(hsl, hexToHsl(draft.value));
  open.value = true;
};

const closeSheet = () => {
  // 取消：还原为打开前取值
  emit('update:modelValue', props.modelValue || '#888888');
  emit('change', props.modelValue || '#888888');
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
  z-index: 120;
  background: rgba(0, 0, 0, 0.4);
}

.acp-sheet {
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
