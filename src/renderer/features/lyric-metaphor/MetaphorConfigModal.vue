<template>
  <n-modal
    :show="modelValue"
    :z-index="100001"
    title="AI 设置"
    preset="card"
    style="width: 480px; max-width: 90vw"
    :mask-closable="false"
    @update:show="$emit('update:modelValue', $event)"
  >
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1">AI 提供商</label>
        <n-select
          v-model:value="config.provider"
          :options="providerOptions"
          :render-label="renderLabel"
          @update:value="onProviderChange"
        />
        <p class="text-xs text-gray-400 mt-1">{{ currentProviderDesc }}</p>
      </div>

      <div v-if="config.provider === 'gateway'">
        <label class="block text-sm font-medium mb-1">共享访问 Token</label>
        <n-input
          v-model:value="config.accessToken"
          type="text"
          placeholder="输入 Zephyrus AI 访问 Token"
        />
        <div class="flex items-center gap-2 mt-2">
          <s-btn size="small" @click="pasteGatewayToken">
            <i class="ri-clipboard-line mr-1"></i>粘贴
          </s-btn>
          <s-btn size="small" :disabled="gatewayLoading" @click="connectGateway">
            {{ gatewayLoading ? '验证中...' : '验证网易云账号' }}
          </s-btn>
          <span v-if="gatewayCredits" class="text-xs text-gray-400">
            今日剩余 {{ gatewayCredits.remaining }}/{{ gatewayCredits.total }} 积分
          </span>
        </div>
        <p v-if="gatewayError" class="text-xs text-red-400 mt-2">{{ gatewayError }}</p>
      </div>

      <div v-if="needsApiKey && config.provider !== 'gateway'">
        <template v-if="config.provider !== 'github-models'">
          <label class="block text-sm font-medium mb-1">API 密钥</label>
          <n-input
            v-model:value="config.apiKey"
            type="password"
            show-password-on="click"
            placeholder="输入 API 密钥"
          />
        </template>

        <template v-else>
          <label class="block text-sm font-medium mb-1">GitHub 个人访问令牌</label>

          <div v-if="githubStep === 'account'" class="github-guide">
            <p class="text-sm text-gray-400 mb-2">
              配置 GitHub Models 需要 GitHub 个人访问令牌（PAT）。
            </p>
            <div class="flex gap-2">
              <s-btn @click="githubStep = 'guide'">我有 GitHub 账号</s-btn>
              <s-btn @click="openUrl('https://github.com/signup')">没有，去注册</s-btn>
            </div>
          </div>

          <div v-if="githubStep === 'guide'" class="github-guide">
            <div class="guide-step">
              <div class="guide-step-header">
                <span class="guide-step-num">1</span>
                <span>在 GitHub 生成新 Token</span>
              </div>
              <p class="text-xs text-gray-400 mt-1 mb-2">
                创建 <strong>Classic token</strong>（不用选权限，直接生成即可）
              </p>
              <s-btn size="small" @click="openUrl(tokenUrl)">打开 GitHub 设置</s-btn>
              <p class="text-xs text-gray-400 mt-1 break-all">
                <a :href="tokenUrl" target="_blank" class="underline hover:text-primary">{{
                  tokenUrl
                }}</a>
              </p>
            </div>

            <div class="guide-step">
              <div class="guide-step-header">
                <span class="guide-step-num">2</span>
                <span>复制生成的 Token 粘贴到下方</span>
              </div>
            </div>

            <n-input
              v-model:value="config.apiKey"
              type="password"
              show-password-on="click"
              placeholder="粘贴 GitHub Token（以 ghp_ 开头）"
              class="mt-2"
            />
          </div>

          <div v-if="githubStep === 'done'" class="github-guide">
            <p class="text-sm text-[var(--accent-color)]">已配置 GitHub 令牌</p>
            <s-btn size="small" class="mt-1" @click="githubStep = 'guide'">重新配置</s-btn>
          </div>
        </template>
      </div>

      <div v-if="config.provider === 'gateway'">
        <label class="block text-sm font-medium mb-1">模型</label>
        <n-select
          v-model:value="config.model"
          :options="gatewayModelOptions"
          :loading="gatewayLoading"
          placeholder="先验证账号并加载模型"
        />
        <p v-if="selectedGatewayModel" class="text-xs text-gray-400 mt-1">
          每次分析消耗 {{ selectedGatewayModel.multiplier }} 积分
          <span v-if="selectedGatewayModel.privacy" class="text-amber-500">
            · 可能用于服务改进或训练，请勿提交敏感信息</span
          >
        </p>
      </div>

      <div v-else>
        <label class="block text-sm font-medium mb-1">模型名称</label>
        <n-input v-model:value="config.model" :placeholder="defaultModelPlaceholder" />
        <p class="text-xs text-gray-400 mt-1">留空则使用默认模型</p>
      </div>

      <div v-if="config.provider === 'custom'">
        <label class="block text-sm font-medium mb-1">API 地址</label>
        <n-input v-model:value="config.baseUrl" placeholder="https://your-api.com/v1" />
        <p class="text-xs text-gray-400 mt-1">完整的 Base URL，需兼容 OpenAI 格式</p>
      </div>

      <div class="flex justify-end gap-2 pt-2">
        <s-btn @click="handleCancel">取消</s-btn>
        <s-btn type="primary" @click="handleSave">保存</s-btn>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, h, reactive, ref, watch } from 'vue';

import {
  createGatewaySession,
  type GatewayCredits,
  type GatewayModel,
  getGatewayCredits,
  listGatewayModels
} from '@/features/ai/gateway';
import { AI_PROVIDERS, getProvider } from '@/features/ai/providers';
import { getMetaphorConfig, saveMetaphorConfig } from '@/features/lyric-metaphor/useMetaphor';
import SBtn from '@/views/set/SBtn.vue';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  saved: [];
}>();

const config = reactive(getMetaphorConfig());
const githubStep = ref(config.apiKey ? 'done' : 'account');
const gatewayModels = ref<GatewayModel[]>([]);
const gatewayCredits = ref<GatewayCredits | null>(null);
const gatewayLoading = ref(false);
const gatewayError = ref('');
const tokenUrl = 'https://github.com/settings/tokens/new';

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      const saved = getMetaphorConfig();
      config.provider = saved.provider;
      config.apiKey = saved.apiKey;
      config.accessToken = saved.accessToken || '';
      config.model = saved.model;
      config.baseUrl = saved.baseUrl;
      githubStep.value = saved.apiKey ? 'done' : 'account';
    }
  }
);

const providerOptions = AI_PROVIDERS.map((p) => ({
  label: p.name,
  value: p.id,
  badge: p.badge
}));

const gatewayModelOptions = computed(() =>
  gatewayModels.value.map((model) => ({
    label: `${model.name} · ${model.multiplier}x`,
    value: model.id
  }))
);
const selectedGatewayModel = computed(() =>
  gatewayModels.value.find((model) => model.id === config.model)
);

const renderLabel = (option: { label: string; badge?: string }) => {
  if (option.badge) {
    return h('span', null, [
      option.label,
      h(
        'span',
        {
          class:
            'ml-1.5 text-[11px] text-white bg-[var(--accent-color)] rounded px-1 py-0.5 leading-none inline-block align-middle'
        },
        option.badge
      )
    ]);
  }
  return option.label;
};

const needsApiKey = computed(() => {
  if (config.provider === 'custom') return false;
  const p = getProvider(config.provider);
  return p?.needApiKey ?? false;
});

const currentProviderDesc = computed(() => {
  const p = getProvider(config.provider);
  return p?.description || '';
});

const defaultModelPlaceholder = computed(() => {
  const p = getProvider(config.provider);
  if (config.provider === 'custom') return '输入模型名称';
  return p?.defaultModel || '';
});

function onProviderChange(providerId: string) {
  const p = getProvider(providerId);
  if (p) {
    config.model = p.defaultModel;
    config.baseUrl = '';
  }
  if (providerId === 'github-models') {
    githubStep.value = 'account';
  }
  if (providerId === 'gateway' && config.accessToken) void connectGateway();
}

async function connectGateway() {
  gatewayLoading.value = true;
  gatewayError.value = '';
  try {
    localStorage.setItem('ai-gateway-access-token', config.accessToken || '');
    await createGatewaySession(config.accessToken || '');
    gatewayModels.value = await listGatewayModels(config.accessToken || '');
    gatewayCredits.value = await getGatewayCredits(config.accessToken || '');
    if (!gatewayModels.value.some((model) => model.id === config.model)) {
      config.model = gatewayModels.value[0]?.id || 'opencode-v4f';
    }
  } catch (error: any) {
    gatewayError.value = error?.message || 'AI 网关验证失败';
  } finally {
    gatewayLoading.value = false;
  }
}

async function pasteGatewayToken() {
  try {
    const value = await navigator.clipboard?.readText();
    if (value?.trim()) config.accessToken = value.trim();
  } catch {
    gatewayError.value = '无法读取剪贴板，请长按输入框粘贴';
  }
}

function openUrl(url: string) {
  if (typeof window.api !== 'undefined' && window.api.openExternal) {
    window.api.openExternal(url).catch((err: unknown) => {
      console.error('openExternal 失败:', err);
      fallbackOpenUrl(url);
    });
  } else {
    fallbackOpenUrl(url);
  }
}

function fallbackOpenUrl(url: string) {
  try {
    const win = window.open(url, '_blank');
    if (!win) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  } catch {
    navigator.clipboard.writeText(url).catch(() => {});
  }
}

watch(
  () => config.apiKey,
  (val) => {
    if (config.provider === 'github-models' && val) {
      githubStep.value = 'done';
    }
  }
);

function handleCancel() {
  emit('update:modelValue', false);
}

function handleSave() {
  if (config.provider === 'github-models' && !config.apiKey) {
    return;
  }
  saveMetaphorConfig({ ...config });
  if (config.provider === 'gateway') {
    localStorage.setItem('ai-gateway-access-token', config.accessToken || '');
  }
  emit('saved');
  emit('update:modelValue', false);
}
</script>

<style scoped>
.github-guide {
  background: var(--hover-color, #f5f5f5);
  border-radius: 8px;
  padding: 12px;
}
.dark .github-guide {
  background: var(--hover-color, #2a2a2a);
}
.guide-step {
  margin-bottom: 12px;
}
.guide-step:last-child {
  margin-bottom: 0;
}
.guide-step-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  font-size: 14px;
}
.guide-step-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--accent-color);
  color: white;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}
</style>
