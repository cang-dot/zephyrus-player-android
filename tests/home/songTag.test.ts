import { describe, expect, it } from 'vitest';

import { resolveSongTag } from '@/utils/songTag';

const translate = (key: string) => {
  const dict: Record<string, string> = {
    'comp.homeV2.tagLossless': '无损',
    'comp.homeV2.tagNiche': '小众推荐'
  };
  return dict[key] ?? key;
};

describe('resolveSongTag', () => {
  it('prefers the daily-recommend reason over quality and popularity', () => {
    const tag = resolveSongTag(
      { reason: '欧美热门精选', recommendReason: '其他理由', maxbr: 999000, pop: 10 },
      translate
    );
    expect(tag).toEqual({ kind: 'reason', text: '欧美热门精选' });
  });

  it('falls back to recommendReason when reason is empty', () => {
    const tag = resolveSongTag({ reason: '', recommendReason: '因为你喜欢' }, translate);
    expect(tag).toEqual({ kind: 'reason', text: '因为你喜欢' });
  });

  it('marks lossless quality when maxbr reaches the lossless threshold', () => {
    expect(resolveSongTag({ maxbr: 999000, pop: 80 }, translate)).toEqual({
      kind: 'quality',
      text: '无损'
    });
  });

  it('reads maxbr from the privilege object', () => {
    expect(resolveSongTag({ privilege: { maxbr: 1999000 }, pop: 90 }, translate)).toEqual({
      kind: 'quality',
      text: '无损'
    });
  });

  it('marks niche songs when popularity is low', () => {
    expect(resolveSongTag({ pop: 12 }, translate)).toEqual({ kind: 'niche', text: '小众推荐' });
  });

  it('returns undefined when nothing qualifies', () => {
    expect(resolveSongTag({ pop: 88 }, translate)).toBeUndefined();
    expect(resolveSongTag({ pop: 0 }, translate)).toBeUndefined();
    expect(resolveSongTag({}, translate)).toBeUndefined();
    expect(resolveSongTag(null, translate)).toBeUndefined();
    expect(resolveSongTag(undefined, translate)).toBeUndefined();
  });
});
