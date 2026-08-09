/**
 * 分享功能类型定义
 */

/** 海报布局类型 */
export type PosterLayout = 'torn-paper' | 'immersive' | 'performance-archive' | 'seal-tour';

export const POSTER_LAYOUT_OPTIONS: ReadonlyArray<{
  key: PosterLayout;
  label: string;
  icon: string;
}> = [
  { key: 'torn-paper', label: '撕纸文艺', icon: 'ri-quill-pen-line' },
  { key: 'immersive', label: '沉浸全屏', icon: 'ri-image-line' },
  { key: 'performance-archive', label: '演出档案', icon: 'ri-mic-line' },
  { key: 'seal-tour', label: '印章巡演', icon: 'ri-stamp-line' }
];

export type PosterImageFilter = 'monochrome' | 'low-saturation' | 'high-contrast';
export type PosterTitleOrientation = 'horizontal' | 'vertical' | 'staggered';

/** 歌词对齐方式 */
export type LyricAlign = 'staggered' | 'center' | 'left' | 'right';

/** 封面/标题位置 */
export type CoverPosition = 'left' | 'right';

/** 背景模式 */
export type PosterBackgroundMode = 'cover' | 'solid' | 'gradient';

/** 歌手名位置 */
export type ArtistPosition = 'right' | 'center';

/** 水印类型 */
export type WatermarkType = 'logo' | 'text';

/** 海报配置 */
export interface PosterConfig {
  /** 布局类型 */
  layout: PosterLayout;
  /** 选中字体 ID */
  fontId: string;
  /** 字体粗细 (100-900) */
  fontWeight: number;
  /** 封面位置 (仅撕纸布局) */
  coverPosition: CoverPosition;
  /** 歌词对齐方式 */
  lyricAlign: LyricAlign;
  /** 歌词颜色模式 */
  lyricColorMode: 'cover' | 'custom';
  /** 自定义歌词颜色 */
  customLyricColor: string;
  /** 背景模式 (仅撕纸布局) */
  backgroundMode: PosterBackgroundMode;
  /** 纯色背景颜色 */
  solidBgColor: string;
  /** 渐变背景颜色 */
  gradientBgColors: string[];
  /** 背景模糊度 (仅沉浸布局, 0-30) */
  blurAmount: number;
  /** 遮罩透明度 (仅沉浸布局, 0-80%) */
  overlayOpacity: number;
  /** 文字颜色 (仅沉浸布局) */
  textColor: string;
  /** 歌手名位置 (仅沉浸布局) */
  artistPosition: ArtistPosition;
  /** 是否显示二维码 */
  showQRCode: boolean;
  /** 水印类型：logo 图标 / 软件名文字 */
  watermarkType: WatermarkType;
  /** 水印透明度 (0-100%) */
  watermarkOpacity: number;
  /** 新演出海报的强调色 */
  accentColor: string;
  /** 新演出海报的图像处理 */
  imageFilter: PosterImageFilter;
  /** 标题排版方向 */
  titleOrientation: PosterTitleOrientation;
  /** 演出日期文案 */
  eventDate: string;
  /** 演出地点文案 */
  eventVenue: string;
  /** 演出附加信息 */
  eventLabel: string;
}

/** 海报默认配置 */
export const DEFAULT_POSTER_CONFIG: PosterConfig = {
  layout: 'torn-paper',
  fontId: 'hengshan-maoxing',
  fontWeight: 600,
  coverPosition: 'left',
  lyricAlign: 'staggered',
  lyricColorMode: 'cover',
  customLyricColor: '#ffffff',
  backgroundMode: 'cover',
  solidBgColor: '#1a1a1a',
  gradientBgColors: ['#2a1a3a', '#0a0a0f'],
  blurAmount: 20,
  overlayOpacity: 50,
  textColor: '#ffffff',
  artistPosition: 'right',
  showQRCode: true,
  watermarkType: 'text',
  watermarkOpacity: 30,
  accentColor: '#d20a12',
  imageFilter: 'monochrome',
  titleOrientation: 'staggered',
  eventDate: '',
  eventVenue: '',
  eventLabel: 'LIVE ARCHIVE'
};

export function normalizePosterConfig(config: Partial<PosterConfig>): PosterConfig {
  const layout = POSTER_LAYOUT_OPTIONS.some((option) => option.key === config.layout)
    ? config.layout!
    : DEFAULT_POSTER_CONFIG.layout;
  const fontWeight =
    Math.round(
      Math.min(900, Math.max(100, Number(config.fontWeight) || DEFAULT_POSTER_CONFIG.fontWeight)) /
        50
    ) * 50;
  return {
    ...DEFAULT_POSTER_CONFIG,
    ...config,
    layout,
    fontWeight,
    gradientBgColors: config.gradientBgColors?.length
      ? [...config.gradientBgColors]
      : [...DEFAULT_POSTER_CONFIG.gradientBgColors]
  };
}

/** 字体定义 */
export interface FontDef {
  id: string;
  /** 文件名 */
  file: string;
  /** 字体名 */
  name: string;
  /** 适用场景 */
  usage: string;
  /** FontFace family 名称 (加载后使用) */
  family: string;
  /** 字体格式 */
  format: 'truetype' | 'opentype' | 'woff2';
  /** 可变字体支持的字重范围 */
  weight?: string;
  /** 上游项目页面 */
  sourceUrl?: string;
  /** 随应用分发的许可证 */
  license?: string;
  licenseFile?: string;
}

/** 内置字体库（免费可商用） */
export const BUILTIN_FONTS: FontDef[] = [
  {
    id: 'noto-serif-sc',
    file: 'NotoSerifSC-VF.ttf',
    name: '思源宋体 / Noto Serif SC',
    usage: '粗宋体 · 标题/歌词',
    family: 'ZephyrusNotoSerifSC',
    format: 'truetype',
    weight: '200 900',
    sourceUrl: 'https://github.com/google/fonts/tree/main/ofl/notoserifsc',
    license: 'SIL Open Font License 1.1',
    licenseFile: 'NotoSerifSC-OFL.txt'
  },
  {
    id: 'ma-shan-zheng',
    file: 'MaShanZheng-Regular.ttf',
    name: '马善政毛笔楷书',
    usage: '书法 · 标题/歌词',
    family: 'ZephyrusMaShanZheng',
    format: 'truetype',
    sourceUrl: 'https://github.com/google/fonts/tree/main/ofl/mashanzheng',
    license: 'SIL Open Font License 1.1',
    licenseFile: 'MaShanZheng-OFL.txt'
  },
  {
    id: 'liu-jian-mao-cao',
    file: 'LiuJianMaoCao-Regular.ttf',
    name: '钟齐流江毛笔草体',
    usage: '毛体 · 标题/歌词',
    family: 'ZephyrusLiuJianMaoCao',
    format: 'truetype',
    sourceUrl: 'https://github.com/google/fonts/tree/main/ofl/liujianmaocao',
    license: 'SIL Open Font License 1.1',
    licenseFile: 'LiuJianMaoCao-OFL.txt'
  },
  {
    id: 'smiley-sans',
    file: 'SmileySans-Oblique.woff2',
    name: '得意黑',
    usage: '现代黑体 · 标题/歌词',
    family: 'ZephyrusSmileySans',
    format: 'woff2',
    sourceUrl: 'https://github.com/atelier-anchor/smiley-sans',
    license: 'SIL Open Font License 1.1',
    licenseFile: 'SmileySans-OFL.txt'
  },
  {
    id: 'pingfang-laijianghu',
    file: 'PingFangLaiJiangHuFeiYangTi-2.ttf',
    name: '平方赖江湖飞扬体',
    usage: '标题/歌词',
    family: 'PingFangLaiJiangHu',
    format: 'truetype'
  },
  {
    id: 'tangxianbin-song',
    file: 'TangXianBinSong-2.otf',
    name: '唐献斌宋',
    usage: '标题/歌手',
    family: 'TangXianBinSong',
    format: 'opentype'
  },
  {
    id: 'cktbmzl',
    file: 'CKTBMZL-2.ttf',
    name: '仓耳周珂正大榜书',
    usage: '标题',
    family: 'CKTBMZL',
    format: 'truetype'
  },
  {
    id: 'hengshan-maoxing',
    file: 'HengShanMaoXing-1.ttf',
    name: '衡山毛笔行',
    usage: '标题/歌词/歌手',
    family: 'HengShanMaoXing',
    format: 'truetype'
  },
  {
    id: 'sanji-xingkai',
    file: 'SanJiXingKaiJianTi-Cu-2.ttf',
    name: '三极行楷简体-粗',
    usage: '歌词/歌手',
    family: 'SanJiXingKai',
    format: 'truetype'
  },
  {
    id: 'yuneki-kaishu',
    file: 'YuNEKIKaiShuJiWuLiaoBanv6-2.ttf',
    name: '玉ねぎ楷書',
    usage: '标题/歌词',
    family: 'YuNEKIKaiShu',
    format: 'truetype'
  },
  {
    id: 'honglei-xingshu',
    file: 'HongLeiXingShuJianTi-2.otf',
    name: '鸿雷行书简体',
    usage: '歌词/歌手',
    family: 'HongLeiXingShu',
    format: 'opentype'
  }
];

/** 选中的歌词行 */
export interface SelectedLyric {
  index: number;
  text: string;
  trText?: string;
}

/** 海报生成所需的歌曲信息 */
export interface PosterSongInfo {
  songId: string | number;
  songName: string;
  artists: string;
  coverUrl: string;
}

/** 分享功能全局配置 */
export interface ShareConfig {
  /** 截图自动添加二维码开关 */
  screenshotQRCode: boolean;
  /** 海报默认布局 */
  defaultPosterLayout: PosterLayout;
  /** 默认字体 */
  defaultFontId: string;
}

/** 分享功能默认配置 */
export const DEFAULT_SHARE_CONFIG: ShareConfig = {
  screenshotQRCode: false,
  defaultPosterLayout: 'torn-paper',
  defaultFontId: 'hengshan-maoxing'
};
