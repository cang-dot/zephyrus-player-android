/**
 * 推荐歌曲行内标签（首页「根据你喜爱的歌曲推荐」）
 * 优先级：推荐理由 > 无损音质 > 小众（热度偏低）；三者都没有则不显示标签。
 */
export interface SongTag {
  kind: 'reason' | 'quality' | 'niche';
  text: string;
}

export interface SongTagSource {
  /** 与 SongResult 共有的字段，保证弱类型检测下可直接互传 */
  id?: string | number;
  name?: string;
  reason?: string | null;
  recommendReason?: string | null;
  maxbr?: number | string | null;
  privilege?: { maxbr?: number | string | null } | null;
  pop?: number | string | null;
}

/** 网易云 maxbr ≥ 999000 即无损档 */
const LOSSLESS_MAXBR = 999000;
/** 热度低于该值视为小众 */
const NICHE_POP_THRESHOLD = 40;

export function resolveSongTag(
  song: SongTagSource | null | undefined,
  translate: (key: string) => string
): SongTag | undefined {
  if (!song) return undefined;

  const reason = song.reason || song.recommendReason;
  if (reason) return { kind: 'reason', text: String(reason) };

  const maxbr = Number(song.privilege?.maxbr ?? song.maxbr ?? 0);
  if (maxbr >= LOSSLESS_MAXBR) {
    return { kind: 'quality', text: translate('comp.homeV2.tagLossless') };
  }

  const pop = Number(song.pop ?? 0);
  if (pop > 0 && pop < NICHE_POP_THRESHOLD) {
    return { kind: 'niche', text: translate('comp.homeV2.tagNiche') };
  }

  return undefined;
}
