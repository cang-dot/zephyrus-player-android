<template>
  <div id="lyric-metaphor-ai" class="metaphor-settings rounded-2xl p-4 space-y-4">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h3 class="text-base font-medium">歌词 AI 解析</h3>
        <p class="text-xs text-muted mt-1">配置网关访问凭据、模型和每日积分。</p>
      </div>
      <span class="text-xs text-muted">{{
        config.provider === 'gateway' ? '云端网关' : config.provider
      }}</span>
    </div>

    <div>
      <label class="field-label">共享访问 Token</label>
      <div class="token-row">
        <n-input
          v-model:value="config.accessToken"
          type="text"
          placeholder="输入或粘贴 Zephyrus AI 访问 Token"
        />
        <s-btn size="small" @click="pasteToken"><i class="ri-clipboard-line mr-1"></i>粘贴</s-btn>
      </div>
      <div class="flex items-center gap-2 mt-2">
        <s-btn size="small" :disabled="loading" @click="connect">
          {{ loading ? '验证中...' : '验证网易云账号' }}
        </s-btn>
        <span v-if="credits" class="text-xs text-muted"
          >今日剩余 {{ credits.remaining }}/{{ credits.total }} 积分</span
        >
      </div>
      <p v-if="error" class="text-xs text-red-500 mt-2">{{ error }}</p>
    </div>

    <div>
      <label class="field-label">默认模型</label>
      <n-select v-model:value="config.model" :options="modelOptions" :loading="loading" />
      <p v-if="selectedModel" class="text-xs text-muted mt-1">
        每次分析消耗 {{ selectedModel.multiplier }} 积分<span v-if="selectedModel.privacy">
          · 可能用于服务改进或训练，请勿提交敏感信息</span
        >
      </p>
    </div>

    <div class="rounded-xl bg-black/5 dark:bg-white/5 p-3 text-xs text-muted leading-relaxed">
      仅发送歌词及歌曲元数据到所选模型。请勿提交隐私、账号凭据或其他敏感内容。
    </div>
    <div class="flex justify-end">
      <s-btn type="primary" @click="save">保存设置</s-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, onMounted } from 'vue';
import {
  createGatewaySession,
  getGatewayCredits,
  listGatewayModels,
  type GatewayCredits,
  type GatewayModel
} from '@/features/ai/gateway';
import { getMetaphorConfig, saveMetaphorConfig } from './useMetaphor';
import SBtn from '@/views/set/SBtn.vue';

const config = reactive(getMetaphorConfig());
const models = ref<GatewayModel[]>([]);
const credits = ref<GatewayCredits | null>(null);
const loading = ref(false);
const error = ref('');
const modelName = (id: string, fallback?: string) =>
  id === 'opencode-v4f' || id === 'deepseek-v4-flash-0731' ? 'DeepSeekV4Flash' : fallback || id;
const modelOptions = computed(() =>
  models.value.map((model) => ({
    label: `${modelName(model.id, model.name)} · ${model.multiplier}x`,
    value: model.id
  }))
);
const selectedModel = computed(() => models.value.find((model) => model.id === config.model));

async function connect() {
  loading.value = true;
  error.value = '';
  try {
    localStorage.setItem('ai-gateway-access-token', config.accessToken || '');
    await createGatewaySession(config.accessToken || '');
    models.value = await listGatewayModels(config.accessToken || '');
    credits.value = await getGatewayCredits(config.accessToken || '');
    if (!models.value.some((model) => model.id === config.model))
      config.model = models.value[0]?.id || 'opencode-v4f';
  } catch (err: any) {
    error.value = err?.message || 'AI 网关验证失败';
  } finally {
    loading.value = false;
  }
}
async function pasteToken() {
  error.value = '';
  try {
    const value = await navigator.clipboard.readText();
    config.accessToken = value.trim();
  } catch {
    error.value = '无法读取剪贴板，请长按输入框粘贴';
  }
}
function save() {
  saveMetaphorConfig({ ...config });
  localStorage.setItem('ai-gateway-access-token', config.accessToken || '');
}
onMounted(() => {
  if (config.accessToken) void connect();
});
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
.token-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
}
.text-muted {
  color: var(--m-text-muted, #8c8780);
}
</style>
