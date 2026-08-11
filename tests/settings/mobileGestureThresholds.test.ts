import { describe, expect, it } from 'vitest';

import {
  shouldCommitMobilePageSwipe,
  shouldOpenMobilePlayer
} from '../../src/renderer/utils/mobileGestureThresholds';

describe('mobile gesture thresholds', () => {
  it('commits a page swipe at 35 percent or sufficient projected velocity', () => {
    expect(shouldCommitMobilePageSwipe(125.9, 360, 0.1)).toBe(false);
    expect(shouldCommitMobilePageSwipe(126, 360, 0.1)).toBe(true);
    expect(shouldCommitMobilePageSwipe(24, 360, -0.55)).toBe(true);
  });

  it('never commits past the first or last page', () => {
    expect(shouldCommitMobilePageSwipe(200, 360, 1, false)).toBe(false);
  });

  it('opens the player from progress or upward release velocity', () => {
    expect(shouldOpenMobilePlayer(0.379, 0.54)).toBe(false);
    expect(shouldOpenMobilePlayer(0.38, 0)).toBe(true);
    expect(shouldOpenMobilePlayer(0.1, 0.55)).toBe(true);
  });
});
