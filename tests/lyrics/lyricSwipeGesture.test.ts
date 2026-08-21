import { describe, expect, it } from 'vitest';

import { lyricSwipeSign, shouldCommitLyricSwipe } from '@/composables/useLyricSwipeGesture';

describe('lyric swipe gesture', () => {
  it('uses the configured opening direction and mirrors it when closing', () => {
    expect(lyricSwipeSign('left', false)).toBe(-1);
    expect(lyricSwipeSign('left', true)).toBe(1);
    expect(lyricSwipeSign('right', false)).toBe(1);
    expect(lyricSwipeSign('right', true)).toBe(-1);
  });

  it('commits a projected flick but rejects a short reverse drag', () => {
    expect(shouldCommitLyricSwipe(-72, -140, -1, 400)).toBe(true);
    expect(shouldCommitLyricSwipe(36, 0, -1, 400)).toBe(false);
    expect(shouldCommitLyricSwipe(28, 820, 1, 400)).toBe(true);
  });
});
