/**
 * 主线程解码音频并重采样为 8kHz 单声道 PCM。
 * Chromium 的 Worker 作用域没有 OfflineAudioContext（decodeAudioData 必须主线程做），
 * Worker 只承担纯计算。decodeAudioData 会把音频重采样到 context 的采样率。
 */
export async function decodeToMono8k(arrayBuffer: ArrayBuffer): Promise<Float32Array> {
  const OfflineCtx =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  if (!OfflineCtx) throw new Error('OfflineAudioContext unavailable');
  const ctx = new OfflineCtx(1, 1, 8000);
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  return audioBuffer.getChannelData(0);
}
