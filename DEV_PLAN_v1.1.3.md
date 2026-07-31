# Zephyrus Player v1.1.3 开发计划

> 本文档供其他 Agent 开发使用，包含完整的项目信息、环境信息、代码结构和逐项改造方案。

---

## 一、项目信息

| 项         | 值                                                                    |
| ---------- | --------------------------------------------------------------------- |
| 项目名称   | ZephyrusPlayer                                                        |
| 当前版本   | 1.1.2（package.json），开发目标版本 1.1.3（**不更新版本号**）         |
| 项目路径   | `c:\Users\Administrator\Desktop\zephyrus-player-android`              |
| 技术栈     | Electron + Vue 3 (Composition API) + TypeScript + Capacitor (Android) |
| UI 框架    | Naive UI + Tailwind CSS + SCSS                                        |
| 状态管理   | Pinia                                                                 |
| 路由       | Vue Router                                                            |
| 构建工具   | electron-vite (前端) + Gradle (Android)                               |
| 包管理     | npm                                                                   |
| Node.js    | v20+                                                                  |
| 移动端桥接 | Capacitor (CapacitorHttp, @capacitor/filesystem, @capacitor/share)    |

### Capacitor 配置

```
appId: com.zephyrus.player
appName: Zephyrus Player
webDir: out/renderer
androidScheme: https
allowMixedContent: true
CapacitorHttp: enabled
```

---

## 二、云服务器信息

| 项               | 值                                                                           |
| ---------------- | ---------------------------------------------------------------------------- |
| 服务器 IP        | `43.250.173.177`                                                             |
| SSH 用户名       | `root`                                                                       |
| SSH 密码         | 通过本机 `ZEPHYRUS_SSH_PASSWORD` 环境变量提供                                |
| SSH Host Key     | `SHA256:zOoEmSvJeh53xMMXScTCFxr+mQ8ZlUAHqmmHapNI520`                         |
| SCP 工具         | `c:\Users\Administrator\Desktop\pscp.exe`                                    |
| SSH 工具         | `c:\Users\Administrator\Desktop\plink.exe`                                   |
| 域名             | `mucang.xyz` (HTTPS, Let's Encrypt)                                          |
| Nginx 配置       | `/etc/nginx/sites-enabled/mucang`                                            |
| API 服务         | PM2 管理，进程名 `netease-api`，基于 `netease-cloud-music-api-alger` v4.32.0 |
| API 路径         | `https://mucang.xyz/zephyrus/api/` → `http://127.0.0.1:3000/`                |
| APK 下载         | `https://mucang.xyz/zephyrus/apks/zephyrus-player-latest.apk`                |
| APK 存储目录     | `/var/www/zephyrus/apks/`                                                    |
| 平台登录路由文件 | `/opt/netease-api/platformLogin.js`                                          |
| API 主文件       | `/opt/netease-api/server.js`                                                 |

### SSH 连接示例（PowerShell）

```powershell
$pw = $env:ZEPHYRUS_SSH_PASSWORD
& "c:\Users\Administrator\Desktop\plink.exe" -ssh -hostkey "SHA256:zOoEmSvJeh53xMMXScTCFxr+mQ8ZlUAHqmmHapNI520" -pw $pw -batch root@43.250.173.177 "命令"
```

### SCP 上传示例

```powershell
& "c:\Users\Administrator\Desktop\pscp.exe" -C -hostkey "SHA256:zOoEmSvJeh53xMMXScTCFxr+mQ8ZlUAHqmmHapNI520" -pw $env:ZEPHYRUS_SSH_PASSWORD "本地路径" "root@43.250.173.177:/远程路径"
```

### 服务器端 QQ/酷狗 扫码登录中转 API

- `GET /platform/qq/qr/create` — 创建 QQ 二维码（返回 base64 图片 + qrsig key）
- `GET /platform/qq/qr/poll?key=xxx` — 轮询 QQ 扫码状态（需要 qrsig Cookie，服务器端已实现会话管理）
- `GET /platform/kugou/qr/create` — 创建酷狗二维码（返回网页 URL + key）
- `GET /platform/kugou/qr/poll?key=xxx` — 轮询酷狗扫码状态
- `GET /platform/qr-display?platform=qq|kugou` — 动态二维码展示页面（供其他设备扫码）

---

## 三、本地构建与部署

### 前端构建

```bash
cd c:\Users\Administrator\Desktop\zephyrus-player-android
npm run build          # electron-vite build，输出到 out/renderer/
```

### Android APK 构建

```bash
cd c:\Users\Administrator\Desktop\zephyrus-player-android
npx cap sync android   # 同步前端到 android/assets/public
cd android
.\gradlew.bat assembleRelease  # 构建 APK
# 输出: android/app/build/outputs/apk/release/app-release.apk
```

### APK 上传到服务器

```powershell
& "c:\Users\Administrator\Desktop\pscp.exe" -C -hostkey "SHA256:zOoEmSvJeh53xMMXScTCFxr+mQ8ZlUAHqmmHapNI520" -pw $env:ZEPHYRUS_SSH_PASSWORD "c:\Users\Administrator\Desktop\zephyrus-player-android\android\app\build\outputs\apk\release\app-release.apk" "root@43.250.173.177:/var/www/zephyrus/apks/zephyrus-player-v1.1.3.apk"
```

### 更新 latest 软链接

```bash
cd /var/www/zephyrus/apks/ && ln -sf zephyrus-player-v1.1.3.apk zephyrus-player-latest.apk
```

---

## 四、改造任务清单

### 任务 1：QQ/酷狗登录成功后设置用户状态

**问题：** QQ/酷狗扫码登录成功后，`login/index.vue` 的 `handlePlatformLoginSuccess` 回调什么都不做，只是 `router.back()`，导致 user store 里没有用户数据，「我的页」依然显示未登录。

**涉及文件：**

| 文件            | 路径                                                                    |
| --------------- | ----------------------------------------------------------------------- |
| 登录页          | `src/renderer/views/login/index.vue`                                    |
| 扫码登录组件    | `src/renderer/components/login/PlatformQrLogin.vue`                     |
| Cookie 登录组件 | `src/renderer/components/login/PlatformCookieLogin.vue`                 |
| 用户 Store      | `src/renderer/store/modules/user.ts`                                    |
| 服务器端路由    | `server-platform-login.js` → 部署到 `/opt/netease-api/platformLogin.js` |

**当前代码（`login/index.vue` 第 203 行）：**

```typescript
const handlePlatformLoginSuccess = (_userInfo: any, _cookie: string) => {
  // 平台登录成功后返回上一页或用户页
  setTimeout(() => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/user');
    }
  }, 1000);
};
```

**改造方案：**

1. `handlePlatformLoginSuccess` 中：
   - 调用 `userStore.setUser({ userId: userInfo.userId || 0, nickname: userInfo.nickname || '平台用户', avatarUrl: userInfo.avatarUrl || '' })`
   - 调用 `userStore.setLoginType('cookie')`
   - Cookie 存入 `localStorage.setItem('platform-cookie-' + platform, cookie)`
   - 同时存入 `localStorage.setItem('token', cookie)` 以兼容需要 token 的 API
   - 跳转到 `/user` 页面

2. 服务器端 `platformLogin.js`：
   - QQ 登录成功时，尝试从重定向 URL 的响应中解析真实昵称（目前硬编码为 `'QQ音乐用户'`）
   - 酷狗登录成功时，调用酷狗的用户信息 API 获取 nickname 和 userId

3. `PlatformQrLogin.vue` 的 `emit` 确保 platform 信息也传递：
   ```typescript
   emit('loginSuccess', result.userInfo || {}, result.cookie || '');
   ```

---

### 任务 2：重写平台账号页 UI 和逻辑

**问题：**

- Cookie 直接显示在卡片上导致溢出屏幕
- 不支持网易云、QQ、酷狗、JOOX 四家统一管理
- 需要切换展示账号的地方

**涉及文件：**

| 文件         | 路径                                                                       |
| ------------ | -------------------------------------------------------------------------- |
| 平台账号组件 | `src/renderer/components/user/PlatformAccounts.vue`（完全重写）            |
| 用户页       | `src/renderer/views/user/index.vue`（第 95 行引用 `<PlatformAccounts />`） |
| 用户 Store   | `src/renderer/store/modules/user.ts`（可能需要添加平台账号状态）           |

**当前 `PlatformAccounts.vue` 结构：**

- 显示 5 个平台卡片：QQ、咪咕、JOOX、酷狗、酷我
- 每个卡片有图标、名称、状态徽章、登录/退出按钮
- 底部有手动 Cookie 输入区（select + textarea + save 按钮）
- Cookie 内容通过 `localStorage` 的 `platform-cookie-{key}` 管理

**重写方案：**

1. **四家平台：** 网易云、QQ、酷狗、JOOX（移除咪咕和酷我）

2. **每个平台卡片显示：**
   - 平台 Logo + 名称
   - 登录方式标签（如「扫码登录」「Cookie 登录」）— **不显示 Cookie 内容**
   - 已登录时显示用户昵称（从 `localStorage` 或 store 读取）
   - 已登录 / 未登录状态徽章
   - 登录按钮 → 跳转 `/login?platform=xxx`
   - 退出登录按钮

3. **网易云卡片：** 从 `userStore.user` 和 `userStore.loginType` 读取当前网易云登录状态

4. **QQ/酷狗卡片：** 从 `localStorage` 读取 `platform-cookie-qq` / `platform-cookie-kugou` 判断登录状态；从 `localStorage` 读取 `platform-user-qq` / `platform-user-kugou` 读取用户昵称

5. **JOOX 卡片：** 从 `localStorage` 读取 `platform-cookie-joox`；支持手动 Cookie 输入（内嵌展开式，不是底部独立区域）

6. **UI 风格：** 使用项目现有的 CSS 变量体系（`--d-text-primary`、`--d-surface-alt`、`--accent-color` 等），与「我的页」hero-card 风格一致

7. **移除：** 底部手动 Cookie 折叠区域（改到各平台卡片内部）

---

### 任务 3：歌曲项右侧只保留竖向三点菜单按钮

**问题：** 当前歌曲项右侧有播放指示器 + 三点菜单，且 hover 才显示菜单按钮，移动端需要长按才能弹出操作菜单。用户要求：右侧只加一个竖向三个点，点击呼出菜单（移动端长按菜单），菜单里要有歌曲作者和专辑的跳转项。

**涉及文件：**

| 文件           | 路径                                                              | 说明                |
| -------------- | ----------------------------------------------------------------- | ------------------- |
| 基础歌曲项     | `src/renderer/components/common/songItemCom/BaseSongItem.vue`     | 触摸/点击逻辑       |
| 标准歌曲项     | `src/renderer/components/common/songItemCom/StandardSongItem.vue` | 桌面端列表          |
| 紧凑歌曲项     | `src/renderer/components/common/songItemCom/CompactSongItem.vue`  | 紧凑列表            |
| 列表歌曲项     | `src/renderer/components/common/songItemCom/ListSongItem.vue`     | 搜索结果列表        |
| 首页歌曲项     | `src/renderer/components/common/songItemCom/HomeSongItem.vue`     | 首页推荐            |
| 迷你歌曲项     | `src/renderer/components/common/songItemCom/MiniSongItem.vue`     | 迷你模式            |
| 歌曲项 Hook    | `src/renderer/hooks/useSongItem.ts`                               | 公共逻辑            |
| 移动端操作面板 | `src/renderer/components/common/MobileSongActionSheet.vue`        | 移动端长按菜单      |
| 桌面端下拉菜单 | `src/renderer/components/common/songItemCom/SongItemDropdown.vue` | 桌面端右键/点击菜单 |

**当前状态：**

- `BaseSongItem.vue` 有 `@mouseenter`/`@mouseleave` 控制悬浮，`@touchstart`/`@touchend` 控制长按
- `StandardSongItem.vue` 和 `CompactSongItem.vue` 的三点菜单通过 `:class="{ 'opacity-0': !isHovering && !isPlaying }"` 控制显隐
- `HomeSongItem.vue` 的 more-btn 通过 `opacity-0 group-hover:opacity-100` 控制显隐
- `MobileSongActionSheet.vue` 已有「跳转歌手」和「跳转专辑」的按钮
- `SongItemDropdown.vue`（桌面端）也已有 `gotoArtist` 和 `gotoAlbum` 选项

**改造方案：**

1. **所有歌曲项变体（StandardSongItem / CompactSongItem / ListSongItem / HomeSongItem）：**
   - 三点菜单按钮**始终可见**（移除 `opacity-0` / `group-hover:opacity-100` 逻辑）
   - 只保留竖向三点图标 `ri-more-vertical-fill`
   - 移除播放状态指示器旁的其他操作元素
   - 播放指示器仍然保留，但放在三点按钮左侧

2. **`BaseSongItem.vue` 触摸逻辑改造：**
   - 移除 `@mouseenter` / `@mouseleave` 绑定（不再用 hover 控制菜单显隐）
   - `isHovering` 改为点击三点按钮时设为 `true`，3 秒后自动设为 `false`
   - `@touchstart` / `@touchend` 保留长按逻辑，但长按只弹出 `MobileSongActionSheet`，**不触发播放**
   - 点击 (`@click`) 触发播放

3. **长按不触发播放：**
   - 在 `handleTouchStart` 中记录开始时间 `touchStartTime`
   - 在 `handleTouchEnd` 中：
     - 如果按压时间 > 500ms → 长按，显示 `showActionSheet = true`，设置 `longPressTriggered = true`
     - 在 `handleItemClick` 中检查 `longPressTriggered`，如果为 `true` 则阻止播放并重置标志
   - 在 `handleClick` 中添加延迟检查：如果距离 `touchEndTime` 很近且 `longPressTriggered` 为 `true`，则 `return`

4. **`MobileSongActionSheet.vue` 确认菜单项：**
   - 当前已有：播放、下一首播放、跳转歌手、跳转专辑、添加到歌单、收藏、移除
   - **确认**歌手和专辑跳转项存在且正常工作（已有，无需修改）
   - 如果有多个歌手，目前只跳转第一个歌手（`firstArtistId`），可考虑支持选择

5. **`SongItemDropdown.vue`（桌面端）确认菜单项：**
   - 当前已有：播放、下一首、跳转歌手、跳转专辑、下载、下载歌词、绑定本地歌词、添加到歌单、收藏、不喜欢、移除
   - **无需修改**，已满足要求

6. **CSS 改造：**
   - `StandardSongItem.vue`：移除 `&:hover { background: var(--d-surface-hover); .opacity-0 { opacity: 1; } }` 中的 `.opacity-0` 规则
   - `CompactSongItem.vue`：同上
   - `HomeSongItem.vue`：将 `opacity-0 group-hover:opacity-100` 改为 `opacity-100`（始终可见）
   - 背景 hover 效果改为 `:active` 或点击态

---

### 任务 4：歌曲项专辑点击范围缩小

**问题：** `StandardSongItem.vue` 第 59 行，整个 `song-item-content-album` div 都绑定了 `@click.stop="onAlbumClick"`，区域太大容易误触。

**涉及文件：**

| 文件       | 路径                                                              |
| ---------- | ----------------------------------------------------------------- |
| 标准歌曲项 | `src/renderer/components/common/songItemCom/StandardSongItem.vue` |
| 紧凑歌曲项 | `src/renderer/components/common/songItemCom/CompactSongItem.vue`  |

**当前代码（`StandardSongItem.vue` 第 59-61 行）：**

```html
<div v-if="item.al?.name" class="song-item-content-album" @click.stop="onAlbumClick">
  <n-ellipsis class="text-ellipsis" line-clamp="1">{{ item.al.name }}</n-ellipsis>
</div>
```

**改造方案：**

- 将 `@click.stop` 从外层 div 移到内层 `<n-ellipsis>` 或添加一个独立的可点击文字元素
- 缩小 `padding` 和点击区域，只让文字本身可点击
- 或者移除专辑名的点击跳转功能，改为只能通过三点菜单跳转专辑（更彻底地避免误触）
- 推荐方案：**移除专辑名的直接点击跳转**，专辑跳转统一通过三点菜单操作

---

### 任务 5：鼠标悬停效果改为点击效果

**问题：** 歌曲项的背景高亮、菜单按钮显隐都依赖 `:hover` 伪类和 `@mouseenter`/`@mouseleave`，在移动端无意义且体验不一致。要求改为点击效果，停留一下就消失。

**涉及文件：**

| 文件        | 路径                                                              |
| ----------- | ----------------------------------------------------------------- |
| 基础歌曲项  | `src/renderer/components/common/songItemCom/BaseSongItem.vue`     |
| 标准歌曲项  | `src/renderer/components/common/songItemCom/StandardSongItem.vue` |
| 紧凑歌曲项  | `src/renderer/components/common/songItemCom/CompactSongItem.vue`  |
| 列表歌曲项  | `src/renderer/components/common/songItemCom/ListSongItem.vue`     |
| 首页歌曲项  | `src/renderer/components/common/songItemCom/HomeSongItem.vue`     |
| 歌曲项 Hook | `src/renderer/hooks/useSongItem.ts`                               |

**改造方案：**

1. **`useSongItem.ts`：**
   - `isHovering` 重命名概念为 `isActive`（或保留名称但语义改变）
   - 添加 `activateTimeout` 变量
   - 新增 `activate()` 方法：设置 `isHovering.value = true`，3 秒后自动设为 `false`
   - `handleMouseEnter` / `handleMouseLeave` 改为空函数或移除

2. **`BaseSongItem.vue`：**
   - 移除 `@mouseenter` / `@mouseleave` 事件绑定
   - 在 `@click` 中调用 `activate()` 激活高亮态

3. **CSS 改造（所有变体）：**
   - `:hover` 背景色改为 `.is-active` 类或 `:active` 伪类
   - 三点菜单按钮始终可见（任务 3 已涵盖）

---

### 任务 6：歌单卡片收起状态显示「定位当前歌曲」按钮

**问题：** `MusicListPage.vue` 中「定位当前播放」按钮只在展开的 hero-controls 区域显示，收起状态（compact）时按钮隐藏，用户无法快速定位。

**涉及文件：**

| 文件       | 路径                                         |
| ---------- | -------------------------------------------- |
| 音乐列表页 | `src/renderer/views/music/MusicListPage.vue` |

**当前代码（第 112 行）：**

```html
<button
  v-if="currentPlayingIndex >= 0"
  class="icon-btn"
  :title="t('comp.musicList.locateCurrent', '定位当前播放')"
  @click="scrollToCurrentSong"
>
  <i class="ri-focus-3-line" />
</button>
```

此按钮在 `hero-controls` 内，`compact` 状态时被 `controls-extra` 包裹并隐藏。

**改造方案：**

1. 在 `hero-controls` 的核心区域（`compact` 时仍然可见的区域，如播放按钮旁边）添加「定位当前歌曲」按钮
2. 或者添加一个浮动的 `position: fixed` / `position: sticky` 按钮，只在 `isCompact && currentPlayingIndex >= 0` 时显示
3. 按钮样式与现有 `icon-btn` 一致，使用 `ri-focus-3-line` 图标
4. 点击行为复用现有的 `scrollToCurrentSong` 方法

---

### 任务 7：搜索结果页点击搜索框弹出历史/建议

**问题：** 在搜索结果页时，再次点击搜索框，如果搜索框为空则弹出搜索历史悬浮菜单，如果有内容则显示搜索建议。目前搜索结果页没有这个交互。

**涉及文件：**

| 文件         | 路径                                                   | 说明                         |
| ------------ | ------------------------------------------------------ | ---------------------------- |
| 浮动搜索栏   | `src/renderer/layout/components/FloatingSearchBar.vue` | 桌面端搜索栏（Overlay 模式） |
| 移动端搜索页 | `src/renderer/views/mobile-search/index.vue`           | 移动端搜索入口               |
| 移动端头部   | `src/renderer/layout/components/MobileHeader.vue`      | 移动端顶栏（含搜索入口）     |
| 搜索结果页   | `src/renderer/views/search/SearchResult.vue`           | 桌面端搜索结果               |
| 移动搜索结果 | `src/renderer/views/mobile-search-result/index.vue`    | 移动端搜索结果               |
| 搜索 API     | `src/renderer/api/search.ts`                           | `getSearchSuggestions` 函数  |
| 搜索 Store   | `src/renderer/store/modules/search.ts`                 | `searchValue`、`searchType`  |

**当前行为：**

- `FloatingSearchBar.vue`（桌面端）：已有搜索历史和建议功能，通过 `n-popover` + `showSuggestions` 控制
  - 搜索框为空时显示历史记录（`isShowingHistory`）
  - 有输入时显示搜索建议（`suggestions`）
  - 但这个交互只在浮动搜索栏本身可用，搜索结果页是通过浮动面板打开的

- `mobile-search/index.vue`：已有搜索历史和建议，但是是一个独立全屏页面
- `MobileHeader.vue`：移动端顶栏有一个搜索入口，点击跳转到 `/mobile-search`

**改造方案（移动端为主）：**

1. **移动端搜索结果页（`mobile-search-result/index.vue`）：**
   - 在页面顶部添加一个搜索输入框（如果还没有的话）
   - 点击搜索框时：
     - 如果搜索框为空 → 下方弹出悬浮菜单显示搜索历史（从 `localStorage` 的 `mobile_search_history` 读取）
     - 如果搜索框有内容 → 下方弹出悬浮菜单显示搜索建议（调用 `getSearchSuggestions` API，防抖 300ms）
   - 悬浮菜单使用 `position: absolute` 或 `n-popover` 实现
   - 点击历史/建议项直接搜索

2. **移动端搜索入口（`MobileHeader.vue`）：**
   - 如果当前已在搜索结果页，点击搜索框不再跳转 `/mobile-search`，而是在原地弹出历史/建议
   - 如果不在搜索结果页，点击搜索框跳转 `/mobile-search`

3. **搜索历史存储：**
   - 移动端使用 `localStorage` key: `mobile_search_history`（字符串数组）
   - 桌面端使用 `localStorage` key: `searchHistory`（对象数组 `{ keyword, type }`）
   - 保持两套独立的历史记录

4. **搜索建议 API：**
   - 已有 `getSearchSuggestions(keyword)` 函数在 `src/renderer/api/search.ts`
   - 返回 `string[]` 类型
   - 使用 `useDebounceFn` 防抖 300ms

---

## 五、执行优先级

| 优先级 | 任务   | 说明                                         |
| ------ | ------ | -------------------------------------------- |
| P0     | 任务 1 | QQ/酷狗登录成功后设置用户状态 — 核心功能修复 |
| P0     | 任务 2 | 重写平台账号页 UI — 核心交互改造             |
| P1     | 任务 3 | 歌曲项右侧只保留竖向三点菜单 — 交互统一      |
| P1     | 任务 5 | 鼠标悬停改为点击效果 — 与任务 3 关联         |
| P1     | 任务 4 | 专辑点击范围缩小 — 与任务 3 关联             |
| P2     | 任务 6 | 歌单卡片收起态定位按钮 — 体验优化            |
| P2     | 任务 7 | 搜索结果页搜索框历史/建议 — 体验优化         |

---

## 六、关键代码位置索引

| 功能             | 文件路径                                                          | 关键行号/函数                            |
| ---------------- | ----------------------------------------------------------------- | ---------------------------------------- |
| 登录页平台切换   | `src/renderer/views/login/index.vue`                              | `handlePlatformLoginSuccess` (第 203 行) |
| 扫码登录组件     | `src/renderer/components/login/PlatformQrLogin.vue`               | `emit('loginSuccess')` (第 208 行)       |
| Cookie 登录组件  | `src/renderer/components/login/PlatformCookieLogin.vue`           | —                                        |
| 平台账号展示     | `src/renderer/components/user/PlatformAccounts.vue`               | 完整文件                                 |
| 用户页           | `src/renderer/views/user/index.vue`                               | 第 95 行 `<PlatformAccounts />`          |
| 用户 Store       | `src/renderer/store/modules/user.ts`                              | `setUser`, `setLoginType`                |
| 歌曲项基类       | `src/renderer/components/common/songItemCom/BaseSongItem.vue`     | `handleItemClick`, `handleTouchStart`    |
| 歌曲项 Hook      | `src/renderer/hooks/useSongItem.ts`                               | `isHovering`, `handleMouseEnter`         |
| 标准歌曲项       | `src/renderer/components/common/songItemCom/StandardSongItem.vue` | 第 59 行专辑点击                         |
| 紧凑歌曲项       | `src/renderer/components/common/songItemCom/CompactSongItem.vue`  | 第 59 行专辑区域                         |
| 列表歌曲项       | `src/renderer/components/common/songItemCom/ListSongItem.vue`     | 操作菜单                                 |
| 首页歌曲项       | `src/renderer/components/common/songItemCom/HomeSongItem.vue`     | `more-btn` opacity                       |
| 移动端操作面板   | `src/renderer/components/common/MobileSongActionSheet.vue`        | 已有歌手/专辑跳转                        |
| 桌面端下拉菜单   | `src/renderer/components/common/songItemCom/SongItemDropdown.vue` | 已有 gotoArtist/gotoAlbum                |
| 音乐列表页       | `src/renderer/views/music/MusicListPage.vue`                      | `scrollToCurrentSong` (第 786 行)        |
| 浮动搜索栏       | `src/renderer/layout/components/FloatingSearchBar.vue`            | `showSuggestions`, `isShowingHistory`    |
| 移动端搜索页     | `src/renderer/views/mobile-search/index.vue`                      | `searchHistory`, `suggestions`           |
| 移动端头部       | `src/renderer/layout/components/MobileHeader.vue`                 | 搜索入口                                 |
| 平台 API 封装    | `src/renderer/api/platformQrApi.ts`                               | `createPlatformQr`, `pollPlatformQr`     |
| 服务器端路由     | `server-platform-login.js`                                        | QQ/酷狗扫码中转                          |
| Capacitor 配置   | `capacitor.config.ts`                                             | —                                        |
| Android 构建配置 | `android/app/build.gradle`                                        | signingConfigs, release                  |
| package.json     | `package.json`                                                    | version: "1.1.2" → 改为 "1.1.3"          |

---

## 七、注意事项

1. **版本号不更新**：当前 `package.json` 版本为 `1.1.2`，本次开发目标版本号为 `1.1.3`，但用户明确要求**不更新版本号**。如果需要构建 APK，版本号保持不变。

2. **移动端与桌面端差异**：
   - 桌面端（Electron）：`isElectron === true`，有 `window.api` IPC 通道
   - 移动端（Capacitor）：`isElectron === false`，使用 `CapacitorHttp` 或服务器中转
   - 歌曲项交互改造需要同时考虑两端

3. **CSS 变量体系**：项目使用大量 CSS 自定义属性，修改样式时注意使用现有变量：
   - `--d-text-primary`、`--d-text-secondary`、`--d-text-muted`
   - `--d-surface`、`--d-surface-alt`、`--d-surface-hover`
   - `--d-border`、`--d-border-light`
   - `--d-radius-lg`、`--d-radius-sm`
   - `--accent-color`
   - `--cover-text-primary`、`--cover-surface`（封面背景相关）

4. **i18n**：项目使用 `vue-i18n`，新增文本需要添加到 `src/i18n/lang/zh-CN/` 下对应文件

5. **服务器端部署**：修改 `server-platform-login.js` 后需要：

   ```bash
   # 上传到服务器
   pscp server-platform-login.js root@43.250.173.177:/opt/netease-api/platformLogin.js
   # 重启 PM2
   ssh root@43.250.173.177 "pm2 restart netease-api"
   ```

6. **APK 构建**：修改前端代码后需要 `npm run build` → `npx cap sync android` → `gradlew.bat assembleRelease` 三步

7. **搜索历史存储 key**：
   - 桌面端浮动搜索栏：`searchHistory`（JSON 数组，`{ keyword, type }` 格式）
   - 移动端搜索页：`mobile_search_history`（JSON 数组，纯字符串格式）
