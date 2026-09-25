/**
 * 平台判定工具（与 audioAnalysisGate / preloadService 共用，避免循环依赖）
 */

/** iOS / iPadOS（含 iPadOS 13+ 的桌面 UA） */
export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}