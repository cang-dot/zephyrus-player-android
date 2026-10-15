/**
 * 设备分档:基于 CPU 核数与设备内存的粗略分级,供视觉背景自动降档。
 * 与 mixEngine 的 evaluateHardware 相互独立——那边服务于音频过渡等级,
 * 这边只回答"能否负担常驻 WebGL / 逐帧 canvas 绘制"。
 */
export type DeviceTier = 'low' | 'mid' | 'high';

function evaluateTier(): DeviceTier {
  if (typeof navigator === 'undefined') return 'high';
  const cores = navigator.hardwareConcurrency || 4;
  // deviceMemory 上报上限 8GB;取不到时按中档兜底,不冤枉真机
  const mem = (navigator as { deviceMemory?: number }).deviceMemory || 4;
  if (mem <= 2 || (cores <= 4 && mem <= 4)) return 'low';
  if (cores >= 8 && mem >= 6) return 'high';
  return 'mid';
}

/** 模块级求值一次,整个会话不变(硬件不会热插拔) */
export const deviceTier: DeviceTier = evaluateTier();

export const isLowEndDevice = deviceTier === 'low';
