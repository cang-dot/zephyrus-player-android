import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { useTransitionStore } from '@/store/modules/transition';
import {
  type SeekPlaybackSnapshot,
  shouldRestorePlayback,
  shouldSuppressSeekPause
} from '@/utils/seekPlaybackGuard';

const seekSnapshot = (overrides: Partial<SeekPlaybackSnapshot> = {}): SeekPlaybackSnapshot => ({
  requestId: 1,
  soundId: 'sound-a',
  wasPlaying: true,
  startedAt: 1_000,
  ...overrides
});

describe('seek playback guard', () => {
  it('suppresses a transient pause and restores only the playing snapshot', () => {
    const snapshot = seekSnapshot();
    expect(shouldSuppressSeekPause(snapshot, 'sound-a', 1_200)).toBe(true);
    expect(shouldRestorePlayback(snapshot, 'sound-a', false, 1_200)).toBe(true);
  });

  it('keeps paused songs paused and rejects stale or expired events', () => {
    expect(shouldSuppressSeekPause(seekSnapshot({ wasPlaying: false }), 'sound-a', 1_200)).toBe(
      false
    );
    expect(shouldRestorePlayback(seekSnapshot(), 'sound-b', false, 1_200)).toBe(false);
    expect(shouldRestorePlayback(seekSnapshot(), 'sound-a', false, 1_701)).toBe(false);
    expect(shouldRestorePlayback(seekSnapshot(), 'sound-a', true, 1_200)).toBe(false);
  });
});

describe('mobile transition snapshot', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('keeps current and next visual colors and ignores stale completion', () => {
    const store = useTransitionStore();
    store.begin({
      duration: 6,
      current: {
        title: 'Current',
        artist: 'Artist A',
        primaryColor: '#101010',
        backgroundColor: '#202020',
        coverUrl: 'cover-current'
      },
      next: {
        trackId: 'next-a',
        title: 'Next',
        artist: 'Artist B',
        primaryColor: '#f0c040',
        backgroundColor: '#403020',
        coverUrl: 'cover-a'
      },
      nextProgress: 0
    });
    expect(store.isCrossfadingUI).toBe(true);
    expect(store.currentAccentColor).toBe('#101010');
    expect(store.nextAccentColor).toBe('#f0c040');
    expect(store.nextTrackId).toBe('next-a');

    store.begin({
      duration: 6,
      current: {
        title: 'Next',
        artist: 'Artist B',
        primaryColor: '#f0c040',
        backgroundColor: '#403020',
        coverUrl: 'cover-a'
      },
      next: {
        trackId: 'next-b',
        title: 'Later',
        artist: 'Artist C',
        primaryColor: '#4060f0',
        backgroundColor: '#101020',
        coverUrl: 'cover-b'
      },
      nextProgress: 0
    });
    store.end('next-a');
    expect(store.isCrossfadingUI).toBe(true);
    expect(store.nextTrackId).toBe('next-b');
    store.end('next-b');
    expect(store.isCrossfadingUI).toBe(false);
  });
});
