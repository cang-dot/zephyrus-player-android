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
 * 音乐播放前台服务
 * 仅负责保持应用在后台不被系统杀死。
 *
 * ⚠️ 不触碰音频焦点！
 * WebView HTML5 Audio 自行管理音频焦点，原生层请求 AUDIOFOCUS_GAIN
 * 会导致系统暂停 WebView 音频（进度条不动、播放停止）。
 */
public class MusicPlaybackService extends Service {
    private static final String TAG = "MusicPlaybackService";
    private static final String CHANNEL_ID = "zephyrus_music_service";
    private static final String PREFS_NAME = "zephyrus_prefs";
    private static final String KEY_KEEP_ALIVE = "background_keep_alive";
    private static final int NOTIFICATION_ID = 1001;

    private static MusicPlaybackService instance = null;

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
        createNotificationChannel();
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
        instance = null;
        super.onDestroy();
        Log.d(TAG, "音乐播放服务已停止");
    }

    /**
     * 由 JS/NativeBridge 调用：开启/关闭后台保活
     * 仅记录设置，不影响音频焦点
     */
    public static void setKeepAliveEnabled(boolean enabled) {
        if (instance != null) {
            instance.keepAliveEnabled = enabled;
        }
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
