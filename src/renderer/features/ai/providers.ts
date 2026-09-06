export interface AIProviderModel {
  id: string;
  label: string;
  /** 免费档 */
  free?: boolean;
  /** 低价付费档 */
  badge?: string;
}

export interface AIProvider {
  id: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
  /** 该服务商的常用模型建议(模型输入框可自由改写) */
  models: AIProviderModel[];
  needApiKey: boolean;
  description: string;
  badge?: string;
  /** 领取密钥/接入说明的文档锚点(文档站 free-api-keys 页) */
  docsAnchor?: string;
}

/**
 * BYOK 提供商注册表:用户自带 API 密钥,客户端直连 OpenAI 兼容端点。
 * 云端网关已弃用。
 */
export const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'zhipu',
    name: '智谱 AI',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
    models: [
      { id: 'glm-4-flash', label: 'GLM-4-Flash', free: true },
      { id: 'glm-5.3-flash', label: 'GLM-5.3-Flash', badge: '低价' },
      { id: 'glm-4-plus', label: 'GLM-4-Plus' }
    ],
    needApiKey: true,
    badge: '免费档',
    docsAnchor: 'zhipu',
    description: 'GLM-4-Flash 永久免费；GLM-5.3-Flash 为低价快速档，中文歌词理解出色。'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-v4-flash',
    models: [
      { id: 'deepseek-v4-flash', label: 'DeepSeek-V4-Flash', badge: '低价' },
      { id: 'deepseek-chat', label: 'DeepSeek-Chat' }
    ],
    needApiKey: true,
    docsAnchor: 'deepseek',
    description: 'DeepSeek-V4-Flash 为低价快速档，中文语境表现稳定。'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'deepseek/deepseek-chat-v3-0324:free',
    models: [
      { id: 'deepseek/deepseek-chat-v3-0324:free', label: 'DeepSeek V3', free: true },
      { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B', free: true },
      { id: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash', free: true }
    ],
    needApiKey: true,
    badge: '免费档',
    docsAnchor: 'openrouter',
    description: '聚合多家厂商，带 :free 后缀的模型免费使用，密钥一个管全部。'
  },
  {
    id: 'opencodezen',
    name: 'OpenCode Zen',
    baseUrl: 'https://opencode.ai/zen/v1',
    defaultModel: 'opencode-v4f',
    models: [{ id: 'opencode-v4f', label: 'OpenCode V4F', free: true }],
    needApiKey: true,
    badge: '免费档',
    docsAnchor: 'opencodezen',
    description: '提供免费模型额度；端点与模型名以其官方文档为准。'
  },
  {
    id: 'pollinations',
    name: 'Pollinations',
    baseUrl: 'https://text.pollinations.ai/v1',
    defaultModel: 'openai',
    models: [{ id: 'openai', label: 'OpenAI (GPT-OSS-20B)', free: true }],
    needApiKey: false,
    description: '无需 API 密钥，开箱即用。基于 GPT-OSS-20B，支持中文。'
  },
  {
    id: 'github-models',
    name: 'GitHub Models',
    baseUrl: 'https://models.github.ai/inference',
    defaultModel: 'openai/gpt-4o',
    models: [{ id: 'openai/gpt-4o', label: 'GPT-4o', free: true }],
    needApiKey: true,
    docsAnchor: 'github-models',
    description: 'GitHub 用户免费使用 GPT-4o、DeepSeek-R1 等，需 GitHub Classic PAT。'
  },
  {
    id: 'custom',
    name: '自定义',
    baseUrl: '',
    defaultModel: '',
    models: [],
    needApiKey: false,
    description: '自定义 API 地址和模型，兼容 OpenAI 格式。'
  }
];

export function getProvider(id: string): AIProvider | undefined {
  return AI_PROVIDERS.find((p) => p.id === id);
}
