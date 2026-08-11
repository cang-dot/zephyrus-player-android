import { defineConfig } from 'vitepress';

export default defineConfig({
  lang: 'zh-CN',
  title: 'Zephyrus Docs',
  titleTemplate: ':title · Zephyrus Player',
  description: 'Zephyrus Player Android 安装、逐字歌词、播放器样式、账号与故障排查文档',
  base: '/zephyrus/docs/',
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ['meta', { name: 'theme-color', content: '#090b09' }],
    ['meta', { name: 'color-scheme', content: 'light dark' }],
    ['link', { rel: 'icon', type: 'image/png', href: '/zephyrus/docs/zephyrus-icon.png' }],
    ['meta', { property: 'og:site_name', content: 'Zephyrus Player Android 文档' }],
    ['meta', { property: 'og:type', content: 'website' }]
  ],
  themeConfig: {
    logo: '/zephyrus-mark.png',
    siteTitle: 'Zephyrus Docs',
    nav: [
      { text: '安装', link: '/guide/installation' },
      { text: '歌词系统', link: '/features/lyric-sources' },
      { text: '播放器样式', link: '/styles/overview' },
      { text: '排查问题', link: '/guide/faq' },
      {
        text: '项目',
        items: [
          { text: '官方网站', link: 'https://mucang.xyz/zephyrus/' },
          {
            text: '下载 Android APK',
            link: 'https://mucang.xyz/zephyrus/apks/zephyrus-player-latest.apk'
          },
          { text: 'GitHub 仓库', link: 'https://github.com/cang-dot/zephyrus-player-android' }
        ]
      }
    ],
    sidebar: [
      {
        text: '开始',
        items: [
          { text: '安装与更新', link: '/guide/installation' },
          { text: '第一次使用', link: '/guide/getting-started' },
          { text: '常见问题', link: '/guide/faq' }
        ]
      },
      {
        text: '歌词与播放',
        items: [
          { text: '歌词源与优先级', link: '/features/lyric-sources' },
          { text: '滚动歌词', link: '/features/scrolling-lyrics' },
          { text: '状态栏歌词', link: '/features/status-bar-lyrics' },
          { text: '高潮与逐字效果', link: '/features/climax-detection' },
          { text: '自定义效果', link: '/features/custom-effects' },
          { text: '字体与字重', link: '/features/font-import' },
          { text: '歌词海报', link: '/features/posters' }
        ]
      },
      {
        text: '播放器样式',
        collapsed: false,
        items: [
          { text: '样式总览', link: '/styles/overview' },
          { text: '默认', link: '/styles/default' },
          { text: '舞台', link: '/styles/stage' },
          { text: '诡谲', link: '/styles/eerie' },
          { text: '狂热', link: '/styles/frenzy' },
          { text: '陈旧', link: '/styles/neon' },
          { text: '杂志', link: '/styles/magazine' },
          { text: '雨夜', link: '/styles/rain' },
          { text: '星盘', link: '/styles/star-chart' },
          { text: '烟雾', link: '/styles/smoke' }
        ]
      },
      {
        text: '音乐与账号',
        items: [
          { text: '跨平台搜索', link: '/features/cross-platform-search' },
          { text: '本地音乐', link: '/features/local-music' },
          { text: '网易云账号', link: '/cookie/netease' },
          { text: 'QQ 音乐账号', link: '/cookie/qq' },
          { text: '酷狗账号', link: '/cookie/kugou' }
        ]
      },
      {
        text: '设置',
        items: [
          { text: '界面与手势', link: '/settings/interface' },
          { text: '播放与歌词', link: '/settings/playback' },
          { text: '关于与数据', link: '/settings/about' }
        ]
      }
    ],
    search: { provider: 'local' },
    socialLinks: [{ icon: 'github', link: 'https://github.com/cang-dot/zephyrus-player-android' }],
    editLink: {
      pattern: 'https://github.com/cang-dot/zephyrus-player-android/edit/main/website/:path',
      text: '在 GitHub 上改进此页'
    },
    outline: { label: '本页内容', level: [2, 3] },
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '文档目录',
    darkModeSwitchLabel: '外观',
    lastUpdatedText: '最后更新',
    docFooter: { prev: '上一页', next: '下一页' },
    footer: {
      message: '只维护 Android 手机体验',
      copyright: 'Copyright © 2026 cang-dot'
    }
  }
});
