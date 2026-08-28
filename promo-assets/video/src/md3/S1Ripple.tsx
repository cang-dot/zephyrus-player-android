// S1 color-ripple｜theme-switch-moves · palette-ripple 式（style-key 已过 library.json 校验）
// 因果链：色板圆点点按（因果源）→ 落定帧=涟漪起始帧（组合命门）→ 主题从圆心荡开换肤
// 已知坑遵守：两版布局逐像素一致（同一组件函数接 palette 渲染）；换肤后灰阶层条件卸载（真静止）；
// 一支片主题切换仅此一次。移动端无命令面板，因果源改为「点按色板圆点」。
import React from 'react';
import { Easing,interpolate, useCurrentFrame } from 'remotion';

import { C, FONT, TokenTag } from './tokens';

const ORIGIN = { x: 1545, y: 510 }; // 色板圆点槽位中心 = 涟漪圆心（与 UiGroup 内 dot 槽位精确对齐）
const TAP = 40; // 点按落定帧 = 涟漪起始帧（组合命门）
const RIPPLE_END = 80;
const MAX_R = 1400;

// 灰阶版 / 主题色版逐像素同构的符号化 UI 组（不展示完整 UI，组件悬浮排布）
type Skin = {
  pillBg: string;
  avatar: string;
  bar1: string;
  bar2: string;
  cardBg: string;
  cardBar1: string;
  cardBar2: string;
  fab: string;
  fabIcon: string;
  chipBg: string;
  chipText: string;
};

const GRAY: Skin = {
  pillBg: '#E8E3D9',
  avatar: '#CFC9BC',
  bar1: '#B5AEA0',
  bar2: '#CDC7BA',
  cardBg: '#EFEAE0',
  cardBar1: '#B5AEA0',
  cardBar2: '#D3CDC0',
  fab: '#CFC9BC',
  fabIcon: '#F5F2EB',
  chipBg: '#E4DFD4',
  chipText: '#8F887B'
};

const TONAL: Skin = {
  pillBg: C.container,
  avatar: C.brand,
  bar1: 'rgba(107,78,38,0.62)',
  bar2: 'rgba(107,78,38,0.3)',
  cardBg: C.containerSoft,
  cardBar1: 'rgba(107,78,38,0.5)',
  cardBar2: 'rgba(107,78,38,0.24)',
  fab: C.brand,
  fabIcon: C.white,
  chipBg: '#EFE3CE',
  chipText: C.brandDeep
};

const UiGroup: React.FC<{ skin: Skin; dot?: boolean }> = ({ skin, dot = false }) => (
  <div style={{ position: 'absolute', right: 130, top: 130, width: 660 }}>
    {/* 播放条胶囊 */}
    <div
      style={{
        height: 108,
        borderRadius: 999,
        background: skin.pillBg,
        marginBottom: 30,
        display: 'flex',
        alignItems: 'center',
        padding: '0 30px',
        boxShadow: '0 14px 30px rgba(60,45,20,0.10), inset 0 2px 0 rgba(255,255,255,0.65)'
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: skin.avatar,
          marginRight: 26
        }}
      />
      <div style={{ flex: 1 }}>
        <div
          style={{
            height: 22,
            width: '58%',
            borderRadius: 11,
            background: skin.bar1,
            marginBottom: 13
          }}
        />
        <div style={{ height: 15, width: '36%', borderRadius: 8, background: skin.bar2 }} />
      </div>
      <div style={{ display: 'flex', gap: 16, marginLeft: 18 }}>
        <div
          style={{
            width: 6,
            height: 30,
            background: skin.bar1,
            borderRadius: 3,
            boxShadow: `-14px 0 0 -1.5px ${skin.bar1}, 14px 0 0 -1.5px ${skin.bar1}`
          }}
        />
      </div>
    </div>
    {/* 信息卡 */}
    <div
      style={{
        height: 156,
        borderRadius: 32,
        background: skin.cardBg,
        marginBottom: 30,
        padding: '32px 34px',
        boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.65)'
      }}
    >
      <div
        style={{
          height: 24,
          width: '46%',
          borderRadius: 12,
          background: skin.cardBar1,
          marginBottom: 18
        }}
      />
      <div
        style={{
          height: 16,
          width: '74%',
          borderRadius: 8,
          background: skin.cardBar2,
          marginBottom: 12
        }}
      />
      <div style={{ height: 16, width: '58%', borderRadius: 8, background: skin.cardBar2 }} />
    </div>
    {/* FAB + chips + 色板圆点槽位（绝对定位，dot 槽位中心 = ORIGIN） */}
    <div style={{ position: 'relative', width: 660, height: 112 }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 112,
          height: 112,
          borderRadius: 38,
          background: skin.fab,
          boxShadow: '0 16px 32px rgba(60,45,20,0.18), inset 0 2px 0 rgba(255,255,255,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div
          style={{
            width: 44,
            height: 5,
            background: skin.fabIcon,
            borderRadius: 3,
            boxShadow: `0 -15px 0 ${skin.fabIcon}, 0 15px 0 ${skin.fabIcon}`
          }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 138,
          top: 22,
          height: 68,
          padding: '0 32px',
          borderRadius: 999,
          background: skin.chipBg,
          display: 'flex',
          alignItems: 'center',
          fontSize: 27,
          color: skin.chipText,
          fontWeight: 700,
          whiteSpace: 'nowrap'
        }}
      >
        私人 FM
      </div>
      {dot && (
        <div
          style={{
            position: 'absolute',
            left: 370,
            top: 11,
            width: 90,
            height: 90,
            borderRadius: '50%',
            background: C.brand,
            boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.4)'
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          left: 486,
          top: 22,
          height: 68,
          padding: '0 32px',
          borderRadius: 999,
          background: skin.chipBg,
          display: 'flex',
          alignItems: 'center',
          fontSize: 27,
          color: skin.chipText,
          fontWeight: 700,
          whiteSpace: 'nowrap'
        }}
      >
        心动模式
      </div>
    </div>
  </div>
);

// 时间轴（镜头 180f）
// 0–22 灰阶元素浮入 | 22–32 静置 | 30–40 色板圆点弹入点按 | 40 涟漪起
// | 40–80 涟漪荡开 | 80–180 主题色真静止 hold
export const S1Ripple: React.FC = () => {
  const f = useCurrentFrame();

  const groupIn = interpolate(f, [0, 16], [0, 1], {
    easing: Easing.bezier(0.2, 0, 0, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });
  const groupY = interpolate(f, [0, 16], [44, 0], {
    easing: Easing.bezier(0.2, 0, 0, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  // 色板圆点：弹入 + 点按压缩回弹（Apple 触感：按下 0.86 回 1.07 落 1）
  const dotIn = interpolate(f, [30, 40], [0, 1], {
    easing: Easing.out(Easing.back(1.8)),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });
  const tap = interpolate(f, [34, 38, 40, 44], [1, 0.86, 1.07, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  // 涟漪：圆从因果点荡开（out cubic，先快后缓），边缘亮环
  const r = interpolate(f, [TAP, RIPPLE_END], [12, MAX_R], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });
  const rippling = f >= TAP && f < RIPPLE_END;
  const done = f >= RIPPLE_END;
  const ringOpacity = interpolate(f, [TAP, RIPPLE_END], [0.85, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  // 点按高光核：钉死「圆点=圆心」因果
  const dotOn = f >= TAP - 2 && f < TAP + 4;

  // 标题：涟漪起后入场
  const headO = interpolate(f, [46, 62], [0, 1], {
    easing: Easing.bezier(0.2, 0, 0, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });
  const headY = interpolate(f, [46, 62], [40, 0], {
    easing: Easing.bezier(0.2, 0, 0, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  // 底部色板行
  const swatchO = interpolate(f, [88, 104], [0, 1], {
    easing: Easing.bezier(0.2, 0, 0, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        background: C.bg,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: FONT
      }}
    >
      {/* 灰阶版：换肤完成后条件卸载（真静止前提） */}
      {!done && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: groupIn,
            transform: `translateY(${groupY}px)`
          }}
        >
          <UiGroup skin={GRAY} />
        </div>
      )}

      {/* 主题色版：从因果点圆形 clip 揭开；完成后铺满无 clip */}
      {(rippling || done) && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            clipPath: done ? 'none' : `circle(${r}px at ${ORIGIN.x}px ${ORIGIN.y}px)`
          }}
        >
          <UiGroup skin={TONAL} dot />
        </div>
      )}

      {/* 涟漪边缘亮环 */}
      {rippling && (
        <div
          style={{
            position: 'absolute',
            left: ORIGIN.x - r,
            top: ORIGIN.y - r,
            width: r * 2,
            height: r * 2,
            borderRadius: '50%',
            border: '5px solid rgba(255,255,255,0.9)',
            opacity: ringOpacity,
            boxShadow: '0 0 44px rgba(180,139,82,0.45), inset 0 0 30px rgba(180,139,82,0.25)'
          }}
        />
      )}

      {/* 因果点：色板圆点（金棕选中态） */}
      <div
        style={{
          position: 'absolute',
          left: ORIGIN.x - 45,
          top: ORIGIN.y - 45,
          width: 90,
          height: 90,
          borderRadius: '50%',
          background: C.brand,
          transform: `scale(${dotIn * tap})`,
          boxShadow: '0 10px 24px rgba(138,101,55,0.4), inset 0 2px 0 rgba(255,255,255,0.4)'
        }}
      />
      {/* 选中描边（换肤完成后出现） */}
      {done && (
        <div
          style={{
            position: 'absolute',
            left: ORIGIN.x - 53,
            top: ORIGIN.y - 53,
            width: 106,
            height: 106,
            borderRadius: '50%',
            border: `4px solid ${C.ink}`
          }}
        />
      )}
      {/* 点按高光核 */}
      {dotOn && (
        <div
          style={{
            position: 'absolute',
            left: ORIGIN.x - 12,
            top: ORIGIN.y - 12,
            width: 24,
            height: 24,
            borderRadius: 12,
            background: '#FFFFFF',
            boxShadow: '0 0 46px 14px rgba(255,255,255,0.9)'
          }}
        />
      )}

      {/* 左侧标题 */}
      <div
        style={{
          position: 'absolute',
          left: 110,
          top: 300,
          opacity: headO,
          transform: `translateY(${headY}px)`
        }}
      >
        <div
          style={{
            fontSize: 112,
            fontWeight: 900,
            color: C.ink,
            letterSpacing: '-0.03em',
            lineHeight: 1.24
          }}
        >
          页面颜色，
          <br />
          来自<span style={{ color: C.brandDeep }}>正在播放</span>的歌。
        </div>
      </div>

      {/* 底部色板行：四主题点（换肤完成后亮出，暗示换肤来源） */}
      <div
        style={{
          position: 'absolute',
          left: 112,
          top: 680,
          display: 'flex',
          gap: 22,
          alignItems: 'center',
          opacity: swatchO
        }}
      >
        {[C.brand, '#7C93B8', '#8FA98E', '#C79A93'].map((cl, i) => (
          <div
            key={i}
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: cl,
              outline: i === 0 ? `4px solid ${C.ink}` : 'none',
              outlineOffset: 4
            }}
          />
        ))}
        <div style={{ fontSize: 24, color: C.sub, marginLeft: 12, letterSpacing: '0.06em' }}>
          取自专辑封面 · Material You
        </div>
      </div>

      <TokenTag text="MD3 · DYNAMIC COLOR" />
    </div>
  );
};
