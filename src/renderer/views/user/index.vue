<template>
  <div class="user-page h-full flex flex-col min-h-0">
    <template v-if="infoLoading">
      <div class="flex-1 flex flex-col gap-4 p-4">
        <div class="rounded-2xl skeleton-shimmer" style="height: 200px" />
        <div class="grid md:grid-cols-2 gap-4">
          <div class="rounded-2xl p-4 space-y-4" style="background: var(--d-surface-alt)">
            <div class="h-8 w-32 skeleton-shimmer rounded-lg" />
            <div v-for="i in 4" :key="i" class="flex gap-3">
              <div class="h-[50px] w-[50px] skeleton-shimmer rounded-xl flex-shrink-0" />
              <div class="flex-1 space-y-2">
                <div class="h-4 w-1/2 skeleton-shimmer rounded-lg" />
                <div class="h-3 w-1/3 skeleton-shimmer rounded-lg" />
              </div>
            </div>
          </div>
          <div class="rounded-2xl p-4 space-y-4" style="background: var(--d-surface-alt)">
            <div class="h-8 w-32 skeleton-shimmer rounded-lg" />
            <div v-for="i in 5" :key="i" class="flex items-center gap-3">
              <div class="h-10 w-10 skeleton-shimmer rounded-full flex-shrink-0" />
              <div class="h-10 w-10 skeleton-shimmer rounded-xl flex-shrink-0" />
              <div class="flex-1 space-y-2">
                <div class="h-4 w-1/3 skeleton-shimmer rounded-lg" />
                <div class="h-3 w-1/4 skeleton-shimmer rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
    <template v-else>
      <!-- 紧凑头部（移动端优先） -->
      <div
        v-if="user"
        class="relative w-full flex-shrink-0 px-4 pt-4"
        :class="setAnimationClass('animate__fadeIn')"
      >
        <div class="flex items-center gap-4">
          <n-avatar round :size="56" :src="getImgUrl(user.avatarUrl, '72y72')" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="text-xl font-bold d-text-primary truncate">{{ user.nickname }}</span>
              <span
                v-if="currentLoginType"
                class="rounded-full border px-2 py-0.5 text-[10px] flex-shrink-0"
                style="color: var(--accent-color); border-color: rgba(var(--accent-color-rgb), 0.4)"
                >{{ t('login.title.' + currentLoginType) }}</span
              >
            </div>
            <div class="mt-0.5 truncate text-xs d-text-secondary">
              {{ userDetail?.profile?.signature || '这个人很懒，什么都没有留下' }}
            </div>
          </div>
        </div>
        <!-- 统计数据 -->
        <div class="mt-3 flex gap-6 text-sm">
          <div class="text-center">
            <span class="font-bold d-text-primary">{{ userDetail?.profile?.followeds || 0 }}</span>
            <span class="ml-1 text-xs d-text-muted">{{ t('user.profile.followers') }}</span>
          </div>
          <div class="cursor-pointer text-center" @click="showFollowList">
            <span class="font-bold d-text-primary">{{ userDetail?.profile?.follows || 0 }}</span>
            <span class="ml-1 text-xs d-text-muted">{{ t('user.profile.following') }}</span>
          </div>
          <div class="text-center">
            <span class="font-bold d-text-primary">{{ userDetail?.level || 0 }}</span>
            <span class="ml-1 text-xs d-text-muted">{{ t('user.profile.level') }}</span>
          </div>
        </div>
      </div>
      <div
        v-if="user"
        class="relative z-20 px-4 pb-4 flex-1 min-h-0 overflow-y-auto"
        :class="setAnimationClass('animate__fadeIn')"
      >
        <div class="tab-container mb-3 flex-shrink-0">
          <n-tabs v-model:value="currentTab" type="segment" animated>
            <n-tab v-for="tab in tabs" :key="tab.key" :name="tab.key" :tab="t(tab.label)" />
          </n-tabs>
        </div>
        <!-- 歌单 2 列网格 -->
        <div v-if="currentTab !== 'platforms'" class="grid grid-cols-2 gap-3 mb-6">
          <button
            v-if="isElectron && currentTab === 'created'"
            @click="goToImportPlaylist"
            class="import-btn flex flex-col items-center gap-2 rounded-2xl p-2"
          >
            <div
              class="flex w-full items-center justify-center rounded-xl text-3xl import-btn-icon"
              style="aspect-ratio: 1"
            >
              <i class="icon iconfont ri-add-line" />
            </div>
            <div class="text-xs font-medium d-text-secondary truncate w-full text-center">
              {{ t('comp.playlist.import.button') }}
            </div>
          </button>
          <div
            v-for="(item, index) in currentList"
            :key="index"
            @click="handleItemClick(item)"
            class="list-item-card flex flex-col gap-2 rounded-2xl p-2"
          >
            <n-image
              :src="getImgUrl(getCoverUrl(item), '200y200')"
              class="w-full overflow-hidden rounded-xl"
              style="aspect-ratio: 1"
              lazy
              preview-disabled
            />
            <div class="min-w-0">
              <div class="truncate text-sm font-medium d-text-primary">
                {{ item.name }}
              </div>
              <div class="mt-0.5 truncate text-xs d-text-secondary">
                {{ getItemDescription(item) }}
              </div>
            </div>
          </div>
        </div>
        <!-- 平台账号 Tab -->
        <platform-accounts v-if="currentTab === 'platforms'" />
        <!-- 听歌排行区 -->
        <div class="mt-2">
          <div class="mb-3 flex-shrink-0 text-lg font-bold d-text-primary">
            {{ t('user.ranking.title') }}
          </div>
          <div>
            <div
              v-for="(item, index) in recordList"
              :key="item.id"
              class="record-item group flex items-center gap-3 rounded-xl p-2"
            >
              <div
                class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold d-text-muted"
              >
                {{ index + 1 }}
              </div>
              <n-image
                :src="getImgUrl(item.picUrl || item.al?.picUrl, '40y40')"
                class="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg"
                lazy
                preview-disabled
              />
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium d-text-primary">
                  {{ item.name }}
                </div>
                <div class="truncate text-xs d-text-secondary">
                  {{ getArtistNames(item) }}
                </div>
              </div>
              <button
                @click.stop="toggleFavorite(item)"
                class="record-action flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-lg"
                :class="{ 'is-favorited': isFavorited(item.id) }"
              >
                <i :class="isFavorited(item.id) ? 'ri-heart-3-fill' : 'ri-heart-3-line'" />
              </button>
              <button
                @click.stop="handlePlayRecord(item)"
                class="record-action flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
              >
                <i class="ri-play-fill text-lg" />
              </button>
            </div>
            <div
              v-if="!recordList || recordList.length === 0"
              class="flex h-32 items-center justify-center d-text-muted"
            >
              {{ t('user.ranking.empty') || '暂无听歌记录' }}
            </div>
          </div>
        </div>
        <play-bottom />
      </div>
      <div
        v-if="!isLoggedIn"
        class="login-container flex h-full w-full items-center justify-center"
        :class="setAnimationClass('animate__fadeIn')"
      >
        <login-component @login-success="handleLoginSuccess" />
      </div>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { useMessage } from 'naive-ui';
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { getUserAlbumSublist, getUserDetail, getUserPlaylist, getUserRecord } from '@/api/user';
import { navigateToMusicList } from '@/components/common/MusicListNavigator';
import PlayBottom from '@/components/common/PlayBottom.vue';
import PlatformAccounts from '@/components/user/PlatformAccounts.vue';
import { usePlayerStore } from '@/store/modules/player';
import { useUserStore } from '@/store/modules/user';
import { getImgUrl, isElectron, isMobile, setAnimationClass } from '@/utils';
import { checkLoginStatus as checkAuthStatus } from '@/utils/auth';
import LoginComponent from '@/views/login/index.vue';

defineOptions({
  name: 'User'
});

const { t } = useI18n();
const userStore = useUserStore();
const playerStore = usePlayerStore();
const router = useRouter();
const { userDetail, recordList } = storeToRefs(userStore);
const infoLoading = ref(false);
const albumLoading = ref(false);
const mounted = ref(true);
const message = useMessage();

const tabs = [
  { key: 'created', label: 'user.tabs.created' },
  { key: 'favorite', label: 'user.tabs.favorite' },
  { key: 'album', label: 'user.tabs.album' },
  { key: 'platforms', label: 'user.tabs.platforms' }
];
const currentTab = ref('created');

const user = computed(() => userStore.user);

const createdPlaylists = computed(() => {
  if (!user.value) return [];
  return userStore.playList.filter((item) => item.creator?.userId === user.value!.userId);
});

const favoritePlaylists = computed(() => {
  if (!user.value) return [];
  return userStore.playList.filter((item) => item.creator?.userId !== user.value!.userId);
});

const currentList = computed(() => {
  if (currentTab.value === 'album') {
    return userStore.albumList;
  }
  return currentTab.value === 'created' ? createdPlaylists.value : favoritePlaylists.value;
});

const getCoverUrl = (item: any) => {
  return item.coverImgUrl || item.picUrl || '';
};

const getItemDescription = (item: any) => {
  if (currentTab.value === 'album') {
    const artist = item.artist?.name || '';
    const size = item.size ? ` · ${item.size}首` : '';
    return `${artist}${size}`;
  } else {
    return `${t('user.playlist.trackCount', { count: item.trackCount })}，${t('user.playlist.playCount', { count: item.playCount })}`;
  }
};

const handleItemClick = (item: any) => {
  if (currentTab.value === 'album') {
    openAlbum(item);
  } else {
    openPlaylist(item);
  }
};

const goToImportPlaylist = () => {
  router.push('/playlist/import');
};

const isFavorited = (songId: number) => {
  return playerStore.favoriteList.some((item: any) => item.id === songId);
};

const toggleFavorite = async (item: any) => {
  const songId = parseInt(item.id);
  if (playerStore.favoriteList.some((s: any) => s.id === songId)) {
    await playerStore.removeFromFavorite(songId);
  } else {
    await playerStore.addToFavorite(songId);
  }
};

const getArtistNames = (item: any) => {
  if (item.ar) return item.ar.map((a: any) => a.name).join(', ');
  if (item.artists) return item.artists.map((a: any) => a.name).join(', ');
  return '';
};

const handlePlayRecord = (item: any) => {
  const tracks = recordList.value || [];
  playerStore.setPlayList(tracks);
  playerStore.setPlay(item);
};

onBeforeUnmount(() => {
  mounted.value = false;
});

const checkLoginStatus = () => {
  if (userStore.user && userStore.loginType) {
    return true;
  }
  const loginInfo = checkAuthStatus();
  if (!loginInfo.isLoggedIn) {
    return false;
  }
  return true;
};

const loadPage = async () => {
  if (!mounted.value) return;
  if (!checkLoginStatus()) return;
  await loadData();
};

const loadData = async () => {
  try {
    if (!userDetail.value || !recordList.value?.length) {
      infoLoading.value = true;
    }
    if (!user.value) {
      console.warn('用户数据不存在，尝试重新获取');
      return;
    }
    const promises = [getUserDetail(user.value.userId), getUserRecord(user.value.userId)];
    if (userStore.playList.length === 0) {
      promises.push(getUserPlaylist(user.value.userId));
    }
    const results = await Promise.all(promises);
    if (!mounted.value) return;
    userDetail.value = results[0].data;
    // /user/record 返回 { allData: [...], weekData: [...] }，但某些 API 版本可能只返回 weekData
    const recordData = results[1].data;
    const recordListData = recordData?.allData || recordData?.weekData || [];
    recordList.value = recordListData.map((item: any) => ({
      ...item,
      ...(item.song || {}),
      picUrl: item.song?.al?.picUrl || item.picUrl || ''
    }));
    if (results.length > 2 && results[2].data?.playlist) {
      userStore.playList = results[2].data.playlist;
    }
  } catch (error: any) {
    console.error('加载用户页面失败:', error);
    if (error.response?.status === 401 || error.response?.status === 301) {
      userStore.handleLogout();
      router.push('/login');
    } else {
      message.error(t('user.message.loadFailed'));
    }
  } finally {
    if (mounted.value) {
      infoLoading.value = false;
    }
  }
};

const loadAlbumList = async () => {
  if (userStore.albumList.length > 0) return;
  try {
    albumLoading.value = true;
    const res = await getUserAlbumSublist({ limit: 100, offset: 0 });
    if (!mounted.value) return;
    userStore.albumList = res.data.data || [];
  } catch (error: any) {
    console.error('加载专辑列表失败:', error);
    message.error('加载专辑列表失败');
  } finally {
    if (mounted.value) {
      albumLoading.value = false;
    }
  }
};

watch(
  () => router.currentRoute.value.path,
  (newPath) => {
    if (newPath === '/user') {
      checkLoginStatus();
      loadData();
    }
  }
);

watch(
  () => userStore.user,
  (newUser) => {
    if (!mounted.value) return;
    if (newUser) {
      checkLoginStatus();
      loadPage();
    }
  }
);

watch(currentTab, async (newTab) => {
  if (newTab === 'album') {
    await userStore.initializeCollectedAlbums();
    if (userStore.albumList.length === 0) {
      loadAlbumList();
    }
  }
});

onMounted(() => {
  checkLoginStatus() && loadData();
});

const openPlaylist = (item: any) => {
  navigateToMusicList(router, {
    id: item.id,
    type: 'playlist',
    name: item.name,
    listInfo: item,
    canRemove: true
  });
};

const openAlbum = async (item: any) => {
  navigateToMusicList(router, {
    id: item.id,
    type: 'album',
    name: item.name,
    listInfo: {
      ...item,
      coverImgUrl: item.picUrl || item.coverImgUrl
    },
    canRemove: false
  });
};

const showFollowList = () => {
  if (!user.value) return;
  router.push('/user/follows');
};

const handleLoginSuccess = () => {
  checkLoginStatus();
  loadData();
};

const isLoggedIn = computed(() => userStore.user);
const currentLoginType = computed(() => userStore.loginType);
</script>

<style lang="scss" scoped>
.user-page {
  @apply flex flex-col min-h-0 overflow-y-auto;
}

.login-type {
  @apply text-sm;
  color: var(--accent-color);
}

.mobile {
  .user-page {
    padding-left: var(--page-pl);
    padding-right: var(--page-pr);
  }
  .login-container {
    @apply flex justify-center items-center h-full w-full;
  }
}

:deep(.n-tabs-rail) {
  @apply rounded-xl overflow-hidden !important;
  .n-tabs-capsule {
    @apply rounded-xl !important;
  }
}

/* 导入按钮 */
.import-btn {
  transition: var(--d-transition-colors);
}

.import-btn:hover {
  background: var(--d-surface-hover);
}

.import-btn-icon {
  background: var(--d-surface-alt);
}

/* 列表项卡片 */
.list-item-card {
  transition: var(--d-transition-colors);
}

.list-item-card:hover {
  background: var(--d-surface-hover);
}

/* 排行榜列表项 */
.record-item {
  transition: var(--d-transition-colors);
}

.record-item:hover {
  background: var(--d-surface-hover);

  .record-action {
    opacity: 1;
  }
}

.record-action {
  transition: var(--d-transition-colors);
  color: var(--d-text-muted);
}

.record-action.is-favorited {
  color: #ef4444;
  opacity: 1;
}

.record-action:not(.is-favorited):hover {
  color: #f87171;
}

.record-play-btn:hover {
  color: var(--accent-color);
}
</style>
