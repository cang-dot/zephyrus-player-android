<template>
  <div>
    <setting-section :title="t('settings.sections.lyrics')">
      <setting-item
        item-id="status-bar-lyrics"
        mode="expandable"
        :title="t('settings.lyricSettings.statusBarLyrics')"
        :description="t('settings.lyricSettings.statusBarLyricsDescription')"
      >
        <template #value>{{ statusBarLyricsEnabled ? t('common.on') : t('common.off') }}</template>
        <status-bar-lyric-settings @update:enabled="statusBarLyricsEnabled = $event" />
      </setting-item>
    </setting-section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { readStatusBarLyricConfig } from '@/services/androidNative';

import StatusBarLyricSettings from '../components/StatusBarLyricSettings.vue';
import SettingItem from '../SettingItem.vue';
import SettingSection from '../SettingSection.vue';

const { t } = useI18n();
const statusBarLyricsEnabled = ref(readStatusBarLyricConfig().enabled);
</script>
