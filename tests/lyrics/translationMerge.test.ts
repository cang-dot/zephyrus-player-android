import { describe, expect, it } from 'vitest';

import type { ILyricText } from '../../src/renderer/types/music';
import {
  mergeBilingualAlternation,
  mergeTranslationFeatures
} from '../../src/renderer/utils/lyricTranslationMerge';

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

describe('mergeBilingualAlternation — 春晓中英整行交替（真实歌词结构）', () => {
  it('pairs each Chinese line with the following English line', () => {
    const result = mergeBilingualAlternation([
      line('他们是一群无能的猪 安逸时贪图享乐', 34708, { duration: 5203 }),
      line('They are a bunch of incompetent pigs, indulging in pleasures', 39911, { duration: 5364 }),
      line('他们是一群勤劳的猪 危难时任人宰割', 45275, { duration: 5120 }),
      line('They are a bunch of diligent pigs, being slaughtered when needed', 50395, { duration: 5601 })
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('他们是一群无能的猪 安逸时贪图享乐');
    expect(result[0].trText).toBe(
      'They are a bunch of incompetent pigs, indulging in pleasures'
    );
    expect(result[0].duration).toBe(39911 + 5364 - 34708);
    expect(result[1].text).toBe('他们是一群勤劳的猪 危难时任人宰割');
    expect(result[1].trText).toBe(
      'They are a bunch of diligent pigs, being slaughtered when needed'
    );
  });

  it('leaves mixed-script credit lines unpaired', () => {
    const result = mergeBilingualAlternation([
      line('编曲：白韶 Arrangement: Bai Shao', 2506),
      line('音频编辑：韩聪 Track Editing: Han Cong', 3824)
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].trText).toBe('');
  });

  it('keeps the last english line end as the merged duration', () => {
    const result = mergeBilingualAlternation([
      line('他们说的所有语言都是荒诞的（都是荒诞的）', 102637, { duration: 6682 }),
      line('Everything they say is absurd (absurd)', 109319, { duration: 4066 })
    ]);
    // 首行含全角括号但括号内外同为中文/拉丁方向不符 → 仅作为 CJK 主行配对英文行
    expect(result).toHaveLength(1);
    expect(result[0].trText).toBe('Everything they say is absurd (absurd)');
    expect(result[0].duration).toBe(109319 + 4066 - 102637);
  });
});
