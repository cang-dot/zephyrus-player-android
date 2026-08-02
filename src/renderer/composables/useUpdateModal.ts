import { ref } from 'vue';

import type { UpdateResult } from '@/utils/update';

/**
 * 更新弹窗全局状态：自动检查、关于页手动检查、下载进度共用同一个弹窗
 */
export const updateModalState = ref<{
  show: boolean;
  info: UpdateResult | null;
}>({
  show: false,
  info: null
});

export const openUpdateModal = (info: UpdateResult) => {
  updateModalState.value = { show: true, info };
};

export const closeUpdateModal = () => {
  updateModalState.value = { show: false, info: null };
};
