<p align="center">
  <img src="src/renderer/assets/icon.png" alt="Zephyrus Player" width="120" style="border-radius: 24px;" />
</p>

<div align="center">

# Zephyrus Player

**西风播放器** — 沉浸式音乐播放器 · Android

[![Version](https://img.shields.io/badge/version-v1.1.0-blue)](https://github.com/cang-dot/zephyrus-player-android/releases)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Vue](https://img.shields.io/badge/Vue_3.5-42b883?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript_5.9-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Android](https://img.shields.io/badge/Capacitor_8-3ddc84?logo=android&logoColor=white)](https://capacitorjs.com/)
[![Docs](https://img.shields.io/badge/文档-mucang.xyz-8b5cf6)](https://www.mucang.xyz/zephyrus/docs)

</div>

---

## 概述

Zephyrus Player 是一款以**视觉体验为核心**的 Android 音乐播放器。深度集成网易云音乐生态，同时支持跨平台搜索（QQ / 咪咕 / 酷狗 / 酷我），自动去重合并。内置 **7 种全屏播放器样式**，通过实时高潮检测、鼓点跟踪、封面取色等技术驱动视觉动画与歌词渲染，让每一首歌都有独特的视觉表达。

> 本项目基于 [AlgerMusicPlayer](https://github.com/algerkong/AlgerMusicPlayer) 深度二次开发。
> 桌面版（Electron）见 [zephyrus-player](https://github.com/cang-dot/zephyrus-player)。
> 📖 **使用文档**：[mucang.xyz/zephyrus/docs](https://www.mucang.xyz/zephyrus/docs)

---

## 核心特性

### 模块化首页

Apple Music 风格的可定制首页，所有组件可自由拖拽排列：

- **卡片轮播区**：顶部全屏宽度卡片，横向滑动浏览每日推荐、私人 FM 等
- **4 列功能网格**：下方组件网格，支持 1-4 宽 × 1-2 高的任意大小
- **拖拽排列**：长按组件进入编辑模式，可跨区域拖拽（网格 ↔ 卡片）
- **FLIP 弹簧动画**：组件位置变化时使用 Apple 风格弹簧曲线平滑过渡
- **动态取色**：所有颜色基于当前播放歌曲封面提取，UI 随音乐变色

### 7 种播放器样式

| 样式 | 说明 |
|------|------|
| **默认** | 封面取色背景 + 逐字歌词 + 渐变遮罩 |
| **舞台 Stage** | 深色背景 + 居中大字歌词 + 高潮鼓点闪白 |
| **诡谲 Eerie** | 噪点底 + 书法字歌词 + 高潮关键词闪现 + VHS 录像效果 |
| **陈旧 Neon** | 混凝土底 + 霓虹描边字 + 脉冲光晕 |
| **狂热 Frenzy** | 极简色块 + 巨字歌词分屏 |
| **杂志 Magazine** | 色块拼贴 + 期刊式歌词 |
| **雨夜 Rain** | 3D 封面 + Canvas 雨水效果 + 歌词叠加 + 底部反射 |

### 跨平台搜索

搜索时自动搜索网易云、QQ、咪咕、酷狗、酷我等平台，结果去重合并。每首歌标注来源，支持按来源筛选。

### 深度链接分享

- 支持 `zephyrus://song/{id}` 深度链接协议，点击链接直接拉起 App
- 分享中转页（relay），海报式布局展示歌曲信息，支持 30 秒试听
- App 内弹出毛玻璃歌曲卡片，点击播放按钮直接播放
- 从后台切回前台时自动检测剪贴板，智能识别分享链接

### 本地音乐

- 支持扫描本地音频文件（FLAC / MP3 / OGG / WAV / M4A）
- 自动解析元数据（封面、歌词、专辑信息）
- 使用 `MediaMetadataRetriever` 原生提取嵌入歌词
- IndexedDB 缓存扫描结果，增量更新

### 其他功能

- 网易云音乐登录（扫码 + 手机号）
- 歌单 / 专辑 / 排行榜 / 播客
- 滚动歌词（点击跳转 + 拖动时间指示器）
- 歌词翻译（多引擎）+ AI 歌词隐喻分析
- 高潮段落检测 + 鼓点跟踪
- 封面取色动态主题
- 自定义效果参数（字体导入、动画速度、光晕半径等）
- 定时关闭
- 平台 Cookie 管理
- 海报式分享

---

## 技术栈

| 层 | 技术 |
|----|------|
| 框架 | Vue 3.5 + TypeScript 5.9 |
| 构建 | Electron-Vite 6 |
| 原生壳 | Capacitor 8 (Android) |
| 状态管理 | Pinia |
| 音频引擎 | Howler.js + Web Audio API |
| 动画 | GSAP + CSS Animations |
| 样式 | Tailwind CSS + SCSS |
| i18n | vue-i18n（5 种语言：简中 / 繁中 / 英 / 日 / 韩） |

---

## 下载

直接点击 [下载最新 APK](https://mucang.xyz/zephyrus/apks/zephyrus-player-latest.apk)，也可从 [GitHub Releases](https://github.com/cang-dot/zephyrus-player-android/releases) 查看所有版本。

系统要求：Android 7.0+，约 50MB 存储空间。

📖 详细安装指南见 [文档](https://www.mucang.xyz/zephyrus/docs/guide/installation)。

---

## 构建

```bash
# 安装依赖
npm install

# 构建 Web 资源
npm run build

# 同步到 Android
npx cap sync android

# 构建 APK
cd android && ./gradlew assembleDebug
```

APK 输出路径：`android/app/build/outputs/apk/debug/app-debug.apk`

安装到设备（USB 调试）：

```bash
adb -s <device_id> install -r android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 开发

```bash
# Web 开发模式
npm run dev:web

# 类型检查
npm run typecheck

# 代码检查
npm run lint

# 格式化
npm run format
```

---

## 开源协议

[MIT License](LICENSE)

本项目基于 [AlgerMusicPlayer](https://github.com/algerkong/AlgerMusicPlayer) 二次开发，感谢原作者。
