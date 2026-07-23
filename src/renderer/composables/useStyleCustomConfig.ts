/**
 * useStyleCustomConfig — 读取当前播放器样式的自定义效果配置
 *
 * 从 localStorage 的 music-full-config.styleCustomConfig[styleKey] 读取参数。
 * 监听 music-full-config-updated 事件自动刷新。
 */
import { ref, onUnmounted } from 'vue';

export function useStyleCustomConfig(styleKey: string) {
  const config = ref<Record<string, any>>({});

  function load() {
    try {
      const saved = localStorage.getItem('music-full-config');
      if (!saved) return;
      const parsed = JSON.parse(saved);
      config.value = parsed.styleCustomConfig?.[styleKey] || {};
    } catch {
      // ignore
    }
  }

  load();

  function handler() {
    load();
  }
  window.addEventListener('music-full-config-updated', handler);
  onUnmounted(() => window.removeEventListener('music-full-config-updated', handler));

  return { config };
}
