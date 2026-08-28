// S5 style-cycle｜beat-step-list-theme-cycle（style-key 已过 library.json 校验）
// 三通道节拍器亮色版：样式词列表逐拍上移一行，中央胶囊"接住"下一个词并换色，
// 整场底色同拍跟换——行、色、场锁死同一拍点。跳变只占拍头 6f，其余静置。
// 8 拍 = 八种播放器样式（默认/舞台/诡谲/狂热/陈旧/雨夜/星盘/烟雾），
// 底色同明度不同色相。BEAT_LEN=14f ≈ 128BPM，阶段 6 对齐 BGM 鼓点。
import React from 'react';
import { AbsoluteFill, Easing,interpolate, useCurrentFrame } from 'remotion';

import { C, FONT, TokenTag } from './tokens';

const ROW_H = 150;
const WORDS = ['默认', '舞台', '诡谲', '狂热', '陈旧', '雨夜', '星盘', '烟雾', '默认']; // 尾行回环垫底

const BEAT_LEN = 14; // ≈128BPM
const FIRST_BEAT = 36; // 铺垫：标题+列表静置
const N_BEATS = 8;

// 每拍（胶囊色 / 场底色）：亮色系，同明度不同色相
const THEMES = [
  { pill: '#B48B52', bg: '#FAF8F3' }, // 默认 金棕
  { pill: '#A6762F', bg: '#F3E8D8' }, // 舞台 暖金
  { pill: '#7A68A8', bg: '#E9E4F2' }, // 诡谲 紫
  { pill: '#C05B4A', bg: '#F5DDD4' }, // 狂热 赤
  { pill: '#8B7B55', bg: '#EAE6DA' }, // 陈旧 橄榄
  { pill: '#5A7A9A', bg: '#DCE4EC' }, // 雨夜 雨蓝
  { pill: '#6B7FB8', bg: '#E2E4F2' }, // 星盘 蓝紫
  { pill: '#9A9A96', bg: '#ECECEA' }, // 烟雾 烟灰
  { pill: '#B48B52', bg: '#FAF8F3' } // 回到默认（收束）
];

// 拍内跳变：拍头 6f 陡 ease-out（"跳"不要"滑"）
const snap = (t: number) =>
  interpolate(t, [0, 1], [0, 1], {
    easing: (x) => 1 - Math.pow(1 - x, 3.2),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

const mix = (a: string, b: string, t: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`;
};

// 时间轴（镜头 240f）：0–24 标题 | 0–36 列表铺垫静置 | 36–148 八拍 |
// 168–186 副标 | hold 至 240
export const S5StyleCycle: React.FC = () => {
  const frame = useCurrentFrame();

  const raw = (frame - FIRST_BEAT) / BEAT_LEN;
  const beat = Math.min(N_BEATS, Math.max(0, Math.floor(raw) + 1));
  const beatStartFrame = FIRST_BEAT + (beat - 1) * BEAT_LEN;
  const tInBeat = beat === 0 ? 1 : snap((frame - beatStartFrame) / 6);
  const step = beat === 0 ? 0 : beat - 1 + tInBeat;

  const listY = -step * ROW_H;

  const themePrev = THEMES[Math.max(0, beat - 1)];
  const themeNow = THEMES[beat];
  const mixT = beat === 0 ? 1 : tInBeat;
  const pillColor = mix(themePrev.pill, themeNow.pill, mixT);
  const bgColor = mix(themePrev.bg, themeNow.bg, mixT);

  // 胶囊落位 squash：1.12→0.97→1 随拍头 6f
  const pop = beat === 0 ? 1 : interpolate(tInBeat, [0, 0.6, 1], [1.12, 0.97, 1]);

  // 反白判定跟 beat 整数走；颜色跟 tInBeat 小数走（防半白半灰中间态）
  const selectedIdx = beat;

  const headO = interpolate(frame, [2, 18], [0, 1], {
    easing: Easing.bezier(0.2, 0, 0, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });
  const headY = interpolate(frame, [2, 18], [36, 0], {
    easing: Easing.bezier(0.2, 0, 0, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });
  const subO = interpolate(frame, [168, 186], [0, 1], {
    easing: Easing.bezier(0.2, 0, 0, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  return (
    <AbsoluteFill style={{ background: bgColor, fontFamily: FONT }}>
      {/* 标题 */}
      <div
        style={{
          position: 'absolute',
          left: 110,
          top: 120,
          opacity: headO,
          transform: `translateY(${headY}px)`,
          zIndex: 4
        }}
      >
        <div style={{ fontSize: 84, fontWeight: 900, color: C.ink, letterSpacing: '-0.03em' }}>
          八种样式，各有各的<span style={{ color: C.brandDeep }}>舞台</span>。
        </div>
      </div>

      {/* 中央固定胶囊（动的是列表不是胶囊） */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 540 - ROW_H / 2 + 10,
          width: 640,
          height: ROW_H - 20,
          transform: `translateX(-50%) scale(${pop})`,
          background: pillColor,
          borderRadius: 999,
          boxShadow: '0 16px 44px rgba(80,60,30,0.22), inset 0 2px 0 rgba(255,255,255,0.35)',
          zIndex: 2
        }}
      />
      {/* 词列表 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 540 - ROW_H / 2,
          transform: `translateY(${listY}px)`
        }}
      >
        {WORDS.map((w, i) => {
          const isSel = i === selectedIdx;
          return (
            <div
              key={i}
              style={{
                height: ROW_H,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <span
                style={{
                  fontSize: 92,
                  fontWeight: 800,
                  letterSpacing: '-0.01em',
                  color: isSel ? '#FFF9F0' : 'rgba(27,24,18,0.30)',
                  position: 'relative',
                  zIndex: 3
                }}
              >
                {w}
              </span>
            </div>
          );
        })}
      </div>
      {/* 视口上下羽化：必须实时跟 bgColor（写死会穿帮） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 250,
          height: 260,
          background: `linear-gradient(${bgColor}, transparent)`,
          zIndex: 3
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 260,
          background: `linear-gradient(transparent, ${bgColor})`,
          zIndex: 3
        }}
      />

      {/* 副标：hold 段出现 */}
      <div
        style={{
          position: 'absolute',
          bottom: 170,
          width: '100%',
          textAlign: 'center',
          fontSize: 28,
          color: C.sub,
          fontWeight: 500,
          opacity: subO,
          zIndex: 4
        }}
      >
        每种样式独立保存背景、歌词颜色、字体与高潮效果
      </div>

      <TokenTag text="STAGES · 8 STYLES" />
    </AbsoluteFill>
  );
};
