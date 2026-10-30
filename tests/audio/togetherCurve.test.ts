import { describe, expect, it } from 'vitest';

import { buildTogetherCurves, sampleCurve } from '@/utils/audio/crossfade';

describe('buildTogetherCurves', () => {
  it('together=0 退化为普通等功率曲线', () => {
    const { out, in: inCurve } = buildTogetherCurves(0.5, 0, 64);
    expect(out[0]).toBeCloseTo(1, 5);
    expect(inCurve[0]).toBeCloseTo(0, 5);
    expect(out[63]).toBeCloseTo(0, 5);
    expect(inCurve[63]).toBeCloseTo(1, 5);
    // 精确中点用 65 点（index 32 → u 恰为 0.5）：等功率 -3dB × bell=1 的 headroom
    const midCurves = buildTogetherCurves(0.5, 0, 65);
    const mid = Math.SQRT1_2 * Math.pow(10, -1.5 / 20);
    expect(midCurves.out[32]).toBeCloseTo(mid, 6);
    expect(midCurves.in[32]).toBeCloseTo(mid, 6);
  });

  it('平台段两曲同电平，功率和恒不超过 1（headroom 钟形压制）', () => {
    const together = 0.55;
    const { out, in: inCurve } = buildTogetherCurves(0.5, together, 128);
    // 平台以 pivot=0.5 为中心：lead=0.225, trail=0.775
    const u = 64 / 127;
    const bell = Math.sin(u * Math.PI);
    const plateauLevel = Math.SQRT1_2 * Math.pow(10, (-1.5 * bell) / 20);
    expect(out[64]).toBeCloseTo(plateauLevel, 4);
    expect(inCurve[64]).toBeCloseTo(plateauLevel, 4);

    // 全程功率和 = cos²+sin² = 1，再乘 headroom² ≤ 1
    for (let i = 0; i < 128; i++) {
      const power = out[i] * out[i] + inCurve[i] * inCurve[i];
      expect(power).toBeLessThanOrEqual(1 + 1e-6);
    }
    // 端点无 headroom（bell=0）
    expect(out[0]).toBeCloseTo(1, 5);
    // 中点功率和 = headroom² = 10^(-1.5/10)（-1.5dB 的功率比）
    const midPower = out[64] * out[64] + inCurve[64] * inCurve[64];
    expect(midPower).toBeCloseTo(Math.pow(10, -1.5 / 10), 4);
  });

  it('端点与终值精确，平台段对称', () => {
    const { out, in: inCurve } = buildTogetherCurves(0.5, 0.5, 128);
    expect(inCurve[0]).toBe(0);
    expect(out[127]).toBeCloseTo(0, 5);
    expect(inCurve[127]).toBeCloseTo(1, 5);
    // 平台段首尾（lead/trail 边界内）值对称相等：headroom 钟形关于 u=0.5 对称
    const leadIdx = Math.round(0.25 * 127);
    const trailIdx = Math.round(0.75 * 127);
    expect(out[leadIdx]).toBeCloseTo(out[trailIdx], 3);
    expect(inCurve[leadIdx]).toBeCloseTo(inCurve[trailIdx], 3);
    // headroom 钟形使平台中点内凹（-1.5dB 余量），单调性按半程断言：
    // 前半程出场不升，后半程进场不降
    const mid = 64;
    for (let i = 1; i <= mid; i++) {
      expect(out[i]).toBeLessThanOrEqual(out[i - 1] + 1e-6);
    }
    for (let i = mid; i < 128; i++) {
      expect(inCurve[i]).toBeGreaterThanOrEqual(inCurve[i - 1] - 1e-6);
    }
  });

  it('crossover 偏移平台中心', () => {
    const { out } = buildTogetherCurves(0.7, 0.5, 128);
    // pivot=0.7: lead=0.35, trail=0.85 → 平台中心 ≈ 0.6
    const idx = Math.round(0.6 * 127);
    expect(out[idx]).toBeCloseTo(Math.SQRT1_2 * Math.pow(10, -1.5 * Math.sin(0.6 * Math.PI) / 20), 2);
  });

  it('volumeScale 缩放端点', () => {
    const { out, in: inCurve } = buildTogetherCurves(0.5, 0, 64, 0.8);
    expect(out[0]).toBeCloseTo(0.8, 5);
    expect(inCurve[63]).toBeCloseTo(0.8, 5);
  });
});

describe('sampleCurve', () => {
  it('线性插值与边界钳制', () => {
    const curve = new Float32Array([0, 0.5, 1]);
    expect(sampleCurve(curve, 0)).toBe(0);
    expect(sampleCurve(curve, 1)).toBe(1);
    expect(sampleCurve(curve, 0.25)).toBeCloseTo(0.25, 5);
    expect(sampleCurve(curve, -1)).toBe(0);
    expect(sampleCurve(curve, 2)).toBe(1);
  });
});
