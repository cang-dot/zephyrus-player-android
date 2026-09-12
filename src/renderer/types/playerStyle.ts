export const MOBILE_PLAYER_STYLE_KEYS = [
  'default',
  'stage',
  'starChart',
  'frenzy',
  'eerie',
  'neon',
  'rain',
  'smoke',
  'error'
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
  frenzyNormalMainColor: string;
  frenzyNormalAuxiliaryColor: string;
  frenzyClimaxMainColor: string;
  frenzyClimaxAuxiliaryColor: string;
  builtinFontId?: string;
  customFontFamily?: string;
  customFontName?: string;
  customFontData?: string;
  /** Font weight used when a built-in or imported custom font is selected. */
  fontWeight?: number;
  climaxUseThemeColor: boolean;
  climaxSplitColors: boolean;
  climaxColors: PlayerStyleClimaxColors;
  effectCrt?: boolean;
  effectLyricColor?: boolean;
  effectWordDrop?: boolean;
  effectKeyword?: boolean;
  effectStaggered?: boolean;
  auroraSpeed?: number;
  /** 极光带出现的位置（8 方向），stage/default 样式可用 */
  auroraPosition?: AuroraPosition;
  beatFlashIntensity?: number;
  newspaperFreq?: number;
  keywordSize?: number;
  glowRadius?: number;
  pulseSpeed?: number;
  giantSize?: number;
  wordDropFontWeight?: number;
  auxiliaryCenterDisplay?: boolean;
  forceNoWrap?: boolean;
  staggeredSize?: number;
  staggeredRowGap?: number;
  staggeredOffset?: number;
  staggeredRotation?: number;
  smokeDensity?: number;
  smokeChaos?: number;
  smokeLoudnessResponse?: number;
  smokeOpacity?: number;
  smokeVignette?: number;
  smokeFontStretch?: number;
  smokeFollowThemeColor?: boolean;
  smokeCustomColor?: string;
  smokeGlowFollowThemeColor?: boolean;
  smokeGlowCustomColor?: string;
  /** 「错误」样式：高潮烟雾式边缘光开关 */
  errorEdgeGlow?: boolean;
  /** 「错误」样式：白色噪点强度 0-1 */
  errorNoise?: number;
  /** 「错误」样式：歌词抽帧抖动强度 0-1 */
  errorJitter?: number;
  /** 「错误」样式：高潮错误闪烁强度 0-1 */
  errorFlash?: number;
  /** 「错误」样式：流体力度倍率 0.5-2 */
  errorFluidPower?: number;
  /** 「错误」样式：歌词装饰符号（!…!）开关 */
  errorDecorMarks?: boolean;
  /** 默认样式：显示大封面 */
  showArtwork?: boolean;
  /** 默认样式：封面下方显示歌名与作者（不影响底部控制栏） */
  showTrackInfo?: boolean;
  /** 默认样式：显示歌词区域 */
  showLyricsZone?: boolean;
  /** 星盘样式：歌词文本块每块行数 2-6 */
  starBlockLines?: number;
  /** 星盘样式：圆盘大小百分比 50-130 */
  starDiscSize?: number;
  /** 星盘样式：歌词文本大小百分比 60-200 */
  starTextSize?: number;
  /** 星盘样式：圆盘九宫格位置（边缘位露出一半） */
  starChartPosition?: string;
  /** 默认样式：封面大小 60-100（占可用空间的百分比） */
  artworkSize?: number;
  /** 默认样式：封面块对齐 */
  artworkAlign?: 'start' | 'center' | 'end';
  /** 默认样式：背景预设（后续可扩展 vuebits 背景板块） */
  backgroundPreset?: 'none' | 'aurora' | 'fluid';
  [key: string]: unknown;
}

/** 极光背景的 8 个方位 */
export type AuroraPosition =
  | 'top'
  | 'top-right'
  | 'right'
  | 'bottom-right'
  | 'bottom'
  | 'bottom-left'
  | 'left'
  | 'top-left';

export interface PlayerStyleEffects {
  crt: boolean;
  lyricColor: boolean;
  wordDrop: boolean;
  keyword: boolean;
  staggered: boolean;
}

export function isMobilePlayerStyleKey(value: unknown): value is MobilePlayerStyleKey {
  return MOBILE_PLAYER_STYLE_KEYS.includes(value as MobilePlayerStyleKey);
}
