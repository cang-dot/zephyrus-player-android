/**
 * Listen-Together Store（一起听）
 *
 * 房间与成员的 UI 态；同步协议逻辑在 services/listenTogetherService.ts。
 * 角色说明：
 *   - 房主：创建房间者，进入播放页后其他成员可加入
 *   - 成员：通过唯一识别码 / 扫码 / deep link 加入
 *   - AI 听众：外部 MCP 客户端只读进度/歌曲信息/LRC/响度
 */

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export type ListenTogetherStatus = 'idle' | 'joining' | 'active' | 'error';

export interface ListenMember {
  id: string;
  name: string;
  joinedAt: number;
  online: boolean;
}

/** 服务端下发的最新播放快照 */
export interface RemotePlaybackState {
  peerId: string;
  name: string;
  ts: number;
  seq: number;
  songId: string;
  songName: string;
  artists: string[];
  album: string;
  picUrl: string;
  duration: number;
  position: number;
  isPaused: boolean;
  volume: number;
  loudness: number | null;
  receivedAt?: number;
}

export const useListenTogetherStore = defineStore('listenTogether', () => {
  // ==================== State ====================

  const status = ref<ListenTogetherStatus>('idle');
  /** 房间唯一识别码，也是分享二维码 / MCP 接入凭证 */
  const roomCode = ref('');
  /** 本端在此房间的成员 ID */
  const peerId = ref('');
  const myName = ref('');
  const hostName = ref('');
  const members = ref<ListenMember[]>([]);
  const listenedMs = ref(0);
  const sessionStartedAt = ref(0);
  /** 服务端合并后的最新远端快照 */
  const remoteState = ref<RemotePlaybackState | null>(null);

  return {
    status,
    roomCode,
    peerId,
    myName,
    hostName,
    members,
    listenedMs,
    sessionStartedAt,
    remoteState
  };
});

/** 是否处于一起听会话中（组件侧常用） */
export const useListenTogetherActive = () => {
  const store = useListenTogetherStore();
  return computed(() => store.status === 'active');
};
