/**
 * 视频分享渲染皮肤类型定义
 *
 * 9 种播放器样式共用同一套逐帧渲染引擎（`utils/videoEngine.ts`），
 * 差异通过「皮肤」注入：配色 / 字体 / 布局骨架 / 装饰层钩子。
 *
 * 皮肤实现的硬约束 —— 逐帧确定性：
 * 同一时间点重复渲染必须产出完全相同的像素，因此皮肤内禁止使用 Math.random()；
 * 需要随机感（雨丝、噪点、星空）的地方一律用 common.ts 的 mulberry32(seed)
 * 以「粒子序号」为种子派生，再按帧时间做解析位移。
 */

import type { MobilePlayerStyleKey } from '@/types/playerStyle';

/** 布局骨架：9 种样式归入 4 类，由引擎统一排版，皮肤只调参 */
export type VideoLayoutVariant =
  /** 封面 + 歌名 + 逐行歌词（default / stage / smoke / starChart / neon） */
  | 'stack'
  /** 全屏模糊封面 + 居中大字（rain / eerie） */
  | 'immersive'
  /** 亮底 + 超大拉伸字（frenzy） */
  | 'poster'
  /** 暗底等宽终端（error） */
  | 'terminal';

/** 矩形区域 */
export interface LayoutBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 逐字数据（时间已换算为相对歌曲的秒） */
export interface VideoWord {
  text: string;
  startSec: number;
  endSec: number;
}

/** 单行歌词（时间已换算为秒） */
export interface VideoLyricLine {
  text: string;
  trText: string;
  /** 行开始时间（秒） */
  startSec: number;
  /** 行结束时间（秒） */
  endSec: number;
  /** 逐字数据；为空表示该行无逐字时间轴 */
  words: VideoWord[];
}

/** 单帧消费的歌曲信息 */
export interface VideoFrameSong {
  title: string;
  artist: string;
  /** 封面图；加载失败为 null */
  cover: HTMLImageElement | null;
  /** 封面主色；用于 accent 跟随封面 */
  dominant: { r: number; g: number; b: number } | null;
}

/** 单帧消费的歌词状态 */
export interface VideoFrameLyric {
  /** 当前行索引；-1 表示前奏（尚未进入第一句） */
  index: number;
  current: VideoLyricLine | null;
  prev: VideoLyricLine | null;
  next: VideoLyricLine | null;
  /** 当前行进度 0~1 */
  lineProgress: number;
  /** 当前行已唱字符数（浮点，供逐字高亮插值） */
  sungChars: number;
}

/**
 * 单帧渲染上下文：引擎每帧构造一次，交给皮肤消费。
 * 皮肤可读不可改（除 ctx 绘制状态外）。
 */
export interface VideoFrameContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  /** 视频内相对时间（秒，从 0 开始） */
  timeSec: number;
  /** 整体导出进度 0~1 */
  progress: number;
  /** 导出片段总时长（秒） */
  totalSec: number;
  /** 当前帧对应的歌曲绝对时间（秒） */
  songTimeSec: number;
  /** 该时刻音频响度 0~1（离线从 AudioBuffer 采样，用于节拍响应） */
  level: number;
  /** 该时刻是否落在强拍上（离线检测，用于脉冲动效） */
  beat: boolean;
  song: VideoFrameSong;
  lyric: VideoFrameLyric;
  skin: VideoSkin;
  /** 解析后的实际强调色（followCoverAccent 为真时取封面主色） */
  accent: string;
  /** 是否叠加水印/二维码 */
  watermark: boolean;
  /** 预生成的二维码图；watermark 开启且生成成功时非 null */
  qrImage: HTMLImageElement | null;
}

/**
 * 样式皮肤：描述一种播放器样式在视频里的视觉呈现。
 * 引擎保证每帧调用顺序为
 * drawBackground → drawAtmosphere → [封面/文字/歌词] → drawForeground。
 */
export interface VideoSkin {
  key: MobilePlayerStyleKey;
  /** 中文标签（与播放器一致） */
  label: string;
  /** 明暗主题 */
  theme: 'light' | 'dark';
  /** 布局骨架 */
  layout: VideoLayoutVariant;
  /** 字体族（CSS font-family 字符串） */
  fontFamily: string;
  /** 背景主色，也作为骨架默认填充 */
  background: string;
  /** 主强调色（进度条、装饰）；followCoverAccent 为真时会被引擎替换为封面主色 */
  accent: string;
  /** 强调色是否跟随封面主色（封面缺失时退回 accent） */
  followCoverAccent?: boolean;
  /** 未唱文字色 */
  textPrimary: string;
  /** 次要文字色（作者、下一行） */
  textSecondary: string;
  /** 已唱高亮色（逐字） */
  textActive: string;
  /** 是否绘制封面（immersive 骨架恒为全屏背景，忽略此值） */
  showCover: boolean;
  /** 自定义背景绘制，覆盖骨架默认背景 */
  drawBackground?: (c: VideoFrameContext) => void;
  /** 背景之上的氛围层（雨丝/烟雾/星空等确定性粒子） */
  drawAtmosphere?: (c: VideoFrameContext) => void;
  /** 歌词文字之下的衬底绘制（如玻璃卡、终端框） */
  drawLyricBackdrop?: (c: VideoFrameContext, box: LayoutBox) => void;
  /** 前景覆盖层（扫描线/噪点/暗角/故障） */
  drawForeground?: (c: VideoFrameContext) => void;
}
