import { defineConfig } from 'vitepress';

export default defineConfig({
  lang: 'zh-CN',
  title: 'Zephyrus Player',
  description: '西风播放器 · 使用文档',
  base: '/zephyrus/docs/',
  lastUpdated: true,
  cleanUrls: true,
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/zephyrus/docs/icon.png' }]
  ],
  themeConfig: {
    logo: '/icon.png',
    nav: [
      { text: '安装', link: '/guide/installation' },
      { text: '使用', link: '/guide/getting-started' },
      { text: '样式', link: '/styles/overview' },
      { text: 'Cookie', link: '/cookie/netease' },
      { text: '功能', link: '/features/cross-platform-search' },
      { text: 'GitHub', link: 'https://github.com/cang-dot/zephyrus-player-android' }
    ],
    sidebar: [
      {
        text: '开始',
        items: [
          { text: '安装', link: '/guide/installation' },
          { text: '基本使用', link: '/guide/getting-started' },
          { text: '常见问题', link: '/guide/faq' }
        ]
      },
      {
        text: '播放器样式',
        items: [
          { text: '总览', link: '/styles/overview' },
          { text: '默认', link: '/styles/default' },
          { text: '舞台', link: '/styles/stage' },
          { text: '诡谲', link: '/styles/eerie' },
          { text: '陈旧', link: '/styles/neon' },
          { text: '狂热', link: '/styles/frenzy' },
          { text: '杂志', link: '/styles/magazine' },
          { text: '雨夜', link: '/styles/rain' }
        ]
      },
      {
        text: 'Cookie 获取',
        items: [
          { text: '网易云', link: '/cookie/netease' },
          { text: 'QQ音乐', link: '/cookie/qq' },
          { text: '咪咕', link: '/cookie/migu' },
          { text: '酷狗', link: '/cookie/kugou' },
          { text: '酷我', link: '/cookie/kuwo' }
        ]
      },
      {
        text: '功能教程',
        items: [
          { text: '跨平台搜索', link: '/features/cross-platform-search' },
          { text: '滚动歌词', link: '/features/scrolling-lyrics' },
          { text: '自定义效果', link: '/features/custom-effects' },
          { text: '字体导入', link: '/features/font-import' },
          { text: '高潮检测', link: '/features/climax-detection' },
          { text: 'AI 歌词分析', link: '/features/ai-lyric-analysis' },
          { text: '本地音乐', link: '/features/local-music' },
          { text: '定时关闭', link: '/features/sleep-timer' }
        ]
      },
      {
        text: '设置说明',
        items: [
          { text: '界面设置', link: '/settings/interface' },
          { text: '播放设置', link: '/settings/playback' },
          { text: '关于', link: '/settings/about' }
        ]
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/cang-dot/zephyrus-player-android' }
    ],
    footer: {
      message: '基于 MIT 协议开源',
      copyright: '© 2026 Zephyrus Player'
    },
    outline: { label: '本页目录' },
    lastUpdatedText: '最后更新',
    docFooter: { prev: '上一页', next: '下一页' }
  }
});
