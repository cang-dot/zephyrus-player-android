import { beforeEach, describe, expect, it } from 'vitest';

import {
  minifySongForSnapshot,
  readPlayerSessionSnapshot,
  writePlayerSessionSnapshot
} from '@/services/playbackSnapshot';
import type { SongResult } from '@/types/music';

const baseSong = {
  id: 42,
  name: '测试曲',
  picUrl: 'http://example/cover.jpg',
  ar: [
    { id: 1, name: '歌手甲' },
    { id: 2, name: '歌手乙' }
  ],
  al: { id: 9, name: '专辑' },
  source: 'netease',
  platform: 'netease',
  dt: 200,
  lyric: '超大歌词对象'.repeat(500),
  song: { artists: [] }
} as unknown as SongResult;

describe('playbackSnapshot', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('写入后可读回，且同拍更新 playProgress', () => {
    writePlayerSessionSnapshot(baseSong, 96.5);
    const snap = readPlayerSessionSnapshot();
    expect(snap?.songId).toBe(42);
    expect(snap?.progress).toBe(96.5);
    expect(snap?.song.id).toBe(42);
    expect(typeof snap?.updatedAt).toBe('number');

    const playProgress = JSON.parse(localStorage.getItem('playProgress') || '{}');
    expect(playProgress).toEqual({ songId: 42, progress: 96.5 });
  });

  it('快照曲目是精简的：剥掉 lyric/song 大字段，保留恢复链所需 platform/playMusicUrl', () => {
    const minified = minifySongForSnapshot(baseSong);
    expect(minified).not.toHaveProperty('lyric');
    expect(minified).not.toHaveProperty('song');
    expect(minified.ar).toEqual([
      { id: 1, name: '歌手甲' },
      { id: 2, name: '歌手乙' }
    ]);
    expect(minified.playMusicUrl).toBeUndefined();

    const withUrl = { ...baseSong, playMusicUrl: 'local://x.m4a' } as SongResult;
    expect(minifySongForSnapshot(withUrl).playMusicUrl).toBe('local://x.m4a');
  });

  it('无 id 的 song 跳过写入；损坏数据读回 null', () => {
    writePlayerSessionSnapshot({ ...baseSong, id: undefined } as unknown as SongResult, 10);
    expect(localStorage.getItem('player-session-snapshot')).toBe(null);

    localStorage.setItem('player-session-snapshot', '{broken');
    expect(readPlayerSessionSnapshot()).toBe(null);

    localStorage.setItem('player-session-snapshot', JSON.stringify({ foo: 1 }));
    expect(readPlayerSessionSnapshot()).toBe(null);
  });
});
