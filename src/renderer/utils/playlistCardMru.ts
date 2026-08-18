export interface PlaylistCardIdentity {
  platform: string;
  accountId: string;
  type: string;
  id: string | number;
}

export interface PlaylistCardMruState {
  version: 1;
  keys: string[];
}

export const PLAYLIST_CARD_MRU_KEY = 'list-all-card-mru-v1';

const keyPart = (value: string | number) => encodeURIComponent(String(value));

export function playlistCardKey(item: PlaylistCardIdentity): string {
  return [item.platform, item.accountId, item.type, item.id].map(keyPart).join(':');
}

export function readPlaylistCardMru(raw: string | null | undefined): PlaylistCardMruState {
  try {
    const parsed = JSON.parse(raw || 'null');
    if (parsed?.version !== 1 || !Array.isArray(parsed.keys)) throw new Error('invalid state');
    const keys = parsed.keys.filter((key: unknown): key is string => typeof key === 'string');
    return {
      version: 1,
      keys: [...new Set<string>(keys)]
    };
  } catch {
    return { version: 1, keys: [] };
  }
}

export function touchPlaylistCardMru(
  state: PlaylistCardMruState,
  item: PlaylistCardIdentity,
  limit = 200
): PlaylistCardMruState {
  const key = playlistCardKey(item);
  return { version: 1, keys: [key, ...state.keys.filter((candidate) => candidate !== key)].slice(0, limit) };
}

export function orderPlaylistCards<T extends PlaylistCardIdentity>(
  items: T[],
  state: PlaylistCardMruState
): T[] {
  if (!state.keys.length) return items;
  const rank = new Map(state.keys.map((key, index) => [key, index]));
  return items
    .map((item, index) => ({ item, index, rank: rank.get(playlistCardKey(item)) }))
    .sort((left, right) => {
      const leftRank = left.rank ?? Number.POSITIVE_INFINITY;
      const rightRank = right.rank ?? Number.POSITIVE_INFINITY;
      return leftRank - rightRank || left.index - right.index;
    })
    .map(({ item }) => item);
}
