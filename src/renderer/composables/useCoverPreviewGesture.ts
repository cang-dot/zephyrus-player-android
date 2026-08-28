import type { Ref } from 'vue';
import { onBeforeUnmount, ref } from 'vue';

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 10;
const CLICK_SUPPRESSION_MS = 420;

export function useCoverPreviewGesture(source: Ref<string>) {
  const visible = ref(false);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let triggered = false;
  let suppressClickUntil = 0;

  function clearTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function releaseCapture(event: PointerEvent) {
    const target = event.currentTarget as HTMLElement | null;
    try {
      if (target?.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
    } catch {
      // WebView may release pointer capture during navigation.
    }
  }

  function onPointerDown(event: PointerEvent) {
    if (!event.isPrimary || pointerId !== null) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    triggered = false;
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is optional on older WebViews.
    }
    clearTimer();
    timer = setTimeout(() => {
      if (pointerId !== event.pointerId || !source.value) return;
      triggered = true;
      suppressClickUntil = performance.now() + CLICK_SUPPRESSION_MS;
      visible.value = true;
      if (navigator.vibrate) navigator.vibrate(20);
    }, LONG_PRESS_MS);
  }

  function onPointerMove(event: PointerEvent) {
    if (event.pointerId !== pointerId) return;
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > MOVE_CANCEL_PX) {
      clearTimer();
    }
  }

  function onPointerUp(event: PointerEvent) {
    if (event.pointerId !== pointerId) return;
    clearTimer();
    releaseCapture(event);
    if (triggered) {
      event.preventDefault();
      suppressClickUntil = Math.max(suppressClickUntil, performance.now() + CLICK_SUPPRESSION_MS);
    }
    pointerId = null;
    triggered = false;
  }

  function onPointerCancel(event: PointerEvent) {
    if (event.pointerId !== pointerId) return;
    clearTimer();
    releaseCapture(event);
    pointerId = null;
    triggered = false;
  }

  function onContextMenu(event: MouseEvent) {
    event.preventDefault();
    clearTimer();
    if (source.value) visible.value = true;
  }

  function consumeSuppressedClick(event?: MouseEvent) {
    if (performance.now() >= suppressClickUntil) return false;
    suppressClickUntil = 0;
    event?.preventDefault();
    event?.stopPropagation();
    return true;
  }

  onBeforeUnmount(() => {
    clearTimer();
    pointerId = null;
  });

  return {
    visible,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onContextMenu,
    consumeSuppressedClick
  };
}
