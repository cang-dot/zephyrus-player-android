import { useMessage } from 'naive-ui';
import { computed, onScopeDispose, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { usePlayerStore, useRecommendStore } from '@/store';
import type { SongResult } from '@/types/music';
import { getImgUrl } from '@/utils';
import { getImageBackground } from '@/utils/linearColor';

import { dislikeRecommendedSong } from '../api/music';
import { isServerSongResult } from '../api/serverSongs';
import { useArtist } from './useArtist';
import { useDownload } from './useDownload';
import { useOverlayNavigate } from './useOverlayNavigate';

export function useSongItem(props: { item: SongResult; canRemove?: boolean }) {
  const { t } = useI18n();
  const playerStore = usePlayerStore();
  const recommendStore = useRecommendStore();
  const message = useMessage();
  const { downloadMusic, downloadLyric } = useDownload();
  const { navigateToArtist } = useArtist();
  const { navigate } = useOverlayNavigate();

  // 状态变量
  const showDropdown = ref(false);
  const dropdownX = ref(0);
  const dropdownY = ref(0);
  const isActive = ref(false);
  let activateTimeout: ReturnType<typeof setTimeout> | null = null;

  const activate = () => {
    isActive.value = true;
    if (activateTimeout) clearTimeout(activateTimeout);
    activateTimeout = setTimeout(() => {
      isActive.value = false;
      activateTimeout = null;
    }, 3000);
  };

  onScopeDispose(() => {
    if (activateTimeout) clearTimeout(activateTimeout);
  });

  // 计算属性
  const play = computed(() => playerStore.isPlay);
  const playMusic = computed(() => playerStore.playMusic);
  const playLoading = computed(
    () => playMusic.value.id === props.item.id && playMusic.value.playLoading
  );
  const isPlaying = computed(() => playMusic.value.id === props.item.id);

  // 收藏与不喜欢状态
  const isFavorite = computed(() => {
    const numericId =
      typeof props.item.id === 'string' ? parseInt(props.item.id, 10) : props.item.id;
    return playerStore.favoriteList.includes(numericId);
  });

  const isDislike = computed(() => {
    const numericId =
      typeof props.item.id === 'string' ? parseInt(props.item.id, 10) : props.item.id;
    return playerStore.dislikeList.includes(numericId);
  });

  // 获取艺术家列表
  const artists = computed(() => {
    return (props.item.ar || props.item.song?.artists)?.slice(0, 4) || [];
  });

  // 处理图片加载
  const handleImageLoad = async (imageElement: HTMLImageElement) => {
    if (!imageElement) return;

    const { backgroundColor, primaryColor } = await getImageBackground(imageElement);
    props.item.backgroundColor = backgroundColor;
    props.item.primaryColor = primaryColor;
  };

  // 播放音乐
  const playMusicEvent = async (item: SongResult) => {
    try {
      const result = await playerStore.setPlay(item);
      if (!result) {
        throw new Error('播放失败');
      }
      return true;
    } catch (error) {
      console.error('播放出错:', error);
      return false;
    }
  };

  // 切换收藏状态
  const toggleFavorite = async (e?: Event) => {
    e?.stopPropagation();
    const numericId =
      typeof props.item.id === 'string' ? parseInt(props.item.id, 10) : props.item.id;

    if (isFavorite.value) {
      playerStore.removeFromFavorite(numericId);
    } else {
      playerStore.addToFavorite(numericId);
    }
  };

  // 判断当前歌曲是否为每日推荐歌曲
  const isDailyRecommendSong = computed(() => {
    return recommendStore.dailyRecommendSongs.some((song) => song.id === props.item.id);
  });

  // 切换不喜欢状态
  const toggleDislike = async (e: Event) => {
    e && e.stopPropagation();

    if (isDislike.value) {
      playerStore.removeFromDislikeList(props.item.id);
      return;
    }

    playerStore.addToDislikeList(props.item.id);

    // 只有当前歌曲是每日推荐歌曲时才调用接口
    if (!isDailyRecommendSong.value) {
      return;
    }
    try {
      const numericId = typeof props.item.id === 'string' ? parseInt(props.item.id) : props.item.id;
      const response = await dislikeRecommendedSong(numericId);
      if (response.data.data) {
        const newSongData = response.data.data;
        const newSong: SongResult = {
          ...newSongData,
          name: newSongData.name,
          id: newSongData.id,
          picUrl: newSongData.al?.picUrl || newSongData.album?.picUrl,
          ar: newSongData.ar || newSongData.artists,
          al: newSongData.al || newSongData.album,
          song: {
            ...newSongData.song,
            id: newSongData.id,
            name: newSongData.name,
            artists: newSongData.ar || newSongData.artists,
            album: newSongData.al || newSongData.album
          },
          source: 'netease',
          count: 0
        };
        recommendStore.replaceSongInDailyRecommend(props.item.id, newSong);
      } else {
        console.warn('标记不感兴趣API成功，但未返回新歌曲。', response.data);
      }
    } catch (error) {
      console.error('发送不感兴趣请求时出错:', error);
    }
  };

  // 添加到下一首播放
  const handlePlayNext = () => {
    playerStore.addToNextPlay(props.item);
    message.success(t('songItem.message.addedToNextPlay'));
  };

  // 获取歌曲时长
  const getDuration = (item: SongResult): number => {
    if (item.duration) return item.duration;
    if (typeof item.dt === 'number') return item.dt;
    return 0;
  };

  // 格式化时长
  const formatDuration = (ms: number): string => {
    if (!ms) return '--:--';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // 处理右键菜单
  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    activate();
    showDropdown.value = true;
    dropdownX.value = e.clientX;
    dropdownY.value = e.clientY;
  };

  // 处理菜单点击
  const handleMenuClick = (e: MouseEvent) => {
    e.preventDefault();
    activate();
    showDropdown.value = true;
    dropdownX.value = e.clientX;
    dropdownY.value = e.clientY;
  };

  // 处理艺术家点击
  const handleArtistClick = (id: number) => {
    navigateToArtist(id);
  };

  // 处理专辑点击
  const handleAlbumClick = (id: number | string = 0) => {
    // 云端歌曲：跳转到云端同名专辑详情页（以专辑名为路由标识）
    if (isServerSongResult(props.item)) {
      const albumName =
        props.item.al?.name ||
        (props.item as any).album?.name ||
        (props.item as any).song?.album?.name;
      if (albumName) {
        navigate(`/music-list/${encodeURIComponent(albumName)}?type=server-album`);
        return;
      }
    }
    navigate(`/music-list/${id}?type=album`);
  };

  return {
    t,
    play,
    playMusic,
    playLoading,
    isPlaying,
    isFavorite,
    isDislike,
    artists,
    showDropdown,
    dropdownX,
    dropdownY,
    isActive,
    playerStore,
    message,
    getImgUrl,
    handleImageLoad,
    playMusicEvent,
    toggleFavorite,
    toggleDislike,
    handlePlayNext,
    getDuration,
    formatDuration,
    handleContextMenu,
    handleMenuClick,
    handleArtistClick,
    handleAlbumClick,
    activate,
    downloadMusic,
    downloadLyric
  };
}
