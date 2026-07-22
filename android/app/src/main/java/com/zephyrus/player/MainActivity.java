package com.zephyrus.player;

import android.content.Intent;
import android.os.Bundle;
import android.view.WindowManager;
import android.graphics.Color;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private NativeBridge nativeBridge;
    private static MainActivity instance;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 切换到非启动主题，避免 Theme.SplashScreen 的 windowBackground（启动 drawable）
        // 在运行期间一直显示为白底，遮盖 CSS 延伸内容
        setTheme(R.style.AppTheme_NoActionBar);

        // 显式设置窗口背景，覆盖 Theme.SplashScreen 的白色 windowBackground
        // setTheme() 在 super.onCreate() 之后调用，不会自动更新已应用的 windowBackground
        getWindow().setBackgroundDrawableResource(R.color.windowBackground);

        // 沉浸式状态栏：内容延伸到状态栏和导航栏下方
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        // 沉浸式模式：状态栏和导航栏完全透明，内容由 CSS 延伸
        // 仅控制图标明暗外观，背景色由前端 CSS / 封面取色决定
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);

        // 沉浸式模式：系统栏完全隐藏，从边缘滑入时临时呼出，松手后自动隐藏
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(
                getWindow(), getWindow().getDecorView());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());

        // 允许内容延伸到刘海屏区域
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }

        instance = this;

        // 注册原生桥接接口供 WebView 调用
        nativeBridge = new NativeBridge(this);
        WebView webView = bridge.getWebView();
        if (webView != null) {
            // WebView 背景设为透明，让 CSS 背景透过状态栏区域可见
            webView.setBackgroundColor(Color.TRANSPARENT);

            webView.addJavascriptInterface(nativeBridge, "AndroidNative");
            // 初始状态栏外观：浅色背景 → 深色图标
            setStatusBarAppearance(false);
        }

        // 使用 OnBackPressedDispatcher 拦截返回键 / 全面屏手势返回
        // 直接调用 webView.goBack() 让 WebView 历史出栈（触发 JS popstate 事件）
        // 前端通过 history.pushState/popstate 管理播放器等覆层的返回层级
        // 当 WebView 没有更多历史时，finish() 退出应用
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = bridge.getWebView();
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                } else {
                    finish();
                }
            }
        });

        // 启动音乐播放前台服务（确保后台播放不被杀死）
        startMusicPlaybackService();
    }

    /**
     * 启动音乐播放前台服务
     */
    private void startMusicPlaybackService() {
        Intent serviceIntent = new Intent(this, MusicPlaybackService.class);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
    }

    /**
     * 停止音乐播放前台服务
     */
    private void stopMusicPlaybackService() {
        Intent serviceIntent = new Intent(this, MusicPlaybackService.class);
        stopService(serviceIntent);
    }

    /**
     * 获取当前 MainActivity 实例
     */
    public static MainActivity getInstance() {
        return instance;
    }

    /**
     * 设置状态栏背景颜色（供 NativeBridge 调用）
     * @param hexColor 十六进制颜色字符串，如 "#f5f1eb"
     */
    public void setStatusBarBackgroundColor(String hexColor) {
        runOnUiThread(() -> {
            try {
                getWindow().setStatusBarColor(Color.parseColor(hexColor));
                // 同步更新导航栏颜色，避免封面/主题切换后底部出现灰色条带。
                // edge-to-edge 模式下 setDecorFitsSystemWindows(false) 仍由系统绘制 bar 背景，
                // 因此显式设置颜色比依赖 TRANSPARENT 灰色 scrim 更可靠。
                getWindow().setNavigationBarColor(Color.parseColor(hexColor));
            } catch (Exception e) {
                // ignore invalid color
            }
        });
    }

    @Override
    public void onDestroy() {
        // 清理媒体通知
        try {
            MediaNotificationManager.getInstance(this).release();
        } catch (Exception e) {
            // ignore
        }
        instance = null;
        super.onDestroy();
    }

    /**
     * 设置状态栏图标外观（沉浸式状态栏）
     * @param isDark true=深色主题（白色图标），false=浅色主题（深色图标）
     */
    public void setStatusBarAppearance(boolean isDark) {
        runOnUiThread(() -> {
            try {
                WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(
                        getWindow(), getWindow().getDecorView());
                // isDark=true → 深色背景 → 浅色（白色）图标 → isAppearanceLightStatusBars=false
                // isDark=false → 浅色背景 → 深色图标 → isAppearanceLightStatusBars=true
                controller.setAppearanceLightStatusBars(!isDark);
            } catch (Exception e) {
                // ignore
            }
        });
    }

    /**
     * 在 WebView 中执行 JavaScript
     */
    public void evaluateJavascript(String js) {
        runOnUiThread(() -> {
            WebView webView = bridge.getWebView();
            if (webView != null) {
                webView.evaluateJavascript(js, null);
            }
        });
    }

    /**
     * 窗口焦点变化时重新隐藏系统栏，保持沉浸模式
     */
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applyImmersiveMode();
        }
    }

    /**
     * 应用沉浸式模式：隐藏系统栏
     */
    private void applyImmersiveMode() {
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(
                getWindow(), getWindow().getDecorView());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }
}
