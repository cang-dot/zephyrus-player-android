package com.zephyrus.player;

import android.content.Context;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;

/**
 * A non-interactive lyric overlay placed immediately below the system status bar.
 * Application overlays cannot sit above Android's system status-bar window, so this
 * keeps the lyric visually attached to it without covering system icons or consuming taps.
 */
public final class StatusBarLyricOverlay {
    private static volatile StatusBarLyricOverlay instance;

    private final Context context;
    private final WindowManager windowManager;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private TextView lyricView;
    private boolean attached;
    private boolean enabled;
    private String lyric = "";
    private int accentColor = Color.WHITE;

    private StatusBarLyricOverlay(Context context) {
        this.context = context.getApplicationContext();
        this.windowManager = (WindowManager) this.context.getSystemService(Context.WINDOW_SERVICE);
    }

    public static StatusBarLyricOverlay getInstance(Context context) {
        if (instance == null) {
            synchronized (StatusBarLyricOverlay.class) {
                if (instance == null) {
                    instance = new StatusBarLyricOverlay(context);
                }
            }
        }
        return instance;
    }

    public boolean hasPermission() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context);
    }

    public boolean setEnabled(boolean value) {
        enabled = value;
        if (!value || !hasPermission()) {
            mainHandler.post(this::removeView);
            return !value;
        }
        mainHandler.post(this::render);
        return true;
    }

    public void update(String text, String color) {
        lyric = text == null ? "" : text.trim();
        accentColor = parseColor(color);
        mainHandler.post(this::render);
    }

    public void destroy() {
        enabled = false;
        mainHandler.post(this::removeView);
    }

    private void render() {
        if (!enabled || !hasPermission() || lyric.isEmpty()) {
            removeView();
            return;
        }

        ensureView();
        if (lyricView == null) return;
        lyricView.setText(lyric);
        lyricView.setTextColor(readableAccent(accentColor));
        lyricView.setBackground(createBackground(accentColor));

        if (!attached && windowManager != null) {
            try {
                windowManager.addView(lyricView, createLayoutParams());
                attached = true;
            } catch (Exception ignored) {
                attached = false;
            }
        }
    }

    private void ensureView() {
        if (lyricView != null) return;
        lyricView = new TextView(context);
        lyricView.setGravity(Gravity.CENTER);
        lyricView.setSingleLine(true);
        lyricView.setEllipsize(TextUtils.TruncateAt.END);
        lyricView.setIncludeFontPadding(false);
        lyricView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        lyricView.setTypeface(android.graphics.Typeface.DEFAULT, android.graphics.Typeface.BOLD);
        lyricView.setPadding(dp(14), 0, dp(14), 0);
        lyricView.setElevation(dp(6));
        lyricView.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
    }

    private WindowManager.LayoutParams createLayoutParams() {
        int overlayType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;
        int maxWidth = Math.max(dp(160), context.getResources().getDisplayMetrics().widthPixels - dp(96));
        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                maxWidth,
                dp(30),
                overlayType,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                        | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        params.y = isLandscape() ? dp(4) : getStatusBarHeight() + dp(4);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            params.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        return params;
    }

    private GradientDrawable createBackground(int color) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setShape(GradientDrawable.RECTANGLE);
        drawable.setCornerRadius(dp(15));
        drawable.setColor(Color.argb(184, 18, 18, 18));
        drawable.setStroke(dp(1), Color.argb(118, Color.red(color), Color.green(color), Color.blue(color)));
        return drawable;
    }

    private int readableAccent(int color) {
        double luminance = (0.2126 * Color.red(color)
                + 0.7152 * Color.green(color)
                + 0.0722 * Color.blue(color)) / 255.0;
        if (luminance >= 0.48) return color;
        return Color.rgb(
                (Color.red(color) + 255) / 2,
                (Color.green(color) + 255) / 2,
                (Color.blue(color) + 255) / 2
        );
    }

    private int parseColor(String value) {
        try {
            return Color.parseColor(value);
        } catch (Exception ignored) {
            return Color.WHITE;
        }
    }

    private int getStatusBarHeight() {
        int resourceId = context.getResources().getIdentifier("status_bar_height", "dimen", "android");
        return resourceId > 0 ? context.getResources().getDimensionPixelSize(resourceId) : dp(24);
    }

    private boolean isLandscape() {
        return context.getResources().getConfiguration().orientation
                == Configuration.ORIENTATION_LANDSCAPE;
    }

    private int dp(int value) {
        return Math.round(value * context.getResources().getDisplayMetrics().density);
    }

    private void removeView() {
        if (!attached || lyricView == null || windowManager == null) return;
        try {
            windowManager.removeViewImmediate(lyricView);
        } catch (Exception ignored) {
            // The window may already have been removed by the system.
        } finally {
            attached = false;
        }
    }
}
