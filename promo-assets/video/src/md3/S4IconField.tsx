// S4 icon-field｜icon-field-colorize（style-key 已过 library.json 校验）
// 灰阶音乐图标原野错峰浮现 → 静置一拍 → 四道色波依次向下快扫（非同帧硬翻），
// 终态四色横带 = 四个音乐来源（网易云/QQ 音乐/酷狗/本地）。
// 参数继承 demo：170 图标 17×10 CELL110、浮现 10 批错峰+微弹、行差 1.4f+列倾 0.25f、
// 翻色 pop 1.22x 正弦 3f、四道波各带起始行。
import React from 'react';
import { AbsoluteFill, Easing,interpolate, useCurrentFrame } from 'remotion';

import { C, FONT, mulberry32,TokenTag } from './tokens';

// 音乐语义简笔图标（viewBox 0 0 24 24，纯填充，可辨认优先）
const SHAPES: ((c: string) => React.ReactNode)[] = [
  // 八分音符
  (c) => (
    <>
      <circle fill={c} cx="7" cy="18" r="3.4" />
      <rect fill={c} x="9.4" y="4" width="2.4" height="14" rx="1.2" />
      <path fill={c} d="M9.4 4c4 .5 7 2 7 5.5-1.8-1.6-4.2-2.2-7-2.3z" />
    </>
  ),
  // 唱片
  (c) => (
    <>
      <circle fill={c} cx="12" cy="12" r="9" />
      <circle fill="#FFF7EC" cx="12" cy="12" r="3" />
      <circle fill={c} cx="12" cy="12" r="1.1" />
    </>
  ),
  // 心
  (c) => (
    <path
      fill={c}
      d="M12 21s-7.5-4.7-9.6-9C.9 8.7 2.7 5 6.2 5c2 0 3.3 1 4 2.1h3.6C14.5 6 15.8 5 17.8 5c3.5 0 5.3 3.7 3.8 7-2.1 4.3-9.6 9-9.6 9z"
      transform="scale(0.92) translate(1,0)"
    />
  ),
  // 播放三角圆
  (c) => (
    <>
      <circle fill={c} cx="12" cy="12" r="9" />
      <path fill="#FFF7EC" d="M10 8.2l6 3.8-6 3.8z" />
    </>
  ),
  // 搜索
  (c) => (
    <>
      <circle fill="none" stroke={c} strokeWidth="2.8" cx="10.5" cy="10.5" r="6" />
      <rect
        fill={c}
        x="14.6"
        y="13.6"
        width="7"
        height="2.9"
        rx="1.4"
        transform="rotate(45 16 15)"
      />
    </>
  ),
  // 下载
  (c) => (
    <path fill={c} d="M11 3h2.4v9.2l3.1-3.1 1.7 1.7-6 6-6-6 1.7-1.7 3.1 3.1zM4 19h16v2.4H4z" />
  ),
  // 列表
  (c) => (
    <>
      <circle fill={c} cx="5" cy="7" r="1.8" />
      <circle fill={c} cx="5" cy="12" r="1.8" />
      <circle fill={c} cx="5" cy="17" r="1.8" />
      <rect fill={c} x="9" y="6" width="11" height="2.4" rx="1.2" />
      <rect fill={c} x="9" y="11" width="11" height="2.4" rx="1.2" />
      <rect fill={c} x="9" y="16" width="11" height="2.4" rx="1.2" />
    </>
  ),
  // 耳机
  (c) => (
    <>
      <path fill="none" stroke={c} strokeWidth="2.4" d="M4 15v-3a8 8 0 0 1 16 0v3" />
      <rect fill={c} x="3" y="14" width="4.4" height="7" rx="2" />
      <rect fill={c} x="16.6" y="14" width="4.4" height="7" rx="2" />
    </>
  ),
  // 星
  (c) => (
    <path
      fill={c}
      d="M12 2l2.7 6.3 6.8.5-5.2 4.4 1.6 6.6L12 16.2 6.1 19.8l1.6-6.6L2.5 8.8l6.8-.5z"
    />
  ),
  // 电台
  (c) => (
    <>
      <rect fill={c} x="3" y="8" width="18" height="12" rx="2.5" />
      <circle fill="#FFF7EC" cx="8.5" cy="14" r="3" />
      <rect fill="#FFF7EC" x="14" y="11" width="4.6" height="2" rx="1" />
      <rect fill="#FFF7EC" x="14" y="15" width="4.6" height="2" rx="1" />
      <path fill="none" stroke={c} strokeWidth="2" d="M7 8L18 3" />
    </>
  ),
  // 铃铛
  (c) => (
    <path
      fill={c}
      d="M12 3a6 6 0 0 0-6 6v4l-1.8 3.4A1 1 0 0 0 5.1 18h13.8a1 1 0 0 0 .9-1.6L18 13V9a6 6 0 0 0-6-6zm-2.5 16a2.6 2.6 0 0 0 5 0z"
    />
  ),
  // 对勾
  (c) => <path fill={c} d="M20.3 6.7L9.6 17.4l-5.9-5.9 2.1-2.1 3.8 3.8 8.6-8.6z" />,
  // 麦克风
  (c) => (
    <>
      <rect fill={c} x="9" y="3" width="6" height="11" rx="3" />
      <path fill="none" stroke={c} strokeWidth="2.2" d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.4" />
    </>
  ),
  // 双音符
  (c) => (
    <>
      <circle fill={c} cx="6" cy="18" r="3" />
      <circle fill={c} cx="17" cy="16" r="3" />
      <path fill={c} d="M8.4 18V6l11.6-2.6V16h-2.4V6.8L10.8 8.7V18z" />
    </>
  ),
  // 闪电
  (c) => <path fill={c} d="M13 2L4 14h6l-1 8 9-12h-6z" />,
  // 文件（本地）
  (c) => (
    <>
      <path fill={c} d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
      <path fill="#FFF7EC" d="M14 2l5 5h-5z" />
      <circle fill={c} cx="11" cy="15" r="2.2" />
      <rect fill={c} x="12.6" y="8.6" width="1.8" height="6.6" />
    </>
  ),
  // 云
  (c) => <path fill={c} d="M6.5 19a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 17.8 8.7 4.2 4.2 0 0 1 17.5 19z" />
];

const COLS = 17;
const ROWS = 10;
const CELL = 110;
const ICON = 44;
const GRAYS = ['#C6BFB0', '#B5AC9B', '#D3CCBD', '#BDB4A3'];
// 四道色波 = 四个来源（金棕先覆盖全场，雾蓝/灰绿/藕粉依次覆盖更低行带）
const WAVES = [
  { color: '#B48B52', fromRow: 0, start: 55 },
  { color: '#7C93B8', fromRow: 3, start: 67 },
  { color: '#8FA98E', fromRow: 6, start: 77 },
  { color: '#C79A93', fromRow: 9, start: 87 }
];

const SRC = ['网易云', 'QQ 音乐', '酷狗', '本地'];

// 时间轴（镜头 180f）：0–45 浮现 | 45–55 静置 | 55–100 波扫 |
// 96–116 标题 | 112–140 chips | 140–180 hold
export const S4IconField: React.FC = () => {
  const frame = useCurrentFrame();
  const rand = mulberry32(20260828);
  const icons: React.ReactNode[] = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const r1 = rand();
      const r2 = rand();
      const r3 = rand();
      // 错峰浮现：分 10 批，批内再抖动
      const batch = Math.floor(r1 * 10);
      const t0 = 2 + batch * 4 + r2 * 3;
      const ap = interpolate(frame, [t0, t0 + 8], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp'
      });
      if (ap <= 0) continue;
      // 微弹：0.55 → 1.07 → 1
      const easeOut = 1 - Math.pow(1 - ap, 3);
      const appearScale = ap < 1 ? 0.55 + easeOut * 0.52 - Math.max(0, ap - 0.72) * 0.25 : 1;

      // 色波：每道波从起始行向下快扫（行差 1.4f + 列倾 0.25f + 抖动 1.5f）
      const gray = GRAYS[Math.floor(r2 * GRAYS.length)];
      let color = gray;
      let flipPhase = 0;
      for (const w of WAVES) {
        if (r < w.fromRow) continue;
        const arrive = w.start + (r - w.fromRow) * 1.4 + c * 0.25 + r3 * 1.5;
        const p = interpolate(frame, [arrive, arrive + 3], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp'
        });
        if (p > 0) {
          color = w.color;
          flipPhase = p;
        }
      }
      const flipPop = flipPhase > 0 && flipPhase < 1 ? 1 + Math.sin(flipPhase * Math.PI) * 0.22 : 1;

      const shape = SHAPES[Math.floor(r3 * SHAPES.length) % SHAPES.length];
      const x = 48 + c * CELL + (r % 2) * 26;
      const y = 26 + r * CELL;
      icons.push(
        <div
          key={`${r}-${c}`}
          style={{
            position: 'absolute',
            left: x,
            top: y,
            width: ICON,
            height: ICON,
            opacity: ap,
            transform: `scale(${appearScale * flipPop})`
          }}
        >
          <svg viewBox="0 0 24 24" width={ICON} height={ICON}>
            {shape(color)}
          </svg>
        </div>
      );
    }
  }

  const headO = interpolate(frame, [96, 114], [0, 1], {
    easing: Easing.bezier(0.2, 0, 0, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });
  const headY = interpolate(frame, [96, 114], [36, 0], {
    easing: Easing.bezier(0.2, 0, 0, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT, overflow: 'hidden' }}>
      {icons}

      {/* 中央毛玻璃标题面板（图标场之上保证可读） */}
      <div
        style={{
          position: 'absolute',
          left: 150,
          top: 356,
          padding: '52px 64px',
          borderRadius: 44,
          background: 'rgba(250,248,243,0.78)',
          backdropFilter: 'blur(18px)',
          boxShadow: '0 24px 60px rgba(80,60,30,0.14), inset 0 2px 0 rgba(255,255,255,0.8)',
          opacity: headO,
          transform: `translateY(${headY}px)`
        }}
      >
        <div
          style={{
            fontSize: 96,
            fontWeight: 900,
            color: C.ink,
            letterSpacing: '-0.03em',
            lineHeight: 1.22
          }}
        >
          四个来源，
          <br />
          一个<span style={{ color: C.brandDeep }}>曲库</span>。
        </div>
      </div>

      {/* 底部四来源 chips：依次弹出，色与波一致 */}
      <div
        style={{
          position: 'absolute',
          bottom: 160,
          left: 0,
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          gap: 24
        }}
      >
        {SRC.map((s, i) => {
          const t0 = 112 + i * 8;
          const sc = interpolate(frame, [t0, t0 + 12], [0.5, 1], {
            easing: Easing.out(Easing.back(1.7)),
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp'
          });
          const o = interpolate(frame, [t0, t0 + 8], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp'
          });
          return (
            <div
              key={s}
              style={{
                padding: '18px 40px',
                borderRadius: 999,
                background: WAVES[i].color,
                color: '#FFF9F0',
                fontSize: 32,
                fontWeight: 800,
                letterSpacing: '0.04em',
                opacity: o,
                transform: `scale(${sc})`,
                boxShadow: '0 12px 26px rgba(80,60,30,0.22), inset 0 2px 0 rgba(255,255,255,0.35)'
              }}
            >
              {s}
            </div>
          );
        })}
      </div>

      <TokenTag text="SOURCES · MULTI-PLATFORM" />
    </AbsoluteFill>
  );
};
