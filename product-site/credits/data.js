/** 致谢数据：33 个被引用/借鉴的项目。改这里即可增删条目。
 *  color: 卡片品牌底色；logo: GitHub 组织头像（可空 → 字母标）；
 *  license/licenseType: 徽标；tagline: 一句话用途；desc: 详情页完整说明。
 */
window.CREDITS = [
  // ─── ① 项目之根 ───────────────────────────────
  {
    id: 'algermusicplayer', name: 'AlgerMusicPlayer', author: 'algerkong',
    license: 'MIT', licenseType: 'mit', color: '#6C5CE7',
    logo: './logos/algerkong.png',
    tagline: '本项目的二次开发母体',
    desc: 'Zephyrus Player 基于 AlgerMusicPlayer 深度二次开发：播放器架构、歌曲行组件体系、免责声明与整体产品形态都由它演化而来。应用内「关于」页保留了原作者署名。',
    url: 'https://github.com/algerkong/AlgerMusicPlayer'
  },
  {
    id: 'ncm-api-alger', name: 'netease-cloud-music-api-alger', author: 'algerkong',
    license: 'MIT', licenseType: 'mit', color: '#C20C0C',
    logo: './logos/algerkong.png',
    tagline: '本地网易云 API 网关',
    desc: '桌面端内置的网易云 API 服务（端口 30488）：登录、歌单、账号、播放链接全部经由它。QWeb 页的 anonymous_token 兼容处理也是为它而做。',
    url: 'https://github.com/algerkong/netease-cloud-music-api-alger'
  },
  {
    id: 'amll', name: 'Apple Music-like Lyrics', author: 'amll-dev',
    license: 'AGPL-3.0-only', licenseType: 'agpl', color: '#7C66F9',
    logo: './logos/amll-dev.png',
    tagline: '滚动歌词核心与网格渐变渲染器',
    desc: 'AMLL 的 Vue 组件承担了全部滚动歌词渲染（逐字时间轴、翻译、罗马音行），MeshGradientRenderer 驱动默认样式的「网格」渐变背景。本项目与 AMLL 同以 AGPL-3.0 发布。',
    url: 'https://github.com/amll-dev/applemusic-like-lyrics'
  },
  {
    id: 'amll-player', name: 'amll-player', author: 'JoyElliot',
    license: 'AGPL-3.0（作者授权使用第一方代码）', licenseType: 'agpl', color: '#4C6EF5',
    logo: './logos/JoyElliot.png',
    tagline: '网格背景的音频响应驱动骨架',
    desc: '默认样式「网格」背景的低频驱动骨架（冲击/稳态双分支 + 包络缓动）移植自 JoyElliot 的 amll-player 分支，经作者授权使用其第一方代码；输入与量纲已按本项目音频管线重做。',
    url: 'https://github.com/JoyElliot/amll-player'
  },
  {
    id: 'amll-ttml-db', name: 'AMLL TTML DataBase', author: 'amll-dev 与社区',
    license: '待确认', licenseType: 'service', color: '#5C7CFA',
    logo: './logos/amll-dev.png',
    tagline: 'TTML 逐字歌词数据库',
    desc: '逐字歌词的主要在线来源：直连 GitHub 原始库、jsDelivr CDN 与社区镜像三路回退，另支持自建镜像地址。',
    url: 'https://github.com/amll-dev/amll-ttml-db'
  },

  // ─── ② 音源与解析 ───────────────────────────────
  {
    id: 'unm', name: 'UnblockNeteaseMusic Server', author: 'UNM 维护者',
    license: 'LGPL-3.0-only', licenseType: 'lgpl', color: '#E74C3C',
    logo: './logos/unblockneteasemusic.png',
    tagline: '音源解锁引擎',
    desc: '桌面端「音乐解析」的引擎内核：当音源不可播时按平台（migu/kugou/kuwo/pyncmd/qq/joox）匹配替代音源，经 IPC 供主进程调用。',
    url: 'https://github.com/UnblockNeteaseMusic/server'
  },
  {
    id: 'lx-source', name: '落雪音乐 自定义音源协议', author: 'toside（lyswhut 生态）',
    license: '协议参考实现', licenseType: 'mit', color: '#F59E0B',
    logo: './logos/lyswhut.png',
    tagline: '音源脚本沙箱运行时',
    desc: '实现了落雪音乐的桌面自定义源协议：Worker 隔离沙箱内模拟 globalThis.lx（crypto / HTTP 代理 / 请求钩子），用户脚本即可作为一处音源接入。',
    url: 'https://lxmusic.toside.cn/desktop/custom-source'
  },
  {
    id: 'gdmusic', name: 'GD 音乐台', author: 'gdstudio',
    license: '公共服务', licenseType: 'service', color: '#10B981',
    logo: './logos/music.gdstudio.xyz-favicon.ico',
    tagline: '解析 / 跨平台搜索 / 歌词兜底',
    desc: '设置页「兜底解析」所依赖的公共解析服务，同时提供 joox/kuwo/netease 等平台的跨平台搜索与歌词回退。感谢 GD 音乐台的开放接口。',
    url: 'https://music.gdstudio.xyz/'
  },
  {
    id: 'qrc-decoder', name: 'qrc-decoder', author: 'npm 社区',
    license: 'MIT', licenseType: 'mit', color: '#6366F1',
    logo: '',
    tagline: 'QQ 音乐 QRC 歌词解密',
    desc: '网关在轮询 QQ 扫码登录与歌词接口时，用它在本地解密 QRC 加密歌词字段（TEA 算法）。',
    url: 'https://www.npmjs.com/package/qrc-decoder'
  },
  {
    id: 'platform-qr', name: '平台扫码接入（QQ / 微信 / 酷狗）', author: '自研逆向',
    license: '—', licenseType: 'self', color: '#334155',
    logo: '',
    tagline: '官方扫码端点的逆向接入',
    desc: '多平台扫码登录为自行逆向：QQ ptlogin2 二维码轮询与 hash33 校验、酷狗二维码签名与 KRC XOR 解压解密、微信扫码与 musicu.fcg 网关均由本项目网关直接对接，无第三方上游。',
    url: ''
  },
  {
    id: 'lrclib', name: 'LRCLIB', author: 'lrclib.net 社区',
    license: '公共服务', licenseType: 'service', color: '#F59E0B',
    logo: './logos/lrclib.net-favicon.ico',
    tagline: '逐行歌词公共数据库',
    desc: '当主流歌词源都拿不到数据时，LRCLIB 是最后一道兜底：按歌曲名与时长匹配逐行歌词。',
    url: 'https://lrclib.net/'
  },
  {
    id: 'makemeahanzi', name: 'Make Me a Hanzi', author: 'skishore',
    license: '数据许可（Arphic 系）', licenseType: 'data', color: '#DC2626',
    logo: './logos/skishore.png',
    tagline: '汉字笔画与笔顺数据',
    desc: '歌词页的汉字笔顺动画数据来自 Make Me a Hanzi（其数据衍生自 Arphic 公开字体）。',
    url: 'https://github.com/skishore/makemeahanzi'
  },

  // ─── ③ 视觉移植 ───────────────────────────────
  {
    id: 'vue-bits', name: 'vue-bits', author: 'DavidHDev',
    license: 'MIT', licenseType: 'mit', color: '#38BDF8',
    logo: './logos/DavidHDev.png',
    tagline: 'MoltenMetal / Dither / LiquidEther 背景',
    desc: '主页漫游卡的熔融金属流体、云卡的黑白抖动、错误皮肤的流体背景均移植自 vue-bits 的同名组件；本致谢站的 Drift Wall 结构同样取自它。',
    url: 'https://vue-bits.dev/'
  },
  {
    id: 'webgl-fluid', name: 'WebGL-Fluid-Simulation', author: 'PavelDoGreat',
    license: 'MIT', licenseType: 'mit', color: '#3B82F6',
    logo: './logos/PavelDoGreat.png',
    tagline: 'Smoke 皮肤的流体模拟',
    desc: '「烟雾」皮肤的流体平流思路参考 PavelDoGreat 的经典 WebGL 流体模拟（完整 MIT 许可文本已随源码附于 SMOKE-THIRD-PARTY-LICENSE.md）。',
    url: 'https://github.com/PavelDoGreat/WebGL-Fluid-Simulation'
  },
  {
    id: 'gsap', name: 'GSAP', author: 'GreenSock',
    license: 'Standard "no charge" License', licenseType: 'gsap', color: '#0AE448',
    logo: './logos/greensock.png',
    tagline: '播放器动画引擎',
    desc: '封面过渡、舞台/狂躁等皮肤的编排动画均由 GSAP 时间轴驱动。',
    url: 'https://gsap.com/'
  },

  // ─── ④ 数据与公共服务 ───────────────────────────
  {
    id: 'spotify', name: 'Spotify Web API', author: 'Spotify',
    license: 'Spotify 开发者条款', licenseType: 'service', color: '#1DB954',
    logo: '',
    tagline: '账号授权与跨平台搜索',
    desc: 'Spotify 账号经 PKCE 授权后接入搜索与外链播放，凭据经自建网关中转。',
    url: 'https://developer.spotify.com/documentation/web-api'
  },
  {
    id: 'netease-api', name: '网易云音乐公开接口', author: '网易云音乐',
    license: '公开接口', licenseType: 'service', color: '#C20C0C',
    logo: './logos/p1.music.126.net-favicon.ico',
    tagline: '公开专辑 / 搜索数据',
    desc: '专辑详情、公开搜索等只读接口直接与网易云公开端点对接（致谢站示例专辑即来自它）。',
    url: 'https://music.163.com/'
  },
  {
    id: 'community-lyric', name: '社区歌词服务', author: '自建',
    license: '自研服务', licenseType: 'self', color: '#8B5CF6',
    logo: '',
    tagline: '社区歌词共享',
    desc: '用户共建的歌词上传与共享服务，覆盖官方源缺失的曲目。',
    url: ''
  },

  // ─── ⑤ 地基 ───────────────────────────────
  {
    id: 'vue', name: 'Vue 3 生态', author: 'Evan You 与社区',
    license: 'MIT', licenseType: 'mit', color: '#42B883',
    logo: './logos/vuejs.png',
    tagline: 'Vue / Pinia / Vue Router / Vue I18n / VueUse',
    desc: '整个渲染层的框架基座：组合式 API、状态管理、路由、国际化与常用组合式工具。',
    url: 'https://vuejs.org/'
  },
  {
    id: 'vite', name: 'Vite', author: 'Evan You 与社区',
    license: 'MIT', licenseType: 'mit', color: '#646CFF',
    logo: './logos/vitejs.png',
    tagline: '构建工具',
    desc: '渲染层与文档站的构建、HMR 与产物优化都由 Vite 驱动。',
    url: 'https://vitejs.dev/'
  },
  {
    id: 'electron', name: 'Electron', author: 'OpenJS Foundation',
    license: 'MIT', licenseType: 'mit', color: '#47848F',
    logo: './logos/electron.png',
    tagline: '桌面端壳',
    desc: '桌面端的主进程：本地 API 服务、托盘、桌面歌词、文件扫描与自动更新。',
    url: 'https://www.electronjs.org/'
  },
  {
    id: 'capacitor', name: 'Capacitor', author: 'Ionic',
    license: 'MIT', licenseType: 'mit', color: '#119EFF',
    logo: './logos/ionic-team.png',
    tagline: 'Android 原生壳',
    desc: '安卓壳与原生音频分析通道：鼓点/频谱由原生引擎分析后推送回渲染层。',
    url: 'https://capacitorjs.com/'
  },
  {
    id: 'howler', name: 'Howler.js', author: 'goldfire',
    license: 'MIT', licenseType: 'mit', color: '#EAB308',
    logo: './logos/goldfire.png',
    tagline: '音频播放内核',
    desc: '流媒体与本地音频的播放内核：音量、倍速、seek 与加载状态都经由 Howler 管理。',
    url: 'https://howlerjs.com/'
  },
  {
    id: 'naive-ui', name: 'Naive UI', author: 'TuSimple',
    license: 'MIT', licenseType: 'mit', color: '#18A058',
    logo: './logos/tusimple.png',
    tagline: 'UI 组件库',
    desc: '设置面板、弹窗、消息与各类表单控件的基础组件库。',
    url: 'https://www.naiveui.com/'
  },
  {
    id: 'tailwind', name: 'Tailwind CSS', author: 'Tailwind Labs',
    license: 'MIT', licenseType: 'mit', color: '#38BDF8',
    logo: './logos/tailwindlabs.png',
    tagline: '原子化样式框架',
    desc: '界面布局与视觉系统的样式基座。',
    url: 'https://tailwindcss.com/'
  },
  {
    id: 'remixicon', name: 'Remix Icon', author: 'Remix Design',
    license: 'Apache-2.0', licenseType: 'apache', color: '#5A67D8',
    logo: './logos/Remix-Design.png',
    tagline: '图标字体',
    desc: '全站 ri-* 图标字体。',
    url: 'https://remixicon.com/'
  },
  {
    id: 'animate-css', name: 'animate.css', author: 'Daniel Eden 与社区',
    license: 'MIT', licenseType: 'mit', color: '#9B59B6',
    logo: './logos/animate-css.png',
    tagline: 'CSS 动画库',
    desc: '入场/切换等通用 CSS 动画。',
    url: 'https://animate.style/'
  },
  {
    id: 'ogl', name: 'ogl', author: 'gordonnl',
    license: 'Unlicense', licenseType: 'unlicense', color: '#94A3B8',
    logo: './logos/gordonnl.png',
    tagline: '极简 WebGL 框架',
    desc: '极光、流体、烟雾、抖动等所有 WebGL 背景的渲染框架。',
    url: 'https://github.com/oframe/ogl'
  },
  {
    id: 'three', name: 'three.js', author: 'mrdoob 与社区',
    license: 'MIT', licenseType: 'mit', color: '#DCDCDC',
    logo: './logos/mrdoob.png',
    tagline: '本致谢站的 3D 过渡',
    desc: '点击卡片时的 3D 展开过渡由 three.js 渲染。',
    url: 'https://threejs.org/'
  },
  {
    id: 'mediabunny', name: 'mediabunny', author: 'vanilagy',
    license: 'MPL-2.0', licenseType: 'mpl', color: '#F97316',
    logo: './logos/vanilagy.png',
    tagline: '视频导出的编码与封装',
    desc: '「视频分享」功能的 WebCodecs 编码与 MP4/WebM 封装。',
    url: 'https://mediabunny.dev/'
  },
  {
    id: 'metadata-suite', name: '音频元数据套件', author: 'Borewit / arelliot / sindresorhus 等',
    license: 'MIT 等', licenseType: 'mit', color: '#8B5CF6',
    logo: './logos/Borewit.png',
    tagline: 'music-metadata / flac-tagger / node-id3 / file-type',
    desc: '本地音乐扫描的元数据解析、FLAC/MP3 标签写回与文件类型嗅探。',
    url: 'https://github.com/Borewit/music-metadata'
  },
  {
    id: 'nlp-suite', name: '中文处理套件', author: 'jieba / BYVoid / mollnn 等',
    license: 'MIT 等', licenseType: 'mit', color: '#10B981',
    logo: '',
    tagline: 'jieba-wasm 分词 / opencc-rust 繁简 / pinyin-match 拼音',
    desc: '逐字歌词断句、歌词繁简转换引擎与拼音首字母搜索。',
    url: ''
  },
  {
    id: 'web-basics', name: '网络与工具链', author: 'axios / express / marked / DOMPurify / crypto-js / jsencrypt / qrcode / tunajs 等',
    license: 'MIT 等', licenseType: 'mit', color: '#334155',
    logo: '',
    tagline: 'axios / express / cors / marked / DOMPurify / crypto-js / jsencrypt / qrcode / tunajs / electron-store / electron-updater',
    desc: '网关服务、请求、渲染与加密等基础能力，以及 EQ 音效与配置持久化。',
    url: ''
  }
];