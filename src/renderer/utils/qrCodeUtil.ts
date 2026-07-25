/**
 * 二维码生成工具
 * 基于 qrcode 库，生成歌曲深链二维码
 */

import QRCode from 'qrcode';

/**
 * 中继网页基础 URL
 * 微信扫码后先跳转到此页面，页面写入剪贴板后再跳转 zephyrus:// deep link
 */
const RELAY_PAGE_URL = 'https://www.mucang.xyz/zephyrus/relay.html';

/**
 * 生成歌曲分享 URL（指向中继网页）
 * 二维码内容为此 URL，扫码后通过中继页面引导跳转到 App
 * @param songId 歌曲 ID
 * @returns 中继网页 URL，如 https://www.mucang.xyz/zephyrus/relay.html?song=123456
 */
export function buildSongDeepLink(songId: string | number): string {
  return `${RELAY_PAGE_URL}?song=${songId}`;
}

/**
 * 生成原生 deep link URL（供中继页面跳转使用）
 * @param songId 歌曲 ID
 * @returns 深链 URL，如 zephyrus://song/123456
 */
export function buildNativeDeepLink(songId: string | number): string {
  return `zephyrus://song/${songId}`;
}

/**
 * 生成二维码并渲染到 Canvas
 * @param canvas 目标 Canvas
 * @param data 二维码内容
 * @param size 二维码尺寸 (像素)
 */
export async function drawQRCodeToCanvas(
  canvas: HTMLCanvasElement,
  data: string,
  size: number = 140
): Promise<void> {
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法获取 Canvas 2D 上下文');

  // 先用 qrcode 库生成到临时 canvas
  const tempCanvas = document.createElement('canvas');
  await QRCode.toCanvas(tempCanvas, data, {
    width: size,
    margin: 1,
    color: {
      dark: '#000000',
      light: '#ffffff'
    },
    errorCorrectionLevel: 'M'
  });

  // 将临时 canvas 内容复制到目标 canvas
  ctx.drawImage(tempCanvas, 0, 0, size, size);
}

/**
 * 生成二维码 Data URL (base64)
 * @param data 二维码内容
 * @param size 二维码尺寸
 * @returns PNG 格式的 Data URL
 */
export async function generateQRCodeDataURL(data: string, size: number = 140): Promise<string> {
  return QRCode.toDataURL(data, {
    width: size,
    margin: 1,
    color: {
      dark: '#000000',
      light: '#ffffff'
    },
    errorCorrectionLevel: 'M'
  });
}

/**
 * 生成二维码 Image 对象 (用于 Canvas 绘制)
 * @param data 二维码内容
 * @param size 二维码尺寸
 * @returns 加载完成的 Image 对象
 */
export async function generateQRCodeImage(
  data: string,
  size: number = 140
): Promise<HTMLImageElement> {
  const dataUrl = await generateQRCodeDataURL(data, size);
  return loadImage(dataUrl);
}

/**
 * 加载图片 (Promise 封装)
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`图片加载失败: ${src}`));
    img.src = src;
  });
}
