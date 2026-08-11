package com.zephyrus.player;

import android.content.Context;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.TextUtils;
import android.text.style.ForegroundColorSpan;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

/** Non-touch lyric capsule rendered by an Android application overlay. */
public final class StatusBarLyricOverlay {
    private static volatile StatusBarLyricOverlay instance;

    private final Context context;
    private final WindowManager windowManager;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private TextView lyricView;
    private boolean attached;
    private boolean enabled;
    private boolean wordByWord = true;
    private String lyric = "";
    private final List<String> words = new ArrayList<>();
    private int currentWordIndex = -1;
    private int themeColor = Color.WHITE;
    private double portraitX = 0.5;
    private double portraitY = 0.035;
    private double landscapeX = 0.5;
    private double landscapeY = 0.045;
    private float fontSizeSp = 12f;
    private int fontWeight = 700;
    private String fontSource = "system";
    private String fontId = "";
    private String sungSource = "theme";
    private String sungColor = "#ffffff";
    private String currentSource = "theme";
    private String currentColor = "#ffffff";
    private String upcomingSource = "custom";
    private String upcomingColor = "#d7d7d7";
    private String fillSource = "custom";
    private String fillColor = "#121212";
    private String borderSource = "theme";
    private String borderColor = "#ffffff";
    private double surfaceOpacity = 0.72;

    private StatusBarLyricOverlay(Context context) {
        this.context = context.getApplicationContext();
        this.windowManager = (WindowManager) this.context.getSystemService(Context.WINDOW_SERVICE);
    }

    public static StatusBarLyricOverlay getInstance(Context context) {
        if (instance == null) {
            synchronized (StatusBarLyricOverlay.class) {
                if (instance == null) instance = new StatusBarLyricOverlay(context);
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

    public boolean applyConfig(String configJson) {
        try {
            JSONObject config = new JSONObject(configJson == null ? "{}" : configJson);
            enabled = config.optBoolean("enabled", false);
            wordByWord = config.optBoolean("wordByWord", true);
            JSONObject positions = config.optJSONObject("positions");
            if (positions != null) {
                JSONObject portrait = positions.optJSONObject("portrait");
                JSONObject landscape = positions.optJSONObject("landscape");
                if (portrait != null) {
                    portraitX = clamp01(portrait.optDouble("x", portraitX));
                    portraitY = clamp01(portrait.optDouble("y", portraitY));
                }
                if (landscape != null) {
                    landscapeX = clamp01(landscape.optDouble("x", landscapeX));
                    landscapeY = clamp01(landscape.optDouble("y", landscapeY));
                }
            }
            JSONObject font = config.optJSONObject("font");
            if (font != null) {
                fontSource = font.optString("source", "system");
                fontId = font.optString("id", "");
                fontSizeSp = (float) clamp(font.optDouble("sizeSp", 12), 9, 28);
                fontWeight = (int) clamp(font.optInt("weight", 700), 100, 900);
            }
            JSONObject colors = config.optJSONObject("colors");
            if (colors != null) {
                String[] sung = readColorSource(colors.optJSONObject("sung"), sungSource, sungColor);
                sungSource = sung[0]; sungColor = sung[1];
                String[] current = readColorSource(colors.optJSONObject("current"), currentSource, currentColor);
                currentSource = current[0]; currentColor = current[1];
                String[] upcoming = readColorSource(colors.optJSONObject("upcoming"), upcomingSource, upcomingColor);
                upcomingSource = upcoming[0]; upcomingColor = upcoming[1];
                JSONObject surface = colors.optJSONObject("surface");
                if (surface != null) {
                    String[] fill = readColorSource(surface.optJSONObject("fill"), fillSource, fillColor);
                    fillSource = fill[0]; fillColor = fill[1];
                    String[] border = readColorSource(surface.optJSONObject("border"), borderSource, borderColor);
                    borderSource = border[0]; borderColor = border[1];
                    surfaceOpacity = clamp(surface.optDouble("opacity", surfaceOpacity), 0, 1);
                }
            }
        } catch (Exception ignored) {
            return false;
        }
        mainHandler.post(this::render);
        return !enabled || hasPermission();
    }

    public void updateState(String stateJson) {
        try {
            JSONObject state = new JSONObject(stateJson == null ? "{}" : stateJson);
            lyric = state.optString("text", "").trim();
            themeColor = parseColor(state.optString("themeColor", "#ffffff"));
            currentWordIndex = state.optInt("currentWordIndex", -1);
            wordByWord = state.optBoolean("wordByWord", wordByWord);
            words.clear();
            JSONArray values = state.optJSONArray("words");
            if (values != null) {
                for (int index = 0; index < values.length(); index++) {
                    JSONObject word = values.optJSONObject(index);
                    String text = word == null ? "" : word.optString("text", "");
                    if (!text.isEmpty()) words.add(text);
                }
            }
        } catch (Exception ignored) {
            return;
        }
        mainHandler.post(this::render);
    }

    public void update(String text, String color) {
        lyric = text == null ? "" : text.trim();
        words.clear();
        currentWordIndex = -1;
        themeColor = parseColor(color);
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
        applyTypography();
        lyricView.setText(buildStyledLyric());
        lyricView.setBackground(createBackground());
        WindowManager.LayoutParams params = createLayoutParams();
        if (!attached && windowManager != null) {
            try {
                windowManager.addView(lyricView, params);
                attached = true;
            } catch (Exception ignored) {
                attached = false;
            }
        } else if (attached && windowManager != null) {
            try { windowManager.updateViewLayout(lyricView, params); } catch (Exception ignored) { }
        }
    }

    private SpannableString buildStyledLyric() {
        String display = lyric;
        if (wordByWord && !words.isEmpty()) {
            StringBuilder builder = new StringBuilder();
            for (String word : words) builder.append(word);
            display = builder.toString();
        }
        SpannableString styled = new SpannableString(display);
        if (!wordByWord || words.isEmpty()) {
            styled.setSpan(new ForegroundColorSpan(resolveColor(upcomingSource, upcomingColor)), 0,
                    styled.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            return styled;
        }
        int offset = 0;
        for (int index = 0; index < words.size(); index++) {
            int end = Math.min(styled.length(), offset + words.get(index).length());
            int color = index < currentWordIndex
                    ? resolveColor(sungSource, sungColor)
                    : index == currentWordIndex
                    ? resolveColor(currentSource, currentColor)
                    : resolveColor(upcomingSource, upcomingColor);
            if (end > offset) styled.setSpan(new ForegroundColorSpan(color), offset, end,
                    Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            offset = end;
        }
        return styled;
    }

    private void ensureView() {
        if (lyricView != null) return;
        lyricView = new TextView(context);
        lyricView.setGravity(Gravity.CENTER);
        lyricView.setSingleLine(true);
        lyricView.setEllipsize(TextUtils.TruncateAt.END);
        lyricView.setIncludeFontPadding(false);
        lyricView.setPadding(dp(14), dp(4), dp(14), dp(4));
        lyricView.setElevation(dp(6));
        lyricView.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
    }

    private void applyTypography() {
        lyricView.setTextSize(TypedValue.COMPLEX_UNIT_SP, fontSizeSp);
        Typeface base = Typeface.DEFAULT;
        try {
            if ("imported".equals(fontSource) && !fontId.isEmpty()) {
                File file = new File(context.getFilesDir(), "status-bar-fonts/" + new File(fontId).getName());
                if (file.exists()) base = Typeface.createFromFile(file);
            } else if ("builtin".equals(fontSource) && !fontId.isEmpty()) {
                String assetPath = fontId.replaceFirst("^/+", "");
                if (assetPath.startsWith("assets/")) assetPath = "public/" + assetPath;
                if (!assetPath.startsWith("public/")) assetPath = "public/assets/" + assetPath;
                base = Typeface.createFromAsset(context.getAssets(), assetPath);
            }
        } catch (Exception ignored) { base = Typeface.DEFAULT; }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            lyricView.setTypeface(Typeface.create(base, fontWeight, false));
        } else {
            lyricView.setTypeface(base, fontWeight >= 600 ? Typeface.BOLD : Typeface.NORMAL);
        }
    }

    private WindowManager.LayoutParams createLayoutParams() {
        int overlayType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;
        int flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS;
        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT,
                overlayType, flags, PixelFormat.TRANSLUCENT);
        int width = context.getResources().getDisplayMetrics().widthPixels;
        int height = context.getResources().getDisplayMetrics().heightPixels;
        int maxWidth = Math.max(dp(160), width - dp(32));
        lyricView.setMaxWidth(maxWidth);
        lyricView.measure(View.MeasureSpec.makeMeasureSpec(maxWidth, View.MeasureSpec.AT_MOST),
                View.MeasureSpec.makeMeasureSpec(dp(54), View.MeasureSpec.AT_MOST));
        int viewWidth = Math.max(dp(120), lyricView.getMeasuredWidth());
        int viewHeight = Math.max(dp(30), lyricView.getMeasuredHeight());
        double x = isLandscape() ? landscapeX : portraitX;
        double y = isLandscape() ? landscapeY : portraitY;
        int safeTop = isLandscape() ? dp(2) : getStatusBarHeight() + dp(2);
        params.gravity = Gravity.TOP | Gravity.LEFT;
        params.x = (int) clamp(x * width - viewWidth / 2.0, dp(8), width - viewWidth - dp(8));
        params.y = (int) clamp(safeTop + y * (height - safeTop - viewHeight), safeTop,
                height - viewHeight - dp(8));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            params.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            params.flags |= WindowManager.LayoutParams.FLAG_BLUR_BEHIND;
            params.setBlurBehindRadius(dp(18));
        }
        return params;
    }

    private GradientDrawable createBackground() {
        int fill = resolveColor(fillSource, fillColor);
        int border = resolveColor(borderSource, borderColor);
        GradientDrawable drawable = new GradientDrawable();
        drawable.setShape(GradientDrawable.RECTANGLE);
        drawable.setCornerRadius(dp(18));
        drawable.setColor(Color.argb((int) Math.round(surfaceOpacity * 255),
                Color.red(fill), Color.green(fill), Color.blue(fill)));
        drawable.setStroke(dp(1), Color.argb(150, Color.red(border), Color.green(border), Color.blue(border)));
        return drawable;
    }

    private String[] readColorSource(JSONObject value, String defaultSource, String defaultColor) {
        if (value == null) return new String[]{defaultSource, defaultColor};
        return new String[]{value.optString("source", defaultSource), value.optString("color", defaultColor)};
    }

    private int resolveColor(String source, String custom) {
        return "theme".equals(source) ? readableAccent(themeColor) : parseColor(custom);
    }

    private int readableAccent(int color) {
        double luminance = (0.2126 * Color.red(color) + 0.7152 * Color.green(color)
                + 0.0722 * Color.blue(color)) / 255.0;
        if (luminance >= 0.42) return color;
        return Color.rgb((Color.red(color) + 255) / 2, (Color.green(color) + 255) / 2,
                (Color.blue(color) + 255) / 2);
    }

    private int parseColor(String value) {
        try { return Color.parseColor(value); } catch (Exception ignored) { return Color.WHITE; }
    }
    private boolean isLandscape() { return context.getResources().getConfiguration().orientation == Configuration.ORIENTATION_LANDSCAPE; }
    private int getStatusBarHeight() {
        int id = context.getResources().getIdentifier("status_bar_height", "dimen", "android");
        return id > 0 ? context.getResources().getDimensionPixelSize(id) : dp(24);
    }
    private int dp(int value) { return Math.round(value * context.getResources().getDisplayMetrics().density); }
    private double clamp01(double value) { return clamp(value, 0, 1); }
    private double clamp(double value, double min, double max) { return Math.min(max, Math.max(min, value)); }

    private void removeView() {
        if (!attached || lyricView == null || windowManager == null) return;
        try { windowManager.removeViewImmediate(lyricView); } catch (Exception ignored) { }
        finally { attached = false; }
    }
}
