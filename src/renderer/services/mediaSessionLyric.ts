/**
 * 控制中心歌词(网易云式):把媒体会话标题实时替换为当前歌词行。
 *
 * 数据源与状态栏歌词 bridge 同源(useWordTimedPlayback 的 displayLineKey,
 * TTML/LRC 统一的换行信号,天然低频);仅在播放中推送,暂停/空行回退真实歌名,
 * 规避 iOS 暂停态 metadata 刷新不可靠的问题。
 * 不加 isAndroidNative 门:Android 原生通知走另一条链路,此服务收益在
 * iOS Safari / 桌面 / 其他浏览器的系统媒体面板。
 */
import { watch } from 'vue';

import { useWordTimedPlayback } from '@/composables/useWordTimedPlayback';
import { audioService } from '@/services/audioService';
import { usePlayerStore } from '@/store/modules/player';

let initialized = false;

export function setupMediaSessionLyric(): void {
  if (initialized || !('mediaSession' in navigator)) return;
  initialized = true;

  const playerStore = usePlayerStore();
  const wordTimedPlayback = useWordTimedPlayback();

  const push = (): void => {
    // 暂停/停止:恢复真实歌名(iOS 暂停态 metadata 刷新不可靠,不逐行推送)
    if (!playerStore.isPlay) {
      audioService.setMediaSessionLyricTitle(null);
      return;
    }
    const line = wordTimedPlayback.currentDisplayLine.value;
    // 空行(间奏)回退歌名,照抄状态栏歌词的回退语义
    const text = line?.text?.trim() || playerStore.currentSong?.name?.trim() || '';
    audioService.setMediaSessionLyricTitle(text || null);
  };

  watch(
    [
      () => wordTimedPlayback.displayLineKey.value,
      () => wordTimedPlayback.currentDisplayLine.value,
      () => playerStore.isPlay,
      () => playerStore.currentSong?.id
    ],
    push,
    { immediate: true }
  );
}
