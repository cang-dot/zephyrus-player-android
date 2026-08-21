export type PlayerResourceKind =
  | 'raf'
  | 'timer'
  | 'observer'
  | 'lyric-player'
  | 'canvas-loop'
  | 'audio-event';

type ResourceSnapshot = Record<PlayerResourceKind, number> & {
  updatedAt: number;
};

const kinds: PlayerResourceKind[] = [
  'raf',
  'timer',
  'observer',
  'lyric-player',
  'canvas-loop',
  'audio-event'
];
const counts = new Map<PlayerResourceKind, number>(kinds.map((kind) => [kind, 0]));
const enabled = import.meta.env.DEV;

function change(kind: PlayerResourceKind, delta: number) {
  if (!enabled) return;
  counts.set(kind, Math.max(0, (counts.get(kind) || 0) + delta));
}

export function acquirePlayerResource(kind: PlayerResourceKind) {
  change(kind, 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    change(kind, -1);
  };
}

export function getPlayerResourceSnapshot(): ResourceSnapshot {
  return {
    ...Object.fromEntries(kinds.map((kind) => [kind, counts.get(kind) || 0])),
    updatedAt: Date.now()
  } as ResourceSnapshot;
}

if (enabled && typeof window !== 'undefined') {
  (window as Window & { __zephyrusPlayerResources?: () => ResourceSnapshot }).__zephyrusPlayerResources =
    getPlayerResourceSnapshot;
}
