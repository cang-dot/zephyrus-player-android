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
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.util.Log;

import androidx.core.content.ContextCompat;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * 音乐通知管理器（原生 Android API 实现）。
 * 使用 android.media.session.MediaSession（API 21+）实现：
 * - 媒体通知（歌曲信息、封面、播放控制按钮）
 * - 锁屏控件
 * - MediaStyle 通知样式
 * 通知按钮通过 BroadcastReceiver -> evaluateJavascript 转发到前端。
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
    private MediaSession mediaSession;
    private boolean isRegistered = false;

    // 当前媒体信息缓存
    private String currentTitle = "Zephyrus Player";
    private String currentArtist = "";
    private String currentAlbum = "";
    private boolean currentIsPlaying = false;
    private long currentDuration = 0;
    private long currentPosition = 0;
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
        initMediaSession();
        registerButtonReceiver();

        Log.d(TAG, "MediaNotificationManager initialized (native API)");
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

    @SuppressWarnings("deprecation")
    private void initMediaSession() {
        mediaSession = new MediaSession(context, "ZephyrusPlayer");
        mediaSession.setFlags(
                MediaSession.FLAG_HANDLES_MEDIA_BUTTONS |
                MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS);

        mediaSession.setCallback(new MediaSession.Callback() {
            @Override public void onPlay() { dispatchMediaButton("play"); }
            @Override public void onPause() { dispatchMediaButton("pause"); }
            @Override public void onSkipToNext() { dispatchMediaButton("next"); }
            @Override public void onSkipToPrevious() { dispatchMediaButton("prev"); }
            @Override public void onStop() { dispatchMediaButton("stop"); }
            @Override public void onSeekTo(long pos) { dispatchMediaButton("seek:" + pos); }
        });
        mediaSession.setActive(true);
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

    /**
     * 更新媒体会话元数据和播放状态，并刷新通知
     */
    public void updateMediaSession(String title, String artist, String album,
                                   String artworkUrl, boolean isPlaying,
                                   double duration, double position) {
        currentTitle = title != null ? title : "";
        currentArtist = artist != null ? artist : "";
        currentAlbum = album != null ? album : "";
        currentIsPlaying = isPlaying;
        currentDuration = (long) (duration * 1000);
        currentPosition = (long) (position * 1000);

        // 更新元数据
        MediaMetadata.Builder metadataBuilder = new MediaMetadata.Builder();
        metadataBuilder.putString(MediaMetadata.METADATA_KEY_TITLE, currentTitle);
        metadataBuilder.putString(MediaMetadata.METADATA_KEY_ARTIST, currentArtist);
        metadataBuilder.putString(MediaMetadata.METADATA_KEY_ALBUM, currentAlbum);
        metadataBuilder.putLong(MediaMetadata.METADATA_KEY_DURATION, currentDuration);
        if (currentArtwork != null) {
            metadataBuilder.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, currentArtwork);
        }
        mediaSession.setMetadata(metadataBuilder.build());

        // 更新播放状态
        PlaybackState.Builder stateBuilder = new PlaybackState.Builder();
        stateBuilder.setActions(
                PlaybackState.ACTION_PLAY |
                PlaybackState.ACTION_PAUSE |
                PlaybackState.ACTION_PLAY_PAUSE |
                PlaybackState.ACTION_SKIP_TO_NEXT |
                PlaybackState.ACTION_SKIP_TO_PREVIOUS |
                PlaybackState.ACTION_SEEK_TO);
        int state = isPlaying
                ? PlaybackState.STATE_PLAYING
                : PlaybackState.STATE_PAUSED;
        stateBuilder.setState(state, currentPosition, isPlaying ? 1.0f : 0f);
        mediaSession.setPlaybackState(stateBuilder.build());

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

    @SuppressWarnings("deprecation")
    private Notification buildNotification() {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        // 点击通知打开 MainActivity
        Intent contentIntent = new Intent(context, MainActivity.class);
        contentIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentPending = PendingIntent.getActivity(context, 0, contentIntent, flags);

        // 上一首
        PendingIntent prevPending = PendingIntent.getBroadcast(context, 1,
                new Intent(ACTION_PREV).setPackage(context.getPackageName()), flags);
        // 播放/暂停
        PendingIntent playPausePending = PendingIntent.getBroadcast(context, 2,
                new Intent(currentIsPlaying ? ACTION_PAUSE : ACTION_PLAY)
                        .setPackage(context.getPackageName()), flags);
        // 下一首
        PendingIntent nextPending = PendingIntent.getBroadcast(context, 3,
                new Intent(ACTION_NEXT).setPackage(context.getPackageName()), flags);

        // 使用原生 Notification.Builder（API 24+ 直接支持 Channel ID）
        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(context, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(context);
            builder.setPriority(Notification.PRIORITY_LOW);
        }

        builder.setContentTitle(currentTitle)
                .setContentText(currentArtist)
                .setSubText(currentAlbum)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(contentPending)
                .setOngoing(true)
                .setShowWhen(false)
                .setOnlyAlertOnce(true)
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

        // MediaStyle：将通知与 MediaSession 关联
        Notification.MediaStyle mediaStyle = new Notification.MediaStyle();
        mediaStyle.setMediaSession(mediaSession.getSessionToken());
        mediaStyle.setShowActionsInCompactView(0, 1, 2);
        builder.setStyle(mediaStyle);

        return builder.build();
    }

    /**
     * 获取通知对象供 MusicPlaybackService 用作前台服务通知
     */
    public Notification getServiceNotification() {
        return buildNotification();
    }

    /**
     * 显示空闲通知（未在播放时）
     */
    public void showIdleNotification() {
        currentTitle = "Zephyrus Player";
        currentArtist = "播放器运行中";
        currentAlbum = "";
        currentIsPlaying = false;
        currentArtwork = null;
        currentArtworkUrl = "";

        // 更新播放状态为空闲
        PlaybackState.Builder stateBuilder = new PlaybackState.Builder();
        stateBuilder.setActions(PlaybackState.ACTION_PLAY);
        stateBuilder.setState(PlaybackState.STATE_NONE, 0, 0);
        mediaSession.setPlaybackState(stateBuilder.build());

        updateNotification();
    }

    /**
     * 清除通知
     */
    public void clear() {
        if (notificationManager != null) {
            notificationManager.cancel(NOTIFICATION_ID);
        }
        if (mediaSession != null) {
            mediaSession.setActive(false);
        }
    }

    /**
     * 释放资源
     */
    public void release() {
        if (isRegistered) {
            try {
                context.unregisterReceiver(mediaButtonReceiver);
            } catch (Exception e) {
                // ignore
            }
            isRegistered = false;
        }
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
            mediaSession = null;
        }
        instance = null;
    }
}
