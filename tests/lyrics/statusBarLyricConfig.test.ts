import { describe, expect, it } from 'vitest';

import {
  DEFAULT_STATUS_BAR_LYRIC_CONFIG,
  normalizeStatusBarLyricConfig
} from '../../src/renderer/types/lyric';

describe('status bar lyric config', () => {
  it('migrates the legacy enabled flag', () => {
    expect(normalizeStatusBarLyricConfig(undefined, true).enabled).toBe(true);
    expect(normalizeStatusBarLyricConfig(undefined, false).enabled).toBe(false);
  });

  it('keeps explicit new configuration ahead of the legacy flag', () => {
    expect(normalizeStatusBarLyricConfig({ enabled: false }, true).enabled).toBe(false);
  });

  it('clamps normalized positions and typography', () => {
    const config = normalizeStatusBarLyricConfig({
      positions: {
        portrait: { x: -2, y: 5 },
        landscape: { x: 0.28, y: 0.7 }
      },
      font: { source: 'builtin', id: 'noto-serif-sc', sizeSp: 80, weight: 655 }
    });
    expect(config.positions.portrait).toEqual({ x: 0, y: 0.1 });
    expect(config.positions.landscape).toEqual({ x: 0.28, y: 0.1 });
    expect(config.font.sizeSp).toBe(28);
    expect(config.font.weight).toBe(700);
  });

  it('normalizes invalid colors without mutating defaults', () => {
    const config = normalizeStatusBarLyricConfig({
      colors: { sung: { source: 'custom', color: 'not-a-color' } }
    });
    expect(config.colors.sung).toEqual({ source: 'custom', color: '#ffffff' });
    expect(DEFAULT_STATUS_BAR_LYRIC_CONFIG.colors.sung.source).toBe('theme');
  });

  it('normalizes capsule width modes and surface visibility', () => {
    const fixed = normalizeStatusBarLyricConfig({
      capsule: { widthMode: 'fixed', fixedWidthDp: 999 },
      colors: { surface: { fillEnabled: false, borderEnabled: false } }
    });
    expect(fixed.capsule).toEqual({ widthMode: 'fixed', fixedWidthDp: 420 });
    expect(fixed.colors.surface.fillEnabled).toBe(false);
    expect(fixed.colors.surface.borderEnabled).toBe(false);

    const migrated = normalizeStatusBarLyricConfig({ capsule: { fixedWidthDp: 40 } });
    expect(migrated.capsule).toEqual({ widthMode: 'fit', fixedWidthDp: 48 });
    expect(migrated.colors.surface.fillEnabled).toBe(true);
    expect(migrated.colors.surface.borderEnabled).toBe(true);
  });
});
