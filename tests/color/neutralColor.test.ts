import { describe, expect, it } from 'vitest';

import {
  adjustForAccent,
  isNearGray,
  pickEdgeDominantColor,
  resolveSaturatedHsl,
  snapToNeutral
} from '@/utils/neutralColor';

/** 确定性伪随机（LCG），模拟 JPEG 色度噪声 */
function makeNoise(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

describe('isNearGray / snapToNeutral', () => {
  it('纯灰与 JPEG 噪声灰判近灰，sepia 暖黑与彩色不算', () => {
    expect(isNearGray(128, 128, 128)).toBe(true);
    expect(isNearGray(10, 10, 10)).toBe(true);
    // 噪声灰：通道极差 12，在容差内
    expect(isNearGray(120, 117, 108)).toBe(true);
    // 暖黑 sepia：极差 22，超出暗部容差
    expect(isNearGray(30, 20, 8)).toBe(false);
    expect(isNearGray(200, 80, 60)).toBe(false);
  });

  it('snapToNeutral：灰归 luma，彩色原样', () => {
    expect(snapToNeutral(128, 128, 128)).toEqual({ r: 128, g: 128, b: 128 });
    // 噪声灰 → 归到 luma ≈ 118
    const snapped = snapToNeutral(120, 117, 108);
    expect(snapped.r).toBe(snapped.g);
    expect(snapped.g).toBe(snapped.b);
    expect(snapToNeutral(200, 80, 60)).toEqual({ r: 200, g: 80, b: 60 });
  });
});

describe('adjustForAccent', () => {
  it('纯灰不做暖化（不再产出脏卡其），亮度钳制照常', () => {
    // 灰 128 → 原样返回，三通道相等
    expect(adjustForAccent(128, 128, 128)).toEqual({ r: 128, g: 128, b: 128 });
    // 默认 #888888 保持中性
    expect(adjustForAccent(136, 136, 136)).toEqual({ r: 136, g: 136, b: 136 });
    // 太暗的灰提亮但保持中性
    const dark = adjustForAccent(40, 40, 40);
    expect(dark.r).toBe(dark.g);
    expect(dark.g).toBe(dark.b);
    expect(dark.r).toBeGreaterThanOrEqual(80);
  });

  it('暖噪声灰不再被暖化放大', () => {
    // 轻微偏暖的噪声灰：原样返回（不叠加 +15/+10/−20），极差不再扩大
    const input = { r: 120, g: 117, b: 108 };
    expect(adjustForAccent(input.r, input.g, input.b)).toEqual(input);
  });

  it('彩色封面暖化行为与旧算法一致', () => {
    // (180,120,60)：亮度 131 不触发提亮/压暗，暖化 +15/+10/−20
    expect(adjustForAccent(180, 120, 60)).toEqual({ r: 195, g: 130, b: 40 });
    // 暗红 (200,50,50)：提亮后暖化
    expect(adjustForAccent(200, 50, 50)).toEqual({ r: 255, g: 89, b: 59 });
  });
});

describe('resolveSaturatedHsl', () => {
  it('彩色封面拉伸饱和度并钳制亮度', () => {
    const out = resolveSaturatedHsl({ h: 200, s: 0.5, l: 0.3 }, { h: 30, s: 0.4 });
    expect(out.h).toBe(200);
    expect(out.s).toBe(0.72);
    expect(out.l).toBeCloseTo(0.42, 5);
  });

  it('灰封面 + 有色强调色 → 借强调色色相', () => {
    const out = resolveSaturatedHsl({ h: 0, s: 0.02, l: 0.5 }, { h: 200, s: 0.5 });
    expect(out.h).toBe(200);
    expect(out.s).toBe(0.72);
  });

  it('灰封面 + 中性强调色 → 保持低饱和中性（不被 hue=0 染红）', () => {
    const out = resolveSaturatedHsl({ h: 0, s: 0.02, l: 0.5 }, { h: 0, s: 0 });
    expect(out.s).toBe(0.06);
    expect(out.l).toBeCloseTo(0.5, 5);
    // 无强调色（读取失败）同样走中性
    const out2 = resolveSaturatedHsl({ h: 0, s: 0.02, l: 0.5 }, null);
    expect(out2.s).toBe(0.06);
  });
});

describe('pickEdgeDominantColor', () => {
  const size = 16;
  const band = size / 4;

  function makeData(fill: (x: number, y: number) => [number, number, number, number]): Uint8ClampedArray {
    const data = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const [r, g, b, a] = fill(x, y);
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = a;
      }
    }
    return data;
  }

  const inEdge = (x: number, y: number) =>
    x < band || x >= size - band || y < band || y >= size - band;

  it('JPEG 噪声灰 → 中性灰桶胜出，不落暖偏桶', () => {
    const noise = makeNoise(42);
    const data = makeData((x, y) => {
      if (!inEdge(x, y)) return [128, 128, 128, 255];
      // ±6 的通道独立噪声（灰度封面 JPEG 色度抽样残留）
      const jitter = () => Math.round((noise() - 0.5) * 12);
      return [120 + jitter(), 118 + jitter(), 116 + jitter(), 255];
    });
    const result = pickEdgeDominantColor(data, size);
    expect(result).not.toBeNull();
    // 三个通道接近相等（中性），而不是 b 通道低一档的暖偏
    expect(Math.abs(result!.r - result!.b)).toBeLessThanOrEqual(2);
    expect(Math.abs(result!.r - result!.g)).toBeLessThanOrEqual(2);
  });

  it('sepia 暖调封面如实保留暖色', () => {
    const data = makeData(() => [80, 60, 40, 255]);
    const result = pickEdgeDominantColor(data, size);
    expect(result).not.toBeNull();
    expect(result!.r).toBeGreaterThan(result!.b);
    expect(Math.round(result!.r)).toBe(80);
  });

  it('黑框彩心封面 → 最大面积的黑框胜出', () => {
    const noise = makeNoise(7);
    const data = makeData((x, y) => {
      if (!inEdge(x, y)) return [128, 128, 128, 255];
      // 边缘 10% 是亮红点缀，其余近黑
      return noise() < 0.1 ? [200, 50, 50, 255] : [5, 5, 5, 255];
    });
    const result = pickEdgeDominantColor(data, size);
    expect(result).not.toBeNull();
    expect(result!.r).toBeLessThan(20);
  });

  it('中心区域不参与统计', () => {
    // 边缘灰、中心全是刺眼的品红 → 结果应是灰
    const data = makeData((x, y) =>
      inEdge(x, y) ? [120, 120, 120, 255] : [255, 0, 255, 255]
    );
    const result = pickEdgeDominantColor(data, size);
    expect(result).not.toBeNull();
    expect(Math.abs(result!.r - 120)).toBeLessThanOrEqual(1);
  });

  it('透明像素跳过，全透明返回 null', () => {
    const data = makeData(() => [200, 50, 50, 100]);
    expect(pickEdgeDominantColor(data, size)).toBeNull();
  });
});
