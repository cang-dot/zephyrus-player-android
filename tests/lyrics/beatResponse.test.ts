import { describe, expect, it } from 'vitest';

import {
  AdaptiveBaseline,
  AttackReleaseEnvelope,
  weightedSpectralFlux
} from '@/utils/audio/beatResponse';

describe('AdaptiveBaseline', () => {
  it('computes a percentile baseline over prior samples, excluding the current frame', () => {
    const baseline = new AdaptiveBaseline({ windowMs: 1500, percentile: 0.75 });

    // 预热期（无历史）返回 0，由调用方兜底
    expect(baseline.observe(0, 5)).toBe(0);

    for (let i = 1; i <= 19; i++) baseline.observe(i * 16, 5);
    // 20 条历史全是 5 → 75 分位 = 5；本次尖峰 20 不参与基线
    expect(baseline.observe(20 * 16, 20)).toBe(5);
    expect(baseline.size).toBe(21);
  });

  it('ignores isolated spikes at a high percentile', () => {
    const baseline = new AdaptiveBaseline({ windowMs: 10_000, percentile: 0.75 });
    let last = 0;
    for (let i = 0; i < 20; i++) last = baseline.observe(i * 16, 5);
    // 20 条 5 + 1 条尖峰 1000：21 条的 75 分位仍在 5
    baseline.observe(20 * 16, 1000);
    expect(last).toBe(5);
    expect(baseline.observe(21 * 16, 5)).toBe(5);
  });

  it('drops samples outside the time window', () => {
    const baseline = new AdaptiveBaseline({ windowMs: 1500, percentile: 0.75 });

    baseline.observe(0, 100);
    // 2s 后首条样本出窗，历史为空 → 基线回到 0
    expect(baseline.observe(2000, 1)).toBe(0);
    expect(baseline.size).toBe(1);

    baseline.reset();
    expect(baseline.size).toBe(0);
    expect(baseline.observe(2100, 3)).toBe(0);
  });

  it('caps memory via maxSamples', () => {
    const baseline = new AdaptiveBaseline({ windowMs: 60_000, percentile: 0.5, maxSamples: 8 });
    for (let i = 0; i < 50; i++) baseline.observe(i, i);
    expect(baseline.size).toBe(8);
  });
});

describe('weightedSpectralFlux', () => {
  const bins = 64;

  it('is zero for silence and for falling energy', () => {
    const zeros = new Array(bins).fill(0);
    expect(weightedSpectralFlux(zeros, zeros, { lowEnd: 2, midEnd: 32 })).toBe(0);
    const falling = new Array(bins).fill(0);
    const rising = new Array(bins).fill(200);
    expect(weightedSpectralFlux(falling, rising, { lowEnd: 2, midEnd: 32 })).toBe(0);
  });

  it('weights a low-band surge above an equal high-band surge', () => {
    const previous = new Array(bins).fill(100);
    const lowSurge = [...previous];
    lowSurge[1] = 160; // 低频段 +60
    const highSurge = [...previous];
    highSurge[50] = 160; // 高频段 +60

    const bands = { lowEnd: 2, midEnd: 32 };
    const lowFlux = weightedSpectralFlux(lowSurge, previous, bands);
    const highFlux = weightedSpectralFlux(highSurge, previous, bands);

    expect(lowFlux).toBeGreaterThan(0);
    expect(lowFlux).toBeGreaterThan(highFlux);
  });

  it('stays within a comparable magnitude to the mean-flux normalization', () => {
    const previous = new Array(bins).fill(100);
    const current = previous.map((v) => v + 30);
    // 全频段统一 +30：flux = Σ30·w / (Σw·255) = 30/255 ≈ 0.118
    expect(weightedSpectralFlux(current, previous, { lowEnd: 2, midEnd: 32 })).toBeCloseTo(30 / 255, 5);
  });
});

describe('AttackReleaseEnvelope', () => {
  it('attacks fast and releases slowly', () => {
    const envelope = new AttackReleaseEnvelope({ attackMs: 20, releaseMs: 160 });

    let value = 0;
    for (let i = 0; i < 5; i++) value = envelope.step(i * 16, 1);
    // 80ms 起音后应已超过一半
    expect(value).toBeGreaterThan(0.5);

    // 目标归零后 80ms 只回落一小部分（release 慢）
    let released = value;
    for (let i = 0; i < 5; i++) released = envelope.step(100 + i * 16, 0);
    expect(released).toBeGreaterThan(0.4);
    expect(released).toBeLessThan(value);
  });

  it('reset clears state so the next step starts from rest', () => {
    const envelope = new AttackReleaseEnvelope();
    envelope.step(0, 1);
    envelope.step(16, 1);
    envelope.reset();
    expect(envelope.step(1000, 1)).toBeLessThan(0.6);
  });
});
