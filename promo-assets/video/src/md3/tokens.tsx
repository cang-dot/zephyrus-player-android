// Zephyrus MD3 宣传片 · 设计 tokens 与帧级时间轴
// 视觉从产品海报（magazine.png）生长：米白底 + 金棕主色 + 胶囊组件 + 编辑风大字
// 动效性格：Apple 临界阻尼弹簧 × MD3 emphasized easing · 三词「干净 / 弹性 / 呼吸」
import React from 'react';
import { Easing,interpolate, useCurrentFrame } from 'remotion';

export const C = {
  bg: '#FAF8F3',
  ink: '#1B1812',
  sub: '#6E675C',
  faint: '#B9B0A0',
  brand: '#B48B52',
  brandDeep: '#8A6537',
  gold: '#C9A02E',
  container: '#EAD9C0',
  containerSoft: '#F1E6D4',
  onContainer: '#6B4E26',
  white: '#FFF7EC'
};

// Material You 动态色板：四套主题均从「专辑主色」推导
export const PALETTES = [
  { name: '金棕', primary: '#B48B52', container: '#EAD9C0', on: '#6B4E26', soft: '#F1E6D4' },
  { name: '雾蓝', primary: '#7C93B8', container: '#D8E1EE', on: '#3E547A', soft: '#E7EDF5' },
  { name: '灰绿', primary: '#8FA98E', container: '#DDE7DB', on: '#4C634B', soft: '#E9F0E8' },
  { name: '藕粉', primary: '#C79A93', container: '#F2DFDC', on: '#7E4F48', soft: '#F7EAE7' }
] as const;

export const FONT = "'NotoSC','Microsoft YaHei',sans-serif";

export const FPS = 30;

// MD3 emphasized easing（入场/转场主缓动）
export const EASE_MD3 = [0.2, 0, 0, 1] as const;

// 帧级时间轴（分镜定稿见 DESIGN-SPEC.md）
export const SHOTS = {
  s0Morph: { from: 0, dur: 150 },
  s1Ripple: { from: 150, dur: 180 },
  s2Thumb: { from: 330, dur: 150 },
  s3Lyrics: { from: 480, dur: 240 },
  s4IconField: { from: 720, dur: 180 },
  s5StyleCycle: { from: 900, dur: 240 },
  s6Spectrum: { from: 1140, dur: 180 },
  s7Poster: { from: 1320, dur: 240 }
} as const;

export const TOTAL_FRAMES = 1560;

// 确定性伪随机（渲染铁律：禁 Math.random）
export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// 全片通用：左下角 MD3 token 标签（镜头内 4–18f 淡入）
export const TokenTag: React.FC<{ text: string }> = ({ text }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [4, 18], [0, 1], {
    easing: Easing.bezier(0.2, 0, 0, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });
  return (
    <div
      style={{
        position: 'absolute',
        left: 110,
        bottom: 88,
        fontFamily: FONT,
        fontSize: 24,
        letterSpacing: '0.28em',
        color: C.brand,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        opacity: o
      }}
    >
      <span
        style={{
          width: 34,
          height: 3,
          background: C.brand,
          marginRight: 18,
          borderRadius: 2,
          display: 'inline-block'
        }}
      />
      {text}
    </div>
  );
};
// 全片通用：章节大字（编辑风左排）
export const Headline: React.FC<{
  lines: React.ReactNode[];
  from: number;
  top?: number;
  size?: number;
}> = ({ lines, from, top = 300, size = 118 }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: 'absolute',
        left: 110,
        top,
        fontFamily: FONT
      }}
    >
      {lines.map((l, i) => {
        const f = frame - (from + i * 5);
        const o = interpolate(f, [0, 14], [0, 1], {
          easing: Easing.bezier(0.2, 0, 0, 1),
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp'
        });
        const y = interpolate(f, [0, 14], [36, 0], {
          easing: Easing.bezier(0.2, 0, 0, 1),
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp'
        });
        return (
          <div
            key={i}
            style={{
              fontSize: size,
              fontWeight: 900,
              color: C.ink,
              letterSpacing: '-0.03em',
              lineHeight: 1.22,
              opacity: o,
              transform: `translateY(${y}px)`
            }}
          >
            {l}
          </div>
        );
      })}
    </div>
  );
};
