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

// ==================== 双模式 + 三类预设(播放器样式重组) ====================

/** 播放器基础模式:经典(封面+滚动歌词)/ 大字歌词 */
export const PLAYER_MODES = ['classic', 'lyric'] as const;
export type PlayerMode = (typeof PLAYER_MODES)[number];

/** 内置背景预设 id(tinycolor 派生的 md3 动态色板也在其中) */
export const BACKGROUND_PRESET_IDS = [
  'theme-solid',
  'cover-blur',
  'stage-dark',
  'concrete',
  'aurora',
  'fluid',
  'glitch',
  'vhs-crack',
  'rain',
  'smoke',
  'starchart',
  'md3'
] as const;
export type BackgroundPresetId = (typeof BACKGROUND_PRESET_IDS)[number];

/** 内置歌词预设 id */
export const LYRIC_PRESET_IDS = [
  'amll-scroll',
  'serif-line',
  'giant-two',
  'brush-single',
  'calligraphy',
  'neon-stroke',
  'dissolve'
] as const;
export type LyricPresetId = (typeof LYRIC_PRESET_IDS)[number];

/** 内置高潮效果预设 id(每个 id 打包一组效果开关) */
export const CLIMAX_PRESET_IDS = [
  'none',
  'stage',
  'frenzy',
  'eerie',
  'smoke',
  'error',
  'beat-flash',
  'color-shift',
  'starchart'
] as const;
export type ClimaxPresetId = (typeof CLIMAX_PRESET_IDS)[number];

/** 用户保存的组合预设(背景+歌词+高潮+参数快照) */
export interface StylePreset {
  id: string;
  name: string;
  background: string;
  lyric: string;
  climax: string;
  params: Record<string, unknown>;
}

/** 旧样式 key → 新模式+预设组合的迁移映射值 */
export interface LegacyStyleMigration {
  mode: PlayerMode;
  background: BackgroundPresetId;
  lyric: LyricPresetId;
  climax: ClimaxPresetId;
}
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
  /** 默认样式：封面下方显示歌名与作者（不影响底部控制栏） */
  showTrackInfo?: boolean;
  /** 默认样式：封面大小 60-100（占可用空间的百分比） */
  artworkSize?: number;
  /** 默认样式：封面块对齐 */
  artworkAlign?: 'start' | 'center' | 'end';
  /** 默认样式：背景预设（后续可扩展 vuebits 背景板块） */
  backgroundPreset?: 'none' | 'aurora' | 'fluid';
  [key: string]: unknown;
}

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
