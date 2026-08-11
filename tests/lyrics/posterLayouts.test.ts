import { describe, expect, it } from 'vitest';

import { DEFAULT_POSTER_CONFIG, normalizePosterConfig, POSTER_LAYOUT_OPTIONS } from '@/types/share';
import { splitSealArtistName } from '@/utils/posterEngine';

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

  it('preserves archive color source, filter, custom label, QR, and watermark options', () => {
    const config = normalizePosterConfig({
      layout: 'performance-archive',
      accentColor: '#ff0033',
      accentColorMode: 'custom',
      imageFilter: 'low-saturation',
      eventLabel: 'SUMMER TOUR',
      showQRCode: false,
      watermarkOpacity: 55
    });
    expect(config).toMatchObject({
      accentColor: '#ff0033',
      accentColorMode: 'custom',
      imageFilter: 'low-saturation',
      eventLabel: 'SUMMER TOUR',
      showQRCode: false,
      watermarkOpacity: 55
    });
  });

  it('defaults invalid or missing archive accent sources to the song color', () => {
    expect(normalizePosterConfig({}).accentColorMode).toBe('cover');
    expect(normalizePosterConfig({ accentColorMode: 'invalid' as 'custom' }).accentColorMode).toBe(
      'cover'
    );
  });

  it('balances artist names across the seal face according to glyph count', () => {
    expect(splitSealArtistName('王')).toEqual(['王']);
    expect(splitSealArtistName('张杰')).toEqual(['张', '杰']);
    expect(splitSealArtistName('野肆乐队')).toEqual(['野肆', '乐队']);
    expect(splitSealArtistName('机械心乐队')).toEqual(['机械心', '乐队']);
    expect(splitSealArtistName('甲乙丙丁戊己庚')).toEqual(['甲乙丙', '丁戊', '己庚']);
    expect(splitSealArtistName('蔡徐坤 feat. Guest')).toEqual(['蔡徐', '坤']);
  });
});
