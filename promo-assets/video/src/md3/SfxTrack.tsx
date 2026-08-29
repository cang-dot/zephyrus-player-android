// 阶段 6 · SFX 钉帧表（声明式集中管理，from 一律写相对表达式 SHOTS.x.from + offset）
// 音量按素材实测峰值给（大多贴近 0dBFS → 系数 0.2-0.55）；长样本显式 durationInFrames 截断。
// 结尾固定句式：riser（S7 三跳前起）→ impact（海报落定，全片峰值）→ sparkle（余韵）。
// BGM: bgm-tech-house.mp3（123 BPM，librosa 实测），压低 0.34 给 SFX 留 headroom，首尾淡入淡出。
import React from 'react';
import { Audio, Sequence, interpolate, staticFile } from 'remotion';
import { SHOTS } from './tokens';

const BGM = 'audio/bgm-tech-house.mp3';

type Cue = {
  from: number;
  src: string;
  volume: number;
  dur?: number;
  note: string;
};

const buildCues = (): Cue[] => [
  // S0 morph 落定：低频落地（克制，不抢开场呼吸）
  { from: SHOTS.s0Morph.from + 54, src: 'impact-deep-whoosh.mp3', volume: 0.4, dur: 60, note: 'S0 圆→胶囊变形落定' },

  // S1 因果链：点按拟音 + 涟漪扫场
  { from: SHOTS.s1Ripple.from + 37, src: 'switch-tap.mp3', volume: 0.4, note: 'S1 色板圆点点按' },
  { from: SHOTS.s1Ripple.from + 40, src: 'sweep-fast.mp3', volume: 0.35, note: 'S1 涟漪荡开换肤' },

  // S2 光标因果链：按下→thumb 滑段→图标弹出奖励
  { from: SHOTS.s2Thumb.from + 48, src: 'switch-click-quick.mp3', volume: 0.3, note: 'S2 光标按下' },
  { from: SHOTS.s2Thumb.from + 52, src: 'transition-snap.mp3', volume: 0.45, note: 'S2 thumb 8f 滑段' },
  { from: SHOTS.s2Thumb.from + 60, src: 'pop.mp3', volume: 0.3, note: 'S2 随机图标 spring 弹出' },

  // S3 逐字点亮：pop 群双样本交替 + 音量阶梯递减（防机枪感）
  ...Array.from({ length: 7 }).map((_, i): Cue => ({
    from: SHOTS.s3Lyrics.from + 62 + i * 11,
    src: i % 2 === 0 ? 'pop.mp3' : 'pop-electric.mp3',
    volume: 0.4 - i * 0.03,
    note: `S3 第 ${i + 1} 字点亮`,
  })),
  { from: SHOTS.s3Lyrics.from + 102, src: 'sparkle-touch.mp3', volume: 0.3, note: 'S3 翻译副行入场', dur: 50 },
  ...Array.from({ length: 4 }).map((_, i): Cue => ({
    from: SHOTS.s3Lyrics.from + 152 + i * 12,
    src: 'switch-tap.mp3',
    volume: 0.34 - i * 0.03,
    note: `S3 格式胶囊 ${['TTML', 'YRC', 'QRC', 'LRC'][i]}`,
  })),

  // S4 四道色波 = 四来源：首波最响，依次递减
  { from: SHOTS.s4IconField.from + 55, src: 'sweep-fast.mp3', volume: 0.4, note: 'S4 金棕波扫全场' },
  { from: SHOTS.s4IconField.from + 67, src: 'sweep-short.mp3', volume: 0.3, note: 'S4 雾蓝波' },
  { from: SHOTS.s4IconField.from + 77, src: 'sweep-short.mp3', volume: 0.26, note: 'S4 灰绿波' },
  { from: SHOTS.s4IconField.from + 87, src: 'sweep-short.mp3', volume: 0.22, note: 'S4 藕粉波' },

  // S5 八拍节拍器：pop 双样本交替 + 阶梯递减
  ...Array.from({ length: 8 }).map((_, i): Cue => ({
    from: SHOTS.s5StyleCycle.from + 36 + i * 14,
    src: i % 2 === 0 ? 'pop.mp3' : 'pop-electric.mp3',
    volume: 0.32 - i * 0.015,
    note: `S5 第 ${i + 1} 拍换肤`,
  })),

  // S6 借用-归还结构：裂开 swoosh + 收线轻响（频谱段 BGM 即节奏，不加 SFX）
  { from: SHOTS.s6Spectrum.from + 25, src: 'sweep-fast.mp3', volume: 0.35, note: 'S6 下划线裂开' },
  { from: SHOTS.s6Spectrum.from + 89, src: 'transition-soft.mp3', volume: 0.3, note: 'S6 收拢还原' },

  // S7 结尾句式：riser → 三跳阶跃（递增宣告）→ impact（全片峰值）→ sparkle 余韵
  { from: SHOTS.s7Poster.from - 60, src: 'riser-cine.mp3', volume: 0.4, dur: 98, note: 'S7 riser 铺垫三跳' },
  { from: SHOTS.s7Poster.from + 6, src: 'hit-fast-exciting.mp3', volume: 0.3, note: 'S7 色块第 1 跳' },
  { from: SHOTS.s7Poster.from + 16, src: 'hit-fast-exciting.mp3', volume: 0.38, note: 'S7 色块第 2 跳' },
  { from: SHOTS.s7Poster.from + 28, src: 'hit-fast-exciting.mp3', volume: 0.46, note: 'S7 色块第 3 跳' },
  { from: SHOTS.s7Poster.from + 38, src: 'impact-cine-big.mp3', volume: 0.55, dur: 75, note: 'S7 海报落定（全片峰值）' },
  { from: SHOTS.s7Poster.from + 44, src: 'shimmer-sparkle-sweep.mp3', volume: 0.3, dur: 70, note: 'S7 sparkle 余韵' },
];

export const SfxTrack: React.FC<{ bgm?: boolean }> = ({ bgm = true }) => {
  const cues = buildCues();
  return (
    <>
      {/* BGM：布尔 inputProp 解耦，终渲出带/无 BGM 两版；首 30f 淡入、尾 60f 淡出 */}
      {bgm && (
        <Audio
          src={staticFile(BGM)}
          volume={(f) =>
            interpolate(f, [0, 30, SHOTS.s7Poster.from + 180, TOTAL], [0, 0.34, 0.34, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          }
        />
      )}
      {cues.map((c, i) => (
        <Sequence key={i} from={c.from} durationInFrames={c.dur ?? undefined}>
          <Audio src={staticFile('sfx/' + c.src)} volume={c.volume} />
        </Sequence>
      ))}
    </>
  );
};

const TOTAL = SHOTS.s7Poster.from + SHOTS.s7Poster.dur;
