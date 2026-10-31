import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import {
  readCrashCountFromStorage,
  resolveStartupDegraded,
  useBackgroundHealthStore
} from '@/store/modules/backgroundHealth';

const CRASH_COUNT_KEY = 'background-health-crash-count';
const CRASHED_LAST_KEY = 'background-health-crashed-last';

describe('backgroundHealth', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('readCrashCountFromStorage：非法/缺省回 0，正整数保留', () => {
    expect(readCrashCountFromStorage()).toBe(0);
    localStorage.setItem(CRASH_COUNT_KEY, '2');
    expect(readCrashCountFromStorage()).toBe(2);
    localStorage.setItem(CRASH_COUNT_KEY, 'abc');
    expect(readCrashCountFromStorage()).toBe(0);
    localStorage.setItem(CRASH_COUNT_KEY, '-3');
    expect(readCrashCountFromStorage()).toBe(0);
  });

  it('resolveStartupDegraded：上次崩过或计数达阈值都降档', () => {
    expect(resolveStartupDegraded(true, 0)).toBe(true);
    expect(resolveStartupDegraded(false, 2)).toBe(true);
    expect(resolveStartupDegraded(false, 1)).toBe(false);
    expect(resolveStartupDegraded(false, 0)).toBe(false);
  });

  it('reportContextLost：计数持久化、同步写跨会话标记、置降级并广播', () => {
    const store = useBackgroundHealthStore();
    const events: Event[] = [];
    window.addEventListener('background-health-degraded', (e) => events.push(e));

    store.reportContextLost('mesh');

    expect(store.degraded).toBe(true);
    expect(store.crashCount).toBe(1);
    expect(localStorage.getItem(CRASH_COUNT_KEY)).toBe('1');
    expect(localStorage.getItem(CRASHED_LAST_KEY)).toBe('1');
    expect(events.length).toBe(1);

    // 5s 去重窗口内的重复上报不叠加
    store.reportContextLost('ether-fluid');
    expect(store.crashCount).toBe(1);
  });

  it('tryRestoreAtSafePoint：整个会话只放行一次重试', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const store = useBackgroundHealthStore();
    store.reportContextLost('liquid-ether');
    expect(store.degraded).toBe(true);

    store.tryRestoreAtSafePoint();
    expect(store.degraded).toBe(false);

    // 跨过去重窗口的第二次崩溃：直接降级；重试名额已用尽，不再放行
    vi.advanceTimersByTime(5001);
    store.reportContextLost('mesh');
    expect(store.degraded).toBe(true);
    store.tryRestoreAtSafePoint();
    expect(store.degraded).toBe(true);
    vi.useRealTimers();
  });

  it('applyStartupFuse：上次崩溃标记触发降档并清除标记', () => {
    localStorage.setItem(CRASHED_LAST_KEY, '1');
    const store = useBackgroundHealthStore();
    store.applyStartupFuse();
    expect(store.degraded).toBe(true);
    expect(store.startupDegraded).toBe(true);
    expect(localStorage.getItem(CRASHED_LAST_KEY)).toBe(null);
  });

  it('applyStartupFuse：无标记且计数未达阈值时不降档', () => {
    const store = useBackgroundHealthStore();
    store.applyStartupFuse();
    expect(store.degraded).toBe(false);
    expect(store.startupDegraded).toBe(false);
  });
});
