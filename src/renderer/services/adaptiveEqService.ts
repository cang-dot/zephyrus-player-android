import { audioService } from './audioService';

export type AdaptiveEqFeatures = {
  low: number;
  mid: number;
  high: number;
  loudness?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function resolveAdaptiveEqGains(features: AdaptiveEqFeatures, intensity: number) {
  const level = clamp(intensity, 0, 1);
  const low = clamp(features.low, 0, 1);
  const mid = clamp(features.mid, 0, 1);
  const high = clamp(features.high, 0, 1);
  const average = Math.max(0.06, (low + mid + high) / 3);
  const bassShape = clamp((mid - low) / average, -1, 1);
  const vocalShape = clamp((mid - (low + high) / 2) / average, -1, 1);
  const airShape = clamp((low + mid - high) / average, -1, 1);

  return {
    low: clamp(1 + bassShape * 0.16 * level, 0.75, 1.25),
    mid: clamp(1 + vocalShape * 0.11 * level, 0.75, 1.25),
    high: clamp(1 + airShape * 0.09 * level, 0.75, 1.25)
  };
}

class AdaptiveEqService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private gains = { low: 1, mid: 1, high: 1 };

  setEnabled(enabled: boolean) {
    audioService.setAdaptiveEQEnabled(enabled);
    if (enabled) this.start();
    else this.stop();
  }

  setIntensity(intensity: number) {
    audioService.setAdaptiveEQIntensity(intensity);
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 100);
    this.tick();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.gains = { low: 1, mid: 1, high: 1 };
    audioService.setAdaptiveEQGains(1, 1, 1);
  }

  private tick() {
    if (!audioService.isAdaptiveEQEnabled()) return;
    const sound = audioService.getCurrentSound();
    if (!sound?.playing()) return;
    const next = resolveAdaptiveEqGains(
      audioService.getBandEnergies(),
      audioService.getAdaptiveEQIntensity()
    );
    this.gains = {
      low: this.gains.low * 0.72 + next.low * 0.28,
      mid: this.gains.mid * 0.72 + next.mid * 0.28,
      high: this.gains.high * 0.72 + next.high * 0.28
    };
    audioService.setAdaptiveEQGains(this.gains.low, this.gains.mid, this.gains.high);
  }
}

export const adaptiveEqService = new AdaptiveEqService();
