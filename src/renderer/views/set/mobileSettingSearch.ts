export interface MobileSettingSearchDefinition {
  tabId:
    | 'appearance'
    | 'playback'
    | 'lyrics'
    | 'ai'
    | 'advanced'
    | 'about';
  titleKey?: string;
  descKey?: string;
  title?: string;
  desc?: string;
  targetTitle?: string;
  targetId?: string;
}

export const MOBILE_SETTING_SEARCH_DEFINITIONS: readonly MobileSettingSearchDefinition[] = [
  {
    tabId: 'appearance',
    titleKey: 'settings.basic.themeMode',
    descKey: 'settings.basic.themeModeDesc'
  },
  {
    tabId: 'appearance',
    titleKey: 'settings.basic.language',
    descKey: 'settings.basic.languageDesc'
  },
  {
    tabId: 'appearance',
    titleKey: 'settings.interface.defaultPage',
    descKey: 'settings.interface.defaultPageDesc'
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
    title: '智能过渡',
    desc: '在歌曲尾部衔接下一首，减少切歌停顿'
  },
  {
    tabId: 'playback',
    titleKey: 'settings.keepAlive.audioFocus',
    descKey: 'settings.keepAlive.audioFocusDesc'
  },
  {
    tabId: 'playback',
    titleKey: 'settings.keepAlive.batteryOptimization',
    descKey: 'settings.keepAlive.batteryOptimizationDesc'
  },
  {
    tabId: 'playback',
    titleKey: 'settings.keepAlive.autoStart',
    descKey: 'settings.keepAlive.autoStartDesc'
  },
  {
    tabId: 'playback',
    titleKey: 'settings.keepAlive.notification',
    descKey: 'settings.keepAlive.notificationDesc'
  },
  {
    tabId: 'playback',
    titleKey: 'settings.keepAlive.displayOverOtherApps',
    descKey: 'settings.keepAlive.displayOverOtherAppsDesc'
  },
  {
    tabId: 'lyrics',
    titleKey: 'settings.lyricSettings.statusBarLyrics',
    descKey: 'settings.lyricSettings.statusBarLyricsDescription'
  },
  {
    tabId: 'lyrics',
    title: '逐字显示',
    desc: '逐字或整句显示状态栏歌词',
    targetId: 'status-bar-lyrics'
  },
  {
    tabId: 'lyrics',
    title: '状态栏歌词位置',
    desc: '分别调整横屏与竖屏悬浮位置',
    targetId: 'status-bar-lyrics'
  },
  {
    tabId: 'lyrics',
    title: '状态栏歌词字体',
    desc: '选择内置字体或导入 TTF/OTF',
    targetId: 'status-bar-lyrics'
  },
  {
    tabId: 'lyrics',
    title: '状态栏歌词字号和字重',
    desc: '调整悬浮歌词大小与粗细',
    targetId: 'status-bar-lyrics'
  },
  {
    tabId: 'lyrics',
    title: '状态栏歌词配色',
    desc: '设置已唱、当前、未唱和表面颜色',
    targetId: 'status-bar-lyrics'
  },
  {
    tabId: 'ai',
    title: '歌词隐喻分析',
    desc: '配置你自己的 AI 服务密钥,解读歌词隐喻'
  },
  {
    tabId: 'ai',
    title: 'AI 服务商',
    desc: '配置 API 密钥与模型'
  },
  {
    tabId: 'advanced',
    titleKey: 'settings.translationEngine',
    descKey: 'settings.translationEngine'
  },
  {
    tabId: 'advanced',
    titleKey: 'settings.basic.tokenManagement',
    descKey: 'settings.basic.tokenManagementDesc'
  },
  {
    tabId: 'advanced',
    titleKey: 'settings.basic.animation',
    descKey: 'settings.basic.animationDesc'
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
  {
    tabId: 'about',
    titleKey: 'settings.about.website',
    descKey: 'settings.about.websiteDesc'
  },
  { tabId: 'about', title: '用户协议', desc: '查看用户协议' },
  { tabId: 'about', title: '开源协议', desc: '查看开源协议' },
  { tabId: 'about', title: '应用介绍', desc: '了解 Zephyrus Player' },
  { tabId: 'about', title: '使用文档', desc: '查看完整使用文档' },
  { tabId: 'about', title: '意见反馈', desc: '提交问题或功能建议' }
];
