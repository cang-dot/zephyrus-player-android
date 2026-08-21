import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const {
  createPlatformGatewayApp,
  parseKugouSongLabel,
  parsePtuiCallback,
  normalizeKugouPlaylists,
  normalizeKugouSongs,
  normalizeKugouUserInfo,
  extractQQOAuthCode,
  parseWechatQrPoll,
  createWechatLoginPayload,
  createQQLoginFromCookie,
  decodeQqLyricField,
  decodeKugouKrc
} = require('../server-platform-login.js');
const { encryptQrc } = require('qrc-decoder');

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

  if (
    locationCode !== 'location-code' ||
    bodyCode !== 'body-code' ||
    encodedCode !== 'encoded-code'
  ) {
    throw new Error(
      `QQ OAuth code parsing failed: ${JSON.stringify({ locationCode, bodyCode, encodedCode })}`
    );
  }

  return { locationCode, bodyCode, encodedCode };
}

function verifyWechatPollParsing() {
  const waiting = parseWechatQrPoll('window.wx_errcode=408;');
  const scanned = parseWechatQrPoll('window.wx_errcode=404;');
  const confirmed = parseWechatQrPoll("window.wx_errcode=405;window.wx_code='wechat-code';");
  const expired = parseWechatQrPoll('window.wx_errcode=403;');
  if (
    waiting.status !== 'waiting' ||
    scanned.status !== 'scanned' ||
    confirmed.status !== 'confirmed' ||
    confirmed.code !== 'wechat-code' ||
    expired.status !== 'expired'
  ) {
    throw new Error('WeChat QR poll parsing failed');
  }
  return { waiting: waiting.status, scanned: scanned.status, confirmed: confirmed.status };
}

function verifyWechatLoginPayload() {
  const payload = createWechatLoginPayload('wechat-code');
  const request = payload['music.login.LoginServer.Login'];
  if (
    payload.comm?.tmeLoginType !== 1 ||
    request?.module !== 'music.login.LoginServer' ||
    request?.method !== 'Login' ||
    request?.param?.code !== 'wechat-code' ||
    request?.param?.strAppid !== 'wx48db31d50e334801' ||
    Object.hasOwn(payload, 'req')
  ) {
    throw new Error(`WeChat login payload failed: ${JSON.stringify(payload)}`);
  }
  return { requestKey: 'music.login.LoginServer.Login', loginType: payload.comm.tmeLoginType };
}

function verifyWechatCredentialNormalization() {
  const result = createQQLoginFromCookie('', {
    str_musicid: '123456',
    musickey: 'W_X_test-key',
    nick: '微信用户'
  });
  if (
    result?.userInfo?.userId !== '123456' ||
    result?.userInfo?.nickname !== '微信用户' ||
    !result.cookie.includes('uin=123456') ||
    !result.cookie.includes('qm_keyst=W_X_test-key')
  ) {
    throw new Error(`WeChat credential normalization failed: ${JSON.stringify(result)}`);
  }
  return { userId: result.userInfo.userId, cookieFields: result.cookie.split(';').length };
}

function verifyQqLyricDecoding() {
  const plaintext = '[0,1000](0,400)synthetic (400,600)lyrics';
  const encrypted = encryptQrc(plaintext);
  const decoded = decodeQqLyricField(encrypted, true);
  if (decoded !== plaintext) throw new Error('QQ QRC decryption failed');
  return { encryptedLength: encrypted.length, decodedLength: decoded.length };
}

function verifyKugouLyricDecoding() {
  const plaintext = '[1000,500]<0,500,0>synthetic';
  const xorKey = Buffer.from([
    0x40, 0x47, 0x61, 0x77, 0x5e, 0x32, 0x74, 0x47, 0x51, 0x36, 0x31, 0x2d, 0xce, 0xd2, 0x6e, 0x69
  ]);
  const compressed = deflateSync(Buffer.from(plaintext));
  const encrypted = Buffer.alloc(compressed.length);
  for (let index = 0; index < compressed.length; index += 1) {
    encrypted[index] = compressed[index] ^ xorKey[index % xorKey.length];
  }
  const encoded = Buffer.concat([Buffer.from('krc1'), encrypted]).toString('base64');
  const decoded = decodeKugouKrc(encoded);
  if (decoded !== plaintext) throw new Error('Kugou KRC decryption failed');
  return { encodedLength: encoded.length, decodedLength: decoded.length };
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

async function verifyPlatform(platform, provider) {
  const providerQuery = provider ? `&provider=${encodeURIComponent(provider)}` : '';
  const created = await readJson(
    `/platform/${platform}/qr/create?noCache=${Date.now()}${providerQuery}`
  );
  if (!created.key || !created.qrUrl) {
    throw new Error(`${platform} create response is incomplete`);
  }
  if (provider && created.provider !== provider) {
    throw new Error(
      `${platform} returned provider ${created.provider || 'missing'}, expected ${provider}`
    );
  }
  if (provider === 'wechat' && !created.qrUrl.startsWith('data:image/')) {
    throw new Error('WeChat QR endpoint did not return image data');
  }

  const polled = await readJson(
    `/platform/${platform}/qr/poll?key=${encodeURIComponent(created.key)}&noCache=${Date.now()}${providerQuery}`
  );
  if (!['waiting', 'scanned', 'expired'].includes(polled.status)) {
    throw new Error(`${platform} returned unexpected initial status: ${polled.status}`);
  }

  let sharedSession = undefined;
  if (platform === 'qq' && provider !== 'wechat') {
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
  } else if (provider === 'wechat') {
    const modulePath = resolve('server-platform-login.js');
    const verification = spawnSync(
      process.execPath,
      [
        '-e',
        "const gateway = require(process.argv[1]); const key = process.argv[2]; const session = gateway.readQqSession(key); if (session?.provider !== 'wechat' || !session?.uuid) process.exit(1); gateway.deleteQqSession(key);",
        modulePath,
        created.key
      ],
      { encoding: 'utf8', timeout: 10000 }
    );
    if (verification.status !== 0) {
      throw new Error(`WeChat shared session verification failed: ${verification.stderr.trim()}`);
    }
    sharedSession = true;
  }

  return {
    platform,
    ...(provider ? { provider } : {}),
    keyLength: created.key.length,
    qrBytes: Math.floor((created.qrUrl.split(',')[1]?.length || 0) * 0.75),
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

async function verifyQqLyricGuards() {
  let lastResponse;
  for (let index = 0; index <= 30; index++) {
    lastResponse = await readResponse('/platform/qq/lyric?mid=%2A%2A%2A');
  }
  if (lastResponse.status !== 429 || lastResponse.body.code !== 429) {
    throw new Error(`QQ lyric rate limit failed: ${JSON.stringify(lastResponse)}`);
  }
  return lastResponse.status;
}

try {
  const health = await readJson('/platform/health');
  if (!health.platforms.includes('spotify')) {
    throw new Error(`Spotify is missing from gateway health: ${JSON.stringify(health)}`);
  }
  const qqCallback = verifyQqCallbackParsing();
  const qqOAuthCode = verifyQqOAuthCodeParsing();
  const wechatPoll = verifyWechatPollParsing();
  const wechatLoginPayload = verifyWechatLoginPayload();
  const wechatCredential = verifyWechatCredentialNormalization();
  const qqLyricDecode = verifyQqLyricDecoding();
  const kugouLyricDecode = verifyKugouLyricDecoding();
  const qq = await verifyPlatform('qq');
  const wechat = await verifyPlatform('qq', 'wechat');
  const kugou = await verifyPlatform('kugou');
  const normalization = verifyKugouNormalization();
  const invalidKugouStatus = await verifyInvalidKugouAccount();
  const invalidKugouPlaylistStatus = await verifyInvalidKugouPlaylist();
  const spotifyRoute = await verifySpotifyRoute();
  const qqLyricRateLimit = await verifyQqLyricGuards();
  console.log(
    JSON.stringify(
      {
        health,
        qq,
        qqCallback,
        qqOAuthCode,
        wechatPoll,
        wechatLoginPayload,
        wechatCredential,
        wechat,
        qqLyricDecode,
        kugouLyricDecode,
        kugou,
        normalization,
        invalidKugouStatus,
        invalidKugouPlaylistStatus,
        spotifyRoute,
        qqLyricRateLimit
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
