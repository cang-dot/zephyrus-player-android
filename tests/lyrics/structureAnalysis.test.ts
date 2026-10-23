import { describe, expect, it } from 'vitest';

import {
  computeFrameFeatures,
  findHighEnergyStretch,
  findHighEnergyStretches,
  normalizeSegments,
  selectChorusSegments
} from '@/utils/audio/structureAnalysis';

interface Section {
  /** 段落总时长（秒），按 5s 一个和弦展开 */
  sec: number;
  /** 和声进行：每 5s 一个二音和弦；段内和弦必须互不相同（否则段内自相似会污染滞后轮廓） */
  prog: number[][];
  gain: number;
}

/** 常用二音和弦（根音+纯五度），音高类互不重叠，保证跨和弦色度余弦接近 0 */
const CH = {
  Am: [220, 330],
  Bb: [233, 349],
  B: [247, 370],
  C: [262, 392],
  Dm: [294, 440],
  E: [330, 494],
  F: [349, 523],
  G: [392, 587]
} as const;

/** 按段落表合成 PCM：5s 一个和弦的和声进行 + 能量包络 */
function makeSectionsPcm(sections: Section[], sampleRate = 8000): Float32Array {
  const total = sections.reduce((s, x) => s + x.sec, 0);
  const pcm = new Float32Array(Math.round(total * sampleRate));
  const subLen = Math.round(5 * sampleRate);
  let offset = 0;
  for (const sec of sections) {
    const chordCount = Math.round(sec.sec / 5);
    for (let c = 0; c < chordCount; c++) {
      const freqs = sec.prog[c % sec.prog.length];
      for (let i = 0; i < subLen && offset + i < pcm.length; i++) {
        const t = i / sampleRate;
        let v = 0;
        for (const f of freqs) v += Math.sin(2 * Math.PI * f * t);
        pcm[offset + i] = (v / freqs.length) * sec.gain;
      }
      offset += subLen;
    }
  }
  return pcm;
}

/** 双遍副歌合成：两遍主歌进行不同、副歌完全相同 → 周期 50s */
function makeDoubleChorusSections(): Section[] {
  return [
    { sec: 10, prog: [CH.Am, CH.Bb], gain: 0.15 }, // 前奏 0-10
    { sec: 20, prog: [CH.C, CH.Dm, CH.Am, CH.Bb], gain: 0.2 }, // 主歌1 10-30
    { sec: 30, prog: [CH.F, CH.G, CH.E, CH.Bb, CH.C, CH.Dm], gain: 0.5 }, // 副歌 30-60
    { sec: 20, prog: [CH.Dm, CH.C, CH.G, CH.Am], gain: 0.2 }, // 主歌2 60-80（进行与主歌1不同）
    { sec: 30, prog: [CH.F, CH.G, CH.E, CH.Bb, CH.C, CH.Dm], gain: 0.5 }, // 副歌 80-110
    { sec: 10, prog: [CH.B, CH.E], gain: 0.12 } // 尾奏 110-120
  ];
}

describe('structureAnalysis (DSP auto climax)', () => {
  it('computeFrameFeatures: 能量与色度帧数对齐 hop', () => {
    const sampleRate = 8000;
    const pcm = new Float32Array(sampleRate * 20); // 20s 静音
    for (let i = 0; i < pcm.length; i++) pcm[i] = i % 100 < 50 ? 0.3 : -0.3;
    const features = computeFrameFeatures(pcm, sampleRate, 1.0, 0.5);
    expect(features.energy.length).toBeGreaterThan(30);
    expect(features.chroma.length).toBe(features.energy.length);
    // 每帧色度单位化
    for (const c of features.chroma) {
      const norm = Math.sqrt(c.reduce((s, v) => s + v * v, 0));
      expect(norm).toBeCloseTo(1, 3);
    }
  });

  it('副歌定位：两遍副歌各输出一段（每对重复两侧都保留）', () => {
    const sampleRate = 8000;
    const pcm = makeSectionsPcm(makeDoubleChorusSections());
    const features = computeFrameFeatures(pcm, sampleRate, 1.0, 0.5);
    const duration = pcm.length / sampleRate; // 120s，副歌 30-60 与 80-110（周期 50s）

    const { segments, confidence } = selectChorusSegments(features, duration);
    expect(segments.length).toBe(2);
    expect(confidence).toBeGreaterThan(0);
    // 两个真实副歌的中点都要被命中
    for (const mid of [45, 95]) {
      expect(segments.some((s) => s.start <= mid && s.end >= mid)).toBe(true);
    }
  }, 20000);

  it('副歌定位：三遍副歌输出三段', () => {
    const sampleRate = 8000;
    const chorus: Section = {
      sec: 20,
      prog: [CH.F, CH.G, CH.E, CH.Bb],
      gain: 0.5
    };
    const sections: Section[] = [
      { sec: 10, prog: [CH.Am, CH.Bb], gain: 0.15 }, // 前奏 0-10
      { sec: 15, prog: [CH.C, CH.Dm, CH.Am], gain: 0.2 }, // 主歌1 10-25
      chorus, // 25-45
      { sec: 15, prog: [CH.Dm, CH.C, CH.G], gain: 0.2 }, // 主歌2 45-60
      chorus, // 60-80
      { sec: 15, prog: [CH.G, CH.Am, CH.Bb], gain: 0.2 }, // 主歌3 80-95
      chorus, // 95-115
      { sec: 10, prog: [CH.B, CH.E], gain: 0.12 } // 尾奏 115-125
    ];
    const pcm = makeSectionsPcm(sections);
    const features = computeFrameFeatures(pcm, sampleRate, 1.0, 0.5);
    const { segments } = selectChorusSegments(features, pcm.length / sampleRate);
    expect(segments.length).toBe(3);
    for (const mid of [35, 70, 105]) {
      expect(segments.some((s) => s.start <= mid && s.end >= mid)).toBe(true);
    }
  }, 20000);

  it('副歌定位：两组不同周期的重复结构都被检出', () => {
    const sampleRate = 8000;
    const sections: Section[] = [
      { sec: 10, prog: [CH.Am, CH.Bb], gain: 0.15 }, // 前奏 0-10
      { sec: 20, prog: [CH.F, CH.G, CH.E, CH.Bb], gain: 0.5 }, // A1 10-30
      { sec: 15, prog: [CH.C, CH.Dm, CH.Am], gain: 0.15 }, // 补白 30-45
      { sec: 20, prog: [CH.F, CH.G, CH.E, CH.Bb], gain: 0.5 }, // A2 45-65（周期 35s）
      { sec: 15, prog: [CH.Dm, CH.G, CH.C], gain: 0.15 }, // 补白 65-80
      { sec: 20, prog: [CH.C, CH.Dm, CH.Am, CH.Bb], gain: 0.45 }, // B1 80-100
      { sec: 30, prog: [CH.E, CH.B, CH.Am, CH.G, CH.Bb, CH.C], gain: 0.15 }, // 补白 100-130
      { sec: 20, prog: [CH.C, CH.Dm, CH.Am, CH.Bb], gain: 0.45 }, // B2 130-150（周期 50s）
      { sec: 15, prog: [CH.B, CH.E, CH.Am], gain: 0.12 } // 尾奏 150-165
    ];
    const pcm = makeSectionsPcm(sections);
    const features = computeFrameFeatures(pcm, sampleRate, 1.0, 0.5);
    const { segments } = selectChorusSegments(features, pcm.length / sampleRate);
    // A 组两段 + B 组两段
    expect(segments.length).toBe(4);
    for (const mid of [20, 55, 90, 140]) {
      expect(segments.some((s) => s.start <= mid && s.end >= mid)).toBe(true);
    }
  }, 20000);

  it('能量兜底：无重复特征时找到最长高能量区间', () => {
    const hopSec = 0.5;
    const frames = 200; // 100s
    const energy = new Float32Array(frames).fill(0.1);
    for (let i = 80; i < 150; i++) energy[i] = 0.6; // 40s~75s 高能量平台
    const stretch = findHighEnergyStretch(energy, hopSec, frames * hopSec, 15);
    expect(stretch).not.toBeNull();
    expect(stretch!.start).toBeGreaterThanOrEqual(39);
    expect(stretch!.end).toBeLessThanOrEqual(76);
    expect(stretch!.end - stretch!.start).toBeGreaterThanOrEqual(15);
  });

  it('能量兜底：输出至多两个最长高能量区间', () => {
    const hopSec = 0.5;
    const frames = 400; // 200s
    const energy = new Float32Array(frames).fill(0.1);
    for (let i = 40; i < 120; i++) energy[i] = 0.6; // 20s~60s（40s 平台）
    for (let i = 240; i < 300; i++) energy[i] = 0.5; // 120s~150s（30s 平台）
    const stretches = findHighEnergyStretches(energy, hopSec, frames * hopSec, 15, 2);
    expect(stretches.length).toBe(2);
    expect(stretches[0].start).toBeLessThanOrEqual(21);
    expect(stretches[0].end).toBeGreaterThanOrEqual(59);
    expect(stretches[1].start).toBeGreaterThanOrEqual(119);
    expect(stretches[1].end).toBeGreaterThanOrEqual(149);
  });

  it('normalizeSegments: 截断/合并/最小段长', () => {
    const merged = normalizeSegments(
      [
        { start: 5, end: 20 },
        { start: 22, end: 40 }, // 间隔 2 < 15*0.4 → 合并
        { start: 50, end: 56 }, // 6s < 最小 8s → 丢弃
        { start: 200, end: 300 } // 截断到 duration
      ],
      120,
      15
    );
    expect(merged.length).toBe(1);
    expect(merged[0].start).toBe(5);
    expect(merged[0].end).toBe(40);
  });
});
