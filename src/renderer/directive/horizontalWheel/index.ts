import type { Directive } from 'vue';

interface HorizontalWheelOptions {
  pageTopOnly?: boolean;
}

type HorizontalWheelElement = HTMLElement & {
  __horizontalWheelListener?: (event: WheelEvent) => void;
};

const normalizeDelta = (event: WheelEvent, value: number, element: HTMLElement) => {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return value * 16;
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return value * element.clientWidth;
  return value;
};

export const vHorizontalWheel: Directive<
  HorizontalWheelElement,
  HorizontalWheelOptions | undefined
> = {
  mounted(element, binding) {
    element.dataset.horizontalWheelPageTopOnly = binding.value?.pageTopOnly ? 'true' : 'false';

    const onWheel = (event: WheelEvent) => {
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ) {
        return;
      }

      if (
        element.dataset.horizontalWheelPageTopOnly === 'true' &&
        (element.closest('.pager-page')?.scrollTop ?? 0) > 4
      ) {
        return;
      }

      const maxScroll = element.scrollWidth - element.clientWidth;
      if (maxScroll <= 1) return;

      const delta = normalizeDelta(event, event.deltaY, element);
      if (!delta) return;

      const current = element.scrollLeft;
      const target = Math.max(0, Math.min(maxScroll, current + delta));
      if (Math.abs(target - current) < 0.5) return;

      event.preventDefault();
      element.scrollBy({ left: delta, behavior: 'smooth' });
    };

    element.__horizontalWheelListener = onWheel;
    element.addEventListener('wheel', onWheel, { passive: false });
  },
  updated(element, binding) {
    element.dataset.horizontalWheelPageTopOnly = binding.value?.pageTopOnly ? 'true' : 'false';
  },
  unmounted(element) {
    if (element.__horizontalWheelListener) {
      element.removeEventListener('wheel', element.__horizontalWheelListener);
      delete element.__horizontalWheelListener;
    }
  }
};
