export interface ArtworkTrackLike {
  picUrl?: string;
  al?: { picUrl?: string };
  album?: { picUrl?: string };
}

export function resolveArtworkSource(track?: ArtworkTrackLike | null): string {
  return track?.picUrl || track?.al?.picUrl || track?.album?.picUrl || '';
}

export function normalizeArtworkUrl(source: string): string {
  const url = String(source || '').trim();
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('http:')) return `https:${url.slice(5)}`;
  return url;
}

export function appendArtworkRetry(url: string, attempt: number): string {
  if (!url || attempt <= 0 || url.startsWith('data:') || url.startsWith('local:')) return url;
  return `${url}${url.includes('?') ? '&' : '?'}zephyrus_retry=${attempt}`;
}
