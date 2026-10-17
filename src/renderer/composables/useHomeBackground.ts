/**
 * 主页自定义背景（solid/cover/image）共享状态：
 * - 墙纸层现在是 MobileLayout 的全局层（播放页被不透明播放器自然盖住），
 *   MobileHome 不再自带背景层；
 * - 自选图存 IndexedDB（localStorage 版本会撞配额），模块级单例 ref 供
 *   布局层与设置页共享，首次调用时异步装载并迁移旧 localStorage 值。
 */
import { computed, ref } from 'vue';

import { playMusic } from '@/hooks/MusicHook';
import { useSettingsStore } from '@/store/modules/settings';
import {
  getStoredBackgroundImage,
  removeStoredBackgroundImage,
  storeBackgroundImage
} from '@/utils/backgroundImageStore';

const backgroundImage = ref('');
let loadStarted = false;

function ensureLoaded() {
  if (loadStarted || typeof window === 'undefined') return;
  loadStarted = true;
  getStoredBackgroundImage()
    .then(async (stored) => {
      // 迁移旧 localStorage 值（历史上写进去过的话顺手清掉，释放配额）
      let value = stored;
      try {
        const legacy = localStorage.getItem('home-background-image');
        if (legacy) {
          localStorage.removeItem('home-background-image');
          if (!value) {
            await storeBackgroundImage(legacy);
            value = legacy;
          }
        }
      } catch {
        /* 迁移失败不影响读取 */
      }
      backgroundImage.value = value;
    })
    .catch(() => {});
}

export function useHomeBackground() {
  ensureLoaded();
  const settingsStore = useSettingsStore();

  const homeBgMode = computed(() => String(settingsStore.setData?.homeBackgroundMode || 'auto'));
  const homeBgColor = computed(() => String(settingsStore.setData?.homeBackgroundColor || '#f5f1eb'));
  const homeBgBlur = computed(() => {
    const value = Number(settingsStore.setData?.homeBackgroundBlur);
    return Number.isFinite(value) ? Math.min(40, Math.max(0, value)) : 0;
  });
  const homeBgBrightness = computed(() => {
    const value = Number(settingsStore.setData?.homeBackgroundBrightness);
    return Number.isFinite(value) && value > 0 ? Math.min(150, Math.max(50, value)) : 100;
  });

  const homeBgActive = computed(() => {
    if (homeBgMode.value === 'solid') return true;
    if (homeBgMode.value === 'cover') return !!playMusic?.value?.picUrl;
    if (homeBgMode.value === 'image') return !!backgroundImage.value;
    return false;
  });

  const homeBgStyle = computed(() => {
    if (!homeBgActive.value) return undefined;
    if (homeBgMode.value === 'solid') {
      return { background: homeBgColor.value };
    }
    const url =
      homeBgMode.value === 'cover'
        ? String(playMusic?.value?.picUrl || '')
        : String(backgroundImage.value);
    if (!url) return undefined;
    const style: Record<string, string> = {
      backgroundImage: `url("${url}")`,
      filter: `blur(${homeBgBlur.value}px) brightness(${homeBgBrightness.value}%)`
    };
    // 模糊边缘外扩，避免四周露出模糊白边
    if (homeBgBlur.value > 0) style.transform = 'scale(1.12)';
    return style;
  });

  /** 保存自选图：先落 IDB 再更新内存 ref；抛错由调用方 toast（配额/解码等） */
  async function saveBackgroundImage(dataUrl: string) {
    await storeBackgroundImage(dataUrl);
    backgroundImage.value = dataUrl;
  }

  async function clearBackgroundImage() {
    await removeStoredBackgroundImage();
    backgroundImage.value = '';
  }

  return {
    homeBgMode,
    homeBgActive,
    homeBgStyle,
    backgroundImage,
    saveBackgroundImage,
    clearBackgroundImage
  };
}
