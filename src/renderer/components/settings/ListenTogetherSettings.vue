<template>
  <div class="listen-together-settings">
    <div class="lt-primary-row">
      <div class="lt-copy">
        <span class="lt-title">{{ t('listenTogether.settings.title') }}</span>
        <span class="lt-description">{{ t('listenTogether.settings.desc') }}</span>
      </div>
      <n-switch :value="isSessionActive" aria-label="一起听" @update:value="handleSwitchToggle" />
    </div>

    <!-- 未加入：创建 / 加入 -->
    <div v-if="!isSessionActive" class="lt-session-panel">
      <div class="lt-create-row">
        <n-input
          v-model:value="joinCode"
          class="lt-code-input"
          :placeholder="t('listenTogether.settings.codePlaceholder')"
          maxlength="6"
          :allow-input="onlyCodeChars"
          size="small"
        />
        <n-button type="primary" size="small" :loading="busy" @click="handleJoin">
          {{ t('listenTogether.settings.join') }}
        </n-button>
        <n-button size="small" :loading="busy" @click="handleCreate">
          {{ t('listenTogether.settings.create') }}
        </n-button>
      </div>
      <p v-if="actionError" class="lt-error">{{ actionError }}</p>
    </div>

    <!-- 已加入：房间码 / 二维码 / 成员 -->
    <div v-else class="lt-session-panel active">
      <div class="lt-room-grid">
        <div class="lt-room-code-block">
          <span class="lt-room-label">{{ t('listenTogether.settings.roomCode') }}</span>
          <span class="lt-room-code">{{ store.roomCode }}</span>
          <div class="lt-room-actions">
            <n-button quaternary size="tiny" @click="copyShareLink">
              <i class="ri-links-line" />
              {{ t('listenTogether.settings.copyInvite') }}
            </n-button>
            <n-button quaternary size="tiny" @click="copyCode">
              <i class="ri-file-copy-line" />
              {{ t('listenTogether.settings.copyCode') }}
            </n-button>
          </div>
        </div>
        <img v-if="qrDataUrl" class="lt-room-qr" :src="qrDataUrl" alt="QR" />
      </div>

      <div class="lt-members-row">
        <span class="lt-members-label">{{ t('listenTogether.settings.members') }}</span>
        <span class="lt-members-list">{{ membersText }}</span>
      </div>

      <div class="lt-leave-row">
        <n-button size="small" type="error" ghost @click="handleLeave">
          {{ t('listenTogether.settings.leave') }}
        </n-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NButton, NInput, NSwitch, useMessage } from 'naive-ui';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { listenTogetherService } from '@/services/listenTogetherService';
import { useListenTogetherStore } from '@/store/modules/listenTogether';
import { buildListenRelayUrl } from '@/utils/qrCodeUtil';
import { generateQRCodeDataURL } from '@/utils/qrCodeUtil';

const { t } = useI18n();
const message = useMessage();
const store = useListenTogetherStore();

const busy = ref(false);
const joinCode = ref('');
const actionError = ref('');
const qrDataUrl = ref('');

const isSessionActive = computed(() => store.status === 'active');

const membersText = computed(() => {
  const list = store.members || [];
  if (!list.length) return '—';
  const names = list.map((m) => (m.online ? m.name : `${m.name}·`));
  return names.join(' / ');
});

const onlyCodeChars = (v: string) => /^[A-Za-z0-9]*$/.test(v);

watch(
  () => [isSessionActive.value, store.roomCode],
  async ([active, code]) => {
    if (active && code) {
      try {
        qrDataUrl.value = await generateQRCodeDataURL(buildListenRelayUrl(String(code)), 96);
      } catch {
        qrDataUrl.value = '';
      }
    } else {
      qrDataUrl.value = '';
    }
  },
  { immediate: true }
);

function handleSwitchToggle(value: boolean) {
  if (value) {
    handleCreate();
  } else {
    handleLeave();
  }
}

async function handleCreate() {
  if (busy.value) return;
  busy.value = true;
  actionError.value = '';
  try {
    const code = await listenTogetherService.createRoom();
    message.success(`${t('listenTogether.settings.createdPrefix')}${code}`);
  } catch (e) {
    actionError.value = e instanceof Error && e.message ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}

async function handleJoin() {
  if (busy.value) return;
  busy.value = true;
  actionError.value = '';
  try {
    await listenTogetherService.joinRoom(joinCode.value);
    joinCode.value = '';
    message.success(t('listenTogether.settings.joined'));
  } catch (e) {
    actionError.value = e instanceof Error && e.message ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}

function handleLeave() {
  listenTogetherService.leaveRoom();
  message.info(t('listenTogether.settings.left'));
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    message.success(t('listenTogether.settings.copied'));
  } catch {
    message.error(t('listenTogether.settings.copyFailed'));
  }
}

const copyShareLink = () => copyText(buildListenRelayUrl(store.roomCode));
const copyCode = () => copyText(store.roomCode);
</script>

<style scoped lang="scss">
.listen-together-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 14px;
  background: var(--zephyrus-panel-bg, rgba(128, 128, 128, 0.08));
}

.lt-primary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.lt-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .lt-title {
    font-size: 15px;
    font-weight: 600;
  }

  .lt-description {
    font-size: 12px;
    opacity: 0.65;
    line-height: 1.4;
  }
}

.lt-session-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;

  &.active {
    padding-top: 4px;
    border-top: 1px solid rgba(128, 128, 128, 0.16);
  }
}

.lt-create-row {
  display: flex;
  gap: 8px;
  align-items: center;

  .lt-code-input {
    flex: 1;
    min-width: 0;

    :deep(input) {
      text-transform: uppercase;
      letter-spacing: 2px;
    }
  }
}

.lt-error {
  margin: 0;
  font-size: 12px;
  color: #ff7a7a;
}

.lt-room-grid {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.lt-room-code-block {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .lt-room-label {
    font-size: 12px;
    opacity: 0.6;
  }

  .lt-room-code {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: 4px;
    font-variant-numeric: tabular-nums;
  }

  .lt-room-actions {
    display: flex;
    gap: 4px;
    margin-top: 2px;
  }
}

.lt-room-qr {
  width: 96px;
  height: 96px;
  border-radius: 10px;
  background: #fff;
  padding: 4px;
  flex-shrink: 0;
}

.lt-members-row {
  display: flex;
  gap: 10px;
  align-items: baseline;

  .lt-members-label {
    font-size: 12px;
    opacity: 0.6;
    flex-shrink: 0;
  }

  .lt-members-list {
    font-size: 13px;
    line-height: 1.5;
    word-break: break-all;
  }
}

.lt-leave-row {
  display: flex;
  justify-content: flex-end;
}
</style>
