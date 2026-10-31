import { ref } from 'vue';
import { defineStore } from 'pinia';

const CRASH_COUNT_KEY = 'background-health-crash-count';
const CRASHED_LAST_KEY = 'background-health-crashed-last';
/** 背景特效降级广播：playerCore 收到后联动「先音频」软恢复与用户提示 */
export const BACKGROUND_HEALTH_DEGRADED_EVENT = 'background-health-degraded';
/** 同一次崩溃中多个层/组件接连上报的去重窗口 */
const REPORT_DEDUPE_MS = 5000;
/** 崩溃计数达到该值后，后续启动直接关特效 */
const CRASH_COUNT_DISABLE_THRESHOLD = 2;

export function readCrashCountFromStorage(): number {
  try {
    const raw = Number(localStorage.getItem(CRASH_COUNT_KEY));
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
  } catch {
    return 0;
  }
}

/** 启动保险丝判定：上次会话崩过 或 累计崩溃达阈值 → 本次启动关特效 */
export function resolveStartupDegraded(crashedLast: boolean, crashCount: number): boolean {
  return crashedLast || crashCount >= CRASH_COUNT_DISABLE_THRESHOLD;
}

/**
 * 背景（WebGL/流体）引擎健康：iOS PWA 前台局部回收会连 GPU 上下文带音频管线一起杀。
 * 职责只管「侦测记账 + 降级开关 + 跨会话保险丝」；音频软恢复由 playerCore 监听
 * BACKGROUND_HEALTH_DEGRADED_EVENT 联动（恢复顺序铁律：先音频、后背景、背景不立即重建）。
 * 本模块刻意不引 service/组件，保证可单测。
 */
export const useBackgroundHealthStore = defineStore('backgroundHealth', () => {
  const crashCount = ref(readCrashCountFromStorage());
  /** 本次会话背景特效已降级（宿主强制实色兜底） */
  const degraded = ref(false);
  /** 启动保险丝触发的降档（mount 后一次性提示用） */
  const startupDegraded = ref(false);
  /** 每次会话只允许一次安全点重试（换歌/重进播放页），再崩禁到下次启动 */
  const retryUsed = ref(false);
  let crashedThisSession = false;
  let lastReportAt = 0;

  function persistCrashCount() {
    try {
      localStorage.setItem(CRASH_COUNT_KEY, String(crashCount.value));
    } catch {
      // 存储不可用时忽略
    }
  }

  /** WebGL 上下文丢失上报（各背景组件的 contextlost 监听/巡检调用） */
  function reportContextLost(source: string) {
    const now = Date.now();
    if (now - lastReportAt < REPORT_DEDUPE_MS) return;
    lastReportAt = now;
    console.warn(`[backgroundHealth] WebGL 上下文丢失（${source}），触发降级与音频联动`);
    crashedThisSession = true;
    crashCount.value += 1;
    persistCrashCount();
    // 同步写跨会话标记：若本次会话随即被系统杀掉，下次启动仍能降档
    try {
      localStorage.setItem(CRASHED_LAST_KEY, '1');
    } catch {
      // 忽略
    }
    degraded.value = true;
    window.dispatchEvent(new Event(BACKGROUND_HEALTH_DEGRADED_EVENT));
  }

  /** 安全点重试（换歌/重进播放页调用）：整个会话只放行一次 */
  function tryRestoreAtSafePoint() {
    if (!degraded.value || retryUsed.value) return;
    retryUsed.value = true;
    degraded.value = false;
  }

  /** 启动保险丝：main.ts 在 pinia 就绪后、mount 前调用一次 */
  function applyStartupFuse() {
    let crashedLast = false;
    try {
      crashedLast = localStorage.getItem(CRASHED_LAST_KEY) === '1';
      localStorage.removeItem(CRASHED_LAST_KEY);
    } catch {
      // 忽略
    }
    if (resolveStartupDegraded(crashedLast, crashCount.value)) {
      degraded.value = true;
      startupDegraded.value = true;
    }
  }

  // 健康会话衰减：正常离开且本次会话无崩溃 → 计数回退一档（自适应自愈，
  // 替代「设置手动重开清零」——持续崩溃的设备自然累积到阈值，健康使用自然洗白）
  window.addEventListener('pagehide', () => {
    if (crashedThisSession || crashCount.value <= 0) return;
    crashCount.value -= 1;
    persistCrashCount();
  });

  return {
    crashCount,
    degraded,
    startupDegraded,
    reportContextLost,
    tryRestoreAtSafePoint,
    applyStartupFuse
  };
});
