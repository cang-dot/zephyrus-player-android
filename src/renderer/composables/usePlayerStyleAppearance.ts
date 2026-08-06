import { computed } from 'vue';

import { useStyleCustomConfig } from '@/composables/useStyleCustomConfig';
import { playMusic } from '@/hooks/MusicHook';
import { useStyleEngineStore } from '@/store/modules/styleEngine';
import type { MobilePlayerStyleKey, PlayerStyleColorChoice } from '@/types/playerStyle';

type PlayerAppearanceVars = Record<string, string>;

function gradientValue(colors: string[], direction: string, fallback: string): string {
  const validColors = colors.filter(Boolean);
  if (validColors.length < 2) return fallback;
  return `linear-gradient(${direction || 'to bottom'}, ${validColors.join(', ')})`;
}

function resolveChoice(choice: PlayerStyleColorChoice, themeColor: string): string {
  return choice.source === 'theme' ? themeColor : choice.customColor;
}

export function usePlayerStyleAppearance(styleKey: MobilePlayerStyleKey) {
  const { config, effects, isCustom } = useStyleCustomConfig(styleKey);
  const styleEngine = useStyleEngineStore();

  const themeColor = computed(
    () =>
      playMusic.value?.primaryColor ||
      playMusic.value?.backgroundColor ||
      'var(--accent-color, #ffffff)'
  );
  const customBackgroundActive = computed(() => isCustom.value && config.value.useCustomBackground);
  const background = computed(() => {
    if (!customBackgroundActive.value) return 'transparent';
    if (config.value.backgroundMode === 'gradient') {
      return gradientValue(
        config.value.gradientColors.colors,
        config.value.gradientColors.direction,
        config.value.solidColor
      );
    }
    if (config.value.backgroundMode === 'image' && config.value.backgroundImage) {
      return `url("${config.value.backgroundImage}") center / cover no-repeat`;
    }
    return config.value.solidColor;
  });

  const baseLyricColor = computed(() => config.value.lyricColor || '#ffffff');
  const climaxColors = computed(() => {
    const base = baseLyricColor.value;
    const mainThemeEnabled = !['stage', 'frenzy'].includes(styleKey) || effects.value.lyricColor;
    if (!isCustom.value || !styleEngine.isInClimax || !config.value.climaxUseThemeColor) {
      return { main: base, auxiliary: base, translation: base };
    }
    if (!config.value.climaxSplitColors) {
      return {
        main: mainThemeEnabled ? themeColor.value : base,
        auxiliary: themeColor.value,
        translation: base
      };
    }
    return {
      main: mainThemeEnabled
        ? resolveChoice(config.value.climaxColors.main, themeColor.value)
        : base,
      auxiliary: resolveChoice(config.value.climaxColors.auxiliary, themeColor.value),
      translation: resolveChoice(config.value.climaxColors.translation, themeColor.value)
    };
  });

  const styleVars = computed<PlayerAppearanceVars>(() => ({
    '--player-style-background': background.value,
    '--player-style-background-blur': `${
      customBackgroundActive.value && config.value.backgroundMode === 'image'
        ? config.value.imageBlur
        : 0
    }px`,
    '--player-style-background-brightness': `${
      customBackgroundActive.value && config.value.backgroundMode === 'image'
        ? config.value.imageBrightness / 100
        : 1
    }`,
    '--player-style-lyric-color': climaxColors.value.main,
    '--player-style-auxiliary-color': climaxColors.value.auxiliary,
    '--player-style-translation-color': climaxColors.value.translation,
    '--player-style-font-family': config.value.customFontFamily || 'inherit'
  }));

  return {
    config,
    effects,
    isCustom,
    customBackgroundActive,
    background,
    baseLyricColor,
    climaxColors,
    themeColor,
    styleVars
  };
}
