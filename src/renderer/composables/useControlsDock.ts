import { computed, onBeforeUnmount, onMounted, ref, type CSSProperties } from 'vue';

/**
 * 播放控件「下移贴底」隐藏模式
 *
 * 自动隐藏时控件不再淡出，而是整体下移到进度条贴住屏幕底边：
 * shift = 视口高度 - 进度条底边距离。位移用 transform 呈现，
 * 基准位置只在控件可见时测量（隐藏后布局已位移，测出的值无效）。
 */
export function useControlsDock(
  getProgressEl: () => HTMLElement | null,
  options: {
    /** 控件当前是否应隐藏 */
    hidden: () => boolean;
    /** dock 是否生效（常显模式/面板打开时为 false） */
    enabled: () => boolean;
  }
) {
  const shift = ref(0);
  let frame = 0;

  const measure = () => {
    if (options.hidden() || !options.enabled()) return;
    const el = getProgressEl();
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    shift.value = Math.max(0, Math.round(window.innerHeight - rect.bottom));
  };

  const scheduleMeasure = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(measure);
  };

  const dockStyle = computed<CSSProperties>(() => {
    const active = options.hidden() && options.enabled() && shift.value > 0;
    return {
      transform: active ? `translate3d(0, ${shift.value}px, 0)` : 'translate3d(0, 0, 0)',
      transition: 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)'
    };
  });

  const dockActive = computed(
    () => options.hidden() && options.enabled() && shift.value > 0
  );

  onMounted(() => {
    window.addEventListener('resize', scheduleMeasure);
    window.addEventListener('orientationchange', scheduleMeasure);
    scheduleMeasure();
  });

  onBeforeUnmount(() => {
    if (frame) cancelAnimationFrame(frame);
    window.removeEventListener('resize', scheduleMeasure);
    window.removeEventListener('orientationchange', scheduleMeasure);
  });

  return { dockStyle, dockActive, dockShift: shift, scheduleMeasure };
}
