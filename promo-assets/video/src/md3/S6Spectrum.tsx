// S6 spectrum｜spectrum-morph-ui（style-key 已过 library.json 校验）
// "ExoPlayer" 大字下划线（720×8px）裂成 32 根竖条（2 的幂），用 @remotion/media-utils
// visualizeAudio 取 BGM 真实频谱跳两小节（64f），再收拢还原成直线，完璧归赵。
// 已知坑遵守：伪 FFT 不许上片（真 FFT）；全片仅此一次频谱；收线后真静止 ≥39f
//（摘罩式：条形阶段外条件挂载整线）。frame 偏移 = 镜头全局起点，频谱即 BGM 真实位置。
import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing, staticFile } from 'remotion';
import { useAudioData, visualizeAudio } from '@remotion/media-utils';
import { C, FONT, TokenTag, SHOTS } from './tokens';

const LINE_W = 720;
const LINE_H = 8;
const LINE_X = (1920 - LINE_W) / 2;
const LINE_BOTTOM = 640;

const N_BARS = 32; // 显示条数
const FFT_SAMPLES = 512; // FFT 点数（2 的幂），再对数分桶聚合成 32 根
const GAP_MAX = 6;

const SPLIT = 25;
const SPLIT_DUR = 8;
const DANCE = 64;
const COLLAPSE_START = SPLIT + DANCE; // 89
const COLLAPSE_DUR = 12;
const COLLAPSE_END = COLLAPSE_START + COLLAPSE_DUR; // 101 → 真静止 79f

const AMP = 92;

export const S6Spectrum: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOp = interpolate(frame, [0, 10], [0, 1], {
    easing: Easing.bezier(0.2, 0, 0, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const titleY = interpolate(frame, [0, 10], [30, 0], {
    easing: Easing.bezier(0.2, 0, 0, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const subO = interpolate(frame, [118, 136], [0, 1], {
    easing: Easing.bezier(0.2, 0, 0, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const rampIn = interpolate(frame, [SPLIT, SPLIT + SPLIT_DUR], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const rampOut = interpolate(frame, [COLLAPSE_START, COLLAPSE_END], [1, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const amp = rampIn * rampOut;

  const gapIn = interpolate(frame, [SPLIT, SPLIT + SPLIT_DUR], [0, GAP_MAX], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const gapOut = interpolate(frame, [COLLAPSE_START, COLLAPSE_END], [GAP_MAX, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const gap = Math.min(gapIn, gapOut);
  const barW = (LINE_W - (N_BARS - 1) * gap) / N_BARS;

  const barsActive = frame >= SPLIT && frame < COLLAPSE_END;

  // 真 FFT：frame 偏移到全局时间轴 = BGM 播放位置（BGM 从 0s 起铺）
  const audioData = useAudioData(staticFile('audio/bgm-tech-house.mp3'));
  const globalFrame = frame + SHOTS.s6Spectrum.from;
  // 真 FFT：512 点频谱 → 对数分桶聚合 32 根（线性桶能量全堆低频，可视化不可读）
  const spectrum =
    audioData && barsActive
      ? visualizeAudio({ fps, frame: globalFrame, audioData, numberOfSamples: FFT_SAMPLES })
      : null;
  const barValue = (i: number): number => {
    if (!spectrum) return 0;
    // 只取低中频段（能量集中区前 35%）对数分桶——全频段映射会让 60% 的条落在能量死区
    const span = Math.floor((FFT_SAMPLES / 2) * 0.35);
    const lo = Math.max(1, Math.floor(Math.pow(span, i / N_BARS)));
    const hi = Math.max(lo + 1, Math.floor(Math.pow(span, (i + 1) / N_BARS)));
    let m = 0;
    for (let k = lo; k < Math.min(hi, FFT_SAMPLES); k++) m = Math.max(m, Number(spectrum[k]));
    const weight = 1 + (i / N_BARS) * 0.5;
    // pow 0.6 压缩动态范围：矮条有存在感，高条仍突出，帧间变化保持真实
    return Math.min(Math.pow(m * 4.2 * weight, 0.6), 1);
  };

  return (
    <div style={{ width: 1920, height: 1080, background: C.bg, position: 'relative', overflow: 'hidden', fontFamily: FONT }}>
      <div
        style={{
          position: 'absolute',
          top: 400,
          width: '100%',
          textAlign: 'center',
          opacity: titleOp,
          transform: `translateY(${titleY}px)`,
          fontWeight: 900,
          fontSize: 130,
          color: C.ink,
          letterSpacing: '-0.02em',
        }}
      >
        ExoPlayer
      </div>

      {/* 副标：hold 段出现 */}
      <div
        style={{
          position: 'absolute',
          top: 760,
          width: '100%',
          textAlign: 'center',
          fontSize: 32,
          color: C.sub,
          fontWeight: 500,
          opacity: subO,
        }}
      >
        原生音频引擎 · 无缝切歌 · 智能过渡
      </div>

      {/* 非跳动段：条件挂载整线（像素级静止） */}
      {!barsActive && (
        <div
          style={{
            position: 'absolute',
            left: LINE_X,
            top: LINE_BOTTOM - LINE_H,
            width: LINE_W,
            height: LINE_H,
            background: C.brand,
            borderRadius: 4,
          }}
        />
      )}

      {/* 跳动段：真频谱竖条，底边锁原线只向上生长 */}
      {barsActive &&
        Array.from({ length: N_BARS }).map((_, i) => {
          const spec = barValue(i);
          // 低频端高、高频端矮包络（visualizeAudio 低频在左）
          const envL = 0.45 + 0.55 * Math.pow(1 - i / (N_BARS - 1), 1.1);
          const barH = LINE_H + AMP * Math.pow(spec, 1.1) * envL * amp;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: LINE_X + i * (barW + gap),
                top: LINE_BOTTOM - barH,
                width: barW + (gap < 1 ? 0.5 : 0),
                height: barH,
                background: C.brand,
                borderRadius: 3,
              }}
            />
          );
        })}

      <div style={{ position: 'absolute', top: 60, left: 60, fontSize: 20, color: '#B48B52', fontFamily: 'monospace' }}>
      </div>
      <TokenTag text="ANDROID · EXOPLAYER" />
    </div>
  );
};
