import tinycolor from 'tinycolor2';
import { computed } from 'vue';

import { useStyleCustomConfig } from '@/composables/useStyleCustomConfig';
import { SMOKE_DEFAULT_LYRIC_COLOR } from '@/config/playerStyleConfig';
import { playMusic } from '@/hooks/MusicHook';
import { useCoverColor } from '@/hooks/useCoverColor';
import { useStyleEngineStore } from '@/store/modules/styleEngine';
import type { MobilePlayerStyleKey, PlayerStyleColorChoice } from '@/types/playerStyle';
import { getFontFamily } from '@/utils/fontLoader';
import { resolveSaturatedHsl } from '@/utils/neutralColor';

type PlayerAppearanceVars = Record<string, string>;

const ORIGINAL_STYLE_BACKGROUNDS: Record<MobilePlayerStyleKey, string> = {
  default: '',
  stage: '#1a1a1a',
  starChart: '#050505',
  frenzy: '#f5f5f5',
  eerie: '',
  neon: '#1a1814',
  rain: '#0a0a0f',
  smoke: '#111111',
  error: '#000000'
};

function gradientValue(colors: string[], direction: string, fallback: string): string {
  const validColors = colors.filter(Boolean);
  if (validColors.length < 2) return fallback;
  return `linear-gradient(${direction || 'to bottom'}, ${validColors.join(', ')})`;
}

function resolveChoice(choice: PlayerStyleColorChoice, themeColor: string): string {
  return choice.source === 'theme' ? themeColor : choice.customColor;
}

function saturateHex(color: string): string {
  const tiny = tinycolor(color);
  if (!tiny.isValid()) return color;
  const hsl = tiny.toHsl();
  // 封面近灰白且全局强调色有色时借其色相（决策逻辑见 neutralColor.resolveSaturatedHsl）；
  // 两者都无色时保持中性——不能强行上色，否则纯灰的 hue=0 会被放大成高饱和红色
  const accent = tinycolor(
    getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim()
  );
  const accentHsl = accent.isValid() ? accent.toHsl() : null;
  return tinycolor(resolveSaturatedHsl(hsl, accentHsl)).toHexString();
}

export function usePlayerStyleAppearance(styleKey: MobilePlayerStyleKey) {
  const { config, effects, isCustom } = useStyleCustomConfig(styleKey);
  const styleEngine = useStyleEngineStore();
  // 响应式封面主色（全局单例，watch playMusic.picUrl 自动更新）。
  // 不能用 'var(--accent-color)' 字符串兜底：切歌后字符串不变导致 computed 不重算，
  // saturateHex 里的 getComputedStyle 读到的是旧值（表现为流体背景不随切歌换色）。
  const coverColor = useCoverColor();

  const themeColor = computed(
    () =>
      playMusic.value?.primaryColor ||
      playMusic.value?.backgroundColor ||
      coverColor.primaryColor.value ||
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
  const backgroundColor = computed(() => {
    if (!customBackgroundActive.value) {
      return ORIGINAL_STYLE_BACKGROUNDS[styleKey] || themeColor.value;
    }
    if (config.value.backgroundMode === 'gradient') {
      return (
        config.value.gradientColors.colors[1] || config.value.gradientColors.colors[0] || '#111111'
      );
    }
    if (config.value.backgroundMode === 'image') {
      return config.value.imageBrightness > 70 ? '#eeeeee' : '#111111';
    }
    return config.value.solidColor;
  });

  // 烟雾样式出厂色即哨兵值：未自定义歌词颜色时跟随高饱和歌曲主色
  const baseLyricColor = computed(() => {
    if (styleKey === 'smoke' && config.value.lyricColor === SMOKE_DEFAULT_LYRIC_COLOR) {
      return saturatedThemeColor.value;
    }
    return config.value.lyricColor || '#ffffff';
  });
  const selectedFontFamily = computed(() => {
    if (!isCustom.value) return '';
    if (config.value.builtinFontId) return getFontFamily(config.value.builtinFontId);
    return config.value.customFontFamily || '';
  });
  const customFontActive = computed(() => Boolean(selectedFontFamily.value));
  const climaxColors = computed(() => {
    const base = baseLyricColor.value;
    const mainThemeEnabled = !['stage', 'frenzy'].includes(styleKey) || effects.value.lyricColor;
    // 默认样式不做高潮变色:高潮时段歌词保持所选颜色不变
    if (
      styleKey === 'default' ||
      !isCustom.value ||
      !styleEngine.isInClimax ||
      !config.value.climaxUseThemeColor
    ) {
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
    '--player-style-background-color': backgroundColor.value,
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
    backgroundColor,
    baseLyricColor,
    climaxColors,
    themeColor,
    saturatedThemeColor,
    selectedFontFamily,
    customFontActive,
    styleVars
  };
}
