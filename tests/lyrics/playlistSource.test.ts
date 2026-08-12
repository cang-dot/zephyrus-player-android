import { describe, expect, it } from 'vitest';

import {
  getMissingTrackIds,
  isSameMusicListSource,
  orderSongsByTrackIds
} from '@/utils/playlistSource';

describe('playlist source isolation', () => {
  it('does not reuse the same numeric id across platforms', () => {
    expect(
      isSameMusicListSource(
        { platform: 'netease', accountId: 'netease:1', sourceId: '42', kind: 'playlist' },
        { platform: 'qq', accountId: 'qq:1', sourceId: '42', kind: 'playlist' }
      )
    ).toBe(false);
  });

  it('keeps trackIds order when detail responses are shuffled', () => {
    const songs = orderSongsByTrackIds(
      [10, 20, 30, 40],
      [{ id: 30, name: 'third' }],
      [
        { id: 40, name: 'fourth' },
        { id: 10, name: 'first' },
        { id: 20, name: 'second' }
      ]
    );
    expect(songs.map((song) => song.id)).toEqual([10, 20, 30, 40]);
  });

  it('requests gaps by source order instead of current array length', () => {
    expect(getMissingTrackIds([10, 20, 30, 40], [{ id: 10 }, { id: 30 }], 2)).toEqual([20, 40]);
  });
});
