<template>
  <div class="settings-page">
    <div ref="contentRef" class="settings-scroll">
      <div class="settings-content">
        <component :is="sectionComponent" v-if="sectionComponent" class="animate-fade-in" />
        <div class="bottom-spacer" />
        <play-bottom />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import PlayBottom from '@/components/common/PlayBottom.vue';
import {
  registerMobileTopbarPresentation,
  unregisterMobileTopbarPresentation
} from '@/composables/useMobileTopbarMenu';
import { useSettingsStore } from '@/store/modules/settings';
import { isElectron } from '@/utils';

import { createDefaultAppUpdateState } from '../../../shared/appUpdate';
import config from '../../../../package.json';
import { flashSettingTarget, useSettingsPageContext } from './useSettingsPageContext';
import AboutTab from './tabs/AboutTab.vue';
import AdvancedTab from './tabs/AdvancedTab.vue';
import ApplicationTab from './tabs/ApplicationTab.vue';
import NetworkTab from './tabs/NetworkTab.vue';
import PlaybackTab from './tabs/PlaybackTab.vue';
import SystemTab from './tabs/SystemTab.vue';

defineOptions({ name: 'SetSection' });

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const settingsStore = useSettingsStore();
const contentRef = ref<HTMLElement | null>(null);

useSettingsPageContext();

const SECTION_COMPONENTS: Record<string, unknown> = {
  playback: PlaybackTab,
  advanced: AdvancedTab,
  about: AboutTab,
  ...(isElectron
    ? {
        application: ApplicationTab,
        network: NetworkTab,
        system: SystemTab
      }
    : {})
};

const section = computed(() => String(route.params.section || ''));

const sectionComponent = computed(() => SECTION_COMPONENTS[section.value] || null);

const sectionTitle = computed(() =>
  sectionComponent.value ? t(`settings.sections.${section.value}`) : ''
);

onMounted(() => {
  // 非法 section 一律回设置主页
  if (!sectionComponent.value) {
    router.replace('/set');
    return;
  }
  if (isElectron && settingsStore.appUpdateState.currentVersion === '') {
    settingsStore.setAppUpdateState(createDefaultAppUpdateState(config.version));
  }
  registerMobileTopbarPresentation({
    routePath: route.path,
    title: sectionTitle.value
  });

  // 搜索跳转落地：?focus=<targetId>&q=<titlePath>
  const focus = String(route.query.focus || '');
  const keyword = String(route.query.q || '');
  if (focus || keyword) {
    nextTick(() =>
      nextTick(() => {
        flashSettingTarget(contentRef.value, focus || undefined, keyword || '');
        router.replace({ path: route.path });
      })
    );
  }
});

onUnmounted(() => {
  unregisterMobileTopbarPresentation(route.path);
});
</script>

<style scoped>
.settings-page {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: var(--cover-bg, var(--m-bg, var(--bg-color, #fff)));
  color: var(--cover-text-primary, var(--m-text-primary, var(--text-color, #000)));
}

.settings-page :deep(.setting-item),
.settings-page :deep(.setting-section-list),
.settings-page :deep(.setting-control),
.settings-page :deep(.setting-card) {
  box-shadow: none !important;
}

.settings-page :deep(*) {
  box-shadow: none !important;
  filter: none !important;
}

.settings-page :deep(.setting-section),
.settings-page :deep(.setting-section-list),
.settings-page :deep(.setting-item),
.settings-page :deep(.setting-item-details),
.settings-page :deep(.setting-item-details-inner) {
  background: transparent !important;
  border-color: transparent !important;
}

.settings-scroll {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: visible;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding-top: var(--mobile-topbar-inset);
}
.settings-scroll::-webkit-scrollbar {
  display: none;
}

.settings-content {
  padding: 0 16px;
}

.bottom-spacer {
  height: calc(var(--safe-area-inset-bottom, 0px) + 140px);
}
</style>
