<template>
  <div>
    <setting-section :title="t('settings.sections.ai')">
      <setting-item
        title="歌词隐喻分析"
        description="配置你自己的 AI 服务密钥，用于歌词隐喻解读、AI 歌单与私人 FM 推荐"
      >
        <metaphor-settings-section />
      </setting-item>
    </setting-section>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import MetaphorSettingsSection from '@/features/lyric-metaphor/MetaphorSettingsSection.vue';

import SettingItem from '../SettingItem.vue';
import SettingSection from '../SettingSection.vue';

const { t } = useI18n();
</script>
