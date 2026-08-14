import { readonly, ref, shallowRef } from 'vue';

import type { SongResult } from '@/types/music';

export type MobileSongActionOrigin = 'mini-player' | 'playing-list';

export interface MobileSongActionCallbacks {
  play?: () => void;
  playNext?: () => void;
  favorite?: () => void | Promise<void>;
  remove?: () => void;
  gotoArtist?: (id: number) => void;
  gotoAlbum?: (id: number) => void;
}

export interface MobileSongActionRequest {
  item: SongResult;
  isFavorite?: boolean;
  canRemove?: boolean;
  origin?: MobileSongActionOrigin;
  sourceElement?: HTMLElement | null;
  callbacks?: MobileSongActionCallbacks;
}

export interface MobileSongActionGeometry {
  left: number;
  top: number;
  width: number;
  height: number;
  borderRadius: number;
}

const visible = ref(false);
const request = shallowRef<MobileSongActionRequest | null>(null);
const sourceGeometry = shallowRef<MobileSongActionGeometry | null>(null);
const scopeGeometry = shallowRef<MobileSongActionGeometry | null>(null);

const readGeometry = (element: HTMLElement | null | undefined) => {
  const rect = element?.getBoundingClientRect();
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    borderRadius: Number.parseFloat(getComputedStyle(element).borderRadius) || rect.height / 2
  } satisfies MobileSongActionGeometry;
};

const resolveMiniPlayerElement = () =>
  document.querySelector<HTMLElement>(
    '.mobile-bottom-dock .mobile-play-bar, .mobile-play-bar .mobile-mini-controls'
  );

const resolvePlayingListSurface = () =>
  document.querySelector<HTMLElement>('.shared-player-bottom-surface.panel-playlist');

export function useMobileSongActionSurface() {
  const open = (nextRequest: MobileSongActionRequest) => {
    const origin = nextRequest.origin ?? 'mini-player';
    const scopeElement = origin === 'playing-list' ? resolvePlayingListSurface() : null;
    const sourceElement =
      origin === 'playing-list'
        ? scopeElement || nextRequest.sourceElement
        : resolveMiniPlayerElement() || nextRequest.sourceElement;

    request.value = { ...nextRequest, origin };
    sourceGeometry.value = readGeometry(sourceElement);
    scopeGeometry.value = readGeometry(scopeElement);
    visible.value = true;
  };

  const close = () => {
    visible.value = false;
  };

  const clear = () => {
    if (visible.value) return;
    request.value = null;
    sourceGeometry.value = null;
    scopeGeometry.value = null;
  };

  return {
    visible: readonly(visible),
    request: readonly(request),
    sourceGeometry: readonly(sourceGeometry),
    scopeGeometry: readonly(scopeGeometry),
    open,
    close,
    clear
  };
}
