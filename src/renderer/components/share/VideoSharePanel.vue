<template>
  <div class="vs-panel">
    <!-- 环境不支持 -->
    <div v-if="!supported" class="vs-notice">
      <i class="ri-error-warning-line"></i>
      <p>{{ t('share.video.unsupported') }}</p>
    </div>

    <template v-else>
      <!-- 画面比例 -->
      <section class="vs-section">
        <div class="vs-label">{{ t('share.video.ratio') }}</div>
        <div class="vs-ratios">
          <button
            v-for="opt in VIDEO_ASPECT_OPTIONS"
            :key="opt.key"
            type="button"
            class="vs-ratio"
            :class="{ active: config.ratio === opt.key }"
            :disabled="exporting"
            @click="selectRatio(opt.key)"
          >
            <span class="vs-ratio-box">
              <span class="vs-ratio-shape" :style="previewStyle(opt)" />
            </span>
            <span class="vs-ratio-text">{{ opt.label }}</span>
          </button>
        </div>
      </section>

      <!-- 时间段 -->
      <section class="vs-section">
        <div class="vs-label">
          <span>{{ t('share.video.segment') }}</span>
          <span class="vs-value">
            {{ formatSegmentTime(config.segment.startSec) }} –
            {{ formatSegmentTime(config.segment.endSec) }}
          </span>
        </div>
        <div class="vs-presets">
          <button
            v-for="preset in presets"
            :key="preset.key"
            type="button"
            class="vs-chip"
            :disabled="exporting"
            @click="applyPreset(preset.key)"
          >
            {{ t(preset.labelKey) }}
          </button>
        </div>
        <label class="vs-slider">
          <span>{{ t('share.video.startPoint') }}</span>
          <input
            type="range"
            min="0"
            :max="startMax"
            step="0.5"
            :value="config.segment.startSec"
            :disabled="exporting"
            @input="onStartInput"
          />
        </label>
        <label class="vs-slider">
          <span>{{ t('share.video.duration') }}</span>
          <input
            type="range"
            :min="VIDEO_MIN_SEGMENT_SEC"
            :max="durationMax"
            step="1"
            :value="Math.round(segmentDurationSec)"
            :disabled="exporting"
            @input="onDurationInput"
          />
          <em>{{ Math.round(segmentDurationSec) }}{{ t('share.video.seconds') }}</em>
        </label>
      </section>

      <!-- 清晰度 + 水印 -->
      <section class="vs-section">
        <div class="vs-label">{{ t('share.video.quality') }}</div>
        <div class="vs-segments">
          <button
            v-for="tier in VIDEO_QUALITY_TIERS"
            :key="tier.key"
            type="button"
            :class="{ active: config.quality === tier.key }"
            :disabled="exporting"
            @click="selectQuality(tier.key)"
          >
            {{ tier.key }}
          </button>
        </div>
        <label class="vs-switch-row">
          <span>{{ t('share.video.watermark') }}</span>
          <button
            type="button"
            class="vs-switch"
            :class="{ on: config.watermark }"
            :disabled="exporting"
            @click="toggleWatermark"
          >
            <span />
          </button>
        </label>
      </section>

      <!-- 操作区 -->
      <section class="vs-actions">
        <!-- 待导出 -->
        <template v-if="!exporting && !result">
          <p class="vs-hint">
            <i class="ri-information-line"></i>
            {{ t('share.video.pauseHint') }}
          </p>
          <button type="button" class="vs-primary" :disabled="!canExport" @click="start">
            <i class="ri-film-line"></i>
            {{ t('share.video.export') }}
          </button>
        </template>

        <!-- 导出中 -->
        <template v-else-if="exporting">
          <div class="vs-progress">
            <div class="vs-progress-track">
              <span :style="{ width: `${percent}%` }" />
            </div>
            <div class="vs-progress-meta">
              <span>{{ stageLabel }}</span>
              <span v-if="progress && progress.totalFrames">
                {{ progress.renderedFrames }} / {{ progress.totalFrames }}
                {{ t('share.video.frameUnit') }}
              </span>
            </div>
          </div>
          <button type="button" class="vs-ghost" @click="cancel">
            {{ t('share.video.cancelExport') }}
          </button>
        </template>

        <!-- 导出完成 -->
        <template v-else-if="result">
          <video class="vs-preview" :src="previewUrl" controls playsinline />
          <div class="vs-result-meta">
            {{ result.width }}×{{ result.height }} · {{ result.extension.toUpperCase() }} ·
            {{ result.durationSec.toFixed(1) }}s
          </div>
          <div class="vs-result-actions">
            <button type="button" class="vs-primary" @click="onSave">
              <i class="ri-download-2-line"></i>
              {{ t('share.video.save') }}
            </button>
            <button type="button" class="vs-ghost" @click="onShare">
              <i class="ri-share-forward-line"></i>
              {{ t('share.video.share') }}
            </button>
          </div>
          <button type="button" class="vs-link" @click="onAgain">
            {{ t('share.video.again') }}
          </button>
        </template>
      </section>

      <p v-if="errorMessage" class="vs-error">
        <i class="ri-error-warning-line"></i>
        {{ errorMessage }}
      </p>
      <p v-else-if="statusText" class="vs-status">{{ statusText }}</p>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * 视频分享面板
 *
 * 提供比例（含对应比例的小圆角矩形预览）、时间段、清晰度与水印配置，
 * 并展示离线导出的进度、取消与结果操作。
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { type SegmentPreset, useVideoShare } from '@/composables/useVideoShare';
import {
  formatSegmentTime,
  VIDEO_ASPECT_OPTIONS,
  VIDEO_MAX_SEGMENT_SEC,
  VIDEO_MIN_SEGMENT_SEC,
  VIDEO_QUALITY_TIERS,
  type VideoAspectOption,
  type VideoAspectRatio,
  type VideoQualityTier
} from '@/types/shareVideo';

const props = defineProps({
  styleKey: { type: String, required: true }
});

const { t } = useI18n();

const {
  config,
  exporting,
  progress,
  result,
  errorMessage,
  supported,
  songDuration,
  segmentDurationSec,
  canExport,
  resetSegment,
  setSegmentStart,
  setSegmentDuration,
  start,
  cancel,
  clearResult,
  save,
  share
} = useVideoShare(() => props.styleKey);

const statusText = ref('');
const previewUrl = ref('');

const presets: Array<{ key: SegmentPreset; labelKey: string }> = [
  { key: 'current', labelKey: 'share.video.presetCurrent' },
  { key: 'climax', labelKey: 'share.video.presetClimax' },
  { key: 'head', labelKey: 'share.video.presetHead' }
];

/** 比例预览矩形尺寸：在固定盒子里按比例画一个圆角矩形 */
function previewStyle(opt: VideoAspectOption): Record<string, string> {
  const box = 34;
  const width = opt.ratio >= 1 ? box : box * opt.ratio;
  const height = opt.ratio >= 1 ? box / opt.ratio : box;
  return { width: `${width.toFixed(1)}px`, height: `${height.toFixed(1)}px` };
}

const percent = computed(() => Math.round((progress.value?.ratio ?? 0) * 100));

const stageLabel = computed(() => {
  switch (progress.value?.stage) {
    case 'preparing':
      return t('share.video.stagePreparing');
    case 'audio':
      return t('share.video.stageAudio');
    case 'rendering':
      return t('share.video.stageRendering');
    case 'finalizing':
      return t('share.video.stageFinalizing');
    case 'done':
      return t('share.video.stageDone');
    case 'canceled':
      return t('share.video.stageCanceled');
    case 'error':
      return t('share.video.stageError');
    default:
      return '';
  }
});

/** 起点滑块上限 */
const startMax = computed(() =>
  Math.max(0, (songDuration.value || VIDEO_MAX_SEGMENT_SEC) - VIDEO_MIN_SEGMENT_SEC)
);

/** 时长滑块上限：不超过歌曲剩余长度，也不超过硬上限 */
const durationMax = computed(() => {
  const remaining = songDuration.value
    ? songDuration.value - config.value.segment.startSec
    : VIDEO_MAX_SEGMENT_SEC;
  return Math.max(VIDEO_MIN_SEGMENT_SEC, Math.min(VIDEO_MAX_SEGMENT_SEC, remaining));
});

function selectRatio(ratio: VideoAspectRatio) {
  config.value.ratio = ratio;
  clearResult();
  statusText.value = '';
}

function selectQuality(quality: VideoQualityTier) {
  config.value.quality = quality;
  clearResult();
  statusText.value = '';
}

function toggleWatermark() {
  config.value.watermark = !config.value.watermark;
  clearResult();
  statusText.value = '';
}

function applyPreset(preset: SegmentPreset) {
  resetSegment(preset);
  clearResult();
  statusText.value = '';
}

function onStartInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value);
  setSegmentStart(value);
  clearResult();
}

function onDurationInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value);
  setSegmentDuration(value);
  clearResult();
}

async function onSave() {
  statusText.value = '';
  const ok = await save();
  statusText.value = ok ? t('share.video.saved') : t('share.video.saveFailed');
}

async function onShare() {
  statusText.value = '';
  const ok = await share();
  statusText.value = ok ? t('share.video.shared') : t('share.video.saveFailed');
}

function onAgain() {
  clearResult();
  statusText.value = '';
}

// 结果 blob → 预览地址，切换结果时释放旧地址
watch(result, (value) => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = value ? URL.createObjectURL(value.blob) : '';
});

onMounted(() => resetSegment('current'));

onUnmounted(() => {
  cancel();
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
});
</script>

<style scoped>
.vs-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 0 2px 4px;
}

.vs-notice {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.55);
  font-size: 13px;
  text-align: center;
}

.vs-notice i {
  font-size: 26px;
  color: #f5a623;
}

.vs-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.vs-label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
}

.vs-value {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  font-variant-numeric: tabular-nums;
}

/* 比例 */
.vs-ratios {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.vs-ratio {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 4px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid transparent;
  transition:
    background 0.2s,
    border-color 0.2s;
}

.vs-ratio.active {
  background: rgba(var(--accent-color-rgb, 120, 130, 160), 0.22);
  border-color: rgba(var(--accent-color-rgb, 120, 130, 160), 0.5);
}

.vs-ratio:disabled {
  opacity: 0.5;
}

.vs-ratio-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
}

.vs-ratio-shape {
  display: block;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.75);
}

.vs-ratio.active .vs-ratio-shape {
  background: rgb(var(--accent-color-rgb, 200, 210, 235));
}

.vs-ratio-text {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
}

.vs-ratio.active .vs-ratio-text {
  color: #fff;
}

/* 时间段 */
.vs-presets {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.vs-chip {
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.7);
}

.vs-chip:disabled {
  opacity: 0.5;
}

.vs-slider {
  display: grid;
  grid-template-columns: 48px 1fr 44px;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.vs-slider em {
  font-style: normal;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.vs-slider input[type='range'] {
  width: 100%;
  accent-color: rgb(var(--accent-color-rgb, 200, 210, 235));
}

/* 清晰度 */
.vs-segments {
  display: flex;
  gap: 8px;
}

.vs-segments button {
  flex: 1;
  padding: 9px 0;
  border-radius: 12px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.65);
  border: 1px solid transparent;
}

.vs-segments button.active {
  background: rgba(var(--accent-color-rgb, 120, 130, 160), 0.22);
  border-color: rgba(var(--accent-color-rgb, 120, 130, 160), 0.5);
  color: #fff;
}

.vs-segments button:disabled {
  opacity: 0.5;
}

.vs-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.05);
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
}

.vs-switch {
  position: relative;
  width: 42px;
  height: 24px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  transition: background 0.2s;
}

.vs-switch span {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
}

.vs-switch.on {
  background: rgb(var(--accent-color-rgb, 120, 130, 160));
}

.vs-switch.on span {
  transform: translateX(18px);
}

/* 操作区 */
.vs-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.vs-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.42);
}

.vs-primary,
.vs-ghost {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 13px 16px;
  border-radius: 14px;
  font-size: 14px;
  font-weight: 600;
}

.vs-primary {
  background: rgb(var(--accent-color-rgb, 120, 130, 160));
  color: #fff;
}

.vs-primary:disabled {
  opacity: 0.45;
}

.vs-ghost {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.85);
}

.vs-link {
  align-self: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  text-decoration: underline;
}

.vs-progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.vs-progress-track {
  height: 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  overflow: hidden;
}

.vs-progress-track span {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: rgb(var(--accent-color-rgb, 120, 130, 160));
  transition: width 0.2s;
}

.vs-progress-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  font-variant-numeric: tabular-nums;
}

.vs-preview {
  width: 100%;
  max-height: 320px;
  border-radius: 14px;
  background: #000;
}

.vs-result-meta {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  text-align: center;
}

.vs-result-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.vs-error,
.vs-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.vs-error {
  color: #ff7a7a;
}

.vs-status {
  color: rgba(255, 255, 255, 0.6);
}
</style>
