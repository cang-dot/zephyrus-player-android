// S0 shape-morph｜morph-from-primitive（style-key 已过 library.json 校验）
// 正圆呼吸一拍 → 同构 path 插值 24f 长成胶囊播放条（MD3 圆→胶囊的 shape 叙事）
// 参数继承 demo 调校：呼吸 1.12/20f inOut cubic、变形 24f、内容 2f 后 12f 淡入
import React from 'react';
import { Easing,interpolate, useCurrentFrame } from 'remotion';

import { C, FONT, Headline,TokenTag } from './tokens';

// ---- 同构 path：M + 8 段 cubic（demo 调校拓扑，勿改锚点数） ----
const CX = 1250;
const CY = 540;
const R = 110;
const PILL_W = 780;
const PILL_H = 210;
const PILL_R = PILL_H / 2; // 完全胶囊：圆角=高/2，与圆同构性最好
const KAPPA = 0.5522847498;

type Seg = [number, number, number, number, number, number];
type Shape = { start: [number, number]; segs: Seg[] };

const line = (from: [number, number], to: [number, number]): Seg => [
  from[0] + (to[0] - from[0]) / 3,
  from[1] + (to[1] - from[1]) / 3,
  from[0] + ((to[0] - from[0]) * 2) / 3,
  from[1] + ((to[1] - from[1]) * 2) / 3,
  to[0],
  to[1]
];
const corner = (from: [number, number], to: [number, number], c: [number, number]): Seg => [
  from[0] + KAPPA * (to[0] - c[0]),
  from[1] + KAPPA * (to[1] - c[1]),
  to[0] + KAPPA * (from[0] - c[0]),
  to[1] + KAPPA * (from[1] - c[1]),
  to[0],
  to[1]
];

const hw = PILL_W / 2;
const hh = PILL_H / 2;
const iw = hw - PILL_R;
const ihh = hh - PILL_R;

const rectAnchors: [number, number][] = [
  [hw, -ihh],
  [hw, ihh],
  [iw, hh],
  [-iw, hh],
  [-hw, ihh],
  [-hw, -ihh],
  [-iw, -hh],
  [iw, -hh]
];
const cornerCenters: [number, number][] = [
  [iw, ihh],
  [-iw, ihh],
  [-iw, -ihh],
  [iw, -ihh]
];

const pillShape: Shape = {
  start: rectAnchors[0],
  segs: [
    line(rectAnchors[0], rectAnchors[1]),
    corner(rectAnchors[1], rectAnchors[2], cornerCenters[0]),
    line(rectAnchors[2], rectAnchors[3]),
    corner(rectAnchors[3], rectAnchors[4], cornerCenters[1]),
    line(rectAnchors[4], rectAnchors[5]),
    corner(rectAnchors[5], rectAnchors[6], cornerCenters[2]),
    line(rectAnchors[6], rectAnchors[7]),
    corner(rectAnchors[7], rectAnchors[0], cornerCenters[3])
  ]
};

const angles = rectAnchors.map(([x, y]) => Math.atan2(y, x));
const circAnchors: [number, number][] = angles.map((a) => [R * Math.cos(a), R * Math.sin(a)]);
const arcSeg = (i: number): Seg => {
  const a1 = angles[i];
  let a2 = angles[(i + 1) % 8];
  if (a2 <= a1) a2 += Math.PI * 2;
  const k = (4 / 3) * Math.tan((a2 - a1) / 4);
  const p1 = circAnchors[i];
  const p2 = circAnchors[(i + 1) % 8];
  return [
    p1[0] - k * R * Math.sin(a1),
    p1[1] + k * R * Math.cos(a1),
    p2[0] + k * R * Math.sin(a2 % (Math.PI * 2)),
    p2[1] - k * R * Math.cos(a2 % (Math.PI * 2)),
    p2[0],
    p2[1]
  ];
};
const circShape: Shape = { start: circAnchors[0], segs: [0, 1, 2, 3, 4, 5, 6, 7].map(arcSeg) };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const f2 = (n: number) => n.toFixed(2);

const morphPath = (t: number): string => {
  const sx = lerp(circShape.start[0], pillShape.start[0], t);
  const sy = lerp(circShape.start[1], pillShape.start[1], t);
  let d = `M ${f2(CX + sx)} ${f2(CY + sy)}`;
  for (let i = 0; i < 8; i++) {
    const a = circShape.segs[i];
    const b = pillShape.segs[i];
    const v = a.map((n, j) => lerp(n, b[j], t));
    d += ` C ${f2(CX + v[0])} ${f2(CY + v[1])} ${f2(CX + v[2])} ${f2(CY + v[3])} ${f2(
      CX + v[4]
    )} ${f2(CY + v[5])}`;
  }
  return d + ' Z';
};

// 时间轴（相对本镜头，镜头长 150f）
// 0–10 静置 | 10–30 呼吸 | 30–54 变形 | 56–68 内容淡入 | 68–150 真静止 hold
export const S0Morph: React.FC = () => {
  const frame = useCurrentFrame();

  const breath = interpolate(frame, [10, 20, 30], [1, 1.12, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });
  const t = interpolate(frame, [30, 54], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });
  const contentOpacity = interpolate(frame, [56, 68], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  // hold 段辅助元素：同心环、色板点、token 标签、字幕（变形落定后才入场，不抢 morph）
  const decoO = interpolate(frame, [66, 84], [0, 1], {
    easing: Easing.bezier(0.2, 0, 0, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });
  // 播放三角：落定后轻微 spring 确认（momentum 微弹）
  const triSpring = interpolate(frame, [60, 78], [0.4, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  const rings = [
    { r: 400, o: 0.35 },
    { r: 560, o: 0.16 },
    { r: 730, o: 0.08 }
  ];

  const d = morphPath(t);

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        background: C.bg,
        position: 'relative',
        fontFamily: FONT,
        overflow: 'hidden'
      }}
    >
      {/* 背景同心环 */}
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, opacity: decoO }}>
        {rings.map((rg, i) => (
          <circle
            key={i}
            cx={CX}
            cy={CY}
            r={rg.r}
            fill="none"
            stroke={C.brand}
            strokeOpacity={rg.o}
            strokeWidth={2}
          />
        ))}
      </svg>

      {/* morph 主体 */}
      <svg
        width={1920}
        height={1080}
        viewBox="0 0 1920 1080"
        style={{ position: 'absolute', inset: 0 }}
      >
        <g transform={`translate(${CX} ${CY}) scale(${breath}) translate(${-CX} ${-CY})`}>
          <path d={d} fill={C.container} />
        </g>
      </svg>

      {/* 胶囊内容（变形完成后淡入） */}
      <div
        style={{
          position: 'absolute',
          left: CX - PILL_W / 2,
          top: CY - PILL_H / 2,
          width: PILL_W,
          height: PILL_H,
          opacity: contentOpacity,
          display: 'flex',
          alignItems: 'center',
          padding: '0 42px',
          gap: 34
        }}
      >
        <div
          style={{
            width: 126,
            height: 126,
            borderRadius: '50%',
            background: C.brand,
            flexShrink: 0,
            boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.4)'
          }}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              height: 26,
              width: '72%',
              borderRadius: 13,
              background: C.onContainer,
              opacity: 0.62
            }}
          />
          <div
            style={{
              height: 18,
              width: '46%',
              borderRadius: 9,
              background: C.onContainer,
              opacity: 0.3
            }}
          />
        </div>
        <div
          style={{
            width: 126,
            height: 126,
            borderRadius: '50%',
            background: C.brandDeep,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `scale(${triSpring})`,
            boxShadow: '0 12px 24px rgba(138,101,55,0.35), inset 0 2px 0 rgba(255,255,255,0.3)'
          }}
        >
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: '30px solid #FFF7EC',
              borderTop: '19px solid transparent',
              borderBottom: '19px solid transparent',
              marginLeft: 8
            }}
          />
        </div>
      </div>

      {/* 左侧字幕 */}
      <Headline lines={['一个圆，', '开始播放。']} from={62} top={330} />
      <div
        style={{
          position: 'absolute',
          left: 112,
          top: 668,
          fontSize: 34,
          color: C.sub,
          fontWeight: 500,
          opacity: decoO
        }}
      >
        Zephyrus Player · 为 Android 而生的音乐播放器
      </div>
      <div
        style={{
          position: 'absolute',
          left: 112,
          top: 748,
          display: 'flex',
          gap: 18,
          opacity: decoO
        }}
      >
        {[C.brand, '#7C93B8', '#8FA98E', '#C79A93'].map((cl, i) => (
          <div key={i} style={{ width: 46, height: 46, borderRadius: '50%', background: cl }} />
        ))}
      </div>

      <TokenTag text="MD3 · SHAPE" />
    </div>
  );
};
