/**
 * server-kugou-api.js — KuGouMusicApi(MakcRe v1.6.0) 网关包装（Folia 移植）。
 *
 * KuGouMusicApi 的 main.js 是可直接 require 的编程式入口（不起 HTTP 服务），
 * 网关进程内直调，按薄路由映射到 /platform/kugou/api/*：
 *   GET /login/qr/key      → login_qr_key（返回 qrcode + 内嵌二维码图）
 *   GET /login/qr/create   → login_qr_create（拼 H5 登录页链接便于本地图库重绘）
 *   GET /login/qr/check    → login_qr_check（status 0/1/2/4，4=成功且 cookie 带 token/userid）
 *   GET /login/token/refresh → login_token（登录态续期，需 cookie: { token, userid }）
 *   GET /song/url          → song_url / song_url_new（播放链接，带登录态）
 *
 * 客户端凭据由 X-Platform-Cookie 头传入（与现有 /platform/kugou/* 路由同约定）。
 */
const express = require('express');

let kugouApi = null;

function getKugouApi() {
  if (!kugouApi) {
    kugouApi = require('kugoumusicapi/main.js');
  }
  return kugouApi;
}

/** X-Platform-Cookie 头（"k=v; k2=v2"）→ KuGouMusicApi 的 cookie 对象（{k:'v'}） */
function parseCookieHeader(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

/** KuGouMusicApi 响应统一整形：错误保持原始结构供前端分类，成功透传 body */
function shapeResult(result) {
  const status = Number(result?.status || 0);
  return {
    status,
    body: result?.body ?? null,
    cookie: Array.isArray(result?.cookie) ? result.cookie : []
  };
}

function createKugouApiRouter() {
  const router = express.Router();

  router.get('/login/qr/key', async (_req, res) => {
    try {
      const result = await getKugouApi().login_qr_key({});
      const shaped = shapeResult(result);
      res.json({
        code: shaped.status === 200 ? 200 : 502,
        data: shaped.status === 200 ? shaped.body?.data : null,
        msg: shaped.status === 200 ? 'ok' : '酷狗二维码创建失败'
      });
    } catch (e) {
      res.status(502).json({ code: 502, msg: `酷狗二维码创建失败: ${String(e?.message || e)}` });
    }
  });

  router.get('/login/qr/create', async (req, res) => {
    try {
      const key = String(req.query.key || '');
      if (!key) {
        res.status(400).json({ code: 400, msg: 'missing key' });
        return;
      }
      const result = await getKugouApi().login_qr_create({ key });
      const shaped = shapeResult(result);
      // H5 登录链接 + 服务端生成的内嵌二维码图都给前端，前端按需重绘
      res.json({
        code: shaped.status === 200 ? 200 : 502,
        data: shaped.status === 200
          ? {
              url: `https://h5.kugou.com/apps/loginQRCode/html/index.html?qrcode=${key}`,
              qrcode_img: shaped.body?.data?.qrcode_img || null
            }
          : null
      });
    } catch (e) {
      res.status(502).json({ code: 502, msg: `酷狗二维码生成失败: ${String(e?.message || e)}` });
    }
  });

  router.get('/login/qr/check', async (req, res) => {
    try {
      const key = String(req.query.key || '');
      if (!key) {
        res.status(400).json({ code: 400, msg: 'missing key' });
        return;
      }
      const result = await getKugouApi().login_qr_check({ key });
      const shaped = shapeResult(result);
      const status = Number(shaped.body?.data?.status);
      // 0=过期 1=等待 2=待确认 4=成功；成功时 token/userid 在 body.data 与 cookie 数组里都有
      const succeeded = status === 4;
      const data = shaped.body?.data || {};
      res.json({
        code: 200,
        data: {
          status: succeeded ? 'success' : status === 2 ? 'scanned' : status === 0 ? 'expired' : 'waiting',
          qrcodeStatus: status,
          // 成功时组装凭据 Cookie 串（与旧链平台 cookie 形态一致，前端存 platform-cookie-kugou）
          cookie: succeeded
            ? `userid=${data.userid}; token=${data.token}; KUGOU_API_PLATFORM=lite;`
            : undefined,
          userInfo: succeeded
            ? {
                userId: String(data.userid ?? ''),
                nickname: data.nick_name || undefined,
                avatarUrl: data.head_img || undefined
              }
            : undefined
        }
      });
    } catch (e) {
      res.status(502).json({ code: 502, msg: `酷狗扫码状态查询失败: ${String(e?.message || e)}` });
    }
  });

  router.get('/login/token/refresh', async (req, res) => {
    try {
      const cookie = parseCookieHeader(req.get('X-Platform-Cookie'));
      const result = await getKugouApi().login_token({ cookie });
      const shaped = shapeResult(result);
      const ok = shaped.status === 200;
      res.json({
        code: ok ? 200 : 502,
        data: ok ? { cookie: shaped.cookie.join('; ') } : null,
        msg: ok ? 'ok' : '酷狗登录态续期失败'
      });
    } catch (e) {
      res.status(502).json({ code: 502, msg: `酷狗登录态续期失败: ${String(e?.message || e)}` });
    }
  });

  router.get('/song/url', async (req, res) => {
    try {
      const hash = String(req.query.hash || '');
      if (!hash) {
        res.status(400).json({ code: 400, msg: 'missing hash' });
        return;
      }
      const cookie = parseCookieHeader(req.get('X-Platform-Cookie'));
      const useNew = req.query.api === 'new';
      const params = useNew ? { hash, cookie } : { hash, cookie };
      const result = await getKugouApi()[useNew ? 'song_url_new' : 'song_url'](params);
      const shaped = shapeResult(result);
      const url =
        shaped.body?.data?.[0]?.url ||
        shaped.body?.url?.[0] ||
        shaped.body?.data?.url ||
        null;
      res.json({
        code: shaped.status === 200 && url ? 200 : 502,
        data: url ? { url } : null,
        msg: url ? 'ok' : '酷狗播放链接获取失败'
      });
    } catch (e) {
      res.status(502).json({ code: 502, msg: `酷狗播放链接获取失败: ${String(e?.message || e)}` });
    }
  });

  return router;
}

module.exports = { createKugouApiRouter, parseCookieHeader };
