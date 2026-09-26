import { describe, expect, it } from 'vitest';

import { splitSongTitle } from '../../src/renderer/utils/songTitle';

describe('splitSongTitle — 结尾括号后缀', () => {
  it('strips fullwidth trailing parens', () => {
    expect(splitSongTitle('明知故犯（重制版）')).toEqual({
      main: '明知故犯',
      suffix: '（重制版）'
    });
  });

  it('strips halfwidth trailing parens', () => {
    expect(splitSongTitle('Song (Live)')).toEqual({ main: 'Song', suffix: '(Live)' });
  });

  it('only strips the last group when multiple parens exist', () => {
    expect(splitSongTitle('A (B) (Live)')).toEqual({ main: 'A (B)', suffix: '(Live)' });
  });

  it('keeps the whole name when it is entirely wrapped in parens', () => {
    expect(splitSongTitle('（Live)')).toEqual({ main: '（Live)', suffix: '' });
    expect(splitSongTitle('(Live)')).toEqual({ main: '(Live)', suffix: '' });
  });

  it('keeps unclosed parens as-is', () => {
    expect(splitSongTitle('未闭合（重制版')).toEqual({ main: '未闭合（重制版', suffix: '' });
  });

  it('keeps plain names untouched', () => {
    expect(splitSongTitle('长大就好了')).toEqual({ main: '长大就好了', suffix: '' });
  });
});

describe('splitSongTitle — 春晓《长大就好了》中英连写（按曲目 id 白名单）', () => {
  const fixtures: Array<[string, string, string]> = [
    ['不符合逻辑，但符合人类 Not logical,But Alive', '不符合逻辑，但符合人类', 'Not logical,But Alive'],
    ['爱人不见 Unfulfilled love', '爱人不见', 'Unfulfilled love'],
    ['十个月后，我将前往罗马 To Rome，Ten Months On', '十个月后，我将前往罗马', 'To Rome，Ten Months On'],
    ['或许我早就死了 Dead Inside', '或许我早就死了', 'Dead Inside'],
    ['痴情总是下贱 To Love Too Much Is To Fall', '痴情总是下贱', 'To Love Too Much Is To Fall'],
    [
      '昨晚睡觉前，我的烟抽完了 When The Last Cigarette Dies',
      '昨晚睡觉前，我的烟抽完了',
      'When The Last Cigarette Dies'
    ],
    ['腐烂的香蕉 Faded Banana', '腐烂的香蕉', 'Faded Banana'],
    ['野狗 Scum dog', '野狗', 'Scum dog'],
    ['长大就好了 Growing Up Was a Lie', '长大就好了', 'Growing Up Was a Lie'],
    [
      '你那么普通，又那么自信 All Hat No Cattle',
      '你那么普通，又那么自信',
      'All Hat No Cattle'
    ]
  ];

  it.each(fixtures)('splits %s', (name, main, suffix) => {
    expect(splitSongTitle(name, 3438657356)).toEqual({ main, suffix });
  });

  it('does not split the same names without the whitelist id', () => {
    const name = '长大就好了 Growing Up Was a Lie';
    expect(splitSongTitle(name)).toEqual({ main: name, suffix: '' });
    expect(splitSongTitle(name, 999)).toEqual({ main: name, suffix: '' });
  });

  it('keeps the album-artist style joined name untouched', () => {
    expect(splitSongTitle('春晓乐队CHUNXIAO')).toEqual({ main: '春晓乐队CHUNXIAO', suffix: '' });
  });
});

describe('splitSongTitle — 普通英文名', () => {
  it('keeps latin-only names untouched', () => {
    expect(splitSongTitle('Love Story')).toEqual({ main: 'Love Story', suffix: '' });
  });

  it('supports string song ids', () => {
    expect(splitSongTitle('野狗 Scum dog', '3438657967')).toEqual({
      main: '野狗',
      suffix: 'Scum dog'
    });
  });
});