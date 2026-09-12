/**
 * 服务端渲染层入口
 *
 * 把视频皮肤的渲染层（9 皮肤 + 骨架排版 + 歌词时间轴）聚合导出，
 * 由 scripts/build-server-renderer.mjs 用 esbuild 打包为 server/render/renderer.cjs，
 * 供 server-video-render.js 在 Node + @napi-rs/canvas 环境逐帧渲染。
 *
 * 约束：这里只允许聚合纯 Canvas 2D 逻辑，不得引入 Vue / 浏览器 DOM 依赖。
 */

// 皮肤注册表与类型
export { getSkin, getAllSkins } from './skins';
export type {
  VideoSkin,
  VideoFrameContext,
  VideoFrameLyric,
  VideoLyricLine,
  VideoWord,
  LayoutBox
} from './types';

// 骨架排版与共享绘制原语
export { renderFrameLayout } from './layout';
export { resolveAccent } from './common';

// 歌词时间轴（毫秒 → 秒 + 逐字状态）
export { buildTimeline, resolveLyricState, computeSungChars } from '../videoLyricTimeline';
export type { ILyricText } from '@/types/music';

// 尺寸与时间常量
export {
  resolveVideoSize,
  VIDEO_EXPORT_FPS,
  formatSegmentTime,
  type VideoShareConfig,
  type VideoExportProgress
} from '@/types/shareVideo';
