import { describe, expect, it } from 'vitest';

import {
  buildBandRanges,
  computeBandEnergies,
  computeBandFlux,
  computeEntropy,
  LeaderBandTracker} from '@/services/leadDetector';

/** 造一段频谱（dB 域）：指定带内 bin 提升 gain dB */
function makeSpec(
  binCount: number,
  bands: { fromHz: number; toHz: number; gainDb: number }[],
  binHz = 11.72,
  baseDb = -95
): Float32Array {
  const spec = new Float32Array(binCount).fill(baseDb);
  for (const b of bands) {
    const lo = Math.floor(b.fromHz / binHz);
    const hi = Math.ceil(b.toHz / binHz);
    for (let i = lo; i < hi && i < binCount; i++) spec[i] = baseDb + b.gainDb;
  }
  return spec;
}

describe('leadDetector 纯函数', () => {
  const binHz = 11.72;
  const binCount = 1024;
  const ranges = buildBandRanges(binHz, binCount);

  it('buildBandRanges：四带 bin 边界覆盖预期 Hz', () => {
    expect(ranges.map((r) => r.name)).toEqual(['low', 'lowmid', 'lead', 'air']);
    expect(ranges[0].startBin).toBe(Math.floor(80 / binHz));
    expect(ranges[2].startBin).toBe(Math.floor(1200 / binHz));
    expect(ranges[3].endBin).toBeLessThanOrEqual(binCount);
  });

  it('computeBandEnergies/Flux：能量集中在某带时该带突出', () => {
    const quiet = makeSpec(binCount, []);
    const loudLead = makeSpec(binCount, [{ fromHz: 1500, toHz: 4000, gainDb: 40 }]);
    const eQuiet = computeBandEnergies(quiet, ranges);
    const eLoud = computeBandEnergies(loudLead, ranges);
    expect(eLoud[2]).toBeGreaterThan(eLoud[1] * 100);
    const prevLin = new Float32Array(binCount);
    for (let i = 0; i < binCount; i++) prevLin[i] = Math.pow(10, quiet[i] / 10);
    const curLin = new Float32Array(binCount);
    for (let i = 0; i < binCount; i++) curLin[i] = Math.pow(10, loudLead[i] / 10);
    const flux = computeBandFlux(prevLin, curLin, ranges);
    expect(flux[2]).toBeGreaterThan(flux[0] * 100);
    expect(flux[2]).toBeGreaterThan(flux[3] * 10);
  });

  it('computeEntropy：单带集中→低熵，均匀铺开→高熵', () => {
    const sparse = new Float32Array([10, 0.01, 0.01, 0.01]);
    const dense = new Float32Array([10, 10, 10, 10]);
    expect(computeEntropy(sparse)).toBeLessThan(0.4);
    expect(computeEntropy(dense)).toBeGreaterThan(0.95);
  });
});

describe('LeaderBandTracker（主导带竞争与起音）', () => {
  const DT = 1 / 30;

  /** 合成一段通量时间线：bands[带序号] = { periodSec, amp }（0=静默）；能量按通量线性对应 */
  function runTimeline(
    seconds: number,
    bands: { periodSec: number; amp: number }[],
    entropy: number,
    tracker = new LeaderBandTracker()
  ): LeadFrame[] {
    const frames: LeadFrame[] = [];
    const n = Math.round(seconds / DT);
    for (let i = 0; i < n; i++) {
      const flux = new Float32Array(4);
      const energies = new Float32Array(4);
      for (let b = 0; b < 4; b++) {
        const cfg = bands[b];
        if (!cfg || cfg.amp <= 0) continue;
        const phase = (i * DT) % cfg.periodSec;
        // 周期性起音：每周期前 1/4 时间是通量脉冲，其余是衰减尾
        flux[b] = phase < cfg.periodSec * 0.25 ? cfg.amp : cfg.amp * 0.03;
        energies[b] = phase < cfg.periodSec * 0.25 ? cfg.amp * 0.1 : cfg.amp * 0.003;
      }
      frames.push(tracker.feed(DT, flux, entropy, energies));
    }
    return frames;
  }

  it('前奏贝斯 solo：低频带周期起音、其他带静默 → 主导带切到低频', () => {
    const tracker = new LeaderBandTracker();
    const frames = runTimeline(
      12,
      [{ periodSec: 0.5, amp: 1.0 }], // 只有低频带（贝斯）在响
      0.3 // 稀疏
    );
    const last = frames[frames.length - 1];
    expect(last.band).toBe(0);
    // 起音帧附近 onset 被触发过（取整个尾段的最大值）
    const recentOnset = Math.max(...frames.slice(-15).map((f) => f.onset));
    expect(recentOnset).toBeGreaterThan(0.9);
    // level 是 EMA（相位敏感），断言尾段窗口峰值
    const recentLevel = Math.max(...frames.slice(-15).map((f) => f.level));
    expect(recentLevel).toBeGreaterThan(0.2);
  });

  it('全奏（高熵）：即使低频活动更强也固定中高频带', () => {
    const tracker = new LeaderBandTracker();
    const frames = runTimeline(
      12,
      [
        { periodSec: 0.5, amp: 1.2 }, // 低频（鼓）更活跃
        { periodSec: 0.6, amp: 0.4 },
        { periodSec: 0.8, amp: 0.5 }
      ],
      0.9 // 全奏
    );
    const last = frames[frames.length - 1];
    expect(last.band).toBe(2);
  });

  it('滞回：主导带切换需要持续胜出，瞬时尖峰不切带', () => {
    const tracker = new LeaderBandTracker();
    // 先让中高频成为主导
    runTimeline(8, [{ periodSec: 1, amp: 0.01 }, { periodSec: 0.5, amp: 1.0 }], 0.3, tracker);
    const frames = runTimeline(12, [{ periodSec: 1, amp: 0.01 }, { periodSec: 0.5, amp: 1.0 }], 0.3, tracker);
    const bandAfterSetup = frames[frames.length - 1].band;
    expect(bandAfterSetup).toBe(1);
    // 低频带突然爆发 0.8s（< 1.5s 滞回窗）→ 不应切带
    const n = Math.round(0.8 / DT);
    let switchedEarly = false;
    for (let i = 0; i < n; i++) {
      const f = tracker.feed(
        DT,
        new Float32Array([5.0, 0.01, 0.3, 0.01]),
        0.3,
        new Float32Array([0.5, 0.001, 0.03, 0.001])
      );
      if (f.band === 0) switchedEarly = true;
    }
    expect(switchedEarly).toBe(false);
    // 持续爆发超过滞回窗 → 切到低频
    const frames2 = runTimeline(4, [{ periodSec: 0.5, amp: 5.0 }], 0.3, tracker);
    expect(frames2[frames2.length - 1].band).toBe(0);
  });

  it('forceBand 跳过预热直接改写主导带', () => {
    const tracker = new LeaderBandTracker();
    tracker.forceBand(0);
    const f = tracker.feed(
      DT,
      new Float32Array([0.5, 0, 0, 0]),
      0.3,
      new Float32Array([0.05, 0, 0, 0])
    );
    expect(f.band).toBe(0);
  });
});
