import { describe, expect, it } from 'vitest';

import {
  resolvePlayerStyleConfig,
  resolvePlayerStyleEffects
} from '../../src/renderer/config/playerStyleConfig';
import {
  arrangeStaggeredWords,
  fitStaggeredTypography,
  resolveStaggeredMaxRows
} from '../../src/renderer/utils/staggeredLyricLayout';

function rowSizes(count: number) {
  const placements = arrangeStaggeredWords(Array.from({ length: count }, (_, index) => index));
  const sizes = new Map<number, number>();
  for (const placement of placements) {
    sizes.set(placement.row, (sizes.get(placement.row) || 0) + 1);
  }
  return { placements, sizes: [...sizes.values()] };
}

describe('arrangeStaggeredWords', () => {
  it('balances five tokens as three plus two without a singleton row', () => {
    const result = rowSizes(5);
    expect(result.sizes).toEqual([3, 2]);
    expect(result.sizes.every((size) => size >= 2)).toBe(true);
  });

  it('preserves token order while distributing eight tokens evenly', () => {
    const result = rowSizes(8);
    expect(result.sizes).toEqual([3, 3, 2]);
    expect(result.placements.map((placement) => placement.word)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('keeps the unavoidable single-token lyric on one row', () => {
    const result = rowSizes(1);
    expect(result.sizes).toEqual([1]);
    expect(result.placements[0]).toMatchObject({ word: 0, row: 0, indexInRow: 0, rowCount: 1 });
  });

  it('uses fewer, wider rows after rotating into landscape', () => {
    expect(resolveStaggeredMaxRows(390, 780)).toBe(4);
    expect(resolveStaggeredMaxRows(780, 390)).toBe(2);
    expect(arrangeStaggeredWords(Array.from({ length: 8 }), 2).map((item) => item.row)).toEqual([
      0, 0, 0, 0, 1, 1, 1, 1
    ]);
  });

  it('scales type, gaps and offsets together when height is constrained', () => {
    const fitted = fitStaggeredTypography(
      [
        ['守', '住', '良'],
        ['知', '行', '永', '极'],
        ['行', '了']
      ],
      {
        width: 720,
        height: 220,
        requestedFontSize: 96,
        rowGap: 48,
        offset: 30,
        rotation: 12
      }
    );
    const occupiedHeight = fitted.rowSlotHeight * 3 + fitted.rowGap * 2;
    expect(fitted.fontSize).toBeLessThan(96);
    expect(occupiedHeight).toBeLessThanOrEqual(220 * 0.94 + 0.001);
  });

  it('normalizes full-screen climax effects so staggered remains selectable', () => {
    const eerie = resolvePlayerStyleConfig('eerie', {
      mode: 'custom',
      effectKeyword: true,
      effectWordDrop: true,
      effectStaggered: true
    });
    expect(eerie.effectKeyword).toBe(false);
    expect(eerie.effectWordDrop).toBe(false);
    expect(resolvePlayerStyleEffects('eerie', eerie).staggered).toBe(true);
  });

  it('keeps the word-drop giant type weight independent and bounded', () => {
    expect(resolvePlayerStyleConfig('stage').wordDropFontWeight).toBe(900);
    expect(resolvePlayerStyleConfig('stage', { wordDropFontWeight: 450 }).wordDropFontWeight).toBe(
      450
    );
    expect(resolvePlayerStyleConfig('stage', { wordDropFontWeight: 1200 }).wordDropFontWeight).toBe(
      900
    );
  });

  it('keeps the centered auxiliary display setting style-local and normalized', () => {
    expect(resolvePlayerStyleConfig('stage').auxiliaryCenterDisplay).toBe(false);
    expect(
      resolvePlayerStyleConfig('stage', { auxiliaryCenterDisplay: true }).auxiliaryCenterDisplay
    ).toBe(true);
    expect(
      resolvePlayerStyleConfig('stage', { auxiliaryCenterDisplay: 'yes' as never })
        .auxiliaryCenterDisplay
    ).toBe(false);
  });
});
