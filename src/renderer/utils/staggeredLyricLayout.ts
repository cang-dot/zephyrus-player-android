export interface StaggeredWordPlacement<T> {
  word: T;
  row: number;
  indexInRow: number;
  rowCount: number;
}

export interface StaggeredTypographyOptions {
  width: number;
  height: number;
  requestedFontSize: number;
  rowGap: number;
  offset: number;
  rotation: number;
}

export interface StaggeredTypography {
  fontSize: number;
  rowGap: number;
  offset: number;
  rowSlotHeight: number;
}

/** Landscape has enough horizontal room to use fewer, longer rows. */
export function resolveStaggeredMaxRows(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 4;
  if (width / height >= 1.15) return 2;
  if (width / height >= 0.9) return 3;
  return 4;
}

function visualTextUnits(text: string): number {
  let units = 0;
  for (const character of [...text.trim()]) {
    if (/\s/u.test(character)) units += 0.3;
    else if ((character.codePointAt(0) || 0) <= 0x7f) units += 0.58;
    else units += 1;
  }
  return Math.max(0.85, units);
}

/**
 * Fits the requested type into the live player bounds. Gaps and offsets scale
 * with the type so a short landscape viewport cannot make neighbouring rows
 * occupy the same visual slot.
 */
export function fitStaggeredTypography(
  rows: string[][],
  options: StaggeredTypographyOptions
): StaggeredTypography {
  const requested = Math.max(12, options.requestedFontSize || 48);
  const rowCount = Math.max(1, rows.length);
  const widestRowUnits = Math.max(
    1,
    ...rows.map(
      (row) =>
        row.reduce((total, text) => total + visualTextUnits(text), 0) +
        Math.max(0, row.length - 1) * 0.12
    )
  );
  const rotationReserve = 1 + Math.min(12, Math.max(0, options.rotation)) / 90;
  const widthFit = (Math.max(1, options.width) * 0.9) / (widestRowUnits * rotationReserve);
  const gapRatio = Math.max(0, options.rowGap) / requested;
  const offsetRatio = Math.max(0, options.offset) / requested;
  const heightUnits = rowCount * (1.12 + offsetRatio * 2) + Math.max(0, rowCount - 1) * gapRatio;
  const heightFit = (Math.max(1, options.height) * 0.94) / heightUnits;
  const fontSize = Math.max(12, Math.min(requested, widthFit, heightFit));
  const scale = fontSize / requested;
  const rowGap = Math.max(0, options.rowGap) * scale;
  const offset = Math.max(0, options.offset) * scale;

  return {
    fontSize,
    rowGap,
    offset,
    rowSlotHeight: fontSize * 1.12 + offset * 2
  };
}

/**
 * Splits an ordered token list into balanced rows. For any list with more than
 * one token, every row contains at least two tokens so the layout never leaves
 * a lone word floating on its own line.
 */
export function arrangeStaggeredWords<T>(words: T[], maxRows = 4): StaggeredWordPlacement<T>[] {
  if (words.length === 0) return [];

  const safeMaxRows = Math.max(1, Math.floor(maxRows));
  let rowCount =
    words.length === 1 ? 1 : Math.min(safeMaxRows, Math.max(1, Math.ceil(words.length / 3)));

  while (rowCount > 1 && Math.floor(words.length / rowCount) < 2) {
    rowCount -= 1;
  }

  const baseSize = Math.floor(words.length / rowCount);
  const remainder = words.length % rowCount;
  const placements: StaggeredWordPlacement<T>[] = [];
  let cursor = 0;

  for (let row = 0; row < rowCount; row += 1) {
    const rowSize = baseSize + (row < remainder ? 1 : 0);
    for (let indexInRow = 0; indexInRow < rowSize; indexInRow += 1) {
      placements.push({
        word: words[cursor],
        row,
        indexInRow,
        rowCount
      });
      cursor += 1;
    }
  }

  return placements;
}
