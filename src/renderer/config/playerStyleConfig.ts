import type {
  MobilePlayerStyleKey,
  PlayerStyleCustomConfig,
  PlayerStyleEffects
} from '@/types/playerStyle';

const STYLE_LYRIC_COLORS: Record<MobilePlayerStyleKey, string> = {
  default: '#ffffff',
  stage: '#f0ece4',
  starChart: '#ffffff',
  frenzy: '#171717',
  eerie: '#f3eee4',
  neon: '#f2dfb0',
  rain: '#ffffff',
  smoke: '#e9f7f2',
  error: '#ffffff'
};

const STYLE_SPECIFIC_DEFAULTS: Record<MobilePlayerStyleKey, Record<string, unknown>> = {
  default: {},
  stage: {
    auroraSpeed: 0.8,
    beatFlashIntensity: 0.5,
    effectLyricColor: true,
    effectWordDrop: false,
    effectStaggered: false
  },
  starChart: {},
  frenzy: {
    giantSize: 80,
    effectCrt: true,
    effectLyricColor: true,
    effectWordDrop: false,
    effectStaggered: false
  },
  eerie: {
    newspaperFreq: 500,
    keywordSize: 32,
    effectKeyword: true,
    effectWordDrop: false,
    effectStaggered: false
  },
  neon: { glowRadius: 12, pulseSpeed: 1.5 },
  rain: {},
  smoke: {
    effectKeyword: true,
    effectWordDrop: false,
    effectStaggered: false,
    smokeDensity: 0.58,
    smokeChaos: 0.42,
    smokeLoudnessResponse: 0.72,
    smokeOpacity: 0.76,
    smokeVignette: 0.48,
    smokeFontStretch: 1.18,
    smokeFollowThemeColor: true,
    smokeCustomColor: '#5fffd0',
    smokeGlowFollowThemeColor: true,
    smokeGlowCustomColor: '#ff765f'
  },
  error: {
    effectCrt: true,
    effectLyricColor: true,
    effectWordDrop: false,
    effectStaggered: false,
    errorEdgeGlow: true,
    errorNoise: 0.5,
    errorJitter: 0.4,
    errorFlash: 0.6,
    errorFluidPower: 1,
    errorDecorMarks: false
  }
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
    frenzyNormalMainColor: styleKey === 'frenzy' ? '#1a1a1a' : lyricColor,
    frenzyNormalAuxiliaryColor: styleKey === 'frenzy' ? '#6b6b6b' : lyricColor,
    frenzyClimaxMainColor: styleKey === 'frenzy' ? '#171717' : lyricColor,
    frenzyClimaxAuxiliaryColor: styleKey === 'frenzy' ? '#6b6b6b' : lyricColor,
    fontWeight: 600,
    wordDropFontWeight: 900,
    auxiliaryCenterDisplay: false,
    forceNoWrap: false,
    staggeredSize: 48,
    staggeredRowGap: 18,
    staggeredOffset: 14,
    staggeredRotation: 5,
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
  config.fontWeight = Math.min(900, Math.max(100, Number(config.fontWeight) || 600));
  config.wordDropFontWeight = Math.min(
    900,
    Math.max(100, Number(config.wordDropFontWeight) || 900)
  );
  config.auxiliaryCenterDisplay = config.auxiliaryCenterDisplay === true;
  config.forceNoWrap = config.forceNoWrap === true;
  config.staggeredSize = Math.min(96, Math.max(24, Number(config.staggeredSize) || 48));
  config.staggeredRowGap = Math.min(48, Math.max(8, Number(config.staggeredRowGap) || 18));
  config.staggeredOffset = Math.min(30, Math.max(0, Number(config.staggeredOffset) || 14));
  config.staggeredRotation = Math.min(12, Math.max(0, Number(config.staggeredRotation) || 5));
  config.smokeDensity = Math.min(
    1,
    Math.max(
      0.05,
      Number.isFinite(Number(config.smokeDensity)) ? Number(config.smokeDensity) : 0.58
    )
  );
  config.smokeChaos = Math.min(
    1,
    Math.max(0, Number.isFinite(Number(config.smokeChaos)) ? Number(config.smokeChaos) : 0.42)
  );
  config.smokeLoudnessResponse = Math.min(
    1,
    Math.max(
      0,
      Number.isFinite(Number(config.smokeLoudnessResponse))
        ? Number(config.smokeLoudnessResponse)
        : 0.72
    )
  );
  config.smokeOpacity = Math.min(
    1,
    Math.max(
      0.05,
      Number.isFinite(Number(config.smokeOpacity)) ? Number(config.smokeOpacity) : 0.76
    )
  );
  config.smokeVignette = Math.min(
    1,
    Math.max(0, Number.isFinite(Number(config.smokeVignette)) ? Number(config.smokeVignette) : 0.48)
  );
  config.smokeFontStretch = Math.min(
    1.8,
    Math.max(
      0.75,
      Number.isFinite(Number(config.smokeFontStretch)) ? Number(config.smokeFontStretch) : 1.18
    )
  );
  config.smokeFollowThemeColor = config.smokeFollowThemeColor !== false;
  config.smokeCustomColor = normalizeColor(config.smokeCustomColor, '#5fffd0');
  config.smokeGlowFollowThemeColor = config.smokeGlowFollowThemeColor !== false;
  config.smokeGlowCustomColor = normalizeColor(config.smokeGlowCustomColor, '#ff765f');
  config.errorEdgeGlow = config.errorEdgeGlow !== false;
  config.errorNoise = Math.min(
    1,
    Math.max(0, Number.isFinite(Number(config.errorNoise)) ? Number(config.errorNoise) : 0.5)
  );
  config.errorJitter = Math.min(
    1,
    Math.max(0, Number.isFinite(Number(config.errorJitter)) ? Number(config.errorJitter) : 0.4)
  );
  config.errorFlash = Math.min(
    1,
    Math.max(0, Number.isFinite(Number(config.errorFlash)) ? Number(config.errorFlash) : 0.6)
  );
  config.errorFluidPower = Math.min(
    2,
    Math.max(
      0.5,
      Number.isFinite(Number(config.errorFluidPower)) ? Number(config.errorFluidPower) : 1
    )
  );
  config.errorDecorMarks = config.errorDecorMarks === true;
  if (!['solid', 'gradient', 'image'].includes(config.backgroundMode)) {
    config.backgroundMode = defaults.backgroundMode;
  }
  if (config.effectStaggered) {
    config.effectWordDrop = false;
    if (styleKey === 'eerie' || styleKey === 'smoke') config.effectKeyword = false;
  } else if (
    (styleKey === 'eerie' || styleKey === 'smoke') &&
    config.effectKeyword &&
    config.effectWordDrop
  ) {
    config.effectWordDrop = false;
  }
  return config;
}

function normalizeColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

export function resolvePlayerStyleEffects(
  styleKey: MobilePlayerStyleKey,
  config: PlayerStyleCustomConfig
): PlayerStyleEffects {
  const source = config.mode === 'custom' ? config : createPlayerStyleConfig(styleKey);
  return {
    crt: (styleKey === 'frenzy' || styleKey === 'error') && source.effectCrt === true,
    lyricColor:
      (styleKey === 'frenzy' || styleKey === 'stage' || styleKey === 'error') &&
      source.effectLyricColor === true,
    wordDrop:
      (styleKey === 'frenzy' ||
        styleKey === 'eerie' ||
        styleKey === 'stage' ||
        styleKey === 'smoke') &&
      source.effectWordDrop === true,
    keyword: (styleKey === 'eerie' || styleKey === 'smoke') && source.effectKeyword === true,
    staggered:
      (styleKey === 'frenzy' ||
        styleKey === 'eerie' ||
        styleKey === 'stage' ||
        styleKey === 'smoke') &&
      source.effectStaggered === true
  };
}
