package com.zephyrus.player;

import android.content.Context;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.Nullable;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.Format;
import androidx.media3.common.audio.AudioProcessor;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.audio.AudioSink;
import androidx.media3.exoplayer.audio.DefaultAudioSink;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.database.StandaloneDatabaseProvider;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.cache.CacheDataSource;
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor;
import androidx.media3.datasource.cache.SimpleCache;

import org.json.JSONObject;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Owns all Android audio output. WebView only receives state and analysis events. */
@UnstableApi
public final class NativeAudioEngine {
    private final Context context;
    @Nullable private volatile MainActivity activity;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Map<String, Slot> slots = new ConcurrentHashMap<>();
    private final SimpleCache mediaCache;
    private final CacheDataSource.Factory cacheDataSourceFactory;
    private final AudioManager audioManager;
    private final AudioManager.OnAudioFocusChangeListener audioFocusChangeListener =
            this::handleAudioFocusChange;
    @Nullable private final AudioFocusRequest audioFocusRequest;
    private boolean hasAudioFocus;
    private boolean resumeAfterFocusGain;
    private boolean keepAudioFocus;
    private float focusMultiplier = 1f;
    private final Runnable reclaimAudioFocusRunnable = this::reclaimAudioFocus;
    @Nullable private volatile Slot current;
    @Nullable private volatile Slot pending;
    private float masterVolume = 1f;
    private boolean released;
    private int crossfadeGeneration;
    private float eqLowGain = 1f;
    private float eqMidGain = 1f;
    private float eqHighGain = 1f;

    private final Runnable progressTicker = new Runnable() {
        @Override
        public void run() {
            if (released) return;
            for (Slot slot : slots.values()) {
                slot.positionMs = Math.max(0, slot.player.getCurrentPosition());
                slot.durationMs = Math.max(0, slot.player.getDuration());
            }
            if (current != null) emitState(current, "progress", null);
            handler.postDelayed(this, 100);
        }
    };

    private final Runnable analysisTicker = new Runnable() {
        @Override
        public void run() {
            if (released) return;
            if (current != null && current.playing) emitAnalysis(current);
            handler.postDelayed(this, 50);
        }
    };

    public NativeAudioEngine(Context context) {
        this.context = context.getApplicationContext();
        if (context instanceof MainActivity) activity = (MainActivity) context;
        mediaCache = new SimpleCache(
                new java.io.File(this.context.getCacheDir(), "media3-audio"),
                new LeastRecentlyUsedCacheEvictor(512L * 1024L * 1024L),
                new StandaloneDatabaseProvider(this.context));
        cacheDataSourceFactory = new CacheDataSource.Factory()
                .setCache(mediaCache)
                .setUpstreamDataSourceFactory(new DefaultDataSource.Factory(this.context))
                .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR);
        audioManager = (AudioManager) this.context.getSystemService(Context.AUDIO_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                    .setAudioAttributes(new android.media.AudioAttributes.Builder()
                            .setUsage(android.media.AudioAttributes.USAGE_MEDIA)
                            .setContentType(android.media.AudioAttributes.CONTENT_TYPE_MUSIC)
                            .build())
                    .setOnAudioFocusChangeListener(audioFocusChangeListener, handler)
                    .setWillPauseWhenDucked(false)
                    .build();
        } else {
            audioFocusRequest = null;
        }
        handler.post(progressTicker);
        handler.post(analysisTicker);
    }

    public void setKeepAudioFocus(boolean enabled) {
        handler.post(() -> {
            keepAudioFocus = enabled;
            if (enabled && current != null && current.player.isPlaying()) requestAudioFocus();
            if (!enabled) {
                handler.removeCallbacks(reclaimAudioFocusRunnable);
                if (focusMultiplier != 1f) {
                    focusMultiplier = 1f;
                    updateSlotVolumes();
                }
            }
        });
    }

    public void attachActivity(MainActivity activity) {
        this.activity = activity;
    }

    public void detachActivity(MainActivity activity) {
        if (this.activity == activity) this.activity = null;
    }

    public String load(String trackJson, boolean preload) {
        String token = UUID.randomUUID().toString();
        handler.post(() -> {
            try {
                JSONObject track = new JSONObject(trackJson);
                String url = track.optString("url", "");
                if (url.startsWith("local://")) {
                    url = Uri.decode(url.replaceFirst("^local:/+", ""));
                }
                if (url.isEmpty()) throw new IllegalArgumentException("音频地址为空");

                Slot slot = createSlot(token, track);
                slots.put(token, slot);
                slot.player.setMediaItem(MediaItem.fromUri(Uri.parse(url)));
                long positionMs = Math.max(0, track.optLong("positionMs", 0));
                if (positionMs > 0) slot.player.seekTo(positionMs);
                slot.player.setPlayWhenReady(false);
                slot.player.prepare();

                if (preload) {
                    releaseSlot(pending, false);
                    pending = slot;
                } else {
                    crossfadeGeneration++;
                    releaseSlot(pending, false);
                    pending = slot;
                }
            } catch (Exception error) {
                emitError(token, error);
            }
        });
        return token;
    }

    public void play(String token) {
        handler.post(() -> {
            Slot slot = slots.get(token);
            if (slot == null) return;
            if (current != slot) {
                Slot previous = current;
                if (previous != null) {
                    rampVolume(previous, previous.player.getVolume(), 0f, 10, () -> {
                        releaseSlot(previous, true);
                        promoteAndPlay(slot);
                    });
                    return;
                }
                promoteAndPlay(slot);
                return;
            }
            startSlot(slot);
        });
    }

    private void promoteAndPlay(Slot slot) {
        if (!slots.containsKey(slot.token)) return;
        current = slot;
        if (pending == slot) pending = null;
        startSlot(slot);
    }

    private void startSlot(Slot slot) {
        if (!requestAudioFocus()) {
            emitError(slot.token, new IllegalStateException("无法获得音频焦点"));
            return;
        }
        slot.player.setVolume(0f);
        slot.player.play();
        rampVolume(slot, 0f, slot.targetVolume(masterVolume), 10, null);
    }

    public void pause(String token) {
        handler.post(() -> {
            Slot slot = slots.get(token);
            if (slot == null) return;
            rampVolume(slot, slot.player.getVolume(), 0f, 10, () -> {
                slot.player.pause();
                slot.player.setVolume(slot.targetVolume(masterVolume));
            });
        });
    }

    public void stop(String token) {
        handler.post(() -> {
            Slot slot = slots.get(token);
            if (slot == null) return;
            rampVolume(slot, slot.player.getVolume(), 0f, 10, () -> {
                slot.player.stop();
                slot.player.seekTo(0);
                abandonAudioFocusIfIdle();
            });
        });
    }

    public void unload(String token) {
        handler.post(() -> {
            releaseSlot(slots.get(token), true);
            abandonAudioFocusIfIdle();
        });
    }

    public void seekTo(String token, long positionMs) {
        handler.post(() -> {
            Slot slot = slots.get(token);
            if (slot == null) return;
            boolean resume = slot.player.isPlaying();
            float target = slot.targetVolume(masterVolume);
            rampVolume(slot, slot.player.getVolume(), 0f, 10, () -> {
                slot.player.seekTo(Math.max(0, positionMs));
                if (resume) rampVolume(slot, 0f, target, 10, null);
                else slot.player.setVolume(target);
                emitState(slot, "seek", null);
            });
        });
    }

    public void setPlaybackRate(String token, float rate) {
        handler.post(() -> {
            Slot slot = slots.get(token);
            if (slot != null) slot.player.setPlaybackSpeed(Math.max(0.25f, Math.min(4f, rate)));
        });
    }

    public void setVolume(float volume) {
        masterVolume = Math.max(0f, Math.min(1f, volume));
        handler.post(() -> {
            if (current != null) current.player.setVolume(current.targetVolume(masterVolume));
            if (pending != null) pending.player.setVolume(pending.targetVolume(masterVolume));
        });
    }

    public void setEqGains(float low, float mid, float high) {
        eqLowGain = Math.max(0.25f, Math.min(2f, low));
        eqMidGain = Math.max(0.25f, Math.min(2f, mid));
        eqHighGain = Math.max(0.25f, Math.min(2f, high));
        handler.post(() -> {
            for (Slot slot : slots.values()) {
                slot.processor.setEqGains(eqLowGain, eqMidGain, eqHighGain);
            }
        });
    }

    public String startCrossfade(String fromToken, String toToken, double durationSeconds, int level) {
        Slot from = slots.get(fromToken);
        Slot to = slots.get(toToken);
        double duration = Math.max(0.25d, durationSeconds);
        long startDelayMs = 0;
        if (level >= 2 && from != null) {
            float bpm = from.processor.getAnalysisSnapshot().bpm;
            if (bpm >= 60f) {
                double beat = 60d / bpm;
                duration = Math.max(beat * 2d, Math.round(duration / beat) * beat);
                double positionSeconds = Math.max(0, from.positionMs) / 1000d;
                double phase = positionSeconds % beat;
                startDelayMs = Math.round((phase < 0.03d ? 0d : beat - phase) * 1000d);
            }
        }
        final double actualDuration = duration;
        final long actualStartDelayMs = startDelayMs;
        handler.postDelayed(
                () -> beginCrossfade(from, to, actualDuration, level),
                actualStartDelayMs);
        try {
            JSONObject result = new JSONObject();
            result.put("started", from != null && to != null);
            result.put("duration", actualDuration);
            result.put("startDelay", actualStartDelayMs / 1000d);
            result.put("level", Math.max(1, Math.min(3, level)));
            return result.toString();
        } catch (Exception error) {
            return "{\"started\":false}";
        }
    }

    public void cancelCrossfade() {
        handler.post(() -> {
            crossfadeGeneration++;
            if (current != null) {
                current.mixFactor = 1f;
                current.processor.setBandGains(1f, 1f, 1f);
                current.player.setVolume(current.targetVolume(masterVolume));
            }
            if (pending != null && pending != current) releaseSlot(pending, true);
            pending = null;
        });
    }

    public String getState(String token) {
        Slot slot = slots.get(token);
        if (slot == null) return "{\"state\":\"unloaded\"}";
        return slot.stateJson().toString();
    }

    public String getAnalysis() {
        Slot slot = current;
        if (slot == null) return "{\"loudness\":0,\"low\":0,\"mid\":0,\"high\":0,\"bpm\":0}";
        PeakSafeAudioProcessor.AnalysisSnapshot data = slot.processor.getAnalysisSnapshot();
        try {
            JSONObject json = new JSONObject();
            json.put("loudness", slot.playing ? data.loudness : 0f);
            json.put("low", slot.playing ? data.low : 0f);
            json.put("mid", slot.playing ? data.mid : 0f);
            json.put("high", slot.playing ? data.high : 0f);
            json.put("bpm", data.bpm);
            return json.toString();
        } catch (Exception error) {
            return "{}";
        }
    }

    public void release() {
        handler.post(() -> {
            released = true;
            handler.removeCallbacksAndMessages(null);
            for (Slot slot : slots.values()) slot.player.release();
            slots.clear();
            current = null;
            pending = null;
            mediaCache.release();
            abandonAudioFocus();
        });
    }

    private Slot createSlot(String token, JSONObject track) throws Exception {
        PeakSafeAudioProcessor processor = new PeakSafeAudioProcessor();
        processor.setEqGains(eqLowGain, eqMidGain, eqHighGain);
        DefaultRenderersFactory renderersFactory = new DefaultRenderersFactory(context) {
            @Override
            protected AudioSink buildAudioSink(
                    Context context,
                    boolean enableFloatOutput,
                    boolean enableAudioOutputPlaybackParams) {
                return new DefaultAudioSink.Builder(context)
                        .setAudioProcessors(new AudioProcessor[]{processor})
                        .setEnableAudioOutputPlaybackParameters(enableAudioOutputPlaybackParams)
                        .build();
            }
        };
        ExoPlayer player = new ExoPlayer.Builder(context, renderersFactory)
                .setMediaSourceFactory(
                        new DefaultMediaSourceFactory(context)
                                .setDataSourceFactory(cacheDataSourceFactory))
                .build();
        player.setAudioAttributes(
                new AudioAttributes.Builder()
                        .setUsage(C.USAGE_MEDIA)
                        .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                        .build(),
                false);
        Slot slot = new Slot(token, player, processor, track);
        player.addListener(slot);
        return slot;
    }

    private void beginCrossfade(@Nullable Slot from, @Nullable Slot to, double duration, int level) {
        if (from == null || to == null || !slots.containsKey(from.token) || !slots.containsKey(to.token)) {
            if (to != null) emitError(to.token, new IllegalStateException("混音音轨不可用"));
            return;
        }
        final int generation = ++crossfadeGeneration;
        if (!requestAudioFocus()) {
            emitError(to.token, new IllegalStateException("无法获得音频焦点"));
            return;
        }
        pending = to;
        to.player.setVolume(0f);
        to.player.play();
        long startedAt = System.nanoTime();
        long durationNs = Math.max(1, (long) (duration * 1_000_000_000L));

        Runnable step = new Runnable() {
            @Override
            public void run() {
                if (generation != crossfadeGeneration || released) return;
                float progress = Math.min(1f, (System.nanoTime() - startedAt) / (float) durationNs);
                float fromCurve = (float) Math.cos(progress * Math.PI * 0.5d);
                float toCurve = (float) Math.sin(progress * Math.PI * 0.5d);
                // Keep the equal-power relationship while reserving enough shared headroom for
                // Android's mixer, which combines the two independently limited AudioTracks.
                float mixHeadroom = 1f / Math.max(1f, fromCurve + toCurve);
                from.mixFactor = fromCurve * mixHeadroom;
                to.mixFactor = toCurve * mixHeadroom;
                from.player.setVolume(from.targetVolume(masterVolume));
                to.player.setVolume(to.targetVolume(masterVolume));
                applyBandTransition(from.processor, to.processor, progress, level);

                if (progress < 1f) {
                    handler.postDelayed(this, 16);
                    return;
                }
                from.suppressPauseEvent = true;
                from.player.stop();
                releaseSlot(from, true);
                to.mixFactor = 1f;
                to.processor.setBandGains(1f, 1f, 1f);
                to.player.setVolume(masterVolume);
                current = to;
                pending = null;
                emitState(to, "crossfadeComplete", null);
            }
        };
        handler.post(step);
    }

    private void applyBandTransition(
            PeakSafeAudioProcessor from,
            PeakSafeAudioProcessor to,
            float progress,
            int level) {
        if (level < 3) {
            from.setBandGains(1f, 1f, 1f);
            to.setBandGains(1f, 1f, 1f);
            return;
        }
        float lowIn = smoothStep(0.48f, 1f, progress);
        float midIn = smoothStep(0.2f, 0.8f, progress);
        float highIn = smoothStep(0f, 0.52f, progress);
        from.setBandGains(1f - lowIn, 1f - midIn, 1f - highIn);
        to.setBandGains(lowIn, midIn, highIn);
    }

    private void rampVolume(
            Slot slot,
            float from,
            float to,
            long durationMs,
            @Nullable Runnable completion) {
        long start = System.nanoTime();
        Runnable step = new Runnable() {
            @Override
            public void run() {
                if (!slots.containsKey(slot.token)) return;
                float progress = Math.min(1f, (System.nanoTime() - start) / (durationMs * 1_000_000f));
                slot.player.setVolume(from + (to - from) * progress);
                if (progress < 1f) handler.postDelayed(this, 4);
                else if (completion != null) completion.run();
            }
        };
        handler.post(step);
    }

    private void releaseSlot(@Nullable Slot slot, boolean remove) {
        if (slot == null) return;
        slot.player.removeListener(slot);
        slot.player.release();
        slots.remove(slot.token);
        if (current == slot) current = null;
        if (pending == slot) pending = null;
    }

    private void emitAnalysis(Slot slot) {
        PeakSafeAudioProcessor.AnalysisSnapshot data = slot.processor.getAnalysisSnapshot();
        try {
            JSONObject payload = new JSONObject();
            payload.put("token", slot.token);
            payload.put("event", "analysis");
            payload.put("loudness", data.loudness);
            payload.put("low", data.low);
            payload.put("mid", data.mid);
            payload.put("high", data.high);
            payload.put("bpm", data.bpm);
            emit(payload);
        } catch (Exception ignored) {
        }
    }

    private void emitState(Slot slot, String event, @Nullable String error) {
        try {
            JSONObject payload = slot.stateJson();
            payload.put("event", event);
            if (error != null) payload.put("error", error);
            emit(payload);
        } catch (Exception ignored) {
        }
    }

    private void emitError(String token, Exception error) {
        try {
            JSONObject payload = new JSONObject();
            payload.put("token", token);
            payload.put("event", "error");
            payload.put("error", error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage());
            emit(payload);
        } catch (Exception ignored) {
        }
    }

    private void emit(JSONObject payload) {
        MainActivity target = activity;
        if (target == null) return;
        String quoted = JSONObject.quote(payload.toString());
        target.evaluateJavascript(
                "window.__nativeAudioEvent&&window.__nativeAudioEvent(" + quoted + ")");
    }

    private boolean requestAudioFocus() {
        if (hasAudioFocus || audioManager == null) return true;
        int result;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
            result = audioManager.requestAudioFocus(audioFocusRequest);
        } else {
            result = audioManager.requestAudioFocus(
                    audioFocusChangeListener,
                    AudioManager.STREAM_MUSIC,
                    AudioManager.AUDIOFOCUS_GAIN);
        }
        hasAudioFocus = result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
        return hasAudioFocus;
    }

    private void handleAudioFocusChange(int change) {
        handler.post(() -> {
            if (change == AudioManager.AUDIOFOCUS_GAIN) {
                handler.removeCallbacks(reclaimAudioFocusRunnable);
                hasAudioFocus = true;
                focusMultiplier = 1f;
                updateSlotVolumes();
                if (resumeAfterFocusGain && current != null) current.player.play();
                if (resumeAfterFocusGain && pending != null && pending.mixFactor > 0f) {
                    pending.player.play();
                }
                resumeAfterFocusGain = false;
                return;
            }
            if (change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK) {
                focusMultiplier = keepAudioFocus ? 1f : 0.2f;
                updateSlotVolumes();
                return;
            }
            hasAudioFocus = false;
            if (keepAudioFocus) {
                // 后台保活：视频/录音类应用抢焦点时不暂停播放，
                // 稍后重新申请焦点，夺回媒体通知与锁屏控制权。
                focusMultiplier = 1f;
                resumeAfterFocusGain = false;
                scheduleAudioFocusReclaim();
                return;
            }
            resumeAfterFocusGain = change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT &&
                    ((current != null && current.player.isPlaying()) ||
                            (pending != null && pending.player.isPlaying()));
            if (current != null) current.player.pause();
            if (pending != null) pending.player.pause();
            if (change == AudioManager.AUDIOFOCUS_LOSS) {
                resumeAfterFocusGain = false;
            }
        });
    }

    private void scheduleAudioFocusReclaim() {
        handler.removeCallbacks(reclaimAudioFocusRunnable);
        handler.postDelayed(reclaimAudioFocusRunnable, 400);
    }

    private void reclaimAudioFocus() {
        if (released || !keepAudioFocus || hasAudioFocus) return;
        boolean playing = (current != null && current.player.isPlaying()) ||
                (pending != null && pending.player.isPlaying());
        if (!playing) return;
        requestAudioFocus();
        if (!hasAudioFocus) {
            handler.postDelayed(reclaimAudioFocusRunnable, 1200);
        }
    }

    private void updateSlotVolumes() {
        if (current != null) current.player.setVolume(current.targetVolume(masterVolume));
        if (pending != null) pending.player.setVolume(pending.targetVolume(masterVolume));
    }

    private void abandonAudioFocusIfIdle() {
        boolean playing = (current != null && current.player.isPlaying()) ||
                (pending != null && pending.player.isPlaying());
        if (!playing) abandonAudioFocus();
    }

    private void abandonAudioFocus() {
        if (!hasAudioFocus || audioManager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
            audioManager.abandonAudioFocusRequest(audioFocusRequest);
        } else {
            audioManager.abandonAudioFocus(audioFocusChangeListener);
        }
        hasAudioFocus = false;
    }

    private static float smoothStep(float edge0, float edge1, float value) {
        float t = Math.max(0f, Math.min(1f, (value - edge0) / (edge1 - edge0)));
        return t * t * (3f - 2f * t);
    }

    private final class Slot implements Player.Listener {
        final String token;
        final ExoPlayer player;
        final PeakSafeAudioProcessor processor;
        final JSONObject track;
        volatile String state = "loading";
        volatile boolean playing;
        volatile long positionMs;
        volatile long durationMs;
        volatile float mixFactor = 1f;
        volatile boolean suppressPauseEvent;
        @Nullable volatile Format audioFormat;

        Slot(String token, ExoPlayer player, PeakSafeAudioProcessor processor, JSONObject track) {
            this.token = token;
            this.player = player;
            this.processor = processor;
            this.track = track;
        }

        float targetVolume(float volume) {
            return Math.max(0f, Math.min(1f, volume * mixFactor * focusMultiplier));
        }

        JSONObject stateJson() {
            JSONObject json = new JSONObject();
            try {
                json.put("token", token);
                json.put("state", state);
                json.put("playing", playing);
                json.put("positionMs", positionMs);
                json.put("durationMs", durationMs);
                if (audioFormat != null) {
                    JSONObject format = new JSONObject();
                    if (audioFormat.sampleMimeType != null) {
                        format.put("sampleMimeType", audioFormat.sampleMimeType);
                    }
                    if (audioFormat.sampleRate != Format.NO_VALUE) {
                        format.put("sampleRate", audioFormat.sampleRate);
                    }
                    if (audioFormat.channelCount != Format.NO_VALUE) {
                        format.put("channelCount", audioFormat.channelCount);
                    }
                    if (audioFormat.bitrate != Format.NO_VALUE) {
                        format.put("bitrate", audioFormat.bitrate);
                    }
                    json.put("audioFormat", format);
                }
            } catch (Exception ignored) {
            }
            return json;
        }

        @Override
        public void onPlaybackStateChanged(int playbackState) {
            if (playbackState == Player.STATE_READY) {
                state = "loaded";
                durationMs = Math.max(0, player.getDuration());
                // 播放就绪后轨道已选定，此时可取到实际解码格式（容器静态元数据缺失时的兜底）。
                audioFormat = player.getAudioFormat();
                emitState(this, "load", null);
            } else if (playbackState == Player.STATE_ENDED) {
                state = "loaded";
                playing = false;
                emitState(this, "end", null);
            } else if (playbackState == Player.STATE_BUFFERING) {
                state = "loading";
            }
        }

        @Override
        public void onIsPlayingChanged(boolean isPlaying) {
            playing = isPlaying;
            if (!isPlaying && suppressPauseEvent) {
                suppressPauseEvent = false;
                return;
            }
            emitState(this, isPlaying ? "play" : "pause", null);
        }

        @Override
        public void onPlayerError(PlaybackException error) {
            state = "error";
            emitState(this, "error", error.getMessage());
        }
    }
}
