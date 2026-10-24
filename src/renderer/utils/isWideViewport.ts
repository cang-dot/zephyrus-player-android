/**
 * 宽屏视口判定（悬浮岛式侧栏生效条件）。
 *
 * 断点与 MusicListPage 宽屏分栏保持一致：≥900px 或横屏（landscape）。
 * 单例 matchMedia + 响应式 ref，避免各组件各开一份监听。
 */
import { onUnmounted, ref, watch } from 'vue';

export const WIDE_QUERY = '(min-width: 900px), (orientation: landscape)';

let mediaQuery: MediaQueryList | null = null;
const isWide = ref(false);
let initialized = false;

function ensureInit(): void {
  if (initialized || typeof window === 'undefined' || !window.matchMedia) return;
  initialized = true;
  mediaQuery = window.matchMedia(WIDE_QUERY);
  isWide.value = mediaQuery.matches;
  mediaQuery.addEventListener('change', (event) => {
    isWide.value = event.matches;
  });
}

/** 响应式宽屏判定（组件外调用安全；在组件内使用会自动随组件卸载解绑无泄漏——单例监听不绑定组件） */
export function useWideViewport(): { isWide: typeof isWide } {
  ensureInit();
  return { isWide };
}

/** 非响应式的即时判定（路由守卫/事件回调里用） */
export function isWideNow(): boolean {
  ensureInit();
  return isWide.value;
}

/** 订阅变化（可选，供需要精确响应的调用方） */
export function onWideChange(handler: (wide: boolean) => void): () => void {
  ensureInit();
  if (!mediaQuery) return () => {};
  const wrapped = (event: MediaQueryListEvent) => handler(event.matches);
  mediaQuery.addEventListener('change', wrapped);
  // 组件卸载时由调用方决定是否解绑；返回解绑函数
  onUnmounted(() => mediaQuery?.removeEventListener('change', wrapped));
  return () => mediaQuery?.removeEventListener('change', wrapped);
}

// 供测试注入的内部钩子（正常代码勿用）
export function _setTestWide(value: boolean): void {
  isWide.value = value;
  initialized = true;
}

export function _resetForTest(): void {
  mediaQuery = null;
  initialized = false;
  isWide.value = false;
}

// watch 导出以便按需使用
export { watch };
