# 网易云 Cookie 获取

获取网易云音乐的 Cookie 可以解锁 VIP 歌曲、更高音质等。

## 方法一：浏览器开发者工具（推荐）

### 步骤

1. 在电脑浏览器打开 [music.163.com](https://music.163.com)
2. 登录你的网易云音乐账号
3. 按 `F12` 打开开发者工具
4. 切换到 **Application**（应用） 标签页
5. 左侧找到 **Cookies** → `https://music.163.com`
6. 找到名为 `MUSIC_U` 的 Cookie

![浏览器开发者工具示意图](https://via.placeholder.com/600x400?text=Application+%E2%86%92+Cookies+%E2%86%92+MUSIC_U)

7. 复制 `MUSIC_U` 的值

### 在应用中配置

1. 打开 Zephyrus Player
2. 进入 **设置** → **网络**
3. 在 Cookie 输入框中粘贴 `MUSIC_U=你的值`
4. 保存

## 方法二：抓包

1. 手机安装抓包工具（如 HttpCanary）
2. 打开网易云音乐 App，播放一首歌
3. 在抓包记录中找到 `music.163.com` 的请求
4. 复制请求头中的 `Cookie` 字段

## Cookie 字段说明

| 字段 | 说明 | 必须 |
|------|------|------|
| `MUSIC_U` | 登录令牌，解锁 VIP | ✅ |
| `__csrf` | CSRF 令牌 | 可选 |
| `ntse_cweb` | 设备标识 | 可选 |

::: warning 注意
- Cookie 有效期约 30 天，过期后需重新获取
- 不要将 Cookie 分享给他人，等同于账号密码
- Cookie 仅存储在设备本地，不会上传
:::
