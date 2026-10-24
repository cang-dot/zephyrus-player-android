import { beforeEach,describe, expect, it } from 'vitest';

import { _resetForTest, _setTestWide, isWideNow, useWideViewport } from '@/utils/isWideViewport';

describe('isWideViewport（宽屏判定）', () => {
  beforeEach(() => {
    _resetForTest();
  });

  it('注入值生效：isWideNow 与 useWideViewport 同源', () => {
    _setTestWide(true);
    expect(isWideNow()).toBe(true);
    const { isWide } = useWideViewport();
    expect(isWide.value).toBe(true);
    _setTestWide(false);
    expect(isWideNow()).toBe(false);
    expect(isWide.value).toBe(false);
  });

  it('单例：多次 useWideViewport 返回同一 ref', () => {
    _setTestWide(true);
    const a = useWideViewport();
    const b = useWideViewport();
    expect(a.isWide).toBe(b.isWide);
  });
});
