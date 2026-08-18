import json
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "public" / "audio" / "long-context"
TARGET = ROOT / "public" / "audio" / "long-context-voice.wav"
TIMINGS = ROOT / "src" / "longContextTimings.json"
RATE = 48_000
GAP_SECONDS = 0.12


def resample(samples: np.ndarray, source_rate: int) -> np.ndarray:
    if source_rate == RATE:
        return samples
    source_x = np.arange(len(samples), dtype=np.float64)
    target_length = round(len(samples) * RATE / source_rate)
    target_x = np.linspace(0, max(0, len(samples) - 1), target_length)
    return np.interp(target_x, source_x, samples).astype(np.float32)


script = json.loads((SOURCE / "script.json").read_text(encoding="utf-8"))["entries"]
chunks = []
timings = []
cursor = 0.0

for index, entry in enumerate(script, start=1):
    samples, sample_rate = sf.read(SOURCE / f"segment-{index:02d}.wav", always_2d=True)
    mono = samples.mean(axis=1).astype(np.float32)
    mono = resample(mono, sample_rate)
    peak = float(np.max(np.abs(mono))) if len(mono) else 0.0
    if peak > 0.97:
        mono *= 0.97 / peak
    start = cursor
    end = start + len(mono) / RATE
    timings.append({"start": round(start, 3), "end": round(end, 3), **entry})
    chunks.append(mono)
    if index < len(script):
        gap = np.zeros(round(GAP_SECONDS * RATE), dtype=np.float32)
        chunks.append(gap)
        cursor = end + GAP_SECONDS
    else:
        cursor = end

audio = np.concatenate(chunks)
sf.write(TARGET, audio, RATE, subtype="PCM_16")
TIMINGS.write_text(json.dumps({"duration": round(cursor, 3), "cues": timings}, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"audio": str(TARGET), "duration": round(cursor, 3), "cues": len(timings)}, ensure_ascii=False))
