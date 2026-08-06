import { computed, onUnmounted, ref } from 'vue';

import { playMusic } from '@/hooks/MusicHook';
import { DEFAULT_LYRIC_CONFIG, type LyricConfig } from '@/types/lyric';

type PlayerAppearanceVars = Record<string, string>;

function loadConfig(): LyricConfig {
  try {
    const saved = localStorage.getItem('music-full-config');
    if (saved) return { ...DEFAULT_LYRIC_CONFIG, ...JSON.parse(saved) } as LyricConfig;
  } catch {
    // Invalid local settings should never prevent the player from opening.
  }
  return { ...DEFAULT_LYRIC_CONFIG };
}

function gradientValue(config: LyricConfig): string {
  const colors = config.gradientColors?.colors?.filter(Boolean) ?? [];
  if (colors.length < 2) return config.solidColor || '#111111';
  return `linear-gradient(${config.gradientColors.direction || 'to bottom'}, ${colors.join(', ')})`;
}

function backgroundValue(config: LyricConfig): string {
  if (!config.useCustomBackground) {
    return playMusic.value?.backgroundColor || playMusic.value?.primaryColor || '#111111';
  }
  if (config.backgroundMode === 'gradient') return gradientValue(config);
  if (config.backgroundMode === 'image' && config.backgroundImage) {
    return `url("${config.backgroundImage}") center / cover no-repeat`;
  }
  if (config.backgroundMode === 'css' && config.customCss?.trim()) return config.customCss;
  return config.solidColor || '#111111';
}

export function usePlayerStyleAppearance() {
  const config = ref<LyricConfig>(loadConfig());

  const refresh = () => {
    config.value = loadConfig();
  };
  window.addEventListener('music-full-config-updated', refresh);
  window.addEventListener('storage', refresh);
  onUnmounted(() => {
    window.removeEventListener('music-full-config-updated', refresh);
    window.removeEventListener('storage', refresh);
  });

  const background = computed(() => backgroundValue(config.value));
  const isImageBackground = computed(
    () => config.value.useCustomBackground && config.value.backgroundMode === 'image'
  );
  const styleVars = computed<PlayerAppearanceVars>(() => ({
    '--player-style-background': background.value,
    '--player-style-background-blur': `${isImageBackground.value ? config.value.imageBlur || 0 : 0}px`,
    '--player-style-background-brightness': `${isImageBackground.value ? (config.value.imageBrightness || 100) / 100 : 1}`,
    '--player-style-lyric-color': config.value.lyricColor || '#ffffff',
    '--player-style-fallback': playMusic.value?.primaryColor || '#111111'
  }));

  return { config, background, styleVars };
}
