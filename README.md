<div align="center">

# Zephyrus Player

**西风播放器** — 沉浸式音乐播放器 · Android

[![Version](https://img.shields.io/badge/version-v1--alpha-blue)](https://github.com/cang-dot/zephyrus-player-android/releases)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Vue](https://img.shields.io/badge/Vue_3.5-42b883?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript_5.9-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Android](https://img.shields.io/badge/Android_Capacitor_8-3ddc84?logo=android&logoColor=white)](https://capacitorjs.com/)

</div>

---

## 概述

Zephyrus Player 是一款深度集成网易云音乐生态的沉浸式 Android 音乐播放器，以高度可定制的播放器界面为核心，内置 6 种全屏播放器样式，通过实时高潮检测、鼓点跟踪、封面取色等技术驱动视觉动画与歌词渲染。

> 本项目基于 [AlgerMusicPlayer](https://github.com/algerkong/AlgerMusicPlayer) 深度二次开发。
> 桌面版（Electron）见 [zephyrus-player](https://github.com/cang-dot/zephyrus-player)。

---

## 核心特性

### 播放器样式

| 样式 | 说明 |
|------|------|
| 默认 | 封面取色背景 + 逐字歌词 + 渐变遮罩 |
| 舞台 Stage | 深色背景 + 居中大字歌词 + 高潮鼓点闪白 |
| 诡谲 Eerie | 噪点底 + 书法字歌词 + 高潮关键词 |
| 陈旧 Neon | 混凝土底 + 霓虹描边字 + 脉冲光晕 |
| 狂热 Frenzy | 极简色块 + 巨字歌词分屏 |
| 杂志 Magazine | 色块拼贴 + 期刊式歌词 |

### 自定义效果

每种样式支持独立的效果参数调节（播放设置面板内）：
- **字体导入**：支持导入 `.ttf` / `.otf` 字体文件
- **样式参数**：Aurora 速度、鼓点闪白强度、光晕半径、脉冲速度、巨字字号、翻页速度等

### 滚动歌词

- `width: fit-content` 歌词行，点击文字精确跳转
- 拖动时右侧显示时间指示器（可点击跳转）
- 上下渐变遮罩 + 自动滚动追踪
- 双击进入、单击空白退出

### 播放控制

- 进度条带高潮段落标注
- 3 秒无操作自动隐藏
- 播放/暂停直接控制音频引擎
- 逐字歌词进度渲染

### 其他

- 网易云音乐登录（扫码 + 手机号）
- 歌单 / 专辑 / 排行榜 / 搜索
- 本地音乐播放
- 歌词翻译（多引擎）
- AI 歌词隐喻分析
- 定时关闭

---

## 技术栈

| 层 | 技术 |
|----|------|
| 框架 | Vue 3.5 + TypeScript 5.9 |
| 构建 | Vite 6 |
| 原生壳 | Capacitor 8 (Android) |
| 状态管理 | Pinia |
| 音频引擎 | Howler.js + Web Audio API |
| 样式 | Tailwind CSS + SCSS |
| i18n | vue-i18n（5 种语言） |

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

---

## 开发

```bash
# Web 开发模式
npm run dev:web

# 类型检查
npm run typecheck:web

# 代码检查
npm run lint
```

---

## 开源协议

[MIT License](LICENSE)

本项目基于 [AlgerMusicPlayer](https://github.com/algerkong/AlgerMusicPlayer) 二次开发，感谢原作者。
