package com.zephyrus.player;

import androidx.media3.common.C;
import androidx.media3.common.audio.AudioProcessor;
import androidx.media3.common.audio.BaseAudioProcessor;
import androidx.media3.common.util.UnstableApi;

import java.nio.ByteBuffer;

/** PCM headroom, linked peak limiting, three-band analysis and mix shaping. */
@UnstableApi
public final class PeakSafeAudioProcessor extends BaseAudioProcessor {
    public static final class AnalysisSnapshot {
        public final float loudness;
        public final float low;
        public final float mid;
        public final float high;
        public final float bpm;
        /**
         * 本快照窗口内 onset（底鼓起振）相对低频包络的最大倍率，0 表示无 onset。
         * 基于未饱和的原始低通幅度（low > max(0.015, envelope×1.55) 才触发），
         * 供 JS 侧绕过被 ×3 封顶的频段数据直接驱动鼓点响应。
         */
        public final float beatStrength;

        AnalysisSnapshot(float loudness, float low, float mid, float high, float bpm, float beatStrength) {
            this.loudness = loudness;
            this.low = low;
            this.mid = mid;
            this.high = high;
            this.bpm = bpm;
            this.beatStrength = beatStrength;
        }
    }

    private static final float HEADROOM = 0.89125094f; // -1 dBFS
    private static final float LIMIT = 0.985f;
    private volatile float lowGain = 1f;
    private volatile float midGain = 1f;
    private volatile float highGain = 1f;
    private volatile float eqLowGain = 1f;
    private volatile float eqMidGain = 1f;
    private volatile float eqHighGain = 1f;
    private volatile AnalysisSnapshot snapshot = new AnalysisSnapshot(0f, 0f, 0f, 0f, 0f, 0f);

    private float[] lowState = new float[0];
    private float[] highState = new float[0];
    private float[] frameBuffer = new float[0];
    private float limiterGain = 1f;
    private double loudnessSum;
    private double lowSum;
    private double midSum;
    private double highSum;
    private int analysisFrames;
    private long totalFrames;
    private float lowEnvelope;
    private long lastOnsetFrame = -1;
    private float bpm;
    /** 自上次 publishAnalysis 以来 onset 的最大强度（low/包络），publish 时取走并清零 */
    private float pendingBeatStrength;

    @Override
    protected AudioFormat onConfigure(AudioFormat inputAudioFormat)
            throws AudioProcessor.UnhandledAudioFormatException {
        if (inputAudioFormat.encoding != C.ENCODING_PCM_16BIT
                && inputAudioFormat.encoding != C.ENCODING_PCM_FLOAT) {
            throw new AudioProcessor.UnhandledAudioFormatException(inputAudioFormat);
        }
        lowState = new float[inputAudioFormat.channelCount];
        highState = new float[inputAudioFormat.channelCount];
        frameBuffer = new float[inputAudioFormat.channelCount];
        return inputAudioFormat;
    }

    public void setBandGains(float low, float mid, float high) {
        lowGain = clamp(low, 0f, 1.25f);
        midGain = clamp(mid, 0f, 1.25f);
        highGain = clamp(high, 0f, 1.25f);
    }

    public void setEqGains(float low, float mid, float high) {
        eqLowGain = clamp(low, 0.25f, 2f);
        eqMidGain = clamp(mid, 0.25f, 2f);
        eqHighGain = clamp(high, 0.25f, 2f);
    }

    public AnalysisSnapshot getAnalysisSnapshot() {
        return snapshot;
    }

    @Override
    public void queueInput(ByteBuffer inputBuffer) {
        int bytesPerSample = inputAudioFormat.encoding == C.ENCODING_PCM_FLOAT ? 4 : 2;
        int frameBytes = bytesPerSample * inputAudioFormat.channelCount;
        int completeBytes = inputBuffer.remaining() - (inputBuffer.remaining() % frameBytes);
        ByteBuffer output = replaceOutputBuffer(completeBytes);
        int frames = completeBytes / frameBytes;
        float sampleRate = Math.max(1, inputAudioFormat.sampleRate);
        float lowAlpha = 1f - (float) Math.exp(-2d * Math.PI * 250d / sampleRate);
        float highAlpha = 1f - (float) Math.exp(-2d * Math.PI * 4000d / sampleRate);

        for (int frame = 0; frame < frames; frame++) {
            float framePeak = 0f;
            float frameLow = 0f;
            float frameMid = 0f;
            float frameHigh = 0f;

            for (int channel = 0; channel < inputAudioFormat.channelCount; channel++) {
                float sample = inputAudioFormat.encoding == C.ENCODING_PCM_FLOAT
                        ? inputBuffer.getFloat()
                        : inputBuffer.getShort() / 32768f;
                lowState[channel] += lowAlpha * (sample - lowState[channel]);
                highState[channel] += highAlpha * (sample - highState[channel]);
                float low = lowState[channel];
                float mid = highState[channel] - low;
                float high = sample - highState[channel];
                float value = (low * lowGain * eqLowGain
                        + mid * midGain * eqMidGain
                        + high * highGain * eqHighGain) * HEADROOM;
                frameBuffer[channel] = value;
                framePeak = Math.max(framePeak, Math.abs(value));
                frameLow += Math.abs(low);
                frameMid += Math.abs(mid);
                frameHigh += Math.abs(high);
            }

            float targetGain = framePeak > LIMIT ? LIMIT / framePeak : 1f;
            if (targetGain < limiterGain) limiterGain = targetGain;
            else limiterGain += (targetGain - limiterGain) * 0.0008f;

            for (float value : frameBuffer) {
                float limited = clamp(value * limiterGain, -LIMIT, LIMIT);
                loudnessSum += limited * limited;
                if (inputAudioFormat.encoding == C.ENCODING_PCM_FLOAT) output.putFloat(limited);
                else output.putShort((short) Math.round(limited * 32767f));
            }

            frameLow /= inputAudioFormat.channelCount;
            frameMid /= inputAudioFormat.channelCount;
            frameHigh /= inputAudioFormat.channelCount;
            lowSum += frameLow;
            midSum += frameMid;
            highSum += frameHigh;
            analysisFrames++;
            totalFrames++;
            detectBeat(frameLow, sampleRate);
            if (analysisFrames >= 2048) publishAnalysis();
        }
        inputBuffer.position(inputBuffer.position() + (inputBuffer.remaining() % frameBytes));
        output.flip();
    }

    private void detectBeat(float low, float sampleRate) {
        float envelopeBeforeUpdate = lowEnvelope;
        lowEnvelope += (low - lowEnvelope) * 0.0025f;
        long refractoryFrames = (long) (sampleRate * 0.25f);
        if (low > Math.max(0.015f, lowEnvelope * 1.55f)
                && (lastOnsetFrame < 0 || totalFrames - lastOnsetFrame > refractoryFrames)) {
            if (lastOnsetFrame >= 0) {
                float candidate = 60f * sampleRate / (totalFrames - lastOnsetFrame);
                while (candidate < 70f) candidate *= 2f;
                while (candidate > 180f) candidate /= 2f;
                bpm = bpm == 0f ? candidate : bpm * 0.82f + candidate * 0.18f;
            }
            lastOnsetFrame = totalFrames;
            // 用更新前的包络计算突起倍率（更代表冲击强度），窗口内取最大
            float strength = low / Math.max(envelopeBeforeUpdate, 1e-4f);
            if (strength > pendingBeatStrength) pendingBeatStrength = strength;
        }
    }

    private void publishAnalysis() {
        float divisor = Math.max(1, analysisFrames);
        float channels = Math.max(1, inputAudioFormat.channelCount);
        snapshot = new AnalysisSnapshot(
                clamp((float) Math.sqrt(loudnessSum / (divisor * channels)) * 2.2f, 0f, 1f),
                clamp((float) (lowSum / divisor) * 3f, 0f, 1f),
                clamp((float) (midSum / divisor) * 3f, 0f, 1f),
                clamp((float) (highSum / divisor) * 3f, 0f, 1f),
                bpm,
                pendingBeatStrength);
        loudnessSum = lowSum = midSum = highSum = 0d;
        analysisFrames = 0;
        pendingBeatStrength = 0f;
    }

    @Override
    protected void onFlush() {
        limiterGain = 1f;
        loudnessSum = lowSum = midSum = highSum = 0d;
        analysisFrames = 0;
        pendingBeatStrength = 0f;
        for (int i = 0; i < lowState.length; i++) {
            lowState[i] = 0f;
            highState[i] = 0f;
        }
    }

    private static float clamp(float value, float min, float max) {
        return Math.max(min, Math.min(max, value));
    }
}
