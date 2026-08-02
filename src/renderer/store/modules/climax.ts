/**
 * 高潮段落状态管理 (Climax Store)
 *
 * 集中管理高潮段落数据，供播放条、编辑器、舞台播放器等组件使用
 */

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { type ClimaxSegment, loadClimaxForSong, normalizeClimaxSegments } from '@/api/climax';
import { isLocalSong } from '@/hooks/useLocalMusic';
import { getLocalClimax } from '@/services/cacheService';

export const useClimaxStore = defineStore('climax', () => {
  // 当前歌曲的高潮段落
  const segments = ref<ClimaxSegment[]>([]);

  // 当前歌曲ID
  const currentSongId = ref<string>('');

  // 贡献者信息
  const contributor = ref<string | null>(null);

  // 加载状态
  const loading = ref(false);

  /**
   * 加载指定歌曲的高潮段落
   */
  async function loadSegments(songId: string) {
    if (!songId || songId === currentSongId.value) return;

    loading.value = true;
    currentSongId.value = songId;

    try {
      // 云端托管歌曲：从歌曲数据中的 serverMeta 获取高潮段落
      if (songId.startsWith('server:')) {
        // 通过 playerStore 获取当前歌曲
        const { usePlayerStore } = await import('./player');
        const playerStore = usePlayerStore();
        const song = playerStore.playMusic;
        const platformId = song?.platformId || songId.slice('server:'.length);
        let songDuration = song?.dt || song?.duration;
        let serverSegments = song?.climaxSegments;

        // 云端歌曲的高潮时段只信任“标注的时段”：
        // 优先取社区标注（编辑器/应用内标记，支持多段），没有社区标注时回退 songs.json。
        if (!serverSegments?.length) {
          const { getServerSongDetail } = await import('@/api/serverSongs');
          const detail = await getServerSongDetail(platformId);
          serverSegments = detail.climax;
          songDuration = detail.duration;
        }

        // 先用云端歌曲的原始 id 查社区标注，再试带 server: 前缀的完整 id
        const communityResult = await loadClimaxForSong(platformId);
        if (!communityResult.segments.length && songId !== platformId) {
          const fullIdResult = await loadClimaxForSong(songId);
          if (fullIdResult.segments.length) {
            communityResult.segments = fullIdResult.segments;
            communityResult.contributor = fullIdResult.contributor;
          }
        }
        if (communityResult.segments.length) {
          serverSegments = communityResult.segments;
        }

        segments.value = normalizeClimaxSegments(serverSegments, songDuration);
        contributor.value = segments.value.length
          ? communityResult.segments.length
            ? communityResult.contributor || 'Zephyrus 云端'
            : 'Zephyrus 云端'
          : null;
        return;
      }

      const { usePlayerStore } = await import('./player');
      const song = usePlayerStore().playMusic;

      // 本地歌曲：按实际播放源识别，避免纯数字路径哈希被误当成在线歌曲。
      if (String(song?.id || '') === songId && isLocalSong(song)) {
        const localData = await getLocalClimax(songId);
        segments.value = normalizeClimaxSegments(localData?.segments, song?.dt || song?.duration);
        contributor.value = localData?.contributor || null;
      } else {
        const result = await loadClimaxForSong(songId);
        segments.value = result.segments || [];
        contributor.value = result.contributor || null;
      }
    } catch (err) {
      console.error('[ClimaxStore] 加载高潮数据失败:', err);
      segments.value = [];
      contributor.value = null;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 检查指定时间是否在高潮段落内
   */
  function isTimeInClimax(time: number): boolean {
    return segments.value.some((seg) => time >= seg.start && time <= seg.end);
  }

  /**
   * 获取当前时间所在的高潮段落
   */
  function getCurrentSegment(time: number): ClimaxSegment | null {
    return segments.value.find((seg) => time >= seg.start && time <= seg.end) || null;
  }

  /**
   * 清空数据（切歌时调用）
   */
  function clear() {
    segments.value = [];
    currentSongId.value = '';
    contributor.value = null;
  }

  /**
   * 更新段落数据（编辑器保存后调用）
   */
  function updateSegments(newSegments: ClimaxSegment[]) {
    segments.value = newSegments;
  }

  // 计算属性
  const hasSegments = computed(() => segments.value.length > 0);

  return {
    segments,
    currentSongId,
    contributor,
    loading,
    hasSegments,
    loadSegments,
    isTimeInClimax,
    getCurrentSegment,
    clear,
    updateSegments
  };
});
