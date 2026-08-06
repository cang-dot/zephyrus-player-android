<template>
  <section class="style-customization-panel">
    <div class="panel-heading">
      <span>{{ tr('player.styleCustomization.title', '样式设置') }}</span>
      <button
        type="button"
        class="reset-button"
        :title="tr('player.styleCustomization.reset', '一键还原')"
        @click="emit('reset')"
      >
        <i class="ri-reset-left-line"></i>
        {{ tr('player.styleCustomization.reset', '一键还原') }}
      </button>
    </div>

    <div class="segmented-control">
      <button
        v-for="option in modeOptions"
        :key="option.value"
        type="button"
        :class="{ active: local.mode === option.value }"
        @click="local.mode = option.value"
      >
        {{ option.label }}
      </button>
    </div>

    <div v-if="local.mode === 'custom'" class="panel-content">
      <div class="section-label">{{ tr('player.styleCustomization.appearance', '外观') }}</div>

      <label class="setting-row">
        <span>{{ tr('player.styleCustomization.lyricColor', '基础歌词颜色') }}</span>
        <input v-model="local.lyricColor" type="color" />
      </label>

      <div class="setting-row">
        <span>{{ tr('player.styleCustomization.font', '字体') }}</span>
        <button type="button" class="command-button" @click="importFont">
          <i class="ri-font-line"></i>
          {{ local.customFontName || tr('player.styleCustomization.importFont', '导入字体') }}
        </button>
      </div>

      <label class="setting-row">
        <span>{{ tr('player.styleCustomization.customBackground', '自定义背景') }}</span>
        <button
          type="button"
          class="toggle-switch"
          :class="{ on: local.useCustomBackground }"
          role="switch"
          :aria-checked="local.useCustomBackground"
          @click.prevent="local.useCustomBackground = !local.useCustomBackground"
        >
          <span></span>
        </button>
      </label>

      <div v-if="local.useCustomBackground" class="nested-settings">
        <div class="segmented-control three-options">
          <button
            v-for="option in backgroundOptions"
            :key="option.value"
            type="button"
            :class="{ active: local.backgroundMode === option.value }"
            @click="local.backgroundMode = option.value"
          >
            {{ option.label }}
          </button>
        </div>

        <input
          v-if="local.backgroundMode === 'solid'"
          v-model="local.solidColor"
          type="color"
          class="wide-color"
        />
        <div v-else-if="local.backgroundMode === 'gradient'" class="color-pair">
          <input v-model="local.gradientColors.colors[0]" type="color" />
          <input v-model="local.gradientColors.colors[1]" type="color" />
        </div>
        <div v-else class="image-settings">
          <button type="button" class="command-button full-width" @click="backgroundInput?.click()">
            <i class="ri-image-add-line"></i>
            {{ tr('player.styleCustomization.chooseImage', '选择背景图片') }}
          </button>
          <input
            ref="backgroundInput"
            type="file"
            accept="image/*"
            hidden
            @change="importBackground"
          />
          <img v-if="local.backgroundImage" :src="local.backgroundImage" alt="" />
          <label v-if="local.backgroundImage" class="range-row">
            <span>{{ tr('player.styleCustomization.blur', '模糊') }} {{ local.imageBlur }}px</span>
            <input v-model.number="local.imageBlur" type="range" min="0" max="20" />
          </label>
          <label v-if="local.backgroundImage" class="range-row">
            <span
              >{{ tr('player.styleCustomization.brightness', '亮度') }}
              {{ local.imageBrightness }}%</span
            >
            <input v-model.number="local.imageBrightness" type="range" min="20" max="200" />
          </label>
        </div>
      </div>

      <div class="section-label">{{ tr('player.styleCustomization.climaxColor', '高潮配色') }}</div>
      <label class="setting-row">
        <span>{{ tr('player.styleCustomization.useThemeColor', '高潮使用歌曲主题色') }}</span>
        <button
          type="button"
          class="toggle-switch"
          :class="{ on: local.climaxUseThemeColor }"
          role="switch"
          :aria-checked="local.climaxUseThemeColor"
          @click.prevent="local.climaxUseThemeColor = !local.climaxUseThemeColor"
        >
          <span></span>
        </button>
      </label>
      <label v-if="local.climaxUseThemeColor" class="setting-row">
        <span>{{ tr('player.styleCustomization.splitColors', '部件独立配色') }}</span>
        <button
          type="button"
          class="toggle-switch"
          :class="{ on: local.climaxSplitColors }"
          role="switch"
          :aria-checked="local.climaxSplitColors"
          @click.prevent="local.climaxSplitColors = !local.climaxSplitColors"
        >
          <span></span>
        </button>
      </label>

      <div
        v-if="local.climaxUseThemeColor && local.climaxSplitColors"
        class="nested-settings color-layers"
      >
        <div v-for="layer in colorLayers" :key="layer.key" class="color-layer-row">
          <span>{{ layer.label }}</span>
          <div class="segmented-control compact">
            <button
              type="button"
              :class="{ active: local.climaxColors[layer.key].source === 'theme' }"
              @click="local.climaxColors[layer.key].source = 'theme'"
            >
              {{ tr('player.styleCustomization.themeColor', '歌曲主题色') }}
            </button>
            <button
              type="button"
              :class="{ active: local.climaxColors[layer.key].source === 'custom' }"
              @click="local.climaxColors[layer.key].source = 'custom'"
            >
              {{ tr('player.styleCustomization.customColor', '自定义色') }}
            </button>
          </div>
          <input
            v-if="local.climaxColors[layer.key].source === 'custom'"
            v-model="local.climaxColors[layer.key].customColor"
            type="color"
          />
        </div>
      </div>

      <template v-if="hasClimaxEffects">
        <div class="section-label">
          {{ tr('player.styleCustomization.climaxEffects', '高潮效果') }}
        </div>
        <label v-if="styleKey === 'frenzy'" class="setting-row">
          <span>CRT</span><input v-model="local.effectCrt" type="checkbox" />
        </label>
        <label v-if="styleKey === 'frenzy' || styleKey === 'stage'" class="setting-row">
          <span>{{ tr('player.styleCustomization.lyricRecolor', '歌词变色') }}</span>
          <input v-model="local.effectLyricColor" type="checkbox" />
        </label>
        <label v-if="styleKey === 'eerie'" class="setting-row">
          <span>{{ tr('player.styleCustomization.keyword', '重点字') }}</span>
          <input
            :checked="local.effectKeyword === true"
            type="checkbox"
            @change="setEerieEffect('keyword', $event)"
          />
        </label>
        <label class="setting-row">
          <span>{{ tr('player.styleCustomization.wordDrop', '逐字砸下') }}</span>
          <input
            :checked="local.effectWordDrop === true"
            type="checkbox"
            @change="
              styleKey === 'eerie'
                ? setEerieEffect('drop', $event)
                : (local.effectWordDrop = checked($event))
            "
          />
        </label>
      </template>

      <div v-if="hasStyleSpecificSettings" class="section-label">
        {{ tr('player.styleCustomization.styleEffects', '样式参数') }}
      </div>
      <label v-if="styleKey === 'stage'" class="range-row">
        <span>Aurora {{ local.auroraSpeed }}</span>
        <input v-model.number="local.auroraSpeed" type="range" min="0.4" max="2" step="0.1" />
      </label>
      <label v-if="styleKey === 'stage'" class="range-row">
        <span
          >{{ tr('player.styleCustomization.beatFlash', '鼓点闪白') }}
          {{ local.beatFlashIntensity }}</span
        >
        <input v-model.number="local.beatFlashIntensity" type="range" min="0" max="1" step="0.05" />
      </label>
      <label v-if="styleKey === 'eerie'" class="range-row">
        <span
          >{{ tr('player.styleCustomization.newspaperFrequency', '报纸闪现频率') }}
          {{ local.newspaperFreq }}ms</span
        >
        <input v-model.number="local.newspaperFreq" type="range" min="200" max="1000" step="100" />
      </label>
      <label v-if="styleKey === 'eerie'" class="range-row">
        <span
          >{{ tr('player.styleCustomization.keywordSize', '重点字字号') }}
          {{ local.keywordSize }}</span
        >
        <input v-model.number="local.keywordSize" type="range" min="16" max="48" step="2" />
      </label>
      <label v-if="styleKey === 'neon'" class="range-row">
        <span
          >{{ tr('player.styleCustomization.glowRadius', '光晕半径') }} {{ local.glowRadius }}</span
        >
        <input v-model.number="local.glowRadius" type="range" min="4" max="30" step="2" />
      </label>
      <label v-if="styleKey === 'neon'" class="range-row">
        <span
          >{{ tr('player.styleCustomization.pulseSpeed', '脉冲速度') }} {{ local.pulseSpeed }}</span
        >
        <input v-model.number="local.pulseSpeed" type="range" min="0.5" max="3" step="0.1" />
      </label>
      <label v-if="styleKey === 'frenzy'" class="range-row">
        <span
          >{{ tr('player.styleCustomization.giantSize', '巨字字号') }} {{ local.giantSize }}</span
        >
        <input v-model.number="local.giantSize" type="range" min="40" max="120" step="5" />
      </label>
      <label v-if="styleKey === 'magazine'" class="range-row">
        <span
          >{{ tr('player.styleCustomization.flipSpeed', '翻页速度') }} {{ local.flipSpeed }}ms</span
        >
        <input v-model.number="local.flipSpeed" type="range" min="200" max="800" step="50" />
      </label>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { resolvePlayerStyleConfig } from '@/config/playerStyleConfig';
import type {
  MobilePlayerStyleKey,
  PlayerStyleCustomConfig,
  PlayerStyleMode
} from '@/types/playerStyle';

const props = defineProps<{
  styleKey: MobilePlayerStyleKey;
  modelValue: PlayerStyleCustomConfig;
}>();
const emit = defineEmits<{
  (event: 'update:modelValue', value: PlayerStyleCustomConfig): void;
  (event: 'reset'): void;
}>();
const { t, te } = useI18n();

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const local = ref<PlayerStyleCustomConfig>(
  resolvePlayerStyleConfig(props.styleKey, props.modelValue)
);
const syncing = ref(false);

watch(
  () => props.modelValue,
  (value) => {
    const next = resolvePlayerStyleConfig(props.styleKey, value);
    if (JSON.stringify(next) === JSON.stringify(local.value)) return;
    syncing.value = true;
    local.value = next;
    void nextTick(() => (syncing.value = false));
  },
  { deep: true }
);
watch(
  local,
  (value) => {
    if (!syncing.value) emit('update:modelValue', clone(value));
  },
  { deep: true }
);

const tr = (key: string, fallback: string) => (te(key) ? t(key) : fallback);
const modeOptions = computed<Array<{ value: PlayerStyleMode; label: string }>>(() => [
  { value: 'original', label: tr('player.styleCustomization.original', '原始设置') },
  { value: 'custom', label: tr('player.styleCustomization.custom', '自定义设置') }
]);
const backgroundOptions = computed(() => [
  { value: 'solid' as const, label: tr('player.styleCustomization.solid', '纯色') },
  { value: 'gradient' as const, label: tr('player.styleCustomization.gradient', '渐变') },
  { value: 'image' as const, label: tr('player.styleCustomization.image', '图片') }
]);
const colorLayers = computed(() => [
  { key: 'main' as const, label: tr('player.styleCustomization.mainLyric', '主歌词') },
  { key: 'auxiliary' as const, label: tr('player.styleCustomization.auxiliary', '背景 / 对唱词') },
  { key: 'translation' as const, label: tr('player.styleCustomization.translation', '翻译') }
]);
const hasClimaxEffects = computed(() => ['stage', 'eerie', 'frenzy'].includes(props.styleKey));
const hasStyleSpecificSettings = computed(() =>
  ['stage', 'eerie', 'neon', 'frenzy', 'magazine'].includes(props.styleKey)
);
const backgroundInput = ref<HTMLInputElement | null>(null);

function checked(event: Event): boolean {
  return (event.target as HTMLInputElement).checked;
}

function setEerieEffect(effect: 'keyword' | 'drop', event: Event) {
  const enabled = checked(event);
  if (effect === 'keyword') {
    local.value.effectKeyword = enabled;
    if (enabled) local.value.effectWordDrop = false;
  } else {
    local.value.effectWordDrop = enabled;
    if (enabled) local.value.effectKeyword = false;
  }
}

function importBackground(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file || !file.type.startsWith('image/') || file.size > 20 * 1024 * 1024) return;
  const reader = new FileReader();
  reader.onload = () => (local.value.backgroundImage = String(reader.result || ''));
  reader.readAsDataURL(file);
}

function importFont() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.ttf,.otf,.woff,.woff2';
  input.onchange = (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || file.size > 20 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => {
      local.value.customFontName = file.name;
      local.value.customFontFamily = `ZephyrusStyleFont-${props.styleKey}`;
      local.value.customFontData = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  };
  input.click();
}
</script>

<style scoped>
.style-customization-panel {
  margin-bottom: 24px;
  padding: 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}
.panel-heading,
.setting-row,
.range-row,
.color-layer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.panel-heading {
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.82);
}
.reset-button,
.command-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 0;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.09);
  color: rgba(255, 255, 255, 0.72);
  padding: 7px 10px;
  font-size: 12px;
}
.segmented-control {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 3px;
  padding: 3px;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.06);
}
.segmented-control.three-options {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.segmented-control button {
  min-height: 32px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: rgba(255, 255, 255, 0.48);
  font-size: 12px;
}
.segmented-control button.active {
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
}
.panel-content {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}
.section-label {
  margin-top: 6px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
}
.setting-row,
.range-row {
  min-height: 36px;
  color: rgba(255, 255, 255, 0.65);
  font-size: 12px;
}
input[type='color'] {
  width: 44px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
}
input[type='range'] {
  width: min(44vw, 180px);
  accent-color: var(--accent-color, #8b8cff);
}
input[type='checkbox'] {
  width: 18px;
  height: 18px;
  accent-color: var(--accent-color, #8b8cff);
}
.toggle-switch {
  position: relative;
  width: 42px;
  height: 24px;
  border: 0;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.14);
}
.toggle-switch span {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  transition: transform 180ms ease;
}
.toggle-switch.on {
  background: var(--accent-color, #7476ff);
}
.toggle-switch.on span {
  transform: translateX(18px);
}
.nested-settings {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-left: 2px solid rgba(255, 255, 255, 0.1);
}
.wide-color {
  width: 100% !important;
}
.color-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.color-pair input {
  width: 100%;
}
.image-settings {
  display: grid;
  gap: 10px;
}
.image-settings img {
  width: 100%;
  max-height: 144px;
  border-radius: 8px;
  object-fit: cover;
}
.full-width {
  width: 100%;
}
.color-layer-row {
  flex-wrap: wrap;
  color: rgba(255, 255, 255, 0.62);
  font-size: 12px;
}
.color-layer-row > span {
  width: 100%;
}
.segmented-control.compact {
  flex: 1;
}
@media (prefers-reduced-motion: reduce) {
  .toggle-switch span {
    transition: none;
  }
}
</style>
