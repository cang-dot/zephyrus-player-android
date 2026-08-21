import { describe, expect, it, vi } from 'vitest';

import { AudioScheduler } from '@/utils/audio/scheduler';

function createContext() {
  return { currentTime: 0 } as AudioContext;
}

describe('AudioScheduler transition scopes', () => {
  it('cancels only events owned by the disposed scope', () => {
    const scheduler = new AudioScheduler(createContext());
    const scope = scheduler.createScope();
    scheduler.scheduleAt(10, vi.fn(), 'unowned');
    scope.scheduleAt(10, vi.fn(), 'owned');

    expect(scheduler.pendingCount).toBe(2);
    scope.cancel();
    expect(scheduler.pendingCount).toBe(1);
  });

  it('clears pending events when stopped', () => {
    const scheduler = new AudioScheduler(createContext());
    scheduler.scheduleAt(10, vi.fn());
    scheduler.stop();
    expect(scheduler.pendingCount).toBe(0);
  });
});
