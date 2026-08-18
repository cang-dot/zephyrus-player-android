<template>
  <div class="status-lyric-settings" @click.stop>
    <div class="setting-line">
      <div>
        <strong>{{ st('enable') }}</strong
        ><small>{{ st('enableDesc') }}</small>
      </div>
      <n-switch :value="config.enabled" @update:value="setEnabled" />
    </div>

    <div class="preview-toolbar">
      <div class="segmented">
        <button :class="{ active: orientation === 'portrait' }" @click="orientation = 'portrait'">
          {{ st('portrait') }}
        </button>
        <button :class="{ active: orientation === 'landscape' }" @click="orientation = 'landscape'">
          {{ st('landscape') }}
        </button>
      </div>
    </div>

    <div class="position-grid">
      <label>
        <span>X {{ formatPositionPercent(currentPosition.x) }}%</span>
        <div class="position-stepper">
          <button type="button" aria-label="X -0.5%" @click="adjustPosition('x', -0.005)">
            <i class="ri-subtract-line" />
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.005"
            :value="currentPosition.x"
            @input="setPosition('x', $event)"
            @change="finishLivePreview"
            @pointercancel="finishLivePreview"
            @pointerup="finishLivePreview"
          />
          <button type="button" aria-label="X +0.5%" @click="adjustPosition('x', 0.005)">
            <i class="ri-add-line" />
          </button>
        </div>
      </label>
      <label>
        <span>Y {{ formatPositionPercent(currentPosition.y) }}%</span>
        <div class="position-stepper">
          <button type="button" aria-label="Y -0.1%" @click="adjustPosition('y', -0.001)">
            <i class="ri-subtract-line" />
          </button>
          <input
            type="range"
            min="0"
            max="0.1"
            step="0.001"
            :value="currentPosition.y"
            @input="setPosition('y', $event)"
            @change="finishLivePreview"
            @pointercancel="finishLivePreview"
            @pointerup="finishLivePreview"
          />
          <button type="button" aria-label="Y +0.1%" @click="adjustPosition('y', 0.001)">
            <i class="ri-add-line" />
          </button>
        </div>
      </label>
    </div>

    <div class="setting-line">
      <div>
        <strong>{{ st('wordByWord') }}</strong
        ><small>{{ st('wordByWordDesc') }}</small>
      </div>
      <n-switch v-model:value="config.wordByWord" />
    </div>

    <div class="setting-line width-mode-line">
      <div>
        <strong>{{ st('capsuleWidth') }}</strong>
        <small>{{ st('capsuleWidthDesc') }}</small>
      </div>
      <div class="segmented">
        <button
          :class="{ active: config.capsule.widthMode === 'fit' }"
          @click="config.capsule.widthMode = 'fit'"
        >
          {{ st('widthFit') }}
        </button>
        <button
          :class="{ active: config.capsule.widthMode === 'fixed' }"
          @click="config.capsule.widthMode = 'fixed'"
        >
          {{ st('widthFixed') }}
        </button>
      </div>
    </div>

    <label v-if="config.capsule.widthMode === 'fixed'" class="control-block opacity-control">
      <span>{{ st('fixedWidth') }} {{ Math.round(config.capsule.fixedWidthDp) }}dp</span>
      <input
        v-model.number="config.capsule.fixedWidthDp"
        type="range"
        min="48"
        max="420"
        step="2"
      />
    </label>

    <label class="control-block">
      <span
        ><strong>{{ st('font') }}</strong
        ><small>{{ st('fontDesc') }}</small></span
      >
      <select v-model="fontSelection" class="glass-select">
        <option value="system">{{ st('systemFont') }}</option>
        <option v-for="font in nativeFonts" :key="font.id" :value="`builtin:${font.id}`">
          {{ font.name }}
        </option>
        <option
          v-if="config.font.source === 'imported' && config.font.id"
          :value="`imported:${config.font.id}`"
        >
          {{ st('importedFont') }}
        </option>
      </select>
    </label>

    <div class="slider-row">
      <label
        ><span>{{ st('fontSize') }} {{ config.font.sizeSp }}sp</span
        ><input v-model.number="config.font.sizeSp" type="range" min="9" max="28" step="1"
      /></label>
      <label
        ><span>{{ st('fontWeight') }} {{ config.font.weight }}</span
        ><input v-model.number="config.font.weight" type="range" min="100" max="900" step="100"
      /></label>
    </div>

    <label class="import-font glass-button">
      <i class="ri-font-size-2" />{{ st('importFont') }}
      <input type="file" accept=".ttf,.otf,font/ttf,font/otf" @change="importFont" />
    </label>

    <section class="color-grid">
      <article v-for="part in colorParts" :key="part.key" class="color-control">
        <strong>{{ part.label }}</strong>
        <div class="segmented color-source">
          <button
            :class="{ active: getColor(part.key).source === 'theme' }"
            @click="setColorSource(part.key, 'theme')"
          >
            {{ st('theme') }}
          </button>
          <button
            :class="{ active: getColor(part.key).source === 'custom' }"
            @click="setColorSource(part.key, 'custom')"
          >
            {{ st('custom') }}
          </button>
        </div>
        <input
          v-if="getColor(part.key).source === 'custom'"
          type="color"
          :value="getColor(part.key).color"
          @input="setColorValue(part.key, ($event.target as HTMLInputElement).value)"
        />
      </article>
    </section>

    <section class="surface-grid">
      <article v-for="part in surfaceParts" :key="part.key" class="color-control surface-control">
        <div class="surface-control-heading">
          <strong>{{ part.label }}</strong>
          <n-switch
            :value="surfaceEnabled(part.key)"
            @update:value="setSurfaceEnabled(part.key, $event)"
          />
        </div>
        <template v-if="surfaceEnabled(part.key)">
          <div class="segmented color-source">
            <button
              :class="{ active: getColor(part.key).source === 'theme' }"
              @click="setColorSource(part.key, 'theme')"
            >
              {{ st('theme') }}
            </button>
            <button
              :class="{ active: getColor(part.key).source === 'custom' }"
              @click="setColorSource(part.key, 'custom')"
            >
              {{ st('custom') }}
            </button>
          </div>
          <input
            v-if="getColor(part.key).source === 'custom'"
            type="color"
            :value="getColor(part.key).color"
            @input="setColorValue(part.key, ($event.target as HTMLInputElement).value)"
          />
        </template>
      </article>
    </section>

    <label v-if="config.colors.surface.fillEnabled" class="control-block opacity-control">
      <span>{{ st('opacity') }} {{ Math.round(config.colors.surface.opacity * 100) }}%</span>
      <input
        v-model.number="config.colors.surface.opacity"
        type="range"
        min="0"
        max="1"
        step="0.05"
      />
    </label>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core';
import type { Ref } from 'vue';
import { computed, inject, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
  applyStatusBarLyricLiveConfig,
  hasStatusBarLyricPermission,
  installStatusBarLyricFont,
  readStatusBarLyricConfig,
  requestStatusBarLyricPermission,
  saveStatusBarLyricConfig,
  setStatusBarLyricInAppVisible
} from '@/services/androidNative';
import {
  normalizeStatusBarLyricConfig,
  type StatusBarLyricColorSource,
  type StatusBarLyricConfig
} from '@/types/lyric';
import { BUILTIN_FONTS } from '@/types/share';

type ColorKey = 'sung' | 'current' | 'upcoming' | 'fill' | 'border';
const emit = defineEmits<{ 'update:enabled': [enabled: boolean] }>();
const { t } = useI18n();
const st = (key: string) => t(`settings.lyricSettings.statusBarLyricOptions.${key}`);
const config = reactive<StatusBarLyricConfig>(readStatusBarLyricConfig());
const orientation = ref<'portrait' | 'landscape'>('portrait');
const nativeFonts = BUILTIN_FONTS.filter((font) => font.format !== 'woff2');
const colorParts: Array<{ key: ColorKey; label: string }> = [
  { key: 'sung', label: st('sung') },
  { key: 'current', label: st('current') },
  { key: 'upcoming', label: st('upcoming') }
];
const surfaceParts: Array<{ key: 'fill' | 'border'; label: string }> = [
  { key: 'fill', label: st('surfaceFill') },
  { key: 'border', label: st('surfaceBorder') }
];

// 设置项展开期间，状态栏歌词悬浮窗持续显示在应用上层（真实歌词，非假数据）；
// 收起或离开页面时恢复常规行为（应用前台时隐藏悬浮窗）。
const settingExpanded = inject<Ref<boolean>>('settingItemExpanded', ref(true));
watch(settingExpanded, (expanded) => setStatusBarLyricInAppVisible(expanded), { immediate: true });

const fontSelection = computed({
  get: () =>
    config.font.source === 'system' ? 'system' : `${config.font.source}:${config.font.id || ''}`,
  set: (value: string) => {
    const [source, ...id] = value.split(':');
    config.font.source = source as StatusBarLyricConfig['font']['source'];
    config.font.id = source === 'system' ? undefined : id.join(':');
  }
});

const currentPosition = computed(() => config.positions[orientation.value]);
const previewActive = computed(() => settingExpanded.value);
let livePreviewFrame: number | null = null;
let livePreviewFinishFrame: number | null = null;
const formatPositionPercent = (value: number) => (value * 100).toFixed(1).replace(/\.0$/, '');
const updateLivePreview = () => {
  if (livePreviewFrame !== null) return;
  livePreviewFrame = window.requestAnimationFrame(() => {
    livePreviewFrame = null;
    applyStatusBarLyricLiveConfig(normalizeStatusBarLyricConfig(config));
  });
};
const finishLivePreview = () => {
  if (livePreviewFinishFrame !== null) window.cancelAnimationFrame(livePreviewFinishFrame);
  livePreviewFinishFrame = window.requestAnimationFrame(() => {
    livePreviewFinishFrame = null;
    if (livePreviewFrame !== null) {
      window.cancelAnimationFrame(livePreviewFrame);
      livePreviewFrame = null;
      applyStatusBarLyricLiveConfig(normalizeStatusBarLyricConfig(config));
    }
    const saved = saveStatusBarLyricConfig(normalizeStatusBarLyricConfig(config), {
      applyNative: false,
      notify: false
    });
    emit('update:enabled', saved.enabled);
  });
};
const setPosition = (axis: 'x' | 'y', event: Event) => {
  const max = axis === 'y' ? 0.1 : 1;
  currentPosition.value[axis] = Math.min(
    max,
    Math.max(0, Number((event.target as HTMLInputElement).value))
  );
  updateLivePreview();
};
const adjustPosition = (axis: 'x' | 'y', amount: number) => {
  const max = axis === 'y' ? 0.1 : 1;
  currentPosition.value[axis] = Math.min(
    max,
    Math.max(0, Number((currentPosition.value[axis] + amount).toFixed(3)))
  );
  updateLivePreview();
  finishLivePreview();
};

const persist = useDebounceFn(() => {
  const normalized = normalizeStatusBarLyricConfig(config);
  const saved = saveStatusBarLyricConfig(normalized, {
    applyNative: !previewActive.value,
    notify: !previewActive.value
  });
  if (previewActive.value) applyStatusBarLyricLiveConfig(normalized);
  emit('update:enabled', saved.enabled);
}, 120);
watch(config, persist, { deep: true });

const setEnabled = (enabled: boolean) => {
  config.enabled = enabled;
  if (enabled && !hasStatusBarLyricPermission()) {
    requestStatusBarLyricPermission();
    window.$message?.info(st('permissionHint'));
  }
};

const getColor = (key: ColorKey): StatusBarLyricColorSource => {
  if (key === 'fill' || key === 'border') return config.colors.surface[key];
  return config.colors[key];
};
const setColorSource = (key: ColorKey, source: 'theme' | 'custom') => {
  getColor(key).source = source;
};
const setColorValue = (key: ColorKey, color: string) => {
  getColor(key).color = color;
};
const surfaceEnabled = (key: 'fill' | 'border') =>
  key === 'fill' ? config.colors.surface.fillEnabled : config.colors.surface.borderEnabled;
const setSurfaceEnabled = (key: 'fill' | 'border', enabled: boolean) => {
  if (key === 'fill') config.colors.surface.fillEnabled = enabled;
  else config.colors.surface.borderEnabled = enabled;
};

const importFont = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const id = await installStatusBarLyricFont(file);
    config.font.source = 'imported';
    config.font.id = id;
    window.$message?.success(`${st('installed')} ${file.name}`);
  } catch (error) {
    window.$message?.error(error instanceof Error ? error.message : st('installFailed'));
  } finally {
    input.value = '';
  }
};

onBeforeUnmount(() => {
  if (livePreviewFrame !== null) window.cancelAnimationFrame(livePreviewFrame);
  if (livePreviewFinishFrame !== null) window.cancelAnimationFrame(livePreviewFinishFrame);
  saveStatusBarLyricConfig(normalizeStatusBarLyricConfig(config), {
    applyNative: false,
    notify: false
  });
  setStatusBarLyricInAppVisible(false);
});
</script>

<style scoped lang="scss">
.status-lyric-settings {
  display: grid;
  width: 100%;
  gap: 14px;
}
.setting-line,
.control-block {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.setting-line > div,
.control-block > span {
  display: grid;
  gap: 2px;
}
.setting-line strong,
.control-block strong {
  font-size: 13px;
}
.setting-line small,
.control-block small {
  color: var(--m-text-muted);
  font-size: 11px;
}
.width-mode-line {
  align-items: flex-start;
}
.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.segmented {
  display: inline-flex;
  padding: 3px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent-color) 9%, transparent);
}
.segmented button,
.glass-button,
.glass-select {
  min-height: 34px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: var(--m-text-primary);
  font-size: 12px;
}
.segmented button {
  padding: 0 12px;
}
.segmented button.active {
  border-color: color-mix(in srgb, var(--accent-color) 34%, transparent);
  background: color-mix(in srgb, var(--accent-color) 18%, transparent);
  color: var(--accent-color);
}
.glass-button,
.glass-select {
  padding: 0 13px;
  border-color: color-mix(in srgb, #fff 24%, transparent);
  background: color-mix(in srgb, var(--accent-color) 10%, var(--m-glass-bg));
  backdrop-filter: blur(18px);
}
.position-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 12px;
  border: 1px solid color-mix(in srgb, #fff 18%, transparent);
  border-radius: 16px;
  background: color-mix(in srgb, var(--accent-color) 7%, transparent);
}
.position-grid label {
  display: grid;
  gap: 7px;
  color: var(--m-text-secondary);
  font-size: 11px;
}
.position-stepper {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) 30px;
  align-items: center;
  gap: 6px;
}
.position-stepper input {
  min-width: 0;
}
.position-stepper button {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 1px solid color-mix(in srgb, #fff 20%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent-color) 12%, transparent);
  color: var(--m-text-primary);
}
.position-stepper button:active {
  transform: scale(0.92);
}
.slider-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.slider-row label,
.opacity-control {
  display: grid;
  gap: 6px;
  color: var(--m-text-secondary);
  font-size: 11px;
}
input[type='range'] {
  width: 100%;
  accent-color: var(--accent-color);
}
.import-font {
  display: flex;
  width: fit-content;
  align-items: center;
  gap: 7px;
  cursor: pointer;
}
.import-font input {
  display: none;
}
.color-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.surface-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.surface-control-heading {
  display: flex;
  min-height: 30px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.color-control {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid color-mix(in srgb, #fff 18%, transparent);
  border-radius: 16px;
  background: color-mix(in srgb, var(--accent-color) 6%, transparent);
}
.color-control strong {
  font-size: 12px;
}
.color-source {
  width: 100%;
}
.color-source button {
  min-width: 0;
  flex: 1;
  padding: 0 5px;
  font-size: 10px;
}
.color-control input[type='color'] {
  width: 100%;
  height: 30px;
  padding: 2px;
  border: 0;
  border-radius: 9px;
  background: transparent;
}
</style>
