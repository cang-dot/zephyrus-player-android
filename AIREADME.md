# AIREADME — AI 协作开发指南

> 本文件供 AI 助手（及人类开发者）快速理解项目架构、发布流程和开发规范。
> **每次修改代码后必须提交一次 commit。** 如需更高权限（push/release/tag），向用户索要 GitHub Token。

---

## 一、发布流程

### 1. 修改代码

每次做任何代码改动后，**必须**提交一次 commit：

```bash
git add -A
git commit -m "<type>: <简要描述>"
```

**commit 类型**遵循：
- `feat`: 新功能
- `fix`: Bug 修复
- `refactor`: 重构
- `style`: 样式调整
- `docs`: 文档
- `chore`: 构建/配置/依赖

### 2. 更新版本号

在 `package.json` 中修改 `version` 字段。版本格式：`<主版本>.<次版本>.<补丁>-<标签>`，例如 `0.9.9-vision`。

### 3. 更新发布说明

编辑 `RELEASE_NOTES.md`，写入本次发布内容。该文件会被 GitHub Actions 工作流读取作为 Release Body。

格式：
```markdown
# Zephyrus Player vX.X.X

## 新增
- ...

## 修复
- ...

## 优化
- ...
```

### 4. 提交所有改动

```bash
git add -A
git commit -m "release: vX.X.X - <简要描述>"
```

### 5. 打 Tag 并推送

```bash
git tag vX.X.X
git push origin main
git push origin vX.X.X
```

推送 tag 后，`.github/workflows/build.yml` 自动触发：
1. 构建 Windows（NSIS x64/ia32/arm64）
2. 构建 macOS（DMG + ZIP x64/arm64）
3. 构建 Linux（AppImage/DEB/RPM）
4. 从 `RELEASE_NOTES.md` 读取发布内容
5. 创建 GitHub Release 并上传全部产物

### 6. 权限说明

- **commit**：AI 可直接执行
- **push**：需要 GitHub 凭据。如 `git push` 超时或失败，向用户索要 GitHub Personal Access Token
- **tag**：AI 创建 tag 后需用户确认再 push
- **GitHub Release**：由 Actions 自动完成，无需手动操作

### 注意事项

- **不要**在 commit message 中使用 `--no-verify` 跳过 hooks
- **不要**force push 到 main 分支
- 打 tag 前**必须**确认 `package.json` 的 version 与 tag 一致
- `RELEASE_NOTES.md` 每次发布后应更新为下次的内容，或清空
- macOS 构建需要 `entitlements.mac.plist`，已配置在 `build/` 目录
- Windows NSIS 安装脚本在 `build/installer.nsh`

---

## 二、项目架构

### 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Electron 40 |
| 前端框架 | Vue 3.5 + TypeScript 5.9 |
| 构建工具 | electron-vite 5 + Vite 6.4 |
| UI 组件库 | Naive UI 2.43 |
| CSS 框架 | Tailwind CSS 3.4 + SCSS |
| 状态管理 | Pinia + pinia-plugin-persistedstate |
| 动画引擎 | GSAP 3.15 |
| WebGL | OGL 1.0 |
| 音频播放 | Howler.js + Web Audio API |
| 音频元数据 | music-metadata + flac-tagger + node-id3 |
| 音乐 API | netease-cloud-music-api-alger |
| 音源解锁 | @unblockneteasemusic/server |
| 中文分词 | jieba-wasm |
| 国际化 | vue-i18n（5 语言：中/英/日/韩/繁中） |

### 目录结构

```
zephyrus-music-player/
├── .github/
│   ├── workflows/
│   │   ├── build.yml             # 构建 & 发布（tag v* 触发）
│   │   └── ci.yml                # CI 检查（push/PR 触发）
│   └── ISSUE_TEMPLATE/           # Issue 模板
├── android/                      # Capacitor Android 脚手架（仅 .gitignore，尚未初始化）
├── build/                        # electron-builder 构建配置
│   ├── entitlements.mac.plist   # macOS 权限声明
│   └── installer.nsh            # Windows NSIS 安装脚本
├── resources/                    # 图标/HTML 等打包资源
│   ├── html/                    # 桌面歌词窗口 HTML
│   ├── icon.icns                # macOS 图标
│   ├── icon.ico                 # Windows 图标
│   └── icon.png                 # Linux 图标
├── scripts/                      # 构建辅助脚本
│   ├── build-plugins.mjs        # 插件构建
│   ├── check_i18n.ts            # i18n 完整性检查
│   └── merge_latest_mac_yml.mjs # macOS 多架构 yml 合并
├── landing-page/                 # 营销页（独立）
├── zephyrus-intro/               # 启动动画（独立）
├── RELEASE_NOTES.md              # 发布说明（GitHub Release 读取此文件）
├── CHANGELOG.md                  # 更新日志
├── DEV.md                        # 开发文档
└── src/
    ├── i18n/                     # 国际化
    │   ├── lang/                # 语言文件（zh-CN/en-US/ja-JP/ko-KR/zh-Hant）
    │   ├── languages.ts         # 语言列表
    │   ├── main.ts              # 主进程 i18n
    │   ├── renderer.ts          # 渲染进程 i18n
    │   └── utils.ts             # i18n 工具
    ├── main/                     # Electron 主进程
    │   ├── index.ts             # ★ 主进程入口：窗口创建、IPC 注册、模块初始化
    │   ├── lyric.ts             # 桌面歌词窗口管理（独立 BrowserWindow）
    │   ├── server.ts            # 本地 Express API 服务（netease-cloud-music-api）
    │   ├── unblockMusic.ts      # 多平台音源解锁（@unblockneteasemusic/server）
    │   ├── set.json             # 默认设置
    │   └── modules/             # 主进程功能模块
    │       ├── window.ts            # 窗口创建与管理
    │       ├── window-size.ts       # 窗口大小/位置持久化（electron-window-state）
    │       ├── tray.ts              # 系统托盘（图标/菜单/点击行为）
    │       ├── shortcuts.ts         # 全局快捷键注册
    │       ├── localMusicScanner.ts # 本地音乐文件夹递归扫描 + 元数据解析
    │       ├── fileManager.ts       # 文件管理（压缩/删除/读写）
    │       ├── cache.ts             # 磁盘缓存管理
    │       ├── config.ts            # electron-store 配置存储
    │       ├── pluginManager.ts     # 插件加载与管理
    │       ├── remoteControl.ts     # 局域网 HTTP 远程控制 API
    │       ├── update.ts            # 自动更新（electron-updater）
    │       ├── deviceInfo.ts        # 设备信息
    │       ├── fonts.ts             # 系统字体枚举
    │       ├── loginWindow.ts       # 登录窗口管理
    │       ├── lxMusicHttp.ts       # 落雪音源 HTTP 代理
    │       └── otherApi.ts          # 其他 API 端点
    ├── preload/                   # Electron 预加载脚本
    │   ├── index.ts              # ★ IPC 桥接：暴露安全 API 给渲染进程
    │   └── index.d.ts            # 类型声明
    ├── shared/                    # 主进程/渲染进程共享类型
    │   ├── appUpdate.ts          # 更新相关共享类型
    │   └── shortcuts.ts         # 快捷键共享定义
    └── renderer/                  # Vue 3 渲染进程
        ├── main.ts               # ★ 渲染进程入口
        ├── App.vue               # ★ 根组件：主题/语言/布局/初始化
        ├── index.html            # HTML 模板
        ├── index.css             # 全局样式（CSS 变量/安全区/响应式）
        ├── api/                  # API 请求层
        │   ├── music.ts          # ★ 网易云音乐核心 API（歌曲URL/详情/搜索）
        │   ├── musicParser.ts    # 音源解析（多平台/自定义API/LX脚本）
        │   ├── parseFromCustomApi.ts # 自定义 API 音源解析
        │   ├── lxMusicStrategy.ts    # 落雪音源策略
        │   ├── home.ts           # 首页数据 API（推荐/ banner/ FM）
        │   ├── playlist.ts      # 歌单 API
        │   ├── album.ts         # 专辑 API
        │   ├── artist.ts        # 歌手 API
        │   ├── list.ts          # 歌单详情 API
        │   ├── login.ts         # 登录 API（二维码/Cookie/UID）
        │   ├── user.ts          # 用户 API（信息/关注/粉丝）
        │   ├── search.ts        # 搜索 API
        │   ├── mv.ts            # MV API
        │   ├── podcast.ts       # 播客 API
        │   ├── climax.ts        # 高潮段落 API（社区数据）
        │   ├── keywords.ts      # 重点词 API
        │   ├── communityLyric.ts # 社区歌词 API
        │   ├── gdmusic.ts       # GD Music API
        │   └── playlist.ts      # 歌单 API
        ├── components/            # Vue 组件
        │   ├── player/          # 播放栏组件
        │   │   ├── PlayBar.vue       # ★ 底部播放栏（全/迷你模式 + 封面过渡动画）
        │   │   ├── MiniPlayBar.vue  # 迷你播放栏
        │   │   ├── SimplePlayBar.vue # 精简播放栏（经典模式内嵌）
        │   │   ├── MobilePlayBar.vue # 移动端播放栏（滑动切歌）
        │   │   ├── MobilePlayerSettings.vue # 移动端设置底部抽屉
        │   │   ├── PlayingListDrawer.vue # 播放列表抽屉
        │   │   ├── AdvancedControlsPopover.vue # 高级控件（EQ/定时/变速）
        │   │   ├── ReparsePopover.vue  # 重新解析音源弹窗
        │   │   ├── SleepTimer.vue     # 睡眠定时器
        │   │   └── SleepTimerTop.vue  # 顶部睡眠定时器
        │   ├── lyric/           # 全屏播放器样式
        │   │   ├── MusicFull.vue         # ★ 经典模式全屏播放器
        │   │   ├── MusicFullMobile.vue   # 移动端全屏播放器（横/竖屏双布局）
        │   │   ├── MusicFullBackground.vue # 背景模式全屏播放器
        │   │   ├── MusicFullWrapper.vue  # ★ 样式切换包装器（按 isMobile/playerStyle 选组件）
        │   │   ├── StagePlayer.vue       # Stage 舞台聚光模式
        │   │   ├── StageStarfield.vue    # Stage 星空背景
        │   │   ├── TypographicPlayer.vue # Magazine 杂志模式
        │   │   ├── FrenzyPlayer.vue      # Frenzy 狂躁模式
        │   │   ├── FrenzyLyrics.vue      # Frenzy 双层歌词
        │   │   ├── GrittyPlayer.vue      # Gritty 工业模式
        │   │   ├── GrittyLyrics.vue      # Gritty 双层歌词
        │   │   ├── GlitchBackground.vue   # WebGL 故障背景
        │   │   ├── PlayerControls.vue    # 全屏播放器通用控件
        │   │   ├── LyricSettings.vue     # 歌词设置面板
        │   │   ├── LyricCorrectionControl.vue # 歌词时间矫正
        │   │   ├── SettingRenderer.vue   # 设置渲染器
        │   │   └── ThemeColorPanel.vue   # 主题颜色面板
        │   ├── cover/
        │   │   └── Cover3D.vue          # 3D 视差封面（鼠标 tilt + 光泽）
        │   ├── common/           # 通用组件
        │   │   ├── InfiniteCoverGrid.vue # 无限滚动歌单网格
        │   │   ├── SongItem.vue          # 歌曲项（统一入口）
        │   │   ├── songItemCom/          # 歌曲项子组件（Base/Compact/Home/List/Mini/Standard）
        │   │   ├── PlaylistDrawer.vue    # 歌单抽屉
        │   │   ├── FloatingPanel.vue     # 浮动面板
        │   │   ├── FloatingWindow.vue   # 浮动窗口
        │   │   ├── FloatingWindowManager.vue # 浮动窗口管理器
        │   │   ├── ResponsiveModal.vue   # 响应式模态框（移动端底部抽屉）
        │   │   ├── EmptyState.vue        # 空状态
        │   │   ├── DisclaimerModal.vue   # 免责声明
        │   │   ├── UpdateModal.vue       # 更新提示
        │   │   ├── MobileUpdateModal.vue # 移动端更新提示
        │   │   ├── InstallAppModal.vue   # 安装提示
        │   │   ├── TrafficWarningDrawer.vue # 流量警告
        │   │   └── StickyTabPage.vue    # 粘性标签页
        │   ├── settings/         # 设置组件
        │   │   ├── SmartMixSettings.vue    # 智能混音设置
        │   │   ├── AudioDeviceSettings.vue # 音频设备设置
        │   │   ├── ShortcutSettings.vue    # 快捷键设置
        │   │   ├── ProxySettings.vue       # 代理设置
        │   │   ├── ServerSetting.vue       # API 服务器设置
        │   │   ├── MusicSourceSettings.vue # 音源设置
        │   │   ├── ClearCacheSettings.vue   # 清除缓存
        │   │   └── CookieSettingsModal.vue  # Cookie 设置
        │   ├── splash/
        │   │   └── SplashScreen.vue   # 启动画面
        │   ├── login/
        │   │   ├── QrLogin.vue       # 二维码登录
        │   │   ├── CookieLogin.vue   # Cookie 登录
        │   │   └── UidLogin.vue      # UID 登录
        │   ├── podcast/
        │   │   ├── ProgramList.vue   # 播客节目列表
        │   │   └── RadioCard.vue    # 电台卡片
        │   ├── ClimaxEditor.vue     # 高潮段落编辑器
        │   ├── EQControl.vue       # 均衡器控件
        │   ├── Aurora.vue          # 极光背景效果
        │   ├── MvPlayer.vue        # MV 播放器
        │   ├── LanguageSwitcher.vue # 语言切换
        │   └── ShortcutToast.vue   # 快捷键提示
        ├── composables/             # Vue 组合式函数
        │   ├── useSmartAudio.ts          # ★ 智能混音引擎（三级过渡策略 + BPM Worker + 调度器）
        │   └── useCoverTransition.ts     # ★ 封面过渡动画（GSAP 动态模糊 + 覆盖层渐显 swap）
        ├── hooks/                    # Vue Hooks
        │   ├── MusicHook.ts          # ★ 音乐播放核心逻辑（进度/歌词/事件监听/自动切歌）
        │   ├── usePlayerHooks.ts     # 播放器事件钩子（歌词加载/歌曲详情）
        │   ├── useCoverColor.ts      # 封面取色
        │   ├── useLocalMusic.ts      # 本地音乐管理
        │   ├── useArtist.ts          # 歌手导航
        │   ├── useFavorite.ts        # 收藏管理
        │   ├── useDownload.ts        # 下载管理
        │   ├── usePlaybackControl.ts # 播放控制（播放/暂停/上一首/下一首）
        │   ├── usePlayMode.ts        # 播放模式（顺序/循环/随机/单曲）
        │   ├── useVolumeControl.ts   # 音量控制
        │   ├── useOverlayNavigate.ts # 浮动覆盖导航
        │   ├── usePlaylistConfirm.ts # 歌单确认
        │   ├── useSongItem.ts        # 歌曲项逻辑
        │   ├── useScrollTitle.ts     # 标题滚动
        │   ├── useZoom.ts           # 缩放
        │   ├── useDownloadStatus.ts  # 下载状态
        │   ├── useLyricBackground.ts # 歌词背景
        │   └── IndexDBHook.ts       # IndexedDB 封装
        ├── services/                 # 核心服务层
        │   ├── audioService.ts       # ★ 音频引擎（Howler + Web Audio EQ + crossfade + 设备管理）
        │   ├── smartMixService.ts    # ★ 智能混音调度（段落门控 + 署名检测 + crossfade 触发 + 状态更新）
        │   ├── localAudioPlayer.ts   # 本地音频播放器
        │   ├── preloadService.ts     # 音频预加载服务
        │   ├── climaxDetector.ts     # 高潮检测器（RMS + 频谱覆盖度）
        │   ├── drumDetector.ts       # 鼓点检测器（BPM + 节拍）
        │   ├── eqService.ts          # 均衡器服务
        │   ├── playbackController.ts # 播放控制器
        │   ├── playbackRequestManager.ts # 播放请求管理（竞态保护）
        │   ├── cacheService.ts       # IndexedDB 缓存服务
        │   ├── pluginManager.ts      # 插件管理器
        │   ├── preloadService.ts     # 预加载服务
        │   ├── SongSourceConfigManager.ts # 音源配置管理
        │   ├── LxMusicSourceRunner.ts # 落雪音源沙箱执行器
        │   ├── lyricTranslation.ts   # 歌词翻译
        │   ├── translation-engines/  # 翻译引擎
        │   │   ├── opencc.ts        # OpenCC 繁简转换
        │   │   └── index.ts         # 引擎注册
        │   └── workers/
        │       └── lxScriptSandbox.worker.ts # LX 脚本沙箱 Worker
        ├── store/                    # Pinia 状态管理
        │   ├── index.ts              # store 入口
        │   └── modules/              # store 模块
        │       ├── player.ts          # ★ 播放器组合 store（聚合 playerCore + playlist + settings）
        │       ├── playerCore.ts     # ★ 核心播放控制（播放/暂停/URL/音量/速度/设备）
        │       ├── playlist.ts       # ★ 播放列表（索引/模式/预加载/上下首）
        │       ├── settings.ts       # ★ 设置（主题/语言/布局/快捷键/移动端检测）
        │       ├── mixEngine.ts      # ★ 智能混音引擎（开关/等级/时长/BPM 缓存/硬件评估）
        │       ├── transition.ts     # ★ 过渡 UI 状态（crossfade 期间下一首信息桥接）
        │       ├── styleEngine.ts    # 样式引擎（聚合播放状态/音频特征/高潮/封面色）
        │       ├── communityData.ts  # 社区数据（高潮段落/重点词/社区歌词）
        │       ├── climax.ts         # 高潮段落 store
        │   │   ├── favorite.ts       # 收藏
        │   │   ├── localMusic.ts     # 本地音乐
        │   │   ├── music.ts          # 音乐数据
        │   │   ├── user.ts          # 用户信息
        │   │   ├── search.ts        # 搜索状态
        │   │   ├── sleepTimer.ts    # 睡眠定时器
        │   │   ├── playHistory.ts   # 播放历史
        │   │   ├── menu.ts          # 菜单（路由过滤/移动端适配）
        │   │   ├── navTitle.ts      # 导航标题
        │   │   ├── windowStore.ts   # 窗口状态
        │   │   ├── lyric.ts         # 歌词状态
        │   │   ├── recommend.ts    # 推荐
        │   │   └── intelligenceMode.ts # 智能模式
        ├── views/                    # 页面视图
        │   ├── home/                # 首页
        │   │   ├── index.vue        # 首页入口
        │   │   └── components/      # 首页子组件（Hero/Playlist/NewSongs/Artists/Album/DailyRecommend/ListItem/PrivateContent/NavCard/FmLyrics）
        │   ├── music/
        │   │   ├── MusicListPage.vue # 音乐列表页
        │   │   └── HistoryRecommend.vue # 历史推荐
        │   ├── set/                 # 设置页
        │   │   ├── index.vue        # 设置入口
        │   │   ├── tabs/           # 设置标签页（Basic/Interface/Playback/Network/Application/About/ExtraFeatures/System）
        │   │   ├── SettingItem.vue  # 设置项
        │   │   ├── SettingNav.vue   # 设置导航
        │   │   ├── SettingSection.vue # 设置分区
        │   │   ├── SBtn.vue        # 设置按钮
        │   │   ├── SInput.vue       # 设置输入框
        │   │   ├── SSelect.vue     # 设置下拉
        │   │   └── keys.ts         # 设置键定义
        │   ├── lyric/              # 桌面歌词窗口视图
        │   │   ├── index.vue        # 歌词窗口入口
        │   │   ├── components/      # 歌词控件（LyricControlBar/LyricDisplay）
        │   │   └── composables/     # 歌词逻辑（useLyricControls/useLyricDrag/useLyricSettings/useLyricState/useLyricTheme）
        │   ├── album/index.vue     # 专辑页
        │   ├── artist/detail.vue   # 歌手详情
        │   ├── toplist/index.vue   # 排行榜
        │   ├── list/index.vue      # 歌单详情
        │   ├── search/             # 搜索
        │   │   ├── index.vue       # 搜索入口
        │   │   └── SearchResult.vue # 搜索结果
        │   ├── mobile-search/      # 移动端搜索
        │   │   └── index.vue
        │   ├── mobile-search-result/ # 移动端搜索结果
        │   │   └── index.vue
        │   ├── mv/index.vue        # MV 页
        │   ├── podcast/            # 播客
        │   │   ├── index.vue       # 播客首页
        │   │   └── radio.vue       # 电台详情
        │   ├── local-music/index.vue # 本地音乐
        │   ├── download/DownloadPage.vue # 下载管理
        │   ├── heatmap/index.vue   # 听歌热力图
        │   ├── favorite/index.vue  # 收藏页
        │   ├── history/index.vue   # 历史记录
        │   ├── historyAndFavorite/index.vue # 历史+收藏合并
        │   ├── playlist/ImportPlaylist.vue # 歌单导入
        │   ├── user/               # 用户页
        │   │   ├── index.vue       # 用户主页
        │   │   ├── detail.vue      # 用户详情
        │   │   ├── follows.vue     # 关注列表
        │   │   └── followers.vue   # 粉丝列表
        │   └── login/index.vue     # 登录页
        ├── layout/                  # 布局组件
        │   ├── AppLayout.vue       # ★ 主布局（桌面/移动/浮动覆盖三模式切换）
        │   ├── MobileLayout.vue    # 移动端布局
        │   ├── MiniLayout.vue      # 迷你模式布局
        │   ├── OverlayLayout.vue   # 浮动覆盖布局
        │   └── components/          # 布局子组件
        │       ├── AppMenu.vue          # 侧边栏菜单
        │       ├── MobileHeader.vue     # 移动端顶部栏
        │       ├── FloatingSidebar.vue  # 浮动侧边栏
        │       ├── FloatingSearchBar.vue # 浮动搜索栏
        │       ├── OverlayPlayerHost.vue # 浮动覆盖播放器宿主
        │       ├── OverlayTitleBar.vue   # 浮动覆盖标题栏
        │       ├── SearchBar.vue         # 搜索栏
        │       ├── TitleBar.vue          # 桌面标题栏
        │       └── index.ts             # 布局组件导出
        ├── router/                  # Vue Router
        │   ├── index.ts            # ★ 路由入口（含 mini 模式守卫）
        │   ├── home.ts             # 主导航路由（含 meta.isMobile 标记）
        │   └── other.ts            # 其他路由（移动端搜索/播客电台）
        ├── playerStyles/            # 全屏播放器样式插件系统
        │   ├── index.ts            # 样式注册入口
        │   ├── registry.ts         # 样式注册表
        │   ├── useStyleContext.ts  # 样式上下文
        │   ├── default/            # 默认样式
        │   ├── stage/             # Stage 舞台样式
        │   ├── magazine/          # Magazine 杂志样式
        │   └── frenzy/            # Frenzy 狂躁样式
        ├── features/               # 功能模块
        │   ├── ai/                 # AI 功能
        │   │   ├── client.ts      # AI 客户端
        │   │   └── providers.ts   # AI 提供者
        │   ├── lyric-metaphor/    # 歌词隐喻分析
        │   │   ├── MetaphorPanel.vue
        │   │   ├── MetaphorConfigModal.vue
        │   │   └── useMetaphor.ts
        │   ├── register.ts        # 内置功能注册
        │   ├── registry.ts        # 功能注册表
        │   ├── store.ts          # 功能状态
        │   └── index.ts          # 功能入口
        ├── utils/                  # 工具函数
        │   ├── audio/             # 音频算法
        │   │   ├── crossfade.ts      # Level 1: 等功率淡入淡出
        │   │   ├── beatAlign.ts      # Level 2: BPM 节拍对齐过渡
        │   │   ├── bandSplitter.ts   # Level 3: 三频段独立淡出
        │   │   └── scheduler.ts      # AudioContext 精准事件调度器
        │   ├── index.ts           # ★ 通用工具（isMobile/isElectron/getImgUrl 等）
        │   ├── linearColor.ts     # 封面取色 + 渐变动画
        │   ├── yrcParser.ts       # YRC 逐字歌词解析器
        │   ├── ttmlParser.ts      # TTML 歌词解析器
        │   ├── request.ts        # HTTP 请求封装
        │   ├── request_music.ts   # 音乐 API 请求封装
        │   ├── auth.ts           # 认证工具
        │   ├── playerUtils.ts    # 播放器工具
        │   ├── theme.ts          # 主题工具
        │   ├── update.ts         # 更新工具
        │   ├── appShortcuts.ts   # 应用快捷键
        │   ├── shortcutKeyboard.ts # 快捷键键盘
        │   ├── shortcutToast.ts  # 快捷键提示
        │   ├── animationSelector.ts # 动画选择器
        │   ├── frenzyAnimations.ts  # Frenzy 动画预设
        │   ├── grittyAnimations.ts  # Gritty 动画预设
        │   ├── stageAnimations.ts   # Stage 动画预设
        │   ├── emotionalDetector.ts # 情绪检测
        │   ├── wordSplitter.ts    # 分词
        │   ├── fileOperation.ts   # 文件操作
        │   ├── localLyricStorage.ts # 本地歌词存储
        │   ├── localMusicUtils.ts  # 本地音乐工具
        │   ├── lxCrypto.ts        # LX 加密
        │   ├── musicSourceConfig.ts # 音源配置
        │   └── podcastUtils.ts    # 播客工具
        ├── lib/                    # 引擎库
        │   ├── climaxDriver.ts     # 高潮驱动器
        │   ├── colorBlockEngine.ts # 色块引擎
        │   └── layoutEngine.ts     # 布局引擎
        ├── workers/                # Web Workers
        │   └── bpmAnalyzer.worker.ts # ★ BPM 离线自相关分析
        ├── types/                  # TypeScript 类型定义
        │   ├── music.ts            # ★ 核心音乐类型（SongResult/ILyricText/Artist 等）
        │   ├── lyric.ts            # 歌词配置类型
        │   ├── audio.d.ts          # 音频类型
        │   ├── electron.d.ts       # Electron 类型
        │   ├── plugin.ts           # 插件类型
        │   ├── lxMusic.ts          # 落雪音源类型
        │   ├── localMusic.ts       # 本地音乐类型
        │   └── ...                 # 其他类型（album/artist/list/mv/podcast/search/singer/user 等）
        ├── const/
        │   └── bar-const.ts        # 播放栏常量
        ├── directive/              # Vue 自定义指令
        │   └── loading/            # loading 指令
        └── assets/                  # 静态资源
            ├── css/
            │   ├── base.css        # 基础样式
            │   └── mobile.css      # 移动端全局样式
            ├── icon/              # iconfont 图标
            ├── icon.png           # 应用图标
            ├── logo.png           # Logo
            └── *.png              # 二维码等图片
```

### 核心数据流

```
用户操作 → PlayBar / MusicFull
  ↓
playerStore (聚合 store)
  ├─ playerCore.handlePlayMusic() → audioService.play()
  │   ├─ preloadService.load() / consume()
  │   ├─ setupEQ() → climaxDetector / drumDetector connect
  │   └─ Howler._sounds[0]._node → MediaElementSource → filters → gainNode → destination
  ↓
MusicHook (全局监听器)
  ├─ audioService.on('play'/'pause'/'end') → 状态同步
  ├─ 进度 interval (50ms) → nowTime / 歌词索引 / crossfade 检查
  └─ smartMixService.checkCrossfade()
      ├─ 段落门控 (isInClimax / 歌词行)
      ├─ 署名关键词检测 → 绕过门控
      └─ doCrossfade() → audioService.crossfadeToNext()
          ├─ useSmartAudio.crossfadeTo() → 三级策略
          ├─ emit('crossfade-start') → transitionStore.begin()
          │   └─ useCoverTransition → GSAP 动态模糊 + 覆盖层渐显
          └─ completeCrossfadeCleanup() → 重建 EQ
              └─ emit('crossfade-complete')
                  └─ smartMixService.completeTransition()
                      ├─ playerCore.playMusic = nextSong
                      └─ transitionStore.end() → useCoverTransition.finishTransition()
```

### 移动端检测与布局切换

```
settingsStore.isMobile = (UA匹配 || innerWidth < 500) && !tabletMode
  ↓
AppLayout.vue:
  ├─ isPhone && !tabletMode → MobileLayout (MobileHeader + router-view + MobilePlayBar)
  ├─ isOverlayMode → OverlayLayout (浮动覆盖)
  └─ else → 桌面布局 (AppMenu + TitleBar + router-view + PlayBar)
  ↓
MusicFullWrapper.vue:
  └─ isMobile ? MusicFullMobile : MusicFull
```

### 智能混音三级过渡策略

| 级别 | 策略 | 文件 | 算法 |
|---|---|---|---|
| Level 1 | 等功率淡入淡出 | `utils/audio/crossfade.ts` | 余弦淡出/正弦淡入，功率守恒 |
| Level 2 | BPM 节拍对齐 | `utils/audio/beatAlign.ts` | 4 拍窗口 + 乐句边界对齐 |
| Level 3 | 频域拼接 | `utils/audio/bandSplitter.ts` | 三频段独立淡出（低频晚/中频早/高频中） |

调度器：`utils/audio/scheduler.ts` — 基于 `AudioContext.currentTime` + `requestAnimationFrame` 的精准事件调度。

---

## 三、开发规范

### 代码风格

- Composition API + `<script setup>` 语法
- TypeScript 类型系统（严格模式）
- Tailwind CSS + SCSS（不使用 Tailwind `mobile:` 变体，移动端通过 `.mobile` CSS class + `isMobile` JS 分支）
- 命名：目录 kebab-case，组件 PascalCase，组合式函数 camelCase（`use` 前缀）

### 提交规范

- 每次改动必须 commit
- commit message 格式：`<type>: <描述>`
- 不要 force push 到 main
- 不要在 commit 中跳过 hooks

### 质量检查

```bash
npm run lint        # ESLint + i18n 检查
npm run typecheck   # TypeScript 类型检查
npm run format      # Prettier 格式化
```

### 开发命令

```bash
npm install         # 安装依赖
npm run dev         # Electron 桌面开发
npm run dev:web     # Web 开发（需 API 服务器）
npm run build       # 构建渲染进程
npm run build:win   # 打包 Windows
npm run build:mac   # 打包 macOS
npm run build:linux # 打包 Linux
```

### 环境变量

```bash
# .env.development
VITE_API=<网易云API地址>
VITE_API_MUSIC=<音乐解锁API地址>
```

### 安全注意

- 不要在代码中硬编码 API Key 或 Token
- 不要提交 `.env` 文件
- 如需 GitHub Token 用于 push/release，向用户索要
- Electron 主进程的 IPC 桥接在 `preload/index.ts`，新增 API 需在此注册

---

## 四、关键文件速查

| 需求 | 文件 |
|---|---|
| 修改版本号 | `package.json` → `version` |
| 修改发布内容 | `RELEASE_NOTES.md` |
| 修改构建工作流 | `.github/workflows/build.yml` |
| 修改 CI 检查 | `.github/workflows/ci.yml` |
| 修改 Electron 打包配置 | `package.json` → `build` 字段 |
| 修改入口 | `src/main/index.ts`（主进程）/ `src/renderer/main.ts`（渲染进程） |
| 修改 IPC 桥接 | `src/preload/index.ts` |
| 修改音频引擎 | `src/renderer/services/audioService.ts` |
| 修改自动切歌逻辑 | `src/renderer/services/smartMixService.ts` |
| 修改播放控制 | `src/renderer/store/modules/playerCore.ts` |
| 修改播放列表 | `src/renderer/store/modules/playlist.ts` |
| 修改移动端检测 | `src/renderer/store/modules/settings.ts` → `calculateMobileStatus()` |
| 修改布局切换 | `src/renderer/layout/AppLayout.vue` |
| 修改全屏播放器 | `src/renderer/components/lyric/MusicFullWrapper.vue` |
| 修改播放栏 | `src/renderer/components/player/PlayBar.vue` |
| 修改封面过渡 | `src/renderer/composables/useCoverTransition.ts` |
| 修改智能混音引擎 | `src/renderer/composables/useSmartAudio.ts` |
| 修改歌词核心 | `src/renderer/hooks/MusicHook.ts` |
| 修改路由 | `src/renderer/router/index.ts` + `home.ts` + `other.ts` |
| 修改 i18n | `src/i18n/lang/<语言>/<模块>.ts` |
| 修改 Tailwind 配置 | `tailwind.config.js` |
| 修改 Vite 配置 | `electron.vite.config.ts` + `vite.config.ts` |
