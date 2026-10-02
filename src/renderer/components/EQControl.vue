<template>
  <div
    class="eq-control p-4 rounded-2xl w-full"
    style="
      background: var(--m-surface-alt, #f3f0eb);
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
      border: 1px solid rgba(255, 255, 255, 0.08);
    "
  >
    <div class="eq-header flex justify-between items-center mb-4">
      <h3 class="text-base font-semibold" style="color: var(--m-text-primary, #f0ece4)">
        {{ t('player.eq.title') }}
        <n-tag type="warning" size="small" round v-if="!isElectron">
          桌面版可用，网页端不支持
        </n-tag>
      </h3>
      <div class="eq-controls">
        <n-switch v-model:value="isEnabled" @update:value="toggleEQ">
          <template #checked>{{ t('player.eq.on') }}</template>
          <template #unchecked>{{ t('player.eq.off') }}</template>
        </n-switch>
      </div>
    </div>

    <!-- 固定预设 -->
    <div class="text-xs mb-2" style="color: var(--m-text-muted, rgba(255, 255, 255, 0.55))">
      {{ t('player.eq.presetsTitle', '预设') }}
    </div>
    <div class="eq-presets mb-3 relative h-10" style="max-width: 100%; overflow: hidden">
      <n-scrollbar x-scrollable>
        <n-space :size="6" :wrap="false">
          <n-tag
            v-for="preset in presetOptions"
            :key="preset.value"
            :type="currentPreset === preset.value ? 'success' : 'default'"
            :bordered="false"
            size="medium"
            round
            clickable
            @click="applyPreset(preset.value)"
          >
            {{ preset.label }}
          </n-tag>
        </n-space>
      </n-scrollbar>
    </div>

    <!-- 叠加空间效果 -->
    <div class="text-xs mb-2" style="color: var(--m-text-muted, rgba(255, 255, 255, 0.55))">
      {{ t('player.eq.spatialTitle', '叠加空间效果') }}
    </div>
    <div
      class="spatial-row flex items-center gap-3 mb-2 rounded-xl p-3"
      style="background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 255, 255, 0.08)"
    >
      <div class="min-w-0 flex-1">
        <div class="font-medium text-sm" style="color: var(--m-text-primary, #f0ece4)">
          {{ t('player.eq.loudspeaker', '外放') }}
        </div>
        <div class="text-xs" style="color: var(--m-text-muted, rgba(255, 255, 255, 0.55))">
          {{ t('player.eq.loudspeakerDesc', '不增加音量的前提下提升外放体感响度') }}
        </div>
      </div>
      <n-switch
        :value="isLoudspeakerOn"
        :disabled="!isEnabled"
        @update:value="toggleSpatial('loudspeaker', $event)"
      />
    </div>
    <div
      class="spatial-row flex items-center gap-3 mb-4 rounded-xl p-3"
      style="background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 255, 255, 0.08)"
    >
      <div class="min-w-0 flex-1">
        <div class="font-medium text-sm" style="color: var(--m-text-primary, #f0ece4)">
          {{ t('player.eq.bathroom', '浴室') }}
        </div>
        <div class="text-xs" style="color: var(--m-text-muted, rgba(255, 255, 255, 0.55))">
          {{ t('player.eq.bathroomDesc', '在浴室等狭小空间听歌时的饱满补偿') }}
        </div>
      </div>
      <n-switch
        :value="isBathroomOn"
        :disabled="!isEnabled"
        @update:value="toggleSpatial('bathroom', $event)"
      />
    </div>

    <button
      v-if="isEnabled"
      type="button"
      class="eq-advanced-toggle"
      @click="showManualEq = !showManualEq"
    >
      <span>{{ t('player.eq.manualTitle', '自定义 (10 段)') }}</span>
      <i :class="showManualEq ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'" />
    </button>

    <div
      v-show="showManualEq && isEnabled"
      class="eq-sliders flex justify-between items-end gap-0.5 rounded-xl p-2 h-[300px] w-full"
      style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.06)"
    >
      <div
        v-for="freq in frequencies"
        :key="freq"
        class="eq-slider flex flex-col items-center h-full"
        style="flex: 1 1 0; min-width: 0"
      >
        <div
          class="freq-label font-medium text-center whitespace-nowrap m-2 h-5"
          style="color: var(--m-text-muted, rgba(255, 255, 255, 0.55)); font-size: 11px"
        >
          {{ formatFreq(freq) }}
        </div>
        <n-slider
          v-model:value="eqValues[freq.toString()]"
          :min="-12"
          :max="12"
          :step="0.1"
          vertical
          :disabled="!isEnabled"
          @update:value="updateEQ(freq.toString(), $event)"
          class="eq-vslider flex-1 my-3"
        />
        <div
          class="gain-value font-medium text-center whitespace-nowrap my-1 h-4"
          style="color: var(--m-text-muted, rgba(255, 255, 255, 0.55)); font-size: 10px"
        >
          {{ eqValues[freq.toString()] }}dB
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { audioService } from '@/services/audioService';
import { isElectron } from '@/utils';

const { t } = useI18n();

const frequencies = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const eqValues = ref<{ [key: string]: number }>({});
const isEnabled = ref(audioService.isEQEnabled());
const currentPreset = ref(audioService.getCurrentPreset() || 'bass');
const isLoudspeakerOn = ref(audioService.isSpatialEffectOn('loudspeaker'));
const isBathroomOn = ref(audioService.isSpatialEffectOn('bathroom'));
const showManualEq = ref(false);

// 固定预设（10 段，±8dB 内防爆音）
const presets = {
  bass: {
    label: t('player.eq.presets.bass'),
    values: {
      31: 7,
      62: 7,
      125: 5,
      250: 0,
      500: 0,
      1000: 0,
      2000: 0,
      4000: 0,
      8000: 0,
      16000: 0
    }
  },
  rock: {
    label: t('player.eq.presets.rock'),
    values: {
      31: 3,
      62: 3,
      125: 2,
      250: 0,
      500: 0,
      1000: 0,
      2000: 0,
      4000: 5,
      8000: 4,
      16000: 0
    }
  },
  electronic: {
    label: t('player.eq.presets.electronic'),
    values: {
      31: 5,
      62: 5,
      125: 3,
      250: -2,
      500: -2,
      1000: 0,
      2000: 0,
      4000: 0,
      8000: 4,
      16000: 4
    }
  },
  lyrical: {
    label: t('player.eq.presets.lyrical'),
    values: {
      31: -1,
      62: -1,
      125: 0,
      250: 2,
      500: 3,
      1000: 3,
      2000: 2,
      4000: 0,
      8000: -1,
      16000: -2
    }
  },
  sad: {
    label: t('player.eq.presets.sad'),
    values: {
      31: 3,
      62: 3,
      125: 0,
      250: 0,
      500: -2,
      1000: -2,
      2000: 0,
      4000: 0,
      8000: 0,
      16000: 0
    }
  },
  custom: {
    label: t('player.eq.presets.custom'),
    values: Object.fromEntries(frequencies.map((f) => [f, 0]))
  }
};

const presetOptions = Object.entries(presets).map(([value, preset]) => ({
  label: preset.label,
  value
}));

const toggleEQ = (enabled: boolean) => {
  audioService.setEQEnabled(enabled);
};

const toggleSpatial = (kind: 'loudspeaker' | 'bathroom', on: boolean) => {
  if (kind === 'loudspeaker') isLoudspeakerOn.value = on;
  else isBathroomOn.value = on;
  audioService.setSpatialEffect(kind, on);
};

const applyPreset = (presetName: string) => {
  const preset = presets[presetName as keyof typeof presets];
  if (!preset) return;
  currentPreset.value = presetName;
  audioService.setCurrentPreset(presetName);
  Object.entries(preset.values).forEach(([freq, gain]) => {
    updateEQ(freq, gain);
  });
};

onMounted(() => {
  // 恢复 EQ 设置
  eqValues.value = audioService.getAllEQSettings();

  // 旧版本保存的预设名不在新表中时按自定义处理
  const savedPreset = audioService.getCurrentPreset() ?? 'custom';
  currentPreset.value = presets[savedPreset as keyof typeof presets] ? savedPreset : 'custom';
});

const updateEQ = (frequency: string, gain: number) => {
  audioService.setEQFrequencyGain(frequency, gain);
  eqValues.value = {
    ...eqValues.value,
    [frequency]: gain
  };

  // 偏离所有预设 → 自定义
  const currentValues = eqValues.value;
  let matchedPreset: string | null = null;

  Object.entries(presets).forEach(([presetName, preset]) => {
    if (presetName === 'custom') return;
    const isMatch = Object.entries(preset.values).every(
      ([freq, value]) => Math.abs(currentValues[freq] - value) < 0.1
    );
    if (isMatch) {
      matchedPreset = presetName;
    }
  });

  if (matchedPreset !== null) {
    currentPreset.value = matchedPreset;
    audioService.setCurrentPreset(matchedPreset);
  } else if (currentPreset.value !== 'custom') {
    currentPreset.value = 'custom';
    audioService.setCurrentPreset('custom');
  }
};

const formatFreq = (freq: number) => {
  if (freq >= 1000) {
    return `${freq / 1000}kHz`;
  }
  return `${freq}Hz`;
};
</script>

<style lang="scss" scoped>
.eq-advanced-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin: 4px 0 8px;
  padding: 9px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--m-text-secondary, rgba(255, 255, 255, 0.72));
  font-size: 13px;
  cursor: pointer;
}

:deep(.n-scrollbar) {
  margin-left: -0.5rem;
  margin-right: -0.5rem;
  padding-left: 0.5rem;
  padding-right: 0.5rem;
}

:deep(.n-tag) {
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;

  &:hover {
    transform: translateY(-2px);
  }
}

:deep(.n-space) {
  flex-wrap: nowrap;
  padding: 4px 0;
}

.eq-slider {
  overflow: hidden;
}

/* naive-ui 垂直滑杆根宽为 --n-rail-width-vertical + handle 补边,
   不约束会在窄列内向外撑开;显式限宽并居中 */
.eq-slider :deep(.n-slider.eq-vslider),
.eq-slider :deep(.n-slider) {
  width: 100% !important;
  max-width: 36px;
  margin-inline: auto;
}

:deep(.n-slider) {
  --n-rail-height: 4px;
  --n-rail-color: rgba(255, 255, 255, 0.14);
  --n-rail-color-hover: rgba(255, 255, 255, 0.22);
  --n-fill-color: var(--accent-color);
  --n-fill-color-hover: var(--accent-color);
  --n-handle-color: var(--accent-color);
  --n-handle-box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  .n-slider-handle {
    transition: all 0.2s;
    &:hover {
      transform: scale(1.2);
    }
  }
}
</style>
