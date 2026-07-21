<template>
  <div class="keep-alive-tab">
    <div class="keep-alive-header">
      <i class="ri-shield-check-line header-icon" />
      <div>
        <h2 class="header-title">{{ t('settings.keepAlive.title') }}</h2>
        <p class="header-desc">{{ t('settings.keepAlive.desc') }}</p>
      </div>
    </div>

    <div class="keep-alive-list">
      <!-- 电池优化 -->
      <div class="keep-alive-item" @click="handleBatteryOptimization">
        <div class="item-icon-wrap">
          <i class="ri-battery-2-charge-line" />
        </div>
        <div class="item-content">
          <div class="item-title">{{ t('settings.keepAlive.batteryOptimization') }}</div>
          <div class="item-desc">{{ t('settings.keepAlive.batteryOptimizationDesc') }}</div>
        </div>
        <i class="ri-arrow-right-s-line item-arrow" />
      </div>

      <!-- 自启动管理 -->
      <div class="keep-alive-item" @click="handleAutoStart">
        <div class="item-icon-wrap">
          <i class="ri-rocket-2-line" />
        </div>
        <div class="item-content">
          <div class="item-title">{{ t('settings.keepAlive.autoStart') }}</div>
          <div class="item-desc">{{ t('settings.keepAlive.autoStartDesc') }}</div>
        </div>
        <i class="ri-arrow-right-s-line item-arrow" />
      </div>

      <!-- 通知权限 -->
      <div class="keep-alive-item" @click="handleNotificationSettings">
        <div class="item-icon-wrap">
          <i class="ri-notification-3-line" />
        </div>
        <div class="item-content">
          <div class="item-title">{{ t('settings.keepAlive.notification') }}</div>
          <div class="item-desc">{{ t('settings.keepAlive.notificationDesc') }}</div>
        </div>
        <i class="ri-arrow-right-s-line item-arrow" />
      </div>

      <!-- 后台弹出界面权限 -->
      <div class="keep-alive-item" @click="handleDisplayOverOtherApps">
        <div class="item-icon-wrap">
          <i class="ri-window-2-line" />
        </div>
        <div class="item-content">
          <div class="item-title">{{ t('settings.keepAlive.displayOverOtherApps') }}</div>
          <div class="item-desc">{{ t('settings.keepAlive.displayOverOtherAppsDesc') }}</div>
        </div>
        <i class="ri-arrow-right-s-line item-arrow" />
      </div>

      <!-- 应用详情页（权限总览） -->
      <div class="keep-alive-item" @click="handleAppDetails">
        <div class="item-icon-wrap">
          <i class="ri-settings-3-line" />
        </div>
        <div class="item-content">
          <div class="item-title">{{ t('settings.keepAlive.appDetails') }}</div>
          <div class="item-desc">{{ t('settings.keepAlive.appDetailsDesc') }}</div>
        </div>
        <i class="ri-arrow-right-s-line item-arrow" />
      </div>
    </div>

    <div class="keep-alive-tips">
      <i class="ri-information-line" />
      <span>{{ t('settings.keepAlive.tips') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import {
  openAppDetailsSettings,
  openAutoStartSettings,
  openBatteryOptimizationSettings,
  openDisplayOverOtherAppsSettings,
  openNotificationSettings
} from '@/services/androidNative';

const { t } = useI18n();

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

.keep-alive-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 24px;
  padding: 20px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(var(--accent-color-rgb, 30, 215, 96), 0.08), rgba(var(--accent-color-rgb, 30, 215, 96), 0.02));
  border: 1px solid rgba(var(--accent-color-rgb, 30, 215, 96), 0.12);
}

.header-icon {
  font-size: 32px;
  color: var(--accent-color, #1ed760);
  flex-shrink: 0;
  margin-top: 2px;
}

.header-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--m-text-primary, #1a1a1a);
  margin-bottom: 4px;
}

.header-desc {
  font-size: 13px;
  color: var(--m-text-secondary, #666);
  line-height: 1.5;
}

.keep-alive-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.keep-alive-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 12px;
  background: var(--m-surface, #f5f5f5);
  cursor: pointer;
  transition: background 0.2s ease, transform 0.1s ease;
}

.keep-alive-item:active {
  transform: scale(0.98);
  background: var(--m-surface-active, #ebebeb);
}

:global(.dark) .keep-alive-item {
  background: rgba(255, 255, 255, 0.04);
}

:global(.dark) .keep-alive-item:active {
  background: rgba(255, 255, 255, 0.08);
}

.item-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(var(--accent-color-rgb, 30, 215, 96), 0.1);
  flex-shrink: 0;
}

.item-icon-wrap i {
  font-size: 20px;
  color: var(--accent-color, #1ed760);
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--m-text-primary, #1a1a1a);
  margin-bottom: 2px;
}

.item-desc {
  font-size: 12px;
  color: var(--m-text-muted, #999);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-arrow {
  font-size: 20px;
  color: var(--m-text-muted, #ccc);
  flex-shrink: 0;
}

.keep-alive-tips {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 20px;
  padding: 14px 16px;
  border-radius: 10px;
  background: rgba(255, 193, 7, 0.08);
  border: 1px solid rgba(255, 193, 7, 0.15);
}

.keep-alive-tips i {
  font-size: 16px;
  color: #ffc107;
  flex-shrink: 0;
  margin-top: 1px;
}

.keep-alive-tips span {
  font-size: 12px;
  color: var(--m-text-secondary, #666);
  line-height: 1.5;
}
</style>
