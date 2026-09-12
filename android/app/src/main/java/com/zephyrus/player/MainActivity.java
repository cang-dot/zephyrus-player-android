package com.zephyrus.player;

import android.content.ClipboardManager;
import android.content.ClipData;
import android.content.ContentResolver;

import androidx.annotation.Nullable;
import android.content.Intent;
import android.content.res.Configuration;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.WindowManager;
import android.graphics.Color;
import android.webkit.WebView;
import android.util.Log;
import org.json.JSONObject;

import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.BackEventCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private NativeBridge nativeBridge;
    private static MainActivity instance;
    public static final int REQUEST_PICK_AUDIO_FOLDER = 10001;
    // 记录上次处理的剪贴板内容，避免重复处理
    private String lastClipboardContent = "";
    // 标记是否已通过 deep link intent 处理过（避免与剪贴板重复）
    private boolean deepLinkHandled = false;
    private String pendingExternalAudioPath;
    private boolean backEvaluationPending = false;
    private String pendingSpotifyCallback;
    private String lastSpotifyCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 切换到非启动主题，避免 Theme.SplashScreen 的 windowBackground（启动 drawable）
        // 在运行期间一直显示为白底，遮盖 CSS 延伸内容
        setTheme(R.style.AppTheme_NoActionBar);

        // 显式设置窗口背景，覆盖 Theme.SplashScreen 的白色 windowBackground
        // setTheme() 在 super.onCreate() 之后调用，不会自动更新已应用的 windowBackground
        getWindow().setBackgroundDrawableResource(R.color.windowBackground);

        // 内容延伸到状态栏和导航栏下方
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        // 状态栏和导航栏背景透明
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);

        // 允许内容延伸到挖孔屏区域
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }

        // 根据当前方向应用对应的系统栏模式
        applySystemBarsMode();

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

        // 返回先交给 Web 层的可见子层栈；只有无人消费时才后退路由或退出应用。
        // OnBackPressedDispatcher 会接收系统返回键和全面屏返回手势，并为后续
        // OnBackInvoked 的预见性返回进度接入保留统一提交入口。
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackStarted(BackEventCompat backEvent) {
                evaluateJavascript(
                        "window.__handleAndroidBackStart && window.__handleAndroidBackStart()");
            }

            @Override
            public void handleOnBackProgressed(BackEventCompat backEvent) {
                dispatchBackProgressToWeb(backEvent.getProgress());
            }

            @Override
            public void handleOnBackCancelled() {
                evaluateJavascript(
                        "window.__handleAndroidBackCancel && window.__handleAndroidBackCancel()");
            }

            @Override
            public void handleOnBackPressed() {
                dispatchBackToWeb();
            }
        });

        // 启动音乐播放前台服务（确保后台播放不被杀死）
        startMusicPlaybackService();

        // 处理通过 deep link 启动时的初始 Intent
        if (handleExternalAudioIntent(getIntent())) return;
        if (handleDeepLink(getIntent())) {
            deepLinkHandled = true;
        }
        // WebView 就绪后重放冷启动竞态挂起的外部音频
        if (pendingExternalAudioPath != null) {
            final String path = pendingExternalAudioPath;
            pendingExternalAudioPath = null;
            dispatchExternalAudioToWeb(path);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // 外部音频(系统"打开方式")优先于深链判断:content:// URI 不属于深链
        if (handleExternalAudioIntent(intent)) return;
        setIntent(intent);
        if (handleDeepLink(intent)) {
            deepLinkHandled = true;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_PICK_AUDIO_FOLDER && resultCode == RESULT_OK && data != null) {
            Uri treeUri = data.getData();
            if (treeUri != null) {
                try {
                    getContentResolver().takePersistableUriPermission(treeUri,
                            Intent.FLAG_GRANT_READ_URI_PERMISSION);
                } catch (Exception e) {
                    Log.w("NativeBridge", "Failed to take persistable permission", e);
                }
                String js = "window.__localMusicFolderPicked && window.__localMusicFolderPicked('"
                        + treeUri.toString() + "');";
                evaluateJavascript(js);
            }
        }
    }

    @Override
    protected void onPostResume() {
        super.onPostResume();
        if (nativeBridge != null) {
            nativeBridge.notifyOverlayPermissionState();
        }
        // 如果 deep link 已处理，跳过本次剪贴板检查
        if (deepLinkHandled) {
            deepLinkHandled = false;
            return;
        }
        // 检查剪贴板是否包含 zephyrus:// 歌曲链接
        checkClipboardForDeepLink();
    }

    private void dispatchBackToWeb() {
        if (backEvaluationPending) return;
        WebView webView = bridge.getWebView();
        if (webView == null) {
            finish();
            return;
        }
        backEvaluationPending = true;
        webView.evaluateJavascript(
                "Boolean(window.__handleAndroidBack && window.__handleAndroidBack())",
                handled -> {
                    backEvaluationPending = false;
                    if ("true".equals(handled)) return;
                    if (webView.canGoBack()) {
                        webView.goBack();
                    } else {
                        finish();
                    }
                });
    }

    private void dispatchBackProgressToWeb(float progress) {
        float clamped = Math.max(0f, Math.min(1f, progress));
        evaluateJavascript(
                "window.__handleAndroidBackProgress && window.__handleAndroidBackProgress("
                        + clamped + ")");
    }

    @Override
    public void onStart() {
        super.onStart();
        StatusBarLyricOverlay.getInstance(this).setAppVisible(true);
    }

    @Override
    public void onStop() {
        StatusBarLyricOverlay.getInstance(this).setAppVisible(false);
        super.onStop();
    }

    /**
     * 处理通过 deep link (zephyrus://song/{id}) 启动或恢复时的 Intent
     * 将 URL 传递给 WebView，由前端 JS 解析并播放对应歌曲
     * @return true 表示成功处理了 deep link
     */
    /** 判定 Intent 是否为系统"打开方式"投递的本地音频(content:// 或 file://) */
    private boolean isAudioViewIntent(Intent intent) {
        if (intent == null || intent.getAction() != Intent.ACTION_VIEW) return false;
        Uri data = intent.getData();
        if (data == null) return false;
        String scheme = data.getScheme();
        return ContentResolver.SCHEME_CONTENT.equals(scheme)
                || ContentResolver.SCHEME_FILE.equals(scheme);
    }

    /**
     * 外部音频:系统"打开方式"用 Zephyrus 打开本地音频文件。
     * 把 content:// 复制进应用缓存(规避一次性 URI 权限失效),
     * 读取元数据后交给前端入列并自动播放。
     */
    private boolean handleExternalAudioIntent(Intent intent) {
        if (!isAudioViewIntent(intent)) return false;
        Uri data = intent.getData();
        if (data == null) return false;

        // 复制到缓存目录,规避 ACTION_VIEW 授予的一次性读权限在重启后失效
        String cachePath;
        try {
            String name = data.getLastPathSegment();
            if (name == null) name = "external_audio";
            String ext = "";
            int dot = name.lastIndexOf('.');
            if (dot > 0) ext = name.substring(dot);
            cachePath = copyUriToCache(data, "external_" + System.currentTimeMillis() + ext);
        } catch (Exception e) {
            Log.e("ExternalAudio", "复制外部音频失败", e);
            return true;
        }
        if (cachePath == null) return true;

        dispatchExternalAudioToWeb(cachePath);
        return true;
    }

    /**
     * 把外部音频路径投递给前端处理器。带重试:冷启动时 Vue 可能尚未挂载
     * window.__externalAudioOpened(evaluateJavascript 返回 "null"),延迟重试直至就绪。
     */
    private void dispatchExternalAudioToWeb(String path) {
        WebView webView = bridge.getWebView();
        if (webView == null) {
            pendingExternalAudioPath = path;
            return;
        }
        final String js = "(window.__externalAudioOpened ? window.__externalAudioOpened("
                + JSONObject.quote(path) + ") : null)";
        webView.evaluateJavascript(js, result -> {
            if (result == null || "null".equals(result)) {
                new Handler(Looper.getMainLooper())
                        .postDelayed(() -> dispatchExternalAudioToWeb(path), 800);
            }
        });
    }

    @Nullable
    private String copyUriToCache(Uri uri, String fileName) {
        try {
            java.io.File dir = new java.io.File(getCacheDir(), "external_audio");
            if (!dir.exists()) dir.mkdirs();
            java.io.File out = new java.io.File(dir, fileName);
            try (java.io.InputStream in = getContentResolver().openInputStream(uri);
                 java.io.FileOutputStream outStream = new java.io.FileOutputStream(out)) {
                byte[] buffer = new byte[8192];
                int read;
                while ((read = in.read(buffer)) > 0) outStream.write(buffer, 0, read);
            }
            return out.getAbsolutePath();
        } catch (Exception e) {
            Log.e("ExternalAudio", "copyUriToCache failed", e);
            return null;
        }
    }

    private boolean handleDeepLink(Intent intent) {
        if (intent == null) return false;
        Uri data = intent.getData();
        if (data == null) return false;
        String url = data.toString();
        String scheme = data.getScheme() == null ? "" : data.getScheme().toLowerCase(Locale.ROOT);

        // 网易云分享链接（微信/浏览器"用其他软件打开"）：解析后走同一弹卡片流程
        if ("https".equals(scheme) || "http".equals(scheme)) {
            String host = data.getHost() == null ? "" : data.getHost().toLowerCase(Locale.ROOT);
            if (!isNeteaseMusicHost(host)) return false;
            Log.i("ZephyrusDeepLink", "Received netease link: " + url);
            lastClipboardContent = url;
            resolveNeteaseUrlAsync(url);
            return true;
        }

        // 只处理 zephyrus:// scheme
        if (!url.startsWith("zephyrus://")) return false;
        Log.i("ZephyrusDeepLink", "Received deep link: " + url);

        // Spotify OAuth 回调：zephyrus://auth/callback?code=xxx
        if (url.startsWith("zephyrus://auth/callback")) {
            if (url.equals(lastSpotifyCallback)) {
                Log.i("SpotifyAuth", "Ignoring duplicate OAuth callback");
                return true;
            }
            lastSpotifyCallback = url;
            Log.i("SpotifyAuth", "Received OAuth callback: " + url);
            dispatchSpotifyCallback(url, 0);
            lastClipboardContent = url;
            return true;
        }

        // 歌曲分享链接：zephyrus://song/{id}
        WebView webView = bridge.getWebView();
        if (webView != null) {
            // 统一调用 __handleClipboardShare：Intent 和剪贴板都走卡片流程
            // url 来自外部 Intent（任意应用可发送，属不可信输入），必须经 JSONObject.quote
            // 转义为合法 JS 字符串字面量，防止拼接式 JS 注入（写法参照 dispatchSpotifyCallback）
            final String js = "window.__handleClipboardShare && window.__handleClipboardShare("
                    + JSONObject.quote(url) + ");";
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

    private boolean isNeteaseMusicHost(String host) {
        return "music.163.com".equals(host)
                || "y.music.163.com".equals(host)
                || host.endsWith(".music.163.com")
                || "163cn.tv".equals(host)
                || host.endsWith(".163cn.tv");
    }

    /** 163cn.tv 短链需跟随 302 拿最终长链（原生解析绕开 WebView CORS），其他网易域名直接使用 */
    private void resolveNeteaseUrlAsync(final String url) {
        if (!url.contains("163cn.tv")) {
            dispatchShareUrlToWeb(url);
            return;
        }
        new Thread(() -> {
            String resolved = resolveRedirectTarget(url);
            final String target = resolved != null ? resolved : url;
            runOnUiThread(() -> dispatchShareUrlToWeb(target));
        }).start();
    }

    /** 单次 302 跟随：网易云短链 Location 即最终长链 */
    private String resolveRedirectTarget(String url) {
        try {
            HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);
            conn.setRequestMethod("HEAD");
            conn.setRequestProperty("User-Agent",
                    "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36");
            int code = conn.getResponseCode();
            String location = conn.getHeaderField("Location");
            conn.disconnect();
            if (location != null && !location.isEmpty()
                    && (code == HttpURLConnection.HTTP_MOVED_PERM
                        || code == HttpURLConnection.HTTP_MOVED_TEMP
                        || code == 303 || code == 307 || code == 308)) {
                return new URL(new URL(url), location).toString();
            }
        } catch (Exception e) {
            Log.w("ZephyrusDeepLink", "Resolve netease short link failed", e);
        }
        return null;
    }

    /** 复用 Intent 链路的三次重试注入，把链接交给前端统一弹卡片 */
    private void dispatchShareUrlToWeb(String url) {
        WebView webView = bridge.getWebView();
        if (webView == null) return;
        // url 来自外部 Intent（不可信输入），必须经 JSONObject.quote 转义
        final String js = "window.__handleClipboardShare && window.__handleClipboardShare("
                + JSONObject.quote(url) + ");";
        webView.postDelayed(() -> evaluateJavascript(js), 300);
        webView.postDelayed(() -> evaluateJavascript(js), 1500);
        webView.postDelayed(() -> evaluateJavascript(js), 3000);
    }

    /**
     * 将 OAuth 回调可靠地投递到 WebView。冷启动时 WebView/JS 可能尚未完成，
     * 因此在 10 秒窗口内重试；JSONObject.quote 可正确处理 URL 中的参数字符。
     */
    private void dispatchSpotifyCallback(String url, int attempt) {
        pendingSpotifyCallback = url;
        WebView webView = bridge.getWebView();
        if (webView == null) {
            if (attempt < 40) {
                new android.os.Handler(getMainLooper()).postDelayed(
                        () -> dispatchSpotifyCallback(url, attempt + 1), 250);
            }
            return;
        }

        final String js = "(function(){if(typeof window.__handleSpotifyCallback==='function'){window.__handleSpotifyCallback("
                + JSONObject.quote(url) + ");return true;}return false;})();";
        webView.evaluateJavascript(js, result -> {
            // JS 已接收后停止重试，避免同一 OAuth code 被反复处理并触发状态闪烁。
            boolean accepted = "true".equalsIgnoreCase(result == null ? "" : result.replace("\"", ""));
            if (!accepted && attempt < 40) {
                webView.postDelayed(() -> dispatchSpotifyCallback(url, attempt + 1), 250);
            }
        });
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
                // content 来自系统剪贴板（不可信输入），同样必须经 JSONObject.quote 转义
                final String js = "window.__handleClipboardShare && window.__handleClipboardShare("
                        + JSONObject.quote(content) + ");";
                // 延迟执行，确保前端 JS 已就绪
                webView.postDelayed(() -> evaluateJavascript(js), 500);
                // 兜底：1.5秒后再试一次
                webView.postDelayed(() -> evaluateJavascript(js), 1500);
            }
        } catch (Exception e) {
            Log.w("ZephyrusClipboard", "Failed to read clipboard", e);
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
     * 获取 Capacitor Bridge 实例（供 MusicPlaybackService 等外部类访问 WebView）
     */
    public com.getcapacitor.Bridge getBridge() {
        return this.bridge;
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
        if (nativeBridge != null) {
            nativeBridge.detachAudioEngine();
        }
        try {
            StatusBarLyricOverlay.getInstance(this).destroy();
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
     * 窗口焦点变化时重新应用系统栏模式
     */
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applySystemBarsMode();
        }
    }

    /**
     * 配置变化（横竖屏切换）时重新应用系统栏模式
     */
    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        applySystemBarsMode();
    }

    /**
     * 根据当前屏幕方向应用对应的系统栏模式：
     * - 竖屏：状态栏可见且背景透明（不隐藏系统栏）
     * - 横屏：沉浸式全屏（隐藏系统栏，从边缘滑入时临时呼出）
     */
    private void applySystemBarsMode() {
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(
                getWindow(), getWindow().getDecorView());

        boolean isLandscape = getResources().getConfiguration().orientation
                == Configuration.ORIENTATION_LANDSCAPE;

        if (isLandscape) {
            // 横屏：沉浸式全屏，隐藏系统栏
            controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            controller.hide(WindowInsetsCompat.Type.systemBars());
        } else {
            // 竖屏：显示系统栏，背景透明
            controller.show(WindowInsetsCompat.Type.systemBars());
        }
    }
}
