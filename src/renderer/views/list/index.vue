<template>
  <div class="my-music-page">
    <!-- 标题区 -->
    <div class="page-header page-padding">
      <h1 class="page-title">{{ t('comp.list') }}</h1>
      <p class="page-subtitle">{{ items.length }} {{ t('comp.musicList.songs') }}</p>
    </div>

    <!-- 封面网格 -->
    <n-scrollbar class="grid-scroll-area">
      <div class="cover-grid page-padding">
        <div
          v-for="item in items"
          :key="`${item.type}-${item.id}`"
          class="cover-card pressable"
          @click="handleItemClick(item)"
        >
          <div class="cover-wrap">
            <img
              v-if="item.src"
              :src="getImgUrl(item.src, '300y300')"
              :alt="item.alt"
              draggable="false"
              class="cover-img"
              loading="lazy"
            />
            <div v-else class="cover-placeholder">
              <i class="ri-disc-line text-3xl text-[var(--accent-color)] opacity-40" />
            </div>
            <!-- 播放按钮 -->
            <div class="cover-play-overlay">
              <i class="ri-play-fill" />
            </div>
          </div>
          <div class="cover-text">
            <p class="cover-name">{{ item.alt }}</p>
            <span class="cover-type-badge" :class="item.type">
              {{ item.type === 'album' ? 'Album' : 'Playlist' }}
            </span>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="items.length === 0" class="empty-state">
        <i class="ri-disc-line"></i>
        <p>暂无歌单或专辑</p>
      </div>
    </n-scrollbar>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { useOverlayNavigate } from '@/hooks/useOverlayNavigate';
import { useUserStore } from '@/store';
import { getImgUrl } from '@/utils';

defineOptions({ name: 'MyMusic' });

const { t } = useI18n();
const { navigate } = useOverlayNavigate();
const userStore = useUserStore();

// 数据：歌单 + 专辑
const items = computed(() => {
  const playlists = userStore.playList.map((pl: any) => ({
    id: pl.id,
    src: pl.coverImgUrl || '',
    alt: pl.name || '未知歌单',
    type: 'playlist' as const
  }));
  const albums = userStore.albumList.map((al: any) => ({
    id: al.id,
    src: al.picUrl || al.blurPicUrl || '',
    alt: al.name || '未知专辑',
    type: 'album' as const
  }));
  return [...playlists, ...albums];
});

const handleItemClick = (item: any) => {
  navigate(`/music-list/${item.id}?type=${item.type === 'album' ? 'album' : 'playlist'}`);
};
</script>

<style lang="scss" scoped>
.my-music-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: var(--m-bg, var(--bg-color, #f5f1eb));
}

.page-header {
  flex-shrink: 0;
  padding-top: var(--safe-area-inset-top, 0px);
  padding-bottom: 12px;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--m-text-primary, #2c2c2c);
  margin: 0;
}

.page-subtitle {
  font-size: 13px;
  color: var(--m-text-muted, #9a9590);
  margin: 4px 0 0;
}

.grid-scroll-area {
  flex: 1;
  min-height: 0;
}

/* 响应式封面网格 */
.cover-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  padding-bottom: calc(var(--safe-area-inset-bottom, 0px) + 80px);

  @media (min-width: 480px) {
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }

  @media (min-width: 768px) {
    grid-template-columns: repeat(4, 1fr);
    gap: 24px;
  }

  @media (min-width: 1024px) {
    grid-template-columns: repeat(5, 1fr);
  }
}

/* 封面卡片 */
.cover-card {
  cursor: pointer;
  user-select: none;
}

.cover-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  background: var(--m-surface, rgba(128, 128, 128, 0.1));
  box-shadow: 0 2px 10px var(--m-shadow, rgba(0, 0, 0, 0.06));
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);

  &:active {
    transform: scale(0.97);
  }
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  pointer-events: none;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    135deg,
    rgba(var(--accent-color-rgb, 136, 136, 136), 0.15),
    rgba(var(--accent-color-rgb, 136, 136, 136), 0.05)
  );
}

/* 悬停播放按钮 */
.cover-play-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0);
  transition: background 0.3s ease;
  pointer-events: none;

  i {
    font-size: 28px;
    color: #fff;
    opacity: 0;
    transform: scale(0.8);
    transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }

  .cover-card:hover & {
    background: rgba(0, 0, 0, 0.25);

    i {
      opacity: 1;
      transform: scale(1);
    }
  }

  /* 移动端常驻播放图标 */
  @media (hover: none) {
    i {
      opacity: 0.7;
      transform: scale(1);
    }
    background: linear-gradient(to top, rgba(0, 0, 0, 0.3) 0%, transparent 50%);
  }
}

/* 封面文字 */
.cover-text {
  margin-top: 8px;
}

.cover-name {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--m-text-primary, #2c2c2c);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.cover-type-badge {
  display: inline-block;
  margin-top: 4px;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 9999px;
  text-transform: uppercase;
  letter-spacing: 0.05em;

  &.playlist {
    background: rgba(var(--accent-color-rgb, 136, 136, 136), 0.12);
    color: var(--accent-color, #888);
  }

  &.album {
    background: rgba(99, 102, 241, 0.12);
    color: #6366f1;
  }
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  gap: 12px;
  color: var(--m-text-muted, #9a9590);

  i {
    font-size: 56px;
    opacity: 0.3;
  }

  p {
    font-size: 14px;
  }
}
</style>
