// S2 thumb-hero｜segmented-thumb-hero（style-key 已过 library.json 校验）
// 超大胶囊分段控件特写：弹簧浮入 → 描边光标画外滑入 → 按下+涟漪 →
// thumb 严格 8f ease-out 滑段 → 新图标 spring 过冲弹出、旧图标 width 归零塌缩 → hold ≥30f
// 参数继承 demo 调校：浮入 spring(damping14/stiff120)、光标 24f out-cubic、
// 按下 0.86、thumb 8f、图标 spring(damping10/stiff220)、涟漪 12f 压 thumb 之上锁点击点。
// 语义适配：Zephyrus 播放模式「顺序 → 随机」（呼应海报「随机歌单 · 换一种播放顺序」）
import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig
} from 'remotion';

import { C, FONT, TokenTag } from './tokens';

// 超大描边箭头光标（demo 调校形状）
const ArrowCursor: React.FC<{ x: number; y: number; press: number }> = ({ x, y, press }) => (
  <svg
    width={130}
    height={150}
    viewBox="0 0 26 30"
    style={{
      position: 'absolute',
      left: x,
      top: y,
      transform: `scale(${1 - press * 0.14})`,
      transformOrigin: '15% 10%',
      filter: 'drop-shadow(0 8px 16px rgba(60,45,20,0.25))'
    }}
  >
    <path
      d="M4 2 L4 24 L9.5 18.5 L13 27 L16.8 25.4 L13.3 17 L21 17 Z"
      fill="#fff"
      stroke={C.ink}
      strokeWidth={1.8}
      strokeLinejoin="round"
    />
  </svg>
);

// 顺序图标：回形循环箭头
const OrderIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 40 40">
    <path
      d="M8 14 Q8 8 14 8 L30 8 M26 4 L31 8 L26 12"
      fill="none"
      stroke={color}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M32 26 Q32 32 26 32 L10 32 M14 28 L9 32 L14 36"
      fill="none"
      stroke={color}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// 随机图标：交叉 shuffle 箭头（弹出奖励感：末端小圆点带节奏）
const ShuffleIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 40 40">
    <path
      d="M6 12 L14 12 L28 28 L34 28 M30 24 L34 28 L30 32"
      fill="none"
      stroke={color}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6 28 L14 28 Q20 28 24 22 M28 12 L34 12 M30 8 L34 12 L30 16"
      fill="none"
      stroke={color}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx={7} cy={12} r={2.2} fill={color} />
    <circle cx={7} cy={28} r={2.2} fill={color} />
  </svg>
);

// 时间轴（镜头 150f）：浮入 0–18 | 光标 20–44 | 点击 48 | thumb 52–60 |
// 图标弹出 60+ | hold 60–150（90f 真静止）
export const S2Thumb: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const FLOAT_IN = 0;
  const CURSOR_IN = 20;
  const CLICK = 48;
  const SLIDE = 52;
  const SLIDE_END = 60;

  const floatT = spring({
    frame: frame - FLOAT_IN,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.9 }
  });
  const ctrlY = interpolate(floatT, [0, 1], [200, 0]);

  const CW = 1080;
  const CH = 220;
  const PAD = 16;
  const SEGW = (CW - PAD * 2) / 2;

  const curT = interpolate(frame, [CURSOR_IN, CURSOR_IN + 24], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic)
  });
  // 点击完成后光标顺势滑开（真人避让，不挡新状态文字）
  const curAway = interpolate(frame, [SLIDE + 2, SLIDE + 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic)
  });
  const curX = interpolate(curT, [0, 1], [1780, 1210]) + curAway * 360;
  const curY = interpolate(curT, [0, 1], [1020, 500]) + curAway * 230;
  const press = interpolate(frame, [CLICK, CLICK + 3, CLICK + 7], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  // thumb 严格 8f（全镜心跳，勿改时长）
  const thumbT = interpolate(frame, [SLIDE, SLIDE_END], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic)
  });
  const thumbX = PAD + thumbT * SEGW;

  // 新图标 spring 过冲弹出；旧图标 6f 塌缩 + width 归零（文字回流，防幽灵缝）
  const iconIn = spring({
    frame: frame - SLIDE_END,
    fps,
    config: { damping: 10, stiffness: 220, mass: 0.6 }
  });
  const shuffleScale = frame >= SLIDE_END ? iconIn : 0;
  const orderScale = interpolate(frame, [SLIDE, SLIDE + 6], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.cubic)
  });

  const rippleT = interpolate(frame, [CLICK, CLICK + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad)
  });

  const labelStyle = (active: boolean): React.CSSProperties => ({
    fontWeight: 700,
    fontSize: 72,
    color: active ? C.ink : C.faint,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    width: SEGW,
    height: CH - PAD * 2,
    position: 'relative',
    zIndex: 2
  });

  const orderActive = thumbT < 0.5;

  // 标题与副标
  const headO = interpolate(frame, [4, 20], [0, 1], {
    easing: Easing.bezier(0.2, 0, 0, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });
  const headY = interpolate(frame, [4, 20], [36, 0], {
    easing: Easing.bezier(0.2, 0, 0, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });
  const subO = interpolate(frame, [78, 94], [0, 1], {
    easing: Easing.bezier(0.2, 0, 0, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT }}>
      {/* 标题（上方居中，不抢控件特写的戏） */}
      <div
        style={{
          position: 'absolute',
          top: 150,
          width: '100%',
          textAlign: 'center',
          fontSize: 88,
          fontWeight: 900,
          color: C.ink,
          letterSpacing: '-0.03em',
          opacity: headO,
          transform: `translateY(${headY}px)`
        }}
      >
        每一次触控，都<span style={{ color: C.brandDeep }}>跟手</span>。
      </div>

      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        {/* 分段控件 */}
        <div
          style={{
            width: CW,
            height: CH,
            borderRadius: CH / 2,
            background: '#EDE7DA',
            border: '3px solid #DCD3C2',
            boxShadow: `0 ${26 - floatT * 14}px ${70 - floatT * 26}px rgba(80,60,30,0.20)`,
            transform: `translateY(${ctrlY}px)`,
            opacity: Math.min(1, floatT * 1.5),
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            padding: PAD,
            boxSizing: 'border-box'
          }}
        >
          {/* 白 thumb */}
          <div
            style={{
              position: 'absolute',
              left: thumbX,
              top: PAD,
              width: SEGW,
              height: CH - PAD * 2,
              borderRadius: (CH - PAD * 2) / 2,
              background: '#FFFFFF',
              boxShadow: '0 6px 20px rgba(80,60,30,0.18), inset 0 1px 0 rgba(255,255,255,0.9)',
              zIndex: 1
            }}
          />
          {/* 点击涟漪：圆心锁点击点（右段中心），zIndex 压 thumb 之上 */}
          {rippleT > 0 && rippleT < 1 && (
            <div
              style={{
                position: 'absolute',
                left: PAD + SEGW + SEGW / 2 - 130 * rippleT,
                top: CH / 2 - 130 * rippleT,
                width: 260 * rippleT,
                height: 260 * rippleT,
                borderRadius: '50%',
                border: `4px solid ${C.brand}`,
                opacity: (1 - rippleT) * 0.8,
                zIndex: 3
              }}
            />
          )}
          {/* 顺序段 */}
          <div style={labelStyle(orderActive)}>
            <span
              style={{
                display: 'inline-flex',
                transform: `scale(${orderScale})`,
                width: orderScale < 0.05 ? 0 : 78,
                overflow: 'visible'
              }}
            >
              <OrderIcon size={78} color={C.faint} />
            </span>
            顺序
          </div>
          {/* 随机段 */}
          <div style={labelStyle(!orderActive)}>
            <span
              style={{
                display: 'inline-flex',
                transform: `scale(${shuffleScale}) rotate(${(1 - shuffleScale) * -40}deg)`,
                width: shuffleScale < 0.05 ? 0 : 78,
                overflow: 'visible'
              }}
            >
              <ShuffleIcon size={78} color={C.brandDeep} />
            </span>
            随机
          </div>
        </div>
      </AbsoluteFill>

      {/* 副标：hold 段出现 */}
      <div
        style={{
          position: 'absolute',
          bottom: 200,
          width: '100%',
          textAlign: 'center',
          fontSize: 30,
          color: C.sub,
          fontWeight: 500,
          opacity: subO
        }}
      >
        跟手手势 · 可中断动画 · 单手触控
      </div>

      <ArrowCursor x={curX} y={curY} press={press} />
      <TokenTag text="MD3 · EXPRESSIVE MOTION" />
    </AbsoluteFill>
  );
};
