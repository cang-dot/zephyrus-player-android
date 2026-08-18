import { readonly, ref } from 'vue';

export type MobilePlayerTransitionState = 'idle' | 'dragging' | 'opening' | 'open' | 'closing';
export type MobilePlayerSurfaceMode = 'controls' | 'playlist' | 'settings';
export interface MobilePlayerSurfaceRect {
  left: number;
  top: number;
  width: number;
  height: number;
  borderRadius: number;
}

const state = ref<MobilePlayerTransitionState>('idle');
const progress = ref(0);
const releaseVelocity = ref(0);
const controlsVisible = ref(false);
const surfaceMode = ref<MobilePlayerSurfaceMode>('controls');
const sheetProgress = ref(0);
const sourceRect = ref<MobilePlayerSurfaceRect | null>(null);
const identitySourceRect = ref<MobilePlayerSurfaceRect | null>(null);
let frame = 0;
let sheetFrame = 0;
let controlsHideTimer: ReturnType<typeof setTimeout> | undefined;

const controlsArePinned = () => {
  try {
    return Boolean(JSON.parse(localStorage.getItem('music-full-config') || '{}').alwaysShowPlayerControls);
  } catch {
    return false;
  }
};

const clearControlsHideTimer = () => {
  if (controlsHideTimer) clearTimeout(controlsHideTimer);
  controlsHideTimer = undefined;
};

const hideControls = () => {
  if (controlsArePinned()) {
    controlsVisible.value = true;
    return;
  }
  if (surfaceMode.value !== 'controls') return;
  clearControlsHideTimer();
  controlsVisible.value = false;
};

const resetControlsHideTimer = () => {
  clearControlsHideTimer();
  if (controlsArePinned()) {
    controlsVisible.value = true;
    return;
  }
  if (!controlsVisible.value || surfaceMode.value !== 'controls') return;
  controlsHideTimer = setTimeout(hideControls, 3000);
};

const showControls = (autoHide = true) => {
  controlsVisible.value = true;
  if (autoHide) resetControlsHideTimer();
  else clearControlsHideTimer();
};

const toggleControls = () => {
  if (controlsArePinned()) {
    controlsVisible.value = true;
    return;
  }
  if (surfaceMode.value !== 'controls') return;
  if (controlsVisible.value) hideControls();
  else showControls();
};

const animateSheet = (target: 0 | 1, complete?: () => void) => {
  if (sheetFrame) cancelAnimationFrame(sheetFrame);
  let value = sheetProgress.value;
  let speed = 0;
  let previous = performance.now();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tick = (now: number) => {
    const dt = Math.min(0.032, Math.max(0.001, (now - previous) / 1000));
    previous = now;
    if (reducedMotion) {
      value += (target - value) * Math.min(1, dt / 0.16);
    } else {
      speed += (-420 * (value - target) - 38 * speed) * dt;
      value += speed * dt;
    }
    sheetProgress.value = Math.min(1, Math.max(0, value));
    if (Math.abs(value - target) < 0.002 && (reducedMotion || Math.abs(speed) < 0.02)) {
      sheetProgress.value = target;
      sheetFrame = 0;
      complete?.();
      return;
    }
    sheetFrame = requestAnimationFrame(tick);
  };
  sheetFrame = requestAnimationFrame(tick);
};

const setSheetProgress = (value: number) => {
  if (sheetFrame) cancelAnimationFrame(sheetFrame);
  sheetFrame = 0;
  sheetProgress.value = Math.min(1, Math.max(0, value));
};

const setSourceRect = (rect: MobilePlayerSurfaceRect | null) => {
  sourceRect.value = rect ? { ...rect } : null;
};

const setIdentitySourceRect = (rect: MobilePlayerSurfaceRect | null) => {
  identitySourceRect.value = rect ? { ...rect } : null;
};

const close = (velocity = 0, complete?: () => void) => {
  animateTo(0, velocity, complete);
};

const setSurfaceMode = (mode: MobilePlayerSurfaceMode) => {
  if (mode === 'controls') {
    if (surfaceMode.value === 'controls') {
      resetControlsHideTimer();
      return;
    }
    animateSheet(0, () => {
      surfaceMode.value = 'controls';
      resetControlsHideTimer();
    });
    return;
  }
  surfaceMode.value = mode;
  showControls(false);
  animateSheet(1);
};

const cancel = () => {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
};

const setDragging = (value: number, velocity = 0) => {
  cancel();
  state.value = 'dragging';
  progress.value = Math.min(1, Math.max(0, value));
  releaseVelocity.value = velocity;
  if (progress.value > 0.02) showControls(false);
};

const finishClose = (complete?: () => void) => {
  complete?.();
  // Give the restored source surface one presentation frame to take over
  // before releasing the teleported full-player surface.
  frame = requestAnimationFrame(() => {
    frame = 0;
    if (state.value !== 'closing' || progress.value !== 0) return;
    state.value = 'idle';
    controlsVisible.value = false;
  });
};

const animateTo = (target: 0 | 1, velocity = 0, complete?: () => void) => {
  cancel();
  state.value = target === 1 ? 'opening' : 'closing';
  releaseVelocity.value = velocity;
  if (target === 1) showControls(false);
  else {
    if (sheetFrame) cancelAnimationFrame(sheetFrame);
    sheetFrame = 0;
    sheetProgress.value = 0;
    surfaceMode.value = 'controls';
    clearControlsHideTimer();
  }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const start = progress.value;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / 160);
      progress.value = start + (target - start) * (1 - Math.pow(1 - t, 3));
      if (t < 1) frame = requestAnimationFrame(tick);
      else {
        frame = 0;
        if (target === 1) {
          state.value = 'open';
          resetControlsHideTimer();
          complete?.();
        } else {
          finishClose(complete);
        }
      }
    };
    frame = requestAnimationFrame(tick);
    return;
  }
  let value = progress.value;
  let speed = velocity;
  let previous = performance.now();
  const tick = (now: number) => {
    const dt = Math.min(0.032, Math.max(0.001, (now - previous) / 1000));
    previous = now;
    speed += (-420 * (value - target) - 38 * speed) * dt;
    value += speed * dt;
    progress.value = Math.min(1, Math.max(0, value));
    if (Math.abs(value - target) < 0.002 && Math.abs(speed) < 0.02) {
      progress.value = target;
      frame = 0;
      if (target === 1) {
        state.value = 'open';
        resetControlsHideTimer();
        complete?.();
      } else {
        finishClose(complete);
      }
      return;
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
};

const markOpen = () => {
  cancel();
  progress.value = 1;
  state.value = 'open';
  showControls();
};

export function useMobilePlayerTransition() {
  return {
    state: readonly(state),
    progress: readonly(progress),
    releaseVelocity: readonly(releaseVelocity),
    controlsVisible: readonly(controlsVisible),
    surfaceMode: readonly(surfaceMode),
    sheetProgress: readonly(sheetProgress),
    sourceRect: readonly(sourceRect),
    identitySourceRect: readonly(identitySourceRect),
    setDragging,
    animateTo,
    close,
    markOpen,
    cancel,
    showControls,
    hideControls,
    toggleControls,
    resetControlsHideTimer,
    setSurfaceMode,
    setSheetProgress,
    setSourceRect,
    setIdentitySourceRect,
    animateSheet
  };
}
