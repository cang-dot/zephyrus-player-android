import { describe, expect, it } from 'vitest';

import { hexToHsl, hexToRgb, hslToHex, normalizeHex, rgbToHex } from '@/utils/colorPickerMath';

const PRESET_COLORS = [
  '#ffffff', '#c9c2b7', '#9a9590', '#55524e', '#1c1b1a', '#000000',
  '#ea402f', '#fb7299', '#e86aa6', '#f5a623', '#f8d477', '#7ba05b',
  '#4caf7d', '#37a0a8', '#5a8dd6', '#7c5cff', '#a05ccc', '#8e6e5a'
];

describe('colorPickerMath', () => {
  it('hex → HSL → hex 无损往返（取整会让颜色漂移）', () => {
    for (const hex of PRESET_COLORS) {
      const hsl = hexToHsl(hex);
      expect(hslToHex(hsl.h, hsl.s, hsl.l)).toBe(hex);
    }
  });

  it('取整后的 HSL 会改变颜色（旧实现的问题）', () => {
    const hex = '#f0ece4';
    const exact = hexToHsl(hex);
    const rounded = {
      h: Math.round(exact.h),
      s: Math.round(exact.s),
      l: Math.round(exact.l)
    };
    expect(hslToHex(rounded.h, rounded.s, rounded.l)).not.toBe(hex);
    expect(hslToHex(exact.h, exact.s, exact.l)).toBe(hex);
  });

  it('解析 #rgb / #rrggbb / 大小写 / 空格', () => {
    expect(hexToRgb('#abc')).toEqual([170, 187, 204]);
    expect(hexToRgb(' ABC ')).toEqual([170, 187, 204]);
    expect(hexToRgb('#GGGGGG')).toBeNull();
    expect(hexToRgb('')).toBeNull();
  });

  it('normalizeHex 输出小写 #rrggbb', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc');
    expect(normalizeHex('E86AA6')).toBe('#e86aa6');
    expect(normalizeHex('not-a-color')).toBeNull();
  });

  it('rgbToHex 钳制越界通道', () => {
    expect(rgbToHex(-5, 300, 12.6)).toBe('#00ff0d');
  });

  it('HSL 边界：黑白与色相回绕', () => {
    expect(hslToHex(0, 0, 0)).toBe('#000000');
    expect(hslToHex(0, 0, 100)).toBe('#ffffff');
    expect(hslToHex(360, 100, 50)).toBe(hslToHex(0, 100, 50));
    expect(hslToHex(-120, 100, 50)).toBe(hslToHex(240, 100, 50));
  });
});
