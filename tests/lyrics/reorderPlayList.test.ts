import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { usePlaylistStore } from '@/store/modules/playlist';
import type { SongResult } from '@/types/music';

function makeSong(id: number): SongResult {
  return { id, name: `song-${id}` } as unknown as SongResult;
}

describe('reorderPlayList（沉浸队列拖拽排序）', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('移动当前播放曲：索引跟随到新位置', () => {
    const store = usePlaylistStore();
    store.setPlayList([makeSong(1), makeSong(2), makeSong(3), makeSong(4), makeSong(5)]);
    store.playListIndex = 2;

    store.reorderPlayList(2, 4);

    expect(store.playList.map((s) => s.id)).toEqual([1, 2, 4, 5, 3]);
    expect(store.playListIndex).toBe(4);
  });

  it('向前跨越当前曲：索引减一', () => {
    const store = usePlaylistStore();
    store.setPlayList([makeSong(1), makeSong(2), makeSong(3), makeSong(4), makeSong(5)]);
    store.playListIndex = 2;

    store.reorderPlayList(0, 3);

    expect(store.playList.map((s) => s.id)).toEqual([2, 3, 4, 1, 5]);
    expect(store.playListIndex).toBe(1);
  });

  it('向后跨越当前曲：索引加一', () => {
    const store = usePlaylistStore();
    store.setPlayList([makeSong(1), makeSong(2), makeSong(3), makeSong(4), makeSong(5)]);
    store.playListIndex = 2;

    // 把队尾(5)移到队首：当前曲(3)被推后一位
    store.reorderPlayList(4, 0);

    expect(store.playList.map((s) => s.id)).toEqual([5, 1, 2, 3, 4]);
    expect(store.playListIndex).toBe(3);
  });

  it('不跨越当前曲：索引不变', () => {
    const store = usePlaylistStore();
    store.setPlayList([makeSong(1), makeSong(2), makeSong(3), makeSong(4), makeSong(5)]);
    store.playListIndex = 2;

    store.reorderPlayList(0, 1);

    expect(store.playList.map((s) => s.id)).toEqual([2, 1, 3, 4, 5]);
    expect(store.playListIndex).toBe(2);
  });

  it('越界与原地移动为无操作', () => {
    const store = usePlaylistStore();
    store.setPlayList([makeSong(1), makeSong(2), makeSong(3)]);
    store.playListIndex = 1;

    store.reorderPlayList(1, 1);
    store.reorderPlayList(-1, 0);
    store.reorderPlayList(0, 9);

    expect(store.playList.map((s) => s.id)).toEqual([1, 2, 3]);
    expect(store.playListIndex).toBe(1);
  });
});
