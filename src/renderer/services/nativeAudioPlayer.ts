import { shallowRef } from 'vue';

import type { SongResult } from '@/types/music';

import { isAndroidNative } from './androidNative';

type EventCallback = (...args: any[]) => void;

export interface NativeAudioAnalysis {
  loudness: number;
  low: number;
  mid: number;
  high: number;
  bpm: number;
}

interface NativeAudioEvent extends Partial<NativeAudioAnalysis> {
  token?: string;
  event?: string;
  state?: string;
  playing?: boolean;
  positionMs?: number;
  durationMs?: number;
  error?: string;
}

const EMPTY_ANALYSIS: NativeAudioAnalysis = {
  loudness: 0,
  low: 0,
  mid: 0,
  high: 0,
  bpm: 0
};
const analysisState = shallowRef<NativeAudioAnalysis>({ ...EMPTY_ANALYSIS });

export class NativeAudioPlayer {
  private static players = new Map<string, NativeAudioPlayer>();
  private static bridgeInstalled = false;

  readonly token: string;
  private playState: 'loading' | 'loaded' | 'unloaded' | 'error' = 'loading';
  private isPlaying = false;
  private position = 0;
  private totalDuration = 0;
  private playbackRate = 1;
  private currentVolume = 1;
  private events = new Map<string, Set<EventCallback>>();
  private loadPromise: Promise<this>;
  private resolveLoad!: (player: this) => void;
  private rejectLoad!: (error: Error) => void;

  constructor(url: string, track: SongResult, preload = false) {
    if (!isAndroidNative() || !window.AndroidNative?.nativeAudioLoad) {
      throw new Error('Android 原生音频引擎不可用');
    }
    NativeAudioPlayer.installBridge();
    this.loadPromise = new Promise<this>((resolve, reject) => {
      this.resolveLoad = resolve;
      this.rejectLoad = reject;
    });
    this.token = window.AndroidNative.nativeAudioLoad(
      JSON.stringify({
        id: String(track.id),
        url,
        title: track.name || '',
        artist: (track.ar || track.song?.artists || []).map((artist) => artist.name).join(', '),
        album: track.al?.name || track.song?.album?.name || '',
        artworkUrl: track.picUrl || ''
      }),
      preload
    );
    NativeAudioPlayer.players.set(this.token, this);
  }

  private static installBridge(): void {
    if (this.bridgeInstalled) return;
    this.bridgeInstalled = true;
    window.__nativeAudioEvent = (rawPayload) => {
      try {
        const payload = (
          typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload
        ) as NativeAudioEvent;
        if (payload.event === 'analysis') {
          analysisState.value = {
            loudness: Number(payload.loudness) || 0,
            low: Number(payload.low) || 0,
            mid: Number(payload.mid) || 0,
            high: Number(payload.high) || 0,
            bpm: Number(payload.bpm) || 0
          };
        }
        if (payload.token) this.players.get(payload.token)?.handleNativeEvent(payload);
      } catch (error) {
        console.warn('[NativeAudio] 无法解析原生事件:', error);
      }
    };
  }

  private handleNativeEvent(payload: NativeAudioEvent): void {
    if (typeof payload.positionMs === 'number') this.position = payload.positionMs / 1000;
    if (typeof payload.durationMs === 'number') this.totalDuration = payload.durationMs / 1000;
    if (typeof payload.playing === 'boolean') this.isPlaying = payload.playing;
    if (payload.state) this.playState = payload.state as typeof this.playState;

    switch (payload.event) {
      case 'load':
        this.playState = 'loaded';
        this.resolveLoad(this);
        this.emit('load');
        break;
      case 'error': {
        this.playState = 'error';
        const error = new Error(payload.error || '原生音频播放失败');
        this.rejectLoad(error);
        this.emit('loaderror', 0, error);
        this.emit('playerror', 0, error);
        break;
      }
      case 'play':
      case 'pause':
      case 'end':
      case 'seek':
      case 'crossfadeComplete':
        this.emit(payload.event);
        break;
    }
  }

  load(): Promise<this> {
    return this.loadPromise;
  }

  state(): string {
    return this.playState;
  }

  playing(): boolean {
    return this.isPlaying;
  }

  duration(): number {
    return this.totalDuration;
  }

  seek(offset?: number): number | void {
    if (offset === undefined) return this.position;
    this.position = Math.max(0, offset);
    window.AndroidNative?.nativeAudioSeekTo(this.token, this.position * 1000);
  }

  rate(value?: number): number | void {
    if (value === undefined) return this.playbackRate;
    this.playbackRate = value;
    window.AndroidNative?.nativeAudioSetPlaybackRate(this.token, value);
  }

  volume(value?: number): number | void {
    if (value === undefined) return this.currentVolume;
    this.currentVolume = Math.max(0, Math.min(1, value));
    window.AndroidNative?.nativeAudioSetVolume(this.currentVolume);
  }

  play(): number {
    window.AndroidNative?.nativeAudioPlay(this.token);
    return 0;
  }

  pause(): void {
    window.AndroidNative?.nativeAudioPause(this.token);
  }

  stop(): void {
    window.AndroidNative?.nativeAudioStop(this.token);
  }

  unload(): void {
    if (this.playState === 'unloaded') return;
    window.AndroidNative?.nativeAudioUnload(this.token);
    NativeAudioPlayer.players.delete(this.token);
    this.playState = 'unloaded';
    this.isPlaying = false;
    this.events.clear();
  }

  on(event: string, callback: EventCallback): this {
    if (!this.events.has(event)) this.events.set(event, new Set());
    this.events.get(event)!.add(callback);
    return this;
  }

  once(event: string, callback: EventCallback): this {
    const wrapped = (...args: any[]) => {
      this.off(event, wrapped);
      callback(...args);
    };
    return this.on(event, wrapped);
  }

  off(event: string, callback?: EventCallback): this {
    if (!callback) this.events.delete(event);
    else this.events.get(event)?.delete(callback);
    return this;
  }

  startCrossfade(next: NativeAudioPlayer, duration: number, level: 1 | 2 | 3) {
    const raw = window.AndroidNative?.nativeAudioStartCrossfade(
      this.token,
      next.token,
      duration,
      level
    );
    return JSON.parse(raw || '{"started":false}') as {
      started: boolean;
      duration?: number;
      level?: 1 | 2 | 3;
    };
  }

  private emit(event: string, ...args: any[]): void {
    this.events.get(event)?.forEach((callback) => callback(...args));
  }

  static cancelCrossfade(): void {
    window.AndroidNative?.nativeAudioCancelCrossfade();
  }

  static getAnalysis(): NativeAudioAnalysis {
    if (!isAndroidNative()) return { ...EMPTY_ANALYSIS };
    try {
      const latest = JSON.parse(
        window.AndroidNative?.nativeAudioGetAnalysis() || '{}'
      ) as Partial<NativeAudioAnalysis>;
      const numeric = (value: unknown, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
      };
      analysisState.value = {
        loudness: numeric(latest.loudness),
        low: numeric(latest.low),
        mid: numeric(latest.mid),
        high: numeric(latest.high),
        bpm: numeric(latest.bpm, analysisState.value.bpm)
      };
    } catch {
      // Event stream remains the fallback when a synchronous bridge read fails.
    }
    return { ...analysisState.value };
  }
}
