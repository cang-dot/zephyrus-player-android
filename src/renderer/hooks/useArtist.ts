import { beginPlaylistOpen } from '@/composables/usePlaylistOpenTransition';

import { useOverlayNavigate } from '@/hooks/useOverlayNavigate';

/** 歌手页 hero 预填充档案：入口页尽量携带，歌手页首帧即时渲染（无全页骨架） */
export interface ArtistPrefillProfile {
  name?: string;
  avatar?: string;
  /** 入口卡片矩形：携带时启动歌单页同款的背景扩展过渡 */
  fromRect?: { x: number; y: number; w: number; h: number };
  /** 入口标识：返回飞回时由来源页消费（`artistCoverReturn`） */
  fromKey?: string;
}

export const ARTIST_PREFILL_KEY = 'artistProfilePrefill';
export const ARTIST_COVER_RETURN_KEY = 'artistCoverReturn';

/** 读取（并清除）指定歌手的预填充档案 */
export function takeArtistPrefill(id: number | string): ArtistPrefillProfile | null {
  try {
    const raw = sessionStorage.getItem(ARTIST_PREFILL_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(ARTIST_PREFILL_KEY);
    const parsed = JSON.parse(raw) as ArtistPrefillProfile & { id?: string };
    if (String(parsed.id || '') !== String(id)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export const useArtist = () => {
  const { navigate } = useOverlayNavigate();

  /**
   * 跳转到歌手详情页。
   * @param id 歌手ID
   * @param profile 预填充档案（名字/头像/入口矩形）：携带矩形时启动
   *   与歌单页同款的覆盖层扩展过渡，歌手页 hero 首帧即可渲染
   */
  const navigateToArtist = (id: number | string, profile?: ArtistPrefillProfile) => {
    try {
      if (profile && (profile.name || profile.avatar)) {
        sessionStorage.setItem(
          ARTIST_PREFILL_KEY,
          JSON.stringify({ ...profile, id: String(id) })
        );
      } else {
        sessionStorage.removeItem(ARTIST_PREFILL_KEY);
      }
    } catch {
      /* sessionStorage 不可用时静默降级 */
    }
    if (profile?.fromRect && profile.fromRect.w > 0) {
      beginPlaylistOpen({ rect: profile.fromRect, coverUrl: profile.avatar });
    }
    navigate(`/artist/detail/${id}`);
  };

  return {
    navigateToArtist
  };
};
