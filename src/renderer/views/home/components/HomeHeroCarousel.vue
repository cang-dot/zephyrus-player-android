<script setup lang="ts">
/**
 * 首页 hero 轮播：歌曲漫游（MoltenMetal 流体 + 心动模式）与 Zephyrus云（黑白抖动 + 云库）
 * 两张卡横向分页吸附，右缘露出下一张卡；漫游卡随明暗、云卡恒定深色。
 */
import { useDocumentVisibility, usePreferredReducedMotion } from '@vueuse/core';
import { computed, inject, onMounted, type Ref, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { type Announcement, fetchAnnouncements } from '@/api/announcements';
import { loadServerSongs, type ServerSong, serverSongToSongResult } from '@/api/serverSongs';
import DitherBackground from '@/components/common/DitherBackground.vue';
import MoltenMetalBackground from '@/components/common/MoltenMetalBackground.vue';
import { playMusic } from '@/hooks/MusicHook';
import { useIntelligenceModeStore } from '@/store/modules/intelligenceMode';
import { usePlayerCoreStore } from '@/store/modules/playerCore';
import { usePlaylistStore } from '@/store/modules/playlist';
import { useSettingsStore } from '@/store/modules/settings';
import { getImgUrl } from '@/utils';

const { t } = useI18n();
const router = useRouter();
const intelligenceStore = useIntelligenceModeStore();
const playerCore = usePlayerCoreStore();
const playlistStore = usePlaylistStore();
const settingsStore = useSettingsStore();

const isDark = computed(() => settingsStore.theme === 'dark');
/** 漫游卡随明暗：浅色下压住流体浓度、蒙版更实，保证深色文字可读 */
const roamFluidOpacity = computed(() => (isDark.value ? 0.88 : 0.62));
const heroMaskOpacity = computed(() => (isDark.value ? 0.78 : 0.82));

// 主页是 pager 常驻页：切到其他 tab 后 WebGL 必须停帧
const pagerActivePath = inject<Readonly<Ref<string>> | null>('mobilePagerActivePath', null);
const documentVisibility = useDocumentVisibility();
const reducedMotion = usePreferredReducedMotion();

const bgPaused = computed(
  () =>
    documentVisibility.value !== 'visible' ||
    reducedMotion.value === 'reduce' ||
    (pagerActivePath ? pagerActivePath.value !== '/' : false)
);

const moltenFailed = ref(false);
const ditherFailed = ref(false);

const roamColors = computed(() => ({
  color1: '#0b0b10',
  color2: playMusic?.value?.primaryColor || '#565660',
  color3: '#f2efe8'
}));

const heartActive = computed(() => intelligenceStore.isIntelligenceMode);
const heartPlaying = computed(() => heartActive.value && playerCore.isPlaying);
const heartLabel = computed(() =>
  heartPlaying.value ? t('comp.homeV2.pauseAria') : t('comp.homeV2.playAria')
);

async function toggleHeart() {
  if (!heartActive.value) {
    await intelligenceStore.playIntelligenceMode();
    return;
  }
  if (playerCore.isPlaying) {
    await playerCore.handlePause();
  } else {
    await playerCore.playAudio();
  }
}

const cloudSongs = ref<ServerSong[]>([]);

/** 公告卡：每次启动拉取一次，取第一篇；拉取失败不渲染 */
const announcement = ref<Announcement | null>(null);

function openAnnouncement() {
  const action = announcement.value?.action;
  if (!action) return;
  // 公告跳转直达网易云专辑页（购买在网易云完成），不被应用内专辑页接住：
  // type=album + id 按网易云 web 专辑页拼链接；action.url 可显式指定任意地址。
  const url =
    action.type === 'album' && action.id
      ? `https://music.163.com/#/album?id=${action.id}`
      : action.url;
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

async function playCloudSong(song: ServerSong) {
  const songs = cloudSongs.value.map(serverSongToSongResult);
  const index = Math.max(
    0,
    cloudSongs.value.findIndex((item) => item.id === song.id)
  );
  playlistStore.setPlayList(songs, false, false);
  await playerCore.handlePlayMusic(songs[index], true);
}

function openCloudLibrary(event?: MouseEvent) {
  // 与歌单库页同一套封面飞行：以云卡为源矩形（key: home-cloud），云库页 hero 从该处飞入
  const el = event?.currentTarget as HTMLElement | null;
  const card = el?.closest('.hero-card.cloud') as HTMLElement | null;
  const rect = card?.getBoundingClientRect();
  if (rect && rect.width > 0) {
    try {
      sessionStorage.setItem(
        'musicListCoverRect',
        JSON.stringify({ x: rect.x, y: rect.y, w: rect.width, h: rect.height, key: 'home-cloud' })
      );
    } catch {
      /* ignore */
    }
  }
  router.push('/music-list/zephyrus-cloud?type=server-library');
}

onMounted(async () => {
  void fetchAnnouncements()
    .then((list) => {
      announcement.value = list[0] ?? null;
    })
    .catch(() => {
      announcement.value = null;
    });

  try {
    const all = await loadServerSongs();
    cloudSongs.value = all.slice(-5).reverse();
  } catch {
    cloudSongs.value = [];
  }
});
</script>

<template>
  <section class="hero-carousel">
    <div class="hero-track" data-horizontal-scroll>
      <article class="hero-card roam">
        <molten-metal-background
          v-if="!moltenFailed"
          class="hero-bg roam-fluid"
          :color1="roamColors.color1"
          :color2="roamColors.color2"
          :color3="roamColors.color3"
          :speed="0.35"
          :scale="4"
          :detail="3"
          color-mode="molten"
          :mouse-interaction="false"
          :max-pixel-ratio="1.5"
          :max-fps="30"
          :paused="bgPaused"
          :style="{ opacity: roamFluidOpacity }"
          @fallback="moltenFailed = true"
        />
        <div v-else class="hero-bg roam-fallback" />
        <div class="hero-mask" :style="{ opacity: heroMaskOpacity }" />

        <div class="hero-copy">
          <h3>{{ t('comp.homeV2.roamTitle') }}</h3>
          <p>{{ t('comp.homeV2.roamSubtitle') }}</p>
        </div>

        <button class="hero-play" type="button" :aria-label="heartLabel" @click="toggleHeart">
          <i :class="heartPlaying ? 'ri-pause-fill' : 'ri-play-fill'" />
        </button>
      </article>

      <article class="hero-card cloud">
        <dither-background
          v-if="!ditherFailed"
          class="hero-bg"
          :wave-color="[0.92, 0.92, 0.92]"
          :wave-speed="0.05"
          :wave-frequency="3"
          :wave-amplitude="0.4"
          :color-num="4"
          :pixel-size="2"
          :enable-mouse-interaction="false"
          :max-pixel-ratio="1.5"
          :max-fps="30"
          :paused="bgPaused"
          @fallback="ditherFailed = true"
        />
        <div class="hero-bg cloud-fallback" />
        <div class="cloud-darken" />

        <div class="hero-copy cloud-copy">
          <h3>{{ t('comp.homeV2.cloudTitle') }}</h3>
          <p>{{ t('comp.homeV2.cloudSubtitle') }}</p>
        </div>

        <ul v-if="cloudSongs.length" class="cloud-list">
          <li v-for="song in cloudSongs" :key="song.id">
            <button type="button" @click="playCloudSong(song)">
              <img :src="getImgUrl(song.picUrl, '100y100')" alt="" loading="lazy" />
              <span class="cloud-name">{{ song.name }}</span>
              <span class="cloud-artist">{{ song.artists.join(' / ') }}</span>
            </button>
          </li>
        </ul>
        <p v-else class="cloud-empty">{{ t('comp.homeV2.cloudEmpty') }}</p>

        <button
          class="hero-play"
          type="button"
          :aria-label="t('comp.homeV2.openCloud')"
          @click="openCloudLibrary($event)"
        >
          <i class="ri-arrow-right-up-line" />
        </button>
      </article>

      <!-- 公告卡：内容每次启动从服务器拉取，按钮直达网易云专辑页（不被应用内捕获） -->
      <article v-if="announcement" class="hero-card announce" @click="openAnnouncement">
        <span class="announce-badge">{{ announcement.title }}</span>
        <p class="announce-body">{{ announcement.body }}</p>
        <button
          v-if="announcement.action"
          class="hero-play"
          type="button"
          :aria-label="announcement.buttonText || announcement.title"
          @click.stop="openAnnouncement"
        >
          <i class="ri-arrow-right-up-line" />
        </button>
      </article>
    </div>
  </section>
</template>

<style scoped lang="scss">
.hero-track {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 8px 16px 4px;
  scroll-padding-inline: 16px;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.hero-card {
  position: relative;
  flex: 0 0 calc(100% - 80px);
  min-height: 216px;
  overflow: hidden;
  border-radius: 30px;
  scroll-snap-align: start;
  isolation: isolate;
}

.hero-bg {
  position: absolute;
  inset: 0;
}

/* ==================== 歌曲漫游（随明暗） ==================== */
.hero-card.roam {
  background: var(--m-card, #f4f1ec);
  color: var(--m-text-primary, #20211f);
}

.roam-fallback {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--accent-color, #77836e) 42%, transparent),
    transparent 62%
  );
}

.hero-mask {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    var(--m-bg, #fff) 0%,
    color-mix(in srgb, var(--m-bg, #fff) 42%, transparent) 26%,
    transparent 46%,
    color-mix(in srgb, var(--m-bg, #fff) 36%, transparent) 76%,
    var(--m-bg, #fff) 100%
  );
  pointer-events: none;
}

/* ==================== Zephyrus 云（恒深） ==================== */
.hero-card.cloud {
  background: #0a0a0c;
  color: #fff;
}

.cloud-fallback {
  background: #0a0a0c;
}

.cloud-darken {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(8, 8, 10, 0.55) 0%,
    rgba(8, 8, 10, 0.26) 46%,
    rgba(8, 8, 10, 0.66) 100%
  );
  pointer-events: none;
}

/* ==================== 公告卡（跟随主题的实色卡） ==================== */
.hero-card.announce {
  background: var(--m-surface-container, var(--m-card, #f4f1ec));
  color: var(--m-text-primary, #20211f);
}

.announce-badge {
  position: absolute;
  left: 16px;
  top: 16px;
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(var(--accent-color-rgb, 119, 131, 110), 0.16);
  color: var(--accent-color, #77836e);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.announce-body {
  position: absolute;
  left: 16px;
  right: 16px;
  top: 54px;
  bottom: 66px;
  display: -webkit-box;
  overflow: hidden;
  font-size: 12.5px;
  line-height: 1.72;
  color: var(--m-text-primary, #20211f);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 5;
}

/* ==================== 文案与播放按钮 ==================== */
.hero-copy {
  position: absolute;
  inset: 16px 16px auto;
  display: grid;
  gap: 4px;

  h3 {
    margin: 0;
    font-size: 24px;
    font-weight: 800;
    letter-spacing: -0.01em;
  }

  p {
    margin: 0;
    font-size: 12.5px;
    color: var(--m-text-secondary, rgba(32, 33, 31, 0.66));
  }
}

.hero-card.cloud .hero-copy p {
  color: rgba(255, 255, 255, 0.72);
}

.hero-play {
  position: absolute;
  right: 16px;
  bottom: 16px;
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.26);
  color: #111;

  i {
    font-size: 22px;
  }

  &:active {
    transform: scale(0.94);
  }
}

/* ==================== 云卡列表 ==================== */
.cloud-copy {
  inset: 16px 16px auto;
}

.cloud-list {
  position: absolute;
  inset: 74px 16px 68px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  overflow: hidden;
  list-style: none;

  button {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 8px;
    padding: 3px 0;
    color: inherit;
    text-align: left;

    &:active {
      opacity: 0.72;
    }
  }

  img {
    width: 26px;
    height: 26px;
    flex: none;
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.08);
    object-fit: cover;
  }
}

.cloud-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.cloud-artist {
  max-width: 38%;
  overflow: hidden;
  flex: none;
  font-size: 11px;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: rgba(255, 255, 255, 0.6);
}

.cloud-empty {
  position: absolute;
  inset: 74px 16px 68px;
  display: grid;
  margin: 0;
  place-items: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

@media (prefers-reduced-motion: no-preference) {
  .hero-card {
    transition: transform 140ms var(--m-ease-out, cubic-bezier(0.23, 1, 0.32, 1));
  }

  .hero-play {
    transition: transform 140ms var(--m-ease-out, cubic-bezier(0.23, 1, 0.32, 1));
  }
}
</style>
