from pathlib import Path

import numpy as np
import soundfile as sf
import torch
from demucs.apply import apply_model
from demucs.pretrained import get_model


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "audio" / "deadman-source.wav"
OUTPUT = ROOT / "public" / "audio" / "deadman-stems"


audio, sample_rate = sf.read(SOURCE, dtype="float32", always_2d=True)
model = get_model(name="htdemucs")
model.eval()

if sample_rate != model.samplerate:
    raise RuntimeError(f"Expected {model.samplerate} Hz, got {sample_rate} Hz")

waveform = torch.from_numpy(audio.T)
reference = waveform.mean(0)
mean = reference.mean()
std = reference.std().clamp_min(1e-8)
normalized = (waveform - mean) / std

with torch.no_grad():
    separated = apply_model(
        model,
        normalized[None],
        device="cpu",
        shifts=1,
        split=True,
        overlap=0.25,
        progress=True,
    )[0]

separated = separated * std + mean
names = list(model.sources)
OUTPUT.mkdir(parents=True, exist_ok=True)

for name, stem in zip(names, separated):
    sf.write(OUTPUT / f"{name}.wav", stem.T.cpu().numpy(), sample_rate, subtype="PCM_16")

vocals_index = names.index("vocals")
instrumental = separated[[index for index in range(len(names)) if index != vocals_index]].sum(0)
peak = float(instrumental.abs().max())
if peak > 0.98:
    instrumental *= 0.98 / peak
sf.write(OUTPUT / "no_vocals.wav", instrumental.T.cpu().numpy(), sample_rate, subtype="PCM_16")
print({"sources": names, "duration": round(audio.shape[0] / sample_rate, 2), "peak": peak})
