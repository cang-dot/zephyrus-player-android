import { beforeEach, describe, expect, it } from 'vitest';

import {
  markSessionSnapshotSong,
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

  it('markSessionSnapshotSong 只标记身份，绝不动 playProgress（进度恢复语义）', () => {
    // 心跳已写 B 的真实进度
    writePlayerSessionSnapshot(baseSong, 96.5);
    const playProgressBefore = localStorage.getItem('playProgress');

    // 切到新歌 C：身份快照换曲，playProgress 必须原样保留（B 的进度不能被抹成 0）
    const songC = { ...baseSong, id: 77, name: '新歌' } as SongResult;
    markSessionSnapshotSong(songC);
    const snap = readPlayerSessionSnapshot();
    expect(snap?.songId).toBe(77);
    expect(snap?.progress).toBe(0); // 新歌「听到哪」为 0
    expect(localStorage.getItem('playProgress')).toBe(playProgressBefore);

    // 重播同曲：progress 透传旧快照值（重播=继续语义）
    markSessionSnapshotSong(songC);
    expect(readPlayerSessionSnapshot()?.progress).toBe(0);
    writePlayerSessionSnapshot(songC, 33);
    markSessionSnapshotSong(songC);
    expect(readPlayerSessionSnapshot()?.progress).toBe(33);
    expect(localStorage.getItem('playProgress')).toBe(
      JSON.stringify({ songId: 77, progress: 33 })
    );
  });
});
