# QQ音乐 Cookie 获取

获取 QQ音乐 Cookie 可以在跨平台搜索中获取 QQ 独占歌曲的播放链接。

## 方法一：浏览器开发者工具

### 步骤

1. 在电脑浏览器打开 [y.qq.com](https://y.qq.com)
2. 登录你的 QQ音乐账号
3. 按 `F12` 打开开发者工具
4. 切换到 **Application** 标签页
5. 左侧 **Cookies** → `https://y.qq.com`
6. 找到以下 Cookie：

| Cookie 字段 | 说明 |
|------------|------|
| `uin` | QQ 号码 |
| `qqmusic_key` | QQ音乐鉴权令牌 |
| `qm_keyst` | 登录令牌 |

7. 复制这三个值

### 在应用中配置

1. 打开 **设置** → **网络**
2. 在 QQ音乐 Cookie 输入框中粘贴：
   ```
   uin=你的QQ号; qqmusic_key=你的key; qm_keyst=你的token
   ```
3. 保存

## 方法二：抓包

1. 手机打开 QQ音乐 App，播放一首 VIP 歌曲
2. 使用抓包工具捕获 `y.qq.com` 或 `u.y.qq.com` 的请求
3. 复制请求头中的 Cookie

::: warning 注意
- `qqmusic_key` 是最关键的字段，没有它无法获取 VIP 歌曲
- QQ音乐 Cookie 有效期较短，可能需要频繁更新
- JOOX 是 QQ音乐的国际版，曲库高度重合，可使用 JOOX 作为替代
:::
