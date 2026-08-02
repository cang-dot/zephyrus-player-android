package com.zephyrus.player;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import android.os.Binder;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.core.app.NotificationCompat;

/**
 * 音乐播放前台服务
 * 保持应用在后台播放音乐时不被系统杀死
 */
public class MusicPlaybackService extends Service {
    private static final String TAG = "MusicPlaybackService";
    private static final String CHANNEL_ID = "zephyrus_music_service";
    private static final String PREFS_NAME = "zephyrus_prefs";
    private static final String KEY_KEEP_ALIVE = "background_keep_alive";
    // 使用与 MediaNotificationManager 相同的通知 ID，确保只有一个通知
    private static final int NOTIFICATION_ID = 1001;

    private static MusicPlaybackService instance = null;

    private final IBinder binder = new LocalBinder();
    private AudioManager audioManager;
    private AudioFocusRequest focusRequest;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean keepAliveEnabled = false;

    private final AudioManager.OnAudioFocusChangeListener focusListener =
            new AudioManager.OnAudioFocusChangeListener() {
                @Override
                public void onAudioFocusChange(int focusChange) {
                    if (!keepAliveEnabled) return;
                    // 后台保活：不暂停、不降音量，立即把音频焦点抢回来，
                    // 避免被其他应用的录音/音频/视频播放阻断。
                    if (focusChange == AudioManager.AUDIOFOCUS_LOSS
                            || focusChange == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT
                            || focusChange == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK) {
                        requestKeepAliveFocus();
                    }
                }
            };

    public class LocalBinder extends Binder {
        MusicPlaybackService getService() {
            return MusicPlaybackService.this;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                    .setOnAudioFocusChangeListener(focusListener)
                    .setWillPauseWhenDucked(false)
                    .build();
        }
        // 读取上次设置的后台保活开关
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        keepAliveEnabled = prefs.getBoolean(KEY_KEEP_ALIVE, false);
        if (keepAliveEnabled) {
            requestKeepAliveFocus();
        }
        createNotificationChannel();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // 启动前台服务（Android 14+ 需要显式指定 foregroundServiceType）
        Notification notification = createServiceNotification();
        if (Build.VERSION.SDK_INT >= 34) {
            // Android 14+ (API 34) 必须传入 foregroundServiceType
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
        if (keepAliveEnabled) {
            abandonKeepAliveFocus();
        }
        super.onDestroy();
        Log.d(TAG, "音乐播放服务已停止");
    }

    /**
     * 由 JS/NativeBridge 调用：开启/关闭后台保活
     */
    public static void setKeepAliveEnabled(boolean enabled) {
        if (instance != null) {
            instance.setKeepAlive(enabled);
        }
    }

    private void setKeepAlive(boolean enabled) {
        keepAliveEnabled = enabled;
        if (enabled) {
            requestKeepAliveFocus();
        } else {
            abandonKeepAliveFocus();
        }
    }

    private void requestKeepAliveFocus() {
        if (audioManager == null || !keepAliveEnabled) return;
        int result;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && focusRequest != null) {
            result = audioManager.requestAudioFocus(focusRequest);
        } else {
            result = audioManager.requestAudioFocus(
                    focusListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN);
        }
        if (result != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
            // 焦点被占用时稍后重试，持续保持“不被抢走”的状态
            handler.removeCallbacks(focusRetryRunnable);
            handler.postDelayed(focusRetryRunnable, 1000);
        } else {
            handler.removeCallbacks(focusRetryRunnable);
        }
    }

    private void abandonKeepAliveFocus() {
        handler.removeCallbacks(focusRetryRunnable);
        if (audioManager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && focusRequest != null) {
            audioManager.abandonAudioFocusRequest(focusRequest);
        } else {
            audioManager.abandonAudioFocus(focusListener);
        }
    }

    private final Runnable focusRetryRunnable = new Runnable() {
        @Override
        public void run() {
            requestKeepAliveFocus();
        }
    };

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

        // 尝试使用 MediaNotificationManager 的媒体通知作为前台服务通知
        // 这样只有一个通知显示，避免两个通知冲突
        MediaNotificationManager mediaMgr = MediaNotificationManager.getInstance(this);
        Notification mediaNotification = mediaMgr.getServiceNotification();
        if (mediaNotification != null) {
            return mediaNotification;
        }

        // 回退到简单的服务通知
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
