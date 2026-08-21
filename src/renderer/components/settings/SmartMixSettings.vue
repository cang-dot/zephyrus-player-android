<template>
  <div class="smart-transition-settings">
    <div class="st-primary-row">
      <div class="st-copy">
        <span class="st-title">智能过渡</span>
        <span class="st-description">在歌曲尾部预加载下一首并平滑衔接</span>
      </div>
      <n-switch v-model:value="smartTransitionEnabled" aria-label="启用智能过渡" />
    </div>

    <div class="st-slider-section" :class="{ disabled: !smartTransitionEnabled }">
      <div class="st-slider-labels" aria-hidden="true">
        <span>更轻量</span>
        <span>更智能</span>
      </div>
      <div
        class="st-engine-slider"
        :class="{ dragging: isEngineDragging, disabled: !smartTransitionEnabled }"
        :style="engineSliderStyle"
        role="slider"
        tabindex="0"
        :aria-valuemin="1"
        :aria-valuemax="availableMaxLevel"
        :aria-valuenow="selectedSliderLevel"
        :aria-valuetext="transitionLabel"
        aria-label="智能过渡引擎强度"
        @pointerdown="handleEnginePointerDown"
        @pointermove="handleEnginePointerMove"
        @pointerup="handleEnginePointerUp"
        @pointercancel="handleEnginePointerCancel"
        @keydown="handleEngineKeydown"
      >
        <div ref="engineRailRef" class="st-engine-rail">
          <div class="st-engine-fill" :style="{ width: `${engineSliderPosition * 100}%` }"></div>
          <span
            v-for="level in availableMaxLevel"
            :key="level"
            class="st-engine-tick"
            :style="{ left: `${levelPosition(level) * 100}%` }"
          ></span>
          <span class="st-engine-handle" :style="{ left: `${engineSliderPosition * 100}%` }"></span>
        </div>
      </div>
      <div class="st-slider-value">{{ transitionLabel }}</div>
    </div>

    <div class="st-detail-row" :class="{ disabled: !smartTransitionEnabled }">
      <span class="st-detail-label">过渡时长</span>
      <n-slider
        v-model:value="duration"
        class="st-duration-slider"
        :style="engineSliderStyle"
        :min="2"
        :max="15"
        :step="0.5"
        :disabled="!smartTransitionEnabled"
        :tooltip="false"
        aria-label="智能过渡时长"
      />
      <output class="st-duration-value">{{ duration.toFixed(1) }} 秒</output>
    </div>

    <div class="st-secondary-row">
      <div class="st-copy">
        <span class="st-detail-label">无缝切歌</span>
        <span class="st-description">首尾直接拼接，不使用淡入淡出</span>
      </div>
      <n-switch v-model:value="gaplessEnabled" aria-label="启用无缝切歌" />
    </div>

    <div v-if="smartTransitionEnabled" class="st-secondary-row st-bpm-row">
      <div class="st-copy">
        <span class="st-detail-label">BPM 预分析</span>
        <span class="st-description">提升节拍和乐句衔接质量</span>
      </div>
      <n-switch v-model:value="bpmPreAnalysis" aria-label="启用 BPM 预分析" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { NSlider, NSwitch } from 'naive-ui';
import { computed, onMounted, ref, watch } from 'vue';

import { playMusic } from '@/hooks/MusicHook';
import {
  isLevelAvailable,
  type TransitionLevel,
  useMixEngineStore
} from '@/store/modules/mixEngine';
import { parseRepresentativeCssColor } from '@/utils/playerInk';

const mixEngine = useMixEngineStore();

const smartTransitionEnabled = computed({
  get: () => mixEngine.smartMixEnabled,
  set: (value: boolean) => mixEngine.setSmartMixEnabled(value)
});

const gaplessEnabled = computed({
  get: () => mixEngine.gaplessEnabled,
  set: (value: boolean) => mixEngine.setGaplessEnabled(value)
});

const transitionLevel = computed({
  get: () => mixEngine.transitionLevel,
  set: (value: number) => mixEngine.setTransitionLevel(value as TransitionLevel)
});

const duration = computed({
  get: () => mixEngine.crossfadeDuration,
  set: (value: number) => mixEngine.setCrossfadeDuration(value)
});

const bpmPreAnalysis = computed({
  get: () => mixEngine.bpmPreAnalysis,
  set: (value: boolean) => mixEngine.setBpmPreAnalysis(value)
});

const availableMaxLevel = computed<TransitionLevel>(() => {
  if (isLevelAvailable(3)) return 3;
  if (isLevelAvailable(2)) return 2;
  return 1;
});

const transitionLabel = computed(() => {
  if (transitionLevel.value === 1) return '轻量';
  if (transitionLevel.value === 2) return '均衡';
  return '智能';
});

const engineRailRef = ref<HTMLElement | null>(null);
const engineSliderPosition = ref(0);
const isEngineDragging = ref(false);

const selectedSliderLevel = computed(() => {
  const maxLevel = availableMaxLevel.value;
  if (maxLevel <= 1) return 1;
  return 1 + Math.round(engineSliderPosition.value * (maxLevel - 1));
});

const levelPosition = (level: number) => {
  const maxLevel = availableMaxLevel.value;
  return maxLevel <= 1 ? 0 : (level - 1) / (maxLevel - 1);
};

const syncEngineSlider = () => {
  const maxLevel = availableMaxLevel.value;
  engineSliderPosition.value = maxLevel <= 1 ? 0 : (transitionLevel.value - 1) / (maxLevel - 1);
};

watch([transitionLevel, availableMaxLevel], syncEngineSlider, { immediate: true });

const sliderColor = computed(() => {
  const song = playMusic?.value;
  const parsed = parseRepresentativeCssColor(song?.primaryColor || song?.backgroundColor);
  if (!parsed) return { color: '#1677d9', rgb: '22, 119, 217' };
  return {
    color: `rgb(${parsed.r}, ${parsed.g}, ${parsed.b})`,
    rgb: `${parsed.r}, ${parsed.g}, ${parsed.b}`
  };
});

const engineSliderStyle = computed(() => ({
  '--st-slider-color': sliderColor.value.color,
  '--st-slider-color-rgb': sliderColor.value.rgb
}));

const clampSliderPosition = (value: number) => Math.min(1, Math.max(0, value));

const updateEngineSliderFromPointer = (event: PointerEvent) => {
  const rail = engineRailRef.value;
  if (!rail) return;
  const rect = rail.getBoundingClientRect();
  if (!rect.width) return;
  engineSliderPosition.value = clampSliderPosition((event.clientX - rect.left) / rect.width);
};

const handleEnginePointerDown = (event: PointerEvent) => {
  if (!smartTransitionEnabled.value || !event.isPrimary) return;
  const target = event.currentTarget as HTMLElement;
  target.setPointerCapture(event.pointerId);
  isEngineDragging.value = true;
  updateEngineSliderFromPointer(event);
  event.preventDefault();
};

const handleEnginePointerMove = (event: PointerEvent) => {
  if (!isEngineDragging.value || !event.isPrimary) return;
  updateEngineSliderFromPointer(event);
  event.preventDefault();
};

const finishEnginePointer = (event: PointerEvent, commit: boolean) => {
  const target = event.currentTarget as HTMLElement;
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);

  if (commit) {
    const maxLevel = availableMaxLevel.value;
    const snappedPosition =
      maxLevel <= 1 ? 0 : Math.round(engineSliderPosition.value * (maxLevel - 1)) / (maxLevel - 1);
    engineSliderPosition.value = snappedPosition;
    transitionLevel.value = (1 + Math.round(snappedPosition * (maxLevel - 1))) as TransitionLevel;
  } else {
    syncEngineSlider();
  }
  isEngineDragging.value = false;
};

const handleEnginePointerUp = (event: PointerEvent) => {
  if (!isEngineDragging.value) return;
  finishEnginePointer(event, true);
};

const handleEnginePointerCancel = (event: PointerEvent) => {
  if (!isEngineDragging.value) return;
  finishEnginePointer(event, false);
};

const handleEngineKeydown = (event: KeyboardEvent) => {
  if (!smartTransitionEnabled.value) return;
  const maxLevel = availableMaxLevel.value;
  let nextLevel = transitionLevel.value;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') nextLevel -= 1;
  else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') nextLevel += 1;
  else if (event.key === 'Home') nextLevel = 1;
  else if (event.key === 'End') nextLevel = maxLevel;
  else return;
  event.preventDefault();
  transitionLevel.value = Math.min(maxLevel, Math.max(1, nextLevel)) as TransitionLevel;
};

onMounted(() => {
  mixEngine.evaluateAndRecommend();
  if (mixEngine.transitionLevel > availableMaxLevel.value) {
    mixEngine.setTransitionLevel(availableMaxLevel.value);
  }
});
</script>

<style scoped lang="scss">
.smart-transition-settings {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 18px;
}

.st-primary-row,
.st-secondary-row,
.st-detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.st-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.st-title,
.st-detail-label {
  color: #1f1f22;
  font-size: 14px;
  font-weight: 600;
}

.st-description {
  color: #888b92;
  font-size: 12px;
  line-height: 1.45;
}

.st-slider-section {
  position: relative;
  padding: 2px 4px 0;
  transition: opacity 180ms ease;
}

.st-slider-section.disabled,
.st-detail-row.disabled {
  opacity: 0.42;
}

.st-slider-labels {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  color: #8b8d94;
  font-size: 12px;
}

.st-engine-slider {
  height: 40px;
  padding: 5px 0;
  touch-action: none;
  user-select: none;
  cursor: pointer;
  outline: none;
}

.st-engine-slider.disabled {
  cursor: not-allowed;
}

.st-engine-slider:focus-visible .st-engine-handle {
  box-shadow:
    0 0 0 4px rgba(var(--st-slider-color-rgb), 0.22),
    0 2px 8px rgba(0, 0, 0, 0.2);
}

.st-engine-rail {
  position: relative;
  width: calc(100% - 40px);
  margin: 0 20px;
  height: 30px;
  border-radius: 999px;
  background: rgba(var(--st-slider-color-rgb), 0.2);
}

.st-engine-fill {
  position: absolute;
  inset: 0 auto 0 0;
  min-width: 30px;
  border-radius: inherit;
  background: var(--st-slider-color);
}

.st-engine-tick {
  position: absolute;
  top: 50%;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.46);
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.st-engine-handle {
  position: absolute;
  top: 50%;
  width: 40px;
  height: 40px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.18);
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.st-engine-slider:not(.dragging) .st-engine-handle {
  transition:
    left 160ms cubic-bezier(0.2, 0.8, 0.2, 1),
    transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1),
    box-shadow 160ms ease;
}

.st-engine-slider.dragging .st-engine-handle {
  transform: translate(-50%, -50%) scale(1.04);
  box-shadow: 0 2px 9px rgba(0, 0, 0, 0.22);
}

.st-slider-value {
  margin-top: 4px;
  color: #6b6e76;
  font-size: 11px;
  text-align: center;
}

.st-detail-row {
  min-height: 32px;
}

.st-duration-slider {
  flex: 1;
  min-width: 100px;
  --n-rail-height: 30px !important;
  --n-handle-size: 40px !important;
  --n-rail-color: rgba(var(--st-slider-color-rgb), 0.2) !important;
  --n-rail-color-hover: rgba(var(--st-slider-color-rgb), 0.28) !important;
  --n-fill-color: var(--st-slider-color) !important;
  --n-fill-color-hover: var(--st-slider-color) !important;
  --n-handle-color: #fff !important;
  --n-handle-box-shadow: 0 1px 5px rgba(0, 0, 0, 0.18) !important;
  --n-handle-box-shadow-hover: 0 2px 9px rgba(0, 0, 0, 0.22) !important;
  --n-handle-box-shadow-active: 0 2px 9px rgba(0, 0, 0, 0.22) !important;
}

.st-duration-slider :deep(.n-slider-handle) {
  box-sizing: border-box;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.st-duration-value {
  min-width: 48px;
  color: #6b6e76;
  font-size: 12px;
  text-align: right;
}

.st-secondary-row {
  min-height: 38px;
  padding-top: 2px;
  border-top: 1px solid rgba(118, 118, 128, 0.14);
}

.st-bpm-row {
  padding-top: 14px;
}

:global(.dark) .st-title,
:global(.dark) .st-detail-label {
  color: #f0f0f3;
}

:global(.dark) .st-description,
:global(.dark) .st-slider-labels,
:global(.dark) .st-slider-value,
:global(.dark) .st-duration-value {
  color: #a6a8b0;
}

:global(.dark) .st-duration-slider :deep(.n-slider-rail) {
  background: rgba(var(--st-slider-color-rgb), 0.24);
}

@media (prefers-reduced-motion: reduce) {
  .st-slider-section,
  .st-engine-slider:not(.dragging) .st-engine-handle,
  .st-duration-slider :deep(.n-slider-rail),
  .st-duration-slider :deep(.n-slider-rail__fill),
  .st-duration-slider :deep(.n-slider-handle) {
    transition: none;
  }
}
</style>
