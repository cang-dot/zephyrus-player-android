# Spotify API 登录接入计划与维护文档

> 调研日期：2026-08-05  
> 项目：Zephyrus Player Android  
> 文档状态：可行性分析 + 接入计划

---

## 一、可行性结论

### ✅ 完全可行

Spotify 官方提供完整的 Web API 和 Android SDK，支持第三方应用通过 OAuth 2.0 进行用户登录授权。对于 Zephyrus Player（Capacitor + Vue + Android WebView 架构），推荐使用 **Authorization Code with PKCE** 流程。

### 关键依据

| 维度 | 结论 |
|------|------|
| 认证方式 | OAuth 2.0 PKCE — 专为移动端/SPA 设计，无需 client_secret |
| Token 有效期 | access_token 1 小时，refresh_token 6 个月 |
| Android SDK | 官方提供 Beta 版 SDK（含 Authorization Lib + App Remote Lib） |
| WebView 兼容 | PKCE 流程可完全在 WebView 内通过 `fetch` + `crypto.subtle` 实现 |
| 重定向 | 支持自定义 scheme redirect URI，适配 Capacitor App |

---

## 二、认证架构设计

### 2.1 流程选择：Authorization Code with PKCE

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Zephyrus    │     │  Spotify Auth    │     │  Spotify Web    │
│  Player App  │     │  Server          │     │  API            │
│  (WebView)   │     │                  │     │                 │
└──────┬───────┘     └────────┬─────────┘     └────────┬────────┘
       │                      │                        │
       │ 1.生成 code_verifier  │                        │
       │   + code_challenge    │                        │
       │                      │                        │
       │ 2.重定向到登录页 ────→│                        │
       │   /authorize?         │                        │
       │   code_challenge=...  │                        │
       │                      │                        │
       │                      │ 3.用户登录+授权         │
       │                      │                        │
       │ 4.回调 redirect_uri ←─┘                        │
       │   ?code=xxxxx        │                        │
       │                      │                        │
       │ 5.POST /api/token ──→│                        │
       │   code+verifier      │                        │
       │                      │                        │
       │ 6.返回 access_token ←┘                        │
       │   +refresh_token     │                        │
       │                      │                        │
       │ 7.调用 Web API ───────────────────────────────→│
       │   Authorization:     │                        │
       │   Bearer <token>     │                        │
       │                      │                        │
       │ 8.token 过期后用     │                        │
       │   refresh_token 换新  │                        │
       └──────────────────────┘                        │
```

### 2.2 为什么选 PKCE 而非其他流程

| 流程 | 适合场景 | 不选原因 |
|------|---------|---------|
| Authorization Code | 服务端应用（可安全存储 secret） | Zephyrus 是客户端应用，无法安全存储 client_secret |
| **PKCE** ✅ | **移动端、SPA、WebView** | **完全匹配我们的架构** |
| Client Credentials | 后端服务、无用户参与 | 无法访问用户资源（歌单、播放历史等） |
| Implicit Grant | ~~SPA~~ | **已废弃**，Spotify 官方不推荐 |

### 2.3 所需 Scopes

```javascript
const scope = [
  'user-read-private',           // 读取用户profile
  'user-read-email',             // 读取邮箱
  'user-read-playback-state',    // 读取当前播放状态
  'user-modify-playback-state',  // 控制播放
  'user-read-currently-playing', // 读取当前播放曲目
  'playlist-read-private',       // 读取私有歌单
  'playlist-read-collaborative', // 读取协作歌单
  'user-library-read',           // 读取收藏的音乐
  'user-top-read',               // 读取用户偏好
  'user-follow-read',            // 读取关注列表
].join(' ');
```

---

## 三、接入实施计划

### Phase 1：Spotify Developer 应用注册（0.5 天）

1. 访问 [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. 创建新 App，填写应用名称和描述
3. 配置 Redirect URI：
   ```
   zephyrus-player://spotify-auth-callback
   ```
4. 获取 `Client ID`（PKCE 流程不需要 Client Secret）
5. 在 `capacitor.config.ts` 中注册自定义 scheme

### Phase 2：认证服务实现（2 天）

#### 2.1 创建 `spotifyAuthService.ts`

```
src/renderer/services/spotifyAuthService.ts
```

核心功能：
- `generateCodeVerifier()` — 生成 64 位随机字符串
- `generateCodeChallenge(verifier)` — SHA256 + Base64URL 编码
- `requestAuthorization()` — 构造授权 URL 并重定向
- `exchangeCodeForToken(code)` — 用 authorization code 换 access token
- `refreshAccessToken()` — 用 refresh_token 刷新 access_token
- `getValidAccessToken()` — 自动检查过期并返回有效 token
- `isAuthenticated()` — 检查登录状态
- `logout()` — 清除存储的 token

#### 2.2 Token 存储策略

```typescript
// 使用 localStorage 存储（WebView 持久化）
interface SpotifyTokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number;  // 时间戳 (ms)
  scope: string;
}
```

#### 2.3 Capacitor 自定义 scheme 处理

在 `capacitor.config.ts` 中：
```typescript
server: {
  androidScheme: 'https',
},
plugins: {
  // 需要安装 @capacitor/app 处理 deep link
}
```

在 `AndroidManifest.xml` 中添加 intent-filter：
```xml
<activity android:name=".MainActivity">
  <intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="zephyrus-player" android:host="spotify-auth-callback" />
  </intent-filter>
</activity>
```

### Phase 3：Spotify Web API 封装（2 天）

#### 3.1 创建 `spotifyApiService.ts`

```
src/renderer/services/spotifyApiService.ts
```

核心端点封装：

| 方法 | API 端点 | 用途 |
|------|---------|------|
| `getUserProfile()` | `GET /v1/me` | 获取用户信息 |
| `getUserPlaylists()` | `GET /v1/me/playlists` | 获取用户歌单 |
| `getCurrentlyPlaying()` | `GET /v1/me/player/currently-playing` | 当前播放状态 |
| `searchTracks(query)` | `GET /v1/search` | 搜索歌曲 |
| `getTrack(id)` | `GET /v1/tracks/{id}` | 获取歌曲详情 |
| `getAudioFeatures(id)` | `GET /v1/audio-features/{id}` | 音频特征（BPM、能量等） |
| `getRecommendations()` | `GET /v1/recommendations` | 推荐歌曲 |
| `getUserTopTracks()` | `GET /v1/me/top/tracks` | 用户最常听 |
| `controlPlayback()` | `PUT /v1/me/player/play` | 控制播放 |

#### 3.2 统一请求封装

```typescript
async function spotifyFetch(url: string, options?: RequestInit) {
  const token = await spotifyAuthService.getValidAccessToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  
  // 429 Rate Limit 处理
  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '1');
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    return spotifyFetch(url, options); // 重试
  }
  
  return response;
}
```

### Phase 4：UI 集成（2 天）

#### 4.1 登录页面

- 在设置页添加 "Spotify 登录" 按钮
- 点击后调用 `spotifyAuthService.requestAuthorization()`
- 处理 deep link 回调，交换 token
- 登录成功后显示用户头像和用户名

#### 4.2 Spotify 浏览页面

- 用户歌单列表
- Spotify 搜索（可搜索并导入歌曲到本地播放列表）
- 推荐/偏好歌曲

### Phase 5：与现有播放器集成（1.5 天）

- 将 Spotify 歌曲数据转换为 Zephyrus Player 的 `SongResult` 格式
- 利用 `audio-features` API 获取 BPM/能量值，增强智能混音引擎
- Spotify 歌曲播放预览（30 秒 preview_url）

---

## 四、技术风险与注意事项

### 4.1 Rate Limiting

| 指标 | 值 |
|------|-----|
| 滚动 30 秒窗口 | 默认 ~180 次请求 |
| 超限响应 | HTTP 429 + `Retry-After` header |
| 策略 | 指数退避 + 请求队列 |

### 4.2 Token 生命周期管理

```
access_token  ──── 1小时有效 ────→ 过期 → refresh_token 换新
                                              │
refresh_token  ──── 6个月有效 ────────────────→ 过期 → 重新授权
```

**关键点：**
- 在 access_token 过期前 5 分钟自动刷新
- refresh_token 过期后必须重新走授权流程
- `invalid_grant` 错误 → 清除 token → 提示用户重新登录

### 4.3 Redirect URI 在 Capacitor 中的处理

Capacitor WebView 不支持 `window.location` 跳转到自定义 scheme。需要：
1. 使用 `@capacitor/app` 插件监听 `appUrlOpen` 事件
2. 或使用 `@capacitor/browser` 打开 Spotify 授权页
3. 在 `MainActivity.java` 中拦截 deep link 回调

### 4.4 Dev Mode 限制（2026 年 2 月变更）

Spotify 2026 年 2 月对 Development Mode 应用有新的限制：
- Dev Mode 应用的 refresh_token 有效期可能缩短
- 用户上限 25 人（Dev Mode）
- 上架前需要申请 Extended Quota Mode

### 4.5 CORS 注意事项

Spotify Web API 的 `/api/token` 端点支持 CORS，可直接在 WebView 中调用。但 `accounts.spotify.com/authorize` 需要在浏览器/外部窗口中打开。

---

## 五、文件结构规划

```
src/renderer/
├── services/
│   ├── spotifyAuthService.ts    # 认证服务
│   ├── spotifyApiService.ts     # API 封装
│   └── spotifyTypes.ts          # 类型定义
├── store/modules/
│   └── spotify.ts               # Pinia store
├── components/spotify/
│   ├── SpotifyLogin.vue         # 登录按钮组件
│   ├── SpotifyProfile.vue       # 用户信息展示
│   └── SpotifyPlaylistList.vue  # 歌单列表
└── hooks/
    └── useSpotifyAuth.ts        # 认证 Hook
```

---

## 六、依赖项

```json
{
  "@capacitor/app": "^6.0.0",
  "@capacitor/browser": "^6.0.0"
}
```

---

## 七、维护指南

### 7.1 日常维护检查项

| 检查项 | 频率 | 方法 |
|--------|------|------|
| Client ID 是否有效 | 每月 | 登录 Developer Dashboard 检查 |
| Redirect URI 是否匹配 | 每次构建前 | 对比 Dashboard 和 AndroidManifest.xml |
| Token 刷新是否正常 | 每周 | 检查 localStorage 中的 expires_at |
| API 调用是否 429 | 每日 | 监控日志中的 429 响应 |
| Spotify API 变更 | 每季度 | 查看 [Changelog](https://developer.spotify.com/documentation/web-api/changelog) |

### 7.2 常见问题排查

#### Q: 用户登录后无法回调到 App
- 检查 `AndroidManifest.xml` 中 intent-filter 的 scheme 和 host
- 确认 Spotify Dashboard 中的 Redirect URI 完全一致
- 确认 `capacitor.config.ts` 中的配置

#### Q: access_token 频繁过期
- 正常现象（1 小时有效期），确保自动刷新逻辑生效
- 检查 `getValidAccessToken()` 是否在每次 API 调用前被调用

#### Q: refresh_token 失效
- 6 个月正常过期 → 需要用户重新登录
- 用户撤销了授权 → 需要用户重新登录
- 收到 `invalid_grant` 错误 → 清除所有 token，重定向到登录页

#### Q: API 返回 403
- 检查请求的 scope 是否在授权时申请
- 检查用户是否为 Spotify Premium（某些端点需要 Premium）

#### Q: API 返回 429
- 实现 Retry-After header 的等待逻辑
- 考虑请求去重和缓存

### 7.3 密钥管理

| 密钥 | 存储位置 | 安全级别 |
|------|---------|---------|
| Client ID | 代码中硬编码（PKCE 不需要 secret） | 公开可见，安全 |
| Client Secret | **不使用**（PKCE 流程不需要） | N/A |
| access_token | localStorage | 可被 XSS 读取，但 1h 过期 |
| refresh_token | localStorage | 6 个月有效，需注意 XSS 防护 |

### 7.4 上架准备

从 Dev Mode 转为正式应用：
1. 完成 Spotify Developer Terms of Service 审核
2. 申请 Extended Quota Mode（如用户超过 25 人）
3. 提供隐私政策和数据处理说明
4. 确保 Redirect URI 为生产环境地址

---

## 八、参考链接

- [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
- [Web API 概念 - Access Token](https://developer.spotify.com/documentation/web-api/concepts/access-token)
- [Authorization 指南](https://developer.spotify.com/documentation/web-api/concepts/authorization)
- [PKCE 流程教程](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow)
- [Token 刷新教程](https://developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens)
- [Scopes 列表](https://developer.spotify.com/documentation/web-api/concepts/scopes)
- [Android SDK](https://developer.spotify.com/documentation/android)
- [Web API Reference](https://developer.spotify.com/documentation/web-api/reference)
- [Rate Limits](https://developer.spotify.com/documentation/web-api/concepts/rate-limits)
- [2026 年 2 月 Dev Mode 变更](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- [示例代码仓库](https://github.com/spotify/web-api-examples/tree/master/authorization/authorization_code_pkce)

---

## 九、工时估算

| 阶段 | 内容 | 预估工时 |
|------|------|---------|
| Phase 1 | Developer 应用注册 + Redirect URI 配置 | 0.5 天 |
| Phase 2 | 认证服务实现（PKCE + Token 管理） | 2 天 |
| Phase 3 | Web API 封装（核心端点） | 2 天 |
| Phase 4 | UI 集成（登录页 + Spotify 浏览） | 2 天 |
| Phase 5 | 播放器集成（数据转换 + 智能混音增强） | 1.5 天 |
| 测试 | 联调测试 + 边界情况处理 | 1 天 |
| **总计** | | **9 天** |
