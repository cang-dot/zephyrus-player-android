/**
 * 播放器预设注册表
 *
 * 9 种旧样式解构为「经典 / 大字歌词」两种模式 + 背景/歌词/高潮三类预设。
 * 本文件是三类预设的唯一注册表:id、显示名兜底、参数默认值、
 * 高潮效果开关组合,以及旧 playerStyle key 的迁移映射。
 */
import type {
  BackgroundPresetId,
  ClimaxPresetId,
  LegacyStyleMigration,
  LyricPresetId,
  MobilePlayerStyleKey,
  PlayerMode
} from '@/types/playerStyle';

export interface BackgroundPresetDef {
  id: BackgroundPresetId;
  label: string;
  /** 背景参数默认值(雨强度/烟雾密度/故障力度等) */
  params: Record<string, unknown>;
}

export interface LyricPresetDef {
  id: LyricPresetId;
  label: string;
  /** 歌词参数默认值(巨字字号/关键字号/ newspaperFreq 等) */
  params: Record<string, unknown>;
}

/** 高潮效果开关组合(单选预设打包多效果,互斥规则由调用方归一) */
export interface ClimaxEffectFlags {
  /** 高潮歌词变歌曲主题色 */
  lyricColor: boolean;
  /** CRT 扫描线 */
  crt: boolean;
  /** 逐字下落 */
  wordDrop: boolean;
  /** 高潮重点词大字 */
  keyword: boolean;
  /** 交错歌词 */
  staggered: boolean;
  /** 鼓点全屏闪白 */
  beatFlash: boolean;
  /** 高潮过渡白闪(hue-rotate) */
  flash: boolean;
  /** 报纸纹理频闪 */
  newspaper: boolean;
  /** 边缘辉光 */
  glow: boolean;
  /** 暗角 */
  vignette: boolean;
  /** 负片爆发(反色+撕裂+色散) */
  invertBurst: boolean;
  /** 抽帧抖动 */
  jitter: boolean;
  /** 星盘提亮 */
  chartBoost: boolean;
}

export interface ClimaxPresetDef {
  id: ClimaxPresetId;
  label: string;
  effects: Partial<ClimaxEffectFlags>;
}

// ==================== 背景预设 ====================

export const BACKGROUND_PRESETS: BackgroundPresetDef[] = [
  { id: 'theme-solid', label: '封面主色', params: {} },
  { id: 'cover-blur', label: '封面模糊', params: { backgroundBlur: 60, backgroundDarkness: 0.4 } },
  { id: 'stage-dark', label: '深色舞台', params: { beatFlashIntensity: 0.5 } },
  { id: 'concrete', label: '陈旧混凝土', params: {} },
  { id: 'aurora', label: '极光', params: { auroraSpeed: 0.8 } },
  { id: 'fluid', label: '流体', params: { fluidPower: 1 } },
  { id: 'glitch', label: '故障', params: { glitchIntensity: 1 } },
  {
    id: 'vhs-crack',
    label: '诡谲噪点',
    params: { vhsIntensity: 1, crackEnabled: true, newspaperFreq: 500 }
  },
  {
    id: 'rain',
    label: '雨夜',
    params: { rainIntensity: 1, rainSpeed: 1, rainAudioReactive: true }
  },
  {
    id: 'smoke',
    label: '烟雾',
    params: { smokeDensity: 1, smokeChaos: 1, smokeLoudnessResponse: 1, smokeOpacity: 1 }
  },
  { id: 'starchart', label: '点阵星盘', params: {} },
  { id: 'md3', label: 'MD3 动态', params: { md3Tone: 'auto' } }
];

// ==================== 歌词预设 ====================

export const LYRIC_PRESETS: LyricPresetDef[] = [
  { id: 'amll-scroll', label: '滚动歌词', params: {} },
  { id: 'serif-line', label: '衬线单行', params: {} },
  { id: 'giant-two', label: '两行巨字', params: { giantSize: 80 } },
  {
    id: 'brush-single',
    label: '毛笔大字',
    params: {
      smokeFontStretch: 1.18,
      smokeDensity: 1,
      smokeChaos: 1,
      smokeLoudnessResponse: 1,
      smokeOpacity: 1,
      builtinFontId: 'ma-shan-zheng'
    }
  },
  {
    id: 'calligraphy',
    label: '书法逐字',
    params: { keywordSize: 32, newspaperFreq: 500 }
  },
  { id: 'neon-stroke', label: '霓虹描边', params: {} },
  {
    id: 'dissolve',
    label: '溶解大字',
    params: { errorNoise: 0.5, errorJitter: 0.4, errorFlash: 0.6, errorFluidPower: 1, errorDecorMarks: false }
  }
];

// ==================== 高潮效果预设 ====================

export const CLIMAX_PRESETS: ClimaxPresetDef[] = [
  { id: 'none', label: '无', effects: {} },
  { id: 'stage', label: '舞台', effects: { lyricColor: true, staggered: true, wordDrop: true } },
  { id: 'frenzy', label: '狂热', effects: { lyricColor: true, crt: true, wordDrop: true, flash: true } },
  { id: 'eerie', label: '诡谲', effects: { keyword: true, newspaper: true, staggered: true } },
  { id: 'smoke', label: '烟雾', effects: { glow: true, vignette: true } },
  {
    id: 'error',
    label: '错误',
    effects: { invertBurst: true, jitter: true, crt: true, lyricColor: true }
  },
  { id: 'beat-flash', label: '鼓点闪白', effects: { beatFlash: true } },
  { id: 'color-shift', label: '歌词变色', effects: { lyricColor: true } },
  { id: 'starchart', label: '星盘提亮', effects: { chartBoost: true, lyricColor: true } }
];

export function getBackgroundPreset(id: string): BackgroundPresetDef {
  return BACKGROUND_PRESETS.find((item) => item.id === id) || BACKGROUND_PRESETS[0];
}

export function getLyricPreset(id: string): LyricPresetDef {
  return LYRIC_PRESETS.find((item) => item.id === id) || LYRIC_PRESETS[0];
}

export function getClimaxPreset(id: string): ClimaxPresetDef {
  return CLIMAX_PRESETS.find((item) => item.id === id) || CLIMAX_PRESETS[0];
}

export function getClimaxEffects(id: string): ClimaxEffectFlags {
  const base: ClimaxEffectFlags = {
    lyricColor: false,
    crt: false,
    wordDrop: false,
    keyword: false,
    staggered: false,
    beatFlash: false,
    flash: false,
    newspaper: false,
    glow: false,
    vignette: false,
    invertBurst: false,
    jitter: false,
    chartBoost: false
  };
  return { ...base, ...(getClimaxPreset(id).effects || {}) };
}

// ==================== 旧样式迁移映射 ====================

export const LEGACY_STYLE_MIGRATIONS: Record<MobilePlayerStyleKey, LegacyStyleMigration> = {
  default: { mode: 'classic', background: 'theme-solid', lyric: 'amll-scroll', climax: 'none' },
  stage: { mode: 'lyric', background: 'stage-dark', lyric: 'serif-line', climax: 'stage' },
  starChart: { mode: 'lyric', background: 'starchart', lyric: 'serif-line', climax: 'starchart' },
  frenzy: { mode: 'lyric', background: 'glitch', lyric: 'giant-two', climax: 'frenzy' },
  eerie: { mode: 'lyric', background: 'vhs-crack', lyric: 'calligraphy', climax: 'eerie' },
  neon: { mode: 'lyric', background: 'concrete', lyric: 'neon-stroke', climax: 'beat-flash' },
  rain: { mode: 'lyric', background: 'rain', lyric: 'amll-scroll', climax: 'none' },
  smoke: { mode: 'lyric', background: 'smoke', lyric: 'brush-single', climax: 'smoke' },
  error: { mode: 'lyric', background: 'fluid', lyric: 'dissolve', climax: 'error' }
};

export function migrateLegacyPlayerStyle(key: string): LegacyStyleMigration {
  const migration = LEGACY_STYLE_MIGRATIONS[key as MobilePlayerStyleKey];
  if (migration) return migration;
  const mode: PlayerMode = key === 'classic' ? 'classic' : 'lyric';
  return { mode, background: 'theme-solid', lyric: 'amll-scroll', climax: 'none' };
}
