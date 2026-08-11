export interface MobileSettingSearchDefinition {
  tabId: 'basic' | 'interface' | 'playback' | 'keepAlive' | 'about';
  titleKey?: string;
  descKey?: string;
  title?: string;
  desc?: string;
}

export const MOBILE_SETTING_SEARCH_DEFINITIONS: readonly MobileSettingSearchDefinition[] = [
  {
    tabId: 'basic',
    titleKey: 'settings.basic.themeMode',
    descKey: 'settings.basic.themeModeDesc'
  },
  {
    tabId: 'basic',
    titleKey: 'settings.basic.language',
    descKey: 'settings.basic.languageDesc'
  },
  {
    tabId: 'basic',
    titleKey: 'settings.translationEngine',
    descKey: 'settings.translationEngine'
  },
  {
    tabId: 'basic',
    titleKey: 'settings.basic.tokenManagement',
    descKey: 'settings.basic.tokenManagementDesc'
  },
  {
    tabId: 'basic',
    titleKey: 'settings.basic.animation',
    descKey: 'settings.basic.animationDesc'
  },
  {
    tabId: 'interface',
    titleKey: 'settings.interface.defaultPage',
    descKey: 'settings.interface.defaultPageDesc'
  },
  {
    tabId: 'interface',
    title: '底栏布局',
    desc: '调整移动端底栏与迷你播放栏的布局'
  },
  {
    tabId: 'interface',
    title: '播放器样式',
    desc: '选择全屏播放界面的视觉样式'
  },
  {
    tabId: 'playback',
    titleKey: 'settings.playback.quality',
    descKey: 'settings.playback.qualityDesc'
  },
  {
    tabId: 'playback',
    titleKey: 'settings.playback.autoPlay',
    descKey: 'settings.playback.autoPlayDesc'
  },
  {
    tabId: 'playback',
    titleKey: 'settings.lyricSettings.statusBarLyrics',
    descKey: 'settings.lyricSettings.statusBarLyricsDescription'
  },
  {
    tabId: 'playback',
    title: '智能混音引擎',
    desc: '切歌时自动平滑过渡，避免硬切中断'
  },
  {
    tabId: 'keepAlive',
    titleKey: 'settings.keepAlive.audioFocus',
    descKey: 'settings.keepAlive.audioFocusDesc'
  },
  {
    tabId: 'keepAlive',
    titleKey: 'settings.keepAlive.batteryOptimization',
    descKey: 'settings.keepAlive.batteryOptimizationDesc'
  },
  {
    tabId: 'keepAlive',
    titleKey: 'settings.keepAlive.autoStart',
    descKey: 'settings.keepAlive.autoStartDesc'
  },
  {
    tabId: 'keepAlive',
    titleKey: 'settings.keepAlive.notification',
    descKey: 'settings.keepAlive.notificationDesc'
  },
  {
    tabId: 'keepAlive',
    titleKey: 'settings.keepAlive.displayOverOtherApps',
    descKey: 'settings.keepAlive.displayOverOtherAppsDesc'
  },
  {
    tabId: 'keepAlive',
    titleKey: 'settings.keepAlive.appDetails',
    descKey: 'settings.keepAlive.appDetailsDesc'
  },
  {
    tabId: 'about',
    titleKey: 'settings.about.version',
    descKey: 'settings.about.authorDesc'
  },
  {
    tabId: 'about',
    titleKey: 'settings.about.author',
    descKey: 'settings.about.authorDesc'
  },
  { tabId: 'about', title: '用户协议', desc: '查看用户协议' },
  { tabId: 'about', title: '开源协议', desc: '查看开源协议' },
  { tabId: 'about', title: '应用介绍', desc: '了解 Zephyrus Player' },
  { tabId: 'about', title: '使用文档', desc: '查看完整使用文档' },
  { tabId: 'about', title: '意见反馈', desc: '提交问题或功能建议' }
];
