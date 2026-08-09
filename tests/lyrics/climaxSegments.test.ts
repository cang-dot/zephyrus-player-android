import { describe, expect, it } from 'vitest';

import { normalizeClimaxSegments } from '../../src/renderer/api/climax';

describe('climax segment normalization', () => {
  it('normalizes persisted millisecond annotations and clamps them to duration', () => {
    expect(
      normalizeClimaxSegments(
        [
          { start: 30_000, end: 45_000 },
          { start: 95_000, end: 130_000 }
        ],
        100_000
      )
    ).toEqual([
      { start: 30, end: 45 },
      { start: 95, end: 100 }
    ]);
  });

  it('keeps second-based manual annotations unchanged', () => {
    expect(normalizeClimaxSegments([{ start: 12.5, end: 24 }], 180)).toEqual([
      { start: 12.5, end: 24 }
    ]);
  });
});
