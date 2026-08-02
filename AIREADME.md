# AIREADME — AI 协作开发指南

> 本文件供 AI 助手快速理解项目架构、开发规范与已知陷阱。
> **每次修改代码后必须提交一次 commit。** 推送 / 打 tag / 发布需用户明确授权。
> 另见同目录 `AGENTRULES.md`（强制行为规范）与 `DEV_PLAN_v1.1.3.md`（服务器部署细节）。

## 项目关系

| 项目 | GitHub |
|------|--------|
| **安卓版（本仓库）** | [cang-dot/zephyrus-player-android](https://github.com/cang-dot/zephyrus-player-android) |
| **桌面版（Electron）** | [cang-dot/zephyrus-player](https://github.com/cang-dot/zephyrus-player) |

两仓库共享渲染层设计，但本仓库是独立维护的 Android 版本（Capacitor），版本号：**v1.1.3-beta**。

---

## 一、平台概述

纯 Android 应用：Capacitor 8 + Android WebView 渲染 Vue 3 前端，Java `NativeBridge` 提供原生能力。
仓库同时保留 Electron 主进程代码（桌面兼容），移动端运行时只用 WebView 渲染层 + 原生桥接。

| 层 | 技术 |
|---|---|
| 前端 | Vue 3.5 + TypeScript 5.9 + Vite 6 + Pinia + Tailwind/SCSS |
| 原生壳 | Capacitor 8（`com.zephyrus.player`） |
| 原生桥接 | `NativeBridge.java` + `@JavascriptInterface` |
| 音频 | Howler.js + Web Audio API + `LocalAudioPlayer` |
| 动画 | GSAP + CSS/WAAPI（FLIP 用 WAAPI，避免 CSS 动画覆盖） |

移动端/桌面端通过 `isMobile` / `isElectron`（`src/renderer/utils`）区分：

- 移动端独有：`MobileLayout.vue`、`MobileHeader.vue`、`MobilePlayBar.vue`、深度链接、本地音乐原生扫描
- 桌面端独有：`AppLayout` / `MiniLayout` / `OverlayLayout`、`TitleBar`、侧栏、快捷键
- 共享：播放器样式组件、stores、services、hooks、i18n

---

## 二、常用命令

```bash
npm run dev:web          # 浏览器调试
npm run typecheck        # node + web 类型检查（仓库存在历史存量报错，仅关注本次改动）
npm run build            # 构建 Web 资源 → out/renderer
npx cap sync android     # 同步到 Android 工程
cd android && ./gradlew.bat assembleDebug   # debug APK
```

APK 输出：`android/app/build/outputs/apk/debug/app-debug.apk`
安装到设备：`adb -s <device> install -r <apk>`

### CI/CD

`.github/workflows/build.yml`：推送 `v*` 标签自动构建**签名 Release APK** 并发布 GitHub Release；
支持 `workflow_dispatch` 手动触发。更新检查走 GitHub Releases API，下载走服务器直链
`https://mucang.xyz/zephyrus/apks/zephyrus-player-latest.apk`。

---

## 三、项目结构

```
src/
├── main/                    # Electron 主进程（桌面兼容）
│   ├── modules/platformLogin.ts   # QQ/酷狗扫码登录（IPC，桌面端）
│   └── modules/multiPlatformSearch.ts
├── preload/                 # Electron IPC 桥
├── renderer/                # ★★ Vue 渲染层（核心）
│   ├── api/
│   │   ├── platformQrApi.ts # 移动端扫码网关客户端（/platform/*）
│   │   ├── serverSongs.ts   # 云端歌曲库（songs.json）+ 高潮归一化
│   │   ├── climax.ts        # 社区高潮标注 API
│   │   └── kugouPlayback.ts # 网易云匹配（封面/音源）
│   ├── components/
│   │   ├── lyric/           # 播放器样式组件（MusicFullMobile 等）
│   │   ├── login/           # 扫码登录 UI
│   │   └── user/            # 账号切换/平台账号
│   ├── layout/MobileLayout.vue   # 移动端主布局
│   ├── playerStyles/        # 样式注册表（默认/stage/frenzy/eerie/neon/magazine/rain/starChart）
│   ├── store/modules/       # Pinia（player/communityData/climax/platformAccounts/settings…）
│   └── views/               # home/search/music/user/set/…
├── shared/                  # 跨端共享（appUpdate 等）
android/                     # Capacitor 原生壳 + NativeBridge + 播放前台服务
website/                     # VitePress 文档站（mucang.xyz/zephyrus/docs）
server-platform-login.js     # ★ 多平台扫码登录/搜索/账号数据网关（部署到服务器）
```

---

## 四、核心架构要点

### 模块化首页（ModularHome.vue）★★

- 布局持久化：`localStorage['homeLayoutV2']`（cards + blocks，w 1-4 / h 1-2）
- 拖拽：pointer 事件 + 长按进入编辑；**必须挂非 passive `touchmove` 拦截器**，
  否则浏览器接管手势触发 `pointercancel`，拖拽立刻回弹
- FLIP 动画：**必须用 WAAPI（`element.animate`）**，编辑态 jiggle 是无限 CSS 动画，
  会覆盖内联 transform 导致动画不可见
- 编辑模式：删除按钮需 `@pointerdown.stop`（否则误判为拖动）；点击空白（未滑动）退出编辑
- 尺寸变化用 translate+scale 的 FLIP 平滑过渡；拖拽时按指针所在网格单元实时避让

### 播放器样式路由

`MusicFullWrapper.vue` 根据 `playerStyle` 分发到各移动端组件。**移动端默认样式
（MusicFullMobile）不再使用 n-drawer**（其 Teleport 行为会导致层级/动画问题），
改为就地渲染的全屏容器。全屏播放器渲染在 `MobilePlayBar` 内，开合无自定义动画（已回滚）。

### 高潮数据链路

- 云端歌曲：`songs.json` 的 `climax`（毫秒数组，**只信人工标注**）→ `communityData.climaxSegments`
  → `styleEngine` → 各播放器
- 云端歌曲也先查社区标注（`/api/climax/:platformId`），无标注回退 songs.json
- 在线歌曲：社区 `/api/climax/:songId` + IndexedDB 缓存
- 本地歌曲：IndexedDB（`cacheService`）
- 实时检测：`climaxDetector.ts`（RMS 能量）作为补充，不参与时段判定

### 多平台账号与扫码登录

- 移动端登录走**服务器网关** `server-platform-login.js`（mucang.xyz `/zephyrus/api/platform/*`）
- QQ 登录链路：ptqrshow → ptqrlogin → check_sig → OAuth authorize → QQLogin
  - **zzc 签名必须用 2026 版参数**（索引 [23,14,6,36,16,7,19] 等），旧版参数会返回错误码 2000
  - `mergeCookieParts` 必须跳过空值 Cookie（QQ 用 `p_skey=;` 清除旧值，会覆盖真值）
  - 用户信息取 `GetLoginUserInfo`，兜底公开主页 `fcg_get_profile_homepage`
- 账号数据：创建歌单 `GetPlaylistByUin`（用 `tid` 当 id）、收藏歌单 `CgiGetPlaylistFavInfo`、
  收藏专辑 `CgiGetAlbumFavInfo`（需 `encrypt_uin`）；字段是 camelCase（`dirId/dirName/songNum`）
- 平台搜索：`/platform/qq/search`、`/platform/kugou/search`，登录后解锁；结果按匹配度排序
- 封面：QQ/酷狗 CDN 无 CORS 头，`crossorigin="anonymous"` 会黑图；
  歌单加载时用网易云匹配结果覆盖封面（`resolveNeteaseMatch`）

### 更新检查

`src/renderer/utils/update.ts`：查 GitHub Releases（走代理），与 `package.json` 版本比较；
下载走服务器直链 `zephyrus-player-latest.apk`。发布新版本：打 `v*` tag → CI 出 Release →
把 APK 上传服务器并更新 `latest` 软链。

### 后台保活（原生）

设置 `setData.backgroundKeepAlive` → `NativeBridge.setBackgroundKeepAlive` →
`MusicPlaybackService` 持有音频焦点（AUDIOFOCUS_GAIN，失焦抢回），SharedPreferences 持久化。

---

## 五、代码约定

- i18n：五语言（zh-CN 为源 / en-US / ja-JP / ko-KR / zh-Hant），新增 key 必须五份同步
  （`npm run lint:i18n` 校验）
- ESLint/Prettier：提交前对**改动文件**运行 `npx eslint --fix <files>`；
  仓库存在历史存量 lint 错误，提交可 `--no-verify`（不要顺手批量重排无关文件）
- 不引入未经评估的新依赖；改动尽量局部化

---

## 六、服务器部署

| 项 | 值 |
|---|---|
| 服务器 | `43.250.173.177`（root，SSH 密码在 `ZEPHYRUS_SSH_PASSWORD`） |
| 工具 | `C:\Users\Administrator\Desktop\plink.exe` / `pscp.exe` |
| 网关 | `/opt/netease-api/platformLogin.js` ← 本仓库 `server-platform-login.js`，PM2 `netease-api` |
| 云端歌曲 | `/var/www/mucang/server-music/`（songs.json / audio / covers / lyrics） |
| 社区数据 | `/opt/thymos-climax-server`（SQLite `db/climax.db`，端口 30188） |
| 文档站 | `/var/www/zephyrus/docs`（由 `website/` 构建后 `deploy_docs.py` 部署） |
| APK | `/var/www/zephyrus/apks/`（`zephyrus-player-latest.apk` 软链） |

网关部署：`pscp server-platform-login.js → /opt/netease-api/platformLogin.js`，再 `pm2 restart netease-api`。
修改 `songs.json` 前先备份（`cp songs.json songs.json.bak-<date>`）。

---

## 七、注意事项

1. **不要批量改代码**：所有修改逐文件手工编辑；格式化只对本次涉及的文件执行
2. 推送需用户明确授权；`git remote` 已配置 Token
3. 安卓真机调试：`adb devices`；测试设备可能离线，先 `adb reconnect`
4. 桌面版仓库改动需另行同步（本仓库与桌面版独立维护）
5. 播放器开合动画、n-drawer 相关改动风险高，改动前先读 `MusicFullMobile.vue` 与 `MobilePlayBar.vue`
