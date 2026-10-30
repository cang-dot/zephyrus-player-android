import { describe, expect, it } from 'vitest';

import { chooseTransition } from '@/utils/audio/transitionChooser';

const base = 8;

describe('chooseTransition', () => {
  it('任一侧特征缺失回退 plainBlend', () => {
    for (const next of [null, { introSilenceSec: 2, startsHot: true }]) {
      for (const current of [null, { endsHot: false, outroSlopeDbPerSec: -0.5 }]) {
        if (next === null && current === null) {
          const r = chooseTransition({ next: null, current: null, baseOverlapSec: base });
          expect(r.kind).toBe('plainBlend');
          expect(r.together).toBe(0);
          expect(r.overlapSec).toBe(base);
        }
      }
    }
    expect(chooseTransition({ next: null, current: { endsHot: true, outroSlopeDbPerSec: 0 }, baseOverlapSec: base }).kind).toBe('plainBlend');
    expect(chooseTransition({ next: { introSilenceSec: 2, startsHot: true }, current: null, baseOverlapSec: base }).kind).toBe('plainBlend');
  });

  it('热开场 + 长前导静音 → beatCut（40ms）', () => {
    const r = chooseTransition({
      next: { introSilenceSec: 1.2, startsHot: true },
      current: { endsHot: false, outroSlopeDbPerSec: -0.5 },
      baseOverlapSec: base
    });
    expect(r.kind).toBe('beatCut');
    expect(r.overlapSec).toBeCloseTo(0.04, 3);
    expect(r.leadSec).toBeCloseTo(0.04, 3);
  });

  it('热开场但静音不足 → bassSwap 短重叠（×0.6, together 0.55）', () => {
    const r = chooseTransition({
      next: { introSilenceSec: 0.2, startsHot: true },
      current: { endsHot: false, outroSlopeDbPerSec: -0.5 },
      baseOverlapSec: base
    });
    expect(r.kind).toBe('bassSwap');
    expect(r.overlapSec).toBeCloseTo(base * 0.6, 5);
    expect(r.together).toBe(0.55);
  });

  it('出歌自带淡出（斜率 ≤ -1.5dB/s）→ 压短重叠', () => {
    const r = chooseTransition({
      next: { introSilenceSec: 0, startsHot: false },
      current: { endsHot: true, outroSlopeDbPerSec: -2.5 },
      baseOverlapSec: base
    });
    expect(r.kind).toBe('bassSwap');
    expect(r.overlapSec).toBeCloseTo(base * 0.6, 5);
  });

  it('出歌自然衰减 + 新歌有 intro → tailRide 长重叠（×1.4, together 0.5）', () => {
    const r = chooseTransition({
      next: { introSilenceSec: 0.5, startsHot: false },
      current: { endsHot: false, outroSlopeDbPerSec: -0.5 },
      baseOverlapSec: base
    });
    expect(r.kind).toBe('tailRide');
    expect(r.overlapSec).toBeCloseTo(base * 1.4, 5);
    expect(r.together).toBe(0.5);
  });

  it('有证据无强特征 → bassSwap 兜底（标准重叠）', () => {
    const r = chooseTransition({
      next: { introSilenceSec: 0.1, startsHot: false },
      current: { endsHot: true, outroSlopeDbPerSec: -0.2 },
      baseOverlapSec: base
    });
    expect(r.kind).toBe('bassSwap');
    expect(r.overlapSec).toBe(base);
  });

  it('短基准下重叠下限钳 1s（beatCut 除外）', () => {
    const r = chooseTransition({
      next: { introSilenceSec: 0.1, startsHot: true },
      current: { endsHot: true, outroSlopeDbPerSec: 0 },
      baseOverlapSec: 1
    });
    expect(r.overlapSec).toBeGreaterThanOrEqual(1);
    const cut = chooseTransition({
      next: { introSilenceSec: 2, startsHot: true },
      current: { endsHot: true, outroSlopeDbPerSec: 0 },
      baseOverlapSec: 1
    });
    expect(cut.overlapSec).toBeCloseTo(0.04, 3);
  });
});
