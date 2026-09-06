# 免费密钥领取指南

歌词 AI 解析、AI 歌单、智能均衡器等 AI 功能使用**你自己的 API 密钥**，客户端直连服务商，不经任何服务器中转。本页整理各服务商的免费额度与低价档位，按需领取即可。

在应用内：**设置 → 基础设置 → 歌词 AI 解析**（或播放界面 → 设置 → 歌词解析），选择服务商并粘贴密钥。

## 智谱 AI（推荐，永久免费档）

- 开放平台：<https://open.bigmodel.cn>
- 注册后进入「API Keys」页面创建密钥，即可调用。
- **GLM-4-Flash：永久免费**，中文歌词理解质量对得起价格（零）。
- **GLM-5.3-Flash：低价快速档**，速度与质量平衡，适合高频使用。
- 应用内配置：服务商选「智谱 AI」，粘贴密钥，模型选 `glm-4-flash`（免费）或 `glm-5.3-flash`。

## OpenRouter（一个密钥用全部厂商）

- 官网：<https://openrouter.ai>
- 注册后在「Keys」页面创建密钥。
- 所有带 **`:free`** 后缀的模型免费调用（如 `deepseek/deepseek-chat-v3-0324:free`、`meta-llama/llama-3.3-70b-instruct:free`），有每日次数上限，适合轻度使用。
- 应用内配置：服务商选「OpenRouter」，模型选任意 `:free` 条目。

## OpenCode Zen（免费额度）

- 官网：<https://opencode.ai/zen>
- 注册后在控制台创建 API Key，赠送免费模型额度。
- 端点与模型名以官方文档为准；应用内预设 `opencode-v4f`。
- 应用内配置：服务商选「OpenCode Zen」。

## GitHub Models（GitHub 账号即用）

- 前提：GitHub 账号 + [Classic Personal Access Token](https://github.com/settings/tokens)（勾选 `models:read`）。
- 免费使用 GPT-4o、DeepSeek-R1 等托管模型，有速率限制。
- 应用内配置：服务商选「GitHub Models」，粘贴 Classic PAT。

## Pollinations（完全免配置）

- 无需任何密钥，应用内服务商选「Pollinations」即可开箱使用。
- 缺点：无稳定性保证，不适合重度使用。

## 低价付费档参考

| 服务商 | 模型 | 定位 |
| --- | --- | --- |
| 智谱 AI | GLM-5.3-Flash | 低价快速档，中文优秀 |
| DeepSeek | DeepSeek-V4-Flash | 低价快速档，官网 <https://platform.deepseek.com> 领取密钥 |

按「少量多次」的使用频率，免费档（智谱 GLM-4-Flash / OpenRouter `:free`）通常已经够用。

## 隐私说明

你的密钥只保存在设备本地（localStorage），请求由客户端直连服务商，**不经过 Zephyrus 的任何服务器**。AI 功能仅发送歌词文本与歌曲元数据，请勿提交其它敏感内容。
