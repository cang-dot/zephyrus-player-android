<p align="center">
  <img src="splash-expanded.png" alt="Zephyrus Player" width="600" />
</p>

<div align="center">

# Zephyrus Player

**西风播放器** — 沉浸式桌面音乐播放器

[![Version](https://img.shields.io/badge/version-0.9.9--update-blue)](https://github.com/cang-dot/zephyrus-player/releases)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Vue](https://img.shields.io/badge/Vue_3.5-42b883?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript_5.9-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron_40-47848f?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Vite](https://img.shields.io/badge/Vite_6.4-646cff?logo=vite&logoColor=white)](https://vitejs.dev/)

</div>

---

## 概述

Zephyrus Player 是一款基于 Electron + Vue 3 的沉浸式桌面音乐播放器，深度集成网易云音乐生态，支持跨平台音源搜索、多平台音源解锁、本地音乐管理、逐字歌词、实时高潮检测驱动的视觉动画，以及高度可定制的播放器界面。

---

## 功能亮点

### 音源体系
- **网易云音乐** — 完整 API 集成，歌单/专辑/歌手/播客/MV/电台
- **跨平台搜索** — 搜索时跨网易云/QQ/酷狗/酷我等平台匹配音源，搜索结果展示来源徽章
- **多平台解锁** — 咪咕/酷狗/酷我/QQ 音乐，通过 `@unblockneteasemusic/server` 智能回退
- **LX Music 脚本** — 自定义音源脚本，沙箱化执行，支持异步初始化等待
- **自定义 API** — 支持接入第三方音乐 API 服务（GdMusic 等）
- **来源探测** — 即时分类（零请求，基于 fee/privilege）+ 懒探测（策略链），标注真实可用音源
- **本地音乐** — 文件夹扫描、元数据解析（碟号/音轨号/年份）、FLAC/MP3/M4A 等格式支持

### 播放器视觉
- **6 种全屏样式** — 默认 / Stage（舞台聚光）/ Magazine（杂志排版）/ Frenzy（狂躁排版）/ Eerie（诡谲书法）/ Neon（陈旧霓虹）
- **27+ GSAP 动画预设** — 逐字弹跳、滑动、缩放、故障等多种效果
- **实时高潮检测** — Web Audio API 频谱分析，自动标注高潮段落，驱动视觉增强
- **鼓点检测** — 实时节拍跟踪，动画同步
- **动态主题色** — 封面取色自动级联到全局 UI
- **浮动覆盖布局** — 播放界面作为背景层，侧栏/搜索栏/底栏悬浮其上，支持自动收起
- **VHS 录像效果** — 诡谲模式前奏阶段模拟老旧 VHS 录像带的雪花噪点、扫描线、信号干扰与色彩偏移
- **高潮段落编辑器** — 圆角窗口形态，可视化标注与预览高潮段落

### 歌词系统
- **逐字歌词** — YRC 格式逐字时间轴，渐变填充进度
- **桌面歌词窗口** — 独立透明窗口，置顶/锁定/拖拽/多显示器支持
- **3 种显示模式** — 滚动 / 单行 / 双行
- **翻译 & 罗马音** — 歌词翻译显示，时间偏移校正
- **本地歌词绑定** — 支持 TTML/LRC 文件手动绑定
- **内嵌歌词提取** — 从音频文件元数据自动提取歌词

### 音频引擎
- **10 段均衡器** — Web Audio API BiquadFilter，预设保存
- **变速播放** — 0.5x ~ 2.0x 播放速率
- **无缝预加载** — 下一曲音频预加载，无缝切换
- **音频输出设备** — 热切换输出设备
- **睡眠定时器** — 定时停止播放
- **Media Session** — 系统媒体键控制

### 界面 & 交互
- **设计令牌系统** — `--d-` 前缀的桌面端设计令牌（表面/边框/阴影/圆角/字体/动画/z-index/间距），统一全应用视觉规范
- **深色/浅色主题** — 跟随系统或手动切换
- **迷你播放器** — 紧凑模式，快捷操作
- **系统托盘** — 后台运行，托盘控制
- **全局快捷键** — 可自定义快捷键绑定
- **远程控制** — 局域网 HTTP API 远程操控
- **5 种语言** — 中文/英语/日语/韩语/繁体中文
- **无限网格浏览** — 歌单/专辑自动滚动展示，悬停查看详情

### 账号 & 平台
- **平台账号管理** — 集中管理各音乐平台的登录状态与 Cookie
- **网易云登录** — 扫码 / 手机 / 邮箱多方式登录
- **歌单同步** — 创建/收藏歌单自动同步

### 本地音乐管理
- **文件夹扫描** — 递归扫描，元数据缓存（版本化，自动重扫）
- **筛选 & 排序** — 按艺术家/专辑/碟号/音轨号排序
- **艺术家/专辑视图** — 分组展示同作者/同专辑作品
- **歌词提取** — 从 syncText/text 元数据自动转换为 LRC 格式
- **拼音搜索** — 支持中文拼音模糊匹配

### 社区数据
- **高潮段落标注** — 社区贡献的高潮时间点
- **重点词标注** — 歌词关键词高亮
- **社区歌词** — 用户校正的歌词版本
- **IndexedDB 缓存** — 本地持久化，减少网络请求

---

## 字体兼容性

本播放器的样式经实测与以下字体配合较好：

### 诡谲模式（Eerie）

诡谲模式以书法哑铃型排版为核心视觉特征，前奏阶段叠加 VHS 录像效果。默认使用 **楷体（KaiTi）**，经实测与以下字体配合较好：

| 字体 | 系统字体名 | 风格说明 | 下载 |
|------|-----------|---------|------|
| 钟齐流江毛草 | `钟齐流江毛草` | 毛笔草书，笔意连贯飞动，与哑铃型排版相得益彰 | [下载](https://www.jb51.net/fonts/717863.html) |
| 潮字社凌渡鲲鹏简繁-闪 | `潮字社凌渡鲲鹏简繁-闪` | 笔锋凌厉带闪光质感，氛围感极强 | [下载](http://www.reeji.com/font/chaozishelingdukunpengjianfan.html) |

> 也可在设置中选择系统已安装的任意字体。草书类字体与诡谲模式的书法美学最为匹配。

### 狂躁模式（Frenzy）

狂躁模式以黑字垂直拉伸 + 红字强调词为核心视觉特征，配合 CRT 扫描线与故障效果。默认使用 **苹方简体（PingFang SC）**，经实测与以下字体配合较好：

| 字体 | 系统字体名 | 风格说明 | 下载 |
|------|-----------|---------|------|
| 平方仿毛体草书 | `平方仿毛体草书` | 仿毛笔草书，垂直拉伸后飞白斑驳，呈现撕裂般的狂躁感 | [下载](https://font-9f.zhaozi.org/9/f/9f13177b8602fbd2a80aaeb878b6f6d0.htm) |

> 也可在设置中选择系统已安装的任意字体。字重设置为 900（最粗）时拉伸效果最佳。

---

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装 & 运行

```bash
# 安装依赖
npm install

# 开发模式（Electron 桌面）
npm run dev

# 开发模式（Web，需外部 API 服务器）
npm run dev:web

# 构建
npm run build

# 打包安装包
npm run build:win      # Windows (NSIS, x64/ia32/arm64)
npm run build:mac      # macOS (DMG + ZIP, x64/arm64)
npm run build:linux    # Linux (AppImage / DEB / RPM)
```

### 代码质量

```bash
npm run lint           # ESLint + Prettier 自动修复
npm run typecheck      # TypeScript 类型检查
npm run format         # Prettier 格式化
```

---

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Electron 40 |
| 前端框架 | Vue 3.5 + TypeScript 5.9 |
| 构建工具 | electron-vite 5 + Vite 6.4 |
| UI 组件库 | Naive UI 2.43 |
| CSS 框架 | Tailwind CSS 3.4 + SCSS + 设计令牌系统 |
| 状态管理 | Pinia + pinia-plugin-persistedstate |
| 动画引擎 | GSAP 3.15 |
| WebGL | OGL 1.0 |
| 音频播放 | Howler.js + Web Audio API + 自研 LocalAudioPlayer |
| 音频元数据 | music-metadata 11 + flac-tagger + node-id3 |
| 音乐 API | netease-cloud-music-api-alger (本地 Express 服务) |
| 音源解锁 | @unblockneteasemusic/server |
| 跨平台搜索 | multiPlatformSearch (主进程) + crossPlatformSearch (渲染层) |
| 中文分词 | jieba-wasm |

---

## 项目结构

```
src/
├── main/                        # Electron 主进程
│   ├── index.ts                 # 入口
│   ├── lyric.ts                 # 桌面歌词窗口管理
│   ├── server.ts                # 本地音乐 API 服务
│   ├── unblockMusic.ts          # 多平台音源解锁
│   ├── multiPlatformSearch.ts   # 跨平台搜索服务
│   └── modules/                 # 主进程模块
│       ├── window.ts            # 窗口管理
│       ├── window-size.ts       # 窗口大小持久化
│       ├── tray.ts              # 系统托盘
│       ├── localMusicScanner.ts # 本地音乐扫描
│       ├── fileManager.ts       # 文件管理
│       ├── cache.ts             # 磁盘缓存
│       ├── config.ts            # 配置存储
│       ├── pluginManager.ts     # 插件管理
│       └── remoteControl.ts     # 远程控制
├── preload/                     # 预加载脚本
│   └── index.ts                 # IPC 桥接
└── renderer/                    # Vue 3 渲染进程
    ├── App.vue                  # 根组件
    ├── components/              # UI 组件
    │   ├── lyric/               # 播放器样式（默认/Stage/Magazine/Frenzy/Eerie/Neon）
    │   ├── player/              # 播放栏/迷你播放栏
    │   ├── user/                # 用户相关（平台账号管理）
    │   └── common/              # 通用组件
    ├── hooks/                   # 组合式函数
    │   ├── MusicHook.ts         # 音乐播放核心逻辑
    │   ├── useCoverColor.ts     # 封面取色
    │   └── usePlayerHooks.ts    # 播放器事件钩子
    ├── lib/                     # 渲染工具库
    │   ├── vhsEffect.ts         # VHS 录像效果渲染器
    │   ├── noiseCanvas.ts       # 噪点画布工具
    │   ├── crackRenderer.ts     # 裂纹渲染器
    │   └── layoutEngine.ts      # 布局引擎
    ├── playerStyles/            # 播放器样式注册系统
    │   ├── registry.ts          # 样式注册表（getAllStyles 动态获取）
    │   ├── default/             # 默认样式
    │   ├── stage/               # 舞台样式
    │   ├── magazine/            # 杂志样式
    │   ├── frenzy/              # 狂躁样式
    │   ├── eerie/               # 诡谲样式
    │   └── neon/                # 陈旧样式
    ├── services/                # 核心服务
    │   ├── audioService.ts      # 音频引擎
    │   ├── localAudioPlayer.ts  # 本地音乐播放器
    │   ├── climaxDetector.ts    # 高潮检测
    │   ├── drumDetector.ts      # 鼓点检测
    │   ├── sourceProbeService.ts # 歌曲来源探测服务
    │   └── playbackRequestManager.ts
    ├── api/                     # API 接口
    │   ├── musicParser.ts       # 音源解析策略链
    │   ├── crossPlatformSearch.ts # 跨平台搜索 API
    │   └── gdmusic.ts           # 自定义音乐 API
    ├── store/                   # Pinia 状态管理
    │   └── modules/             # player/playerCore/settings/localMusic/...
    ├── views/                   # 页面视图
    │   ├── home/                # 首页
    │   ├── lyric/               # 桌面歌词窗口
    │   ├── local-music/         # 本地音乐
    │   ├── search/              # 搜索（含来源筛选）
    │   ├── set/                 # 设置
    │   └── ...
    ├── utils/                   # 工具函数
    ├── features/                # 功能模块（AI/插件系统）
    └── layout/                  # 布局组件
        ├── AppLayout.vue        # 主布局
        ├── MiniLayout.vue       # 迷你模式
        └── OverlayLayout.vue    # 浮动覆盖模式
```

---

## 下载

从 [GitHub Releases](https://github.com/cang-dot/zephyrus-player/releases) 下载最新版本。

---

## 更新日志

详见 [RELEASE_NOTES.md](RELEASE_NOTES.md)

---

## 开发者文档

详见 [DEV.md](DEV.md)

---

## 许可证

[MIT License](LICENSE)

基于 [AlgerMusicPlayer](https://github.com/algerkong/AlgerMusicPlayer) 修改

---

## 致谢

- [AlgerMusicPlayer](https://github.com/algerkong/AlgerMusicPlayer) — 原项目
- [GSAP](https://greensock.com/gsap/) — 动画引擎
- [Naive UI](https://www.naiveui.com/) — UI 组件库
- [OGL](https://github.com/oframe/ogl) — WebGL 渲染库
- [Howler.js](https://howlerjs.com/) — 音频播放库
- [music-metadata](https://github.com/Borewit/music-metadata) — 音频元数据解析
