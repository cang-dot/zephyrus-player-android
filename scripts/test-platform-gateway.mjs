import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const {
  createPlatformGatewayApp,
  parseKugouSongLabel,
  parsePtuiCallback,
  normalizeKugouPlaylists,
  normalizeKugouSongs,
  normalizeKugouUserInfo,
  extractQQOAuthCode
} = require('../server-platform-login.js');

function verifyQqCallbackParsing() {
  const redirectUrl =
    'https://ssl.ptlogin2.graph.qq.com/check_sig?pttype=1&uin=10001&service=ptqrlogin';
  const fiveArguments = parsePtuiCallback(`ptuiCB('0','0','${redirectUrl}','0','登录成功！');`);
  const escapedNickname = parsePtuiCallback(
    `ptuiCB('0', '0', '${redirectUrl}', '0', '登录成功！', 'O\\'Brien');`
  );
  const waiting = parsePtuiCallback("ptuiCB('66','0','','0','二维码未失效。','');");

  if (
    fiveArguments?.code !== 0 ||
    fiveArguments.redirectUrl !== redirectUrl ||
    escapedNickname?.code !== 0 ||
    waiting?.code !== 66 ||
    parsePtuiCallback('invalid') !== null
  ) {
    throw new Error('QQ callback parsing failed');
  }

  return { successCode: fiveArguments.code, waitingCode: waiting.code };
}

function verifyQqOAuthCodeParsing() {
  const locationCode = extractQQOAuthCode({
    headers: { location: 'https://y.qq.com/portal/wx_redirect.html?code=location-code' }
  });
  const bodyCode = extractQQOAuthCode({
    data: '<script>window.location.href="https://y.qq.com/?auth_code=body-code";</script>'
  });
  const encodedCode = extractQQOAuthCode({
    data: encodeURIComponent('https://y.qq.com/?code=encoded-code')
  });

  if (locationCode !== 'location-code' || bodyCode !== 'body-code' || encodedCode !== 'encoded-code') {
    throw new Error(
      `QQ OAuth code parsing failed: ${JSON.stringify({ locationCode, bodyCode, encodedCode })}`
    );
  }

  return { locationCode, bodyCode, encodedCode };
}

const app = createPlatformGatewayApp();
const server = await new Promise((resolve) => {
  const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
});

const address = server.address();
const baseURL = `http://127.0.0.1:${address.port}`;

async function readJson(path) {
  const response = await fetch(`${baseURL}${path}`, {
    signal: AbortSignal.timeout(20000)
  });
  const body = await response.json();
  if (!response.ok || body.code !== 200) {
    throw new Error(`${path} failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return body.data;
}

async function readResponse(path, options = {}) {
  const response = await fetch(`${baseURL}${path}`, {
    ...options,
    signal: AbortSignal.timeout(20000)
  });
  return { status: response.status, body: await response.json() };
}

async function verifyPlatform(platform) {
  const created = await readJson(`/platform/${platform}/qr/create?noCache=${Date.now()}`);
  if (!created.key || !created.qrUrl) {
    throw new Error(`${platform} create response is incomplete`);
  }

  const polled = await readJson(
    `/platform/${platform}/qr/poll?key=${encodeURIComponent(created.key)}&noCache=${Date.now()}`
  );
  if (!['waiting', 'scanned', 'expired'].includes(polled.status)) {
    throw new Error(`${platform} returned unexpected initial status: ${polled.status}`);
  }

  let sharedSession = undefined;
  if (platform === 'qq') {
    const modulePath = resolve('server-platform-login.js');
    const verification = spawnSync(
      process.execPath,
      [
        '-e',
        "const gateway = require(process.argv[1]); const key = process.argv[2]; const session = gateway.readQqSession(key); if (!session?.cookie.includes('qrsig=')) process.exit(1); gateway.deleteQqSession(key);",
        modulePath,
        created.key
      ],
      { encoding: 'utf8', timeout: 10000 }
    );
    if (verification.status !== 0) {
      throw new Error(`QQ shared session verification failed: ${verification.stderr.trim()}`);
    }
    sharedSession = true;
  }

  return {
    platform,
    keyLength: created.key.length,
    status: polled.status,
    ...(sharedSession ? { sharedSession } : {})
  };
}

function verifyKugouNormalization() {
  const parsedLabel = parseKugouSongLabel('歌手甲、歌手乙 - 示例歌名.mp3');
  if (parsedLabel.name !== '示例歌名' || parsedLabel.artistNames.join(',') !== '歌手甲,歌手乙') {
    throw new Error(`Kugou filename parsing failed: ${JSON.stringify(parsedLabel)}`);
  }

  const normalized = normalizeKugouPlaylists(
    {
      status: 1,
      data: {
        info: [
          {
            listid: '1001',
            listname: '我的歌单',
            pic: 'http://imge.kugou.com/stdmusic/{size}/cover.jpg',
            count: 12,
            userid: '42'
          },
          {
            global_collection_id: '2002',
            name: '收藏歌单',
            collect_type: 1,
            playcount: 88
          }
        ]
      }
    },
    '42'
  );
  if (normalized.playlists.length !== 1 || normalized.favorites.length !== 1) {
    throw new Error(`Kugou playlist normalization failed: ${JSON.stringify(normalized)}`);
  }
  if (!normalized.playlists[0].coverImgUrl.includes('/400/')) {
    throw new Error('Kugou cover placeholder was not normalized');
  }

  const userInfo = normalizeKugouUserInfo(
    { data: { user: { nick_name: '测试用户', head_url: '//example.com/avatar.jpg' } } },
    'userid=42; token=test',
    {}
  );
  if (userInfo.nickname !== '测试用户' || userInfo.avatarUrl !== 'https://example.com/avatar.jpg') {
    throw new Error(`Kugou user normalization failed: ${JSON.stringify(userInfo)}`);
  }

  const songs = normalizeKugouSongs(
    {
      data: {
        files: [
          {
            hash: 'ABC123',
            songname: '测试歌曲',
            singername: '歌手 A,歌手 B',
            album_name: '测试专辑',
            timelen: 215000,
            album_img: 'https://example.com/{size}/cover.jpg'
          },
          {
            hash: 'FILENAME123',
            filename: '文件歌手 - 文件歌曲.mp3'
          }
        ]
      }
    },
    { id: '1001' }
  );
  if (
    songs.length !== 2 ||
    songs[0].id !== 'kugou:ABC123' ||
    songs[0].platformId !== 'ABC123' ||
    songs[0].ar.length !== 2 ||
    !songs[0].picUrl.includes('/400/') ||
    songs[1].name !== '文件歌曲' ||
    songs[1].ar[0]?.name !== '文件歌手'
  ) {
    throw new Error(`Kugou song normalization failed: ${JSON.stringify(songs)}`);
  }

  return {
    playlists: normalized.playlists.length,
    favorites: normalized.favorites.length,
    songs: songs.length
  };
}

async function verifyInvalidKugouAccount() {
  const response = await readResponse('/platform/kugou/account/data', {
    headers: {
      'X-Platform-Cookie': 'userid=1; token=invalid; dfid=-; KUGOU_API_MID=test'
    }
  });
  if (response.body.code === 200 || ![401, 502].includes(response.status)) {
    throw new Error(`Invalid Kugou account was accepted: ${JSON.stringify(response)}`);
  }
  return response.status;
}

async function verifyInvalidKugouPlaylist() {
  const response = await readResponse('/platform/kugou/playlist/tracks?id=1001', {
    headers: {
      'X-Platform-Cookie': 'userid=1; token=invalid; dfid=-; KUGOU_API_MID=test'
    }
  });
  if (response.body.code === 200 || ![401, 502].includes(response.status)) {
    throw new Error(`Invalid Kugou playlist was accepted: ${JSON.stringify(response)}`);
  }
  return response.status;
}

async function verifySpotifyRoute() {
  const response = await readResponse('/platform/spotify/search?keyword=');
  if (response.status !== 200 || response.body.code !== 200) {
    throw new Error(`Spotify route is unavailable: ${JSON.stringify(response)}`);
  }
  return response.status;
}

try {
  const health = await readJson('/platform/health');
  if (!health.platforms.includes('spotify')) {
    throw new Error(`Spotify is missing from gateway health: ${JSON.stringify(health)}`);
  }
  const qqCallback = verifyQqCallbackParsing();
  const qqOAuthCode = verifyQqOAuthCodeParsing();
  const qq = await verifyPlatform('qq');
  const kugou = await verifyPlatform('kugou');
  const normalization = verifyKugouNormalization();
  const invalidKugouStatus = await verifyInvalidKugouAccount();
  const invalidKugouPlaylistStatus = await verifyInvalidKugouPlaylist();
  const spotifyRoute = await verifySpotifyRoute();
  console.log(
    JSON.stringify(
      {
        health,
        qq,
        qqCallback,
        qqOAuthCode,
        kugou,
        normalization,
        invalidKugouStatus,
        invalidKugouPlaylistStatus,
        spotifyRoute
      },
      null,
      2
    )
  );
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
