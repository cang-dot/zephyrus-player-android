/**
 * 封面取色 composable
 *
 * 从当前播放歌曲的封面提取主色，动态更新 CSS 变量
 * 替换全局的默认灰色主色
 */
import { ref, watch } from 'vue';

import { playMusic } from '@/hooks/MusicHook';
import { getImgUrl } from '@/utils';

import tinycolor from 'tinycolor2';

// 当前提取的颜色
const primaryColor = ref('#888888');
const primaryColorRgb = ref('136, 136, 136');
// 封面原始平均色（不做暖色调整）
const averageColor = ref('#888888');
const averageColorRgb = ref('136, 136, 136');

// 默认灰色的 RGB
const DEFAULT_R = 136;
const DEFAULT_G = 136;
const DEFAULT_B = 136;

/**
 * 从图片提取主色（基于 canvas 像素采样）
 */
async function extractColorFromImage(picUrl: string): Promise<{ r: number; g: number; b: number } | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = getImgUrl(picUrl, '50y50');
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const canvas = document.createElement('canvas');
    canvas.width = 10;
    canvas.height = 10;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0, 10, 10);
    const data = ctx.getImageData(0, 0, 10, 10).data;

    let r = 0, g = 0, b = 0;
    const pixelCount = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }

    return {
      r: Math.round(r / pixelCount),
      g: Math.round(g / pixelCount),
      b: Math.round(b / pixelCount)
    };
  } catch {
    return null;
  }
}

/**
 * 将 RGB 颜色调整为适合 UI 的强调色
 * 偏暖、提高饱和度和亮度
 */
function adjustForAccent(r: number, g: number, b: number): { r: number; g: number; b: number } {
  // 计算亮度
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  // 如果太暗，提亮
  let ar = r;
  let ag = g;
  let ab = b;

  if (brightness < 100) {
    const factor = 150 / Math.max(brightness, 1);
    ar = Math.min(255, Math.round(r * factor));
    ag = Math.min(255, Math.round(g * factor));
    ab = Math.min(255, Math.round(b * factor));
  }

  // 如果太亮（接近白色），降低亮度
  if (brightness > 220) {
    ar = Math.round(ar * 0.7);
    ag = Math.round(ag * 0.7);
    ab = Math.round(ab * 0.7);
  }

  // 偏暖：增加红色和绿色，减少蓝色
  ar = Math.min(255, ar + 15);
  ag = Math.min(255, ag + 10);
  ab = Math.max(0, ab - 20);

  // 确保最低亮度（避免太暗）
  const minBrightness = 80;
  const newBrightness = (ar * 299 + ag * 587 + ab * 114) / 1000;
  if (newBrightness < minBrightness) {
    const factor = minBrightness / Math.max(newBrightness, 1);
    ar = Math.min(255, Math.round(ar * factor));
    ag = Math.min(255, Math.round(ag * factor));
    ab = Math.min(255, Math.round(ab * factor));
  }

  return { r: ar, g: ag, b: ab };
}

/**
 * 更新 CSS 变量：生成完整的设计令牌体系
 *
 * 基于封面取色，根据当前主题（浅色/深色）混合生成：
 * - 背景色 (--cover-bg)
 * - 表面色 (--cover-surface)
 * - 边框色 (--cover-border)
 * - 文字色 (--cover-text-primary / --cover-text-secondary / --cover-text-muted)
 * - 强调色变体
 */
function updateCSSVariables(r: number, g: number, b: number) {
  const color = `rgb(${r}, ${g}, ${b})`;
  const colorRgb = `${r}, ${g}, ${b}`;

  const root = document.documentElement;

  // === 强调色（原有） ===
  root.style.setProperty('--accent-color', color);
  root.style.setProperty('--accent-color-rgb', colorRgb);

  // 生成变体颜色
  const lighter = `${Math.min(255, r + 20)}, ${Math.min(255, g + 20)}, ${Math.min(255, b + 20)}`;
  const darker = `${Math.max(0, r - 20)}, ${Math.max(0, g - 20)}, ${Math.max(0, b - 20)}`;

  root.style.setProperty('--accent-color-light', `rgb(${lighter})`);
  root.style.setProperty('--accent-color-dark', `rgb(${darker})`);
  root.style.setProperty('--accent-color-10', `rgba(${colorRgb}, 0.1)`);
  root.style.setProperty('--accent-color-20', `rgba(${colorRgb}, 0.2)`);

  // === 封面取色设计令牌 ===
  const coverTiny = tinycolor({ r, g, b });
  const isDarkTheme = root.getAttribute('data-theme') === 'dark';

  if (isDarkTheme) {
    // 深色模式：封面色与深色背景混合
    // 背景色：95% 深色 + 5% 封面色
    const bgColor = tinycolor.mix(tinycolor('#1a1a1a'), coverTiny, 5);
    root.style.setProperty('--cover-bg', bgColor.toHexString());
    root.style.setProperty('--cover-bg-rgb', bgColor.toRgbString());

    // 表面色（卡片/播放栏）：90% 深色 + 10% 封面色
    const surfaceColor = tinycolor.mix(tinycolor('#242424'), coverTiny, 12);
    root.style.setProperty('--cover-surface', surfaceColor.toHexString());

    // 悬浮表面：85% 深色 + 15% 封面色
    const surfaceHover = tinycolor.mix(tinycolor('#2a2a2a'), coverTiny, 18);
    root.style.setProperty('--cover-surface-hover', surfaceHover.toHexString());

    // 边框色：80% 深色 + 20% 封面色，低透明度
    const borderColor = tinycolor.mix(tinycolor('#333333'), coverTiny, 20).setAlpha(0.3);
    root.style.setProperty('--cover-border', borderColor.toRgbString());

    // 文字色
    root.style.setProperty('--cover-text-primary', 'rgba(255, 255, 255, 0.92)');
    root.style.setProperty('--cover-text-secondary', 'rgba(255, 255, 255, 0.6)');
    root.style.setProperty('--cover-text-muted', 'rgba(255, 255, 255, 0.38)');
  } else {
    // 浅色模式：封面色与白色混合
    // 背景色：96% 白色 + 4% 封面色
    const bgColor = tinycolor.mix(tinycolor('#ffffff'), coverTiny, 4);
    root.style.setProperty('--cover-bg', bgColor.toHexString());
    root.style.setProperty('--cover-bg-rgb', bgColor.toRgbString());

    // 表面色（卡片/播放栏）：92% 白色 + 8% 封面色
    const surfaceColor = tinycolor.mix(tinycolor('#ffffff'), coverTiny, 8);
    root.style.setProperty('--cover-surface', surfaceColor.toHexString());

    // 悬浮表面：88% 白色 + 12% 封面色
    const surfaceHover = tinycolor.mix(tinycolor('#ffffff'), coverTiny, 12);
    root.style.setProperty('--cover-surface-hover', surfaceHover.toHexString());

    // 边框色：80% 白色 + 20% 封面色，低透明度
    const borderColor = tinycolor.mix(tinycolor('#ffffff'), coverTiny, 20).setAlpha(0.3);
    root.style.setProperty('--cover-border', borderColor.toRgbString());

    // 文字色
    root.style.setProperty('--cover-text-primary', 'rgba(0, 0, 0, 0.88)');
    root.style.setProperty('--cover-text-secondary', 'rgba(0, 0, 0, 0.56)');
    root.style.setProperty('--cover-text-muted', 'rgba(0, 0, 0, 0.38)');
  }

  // === 封面渐变背景（用于播放器等全屏场景） ===
  // 封面色 → 背景色的渐变
  const gradientStart = coverTiny.toHexString();
  const gradientEnd = isDarkTheme ? '#0d0d0d' : '#f8f6f3';
  root.style.setProperty('--cover-gradient-start', gradientStart);
  root.style.setProperty('--cover-gradient-end', gradientEnd);
}

/**
 * 当主题切换时重新生成设计令牌（不重新提取封面色）
 */
export function refreshCoverTokens() {
  const rgb = primaryColorRgb.value.split(',').map((s) => parseInt(s.trim(), 10));
  if (rgb.length === 3) {
    updateCSSVariables(rgb[0], rgb[1], rgb[2]);
  }
}

/**
 * 重置为默认绿色
 */
function resetToDefault() {
  primaryColor.value = '#888888';
  primaryColorRgb.value = `${DEFAULT_R}, ${DEFAULT_G}, ${DEFAULT_B}`;
  averageColor.value = '#888888';
  averageColorRgb.value = `${DEFAULT_R}, ${DEFAULT_G}, ${DEFAULT_B}`;
  updateCSSVariables(DEFAULT_R, DEFAULT_G, DEFAULT_B);
}

/**
 * 初始化封面取色监听
 */
export function initCoverColor() {
  watch(
    () => playMusic.value?.picUrl,
    async (picUrl) => {
      if (!picUrl) {
        resetToDefault();
        return;
      }

      const color = await extractColorFromImage(picUrl);
      if (color) {
        // 封面原始平均色（不做调整）
        averageColor.value = `rgb(${color.r}, ${color.g}, ${color.b})`;
        averageColorRgb.value = `${color.r}, ${color.g}, ${color.b}`;

        const accent = adjustForAccent(color.r, color.g, color.b);
        primaryColor.value = `rgb(${accent.r}, ${accent.g}, ${accent.b})`;
        primaryColorRgb.value = `${accent.r}, ${accent.g}, ${accent.b}`;
        updateCSSVariables(accent.r, accent.g, accent.b);

        // 发送颜色到桌面歌词窗口
        if (window.api?.sendCoverColor) {
          window.api.sendCoverColor(primaryColor.value);
        }
      }
    },
    { immediate: true }
  );
}

/**
 * 获取当前主色（响应式）
 */
export function useCoverColor() {
  return {
    primaryColor,
    primaryColorRgb,
    averageColor,
    averageColorRgb
  };
}

/**
 * 从封面图片的不同随机区域提取多个平均色
 *
 * 用于 Magazine 移动端模式的色块：每个色块从封面不同位置取色，
 * 产生差异化视觉效果。
 *
 * @param picUrl 封面图片 URL
 * @param count 需要提取的颜色数量
 * @returns CSS 颜色字符串数组，如 ['rgb(100,50,30)', 'rgb(200,180,160)', ...]
 */
export async function extractRegionalColors(
  picUrl: string,
  count: number = 5
): Promise<string[]> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = getImgUrl(picUrl, '100y100');
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];

    ctx.drawImage(img, 0, 0, 100, 100);

    const colors: string[] = [];
    const regionSize = 20; // 每个采样区域 20x20 像素
    const usedPositions: { sx: number; sy: number }[] = [];

    for (let i = 0; i < count; i++) {
      // 随机选取一个不重复的区域
      let sx: number, sy: number;
      let attempts = 0;
      do {
        sx = Math.floor(Math.random() * (100 - regionSize));
        sy = Math.floor(Math.random() * (100 - regionSize));
        attempts++;
      } while (
        attempts < 50 &&
        usedPositions.some(
          (p) => Math.abs(p.sx - sx) < regionSize && Math.abs(p.sy - sy) < regionSize
        )
      );
      usedPositions.push({ sx, sy });

      const data = ctx.getImageData(sx, sy, regionSize, regionSize).data;
      let r = 0, g = 0, b = 0;
      const pixels = data.length / 4;
      for (let j = 0; j < data.length; j += 4) {
        r += data[j];
        g += data[j + 1];
        b += data[j + 2];
      }

      r = Math.round(r / pixels);
      g = Math.round(g / pixels);
      b = Math.round(b / pixels);
      colors.push(`rgb(${r}, ${g}, ${b})`);
    }

    return colors;
  } catch {
    // 提取失败时返回基于主色的变体
    return Array(count).fill(primaryColor.value);
  }
}
