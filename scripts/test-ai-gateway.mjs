import { createRequire } from 'node:module';
import http from 'node:http';

const require = createRequire(import.meta.url);
const { createAiGatewayRouter } = require('../server-ai-gateway.js');
const express = require('express');

process.env.AI_GATEWAY_ACCESS_TOKEN = 'test-access-token';
for (const key of ['DG_GPT_API_KEY', 'DEEPSEEK_API_KEY', 'OPENCODE_API_KEY']) process.env[key] = 'test-key';

const app = express();
app.use('/v1', createAiGatewayRouter({ accessToken: process.env.AI_GATEWAY_ACCESS_TOKEN }));
const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const base = `http://127.0.0.1:${port}/v1`;

const models = await fetch(`${base}/models`, { headers: { 'X-AI-Access-Token': 'test-access-token' } });
if (!models.ok) throw new Error(`models failed: ${models.status}`);
const data = await models.json();
const expected = new Map(data.data.map((model) => [model.id, model.multiplier]));
for (const [id, multiplier] of [['opencode-hy3', 0.4], ['opencode-v4f', 0.8], ['opencode-mimo-v2.5', 0.5]]) {
  if (expected.get(id) !== multiplier) throw new Error(`${id} multiplier mismatch`);
}
const unauthorized = await fetch(`${base}/models`);
if (unauthorized.status !== 401) throw new Error(`unauthorized status ${unauthorized.status}`);
server.close();
console.log(`AI gateway smoke test passed (${data.data.length} models)`);
