// src/renderer/utils/audio/structureAnalysis.ts
var PITCH_CLASSES = 12;
function fftInPlace(re, im) {
  const n = re.length;
  if (n <= 1 || (n & n - 1) !== 0) return;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k];
        const ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}
function computeFrameFeatures(pcm, sampleRate, windowSec = 1, hopSec = 0.5) {
  const windowSize = Math.round(windowSec * sampleRate);
  const hopSize = Math.max(1, Math.round(hopSec * sampleRate));
  const numFrames = Math.max(0, Math.floor((pcm.length - windowSize) / hopSize) + 1);
  const fftSize = 1 << Math.ceil(Math.log2(Math.max(2, windowSize)));
  const halfSpec = fftSize / 2;
  const energy = new Float32Array(numFrames);
  const chroma = [];
  const fftRe = new Float32Array(fftSize);
  const fftIm = new Float32Array(fftSize);
  const hann = new Float32Array(windowSize);
  for (let i = 0; i < windowSize; i++) hann[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (windowSize - 1));
  for (let f = 0; f < numFrames; f++) {
    const start = f * hopSize;
    let sumSq = 0;
    for (let i = 0; i < windowSize; i++) {
      const s = pcm[start + i] * hann[i];
      fftRe[i] = s;
      fftIm[i] = 0;
      sumSq += s * s;
    }
    for (let i = windowSize; i < fftSize; i++) {
      fftRe[i] = 0;
      fftIm[i] = 0;
    }
    energy[f] = Math.sqrt(sumSq / windowSize);
    fftInPlace(fftRe, fftIm);
    const c = new Float32Array(PITCH_CLASSES);
    const minHz = 60;
    const maxHz = Math.min(4e3, sampleRate / 2 - 100);
    const binHz = sampleRate / fftSize;
    const minBin = Math.max(1, Math.floor(minHz / binHz));
    const maxBin = Math.min(halfSpec - 1, Math.ceil(maxHz / binHz));
    for (let bin = minBin; bin <= maxBin; bin++) {
      const mag = Math.sqrt(fftRe[bin] * fftRe[bin] + fftIm[bin] * fftIm[bin]);
      const hz = bin * binHz;
      const midi = 69 + 12 * Math.log2(hz / 440);
      const pc = (Math.round(midi) % PITCH_CLASSES + PITCH_CLASSES) % PITCH_CLASSES;
      c[pc] += mag;
    }
    let norm = 0;
    for (let i = 0; i < PITCH_CLASSES; i++) norm += c[i] * c[i];
    norm = Math.sqrt(norm);
    if (norm > 1e-9) for (let i = 0; i < PITCH_CLASSES; i++) c[i] /= norm;
    chroma.push(c);
  }
  return { hopSec, energy, chroma };
}
function computeNovelty(features, halfWindowSec = 4) {
  const { chroma, hopSec } = features;
  const n = chroma.length;
  const L = Math.max(2, Math.round(halfWindowSec / hopSec));
  const novelty = new Float32Array(n);
  const prefix = new Float32Array((n + 1) * PITCH_CLASSES);
  for (let i = 0; i < n; i++) {
    const c = chroma[i];
    for (let k = 0; k < PITCH_CLASSES; k++) {
      prefix[(i + 1) * PITCH_CLASSES + k] = prefix[i * PITCH_CLASSES + k] + c[k];
    }
  }
  const windowMean = (lo, hi, out) => {
    const loC = Math.max(0, lo);
    const hiC = Math.min(n, hi);
    const count = Math.max(1, hiC - loC);
    for (let k = 0; k < PITCH_CLASSES; k++) {
      out[k] = (prefix[hiC * PITCH_CLASSES + k] - prefix[loC * PITCH_CLASSES + k]) / count;
    }
  };
  const a = new Float32Array(PITCH_CLASSES);
  const b = new Float32Array(PITCH_CLASSES);
  for (let i = 0; i < n; i++) {
    windowMean(i - L, i, a);
    windowMean(i, i + L, b);
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let k = 0; k < PITCH_CLASSES; k++) {
      dot += a[k] * b[k];
      na += a[k] * a[k];
      nb += b[k] * b[k];
    }
    novelty[i] = 1 - dot / Math.sqrt(Math.max(1e-9, na * nb));
  }
  return novelty;
}
function pickBoundaries(novelty, hopSec, duration, minGapSec = 12) {
  const n = novelty.length;
  if (n < 3) return [];
  let mean = 0;
  for (let i = 0; i < n; i++) mean += novelty[i];
  mean /= n;
  let variance = 0;
  for (let i = 0; i < n; i++) variance += (novelty[i] - mean) ** 2;
  const std = Math.sqrt(variance / n);
  const threshold = mean + 0.8 * std;
  const peaks = [];
  for (let i = 1; i < n - 1; i++) {
    if (novelty[i] >= threshold && novelty[i] >= novelty[i - 1] && novelty[i] >= novelty[i + 1]) {
      peaks.push({ time: i * hopSec, value: novelty[i] });
    }
  }
  peaks.sort((x, y) => y.value - x.value);
  const kept = [];
  const minGap = minGapSec;
  for (const peak of peaks) {
    if (peak.time < minGapSec * 0.5 || peak.time > duration - minGapSec * 0.5) continue;
    if (kept.every((t) => Math.abs(t - peak.time) >= minGap)) kept.push(peak.time);
  }
  kept.sort((x, y) => x - y);
  return kept;
}
function cosineSim(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / Math.sqrt(Math.max(1e-9, na * nb));
}
function selectChorusSegments(features, duration, options) {
  const minSegmentSec = options?.minSegmentSec ?? 15;
  const { chroma, energy, hopSec } = features;
  const n = chroma.length;
  if (n < 8) return { segments: [], confidence: 0 };
  const minLag = Math.max(2, Math.round((options?.minLagSec ?? 12) / hopSec));
  const maxLag = Math.min(
    Math.round((options?.maxLagSec ?? 100) / hopSec),
    Math.floor(n / 2)
  );
  if (maxLag <= minLag) return { segments: [], confidence: 0 };
  const lagScores = new Float32Array(maxLag + 1);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    let count = 0;
    for (let i = 0; i + lag < n; i += 2) {
      sum += cosineSim(chroma[i], chroma[i + lag]);
      count++;
    }
    lagScores[lag] = count ? sum / count : 0;
  }
  let bestLag = -1;
  let bestScore = -Infinity;
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    const smoothed = (lagScores[lag - 1] + lagScores[lag] * 2 + lagScores[lag + 1]) / 4;
    if (smoothed > bestScore) {
      bestScore = smoothed;
      bestLag = lag;
    }
  }
  if (bestLag < 0) return { segments: [], confidence: 0 };
  const localSim = new Float32Array(n);
  const halfWin = Math.max(2, Math.round(2 / hopSec));
  for (let i = 0; i < n; i++) {
    if (i + bestLag >= n) break;
    let sum = 0;
    let count = 0;
    for (let k = -halfWin; k <= halfWin; k++) {
      const j = i + k;
      if (j < 0 || j + bestLag >= n) continue;
      sum += cosineSim(chroma[j], chroma[j + bestLag]);
      count++;
    }
    localSim[i] = count ? sum / count : 0;
  }
  let mean = 0;
  for (let i = 0; i < n; i++) mean += localSim[i];
  mean /= n;
  let variance = 0;
  for (let i = 0; i < n; i++) variance += (localSim[i] - mean) ** 2;
  const std = Math.sqrt(variance / n);
  const threshold = Math.max(0.78, mean + 0.6 * std);
  const pairs = [];
  let runStart = -1;
  for (let i = 0; i <= n; i++) {
    const high = i < n && localSim[i] >= threshold;
    if (high && runStart < 0) runStart = i;
    if (!high && runStart >= 0) {
      const len = i - runStart;
      if (len >= Math.round(6 / hopSec)) {
        const a = { start: runStart * hopSec, end: i * hopSec };
        const b = { start: a.start + bestLag * hopSec, end: a.end + bestLag * hopSec };
        pairs.push({ a, b });
      }
      runStart = -1;
    }
  }
  if (runStart >= 0 && n - runStart >= Math.round(6 / hopSec)) {
    const a = { start: runStart * hopSec, end: n * hopSec };
    const b = { start: a.start + bestLag * hopSec, end: a.end + bestLag * hopSec };
    pairs.push({ a, b });
  }
  const meanEnergyAt = (s) => {
    const lo = Math.max(0, Math.floor(s.start / hopSec));
    const hi = Math.min(energy.length, Math.ceil(s.end / hopSec));
    let sum = 0;
    for (let i = lo; i < hi; i++) sum += energy[i];
    return sum / Math.max(1, hi - lo);
  };
  let candidates = [];
  let peakSim = 0;
  for (const { a, b } of pairs) {
    const aOk = a.start >= 0 && a.end <= duration && a.end - a.start >= minSegmentSec;
    const bOk = b.start >= 0 && b.end <= duration && b.end - b.start >= minSegmentSec;
    if (!aOk && !bOk) continue;
    const chosen = !aOk ? b : !bOk ? a : meanEnergyAt(a) >= meanEnergyAt(b) ? a : b;
    candidates.push(expandByEnergy({ start: chosen.start, end: chosen.end }, energy, hopSec, duration));
    const lo = Math.max(0, Math.floor(chosen.start / hopSec));
    const hi = Math.min(n - 1, Math.ceil(chosen.end / hopSec));
    for (let i = lo; i <= hi; i++) peakSim = Math.max(peakSim, localSim[i]);
  }
  candidates = normalizeSegments(candidates, duration, minSegmentSec);
  if (candidates.length) {
    const globalEnergy = energy.reduce((s, v) => s + v, 0) / energy.length;
    const chorusEnergy = candidates.reduce((s, seg) => s + meanEnergyAt(seg), 0) / candidates.length;
    const energyMargin = Math.max(
      0,
      Math.min(1, (chorusEnergy - globalEnergy) / (globalEnergy + 1e-9))
    );
    const confidence = Math.max(0.2, Math.min(0.95, peakSim * 0.6 + energyMargin * 0.4));
    return { segments: candidates, confidence };
  }
  const fallback = findHighEnergyStretch(energy, hopSec, duration, minSegmentSec);
  return fallback ? { segments: [fallback], confidence: 0.3 } : { segments: [], confidence: 0 };
}
function expandByEnergy(seg, energy, hopSec, duration) {
  const smoothSpan = Math.max(1, Math.round(3 / hopSec));
  const smooth = new Float32Array(energy.length);
  let running = 0;
  for (let i = 0; i < energy.length; i++) {
    running += energy[i];
    if (i >= smoothSpan) running -= energy[i - smoothSpan];
    smooth[i] = running / Math.min(i + 1, smoothSpan);
  }
  let mean = 0;
  for (let i = 0; i < smooth.length; i++) mean += smooth[i];
  mean /= smooth.length;
  let variance = 0;
  for (let i = 0; i < smooth.length; i++) variance += (smooth[i] - mean) ** 2;
  const std = Math.sqrt(variance / smooth.length);
  const segEnergy = (() => {
    const lo = Math.max(0, Math.floor(seg.start / hopSec));
    const hi = Math.min(energy.length, Math.ceil(seg.end / hopSec));
    let sum = 0;
    for (let i = lo; i < hi; i++) sum += energy[i];
    return sum / Math.max(1, hi - lo);
  })();
  const threshold = Math.max(segEnergy * 0.8, mean + 0.3 * std);
  const maxWalk = Math.round(30 / hopSec);
  const gapTolerance = Math.round(3 / hopSec);
  const expand = (dir) => {
    let idx = dir === -1 ? Math.floor(seg.start / hopSec) : Math.ceil(seg.end / hopSec);
    let gap = 0;
    let lastGood = idx;
    for (let step = 0; step < maxWalk; step++) {
      idx += dir;
      if (idx < 0 || idx >= energy.length) break;
      if (smooth[idx] >= threshold) {
        lastGood = idx;
        gap = 0;
      } else {
        gap++;
        if (gap > gapTolerance) break;
      }
    }
    return lastGood;
  };
  const loFrame = expand(-1);
  const hiFrame = expand(1);
  const result = {
    start: Math.max(0, Math.min(duration, loFrame * hopSec)),
    end: Math.max(0, Math.min(duration, (hiFrame + 1) * hopSec))
  };
  return result.end - result.start >= seg.end - seg.start ? result : seg;
}
function findHighEnergyStretch(energy, hopSec, duration, minSegmentSec) {
  if (!energy.length) return null;
  const smoothSpan = Math.max(1, Math.round(3 / hopSec));
  const smooth = new Float32Array(energy.length);
  let running = 0;
  for (let i = 0; i < energy.length; i++) {
    running += energy[i];
    if (i >= smoothSpan) running -= energy[i - smoothSpan];
    smooth[i] = running / Math.min(i + 1, smoothSpan);
  }
  let mean = 0;
  for (let i = 0; i < smooth.length; i++) mean += smooth[i];
  mean /= smooth.length;
  let variance = 0;
  for (let i = 0; i < smooth.length; i++) variance += (smooth[i] - mean) ** 2;
  const std = Math.sqrt(variance / smooth.length);
  const threshold = mean + 0.4 * std;
  let best = null;
  let start = -1;
  let gap = 0;
  const maxGap = Math.max(1, Math.round(2 / hopSec));
  for (let i = 0; i < smooth.length; i++) {
    if (smooth[i] >= threshold) {
      if (start < 0) start = i;
      gap = 0;
    } else if (start >= 0) {
      gap++;
      if (gap > maxGap) {
        const end = i - gap;
        if (!best || end - start > best.end - best.start) {
          best = { start: start * hopSec, end: end * hopSec };
        }
        start = -1;
        gap = 0;
      }
    }
  }
  if (start >= 0) {
    const end = Math.min(smooth.length - 1, Math.round(duration / hopSec));
    if (!best || end - start > best.end - best.start) {
      best = { start: start * hopSec, end: end * hopSec };
    }
  }
  if (!best) return null;
  best.end = Math.min(best.end, duration);
  best.start = Math.max(0, best.start);
  if (best.end - best.start < minSegmentSec) return null;
  return best;
}
function normalizeSegments(input, duration, minSegmentSec = 15) {
  const sorted = [...input].map((s) => ({
    start: Math.max(0, Math.min(duration, s.start)),
    end: Math.max(0, Math.min(duration, s.end))
  })).filter((s) => s.end > s.start).sort((a, b) => a.start - b.start);
  const merged = [];
  for (const seg of sorted) {
    const prev = merged[merged.length - 1];
    if (prev && seg.start - prev.end < minSegmentSec * 0.4) {
      prev.end = Math.max(prev.end, seg.end);
    } else {
      merged.push({ ...seg });
    }
  }
  const minLen = Math.min(minSegmentSec, duration / 4);
  return merged.filter((s) => s.end - s.start >= Math.min(8, minLen));
}
export {
  computeFrameFeatures,
  computeNovelty,
  fftInPlace,
  findHighEnergyStretch,
  normalizeSegments,
  pickBoundaries,
  selectChorusSegments
};
