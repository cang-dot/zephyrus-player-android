import { beginPlaylistOpen } from '@/composables/usePlaylistOpenTransition';

import { useOverlayNavigate } from '@/hooks/useOverlayNavigate';
import { getImgUrl } from '@/utils';

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
   * 头像均色提取（50y50 canvas）：作为色块过渡的底色。
   * img 带 no-referrer（B站图床拒绝外域 Referer）+ crossOrigin（可读像素）；
   * 入口卡片刚显示过同一张图，通常缓存命中、无网络等待。失败返回 undefined。
   */
  const averageColorOf = (url: string): Promise<string | undefined> =>
    new Promise((resolve) => {
      if (!url) {
        resolve(undefined);
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.referrerPolicy = 'no-referrer';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 10;
          canvas.height = 10;
          const context = canvas.getContext('2d');
          if (!context) {
            resolve(undefined);
            return;
          }
          context.drawImage(img, 0, 0, 10, 10);
          const { data } = context.getImageData(0, 0, 10, 10);
          let r = 0;
          let g = 0;
          let b = 0;
          const count = data.length / 4;
          for (let i = 0; i < data.length; i += 4) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
          }
          const hex = `#${[r, g, b]
            .map((sum) => Math.round(sum / count).toString(16).padStart(2, '0'))
            .join('')}`;
          resolve(hex);
        } catch {
          resolve(undefined);
        }
      };
      img.onerror = () => resolve(undefined);
      img.src = getImgUrl(url, '50y50');
    });

  /**
   * 跳转到歌手详情页。
   * @param id 歌手ID
   * @param profile 预填充档案（名字/头像/入口矩形）：携带矩形时启动
   *   与歌单页同款的覆盖层扩展过渡，歌手页 hero 首帧即可渲染
   */
  const navigateToArtist = async (id: number | string, profile?: ArtistPrefillProfile) => {
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
      // 色块底色 = 头像均色（异步提取，通常命中缓存近乎即时）；
      // 不传 color 时 beginPlaylistOpen 的兜底是近黑，头像跨域补色又可能失败 → 黑块
      const color = await averageColorOf(profile.avatar || '');
      beginPlaylistOpen({
        rect: profile.fromRect,
        coverUrl: profile.avatar,
        color
      });
    }
    navigate(`/artist/detail/${id}`);
  };

  return {
    navigateToArtist
  };
};
