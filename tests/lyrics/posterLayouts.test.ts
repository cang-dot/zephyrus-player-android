import { describe, expect, it } from 'vitest';

import { DEFAULT_POSTER_CONFIG, normalizePosterConfig, POSTER_LAYOUT_OPTIONS } from '@/types/share';

describe('poster layouts', () => {
  it('publishes both archive layouts alongside the existing layouts', () => {
    expect(POSTER_LAYOUT_OPTIONS.map((option) => option.key)).toEqual([
      'torn-paper',
      'immersive',
      'performance-archive',
      'seal-tour'
    ]);
  });

  it('keeps each new layout configurable without changing the default layout', () => {
    expect(DEFAULT_POSTER_CONFIG.layout).toBe('torn-paper');
    expect(normalizePosterConfig({ layout: 'performance-archive' }).layout).toBe(
      'performance-archive'
    );
    expect(normalizePosterConfig({ layout: 'seal-tour' }).layout).toBe('seal-tour');
  });

  it('clamps and snaps custom font weight to supported steps', () => {
    expect(normalizePosterConfig({ fontWeight: 43 }).fontWeight).toBe(100);
    expect(normalizePosterConfig({ fontWeight: 624 }).fontWeight).toBe(600);
    expect(normalizePosterConfig({ fontWeight: 1200 }).fontWeight).toBe(900);
  });

  it('preserves archive color, filter, metadata, QR, and watermark options', () => {
    const config = normalizePosterConfig({
      layout: 'performance-archive',
      accentColor: '#ff0033',
      imageFilter: 'low-saturation',
      eventDate: '2026-08-09',
      eventVenue: 'Guangzhou',
      showQRCode: false,
      watermarkOpacity: 55
    });
    expect(config).toMatchObject({
      accentColor: '#ff0033',
      imageFilter: 'low-saturation',
      eventDate: '2026-08-09',
      eventVenue: 'Guangzhou',
      showQRCode: false,
      watermarkOpacity: 55
    });
  });
});
