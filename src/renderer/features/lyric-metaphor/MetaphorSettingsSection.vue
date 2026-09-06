<template>
  <div id="lyric-metaphor-ai" class="metaphor-settings rounded-2xl p-4 space-y-4">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h3 class="text-base font-medium">歌词 AI 解析</h3>
        <p class="text-xs text-muted mt-1">使用你自己的 API 密钥，客户端直连，不经服务器中转。</p>
      </div>
      <a
        class="text-xs"
        style="color: var(--accent-color, #888)"
        href="https://mucang.xyz/zephyrus/docs/guide/free-api-keys"
        target="_blank"
        rel="noopener"
      >
        如何领取免费密钥 →
      </a>
    </div>

    <!-- 服务商选择 -->
    <div>
      <label class="field-label">AI 服务商</label>
      <div class="provider-chips">
        <button
          v-for="provider in providers"
          :key="provider.id"
          type="button"
          class="provider-chip"
          :class="{ active: config.provider === provider.id }"
          @click="selectProvider(provider.id)"
        >
          {{ provider.name }}
          <span v-if="hasFreeModel(provider)" class="free-dot" title="含免费模型"></span>
        </button>
      </div>
      <p class="text-xs text-muted mt-2">{{ currentProvider?.description }}</p>
    </div>

    <!-- API Key -->
    <div v-if="currentProvider?.needApiKey">
      <label class="field-label">API 密钥</label>
      <n-input
        v-model:value="config.apiKey"
        type="password"
        show-password-on="click"
        placeholder="粘贴该服务商的 API Key"
      />
      <p v-if="currentProvider?.docsAnchor" class="text-xs text-muted mt-1">
        密钥在服务商控制台创建，领取免费额度见
        <a
          :href="`https://mucang.xyz/zephyrus/docs/guide/free-api-keys#${currentProvider.docsAnchor}`"
          target="_blank"
          rel="noopener"
          style="color: var(--accent-color, #888)"
          >领取指南</a
        >
      </p>
    </div>

    <!-- 模型:预设建议 + 自定义输入 -->
    <div>
      <label class="field-label">模型</label>
      <n-select
        v-if="currentProvider?.models.length"
        v-model:value="config.model"
        :options="modelOptions"
        tag
        filterable
        placeholder="选择或输入模型 id"
      />
      <n-input v-else v-model:value="config.model" placeholder="输入模型 id" />
      <n-input
        v-if="currentProvider && currentProvider.models.length === 0"
        v-model:value="config.baseUrl"
        class="mt-2"
        placeholder="API 地址（OpenAI 兼容，如 https://api.example.com/v1）"
      />
      <p v-if="selectedModelMeta" class="text-xs text-muted mt-1">
        {{ selectedModelMeta.free ? '该模型免费' : '' }}
        {{ selectedModelMeta.badge ? `· ${selectedModelMeta.badge} 档` : '' }}
      </p>
      <p v-if="currentProvider?.id === 'custom' && !config.baseUrl" class="text-xs text-red-500 mt-1">
        自定义服务商需要填写 API 地址
      </p>
    </div>

    <div class="rounded-xl bg-black/5 dark:bg-white/5 p-3 text-xs text-muted leading-relaxed">
      仅发送歌词及歌曲元数据到你选择的服务商。密钥只保存在本机，请勿提交隐私、账号凭据或其他敏感内容。
    </div>
    <div class="flex justify-end">
      <s-btn type="primary" @click="save">保存设置</s-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NInput, NSelect } from 'naive-ui';
import { computed, reactive } from 'vue';

import { AI_PROVIDERS } from '@/features/ai/providers';
import SBtn from '@/views/set/SBtn.vue';

import { getMetaphorConfig, saveMetaphorConfig } from './useMetaphor';

const providers = AI_PROVIDERS.filter((p) => p.id !== 'custom');
const config = reactive(getMetaphorConfig());
const currentProvider = computed(() => AI_PROVIDERS.find((p) => p.id === config.provider));

const hasFreeModel = (provider: (typeof providers)[number]) =>
  provider.models.some((model) => model.free);

const modelOptions = computed(() =>
  (currentProvider.value?.models || []).map((model) => ({
    label: model.free ? `${model.label}（免费）` : model.badge ? `${model.label}（${model.badge}）` : model.label,
    value: model.id
  }))
);

const selectedModelMeta = computed(() =>
  (currentProvider.value?.models || []).find((model) => model.id === config.model)
);

function selectProvider(id: string) {
  config.provider = id;
  const provider = AI_PROVIDERS.find((p) => p.id === id);
  config.baseUrl = provider?.baseUrl || '';
  // 切换服务商时带上该服务商的默认模型,避免残留上一家的模型 id
  if (provider?.defaultModel) config.model = provider.defaultModel;
  saveMetaphorConfig({ ...config });
}

function save() {
  if (!config.model) config.model = currentProvider.value?.defaultModel || '';
  saveMetaphorConfig({ ...config });
}
</script>

<style scoped>
.metaphor-settings {
  background: color-mix(in srgb, var(--m-surface-alt, #f3f0eb) 86%, transparent);
}
.field-label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 500;
}
.text-muted {
  color: var(--m-text-muted, #8c8780);
}
.provider-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.provider-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border: 1px solid rgba(128, 128, 128, 0.25);
  border-radius: 999px;
  background: transparent;
  font-size: 12.5px;
  color: var(--m-text-muted, #8c8780);
  cursor: pointer;
  transition:
    background 160ms ease,
    color 160ms ease,
    border-color 160ms ease;
}
.provider-chip.active {
  border-color: var(--accent-color, #888);
  background: color-mix(in srgb, var(--accent-color, #888) 14%, transparent);
  color: var(--m-text-primary, #333);
}
.free-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
}
</style>
