/**
 * 「太阳耀斑」（ether）背景的墨色调色板推导。
 *
 * 抽成纯函数是为了可测：门控规则一旦写错，表现是「黑白封面出现暖色/偏色」，
 * 这种问题在真机上很难肉眼定位。
 *
 * 规则（自上而下）：
 * 1. 黑白灰占比 > 95% → 直接中性灰度墨，绝不从残余色度里造色相；
 * 2. 主题色饱和度足够 → 用它本身的色相；
 * 3. 饱和度低但封面原始色度可辨（通道差 ≥ 10/255）→ 保留封面色相造墨；
 * 4. 其余（真灰/无封面）→ 返回 null，由求解器回退孔乙己暖墨。
 */
import tinycolor from 'tinycolor2';

import type { EtherTheme } from '@/utils/etherFluid';

/** 黑白灰封面：s=0 的中性墨 */
export const ETHER_GRAY_THEME: EtherTheme = {
  inkDark: [0.17, 0.17, 0.17],
  inkLight: [0.86, 0.86, 0.86],
  inkHot: [0.64, 0.64, 0.64],
  bg: [0.04, 0.04, 0.04],
  flash: [0.9, 0.9, 0.9]
};

/** 黑白灰占比超过这个值就按灰度封面处理 */
export const GRAY_COVER_THRESHOLD = 0.95;
/** 原始平均色的通道差低于此值视为无彩色（JPEG 色度噪声量级） */
const CHROMA_NOISE_FLOOR = 10;

export interface EtherThemeInput {
  /** 主题色（saturatedThemeColor，可能已被去灰压到 s=0.06） */
  color?: string;
  /** 封面原始平均色（未去灰） */
  rawColor?: string;
  /** 封面近灰像素占比 0–1 */
  grayRatio?: number;
}

export function computeEtherTheme({
  color,
  rawColor,
  grayRatio = 0
}: EtherThemeInput): EtherTheme | null {
  if (grayRatio > GRAY_COVER_THRESHOLD) return ETHER_GRAY_THEME;
  if (!color) return null;

  const tiny = tinycolor(color);
  if (!tiny.isValid()) return null;
  const hsl = tiny.toHsl();

  const raw = tinycolor(rawColor || '');
  const rawValid = raw.isValid();
  const rawRgb = rawValid ? raw.toRgb() : null;
  const chroma = rawRgb
    ? Math.max(rawRgb.r, rawRgb.g, rawRgb.b) - Math.min(rawRgb.r, rawRgb.g, rawRgb.b)
    : 0;

  let hue = hsl.h;
  let baseSaturation = hsl.s;
  if (hsl.s < 0.12) {
    if (chroma < CHROMA_NOISE_FLOOR) return null;
    hue = raw.toHsl().h;
    baseSaturation = 0.42;
  }

  const at = (s: number, l: number): [number, number, number] => {
    const c = tinycolor({ h: hue, s: Math.min(1, s), l }).toRgb();
    return [c.r / 255, c.g / 255, c.b / 255];
  };
  return {
    inkDark: at(baseSaturation * 0.9, 0.16),
    inkLight: at(baseSaturation * 0.22, 0.86),
    inkHot: at(baseSaturation * 1.05, 0.68),
    bg: at(baseSaturation * 0.6, 0.035),
    flash: at(0.18, 0.9)
  };
}
