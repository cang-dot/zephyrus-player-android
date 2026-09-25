/**
 * 统一歌曲卡模板的徽章映射（纯函数）：
 * 推荐理由（日推 reason 字段）> 音质（SQ/无损）> 小众推荐（pop 低阈值）。
 */
export interface SongBadge {
  kind: 'reason' | 'quality' | 'niche';
  text: string;
}

/** 云歌曲/网易歌曲的「小众」判定阈值（popularity/pop 0-100） */
const NICHE_POP_THRESHOLD = 40;

export function resolveSongBadge(
  song: any,
  translate: (key: string) => string
): SongBadge | undefined {
  const reason = song?.reason || song?.recommendReason;
  if (reason) return { kind: 'reason', text: String(reason) };
  const maxbr = Number(song?.privilege?.maxbr ?? song?.maxbr ?? 0);
  if (maxbr >= 999000) return { kind: 'quality', text: translate('comp.homeBadge.lossless') };
  const pop = Number(song?.pop ?? song?.popularity ?? 0);
  if (pop > 0 && pop < NICHE_POP_THRESHOLD) {
    return { kind: 'niche', text: translate('comp.homeBadge.niche') };
  }
  return undefined;
}
