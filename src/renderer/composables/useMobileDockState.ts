/**
 * 底部 Dock 三态状态机：expanded（展开）/ collapsed（收起）/ search（搜索）。
 *
 * 规则（收起态无法主动触发）：
 * - 页面下滑（越过阈值）→ collapsed；
 * - 回到页顶（scrollY 归零）→ expanded；
 * - 收起态点左圆钮 → expanded；
 * - 搜索钮 → search（记住进入前的形态，X 退出还原）。
 * 迁移规则抽成纯 reducer（nextDockMode）供单测，composable 只做滚动采样与响应式暴露。
 */
import { computed, ref } from 'vue';

export type MobileDockMode = 'expanded' | 'collapsed' | 'search';

export interface MobileDockState {
  mode: MobileDockMode;
  /** 进入 search 前的形态，退出时还原 */
  preSearchMode: Exclude<MobileDockMode, 'search'>;
  atTop: boolean;
}

export type MobileDockEvent =
  | { type: 'scrollDown'; scrollTop: number }
  | { type: 'atTop'; scrollTop: number }
  | { type: 'enterSearch' }
  | { type: 'exitSearch' }
  | { type: 'expand' };

/** 收起触发的滚动阈值（px） */
export const DOCK_COLLAPSE_THRESHOLD = 120;
/** 回顶判定阈值（px） */
export const DOCK_TOP_THRESHOLD = 8;

export function initialMobileDockState(): MobileDockState {
  return { mode: 'expanded', preSearchMode: 'expanded', atTop: true };
}

export function nextDockMode(state: MobileDockState, event: MobileDockEvent): MobileDockState {
  switch (event.type) {
    case 'scrollDown': {
      if (event.scrollTop <= DOCK_COLLAPSE_THRESHOLD) return state;
      // 搜索态下滚动不打断搜索（用户正在输入/浏览结果）
      if (state.mode === 'search') return state;
      if (state.mode === 'collapsed' && !state.atTop) return state;
      return { ...state, mode: 'collapsed', atTop: false };
    }
    case 'atTop': {
      // 回到页顶恢复展开态（搜索态除外）
      if (state.mode === 'search') return { ...state, atTop: true };
      return { ...state, mode: 'expanded', atTop: true };
    }
    case 'enterSearch': {
      if (state.mode === 'search') return state;
      const pre = state.mode === 'collapsed' ? 'collapsed' : 'expanded';
      return { ...state, mode: 'search', preSearchMode: pre };
    }
    case 'exitSearch': {
      if (state.mode !== 'search') return state;
      return { ...state, mode: state.preSearchMode };
    }
    case 'expand': {
      return state.mode === 'expanded' ? state : { ...state, mode: 'expanded' };
    }
    default:
      return state;
  }
}

// ── 响应式单例（供 MobileLayout / 页面滚动回调共享） ──
const state = ref<MobileDockState>(initialMobileDockState());
let lastScrollTop = 0;

export function useMobileDockState() {
  const mode = computed(() => state.value.mode);
  const atTop = computed(() => state.value.atTop);

  function dispatch(event: MobileDockEvent) {
    state.value = nextDockMode(state.value, event);
  }

  /**
   * 页面滚动回调：向下滚过阈值收起，回到页顶展开。
   * delta 由调用方给出（正 = 内容向下滚/远离页顶），无 delta 时按位置判定。
   */
  function reportScrollTop(scrollTop: number) {
    const delta = scrollTop - lastScrollTop;
    lastScrollTop = scrollTop;
    if (scrollTop <= DOCK_TOP_THRESHOLD) {
      dispatch({ type: 'atTop', scrollTop });
      return;
    }
    if (delta > 0) {
      dispatch({ type: 'scrollDown', scrollTop });
    }
  }

  function enterSearch() {
    dispatch({ type: 'enterSearch' });
  }

  function exitSearch() {
    dispatch({ type: 'exitSearch' });
  }

  function expand() {
    dispatch({ type: 'expand' });
  }

  /** 路由切换后复位（页顶、展开态） */
  function resetForPage() {
    lastScrollTop = 0;
    state.value = { ...initialMobileDockState(), mode: state.value.mode === 'search' ? 'search' : 'expanded' };
  }

  return { mode, atTop, reportScrollTop, enterSearch, exitSearch, expand, resetForPage, dispatch };
}
