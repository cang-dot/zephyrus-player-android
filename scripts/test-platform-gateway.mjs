import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createPlatformGatewayApp } = require('../server-platform-login.js');

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

  return {
    platform,
    keyLength: created.key.length,
    status: polled.status
  };
}

try {
  const health = await readJson('/platform/health');
  const qq = await verifyPlatform('qq');
  const kugou = await verifyPlatform('kugou');
  console.log(JSON.stringify({ health, qq, kugou }, null, 2));
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
