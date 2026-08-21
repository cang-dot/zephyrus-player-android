# AI Gateway deployment

The production gateway is mounted at `https://mucang.xyz/v1` and reads all credentials from the server environment. Do not place these values in the repository, APK, or frontend build:

```dotenv
AI_GATEWAY_ACCESS_TOKEN=replace-with-a-long-random-shared-token
OPENCODE_API_KEY=replace-with-opencode-zen-key
DG_GPT_API_KEY=replace-with-relay-key
DEEPSEEK_API_KEY=replace-with-deepseek-key
```

After injecting the variables into the PM2 environment, restart the `netease-api` process with `pm2 restart netease-api --update-env` and verify:

```text
GET /v1/healthz     -> 200
GET /v1/readyz      -> 200 when at least one model key is configured
GET /v1/models      -> 200 with X-AI-Access-Token
```

The client sends the网易云 Cookie only when creating a short-lived AI session. The gateway stores a hash and account ID, not the raw Cookie.
