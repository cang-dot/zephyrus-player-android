/**
 * Deep link / 剪贴板分享处理工具
 * 解析 zephyrus://song/{id} 格式的链接，弹出歌曲卡片供用户手动播放
 *
 * 统一入口：无论是 Intent deep link 还是剪贴板检测，都走卡片流程
 */

import { getMusicDetail } from '@/api/music';
import type { SongResult } from '@/types/music';

// 防止重复处理同一个 URL（卡片显示期间）
let lastHandledUrl = '';

// SharedSongCard 组件引用
let sharedSongCardRef: { showSongCard: (songId: number) => void } | null = null;

// 待处理的 URL 队列：如果组件尚未就绪，先缓存，就绪后重放
let pendingUrl: string | null = null;

/**
 * 解析 deep link URL，提取歌曲 ID
 */
function parseDeepLink(url: string): number | null {
  try {
    const match = url.match(/^zephyrus:\/\/song\/(\d+)$/);
    if (match) {
      return Number(match[1]);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 统一处理函数：解析 URL 并弹出歌曲卡片
 * 无论来源是 Intent deep link 还是剪贴板，都走同一条路径
 */
async function processShareUrl(url: string): Promise<void> {
  console.info('[ShareLink] 收到分享链接:', url);

  // 防止重复处理（卡片正在显示同一首歌时跳过）
  if (url === lastHandledUrl) {
    console.info('[ShareLink] 与上次相同，跳过');
    return;
  }
  lastHandledUrl = url;

  const songId = parseDeepLink(url);
  if (songId === null) {
    console.warn('[ShareLink] 无法解析 URL:', url);
    return;
  }

  console.info('[ShareLink] 解析到歌曲 ID:', songId);

  if (sharedSongCardRef) {
    sharedSongCardRef.showSongCard(songId);
  } else {
    // 组件尚未就绪（冷启动时 JS 刚加载），缓存 URL，组件注册后重放
    console.warn('[ShareLink] SharedSongCard 尚未就绪，缓存 URL 待重放');
    pendingUrl = url;
  }
}

/**
 * 兜底：直接播放（仅在卡片组件完全不可用时使用）
 */
async function playSongById(songId: number): Promise<void> {
  const { usePlayerStore } = await import('@/store/modules/player');
  const playerStore = usePlayerStore();

  const res = await getMusicDetail([songId]);
  const song = res?.data?.songs?.[0] as SongResult | undefined;
  if (!song) {
    console.warn('[ShareLink] 未找到歌曲, id:', songId);
    return;
  }

  // 确保 picUrl 在顶层（播放器 UI 依赖）
  const playableSong = {
    ...song,
    picUrl: song.al?.picUrl || song.album?.picUrl || song.picUrl || ''
  };

  playerStore.setPlayList([playableSong], false);
  playerStore.setPlay(playableSong);
  playerStore.setMusicFull(true);
}

/**
 * 处理 deep link（Intent 跳转）
 * 注册到 window.__handleDeepLink，行为与剪贴板一致：弹卡片
 */
export async function handleDeepLink(url: string): Promise<void> {
  await processShareUrl(url);
}

/**
 * 处理剪贴板分享链接
 * 注册到 window.__handleClipboardShare
 */
export async function handleClipboardShare(url: string): Promise<void> {
  await processShareUrl(url);
}

/**
 * 重置去重标记（卡片关闭后调用，允许同一链接再次处理）
 */
export function resetLastHandledUrl(): void {
  lastHandledUrl = '';
}

/**
 * 注册 SharedSongCard 组件引用
 * 注册后如果有待处理的 URL，立即重放
 */
export function setSharedSongCardRef(ref: { showSongCard: (songId: number) => void } | null): void {
  sharedSongCardRef = ref;

  // 组件就绪后，重放缓存的 URL
  if (ref && pendingUrl) {
    const url = pendingUrl;
    pendingUrl = null;
    console.info('[ShareLink] 组件就绪，重放缓存的 URL:', url);
    // 重放时清除 lastHandledUrl，确保能正常处理
    lastHandledUrl = '';
    processShareUrl(url).catch(console.error);
  }
}

/**
 * 注册处理器到 window
 * 在应用启动时调用，原生 MainActivity 通过 evaluateJavascript 调用
 */
export function setupDeepLinkHandler(): void {
  (window as any).__handleDeepLink = (url: string) => {
    handleDeepLink(url).catch(console.error);
  };
  (window as any).__handleClipboardShare = (url: string) => {
    handleClipboardShare(url).catch(console.error);
  };
  console.info('[ShareLink] 处理器已注册 (intent + clipboard 统一弹卡片)');
}
