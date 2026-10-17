import { describe, expect, it } from 'vitest';

import {
  decideImmersiveDragSettle,
  projectMomentum,
  rubberbandClamp01
} from '@/utils/immersiveMotion';

describe('immersive lyrics rise gesture (momentum projection)', () => {
  it('projects momentum with exponential decay (d = 0.99)', () => {
    // v/1000 * d/(1-d)，d=0.99 → 系数 99：600px/s ≈ 59px 惯性滑行
    expect(projectMomentum(0)).toBe(0);
    expect(projectMomentum(600)).toBeCloseTo(59.4, 1);
    expect(projectMomentum(-300)).toBeCloseTo(-29.7, 1);
  });

  it('commits when the projected landing passes the threshold', () => {
    const distance = 220;
    const shouldCommit = (start: number, velocity: number) =>
      start + projectMomentum(velocity) / distance >= 0.55;

    expect(shouldCommit(0.3, 900)).toBe(true); // 快速轻扫：动量投掷过阈
    expect(shouldCommit(0.3, 200)).toBe(false); // 慢拖未过半：回落
    expect(shouldCommit(0.6, 0)).toBe(true); // 静止但已过半：提交
    expect(shouldCommit(0.4, 0)).toBe(false); // 静止未过半：回落
  });
});

describe('rubberbandClamp01 (soft edges)', () => {
  it('passes in-range values through', () => {
    expect(rubberbandClamp01(0)).toBe(0);
    expect(rubberbandClamp01(0.5)).toBe(0.5);
    expect(rubberbandClamp01(1)).toBe(1);
  });

  it('resists progressively beyond both edges', () => {
    // 越界 0.4 → 0.4*0.55/1.22 ≈ 0.18：有位移但被阻尼
    expect(rubberbandClamp01(-0.4)).toBeLessThan(0);
    expect(rubberbandClamp01(-0.4)).toBeGreaterThan(-0.25);
    expect(rubberbandClamp01(1.4)).toBeGreaterThan(1);
    expect(rubberbandClamp01(1.4)).toBeLessThan(1.25);
    // 渐进阻力：位移/输入 的比值随深度递减（0.4→45%，1.4→31%，2.4→更小）
    const ratio = (overshoot: number) => (rubberbandClamp01(1 + overshoot) - 1) / overshoot;
    expect(ratio(0.4)).toBeGreaterThan(ratio(1.4));
    expect(ratio(1.4)).toBeGreaterThan(ratio(2.4));
  });
});

describe('decideImmersiveDragSettle (bidirectional info-bar drag)', () => {
  const commitVelocity = 620 / 240; // ≈620px/s ÷ 行程

  it('closed state: commits open on projection or upward flick', () => {
    expect(decideImmersiveDragSettle({ progress: 0.6, velocity: 0, isOpen: false })).toBe(1);
    expect(
      decideImmersiveDragSettle({
        progress: 0.2,
        velocity: 3,
        isOpen: false,
        commitVelocity
      })
    ).toBe(1);
    expect(decideImmersiveDragSettle({ progress: 0.3, velocity: 0, isOpen: false })).toBe(0);
  });

  it('open state: mirrors to close on downward projection or flick', () => {
    expect(decideImmersiveDragSettle({ progress: 0.4, velocity: 0, isOpen: true })).toBe(0);
    expect(
      decideImmersiveDragSettle({
        progress: 0.9,
        velocity: -3,
        isOpen: true,
        commitVelocity
      })
    ).toBe(0);
    // 轻拖即松：弹回展开
    expect(decideImmersiveDragSettle({ progress: 0.85, velocity: 0, isOpen: true })).toBe(1);
  });

  it('cancelled gesture always returns to the origin state', () => {
    expect(
      decideImmersiveDragSettle({ progress: 0.8, velocity: 5, isOpen: false, cancelled: true })
    ).toBe(0);
    expect(
      decideImmersiveDragSettle({ progress: 0.2, velocity: -5, isOpen: true, cancelled: true })
    ).toBe(1);
  });
});
