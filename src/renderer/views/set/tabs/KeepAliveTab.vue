<template>
  <div class="keep-alive-tab">
    <setting-section :title="t('settings.keepAlive.title')">
      <setting-item
        mode="direct"
        :title="t('settings.keepAlive.audioFocus')"
        :description="t('settings.keepAlive.audioFocusDesc')"
      >
        <n-switch v-model:value="setData.backgroundKeepAlive" size="small" />
      </setting-item>

      <setting-item
        :title="t('settings.keepAlive.batteryOptimization')"
        :description="t('settings.keepAlive.batteryOptimizationDesc')"
        @click="handleBatteryOptimization"
      >
        <template #action>
          <i class="ri-arrow-right-s-line nav-arrow" />
        </template>
      </setting-item>

      <setting-item
        :title="t('settings.keepAlive.autoStart')"
        :description="t('settings.keepAlive.autoStartDesc')"
        @click="handleAutoStart"
      >
        <template #action>
          <i class="ri-arrow-right-s-line nav-arrow" />
        </template>
      </setting-item>

      <setting-item
        :title="t('settings.keepAlive.notification')"
        :description="t('settings.keepAlive.notificationDesc')"
        @click="handleNotificationSettings"
      >
        <template #action>
          <i class="ri-arrow-right-s-line nav-arrow" />
        </template>
      </setting-item>

      <setting-item
        :title="t('settings.keepAlive.displayOverOtherApps')"
        :description="t('settings.keepAlive.displayOverOtherAppsDesc')"
        @click="handleDisplayOverOtherApps"
      >
        <template #action>
          <i class="ri-arrow-right-s-line nav-arrow" />
        </template>
      </setting-item>

      <setting-item
        :title="t('settings.keepAlive.appDetails')"
        :description="t('settings.keepAlive.appDetailsDesc')"
        @click="handleAppDetails"
      >
        <template #action>
          <i class="ri-arrow-right-s-line nav-arrow" />
        </template>
      </setting-item>
    </setting-section>

    <div class="keep-alive-tips">
      <i class="ri-information-line" />
      <span>{{ t('settings.keepAlive.tips') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue';
import { useI18n } from 'vue-i18n';

import {
  openAppDetailsSettings,
  openAutoStartSettings,
  openBatteryOptimizationSettings,
  openDisplayOverOtherAppsSettings,
  openNotificationSettings
} from '@/services/androidNative';

import { SETTINGS_DATA_KEY } from '@/views/set/keys';
import SettingItem from '../SettingItem.vue';
import SettingSection from '../SettingSection.vue';

const { t } = useI18n();
const setData = inject(SETTINGS_DATA_KEY)!;

const handleBatteryOptimization = () => {
  openBatteryOptimizationSettings();
};

const handleAutoStart = () => {
  openAutoStartSettings();
};

const handleNotificationSettings = () => {
  openNotificationSettings();
};

const handleDisplayOverOtherApps = () => {
  openDisplayOverOtherAppsSettings();
};

const handleAppDetails = () => {
  openAppDetailsSettings();
};
</script>

<style scoped>
.keep-alive-tab {
  max-width: 640px;
}

.nav-arrow {
  font-size: 20px;
  color: var(--m-text-muted, #9a9590);
}

.keep-alive-tips {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 12px;
  padding: 0 4px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--m-text-muted, #9a9590);
}

.keep-alive-tips i {
  flex-shrink: 0;
  margin-top: 1px;
  font-size: 14px;
}
</style>
