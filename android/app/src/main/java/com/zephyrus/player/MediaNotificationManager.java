package com.zephyrus.player;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * 音乐通知管理器。
 * 使用 NotificationCompat 实现媒体通知（歌曲信息、封面、播放控制按钮）。
 * 通知按钮通过 BroadcastReceiver -> evaluateJavascript 转发到前端。
 * TODO: 集成 MediaSession 实现锁屏控件（需解决 androidx.media 包路径问题）
 */
public class MediaNotificationManager {
    private static final String TAG = "MediaNotification";
    private static final String CHANNEL_ID = "zephyrus_music_service";
    private static final int NOTIFICATION_ID = 1001;

    private static final String ACTION_PLAY = "com.zephyrus.player.ACTION_PLAY";
    private static final String ACTION_PAUSE = "com.zephyrus.player.ACTION_PAUSE";
    private static final String ACTION_NEXT = "com.zephyrus.player.ACTION_NEXT";
    private static final String ACTION_PREV = "com.zephyrus.player.ACTION_PREV";

    private static MediaNotificationManager instance;

    private final Context context;
    private final NotificationManager notificationManager;
    private boolean isRegistered = false;

    // 当前媒体信息缓存
    private String currentTitle = "Zephyrus Player";
    private String currentArtist = "";
    private String currentAlbum = "";
    private boolean currentIsPlaying = false;
    private Bitmap currentArtwork = null;
    private String currentArtworkUrl = "";

    public static MediaNotificationManager getInstance(Context context) {
        if (instance == null) {
            instance = new MediaNotificationManager(context.getApplicationContext());
        }
        return instance;
    }

    private MediaNotificationManager(Context context) {
        this.context = context;
        this.notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        createNotificationChannel();
        registerButtonReceiver();

        Log.d(TAG, "MediaNotificationManager initialized");
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "音乐播放服务", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("保持音乐在后台播放");
            channel.setShowBadge(false);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    private final BroadcastReceiver mediaButtonReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context ctx, Intent intent) {
            String action = intent.getAction();
            if (action == null) return;
            switch (action) {
                case ACTION_PLAY: dispatchMediaButton("play"); break;
                case ACTION_PAUSE: dispatchMediaButton("pause"); break;
                case ACTION_NEXT: dispatchMediaButton("next"); break;
                case ACTION_PREV: dispatchMediaButton("prev"); break;
            }
        }
    };

    private void registerButtonReceiver() {
        if (isRegistered) return;
        IntentFilter filter = new IntentFilter();
        filter.addAction(ACTION_PLAY);
        filter.addAction(ACTION_PAUSE);
        filter.addAction(ACTION_NEXT);
        filter.addAction(ACTION_PREV);
        ContextCompat.registerReceiver(context, mediaButtonReceiver, filter,
                ContextCompat.RECEIVER_NOT_EXPORTED);
        isRegistered = true;
    }

    private void dispatchMediaButton(String action) {
        MainActivity activity = MainActivity.getInstance();
        if (activity != null) {
            String js = "window.dispatchEvent(new CustomEvent('media-button',{detail:'" + action + "'}));";
            activity.evaluateJavascript(js);
        }
    }

    public void updateMediaSession(String title, String artist, String album,
                                   String artworkUrl, boolean isPlaying,
                                   double duration, double position) {
        currentTitle = title != null ? title : "";
        currentArtist = artist != null ? artist : "";
        currentAlbum = album != null ? album : "";
        currentIsPlaying = isPlaying;

        // 异步加载封面
        if (artworkUrl != null && !artworkUrl.isEmpty() && !artworkUrl.equals(currentArtworkUrl)) {
            currentArtworkUrl = artworkUrl;
            loadArtworkAsync(artworkUrl);
        }

        updateNotification();
    }

    private void loadArtworkAsync(String urlStr) {
        new Thread(() -> {
            try {
                URL url = new URL(urlStr);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setDoInput(true);
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);
                conn.connect();
                InputStream input = conn.getInputStream();
                Bitmap bitmap = BitmapFactory.decodeStream(input);
                input.close();
                conn.disconnect();

                currentArtwork = bitmap;

                MainActivity activity = MainActivity.getInstance();
                if (activity != null) {
                    activity.runOnUiThread(this::updateNotification);
                }
            } catch (Exception e) {
                Log.w(TAG, "Failed to load artwork: " + e.getMessage());
            }
        }).start();
    }

    private void updateNotification() {
        if (notificationManager == null) return;
        Notification notification = buildNotification();
        if (notification != null) {
            notificationManager.notify(NOTIFICATION_ID, notification);
        }
    }

    private Notification buildNotification() {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        Intent contentIntent = new Intent(context, MainActivity.class);
        contentIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentPending = PendingIntent.getActivity(context, 0, contentIntent, flags);

        PendingIntent prevPending = PendingIntent.getBroadcast(context, 1,
                new Intent(ACTION_PREV).setPackage(context.getPackageName()), flags);
        PendingIntent playPausePending = PendingIntent.getBroadcast(context, 2,
                new Intent(currentIsPlaying ? ACTION_PAUSE : ACTION_PLAY)
                        .setPackage(context.getPackageName()), flags);
        PendingIntent nextPending = PendingIntent.getBroadcast(context, 3,
                new Intent(ACTION_NEXT).setPackage(context.getPackageName()), flags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setContentTitle(currentTitle)
                .setContentText(currentArtist)
                .setSubText(currentAlbum)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(contentPending)
                .setOngoing(true)
                .setShowWhen(false)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .addAction(android.R.drawable.ic_media_previous, "Previous", prevPending)
                .addAction(
                        currentIsPlaying
                                ? android.R.drawable.ic_media_pause
                                : android.R.drawable.ic_media_play,
                        currentIsPlaying ? "Pause" : "Play",
                        playPausePending)
                .addAction(android.R.drawable.ic_media_next, "Next", nextPending);

        if (currentArtwork != null) {
            builder.setLargeIcon(currentArtwork);
        }

        return builder.build();
    }

    public Notification getServiceNotification() {
        return buildNotification();
    }

    public void showIdleNotification() {
        currentTitle = "Zephyrus Player";
        currentArtist = "播放器运行中";
        currentAlbum = "";
        currentIsPlaying = false;
        currentArtwork = null;
        currentArtworkUrl = "";
        updateNotification();
    }

    public void clear() {
        if (notificationManager != null) {
            notificationManager.cancel(NOTIFICATION_ID);
        }
    }

    public void release() {
        if (isRegistered) {
            try {
                context.unregisterReceiver(mediaButtonReceiver);
            } catch (Exception e) {
                // ignore
            }
            isRegistered = false;
        }
        instance = null;
    }
}
