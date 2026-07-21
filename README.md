<p align="center">
  <img src="splash-expanded.png" alt="Zephyrus Player" width="600" />
</p>

<div align="center">

# Zephyrus Player

**西风播放器** — 沉浸式音乐播放器 · Android 移植版

[![Version](https://img.shields.io/badge/version-0.9.9--update-blue)](https://github.com/cang-dot/zephyrus-player/releases)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Vue](https://img.shields.io/badge/Vue_3.5-42b883?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript_5.9-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron_40-47848f?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Android](https://img.shields.io/badge/Android_Capacitor_8-3ddc84?logo=android&logoColor=white)](https://capacitorjs.com/)
[![Desktop](https://img.shields.io/badge/桌面版-GitHub-44cc11?logo=github)](https://github.com/cang-dot/zephyrus-player)

</div>

---

## 概述

Zephyrus Player 是一款深度集成网易云音乐生态的跨平台音乐播放器，提供桌面端（Electron）和移动端（Capacitor / Android）两种使用形态。项目以沉浸式视觉体验和高度可定制的播放器界面为核心，内置 6 种全屏播放器样式，通过实时高潮检测、鼓点跟踪、封面取色等技术驱动视觉动画与歌词渲染。

> 本项目基于 [AlgerMusicPlayer](https://github.com/algerkong/AlgerMusicPlayer) 深度二次开发。
> 这是 **Android 移植版**仓库，桌面版（Electron）见 [zephyrus-player](https://github.com/cang-dot/zephyrus-player)。

---

## 平台支持

| 平台 | 技术栈 | 特性 |
|------|--------|------|
| **桌面端** | Electron 40 + electron-vite 5 | 完整功能：多窗口、系统托盘、全局快捷键、插件系统、本地音乐文件夹扫描 |
| **移动端** | Capacitor 8（Android WebView） | 核心播放功能：全屏播放器样式、在线搜索与播放、本地音乐导入、进度条高潮标注 |

桌面端与移动端共享同一套 Vue 3 渲染层代码，通过 `isElectron` / `isMobile` / `isAndroidNative` 等条件分支实现平台差异化。

---

## 功能

### 播放器视觉
- **6 种全屏样式** — 默认 / Stage（舞台聚光）/ Magazine（杂志排版）/ Frenzy（狂躁）/ Eerie（诡谲书法）/ Neon（陈旧霓虹）
- **移动端全屏播放器** — 横竖屏自适应，控件 3 秒无操作自动隐藏，全屏滚动歌词
- **实时高潮检测** — Web Audio API 频谱分析，自动识别高潮段落并驱动视觉增强（霓虹闪烁、报纸纹理、Aurora 振幅加倍）
- **进度条高潮段落标注** — 桌面与移动端进度条均以金色片段标记社区标注的高潮时间点
- **鼓点检测** — 实时节拍跟踪，Neon 样式下驱动霓虹呼吸效果
- **动态主题色** — 封面取色自动级联到全局 UI 与状态栏（Android）
- **GSAP 动画** — 逐字弹跳、滑动、缩放、故障等多种歌词动画预设
- **VHS 录像效果** — Eerie 样式前奏阶段模拟雪花噪点、扫描线与色彩偏移

### 音源体系
- **网易云音乐** — 完整 API 集成（歌单/专辑/歌手/播客/MV/电台）
- **跨平台搜索** — 搜索时跨网易云/QQ/酷狗/酷我等平台匹配音源
- **多平台音源解锁** — 咪咕/酷狗/酷我/QQ 音乐智能回退
- **自定义 API** — 接入第三方音乐 API 服务
- **本地音乐** — 桌面端文件夹递归扫描，移动端目录选取与元数据解析（music-metadata）

### 歌词系统
- **逐字歌词** — YRC 格式逐字时间轴，渐变填充进度
- **桌面歌词窗口** — 独立透明窗口，置顶/锁定/拖拽/多显示器支持
- **翻译 & 罗马音** — 歌词翻译显示，时间偏移校正
- **本地歌词绑定** — TTML/LRC 文件手动绑定与内嵌歌词提取

### 音频引擎
- **10 段均衡器** — Web Audio API BiquadFilter
- **变速播放** — 0.5x ~ 2.0x
- **无缝预加载** — 下一曲预加载无缝切换
- **音频输出设备热切换** — 桌面端多设备支持
- **睡眠定时器** / **Media Session**

### 界面 & 交互
- **浮动覆盖布局** — 播放界面作为背景层，侧栏/搜索栏/底栏悬浮其上
- **设计令牌系统** — 统一全应用视觉规范的 CSS 变量
- **深色/浅色主题** — 跟随系统或手动切换
- **迷你播放器** / **系统托盘** / **全局快捷键**（桌面端）
- **5 种语言** — 中文 / English / 日本語 / 한국어 / 繁體中文
- **无限封面网格** — 歌单/专辑自动滚动浏览，手势拖动暂停

### 社区数据
- **高潮段落标注** — 社区贡献的高潮时间点（进度条金色标记）
- **重点词标注** — 歌词关键词高亮（Eerie / Frenzy 样式）
- **社区歌词** — 用户校正的歌词版本
- **IndexedDB 持久化缓存**

---

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Electron 40 |
| 移动端容器 | Capacitor 8 + Android WebView |
| 前端框架 | Vue 3.5 + TypeScript 5.9 |
| 构建工具 | electron-vite 5 + Vite 6.4 |
| UI 组件库 | Naive UI 2.43 |
| CSS | Tailwind CSS 3.4 + SCSS + 设计令牌系统 |
| 状态管理 | Pinia + pinia-plugin-persistedstate |
| 动画 | GSAP 3.15 + WebGL（OGL） |
| 音频 | Howler.js + Web Audio API + 自研 LocalAudioPlayer |
| 元数据 | music-metadata 11 + flac-tagger + node-id3 |
| 音乐 API | netease-cloud-music-api-alger（本地 Express） |
| 音源解锁 | @unblockneteasemusic/server |
| 中文分词 | jieba-wasm |

---

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9
- （Android 构建）Android Studio + JDK 17 + Android SDK

### 桌面端

```bash
# 安装依赖
npm install

# 开发模式（Electron）
npm run dev

# 构建（Windows / macOS / Linux）
npm run build
```

### 移动端（Android）

```bash
# 先构建 Web 资源
npm run build:web

# 同步到 Android 项目
npx cap sync android

# 使用 Android Studio 打开构建
npx cap open android
```

### 代码质量

```bash
npm run lint           # ESLint + Prettier
npm run typecheck      # TypeScript 类型检查
npm run format         # Prettier 格式化
```

---

## 项目结构

```
zephyrus-player-android/
├── android/                        # Capacitor Android 原生壳
│   ├── app/src/main/java/...      # MainActivity, NativeBridge
│   └── app/src/main/res/          # 资源（主题/颜色/布局）
├── src/
│   ├── main/                       # Electron 主进程
│   │   ├── index.ts                # 窗口创建、IPC 路由
│   │   ├── lyric.ts                # 桌面歌词独立窗口
│   │   ├── server.ts               # 本地音乐 API Express 服务
│   │   ├── unblockMusic.ts         # 多平台音源解锁
│   │   └── modules/                # 主进程模块
│   │       ├── localMusicScanner.ts # 本地音乐递归扫描 + 元数据
│   │       ├── window.ts           # 窗口管理
│   │       ├── tray.ts             # 系统托盘
│   │       └── ...
│   ├── preload/                    # Electron 预加载脚本
│   │   └── index.ts                # IPC 桥接（渲染进程安全 API）
│   ├── shared/                     # 主进程/渲染进程共享类型
│   └── renderer/                   # Vue 3 渲染进程
│       ├── components/
│       │   ├── lyric/              # 播放器样式组件
│       │   │   ├── MusicFullWrapper.vue    # 样式路由（桌面/移动/横竖屏）
│       │   │   ├── MusicFullMobile.vue     # 默认样式移动端
│       │   │   ├── EerieMobilePlayer.vue   # 诡谲样式移动端
│       │   │   ├── NeonMobilePlayer.vue    # 陈旧样式移动端
│       │   │   ├── StageMobilePlayer.vue   # 舞台样式移动端
│       │   │   ├── MagazineMobilePlayer.vue
│       │   │   ├── FrenzyMobilePlayer.vue
│       │   │   └── ...（桌面端对应组件）
│       │   ├── player/             # 播放栏组件
│       │   │   ├── PlayBar.vue     # 桌面播放栏（含高潮标注）
│       │   │   ├── MobilePlayBar.vue / MobilePlayerSettings.vue
│       │   │   └── PlayingListDrawer.vue
│       │   └── common/             # 通用组件
│       ├── playerStyles/           # 播放器样式注册系统
│       │   ├── registry.ts         # registerStyle / getStyle API
│       │   └── {default,stage,magazine,frenzy,eerie,neon}/
│       ├── store/modules/
│       │   ├── climax.ts           # 高潮段落状态
│       │   ├── styleEngine.ts      # 样式引擎（实时音频特征聚合）
│       │   ├── playerCore.ts       # 播放核心控制
│       │   ├── localMusic.ts       # 本地音乐 IndexedDB 缓存
│       │   └── ...
│       ├── services/
│       │   ├── audioService.ts     # 音频引擎（Howler + Web Audio EQ）
│       │   ├── climaxDetector.ts   # 实时高潮检测（RMS + 频谱覆盖）
│       │   ├── drumDetector.ts     # 鼓点检测（频谱通量 + BPM 估算）
│       │   └── localAudioPlayer.ts # 本地文件音频播放器
│       ├── hooks/
│       │   ├── MusicHook.ts        # 播放进度/歌词/切歌核心逻辑
│       │   └── useCoverColor.ts    # 封面取色
│       ├── views/
│       │   ├── home/               # 首页（无限网格歌单）
│       │   ├── local-music/        # 本地音乐管理（桌面文件夹 / 移动端目录选取）
│       │   ├── search/             # 跨平台搜索
│       │   └── ...
│       ├── i18n/lang/              # 国际化（zh-CN/en-US/ja-JP/ko-KR/zh-Hant）
│       └── utils/
├── resources/                      # 图标与安装配置
├── capacitor.config.ts             # Capacitor 配置
├── electron-builder.yml            # 桌面打包配置
└── package.json                    # 全平台依赖与脚本
```

---

## 播放器样式

| Key | 中文名 | 主题 | 桌面组件 | 移动端组件 |
|-----|--------|------|---------|-----------|
| `default` | 默认 | 浅色 | `MusicFull.vue` | `MusicFullMobile.vue` |
| `stage` | 舞台 | 深色 | `StagePlayer.vue` | `StageMobilePlayer.vue` |
| `magazine` | 杂志 | 浅色 | `TypographicPlayer.vue` | `MagazineMobilePlayer.vue` |
| `frenzy` | 狂热 | 浅色 | `FrenzyPlayer.vue` | `FrenzyMobilePlayer.vue` |
| `eerie` | 诡谲 | 深色 | `EeriePlayer.vue` | `EerieMobilePlayer.vue` |
| `neon` | 陈旧 | 深色 | `NeonPlayer.vue` | `NeonMobilePlayer.vue` |

移动端横竖屏下均使用各自专属组件，竖屏也支持全屏滚动歌词 + 控件 3 秒自动隐藏。

---

## Android 原生特性

- **沉浸式状态栏 & 导航栏** — edge-to-edge 渲染，`setDecorFitsSystemWindows(false)` 使内容延伸至系统栏下方
- **状态栏动态取色** — 随封面颜色自动变化（`useCoverColor.ts` → `NativeBridge.setStatusBarColor`）
- **安全区域适配** — `NativeBridge.getSafeAreaInsets()` 注入 CSS 变量 `--safe-area-inset-{top,bottom}`
- **媒体通知** — `MediaNotificationManager` 提供系统通知栏播放控件
- **前台服务** — `MusicPlaybackService` 确保后台播放不被系统杀死
- **返回手势拦截** — `OnBackPressedDispatcher` 管理 WebView 历史栈

---

## 字体建议

### 诡谲（Eerie）
草书类字体与书法哑铃型排版最为匹配，推荐：
- 钟齐流江毛草 / 潮字社凌渡鲲鹏简繁-闪

### 狂热（Frenzy）
方黑体垂直拉伸 + 红色强调词，推荐：
- 平方仿毛体草书（字重 900）

可在播放器设置中切换系统已安装的任意字体。

---

## 更新日志

详见 [RELEASE_NOTES.md](RELEASE_NOTES.md)

---

## 许可证

[MIT License](LICENSE)

本项目基于 [AlgerMusicPlayer](https://github.com/algerkong/AlgerMusicPlayer) 修改。

---

## 致谢

- [AlgerMusicPlayer](https://github.com/algerkong/AlgerMusicPlayer) — 原项目
- [GSAP](https://greensock.com/gsap/) — 动画引擎
- [Naive UI](https://www.naiveui.com/) — UI 组件库
- [Howler.js](https://howlerjs.com/) — 音频播放库
- [music-metadata](https://github.com/Borewit/music-metadata) — 音频元数据解析
- [Capacitor](https://capacitorjs.com/) — 跨平台移动端框架
