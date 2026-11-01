import { describe, expect, it } from 'vitest';

import { fitDefaultPlayer } from '@/config/mobileGeometry';

const base = {
  height: 500,
  width: 390,
  desiredCover: 280,
  infoHeight: 56,
  split: 0.58,
  showArtwork: true,
  showInfo: true,
  showLyrics: true
};

describe('default player space allocation', () => {
  it('keeps the requested cover and song info ahead of lyrics', () => {
    const result = fitDefaultPlayer(base);
    expect(result.cover).toBe(280);
    expect(result.artworkRow).toBeGreaterThanOrEqual(348);
    expect(base.height - result.artworkRow - result.lyricGap).toBeGreaterThanOrEqual(80);
  });
  it('shrinks an oversized cover before colliding with metadata or lyrics', () => {
    const result = fitDefaultPlayer({ ...base, height: 300, desiredCover: 440 });
    expect(result.cover).toBe(140);
    expect(result.artworkRow + result.lyricGap + 80).toBe(300);
  });
  it('fits a narrow embedded container', () => {
    expect(fitDefaultPlayer({ ...base, width: 200 }).cover).toBe(160);
  });
  it('releases space when artwork or lyrics are hidden', () => {
    const textOnly = fitDefaultPlayer({ ...base, showArtwork: false });
    expect(textOnly.cover).toBe(0);
    expect(textOnly.artworkRow).toBeGreaterThanOrEqual(base.infoHeight);
    const coverOnly = fitDefaultPlayer({ ...base, showLyrics: false });
    expect(coverOnly.lyricGap).toBe(0);
    expect(coverOnly.cover).toBe(base.desiredCover);
  });
  it('allocates all space to lyrics when artwork and metadata are disabled', () => {
    expect(fitDefaultPlayer({ ...base, showArtwork: false, showInfo: false })).toEqual({
      cover: 0,
      artworkRow: 0,
      lyricGap: 0
    });
  });
  it('remains finite on the initial unmeasured render and handles tall text', () => {
    expect(fitDefaultPlayer({ ...base, height: 0, width: 0 }).cover).toBe(0);
    const result = fitDefaultPlayer({ ...base, height: 350, infoHeight: 90 });
    expect(result.artworkRow).toBeGreaterThanOrEqual(result.cover + 90 + 12);
    expect(350 - result.artworkRow - result.lyricGap).toBeGreaterThanOrEqual(80);
  });
});
