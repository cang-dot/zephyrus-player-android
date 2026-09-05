<template>
  <div ref="rootRef" class="vhs-crack-backdrop">
    <!-- 裂纹层（静态，DPR 缩放保证线段清晰） -->
    <canvas ref="crackCanvasRef" class="crack-canvas"></canvas>
    <!-- VHS 噪点层（透明底，每帧重绘：雪花噪点 + 扫描线 + 滚动条 + 信号干扰） -->
    <canvas ref="vhsCanvasRef" class="vhs-canvas"></canvas>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { playMusic } from '@/hooks/MusicHook';
import { useCoverColor } from '@/hooks/useCoverColor';
import { drawCracks } from '@/lib/crackRenderer';
import { startVHSAnimation } from '@/lib/vhsEffect';
import { useStyleEngineStore } from '@/store/modules/styleEngine';

/**
 * VHS 噪点 + 裂纹背景预设
 *
 * 抽取自 EerieMobilePlayer.vue 的正片背景（startVHSAnimation + drawCracks）：
 * - VHS 层：雪花噪点 / 扫描线 / 滚动横条 / 信号干扰（透明底叠加在裂纹之上），
 *   复用 @/lib/vhsEffect 的动画循环（24fps，rAF 驱动）
 * - 裂纹层：递归分形裂纹（复用 @/lib/crackRenderer），颜色跟随封面主色，
 *   保留「高潮（isInClimax）时裂纹停画」的原逻辑
 * - 不包含报纸闪层（属歌词区，不随背景带入）
 */

interface VhsCrackBackdropParams {
  /** VHS 效果总体强度（默认 1，即原版 0.7 master intensity） */
  vhsIntensity?: number;
  /** 是否绘制裂纹（默认 true；高潮期间强制停画） */
  crackEnabled?: boolean;
}

const props = defineProps({
  params: { type: Object as PropType<VhsCrackBackdropParams>, default: () => ({}) }
});

const styleEngine = useStyleEngineStore();
const { primaryColor } = useCoverColor();

const rootRef = ref<HTMLElement | null>(null);
const crackCanvasRef = ref<HTMLCanvasElement | null>(null);
const vhsCanvasRef = ref<HTMLCanvasElement | null>(null);

const sizeW = ref(0);
const sizeH = ref(0);

const isInClimax = computed(() => styleEngine.isInClimax);
const crackColor = computed(() => primaryColor.value || '#888888');

/** VHS 强度：默认 1 = 原版强度，允许 0~2 缩放 */
const vhsIntensity = computed(() => {
  const raw = Number(props.params?.vhsIntensity ?? 1);
  if (!Number.isFinite(raw)) return 1;
  return Math.min(2, Math.max(0, raw));
});

/** 裂纹开关：默认 true */
const crackEnabled = computed(() => props.params?.crackEnabled !== false);

// ==================== 画布尺寸（devicePixelRatio 处理） ====================

function applyCanvasSize(): boolean {
  const root = rootRef.value;
  if (!root) return false;
  const w = root.clientWidth;
  const h = root.clientHeight;
  if (!w || !h) return false;
  if (w === sizeW.value && h === sizeH.value) return false;
  sizeW.value = w;
  sizeH.value = h;

  const dpr = window.devicePixelRatio || 1;
  const targetW = Math.round(w * dpr);
  const targetH = Math.round(h * dpr);

  const crackCanvas = crackCanvasRef.value;
  if (crackCanvas) {
    crackCanvas.width = targetW;
    crackCanvas.height = targetH;
    crackCanvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const vhsCanvas = vhsCanvasRef.value;
  if (vhsCanvas) {
    vhsCanvas.width = targetW;
    vhsCanvas.height = targetH;
    // startVHSAnimation 每帧 save/restore 调用方 transform，需先设好 DPR 缩放
    vhsCanvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  return true;
}

// ==================== VHS 噪点动画 ====================

let noiseStopFn: (() => void) | null = null;

function stopVhs() {
  if (noiseStopFn) {
    noiseStopFn();
    noiseStopFn = null;
  }
}

function startVhs() {
  stopVhs();
  const canvas = vhsCanvasRef.value;
  if (!canvas || !sizeW.value || !sizeH.value) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const master = vhsIntensity.value;
  if (master <= 0) return;
  // 透明底（空字符串 getter）：只绘制效果层，让下方的裂纹/底色透出
  noiseStopFn = startVHSAnimation(ctx, sizeW.value, sizeH.value, () => '', {
    intensity: 0.7 * master,
    snow: 0.4,
    scanlines: 0.15,
    interference: 0.18,
    colorBleed: 2,
    rollingBar: true,
    fps: 24
  });
}

// ==================== 裂纹绘制 ====================

function paintCracks() {
  const canvas = crackCanvasRef.value;
  if (!canvas || !sizeW.value || !sizeH.value) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = sizeW.value;
  const h = sizeH.value;
  // 设置 canvas.width 会重置全部状态，这里重设 DPR transform 再清屏
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  // 高潮时裂纹停画（原逻辑保留）；开关关闭时同样清空
  if (!crackEnabled.value || isInClimax.value) return;
  drawCracks(ctx, w, h, {
    count: 5 + Math.floor(Math.random() * 3),
    opacity: 0.12,
    color: crackColor.value,
    maxDepth: 4
  });
}

// 裂纹随机重绘（模拟原版随歌词行推进的重绘节奏）
let crackTimer: ReturnType<typeof setInterval> | null = null;
const CRACK_REFRESH_MS = 9000;

function startCrackTimer() {
  stopCrackTimer();
  crackTimer = setInterval(paintCracks, CRACK_REFRESH_MS);
}

function stopCrackTimer() {
  if (crackTimer) {
    clearInterval(crackTimer);
    crackTimer = null;
  }
}

// ==================== 尺寸监听 ====================

let resizeFrame = 0;
let resizeObserver: ResizeObserver | null = null;

function handleResize() {
  if (resizeFrame) cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = 0;
    if (applyCanvasSize()) {
      paintCracks();
      startVhs();
    }
  });
}

// ==================== 生命周期与响应 ====================

onMounted(() => {
  styleEngine.syncFromPlayerStore();
  applyCanvasSize();
  paintCracks();
  startVhs();
  startCrackTimer();
  if (rootRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(rootRef.value);
  }
});

onBeforeUnmount(() => {
  stopVhs();
  stopCrackTimer();
  if (resizeFrame) cancelAnimationFrame(resizeFrame);
  resizeObserver?.disconnect();
  resizeObserver = null;
});

// 参数变化：重启 VHS / 重绘裂纹
watch(vhsIntensity, () => startVhs());
watch(crackEnabled, () => paintCracks());

// 高潮切换：进入高潮清掉裂纹，退出后重新绘制（原逻辑）
watch(isInClimax, () => paintCracks());

// 封面主色变化：裂纹颜色跟随重绘
watch(crackColor, () => paintCracks());

// 切歌：换一批随机裂纹
watch(
  () => playMusic.value?.picUrl ?? playMusic.value?.name,
  () => paintCracks()
);
</script>

<style lang="scss" scoped>
.vhs-crack-backdrop {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  background: #0a0a0a;
}

.crack-canvas,
.vhs-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  pointer-events: none;
}

.crack-canvas {
  z-index: 0;
}

.vhs-canvas {
  z-index: 1;
}
</style>
