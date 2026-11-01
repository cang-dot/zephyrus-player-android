/** Shared dimensions for navigation, its merge transition, and player layout. */
export const MOBILE_DOCK = { height: 60, itemHeight: 52, compactSize: 48, miniOffset: 64 } as const;
export const PLAYER_GEOMETRY = {
  defaultControlsHeight: 150,
  controlsHeight: 168,
  landscapeControlsHeight: 96,
  selectionControlsHeight: 88,
  bottomGap: 14,
  topClearance: 56,
  contentGap: 12,
  minimumLyricsHeight: 80
} as const;

/** Allocate the cover first while retaining a usable, compressible lyric viewport. */
export function fitDefaultPlayer(input: {
  height: number;
  width: number;
  desiredCover: number;
  infoHeight: number;
  split: number;
  showArtwork: boolean;
  showInfo: boolean;
  showLyrics: boolean;
}) {
  const height = Math.max(0, input.height);
  const info = input.showInfo ? input.infoHeight : 0;
  const coverGap = input.showArtwork && input.showInfo ? PLAYER_GEOMETRY.contentGap : 0;
  const lyricGap =
    input.showLyrics && (input.showArtwork || input.showInfo) ? PLAYER_GEOMETRY.contentGap : 0;
  const lyricMinimum = input.showLyrics
    ? Math.min(
        PLAYER_GEOMETRY.minimumLyricsHeight,
        Math.max(0, height - info - coverGap - lyricGap)
      )
    : 0;
  const cover = input.showArtwork
    ? Math.max(
        0,
        Math.min(
          input.desiredCover,
          input.width - 40,
          height - info - coverGap - lyricGap - lyricMinimum
        )
      )
    : 0;
  const needed = cover + coverGap + info;
  const artworkRow =
    input.showArtwork || input.showInfo
      ? Math.max(needed, Math.min(height - lyricGap - lyricMinimum, height * input.split))
      : 0;
  return { cover, artworkRow, lyricGap };
}
