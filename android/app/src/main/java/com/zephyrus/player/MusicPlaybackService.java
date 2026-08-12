package com.zephyrus.player;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Binder;
import android.os.IBinder;
import android.util.Log;

import androidx.core.app.NotificationCompat;

/**
 * 音乐播放前台服务，同时持有 Android 原生音频引擎。
 * 音频焦点、缓存、解码和通知状态由服务生命周期内的 Media3 引擎统一管理。
 */
public class MusicPlaybackService extends Service {
    private static final String TAG = "MusicPlaybackService";
    private static final String CHANNEL_ID = "zephyrus_music_service";
    private static final String PREFS_NAME = "zephyrus_prefs";
    private static final String KEY_KEEP_ALIVE = "background_keep_alive";
    private static final int NOTIFICATION_ID = 1001;

    private static MusicPlaybackService instance = null;
    private static NativeAudioEngine audioEngine;

    private final IBinder binder = new LocalBinder();

    public class LocalBinder extends Binder {
        MusicPlaybackService getService() {
            return MusicPlaybackService.this;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        keepAliveEnabled = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                .getBoolean(KEY_KEEP_ALIVE, false);
        createNotificationChannel();
        getOrCreateAudioEngine(this).setKeepAudioFocus(keepAliveEnabled);
    }

    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification notification = createServiceNotification();
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIFICATION_ID, notification,
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        Log.d(TAG, "音乐播放服务已启动");
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        synchronized (MusicPlaybackService.class) {
            if (audioEngine != null) {
                audioEngine.release();
                audioEngine = null;
            }
        }
        try {
            MediaNotificationManager.getInstance(this).release();
        } catch (Exception ignored) {
        }
        instance = null;
        super.onDestroy();
        Log.d(TAG, "音乐播放服务已停止");
    }

    public static synchronized NativeAudioEngine getOrCreateAudioEngine(android.content.Context context) {
        if (audioEngine == null) {
            audioEngine = new NativeAudioEngine(context);
            boolean enabled = context.getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                    .getBoolean(KEY_KEEP_ALIVE, false);
            audioEngine.setKeepAudioFocus(enabled);
        }
        return audioEngine;
    }

    /**
     * 由 JS/NativeBridge 调用：开启/关闭后台保活。
     */
    public static void setKeepAliveEnabled(boolean enabled) {
        if (instance != null) {
            instance.keepAliveEnabled = enabled;
        }
        if (audioEngine != null) audioEngine.setKeepAudioFocus(enabled);
    }

    private boolean keepAliveEnabled = false;

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "音乐播放服务",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("保持音乐在后台播放");
            channel.setShowBadge(false);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification createServiceNotification() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, flags);

        MediaNotificationManager mediaMgr = MediaNotificationManager.getInstance(this);
        Notification mediaNotification = mediaMgr.getServiceNotification();
        if (mediaNotification != null) {
            return mediaNotification;
        }

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Zephyrus Player")
                .setContentText("播放器运行中")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setShowWhen(false)
                .setPriority(NotificationCompat.PRIORITY_MIN)
                .build();
    }
}
