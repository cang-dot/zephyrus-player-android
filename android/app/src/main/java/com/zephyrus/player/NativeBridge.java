package com.zephyrus.player;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.database.Cursor;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.provider.Settings;
import android.util.Base64;
import android.util.DisplayMetrics;
import android.util.Log;
import android.webkit.JavascriptInterface;

import androidx.browser.customtabs.CustomTabsIntent;

import org.json.JSONArray;
import org.json.JSONObject;

import org.jaudiotagger.audio.AudioFile;
import org.jaudiotagger.audio.AudioFileIO;
import org.jaudiotagger.tag.FieldKey;
import org.jaudiotagger.tag.Tag;
import org.jaudiotagger.tag.images.AndroidArtwork;
import org.jaudiotagger.tag.images.Artwork;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * WebView 与原生 Android 之间的桥接接口。
 * 通过 webView.addJavascriptInterface(new NativeBridge(activity), "AndroidNative") 注册。
 * WebView 中可通过 window.AndroidNative.xxx() 调用原生方法。
 */
public class NativeBridge {
    private final MainActivity activity;
    private final NativeAudioEngine audioEngine;

    public NativeBridge(MainActivity activity) {
        this.activity = activity;
        this.audioEngine = MusicPlaybackService.getOrCreateAudioEngine(activity);
        this.audioEngine.attachActivity(activity);
    }

    // ==================== Android 原生音频引擎 ====================

    @JavascriptInterface
    public String nativeAudioLoad(String trackJson, boolean preload) {
        return audioEngine.load(trackJson, preload);
    }

    @JavascriptInterface
    public void nativeAudioPlay(String token) {
        audioEngine.play(token);
    }

    @JavascriptInterface
    public void nativeAudioPause(String token) {
        audioEngine.pause(token);
    }

    @JavascriptInterface
    public void nativeAudioStop(String token) {
        audioEngine.stop(token);
    }

    @JavascriptInterface
    public void nativeAudioUnload(String token) {
        audioEngine.unload(token);
    }

    @JavascriptInterface
    public void nativeAudioSeekTo(String token, double positionMs) {
        audioEngine.seekTo(token, Math.max(0, Math.round(positionMs)));
    }

    @JavascriptInterface
    public void nativeAudioSetPlaybackRate(String token, float rate) {
        audioEngine.setPlaybackRate(token, rate);
    }

    @JavascriptInterface
    public void nativeAudioSetVolume(float volume) {
        audioEngine.setVolume(volume);
    }

    @JavascriptInterface
    public void nativeAudioSetEqGains(float low, float mid, float high) {
        audioEngine.setEqGains(low, mid, high);
    }

    @JavascriptInterface
    public String nativeAudioStartCrossfade(
            String fromToken,
            String toToken,
            double durationSeconds,
            int level) {
        return audioEngine.startCrossfade(fromToken, toToken, durationSeconds, level);
    }

    @JavascriptInterface
    public void nativeAudioCancelCrossfade() {
        audioEngine.cancelCrossfade();
    }

    @JavascriptInterface
    public String nativeAudioGetPlaybackState(String token) {
        return audioEngine.getState(token);
    }

    @JavascriptInterface
    public String nativeAudioGetAnalysis() {
        return audioEngine.getAnalysis();
    }

    void detachAudioEngine() {
        audioEngine.detachActivity(activity);
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

    // ==================== 本地音乐功能 ====================

    /**
     * 打开文件夹选择器（ACTION_OPEN_DOCUMENT_TREE）
     * 选择结果通过 window.__localMusicFolderPicked(treeUri) 回调到 JS
     */
    @JavascriptInterface
    public void pickAudioFolder() {
        activity.runOnUiThread(() -> {
            try {
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                        | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
                activity.startActivityForResult(intent, MainActivity.REQUEST_PICK_AUDIO_FOLDER);
            } catch (Exception e) {
                Log.e("NativeBridge", "pickAudioFolder error", e);
                activity.evaluateJavascript(
                    "window.__localMusicFolderPicked && window.__localMusicFolderPicked(null);"
                );
            }
        });
    }

    /**
     * 扫描文件夹下的所有音频文件（递归，最多 5 层）
     * @param treeUriStr SAF tree URI
     * @return JSON 数组字符串：[{ uri, name, size, lastModified }, ...]
     */
    @JavascriptInterface
    public String scanAudioFiles(String treeUriStr) {
        JSONArray result = new JSONArray();
        try {
            Uri treeUri = Uri.parse(treeUriStr);
            ContentResolver resolver = activity.getContentResolver();
            String rootDocId = DocumentsContract.getTreeDocumentId(treeUri);
            Uri rootDocUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, rootDocId);
            scanDirectory(resolver, treeUri, rootDocUri, result, 0);
        } catch (Exception e) {
            Log.e("NativeBridge", "scanAudioFiles error", e);
        }
        return result.toString();
    }

    private void scanDirectory(ContentResolver resolver, Uri treeUri, Uri docUri,
                                JSONArray result, int depth) {
        if (depth > 5) return;
        Cursor cursor = null;
        try {
            Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(
                    treeUri, DocumentsContract.getDocumentId(docUri));
            cursor = resolver.query(childrenUri, new String[]{
                    DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                    DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                    DocumentsContract.Document.COLUMN_MIME_TYPE,
                    DocumentsContract.Document.COLUMN_SIZE,
                    DocumentsContract.Document.COLUMN_LAST_MODIFIED
            }, null, null, null);
            if (cursor == null) return;

            while (cursor.moveToNext()) {
                String docId = cursor.getString(0);
                String name = cursor.getString(1);
                String mime = cursor.getString(2);
                long size = cursor.getLong(3);
                long lastModified = cursor.getLong(4);
                Uri fileUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, docId);

                if (mime != null && mime.equals(DocumentsContract.Document.MIME_TYPE_DIR)) {
                    scanDirectory(resolver, treeUri, fileUri, result, depth + 1);
                } else if (isAudioFile(name, mime)) {
                    JSONObject fileObj = new JSONObject();
                    fileObj.put("uri", fileUri.toString());
                    fileObj.put("name", name);
                    fileObj.put("size", size);
                    fileObj.put("lastModified", lastModified);
                    result.put(fileObj);
                }
            }
        } catch (Exception e) {
            Log.e("NativeBridge", "scanDirectory error (depth=" + depth + ")", e);
        } finally {
            if (cursor != null) cursor.close();
        }
    }

    private boolean isAudioFile(String name, String mime) {
        if (mime != null && mime.startsWith("audio/")) return true;
        if (name != null) {
            String lower = name.toLowerCase();
            return lower.endsWith(".mp3") || lower.endsWith(".flac") || lower.endsWith(".wav")
                || lower.endsWith(".ogg") || lower.endsWith(".m4a") || lower.endsWith(".aac")
                || lower.endsWith(".opus") || lower.endsWith(".wma");
        }
        return false;
    }

    /**
     * 提取音频文件元数据（使用 MediaMetadataRetriever）
     * @param uriStr content URI
     * @return JSON: { filePath, title, artist, album, duration, cover, lyrics, fileSize, modifiedTime, diskNumber, trackNumber, year }
     */
    @JavascriptInterface
    public String getAudioMetadata(String uriStr) {
        JSONObject result = new JSONObject();
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        try {
            Uri uri = Uri.parse(uriStr);
            retriever.setDataSource(activity, uri);

            String title = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE);
            String artist = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST);
            String album = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM);
            String durationStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
            String trackStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_CD_TRACK_NUMBER);
            String yearStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_YEAR);
            String mime = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_MIMETYPE);
            long bitrate = tryParseLong(
                    retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_BITRATE));
            long sampleRate = 0;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                sampleRate = tryParseLong(
                        retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_SAMPLERATE));
            }

            byte[] coverBytes = retriever.getEmbeddedPicture();
            String coverBase64 = null;
            if (coverBytes != null && coverBytes.length > 0) {
                coverBase64 = "data:image/jpeg;base64," + Base64.encodeToString(coverBytes, Base64.NO_WRAP);
            }

            String fileName = extractFileNameFromUri(uri);

            result.put("filePath", uriStr);
            result.put("title", title != null ? title : fileName);
            result.put("artist", artist != null ? artist : "未知艺术家");
            result.put("album", album != null ? album : "未知专辑");
            result.put("duration", durationStr != null ? Long.parseLong(durationStr) : 0);
            result.put("cover", coverBase64 != null ? coverBase64 : JSONObject.NULL);
            // 尝试提取内嵌歌词
            String lyrics = extractEmbeddedLyrics(uri);
            result.put("lyrics", lyrics != null ? lyrics : JSONObject.NULL);
            result.put("fileSize", queryFileSize(uri));
            result.put("bitrate", bitrate);
            result.put("sampleRate", sampleRate);
            result.put("mime", mime != null ? mime : JSONObject.NULL);
            result.put("modifiedTime", 0);
            result.put("diskNumber", 0);
            result.put("trackNumber", parseTrackNumber(trackStr));
            result.put("year", yearStr != null ? tryParseInt(yearStr) : 0);
        } catch (Exception e) {
            Log.e("NativeBridge", "getAudioMetadata error: " + uriStr, e);
            try {
                result.put("filePath", uriStr);
                result.put("title", extractFileNameFromUri(Uri.parse(uriStr)));
                result.put("artist", "未知艺术家");
                result.put("album", "未知专辑");
                result.put("duration", 0);
                result.put("cover", JSONObject.NULL);
                result.put("lyrics", JSONObject.NULL);
                result.put("fileSize", 0);
                result.put("bitrate", 0);
                result.put("sampleRate", 0);
                result.put("mime", JSONObject.NULL);
                result.put("modifiedTime", 0);
                result.put("diskNumber", 0);
                result.put("trackNumber", 0);
                result.put("year", 0);
            } catch (Exception e2) {
                Log.e("NativeBridge", "getAudioMetadata fallback error", e2);
            }
        } finally {
            try { retriever.release(); } catch (Exception e) { /* ignore */ }
        }
        return result.toString();
    }

    /** 通过 AssetFileDescriptor 读取 SAF 文档的真实大小。 */
    private long queryFileSize(Uri uri) {
        try (android.content.res.AssetFileDescriptor descriptor =
                     activity.getContentResolver().openAssetFileDescriptor(uri, "r")) {
            if (descriptor != null) return descriptor.getLength();
        } catch (Exception ignored) { }
        return 0;
    }

    private long tryParseLong(String value) {
        if (value == null) return 0;
        try { return Long.parseLong(value.trim()); } catch (Exception ignored) { return 0; }
    }

    /** 支持标签写回的容器扩展名白名单。 */
    private static final java.util.Set<String> TAG_WRITABLE_EXTENSIONS = new java.util.HashSet<>(
            java.util.Arrays.asList("mp3", "flac", "m4a", "mp4", "ogg", "oga"));

    /**
     * 将元数据修改写回音频文件标签（JAudioTagger）。
     * changesJson: { requestId, title?, artist?, album?, year?, trackNumber?, diskNumber?, coverBase64?, lyrics? }
     * 后台线程执行，结果通过 window.__metadataWriteResult(json) 回调：
     * { requestId, success, error?, metadata? }，metadata 为写回后重新提取的完整元数据。
     */
    @JavascriptInterface
    public void writeAudioMetadata(String uriStr, String changesJson) {
        new Thread(() -> {
            String result;
            try {
                result = performMetadataWrite(uriStr, changesJson);
            } catch (Exception error) {
                Log.e("NativeBridge", "writeAudioMetadata error: " + uriStr, error);
                result = metadataWriteResult(extractRequestId(changesJson), false,
                        error.getMessage() == null ? "写入失败" : error.getMessage(), null);
            }
            String payload = result;
            activity.runOnUiThread(() -> activity.evaluateJavascript(
                    "window.__metadataWriteResult && window.__metadataWriteResult("
                            + JSONObject.quote(payload) + ");"));
        }).start();
    }

    private String extractRequestId(String changesJson) {
        try {
            return new JSONObject(changesJson == null ? "{}" : changesJson).optString("requestId", "");
        } catch (Exception ignored) {
            return "";
        }
    }

    private String metadataWriteResult(
            String requestId, boolean success, String error, String metadataJson) {
        JSONObject json = new JSONObject();
        try {
            json.put("requestId", requestId);
            json.put("success", success);
            if (error != null) json.put("error", error);
            if (metadataJson != null) json.put("metadata", new JSONObject(metadataJson));
        } catch (Exception ignored) { }
        return json.toString();
    }

    private String performMetadataWrite(String uriStr, String changesJson) throws Exception {
        JSONObject changes = new JSONObject(changesJson == null ? "{}" : changesJson);
        String requestId = changes.optString("requestId", "");
        Uri uri = Uri.parse(uriStr);
        String extension = fileExtensionOf(uri);
        if (!TAG_WRITABLE_EXTENSIONS.contains(extension)) {
            throw new IllegalArgumentException("不支持的格式: " + extension.toUpperCase());
        }

        ContentResolver resolver = activity.getContentResolver();
        // 标签库需要随机访问，先复制到缓存工作文件；另留一份原字节备份用于写回失败恢复。
        File work = new File(activity.getCacheDir(),
                "meta-edit-" + System.currentTimeMillis() + "." + extension);
        File backup = new File(work.getPath() + ".bak");
        try {
            try (InputStream source = resolver.openInputStream(uri);
                 FileOutputStream sink = new FileOutputStream(work)) {
                copyStream(source, sink);
            }
            try (InputStream source = resolver.openInputStream(uri);
                 FileOutputStream sink = new FileOutputStream(backup)) {
                copyStream(source, sink);
            }

            AudioFile audioFile = AudioFileIO.read(work);
            Tag tag = audioFile.getTag();
            if (changes.has("title")) setTagField(tag, FieldKey.TITLE, changes.optString("title"));
            if (changes.has("artist")) setTagField(tag, FieldKey.ARTIST, changes.optString("artist"));
            if (changes.has("album")) setTagField(tag, FieldKey.ALBUM, changes.optString("album"));
            if (changes.has("year")) {
                setTagField(tag, FieldKey.YEAR, String.valueOf(changes.optLong("year", 0)));
            }
            if (changes.has("trackNumber")) {
                setTagField(tag, FieldKey.TRACK, String.valueOf(changes.optLong("trackNumber", 0)));
            }
            if (changes.has("diskNumber")) {
                setTagField(tag, FieldKey.DISC_NO, String.valueOf(changes.optLong("diskNumber", 0)));
            }
            if (changes.has("lyrics")) setTagField(tag, FieldKey.LYRICS, changes.optString("lyrics"));
            if (changes.has("coverBase64")) {
                byte[] coverBytes = Base64.decode(changes.optString("coverBase64"), Base64.NO_WRAP);
                if (coverBytes.length == 0) throw new IllegalArgumentException("封面数据为空");
                Artwork artwork = new AndroidArtwork();
                artwork.setBinaryData(coverBytes);
                artwork.setMimeType(changes.optString("coverMime", "image/jpeg"));
                artwork.setDescription("cover");
                tag.deleteArtworkField();
                tag.setField(artwork);
            }
            AudioFileIO.write(audioFile);

            try (OutputStream target = resolver.openOutputStream(uri, "wt");
                 InputStream source = new java.io.FileInputStream(work)) {
                copyStream(source, target);
            } catch (Exception writeError) {
                Log.e("NativeBridge", "writeAudioMetadata write-back failed, restoring", writeError);
                try (OutputStream target = resolver.openOutputStream(uri, "wt");
                     InputStream source = new java.io.FileInputStream(backup)) {
                    copyStream(source, target);
                } catch (Exception restoreError) {
                    Log.e("NativeBridge", "writeAudioMetadata restore failed", restoreError);
                }
                throw new Exception("写回文件失败，已尝试恢复原文件");
            }
        } finally {
            work.delete();
            backup.delete();
        }

        return metadataWriteResult(requestId, true, null, getAudioMetadata(uriStr));
    }

    private void setTagField(Tag tag, FieldKey key, String value) throws Exception {
        tag.deleteField(key);
        tag.setField(key, value);
    }

    private String fileExtensionOf(Uri uri) {
        String name = extractFileNameFromUri(uri);
        int dot = name.lastIndexOf('.');
        return dot >= 0 ? name.substring(dot + 1).toLowerCase() : "";
    }

    private void copyStream(InputStream source, OutputStream sink) throws Exception {
        byte[] buffer = new byte[64 * 1024];
        int read;
        while ((read = source.read(buffer)) > 0) sink.write(buffer, 0, read);
    }

    /**
     * 读取音频文件为 base64（用于播放）
     * @param uriStr content URI
     * @return base64 编码的文件内容
     */
    @JavascriptInterface
    public String readFileBase64(String uriStr) {
        try {
            Uri uri = Uri.parse(uriStr);
            InputStream is = activity.getContentResolver().openInputStream(uri);
            if (is == null) return "";
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            byte[] buffer = new byte[16384];
            int len;
            while ((len = is.read(buffer)) != -1) {
                baos.write(buffer, 0, len);
            }
            is.close();
            return Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);
        } catch (Exception e) {
            Log.e("NativeBridge", "readFileBase64 error: " + uriStr, e);
            return "";
        }
    }

    /**
     * 异步将 content URI 对应的文件复制到缓存目录。
     * 复制完成后通过 JS 回调通知。
     * @param uriStr content URI
     * @param callback JS 回调函数名，接收 (tempPath: string)
     */
    @JavascriptInterface
    public void copyToCacheDirAsync(String uriStr, String callback) {
        new Thread(() -> {
            String tempPath = "";
            try {
                Uri uri = Uri.parse(uriStr);
                InputStream is = activity.getContentResolver().openInputStream(uri);
                if (is == null) {
                    activity.evaluateJavascript(callback + "('');");
                    return;
                }
                File tempFile = new File(activity.getCacheDir(),
                        "audio_" + System.currentTimeMillis() + ".tmp");
                FileOutputStream fos = new FileOutputStream(tempFile);
                byte[] buffer = new byte[16384];
                int len;
                while ((len = is.read(buffer)) != -1) {
                    fos.write(buffer, 0, len);
                }
                fos.close();
                is.close();
                tempPath = tempFile.getAbsolutePath();
            } catch (Exception e) {
                Log.e("NativeBridge", "copyToCacheDirAsync error: " + uriStr, e);
            }
            final String path = tempPath;
            activity.evaluateJavascript(callback + "('" + path.replace("\\", "\\\\") + "');");
        }).start();
    }

    /**
     * 将 content URI 对应的文件复制到缓存目录，返回临时文件绝对路径。
     * 同步版本，仅在文件较小时使用。
     * @param uriStr content URI
     * @return 临时文件绝对路径，失败返回空字符串
     */
    @JavascriptInterface
    public String copyToCacheDir(String uriStr) {
        try {
            Uri uri = Uri.parse(uriStr);
            InputStream is = activity.getContentResolver().openInputStream(uri);
            if (is == null) return "";
            File tempFile = new File(activity.getCacheDir(),
                    "audio_" + System.currentTimeMillis() + ".tmp");
            FileOutputStream fos = new FileOutputStream(tempFile);
            byte[] buffer = new byte[16384];
            int len;
            while ((len = is.read(buffer)) != -1) {
                fos.write(buffer, 0, len);
            }
            fos.close();
            is.close();
            return tempFile.getAbsolutePath();
        } catch (Exception e) {
            Log.e("NativeBridge", "copyToCacheDir error: " + uriStr, e);
            return "";
        }
    }

    /**
     * 删除临时文件
     */
    @JavascriptInterface
    public void deleteTempFile(String path) {
        try {
            if (path != null && !path.isEmpty()) {
                new File(path).delete();
            }
        } catch (Exception e) {
            // ignore
        }
    }

    /**
     * 检查 content URI 对应的文件是否仍然可访问
     */
    @JavascriptInterface
    public String checkFileExists(String uriStr) {
        try {
            Uri uri = Uri.parse(uriStr);
            Cursor cursor = activity.getContentResolver().query(uri, null, null, null, null);
            if (cursor != null) {
                boolean exists = cursor.getCount() > 0;
                cursor.close();
                return exists ? "true" : "false";
            }
            return "false";
        } catch (Exception e) {
            return "false";
        }
    }

    private String extractFileNameFromUri(Uri uri) {
        String path = uri.getLastPathSegment();
        if (path == null) return "未知标题";
        int dotIdx = path.lastIndexOf('.');
        if (dotIdx > 0) path = path.substring(0, dotIdx);
        try {
            return java.net.URLDecoder.decode(path, "UTF-8");
        } catch (Exception e) {
            return path;
        }
    }

    private int parseTrackNumber(String trackStr) {
        if (trackStr == null) return 0;
        try {
            String num = trackStr.split("/")[0].trim();
            return Integer.parseInt(num);
        } catch (Exception e) {
            return 0;
        }
    }

    private int tryParseInt(String str) {
        try { return Integer.parseInt(str); } catch (Exception e) { return 0; }
    }

    /**
     * 从音频文件中提取内嵌歌词（ID3 USLT 帧 / FLAC LYRICS 标签）
     * @param uri content URI
     * @return 歌词文本，失败返回 null
     */
    private String extractEmbeddedLyrics(Uri uri) {
        // 方案1：MediaMetadataRetriever 尝试 WRITER 字段（某些设备将歌词存于此）
        MediaMetadataRetriever mmr = new MediaMetadataRetriever();
        try {
            mmr.setDataSource(activity, uri);
            // 尝试 WRITER（部分厂商将歌词写入此字段）
            String writer = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_WRITER);
            if (writer != null && writer.contains("[") && writer.contains("]")
                    && (writer.contains(":") || writer.contains("."))) {
                return writer;
            }
            // 尝试 AUTHOR（某些编码器将歌词放在作者字段）
            String author = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_AUTHOR);
            if (author != null && author.contains("[") && author.contains("]")
                    && (author.contains(":") || author.contains("."))) {
                return author;
            }
        } catch (Exception e) {
            // ignore
        } finally {
            try { mmr.release(); } catch (Exception e) { /* ignore */ }
        }

        // 方案2：直接解析文件二进制，查找 ID3v2 USLT 帧
        try {
            String lyrics = extractId3v2Lyrics(uri);
            if (lyrics != null) return lyrics;
        } catch (Exception e) {
            Log.d("NativeBridge", "ID3v2 lyrics extraction failed", e);
        }

        // 方案3：FLAC VORBIS_COMMENT 中的 LYRICS 字段
        try {
            String lyrics = extractFlacLyrics(uri);
            if (lyrics != null) return lyrics;
        } catch (Exception e) {
            Log.d("NativeBridge", "FLAC lyrics extraction failed", e);
        }

        return null;
    }

    /**
     * 从 ID3v2 标签中提取 USLT（同步歌词）帧
     */
    private String extractId3v2Lyrics(Uri uri) {
        try {
            InputStream is = activity.getContentResolver().openInputStream(uri);
            if (is == null) return null;

            // 读取前 10 字节：ID3v2 头部
            byte[] header = new byte[10];
            int read = is.read(header);
            if (read < 10) { is.close(); return null; }

            // 检查 ID3 标识
            if (header[0] != 'I' || header[1] != 'D' || header[2] != '3') {
                is.close();
                return null;
            }

            // ID3v2 版本
            int version = header[3] & 0xFF; // 3=v2.3, 4=v2.4

            // 计算标签总大小（同步安全整数）
            int tagSize = ((header[6] & 0x7F) << 21)
                        | ((header[7] & 0x7F) << 14)
                        | ((header[8] & 0x7F) << 7)
                        | (header[9] & 0x7F);

            if (tagSize <= 0 || tagSize > 10 * 1024 * 1024) { is.close(); return null; }

            // 读取整个标签
            byte[] tagData = new byte[tagSize];
            int totalRead = 0;
            while (totalRead < tagSize) {
                int r = is.read(tagData, totalRead, tagSize - totalRead);
                if (r <= 0) break;
                totalRead += r;
            }
            is.close();

            if (totalRead < tagSize) return null;

            // 遍历帧，查找 USLT
            int pos = 0;
            while (pos + 10 <= tagSize) {
                String frameId;
                int frameSize;

                if (version == 4) {
                    // ID3v2.4: 帧大小为同步安全整数
                    frameId = new String(tagData, pos, 4, "ISO-8859-1");
                    frameSize = ((tagData[pos + 4] & 0x7F) << 21)
                              | ((tagData[pos + 5] & 0x7F) << 14)
                              | ((tagData[pos + 6] & 0x7F) << 7)
                              | (tagData[pos + 7] & 0x7F);
                } else {
                    // ID3v2.3: 帧大小为普通整数
                    frameId = new String(tagData, pos, 4, "ISO-8859-1");
                    frameSize = ((tagData[pos + 4] & 0xFF) << 24)
                              | ((tagData[pos + 5] & 0xFF) << 16)
                              | ((tagData[pos + 6] & 0xFF) << 8)
                              | (tagData[pos + 7] & 0xFF);
                }

                // 帧ID全零表示到达标签末尾
                if (frameId.charAt(0) == 0) break;

                if (frameSize <= 0 || pos + 10 + frameSize > tagSize) break;

                if ("USLT".equals(frameId)) {
                    // USLT 帧格式：编码(1) 语言(3) 内容描述(0分隔) 歌词文本
                    int frameDataStart = pos + 10;
                    int encoding = tagData[frameDataStart] & 0xFF;
                    // 跳过：编码(1) + 语言(3)
                    int textStart = frameDataStart + 4;
                    // 跳过内容描述（以 null 结尾）
                    int descEnd = textStart;
                    if (encoding == 0 || encoding == 3) {
                        // ISO-8859-1 或 UTF-8：单字节 null
                        while (descEnd < frameDataStart + frameSize && tagData[descEnd] != 0) descEnd++;
                        descEnd++; // 跳过 null
                    } else {
                        // UTF-16 / UTF-16BE：双字节 null
                        while (descEnd + 1 < frameDataStart + frameSize
                                && !(tagData[descEnd] == 0 && tagData[descEnd + 1] == 0)) descEnd += 2;
                        descEnd += 2; // 跳过双字节 null
                    }

                    int lyricsStart = descEnd;
                    int lyricsLen = (frameDataStart + frameSize) - lyricsStart;
                    if (lyricsLen <= 0) break;

                    String lyrics;
                    if (encoding == 0) {
                        lyrics = new String(tagData, lyricsStart, lyricsLen, "ISO-8859-1");
                    } else if (encoding == 1) {
                        lyrics = new String(tagData, lyricsStart, lyricsLen, "UTF-16");
                    } else if (encoding == 2) {
                        lyrics = new String(tagData, lyricsStart, lyricsLen, "UTF-16BE");
                    } else {
                        lyrics = new String(tagData, lyricsStart, lyricsLen, "UTF-8");
                    }

                    // 去除 BOM 和尾部 null
                    lyrics = lyrics.replace("\uFEFF", "").trim();
                    if (!lyrics.isEmpty()) {
                        return lyrics;
                    }
                    break;
                }

                pos += 10 + frameSize;
            }
        } catch (Exception e) {
            Log.d("NativeBridge", "extractId3v2Lyrics error", e);
        }
        return null;
    }

    /**
     * 从 FLAC 文件的 VORBIS_COMMENT 块中提取 LYRICS 字段
     */
    private String extractFlacLyrics(Uri uri) {
        try {
            InputStream is = activity.getContentResolver().openInputStream(uri);
            if (is == null) return null;

            // 检查 FLAC 标识
            byte[] magic = new byte[4];
            if (is.read(magic) < 4) { is.close(); return null; }
            if (magic[0] != 'f' || magic[1] != 'L' || magic[2] != 'a' || magic[3] != 'C') {
                is.close(); return null;
            }

            // 遍历 metadata blocks
            boolean lastBlock = false;
            while (!lastBlock) {
                int blockHeader = is.read();
                if (blockHeader < 0) break;
                lastBlock = (blockHeader & 0x80) != 0;
                int blockType = blockHeader & 0x7F;

                // 读取块大小（3字节大端）
                int blockSize = ((is.read() & 0xFF) << 16)
                              | ((is.read() & 0xFF) << 8)
                              | (is.read() & 0xFF);

                if (blockType == 4) {
                    // VORBIS_COMMENT block
                    byte[] blockData = new byte[blockSize];
                    int totalRead = 0;
                    while (totalRead < blockSize) {
                        int r = is.read(blockData, totalRead, blockSize - totalRead);
                        if (r <= 0) break;
                        totalRead += r;
                    }
                    is.close();

                    if (totalRead < blockSize) return null;

                    // 解析 VORBIS_COMMENT
                    int pos = 0;
                    // 厂商字符串长度（小端 4 字节）
                    int vendorLen = (blockData[pos] & 0xFF)
                                  | ((blockData[pos + 1] & 0xFF) << 8)
                                  | ((blockData[pos + 2] & 0xFF) << 16)
                                  | ((blockData[pos + 3] & 0xFF) << 24);
                    pos += 4 + vendorLen;

                    // 评论字段数量
                    int commentCount = (blockData[pos] & 0xFF)
                                     | ((blockData[pos + 1] & 0xFF) << 8)
                                     | ((blockData[pos + 2] & 0xFF) << 16)
                                     | ((blockData[pos + 3] & 0xFF) << 24);
                    pos += 4;

                    for (int i = 0; i < commentCount && pos < blockSize; i++) {
                        int commentLen = (blockData[pos] & 0xFF)
                                       | ((blockData[pos + 1] & 0xFF) << 8)
                                       | ((blockData[pos + 2] & 0xFF) << 16)
                                       | ((blockData[pos + 3] & 0xFF) << 24);
                        pos += 4;

                        String comment = new String(blockData, pos, commentLen, "UTF-8");
                        pos += commentLen;

                        // 查找 LYRICS= 或 LYRICS=
                        int eqIdx = comment.indexOf('=');
                        if (eqIdx > 0) {
                            String key = comment.substring(0, eqIdx).toUpperCase();
                            if ("LYRICS".equals(key) || "UNSYNCEDLYRICS".equals(key)
                                    || "SYNC LYRICS".equals(key.replace(" ", ""))) {
                                String lyrics = comment.substring(eqIdx + 1);
                                if (!lyrics.trim().isEmpty()) return lyrics.trim();
                            }
                        }
                    }
                    return null;
                } else {
                    // 跳过非 VORBIS_COMMENT 块
                    long skipped = is.skip(blockSize);
                    if (skipped < blockSize) {
                        // skip 可能不完整，手动跳
                        byte[] skipBuf = new byte[Math.min(blockSize - (int)skipped, 8192)];
                        int remaining = blockSize - (int)skipped;
                        while (remaining > 0) {
                            int toRead = Math.min(remaining, skipBuf.length);
                            int r = is.read(skipBuf, 0, toRead);
                            if (r <= 0) break;
                            remaining -= r;
                        }
                    }
                }
            }
            is.close();
        } catch (Exception e) {
            Log.d("NativeBridge", "extractFlacLyrics error", e);
        }
        return null;
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

    /** Returns whether the app can create the status-bar lyric overlay. */
    @JavascriptInterface
    public boolean canDrawOverlays() {
        return StatusBarLyricOverlay.getInstance(activity).hasPermission();
    }

    /** Enables or hides the status-bar lyric overlay. */
    @JavascriptInterface
    public boolean setStatusBarLyricEnabled(boolean enabled) {
        return StatusBarLyricOverlay.getInstance(activity).setEnabled(enabled);
    }

    /** Updates the current lyric line and its song-theme accent color. */
    @JavascriptInterface
    public void updateStatusBarLyric(String text, String accentColor) {
        StatusBarLyricOverlay.getInstance(activity).update(text, accentColor);
    }

    /** Applies the complete overlay appearance and position configuration. */
    @JavascriptInterface
    public boolean applyStatusBarLyricConfig(String configJson) {
        return StatusBarLyricOverlay.getInstance(activity).applyConfig(configJson);
    }

    /** Allows only an explicit settings preview to appear while the app is visible. */
    @JavascriptInterface
    public boolean setStatusBarLyricPreviewVisible(boolean visible) {
        return StatusBarLyricOverlay.getInstance(activity).setForegroundPreviewVisible(visible);
    }

    /** Updates word-boundary lyric state without recreating the overlay window. */
    @JavascriptInterface
    public void updateStatusBarLyricState(String stateJson) {
        StatusBarLyricOverlay.getInstance(activity).updateState(stateJson);
    }

    /** 提供整首歌的歌词时间轴，供原生时钟在后台推送停摆期间自行推进。 */
    @JavascriptInterface
    public void setStatusBarLyricTimeline(String timelineJson) {
        StatusBarLyricOverlay.getInstance(activity).setTimeline(timelineJson);
    }

    /** Installs a TTF/OTF into the app-private font directory and returns its stable file id. */
    @JavascriptInterface
    public String installStatusBarLyricFont(String name, String base64Data) {
        try {
            String safeName = new File(name == null ? "font.ttf" : name).getName();
            if (!safeName.toLowerCase().endsWith(".ttf") && !safeName.toLowerCase().endsWith(".otf")) {
                return "";
            }
            byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
            if (bytes.length == 0 || bytes.length > 20 * 1024 * 1024) return "";
            File directory = new File(activity.getFilesDir(), "status-bar-fonts");
            if (!directory.exists() && !directory.mkdirs()) return "";
            String storedName = System.currentTimeMillis() + "-" + safeName.replaceAll("[^A-Za-z0-9._-]", "_");
            File output = new File(directory, storedName);
            try (FileOutputStream stream = new FileOutputStream(output)) {
                stream.write(bytes);
            }
            return storedName;
        } catch (Exception error) {
            Log.e("NativeBridge", "installStatusBarLyricFont error", error);
            return "";
        }
    }

    /** Notifies the WebView after returning from the system overlay-permission page. */
    public void notifyOverlayPermissionState() {
        boolean granted = StatusBarLyricOverlay.getInstance(activity).hasPermission();
        activity.evaluateJavascript(
                "window.__statusBarLyricPermissionChanged && "
                        + "window.__statusBarLyricPermissionChanged(" + granted + ");"
        );
    }

    /**
     * 设置后台保活（音频焦点保持）
     * 开启后播放服务会持续持有音频焦点，尽量避免被其他应用的录音/音频/视频播放阻断
     */
    @JavascriptInterface
    public void setBackgroundKeepAlive(boolean enabled) {
        try {
            activity.getSharedPreferences("zephyrus_prefs", android.content.Context.MODE_PRIVATE)
                    .edit()
                    .putBoolean("background_keep_alive", enabled)
                    .apply();
            MusicPlaybackService.setKeepAliveEnabled(enabled);
        } catch (Exception e) {
            Log.e("NativeBridge", "setBackgroundKeepAlive error", e);
        }
    }

    /**
     * 安装应用内下载的 APK（缓存目录 -> FileProvider -> 系统安装器）
     */
    @JavascriptInterface
    public void installApkFromCache(String fileName) {
        try {
            if (fileName == null || fileName.isEmpty()) return;
            File cacheDir = activity.getCacheDir();
            File apkFile = new File(cacheDir, fileName);
            Uri apkUri = getPublishedApkUri();
            if (apkUri == null && !apkFile.exists()) {
                Log.e("NativeBridge", "installApkFromCache: 安装包不存在 " + apkFile.getAbsolutePath());
                return;
            }
            if (apkUri == null) {
                apkUri = androidx.core.content.FileProvider.getUriForFile(
                        activity, activity.getPackageName() + ".fileprovider", apkFile);
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    && !activity.getPackageManager().canRequestPackageInstalls()) {
                Intent permissionIntent = new Intent(
                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + activity.getPackageName()));
                permissionIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.startActivity(permissionIntent);
                return;
            }

            Intent baseIntent = new Intent(Intent.ACTION_INSTALL_PACKAGE);
            baseIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            baseIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                    | Intent.FLAG_ACTIVITY_CLEAR_TOP
                    | Intent.FLAG_GRANT_READ_URI_PERMISSION
                    | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            baseIntent.putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true);
            if (baseIntent.resolveActivity(activity.getPackageManager()) == null) {
                Log.e("NativeBridge", "installApkFromCache: 未找到系统安装器");
                return;
            }
            activity.startActivity(baseIntent);
        } catch (Exception e) {
            Log.e("NativeBridge", "installApkFromCache error", e);
        }
    }

    // ==================== 应用内 APK 下载（原生线程直写缓存，避免大文件过桥崩溃） ====================

    private static final String APK_DOWNLOAD_FILE = "zephyrus-update.apk";
    private volatile boolean apkDownloadDone = false;
    private volatile boolean apkDownloadError = false;
    private volatile String apkDownloadErrorMessage = "";
    private volatile long apkDownloadBytes = 0;
    private volatile long apkDownloadExpected = 0;
    private volatile String apkDownloadUri = "";

    private Uri getPublishedApkUri() {
        if (apkDownloadUri == null || apkDownloadUri.isEmpty()) {
            apkDownloadUri = activity.getSharedPreferences("zephyrus_prefs", android.content.Context.MODE_PRIVATE)
                    .getString("apk_download_uri", "");
        }
        if (apkDownloadUri == null || apkDownloadUri.isEmpty()) return null;
        try {
            Uri uri = Uri.parse(apkDownloadUri);
            Cursor cursor = activity.getContentResolver().query(uri, null, null, null, null);
            if (cursor != null) {
                boolean exists = cursor.getCount() > 0;
                cursor.close();
                return exists ? uri : null;
            }
        } catch (Exception e) {
            Log.w("NativeBridge", "published APK URI unavailable", e);
        }
        return null;
    }

    /** 发布到公共 Downloads，供系统安装器和文件管理器使用。 */
    private void publishApkToDownloads(File source) throws Exception {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return;
        ContentResolver resolver = activity.getContentResolver();
        ContentValues values = new ContentValues();
        values.put(android.provider.MediaStore.Downloads.DISPLAY_NAME, "zephyrus-player-update.apk");
        values.put(android.provider.MediaStore.Downloads.MIME_TYPE, "application/vnd.android.package-archive");
        values.put(android.provider.MediaStore.Downloads.RELATIVE_PATH,
                Environment.DIRECTORY_DOWNLOADS + "/Zephyrus");
        values.put(android.provider.MediaStore.Downloads.IS_PENDING, 1);
        Uri uri = resolver.insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (uri == null) throw new Exception("无法创建公共下载文件");
        try (OutputStream output = resolver.openOutputStream(uri);
             InputStream input = new java.io.FileInputStream(source)) {
            if (output == null) throw new Exception("无法写入公共下载文件");
            copyStream(input, output);
        }
        ContentValues ready = new ContentValues();
        ready.put(android.provider.MediaStore.Downloads.IS_PENDING, 0);
        resolver.update(uri, ready, null, null);
        apkDownloadUri = uri.toString();
        activity.getSharedPreferences("zephyrus_prefs", android.content.Context.MODE_PRIVATE)
                .edit().putString("apk_download_uri", apkDownloadUri).apply();
    }

    /**
     * 在原生线程中下载 APK 到缓存目录（不经过 JS 桥接层，避免内存溢出）
     */
    @JavascriptInterface
    public void startApkDownload(String url, double expectedSize) {
        apkDownloadDone = false;
        apkDownloadError = false;
        apkDownloadErrorMessage = "";
        apkDownloadBytes = 0;
        apkDownloadExpected = (long) expectedSize;
        apkDownloadUri = "";
        if (url == null || url.isEmpty()) {
            apkDownloadError = true;
            apkDownloadErrorMessage = "下载地址为空";
            return;
        }

        new Thread(() -> {
            File target = new File(activity.getCacheDir(), APK_DOWNLOAD_FILE);
            File temp = new File(activity.getCacheDir(), APK_DOWNLOAD_FILE + ".tmp");
            HttpURLConnection connection = null;
            InputStream input = null;
            FileOutputStream output = null;
            try {
                URL source = new URL(url);
                connection = (HttpURLConnection) source.openConnection();
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(30000);
                connection.setInstanceFollowRedirects(true);
                connection.setRequestProperty("User-Agent", "Zephyrus-Player/Android");
                connection.connect();

                int status = connection.getResponseCode();
                if (status < 200 || status >= 300) {
                    throw new RuntimeException("HTTP " + status);
                }
                long total = connection.getContentLengthLong();
                if (total > 0) apkDownloadExpected = total;

                input = connection.getInputStream();
                output = new FileOutputStream(temp);
                byte[] buffer = new byte[128 * 1024];
                int read;
                long written = 0;
                while ((read = input.read(buffer)) != -1) {
                    output.write(buffer, 0, read);
                    written += read;
                    apkDownloadBytes = written;
                }
                output.flush();
                output.close();
                output = null;

                if (apkDownloadExpected > 0 && written < apkDownloadExpected) {
                    throw new RuntimeException("下载不完整");
                }
                if (target.exists()) target.delete();
                if (!temp.renameTo(target)) throw new RuntimeException("保存安装包失败");
                publishApkToDownloads(target);
                apkDownloadDone = true;
            } catch (Exception e) {
                Log.e("NativeBridge", "startApkDownload error", e);
                apkDownloadError = true;
                apkDownloadErrorMessage = e.getMessage() == null ? "下载失败" : e.getMessage();
                try {
                    if (temp.exists()) temp.delete();
                } catch (Exception ignored) {
                }
            } finally {
                try {
                    if (output != null) output.close();
                } catch (Exception ignored) {
                }
                try {
                    if (input != null) input.close();
                } catch (Exception ignored) {
                }
                if (connection != null) connection.disconnect();
            }
        }).start();
    }

    /**
     * 查询下载状态，返回 JSON: {done, error, message, bytes, expected}
     */
    @JavascriptInterface
    public String getApkDownloadState() {
        JSONObject result = new JSONObject();
        try {
            result.put("done", apkDownloadDone);
            result.put("error", apkDownloadError);
            result.put("message", apkDownloadErrorMessage);
            result.put("bytes", apkDownloadBytes);
            result.put("expected", apkDownloadExpected);
        } catch (Exception ignored) {
        }
        return result.toString();
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

    /**
     * 在外部浏览器中打开 URL（用于 Spotify OAuth 授权等）
     */
    @JavascriptInterface
    public void openExternal(String url) {
        if (url == null || url.isEmpty()) return;
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(intent);
        } catch (Exception e) {
            Log.e("NativeBridge", "openExternal error", e);
        }
    }

    /**
     * 在与当前 Activity 关联的 Custom Tab 中完成 Spotify OAuth。
     * 相比 NEW_TASK 外部浏览器，Custom Tab 能稳定把自定义 scheme 回调交还给 MainActivity。
     */
    @JavascriptInterface
    public void openSpotifyAuth(String url) {
        if (url == null || url.isEmpty()) return;
        activity.runOnUiThread(() -> {
            try {
                CustomTabsIntent customTabsIntent = new CustomTabsIntent.Builder()
                        .setShowTitle(false)
                        .setUrlBarHidingEnabled(true)
                        .build();
                customTabsIntent.launchUrl(activity, Uri.parse(url));
            } catch (Exception customTabError) {
                Log.w("SpotifyAuth", "Custom Tab unavailable, falling back to browser", customTabError);
                openExternal(url);
            }
        });
    }

    /**
     * Spotify Web API 原生网络通道。WebView 的 capacitor:// Origin 在部分设备上会被
     * CORS 拦截，因此移动端仅对 Spotify 官方 API 域名提供异步 Bearer 请求。
     */
    @JavascriptInterface
    public void spotifyApiRequest(String requestId, String url, String method, String accessToken, String body) {
        new Thread(() -> {
            JSONObject result = new JSONObject();
            HttpURLConnection connection = null;
            try {
                URL target = new URL(url);
                if (!"https".equalsIgnoreCase(target.getProtocol())
                        || !"api.spotify.com".equalsIgnoreCase(target.getHost())) {
                    throw new SecurityException("Unsupported Spotify API host");
                }

                connection = (HttpURLConnection) target.openConnection();
                connection.setRequestMethod(method == null || method.isEmpty() ? "GET" : method);
                connection.setConnectTimeout(12000);
                connection.setReadTimeout(15000);
                connection.setRequestProperty("Authorization", "Bearer " + accessToken);
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("Content-Type", "application/json");

                if (body != null && !body.isEmpty()
                        && !"GET".equalsIgnoreCase(connection.getRequestMethod())) {
                    connection.setDoOutput(true);
                    try (OutputStream output = connection.getOutputStream()) {
                        output.write(body.getBytes(StandardCharsets.UTF_8));
                    }
                }

                int status = connection.getResponseCode();
                InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
                String responseBody = "";
                if (stream != null) {
                    try (InputStream input = stream; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                        byte[] buffer = new byte[8192];
                        int read;
                        while ((read = input.read(buffer)) >= 0) output.write(buffer, 0, read);
                        responseBody = output.toString(StandardCharsets.UTF_8.name());
                    }
                }
                result.put("status", status);
                result.put("body", responseBody);
            } catch (Exception error) {
                Log.e("SpotifyApi", "Native request failed", error);
                try {
                    result.put("status", 0);
                    result.put("error", error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage());
                } catch (Exception ignored) {
                }
            } finally {
                if (connection != null) connection.disconnect();
            }

            String js = "window.__spotifyNativeResponse && window.__spotifyNativeResponse("
                    + JSONObject.quote(requestId) + "," + JSONObject.quote(result.toString()) + ");";
            activity.evaluateJavascript(js);
        }, "SpotifyApiRequest").start();
    }
}
