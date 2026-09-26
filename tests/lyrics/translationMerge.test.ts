import { describe, expect, it } from 'vitest';

import { mergeTranslationFeatures } from '../../src/renderer/utils/lyricTranslationMerge';
import type { ILyricText } from '../../src/renderer/types/music';

const line = (text: string, startTime = 1000, extra: Partial<ILyricText> = {}): ILyricText => ({
  text,
  trText: '',
  startTime,
  ...extra
});

describe('mergeTranslationFeatures — 内联全角括号翻译', () => {
  it('splits the user-reported example into text + trText', () => {
    const result = mergeTranslationFeatures([
      line('I feel lonely, makes me start miss you.（我觉得孤独让你开始想你）')
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('I feel lonely, makes me start miss you.');
    expect(result[0].trText).toBe('我觉得孤独让你开始想你');
  });

  it('keeps trailing punctuation out of both parts', () => {
    const result = mergeTranslationFeatures([line('Hold me tight（紧紧抱住我）。')]);
    expect(result[0].text).toBe('Hold me tight');
    expect(result[0].trText).toBe('紧紧抱住我');
  });

  it('ignores halfwidth parens with non-CJK content (style tags like (Live))', () => {
    const source = 'Song (Live)';
    const result = mergeTranslationFeatures([line(source)]);
    expect(result[0].text).toBe(source);
    expect(result[0].trText).toBe('');
  });

  it('ignores fullwidth parens whose content is not CJK', () => {
    const source = 'Song（Live）';
    const result = mergeTranslationFeatures([line(source)]);
    expect(result[0].text).toBe(source);
  });

  it('does not touch pure CJK lines', () => {
    const source = '我爱你（我也爱你）';
    const result = mergeTranslationFeatures([line(source)]);
    expect(result[0].text).toBe(source);
  });

  it('keeps lines that already carry a translation', () => {
    const result = mergeTranslationFeatures([
      line('Hello（你好）', 1000, { trText: '你好' })
    ]);
    expect(result[0].text).toBe('Hello（你好）');
    expect(result[0].trText).toBe('你好');
  });
});

describe('mergeTranslationFeatures — 同时间轴双行', () => {
  it('merges same-timestamp latin original + CJK translation', () => {
    const result = mergeTranslationFeatures([
      line('I feel lonely', 2000),
      line('我觉得孤独', 2000)
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('I feel lonely');
    expect(result[0].trText).toBe('我觉得孤独');
  });

  it('merges reversed order (translation line first)', () => {
    const result = mergeTranslationFeatures([
      line('我觉得孤独', 2000),
      line('I feel lonely', 2000)
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('I feel lonely');
    expect(result[0].trText).toBe('我觉得孤独');
  });

  it('merges near timestamps within the window', () => {
    const result = mergeTranslationFeatures([
      line('I feel lonely', 2000),
      line('我觉得孤独', 2040)
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].trText).toBe('我觉得孤独');
  });

  it('does not merge lines outside the window', () => {
    const result = mergeTranslationFeatures([
      line('I feel lonely', 2000),
      line('我觉得孤独', 2400)
    ]);
    expect(result).toHaveLength(2);
  });

  it('does not merge two CJK lines', () => {
    const result = mergeTranslationFeatures([line('我觉得孤独', 2000), line('我想念你', 2000)]);
    expect(result).toHaveLength(2);
  });

  it('keeps word timing from the latin original', () => {
    const result = mergeTranslationFeatures([
      line('I feel lonely', 2000, {
        words: [
          { text: 'I', startTime: 2000, duration: 200 },
          { text: 'feel', startTime: 2200, duration: 300 }
        ],
        hasWordByWord: true
      }),
      line('我觉得孤独', 2000)
    ]);
    expect(result[0].words).toEqual([
      { text: 'I', startTime: 2000, duration: 200 },
      { text: 'feel', startTime: 2200, duration: 300 }
    ]);
    expect(result[0].hasWordByWord).toBe(true);
  });

  it('does not merge background lines', () => {
    const result = mergeTranslationFeatures([
      line('I feel lonely', 2000),
      line('我觉得孤独', 2000, { isBG: true })
    ]);
    expect(result).toHaveLength(2);
  });
});
