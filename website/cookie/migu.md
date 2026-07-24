# 咪咕音乐 Cookie 获取

获取咪咕音乐 Cookie 可以在跨平台搜索中获取咪咕独占歌曲。

## 方法一：浏览器开发者工具

### 步骤

1. 在电脑浏览器打开 [music.cmcc.com](https://music.cmcc.com) 或 [m.music.cm3.com](https://m.music.cm3.com)
2. 登录你的咪咕音乐账号
3. 按 `F12` 打开开发者工具
4. 切换到 **Application** 标签页
5. 左侧 **Cookies** → 对应域名
6. 找到以下 Cookie：

| Cookie 字段 | 说明 |
|------------|------|
| `migu_user_id` | 用户 ID |
| `migu_token` | 鉴权令牌 |
| `migu_session_id` | 会话 ID |

7. 复制这些值

### 在应用中配置

1. 打开 **设置** → **网络**
2. 在咪咕 Cookie 输入框中粘贴完整 Cookie 字符串
3. 保存

## 方法二：抓包

1. 手机打开咪咕音乐 App，播放一首歌
2. 抓包捕获 `music.cmcc.com` 的请求
3. 复制请求头中的 Cookie

::: tip 提示
咪咕音乐的 Cookie 获取相对简单，且咪咕有很多独家版权歌曲（如部分周杰伦歌曲）。
:::
