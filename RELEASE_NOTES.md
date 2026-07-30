# Zephyrus Player 更新日志

## v1.1.2

### 🐛 修复

- **移动端更新检查指向错误仓库**：`update.ts` 中 `getLatestReleaseInfo` 请求的是桌面版仓库 `zephyrus-player`，改为优先请求 Android 仓库 `zephyrus-player-android`
- **APK 下载链接指向错误仓库**：`MobileUpdateModal.vue` 下载链接从 GitHub 桌面版仓库改为服务器直链 `https://mucang.xyz/zephyrus/apks/zephyrus-player-latest.apk`
- **全站 GitHub Releases 链接统一**：`SearchBar`、`FloatingSearchBar`、`TitleBar`、`InstallAppModal`、`appUpdate.ts` 中所有 releases 链接统一指向 `zephyrus-player-android` 仓库

### 🎨 优化

- **移除冗余代理节点逻辑**：移动端更新弹窗不再依赖第三方 GitHub 代理服务，直接使用服务器直链下载
- **版本号统一更新至 v1.1.2**

---

## v1.1.1

### 🐛 修复

- **SegmentSlider 未使用变量**：移除 `v-for` 中未使用的 `index` 变量，消除 ESLint 警告
- **local-music/index.vue 多重 BOM**：文件开头存在多个 UTF-8 BOM 标记导致潜在解析问题，清理为单个 BOM

### 🎨 优化

- **版本号统一更新至 v1.1.1**：`package.json` / `build.gradle` / README / 文档站全部同步

---

## v1.1.0

### ✨ 新增

- **本地音乐完整支持**：扫描本地音频文件（FLAC/MP3/OGG/WAV/M4A），自动解析元数据（封面、歌词、专辑信息），Hero Card UI 设计
- **嵌入式歌词提取**：原生 `MediaMetadataRetriever` 提取 ID3v2 USLT / FLAC LYRICS 标签，支持内嵌歌词读取
- **异步文件加载**：`copyToCacheDirAsync` 异步复制文件到缓存目录，避免阻塞 JS 线程导致播放卡死
- **GlowTabs 光晕滑块**：全站统一使用 `GlowTabs` 组件替代旧滑块，视觉一致性提升
- **Hero Card 浮动卡片**：可收起/展开的浮动 Hero Card 组件，用于本地音乐等页面
- **紧凑模式播放栏**：底栏导航紧凑模式下播放栏自动适配，带过渡动画
- **APK 自动发布 Agent**：服务器每日自动从 GitHub Release 下载最新 APK，保留 30 天滑动窗口，自动更新文档下载链接
- **服务器直链下载**：文档下载链接改为 `https://mucang.xyz/zephyrus/apks/zephyrus-player-latest.apk`

### 🐛 修复

- **本地音乐播放卡死**：`copyToCacheDir` 同步 JNI 调用阻塞 JS 线程，改用 `copyToCacheDirAsync` 异步回调
- **本地音乐无声音/无进度**：`setupEQ` 对 `LocalAudioPlayer` 提前 return 导致未连接 `AudioContext.destination`，新增 `_setupEQLocalMobile` 方法
- **嵌入歌词不读取**：`getAudioMetadata` 硬编码 lyrics 为 NULL，实现 `extractEmbeddedLyrics` 多策略提取
- **设置页版本号显示 v1-alpha**：`AboutTab.vue` 硬编码版本字符串，改为从 `package.json` 动态读取 `config.version`
- **紧凑底栏对齐问题**：直接复制底栏导航的位置/高度参数到紧凑播放栏
- **页面标题冗余**：有 Hero Card 的页面自动隐藏顶栏标题 pill
- **AudioContext 挂起**：移动端后台切回后 AudioContext 可能被暂停，播放前调用 `resume()`

### 🎨 优化

- **README / AIREADME 全面重写**：基于实际项目结构重写，补全所有组件、服务、工具的文档
- **版本号统一**：`package.json` / `build.gradle` / `AboutTab` / 文档站全部同步至 v1.1.0
- **SCAN_VERSION 递增至 4**：强制重新扫描以应用新的歌词提取逻辑
- **本地音乐页布局优化**：内容区域下移避免被 Hero Card 遮挡

---

## v1.0.5

### ✨ 新增

- **深度链接（Deep Link）分享**：支持 `zephyrus://song/{id}` 协议，点击分享链接直接拉起 App 并展示歌曲卡片
- **中转页（relay）**：新增分享中转页面 `relay.html`，暗色玻璃拟态设计，支持 30 秒试听分享音频，海报式布局展示封面/歌名/歌手
- **分享歌曲卡片（SharedSongCard）**：App 内弹出毛玻璃歌曲卡片，展示封面、歌名、歌手信息，点击播放按钮直接播放，支持返回键关闭
- **剪贴板智能识别**：App 从后台切回前台时自动检测剪贴板，识别到分享链接格式自动弹出歌曲卡片
- **冷启动重试机制**：深度链接冷启动时通过多次延时重试 + URL 队列缓存，确保 JS 层就绪后正确处理链接
- **海报式分享设置**：生成海报时可选左下角展示软件名或 Logo、调整透明度

### 🐛 修复

- **深度链接冷启动不弹卡片**：JS 层未就绪时调用 `__handleClipboardShare` 无响应，新增 `pendingUrl` 队列 + 多次 `postDelayed` 重试
- **歌曲卡片被底栏遮挡**：`SharedSongCard` z-index 不足且定位偏低，提升至 `100001` 并改为居中定位
- **分享卡片封面缺失**：`picUrl` 未正确传入播放器，统一 `handleDeepLink` 与 `handleClipboardShare` 的歌曲对象构建逻辑
- **深度链接偶发自动播放**：移除直接自动播放逻辑，统一通过 `SharedSongCard` 交互后播放
- **构建产物路径不匹配**：`vite build` 输出到 `dist/renderer` 而 Capacitor 期望 `out/renderer`，改用 `electron-vite build`

### 🎨 优化

- **中转页重构**：采用暗色玻璃拟态 + 琥珀色点缀设计语言，移除自动播放，与卡片交互流程统一
- **版本号升级至 v1.0.5**

---

## v1.0.0-beta

### ✨ 新增

- **雨夜播放器样式**：3D 封面 + Canvas 雨水效果 + 歌词叠加 + 底部反射，竖屏/横屏自适应布局
- **跨平台搜索（移动端）**：移动端搜索结果接入跨平台搜索，自动搜索 QQ/咪咕/酷狗/酷我/JOOX，结果去重合并
- **来源标签 + 筛选（移动端）**：搜索结果每首歌标注来源（网易云/JOOX/QQ等），支持按来源筛选
- **使用文档网站**：VitePress 文档站上线 [www.mucang.xyz/zephyrus/docs](https://www.mucang.xyz/zephyrus/docs)
- **用户协议**：首次启动弹出用户协议窗口，支持 Markdown 渲染
- **欢迎页重写**：移除原项目收款码/公众号，改为项目 GitHub 链接 + 软件图标
- **平台账号管理**：移动端支持手动输入 Cookie，localStorage fallback
- **设置-关于新增文档入口**：点击跳转到使用文档网站
- **GitHub Actions 自动构建发布**：推送 tag 自动构建 APK 并发布 Release

### 🐛 修复

- **雨夜样式移动端不显示**：`MobilePlayerSettings` 硬编码数组缺少 rain + `MusicFullWrapper` 缺少 rain 路由 + `isFeatureEnabled` 默认 false
- **平台登录报错**：`window.api.openPlatformLogin` 在移动端不存在，添加 fallback 到手动输入 Cookie
- **功能开关默认关闭**：移除额外功能面板后所有 feature flag 默认 false，改为默认 true

### 🎨 优化

- **README 重写**：新增 7 种样式说明、跨平台搜索、文档链接、下载入口
- **版本号升级至 v1.0.0-beta**

---

## v0.9.9-update

### ✨ 新增

- **跨平台搜索**：新增多平台音乐搜索能力，支持在搜索时跨网易云/QQ/酷狗/酷我等平台匹配音源
- **歌曲来源筛选**：搜索结果页新增来源筛选栏，基于 `sourceProbeService` 即时分类（零请求）+ 懒探测（策略链），动态展示每首歌曲的真实可用音源徽章
- **平台账号管理**：用户页新增 `PlatformAccounts` 组件，集中管理各音乐平台的登录状态与 Cookie
- **GdMusic API 扩展**：增强自定义音乐 API 解析能力，支持更多第三方音源接入
- **跨平台搜索服务**：主进程新增 `multiPlatformSearch` 模块，渲染层新增 `crossPlatformSearch` API

### 🐛 修复

- **诡谲/陈旧模式全屏失效**：`EeriePlayer` 与 `NeonPlayer` 缺少全屏控制逻辑，新增 `isFullScreen` 状态与 `toggleFullScreen` 方法，监听 `fullscreenchange` 事件
- **诡谲/陈旧模式遮挡侧栏与搜索框**：Overlay 模式下播放器层级过高，新增 `overlay-mode` class，设置 `z-index: 1` + `pointer-events: none` 实现穿透
- **浮动覆盖模式底部进度条不显示**：`showFullStyle` 在 overlay 模式下始终为 `true` 触发自动收起，overlay 模式下跳过自动收起逻辑
- **浮动覆盖模式搜索框无法点击**：搜索框 `z-index` 被标题栏（3000）遮挡，提升至 3002
- **设置面板缺少新样式选项**：播放器样式选项硬编码，改为从 `getAllStyles()` 动态生成，自动包含诡谲/陈旧样式
- **歌单弹窗滚动空白**：浮动覆盖模式下歌单详情列表滚动出现空白，`MusicListPage` 改为 flex 布局 + `n-scrollbar` 设为 `flex-1 min-h-0`
- **构建版本报纸纹理消失**：诡谲模式报纸滤镜在 `npm run build:win` 后失效，改用 `import.meta.glob` 动态导入确保带哈希文件名正确解析
- **LX 音源脚本初始化失败**：脚本未调用 `lx.send(EVENT_NAMES.inited)` 导致超时，Worker 新增异步初始化等待机制（10 秒窗口），超时错误附带脚本诊断信息
- **SSL 证书验证失败**：`npm run build:win` 时 electron-builder 下载资源失败，配置 npmmirror 镜像源并绕过 SSL 验证

### 🎨 优化

- **UI 统一重构**：搜索结果页、歌曲列表项、设置页、用户页、平台账号管理、高潮段落编辑器全面适配设计令牌（`--d-*`），消除视觉割裂感
- **高潮段落编辑器**：窗口改为圆角形态并加宽，播放头从红色圆点改回竖条，时间轴与段落区域改为居中圆角窗口
- **搜索栏自动收起**：浮动覆盖模式下搜索栏支持完全移出屏幕，鼠标移入顶部触发区域唤回，与侧栏/标题栏行为一致
- **语义工具类扩充**：`index.css` 新增 `.d-btn-primary` 等核心语义工具类

---

## v0.9.9

### 新增

- **VHS 录像效果**：诡谲模式（Eerie）前奏阶段模拟老旧 VHS 录像带的雪花噪点、扫描线、信号干扰与色彩偏移，营造复古诡谲氛围
- **设计令牌系统**：建立 `--d-` 前缀的桌面端设计令牌（表面/边框/阴影/圆角/字体/动画/z-index/间距），Tailwind 配置对接，统一全应用视觉规范
- **字体兼容性文档**：README 新增字体兼容性章节，记录诡谲模式与狂躁模式经实测配合较好的字体

### 修复

- **全屏按钮失效**：改用 Electron 原生 `win.setFullScreen()` 替代浏览器全屏 API，修复无边框窗口（`frame: false`）下全屏按钮失效的问题
- **设置面板白底白字**：设置面板根元素强制暗色设计令牌，替换所有硬编码 `rgba(255,255,255,...)` 颜色值，修复亮色系统主题下白底白字不可见的问题
- **贴底进度条交互冲突**：扩大贴底进度条的命中区域（`.music-time` 高度 + `n-slider` padding），避免与窗口 resize 手势冲突
- **播放栏隐藏时进度条消失**：播放栏自动隐藏时仅渐隐内容元素，进度条保持可见和可交互，并添加渐隐动画
- **VHS 效果白色累积**：修复过渡阶段切歌时诡谲模式前奏 VHS 效果白色不断累加直至占满屏幕的问题。改为动态获取底色（getter 函数），避免频繁重启动画；每帧用 `clearRect` + `setTransform` 确保画布完全清除；停止动画时清除画布残留

### 优化

- **UI 统一**：圆角/阴影统一为设计令牌工具类（`rounded-d-*` / `shadow-d-*`），页面背景统一为 `.page-bg` / `.page-card` 工具类
- **组件复用**：Magazine 模式复用 `PlayerControls` 组件（新增 `#extra` 插槽），移除重复控制代码
- **TitleBar 合并**：合并 `TitleBar` 与 `OverlayTitleBar`，自动收起行为整合到统一组件
- **主色统一**：统一主色变量为单一 `--accent-color`，移除 `--dynamic-primary` 和 `--primary-color` 的直接使用
