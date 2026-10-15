import { describe, expect, it } from 'vitest';

import { projectMomentum } from '@/utils/immersiveMotion';

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
