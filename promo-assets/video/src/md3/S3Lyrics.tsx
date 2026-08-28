// S3 word-timed｜自定义 word-timed-capsule（无现成卡，spec 已记录范围与风险）
// 逐字歌词符号化：当前句大字逐字点亮（mask 填充扫过 + 当前字轻弹），
// 翻译副行延迟淡入，背景声部小字错拍，TTML/YRC/QRC/LRC 格式胶囊依次点亮，
// 右上时间刻度同步推进。歌词为虚构中性占位（西风品牌意象）。
import React from 'react';
import { Easing,interpolate, useCurrentFrame } from 'remotion';

import { C, FONT, TokenTag } from './tokens';

const LINE2 = ['追', '着', '云', '跑', '过', '山', '坡'];
// 逐字点亮起点：第 i 字在 CHAR_T0 + i * CHAR_GAP 起 12f 内扫完
const CHAR_T0 = 62;
const CHAR_GAP = 11;

const Word: React.FC<{ ch: string; i: number; frame: number }> = ({ ch, i, frame }) => {
  const t0 = CHAR_T0 + i * CHAR_GAP;
  const sweep = interpolate(frame, [t0, t0 + 12], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });
  // 当前字轻弹（点亮瞬间 1.08 回 1，Apple 触感）
  const pop = interpolate(frame, [t0, t0 + 5, t0 + 12], [1, 1.08, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });
  const inO = interpolate(frame, [36 + i * 3, 48 + i * 3], [0, 1], {
    easing: Easing.bezier(0.2, 0, 0, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });
  return (
    <span style={{ position: 'relative', display: 'inline-block', transform: `scale(${pop})` }}>
      {/* 未唱底字：淡灰 */}
      <span style={{ color: '#CFC8BA', opacity: inO }}>{ch}</span>
      {/* 已唱层：金棕，clip 从左向右扫 */}
      <span
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          color: C.brandDeep,
          clipPath: `inset(0 ${100 - sweep * 100}% 0 0)`,
          opacity: inO
        }}
      >
        {ch}
      </span>
    </span>
  );
};

// 时间轴（镜头 240f）
// 0–20 标题 | 20–40 首行(已唱态) | 36–60 次行字入场 | 62–146 逐字点亮
// | 100–120 翻译副行 | 126–150 声部行 | 150–186 格式胶囊依次点亮 | 186–240 hold
export const S3Lyrics: React.FC = () => {
  const frame = useCurrentFrame();

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

  const line1O = interpolate(frame, [20, 36], [0, 1], {
    easing: Easing.bezier(0.2, 0, 0, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  const transO = interpolate(frame, [100, 120], [0, 1], {
    easing: Easing.bezier(0.2, 0, 0, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });
  const transX = interpolate(frame, [100, 120], [-30, 0], {
    easing: Easing.bezier(0.2, 0, 0, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  const bgO = interpolate(frame, [126, 146], [0, 1], {
    easing: Easing.bezier(0.2, 0, 0, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  // 时间刻度：进度 40%→56% 随逐字推进
  const progress = interpolate(frame, [40, 160], [0.4, 0.56], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });
  const timeO = interpolate(frame, [24, 40], [0, 1], {
    easing: Easing.bezier(0.2, 0, 0, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  const FMT = ['TTML', 'YRC', 'QRC', 'LRC'];
  const fmtIn = (i: number) =>
    interpolate(frame, [150 + i * 12, 162 + i * 12], [0, 1], {
      easing: Easing.out(Easing.back(1.6)),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp'
    });
  // 演示到 LRC 之外的第五级：AMLL TTML 说明文字
  const fmtNoteO = interpolate(frame, [200, 216], [0, 1], {
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
      {/* 标题 */}
      <div
        style={{
          position: 'absolute',
          left: 110,
          top: 170,
          opacity: headO,
          transform: `translateY(${headY}px)`
        }}
      >
        <div style={{ fontSize: 92, fontWeight: 900, color: C.ink, letterSpacing: '-0.03em' }}>
          一字一句，都<span style={{ color: C.brandDeep }}>跟上</span>。
        </div>
      </div>

      {/* 右上时间刻度 */}
      <div
        style={{ position: 'absolute', right: 130, top: 200, opacity: timeO, textAlign: 'right' }}
      >
        <div
          style={{
            fontSize: 26,
            color: C.sub,
            fontWeight: 700,
            letterSpacing: '0.12em',
            marginBottom: 14
          }}
        >
          01:38 / 03:56
        </div>
        <div
          style={{
            width: 320,
            height: 6,
            borderRadius: 3,
            background: '#E4DDCF',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              width: `${progress * 100}%`,
              height: '100%',
              borderRadius: 3,
              background: C.brand
            }}
          />
        </div>
      </div>

      {/* 歌词主体 */}
      <div style={{ position: 'absolute', left: 110, top: 360 }}>
        {/* 首行：已唱完的上一句 */}
        <div
          style={{
            fontSize: 84,
            fontWeight: 900,
            color: '#B9B0A0',
            letterSpacing: '0.02em',
            opacity: line1O
          }}
        >
          让晚风，唱一首歌
        </div>
        {/* 次行：逐字点亮主角 */}
        <div style={{ fontSize: 128, fontWeight: 900, letterSpacing: '0.04em', marginTop: 36 }}>
          {LINE2.map((ch, i) => (
            <Word key={i} ch={ch} i={i} frame={frame} />
          ))}
        </div>
        {/* 翻译副行胶囊 + 背景声部 chip（同一行，避免与底部格式胶囊重叠） */}
        <div style={{ marginTop: 40, display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 16,
              opacity: transO,
              transform: `translateX(${transX}px)`,
              background: C.containerSoft,
              borderRadius: 999,
              padding: '16px 32px'
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: 5, background: C.brand }} />
            <div style={{ fontSize: 30, color: C.onContainer, fontWeight: 600 }}>
              Chasing clouds, over the hillside
            </div>
          </div>
          {/* 背景声部小字（TTML 多声部） */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: bgO }}>
            <div
              style={{
                fontSize: 20,
                color: C.white,
                background: C.faint,
                borderRadius: 999,
                padding: '6px 16px',
                fontWeight: 700,
                letterSpacing: '0.1em'
              }}
            >
              背景声部
            </div>
            <div style={{ fontSize: 26, color: '#A89F8E', fontWeight: 600 }}>（和声）追着云～</div>
          </div>
        </div>
      </div>

      {/* 底部格式胶囊：五级查找的符号化 */}
      <div
        style={{
          position: 'absolute',
          left: 110,
          bottom: 170,
          display: 'flex',
          gap: 20,
          alignItems: 'center'
        }}
      >
        {FMT.map((f, i) => {
          const s = fmtIn(i);
          const active = s > 0.5;
          return (
            <div
              key={f}
              style={{
                padding: '14px 30px',
                borderRadius: 999,
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: '0.08em',
                transform: `scale(${Math.max(s, 0.6)})`,
                background: active ? C.brand : '#EDE7DA',
                color: active ? C.white : '#A89F8E',
                boxShadow: active ? '0 10px 22px rgba(138,101,55,0.3)' : 'none'
              }}
            >
              {f}
            </div>
          );
        })}
        <div style={{ fontSize: 24, color: C.sub, marginLeft: 8, opacity: fmtNoteO }}>
          逐字优先 · 无逐字自动回退整句滚动
        </div>
      </div>

      <TokenTag text="LYRICS · WORD-TIMED" />
    </div>
  );
};
