<template>
  <div
    ref="topbarRootRef"
    class="floating-topbar"
    :class="{
      'safe-area-top': hasSafeArea,
      'is-search': isSearchPage,
      'has-back': showBack,
      'menu-expanded': topbarMenu.expanded.value,
      'filter-expanded': searchTypeExpanded,
      'create-expanded': createPlaylistExpanded,
      'assist-expanded': showSearchAssist,
      'wide-detail-topbar': usesWideDetailTopbar,
      'legacy-content-topbar': usesLegacyContentTopbar,
      'player-surface-active': playerHeaderMounted
    }"
    :style="{ '--player-header-progress': String(playerTransition.progress.value) }"
  >
    <Transition name="topbar-pill-morph">
      <button v-if="showBack" type="button" class="topbar-pill topbar-back" @click="onTitleClick">
        <i class="ri-arrow-left-s-line" />
      </button>
    </Transition>

    <!-- 标题形变胶囊（详情页出现）：收合/展开的形变过渡 -->
    <Transition
      name="topbar-pill-morph"
      mode="out-in"
      @enter="onTopbarPillMorphEnter"
      @leave="onTopbarPillMorphLeave"
    >
      <div
        v-if="showPageCapsule"
        :key="route.path"
        ref="morphAnchorRef"
        class="topbar-morph-anchor"
        :class="{ expanded: topbarMenu.expanded.value }"
        :style="morphAnchorStyle"
      >
        <section
          ref="morphPanelRef"
          class="topbar-pill topbar-morph"
          :class="{ expanded: topbarMenu.expanded.value, 'has-menu': hasMorphMenu }"
          @pointerdown.stop
        >
          <header ref="morphTriggerRef" class="morph-trigger" @click.stop="toggleMorphMenu">
            <img
              v-if="topbarMenu.presentation.value?.imageUrl"
              :src="topbarMenu.presentation.value.imageUrl"
              class="morph-trigger-image"
              alt=""
            />
            <span class="morph-trigger-copy">
              <strong>{{
                topbarMenu.presentation.value?.title ||
                (hasMorphMenu ? topbarMenu.activeLabel.value || displayTitle : displayTitle)
              }}</strong>
              <small v-if="topbarMenu.presentation.value?.subtitle">
                {{ topbarMenu.presentation.value.subtitle }}
              </small>
            </span>
            <i v-if="hasMorphMenu" class="ri-arrow-down-s-line" />
          </header>
          <div v-if="topbarMenu.presentation.value?.badge" class="morph-badge">
            {{ topbarMenu.presentation.value.badge }}
          </div>
          <div ref="morphContentRef" class="morph-content" @click.stop>
            <section v-if="topbarMenu.presentation.value?.description" class="morph-description">
              <header v-if="topbarMenu.presentation.value.descriptionTitle">
                <i class="ri-information-line" />
                <strong>{{ topbarMenu.presentation.value.descriptionTitle }}</strong>
              </header>
              <p>{{ topbarMenu.presentation.value.description }}</p>
            </section>
            <label v-if="topbarMenu.presentation.value?.searchPlaceholder" class="morph-search">
              <i class="ri-search-line" />
              <input
                ref="morphSearchInputRef"
                :value="topbarMenu.presentation.value.searchValue || ''"
                :placeholder="topbarMenu.presentation.value.searchPlaceholder"
                @input="
                  topbarMenu.presentation.value.onSearchInput?.(
                    ($event.target as HTMLInputElement).value
                  )
                "
              />
            </label>
            <div v-for="group in topbarMenu.groups.value" :key="group.id" class="morph-group">
              <button
                v-for="option in group.options"
                :key="option.key"
                type="button"
                :class="{ active: String(option.key) === String(group.value) }"
                @click="selectMorphOption(group, option.key)"
              >
                <i v-if="option.icon" :class="option.icon" />
                <span>{{ option.label }}</span>
                <i v-if="String(option.key) === String(group.value)" class="ri-check-line" />
              </button>
            </div>
            <div v-if="topbarMenu.actions.value.length" class="morph-actions">
              <section
                v-for="action in topbarMenu.actions.value"
                :key="action.id"
                class="morph-action-shell"
                :class="{ expanded: expandedMorphActionId === action.id }"
              >
                <button
                  type="button"
                  class="morph-action-trigger"
                  @click.stop="runMorphAction(action)"
                >
                  <i :class="action.icon" />
                  <span>{{ action.label }}</span>
                  <i
                    v-if="action.options?.length"
                    class="ri-arrow-down-s-line morph-action-arrow"
                  />
                </button>
                <div v-if="action.options?.length" class="morph-action-options-wrap">
                  <div class="morph-action-options">
                    <button
                      v-for="option in action.options"
                      :key="option.key"
                      type="button"
                      :class="{ active: String(option.key) === String(action.value) }"
                      @click.stop="selectMorphActionOption(action, option.key)"
                    >
                      <span>{{ option.label }}</span>
                      <i v-if="String(option.key) === String(action.value)" class="ri-check-line" />
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>
    </Transition>

    <!-- 搜索框（非搜索页：点击跳转；搜索页：真实输入框） -->
    <section
      class="topbar-pill topbar-search-pill"
      :class="{
        'search-circle': usesWideDetailTopbar,
        'assist-expanded': showSearchAssist
      }"
      :style="searchPillStyle"
      @click="!isSearchPage && !isSettingsPage && openSearch()"
      :aria-label="t('comp.searchBar.searchPlaceholder')"
      @pointerdown.stop
    >
      <div class="topbar-search-row">
        <i class="ri-search-line search-icon"></i>
        <input
          ref="searchInputRef"
          :value="
            isSettingsPage ? settingsSearchValue : isSearchPage ? searchStore.searchValue : ''
          "
          type="text"
          class="search-input"
          :readonly="!isSearchPage && !isSettingsPage"
          :placeholder="isSettingsPage ? topbarSearchPlaceholder : searchStore.placeholder"
          @input="onTopbarInput"
          @focus="(isSearchPage || isSettingsPage) && handleSearchFocus()"
          @click="(isSearchPage || isSettingsPage) && handleSearchFocus()"
          @keydown.enter="isSearchPage && handleSearchSubmit()"
        />
        <i
          v-if="
            (isSearchPage && searchStore.searchValue) || (isSettingsPage && settingsSearchValue)
          "
          class="ri-close-circle-fill clear-icon"
          @click.stop="isSettingsPage ? clearSettingsSearch() : clearSearch()"
        ></i>
      </div>

      <div class="search-assist-panel" :aria-hidden="!showSearchAssist" @click.stop>
        <header class="search-assist-header">
          <div class="search-assist-title">
            <i
              :class="
                isSettingsPage
                  ? 'ri-settings-3-line'
                  : showingHistory
                    ? 'ri-time-line'
                    : 'ri-search-line'
              "
            />
            <span>
              {{
                isSettingsPage
                  ? '设置建议'
                  : showingHistory
                    ? t('search.title.searchHistory')
                    : t('search.suggestions')
              }}
            </span>
          </div>
          <button
            v-if="!isSettingsPage && showingHistory && searchHistory.length"
            type="button"
            class="search-assist-clear"
            @click="clearSearchHistory"
          >
            {{ t('search.button.clear') }}
          </button>
        </header>

        <div v-if="suggestionsLoading" class="search-assist-loading">
          <i class="ri-loader-4-line" />
        </div>

        <div v-else-if="isSettingsPage && settingsAssistItems.length" class="search-assist-list">
          <button
            v-for="(item, itemIndex) in settingsAssistItems"
            :key="`settings-${item.tabId}-${item.title}-${itemIndex}`"
            type="button"
            class="search-assist-item search-assist-item--setting"
            @click="selectSettingsAssistItem(item)"
          >
            <span class="settings-assist-section">{{ item.tabLabel }}</span>
            <span class="settings-assist-copy">
              <strong>{{ item.title }}</strong>
              <small>{{ item.desc }}</small>
            </span>
            <i class="ri-arrow-right-s-line item-arrow" />
          </button>
        </div>

        <div v-else-if="!isSettingsPage && assistItems.length" class="search-assist-list">
          <button
            v-for="(item, itemIndex) in assistItems"
            :key="`${showingHistory ? 'history' : 'suggestion'}-${item}-${itemIndex}`"
            type="button"
            class="search-assist-item"
            @click="selectSearchAssistItem(item)"
          >
            <i :class="showingHistory ? 'ri-history-line' : 'ri-search-line'" />
            <span>{{ item }}</span>
            <i class="ri-arrow-right-up-line item-arrow" />
          </button>
        </div>

        <div v-else class="search-assist-empty">
          <i :class="showingHistory ? 'ri-history-line' : 'ri-search-eye-line'" />
          <span>{{ t('common.noData') }}</span>
        </div>
      </div>
    </section>

    <div v-if="isSearchPage" class="topbar-morph-anchor topbar-search-morph-anchor">
      <section
        class="topbar-pill topbar-morph topbar-search-morph"
        :class="{ expanded: searchTypeExpanded }"
        @pointerdown.stop
      >
        <header class="morph-trigger search-filter-trigger" @click.stop="toggleSearchTypeMenu">
          <span>{{ activeSearchTypeLabel }}</span>
          <i class="ri-arrow-down-s-line" />
        </header>
        <div class="morph-content search-filter-content" @click.stop>
          <div class="search-filter-grid">
            <section class="search-filter-column">
              <p class="search-filter-heading">搜索类型</p>
              <div class="morph-group search-filter-options">
                <button
                  v-for="type in searchTypes"
                  :key="type.key"
                  type="button"
                  :class="{ active: Number(type.key) === Number(searchStore.searchType) }"
                  @click.stop="selectSearchType(type.key)"
                >
                  <span>{{ type.label }}</span>
                  <i
                    v-if="Number(type.key) === Number(searchStore.searchType)"
                    class="ri-check-line"
                  />
                </button>
              </div>
            </section>
            <section class="search-filter-column">
              <p class="search-filter-heading">来源</p>
              <div class="morph-group search-filter-options search-source-options">
                <button
                  v-for="source in searchStore.searchSourceOptions"
                  :key="source.key"
                  type="button"
                  class="search-source-option"
                  :class="{ active: source.key === searchStore.searchSource }"
                  @click.stop="selectSearchSource(source.key)"
                >
                  <platform-logo
                    v-if="platformForSearchSource(source.key)"
                    :platform="platformForSearchSource(source.key)"
                    :size="16"
                  />
                  <i v-else class="ri-apps-2-line" />
                  <span
                    >{{ source.label
                    }}<small v-if="source.count != null"> {{ source.count }}</small></span
                  >
                  <i v-if="source.key === searchStore.searchSource" class="ri-check-line" />
                </button>
              </div>
            </section>
          </div>
        </div>
      </section>
    </div>

    <!-- 右侧动作胶囊随路由切换：缩回再展开的形变过渡 -->
    <Transition name="topbar-pill-morph" mode="out-in">
      <button
        v-if="route.path === '/user'"
        key="settings"
        type="button"
        class="topbar-pill topbar-action-pill topbar-settings-pill"
        :title="t('common.settings')"
        @click="goToSettings"
      >
        <i class="ri-settings-3-line action-icon" />
      </button>

      <!-- 歌单页:加号胶囊,点击原地变形为创建歌单面板(锚点宽度归零,搜索框自动右延) -->
      <div
        v-else-if="route.path === '/list'"
        key="create-playlist"
        ref="createPillAnchorRef"
        class="topbar-create-anchor"
        :class="{ expanded: createPlaylistExpanded }"
      >
        <button
          type="button"
          class="topbar-pill topbar-action-pill topbar-create-pill"
          :title="t('comp.playlistDrawer.createPlaylist') || '创建歌单'"
          :aria-expanded="createPlaylistExpanded"
          @click="toggleCreatePlaylist"
        >
          <i class="ri-add-line action-icon" />
        </button>

        <div class="topbar-create-panel" :aria-hidden="!createPlaylistExpanded">
          <div class="topbar-create-body">
            <header>
              <h3>{{ t('comp.playlistDrawer.createPlaylist') || '创建歌单' }}</h3>
              <button type="button" :aria-label="t('common.close')" @click="closeCreatePlaylist">
                <i class="ri-close-line" />
              </button>
            </header>
            <input
              v-model="createPlaylistName"
              type="text"
              maxlength="40"
              :placeholder="t('comp.playlistDrawer.namePlaceholder') || '给新歌单起个名字'"
              @keyup.enter="submitCreatePlaylist"
            />
            <textarea
              v-model="createPlaylistDesc"
              maxlength="1000"
              :placeholder="t('comp.playlistDrawer.descPlaceholder') || '添加简介（可选）'"
            ></textarea>
            <div class="create-playlist-cover">
              <button type="button" class="cover-picker" @click="createCoverInputRef?.click()">
                <img v-if="createPlaylistCover" :src="createPlaylistCover.url" alt="" />
                <i v-else class="ri-image-add-line"></i>
              </button>
              <div class="cover-meta">
                <span>{{
                  createPlaylistCover
                    ? t('comp.playlistDrawer.coverSelected') || '已选择封面'
                    : t('comp.playlistDrawer.coverPick') || '选择封面（可选）'
                }}</span>
                <button
                  v-if="createPlaylistCover"
                  type="button"
                  class="cover-remove"
                  @click="removeCreatePlaylistCover"
                >
                  {{ t('comp.playlistDrawer.coverRemove') || '移除' }}
                </button>
              </div>
            </div>
            <input
              ref="createCoverInputRef"
              class="create-playlist-cover-input"
              type="file"
              accept="image/*"
              @change="onCreatePlaylistCoverChange"
            />
            <button
              type="submit"
              class="create-playlist-submit"
              :disabled="!createPlaylistName.trim() || creatingPlaylist"
              @click="submitCreatePlaylist"
            >
              {{ creatingPlaylist ? t('common.loading') : t('common.confirm') || '创建' }}
            </button>
            <p v-if="createPlaylistError" class="create-playlist-error">
              {{ createPlaylistError }}
            </p>
          </div>
        </div>
      </div>

      <!-- 头像 / 搜索按钮 -->
      <div
        v-else
        key="avatar"
        class="topbar-pill topbar-action-pill"
        :class="{ 'search-btn': isSearchPage }"
        @click="isSearchPage ? handleSearchSubmit() : goToUser()"
      >
        <i v-if="isSearchPage" class="ri-search-line action-icon"></i>
        <template v-else>
          <img v-if="avatarUrl" :src="avatarUrl" alt="avatar" class="avatar-img" />
          <div v-else class="avatar-placeholder">
            <i class="ri-user-3-line"></i>
          </div>
        </template>
      </div>
    </Transition>

    <div
      v-if="playerHeaderMounted"
      class="player-header-layer no-toggle"
      :class="{
        'surface-interaction-active': playerSurfaceFeedback.active.value,
        'collapse-only': !lyricSelection.active.value,
        'lyric-selection-mode': lyricSelection.active.value
      }"
      :style="playerHeaderStyle"
    >
      <template v-if="lyricSelection.active.value">
        <button
          type="button"
          class="player-header-button"
          aria-label="退出歌词选择"
          :style="playerCloseMorphStyle"
          @click="lyricSelection.cancel()"
        >
          <i class="ri-close-line" />
        </button>
        <div class="player-header-song-pill lyric-selection-active" :style="playerSongMorphStyle">
          <span>
            <strong>{{ t('player.share.selectLyrics') || '选择歌词' }}</strong>
            <small>已选择 {{ lyricSelection.selectedCount.value }} 句</small>
          </span>
        </div>
        <button
          type="button"
          class="player-header-button"
          aria-label="全选或取消全选"
          :style="playerSettingsMorphStyle"
          @click="lyricSelection.toggleAll()"
        >
          <i
            :class="
              lyricSelection.allSelected.value
                ? 'ri-checkbox-circle-fill'
                : 'ri-checkbox-multiple-line'
            "
          />
        </button>
      </template>
      <button
        v-else
        type="button"
        class="player-collapse-indicator"
        aria-label="收起播放器"
        @click="onCollapseIndicatorClick"
        @pointerdown="onCollapsePointerDown"
        @pointermove="onCollapsePointerMove"
        @pointerup="onCollapsePointerUp"
        @pointercancel="onCollapsePointerCancel"
      >
        <span class="collapse-line" />
        <i class="ri-arrow-down-s-line" />
      </button>
    </div>
  </div>

  <div
    v-if="topbarMenu.expanded.value || searchTypeExpanded || showSearchAssist"
    class="morph-dismiss-layer"
    @pointerdown="closeFloatingMenus"
  />
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core';
import { onClickOutside } from '@vueuse/core';
import type { CSSProperties } from 'vue';
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { createPlaylist, updatePlaylistCover, updatePlaylistDesc } from '@/api/music';
import { getSearchSuggestions } from '@/api/search';
import PlatformLogo from '@/components/common/PlatformLogo.vue';
import { useLyricSelectionSurface } from '@/composables/useLyricSelectionSurface';
import { useMobilePlayerTransition } from '@/composables/useMobilePlayerTransition';
import { useMobileTopbarMenu } from '@/composables/useMobileTopbarMenu';
import { usePlayerSurfaceFeedback } from '@/composables/usePlayerSurfaceFeedback';
import { SEARCH_TYPES } from '@/const/bar-const';
import { registerMobileBackLayer } from '@/services/mobileBackStack';
import { usePlatformAccountsStore } from '@/store/modules/platformAccounts';
import { usePlayerStore } from '@/store/modules/player';
import { useSearchStore } from '@/store/modules/search';
import { useUserStore } from '@/store/modules/user';
import { getImgUrl } from '@/utils';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const userStore = useUserStore();
const accountStore = usePlatformAccountsStore();
const searchStore = useSearchStore();
const playerStore = usePlayerStore();
const playerTransition = useMobilePlayerTransition();
const lyricSelection = useLyricSelectionSurface();
const playerSurfaceFeedback = usePlayerSurfaceFeedback();

const hasSafeArea = inject('hasSafeArea', false);

const showBack = computed(() => route.meta.back === true);

const isSearchPage = computed(
  () => route.path === '/mobile-search' || route.path === '/mobile-search-result'
);
const isSettingsPage = computed(() => route.path === '/set');
const showPageCapsule = computed(
  () => !isSearchPage.value && !['/', '/discover', '/user'].includes(route.path)
);
const usesWideDetailTopbar = computed(
  () => route.path.startsWith('/music-list/') || route.path.startsWith('/artist/detail/')
);
const usesLegacyContentTopbar = computed(() => showPageCapsule.value);
const isSearchResultPage = computed(() => route.path === '/mobile-search-result');
const searchTypes = computed(() =>
  SEARCH_TYPES.map((type) => ({ key: type.key, label: t(type.label) }))
);

const topbarMenu = useMobileTopbarMenu(() => route.path);
const isUserPage = computed(() => route.path === '/user');
const hasMorphMenu = computed(
  () =>
    !isUserPage.value &&
    (topbarMenu.groups.value.length > 0 ||
      topbarMenu.actions.value.length > 0 ||
      Boolean(topbarMenu.presentation.value))
);

const displayTitle = computed(() => {
  if (route.path === '/') return t('comp.home');
  const title = route.meta.title as string;
  return title ? t(title) : '';
});

const avatarUrl = computed(() => {
  const url = accountStore.activeAccount?.avatarUrl || userStore.user?.avatarUrl;
  return url ? getImgUrl(url, '72y72') : '';
});

const topbarSearchPlaceholder = computed(() =>
  route.path === '/set' ? '搜索设置项...' : t('comp.searchBar.searchPlaceholder')
);
const playerHeaderMounted = computed(
  () =>
    lyricSelection.active.value || playerStore.musicFull || playerTransition.progress.value > 0.015
);
const playerHeaderVisible = computed(
  () =>
    lyricSelection.active.value ||
    playerTransition.controlsVisible.value ||
    playerTransition.surfaceMode.value !== 'controls'
);
type HeaderMorphRect = { left: number; top: number; width: number; height: number };
const playerHeaderOrigins = ref<{
  close: HeaderMorphRect;
  song: HeaderMorphRect;
  settings: HeaderMorphRect;
} | null>(null);
const playerHeaderStyle = computed<CSSProperties>(() => {
  const progressReveal = lyricSelection.active.value
    ? 1
    : Math.min(1, Math.max(0, playerTransition.progress.value * 2.6));
  const reveal = progressReveal * (playerHeaderVisible.value ? 1 : 0);
  return {
    opacity: String(reveal),
    pointerEvents: reveal > 0.05 ? 'auto' : 'none'
  };
});
const headerTargetTop = () =>
  Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-top') || '0'
  ) + 8;
const morphFromHeaderRect = (
  source: HeaderMorphRect | undefined,
  target: HeaderMorphRect
): CSSProperties => {
  if (!source) return {};
  const progress = Math.min(1, Math.max(0, playerTransition.progress.value));
  const inverse = 1 - progress;
  const sourceCenterX = source.left + source.width / 2;
  const sourceCenterY = source.top + source.height / 2;
  const targetCenterX = target.left + target.width / 2;
  const targetCenterY = target.top + target.height / 2;
  return {
    transform: `translate3d(${(sourceCenterX - targetCenterX) * inverse}px, ${(sourceCenterY - targetCenterY) * inverse}px, 0) scale(${1 + (source.width / target.width - 1) * inverse}, ${1 + (source.height / target.height - 1) * inverse})`
  };
};
const playerCloseMorphStyle = computed<CSSProperties>(() =>
  morphFromHeaderRect(playerHeaderOrigins.value?.close, {
    left: 12,
    top: headerTargetTop(),
    width: 42,
    height: 42
  })
);
const playerSongMorphStyle = computed<CSSProperties>(() => {
  const width = Math.min(260, Math.max(176, window.innerWidth - 130));
  return morphFromHeaderRect(playerHeaderOrigins.value?.song, {
    left: (window.innerWidth - width) / 2,
    top: headerTargetTop(),
    width,
    height: 42
  });
});
const playerSettingsMorphStyle = computed<CSSProperties>(() =>
  morphFromHeaderRect(playerHeaderOrigins.value?.settings, {
    left: window.innerWidth - 54,
    top: headerTargetTop(),
    width: 42,
    height: 42
  })
);

const closePlayer = () => {
  playerTransition.setSurfaceMode('controls');
  playerTransition.close(0, () => playerStore.setMusicFull(false));
};
let collapsePointerId: number | null = null;
let collapseStartY = 0;
let collapseTravel = 1;
let collapseMoved = false;
let collapseSuppressClick = false;
let collapseSamples: Array<{ y: number; time: number }> = [];

const collapseVelocity = () => {
  if (collapseSamples.length < 2) return 0;
  const last = collapseSamples[collapseSamples.length - 1];
  const first =
    collapseSamples.find((sample) => last.time - sample.time <= 100) || collapseSamples[0];
  const elapsed = Math.max(1, last.time - first.time);
  return -(((last.y - first.y) / elapsed) * 1000) / collapseTravel;
};

const onCollapsePointerDown = (event: PointerEvent) => {
  if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
  collapsePointerId = event.pointerId;
  collapseStartY = event.clientY;
  collapseTravel = Math.max(220, window.innerHeight * 0.38);
  collapseMoved = false;
  collapseSamples = [{ y: event.clientY, time: performance.now() }];
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  playerTransition.setDragging(playerTransition.progress.value || 1);
  playerTransition.showControls(false);
};

const onCollapsePointerMove = (event: PointerEvent) => {
  if (collapsePointerId !== event.pointerId) return;
  const delta = event.clientY - collapseStartY;
  if (Math.abs(delta) > 5) collapseMoved = true;
  collapseSamples.push({ y: event.clientY, time: performance.now() });
  collapseSamples = collapseSamples.filter((sample) => performance.now() - sample.time <= 120);
  playerTransition.setDragging(Math.min(1, Math.max(0, 1 - delta / collapseTravel)));
};

const finishCollapseGesture = (event: PointerEvent, cancelled = false) => {
  if (collapsePointerId !== event.pointerId) return;
  const velocity = collapseVelocity();
  const shouldClose = !cancelled && (playerTransition.progress.value < 0.84 || velocity < -0.45);
  if (collapseMoved) collapseSuppressClick = true;
  collapsePointerId = null;
  collapseSamples = [];
  if (shouldClose) {
    playerTransition.setSurfaceMode('controls');
    playerTransition.close(velocity, () => playerStore.setMusicFull(false));
  } else {
    playerTransition.animateTo(1, velocity);
  }
};

const onCollapsePointerUp = (event: PointerEvent) => finishCollapseGesture(event);
const onCollapsePointerCancel = (event: PointerEvent) => finishCollapseGesture(event, true);
const onCollapseIndicatorClick = () => {
  if (collapseSuppressClick) {
    collapseSuppressClick = false;
    return;
  }
  closePlayer();
};

const searchInputRef = ref<HTMLInputElement | null>(null);
const morphSearchInputRef = ref<HTMLInputElement | null>(null);
const topbarRootRef = ref<HTMLElement | null>(null);
const morphAnchorRef = ref<HTMLElement | null>(null);
const morphPanelRef = ref<HTMLElement | null>(null);
const morphTriggerRef = ref<HTMLElement | null>(null);
const morphContentRef = ref<HTMLElement | null>(null);
const morphExpandedWidth = ref<number | null>(null);
const settingsAssistOverlapWidth = ref(72);
const morphAnchorStyle = computed(() =>
  !usesLegacyContentTopbar.value && topbarMenu.expanded.value && morphExpandedWidth.value
    ? { '--topbar-morph-expanded-width': `${morphExpandedWidth.value}px` }
    : undefined
);
const searchPillStyle = computed<CSSProperties | undefined>(() => {
  if (!showSearchAssist.value || !isSettingsPage.value) return undefined;
  return { marginLeft: `-${settingsAssistOverlapWidth.value}px` };
});
const settingsSearchValue = ref('');
const searchTypeExpanded = ref(false);
const expandedMorphActionId = ref<string | null>(null);
const showSearchAssist = ref(false);
type SettingsAssistItem = {
  tabId: string;
  tabLabel: string;
  title: string;
  desc: string;
  titlePath: string;
};
const settingsAssistItems = ref<SettingsAssistItem[]>([]);
const searchHistory = ref<string[]>([]);
const suggestions = ref<string[]>([]);
const suggestionsLoading = ref(false);
const showingHistory = computed(() => !searchStore.searchValue.trim());
const assistItems = computed(() =>
  showingHistory.value ? searchHistory.value : suggestions.value
);
const activeSearchTypeLabel = computed(
  () =>
    searchTypes.value.find((type) => Number(type.key) === Number(searchStore.searchType))?.label ||
    searchTypes.value[0]?.label ||
    ''
);
const HISTORY_KEY = 'mobile_search_history';
let suggestionRequestId = 0;
let morphResizeObserver: ResizeObserver | undefined;

const readHeaderRect = (element: Element | null): HeaderMorphRect | null => {
  if (!(element instanceof HTMLElement)) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
};

const capturePlayerHeaderOrigins = () => {
  const root = topbarRootRef.value;
  if (!root) return;
  const back = readHeaderRect(root.querySelector('.topbar-back'));
  const title = readHeaderRect(root.querySelector('.topbar-morph'));
  const search = readHeaderRect(root.querySelector('.topbar-search-pill'));
  const action = readHeaderRect(root.querySelector('.topbar-action-pill'));
  const center = title || search;
  if (!center) return;
  playerHeaderOrigins.value = {
    close: back || search || center,
    song: center,
    settings: action || search || center
  };
};

watch(
  () => playerTransition.state.value,
  (state, previous) => {
    if ((state === 'dragging' || state === 'opening') && previous === 'idle') {
      capturePlayerHeaderOrigins();
    }
  },
  { flush: 'sync' }
);

const loadSearchHistory = () => {
  try {
    const storedHistory = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    searchHistory.value = Array.isArray(storedHistory)
      ? storedHistory.filter((item): item is string => typeof item === 'string').slice(0, 20)
      : [];
  } catch {
    searchHistory.value = [];
  }
};

const saveSearchHistory = (keyword: string) => {
  loadSearchHistory();
  searchHistory.value = [keyword, ...searchHistory.value.filter((item) => item !== keyword)].slice(
    0,
    20
  );
  localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory.value));
};

const loadSuggestions = async (keyword: string) => {
  const normalizedKeyword = keyword.trim();
  const requestId = ++suggestionRequestId;

  if (!normalizedKeyword) {
    suggestions.value = [];
    suggestionsLoading.value = false;
    return;
  }

  suggestionsLoading.value = true;
  const result = await getSearchSuggestions(normalizedKeyword);
  if (requestId === suggestionRequestId && searchStore.searchValue.trim() === normalizedKeyword) {
    suggestions.value = result;
    suggestionsLoading.value = false;
  }
};

const debouncedLoadSuggestions = useDebounceFn(loadSuggestions, 240);

const openSearchAssist = () => {
  if (!isSearchPage.value && !isSettingsPage.value) return;

  searchTypeExpanded.value = false;
  if (isSettingsPage.value) {
    settingsAssistOverlapWidth.value = (morphAnchorRef.value?.offsetWidth || 64) + 8;
  }
  showSearchAssist.value = true;
  if (isSettingsPage.value) return;
  if (showingHistory.value) {
    suggestionRequestId++;
    suggestions.value = [];
    suggestionsLoading.value = false;
    loadSearchHistory();
  } else {
    debouncedLoadSuggestions(searchStore.searchValue);
  }
};

const closeSearchAssist = () => {
  showSearchAssist.value = false;
};

// Focus search input when entering search page
watch(isSearchPage, (val) => {
  if (val && route.path === '/mobile-search') {
    nextTick(() => {
      setTimeout(() => searchInputRef.value?.focus(), 300);
    });
  }
});

// Sync search value from URL on search result page
watch(
  () => route.query.keyword,
  (keyword) => {
    if (route.path === '/mobile-search-result' && typeof keyword === 'string') {
      searchStore.setSearchValue(keyword);
    }
  },
  { immediate: true }
);

watch(
  () => route.path,
  () => {
    closeSearchAssist();
    topbarMenu.close();
    searchTypeExpanded.value = false;
    expandedMorphActionId.value = null;
  }
);

watch(
  () => playerTransition.progress.value,
  (progress) => {
    if (progress > 0.015) closeFloatingMenus();
  }
);

const closeFloatingMenus = () => {
  topbarMenu.close();
  searchTypeExpanded.value = false;
  expandedMorphActionId.value = null;
  closeSearchAssist();
  if (createPlaylistExpanded.value) closeCreatePlaylist();
};

// ==================== 顶栏胶囊路由过渡 ====================
// 胶囊锚点/back 按钮的出现与消失会瞬间改变 flex 布局，导致搜索框宽度跳变。
// 通过 JS hook 测量目标宽度，做"宽度从 0 展开 / 收缩到 0"的过渡，
// 搜索框随锚点宽度变化被平滑推让，实现顶栏整体的路由切换动画。
const TOPBAR_MORPH_ENTER_MS = 320;
const TOPBAR_MORPH_LEAVE_MS = 190;

const clearTopbarMorphInline = (el: HTMLElement) => {
  el.style.removeProperty('width');
  el.style.removeProperty('min-width');
  el.style.removeProperty('flex-basis');
};

const onTopbarPillMorphEnter = (el: Element, done: () => void) => {
  const node = el as HTMLElement;
  const isBack = node.classList.contains('topbar-back');
  const isAnchor = node.classList.contains('topbar-morph-anchor');
  if (!isBack && !isAnchor) {
    done();
    return;
  }
  let target: number;
  if (isBack) {
    target = node.offsetWidth || 40;
    node.style.flexBasis = '0px';
  } else {
    node.style.width = 'auto';
    target = node.offsetWidth;
    node.style.width = '0px';
    node.style.minWidth = '0px';
  }
  void node.offsetWidth; // 强制 reflow，确保起始尺寸生效后再过渡
  if (isBack) {
    node.style.flexBasis = `${target}px`;
  } else {
    node.style.width = `${target}px`;
    node.style.minWidth = `${target}px`;
  }
  window.setTimeout(() => {
    clearTopbarMorphInline(node);
    done();
  }, TOPBAR_MORPH_ENTER_MS + 60);
};

const onTopbarPillMorphLeave = (el: Element, done: () => void) => {
  const node = el as HTMLElement;
  const isBack = node.classList.contains('topbar-back');
  const isAnchor = node.classList.contains('topbar-morph-anchor');
  if (!isBack && !isAnchor) {
    done();
    return;
  }
  if (isBack) {
    node.style.flexBasis = `${node.offsetWidth}px`;
    void node.offsetWidth;
    node.style.flexBasis = '0px';
  } else {
    const current = node.offsetWidth;
    node.style.width = `${current}px`;
    node.style.minWidth = `${current}px`;
    void node.offsetWidth;
    node.style.width = '0px';
    node.style.minWidth = '0px';
  }
  window.setTimeout(() => {
    clearTopbarMorphInline(node);
    done();
  }, TOPBAR_MORPH_LEAVE_MS + 60);
};

const onTitleClick = () => {
  if (showBack.value) {
    // Clear search value when leaving search
    if (isSearchPage.value) {
      searchStore.setSearchValue('');
    }
    router.back();
  }
};

const toggleMorphMenu = () => {
  if (!hasMorphMenu.value) return;
  topbarMenu.expanded.value = !topbarMenu.expanded.value;
  if (!topbarMenu.expanded.value) expandedMorphActionId.value = null;
};

const measureMorphWidth = () => {
  if (
    usesLegacyContentTopbar.value ||
    !topbarMenu.expanded.value ||
    !morphTriggerRef.value ||
    !morphContentRef.value
  ) {
    morphExpandedWidth.value = null;
    return;
  }

  const fixedSearchWidth = usesWideDetailTopbar.value ? 40 : 72;
  const backWidth = showBack.value ? 40 : 0;
  const visibleItemCount = 3 + (showBack.value ? 1 : 0);
  const availableWidth = Math.max(
    64,
    window.innerWidth - 24 - backWidth - fixedSearchWidth - 40 - (visibleItemCount - 1) * 8
  );
  const measurableRows = Array.from(
    morphContentRef.value.querySelectorAll<HTMLElement>(
      '.morph-description, .morph-search, .morph-group > button, .morph-action-trigger, .morph-action-options > button'
    )
  );
  const desiredWidth = Math.max(
    morphTriggerRef.value.scrollWidth,
    ...measurableRows.map((row) => row.scrollWidth + 28),
    64
  );
  morphExpandedWidth.value = Math.min(availableWidth, desiredWidth);
};

const scheduleMorphMeasurement = () => {
  nextTick(() => {
    [
      topbarRootRef.value,
      morphAnchorRef.value,
      morphPanelRef.value,
      morphTriggerRef.value,
      morphContentRef.value
    ].forEach((element) => element && morphResizeObserver?.observe(element));
    requestAnimationFrame(measureMorphWidth);
  });
};

const selectMorphOption = (group: any, value: string | number) => {
  group.select(value);
  topbarMenu.close();
};

const runMorphAction = (action: any) => {
  if (action.options?.length) {
    expandedMorphActionId.value = expandedMorphActionId.value === action.id ? null : action.id;
    return;
  }
  if (!action.keepOpen) topbarMenu.close();
  expandedMorphActionId.value = null;
  action.run();
  if (action.keepOpen) nextTick(() => morphSearchInputRef.value?.focus());
};

const selectMorphActionOption = (action: any, value: string | number) => {
  action.select?.(value);
  expandedMorphActionId.value = null;
};

const openSearch = () => router.push('/mobile-search');

const onSettingsSearchInput = (event: Event) => {
  const value = (event.target as HTMLInputElement).value;
  settingsSearchValue.value = value;
  window.dispatchEvent(new CustomEvent('mobile-settings-search-input', { detail: value }));
};

const onTopbarInput = (event: Event) => {
  if (isSettingsPage.value) {
    onSettingsSearchInput(event);
  } else if (isSearchPage.value) {
    onSearchInput(event);
  }
};

const onSettingsSearchResults = (event: Event) => {
  settingsAssistItems.value = Array.isArray((event as CustomEvent).detail)
    ? (event as CustomEvent<SettingsAssistItem[]>).detail
    : [];
  showSearchAssist.value = Boolean(settingsSearchValue.value.trim());
};

const clearSettingsSearch = () => {
  settingsSearchValue.value = '';
  window.dispatchEvent(new CustomEvent('mobile-settings-search-input', { detail: '' }));
  settingsAssistItems.value = [];
  closeSearchAssist();
};

const goToUser = () => router.push('/user');
const goToSettings = () => router.push('/set');

// ==================== 顶栏创建歌单(加号原地变形) ====================
const createPlaylistExpanded = ref(false);
const createPillAnchorRef = ref<HTMLElement | null>(null);
let unregisterCreateBackLayer: (() => void) | undefined;

const syncCreateBackLayer = () => {
  if (createPlaylistExpanded.value) {
    if (unregisterCreateBackLayer) return;
    unregisterCreateBackLayer = registerMobileBackLayer({
      id: 'topbar-create-playlist',
      priority: 1090,
      isActive: () => createPlaylistExpanded.value,
      onBack: () => closeCreatePlaylist()
    });
    return;
  }
  unregisterCreateBackLayer?.();
  unregisterCreateBackLayer = undefined;
};
const createPlaylistName = ref('');
const createPlaylistDesc = ref('');
const creatingPlaylist = ref(false);
const createPlaylistError = ref('');
const createCoverInputRef = ref<HTMLInputElement | null>(null);
const createPlaylistCover = ref<{ blob: Blob; url: string; width: number; height: number } | null>(
  null
);

function closeCreatePlaylist() {
  createPlaylistExpanded.value = false;
  syncCreateBackLayer();
  resetCreatePlaylistDialog();
}

function toggleCreatePlaylist() {
  if (createPlaylistExpanded.value) closeCreatePlaylist();
  else {
    createPlaylistExpanded.value = true;
    syncCreateBackLayer();
  }
}

// 外部点击关闭：morph-dismiss-layer 是全屏 fixed 遮罩（z-index 299），
// 会盖在顶栏（z-index 100）内的创建面板之上，导致点击面板任何位置都先触发
// 遮罩的关闭逻辑（表现为"点击穿透、面板秒关"）。因此创建面板不走遮罩，
// 改用 document 捕获阶段监听：点击锚点（胶囊+面板）之外的区域才关闭。
const onCreatePlaylistOutsidePointerDown = (event: PointerEvent) => {
  const anchor = createPillAnchorRef.value;
  if (!anchor || anchor.contains(event.target as Node)) return;
  closeCreatePlaylist();
};

watch(
  createPlaylistExpanded,
  (expanded) => {
    if (expanded) {
      document.addEventListener('pointerdown', onCreatePlaylistOutsidePointerDown, true);
    } else {
      document.removeEventListener('pointerdown', onCreatePlaylistOutsidePointerDown, true);
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onCreatePlaylistOutsidePointerDown, true);
});

function resetCreatePlaylistDialog() {
  createPlaylistName.value = '';
  createPlaylistDesc.value = '';
  if (createPlaylistCover.value) URL.revokeObjectURL(createPlaylistCover.value.url);
  createPlaylistCover.value = null;
}

// 读取图片并中心裁剪为正方形（网易云封面接口要求正方形图片）
async function squareCropCoverFile(file: File) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('image load failed'));
      element.src = objectUrl;
    });
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = side;
    canvas.height = side;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas unavailable');
    context.drawImage(
      image,
      (image.naturalWidth - side) / 2,
      (image.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      side,
      side
    );
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92)
    );
    if (!blob) throw new Error('canvas export failed');
    return { blob, width: side, height: side };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function onCreatePlaylistCoverChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ''; // 允许重复选择同一文件
  if (!file) return;
  try {
    const cropped = await squareCropCoverFile(file);
    if (createPlaylistCover.value) URL.revokeObjectURL(createPlaylistCover.value.url);
    createPlaylistCover.value = { ...cropped, url: URL.createObjectURL(cropped.blob) };
  } catch {
    window.$message?.error('封面图片读取失败');
  }
}

function removeCreatePlaylistCover() {
  if (createPlaylistCover.value) URL.revokeObjectURL(createPlaylistCover.value.url);
  createPlaylistCover.value = null;
}

const submitCreatePlaylist = async () => {
  const name = createPlaylistName.value.trim();
  if (!name || creatingPlaylist.value) return;
  creatingPlaylist.value = true;
  createPlaylistError.value = '';
  try {
    const response = await createPlaylist({ name, privacy: 0 });
    const playlistId = response.data?.data?.id || response.data?.playlist?.id;
    if (!playlistId) throw new Error(response.data?.message || '创建歌单失败');
    // 简介与封面为可选追加项：失败不回滚已创建的歌单，仅在结果提示中说明
    const followUpIssues: string[] = [];
    const desc = createPlaylistDesc.value.trim();
    if (desc) {
      try {
        const descResponse = await updatePlaylistDesc({ id: playlistId, desc });
        if (descResponse.data?.code !== 200) throw new Error();
      } catch {
        followUpIssues.push('简介更新失败');
      }
    }
    const cover = createPlaylistCover.value;
    if (cover) {
      try {
        const coverResponse = await updatePlaylistCover({
          id: playlistId,
          imgFile: cover.blob,
          imgSize: cover.blob.size,
          imgWidth: cover.width,
          imgHeight: cover.height
        });
        if (coverResponse.data?.code !== 200) throw new Error();
      } catch {
        followUpIssues.push('封面更新失败');
      }
    }
    closeCreatePlaylist();
    const resultSuffix = followUpIssues.length ? '（' + followUpIssues.join('、') + '）' : '';
    window.$message?.success('已创建「' + name + '」' + resultSuffix);
  } catch (error: any) {
    createPlaylistError.value = error?.message || '创建歌单失败';
  } finally {
    creatingPlaylist.value = false;
  }
};

const onSearchInput = (e: Event) => {
  const value = (e.target as HTMLInputElement).value;
  searchStore.setSearchValue(value);
  showSearchAssist.value = true;
  if (value.trim()) {
    debouncedLoadSuggestions(value);
  } else {
    suggestionRequestId++;
    suggestions.value = [];
    suggestionsLoading.value = false;
    loadSearchHistory();
  }
};

const handleSearchFocus = () => openSearchAssist();

const toggleSearchTypeMenu = () => {
  closeSearchAssist();
  searchTypeExpanded.value = !searchTypeExpanded.value;
};

const clearSearch = () => {
  searchStore.setSearchValue('');
  openSearchAssist();
};

const selectSearchType = (value: string | number) => {
  const type = Number(value);
  searchStore.setSearchType(type);
  searchTypeExpanded.value = false;
  if (isSearchResultPage.value) {
    router.replace({ path: route.path, query: { ...route.query, type } });
  }
};

const selectSearchSource = (source: string) => {
  if (searchStore.searchType !== 1) searchStore.setSearchType(1);
  searchStore.setSearchSource(source);
  searchTypeExpanded.value = false;
  if (isSearchResultPage.value) {
    router.replace({ path: route.path, query: { ...route.query, type: 1, source } });
  }
};

const platformForSearchSource = (source: string) => {
  if (source === 'netease' || source === 'netease-vip') return 'netease';
  if (source === 'cross-qq') return 'qq';
  if (source === 'cross-joox') return 'joox';
  if (source === 'cross-kugou') return 'kugou';
  if (source === 'cross-spotify') return 'spotify';
  return '';
};

const selectSettingsAssistItem = (item: SettingsAssistItem) => {
  settingsSearchValue.value = '';
  settingsAssistItems.value = [];
  closeSearchAssist();
  searchInputRef.value?.blur();
  window.dispatchEvent(new CustomEvent('mobile-settings-search-select', { detail: item }));
};

const onSettingsSearchReset = () => {
  settingsSearchValue.value = '';
  settingsAssistItems.value = [];
  closeSearchAssist();
  searchInputRef.value?.blur();
};

onMounted(() => {
  // 创建歌单面板:点击锚点容器外部收起
  onClickOutside(createPillAnchorRef, () => {
    if (createPlaylistExpanded.value) closeCreatePlaylist();
  });
  window.addEventListener('mobile-settings-search-results', onSettingsSearchResults);
  window.addEventListener('mobile-settings-search-reset', onSettingsSearchReset);
  window.addEventListener('resize', scheduleMorphMeasurement);
  nextTick(() => {
    if (typeof ResizeObserver === 'undefined') return;
    morphResizeObserver = new ResizeObserver(scheduleMorphMeasurement);
    [
      topbarRootRef.value,
      morphAnchorRef.value,
      morphPanelRef.value,
      morphTriggerRef.value,
      morphContentRef.value
    ].forEach((element) => element && morphResizeObserver?.observe(element));
  });
});

onBeforeUnmount(() => {
  window.removeEventListener('mobile-settings-search-results', onSettingsSearchResults);
  window.removeEventListener('mobile-settings-search-reset', onSettingsSearchReset);
  window.removeEventListener('resize', scheduleMorphMeasurement);
  morphResizeObserver?.disconnect();
  morphResizeObserver = undefined;
  unregisterCreateBackLayer?.();
});

watch(
  () => [
    topbarMenu.expanded.value,
    expandedMorphActionId.value,
    topbarMenu.activeLabel.value,
    topbarMenu.groups.value.length,
    topbarMenu.actions.value.length,
    route.path
  ],
  scheduleMorphMeasurement,
  { flush: 'post' }
);

const clearSearchHistory = () => {
  searchHistory.value = [];
  localStorage.removeItem(HISTORY_KEY);
};

const navigateToSearchResult = (keyword: string) => {
  saveSearchHistory(keyword);
  searchStore.setSearchValue(keyword);
  closeSearchAssist();
  searchInputRef.value?.blur();

  const location = {
    path: '/mobile-search-result',
    query: {
      keyword,
      type: searchStore.searchType,
      ...(searchStore.searchSource ? { source: searchStore.searchSource } : {})
    }
  };
  if (isSearchResultPage.value) {
    router.replace(location);
  } else {
    router.push(location);
  }
};

const selectSearchAssistItem = (keyword: string) => {
  navigateToSearchResult(keyword);
};

const handleSearchSubmit = () => {
  const keyword = searchStore.searchValue.trim();
  if (!keyword) {
    openSearchAssist();
    return;
  }

  navigateToSearchResult(keyword);
};
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
  padding-top: calc(var(--safe-area-inset-top, 0px) + 8px);
  padding-bottom: 8px;
  pointer-events: none; /* allow scroll-through on gaps */
  transition: padding-top 220ms ease;

  &.player-surface-active {
    z-index: 100150;
  }

  &.player-surface-active > .topbar-back,
  &.player-surface-active > .topbar-morph-anchor,
  &.player-surface-active > .topbar-search-pill,
  &.player-surface-active > .topbar-search-morph-anchor,
  &.player-surface-active > .topbar-action-pill,
  // 创建歌单的「+」按钮也要随播放界面展开淡出，否则会以顶栏层级悬浮在播放器上
  &.player-surface-active > .topbar-create-anchor {
    opacity: calc(1 - var(--player-header-progress, 0));
    transform: none;
    pointer-events: none;
  }
}

.player-header-layer {
  position: absolute;
  top: calc(var(--safe-area-inset-top, 0px) + 8px);
  right: 12px;
  left: 12px;
  display: grid;
  grid-template-columns: 42px minmax(176px, 260px) 42px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  transform-origin: center top;
  will-change: transform, opacity;
}

.player-header-layer.collapse-only {
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.player-collapse-indicator {
  display: grid;
  width: 76px;
  height: 42px;
  padding: 6px 0 2px;
  place-items: center;
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.88);
  pointer-events: auto;
  touch-action: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.player-collapse-indicator .collapse-line {
  width: 34px;
  height: 2px;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.7;
}

.player-collapse-indicator i {
  margin-top: -5px;
  font-size: 24px;
  line-height: 1;
}

.player-collapse-indicator:active {
  opacity: 0.72;
  transform: translateY(1px);
}

.player-header-button,
.player-header-song-pill {
  height: 42px;
  border: 1px solid var(--player-glass-border, rgba(255, 255, 255, 0.1));
  background: var(--player-glass-background, rgba(20, 20, 22, 0.2));
  color: var(--player-glass-text, rgba(255, 255, 255, 0.94));
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.06);
  backdrop-filter: var(--player-glass-filter, blur(12px) saturate(145%));
  -webkit-backdrop-filter: var(--player-glass-filter, blur(12px) saturate(145%));
  transform-origin: center center;
  will-change: transform;
  transition:
    border-color var(--player-glass-feedback-duration, 220ms) ease,
    background-color var(--player-glass-feedback-duration, 220ms) ease,
    box-shadow var(--player-glass-feedback-duration, 220ms) ease;
}

.player-header-layer.lyric-selection-mode .player-header-song-pill {
  justify-content: center;
  padding: 0;
  border-color: transparent;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.player-header-layer.lyric-selection-mode .player-header-song-pill span {
  text-align: center;
}

.player-header-layer.lyric-selection-mode .player-header-button {
  border-color: transparent;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.player-header-layer.lyric-selection-mode .player-header-button i {
  font-size: 27px;
}

.player-header-layer.surface-interaction-active .player-header-button,
.player-header-layer.surface-interaction-active .player-header-song-pill {
  border-color: var(--player-glass-border-active, rgba(255, 255, 255, 0.16));
  background: var(--player-glass-background-active, rgba(24, 24, 26, 0.28));
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.08);
}

@supports not (backdrop-filter: blur(1px)) {
  .player-header-button,
  .player-header-song-pill {
    background: var(--player-glass-background-fallback, rgba(24, 24, 26, 0.52));
  }
}

.player-header-button {
  display: grid;
  width: 42px;
  padding: 0;
  place-items: center;
  border-radius: 50%;
  font-size: 21px;
}

.player-header-song-pill {
  display: flex;
  width: clamp(176px, calc(100vw - 130px), 260px);
  min-width: 0;
  align-items: center;
  justify-self: center;
  gap: 9px;
  padding: 3px 13px 3px 4px;
  border-radius: 999px;
}

.player-header-song-pill img {
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  border-radius: 50%;
  object-fit: cover;
}

.player-header-song-pill span {
  display: grid;
  min-width: 0;
  text-align: left;
}

.player-header-song-pill strong,
.player-header-song-pill small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-header-song-pill strong {
  font-size: 12px;
  font-weight: 700;
}

.player-header-song-pill small {
  color: rgba(255, 255, 255, 0.68);
  font-size: 10px;
}

.topbar-morph-anchor {
  position: relative;
  width: fit-content;
  min-width: 64px;
  max-width: 44vw;
  height: 40px;
  flex: 0 1 auto;
  pointer-events: auto;
  transform-origin: left center;
  transition:
    width 360ms cubic-bezier(0.32, 0.72, 0, 1),
    min-width 360ms cubic-bezier(0.32, 0.72, 0, 1),
    flex-basis 360ms cubic-bezier(0.32, 0.72, 0, 1),
    max-width 360ms cubic-bezier(0.32, 0.72, 0, 1);

  &.expanded {
    width: var(--topbar-morph-expanded-width, 180px);
    min-width: var(--topbar-morph-expanded-width, 180px);
    max-width: var(--topbar-morph-expanded-width, 180px);
    flex: 0 0 var(--topbar-morph-expanded-width, 180px);
    z-index: 3;
  }
}

.topbar-pill {
  display: flex;
  align-items: center;
  height: 40px;
  border-radius: 20px;
  background: var(--m-glass-bg);
  backdrop-filter: blur(24px) saturate(170%);
  -webkit-backdrop-filter: blur(24px) saturate(170%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
  cursor: pointer;
  pointer-events: auto;
  transition:
    transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1),
    background 180ms ease,
    border-color 180ms ease,
    max-width 240ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 180ms cubic-bezier(0.32, 0.72, 0, 1),
    padding 220ms cubic-bezier(0.32, 0.72, 0, 1),
    flex 240ms cubic-bezier(0.32, 0.72, 0, 1);
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  overflow: hidden;

  &:active {
    transform: scale(0.95);
  }
}

.topbar-back {
  flex: 0 0 40px;
  justify-content: center;
  padding: 0;
  border-radius: 50%;
  border-color: var(--cover-border, rgba(128, 128, 128, 0.14));
  color: var(--cover-text-primary, var(--text-color));
  font-size: 22px;
  transform-origin: left center;
}

.topbar-morph {
  position: relative;
  z-index: 3;
  flex: 0 0 auto;
  width: max-content;
  height: auto;
  min-width: 64px;
  max-width: 44vw;
  min-height: 40px;
  max-height: 40px;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  padding: 0;
  border-radius: 20px;
  overflow: hidden;
  transform-origin: top left;
  transition:
    width 360ms cubic-bezier(0.32, 0.72, 0, 1),
    max-width 360ms cubic-bezier(0.32, 0.72, 0, 1),
    max-height 360ms cubic-bezier(0.32, 0.72, 0, 1),
    min-height 360ms cubic-bezier(0.32, 0.72, 0, 1),
    border-radius 360ms cubic-bezier(0.32, 0.72, 0, 1),
    background-color 240ms ease,
    box-shadow 360ms cubic-bezier(0.32, 0.72, 0, 1);

  &.expanded {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    max-width: 100%;
    max-height: min(52dvh, 420px);
    min-height: 40px;
    border-radius: 18px;
    background: var(--m-glass-bg);
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.16);
    backdrop-filter: blur(28px) saturate(180%);
    -webkit-backdrop-filter: blur(28px) saturate(180%);
  }
}

.topbar-search-morph-anchor {
  position: relative;
  width: 72px;
  flex-basis: 72px;
  align-self: flex-start;
}

.topbar-search-morph {
  position: absolute;
  top: 0;
  right: 0;
  left: auto;
  width: 72px;
  min-width: 72px;
  max-width: 72px;
  max-height: none;
  transform-origin: top right;

  &.expanded {
    width: min(calc(100vw - 72px), 430px);
    max-width: min(calc(100vw - 72px), 430px);
    max-height: calc(100dvh - var(--safe-area-inset-top, 0px) - 16px);
    min-height: 40px;
    border-radius: 18px;
    background: var(--m-glass-bg);
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.16);
    backdrop-filter: blur(28px) saturate(180%);
    -webkit-backdrop-filter: blur(28px) saturate(180%);
  }
}

/* 详情页也按标题实际宽度收起，搜索框吸收剩余空间。 */
.floating-topbar.wide-detail-topbar .topbar-morph-anchor {
  width: fit-content;
  min-width: 64px;
  max-width: 44vw;
  flex: 0 1 auto;

  &.expanded {
    width: var(--topbar-morph-expanded-width, 180px);
    min-width: var(--topbar-morph-expanded-width, 180px);
    max-width: var(--topbar-morph-expanded-width, 180px);
    flex-basis: var(--topbar-morph-expanded-width, 180px);
  }
}

.floating-topbar.wide-detail-topbar .topbar-morph:not(.expanded) {
  width: max-content;
  max-width: 44vw;
}

.floating-topbar.wide-detail-topbar .topbar-morph.expanded {
  width: 100%;
  max-width: 100%;
}

/* Search filter stays anchored to the trigger's top-right corner. */
.floating-topbar.has-back .topbar-search-morph.expanded {
  right: 0;
  left: auto;
}

.morph-trigger {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 14px;
  color: var(--cover-text-primary, var(--text-color));
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;

  .morph-trigger-copy {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    align-items: center;

    strong,
    small {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    strong {
      font-size: inherit;
      font-weight: inherit;
    }

    small {
      max-height: 0;
      color: var(--cover-text-muted, #9a9590);
      font-size: 10px;
      font-weight: 500;
      opacity: 0;
      transition:
        max-height 260ms cubic-bezier(0.32, 0.72, 0, 1),
        opacity 180ms ease;
    }
  }

  .topbar-morph.expanded & {
    min-height: 54px;
    justify-content: flex-start;

    .morph-trigger-copy {
      align-items: flex-start;
    }

    .morph-trigger-copy small {
      max-height: 16px;
      opacity: 1;
    }
  }

  > i:last-child {
    transition: transform 300ms cubic-bezier(0.32, 0.72, 0, 1);
  }

  .topbar-morph.expanded & > i:last-child {
    transform: rotate(180deg);
  }

  span {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  i {
    flex: 0 0 auto;
    color: var(--cover-text-muted, #9a9590);
    font-size: 16px;
  }
}

.morph-trigger-image {
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  border-radius: 8px;
  object-fit: cover;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.16);
  transition:
    width 320ms cubic-bezier(0.32, 0.72, 0, 1),
    height 320ms cubic-bezier(0.32, 0.72, 0, 1),
    border-radius 320ms cubic-bezier(0.32, 0.72, 0, 1);

  .topbar-morph.expanded & {
    width: 34px;
    height: 34px;
    flex-basis: 34px;
    border-radius: 10px;
  }
}

.morph-badge {
  display: none;
  margin: 0 12px 4px;
  color: var(--cover-text-muted, #9a9590);
  font-size: 10px;
  letter-spacing: 0.04em;

  .topbar-morph.expanded & {
    display: block;
  }
}

.morph-content {
  display: grid;
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  padding: 0;
  transition:
    max-height 360ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 180ms ease,
    padding 360ms cubic-bezier(0.32, 0.72, 0, 1);

  .topbar-morph.expanded & {
    max-height: min(52dvh, 420px);
    overflow-y: auto;
    opacity: 1;
    padding: 6px;
  }
}

.morph-description {
  display: grid;
  gap: 8px;
  margin: 0 6px 6px;
  padding: 10px 8px 12px;
  border-bottom: 1px solid
    color-mix(in srgb, var(--cover-border, rgba(128, 128, 128, 0.14)) 78%, transparent);
  color: var(--cover-text-secondary, var(--text-color));

  header {
    display: flex;
    align-items: center;
    gap: 7px;
    color: var(--cover-text-primary, var(--text-color));
    font-size: 13px;

    i {
      color: var(--accent-color);
      font-size: 16px;
    }

    strong {
      font-weight: 650;
    }
  }

  p {
    max-height: min(24dvh, 180px);
    margin: 0;
    padding-right: 4px;
    overflow-y: auto;
    overscroll-behavior: contain;
    color: var(--cover-text-secondary, var(--text-color));
    font-size: 12px;
    line-height: 1.65;
    scrollbar-width: thin;
    touch-action: pan-y;
    white-space: pre-line;
  }
}

.search-filter-content {
  display: grid;
  max-height: none;
  grid-template-rows: 0fr;
  padding: 0 6px;
  overflow: hidden;
  transition:
    grid-template-rows 420ms cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 180ms ease,
    padding 420ms cubic-bezier(0.2, 0.8, 0.2, 1);

  .topbar-search-morph.expanded & {
    max-height: none;
    grid-template-rows: 1fr;
    overflow: hidden;
    padding: 6px;
  }
}

.search-filter-grid {
  display: grid;
  min-height: 0;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 8px;
  overflow: hidden;
}

.search-filter-trigger {
  min-height: 40px;
  padding-inline: 10px;
  font-size: 12px;

  i {
    font-size: 13px;
    transition: transform 300ms cubic-bezier(0.32, 0.72, 0, 1);
  }

  .topbar-search-morph.expanded & i {
    transform: rotate(180deg);
  }
}

.search-filter-column {
  min-width: 0;
}

.morph-group,
.morph-actions {
  display: grid;
  gap: 2px;
}

.floating-topbar.wide-detail-topbar .morph-actions {
  grid-template-columns: minmax(0, 1fr);
  gap: 6px;
}

.floating-topbar.wide-detail-topbar .morph-action-trigger > i:first-child {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  place-items: center;
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent-color) 12%, transparent);
  color: var(--accent-color);
}

.morph-action-shell {
  display: grid;
  min-width: 0;
  grid-template-rows: auto 0fr;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--m-glass-border) 60%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--m-surface-alt, #fff) 38%, transparent);
  transition:
    grid-template-rows 360ms cubic-bezier(0.32, 0.72, 0, 1),
    background-color 180ms ease,
    border-radius 360ms cubic-bezier(0.32, 0.72, 0, 1);

  &.expanded {
    grid-template-rows: auto 1fr;
    border-radius: 18px;
    background: color-mix(in srgb, var(--accent-color) 8%, var(--m-surface-alt, #fff));
  }
}

.morph-action-shell > .morph-action-trigger {
  border: 0;
  background: transparent;
}

.morph-action-arrow {
  margin-left: auto;
  transition: transform 320ms cubic-bezier(0.32, 0.72, 0, 1);

  .morph-action-shell.expanded & {
    transform: rotate(180deg);
  }
}

.morph-action-options-wrap {
  min-height: 0;
  overflow: hidden;
}

.morph-action-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
  padding: 0 6px 6px;
  opacity: 0;
  transform: translate3d(0, -5px, 0);
  // 选项过多（如用户歌单列表）时限高滚动，防止菜单撑出屏幕
  max-height: 42dvh;
  overflow-y: auto;
  overscroll-behavior: contain;
  transition:
    opacity 180ms ease,
    transform 320ms cubic-bezier(0.32, 0.72, 0, 1);

  .morph-action-shell.expanded & {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }

  button {
    min-height: 38px;
    padding-inline: 9px;
    border-radius: 11px;
    font-size: 12px;

    span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

.morph-group + .morph-group,
.morph-actions {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--cover-border, rgba(128, 128, 128, 0.12));
}

.morph-group button,
.morph-actions button {
  display: flex;
  min-height: 48px;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 0 10px;
  border: 1px solid color-mix(in srgb, var(--m-glass-border) 60%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--m-surface-alt, #fff) 38%, transparent);
  color: var(--cover-text-primary, var(--text-color));
  font-size: 14px;
  text-align: left;
  cursor: pointer;

  i:first-child {
    color: var(--cover-text-muted, #9a9590);
    font-size: 17px;
  }

  i:last-child {
    margin-left: auto;
    color: var(--accent-color);
    font-size: 18px;
  }

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &:active,
  &.active {
    background: color-mix(in srgb, var(--accent-color) 14%, var(--m-surface-alt, #fff));
    color: var(--accent-color);
  }
}

.morph-group {
  gap: 5px;
}

.morph-group + .morph-group,
.morph-actions {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 0;
}

.search-filter-options {
  gap: 5px;

  button {
    min-height: 38px;
    padding-inline: 9px;
    font-size: 12px;
  }
}

.morph-dismiss-layer {
  position: fixed;
  inset: 0;
  z-index: 299;
  background: transparent;
}

/* 页面名 */
.topbar-title-pill {
  flex-shrink: 0;
  padding: 0 14px;
  gap: 2px;
  max-width: 140px;
  opacity: 1;

  &.collapsed {
    max-width: 40px;
    padding: 0;
    justify-content: center;
    flex-shrink: 0;
  }

  .title-back-icon {
    font-size: 22px;
    color: var(--cover-text-primary, var(--text-color));
    flex-shrink: 0;
    opacity: 0;
    width: 0;
    transition:
      opacity 180ms ease,
      width 200ms ease;
  }

  &.collapsed .title-back-icon {
    opacity: 1;
    width: 22px;
  }
}

.topbar-title-text {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0;
  color: var(--cover-text-primary, var(--text-color));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: opacity 160ms ease;
}

.collapsed .topbar-title-text {
  opacity: 0;
  width: 0;
}

/* 搜索框 */
.topbar-search-pill {
  position: relative;
  z-index: 2;
  flex: 1;
  height: auto;
  min-height: 40px;
  min-width: 72px;
  max-height: 40px;
  align-self: flex-start;
  flex-direction: column;
  align-items: stretch;
  padding: 0;
  gap: 0;
  border-radius: 20px;
  transform-origin: top center;
  transition:
    max-height 380ms cubic-bezier(0.32, 0.72, 0, 1),
    border-radius 380ms cubic-bezier(0.32, 0.72, 0, 1),
    box-shadow 260ms ease,
    flex 240ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 220ms ease,
    min-width 240ms cubic-bezier(0.32, 0.72, 0, 1);

  /* 创建歌单面板展开时收缩消失让位（面板从右侧覆盖顶栏区域），
     关闭后恢复；避免面板与搜索框视觉重叠 */
  .floating-topbar.create-expanded & {
    flex: 0 0 0px;
    min-width: 0;
    /* 搜索框归零后，auto margin 吸收剩余空间把创建锚点推回右缘，
       否则锚点被挤到左侧导致面板向左溢出屏幕 */
    margin-right: auto;
    opacity: 0;
    pointer-events: none;
  }

  &.assist-expanded {
    z-index: 310;
    max-height: min(52dvh, 460px);
    border-radius: 20px;
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.18);
  }

  .topbar-search-row {
    display: flex;
    width: 100%;
    min-height: 38px;
    align-items: center;
    gap: 8px;
    padding: 0 14px;
  }

  .search-icon {
    font-size: 17px;
    color: var(--cover-text-muted, #9a9590);
    flex-shrink: 0;
  }
}

.morph-search {
  display: flex;
  min-height: 40px;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  padding: 0 10px;
  border: 1px solid var(--cover-border, rgba(128, 128, 128, 0.12));
  border-radius: 12px;
  background: color-mix(in srgb, var(--accent-color) 8%, transparent);

  i {
    color: var(--cover-text-muted, #9a9590);
  }

  input {
    min-width: 0;
    flex: 1;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--cover-text-primary, var(--text-color));
    font-size: 13px;
  }
}

.topbar-search-pill.search-circle {
  flex: 0 0 40px;
  width: 40px;
  min-width: 40px;
  max-width: 40px;
  padding: 0;
  justify-content: center;

  .topbar-search-row {
    display: grid;
    width: 40px;
    min-height: 40px;
    place-items: center;
    gap: 0;
    padding: 0;
  }

  .search-icon {
    display: block;
    line-height: 1;
  }

  .search-input,
  .clear-icon,
  .search-assist-panel {
    display: none;
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

.search-input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  font-size: 14px;
  color: var(--cover-text-primary, var(--text-color));
  height: 100%;

  &::placeholder {
    color: var(--cover-text-muted, #9a9590);
  }
}

.clear-icon {
  font-size: 16px;
  color: var(--cover-text-muted, #9a9590);
  flex-shrink: 0;
  cursor: pointer;
}

/* 头像 / 搜索按钮 */
.topbar-action-pill {
  flex-shrink: 0;
  padding: 3px;
  width: 40px;
  height: 40px;
  justify-content: center;

  &.search-btn {
    background: var(--accent-color, #888);
    border-color: transparent;
  }
}

.search-filter-heading {
  color: var(--cover-text-muted, #9a9590);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.search-filter-options button :deep(.platform-logo) {
  flex: 0 0 auto;
  color: currentColor;
}

.search-filter-options button.search-source-option {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) 18px;

  > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.search-filter-options button small {
  color: var(--cover-text-muted, #9a9590);
  font-size: 10px;
}

.search-assist-item--setting {
  grid-template-columns: 52px minmax(0, 1fr) 20px;
}

.settings-assist-section {
  align-self: start;
  margin-top: 13px;
  color: var(--accent-color, #888);
  font-size: 10px;
  font-weight: 700;
}

.settings-assist-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;

  strong,
  small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    font-size: 13px;
    font-weight: 650;
  }

  small {
    color: var(--cover-text-muted, #9a9590);
    font-size: 11px;
  }
}

.topbar-search-pill {
  transform-origin: center right;
  transition:
    opacity 180ms ease,
    transform 340ms cubic-bezier(0.32, 0.72, 0, 1),
    background 180ms ease,
    border-color 180ms ease,
    max-height 380ms cubic-bezier(0.32, 0.72, 0, 1),
    border-radius 380ms cubic-bezier(0.32, 0.72, 0, 1),
    box-shadow 260ms ease,
    flex 360ms cubic-bezier(0.32, 0.72, 0, 1),
    margin-left 360ms cubic-bezier(0.32, 0.72, 0, 1),
    margin-right 360ms cubic-bezier(0.32, 0.72, 0, 1);
}

.topbar-action-pill {
  transform-origin: center right;
  transition:
    opacity 180ms ease,
    transform 340ms cubic-bezier(0.32, 0.72, 0, 1),
    background 180ms ease,
    border-color 180ms ease;
}

.floating-topbar.menu-expanded {
  z-index: 300;
}

/* Song lists, playlists and artists retain the established topbar geometry. */
.floating-topbar.legacy-content-topbar {
  &.wide-detail-topbar .topbar-morph-anchor:not(.expanded) {
    width: auto;
    min-width: 0;
    max-width: none;
    flex: 1 1 auto;
  }

  &.wide-detail-topbar .topbar-morph:not(.expanded) {
    width: 100%;
    max-width: none;
  }

  .topbar-morph-anchor.expanded {
    width: fit-content;
    min-width: 64px;
    max-width: 44vw;
    flex: 0 1 auto;
  }

  .topbar-morph.expanded {
    position: fixed;
    top: calc(var(--safe-area-inset-top, 0px) + 8px);
    left: 12px;
    width: min(78vw, 320px);
    max-width: min(78vw, 320px);
  }

  &.has-back .topbar-morph.expanded {
    left: 60px;
  }

  &.wide-detail-topbar .topbar-morph.expanded {
    width: min(calc(100vw - 72px), 460px);
    max-width: min(calc(100vw - 72px), 460px);
  }

  &.menu-expanded {
    .topbar-search-pill,
    .topbar-action-pill {
      opacity: 0;
      transform: translate3d(12px, 0, 0) scale(0.94);
      pointer-events: none;
    }
  }
}

.topbar-search-morph {
  transform-origin: top right;
  transition:
    width 420ms cubic-bezier(0.2, 0.8, 0.2, 1),
    max-width 420ms cubic-bezier(0.2, 0.8, 0.2, 1),
    max-height 420ms cubic-bezier(0.2, 0.8, 0.2, 1),
    min-height 420ms cubic-bezier(0.2, 0.8, 0.2, 1),
    border-radius 420ms cubic-bezier(0.2, 0.8, 0.2, 1),
    background-color 240ms ease,
    box-shadow 420ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.floating-topbar.filter-expanded {
  z-index: 300;
}

.floating-topbar.assist-expanded {
  z-index: 300;
  align-items: flex-start;
}

.floating-topbar.is-search.assist-expanded > .topbar-search-pill {
  margin-right: -80px;
  z-index: 310;
}

.floating-topbar.is-search.assist-expanded > .topbar-search-morph-anchor {
  opacity: 0;
  transform: scale(0.92);
  pointer-events: none;
}

.floating-topbar:not(.is-search).assist-expanded > .topbar-morph-anchor {
  opacity: 0;
  transform: scale(0.92);
  pointer-events: none;
}

.topbar-settings-pill {
  border: 1px solid var(--m-glass-border);
  color: var(--cover-text-primary, var(--text-color));

  .action-icon {
    color: currentColor;
    font-size: 20px;
  }
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

.action-icon {
  font-size: 18px;
  color: #fff;
}

.search-assist-panel {
  width: 100%;
  max-height: calc(min(52dvh, 460px) - 40px);
  overflow: hidden;
  border-top: 1px solid var(--cover-border, rgba(255, 255, 255, 0.12));
  color: var(--cover-text-primary, var(--text-color));
  opacity: 1;
  transform: translate3d(0, 0, 0);
  transition:
    opacity 180ms ease 70ms,
    transform 300ms cubic-bezier(0.32, 0.72, 0, 1) 40ms;
}

.search-assist-panel[aria-hidden='true'] {
  max-height: 0;
  border-top-color: transparent;
  opacity: 0;
  pointer-events: none;
  transform: translate3d(0, -8px, 0);
  transition-delay: 0ms;
}

.search-assist-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 46px;
  padding: 0 16px;
  border-bottom: 1px solid var(--cover-border, rgba(128, 128, 128, 0.1));
}

.search-assist-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;

  i {
    color: var(--accent-color);
    font-size: 16px;
  }
}

.search-assist-clear {
  padding: 6px 9px;
  border: 0;
  border-radius: 9999px;
  background: transparent;
  color: var(--cover-text-muted, #9a9590);
  font-size: 12px;
  cursor: pointer;
  transition:
    color 150ms ease,
    background-color 150ms ease,
    transform 140ms cubic-bezier(0.23, 1, 0.32, 1);

  &:active {
    background: var(--cover-surface-hover, rgba(128, 128, 128, 0.1));
    transform: scale(0.97);
  }
}

.search-assist-list {
  max-height: calc(min(52dvh, 460px) - 86px);
  overflow-y: auto;
  padding: 6px;
  overscroll-behavior: contain;
}

.search-assist-item {
  display: grid;
  width: 100%;
  min-height: 44px;
  grid-template-columns: 22px minmax(0, 1fr) 20px;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--cover-text-primary, var(--text-color));
  cursor: pointer;
  text-align: left;
  transition:
    color 150ms ease,
    background-color 150ms ease,
    transform 140ms cubic-bezier(0.23, 1, 0.32, 1);

  > i:first-child {
    color: var(--cover-text-muted, #9a9590);
    font-size: 16px;
  }

  span {
    overflow: hidden;
    font-size: 14px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .item-arrow {
    color: var(--cover-text-muted, #9a9590);
    font-size: 15px;
    opacity: 0.6;
  }

  &:active {
    background: var(--cover-surface-hover, rgba(128, 128, 128, 0.1));
    color: var(--accent-color);
    transform: scale(0.99);
  }
}

.search-assist-loading,
.search-assist-empty {
  display: flex;
  min-height: 112px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--cover-text-muted, #9a9590);
  font-size: 13px;
}

.search-assist-loading i {
  color: var(--accent-color);
  font-size: 20px;
  animation: search-assist-spin 800ms linear infinite;
}

.search-assist-enter-active,
.search-assist-leave-active {
  transition: opacity 180ms ease;

  .search-assist-panel {
    transition:
      opacity 180ms ease,
      transform 220ms cubic-bezier(0.23, 1, 0.32, 1);
  }
}

.search-assist-enter-from,
.search-assist-leave-to {
  opacity: 0;

  .search-assist-panel {
    opacity: 0;
    transform: translateY(-8px) scale(0.985);
  }
}

@keyframes search-assist-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .player-header-button,
  .player-header-song-pill {
    transition-duration: 100ms;
  }

  .topbar-search-pill,
  .topbar-search-morph,
  .topbar-action-pill {
    transition-duration: 120ms;
    transform: none !important;
  }

  .topbar-pill-morph-enter-active,
  .topbar-pill-morph-leave-active {
    transition: none;
  }

  .floating-topbar,
  .topbar-pill {
    transition: none;
  }

  .title-back-icon,
  .topbar-title-text {
    transition-duration: 0ms;
  }

  .search-assist-enter-active,
  .search-assist-leave-active,
  .search-assist-enter-active .search-assist-panel,
  .search-assist-leave-active .search-assist-panel,
  .search-assist-clear,
  .search-assist-item {
    transition-duration: 0ms;
  }

  .search-assist-loading i {
    animation-duration: 1.6s;
  }

  .search-assist-clear:active,
  .search-assist-item:active {
    transform: none;
  }
}

/* 顶栏胶囊形变：路由切换时缩回再展开（Dock 同款曲线）。
   宽度/flex-basis 过渡配合 JS hook 的宽度测量，让搜索框平滑让位。 */
.topbar-pill-morph-enter-active {
  transition:
    opacity 220ms cubic-bezier(0.32, 0.72, 0, 1),
    transform 220ms cubic-bezier(0.32, 0.72, 0, 1),
    width 320ms cubic-bezier(0.32, 0.72, 0, 1),
    min-width 320ms cubic-bezier(0.32, 0.72, 0, 1),
    flex-basis 320ms cubic-bezier(0.32, 0.72, 0, 1);
}

.topbar-pill-morph-leave-active {
  transition:
    opacity 170ms ease,
    transform 170ms ease,
    width 190ms cubic-bezier(0.32, 0.72, 0, 1),
    min-width 190ms cubic-bezier(0.32, 0.72, 0, 1),
    flex-basis 190ms cubic-bezier(0.32, 0.72, 0, 1);
}

.topbar-pill-morph-enter-from,
.topbar-pill-morph-leave-to {
  opacity: 0;
  transform: scale(0.72);
}

/* ==================== 歌单页:加号原地变形为创建歌单面板 ==================== */
/* 锚点承载变形:展开时宽度 40→0,flex:1 的搜索框自动吞掉空出的空间向右延长 */
.topbar-create-anchor {
  position: relative;
  width: 40px;
  min-width: 40px;
  flex: 0 0 40px;
  height: 40px;
  pointer-events: auto;
  transform-origin: right center;
  transition:
    width 360ms cubic-bezier(0.32, 0.72, 0, 1),
    min-width 360ms cubic-bezier(0.32, 0.72, 0, 1),
    flex-basis 360ms cubic-bezier(0.32, 0.72, 0, 1);

  > .topbar-action-pill {
    transition:
      opacity 200ms ease,
      transform 300ms cubic-bezier(0.32, 0.72, 0, 1);
  }

  &.expanded {
    width: 0;
    min-width: 0;
    flex-basis: 0;

    > .topbar-action-pill {
      opacity: 0;
      pointer-events: none;
      transform: scale(0.86);
    }
  }
}

/* 面板:右锚定展开(transform-origin 右上),grid-template-rows 0fr→1fr 高度自适应 */
.topbar-create-panel {
  position: absolute;
  top: 0;
  right: 0;
  display: grid;
  grid-template-rows: 0fr;
  width: min(calc(100vw - 92px), 340px);
  overflow: hidden;
  border-radius: 20px;
  background: var(--m-glass-bg);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.16);
  backdrop-filter: blur(28px) saturate(180%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  opacity: 0;
  transform: scale(0.94);
  transform-origin: top right;
  pointer-events: none;
  transition:
    grid-template-rows 360ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 200ms ease,
    transform 360ms cubic-bezier(0.32, 0.72, 0, 1),
    border-radius 360ms cubic-bezier(0.32, 0.72, 0, 1);

  .topbar-create-anchor.expanded & {
    grid-template-rows: 1fr;
    opacity: 1;
    transform: none;
    pointer-events: auto;
    z-index: 4;
  }
}

.topbar-create-body {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  overflow: hidden;

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    h3 {
      font-size: 15px;
      font-weight: 700;
    }

    button {
      display: grid;
      width: 28px;
      height: 28px;
      place-items: center;
      border: 0;
      border-radius: 50%;
      background: rgba(128, 128, 128, 0.14);
      color: inherit;
      cursor: pointer;
    }
  }

  input[type='text'],
  textarea {
    padding: 11px 13px;
    border: 1px solid rgba(128, 128, 128, 0.35);
    border-radius: 13px;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 13.5px;
    outline: none;
    resize: none;
    transition: border-color 160ms ease;

    &:focus {
      border-color: var(--accent-color, #888);
    }
  }

  textarea {
    min-height: 62px;
  }
}

.create-playlist-cover {
  display: flex;
  align-items: center;
  gap: 10px;

  .cover-picker {
    display: grid;
    width: 52px;
    height: 52px;
    flex: 0 0 52px;
    place-items: center;
    overflow: hidden;
    border: 1px dashed rgba(128, 128, 128, 0.45);
    border-radius: 13px;
    background: transparent;
    color: var(--d-text-muted, #999);
    cursor: pointer;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .cover-meta {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--d-text-muted, #999);
  }

  .cover-remove {
    align-self: flex-start;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--accent-color, #888);
    font-size: 12px;
    cursor: pointer;
  }
}

.create-playlist-cover-input {
  display: none;
}

.create-playlist-submit {
  padding: 11px;
  border: 0;
  border-radius: 13px;
  background: var(--accent-color, #888);
  color: #141414;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 140ms cubic-bezier(0.34, 1.56, 0.64, 1);

  &:disabled {
    opacity: 0.5;
  }

  &:active {
    transform: scale(0.98);
  }
}

.create-playlist-error {
  margin: 0;
  font-size: 12px;
  color: #f87171;
}

@media (prefers-reduced-motion: reduce) {
  .topbar-create-anchor,
  .topbar-create-panel,
  .topbar-create-anchor > .topbar-action-pill {
    transition-duration: 100ms;
  }
}
</style>
