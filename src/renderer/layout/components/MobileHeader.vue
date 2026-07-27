<template>
  <div class="floating-topbar" :class="{ 'safe-area-top': hasSafeArea }">
    <!-- 页面名 -->
    <div class="topbar-pill topbar-title-pill" @click="onTitleClick">
      <i v-if="showBack" class="ri-arrow-left-s-line"></i>
      <span class="topbar-title-text">{{ displayTitle }}</span>
    </div>

    <!-- 搜索框 -->
    <div class="topbar-pill topbar-search-pill" @click="openSearch">
      <i class="ri-search-line"></i>
      <span class="topbar-search-text">{{ t('comp.searchBar.searchPlaceholder') }}</span>
    </div>

    <!-- 头像 -->
    <div class="topbar-pill topbar-avatar-pill" @click="goToUser">
      <img v-if="avatarUrl" :src="avatarUrl" alt="avatar" class="avatar-img" />
      <div v-else class="avatar-placeholder">
        <i class="ri-user-3-line"></i>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { useUserStore } from '@/store/modules/user';
import { getImgUrl } from '@/utils';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const userStore = useUserStore();

const hasSafeArea = inject('hasSafeArea', false);

const showBack = computed(() => route.meta.back === true);

const displayTitle = computed(() => {
  if (route.path === '/') return 'Zephyrus';
  const title = route.meta.title as string;
  return title ? t(title) : '';
});

const avatarUrl = computed(() => {
  const url = userStore.user?.avatarUrl;
  return url ? getImgUrl(url, '72y72') : '';
});

const onTitleClick = () => {
  if (showBack.value) router.back();
};

const openSearch = () => router.push('/mobile-search');

const goToUser = () => router.push('/user');
</script>

<style lang="scss" scoped>
.floating-topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  padding-top: var(--safe-area-inset-top, 0px);
  padding-top: calc(var(--safe-area-inset-top, 0px) + 8px);
  padding-bottom: 8px;
  pointer-events: none; /* allow scroll-through on gaps */
  transition: padding-top 0.3s ease;
}

.topbar-pill {
  display: flex;
  align-items: center;
  height: 40px;
  border-radius: 20px;
  background: var(--cover-surface, rgba(255, 255, 255, 0.08));
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid var(--cover-border, rgba(255, 255, 255, 0.06));
  cursor: pointer;
  pointer-events: auto;
  transition: transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1),
              background 0.4s ease, border-color 0.4s ease;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;

  &:active {
    transform: scale(0.95);
  }
}

/* 页面名 */
.topbar-title-pill {
  flex-shrink: 0;
  padding: 0 14px;
  gap: 2px;
  max-width: 120px;

  i {
    font-size: 22px;
    color: var(--cover-text-primary, var(--text-color));
    flex-shrink: 0;
  }
}

.topbar-title-text {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--cover-text-primary, var(--text-color));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: opacity 0.25s ease;
}

/* 搜索框 */
.topbar-search-pill {
  flex: 1;
  min-width: 0;
  padding: 0 14px;
  gap: 8px;

  i {
    font-size: 17px;
    color: var(--cover-text-muted, #9a9590);
    flex-shrink: 0;
  }
}

.topbar-search-text {
  flex: 1;
  font-size: 13px;
  color: var(--cover-text-muted, #9a9590);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
}

/* 头像 */
.topbar-avatar-pill {
  flex-shrink: 0;
  padding: 3px;
  width: 40px;
  height: 40px;
  justify-content: center;
}

.avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 17px;
  object-fit: cover;
}

.avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: 17px;
  background: var(--cover-surface-hover, rgba(255, 255, 255, 0.12));
  color: var(--cover-text-muted, #9a9590);
  font-size: 18px;
}

@media (prefers-reduced-motion: reduce) {
  .topbar-pill {
    transition: none;
  }
}
</style>
