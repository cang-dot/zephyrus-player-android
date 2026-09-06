<template>
  <div class="eq-control p-4 rounded-2xl w-full" style="
    background: color-mix(in srgb, var(--m-surface-alt, #f3f0eb) 86%, transparent);
    backdrop-filter: blur(20px) saturate(160%);
    -webkit-backdrop-filter: blur(20px) saturate(160%);
    border: 1px solid rgba(255, 255, 255, 0.08);
  ">
    <div class="eq-header flex justify-between items-center mb-4">
      <h3 class="text-base font-semibold" style="color: var(--m-text-primary, #f0ece4);">
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

    <div
      class="adaptive-eq-row flex items-center gap-3 mb-4 rounded-xl p-3"
      style="background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 255, 255, 0.08);"
    >
      <div class="min-w-0 flex-1">
        <div class="font-medium text-sm" style="color: var(--m-text-primary, #f0ece4);">AI 动态均衡器</div>
        <div class="text-xs" style="color: var(--m-text-muted, rgba(255,255,255,0.55));">
          根据实时频段自动平滑调整，限制在安全增益范围内
        </div>
      </div>
      <n-switch v-model:value="isAdaptiveEnabled" @update:value="toggleAdaptiveEQ" />
    </div>
    <div v-if="isAdaptiveEnabled" class="adaptive-eq-intensity flex items-center gap-3 mb-4">
      <span class="text-xs" style="color: var(--m-text-muted, rgba(255,255,255,0.55));">强度</span>
      <n-slider
        v-model:value="adaptiveIntensity"
        :min="0"
        :max="1"
        :step="0.05"
        @update:value="updateAdaptiveIntensity"
      />
      <span class="w-10 text-right text-xs" style="color: var(--m-text-muted, rgba(255,255,255,0.55));"
        >{{ Math.round(adaptiveIntensity * 100) }}%</span
      >
    </div>

    <div class="eq-presets mb-2 relative h-10" style="max-width: 100%; overflow: hidden;">
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

    <div
      class="eq-sliders flex justify-between items-end gap-0.5 rounded-xl p-2 h-[300px] w-full"
      style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.06);"
    >
      <div
        v-for="freq in frequencies"
        :key="freq"
        class="eq-slider flex flex-col items-center h-full" style="flex: 1 1 0; min-width: 0;"
      >
        <div
          class="freq-label font-medium text-center whitespace-nowrap m-2 h-5" style="color: var(--m-text-muted, rgba(255,255,255,0.55)); font-size: 11px;"
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
          class="gain-value font-medium text-center whitespace-nowrap my-1 h-4" style="color: var(--m-text-muted, rgba(255,255,255,0.55)); font-size: 10px;"
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

import { adaptiveEqService } from '@/services/adaptiveEqService';
import { audioService } from '@/services/audioService';
import { isElectron } from '@/utils';

const { t } = useI18n();

const frequencies = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const eqValues = ref<{ [key: string]: number }>({});
const isEnabled = ref(audioService.isEQEnabled());
const currentPreset = ref(audioService.getCurrentPreset() || 'flat');
const isAdaptiveEnabled = ref(audioService.isAdaptiveEQEnabled());
const adaptiveIntensity = ref(audioService.getAdaptiveEQIntensity());

// 预设配置
const presets = {
  flat: {
    label: t('player.eq.presets.flat'),
    values: Object.fromEntries(frequencies.map((f) => [f, 0]))
  },
  pop: {
    label: t('player.eq.presets.pop'),
    values: {
      31: -1.5,
      62: 3.5,
      125: 5.5,
      250: 3.5,
      500: -0.5,
      1000: -1.5,
      2000: 1.5,
      4000: 2.5,
      8000: 2.5,
      16000: 2.5
    }
  },
  rock: {
    label: t('player.eq.presets.rock'),
    values: {
      31: 4.5,
      62: 3.5,
      125: 2,
      250: 0.5,
      500: -0.5,
      1000: -1,
      2000: 0.5,
      4000: 2,
      8000: 2.5,
      16000: 3.5
    }
  },
  classical: {
    label: t('player.eq.presets.classical'),
    values: {
      31: 3.5,
      62: 3,
      125: 2.5,
      250: 1.5,
      500: -0.5,
      1000: -1.5,
      2000: -1.5,
      4000: 0.5,
      8000: 2,
      16000: 3
    }
  },
  jazz: {
    label: t('player.eq.presets.jazz'),
    values: {
      31: 3,
      62: 2,
      125: 1.5,
      250: 2,
      500: -1,
      1000: -1.5,
      2000: -0.5,
      4000: 1,
      8000: 2.5,
      16000: 3
    }
  },
  hiphop: {
    label: t('player.eq.presets.hiphop'),
    values: {
      31: 5,
      62: 4.5,
      125: 3,
      250: 1.5,
      500: -0.5,
      1000: -1,
      2000: 0.5,
      4000: 1.5,
      8000: 2,
      16000: 2.5
    }
  },
  vocal: {
    label: t('player.eq.presets.vocal'),
    values: {
      31: -2,
      62: -1.5,
      125: -1,
      250: 0.5,
      500: 2,
      1000: 3.5,
      2000: 3,
      4000: 1.5,
      8000: 0.5,
      16000: 0
    }
  },
  dance: {
    label: t('player.eq.presets.dance'),
    values: {
      31: 4,
      62: 3.5,
      125: 2.5,
      250: 1,
      500: 0,
      1000: -0.5,
      2000: 1.5,
      4000: 2.5,
      8000: 3,
      16000: 2.5
    }
  },
  acoustic: {
    label: t('player.eq.presets.acoustic'),
    values: {
      31: 2,
      62: 1.5,
      125: 1,
      250: 1.5,
      500: 2,
      1000: 1.5,
      2000: 2,
      4000: 2.5,
      8000: 2,
      16000: 1.5
    }
  }
};

const presetOptions = Object.entries(presets).map(([value, preset]) => ({
  label: preset.label,
  value
}));

const toggleEQ = (enabled: boolean) => {
  audioService.setEQEnabled(enabled);
};

const toggleAdaptiveEQ = (enabled: boolean) => {
  isAdaptiveEnabled.value = enabled;
  adaptiveEqService.setEnabled(enabled);
};

const updateAdaptiveIntensity = (value: number) => {
  adaptiveIntensity.value = value;
  adaptiveEqService.setIntensity(value);
};

const applyPreset = (presetName: string) => {
  currentPreset.value = presetName;
  audioService.setCurrentPreset(presetName);
  const preset = presets[presetName as keyof typeof presets];
  if (preset) {
    Object.entries(preset.values).forEach(([freq, gain]) => {
      updateEQ(freq, gain);
    });
  }
};

onMounted(() => {
  // 恢复 EQ 设置
  const settings = audioService.getAllEQSettings();
  eqValues.value = settings;

  // 如果有保存的预设，应用该预设
  const savedPreset = audioService.getCurrentPreset();
  if (savedPreset && presets[savedPreset as keyof typeof presets]) {
    currentPreset.value = savedPreset;
  }
  if (isAdaptiveEnabled.value) adaptiveEqService.start();
});

const updateEQ = (frequency: string, gain: number) => {
  audioService.setEQFrequencyGain(frequency, gain);
  eqValues.value = {
    ...eqValues.value,
    [frequency]: gain
  };

  // 检查当前值是否与任何预设匹配
  const currentValues = eqValues.value;
  let matchedPreset: string | null = null;

  // 检查是否与任何预设完全匹配
  Object.entries(presets).forEach(([presetName, preset]) => {
    const isMatch = Object.entries(preset.values).every(
      ([freq, value]) => Math.abs(currentValues[freq] - value) < 0.1
    );
    if (isMatch) {
      matchedPreset = presetName;
    }
  });

  // 更新当前预设状态
  if (matchedPreset !== null) {
    currentPreset.value = matchedPreset;
    audioService.setCurrentPreset(matchedPreset);
  } else if (currentPreset.value !== 'custom') {
    // 如果与任何预设都不匹配，将状态设置为自定义
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
