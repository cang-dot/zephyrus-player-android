export type PlayerInkTone = 'dark' | 'light';

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

const clampChannel = (value: number) => Math.min(255, Math.max(0, Math.round(value)));

export function parseCssColor(value: string | null | undefined): RgbColor | null {
  const source = String(value || '').trim();
  const hex = source.match(/^#([\da-f]{3}|[\da-f]{6})$/i)?.[1];
  if (hex) {
    const normalized = hex.length === 3 ? hex.split('').map((part) => part + part).join('') : hex;
    return {
      r: Number.parseInt(normalized.slice(0, 2), 16),
      g: Number.parseInt(normalized.slice(2, 4), 16),
      b: Number.parseInt(normalized.slice(4, 6), 16)
    };
  }

  const rgb = source.match(/^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/i);
  if (!rgb) return null;
  return {
    r: clampChannel(Number(rgb[1])),
    g: clampChannel(Number(rgb[2])),
    b: clampChannel(Number(rgb[3]))
  };
}

export function parseRepresentativeCssColor(value: string | null | undefined): RgbColor | null {
  const direct = parseCssColor(value);
  if (direct || !value) return direct;
  const colors = value.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi) || [];
  const parsed = colors.map(parseCssColor).filter((color): color is RgbColor => Boolean(color));
  if (!parsed.length) return null;
  return parsed.reduce(
    (result, color, index) => mixRgb(result, color, 1 / (index + 1)),
    parsed[0]
  );
}

const linearChannel = (channel: number) => {
  const normalized = clampChannel(channel) / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
};

export function relativeLuminance(color: RgbColor): number {
  return (
    linearChannel(color.r) * 0.2126 +
    linearChannel(color.g) * 0.7152 +
    linearChannel(color.b) * 0.0722
  );
}

export function contrastRatio(left: RgbColor, right: RgbColor): number {
  const brightest = Math.max(relativeLuminance(left), relativeLuminance(right));
  const darkest = Math.min(relativeLuminance(left), relativeLuminance(right));
  return (brightest + 0.05) / (darkest + 0.05);
}

export function mixRgb(from: RgbColor, to: RgbColor, progress: number): RgbColor {
  const amount = Math.min(1, Math.max(0, progress));
  return {
    r: clampChannel(from.r + (to.r - from.r) * amount),
    g: clampChannel(from.g + (to.g - from.g) * amount),
    b: clampChannel(from.b + (to.b - from.b) * amount)
  };
}

export function choosePlayerInkTone(color: RgbColor, previous?: PlayerInkTone): PlayerInkTone {
  const luminance = relativeLuminance(color);
  if (previous === 'dark' && luminance >= 0.16) return 'dark';
  if (previous === 'light' && luminance <= 0.22) return 'light';

  const black = { r: 23, g: 23, b: 26 };
  const white = { r: 255, g: 255, b: 255 };
  return contrastRatio(color, black) >= contrastRatio(color, white) ? 'dark' : 'light';
}

export function playerInkVariables(tone: PlayerInkTone) {
  return tone === 'dark'
    ? { color: '#17171a', rgb: '23, 23, 26' }
    : { color: '#ffffff', rgb: '255, 255, 255' };
}
