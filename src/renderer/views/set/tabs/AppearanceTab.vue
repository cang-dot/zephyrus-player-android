<template>
  <div>
    <setting-section :title="t('settings.sections.appearance')">
      <setting-item
        mode="direct"
        :title="t('settings.basic.themeMode')"
        :description="t('settings.basic.themeModeDesc')"
      >
        <template #action>
          <div class="flex items-center gap-3 max-md:flex-wrap">
            <div class="flex items-center gap-2">
              <n-switch v-model:value="setData.autoTheme" @update:value="handleAutoThemeChange">
                <template #checked><i class="ri-smartphone-line"></i></template>
                <template #unchecked><i class="ri-settings-line"></i></template>
              </n-switch>
              <span class="text-sm text-gray-500 max-md:hidden">
                {{
                  setData.autoTheme ? t('settings.basic.autoTheme') : t('settings.basic.manualTheme')
                }}
              </span>
            </div>
            <n-switch
              v-model:value="isDarkTheme"
              :disabled="setData.autoTheme"
              :class="{ 'opacity-50': setData.autoTheme }"
            >
              <template #checked><i class="ri-moon-line"></i></template>
              <template #unchecked><i class="ri-sun-line"></i></template>
            </n-switch>
          </div>
        </template>
      </setting-item>

      <setting-item
        :title="t('settings.basic.language')"
        :description="t('settings.basic.languageDesc')"
      >
        <language-switcher />
      </setting-item>

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
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';

import LanguageSwitcher from '@/components/LanguageSwitcher.vue';
import { useSettingsStore } from '@/store/modules/settings';

import { SETTINGS_DATA_KEY } from '../keys';
import SettingItem from '../SettingItem.vue';
import SettingSection from '../SettingSection.vue';
import SSelect from '../SSelect.vue';

const { t } = useI18n();
const settingsStore = useSettingsStore();
const setData = inject(SETTINGS_DATA_KEY)!;

const isDarkTheme = computed({
  get: () => settingsStore.theme === 'dark',
  set: () => settingsStore.toggleTheme()
});

const handleAutoThemeChange = (value: boolean) => {
  settingsStore.setAutoTheme(value);
};

// 启动默认页选项（仅移动端可用页面）
const defaultPageOptions = computed(() => [
  { label: t('comp.home'), value: '/' },
  { label: t('comp.list'), value: '/list' },
  { label: t('comp.history'), value: '/history' },
  { label: t('comp.localMusic'), value: '/local-music' },
  { label: t('comp.my'), value: '/user' },
  { label: t('comp.settings'), value: '/set' }
]);
</script>
