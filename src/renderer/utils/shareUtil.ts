/**
 * 相册保存与分享工具
 * 支持 Capacitor 原生保存/分享，以及 Web 环境的下载降级
 */

import { canvasToBlob } from '@/utils/posterEngine';

/**
 * 检测是否在 Capacitor 原生环境中
 */
function isNative(): boolean {
  return typeof window !== 'undefined' && !!(window as any).AndroidNative;
}

/**
 * 将 Canvas 保存到系统相册
 * - Android 原生：通过 Filesystem 写入 MediaStore
 * - Web：触发下载
 */
export async function saveCanvasToGallery(canvas: HTMLCanvasElement): Promise<boolean> {
  try {
    const blob = await canvasToBlob(canvas);

    if (isNative()) {
      // 尝试使用 Capacitor Filesystem + Gallery
      try {
        const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
        const base64 = canvas.toDataURL('image/png').split(',')[1];
        const fileName = `zephyrus_poster_${Date.now()}.png`;

        // 先尝试保存到外部存储
        try {
          await Filesystem.writeFile({
            path: fileName,
            data: base64,
            directory: Directory.ExternalStorage
          });
        } catch {
          // 降级到文档目录
          await Filesystem.writeFile({
            path: fileName,
            data: base64,
            directory: Directory.Documents
          });
        }

        // 通过原生桥接通知 MediaStore 扫描新文件
        if ((window as any).AndroidNative?.scanMediaFile) {
          (window as any).AndroidNative.scanMediaFile(fileName);
        }

        return true;
      } catch (e) {
        console.warn('[ShareUtil] Capacitor 保存失败，降级到下载:', e);
        return downloadBlob(blob);
      }
    } else {
      // Web 环境：直接下载
      return downloadBlob(blob);
    }
  } catch (e) {
    console.error('[ShareUtil] 保存到相册失败:', e);
    return false;
  }
}

/**
 * 通过系统分享面板分享 Canvas 图片
 */
export async function shareCanvasImage(canvas: HTMLCanvasElement): Promise<boolean> {
  try {
    if (isNative()) {
      // 使用 Capacitor Share 插件
      try {
        const { Share } = await import('@capacitor/share');
        const base64 = canvas.toDataURL('image/png').split(',')[1];
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const fileName = `zephyrus_poster_${Date.now()}.png`;

        // 先写入临时文件
        const fileResult = await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Cache
        });

        // 分享文件
        await Share.share({
          title: 'Zephyrus Player',
          text: '分享歌词海报',
          url: fileResult.uri
        });

        return true;
      } catch (e) {
        console.warn('[ShareUtil] Capacitor 分享失败，降级到下载:', e);
        const blob = await canvasToBlob(canvas);
        return downloadBlob(blob);
      }
    } else {
      // Web 环境：使用 Web Share API 或下载
      const blob = await canvasToBlob(canvas);
      const file = new File([blob], `zephyrus_poster_${Date.now()}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Zephyrus Player',
          text: '分享歌词海报',
          files: [file]
        });
        return true;
      } else {
        return downloadBlob(blob);
      }
    }
  } catch (e) {
    console.error('[ShareUtil] 分享失败:', e);
    return false;
  }
}

/**
 * 下载 Blob 为文件（Web 降级方案）
 */
function downloadBlob(blob: Blob): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zephyrus_poster_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (e) {
    console.error('[ShareUtil] 下载失败:', e);
    return false;
  }
}
