package com.zephyrus.player;

import android.content.ClipboardManager;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.WindowManager;
import android.graphics.Color;
import android.webkit.WebView;
import android.util.Log;

import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private NativeBridge nativeBridge;
    private static MainActivity instance;
    // 记录上次处理的剪贴板内容，避免重复处理
    private String lastClipboardContent = "";
    // 标记是否已通过 deep link intent 处理过（避免与剪贴板重复）
    private boolean deepLinkHandled = false;

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

        // 处理通过 deep link 启动时的初始 Intent
        if (handleDeepLink(getIntent())) {
            deepLinkHandled = true;
        }
    }

    @Override
    protected void onPostResume() {
        super.onPostResume();
        // 如果 deep link 已处理，跳过本次剪贴板检查
        if (deepLinkHandled) {
            deepLinkHandled = false;
            return;
        }
        // 检查剪贴板是否包含 zephyrus:// 歌曲链接
        checkClipboardForDeepLink();
    }

    /**
     * 处理通过 deep link (zephyrus://song/{id}) 启动或恢复时的 Intent
     * 将 URL 传递给 WebView，由前端 JS 解析并播放对应歌曲
     * @return true 表示成功处理了 deep link
     */
    private boolean handleDeepLink(Intent intent) {
        if (intent == null) return false;
        Uri data = intent.getData();
        if (data == null) return false;
        String url = data.toString();
        // 只处理 zephyrus:// scheme
        if (!url.startsWith("zephyrus://")) return false;
        Log.i("ZephyrusDeepLink", "Received deep link: " + url);

        WebView webView = bridge.getWebView();
        if (webView != null) {
            // 统一调用 __handleClipboardShare：Intent 和剪贴板都走卡片流程
            final String js = "window.__handleClipboardShare && window.__handleClipboardShare('" + url + "');";
            // 延迟执行，确保前端 JS 已就绪
            webView.postDelayed(() -> evaluateJavascript(js), 500);
            // 兜底：1.5秒后再试一次（冷启动时 JS 可能尚未注册）
            webView.postDelayed(() -> evaluateJavascript(js), 1500);
            // 再次兜底：3秒后最后试一次
            webView.postDelayed(() -> evaluateJavascript(js), 3000);
        }
        // 记录到 lastClipboardContent 防止 onResume 重复处理
        lastClipboardContent = url;
        return true;
    }

    /**
     * 检查剪贴板是否包含 zephyrus://song/ 格式的歌曲链接
     * 如果包含且与上次处理的不同，则传递给前端播放
     */
    private void checkClipboardForDeepLink() {
        try {
            ClipboardManager clipboard = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
            if (clipboard == null) return;
            if (!clipboard.hasPrimaryClip()) return;
            ClipData clip = clipboard.getPrimaryClip();
            if (clip == null || clip.getItemCount() == 0) return;
            CharSequence text = clip.getItemAt(0).coerceToText(this);
            if (text == null) return;
            String content = text.toString().trim();

            // 检查是否是 zephyrus:// 歌曲链接
            if (!content.startsWith("zephyrus://song/")) return;

            // 避免重复处理同一内容
            if (content.equals(lastClipboardContent)) return;
            lastClipboardContent = content;

            Log.i("ZephyrusClipboard", "Found deep link in clipboard: " + content);

            // 传递给前端处理：弹出歌曲卡片
            WebView webView = bridge.getWebView();
            if (webView != null) {
                final String js = "window.__handleClipboardShare && window.__handleClipboardShare('" + content + "');";
                // 延迟执行，确保前端 JS 已就绪
                webView.postDelayed(() -> evaluateJavascript(js), 500);
                // 兜底：1.5秒后再试一次
                webView.postDelayed(() -> evaluateJavascript(js), 1500);
            }
        } catch (Exception e) {
            Log.w("ZephyrusClipboard", "Failed to read clipboard", e);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (handleDeepLink(intent)) {
            deepLinkHandled = true;
        }
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
