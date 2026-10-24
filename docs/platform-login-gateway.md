# 平台登录网关部署说明（Folia 移植新链）

`server-platform-login.js`（mucang.xyz 网关）自本版本起内置两条新登录/解析链：

- **QQ**：`@yakult-green-tea/qq-music-api`（MIT，子进程 + `/platform/qq/api/*` 反代）
  ——三通道扫码（QQ/微信/QQ 音乐 App 通用码）、sealed/stored 会话、`/login/refresh` 续期、
  结构化失败（20279 设备超限等）、`/getMusicPlay` 带会话播放链接；
- **酷狗**：`kugoumusicapi`（MakcRe/KuGouMusicApi v1.6.0，MIT，进程内直调
  `/platform/kugou/api/*`）——扫码登录、`login_token` 续期、`song_url` 播放链接。

旧自建登录路由全部保留；前端探测新链失败（旧网关/未配密钥）自动回退旧链。

## 服务器升级步骤

```bash
# 1. 拉代码 + 装依赖（新增两个包）
npm install

# 2. 生成并配置密钥（只保存在服务端，勿提交/勿加 VITE_ 前缀）
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
export QQ_SESSION_SECRET=<上面生成的密钥>

# 3. 重启网关（qq-music-api 子进程由网关自动拉起，监听 127.0.0.1:3210，
#    可用 QQ_API_PORT 覆盖）
node server-platform-login.js
```

## 环境变量

| 变量 | 用途 | 必需 |
|---|---|---|
| `QQ_SESSION_SECRET` | sealed 登录态加密密钥（≥32 字节）；未配置时 QQ 新链返回 501，前端回退旧链 | QQ 新链 |
| `QQ_SESSION_SECRET_PREVIOUS` | 密钥轮换时临时验证旧令牌 | 可选 |
| `QQ_AUTH_STATE_PATH` | QQ 设备标识文件（默认 `.auth-state/qq-device.json`） | 可选 |
| `QQ_AUTH_SESSION_PATH` | QQ 加密登录态文件（默认 `.auth-state/qq-session.enc`） | 可选 |
| `QQ_API_PORT` | qq-music-api 子进程端口（默认 3210） | 可选 |

## 部署后自检

```bash
curl https://mucang.xyz/zephyrus/api/platform/qq/api/login/channels
# 期望 {"code":200,"data":{"channels":["qq","wechat","qqmusic"],...}}

curl https://mucang.xyz/zephyrus/api/platform/kugou/api/login/qr/key
# 期望 {"code":200,"data":{"qrcode":"..."}}
```

## 已知边界（来自 Folia 文档的语义）

- **设备身份**：常驻网关对 QQ 是**一台设备**（身份由 `QQ_SESSION_SECRET` 派生）；
  多用户共享设备额度，`20279` 时提示用户去 QQ 音乐 App「设置→设备管理」清理。
  换密钥 = 换设备，密钥定下后勿随意更换。
- **登录时效**：QQ 登录态约 3 天，前端每小时问一次 `/login/refresh`，
  到期 <6h 网关才换新令牌；从首次扫码起最多 30 天需重扫。
- `server-*.js` 不在 `deploy_web.py` 部署范围，网关更新需手动执行上述步骤。
