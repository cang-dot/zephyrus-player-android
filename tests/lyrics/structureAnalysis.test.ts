import { describe, expect, it } from 'vitest';

import {
  computeFrameFeatures,
  computeNovelty,
  findHighEnergyStretch,
  normalizeSegments,
  pickBoundaries,
  selectChorusSegments
} from '@/utils/audio/structureAnalysis';

/** 合成 PCM：不同音高类占优的正弦段（副歌段用固定和弦，主歌段换音），加能量包络 */
function makeSyntheticPcm(sampleRate = 8000): {
  pcm: Float32Array;
  chorus: { start: number; end: number };
} {
  const sections: { sec: number; freqs: number[]; gain: number }[] = [
    { sec: 10, freqs: [220, 277], gain: 0.15 }, // 前奏 Am
    { sec: 20, freqs: [262, 330], gain: 0.2 }, // 主歌 C
    { sec: 30, freqs: [349, 440, 523], gain: 0.5 }, // 副歌 F（高能量）
    { sec: 20, freqs: [262, 330], gain: 0.2 }, // 主歌 C（重复）
    { sec: 30, freqs: [349, 440, 523], gain: 0.5 }, // 副歌 F（重复）
    { sec: 10, freqs: [220, 277], gain: 0.12 } // 尾奏
  ];
  const total = sections.reduce((s, x) => s + x.sec, 0);
  const pcm = new Float32Array(Math.round(total * sampleRate));
  let offset = 0;
  let chorusStart = 0;
  let chorusEnd = 0;
  for (const sec of sections) {
    if (sec.gain > 0.4 && !chorusStart) chorusStart = offset / sampleRate;
    if (chorusStart && !chorusEnd && sec.gain <= 0.4 && chorusStart) chorusEnd = offset / sampleRate;
    const len = Math.round(sec.sec * sampleRate);
    for (let i = 0; i < len; i++) {
      const t = i / sampleRate;
      let v = 0;
      for (const f of sec.freqs) v += Math.sin(2 * Math.PI * f * t);
      pcm[offset + i] = (v / sec.freqs.length) * sec.gain;
    }
    offset += len;
  }
  if (!chorusEnd) chorusEnd = total;
  return { pcm, chorus: { start: chorusStart, end: chorusEnd } };
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

  it('副歌定位：重复的高能量段被选中，边界落在换段附近', () => {
    const sampleRate = 8000;
    const { pcm, chorus } = makeSyntheticPcm(sampleRate);
    const features = computeFrameFeatures(pcm, sampleRate, 1.0, 0.5);
    const novelty = computeNovelty(features, 4);
    const duration = pcm.length / sampleRate; // 120s
    const boundaries = pickBoundaries(novelty, features.hopSec, duration, 12);
    expect(boundaries.length).toBeGreaterThanOrEqual(3);

    const { segments, confidence } = selectChorusSegments(features, boundaries, duration);
    expect(segments.length).toBeGreaterThanOrEqual(1);
    expect(confidence).toBeGreaterThan(0);
    // 至少一个结果段与真实副歌重叠超过一半
    const chorusMid = (chorus.start + chorus.end) / 2;
    const hit = segments.some((s) => s.start <= chorusMid && s.end >= chorusMid);
    expect(hit).toBe(true);
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
