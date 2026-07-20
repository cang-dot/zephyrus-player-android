# Zephyrus Player 更新日志

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
