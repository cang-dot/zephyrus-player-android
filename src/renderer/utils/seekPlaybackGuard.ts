export type SeekPlaybackSnapshot = {
  requestId: number;
  soundId: string;
  wasPlaying: boolean;
  startedAt: number;
};

const SEEK_EVENT_GRACE_MS = 700;

export function shouldSuppressSeekPause(
  snapshot: SeekPlaybackSnapshot | null,
  soundId: string,
  now = Date.now()
): boolean {
  if (!snapshot || !snapshot.wasPlaying || snapshot.soundId !== soundId) return false;
  return now - snapshot.startedAt <= SEEK_EVENT_GRACE_MS;
}

export function shouldRestorePlayback(
  snapshot: SeekPlaybackSnapshot | null,
  soundId: string,
  isPlaying: boolean,
  now = Date.now()
): boolean {
  if (!snapshot || !snapshot.wasPlaying || snapshot.soundId !== soundId) return false;
  if (now - snapshot.startedAt > SEEK_EVENT_GRACE_MS) return false;
  return !isPlaying;
}
