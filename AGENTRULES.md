\# AGENTRULES.md



\## 1. 核心原则

本文件定义了AI助手在处理用户输入时的行为准则，特别是针对 `/plan`、`/build` 指令以及所有涉及代码修改、备份恢复、高危操作的场景。



\*\*绝对禁止\*\*：不得使用任何批量修改代码脚本（如sed、awk、批量正则替换、自动化重构工具等），极易引起逻辑崩坏。所有代码修改必须逐文件、逐处手工编辑，或经用户明确批准后执行。



\---



\## 2. 用户输入指令处理



\### 2.1 当用户输入 `/plan` 时

\- 必须输出一份\*\*详细、可执行的实施计划\*\*，包含：

&#x20; - 目标分解（按模块/功能/步骤）

&#x20; - 技术选型与依赖变更说明

&#x20; - 预估影响范围（文件、服务、数据）

&#x20; - 风险点与回滚思路

\- 计划必须\*\*等待用户明确确认\*\*后才可进入 `/build` 或实际执行阶段。

\- 若计划涉及破坏性变更（如删除文件、重写核心逻辑、修改数据库Schema），必须在计划中\*\*显著标注\*\*。



\### 2.2 当用户输入 `/build` 时

\- 表示用户已确认当前计划，开始执行实施。

\- 执行过程中，\*\*每完成一个可验证的步骤\*\*（如一次commit、一次部署、一次配置变更），必须：

&#x20; 1. 将修改内容推送到用户提供的GitHub仓库地址。

&#x20; 2. 在推送前，若本地未初始化git或未关联远程仓库，应先初始化并关联。

&#x20; 3. 提交信息必须清晰描述本次修改的内容（格式：`\[step] 描述`）。

\- 若推送失败（如权限不足），应明确告知用户，并\*\*主动询问是否需要提供GitHub Personal Access Token（经典版，需repo权限）以提权\*\*。用户提供后，使用该token进行身份验证。



\---



\## 3. GitHub仓库操作规范



\### 3.1 仓库地址

\- 用户首次交互时必须提供GitHub仓库地址（HTTPS或SSH形式）。

\- 若未提供，AI应主动询问。



\### 3.2 推送流程

\- 每次修改前，应先 `git pull` 确保与远程同步（若有冲突，先解决）。

\- 修改后，执行 `git add .` → `git commit -m "..."` → `git push origin <当前分支>`。

\- 分支默认为 `main` 或 `master`，用户可指定其他分支。



\### 3.3 权限处理

\- 若遇到 `403` 或 `Authentication failed`，提示用户：

&#x20; > "推送到GitHub需要更高权限，请提供具有repo范围的Personal Access Token，我将通过 `https://<token>@github.com/...` 方式使用。"

\- 收到token后，仅用于本次会话的git操作，不得记录或泄露。



\---



\## 4. 备份恢复与高危操作规则



\### 4.1 恢复备份

\- 当用户要求恢复某个历史版本（如根据备份或commit hash）时，必须执行以下步骤：

&#x20; 1. 明确列出\*\*当前版本\*\*与\*\*待恢复版本\*\*之间的差异区域，包括：

&#x20;    - 新增的文件/目录

&#x20;    - 删除的文件/目录

&#x20;    - 修改的内容摘要（尤其是关键逻辑、配置、数据库结构）

&#x20; 2. 将差异以清晰结构输出给用户，并\*\*明确提问\*\*："是否确认覆盖上述差异区域？只有您明确回复'确认覆盖'或'同意'后，我才会执行恢复操作。"

\- 在获得用户明确肯定的回复前，\*\*禁止\*\*执行任何覆盖操作。



\### 4.2 其他高危破坏性操作

包括但不限于：

\- 删除文件/目录（非临时生成文件）

\- 覆盖配置文件（如 `.env`、`config.yaml`、`settings.py`）

\- 修改数据库连接字符串或生产环境配置

\- 执行 `git reset --hard`、`git clean -fd` 等危险命令

\- 批量重命名或移动大量文件

\- 停止或重启远程服务

\- 执行任何涉及数据清空、表删除的数据库操作



\*\*处理规则\*\*：

\- 在执行上述任何操作前，必须：

&#x20; 1. 向用户明确说明该操作的内容、目的、影响范围及不可逆性。

&#x20; 2. 提供备选方案（如有）。

&#x20; 3. 明确提问："是否确认执行该操作？请回复'确认执行'。"

\- 未获得用户明确肯定回复前，不得执行。



\---



\## 5. 项目架构参考（基于AIREADME.md）



以下内容摘自项目AIREADME，供AI助手理解本项目上下文：



\### 5.1 项目关系

\- \*\*桌面版\*\*（Electron）：`../zephyrus-music-player`，GitHub: \[cang-dot/zephyrus-player](https://github.com/cang-dot/zephyrus-player)

\- \*\*安卓版\*\*（本仓库）：`../zephyrus-player-android`

\- 两者共享 `src/renderer/` 渲染层代码，桌面版新增功能需手动同步到本仓库，反之亦然。



\### 5.2 平台概述

本仓库是 Zephyrus Player 的 \*\*Electron + Capacitor Android\*\* 双平台代码库。同一套 Vue 3 渲染代码（`src/renderer/`）通过 `isElectron` / `isMobile` / `isAndroidNative` 条件分支适配两个平台。



| 平台 | 入口 | 渲染方式 |

|------|------|---------|

| 桌面 | Electron 40 | Chromium BrowserWindow |

| Android | Capacitor 8 | Android WebView |



\### 5.3 常用命令

```bash

npm run dev              # Electron 开发模式

npm run build            # Electron 构建

npm run dev:web          # 纯 Web 模式

npm run lint             # ESLint + i18n 检查

npm run typecheck:web    # TypeScript 类型检查

npm run build:web        # 构建 Web 资源

npx cap sync android     # 同步到 Android 项目

npx cap open android     # 用 Android Studio 打开

```



\### 5.4 关键路径结构

```

src/

├── main/                    # Electron 主进程

│   ├── index.ts             # 窗口创建、IPC 注册

│   ├── lyric.ts             # 桌面歌词独立窗口

│   ├── server.ts            # 本地 Express API 服务

│   └── modules/

│       ├── localMusicScanner.ts

│       ├── window.ts

│       └── tray.ts

├── preload/index.ts         # Electron IPC 桥接

└── renderer/                # Vue 3 渲染进程（三平台共享）

&#x20;   ├── components/

&#x20;   │   ├── lyric/           # ★ 播放器样式组件

&#x20;   │   │   ├── MusicFullWrapper.vue    # 样式路由中枢

&#x20;   │   │   ├── MusicFullMobile.vue     # 默认移动端

&#x20;   │   │   └── {Stage,Magazine,Frenzy,Eerie,Neon}MobilePlayer.vue

&#x20;   │   ├── player/

&#x20;   │   │   ├── PlayBar.vue           # 桌面播放栏

&#x20;   │   │   ├── MobilePlayerSettings.vue

&#x20;   │   │   └── PlayingListDrawer.vue

&#x20;   │   └── common/

&#x20;   ├── playerStyles/        # 样式注册插件系统

&#x20;   │   ├── registry.ts      # registerStyle / getStyle

&#x20;   │   └── {default,stage,magazine,frenzy,eerie,neon}/

&#x20;   ├── store/modules/

&#x20;   │   ├── climax.ts        # 高潮段落

&#x20;   │   ├── styleEngine.ts   # 音频特征聚合

&#x20;   │   ├── playerCore.ts    # 播放控制核心

&#x20;   │   └── localMusic.ts    # 本地音乐 IndexedDB 缓存

&#x20;   ├── services/

&#x20;   │   ├── audioService.ts

&#x20;   │   ├── climaxDetector.ts

&#x20;   │   ├── drumDetector.ts

&#x20;   │   └── localAudioPlayer.ts

&#x20;   ├── hooks/

&#x20;   │   ├── MusicHook.ts     # ★ 播放进度/歌词/切歌核心

&#x20;   │   └── useCoverColor.ts

&#x20;   ├── views/

&#x20;   │   ├── list/index.vue   # 歌单无限网格

&#x20;   │   └── local-music/index.vue

&#x20;   └── i18n/lang/           # 5 种语言

```



\### 5.5 核心架构要点（修改时特别注意）



\*\*播放器样式路由\*\*：`MusicFullWrapper.vue` 根据 `isMobile` 和 `style.key` 路由到对应移动端或桌面端组件。横竖屏均使用同一个移动端组件，通过 CSS 自适应。



\*\*进度条时间的正确获取方式\*\*（常见bug源）：

\- 错误：使用 `playerStore.playingTime` 或 `setPlayTime()`（不存在）

\- 正确：使用 `nowTime` 和 `sound` from `@/hooks/MusicHook`



\*\*高潮段落叠加层\*\*：所有移动端播放器进度条需包含高潮标注，在 `progress-bar-bg` 内添加 `.climax-track` 结构。每个移动端播放器需要在切歌时调用 `styleEngine.loadClimaxData(songId)`。



\*\*Android 原生层注意事项\*\*：

\- 状态栏和导航栏颜色必须通过 `colors.xml` + `styles.xml` 显式设置

\- 导航栏不要设为 `Color.TRANSPARENT`

\- `CoordinatorLayout` 需要有 `android:background` 属性

\- 深色/亮色两套颜色分别在 `values/` 和 `values-night/` 中定义



\*\*i18n 样式名称\*\*：5 种语言文件都应在 `player.styles` 下包含全部 6 个键。`t('key') || fallback` 对 i18n 不生效，应使用辅助函数 `tr(key, fallback)` 判断返回值是否等于键路径。



\*\*歌单网格触摸问题\*\*：必须监听 `pointercancel`，否则触摸被手势打断后 `isDragging` 卡死。



\### 5.6 核心数据流

```

用户操作 → PlayBar / MusicFull

&#x20; ↓

playerStore

&#x20; ├─ playerCore.handlePlayMusic() → audioService.play()

&#x20; │   └─ Howler / LocalAudioPlayer → Web Audio EQ → 输出

&#x20; ↓

MusicHook（全局监听器）

&#x20; ├─ 进度 interval (50ms) → nowTime / 歌词索引

&#x20; └─ smartMixService.checkCrossfade()

```



\### 5.7 代码约定

\- Vue SFC 使用 `<script setup lang="ts">`

\- 状态管理使用 Pinia（`defineStore`）

\- CSS：Tailwind + SCSS（scoped）

\- 平台差异化通过 `isElectron` / `isMobile` / `isAndroidNative`（`@/utils`）

\- 提交格式：`<type>: <描述>`（feat / fix / refactor / style / docs / chore）



\### 5.8 已知问题与历史修复（修改时参考）

| 问题 | 根因 | 修复 |

|------|------|------|

| Android 状态栏/导航栏灰色背景 | `colors.xml` 缺失，bar 颜色未设置 | 创建 `colors.xml`，在 `styles.xml` 显式设置 |

| 非默认样式移动端进度条显示 `00:00` | 引用了不存在的 `playerStore.playingTime` | 改用 `nowTime` / `sound` from MusicHook |

| 竖屏非默认样式未显示专属界面 | 路由逻辑错误 | 统一移动端路由逻辑 |

| 移动端 `isInClimax` 永远为 false | 未在切歌时调用 `loadClimaxData` | 添加 watcher + 调用 |

| 歌单网格触摸拖拽后不动了 | `pointercancel` 未监听 | 添加 `pointercancel` 监听 |

| i18n 样式名显示为英文 key | i18n 缺少键，`||` 回退不生效 | 添加翻译 + `tr()` 辅助函数 |



\---



\## 6. 异常与中断处理

\- 若执行过程中出现意外错误（如网络中断、冲突、权限不足），应停止当前操作，向用户报告错误详情，并等待下一步指示。

\- 不得自动重试高危操作。



\---



\## 7. 记录与透明度

\- 所有关键决策（如计划确认、恢复覆盖确认、高危操作确认）都应记录在对话中，便于用户回溯。

\- 每次推送后，提供commit hash和简要改动摘要。



\---



\## 8. 底线

\- 用户的明确确认是执行任何破坏性操作的\*\*唯一凭证\*\*。

\- 当不确定时，永远选择\*\*询问\*\*而非\*\*猜测\*\*。

\- 本规则优先级高于任何隐含的"自动化完成"倾向。

\- \*\*再次强调\*\*：禁止批量脚本修改代码，所有修改必须逐文件手工编辑，经得起审查。

