import type { CSSProperties } from 'vue';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { type LyricSwipeDirection, normalizeLyricSwipeDirection } from '@/types/lyric';

type LyricSwipeGestureOptions = {
  isOpen: () => boolean;
  onOpen: () => void;
  onClose: () => void;
};

export type LyricSwipePhase = 'opening' | 'closing' | null;

type PointerSample = {
  x: number;
  time: number;
};

const INTERACTIVE_TARGETS = [
  'button',
  'a',
  'input',
  'textarea',
  'select',
  '[role="slider"]',
  '.no-toggle',
  '[data-no-lyrics-swipe]'
].join(',');

const AXIS_LOCK_DISTANCE = 10;

export function lyricSwipeSign(direction: LyricSwipeDirection, lyricsOpen: boolean): number {
  const openSign = direction === 'right' ? 1 : -1;
  return lyricsOpen ? -openSign : openSign;
}

export function shouldCommitLyricSwipe(
  offset: number,
  velocity: number,
  sign: number,
  viewportWidth: number
): boolean {
  const projected = offset + velocity * 0.14;
  const threshold = Math.min(112, Math.max(72, viewportWidth * 0.2));
  return (
    projected * sign >= threshold ||
    (velocity * sign >= 760 && Math.abs(offset) >= AXIS_LOCK_DISTANCE * 2)
  );
}

function rubberBand(distance: number, dimension: number, constant = 0.24): number {
  return (distance * dimension * constant) / (dimension + constant * Math.abs(distance));
}

function readDirection(): LyricSwipeDirection {
  try {
    const stored = JSON.parse(localStorage.getItem('music-full-config') || '{}');
    return normalizeLyricSwipeDirection(stored.lyricSwipeDirection);
  } catch {
    return 'left';
  }
}

export function useLyricSwipeGesture(options: LyricSwipeGestureOptions) {
  const direction = ref<LyricSwipeDirection>(readDirection());
  const offset = ref(0);
  const dragging = ref(false);
  const settling = ref(false);
  const previewing = ref(false);
  const phase = ref<LyricSwipePhase>(null);
  const reduceMotion = ref(false);

  let pointerId = -1;
  let startX = 0;
  let startY = 0;
  let startOffset = 0;
  let axis: 'pending' | 'horizontal' | 'vertical' = 'pending';
  let gestureSign = -1;
  let startedOpen = false;
  let samples: PointerSample[] = [];
  let animationFrame = 0;
  let suppressClickUntil = 0;
  let motionQuery: MediaQueryList | null = null;
  let captureTarget: Element | null = null;

  const viewportWidth = () => Math.max(1, typeof window === 'undefined' ? 1 : window.innerWidth);
  const progress = computed(() => Math.min(1, Math.abs(offset.value) / viewportWidth()));
  const animatedStyle = (transform: string | undefined, opacity: number): CSSProperties => ({
    transform: reduceMotion.value ? undefined : transform,
    opacity: String(Math.max(0, Math.min(1, opacity))),
    transition: 'none',
    willChange: reduceMotion.value ? undefined : 'transform, opacity'
  });

  // The player surface remains stationary. Only the two lyric layers move so
  // the cover, controls, and the shared bottom bar keep their hit areas.
  const style = computed<CSSProperties>(() => ({
    touchAction: 'pan-y',
    // Keep the player surface fixed. Gesture motion belongs exclusively to
    // the lyric overlay and its large-lyric underlay.
    transform: 'none'
  }));

  const overlayStyle = computed<CSSProperties>(() => {
    if (!previewing.value || !phase.value) return {};
    const width = viewportWidth();
    if (phase.value === 'opening') {
      const from = gestureSign * width;
      return animatedStyle(
        `translate3d(${(offset.value - from).toFixed(2)}px, 0, 0)`,
        progress.value
      );
    }
    return animatedStyle(`translate3d(${offset.value.toFixed(2)}px, 0, 0)`, 1 - progress.value);
  });

  const underlayStyle = computed<CSSProperties>(() => {
    if (!previewing.value || !phase.value) return {};
    // 只在唤起(歌词滑入)时给封面层视差;收起时保持原位,
    // 否则歌词滑出后封面会先移开再弹回,看起来像瞬移
    const parallax = phase.value === 'opening' ? offset.value * 0.16 : 0;
    return animatedStyle(
      `translate3d(${parallax.toFixed(2)}px, 0, 0) scale(${(1 - progress.value * 0.018).toFixed(4)})`,
      phase.value === 'opening' ? 1 - progress.value : progress.value
    );
  });

  const backdropStyle = computed<CSSProperties>(() => {
    if (!previewing.value || !phase.value) return {};
    return {
      opacity: String(
        phase.value === 'opening' ? progress.value * 0.82 : (1 - progress.value) * 0.82
      ),
      transition: 'none',
      willChange: 'opacity'
    };
  });

  function syncDirection() {
    direction.value = readDirection();
  }

  function cancelAnimation() {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    settling.value = false;
  }

  function finishPreview() {
    offset.value = 0;
    previewing.value = false;
    phase.value = null;
  }

  function animateTo(target: number, initialVelocity: number, onComplete?: () => void) {
    cancelAnimation();
    if (reduceMotion.value) {
      offset.value = target;
      onComplete?.();
      return;
    }

    settling.value = true;
    const startedAt = performance.now();
    const from = offset.value;
    const displacement = from - target;
    const omega = 18;

    const frame = (now: number) => {
      const elapsed = Math.min(0.55, (now - startedAt) / 1000);
      const decay = Math.exp(-omega * elapsed);
      offset.value =
        target + (displacement + (initialVelocity + omega * displacement) * elapsed) * decay;

      if (elapsed >= 0.55 || (Math.abs(offset.value - target) < 0.35 && now - startedAt > 120)) {
        offset.value = target;
        settling.value = false;
        animationFrame = 0;
        onComplete?.();
        return;
      }
      animationFrame = requestAnimationFrame(frame);
    };

    animationFrame = requestAnimationFrame(frame);
  }

  function resetPointer() {
    if (captureTarget && pointerId >= 0) {
      try {
        if (captureTarget.hasPointerCapture?.(pointerId)) {
          captureTarget.releasePointerCapture(pointerId);
        }
      } catch {
        // The WebView may release capture automatically during navigation.
      }
    }
    captureTarget = null;
    pointerId = -1;
    axis = 'pending';
    dragging.value = false;
    samples = [];
  }

  function pointerVelocity(): number {
    if (samples.length < 2) return 0;
    const last = samples[samples.length - 1];
    const first = samples.find((sample) => last.time - sample.time <= 90) || samples[0];
    return ((last.x - first.x) / Math.max(1, last.time - first.time)) * 1000;
  }

  function recordSample(x: number, time = performance.now()) {
    samples.push({ x, time });
    if (samples.length > 6) samples.shift();
  }

  function isInteractiveTarget(target: EventTarget | null): boolean {
    return target instanceof Element && Boolean(target.closest(INTERACTIVE_TARGETS));
  }

  function onPointerDown(event: PointerEvent) {
    if (!event.isPrimary || event.pointerType === 'mouse' || direction.value === 'none') return;
    if (isInteractiveTarget(event.target)) return;

    cancelAnimation();
    previewing.value = false;
    phase.value = null;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    startOffset = offset.value;
    startedOpen = options.isOpen();
    gestureSign = lyricSwipeSign(direction.value, startedOpen);
    axis = 'pending';
    samples = [];
    recordSample(event.clientX, event.timeStamp || performance.now());
  }

  function onPointerMove(event: PointerEvent) {
    if (event.pointerId !== pointerId) return;
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;

    if (axis === 'pending') {
      if (Math.hypot(deltaX, deltaY) < AXIS_LOCK_DISTANCE) return;
      axis = Math.abs(deltaX) > Math.abs(deltaY) * 1.12 ? 'horizontal' : 'vertical';
      if (axis === 'vertical') return;
      dragging.value = true;
      phase.value = startedOpen ? 'closing' : 'opening';
      previewing.value = true;
      const target = event.currentTarget;
      if (target instanceof Element && target.setPointerCapture) {
        try {
          target.setPointerCapture(event.pointerId);
          captureTarget = target;
        } catch {
          // Pointer capture is optional in older embedded WebViews.
        }
      }
    }
    if (axis !== 'horizontal') return;

    if (event.cancelable) event.preventDefault();
    recordSample(event.clientX, event.timeStamp || performance.now());

    const width = Math.max(1, window.innerWidth);
    const rawOffset = startOffset + deltaX;
    const travel = rawOffset * gestureSign;
    if (travel < 0) {
      offset.value = gestureSign * -rubberBand(Math.abs(travel), width);
      return;
    }

    const maximum = width * 0.68;
    offset.value =
      travel <= maximum ? rawOffset : gestureSign * (maximum + rubberBand(travel - maximum, width));
  }

  function finishGesture(event: PointerEvent, cancelled = false) {
    if (event.pointerId !== pointerId) return;
    if (axis !== 'horizontal' || !dragging.value) {
      resetPointer();
      return;
    }

    if (event.cancelable) event.preventDefault();
    const velocity = cancelled ? 0 : pointerVelocity();
    const width = viewportWidth();
    const commit = !cancelled && shouldCommitLyricSwipe(offset.value, velocity, gestureSign, width);
    suppressClickUntil = performance.now() + 420;
    resetPointer();

    if (!commit) {
      animateTo(0, velocity, finishPreview);
      return;
    }

    // Finish at the viewport edge. This makes the overlay fully present or
    // fully gone before the logical state flips, avoiding a visible jump.
    animateTo(gestureSign * width, velocity, () => {
      if (startedOpen) options.onClose();
      else options.onOpen();
      finishPreview();
    });
  }

  function onPointerUp(event: PointerEvent) {
    finishGesture(event);
  }

  function onPointerCancel(event: PointerEvent) {
    finishGesture(event, true);
  }

  function animateOpen() {
    if (options.isOpen() || settling.value) return;
    cancelAnimation();
    startedOpen = false;
    gestureSign = lyricSwipeSign(direction.value, false);
    phase.value = 'opening';
    previewing.value = true;
    offset.value = 0;
    animateTo(gestureSign * viewportWidth(), 0, () => {
      options.onOpen();
      finishPreview();
    });
  }

  function animateClose() {
    if (!options.isOpen() || settling.value) return;
    cancelAnimation();
    startedOpen = true;
    gestureSign = lyricSwipeSign(direction.value, true);
    phase.value = 'closing';
    previewing.value = true;
    offset.value = 0;
    animateTo(gestureSign * viewportWidth(), 0, () => {
      options.onClose();
      finishPreview();
    });
  }

  function suppressGestureClick(event: MouseEvent) {
    if (performance.now() >= suppressClickUntil) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function handleMotionChange(event: MediaQueryListEvent | MediaQueryList) {
    reduceMotion.value = event.matches;
  }

  onMounted(() => {
    syncDirection();
    motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    handleMotionChange(motionQuery);
    motionQuery.addEventListener('change', handleMotionChange);
    window.addEventListener('music-full-config-updated', syncDirection);
    window.addEventListener('click', suppressGestureClick, true);
  });

  onBeforeUnmount(() => {
    cancelAnimation();
    finishPreview();
    motionQuery?.removeEventListener('change', handleMotionChange);
    window.removeEventListener('music-full-config-updated', syncDirection);
    window.removeEventListener('click', suppressGestureClick, true);
  });

  return {
    direction,
    dragging,
    settling,
    previewing,
    phase,
    progress,
    style,
    overlayStyle,
    underlayStyle,
    backdropStyle,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    animateOpen,
    animateClose
  };
}
