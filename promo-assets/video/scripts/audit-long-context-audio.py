from __future__ import annotations

import json
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
from faster_whisper import WhisperModel


ROOT = Path(__file__).resolve().parents[1]
AUDIO_DIR = ROOT / "public" / "audio" / "long-context"
REPORT_PATH = ROOT / "out" / "long-context-audio-audit.json"
BGM_PATH = ROOT / "public" / "audio" / "deadman-instrumental.mp3"
BGM_REPORT_PATH = ROOT / "out" / "long-context-bgm-audit.json"


def signal_metrics(path: Path) -> dict[str, float | int | bool]:
    audio, sample_rate = sf.read(path, dtype="float32", always_2d=False)
    if audio.ndim > 1:
        audio = audio.mean(axis=1)

    frame_length = max(256, int(sample_rate * 0.05))
    hop_length = max(128, int(sample_rate * 0.025))
    rms = librosa.feature.rms(
        y=audio, frame_length=frame_length, hop_length=hop_length
    )[0]
    active = rms[rms > max(0.002, np.percentile(rms, 20))]
    median_active = float(np.median(active)) if active.size else 0.0
    p99_active = float(np.percentile(active, 99)) if active.size else 0.0
    burst_db = 20 * np.log10((p99_active + 1e-9) / (median_active + 1e-9))

    spectrum = np.abs(librosa.stft(audio, n_fft=2048, hop_length=512)) ** 2
    frequencies = librosa.fft_frequencies(sr=sample_rate, n_fft=2048)
    high_energy = float(spectrum[frequencies >= 8000].sum())
    total_energy = float(spectrum.sum()) + 1e-12

    peak = float(np.max(np.abs(audio)))
    clipping_rate = float(np.mean(np.abs(audio) >= 0.99))
    high_frequency_ratio = high_energy / total_energy
    suspicious = clipping_rate > 0.0001 or burst_db > 20 or high_frequency_ratio > 0.12

    return {
        "sample_rate": sample_rate,
        "duration_seconds": round(len(audio) / sample_rate, 3),
        "peak": round(peak, 5),
        "clipping_rate": round(clipping_rate, 8),
        "p99_to_median_active_db": round(float(burst_db), 2),
        "high_frequency_ratio": round(high_frequency_ratio, 5),
        "suspicious_signal": bool(suspicious),
    }


def main() -> None:
    files = sorted(AUDIO_DIR.glob("segment-*.wav"))
    model = WhisperModel("tiny", device="cpu", compute_type="int8")
    report = []

    for path in files:
        metrics = signal_metrics(path)
        segments, info = model.transcribe(
            str(path), language="zh", vad_filter=True, beam_size=5
        )
        text = "".join(segment.text.strip() for segment in segments)
        report.append(
            {
                "file": path.name,
                **metrics,
                "detected_language_probability": round(info.language_probability, 4),
                "transcript": text,
            }
        )
        print(
            f"{path.name}: suspicious={metrics['suspicious_signal']} "
            f"burst={metrics['p99_to_median_active_db']}dB "
            f"hf={metrics['high_frequency_ratio']} transcript={text}"
        )

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Report: {REPORT_PATH}")

    bgm_segments, bgm_info = model.transcribe(
        str(BGM_PATH), language="zh", vad_filter=True, beam_size=5
    )
    bgm_transcript = "".join(segment.text.strip() for segment in bgm_segments)
    bgm_report = {
        "file": BGM_PATH.name,
        "detected_language_probability": round(bgm_info.language_probability, 4),
        "transcript": bgm_transcript,
        "recognizable_voice_detected": bool(bgm_transcript.strip()),
    }
    BGM_REPORT_PATH.write_text(
        json.dumps(bgm_report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"BGM report: {BGM_REPORT_PATH} transcript={bgm_transcript}")


if __name__ == "__main__":
    main()
