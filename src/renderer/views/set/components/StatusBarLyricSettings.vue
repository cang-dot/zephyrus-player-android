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
      <button class="glass-button" @click="showActualPreview">{{ st('actualPreview') }}</button>
    </div>

    <div class="position-grid">
      <label>
        <span>X {{ Math.round(currentPosition.x * 100) }}%</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="currentPosition.x"
          @input="setPosition('x', $event)"
        />
      </label>
      <label>
        <span>Y {{ Math.round(currentPosition.y * 100) }}%</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="currentPosition.y"
          @input="setPosition('y', $event)"
        />
      </label>
    </div>

    <div class="setting-line">
      <div>
        <strong>{{ st('wordByWord') }}</strong
        ><small>{{ st('wordByWordDesc') }}</small>
      </div>
      <n-switch v-model:value="config.wordByWord" />
    </div>

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

    <label class="control-block opacity-control">
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
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
  hasStatusBarLyricPermission,
  installStatusBarLyricFont,
  previewStatusBarLyric,
  readStatusBarLyricConfig,
  requestStatusBarLyricPermission,
  saveStatusBarLyricConfig
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
  { key: 'upcoming', label: st('upcoming') },
  { key: 'fill', label: st('surfaceFill') },
  { key: 'border', label: st('surfaceBorder') }
];

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
const setPosition = (axis: 'x' | 'y', event: Event) => {
  currentPosition.value[axis] = Number((event.target as HTMLInputElement).value);
};

const persist = useDebounceFn(() => {
  const saved = saveStatusBarLyricConfig(normalizeStatusBarLyricConfig(config));
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

const showActualPreview = () => {
  if (!previewStatusBarLyric(normalizeStatusBarLyricConfig(config))) {
    window.$message?.info(st('previewPermission'));
  }
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
