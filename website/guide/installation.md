# 安装与更新

Zephyrus Player 当前只发布 Android APK。推荐从 GitHub Release 下载正式签名版本。

## 下载

- [GitHub Releases](https://github.com/cang-dot/zephyrus-player-android/releases)
- [服务器最新版本直链](https://mucang.xyz/zephyrus/apks/zephyrus-player-latest.apk)

当前正式版本为 `v1.2.0`。下载文件名应类似 `zephyrus-player-v1.2.0.apk`。

## 系统要求

- Android 8.0 或更高版本
- 建议至少保留 300 MB 可用空间
- 在线搜索和歌词需要网络连接
- 状态栏歌词需要悬浮窗权限

## 安装步骤

1. 下载 APK。
2. 在系统下载管理器中打开文件。
3. 如果系统拦截，允许当前浏览器或文件管理器“安装未知应用”。
4. 核对应用名为 Zephyrus Player 后完成安装。

覆盖安装会保留本地设置和缓存。切勿从不明来源下载改包，正式 Release 应由项目配置的 Android 密钥签名。

## 首次启动

首次启动会出现项目来源说明。进入应用后建议依次完成：

1. 在“我的”中添加需要的平台账号。
2. 在“设置 > 播放”中选择播放器样式和歌词选项。
3. 需要状态栏歌词时，打开悬浮窗权限并运行真实预览。
4. 本地音乐用户在歌单页切换到“本地”，选择扫描目录。

## 更新

应用会检查 GitHub Release。更新弹窗提供正式下载链接，下载完成后由 Android 安装器覆盖安装。若自动检查失败，可以直接访问 Release 页面。

更新前不要清除应用数据。卸载后重装会移除本机设置、导入字体和部分缓存。

## ADB 安装

开发者可以连接已授权设备后执行：

```bash
adb install -r zephyrus-player-v1.2.0.apk
```

出现 `INSTALL_FAILED_VERSION_DOWNGRADE` 时，说明设备上的版本号更高。不要直接清除数据，先确认是否安装了测试版。
