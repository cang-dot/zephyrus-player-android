<template>
  <setting-section :title="t('settings.sections.interface')">
    <!-- 启动默认页 -->
    <setting-item
      :title="t('settings.interface.defaultPage')"
      :description="t('settings.interface.defaultPageDesc')"
    >
      <s-select
        v-model="setData.defaultPage"
        :options="defaultPageOptions"
        width="w-40 max-md:w-full"
      />
    </setting-item>
  </setting-section>

  <!-- 播放器样式 -->
  <setting-section title="播放器样式" description="选择全屏播放界面的视觉样式">
    <setting-item title="播放器样式" :description="playerStyleDesc">
      <s-select
        :model-value="currentPlayerStyle"
        :options="playerStyleOptions"
        width="w-40 max-md:w-full"
        @update:model-value="updatePlayerStyle"
      />
    </setting-item>
  </setting-section>
</template>

<script setup lang="ts">
import { computed, inject, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { getAllStyles } from '@/playerStyles';

import { SETTINGS_DATA_KEY } from '../keys';
import SettingItem from '../SettingItem.vue';
import SettingSection from '../SettingSection.vue';
import SSelect from '../SSelect.vue';

const { t } = useI18n();
const setData = inject(SETTINGS_DATA_KEY)!;

// ==================== 播放器样式 ====================
const currentPlayerStyle = ref('default');

const playerStyleOptions = computed(() =>
  getAllStyles().map((s) => ({ label: s.label, value: s.key }))
);

const playerStyleDesc = computed(() =>
  getAllStyles()
    .map((s) => s.label)
    .join(' / ')
);

// 从 localStorage 加载当前播放器样式
function loadPlayerStyle() {
  try {
    const saved = localStorage.getItem('music-full-config');
    if (saved) {
      const parsed = JSON.parse(saved);
      currentPlayerStyle.value = parsed.playerStyle || 'default';
    }
  } catch {}
}
loadPlayerStyle();

const updatePlayerStyle = (val: string) => {
  currentPlayerStyle.value = val;
  try {
    const saved = localStorage.getItem('music-full-config');
    const config = saved ? JSON.parse(saved) : {};
    config.playerStyle = val;
    localStorage.setItem('music-full-config', JSON.stringify(config));
    // 触发更新事件
    window.dispatchEvent(new CustomEvent('music-full-config-updated'));
  } catch (e) {
    console.error('更新播放器样式失败:', e);
  }
};

// 监听外部变更
window.addEventListener('music-full-config-updated', loadPlayerStyle);
onUnmounted(() => {
  window.removeEventListener('music-full-config-updated', loadPlayerStyle);
});

// 启动默认页选项（仅保留移动端可用页面）
const defaultPageOptions = computed(() => [
  { label: t('comp.home'), value: '/' },
  { label: t('comp.search'), value: '/search' },
  { label: t('comp.list'), value: '/list' },
  { label: t('comp.newAlbum.title'), value: '/album' },
  { label: t('comp.toplist'), value: '/toplist' },
  { label: t('comp.history'), value: '/history' },
  { label: t('comp.localMusic'), value: '/local-music' },
  { label: t('comp.my'), value: '/user' },
  { label: t('comp.settings'), value: '/set' }
]);
</script>
