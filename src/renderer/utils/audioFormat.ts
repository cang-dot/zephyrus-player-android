/** 音频参数展示片段：来源为容器静态元数据与引擎实际解码格式的合并结果。 */

export interface AudioParamSource {
  mime?: string | null;
  sampleRate?: number | null;
  channelCount?: number | null;
  bitrate?: number | null;
  fileSize?: number | null;
}

const MIME_LABELS: Record<string, string> = {
  'audio/mpeg': 'MP3',
  'audio/mp3': 'MP3',
  'audio/flac': 'FLAC',
  'audio/x-flac': 'FLAC',
  'audio/mp4a-latm': 'AAC',
  'audio/aac': 'AAC',
  'audio/mp4': 'M4A',
  'audio/x-m4a': 'M4A',
  'audio/ogg': 'OGG',
  'audio/opus': 'OPUS',
  'audio/wav': 'WAV',
  'audio/x-wav': 'WAV',
  'audio/wave': 'WAV',
  'audio/x-ms-wma': 'WMA'
};

const formatLabel = (mime: string) =>
  MIME_LABELS[mime.toLowerCase()] || mime.split('/').pop()?.toUpperCase() || mime.toUpperCase();

const formatSampleRate = (hz: number) => {
  const khz = hz / 1000;
  return `${Number.isInteger(khz) ? khz : khz.toFixed(1)}kHz`;
};

const formatBitrate = (bps: number) => `${Math.round(bps / 1000)}kbps`;

const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)}GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.round(bytes / 1024)}KB`;
};

/** 生成形如 ["FLAC", "44.1kHz", "2ch", "987kbps", "28.5MB"] 的展示片段，无效字段自动跳过。 */
export function formatAudioSegments(source: AudioParamSource): string[] {
  const segments: string[] = [];
  if (source.mime) segments.push(formatLabel(source.mime));
  if (source.sampleRate && source.sampleRate > 0) {
    segments.push(formatSampleRate(source.sampleRate));
  }
  if (source.channelCount && source.channelCount > 0) {
    segments.push(`${source.channelCount}ch`);
  }
  if (source.bitrate && source.bitrate > 0) segments.push(formatBitrate(source.bitrate));
  if (source.fileSize && source.fileSize > 0) segments.push(formatFileSize(source.fileSize));
  return segments;
}
