/**
 * 取色面板的纯色值换算工具（无 DOM 依赖，供 AppColorPicker 与单测共用）。
 *
 * 关键点：hex → HSL 必须保留浮点。取色面板曾把 HSL 四舍五入到整数，
 * 再把 HSL 转回 hex 回写，导致「一点开取色器颜色就变了」以及「点预设色
 * 得到的不是预设值」——每通道漂移 1–3。
 */

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** 解析 #rgb / #rrggbb（大小写不敏感） */
export function hexToRgb(hex: string): [number, number, number] | null {
  const normalized = String(hex || '').trim().replace(/^#/, '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16)
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const to = (value: number) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** HSL(0–360, 0–100, 0–100) → #rrggbb */
export function hslToHex(h: number, s: number, l: number): string {
  const sat = clamp(s, 0, 100) / 100;
  const lig = clamp(l, 0, 100) / 100;
  const hue = ((h % 360) + 360) % 360;
  const k = (n: number) => (n + hue / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

/** #rrggbb → HSL，保留浮点（取整会让回写漂移） */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const rgb = hexToRgb(hex);
  if (!rgb) return { h: 0, s: 0, l: 50 };
  const [r255, g255, b255] = rgb.map((value) => value / 255);
  const max = Math.max(r255, g255, b255);
  const min = Math.min(r255, g255, b255);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const delta = max - min;
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === r255) h = ((g255 - b255) / delta + (g255 < b255 ? 6 : 0)) * 60;
    else if (max === g255) h = ((b255 - r255) / delta + 2) * 60;
    else h = ((r255 - g255) / delta + 4) * 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

/** 规范化输入色：合法则返回小写 #rrggbb，否则 null */
export function normalizeHex(hex: string): string | null {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHex(rgb[0], rgb[1], rgb[2]) : null;
}
