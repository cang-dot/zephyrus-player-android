package com.zephyrus.player;

import android.app.Notification;
import android.content.Context;
import android.util.Log;

/**
 * 音乐通知管理器（存根）。
 * 原本基于 android.support.v4.media.session 的 MediaSessionCompat /
 * PlaybackStateCompat / MediaMetadataCompat，这些类在 androidx.media:media
 * 中不存在。待完整迁移到 Media3 或重新引入兼容依赖后恢复通知功能。
 */
public class MediaNotificationManager {
    private static final String TAG = "MediaNotification";
    private static MediaNotificationManager instance;

    public static MediaNotificationManager getInstance(Context context) {
        if (instance == null) {
            instance = new MediaNotificationManager(context);
        }
        return instance;
    }

    private MediaNotificationManager(Context context) {
        Log.d(TAG, "MediaNotificationManager stub initialized");
    }

    public void updateMediaSession(String title, String artist, String album,
                                   String artworkUrl, boolean isPlaying,
                                   double duration, double position) {
    }

    public void clear() {
    }

    public void release() {
        instance = null;
    }

    public void showIdleNotification() {
    }

    public Notification getServiceNotification() {
        return null;
    }
}
