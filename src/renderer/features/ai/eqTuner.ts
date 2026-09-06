/**
 * AI 智能调音:根据当前歌曲的元数据与实时音频特征,
 * 让 LLM 给出 10 段 EQ 的增益建议,并应用到现有均衡器链路。
 */
import { audioService } from '@/services/audioService';
import { playMusic } from '@/hooks/MusicHook';

import { type ChatMessage, chatCompletion } from './client';
import { getProvider } from './providers';

const EQ_BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export interface EqTuneResult {
  gains: Array<{ frequency: number; gain: number }>;
  rationale: string;
}

/** 调音前的 EQ 快照(用于「还原」) */
export function snapshotEqSettings(): string {
  return localStorage.getItem('eqSettings') || '{}';
}

export async function tuneEqForCurrentSong(): Promise<EqTuneResult> {
  const song = playMusic.value;
  const songName = song?.name || '未知';
  const artist = (song?.ar || song?.artists || []).map((a) => a.name).join('/');
  const bands = audioService.getBandEnergies();
  const bpm = audioService.getRealtimeBpm();

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        '你是调音师。根据歌曲信息与实时音频特征,输出 10 段图形均衡器(31/62/125/250/500/1k/2k/4k/8k/16k Hz)的增益设置。' +
        '只输出一个 JSON 对象:{"gains":[10 个数字,-12 到 12 之间的 dB 值,按频率从低到高],"rationale":"一句话调音思路(中文)"}。不要输出其它内容。'
    },
    {
      role: 'user',
      content: `歌曲:${songName}${artist ? ` - ${artist}` : ''}
实时特征:BPM≈${Math.round(bpm) || '未知'},低频能量 ${bands.low.toFixed(2)},中频 ${bands.mid.toFixed(2)},高频 ${bands.high.toFixed(2)}(0~1)。
请给出适合这首歌曲当前段落的均衡器设置。`
    }
  ];

  const config = (() => {
    try {
      return JSON.parse(localStorage.getItem('lyric-metaphor-config') || '{}');
    } catch {
      return {};
    }
  })();

  if (!config.apiKey && getProvider(config.provider)?.needApiKey) {
    throw new Error('请先在歌词 AI 解析设置中配置密钥');
  }

  const result = await chatCompletion({
    providerId: getProvider(config.provider) ? config.provider : 'custom',
    apiKey: config.apiKey || undefined,
    model: config.model,
    baseUrl: config.baseUrl || getProvider(config.provider)?.baseUrl,
    messages
  });

  const fenced = result.content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : result.content;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AI 未返回有效的调音结果');
  const parsed = JSON.parse(candidate.slice(start, end + 1)) as {
    gains?: unknown;
    rationale?: unknown;
  };

  const rawGains = Array.isArray(parsed.gains) ? parsed.gains.map(Number) : [];
  if (rawGains.length < EQ_BANDS.length) throw new Error('调音结果段数不足');

  const gains = EQ_BANDS.map((frequency, i) => ({
    frequency,
    gain: Math.max(-12, Math.min(12, rawGains[i] || 0))
  }));

  // 应用:逐段写入并同步安卓原生(3 段折算)
  gains.forEach(({ frequency, gain }) => audioService.setEQFrequencyGain(String(frequency), gain));

  return { gains, rationale: String(parsed.rationale || '') };
}
