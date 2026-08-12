import { computed } from 'vue';

import { useStyleCustomConfig } from '@/composables/useStyleCustomConfig';
import { playMusic } from '@/hooks/MusicHook';
import { useStyleEngineStore } from '@/store/modules/styleEngine';
import type { MobilePlayerStyleKey, PlayerStyleColorChoice } from '@/types/playerStyle';
import { getFontFamily } from '@/utils/fontLoader';

type PlayerAppearanceVars = Record<string, string>;

function gradientValue(colors: string[], direction: string, fallback: string): string {
  const validColors = colors.filter(Boolean);
  if (validColors.length < 2) return fallback;
  return `linear-gradient(${direction || 'to bottom'}, ${validColors.join(', ')})`;
}

function resolveChoice(choice: PlayerStyleColorChoice, themeColor: string): string {
  return choice.source === 'theme' ? themeColor : choice.customColor;
}

function saturateHex(color: string): string {
  const match = color.match(/^#([0-9a-f]{6})$/i);
  if (!match) return color;
  const values = [0, 1, 2].map((i) => Number.parseInt(match[1].slice(i * 2, i * 2 + 2), 16));
  const max = Math.max(...values);
  const min = Math.min(...values);
  const spread = Math.max(1, max - min);
  return `#${values
    .map((value) => Math.min(255, Math.round(min + ((value - min) * 1.55 * 255) / spread)))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`;
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
  const saturatedThemeColor = computed(() => saturateHex(themeColor.value));
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
  const selectedFontFamily = computed(() => {
    if (!isCustom.value) return '';
    if (config.value.builtinFontId) return getFontFamily(config.value.builtinFontId);
    return config.value.customFontFamily || '';
  });
  const customFontActive = computed(() => Boolean(selectedFontFamily.value));
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
    ...(isCustom.value
      ? {
          '--player-style-custom-main-color': climaxColors.value.main,
          '--player-style-custom-auxiliary-color': climaxColors.value.auxiliary,
          '--player-style-custom-translation-color': climaxColors.value.translation
        }
      : {}),
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
    '--player-style-font-family':
      selectedFontFamily.value || 'var(--player-style-resolved-font, inherit)',
    '--player-style-font-weight': String(config.value.fontWeight || 600),
    '--player-style-drop-font-weight': String(
      isCustom.value ? config.value.wordDropFontWeight || 900 : 900
    ),
    '--player-style-font-stretch': String(config.value.smokeFontStretch || 1)
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
    saturatedThemeColor,
    selectedFontFamily,
    customFontActive,
    styleVars
  };
}
