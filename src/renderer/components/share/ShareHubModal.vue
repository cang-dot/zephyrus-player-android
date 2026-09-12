<template>
  <Teleport to="body">
    <Transition name="shub">
      <div v-if="visible" class="shub-overlay" @click.self="close">
        <div class="shub-sheet">
          <header class="shub-header">
            <button type="button" class="shub-close" :aria-label="t('common.close')" @click="close">
              <i class="ri-close-line" />
            </button>
            <div class="shub-title">
              <strong>{{ t('share.hub.title') }}</strong>
              <span v-if="songLabel">{{ songLabel }}</span>
            </div>
            <div class="shub-spacer" aria-hidden="true" />
          </header>

          <!-- 两个板块 -->
          <div class="shub-tabs" role="tablist">
            <button
              v-for="tab in tabs"
              :key="tab.key"
              type="button"
              role="tab"
              :aria-selected="activeTab === tab.key"
              :class="{ active: activeTab === tab.key }"
              @click="activeTab = tab.key"
            >
              <i :class="tab.icon" />
              <span>{{ t(tab.labelKey) }}</span>
            </button>
          </div>

          <div class="shub-body">
            <!-- 图片分享：沿用「选歌词生成海报」 -->
            <div v-if="activeTab === 'image'" class="shub-image">
              <p class="shub-desc">{{ t('share.hub.imageDesc') }}</p>
              <button type="button" class="shub-action" @click="emit('openPoster', 'lyrics')">
                <i class="ri-file-text-line" />
                <span>{{ t('share.hub.posterLyrics') }}</span>
                <i class="ri-arrow-right-s-line shub-action-arrow" />
              </button>
              <button type="button" class="shub-action" @click="emit('openPoster', 'info')">
                <i class="ri-album-line" />
                <span>{{ t('share.hub.posterInfo') }}</span>
                <i class="ri-arrow-right-s-line shub-action-arrow" />
              </button>
            </div>

            <!-- 视频分享 -->
            <div v-else class="shub-video">
              <p class="shub-desc">{{ t('share.hub.videoDesc') }}</p>
              <video-share-panel :style-key="styleKey" />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * 分享中心
 *
 * 把分享功能拆成两个板块：
 * - 图片分享：沿用「选歌词 / 歌曲信息生成海报」的原有链路
 * - 视频分享：直接导出当前播放器样式在选定时间段的效果展示视频
 */
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

// 视频面板按需加载：其依赖链包含 mediabunny（编码器实现），不应计入首屏主包
const VideoSharePanel = defineAsyncComponent(() => import('./VideoSharePanel.vue'));

const props = defineProps({
  visible: { type: Boolean, default: false },
  /** 当前播放器样式 key */
  styleKey: { type: String, default: 'default' },
  songTitle: { type: String, default: '' },
  artist: { type: String, default: '' }
});

const emit = defineEmits(['update:visible', 'openPoster']);

const { t } = useI18n();

const activeTab = ref<'image' | 'video'>('image');

const tabs = [
  { key: 'image' as const, icon: 'ri-image-line', labelKey: 'share.hub.image' },
  { key: 'video' as const, icon: 'ri-film-line', labelKey: 'share.hub.video' }
];

const songLabel = computed(() => [props.songTitle, props.artist].filter(Boolean).join(' · '));

function close() {
  emit('update:visible', false);
}

// 每次打开回到「图片分享」，与原先的行为保持一致
watch(
  () => props.visible,
  (value) => {
    if (value) activeTab.value = 'image';
  }
);
</script>

<style scoped>
.shub-overlay {
  position: fixed;
  inset: 0;
  /* 与 PosterShareModal（100300）同级：必须高于播放设置面板的 100200，
     否则弹层会被设置面板整体盖住，表现为「点击分享没反应」 */
  z-index: 100300;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
}

.shub-sheet {
  display: flex;
  flex-direction: column;
  width: min(560px, 100%);
  max-height: 88vh;
  padding: 14px 16px calc(16px + env(safe-area-inset-bottom, 0px));
  border-radius: 22px 22px 0 0;
  background: #16161c;
  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.5);
}

.shub-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.shub-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.8);
  font-size: 18px;
}

.shub-title {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.shub-title strong {
  font-size: 15px;
  color: #fff;
}

.shub-title span {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.42);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shub-spacer {
  width: 34px;
}

.shub-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin: 14px 0 4px;
  padding: 4px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.06);
}

.shub-tabs button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 0;
  border-radius: 11px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  transition:
    background 0.2s,
    color 0.2s;
}

.shub-tabs button.active {
  background: rgba(var(--accent-color-rgb, 120, 130, 160), 0.25);
  color: #fff;
}

.shub-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-top: 12px;
}

.shub-desc {
  margin-bottom: 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}

.shub-image {
  display: flex;
  flex-direction: column;
}

.shub-action {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 15px 14px;
  margin-bottom: 10px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  text-align: left;
}

.shub-action:active {
  background: rgba(255, 255, 255, 0.1);
}

.shub-action i:first-child {
  font-size: 18px;
  color: rgb(var(--accent-color-rgb, 200, 210, 235));
}

.shub-action-arrow {
  margin-left: auto;
  color: rgba(255, 255, 255, 0.3);
}

.shub-enter-active,
.shub-leave-active {
  transition: opacity 0.22s ease;
}

.shub-enter-active .shub-sheet,
.shub-leave-active .shub-sheet {
  transition: transform 0.26s cubic-bezier(0.22, 1, 0.36, 1);
}

.shub-enter-from,
.shub-leave-to {
  opacity: 0;
}

.shub-enter-from .shub-sheet,
.shub-leave-to .shub-sheet {
  transform: translateY(24px);
}
</style>
