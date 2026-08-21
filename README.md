# Zephyrus Player

Zephyrus Player 是一款只为 Android 手机设计的音乐播放器：歌曲、歌词和播放器舞台共享同一条时间轴，常用操作围绕单手触控和可中断动画组织。

[![版本](https://img.shields.io/badge/version-v1.2.5-b48b52)](https://github.com/cang-dot/zephyrus-player-android/releases/tag/v1.2.5)
[![Android](https://img.shields.io/badge/Android-8.0%2B-3ddc84?logo=android&logoColor=white)](https://developer.android.com/about/versions/oreo)
[![Vue](https://img.shields.io/badge/Vue_3-42b883?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![许可证](https://img.shields.io/badge/license-AGPL--3.0-blue)](./LICENSE)

## 下载

- [GitHub Release v1.2.5](https://github.com/cang-dot/zephyrus-player-android/releases/tag/v1.2.5)
- [服务器直链](https://mucang.xyz/zephyrus/apks/zephyrus-player-latest.apk)
- [Android 产品介绍](https://mucang.xyz/zephyrus/)
- [使用文档](https://mucang.xyz/zephyrus/docs/)

安装需要 Android 8.0 或更高版本。首次启动按提示授予通知、悬浮窗和本地文件访问权限；没有这些权限时，基础播放仍可使用，但对应功能会保持关闭。

## 主要能力

### 歌词时间轴

歌词按以下顺序尝试加载：

1. Zephyrus TTML
2. AMLL TTML
3. 网易云 YRC
4. QQ 音乐 QRC
5. 普通 LRC

TTML 可以同时携带主唱、背景、对唱、翻译和罗马音。默认播放器与独立滚动歌词使用 AMLL Vue 组件渲染，缺少逐字时间时会自然回退到行级歌词。点击歌词可定位，长按可进入歌词选择；手势、系统返回和播放界面切换不会改变音频播放状态。

### 移动播放器

当前版本提供默认、舞台、诡谲、狂热、陈旧、雨夜、星盘和烟雾八种样式。样式会独立保存背景、字体、歌词颜色、对齐方式和高潮效果；默认样式也支持大封面、滚动歌词和沉浸式底栏。样式自身的背景动画在歌词覆盖层出现时仍保持生命周期一致，不会因为切换歌词而卡住。

### 音频与过渡

- 播放中跳转进度会保持播放，暂停中跳转仍保持暂停。
- 快速切歌只处理最新请求，旧音频的延迟事件不会重新暂停或启动当前歌曲。
- 智能过渡支持轻量到智能的连续调节、无缝切歌和可中断的加载反馈。
- 本地文件播放失败时只提示一次并安全推进队列，不会在同一首歌上重复循环报错。

### 来源与账号

支持网易云、QQ 音乐、酷狗和本地音乐的搜索、歌单与收藏。QQ 音乐扫码登录由服务端中转，Spotify 登录受 Spotify 开发者应用白名单限制，未配置应用时会明确显示不可用状态，不会伪造登录成功。

### 歌词 AI 解析

歌词设置中可以选择云端模型并查看每日积分。网关只接收歌曲元数据和歌词文本，不接收账号密码；模型列表、倍率、流式输出、Markdown 展示和纯文本复制都在同一面板完成。部署说明见 [`docs/ai-gateway-deployment.md`](./docs/ai-gateway-deployment.md)。

## 开发

```bash
npm install
npm run dev:web
```

常用检查：

```bash
npm run test:lyrics
npm run test:ai-gateway
npm run typecheck
npm run build
npx cap sync android
cd android
./gradlew.bat assembleRelease --no-daemon
```

APK 输出在 `android/app/build/outputs/apk/release/app-release.apk`。连接已授权设备后可以覆盖安装：

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

## 项目结构

```text
src/renderer/components/  移动布局、播放栏、歌词和播放器样式
src/renderer/services/    音频、歌词、平台账号与原生桥接
src/renderer/store/       播放、歌词、样式、账号和过渡状态
src/renderer/utils/       歌词解析、调度器、手势与生命周期工具
website/                  VitePress 文档站
product-site/             Android 产品介绍站
android/                  Capacitor Android 容器与原生桥接
server-ai-gateway.js      云端歌词 AI 网关
```

## 致谢与许可证

滚动歌词使用 [Apple Music-like Lyrics](https://github.com/amll-dev/applemusic-like-lyrics) 的 Vue 组件，遵循其开源许可证并在应用关于页面与文档站致谢。项目整体使用 [AGPL-3.0-only](./LICENSE) 发布；第三方依赖的许可证以各自仓库为准。

问题反馈请提交 [GitHub Issues](https://github.com/cang-dot/zephyrus-player-android/issues)，并附上 Android 版本、歌曲来源、歌词格式、播放器样式和复现步骤。
