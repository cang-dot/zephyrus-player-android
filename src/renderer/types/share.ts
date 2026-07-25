/**
 * 分享功能类型定义
 */

/** 海报布局类型 */
export type PosterLayout = 'torn-paper' | 'immersive';

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
}

/** 海报默认配置 */
export const DEFAULT_POSTER_CONFIG: PosterConfig = {
  layout: 'torn-paper',
  fontId: 'hengshan-maoxing',
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
  watermarkOpacity: 30
};

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
  format: 'truetype' | 'opentype';
}

/** 内置字体库 (7款免费可商用) */
export const BUILTIN_FONTS: FontDef[] = [
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
