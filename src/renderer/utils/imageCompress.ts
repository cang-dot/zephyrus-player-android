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
  const bitmap = await createImageBitmap(source);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return { base64: dataUrl.slice(dataUrl.indexOf(',') + 1), dataUrl, mime: 'image/jpeg' };
}
