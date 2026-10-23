import { describe, expect, it } from 'vitest';

import {
  burnHash01,
  burnNoiseShiftPx,
  burnTotalDurationSec,
  lyricCharDelaySec
} from '@/utils/errorBurnLyric';

describe('errorBurnLyric（溶解/燃烧逐字切换）', () => {
  it('dissolve：全字 delay 为零（同步边缘溶解）', () => {
    for (let i = 0; i < 20; i++) {
      expect(lyricCharDelaySec('dissolve', i)).toBe(0);
    }
  });

  it('burn：delay 随 index 单调不递减，抖动有界', () => {
    let prev = -1;
    for (let i = 0; i < 24; i++) {
      const d = lyricCharDelaySec('burn', i);
      expect(d).toBeGreaterThanOrEqual(prev);
      expect(d).toBeLessThanOrEqual(i * 0.045 + 0.03 + 1e-9);
      prev = d;
    }
    // 相邻字平均步进接近 45ms（抖动均值不为零也不吞掉步进）
    const span = lyricCharDelaySec('burn', 23) - lyricCharDelaySec('burn', 0);
    expect(span).toBeGreaterThan(23 * 0.045 * 0.8);
    expect(span).toBeLessThan(23 * 0.045 + 0.03);
  });

  it('burnHash01：确定性且在 0~1', () => {
    expect(burnHash01(7)).toBe(burnHash01(7));
    for (let i = 0; i < 50; i++) {
      const v = burnHash01(i);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('总时长：dissolve 覆盖动画本体；burn 覆盖末字 delay + ember 滞后', () => {
    const dissolveTotal = burnTotalDurationSec('dissolve', 10);
    expect(dissolveTotal).toBeGreaterThanOrEqual(0.62);

    const burnTotal = burnTotalDurationSec('burn', 12);
    const lastDelay = lyricCharDelaySec('burn', 11);
    expect(burnTotal).toBeGreaterThanOrEqual(lastDelay + 0.5 + 0.12);
    // 空行不崩溃
    expect(burnTotalDurationSec('burn', 0)).toBeGreaterThan(0.5);
  });

  it('噪声相位：确定性且范围有界', () => {
    expect(burnNoiseShiftPx(5)).toBe(burnNoiseShiftPx(5));
    for (let i = 0; i < 30; i++) {
      expect(Math.abs(burnNoiseShiftPx(i))).toBeLessThanOrEqual(60);
    }
  });
});
