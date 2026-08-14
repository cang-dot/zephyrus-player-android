import { readonly, shallowRef } from 'vue';

export interface PosterTransitionOrigin {
  left: number;
  top: number;
  width: number;
  height: number;
}

const origin = shallowRef<PosterTransitionOrigin | null>(null);

export function usePosterTransitionOrigin() {
  return {
    origin: readonly(origin),
    capture: (element: Element | null) => {
      const rect = element?.getBoundingClientRect();
      if (!rect) return;
      origin.value = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      };
    },
    clear: () => {
      origin.value = null;
    }
  };
}
