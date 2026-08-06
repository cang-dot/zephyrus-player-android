import { computed, onUnmounted, ref } from 'vue';

import {
  createPlayerStyleConfig,
  resolvePlayerStyleConfig,
  resolvePlayerStyleEffects
} from '@/config/playerStyleConfig';
import type { MobilePlayerStyleKey, PlayerStyleCustomConfig } from '@/types/playerStyle';

export function useStyleCustomConfig(styleKey: MobilePlayerStyleKey) {
  const savedConfig = ref<PlayerStyleCustomConfig>(resolvePlayerStyleConfig(styleKey));

  function load() {
    try {
      const saved = localStorage.getItem('music-full-config');
      const parsed = saved ? JSON.parse(saved) : {};
      savedConfig.value = resolvePlayerStyleConfig(styleKey, parsed.styleCustomConfig?.[styleKey]);
      installCustomFont(styleKey, savedConfig.value);
    } catch {
      savedConfig.value = resolvePlayerStyleConfig(styleKey);
    }
  }

  load();

  const handler = () => load();
  window.addEventListener('music-full-config-updated', handler);
  window.addEventListener('storage', handler);
  onUnmounted(() => {
    window.removeEventListener('music-full-config-updated', handler);
    window.removeEventListener('storage', handler);
  });

  const isCustom = computed(() => savedConfig.value.mode === 'custom');
  const config = computed(() =>
    isCustom.value ? savedConfig.value : createPlayerStyleConfig(styleKey)
  );
  const effects = computed(() => resolvePlayerStyleEffects(styleKey, savedConfig.value));

  return { config, effects, isCustom, reload: load };
}

function installCustomFont(styleKey: MobilePlayerStyleKey, config: PlayerStyleCustomConfig) {
  const elementId = `user-style-font-${styleKey}`;
  document.getElementById(elementId)?.remove();
  if (
    config.mode !== 'custom' ||
    !config.customFontFamily ||
    !config.customFontData?.startsWith('data:')
  )
    return;
  const style = document.createElement('style');
  style.id = elementId;
  style.textContent = `@font-face { font-family: '${config.customFontFamily}'; src: url('${config.customFontData}'); font-display: swap; }`;
  document.head.appendChild(style);
}
