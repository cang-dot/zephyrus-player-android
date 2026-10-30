import { describe, expect, it } from 'vitest';

import {
  analyzeIntro,
  analyzeOutro,
  outroFeaturesFromHistory,
  TRACK_FEATURE_THRESHOLDS as TH
} from '@/utils/audio/trackFeatures';

const SR = 8000;

/** 生成正弦 PCM（振幅线性/常值） */
function sine(amplitude: number, seconds: number, freq = 440): Float32Array {
  const n = Math.round(seconds * SR);
  const pcm = new Float32Array(n);
  for (let i = 0; i < n; i++) pcm[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / SR);
  return pcm;
}

describe('analyzeIntro', () => {
  it('前导静音被测出，热开场判定成立', () => {
    const silence = new Float32Array(Math.round(1.5 * SR)); // 1.5s 静音
    const hot = sine(0.6, 8.5);
    const pcm = new Float32Array(silence.length + hot.length);
    pcm.set(silence, 0);
    pcm.set(hot, silence.length);
    const r = analyzeIntro(pcm, SR);
    expect(r.introSilenceSec).toBeGreaterThanOrEqual(1.4);
    expect(r.introSilenceSec).toBeLessThanOrEqual(1.7);
    expect(r.startsHot).toBe(true);
  });

  it('渐入式开场（先弱后强）判 startsHot=false', () => {
    const n = Math.round(10 * SR);
    const pcm = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      // 开场 0.05 振幅，5 秒后爬到 0.6
      const t = i / SR;
      const amp = t < 5 ? 0.05 : 0.6;
      pcm[i] = amp * Math.sin((2 * Math.PI * 440 * i) / SR);
    }
    const r = analyzeIntro(pcm, SR);
    expect(r.startsHot).toBe(false);
  });

  it('全静音段：introSilenceSec = 全长，startsHot=false', () => {
    const r = analyzeIntro(new Float32Array(Math.round(10 * SR)), SR);
    expect(r.introSilenceSec).toBeCloseTo(10, 0);
    expect(r.startsHot).toBe(false);
  });

  it('数据过短返回中性值不崩溃', () => {
    const r = analyzeIntro(new Float32Array(100), SR);
    expect(r.introSilenceSec).toBe(0);
    expect(r.startsHot).toBe(false);
  });
});

describe('analyzeOutro', () => {
  it('自然衰减尾段：endsHot=false，斜率为负', () => {
    const n = Math.round(30 * SR);
    const pcm = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      // 30s 内线性衰减 12dB（振幅域 10^(dB/20)）
      const amp = 0.6 * Math.pow(10, (-12 * t) / 30 / 20);
      pcm[i] = amp * Math.sin((2 * Math.PI * 440 * i) / SR);
    }
    const r = analyzeOutro(pcm, SR);
    expect(r.endsHot).toBe(false);
    expect(r.outroSlopeDbPerSec).toBeLessThan(-0.2);
  });

  it('恒定响度收尾：endsHot=true', () => {
    const r = analyzeOutro(sine(0.6, 30), SR);
    expect(r.endsHot).toBe(true);
    expect(Math.abs(r.outroSlopeDbPerSec)).toBeLessThan(0.2);
  });
});

describe('outroFeaturesFromHistory', () => {
  it('历史不足返回 null', () => {
    expect(outroFeaturesFromHistory([], 1)).toBeNull();
    expect(outroFeaturesFromHistory([-10, -10, -10], 1)).toBeNull();
  });

  it('衰减历史判自然衰减；平稳历史判热收尾', () => {
    const fading: number[] = [];
    for (let i = 0; i < 20; i++) fading.push(-8 - 0.6 * i); // -0.6dB/s
    const fade = outroFeaturesFromHistory(fading, 1);
    expect(fade).not.toBeNull();
    expect(fade!.endsHot).toBe(false);
    expect(fade!.outroSlopeDbPerSec).toBeCloseTo(-0.6, 1);

    const steady: number[] = new Array(20).fill(-9);
    const hot = outroFeaturesFromHistory(steady, 1);
    expect(hot).not.toBeNull();
    expect(hot!.endsHot).toBe(true);
  });
});

describe('阈值出口', () => {
  it('selfFadeSlopeDbPerSec 与 folia 对齐为 -1.5dB/s', () => {
    expect(TH.selfFadeSlopeDbPerSec).toBe(-1.5);
  });
});
