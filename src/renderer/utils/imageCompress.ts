/**
 * 图片压缩：位图缩放到最长边上限后转 JPEG。
 * 供元数据封面、主页自定义背景等"用户选图落盘"场景共用，
 * 控制进 localStorage/元数据的体积。
 */
export async function compressImage(
  source: Blob,
  maxEdge = 1000,
  quality = 0.88
): Promise<{ base64: string; dataUrl: string; mime: string }> {
  let drawable: CanvasImageSource;
  let width: number;
  let height: number;
  let cleanup: (() => void) | null = null;
  try {
    const bitmap = await createImageBitmap(source);
    drawable = bitmap;
    width = bitmap.width;
    height = bitmap.height;
  } catch {
    // createImageBitmap 解不了的格式（iOS 相册"原始格式"HEIC 等）走 <img> 原生解码兜底：
    // iOS 的 <img> 能原生解码 HEIC，drawImage 可用；桌面 Chromium 不支持 HEIC 时仍会抛错
    const url = URL.createObjectURL(source);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('image decode failed'));
        img.src = url;
      });
      drawable = image;
      width = image.naturalWidth;
      height = image.naturalHeight;
      cleanup = () => URL.revokeObjectURL(url);
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
  }
  try {
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    canvas.getContext('2d')!.drawImage(drawable, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    return { base64: dataUrl.slice(dataUrl.indexOf(',') + 1), dataUrl, mime: 'image/jpeg' };
  } finally {
    cleanup?.();
  }
}
