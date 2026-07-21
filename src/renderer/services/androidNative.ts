/**
 * Android 原生桥接服务
 * 通过 window.AndroidNative (JavascriptInterface) 与原生 Android 层通信
 * 包括：状态栏外观控制、音乐通知（MediaSession）、安全区域、返回手势
 */

import { usePlayerStore } from '@/store/modules/player';
import { useSettingsStore } from '@/store/modules/settings';
import { allTime, artistList, nowTime, playMusic } from '@/hooks/MusicHook';
import { getImgUrl } from '@/utils';
import { nextTick, watch } from 'vue';

type NativeBridge = {
  setStatusBarDark: (isDark: boolean) => void;
  setStatusBarColor: (hexColor: string) => void;
  getSafeAreaInsets: () => string;
  updateMediaNotification: (
    title: string,
    artist: string,
    album: string,
    artworkUrl: string,
    isPlaying: boolean,
    duration: number,
    position: number
  ) => void;
  clearMediaNotification: () => void;
  showIdleNotification: () => void;
  exitApp: () => void;
  openBatteryOptimizationSettings: () => void;
  openAutoStartSettings: () => void;
  openNotificationSettings: () => void;
  openAppDetailsSettings: () => void;
  openDisplayOverOtherAppsSettings: () => void;
};

declare global {
  interface Window {
    AndroidNative?: NativeBridge;
  }
}

/** 是否在 Android 原生环境中 */
export const isAndroidNative = (): boolean => {
  return typeof window !== 'undefined' && !!window.AndroidNative;
};

/**
 * 更新状态栏图标外观以匹配当前主题
 * @param isDark 是否为深色主题
 */
export function updateStatusBarTheme(isDark: boolean) {
  if (isAndroidNative()) {
    try {
      window.AndroidNative!.setStatusBarDark(isDark);
    } catch (e) {
      console.warn('[NativeBridge] 更新状态栏外观失败:', e);
    }
  }
}

/**
 * 更新状态栏背景颜色
 * @param hexColor 十六进制颜色字符串，如 "#f5f1eb"
 */
export function setStatusBarBgColor(hexColor: string) {
  if (isAndroidNative()) {
    try {
      window.AndroidNative!.setStatusBarColor(hexColor);
    } catch (e) {
      console.warn('[NativeBridge] 更新状态栏背景色失败:', e);
    }
  }
}

/**
 * 请求原生层注入安全区域 CSS 变量
 * 将状态栏和导航栏高度注入为 CSS 变量 --safe-area-inset-*
 */
export function injectSafeAreaInsets() {
  if (!isAndroidNative()) return;
  try {
    const json = window.AndroidNative!.getSafeAreaInsets();
    const insets = JSON.parse(json);
    const root = document.documentElement;
    root.style.setProperty('--safe-area-inset-top', `${insets.top}px`);
    root.style.setProperty('--safe-area-inset-bottom', `${insets.bottom}px`);
    root.style.setProperty('--safe-area-inset-left', `${insets.left}px`);
    root.style.setProperty('--safe-area-inset-right', `${insets.right}px`);
  } catch (e) {
    console.warn('[NativeBridge] 注入安全区域失败:', e);
  }
}

/**
 * 更新音乐通知
 */
export function updateMusicNotification() {
  if (!isAndroidNative()) return;

  const playerStore = usePlayerStore();
  // playMusic 在 initMusicHook 后才被赋值，需做安全检查
  const song = playMusic?.value;
  if (!song || !song.id) {
    // 没有歌曲时显示空闲通知（而非清除）
    showIdleMusicNotification();
    return;
  }

  const title = song.name || '未知歌曲';
  const artists = artistList?.value || [];
  const artist = artists.map((a: any) => a.name).join(' / ');
  const album = song.al?.name || song.album?.name || '';
  const artworkUrl = getImgUrl(song.picUrl, '300y300');
  const isPlaying = playerStore.isPlay;
  const duration = allTime.value || 0;
  const position = nowTime.value || 0;

  try {
    window.AndroidNative!.updateMediaNotification(
      title,
      artist,
      album,
      artworkUrl,
      isPlaying,
      duration,
      position
    );
  } catch (e) {
    console.warn('[NativeBridge] 更新音乐通知失败:', e);
  }
}

/**
 * 显示空闲音乐通知（常驻，未在播放时显示）
 */
export function showIdleMusicNotification() {
  if (!isAndroidNative()) return;
  try {
    window.AndroidNative!.showIdleNotification();
  } catch (e) {
    console.warn('[NativeBridge] 显示空闲通知失败:', e);
  }
}

/**
 * 清除音乐通知
 */
export function clearMusicNotification() {
  if (!isAndroidNative()) return;
  try {
    window.AndroidNative!.clearMediaNotification();
  } catch (e) {
    console.warn('[NativeBridge] 清除音乐通知失败:', e);
  }
}

/**
 * 退出应用
 */
export function exitApp() {
  if (!isAndroidNative()) return;
  try {
    window.AndroidNative!.exitApp();
  } catch (e) {
    console.warn('[NativeBridge] 退出应用失败:', e);
  }
}

// ==================== 保活相关 ====================

export function openBatteryOptimizationSettings() {
  if (!isAndroidNative()) return;
  try {
    window.AndroidNative!.openBatteryOptimizationSettings();
  } catch (e) {
    console.warn('[NativeBridge] 打开电池优化设置失败:', e);
  }
}

export function openAutoStartSettings() {
  if (!isAndroidNative()) return;
  try {
    window.AndroidNative!.openAutoStartSettings();
  } catch (e) {
    console.warn('[NativeBridge] 打开自启动设置失败:', e);
  }
}

export function openNotificationSettings() {
  if (!isAndroidNative()) return;
  try {
    window.AndroidNative!.openNotificationSettings();
  } catch (e) {
    console.warn('[NativeBridge] 打开通知设置失败:', e);
  }
}

export function openAppDetailsSettings() {
  if (!isAndroidNative()) return;
  try {
    window.AndroidNative!.openAppDetailsSettings();
  } catch (e) {
    console.warn('[NativeBridge] 打开应用详情设置失败:', e);
  }
}

export function openDisplayOverOtherAppsSettings() {
  if (!isAndroidNative()) return;
  try {
    window.AndroidNative!.openDisplayOverOtherAppsSettings();
  } catch (e) {
    console.warn('[NativeBridge] 打开显示在其他应用上层设置失败:', e);
  }
}

// ==================== 返回手势处理（基于 history API）====================
//
// 原理：
// 1. 当覆层（播放器、歌词全屏、设置弹窗等）打开时，调用 history.pushState 压入一个历史条目
// 2. 用户触发返回手势 → Java 端 webView.goBack() → WebView 历史出栈 → 触发 JS popstate 事件
// 3. popstate 监听器检查哪个覆层处于打开状态，关闭最顶层的覆层
// 4. 由于 popstate 弹出的是 pushState 条目（不是路由变更），SPA 路由不会后退
// 5. 当所有覆层都关闭后，下一次返回手势才会真正后退 SPA 路由
// 6. 当 SPA 路由在首页且无更多历史时，Java 端调用 finish() 退出应用

let overlayCount = 0;
let isPopStateHandling = false;

/**
 * 压入一个覆层历史条目
 */
function pushOverlayState() {
  overlayCount++;
  history.pushState({ overlay: true }, '');
}

/**
 * 弹出一个覆层历史条目（用于 UI 关闭覆层时清理历史）
 */
function popOverlayState() {
  if (overlayCount > 0 && !isPopStateHandling) {
    overlayCount--;
    history.back();
  }
}

/**
 * 设置基于 history.pushState/popstate 的分层返回手势处理
 * 当覆层打开时压入历史条目，返回手势触发 popstate 时关闭最顶层覆层
 */
function setupOverlayBackHandler() {
  const playerStore = usePlayerStore();
  const settingsStore = useSettingsStore();

  // 监听各覆层状态，打开时 pushState，关闭时 back()
  // immediate: true 确保初始化时若覆层已打开（如状态恢复）也能正确 pushState
  watch(
    () => playerStore.musicFull,
    (visible) => {
      if (visible) pushOverlayState();
      else popOverlayState();
    },
    { immediate: true }
  );

  watch(
    () => playerStore.fullLyricsVisible,
    (visible) => {
      if (visible) pushOverlayState();
      else popOverlayState();
    },
    { immediate: true }
  );

  watch(
    () => playerStore.playerSettingsVisible,
    (visible) => {
      if (visible) pushOverlayState();
      else popOverlayState();
    },
    { immediate: true }
  );

  watch(
    () => settingsStore.showArtistDrawer,
    (visible) => {
      if (visible) pushOverlayState();
      else popOverlayState();
    },
    { immediate: true }
  );

  watch(
    () => playerStore.playListDrawerVisible,
    (visible) => {
      if (visible) pushOverlayState();
      else popOverlayState();
    },
    { immediate: true }
  );

  // 监听 popstate：返回手势触发时关闭最顶层覆层
  // 返回顺序：设置弹窗 → 全屏歌词 → 播放器 → 歌手抽屉 → 播放列表抽屉 → 路由后退
  window.addEventListener('popstate', () => {
    if (overlayCount > 0 && !isPopStateHandling) {
      isPopStateHandling = true;
      overlayCount--;

      // 按优先级关闭最顶层的覆层
      if (playerStore.playerSettingsVisible) {
        playerStore.setPlayerSettingsVisible(false);
      } else if (playerStore.fullLyricsVisible) {
        playerStore.setFullLyricsVisible(false);
      } else if (playerStore.musicFull) {
        // 关闭播放器时同时重置子覆层，防止残留状态
        playerStore.setFullLyricsVisible(false);
        playerStore.setPlayerSettingsVisible(false);
        playerStore.setMusicFull(false);
      } else if (settingsStore.showArtistDrawer) {
        settingsStore.setShowArtistDrawer(false);
      } else if (playerStore.playListDrawerVisible) {
        playerStore.setPlayListDrawerVisible(false);
      }

      // 等待 Vue watch 回调执行完毕后再重置标志
      // watch 会在 nextTick 之前执行，此时 isPopStateHandling=true 可阻止 popOverlayState 重复弹栈
      nextTick(() => {
        isPopStateHandling = false;
      });
    }
  });
}

// 保留旧接口以兼容现有代码（不再使用，但避免编译错误）
type BackHandler = () => boolean;

/**
 * @deprecated 已改用 history.pushState/popstate 方案
 */
export function registerBackHandler(_handler: BackHandler) {
  // no-op
}

/**
 * 监听通知栏媒体按钮事件（播放/暂停/上一首/下一首）
 */
export function setupMediaButtonListener() {
  if (!isAndroidNative()) return;

  const playerStore = usePlayerStore();

  window.addEventListener('media-button', ((e: CustomEvent) => {
    const action = e.detail;
    // 处理 seek 操作
    if (typeof action === 'string' && action.startsWith('seek:')) {
      const pos = parseInt(action.split(':')[1], 10);
      if (!isNaN(pos)) {
        // seek 操作通过 audioService 处理
        const audio = document.querySelector('audio') || document.querySelector('video');
        if (audio) {
          audio.currentTime = pos / 1000;
        }
      }
      return;
    }

    switch (action) {
      case 'play':
      case 'pause':
        if (playMusic?.value) {
          playerStore.setPlay(playMusic.value);
        }
        break;
      case 'next':
        playerStore.nextPlay();
        break;
      case 'prev':
        playerStore.prevPlay();
        break;
      case 'stop':
        playerStore.handlePause();
        // 不再清除通知，改为更新为暂停状态
        updateMusicNotification();
        break;
    }
  }) as EventListener);
}

/**
 * 初始化原生桥接：监听主题变化、播放状态变化、歌曲变化
 * 应在 App.vue 的 onMounted 中调用
 */
export function initNativeBridge() {
  if (!isAndroidNative()) return;

  try {
    const playerStore = usePlayerStore();
    const settingsStore = useSettingsStore();

    // 1. 注入安全区域 CSS 变量
    injectSafeAreaInsets();

    // 2. 同步状态栏外观到当前主题
    updateStatusBarTheme(settingsStore.theme === 'dark');
    // 设置初始状态栏背景色
    if (settingsStore.theme === 'dark') {
      setStatusBarBgColor('#1a1a1a');
    } else {
      setStatusBarBgColor('#f5f1eb');
    }

    // 3. 监听主题变化
    watch(
      () => settingsStore.theme,
      (newTheme) => {
        updateStatusBarTheme(newTheme === 'dark');
        if (newTheme === 'dark') {
          setStatusBarBgColor('#1a1a1a');
        } else {
          setStatusBarBgColor('#f5f1eb');
        }
      }
    );

    // 4. 监听歌曲变化
    watch(
      () => playMusic?.value?.id,
      () => {
        updateMusicNotification();
      }
    );

    // 5. 监听播放状态变化
    watch(
      () => playerStore.isPlay,
      () => {
        updateMusicNotification();
      }
    );

    // 6. 定时更新播放进度（每5秒）
    setInterval(() => {
      if (playerStore.isPlay) {
        updateMusicNotification();
      }
    }, 5000);

    // 7. 设置媒体按钮监听
    setupMediaButtonListener();

    // 8. 设置覆层返回手势处理（基于 history.pushState/popstate）
    setupOverlayBackHandler();

    // 9. 显示初始空闲通知（常驻通知，确保通知不间歇性失效）
    showIdleMusicNotification();

    console.log('[NativeBridge] 原生桥接已初始化');
  } catch (e) {
    console.error('[NativeBridge] 初始化失败:', e);
  }
}
