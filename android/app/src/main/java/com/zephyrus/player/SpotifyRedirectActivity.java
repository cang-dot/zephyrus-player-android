package com.zephyrus.player;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

/** 独立接收 Spotify 自定义 Scheme 回调，再交给单实例播放器。 */
public class SpotifyRedirectActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        forward(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        forward(intent);
    }

    private void forward(Intent intent) {
        if (intent == null || intent.getData() == null) {
            finish();
            return;
        }
        Log.i("SpotifyAuth", "Redirect receiver captured: " + intent.getData());
        Intent main = new Intent(this, MainActivity.class);
        main.setAction(Intent.ACTION_VIEW);
        main.setData(intent.getData());
        main.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(main);
        finish();
    }
}
