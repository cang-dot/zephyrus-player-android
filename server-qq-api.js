/**
 * server-qq-api.js — @yakult-green-tea/qq-music-api 网关包装（Folia 移植）。
 *
 * qq-music-api 是自带 listen() 的独立 HTTP 服务（koa），不是可挂载中间件；
 * 网关以子进程方式拉起（PORT 由本模块分配），Express 反代 /platform/qq/api/*。
 * 子进程隔离：崩溃只影响 QQ 新链（旧自建路由不受牵连），退出自动重启。
 *
 * 环境变量（透传给子进程）：
 *   QQ_SESSION_SECRET          sealed 登录态加密密钥（≥32 字节，必填，未配置则本路由返回 501）
 *   QQ_SESSION_SECRET_PREVIOUS 密钥轮换时临时验证旧令牌
 *   QQ_AUTH_STATE_PATH         设备标识文件（默认 .auth-state/qq-device.json）
 *   QQ_AUTH_SESSION_PATH       加密登录态文件（默认 .auth-state/qq-session.enc）
 *
 * Folia 文档参考：docs/qq-music-deployment.md（常驻 Node 形态=全通道扫码+自动续期）。
 */
const { spawn } = require('node:child_process');
const path = require('node:path');
const http = require('node:http');
const { Duplex } = require('node:stream');

const QQ_API_PREFIX = '/platform/qq/api';
/** 子进程内部监听端口：选一个不常用段，可被 QQ_API_PORT 覆盖 */
const CHILD_PORT = Number(process.env.QQ_API_PORT || 3210);

let child = null;
let childReady = false;

function startQqApiChild() {
  if (child) return;
  const entry = path.join(
    __dirname,
    'node_modules',
    '@yakult-green-tea',
    'qq-music-api',
    'dist',
    'src',
    'app.js'
  );
  child = spawn(process.execPath, [entry], {
    env: {
      ...process.env,
      PORT: String(CHILD_PORT),
      HOST: '127.0.0.1'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (buf) => {
    const text = String(buf);
    if (text.includes(`server running @`)) childReady = true;
    process.stdout.write(`[qq-api] ${text}`);
  });
  child.stderr.on('data', (buf) => process.stderr.write(`[qq-api] ${buf}`));
  child.on('exit', () => {
    child = null;
    childReady = false;
    // 崩溃自动重启（延迟 2s 防止快速循环）
    setTimeout(() => startQqApiChild(), 2000);
  });
}

function proxyToChild(req, res) {
  const options = {
    hostname: '127.0.0.1',
    port: CHILD_PORT,
    // Express 挂载 /platform/qq/api 后 req.url 已剥掉前缀（即子进程要的路径）
    path: req.url || '/',
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${CHILD_PORT}` }
  };
  const upstream = http.request(options, (upRes) => {
    res.writeHead(upRes.statusCode || 502, upRes.headers);
    upRes.pipe(res);
  });
  upstream.on('error', () => {
    if (!res.headersSent) {
      res.status(502).json({ code: 502, msg: 'qq-music-api 子进程不可用' });
    } else {
      res.end();
    }
  });
  req.pipe(upstream);
}

/**
 * 创建 /platform/qq/api 反代路由。
 * 未配置 QQ_SESSION_SECRET 时返回 501（对齐 qq-music-api 的语义），
 * 前端 channels 探测据此自动回退旧登录链。
 */
function createQqApiRouter() {
  const router = require('express').Router();
  router.use((req, res, next) => {
    if (!process.env.QQ_SESSION_SECRET) {
      res.status(501).json({
        code: 501,
        msg: 'QQ_SESSION_SECRET 未配置，qq-music-api 未启用'
      });
      return;
    }
    if (!child) startQqApiChild();
    // 子进程未就绪时先等一拍（首次请求冷启动）
    if (!childReady && !res.headersSent) {
      const started = Date.now();
      const waitReady = () => {
        if (childReady || Date.now() - started > 8000) {
          proxyToChild(req, res);
        } else {
          setTimeout(waitReady, 200);
        }
      };
      waitReady();
      return;
    }
    proxyToChild(req, res);
  });
  return router;
}

module.exports = { createQqApiRouter, QQ_API_PREFIX, startQqApiChild, CHILD_PORT };
