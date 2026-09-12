/**
 * 系统打开方式接入:外部用 Zephyrus 打开本地音频文件
 *
 * 原生链(MainActivity.handleExternalAudioIntent):content:// 复制进应用缓存,
 * 经 evaluateJavascript 把缓存绝对路径投递到 window.__externalAudioOpened。
 *
 * 本模块:读取元数据 → 入本地歌曲库(IndexedDB)→ 单曲队列自动播放。
 * 挂载一次(App.vue),与页面生命周期解耦,冷启动重试竞态安全。
 */
import { useLocalMusicStore } from '@/store/modules/localMusic';
import { usePlayerStore } from '@/store/modules/player';
import { toSongResult } from '@/utils/localMusicUtils';

let registered = false;

export function registerExternalAudioHandler(): void {
  if (registered || typeof window === 'undefined') return;
  registered = true;
  (window as any).__externalAudioOpened = async (filePath: string) => {
    if (!filePath) return;
    try {
      const localMusicStore = useLocalMusicStore();
      const playerStore = usePlayerStore();
      const native = (window as any).AndroidNative;
      if (!native?.getAudioMetadata) return;

      // 确保列表缓存已加载(入库前查重需要)
      await localMusicStore.loadFromCache();

      // 原生元数据 → 入库(applyEntryMetadata 内部按 filePath 去重更新)
      const metaJson = native.getAudioMetadata(filePath);
      if (!metaJson) return;
      const entry = await localMusicStore.applyEntryMetadata(metaJson);
      const song = toSongResult(entry);

      // 单曲队列自动播放
      playerStore.setPlayList([song]);
      await playerStore.setPlay(song);
    } catch (error) {
      console.warn('[ExternalAudio] 外部音频处理失败:', error);
    }
  };
}
