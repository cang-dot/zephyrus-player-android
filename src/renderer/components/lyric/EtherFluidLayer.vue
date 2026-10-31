<template>
  <canvas ref="canvasRef" class="ether-fluid-canvas" aria-hidden="true"></canvas>
</template>

<script setup lang="ts">
/**
 * EtherFluidLayer — 错误样式的「墨烟」背景（孔乙己 PV 间奏流体的实时移植）
 *
 * 30fps 驱动 EtherFluid 求解器：能量取 climaxDetector.energyLevel，punch 按
 * 原能量分析口径现算（短时能量减 0.8s 慢包络），鼓点订阅 drumDetector 变成
 * 频闪与高频段加成。抽帧跳变按能量分档（tally/hui/storm 保持表），冻结拍
 * 不调 frame()，画布凭 preserveDrawingBuffer 保持上一帧。
 * 减弱动画：播完 seed+settle 后渲染一帧静止画面并停循环。
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import grainUrl from '@/assets/textures/ether/grain.png';
import turbUrl from '@/assets/textures/ether/turb.png';
import { climaxDetector } from '@/services/climaxDetector';
import { leadDetector } from '@/services/leadDetector';
import { createHoldWalker, EtherFluid, probeEtherSupport } from '@/utils/etherFluid';
import { computeEtherTheme } from '@/utils/etherTheme';
import { acquirePlayerResource } from '@/utils/playerResourceDiagnostics';

const SOURCE_FPS = 30;
/** punch 缩放：实时 RMS 残差比离线 log-RMS 残差小，放大到原曲线量级 */
const PUNCH_SCALE_FALLBACK = 2.5;
const punchScale = () => Number(props.punchScale) || PUNCH_SCALE_FALLBACK;
const beatStrongScale = () => Number(props.beatStrongScale) || 1;

const props = defineProps({
  /** 歌曲主题色（saturatedThemeColor）；缺失/近灰时回孔乙己原版暖墨 */
  themeColor: { type: String, default: '' },
  /** 封面原始平均色（未做去灰）：近灰但色度可辨时用它保住色相 */
  rawColor: { type: String, default: '' },
  /** 封面近灰像素占比（0–1）：>0.95 时按黑白灰封面处理，直接用中性墨 */
  grayRatio: { type: Number, default: 0 },
  /** 错误样式的「流体力度」滑杆 → 喷注增益 */
  power: { type: Number, default: 1 },
  /** 耀斑 punch 放大倍数（统一参数系统 etherPunchScale） */
  punchScale: { type: Number, default: 2.5 },
  /** 强拍强度缩放（etherBeatStrong） */
  beatStrongScale: { type: Number, default: 1 },
  paused: { type: Boolean, default: false }
});

const canvasRef = ref<HTMLCanvasElement | null>(null);

let fluid: EtherFluid | null = null;
let rafId: number | null = null;
let releaseResource: (() => void) | null = null;
let resizeObserver: ResizeObserver | null = null;
let drumUnsubscribe: (() => void) | null = null;

const holdWalker = createHoldWalker();
let lastTick = 0;
let simTime = 0;
let slowEnv = 0;
let beatAt = -Infinity;
let beatStrength = 0;
let beatSpike = 0;
let spikeTimer: ReturnType<typeof setTimeout> | null = null;
let leadOnsetArmed = true;

function resizeCanvas(): void {
  const canvas = canvasRef.value;
  if (!canvas || !fluid) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  fluid.resize(canvas.clientWidth * dpr, canvas.clientHeight * dpr);
}

function ensureLoop(): void {
  if (rafId !== null || !fluid) return;
  lastTick = 0;
  rafId = requestAnimationFrame(tick);
}

function tick(now: number): void {
  rafId = requestAnimationFrame(tick);
  if (!fluid) return;
  const minInterval = 1000 / SOURCE_FPS;
  if (now - lastTick < minInterval - 1) return;
  const dt = lastTick > 0 ? Math.min(0.25, (now - lastTick) / 1000) : minInterval / 1000;
  lastTick = now;

  const e = Math.min(1, Math.max(0, climaxDetector.energyLevel));
  slowEnv += (e - slowEnv) * (1 - Math.exp(-dt / 0.8));
  const punch = Math.min(1, Math.max(0, (e - slowEnv) * punchScale()));

  // 主奏信号（leadDetector：四带通量+熵+主导带竞争），替代旧的 hi≈响度近似
  const lead = leadDetector.snapshot();
  const leadLevel = Math.min(1, Math.max(0, lead.level));
  const hi = Math.min(1, leadLevel * 0.9 + beatSpike * 0.3);

  // 起音边沿武装：onset 脉冲衰减 ~0.12s 期间每帧都过阈值会连发喷丝
  // （一次起音实际喷 6-8 股）——上升沿只放行一帧，回落过 0.35 重新武装
  const leadOnsetRaw = Math.min(1, Math.max(0, lead.onset));
  let leadOnsetForFrame = 0;
  if (leadOnsetArmed && leadOnsetRaw > 0.7) {
    leadOnsetForFrame = leadOnsetRaw;
    leadOnsetArmed = false;
  } else if (leadOnsetRaw < 0.35) {
    leadOnsetArmed = true;
  }

  const beatAge = (now - beatAt) / 1000;
  const flash =
    beatAge >= 0 && beatAge < 0.2
      ? Math.pow(1 - beatAge / 0.2, 2) * (0.3 + punch * 0.7) * beatStrength
      : 0;

  // 抽帧跳变：保持表第 i 项 = 第 i 个源帧的保持拍数；推进只发生在每组第 1 拍
  if (holdWalker(e)) {
    simTime += (1 / 60) * 0.9 * 4;
    fluid.frame({
      energy: e,
      punch,
      low: e,
      mid: e,
      high: hi,
      flash,
      // 主奏的撕裂密度项同样配响度门（安静段收敛到 ~40%），与喷丝的响度守恒一致
      rough: Math.min(1.2, 0.3 + hi * 0.45 + punch * 0.25 + leadLevel * 0.35 * (0.4 + e * 0.6)),
      leadLevel,
      leadOnset: leadOnsetForFrame,
      leadBand: lead.band,
      time: simTime
    });
  }
}

function stopLoop(): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

/** 减弱动画：seed+settle 后渲染一帧静止画面（保持表中间档走一次推进） */
function renderStill(): void {
  if (!fluid) return;
  simTime += (1 / 60) * 0.9 * 4;
  fluid.frame({ energy: 0.5, punch: 0, low: 0.5, mid: 0.5, high: 0.4, flash: 0, time: simTime });
}

const themeWatcher = watch(
  () => [props.themeColor, props.rawColor, props.grayRatio] as const,
  ([color, raw, ratio]) =>
    fluid?.setTheme(computeEtherTheme({ color, rawColor: raw, grayRatio: ratio }))
);

const powerWatcher = watch(
  () => props.power,
  (p) => fluid?.setSplatGain(p)
);

const pausedWatcher = watch(
  () => props.paused,
  (paused) => {
    if (paused) {
      stopLoop();
    } else {
      ensureLoop();
    }
  }
);

onMounted(async () => {
  const canvas = canvasRef.value;
  if (!canvas || !probeEtherSupport()) return;
  releaseResource = acquirePlayerResource('timer');
  try {
    fluid = new EtherFluid(canvas);
  } catch (err) {
    console.warn('[EtherFluidLayer] 求解器初始化失败:', err);
    releaseResource?.();
    releaseResource = null;
    return;
  }
  resizeCanvas();
  resizeObserver = new ResizeObserver(resizeCanvas);
  resizeObserver.observe(canvas);
  fluid.setSplatGain(props.power);
  fluid.setTheme(
    computeEtherTheme({
      color: props.themeColor,
      rawColor: props.rawColor,
      grayRatio: props.grayRatio
    })
  );

  const { drumDetector } = await import('@/services/drumDetector');
  drumUnsubscribe = drumDetector.onBeat((info) => {
    beatAt = performance.now();
    beatStrength = info.isStrong ? beatStrongScale() : 0.65 * beatStrongScale();
    beatSpike = (info.isStrong ? 0.5 : 0.28) * beatStrongScale() * (0.6 + info.kickEnergy * 0.4);
    if (spikeTimer) clearTimeout(spikeTimer);
    spikeTimer = setTimeout(() => {
      beatSpike = 0;
    }, 120);
  });

  const texturesOk = await fluid.loadTextures(turbUrl, grainUrl);
  if (!texturesOk) console.warn('[EtherFluidLayer] 湍流纹理加载失败，使用占位纹理');
  fluid.seed(5.5, 1.7, 3.0);
  fluid.settle(70, 0.05);

  if (props.paused) {
    renderStill();
  } else {
    ensureLoop();
  }
});

onBeforeUnmount(() => {
  pausedWatcher.stop();
  themeWatcher.stop();
  powerWatcher.stop();
  stopLoop();
  if (spikeTimer) clearTimeout(spikeTimer);
  drumUnsubscribe?.();
  resizeObserver?.disconnect();
  fluid?.dispose();
  fluid = null;
  releaseResource?.();
  releaseResource = null;
});
</script>

<style lang="scss" scoped>
.ether-fluid-canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}
</style>
