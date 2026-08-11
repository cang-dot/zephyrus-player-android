<template>
  <div>
    <setting-section :title="t('settings.sections.playback')">
      <setting-item
        :title="t('settings.playback.quality')"
        :description="t('settings.playback.qualityDesc')"
      >
        <s-select
          v-model="setData.musicQuality"
          :options="qualityOptions"
          width="w-40 max-md:w-full"
        />
      </setting-item>

      <setting-item
        v-if="!isElectron"
        :title="t('settings.lyricSettings.statusBarLyrics')"
        :description="t('settings.lyricSettings.statusBarLyricsDescription')"
      >
        <n-switch :value="statusBarLyricsEnabled" @update:value="updateStatusBarLyricsEnabled">
          <template #checked>{{ t('common.on') }}</template>
          <template #unchecked>{{ t('common.off') }}</template>
        </n-switch>
      </setting-item>

      <setting-item v-if="isElectron" :title="t('settings.playback.musicSources')">
        <template #description>
          <div class="flex items-center gap-2">
            <n-switch v-model:value="setData.enableMusicUnblock">
              <template #checked>{{ t('common.on') }}</template>
              <template #unchecked>{{ t('common.off') }}</template>
            </n-switch>
            <span>{{ t('settings.playback.musicUnblockEnableDesc') }}</span>
          </div>
          <div v-if="setData.enableMusicUnblock" class="mt-2 text-sm">
            <span class="text-gray-500">{{ t('settings.playback.selectedMusicSources') }}</span>
            <span v-if="musicSources.length > 0" class="text-gray-400">{{
              musicSources.join(', ')
            }}</span>
            <span v-else class="text-red-500 text-xs">{{
              t('settings.playback.noMusicSources')
            }}</span>
          </div>
        </template>
        <s-btn :disabled="!setData.enableMusicUnblock" @click="showMusicSourcesModal = true">
          {{ t('settings.playback.configureMusicSources') }}
        </s-btn>
      </setting-item>

      <setting-item
        v-if="platform === 'darwin'"
        :title="t('settings.playback.showStatusBar')"
        :description="t('settings.playback.showStatusBarContent')"
      >
        <n-switch v-model:value="setData.showTopAction">
          <template #checked>{{ t('common.on') }}</template>
          <template #unchecked>{{ t('common.off') }}</template>
        </n-switch>
      </setting-item>

      <setting-item
        :title="t('settings.playback.autoPlay')"
        :description="t('settings.playback.autoPlayDesc')"
      >
        <n-switch v-model:value="setData.autoPlay">
          <template #checked>{{ t('common.on') }}</template>
          <template #unchecked>{{ t('common.off') }}</template>
        </n-switch>
      </setting-item>

      <setting-item
        v-if="isElectron"
        :title="t('settings.playback.audioDevice')"
        :description="t('settings.playback.audioDeviceDesc')"
      >
        <audio-device-settings />
      </setting-item>
    </setting-section>

    <setting-section title="智能混音">
      <setting-item title="智能混音引擎" description="切歌时自动平滑过渡，避免硬切中断">
        <smart-mix-settings />
      </setting-item>
    </setting-section>

    <music-source-settings
      v-if="isElectron"
      v-model:show="showMusicSourcesModal"
      v-model:sources="musicSources"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AudioDeviceSettings from '@/components/settings/AudioDeviceSettings.vue';
import MusicSourceSettings from '@/components/settings/MusicSourceSettings.vue';
import SmartMixSettings from '@/components/settings/SmartMixSettings.vue';
import {
  hasStatusBarLyricPermission,
  isAndroidNative,
  refreshStatusBarLyric,
  requestStatusBarLyricPermission
} from '@/services/androidNative';
import { type Platform } from '@/types/music';
import { isElectron } from '@/utils';

import { SETTINGS_DATA_KEY } from '../keys';
import SBtn from '../SBtn.vue';
import SettingItem from '../SettingItem.vue';
import SettingSection from '../SettingSection.vue';
import SSelect from '../SSelect.vue';

const ALL_PLATFORMS: Platform[] = ['migu', 'kugou', 'kuwo', 'pyncmd'];

const { t } = useI18n();
const setData = inject(SETTINGS_DATA_KEY)!;
const platform = window.electron ? window.electron.ipcRenderer.sendSync('get-platform') : 'web';

const showMusicSourcesModal = ref(false);

function readStatusBarLyricsEnabled(): boolean {
  try {
    const saved = localStorage.getItem('music-full-config');
    return Boolean(saved && JSON.parse(saved).statusBarLyricsEnabled);
  } catch {
    return false;
  }
}

const statusBarLyricsEnabled = ref(readStatusBarLyricsEnabled());

function syncStatusBarLyricsEnabled() {
  statusBarLyricsEnabled.value = readStatusBarLyricsEnabled();
}

function updateStatusBarLyricsEnabled(enabled: boolean) {
  try {
    const saved = localStorage.getItem('music-full-config');
    const config = saved ? JSON.parse(saved) : {};
    config.statusBarLyricsEnabled = enabled;
    localStorage.setItem('music-full-config', JSON.stringify(config));
    statusBarLyricsEnabled.value = enabled;
    window.dispatchEvent(new CustomEvent('music-full-config-updated'));

    if (enabled && isAndroidNative() && !hasStatusBarLyricPermission()) {
      requestStatusBarLyricPermission();
      window.$message?.info('请允许 Zephyrus 显示在其他应用上层');
    }
    refreshStatusBarLyric();
  } catch (error) {
    console.error('更新状态栏歌词设置失败:', error);
  }
}

onMounted(() => {
  window.addEventListener('music-full-config-updated', syncStatusBarLyricsEnabled);
});

onUnmounted(() => {
  window.removeEventListener('music-full-config-updated', syncStatusBarLyricsEnabled);
});

const qualityOptions = computed(() => [
  { label: t('settings.playback.qualityOptions.standard'), value: 'standard' },
  { label: t('settings.playback.qualityOptions.higher'), value: 'higher' },
  { label: t('settings.playback.qualityOptions.exhigh'), value: 'exhigh' },
  { label: t('settings.playback.qualityOptions.lossless'), value: 'lossless' },
  { label: t('settings.playback.qualityOptions.hires'), value: 'hires' },
  { label: t('settings.playback.qualityOptions.jyeffect'), value: 'jyeffect' },
  { label: t('settings.playback.qualityOptions.sky'), value: 'sky' },
  { label: t('settings.playback.qualityOptions.dolby'), value: 'dolby' },
  { label: t('settings.playback.qualityOptions.jymaster'), value: 'jymaster' }
]);

const musicSources = computed({
  get: () => {
    if (!setData.value.enabledMusicSources) return ALL_PLATFORMS;
    return setData.value.enabledMusicSources as Platform[];
  },
  set: (newValue: Platform[]) => {
    const valuesToSet = newValue.length > 0 ? [...new Set(newValue)] : ALL_PLATFORMS;
    setData.value = { ...setData.value, enabledMusicSources: valuesToSet };
  }
});
</script>
