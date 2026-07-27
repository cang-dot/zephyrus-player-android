package com.zephyrus.player;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.webkit.JavascriptInterface;

import org.json.JSONObject;

/**
 * WebView 与原生 Android 之间的桥接接口。
 * 通过 webView.addJavascriptInterface(new NativeBridge(activity), "AndroidNative") 注册。
 * WebView 中可通过 window.AndroidNative.xxx() 调用原生方法。
 */
public class NativeBridge {
    private final MainActivity activity;

    public NativeBridge(MainActivity activity) {
        this.activity = activity;
    }

    /**
     * 设置状态栏图标外观
     * @param isDarkTheme true=深色主题（白色图标），false=浅色主题（深色图标）
     */
    @JavascriptInterface
    public void setStatusBarDark(boolean isDarkTheme) {
        activity.setStatusBarAppearance(isDarkTheme);
    }

    /**
     * 设置状态栏背景颜色
     * @param hexColor 十六进制颜色字符串，如 "#f5f1eb" 或 "#1a1a1a"
     */
    @JavascriptInterface
    public void setStatusBarColor(String hexColor) {
        activity.setStatusBarBackgroundColor(hexColor);
    }

    /**
     * 获取安全区域 insets（状态栏高度、导航栏高度）
     * @return JSON 字符串，如 {"top": 24, "bottom": 48, "left": 0, "right": 0}
     */
    @JavascriptInterface
    public String getSafeAreaInsets() {
        JSONObject result = new JSONObject();
        try {
            // 优先使用 DisplayCutout API 获取精确挖孔避让高度
            int top = getCutoutSafeInsetTop();
            // 回退：如果没有挖孔或获取失败，使用状态栏高度
            if (top <= 0) {
                top = getStatusBarHeight();
            }
            result.put("top", top);
            result.put("bottom", 0);
            result.put("left", 0);
            result.put("right", 0);
            result.put("density", activity.getResources().getDisplayMetrics().density);
        } catch (Exception e) {
            // ignore
        }
        return result.toString();
    }

    /**
     * 通过 DisplayCutout API 获取挖孔区域的安全避让高度（像素）
     * 仅在 API 28+ 可用
     */
    private int getCutoutSafeInsetTop() {
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.P) {
            return 0;
        }
        try {
            android.view.View decorView = activity.getWindow().getDecorView();
            if (decorView == null) return 0;
            android.view.WindowInsets insets = decorView.getRootWindowInsets();
            if (insets == null) return 0;
            android.view.DisplayCutout cutout = insets.getDisplayCutout();
            if (cutout == null) return 0;
            return cutout.getSafeInsetTop();
        } catch (Exception e) {
            return 0;
        }
    }

    /**
     * 获取状态栏高度（像素）
     */
    private int getStatusBarHeight() {
        int result = 0;
        int resourceId = activity.getResources().getIdentifier("status_bar_height", "dimen", "android");
        if (resourceId > 0) {
            result = activity.getResources().getDimensionPixelSize(resourceId);
        }
        return result;
    }

    /**
     * 获取导航栏高度（像素）
     */
    private int getNavigationBarHeight() {
        int result = 0;
        int resourceId = activity.getResources().getIdentifier("navigation_bar_height", "dimen", "android");
        if (resourceId > 0) {
            result = activity.getResources().getDimensionPixelSize(resourceId);
        }
        return result;
    }

    /**
     * 更新媒体通知（歌曲信息 + 播放状态）
     */
    @JavascriptInterface
    public void updateMediaNotification(String title, String artist, String album,
                                        String artworkUrl, boolean isPlaying,
                                        double duration, double position) {
        MediaNotificationManager mgr = MediaNotificationManager.getInstance(activity);
        mgr.updateMediaSession(title, artist, album, artworkUrl, isPlaying, duration, position);
    }

    /**
     * 清除媒体通知
     */
    @JavascriptInterface
    public void clearMediaNotification() {
        MediaNotificationManager mgr = MediaNotificationManager.getInstance(activity);
        mgr.clear();
    }

    /**
     * 显示空闲通知（未在播放时的常驻通知）
     */
    @JavascriptInterface
    public void showIdleNotification() {
        MediaNotificationManager mgr = MediaNotificationManager.getInstance(activity);
        mgr.showIdleNotification();
    }

    /**
     * 退出应用
     */
    @JavascriptInterface
    public void exitApp() {
        activity.finishAffinity();
    }

    // ==================== 保活相关设置 ====================

    /**
     * 打开电池优化设置（请求忽略电池优化）
     */
    @JavascriptInterface
    public void openBatteryOptimizationSettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + activity.getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(intent);
        } catch (Exception e) {
            // 回退到电池优化列表页
            try {
                Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.startActivity(intent);
            } catch (Exception e2) {
                openAppDetailsSettings();
            }
        }
    }

    /**
     * 打开应用详情设置页（权限管理）
     */
    @JavascriptInterface
    public void openAppDetailsSettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + activity.getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(intent);
        } catch (Exception e) {
            // ignore
        }
    }

    /**
     * 打开通知设置页
     */
    @JavascriptInterface
    public void openNotificationSettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            intent.putExtra(Settings.EXTRA_APP_PACKAGE, activity.getPackageName());
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(intent);
        } catch (Exception e) {
            openAppDetailsSettings();
        }
    }

    /**
     * 打开"显示在其他应用上层"设置页
     */
    @JavascriptInterface
    public void openDisplayOverOtherAppsSettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION);
            intent.setData(Uri.parse("package:" + activity.getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(intent);
        } catch (Exception e) {
            openAppDetailsSettings();
        }
    }

    /**
     * 尝试打开自启动管理页（各厂商不同）
     */
    @JavascriptInterface
    public void openAutoStartSettings() {
        // 各厂商自启动管理页 Intent
        String[][] autoStartIntents = {
            // 小米 / MIUI
            {"com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"},
            // 华为 / EMUI
            {"com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"},
            // OPPO / ColorOS
            {"com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"},
            {"com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"},
            // vivo / FuntouchOS
            {"com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager"},
            // 三星
            {"com.samsung.android.sm", "com.samsung.android.sm.ui.ram.AutoRunActivity"},
            // 魅族
            {"com.meizu.safe", "com.meizu.safe.security.SHOW_APPSEC"},
            // 一加
            {"com.oneplus.security", "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity"},
            // 乐视
            {"com.letv.android.letvsafe", "com.letv.android.letvsafe.AutobootManageActivity"},
        };

        for (String[] entry : autoStartIntents) {
            try {
                Intent intent = new Intent();
                intent.setComponent(new android.content.ComponentName(entry[0], entry[1]));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.startActivity(intent);
                return;
            } catch (Exception e) {
                // 继续尝试下一个
            }
        }

        // 所有厂商 Intent 均失败，回退到应用详情页
        openAppDetailsSettings();
    }
}
