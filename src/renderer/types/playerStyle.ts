export const MOBILE_PLAYER_STYLE_KEYS = [
  'default',
  'stage',
  'starChart',
  'magazine',
  'frenzy',
  'eerie',
  'neon',
  'rain'
] as const;

export type MobilePlayerStyleKey = (typeof MOBILE_PLAYER_STYLE_KEYS)[number];
export type PlayerStyleMode = 'original' | 'custom';
export type PlayerStyleBackgroundMode = 'solid' | 'gradient' | 'image';
export type PlayerStyleColorSource = 'theme' | 'custom';

export interface PlayerStyleColorChoice {
  source: PlayerStyleColorSource;
  customColor: string;
}

export interface PlayerStyleClimaxColors {
  main: PlayerStyleColorChoice;
  auxiliary: PlayerStyleColorChoice;
  translation: PlayerStyleColorChoice;
}

export interface PlayerStyleCustomConfig {
  mode: PlayerStyleMode;
  useCustomBackground: boolean;
  backgroundMode: PlayerStyleBackgroundMode;
  solidColor: string;
  gradientColors: {
    colors: string[];
    direction: string;
  };
  backgroundImage?: string;
  imageBlur: number;
  imageBrightness: number;
  lyricColor: string;
  customFontFamily?: string;
  customFontName?: string;
  customFontData?: string;
  climaxUseThemeColor: boolean;
  climaxSplitColors: boolean;
  climaxColors: PlayerStyleClimaxColors;
  effectCrt?: boolean;
  effectLyricColor?: boolean;
  effectWordDrop?: boolean;
  effectKeyword?: boolean;
  auroraSpeed?: number;
  beatFlashIntensity?: number;
  newspaperFreq?: number;
  keywordSize?: number;
  glowRadius?: number;
  pulseSpeed?: number;
  giantSize?: number;
  flipSpeed?: number;
  [key: string]: unknown;
}

export interface PlayerStyleEffects {
  crt: boolean;
  lyricColor: boolean;
  wordDrop: boolean;
  keyword: boolean;
}

export function isMobilePlayerStyleKey(value: unknown): value is MobilePlayerStyleKey {
  return MOBILE_PLAYER_STYLE_KEYS.includes(value as MobilePlayerStyleKey);
}
