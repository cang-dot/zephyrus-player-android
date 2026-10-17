<template>
  <div>
    <input
      ref="backgroundImageInput"
      type="file"
      accept="image/*"
      class="hidden"
      @change="onBackgroundImagePicked"
    />
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
                  setData.autoTheme
                    ? t('settings.basic.autoTheme')
                    : t('settings.basic.manualTheme')
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

      <setting-item
        :title="t('settings.interface.homeBackground')"
        :description="t('settings.interface.homeBackgroundDesc')"
      >
        <s-select
          v-model="setData.homeBackgroundMode"
          :options="homeBgModeOptions"
          width="w-40 max-md:w-full"
        />
      </setting-item>

      <template v-if="setData.homeBackgroundMode === 'solid'">
        <setting-item mode="direct" :title="t('settings.interface.homeBackgroundSolid')">
          <app-color-picker v-model="setData.homeBackgroundColor" />
        </setting-item>
      </template>

      <template
        v-if="setData.homeBackgroundMode === 'cover' || setData.homeBackgroundMode === 'image'"
      >
        <setting-item
          v-if="setData.homeBackgroundMode === 'image'"
          mode="direct"
          :title="t('settings.interface.chooseBackgroundImage')"
        >
          <div class="flex items-center gap-3">
            <button type="button" class="home-bg-action" @click="backgroundImageInput?.click()">
              {{ t('settings.interface.chooseBackgroundImage') }}
            </button>
            <button
              v-if="backgroundImage"
              type="button"
              class="home-bg-action home-bg-action-quiet"
              @click="onClearBackgroundImage"
            >
              {{ t('settings.interface.clearBackgroundImage') }}
            </button>
          </div>
        </setting-item>
        <setting-item mode="direct" :title="t('settings.interface.homeBackgroundBlur')">
          <div class="home-bg-slider-row">
            <input
              v-model.number="setData.homeBackgroundBlur"
              type="range"
              min="0"
              max="40"
              step="1"
            />
            <span class="home-bg-slider-value">{{ setData.homeBackgroundBlur ?? 0 }}px</span>
          </div>
        </setting-item>
        <setting-item mode="direct" :title="t('settings.interface.homeBackgroundBrightness')">
          <div class="home-bg-slider-row">
            <input
              v-model.number="setData.homeBackgroundBrightness"
              type="range"
              min="50"
              max="150"
              step="5"
            />
            <span class="home-bg-slider-value">{{ setData.homeBackgroundBrightness ?? 100 }}%</span>
          </div>
        </setting-item>
      </template>

      <setting-item
        :title="t('settings.interface.albumBackgroundStyle')"
        :description="t('settings.interface.albumBackgroundStyleDesc')"
      >
        <s-select
          v-model="setData.albumBackgroundStyle"
          :options="albumBgStyleOptions"
          width="w-44 max-md:w-full"
        />
      </setting-item>
    </setting-section>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AppColorPicker from '@/components/common/AppColorPicker.vue';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';
import { useHomeBackground } from '@/composables/useHomeBackground';
import { useSettingsStore } from '@/store/modules/settings';
import { compressImage } from '@/utils/imageCompress';

import { SETTINGS_DATA_KEY, SETTINGS_MESSAGE_KEY } from '../keys';
import SettingItem from '../SettingItem.vue';
import SettingSection from '../SettingSection.vue';
import SSelect from '../SSelect.vue';

const { t } = useI18n();
const settingsStore = useSettingsStore();
const setData = inject(SETTINGS_DATA_KEY)!;
const message = inject(SETTINGS_MESSAGE_KEY)!;

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

// 主页背景：auto=MD3 动态取色（现状），solid/cover/image 为自定义覆盖层
const homeBgModeOptions = computed(() => [
  { label: t('settings.interface.homeBackgroundMd3'), value: 'auto' },
  { label: t('settings.interface.homeBackgroundSolid'), value: 'solid' },
  { label: t('settings.interface.homeBackgroundCover'), value: 'cover' },
  { label: t('settings.interface.homeBackgroundImage'), value: 'image' }
]);

// 歌单/专辑详情页背景取色策略：muted=现状（向黑白混合压饱和），vivid=贴封面原色
const albumBgStyleOptions = computed(() => [
  { label: t('settings.interface.albumBgMuted'), value: 'muted' },
  { label: t('settings.interface.albumBgVivid'), value: 'vivid' }
]);

// 自选图存 IndexedDB（经 useHomeBackground 单例共享）：localStorage 版本会撞配额
// （QuotaExceededError 且 vueuse 异步 flush 抛错连 toast 都走不到）
const { backgroundImage, saveBackgroundImage, clearBackgroundImage } = useHomeBackground();
const backgroundImageInput = ref<HTMLInputElement | null>(null);

const onBackgroundImagePicked = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const compressed = await compressImage(file, 1280, 0.85);
    await saveBackgroundImage(compressed.dataUrl);
    message.success(t('settings.interface.backgroundImageSaved'));
  } catch (error) {
    // 压缩/存储失败不再静默——HEIC 解不了、配额超限等在此统一提示
    console.warn('[Appearance] 背景图处理失败:', error);
    message.error(t('settings.interface.backgroundImageFailed'));
  } finally {
    input.value = '';
  }
};

const onClearBackgroundImage = async () => {
  try {
    await clearBackgroundImage();
  } catch (error) {
    console.warn('[Appearance] 背景图清除失败:', error);
  }
};
</script>

<style scoped>
.home-bg-slider-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: min(260px, 100%);
}

.home-bg-slider-row input[type='range'] {
  flex: 1;
  min-width: 0;
  accent-color: var(--accent-color, #7c7c74);
}

.home-bg-slider-value {
  min-width: 44px;
  font-size: 12px;
  color: var(--m-text-secondary, #6b6b64);
  text-align: right;
}

.home-bg-action {
  padding: 6px 14px;
  border: 1px solid var(--m-border, #ddd);
  border-radius: 999px;
  background: var(--m-surface, #fff);
  color: var(--m-text-primary, #20211f);
  font-size: 13px;
  cursor: pointer;
}

.home-bg-action-quiet {
  background: transparent;
  color: var(--m-text-secondary, #6b6b64);
}
</style>
