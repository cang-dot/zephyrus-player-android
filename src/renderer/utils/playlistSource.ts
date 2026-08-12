import type { MusicListSourceContext } from '@/components/common/MusicListNavigator';

export function isSameMusicListSource(
  left: Partial<MusicListSourceContext> | null | undefined,
  right: Partial<MusicListSourceContext> | null | undefined
): boolean {
  if (!left || !right) return false;
  return (
    left.platform === right.platform &&
    left.accountId === right.accountId &&
    String(left.sourceId) === String(right.sourceId) &&
    left.kind === right.kind
  );
}

export function orderSongsByTrackIds<T extends { id?: string | number }>(
  trackIds: Array<string | number>,
  ...collections: T[][]
): T[] {
  const songsById = new Map<string, T>();
  for (const collection of collections) {
    for (const song of collection) {
      if (song?.id != null) songsById.set(String(song.id), song);
    }
  }
  return trackIds.map((id) => songsById.get(String(id))).filter((song): song is T => Boolean(song));
}

export function getMissingTrackIds<T extends { id?: string | number }>(
  trackIds: Array<string | number>,
  loadedSongs: T[],
  limit: number
): number[] {
  const loadedIds = new Set(loadedSongs.map((song) => String(song.id)));
  return trackIds
    .filter((id) => !loadedIds.has(String(id)))
    .slice(0, Math.max(0, limit))
    .map(Number)
    .filter(Number.isFinite);
}
