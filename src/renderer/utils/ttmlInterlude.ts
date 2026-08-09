import type { TtmlLine } from '@/services/ttmlParser';

export interface TtmlInterludeInput {
  lines: TtmlLine[];
  time: number;
  title?: string;
  coverUrl?: string;
}

export interface TtmlInterludeState {
  active: boolean;
  outro: boolean;
  coverUrl: string;
  title: string;
  key: string;
}

const inactive = (key = 'inactive'): TtmlInterludeState => ({
  active: false,
  outro: false,
  coverUrl: '',
  title: '',
  key
});

/** Resolve TTML interlude/outro without relying on climax metadata. */
export function resolveTtmlInterludeState(input: TtmlInterludeInput): TtmlInterludeState {
  const lines = input.lines;
  if (lines.length === 0) return inactive('empty');

  let lineIndex = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].begin <= input.time) lineIndex = index;
    else break;
  }
  if (lineIndex < 0) return inactive('intro');

  const line = lines[lineIndex];
  const lastWordEnd = line.words.reduce((end, word) => Math.max(end, word.end), line.end);
  if (input.time < lastWordEnd) return inactive(`line:${line.key || line.begin}`);

  const nextLine = lines[lineIndex + 1];
  const gap = nextLine ? nextLine.begin - lastWordEnd : Number.POSITIVE_INFINITY;
  const active = !nextLine || gap >= 15;
  if (!active) return inactive('inactive');

  return {
    active: true,
    outro: !nextLine,
    coverUrl: input.coverUrl || '',
    title: input.title || '',
    key: `interlude:${line.key || line.begin}:${nextLine?.begin ?? 'outro'}`
  };
}
