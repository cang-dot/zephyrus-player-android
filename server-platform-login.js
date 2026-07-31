/**
 * 多平台扫码登录中转 API
 *
 * 挂载在 /platform/ 路径下：
 * - GET /platform/qq/qr/create    — 创建 QQ 音乐登录二维码
 * - GET /platform/qq/qr/poll      — 轮询 QQ 音乐扫码状态
 * - GET /platform/kugou/qr/create — 创建酷狗音乐登录二维码（新 API，带 Web 签名）
 * - GET /platform/kugou/qr/poll   — 轮询酷狗音乐扫码状态
 * - GET /platform/qr-display      — 动态二维码展示页（供其他设备打开扫码）
 *
 * 作用：作为移动端（Capacitor）和 QQ/酷狗官方 API 之间的中转，
 * 解决移动端直接调用时可能遇到的 CORS / Set-Cookie 读取问题。
 *
 * QQ 轮询需要携带 qrsig Cookie，否则返回 403。
 */

const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const cors = require('cors');

const router = express.Router();

// ==================== 工具函数 ====================

function md5(str) {
  return crypto.createHash('md5').update(str, 'utf8').digest('hex');
}

function generateMid() {
  return crypto.randomBytes(16).toString('hex');
}

function generateDfid() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function cookiePartsFromString(cookie) {
  return String(cookie || '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.includes('='));
}

function setCookiesFromHeader(cookies) {
  return (cookies || []).map((cookie) => cookie.split(';')[0]);
}

function mergeCookieParts(...cookieSources) {
  const cookies = new Map();

  for (const source of cookieSources) {
    for (const part of cookiePartsFromString(source)) {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex > 0) {
        cookies.set(part.slice(0, separatorIndex), part);
      }
    }
  }

  return Array.from(cookies.values()).join('; ');
}

// ==================== QQ 会话存储（qrsig -> cookies） ====================

// 存储创建二维码时的完整 Cookie，轮询时需要带上
const qqSessionStore = new Map();

// 定期清理过期会话（每 5 分钟）
const sessionCleanupTimer = setInterval(
  () => {
    const now = Date.now();
    for (const [key, val] of qqSessionStore) {
      if (now - val.createdAt > 5 * 60 * 1000) {
        qqSessionStore.delete(key);
      }
    }
  },
  5 * 60 * 1000
);
sessionCleanupTimer.unref?.();

router.get('/health', (_req, res) => {
  res.json({
    code: 200,
    data: {
      service: 'zephyrus-music-gateway',
      platforms: ['qq', 'kugou']
    }
  });
});

// ==================== QQ 音乐扫码登录 ====================

const QQ_APPID = '716027609';
const QQ_DAID = '384';
const QQ_REDIRECT = 'https://y.qq.com/portal';

function hash33(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h += (h << 5) + s.charCodeAt(i);
  }
  return h & 0x7fffffff;
}

// GET /platform/qq/qr/create
router.get('/qq/qr/create', async (req, res) => {
  try {
    const t = Math.random().toString(36).substring(2, 10);
    const url = `https://ssl.ptlogin2.qq.com/ptqrshow?appid=${QQ_APPID}&e=2&l=M&s=3&d=72&v=4&t=${t}&daid=${QQ_DAID}&pt_3rd_aid=0`;

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://y.qq.com/'
      },
      maxRedirects: 0,
      validateStatus: () => true
    });

    const setCookies = response.headers['set-cookie'] || [];
    let qrsig = '';

    for (const cookie of setCookies) {
      const match = cookie.match(/qrsig=([^;]+)/);
      if (match) {
        qrsig = match[1];
      }
    }

    if (!qrsig) {
      return res.json({ code: 500, msg: 'QQ 二维码创建失败: 未获取到 qrsig' });
    }

    // 存储 Cookie 供轮询使用
    qqSessionStore.set(qrsig, {
      cookie: setCookiesFromHeader(setCookies).join('; '),
      createdAt: Date.now()
    });

    const base64 = Buffer.from(response.data).toString('base64');

    res.json({
      code: 200,
      data: {
        qrUrl: `data:image/png;base64,${base64}`,
        key: qrsig,
        expiredAt: Date.now() + 2 * 60 * 1000
      }
    });
  } catch (error) {
    console.error('[platformLogin] QQ QR create error:', error.message);
    res.json({ code: 500, msg: `QQ 二维码创建失败: ${error.message}` });
  }
});

// GET /platform/qq/qr/poll?key=xxx
router.get('/qq/qr/poll', async (req, res) => {
  try {
    const qrsig = req.query.key;
    if (!qrsig) {
      return res.json({ code: 400, msg: '缺少 key (qrsig) 参数' });
    }

    // 从会话存储中获取 Cookie
    const session = qqSessionStore.get(qrsig);
    const cookieStr = session ? session.cookie : `qrsig=${qrsig}`;

    const ptqrtoken = hash33(qrsig);
    const time = Date.now();
    const url =
      `https://ssl.ptlogin2.qq.com/ptqrlogin?u1=${encodeURIComponent(QQ_REDIRECT)}` +
      `&ptqrtoken=${ptqrtoken}&ptredirect=0&h=1&t=1&g=1&from_ui=1&ptlang=2052` +
      `&action=0-0-${time}&js_ver=10275&js_type=1&login_sig=` +
      `&pt_uistyle=40&aid=${QQ_APPID}&daid=${QQ_DAID}&pt_3rd_aid=0`;

    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://y.qq.com/',
        Cookie: cookieStr
      },
      maxRedirects: 0,
      validateStatus: () => true
    });

    // 处理 403 错误
    if (response.status === 403) {
      return res.json({
        code: 200,
        data: { status: 'error', message: 'QQ 服务器拒绝访问 (403)，请刷新二维码重试' }
      });
    }

    const responseCookie = setCookiesFromHeader(response.headers['set-cookie']).join('; ');
    const mergedSessionCookie = mergeCookieParts(cookieStr, responseCookie);
    if (session) {
      qqSessionStore.set(qrsig, {
        cookie: mergedSessionCookie,
        createdAt: session.createdAt
      });
    }

    const text = typeof response.data === 'string' ? response.data : String(response.data);

    // 更灵活的正则：ptuiCB('code', 'status', 'redirectUrl', 'something', 'message', 'something')
    const match = text.match(
      /ptuiCB\('(\d+)',\s*'[^']*',\s*'([^']*)',\s*'[^']*',\s*'([^']*)',\s*'[^']*'\)/
    );
    if (!match) {
      return res.json({
        code: 500,
        msg: `QQ 登录状态解析失败: ${text.substring(0, 100)}`,
        data: { status: 'error' }
      });
    }

    const [, codeStr, redirectUrl] = match;
    const code = parseInt(codeStr, 10);

    // 66 = 等待扫码, 67 = 已扫码等待确认, 65 = 过期, 0 = 登录成功
    // 其他码（如 23013）可能是安全验证，统一当作 waiting 处理
    if (code === 66 || code > 1000) {
      return res.json({ code: 200, data: { status: 'waiting', message: '等待扫码' } });
    }
    if (code === 67) {
      return res.json({
        code: 200,
        data: { status: 'scanned', message: '已扫码，请在手机上确认登录' }
      });
    }
    if (code === 65) {
      // 清理会话
      qqSessionStore.delete(qrsig);
      return res.json({ code: 200, data: { status: 'expired', message: '二维码已过期' } });
    }

    // 0 = 登录成功
    if (code === 0 && redirectUrl) {
      try {
        const cookieResponse = await axios.get(redirectUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Referer: 'https://y.qq.com/',
            Cookie: mergedSessionCookie
          },
          maxRedirects: 0,
          validateStatus: () => true
        });

        const setCookies = cookieResponse.headers['set-cookie'] || [];
        const resultCookieStr = mergeCookieParts(
          mergedSessionCookie,
          setCookiesFromHeader(setCookies).join('; ')
        );
        const uin = resultCookieStr.match(/(?:^|;\s*)uin=([^;]+)/)?.[1] || '';

        // 清理会话
        qqSessionStore.delete(qrsig);

        return res.json({
          code: 200,
          data: {
            status: 'success',
            message: 'QQ 音乐登录成功',
            cookie: resultCookieStr,
            userInfo: {
              userId: uin,
              nickname: 'QQ音乐用户'
            }
          }
        });
      } catch (error) {
        return res.json({
          code: 500,
          data: { status: 'error', message: `获取 Cookie 失败: ${error.message}` }
        });
      }
    }

    return res.json({ code: 500, data: { status: 'error', message: `未知状态: ${code}` } });
  } catch (error) {
    console.error('[platformLogin] QQ QR poll error:', error.message);
    res.json({ code: 500, msg: `QQ 轮询失败: ${error.message}` });
  }
});

// ==================== 酷狗音乐扫码登录（新 API，带 Web 签名） ====================

const KUGOU_WEB_SALT = 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt';
const KUGOU_SRC_APPID = 2919;
const KUGOU_APPID = 3116;
const KUGOU_CLIENTVER = 11436;

let kugouMid = generateMid();
let kugouDfid = generateDfid();

function kugouWebSign(params) {
  const sortedKeys = Object.keys(params).sort();
  let paramsStr = '';
  for (const key of sortedKeys) {
    let val = params[key];
    if (val === null || val === undefined) val = '';
    if (val === true) val = '1';
    if (val === false) val = '0';
    paramsStr += `${key}=${val}`;
  }
  return md5(`${KUGOU_WEB_SALT}${paramsStr}${KUGOU_WEB_SALT}`);
}

function buildKugouDefaultParams() {
  return {
    dfid: kugouDfid,
    mid: kugouMid,
    uuid: '-',
    appid: KUGOU_APPID,
    clientver: KUGOU_CLIENTVER,
    clienttime: Math.floor(Date.now() / 1000),
    userid: 0,
    token: ''
  };
}

// GET /platform/kugou/qr/create
router.get('/kugou/qr/create', async (req, res) => {
  try {
    const defaultParams = buildKugouDefaultParams();
    const params = {
      ...defaultParams,
      appid: 1001,
      type: 1,
      plat: 4,
      qrcode_txt: `https://h5.kugou.com/apps/loginQRCode/html/index.html?appid=${KUGOU_APPID}&`,
      srcappid: KUGOU_SRC_APPID
    };

    params.signature = kugouWebSign(params);

    const url = 'https://login-user.kugou.com/v2/qrcode';
    const response = await axios.get(url, {
      params,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Referer: 'https://www.kugou.com/'
      }
    });

    const json = response.data;

    if (json.status !== 1 || !json.data) {
      return res.json({
        code: 500,
        msg: `酷狗二维码创建失败: ${json.error_msg || JSON.stringify(json)}`
      });
    }

    const qrUrl = `https://h5.kugou.com/apps/loginQRCode/html/index.html?qrcode=${json.data.qrcode}`;

    res.json({
      code: 200,
      data: {
        qrUrl,
        key: json.data.qrcode,
        expiredAt: Date.now() + 5 * 60 * 1000
      }
    });
  } catch (error) {
    console.error('[platformLogin] Kugou QR create error:', error.message);
    res.json({ code: 500, msg: `酷狗二维码创建失败: ${error.message}` });
  }
});

// GET /platform/kugou/qr/poll?key=xxx
router.get('/kugou/qr/poll', async (req, res) => {
  try {
    const key = req.query.key;
    if (!key) {
      return res.json({ code: 400, msg: '缺少 key 参数' });
    }

    const defaultParams = buildKugouDefaultParams();
    const params = {
      ...defaultParams,
      plat: 4,
      srcappid: KUGOU_SRC_APPID,
      qrcode: key
    };

    params.signature = kugouWebSign(params);

    const url = 'https://login-user.kugou.com/v2/get_userinfo_qrcode';
    const response = await axios.get(url, {
      params,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Referer: 'https://www.kugou.com/'
      }
    });

    const json = response.data;

    if (json.status !== 1) {
      return res.json({
        code: 500,
        msg: json.error_msg || `酷狗登录状态查询失败 (error_code: ${json.error_code})`
      });
    }

    const data = json.data;
    const status = data?.status;

    if (status === 1) {
      return res.json({ code: 200, data: { status: 'waiting', message: '等待扫码' } });
    }
    if (status === 2) {
      return res.json({
        code: 200,
        data: { status: 'scanned', message: '已扫码，请在手机上确认登录' }
      });
    }
    if (status === 0) {
      return res.json({ code: 200, data: { status: 'expired', message: '二维码已过期' } });
    }

    if (status === 4) {
      const userid = String(data.userid || '');
      const token = data.token || '';
      const cookieStr = `userid=${userid}; token=${token};`;

      return res.json({
        code: 200,
        data: {
          status: 'success',
          message: '酷狗音乐登录成功',
          cookie: cookieStr,
          userInfo: {
            userId: userid,
            nickname: data.nickname || '酷狗用户',
            avatarUrl: data.head_icon || ''
          }
        }
      });
    }

    return res.json({ code: 500, data: { status: 'error', message: `未知状态: ${status}` } });
  } catch (error) {
    console.error('[platformLogin] Kugou QR poll error:', error.message);
    res.json({ code: 500, msg: `酷狗轮询失败: ${error.message}` });
  }
});

// ==================== 动态二维码展示页 ====================

// GET /platform/qr-display?platform=qq|kugou
// 供用户在其他设备（电脑/另一台手机）打开，显示二维码供手机扫码
router.get('/qr-display', (req, res) => {
  const platform = req.query.platform === 'kugou' ? 'kugou' : 'qq';
  const platformName = platform === 'qq' ? 'QQ 音乐' : '酷狗音乐';
  const appName = platform === 'qq' ? 'QQ' : '酷狗';

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${platformName} 扫码登录</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #333;
    }
    .container {
      background: #fff;
      border-radius: 24px;
      padding: 40px 32px;
      text-align: center;
      max-width: 380px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    h1 {
      font-size: 22px;
      margin-bottom: 8px;
      color: #1a1a2e;
    }
    .subtitle {
      font-size: 14px;
      color: #666;
      margin-bottom: 24px;
    }
    .qr-box {
      width: 240px;
      height: 240px;
      margin: 0 auto 20px;
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      position: relative;
    }
    .qr-box img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .qr-box.loading::after {
      content: '加载中...';
      position: absolute;
      color: #999;
      font-size: 14px;
    }
    .status {
      font-size: 15px;
      color: #1a1a2e;
      margin-bottom: 12px;
      font-weight: 500;
    }
    .status.scanned { color: #07c160; }
    .status.success { color: #07c160; }
    .status.expired { color: #ff6b35; }
    .status.error { color: #e74c3c; }
    .refresh-btn {
      background: #1a1a2e;
      color: #fff;
      border: none;
      padding: 10px 28px;
      border-radius: 24px;
      font-size: 14px;
      cursor: pointer;
      margin-top: 8px;
      transition: opacity 0.2s;
    }
    .refresh-btn:hover { opacity: 0.85; }
    .hint {
      font-size: 12px;
      color: #999;
      margin-top: 16px;
      line-height: 1.6;
    }
    .success-icon {
      font-size: 48px;
      color: #07c160;
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${platformName} 扫码登录</h1>
    <p class="subtitle">请使用 ${appName} APP 扫描下方二维码</p>
    <div class="qr-box loading" id="qrBox"></div>
    <div class="status" id="status">正在获取二维码...</div>
    <button class="refresh-btn" id="refreshBtn" style="display:none" onclick="loadQr()">刷新二维码</button>
    <p class="hint">提示：请使用 ${appName} APP 的「扫一扫」功能<br>扫描上方二维码完成登录</p>
  </div>

  <script>
    let pollTimer = null;
    let currentKey = '';

    async function loadQr() {
      const qrBox = document.getElementById('qrBox');
      const statusEl = document.getElementById('status');
      const refreshBtn = document.getElementById('refreshBtn');

      qrBox.className = 'qr-box loading';
      qrBox.innerHTML = '';
      statusEl.className = 'status';
      statusEl.textContent = '正在获取二维码...';
      refreshBtn.style.display = 'none';

      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }

      try {
        const resp = await fetch('/platform/${platform}/qr/create?noCache=' + Date.now());
        const json = await resp.json();

        if (json.code !== 200 || !json.data) {
          statusEl.className = 'status error';
          statusEl.textContent = json.msg || '获取二维码失败';
          refreshBtn.style.display = 'inline-block';
          return;
        }

        currentKey = json.data.key;

        // 如果是图片 base64 直接显示，否则用 qrcode.js 生成
        if (json.data.qrUrl.startsWith('data:image/')) {
          qrBox.className = 'qr-box';
          qrBox.innerHTML = '<img src="' + json.data.qrUrl + '" />';
        } else {
          // 动态加载 qrcode 库
          if (!window.QRCode) {
            await new Promise((resolve, reject) => {
              const s = document.createElement('script');
              s.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js';
              s.onload = resolve;
              s.onerror = reject;
              document.head.appendChild(s);
            });
          }
          qrBox.className = 'qr-box';
          const canvas = document.createElement('canvas');
          await QRCode.toCanvas(canvas, json.data.qrUrl, { width: 240, margin: 1 });
          qrBox.innerHTML = '';
          qrBox.appendChild(canvas);
        }

        statusEl.textContent = '请使用 ${appName} APP 扫码';
        startPoll();
      } catch (err) {
        statusEl.className = 'status error';
        statusEl.textContent = '网络错误: ' + err.message;
        refreshBtn.style.display = 'inline-block';
      }
    }

    function startPoll() {
      pollTimer = setInterval(async () => {
        if (!currentKey) return;
        try {
          const resp = await fetch('/platform/${platform}/qr/poll?key=' + encodeURIComponent(currentKey));
          const json = await resp.json();

          if (json.code !== 200 || !json.data) {
            return;
          }

          const statusEl = document.getElementById('status');
          const data = json.data;

          switch (data.status) {
            case 'waiting':
              statusEl.className = 'status';
              statusEl.textContent = '请使用 ${appName} APP 扫码';
              break;
            case 'scanned':
              statusEl.className = 'status scanned';
              statusEl.textContent = '已扫码，请在手机上确认登录';
              break;
            case 'expired':
              statusEl.className = 'status expired';
              statusEl.textContent = '二维码已过期';
              document.getElementById('refreshBtn').style.display = 'inline-block';
              if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
              break;
            case 'success':
              statusEl.className = 'status success';
              statusEl.innerHTML = '<div class="success-icon">✓</div>${platformName} 登录成功！<br><small style="color:#999">请返回 APP 查看</small>';
              if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
              break;
            case 'error':
              statusEl.className = 'status error';
              statusEl.textContent = data.message || '登录失败';
              document.getElementById('refreshBtn').style.display = 'inline-block';
              if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
              break;
          }
        } catch (err) {
          // 轮询失败时静默重试
        }
      }, 3000);
    }

    loadQr();
  </script>
</body>
</html>`;

  res.type('text/html').send(html);
});

module.exports = router;

function createPlatformGatewayApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  app.use('/platform', router);
  app.use((_req, res) => {
    res.status(404).json({ code: 404, msg: 'Gateway route not found' });
  });
  return app;
}

module.exports.createPlatformGatewayApp = createPlatformGatewayApp;

if (require.main === module) {
  const port = Number(process.env.PORT || process.env.ZEPHYRUS_GATEWAY_PORT || 3050);
  const host = process.env.HOST || '127.0.0.1';
  createPlatformGatewayApp().listen(port, host, () => {
    console.log(`[music-gateway] listening on http://${host}:${port}`);
  });
}
