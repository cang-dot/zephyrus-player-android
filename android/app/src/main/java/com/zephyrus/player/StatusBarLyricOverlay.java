package com.zephyrus.player;

import android.content.Context;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.Paint;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.TextUtils;
import android.text.style.ForegroundColorSpan;
import android.util.TypedValue;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Non-touch lyric capsule rendered by an Android application overlay. */
public final class StatusBarLyricOverlay {
    private static final String TAG = "StatusBarLyricOverlay";
    private static volatile StatusBarLyricOverlay instance;

    /** 原生时钟步进间隔：后台 WebView 计时节流期间由原生推进歌词。 */
    private static final long TICKER_INTERVAL_MS = 100;

    private static final class TimelineWord {
        final String text;
        final double startTime;
        final double duration;

        TimelineWord(String text, double startTime, double duration) {
            this.text = text;
            this.startTime = startTime;
            this.duration = duration;
        }
    }

    private static final class TimelineLine {
        final String text;
        final List<TimelineWord> words;
        final double startTime;
        final double endTime;

        TimelineLine(String text, List<TimelineWord> words, double startTime, double endTime) {
            this.text = text;
            this.words = words;
            this.startTime = startTime;
            this.endTime = endTime;
        }
    }

    private final Context context;
    private final WindowManager windowManager;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Runnable renderRunnable = this::render;
    private final Runnable scrollRunnable = this::applyWordProgressScroll;
    private final Runnable removeRunnable = this::removeView;
    private final Runnable tickerRunnable = this::tickFromNativeClock;
    private TextView lyricView;
    private boolean attached;
    private boolean enabled;
    private boolean appVisible = true;
    private boolean foregroundPreviewVisible;
    // ---- 原生时钟状态：JS 每次推送携带 positionMs 时重置基准，推送停摆后按流逝时间外推 ----
    private volatile List<TimelineLine> timeline = Collections.emptyList();
    private volatile long lastSyncPositionMs = -1;
    private volatile long lastSyncElapsedMs;
    private volatile boolean playingFromSync;
    private boolean tickerActive;
    private boolean wordByWord = true;
    private String widthMode = "fit";
    private int fixedWidthDp = 240;
    private String lyric = "";
    private final List<String> words = new ArrayList<>();
    private int currentWordIndex = -1;
    private float currentWordProgress = 0f;
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
    private boolean fillEnabled = true;
    private String borderSource = "theme";
    private String borderColor = "#ffffff";
    private boolean borderEnabled = true;
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
            stopTicker();
            scheduleRemove();
            return !value;
        }
        scheduleRender();
        return true;
    }

    /** Hides the overlay while the app itself is visible without changing the saved setting. */
    public void setAppVisible(boolean value) {
        appVisible = value;
        if (!value) foregroundPreviewVisible = false;
        if (shouldRender()) scheduleRender();
        else scheduleRemove();
    }

    /** Temporarily allows the settings preview to render over the foreground app. */
    public boolean setForegroundPreviewVisible(boolean value) {
        foregroundPreviewVisible = value;
        if (shouldRender()) scheduleRender();
        else scheduleRemove();
        return !enabled || hasPermission();
    }

    public boolean applyConfig(String configJson) {
        try {
            JSONObject config = new JSONObject(configJson == null ? "{}" : configJson);
            enabled = config.optBoolean("enabled", false);
            wordByWord = config.optBoolean("wordByWord", true);
            JSONObject capsule = config.optJSONObject("capsule");
            if (capsule != null) {
                widthMode = "fixed".equals(capsule.optString("widthMode", widthMode))
                        ? "fixed" : "fit";
                fixedWidthDp = (int) clamp(capsule.optInt("fixedWidthDp", fixedWidthDp), 48, 420);
            }
            JSONObject positions = config.optJSONObject("positions");
            if (positions != null) {
                JSONObject portrait = positions.optJSONObject("portrait");
                JSONObject landscape = positions.optJSONObject("landscape");
                if (portrait != null) {
                    portraitX = clamp01(portrait.optDouble("x", portraitX));
                    portraitY = clamp(portrait.optDouble("y", portraitY), 0, 0.1);
                }
                if (landscape != null) {
                    landscapeX = clamp01(landscape.optDouble("x", landscapeX));
                    landscapeY = clamp(landscape.optDouble("y", landscapeY), 0, 0.1);
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
                    fillEnabled = surface.optBoolean("fillEnabled", fillEnabled);
                    borderEnabled = surface.optBoolean("borderEnabled", borderEnabled);
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
        scheduleRender();
        return !enabled || hasPermission();
    }

    public void updateState(String stateJson) {
        try {
            JSONObject state = new JSONObject(stateJson == null ? "{}" : stateJson);
            String nextLyric = state.optString("text", "").trim();
            int nextThemeColor = parseColor(state.optString("themeColor", "#ffffff"));
            int nextWordIndex = state.optInt("currentWordIndex", -1);
            float nextWordProgress = (float) clamp(state.optDouble("currentWordProgress", 0), 0, 1);
            boolean nextWordByWord = state.optBoolean("wordByWord", wordByWord);
            List<String> nextWords = new ArrayList<>();
            JSONArray values = state.optJSONArray("words");
            if (values != null) {
                for (int index = 0; index < values.length(); index++) {
                    JSONObject word = values.optJSONObject(index);
                    String text = word == null ? "" : word.optString("text", "");
                    if (!text.isEmpty()) nextWords.add(text);
                }
            }
            double positionMs = state.optDouble("positionMs", -1);
            if (positionMs >= 0) {
                lastSyncPositionMs = (long) positionMs;
                lastSyncElapsedMs = SystemClock.elapsedRealtime();
                playingFromSync = !state.optBoolean("paused", true);
            }
            startTicker();
            boolean needsRender = !lyric.equals(nextLyric)
                    || themeColor != nextThemeColor
                    || currentWordIndex != nextWordIndex
                    || wordByWord != nextWordByWord
                    || !words.equals(nextWords);
            lyric = nextLyric;
            themeColor = nextThemeColor;
            currentWordIndex = nextWordIndex;
            currentWordProgress = nextWordProgress;
            wordByWord = nextWordByWord;
            words.clear();
            words.addAll(nextWords);
            if (needsRender) scheduleRender();
            else scheduleScroll();
        } catch (Exception ignored) {
            return;
        }
    }

    /** 接收整首歌的歌词时间轴，供原生时钟在 WebView 计时节流期间自行推进。 */
    public void setTimeline(String timelineJson) {
        List<TimelineLine> parsed = new ArrayList<>();
        try {
            JSONObject payload = new JSONObject(timelineJson == null ? "{}" : timelineJson);
            JSONArray lines = payload.optJSONArray("lines");
            if (lines != null) {
                for (int i = 0; i < lines.length(); i++) {
                    JSONObject line = lines.optJSONObject(i);
                    if (line == null) continue;
                    String text = line.optString("text", "").trim();
                    double start = line.optDouble("startTime", -1);
                    if (text.isEmpty() || start < 0) continue;
                    double end = line.optDouble("endTime", -1);
                    if (end < start) end = start + 3000;
                    List<TimelineWord> words = new ArrayList<>();
                    JSONArray wordValues = line.optJSONArray("words");
                    if (wordValues != null) {
                        for (int w = 0; w < wordValues.length(); w++) {
                            JSONObject word = wordValues.optJSONObject(w);
                            String wordText = word == null ? "" : word.optString("text", "");
                            if (wordText.isEmpty()) continue;
                            words.add(new TimelineWord(wordText,
                                    word.optDouble("startTime", start),
                                    Math.max(1, word.optDouble("duration", 400))));
                        }
                    }
                    parsed.add(new TimelineLine(text, words, start, end));
                }
            }
        } catch (Exception ignored) { }
        timeline = parsed;
        if (parsed.isEmpty() || lastSyncPositionMs < 0) stopTicker();
        else startTicker();
    }

    private void startTicker() {
        if (tickerActive || timeline.isEmpty() || lastSyncPositionMs < 0) return;
        tickerActive = true;
        mainHandler.postDelayed(tickerRunnable, TICKER_INTERVAL_MS);
    }

    private void stopTicker() {
        tickerActive = false;
        mainHandler.removeCallbacks(tickerRunnable);
    }

    private void tickFromNativeClock() {
        if (!tickerActive) return;
        try {
            applyTimelinePosition(nativeClockPositionMs());
        } finally {
            if (tickerActive && !timeline.isEmpty() && lastSyncPositionMs >= 0) {
                mainHandler.postDelayed(tickerRunnable, TICKER_INTERVAL_MS);
            } else {
                tickerActive = false;
            }
        }
    }

    private long nativeClockPositionMs() {
        long elapsed = playingFromSync ? SystemClock.elapsedRealtime() - lastSyncElapsedMs : 0;
        return lastSyncPositionMs + elapsed;
    }

    /** 当前播放位置在时间轴所属行内的进度 [0,1]；无时间轴或未找到时返回 -1。 */
    private double timelineLineProgress(long positionMs) {
        List<TimelineLine> lines = timeline;
        if (lines.isEmpty()) return -1;
        TimelineLine active = null;
        for (TimelineLine line : lines) {
            if (line.startTime <= positionMs) active = line;
            else break;
        }
        if (active == null) return -1;
        double span = Math.max(1, active.endTime - active.startTime);
        return clamp((positionMs - active.startTime) / span, 0, 1);
    }

    /** 按播放位置从时间轴推导当前行/当前字，与 JS 推送共用同一套渲染判定。 */
    private void applyTimelinePosition(long positionMs) {
        List<TimelineLine> lines = timeline;
        if (lines.isEmpty()) return;
        TimelineLine active = lines.get(0);
        for (TimelineLine line : lines) {
            if (line.startTime <= positionMs) active = line;
            else break;
        }
        List<String> nextWords = new ArrayList<>(active.words.size());
        for (TimelineWord word : active.words) nextWords.add(word.text);
        int wordIndex = -1;
        float wordProgress = 0f;
        if (wordByWord && !active.words.isEmpty()) {
            for (int index = 0; index < active.words.size(); index++) {
                TimelineWord word = active.words.get(index);
                if (positionMs < word.startTime) break;
                double wordEnd = word.startTime + Math.max(0, word.duration);
                if (positionMs <= wordEnd) {
                    wordIndex = index;
                    wordProgress = (float) clamp(
                            (positionMs - word.startTime) / Math.max(1, word.duration), 0, 1);
                    break;
                }
                wordIndex = index + 1;
            }
        }
        boolean nextWordByWord = wordByWord && !nextWords.isEmpty();
        int nextIndex = nextWordByWord ? wordIndex : -1;
        float nextProgress = nextWordByWord ? wordProgress : 0f;
        boolean needsRender = !lyric.equals(active.text)
                || currentWordIndex != nextIndex
                || wordByWord != nextWordByWord
                || !words.equals(nextWords);
        lyric = active.text;
        currentWordIndex = nextIndex;
        currentWordProgress = nextProgress;
        wordByWord = nextWordByWord;
        words.clear();
        words.addAll(nextWords);
        if (needsRender) scheduleRender();
        else scheduleScroll();
    }

    public void update(String text, String color) {
        lyric = text == null ? "" : text.trim();
        words.clear();
        currentWordIndex = -1;
        themeColor = parseColor(color);
        scheduleRender();
    }

    public void destroy() {
        enabled = false;
        stopTicker();
        scheduleRemove();
    }

    private void scheduleRender() {
        mainHandler.removeCallbacks(renderRunnable);
        mainHandler.removeCallbacks(scrollRunnable);
        mainHandler.removeCallbacks(removeRunnable);
        mainHandler.post(renderRunnable);
    }

    private void scheduleScroll() {
        mainHandler.removeCallbacks(scrollRunnable);
        mainHandler.post(scrollRunnable);
    }

    private void scheduleRemove() {
        mainHandler.removeCallbacks(renderRunnable);
        mainHandler.removeCallbacks(scrollRunnable);
        mainHandler.removeCallbacks(removeRunnable);
        mainHandler.post(removeRunnable);
    }

    private void render() {
        if (!shouldRender() || lyric.isEmpty()) {
            removeView();
            return;
        }
        try {
            ensureView();
            if (lyricView == null) return;
            applyTypography();
            lyricView.setText(buildStyledLyric());
            lyricView.setBackground(createBackground());
            WindowManager.LayoutParams params = createLayoutParams();
            if (!attached && windowManager != null) {
                windowManager.addView(lyricView, params);
                attached = true;
            } else if (attached && windowManager != null) {
                windowManager.updateViewLayout(lyricView, params);
            }
            lyricView.removeCallbacks(scrollRunnable);
            lyricView.post(scrollRunnable);
        } catch (RuntimeException exception) {
            Log.e(TAG, "Unable to render status bar lyric overlay", exception);
            removeView();
        }
    }

    private boolean shouldRender() {
        return enabled && hasPermission() && (!appVisible || foregroundPreviewVisible);
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
        lyricView.setSelected(true);
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
        int width = context.getResources().getDisplayMetrics().widthPixels;
        int fixedWidth = Math.min(dp(fixedWidthDp), Math.max(dp(48), width - dp(16)));
        boolean fixed = "fixed".equals(widthMode);
        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                fixed ? fixedWidth : WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                overlayType, flags, PixelFormat.TRANSLUCENT);
        int height = context.getResources().getDisplayMetrics().heightPixels;
        int maxWidth = fixed ? fixedWidth : Math.max(dp(160), width - dp(16));
        lyricView.setEllipsize(fixed ? null : TextUtils.TruncateAt.END);
        lyricView.setHorizontallyScrolling(fixed);
        lyricView.setSelected(false);
        lyricView.setMarqueeRepeatLimit(0);
        lyricView.setGravity(fixed ? Gravity.START | Gravity.CENTER_VERTICAL : Gravity.CENTER);
        lyricView.setMaxLines(1);
        lyricView.setMaxWidth(maxWidth);
        String visibleText = lyricView.getText() == null ? "" : lyricView.getText().toString();
        int textWidth = (int) Math.ceil(lyricView.getPaint().measureText(visibleText));
        Paint.FontMetricsInt metrics = lyricView.getPaint().getFontMetricsInt();
        int desiredWidth = textWidth + lyricView.getPaddingLeft() + lyricView.getPaddingRight();
        int desiredHeight = metrics.bottom - metrics.top
                + lyricView.getPaddingTop() + lyricView.getPaddingBottom();
        int viewWidth = fixed ? fixedWidth : Math.min(maxWidth, Math.max(dp(120), desiredWidth));
        int viewHeight = Math.max(dp(30), desiredHeight);
        params.width = viewWidth;
        params.height = viewHeight;
        double x = isLandscape() ? landscapeX : portraitX;
        double y = isLandscape() ? landscapeY : portraitY;
        params.gravity = Gravity.TOP | Gravity.LEFT;
        params.x = (int) clamp(x * width - viewWidth / 2.0, 0, width - viewWidth);
        params.y = (int) clamp(y * height - viewHeight / 2.0, 0, height * 0.1 - viewHeight);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            params.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        return params;
    }

    private void applyWordProgressScroll() {
        if (lyricView == null || !"fixed".equals(widthMode)) {
            if (lyricView != null) lyricView.scrollTo(0, 0);
            return;
        }
        String fullText = lyricView.getText() == null ? "" : lyricView.getText().toString();
        float contentWidth = lyricView.getPaint().measureText(fullText)
                + lyricView.getPaddingLeft() + lyricView.getPaddingRight();
        int viewportWidth = lyricView.getWidth() > 0 ? lyricView.getWidth() : dp(fixedWidthDp);
        int maxScroll = Math.max(0, Math.round(contentWidth - viewportWidth));
        if (maxScroll == 0) {
            lyricView.scrollTo(0, 0);
            return;
        }

        // 非逐字歌词：按当前句时间与句长线性滚动（时间轴 + 原生时钟驱动）。
        if (!wordByWord || words.isEmpty()) {
            if (lastSyncPositionMs >= 0) {
                double progress = timelineLineProgress(nativeClockPositionMs());
                if (progress >= 0) {
                    lyricView.scrollTo((int) clamp(progress * maxScroll, 0, maxScroll), 0);
                }
            }
            return;
        }

        int index = Math.max(0, Math.min(currentWordIndex, words.size()));
        StringBuilder completed = new StringBuilder();
        for (int i = 0; i < index; i++) completed.append(words.get(i));
        float currentWidth = index < words.size()
                ? lyricView.getPaint().measureText(words.get(index)) * currentWordProgress
                : 0f;
        float progressPoint = lyricView.getPaddingLeft()
                + lyricView.getPaint().measureText(completed.toString()) + currentWidth;
        int target = (int) clamp(progressPoint - viewportWidth * 0.58f, 0, maxScroll);
        lyricView.scrollTo(target, 0);
    }

    private GradientDrawable createBackground() {
        int fill = resolveColor(fillSource, fillColor);
        int border = resolveColor(borderSource, borderColor);
        GradientDrawable drawable = new GradientDrawable();
        drawable.setShape(GradientDrawable.RECTANGLE);
        drawable.setCornerRadius(dp(18));
        drawable.setColor(fillEnabled
                ? Color.argb((int) Math.round(surfaceOpacity * 255),
                    Color.red(fill), Color.green(fill), Color.blue(fill))
                : Color.TRANSPARENT);
        drawable.setStroke(borderEnabled ? dp(1) : 0, borderEnabled
                ? Color.argb(180, Color.red(border), Color.green(border), Color.blue(border))
                : Color.TRANSPARENT);
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
