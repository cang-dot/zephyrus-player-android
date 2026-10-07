import { useDebounceFn } from '@vueuse/core';
import { useDialog, useMessage } from 'naive-ui';
import { computed, onUnmounted, provide, ref, watch } from 'vue';

import { useSettingsStore } from '@/store/modules/settings';

import { SETTINGS_DATA_KEY, SETTINGS_DIALOG_KEY, SETTINGS_MESSAGE_KEY } from './keys';

/**
 * 设置页共享上下文：setData 双向同步 + 三项 provide。
 * 设置主页（index.vue）与子页面（section.vue）各自调用一份，
 * 保证 Tab 组件在任一页面下都能 inject 到相同的数据与反馈通道。
 */
export function useSettingsPageContext() {
  const settingsStore = useSettingsStore();
  const message = useMessage();
  const dialog = useDialog();

  const saveSettings = useDebounceFn((data) => {
    settingsStore.setSetData(data);
  }, 500);

  const localSetData = ref({ ...settingsStore.setData });

  const setData = computed({
    get: () => localSetData.value,
    set: (newData) => {
      localSetData.value = newData;
    }
  });

  watch(
    () => localSetData.value,
    (newValue) => saveSettings(newValue),
    { deep: true }
  );

  watch(
    () => settingsStore.setData,
    (newValue) => {
      if (JSON.stringify(localSetData.value) !== JSON.stringify(newValue)) {
        localSetData.value = { ...newValue };
      }
    },
    { deep: true, immediate: true }
  );

  onUnmounted(() => {
    settingsStore.setSetData(localSetData.value);
  });

  provide(SETTINGS_DATA_KEY, setData);
  provide(SETTINGS_MESSAGE_KEY, message);
  provide(SETTINGS_DIALOG_KEY, dialog);

  const ensureDefaults = () => {
    if (setData.value.enableRealIP === undefined) {
      setData.value = { ...setData.value, enableRealIP: false };
    }
    if (setData.value.enableDiskCache === undefined) {
      setData.value = { ...setData.value, enableDiskCache: true };
    }
    if (!setData.value.diskCacheMaxSizeMB) {
      setData.value = { ...setData.value, diskCacheMaxSizeMB: 4096 };
    }
    if (!['lru', 'fifo'].includes(setData.value.diskCacheCleanupPolicy)) {
      setData.value = { ...setData.value, diskCacheCleanupPolicy: 'lru' };
    }
  };
  ensureDefaults();

  return { setData, message, dialog };
}

/** 设置搜索结果的同页/子页定位：滚动到目标项、展开手风琴并闪烁提示 */
export function flashSettingTarget(
  root: HTMLElement | null,
  targetId: string | undefined,
  titlePath: string
) {
  const targetedItem = targetId
    ? root?.querySelector<HTMLElement>(`#${CSS.escape(targetId)}`)
    : null;
  if (targetedItem) {
    targetedItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (targetedItem.getAttribute('aria-expanded') !== 'true') {
      targetedItem.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
    targetedItem.classList.add('setting-item-flash');
    setTimeout(() => targetedItem.classList.remove('setting-item-flash'), 2000);
    return true;
  }
  const items = root?.querySelectorAll<HTMLElement>('.setting-item, .keep-alive-item');
  if (items) {
    for (const item of items) {
      const titleEl = item.querySelector('.setting-item-title, .item-title, [class*="title"]');
      if (titleEl && titleEl.textContent?.includes(titlePath)) {
        item.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (item.getAttribute('aria-expanded') !== 'true') {
          item.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
        item.classList.add('setting-item-flash');
        setTimeout(() => item.classList.remove('setting-item-flash'), 2000);
        return true;
      }
    }
  }
  return false;
}
