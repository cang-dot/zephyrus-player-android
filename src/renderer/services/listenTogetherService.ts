/**
 * Listen-Together Service（一起听同步服务）
 *
 * 传输模型（纯 HTTP 轮询，无需 WebSocket，部署在现有网关后无障碍）：
 *   - 每 5s 心跳上报本端权威播放快照；seek / 切歌 / 暂停切换时立即上报
 *   - 服务端按时间戳收敛到最新快照，每轮响应回传合并后的房间状态
 *   - 远端快照按需应用：切歌→换歌并校准进度与暂停态；
 *     暂停差异→跟随；位置偏差 > 2.5s → 纠偏 seek
 *   - 应用远端变更时置抑制窗口，防止“我应用了远端 → 误当本地操作 → 回推”回环
 */

import { watch } from 'vue';

import { allTime, nowTime } from '@/hooks/MusicHook';
import { audioService } from '@/services/audioService';
import { type RemotePlaybackState, useListenTogetherStore } from '@/store/modules/listenTogether';
import { usePlayerStore } from '@/store/modules/player';
import { useTransitionStore } from '@/store/modules/transition';
import type { ILyric, SongResult } from '@/types/music';

const SYNC_INTERVAL_MS = 5_000;
/** 远端与本地的进度差超过该值才纠偏 */
const SEEK_TOLERANCE_SEC = 2.5;
/** 抑制窗口：应用远端指令后短时间内不再把自己的变化当作本地操作外发 */
const SUPPRESS_WINDOW_MS = 1_500;

/**
 * 网关基址：与 platformQrApi 同源策略。
 * 注意：必须用 fetch 而非 axios/XHR —— Android 端 CapacitorHttp 劫持了
 * XMLHttpRequest，其补丁与 axios 的 open/setRequestHeader 时序不兼容，
 * POST + JSON 会抛 "setRequestHeader ... state must be OPENED"。
 */
const GATEWAY_BASE = (
  (import.meta.env.VITE_MUSIC_GATEWAY as string | undefined) || 'https://mucang.xyz/zephyrus/api'
)
  .replace(/\/+$/, '')
  .replace(/\/platform$/i, '');

interface PostResult {
  status: number;
  data: any;
}

async function postJson(path: string, body: unknown, timeoutMs = 12_000): Promise<PostResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${GATEWAY_BASE}/platform/listen${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

interface RoomSnapshot {
  code: string;
  hostName: string;
  startedAt: number;
  listenedMs: number;
  serverTime: number;
  members: Array<{ id: string; name: string; joinedAt: number; online: boolean }>;
  state: RemotePlaybackState | null;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function fmtLrcTime(sec: number): string {
  const s = Math.max(0, sec);
  const min = Math.floor(s / 60);
  const rest = s - min * 60;
  return `${pad(min)}:${pad(Math.floor(rest))}.${Math.round((rest - Math.floor(rest)) * 100)
    .toString()
    .padStart(2, '0')}`;
}

class ListenTogetherService {
  /** 本机时钟 → 服务器时钟 的偏移估计 (serverNow ≈ Date.now() + offset) */
  private clockOffset = 0;
  private seq = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private syncing = false;
  private applyingRemoteUntil = 0;
  private loadingRemoteSong = false;
  private pendingSeekTarget: number | null = null;
  private lastLyricSongId = '';
  private initialized = false;
  private unwatchers: Array<() => void> = [];

  // ==================== 生命周期 ====================

  /** 在 App 启动后调用一次：注册插桩监听（幂等） */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    const playerStore = usePlayerStore();

    // —— 插桩 1：用户 seek（所有 UI/通知栏/MediaSession 都汇聚到 audioService.seek）
    const originalSeek = audioService.seek.bind(audioService);
    (audioService as unknown as { seek: (t: number) => void }).seek = (time: number) => {
      originalSeek(time);
      this.publishNow('seek').catch(() => {});
    };

    // —— 插桩 2：暂停/恢复（通知栏、耳机、快捷键、UI 全部最终落到 isPlay）
    this.unwatchers.push(
      watch(
        () => playerStore.isPlay,
        () => {
          if (!this.isActive()) return;
          if (Date.now() < this.applyingRemoteUntil) return;
          this.publishNow('pause-toggle').catch(() => {});
        }
      )
    );

    // —— 插桩 3：切歌（远端触发时由抑制窗口拦截，避免回推）
    this.unwatchers.push(
      watch(
        () => playerStore.playMusic?.id,
        (_next, prev) => {
          if (prev === undefined) return; // 首次赋值不算切歌
          if (!this.isActive()) return;
          if (Date.now() < this.applyingRemoteUntil) return;
          this.lastLyricSongId = '';
          this.publishNow('track-change').catch(() => {});
        }
      )
    );

    // —— 远端触发切歌完成后：校准进度
    window.addEventListener('audio-ready', this.onAudioReady as EventListener);
  }

  dispose(): void {
    this.stopHeartbeat();
    this.unwatchers.forEach((fn) => fn());
    this.unwatchers = [];
    window.removeEventListener('audio-ready', this.onAudioReady as EventListener);
    this.initialized = false;
  }

  isActive(): boolean {
    const store = useListenTogetherStore();
    return store.status === 'active' && !!store.roomCode;
  }

  // ==================== 房间管理 ====================

  async createRoom(name?: string): Promise<string> {
    const store = useListenTogetherStore();
    const playerName = this.resolveName(name);
    store.status = 'joining';
    try {
      const res = await this.post('/create', { name: playerName });
      const data = res.data?.data;
      if (!data?.code || !data?.peerId) throw new Error(data?.msg || '创建房间失败');
      this.acceptRoom(store, data, playerName);
      return String(data.code);
    } catch (e) {
      this.failEnter(store);
      throw e;
    }
  }

  async joinRoom(code: string, name?: string): Promise<void> {
    const normalized = (code || '').trim().toUpperCase();
    if (!normalized) throw new Error('请输入房间识别码');
    const store = useListenTogetherStore();
    const playerName = this.resolveName(name);
    store.status = 'joining';
    try {
      const res = await this.post('/join', { code: normalized, name: playerName });
      const data = res.data?.data;
      if (!data?.code || !data?.peerId) throw new Error(data?.msg || '加入房间失败');
      this.acceptRoom(store, data, playerName);
    } catch (e) {
      this.failEnter(store);
      throw e;
    }
  }

  leaveRoom(): void {
    const store = useListenTogetherStore();
    if (store.roomCode && store.peerId) {
      // best-effort，不等结果
      this.post('/leave', { code: store.roomCode, peerId: store.peerId }).catch(() => {});
    }
    this.resetStore(store);
  }

  private resolveName(nameInput?: string): string {
    const saved = localStorage.getItem('zephyrus_listen_name') || '';
    const name = (nameInput || saved).trim() || '听众';
    localStorage.setItem('zephyrus_listen_name', name);
    return name;
  }

  private acceptRoom(
    store: ReturnType<typeof useListenTogetherStore>,
    data: { code: string; peerId: string; room?: RoomSnapshot },
    playerName: string
  ): void {
    store.$patch({
      status: 'active',
      roomCode: String(data.code),
      peerId: data.peerId,
      myName: playerName,
      hostName: data.room?.hostName || playerName,
      sessionStartedAt: data.room?.startedAt || Date.now(),
      listenedMs: data.room?.listenedMs || 0,
      members: data.room?.members || [],
      remoteState: data.room?.state || null
    });
    this.lastLyricSongId = '';
    this.startHeartbeat();
    // 入房立刻广播一次本端状态，让房间马上有数据可同步
    this.publishNow('join').catch(() => {});
  }

  private failEnter(store: ReturnType<typeof useListenTogetherStore>): void {
    store.status = 'idle';
  }

  private resetStore(store: ReturnType<typeof useListenTogetherStore>): void {
    this.stopHeartbeat();
    store.$patch({
      status: 'idle',
      roomCode: '',
      peerId: '',
      hostName: '',
      members: [],
      listenedMs: 0,
      sessionStartedAt: 0,
      remoteState: null
    });
  }

  // ==================== 发布（上行） ====================

  startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.isActive()) this.publishNow('heartbeat').catch(() => {});
    }, SYNC_INTERVAL_MS);
  }

  stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  buildSnapshot(reason: string): Record<string, unknown> {
    const playerStore = usePlayerStore();
    const song = playerStore.playMusic as SongResult;
    const localPos = Number(nowTime.value) || 0;
    const durationSec =
      Number(allTime.value) || Number((song as unknown as { dt?: number })?.dt ?? 0) / 1000 || 0;

    const artists: string[] = (song?.ar?.length ? song.ar : song?.artists || [])
      .map((a) => a?.name)
      .filter(Boolean);

    let loudness = 0;
    try {
      loudness = audioService.getLoudness() || 0;
    } catch {
      loudness = 0;
    }

    return {
      peerId: '',
      name: '',
      ts: Date.now(),
      seq: ++this.seq,
      reason,
      songId: String(song?.id ?? ''),
      songName: song?.name || '',
      artists,
      album: song?.al?.name || song?.album?.name || '',
      picUrl: song?.picUrl || song?.al?.picUrl || song?.album?.picUrl || '',
      duration: durationSec,
      position: Math.min(localPos, durationSec || localPos),
      isPaused: !playerStore.isPlay,
      volume: Math.round((playerStore.volume ?? 1) * 100),
      loudness: loudness > 0 ? Number(loudness.toFixed(4)) : null
    };
  }

  /** LRC 文本，仅在歌曲或歌词变化后的首次上报随包携带 */
  private buildLrcIfChanged(state: Record<string, unknown>): string | null {
    const playerStore = usePlayerStore();
    const song = playerStore.playMusic as SongResult;
    const songId = String(state.songId || '');
    if (!songId || !song?.lyric) return null;
    if (songId === this.lastLyricSongId) return null;

    const lyric = song.lyric as ILyric;
    const times = lyric.lrcTimeArray || [];
    const lines = lyric.lrcArray || [];
    const out: string[] = [];
    for (let i = 0; i < Math.min(times.length, lines.length); i += 1) {
      const line = lines[i] as { text?: string; trText?: string; isBG?: boolean };
      if (!line || line.isBG) continue;
      const text = line.text || '';
      if (!text.trim()) continue;
      out.push(`[${fmtLrcTime(times[i])}]${text}`);
    }
    this.lastLyricSongId = songId;
    return out.join('\n') || null;
  }

  async publishNow(reason: string): Promise<void> {
    const store = useListenTogetherStore();
    if (!this.isActive()) return;
    if (this.syncing && reason === 'heartbeat') return; // 上轮未返回则本轮跳过
    this.syncing = true;

    const t0 = Date.now();
    try {
      const state = this.buildSnapshot(reason);
      state.peerId = store.peerId;
      state.name = store.myName;
      const body: Record<string, unknown> = {
        code: store.roomCode,
        peerId: store.peerId,
        name: store.myName,
        state
      };
      const lrc = reason !== 'heartbeat' ? this.buildLrcIfChanged(state) : null;
      if (lrc) {
        body.lrc = lrc;
        body.lrcSongId = state.songId;
      }
      await this.syncRound(body, t0);
    } catch (e) {
      console.warn('[ListenTogether] 同步失败:', e);
    } finally {
      this.syncing = false;
    }
  }

  private async post(path: string, body: Record<string, unknown>): Promise<PostResult> {
    return postJson(path, body);
  }

  // ==================== 消费（下行） ====================

  private async syncRound(body: Record<string, unknown>, t0: number): Promise<void> {
    const res = await this.post('/sync', body);
    const t1 = Date.now();
    // 房间已被服务端回收（15 分钟无活动）：静默退出，避免每 5s 无效重试
    if (res.status === 404 || res.data?.code === 40404) {
      console.warn('[ListenTogether] 房间已过期，自动退出');
      this.leaveRoom();
      return;
    }
    const room = res.data?.data?.room as RoomSnapshot | undefined;
    if (!room?.serverTime) return;

    // 时钟偏移估计：serverTime 对应往返中点时刻
    this.clockOffset = room.serverTime - (t0 + t1) / 2;
    this.applyRoomSnapshot(room);
  }

  applyRoomSnapshot(room: RoomSnapshot): void {
    const store = useListenTogetherStore();
    if (store.status !== 'active' || room.code !== store.roomCode) return;

    store.hostName = room.hostName;
    store.listenedMs = room.listenedMs;
    store.sessionStartedAt = room.startedAt;
    store.members = room.members || [];
    const st = room.state;
    store.remoteState = st;
    if (!st) return;
    if (st.peerId === store.peerId) return; // 自己发出的回声不应用
    if (this.loadingRemoteSong) return;

    const targetPos = this.expectedRemotePosition(st);
    const playerStore = usePlayerStore();
    const currentSongId = String(playerStore.playMusic?.id ?? '');

    // 1) 歌曲不同 → 跟随切歌
    if (st.songId && st.songId !== currentSongId) {
      void this.followRemoteSong(st, targetPos);
      return;
    }
    if (!currentSongId && !playerStore.playMusic) return; // 本端还没有任何歌曲在播

    // 2) 暂停态不同 → 跟随
    if (playerStore.isPlay !== st.isPaused) {
      this.suppressLocalEvents();
      playerStore.setPlayMusic(!st.isPaused);
      return;
    }

    // 3) 进度偏差过大 → 纠偏 seek（crossfade 期间不打架）
    const transitionStore = useTransitionStore();
    if (!transitionStore.isCrossfadingUI && playerStore.isPlay === st.isPaused) {
      const drift = Math.abs(Number(nowTime.value || 0) - targetPos);
      if (drift > SEEK_TOLERANCE_SEC) {
        this.suppressLocalEvents();
        audioService.seek(targetPos);
      }
    }
  }

  /** 远端锚定于服务器时钟的位置推算到"现在" */
  expectedRemotePosition(st: RemotePlaybackState): number {
    const anchor = st.receivedAt || st.ts;
    const elapsedSec = Math.max(0, Date.now() + this.clockOffset - anchor) / 1000;
    const live = st.isPaused ? st.position : st.position + elapsedSec;
    const dur = st.duration || 0;
    return dur > 0 ? Math.min(live, dur) : Math.max(0, live);
  }

  private suppressLocalEvents(extraMs = 0): void {
    this.applyingRemoteUntil = Date.now() + SUPPRESS_WINDOW_MS + extraMs;
  }

  /** 跟随远端切歌：重建歌曲对象 → 播放 → audio-ready 后校准进度 */
  private async followRemoteSong(st: RemotePlaybackState, targetPos: number): Promise<void> {
    if (this.loadingRemoteSong || !st.songId) return;
    this.loadingRemoteSong = true;
    try {
      const playerStore = usePlayerStore();
      const song = await this.rebuildSong(st);

      this.pendingSeekTarget = targetPos;
      this.suppressLocalEvents(SUPPRESS_WINDOW_MS);
      // 行为对齐扫码分享卡片：整组替换并开始播放
      playerStore.setPlayList([song], false);
      await playerStore.setPlay(song);
      if (!st.isPaused) {
        playerStore.setIsPlay(true);
      } else {
        this.suppressLocalEvents();
        playerStore.setIsPlay(false);
      }

      // audio-ready 兜底由 onAudioReady 处理；8 秒内没事件则放弃校准
      window.setTimeout(() => {
        this.pendingSeekTarget = null;
      }, 8_000);
    } catch (e) {
      console.warn('[ListenTogether] 跟随切歌失败:', e);
      this.pendingSeekTarget = null;
    } finally {
      this.loadingRemoteSong = false;
    }
  }

  private async rebuildSong(st: RemotePlaybackState): Promise<SongResult> {
    const skeleton = {
      id: st.songId,
      name: st.songName,
      picUrl: st.picUrl,
      ar: (st.artists || []).map((name, i) => ({ id: i, name })),
      al: { id: 0, name: st.album, picUrl: st.picUrl },
      count: 0
    };
    try {
      // 网易云歌曲优先补全详情（URL 解析链依赖完整字段）
      const { getMusicDetail } = await import('@/api/music');
      const res = await getMusicDetail([Number(st.songId)]);
      const detail = res?.data?.songs?.[0];
      if (detail) {
        return {
          ...(detail as SongResult),
          ar: detail.ar?.length ? detail.ar : skeleton.ar,
          al: detail.al ?? skeleton.al,
          picUrl: detail.al?.picUrl || detail.picUrl || skeleton.picUrl
        };
      }
    } catch {
      /* 非网易云 ID 或网络异常，退回骨架对象 */
    }
    return skeleton as unknown as SongResult;
  }

  private onAudioReady = (): void => {
    if (this.pendingSeekTarget === null) return;
    const target = this.pendingSeekTarget;
    this.pendingSeekTarget = null;
    this.suppressLocalEvents();
    try {
      audioService.seek(target);
    } catch {
      /* ignore */
    }
  };
}

export const listenTogetherService = new ListenTogetherService();
