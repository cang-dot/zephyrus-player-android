# Zephyrus Player Android — 下一阶段修复计划

> 本文档整理当前版本（截至 2026-07-21）遗留的所有 UI/交互问题，供下一轮对话或开发交接使用。
> 每个问题包含：**现象描述 → 代码根因 → 修复方案 → 涉及文件**。

---

## 问题总览

| # | 问题 | 优先级 | 涉及模块 |
|---|------|--------|----------|
| 1 | 设置页背景与顶栏底栏颜色割裂 | P0 | 设置页 |
| 2 | 歌单详情页背景未跟随取色 | P0 | 歌单详情页 |
| 3 | 主页元素右侧裁剪位置不在屏幕边缘 | P1 | 主页布局 |
| 4 | 每日推荐 / 私人 FM 卡片溢出屏幕 | P1 | 主页 Hero |
| 5 | 横向滑动栏渐变遮罩跟随滚动移动 | P1 | CoverScrollRow / HomeArtists |
| 6 | 沉浸式状态栏未完全实现 | P0 | Android Native + CSS |
| 7 | 需移除启动动画 | P2 | App.vue + SplashScreen |
| 8 | 启动后顶栏底栏莫名上下移动 | P0 | safe-area 注入时序 |

---

## 问题 1：设置页背景与顶栏底栏颜色割裂

### 现象
设置页整体背景呈现「取色+变暗」效果（`--m-bg` / `--cover-bg`），但点击选项后选项的 hover/active 背景色变成了与顶栏底栏一致的纯色——视觉上页面背景和选项背景是两套颜色体系，割裂明显。

### 代码根因
1. **设置页根容器** `src/renderer/views/set/index.vue` 第 2 行：
   ```html
   <div class="h-full w-full page-bg ...">
   ```
   `.page-bg` 定义在 `src/renderer/index.css` 第 21 行：
   ```css
   .page-bg {
     background-color: var(--bg-color, #fff);
     color: var(--text-color, #000);
   }
   ```
   `--bg-color` 在 `.theme-dark` / `.theme-light` / `.theme-gray` 中是写死的纯色（`#000` / `#fff` / `#f8f9fa`），**完全不跟随封面取色**。

2. **SettingItem 组件** `src/renderer/views/set/SettingItem.vue` 第 92-98 行：
   ```css
   .setting-item:hover {
     background: var(--d-surface-hover);   /* 写死 #f1f3f5 */
   }
   .setting-item:active {
     background: var(--d-surface-active);  /* 写死 #e9ecef */
   }
   ```
   `--d-surface-hover` / `--d-surface-active` 是**桌面端设计令牌**（`index.css` 第 114-115 行），写死纯色，不跟随取色。

3. **顶栏底栏**用的是移动端令牌 `var(--m-bg)` = `var(--cover-bg)`（封面取色+变暗），与上述两处颜色体系不同。

### 修复方案
**方案 A（推荐，最小改动）**：让设置页和 SettingItem 统一使用移动端令牌。
- `set/index.vue` 根 div：将 `page-bg` 改为内联样式或新 class，背景用 `var(--m-bg, var(--bg-color))`。
- `SettingItem.vue` 的 hover/active：改为 `var(--m-surface-hover)` / `var(--m-surface-alt)`。
- 同时检查 `SettingItem.vue` 的文字颜色：`--d-text-primary` / `--d-text-secondary` 也应改为 `--m-text-primary` / `--m-text-secondary`。

**方案 B（全局统一）**：在 `mobile.css` 的 `.mobile` 选择器下，把 `--d-surface-*` / `--d-text-*` 等 desktop 令牌重定向到 `--m-*` 对应值，让所有桌面端组件在移动端自动适配。

### 涉及文件
- `src/renderer/views/set/index.vue`
- `src/renderer/views/set/SettingItem.vue`
- `src/renderer/index.css`（`.page-bg` 定义）
- `src/renderer/assets/css/mobile.css`（`--m-*` 令牌定义，方案 B）

---

## 问题 2：歌单详情页背景未跟随取色

### 现象
进入歌单详情页（`/music-list/:id`），页面背景是纯白/纯黑，与顶栏底栏的取色+变暗背景完全脱节。

### 代码根因
`src/renderer/views/music/MusicListPage.vue` 第 2 行：
```html
<div class="music-list-page h-full w-full bg-white dark:bg-black transition-colors duration-500">
```
使用了 Tailwind 的 `bg-white dark:bg-black`（写死纯色），完全没用 `var(--m-bg)` 或 `var(--cover-bg)`。

第 18 行的 Hero 渐变也用了写死颜色：
```html
<div class="absolute inset-0 bg-gradient-to-b from-transparent via-white/80 to-white dark:via-black/80 dark:to-black"></div>
```

### 修复方案
1. 根 div 改为：
   ```html
   <div class="music-list-page h-full w-full transition-colors duration-500"
        style="background: var(--m-bg, var(--bg-color));">
   ```
2. Hero 渐变改为基于 `var(--m-bg)` 的 `color-mix`：
   ```html
   <div class="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--m-bg)]"
        style="background: linear-gradient(to bottom, transparent, color-mix(in srgb, var(--m-bg) 80%, transparent), var(--m-bg));">
   ```
3. 同步检查页面内其他 `bg-white dark:bg-black` / `text-neutral-900 dark:text-white` 等 Tailwind 写死颜色，替换为 `--m-*` 令牌。

### 涉及文件
- `src/renderer/views/music/MusicListPage.vue`

---

## 问题 3：主页元素右侧裁剪位置不在屏幕边缘

### 现象
主页大部分元素在右边都有一个裁剪边界，但裁剪位置不在屏幕边缘，而是向屏幕内缩进了一段距离。此外，每日推荐和私人 FM 卡片会超长溢出屏幕。横向滑动栏（如推荐歌单、热门歌手）右侧的渐变遮罩会跟着横向滑动一起移动，且遮罩右侧直接暴露了其他横向滑动栏的内容。

### 代码根因
**裁剪位置不对**：
- `src/renderer/views/home/index.vue` 第 3-4 行：
  ```html
  <n-scrollbar class="h-full">
    <div class="home-content w-full pb-32 page-padding">
  ```
  `n-scrollbar`（Naive UI）内部会创建 `overflow: scroll` 容器。`home-content` 的 `page-padding` 给了左右各 `var(--page-pl)` / `var(--page-pr)` 的 padding（移动端 ≥640px 时为 1.5rem）。

- `CoverScrollRow.vue` 和 `HomeArtists.vue` 用负 margin 抵消 page-padding：
  ```css
  margin-left: calc(var(--page-pl) * -1);
  margin-right: calc(var(--page-pr) * -1);
  padding-left: var(--page-pl);
  padding-right: var(--page-pr);
  ```
  但 `n-scrollbar-container` 的 `overflow: scroll` 会裁剪溢出内容。如果 n-scrollbar 内部有额外 padding 或 border，负 margin 无法完全延伸到屏幕边缘。

**卡片溢出**：
- `HomeHero.vue` 第 689-700 行：
  ```css
  .hero-grid {
    grid-template-columns: 1fr;
  }
  .hero-grid > .hero-card {
    height: 100%;
  }
  .hero-grid > .hero-card > .daily-card {
    height: 100%;
    min-height: 200px;
    max-height: 220px;
  }
  ```
  单列 grid 下 `height: 100%` 会形成循环依赖。FM 卡片是横卡（`flex items-center gap-4 p-4`），如果歌名过长且 flex 子元素没有 `min-w-0`，会撑爆容器宽度。

**遮罩跟随滚动**：
- `CoverScrollRow.vue` 第 49-56 行和 `HomeArtists.vue` 第 58-65 行：
  ```html
  <div class="scroll-fade-right pointer-events-none absolute right-0 top-0 bottom-0 w-8
       bg-gradient-to-l from-[var(--m-bg,#fff)] to-transparent ..." />
  ```
  fade 元素是 `overflow-x-auto` 滚动容器的直接子元素。**在 CSS 规范中，当一个 `position: relative` 的元素同时是 scroll container 时，其 absolute 子元素会跟随滚动内容移动**。这就是遮罩跟着横向滑动移动的原因。

  此外，`CoverScrollRow.vue` 的 fade 用 `from-[var(--m-bg,#fff)]`（跟随取色），但 `HomeArtists.vue` 的 fade 用 `from-white dark:from-black`（写死纯色），两者不一致。

### 修复方案

**裁剪位置**：
- 检查 `n-scrollbar` 是否在 `mobile-content` 内被正确约束宽度。
- 确认 `--page-pl` / `--page-pr` 在移动端的实际值（≥640px 时为 1.5rem）。
- 如果 n-scrollbar 内部有 padding，需要额外抵消。
- 或者改用 `width: 100vw; margin-left: calc(50% - 50vw); margin-right: calc(50% - 50vw);` 的方式让滚动行延伸到完整视口宽度。

**卡片溢出**：
- 移除 `.hero-grid > .hero-card` 的 `height: 100%`（grid 单列下不需要）。
- 给 FM 卡片的文字容器加 `min-w-0`（已有 `flex-1 min-w-0`，但需确认所有层级都有）。
- 给 hero-grid 或 home-content 加 `overflow: hidden` 或 `overflow-x: hidden` 防止横向溢出。

**遮罩跟随滚动**（关键修复）：
重构 `CoverScrollRow.vue` 和 `HomeArtists.vue` 的 DOM 结构：

```html
<!-- 外层 wrapper：position: relative，不滚动 -->
<div class="scroll-row-wrapper relative"
     style="margin-left: calc(var(--page-pl) * -1); margin-right: calc(var(--page-pr) * -1);">
  <!-- 内层：overflow-x-auto 滚动容器 -->
  <div ref="scrollContainer" class="scroll-row-inner overflow-x-auto overflow-y-hidden"
       style="padding-left: var(--page-pl); padding-right: var(--page-pr);">
    <div class="cover-track flex gap-3">...</div>
  </div>
  <!-- fade 元素放在 wrapper 上，不在 scroll container 内 -->
  <div class="scroll-fade-left absolute left-0 top-0 bottom-0 w-8 ..."
       :class="..." />
  <div class="scroll-fade-right absolute right-0 top-0 bottom-0 w-8 ..."
       :class="..." />
</div>
```

这样 fade 元素的 containing block 是外层 wrapper（非 scroll container），不会跟随滚动移动。

同时统一 fade 背景色为 `var(--m-bg)`。

### 涉及文件
- `src/renderer/views/home/index.vue`
- `src/renderer/views/home/components/HomeHero.vue`
- `src/renderer/components/common/CoverScrollRow.vue`
- `src/renderer/views/home/components/HomeArtists.vue`
- `src/renderer/views/home/components/HomeAlbumSection.vue`（也使用 CoverScrollRow）
- `src/renderer/views/home/components/HomePlaylistSection.vue`（也使用 CoverScrollRow）

---

## 问题 4：每日推荐 / 私人 FM 卡片溢出屏幕

### 现象
每日推荐和私人 FM 的卡片宽度超出屏幕，横向溢出。

### 代码根因
`src/renderer/views/home/components/HomeHero.vue`：
- `.hero-grid { grid-template-columns: 1fr; }` — 单列布局，卡片宽度 = grid 宽度。
- `.hero-grid > .hero-card { height: 100%; }` — 单列下 `height: 100%` 无意义且可能导致高度计算异常。
- FM 卡片（第 108 行）：`<div class="relative flex h-full items-center gap-4 p-4">`
  - 中间歌名区：`<div class="flex-1 min-w-0">` — 有 `min-w-0`，应该不会撑爆。
  - 但右侧控制按钮区（第 164 行）：`<div class="flex items-center gap-2 flex-shrink-0">` — 如果按钮过多，`flex-shrink-0` 的按钮总宽度可能超过容器可用宽度。
- 每日推荐卡（第 47 行）：`<div class="relative flex h-full flex-col justify-between p-5">`
  - 底部区（第 68 行）：`<div class="flex items-end justify-between gap-4">`
    - 左侧歌曲列表：`<div class="flex min-w-0 flex-1 flex-col gap-0.5">` — 有 `min-w-0`。
    - 右侧播放按钮：`<button class="daily-play-btn ... flex-shrink-0 ...">` — 52x52，应该不会撑爆。

可能的原因：
1. `hero-grid` 或 `hero-card` 没有设置 `overflow: hidden`，内部内容溢出。
2. `home-content` 的 `page-padding` 限制了可用宽度，但卡片内的 `p-5` / `p-4` padding 叠加导致内容区过窄，flex 子元素无法正常收缩。
3. 某些 flex 子元素缺少 `min-w-0`。

### 修复方案
1. 给 `.hero-grid` 或 `.hero-card` 加 `overflow: hidden` 或 `min-width: 0`。
2. 移除 `.hero-grid > .hero-card { height: 100%; }`（单列下不需要）。
3. 检查所有 flex 子元素是否有 `min-w-0`，特别是 `flex-1` 的容器。
4. 如果 FM 卡片的右侧按钮区在小屏幕上过宽，考虑减少按钮数量或用 `overflow: hidden` 截断。

### 涉及文件
- `src/renderer/views/home/components/HomeHero.vue`

---

## 问题 5：沉浸式状态栏未完全实现

### 现象
状态栏区域没有与 Vue 页面顶部背景色融为一体，沉浸式效果不完整。用户要求：
- 状态栏颜色在 `values/styles.xml`（用户称 `themes.xml`）里改 `android:statusBarColor`，与 Vue 页面顶部背景色一致。
- 导航栏颜色 `android:navigationBarColor` 设为透明或深色模式适配。

### 代码根因
**Android 端已做的工作**：
- `android/app/src/main/res/values/styles.xml`：
  - `AppTheme.NoActionBar` 和 `AppTheme.NoActionBarLaunch` 都已设 `statusBarColor` / `navigationBarColor` = `@android:color/transparent`。
  - `windowDrawsSystemBarBackgrounds` = true，`windowTranslucentStatus` = false。
  - `windowLayoutInDisplayCutoutMode` = shortEdges。
- `MainActivity.java`：
  - `WindowCompat.setDecorFitsSystemWindows(getWindow(), false)` — edge-to-edge。
  - `setStatusBarColor(Color.TRANSPARENT)` + `setNavigationBarColor(Color.TRANSPARENT)`。
  - `BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE`。
  - WebView 背景设为 `Color.TRANSPARENT`。

**问题所在**：
1. **AndroidManifest.xml** 第 18 行：MainActivity 使用 `@style/AppTheme.NoActionBarLaunch`（parent `Theme.SplashScreen`），而非 `@style/AppTheme.NoActionBar`。`Theme.SplashScreen` 可能有额外属性影响沉浸式效果。Capacitor 通常会在运行时切换 theme，但需确认是否生效。

2. **CSS 端 safe-area 注入时序问题**（详见问题 8）：
   - `--safe-area-inset-top` 初始值为 `env(safe-area-inset-top, 0px)`，fallback 0px。
   - `injectSafeAreaInsets()` 在 `initNativeBridge()` 里同步调用，但此时 `window.AndroidNative` 可能还未注入。
   - 如果注入失败，顶栏 `padding-top` = 0 + 16px = 16px，内容会被状态栏遮挡，状态栏区域显示的是 windowBackground（`@drawable/splash` 或纯色），而非 Vue 顶栏背景。

3. **windowBackground 不匹配**：
   - `AppTheme.NoActionBarLaunch` 的 `windowBackground` = `@drawable/splash`（启动画面 drawable）。
   - `AppTheme.NoActionBar` 的 `windowBackground` = `@color/windowBackground`（`#f5f1eb` 浅色 / `#1a1a1a` 深色）。
   - 如果运行时一直用 `NoActionBarLaunch`，windowBackground 是 splash drawable，不是 Vue 背景色。

### 修复方案
1. **确认运行时 theme**：在 `MainActivity.java` 的 `onCreate` 里调用 `setTheme(R.style.AppTheme_NoActionBar)` 显式切换到非启动主题。

2. **修复 safe-area 注入时序**（见问题 8）。

3. **让 Vue 顶栏背景延伸到状态栏区域**：
   - `MobileHeader.vue` 的 `safe-area-top` class 已设 `padding-top: calc(var(--safe-area-inset-top, 0px) + 16px)`。
   - 确保 `--safe-area-inset-top` 有合理初始值（如 24px），而非 0px。
   - 顶栏背景 `var(--m-bg)` 会随 padding-top 延伸到状态栏区域。

4. **动态状态栏背景色**（可选进阶）：
   - 在 `androidNative.ts` 的 `setStatusBarBgColor()` 已有实现，但当前未被调用。
   - 可在封面取色变化时调用 `setStatusBarBgColor(primaryColor)`，让状态栏背景与封面取色一致。
   - 但这会与"透明状态栏 + CSS 延伸"方案冲突，需二选一。

### 涉及文件
- `android/app/src/main/AndroidManifest.xml`
- `android/app/src/main/res/values/styles.xml`
- `android/app/src/main/res/values/colors.xml`
- `android/app/src/main/res/values-night/colors.xml`
- `android/app/src/main/java/com/zephyrus/player/MainActivity.java`
- `src/renderer/services/androidNative.ts`
- `src/renderer/layout/components/MobileHeader.vue`

---

## 问题 6：移除启动动画

### 现象
应用启动时有一个 GSAP 动画启动画面（Zephyrus Player 文字 + 色块动画），需要移除。

### 代码根因
- `src/renderer/App.vue` 第 15 行：
  ```html
  <splash-screen v-if="!isLyricWindow && showSplash" @finish="showSplash = false" />
  ```
- 第 27 行：`import SplashScreen from '@/components/splash/SplashScreen.vue';`
- 第 47 行：`const showSplash = ref(true);`
- `src/renderer/components/splash/SplashScreen.vue`：完整的 GSAP 动画组件。
- `android/app/src/main/res/values/styles.xml` 第 33-41 行：`AppTheme.NoActionBarLaunch` 使用 `@drawable/splash` 作为背景。

### 修复方案
1. **移除 Vue 端 splash**：
   - `App.vue`：删除 `<splash-screen>` 标签、`import SplashScreen` 语句、`const showSplash` 变量。
   - 删除 `src/renderer/components/splash/SplashScreen.vue` 文件（可选，保留也不影响）。
   - 检查是否还有其他地方引用 `showSplash` 或 `SplashScreen`。

2. **移除 Android 端 splash**（可选）：
   - `styles.xml`：把 `AppTheme.NoActionBarLaunch` 的 `android:background` 从 `@drawable/splash` 改为 `@color/windowBackground`。
   - 或直接让 `AppTheme.NoActionBarLaunch` parent 改为 `AppTheme.NoActionBar`，仅保留启动主题的差异。
   - 检查 `android/app/src/main/res/drawable/splash.xml`（如果存在）。

3. **检查 Capacitor 配置**：
   - `capacitor.config.ts`：查看是否有 splash 相关配置（如 `plugins.SplashScreen`），如有则禁用。

### 涉及文件
- `src/renderer/App.vue`
- `src/renderer/components/splash/SplashScreen.vue`（删除）
- `android/app/src/main/res/values/styles.xml`
- `android/app/src/main/res/drawable/splash.xml`（如存在）
- `capacitor.config.ts`

---

## 问题 7：启动后顶栏底栏莫名上下移动

### 现象
应用启动后一段时间，顶栏突然往下移动一大段距离，底栏突然往上移动一大段距离，导致上下空出很多空白。

### 代码根因
**safe-area-inset 注入时序问题**：

1. **初始渲染**：`--safe-area-inset-top` / `--safe-area-inset-bottom` 的值来自 `src/renderer/index.css` 第 173-176 行：
   ```css
   :root {
     --safe-area-inset-top: env(safe-area-inset-top, 0px);
     --safe-area-inset-bottom: env(safe-area-inset-bottom, 10px);
   }
   ```
   Android WebView 下 `env(safe-area-inset-*)` 通常不生效，所以初始值为 0px / 10px。

2. **JS 注入**：`src/renderer/services/androidNative.ts` 第 79-92 行：
   ```ts
   export function injectSafeAreaInsets() {
     if (!isAndroidNative()) return;
     try {
       const json = window.AndroidNative!.getSafeAreaInsets();
       const insets = JSON.parse(json);
       root.style.setProperty('--safe-area-inset-top', `${insets.top}px`);
       root.style.setProperty('--safe-area-inset-bottom', `${insets.bottom}px`);
       // ...
     } catch (e) { ... }
   }
   ```
   这个函数在 `initNativeBridge()` 里调用（`androidNative.ts` 第 419 行），而 `initNativeBridge()` 在 `App.vue` 第 346-347 行模块顶层执行。

3. **时序问题**：
   - Vue 首次渲染时，`--safe-area-inset-top` = 0px。
   - 顶栏 `MobileHeader.vue` 的 `padding-top` = `calc(0px + 16px)` = 16px。
   - 底栏 `MobilePlayBar.vue` 的 `bottom` = `calc(0px + 10px)` = 10px。
   - 某个时刻 `injectSafeAreaInsets()` 执行成功，注入实际值（如 top=24px, bottom=48px）。
   - 顶栏 `padding-top` 突变为 `calc(24px + 16px)` = 40px → **顶栏往下移动 24px**。
   - 底栏 `bottom` 突变为 `calc(48px + 10px)` = 58px → **底栏往上移动 48px**。

4. **Splash 动画掩盖了初始状态**：splash 动画持续约 4-5 秒，期间用户看不到布局。splash 消失后，native bridge 注入可能已完成或即将完成，导致用户看到"突然移动"。

### 修复方案

**方案 A（推荐，前端侧）**：在 `index.html` 中预设合理的 safe-area 默认值。
- 在 `<html>` 标签上设置内联样式：
  ```html
  <html lang="zh-CN" style="--safe-area-inset-top: 24px; --safe-area-inset-bottom: 24px;">
  ```
  （24px 是 Android 状态栏典型高度，bottom 24px 是手势导航栏典型高度）
- 这样首次渲染就有合理 padding，native 注入后即使值不同也只微调。
- 配合 `transition: padding 0.15s ease` 让微调平滑。

**方案 B（更彻底，Native 侧）**：让 Native 在 WebView 加载前就注入 insets。
- 在 `MainActivity.java` 的 `onPageStarted` 或 WebView 初始化时，通过 `evaluateJavascript` 提前注入 CSS 变量。
- 或在 `NativeBridge.java` 的 `getSafeAreaInsets()` 返回正确值后，主动调用 `evaluateJavascript` 设置 CSS 变量。

**方案 C（最简单但治标）**：给顶栏底栏的 padding/bottom 加 transition。
- `MobileHeader.vue`：`transition: padding-top 0.2s ease;`
- `MobilePlayBar.vue`：`transition: bottom 0.2s ease;`
- 这样即使值变化，也是平滑过渡而非突变。

### 涉及文件
- `src/renderer/index.html`（方案 A）
- `src/renderer/index.css`（`:root` 的 `--safe-area-inset-*` 定义）
- `src/renderer/services/androidNative.ts`（`injectSafeAreaInsets`）
- `src/renderer/layout/components/MobileHeader.vue`
- `src/renderer/components/player/MobilePlayBar.vue`
- `android/app/src/main/java/com/zephyrus/player/MainActivity.java`（方案 B）
- `android/app/src/main/java/com/zephyrus/player/NativeBridge.java`（方案 B）

---

## 修复优先级建议

### P0（影响核心体验，优先修复）
1. **问题 7**：safe-area 注入时序 — 方案 A，改 `index.html`，1 分钟修复，效果立竿见影。
2. **问题 6**：移除启动动画 — 改 `App.vue`，2 分钟修复。
3. **问题 1**：设置页背景割裂 — 改 `set/index.vue` + `SettingItem.vue`，10 分钟。
4. **问题 2**：歌单详情页背景 — 改 `MusicListPage.vue`，10 分钟。
5. **问题 5**：沉浸式状态栏 — 确认 theme 切换 + safe-area 注入，15 分钟。

### P1（影响视觉一致性）
6. **问题 3+4**：主页裁剪 + 卡片溢出 — 调整布局，20 分钟。
7. **问题 5（遮罩）**：横向滑动栏遮罩跟随滚动 — 重构 CoverScrollRow + HomeArtists DOM 结构，30 分钟。

### P2（可选优化）
8. 动态状态栏背景色（跟随封面取色变化调用 `setStatusBarBgColor`）。
9. 全局统一 `--d-*` 桌面端令牌在 `.mobile` 下的映射（方案 B）。

---

## 关键文件索引

### CSS 设计令牌
- `src/renderer/index.css` — `:root` 令牌、`.page-bg`、`.page-padding`、`--safe-area-inset-*`
- `src/renderer/assets/css/mobile.css` — `.mobile` 下的 `--m-*` 令牌（跟随 `--cover-bg`）

### 封面取色
- `src/renderer/hooks/useCoverColor.ts` — `updateCSSVariables` 生成 `--cover-bg` / `--cover-surface` 等

### 移动端布局
- `src/renderer/layout/AppLayout.vue` — 入口，使用 `MobileLayout :is-phone="true"`
- `src/renderer/layout/MobileLayout.vue` — 主布局，provide `hasSafeArea`
- `src/renderer/layout/components/MobileHeader.vue` — 顶栏，`safe-area-top` class
- `src/renderer/components/player/MobilePlayBar.vue` — 底部播放栏

### 主页
- `src/renderer/views/home/index.vue` — 主页入口，`n-scrollbar` + `page-padding`
- `src/renderer/views/home/components/HomeHero.vue` — 每日推荐 + 私人 FM 卡片
- `src/renderer/views/home/components/HomeArtists.vue` — 热门歌手横向滚动
- `src/renderer/components/common/CoverScrollRow.vue` — 通用横向封面滚动行

### 设置页
- `src/renderer/views/set/index.vue` — 设置页入口
- `src/renderer/views/set/SettingItem.vue` — 设置项组件

### 歌单详情页
- `src/renderer/views/music/MusicListPage.vue` — 歌单/专辑详情页

### Native Bridge
- `src/renderer/services/androidNative.ts` — `injectSafeAreaInsets` / `initNativeBridge` / `setStatusBarBgColor`
- `android/app/src/main/java/com/zephyrus/player/MainActivity.java` — edge-to-edge + 透明状态栏
- `android/app/src/main/java/com/zephyrus/player/NativeBridge.java` — `getSafeAreaInsets` 实现

### Android 资源
- `android/app/src/main/AndroidManifest.xml` — MainActivity theme = `AppTheme.NoActionBarLaunch`
- `android/app/src/main/res/values/styles.xml` — `AppTheme` / `AppTheme.NoActionBar` / `AppTheme.NoActionBarLaunch`
- `android/app/src/main/res/values/colors.xml` — `windowBackground` / `statusBarColor` / `navigationBarColor`
- `android/app/src/main/res/values-night/colors.xml` — 深色模式颜色

### 启动动画
- `src/renderer/App.vue` — `<splash-screen>` 引用
- `src/renderer/components/splash/SplashScreen.vue` — GSAP 动画组件

---

## 注意事项

1. **备份项目已存在**：`zephyrus-music-player/ThymosMusicPlayer-v1.0.0-backup-20260629-214104/` 和 `ThymosMusicPlayer-v1.0.0-backup-20260630/` 是之前的备份。建议在开始修复前再创建一个备份。

2. **设计令牌体系**：项目有两套设计令牌：
   - `--d-*`（desktop）：写死纯色，用于桌面端组件。
   - `--m-*`（mobile）：跟随 `--cover-bg`（封面取色），用于移动端。
   移动端项目（zephyrus-player-android）应统一使用 `--m-*` 令牌，避免混用。

3. **`--cover-bg` vs `--m-bg`**：
   - `--cover-bg`：由 `useCoverColor.ts` 从封面提取颜色后与深色/白色混合生成。
   - `--m-bg`：`var(--cover-bg, fallback)`，是 `--cover-bg` 的移动端别名。
   - 两者在取色后值相同，未取色时 `--m-bg` 用 fallback。

4. **Native Bridge 时序**：`window.AndroidNative` 由 `NativeBridge.java` 通过 `addJavascriptInterface` 注入。注入时机在 WebView 创建后，但 JS 首次执行时可能尚未可用。`isAndroidNative()` 检查 `window.AndroidNative` 是否存在。

5. **Capacitor BridgeActivity**：`MainActivity` 继承 `BridgeActivity`，Capacitor 会管理 WebView 生命周期。`bridge.getWebView()` 在 `onCreate` 后可用。

6. **Edge-to-Edge 模式**：`setDecorFitsSystemWindows(false)` 让内容延伸到系统栏区域。系统栏背景透明时，由 CSS 内容（通过 `--safe-area-inset-*` padding）决定系统栏区域的视觉颜色。

---

*文档生成时间：2026-07-21*
*项目路径：`c:\Users\Administrator\Desktop\zephyrus-player-android`*
