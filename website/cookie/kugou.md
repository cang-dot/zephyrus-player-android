# 酷狗音乐 Cookie 获取

获取酷狗音乐 Cookie 可以在跨平台搜索中获取酷狗音源的歌曲。

## 方法一：浏览器开发者工具

### 步骤

1. 在电脑浏览器打开 [kugou.com](https://www.kugou.com)
2. 登录你的酷狗音乐账号
3. 按 `F12` 打开开发者工具
4. 切换到 **Application** 标签页
5. 左侧 **Cookies** → `https://www.kugou.com`
6. 找到以下 Cookie：

| Cookie 字段 | 说明 |
|------------|------|
| `KugooID` | 用户 ID |
| `KugooPwd` | 加密密码令牌 |
| `kg_mid` | 设备标识 |

7. 复制这些值

### 在应用中配置

1. 打开 **设置** → **网络**
2. 在酷狗 Cookie 输入框中粘贴完整 Cookie 字符串
3. 保存

## 方法二：抓包

1. 手机打开酷狗音乐 App，播放一首歌
2. 抓包捕获 `kugou.com` 或 `m.kugou.com` 的请求
3. 复制请求头中的 Cookie

::: warning 注意
酷狗音乐的 URL 解析可能不稳定，部分歌曲即使搜索到也可能无法播放。
:::
