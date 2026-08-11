/**
 * Android 原生桥接服务
 * 通过 window.AndroidNative (JavascriptInterface) 与原生 Android 层通信
 * 包括：状态栏外观控制、音乐通知（MediaSession）、安全区域、返回手势
 */

import { nextTick, watch } from 'vue';

import { useWordTimedPlayback } from '@/composables/useWordTimedPlayback';
import { allTime, artistList, lrcArray, nowIndex, nowTime, playMusic } from '@/hooks/MusicHook';
import { usePlayerStore } from '@/store/modules/player';
import { useSettingsStore } from '@/store/modules/settings';
import {
  DEFAULT_LYRIC_CONFIG,
  type LyricConfig,
  normalizeStatusBarLyricConfig,
  type StatusBarLyricConfig
} from '@/types/lyric';
import { getImgUrl } from '@/utils';
import { getFontAssetUrl } from '@/utils/fontLoader';

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
  canDrawOverlays: () => boolean;
  setStatusBarLyricEnabled: (enabled: boolean) => boolean;
  updateStatusBarLyric: (text: string, accentColor: string) => void;
  applyStatusBarLyricConfig?: (configJson: string) => boolean;
  updateStatusBarLyricState?: (stateJson: string) => void;
  installStatusBarLyricFont?: (name: string, base64Data: string) => string;
  setBackgroundKeepAlive: (enabled: boolean) => void;
  installApkFromCache: (fileName: string) => void;
  startApkDownload: (url: string, expectedSize: number) => void;
  getApkDownloadState: () => string;
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

type NativeSafeAreaInsets = {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  density?: number;
};

let safeAreaListenersBound = false;
let safeAreaRefreshTimer: ReturnType<typeof setTimeout> | undefined;

/** WebView 的 env() 在部分挖孔设备上始终为 0，因此以原生窗口 inset 兜底。 */
export function injectSafeAreaInsets() {
  if (!isAndroidNative()) return;

  try {
    const insets = JSON.parse(window.AndroidNative!.getSafeAreaInsets()) as NativeSafeAreaInsets;
    const density = Math.max(0.1, Number(insets.density) || window.devicePixelRatio || 1);
    const rootStyle = document.documentElement.style;
    const setInset = (side: 'top' | 'bottom' | 'left' | 'right', rawValue?: number) => {
      const value = Number(rawValue);
      if (!Number.isFinite(value) || value <= 0) return;
      rootStyle.setProperty(`--safe-area-inset-${side}`, `${value / density}px`);
    };

    setInset('top', insets.top);
    setInset('bottom', insets.bottom);
    setInset('left', insets.left);
    setInset('right', insets.right);
  } catch (e) {
    console.warn('[NativeBridge] 获取安全区域失败，继续使用 CSS env():', e);
  }
}

function bindSafeAreaListeners() {
  if (safeAreaListenersBound || typeof window === 'undefined') return;
  safeAreaListenersBound = true;
  const refresh = () => {
    if (safeAreaRefreshTimer) clearTimeout(safeAreaRefreshTimer);
    requestAnimationFrame(injectSafeAreaInsets);
    safeAreaRefreshTimer = setTimeout(injectSafeAreaInsets, 160);
  };
  window.addEventListener('resize', refresh, { passive: true });
  window.addEventListener('orientationchange', refresh, { passive: true });
  window.visualViewport?.addEventListener('resize', refresh, { passive: true });
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
  const rawArtwork = song.picUrl || song.al?.picUrl || song.album?.picUrl || '';
  const artworkUrl = getImgUrl(rawArtwork, '300y300');
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

export function hasStatusBarLyricPermission(): boolean {
  if (!isAndroidNative()) return false;
  try {
    return Boolean(window.AndroidNative!.canDrawOverlays());
  } catch (e) {
    console.warn('[NativeBridge] 检查悬浮窗权限失败:', e);
    return false;
  }
}

export function requestStatusBarLyricPermission() {
  openDisplayOverOtherAppsSettings();
}

function readLyricConfig(): LyricConfig {
  try {
    const saved = JSON.parse(localStorage.getItem('music-full-config') || '{}');
    return { ...DEFAULT_LYRIC_CONFIG, ...saved };
  } catch {
    return { ...DEFAULT_LYRIC_CONFIG };
  }
}

export function readStatusBarLyricConfig(): StatusBarLyricConfig {
  const config = readLyricConfig();
  return normalizeStatusBarLyricConfig(
    config.statusBarLyricConfig,
    Boolean(config.statusBarLyricsEnabled)
  );
}

export function saveStatusBarLyricConfig(value: StatusBarLyricConfig) {
  const normalized = normalizeStatusBarLyricConfig(value);
  const stored = (() => {
    try {
      return JSON.parse(localStorage.getItem('music-full-config') || '{}');
    } catch {
      return {};
    }
  })();
  stored.statusBarLyricConfig = normalized;
  stored.statusBarLyricsEnabled = normalized.enabled;
  localStorage.setItem('music-full-config', JSON.stringify(stored));
  window.dispatchEvent(new CustomEvent('music-full-config-updated'));
  applyStatusBarLyricConfig(normalized);
  return normalized;
}

function nativeStatusBarLyricConfig(config: StatusBarLyricConfig): StatusBarLyricConfig {
  if (config.font.source !== 'builtin' || !config.font.id) return config;
  return {
    ...config,
    font: { ...config.font, id: getFontAssetUrl(config.font.id) || config.font.id }
  };
}

export function applyStatusBarLyricConfig(value = readStatusBarLyricConfig()): boolean {
  if (!isAndroidNative()) return false;
  const config = normalizeStatusBarLyricConfig(value);
  const permitted = hasStatusBarLyricPermission();
  try {
    if (window.AndroidNative!.applyStatusBarLyricConfig) {
      return Boolean(
        window.AndroidNative!.applyStatusBarLyricConfig(
          JSON.stringify({
            ...nativeStatusBarLyricConfig(config),
            enabled: config.enabled && permitted
          })
        )
      );
    }
    return window.AndroidNative!.setStatusBarLyricEnabled(config.enabled && permitted);
  } catch (error) {
    console.warn('[NativeBridge] 应用状态栏歌词配置失败:', error);
    return false;
  }
}

export function installStatusBarLyricFont(file: File): Promise<string> {
  if (!isAndroidNative() || !window.AndroidNative!.installStatusBarLyricFont) {
    return Promise.reject(new Error('当前环境不支持原生字体安装'));
  }
  if (file.size > 20 * 1024 * 1024) return Promise.reject(new Error('字体文件不能超过 20MB'));
  if (!/\.(ttf|otf)$/i.test(file.name)) return Promise.reject(new Error('仅支持 TTF/OTF 字体'));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('字体读取失败'));
    reader.onload = () => {
      try {
        const data =
          String(reader.result || '')
            .split(',')
            .pop() || '';
        const id = window.AndroidNative!.installStatusBarLyricFont!(file.name, data);
        if (!id) throw new Error('字体安装失败');
        resolve(id);
      } catch (error) {
        reject(error);
      }
    };
    reader.readAsDataURL(file);
  });
}

let wordTimedPlayback: ReturnType<typeof useWordTimedPlayback> | null = null;

export function refreshStatusBarLyric() {
  if (!isAndroidNative()) return;
  const config = readStatusBarLyricConfig();
  const enabled = config.enabled;
  const permitted = hasStatusBarLyricPermission();

  try {
    applyStatusBarLyricConfig(config);
    if (!enabled || !permitted) return;

    const song = playMusic?.value;
    const line = wordTimedPlayback?.currentDisplayLine.value || lrcArray.value[nowIndex.value];
    const text = line?.text?.trim() || song?.name?.trim() || '';
    const accentColor = song?.primaryColor || '#ffffff';
    if (window.AndroidNative!.updateStatusBarLyricState) {
      const words = (line?.words || []).filter((word) => word.text);
      const currentMs = (wordTimedPlayback?.correctedTime.value ?? nowTime.value) * 1000;
      let currentWordIndex = -1;
      for (let index = 0; index < words.length; index++) {
        if (currentMs < words[index].startTime) break;
        const wordEnd = words[index].startTime + Math.max(0, words[index].duration || 0);
        currentWordIndex = currentMs <= wordEnd ? index : index + 1;
      }
      window.AndroidNative!.updateStatusBarLyricState(
        JSON.stringify({
          text,
          words: words.map((word) => ({ ...word, text: `${word.text}${word.space ? ' ' : ''}` })),
          currentWordIndex: config.wordByWord ? currentWordIndex : -1,
          wordByWord: config.wordByWord && words.length > 0,
          themeColor: accentColor,
          paused: !usePlayerStore().isPlay
        })
      );
    } else {
      window.AndroidNative!.updateStatusBarLyric(text, accentColor);
    }
  } catch (e) {
    console.warn('[NativeBridge] 更新状态栏歌词失败:', e);
  }
}

let statusBarLyricBridgeInitialized = false;

function setupStatusBarLyricBridge() {
  if (statusBarLyricBridgeInitialized) return;
  statusBarLyricBridgeInitialized = true;
  wordTimedPlayback = useWordTimedPlayback();
  const playerStore = usePlayerStore();

  watch(
    [
      nowIndex,
      lrcArray,
      () => playMusic?.value?.id,
      () => playerStore.isPlay,
      () => wordTimedPlayback?.displayLineKey.value,
      () => wordTimedPlayback?.stableAnimationKey.value
    ],
    refreshStatusBarLyric,
    { immediate: true }
  );
  window.addEventListener('music-full-config-updated', refreshStatusBarLyric);
  window.addEventListener('focus', refreshStatusBarLyric);
  (window as any).__statusBarLyricPermissionChanged = () => refreshStatusBarLyric();
}

export function previewStatusBarLyric(config = readStatusBarLyricConfig()) {
  if (!isAndroidNative()) return false;
  if (!hasStatusBarLyricPermission()) {
    requestStatusBarLyricPermission();
    return false;
  }
  applyStatusBarLyricConfig({ ...config, enabled: true });
  window.AndroidNative!.updateStatusBarLyricState?.(
    JSON.stringify({
      text: '风吹过城市的夜',
      words: [
        { text: '风吹过', startTime: 0, duration: 900 },
        { text: '城市', startTime: 900, duration: 700 },
        { text: '的夜', startTime: 1600, duration: 900 }
      ],
      currentWordIndex: config.wordByWord ? 1 : -1,
      wordByWord: config.wordByWord,
      themeColor: playMusic?.value?.primaryColor || '#ff6b55',
      paused: false
    })
  );
  window.setTimeout(refreshStatusBarLyric, 5000);
  return true;
}

/**
 * 设置后台保活（音频焦点保持）
 */
export function setBackgroundKeepAlive(enabled: boolean) {
  if (!isAndroidNative()) return;
  try {
    window.AndroidNative!.setBackgroundKeepAlive(Boolean(enabled));
  } catch (e) {
    console.warn('[NativeBridge] 设置后台保活失败:', e);
  }
}

/**
 * 安装应用内下载到缓存目录的 APK（唤起系统安装器）
 */
export function installApkFromCache(fileName: string) {
  if (!isAndroidNative()) return;
  try {
    window.AndroidNative!.installApkFromCache(fileName);
  } catch (e) {
    console.warn('[NativeBridge] 唤起系统安装器失败:', e);
  }
}

export interface ApkDownloadState {
  done: boolean;
  error: boolean;
  message: string;
  bytes: number;
  expected: number;
}

/**
 * 原生线程下载 APK 到缓存目录（大文件不经过 JS 桥接，避免内存溢出闪退）
 */
export function startApkDownload(url: string, expectedSize: number) {
  if (!isAndroidNative()) return;
  try {
    window.AndroidNative!.startApkDownload(url, expectedSize);
  } catch (e) {
    console.warn('[NativeBridge] 启动 APK 下载失败:', e);
  }
}

export function getApkDownloadState(): ApkDownloadState | null {
  if (!isAndroidNative()) return null;
  try {
    return JSON.parse(window.AndroidNative!.getApkDownloadState() || '{}');
  } catch (e) {
    console.warn('[NativeBridge] 读取下载状态失败:', e);
    return null;
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
// 标志：当 UI 主动关闭覆层（如点击关闭按钮）时设置，用于区分 popstate 是由
// UI 主动 history.back() 触发还是由用户返回手势触发。
// 若是 UI 主动触发，popstate 只需递减计数器，不应再关闭其他覆层。
let uiInitiatedClose = false;

/**
 * 压入一个覆层历史条目
 */
function pushOverlayState() {
  overlayCount++;
  history.pushState({ overlay: true }, '');
}

/**
 * 弹出一个覆层历史条目（用于 UI 关闭覆层时清理历史）
 * 设置 uiInitiatedClose 标志，防止 popstate handler 重复关闭其他覆层
 */
function popOverlayState() {
  if (overlayCount > 0 && !isPopStateHandling) {
    overlayCount--;
    uiInitiatedClose = true;
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

      // 如果是 UI 主动关闭（如点击关闭按钮触发的 history.back()），
      // 只需递减计数器，不应再关闭其他覆层
      if (uiInitiatedClose) {
        uiInitiatedClose = false;
        overlayCount--;
        nextTick(() => {
          isPopStateHandling = false;
        });
        return;
      }

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
    bindSafeAreaListeners();

    // 2. 同步状态栏图标外观到当前主题（沉浸式模式，背景透明，仅控制图标明暗）
    updateStatusBarTheme(settingsStore.theme === 'dark');

    // 3. 监听主题变化（仅更新图标外观，背景透明由 CSS 控制）
    watch(
      () => settingsStore.theme,
      (newTheme) => {
        updateStatusBarTheme(newTheme === 'dark');
      }
    );

    // 4. 监听歌曲变化
    watch(
      () => [playMusic?.value?.id, playMusic?.value?.picUrl, playMusic?.value?.playMusicUrl],
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

    // 10. 后台保活：初始化时同步一次，并监听设置变化
    setBackgroundKeepAlive(Boolean(settingsStore.setData?.backgroundKeepAlive));
    watch(
      () => settingsStore.setData?.backgroundKeepAlive,
      (enabled) => {
        setBackgroundKeepAlive(Boolean(enabled));
      }
    );

    // 11. 音频焦点恢复钩子：其他应用抢走焦点后，保活模式下自动恢复播放
    (window as any).__audioFocusResumed = () => {
      import('@/services/audioService')
        .then(({ audioService }) => {
          const currentSound = audioService.getCurrentSound();
          if (currentSound && !currentSound.playing()) {
            currentSound.play();
          }
        })
        .catch((e) => {
          console.warn('[NativeBridge] 音频焦点恢复后播放失败:', e);
        });
    };

    // 12. 状态栏歌词使用 Android 应用悬浮窗，按歌词行变化同步。
    setupStatusBarLyricBridge();

    console.log('[NativeBridge] 原生桥接已初始化');
  } catch (e) {
    console.error('[NativeBridge] 初始化失败:', e);
  }
}
