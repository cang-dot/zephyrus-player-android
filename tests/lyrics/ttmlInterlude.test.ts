import { describe, expect, it } from 'vitest';

import type { TtmlLine } from '@/services/ttmlParser';
import { resolveTtmlInterludeState } from '@/utils/ttmlInterlude';

const line = (begin: number, end: number, key: string): TtmlLine => ({
  begin,
  end,
  key,
  words: [{ begin, end, text: key }],
  text: key,
  isBackground: false
});

describe('TTML interlude state', () => {
  const lines = [line(0, 2, 'first'), line(17, 19, 'second')];

  it('activates at a fifteen second gap without climax metadata', () => {
    const state = resolveTtmlInterludeState({ lines, time: 2, title: 'Song' });
    expect(state.active).toBe(true);
    expect(state.outro).toBe(false);
  });

  it('does not activate below fifteen seconds', () => {
    expect(
      resolveTtmlInterludeState({ lines: [line(0, 2, 'a'), line(16.999, 19, 'b')], time: 2 }).active
    ).toBe(false);
  });

  it('activates the outro after the final timed word', () => {
    const state = resolveTtmlInterludeState({
      lines: [line(0, 2, 'last')],
      time: 9,
      coverUrl: '/cover.jpg'
    });
    expect(state).toMatchObject({ active: true, outro: true, coverUrl: '/cover.jpg' });
  });

  it('stays inactive before the current line finishes', () => {
    expect(resolveTtmlInterludeState({ lines, time: 1.99 }).active).toBe(false);
  });

  it('stays inactive before the first line and with no TTML lines', () => {
    expect(resolveTtmlInterludeState({ lines, time: -1 }).active).toBe(false);
    expect(resolveTtmlInterludeState({ lines: [], time: 10 }).active).toBe(false);
  });

  it('remains stable while paused at the same timestamp', () => {
    const first = resolveTtmlInterludeState({ lines, time: 4, title: 'Song' });
    const paused = resolveTtmlInterludeState({ lines, time: 4, title: 'Song' });
    expect(paused).toEqual(first);
  });

  it('exits immediately after seeking into the next primary line', () => {
    expect(resolveTtmlInterludeState({ lines, time: 4 }).active).toBe(true);
    expect(resolveTtmlInterludeState({ lines, time: 17.2 }).active).toBe(false);
  });

  it('does not leak the previous song state after a track change', () => {
    expect(resolveTtmlInterludeState({ lines: [line(0, 2, 'old')], time: 8 }).active).toBe(true);
    expect(resolveTtmlInterludeState({ lines: [line(7, 10, 'new')], time: 1 }).active).toBe(false);
  });
});
