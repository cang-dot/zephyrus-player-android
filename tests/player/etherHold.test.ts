import { describe, expect, it } from 'vitest';

import { createHoldWalker, HOLD_PATTERNS, selectHoldPattern } from '@/utils/etherFluid';

describe('etherFluid hold walker（抽帧跳变节拍）', () => {
  it('能量分档边界正确', () => {
    expect(selectHoldPattern(0.1)).toBe('tally');
    expect(selectHoldPattern(0.34)).toBe('tally');
    expect(selectHoldPattern(0.35)).toBe('hui');
    expect(selectHoldPattern(0.67)).toBe('hui');
    expect(selectHoldPattern(0.68)).toBe('storm');
    expect(selectHoldPattern(0.95)).toBe('storm');
  });

  it('tally 保持表推进/冻结节拍与表一致', () => {
    // tally = [3,1,2,1,4,...]：源帧 0 保持 3 拍、源帧 1 保持 1 拍、源帧 2 保持 2 拍…
    const walker = createHoldWalker();
    const ticks = Array.from({ length: 11 }, () => walker(0.2));
    expect(ticks).toEqual([
      true, // 源帧 0（保持 3）
      false,
      false,
      true, // 源帧 1（保持 1）
      true, // 源帧 2（保持 2）
      false,
      true, // 源帧 3（保持 1）
      true, // 源帧 4（保持 4）
      false,
      false,
      false
    ]);
  });

  it('storm 档几乎每拍推进（保持最短 1 帧）', () => {
    const walker = createHoldWalker();
    const ticks = Array.from({ length: 8 }, () => walker(0.9));
    const advances = ticks.filter(Boolean).length;
    // storm = [1,1,2,1,1,2,1,3]：8 拍内至少 6 次推进
    expect(advances).toBeGreaterThanOrEqual(6);
    expect(HOLD_PATTERNS.storm.every((h) => h >= 1)).toBe(true);
  });

  it('能量跨越分档边界：模式表从当前位置平滑接管', () => {
    const walker = createHoldWalker();
    walker(0.9); // storm 组0（长1）：推进
    walker(0.9); // storm 组1（长1）：推进
    walker(0.9); // storm 组2（长2）：推进（组内第 1 拍）
    // 切到 tally，patternPos=2（tally 组2 长 2）：本拍是组内第 2 拍 → 冻结
    expect(walker(0.2)).toBe(false);
    // 下一拍进入 tally 组3（长1）→ 推进
    expect(walker(0.2)).toBe(true);
  });
});
