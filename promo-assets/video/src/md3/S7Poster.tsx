// S7 poster｜color-block-step-wipe B 式（style-key 已过 library.json 校验）+ 用户海报收尾
// 金棕阶跃色块右下角斜向 3 跳吃屏（stepVal 帧阈值查表，零插值零缓动），
// 海报卡 rotate -4° 定角与色块同拍跳位——"整块被搬进来"；第 3 跳满屏时
// 海报以 A 式徽章语法三跳落定（0.55→1.12→1），随后平滑缓推 1.03→1.00 呼吸，
// 结尾完全静止。
// 已知坑遵守：跳位不等距（读作节拍）；每跳一记打点（SFX）；阶跃段不混缓动。
import React from 'react';
import { AbsoluteFill, Img, useCurrentFrame, interpolate, Easing, staticFile } from 'remotion';
import { C, FONT } from './tokens';

const BRAND = '#B48B52';

// 离散阶跃：frame 越过阈值瞬间跳到新值，无插值（本卡语法宪法）
const stepVal = (frame: number, steps: Array<[number, number]>): number => {
  let v = steps[0][1];
  for (const [f, val] of steps) {
    if (frame >= f) v = val;
  }
  return v;
};

// 时间轴（镜头 240f）：
// 色块三跳 p: 0→42→106→200 @ 6/16/28（不等距）；海报卡同拍跳位
// 徽章式落定 28/34/38；缓推 42–96；尾段完全静止（海报即品牌收尾，不叠字）
export const S7Poster: React.FC = () => {
  const frame = useCurrentFrame();

  // 对角线推进量：p=200 全覆盖（clip-path polygon 直角三角，硬边无羽化）
  const p = stepVal(frame, [
    [0, 0],
    [6, 42],
    [16, 106],
    [28, 200],
  ]);
  const covered = p >= 200;

  // 海报卡：画外 → 两个停靠点 → 满屏，rotate -4° 定角，同拍离散跳位
  const cardState = stepVal(frame, [
    [0, 0], // 画外（右下角外）
    [6, 1], // 停靠点 1：右下小卡
    [16, 2], // 停靠点 2：中央中卡
    [28, 3], // 满屏落位（配合徽章式 scale 三跳）
  ]);

  // 徽章式落定 scale：三档硬跳 0.55→1.12→1（同一语法贯穿到底）
  const badgeScale = stepVal(frame, [
    [0, 0],
    [28, 0.55],
    [34, 1.12],
    [38, 1],
  ]);
  const posterVisible = frame >= 6;

  // 停靠点几何（scale 相对满屏 1920×1080）
  const poses = [
    { x: 1560, y: 900, scale: 0.18, rot: -4 }, // 画外入口
    { x: 1450, y: 760, scale: 0.24, rot: -4 },
    { x: 960, y: 540, scale: 0.52, rot: -4 },
    { x: 960, y: 540, scale: 1, rot: 0 },
  ];
  const pos = poses[Math.min(cardState, 3)];
  // 满屏落定后的平滑缓推（新场呼吸，1.03→1.00）
  const settle = interpolate(frame, [42, 96], [1.03, 1], {
    easing: Easing.bezier(0.2, 0, 0, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = cardState >= 3 ? badgeScale * settle : pos.scale;


  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT, overflow: 'hidden' }}>
      {/* 阶跃色块：对角线直角三角从右下角生长（硬边） */}
      {!covered && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            clipPath: `polygon(${1920 - (p / 200) * 3200}px 1080px, 1920px 1080px, 1920px ${1080 - (p / 200) * 1800}px)`,
            background: BRAND,
          }}
        />
      )}

      {/* 海报卡（与色块同拍跳位，rotate -4° 定角） */}
      {posterVisible && (
        <div
          style={{
            position: 'absolute',
            left: 960,
            top: 540,
            width: 1920,
            height: 1080,
            transform: `translate(-50%, -50%) rotate(${cardState >= 3 ? 0 : -4}deg) scale(${scale})`,
            boxShadow: cardState >= 3 ? 'none' : '0 30px 80px rgba(60,40,10,0.45)',
            overflow: 'hidden',
          }}
        >
          <Img src={staticFile('textures/magazine.png')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}

    </AbsoluteFill>
  );
};
