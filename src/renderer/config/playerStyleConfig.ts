import type {
  MobilePlayerStyleKey,
  PlayerStyleCustomConfig,
  PlayerStyleEffects
} from '@/types/playerStyle';

const STYLE_LYRIC_COLORS: Record<MobilePlayerStyleKey, string> = {
  default: '#ffffff',
  stage: '#f0ece4',
  starChart: '#ffffff',
  magazine: '#171717',
  frenzy: '#171717',
  eerie: '#f3eee4',
  neon: '#f2dfb0',
  rain: '#ffffff'
};

const STYLE_SPECIFIC_DEFAULTS: Record<MobilePlayerStyleKey, Record<string, unknown>> = {
  default: {},
  stage: {
    auroraSpeed: 0.8,
    beatFlashIntensity: 0.5,
    effectLyricColor: true,
    effectWordDrop: false
  },
  starChart: {},
  magazine: { flipSpeed: 400 },
  frenzy: {
    giantSize: 80,
    effectCrt: true,
    effectLyricColor: true,
    effectWordDrop: false
  },
  eerie: {
    newspaperFreq: 500,
    keywordSize: 32,
    effectKeyword: true,
    effectWordDrop: false
  },
  neon: { glowRadius: 12, pulseSpeed: 1.5 },
  rain: {}
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createPlayerStyleConfig(styleKey: MobilePlayerStyleKey): PlayerStyleCustomConfig {
  const lyricColor = STYLE_LYRIC_COLORS[styleKey];
  return {
    mode: 'original',
    useCustomBackground: false,
    backgroundMode: 'solid',
    solidColor: '#111111',
    gradientColors: {
      colors: ['#111111', '#000000'],
      direction: 'to bottom'
    },
    imageBlur: 0,
    imageBrightness: 100,
    lyricColor,
    climaxUseThemeColor: true,
    climaxSplitColors: false,
    climaxColors: {
      main: { source: 'theme', customColor: lyricColor },
      auxiliary: { source: 'theme', customColor: lyricColor },
      translation: { source: 'custom', customColor: lyricColor }
    },
    ...clone(STYLE_SPECIFIC_DEFAULTS[styleKey])
  };
}

export function resolvePlayerStyleConfig(
  styleKey: MobilePlayerStyleKey,
  saved?: Partial<PlayerStyleCustomConfig> | null
): PlayerStyleCustomConfig {
  const defaults = createPlayerStyleConfig(styleKey);
  const config = {
    ...defaults,
    ...(saved || {}),
    gradientColors: {
      ...defaults.gradientColors,
      ...(saved?.gradientColors || {}),
      colors:
        saved?.gradientColors?.colors?.length === 2
          ? [...saved.gradientColors.colors]
          : [...defaults.gradientColors.colors]
    },
    climaxColors: {
      main: { ...defaults.climaxColors.main, ...(saved?.climaxColors?.main || {}) },
      auxiliary: {
        ...defaults.climaxColors.auxiliary,
        ...(saved?.climaxColors?.auxiliary || {})
      },
      translation: {
        ...defaults.climaxColors.translation,
        ...(saved?.climaxColors?.translation || {})
      }
    }
  } as PlayerStyleCustomConfig;

  if (config.mode !== 'custom') config.mode = 'original';
  if (!['solid', 'gradient', 'image'].includes(config.backgroundMode)) {
    config.backgroundMode = defaults.backgroundMode;
  }
  if (styleKey === 'eerie' && config.effectKeyword && config.effectWordDrop) {
    config.effectWordDrop = false;
  }
  return config;
}

export function resolvePlayerStyleEffects(
  styleKey: MobilePlayerStyleKey,
  config: PlayerStyleCustomConfig
): PlayerStyleEffects {
  const source = config.mode === 'custom' ? config : createPlayerStyleConfig(styleKey);
  return {
    crt: styleKey === 'frenzy' && source.effectCrt === true,
    lyricColor: (styleKey === 'frenzy' || styleKey === 'stage') && source.effectLyricColor === true,
    wordDrop:
      (styleKey === 'frenzy' || styleKey === 'eerie' || styleKey === 'stage') &&
      source.effectWordDrop === true,
    keyword: styleKey === 'eerie' && source.effectKeyword === true
  };
}
