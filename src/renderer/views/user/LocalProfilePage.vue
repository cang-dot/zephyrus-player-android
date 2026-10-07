<template>
  <div class="h-full w-full page-bg transition-colors duration-500">
    <div class="lp-scroll" style="padding-top: var(--mobile-topbar-inset)">
      <!-- 头像 -->
      <section class="lp-card">
        <div class="lp-avatar-row">
          <div class="lp-avatar-wrap" role="button" tabindex="0" @click="pickAvatar">
            <img
              v-if="previewAvatarUrl"
              :src="getImgUrl(previewAvatarUrl)"
              referrerpolicy="no-referrer"
              :alt="t('user.localProfile.avatar')"
            />
            <span v-else class="lp-avatar-placeholder"><i class="ri-user-3-line" /></span>
            <span class="lp-avatar-camera"><i class="ri-camera-line" /></span>
          </div>
          <div class="lp-avatar-copy">
            <strong>{{ t('user.localProfile.avatar') }}</strong>
            <small>{{ t('user.localProfile.avatarHint') }}</small>
          </div>
          <button
            v-if="localProfileStore.profile.avatarUrl"
            type="button"
            class="lp-field-reset"
            @click="resetAvatar"
          >
            {{ t('user.localProfile.resetField') }}
          </button>
        </div>
        <input ref="avatarInputRef" type="file" accept="image/*" hidden @change="onAvatarChange" />
      </section>

      <!-- 覆盖字段 -->
      <section class="lp-card">
        <div class="lp-row">
          <label>{{ t('user.localProfile.nickname') }}</label>
          <n-input
            v-model:value="draft.nickname"
            class="lp-input"
            :placeholder="baseNickname || t('user.localProfile.emptyPlaceholder')"
            :maxlength="30"
          />
          <button
            v-if="localProfileStore.profile.nickname"
            type="button"
            class="lp-field-reset"
            @click="clearField('nickname')"
          >
            {{ t('user.localProfile.resetField') }}
          </button>
        </div>
        <div class="lp-row">
          <label>{{ t('user.localProfile.signature') }}</label>
          <n-input
            v-model:value="draft.signature"
            class="lp-input"
            type="textarea"
            :rows="2"
            :placeholder="baseSignature || t('user.localProfile.emptyPlaceholder')"
            :maxlength="254"
          />
          <button
            v-if="localProfileStore.profile.signature"
            type="button"
            class="lp-field-reset"
            @click="clearField('signature')"
          >
            {{ t('user.localProfile.resetField') }}
          </button>
        </div>
        <div class="lp-row">
          <label>{{ t('user.localProfile.gender') }}</label>
          <div class="lp-gender-seg" role="radiogroup">
            <button
              v-for="option in genderOptions"
              :key="option.value"
              type="button"
              :class="{ active: draft.gender === option.value }"
              @click="draft.gender = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
        <div class="lp-row">
          <label>{{ t('user.localProfile.birthday') }}</label>
          <n-date-picker
            v-model:value="draft.birthday"
            class="lp-input"
            type="date"
            clearable
            :is-date-disabled="blockFutureDates"
          />
        </div>
        <div class="lp-row">
          <label>{{ t('user.localProfile.region') }}</label>
          <n-input
            v-model:value="draft.region"
            class="lp-input"
            :placeholder="t('user.localProfile.regionPlaceholder')"
            :maxlength="30"
          />
        </div>
      </section>

      <p class="lp-hint">{{ t('user.localProfile.overlayHint') }}</p>

      <!-- 保存 / 一键恢复 -->
      <div class="lp-save-bar">
        <button type="button" class="lp-save" @click="saveOffline">
          {{ t('user.localProfile.save') }}
        </button>
      </div>
      <button
        v-if="localProfileStore.hasOverrides"
        type="button"
        class="lp-clear-all"
        :class="{ confirming: clearArmed }"
        @click="clearAll"
      >
        {{ clearArmed ? t('user.localProfile.clearAllConfirm') : t('user.localProfile.clearAll') }}
      </button>

      <div class="lp-bottom-spacer" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useMessage } from 'naive-ui';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { registerMobileBackLayer } from '@/services/mobileBackStack';
import { useLocalProfileStore, type LocalProfile } from '@/store/modules/localProfile';
import { useUserStore } from '@/store/modules/user';
import { getImgUrl } from '@/utils';

defineOptions({ name: 'UserLocalProfile' });

const { t } = useI18n();
const message = useMessage();

const userStore = useUserStore();
const localProfileStore = useLocalProfileStore();

const avatarInputRef = ref<HTMLInputElement | null>(null);
const clearArmed = ref(false);
let clearArmTimer: number | null = null;
let backDisposer: (() => void) | null = null;

// 平台原始值（未覆盖时的显示值）作为 placeholder 对照
const baseNickname = computed(
  () => localProfileStore.displayNickname || userStore.user?.nickname || ''
);
const baseSignature = computed(() => userStore.userDetail?.profile?.signature || '');
const baseAvatarUrl = computed(
  () => localProfileStore.displayAvatarUrl || userStore.user?.avatarUrl || ''
);

const draft = reactive({
  nickname: localProfileStore.profile.nickname,
  signature: localProfileStore.profile.signature,
  avatarUrl: localProfileStore.profile.avatarUrl,
  gender: localProfileStore.profile.gender ?? (userStore.userDetail?.profile?.gender ?? 0),
  birthday: localProfileStore.profile.birthday,
  region: localProfileStore.profile.region
});

const previewAvatarUrl = computed(() => draft.avatarUrl || baseAvatarUrl.value);

const genderOptions = computed(() => [
  { value: 0, label: t('user.localProfile.genderSecret') },
  { value: 1, label: t('user.localProfile.genderMale') },
  { value: 2, label: t('user.localProfile.genderFemale') }
]);

const blockFutureDates = (current: number) => current > Date.now();

async function squareCropAvatarFile(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('image load failed'));
      element.src = objectUrl;
    });
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const size = Math.min(side, 512);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas unavailable');
    context.drawImage(
      image,
      (image.naturalWidth - side) / 2,
      (image.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size
    );
    return canvas.toDataURL('image/jpeg', 0.88);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

const pickAvatar = () => avatarInputRef.value?.click();

const onAvatarChange = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    draft.avatarUrl = await squareCropAvatarFile(file);
  } catch {
    message.error(t('user.localProfile.avatarFailed'));
  }
};

const resetAvatar = () => {
  draft.avatarUrl = '';
  localProfileStore.saveProfile({ avatarUrl: '' });
};

const clearField = (key: 'nickname' | 'signature') => {
  localProfileStore.saveProfile({ [key]: '' });
  if (key === 'nickname') draft.nickname = '';
  else draft.signature = '';
  message.success(t('user.localProfile.fieldCleared'));
};

const saveOffline = () => {
  localProfileStore.saveProfile({
    nickname: draft.nickname.trim(),
    signature: draft.signature.trim(),
    avatarUrl: draft.avatarUrl,
    gender: draft.gender,
    birthday: draft.birthday,
    region: draft.region.trim()
  } satisfies Partial<LocalProfile>);
  message.success(t('user.localProfile.saveOk'));
};

/** 两段确认：第一次点击进入待确认态，3 秒后自动解除 */
const clearAll = () => {
  if (!clearArmed.value) {
    clearArmed.value = true;
    if (clearArmTimer) window.clearTimeout(clearArmTimer);
    clearArmTimer = window.setTimeout(() => {
      clearArmed.value = false;
    }, 3000);
    return;
  }
  if (clearArmTimer) window.clearTimeout(clearArmTimer);
  clearArmed.value = false;
  localProfileStore.clearProfile();
  draft.nickname = '';
  draft.signature = '';
  draft.avatarUrl = '';
  draft.gender = 0;
  draft.birthday = null;
  draft.region = '';
  message.success(t('user.localProfile.clearAllDone'));
};

onMounted(() => {
  backDisposer = registerMobileBackLayer({
    id: 'local-profile-clear-arm',
    priority: 860,
    isActive: () => clearArmed.value,
    onBack: () => {
      clearArmed.value = false;
      if (clearArmTimer) window.clearTimeout(clearArmTimer);
    }
  });
});

onBeforeUnmount(() => {
  backDisposer?.();
  if (clearArmTimer) window.clearTimeout(clearArmTimer);
});
</script>

<style lang="scss" scoped>
.lp-scroll {
  width: 100%;
  min-height: 100%;
  padding-left: 16px;
  padding-right: 16px;
}

.lp-card {
  margin-top: 12px;
  padding: 16px;
  border: 1px solid color-mix(in srgb, var(--m-border, #d8d3cc) 34%, transparent);
  border-radius: 24px;
  background: var(--m-surface, #f7f5f1);
  box-shadow: 0 10px 28px color-mix(in srgb, var(--m-shadow, #000) 10%, transparent);
}

.lp-avatar-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.lp-avatar-wrap {
  position: relative;
  width: 72px;
  height: 72px;
  flex: 0 0 72px;
  border-radius: 50%;
  cursor: pointer;

  img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.16);
  }

  &:active .lp-avatar-camera {
    transform: scale(0.92);
  }
}

.lp-avatar-placeholder {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  border-radius: 50%;
  background: color-mix(in srgb, var(--m-surface-alt) 72%, transparent);
  color: var(--m-text-muted);
  font-size: 28px;
}

.lp-avatar-camera {
  position: absolute;
  right: -2px;
  bottom: -2px;
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border: 2px solid var(--m-surface, #f7f5f1);
  border-radius: 50%;
  background: var(--accent-color);
  color: #fff;
  font-size: 14px;
  transition: transform 200ms cubic-bezier(0.32, 0.72, 0, 1);
}

.lp-avatar-copy {
  display: grid;
  gap: 3px;
  min-width: 0;
  flex: 1;

  strong {
    color: var(--m-text-primary);
    font-size: 16px;
  }

  small {
    color: var(--m-text-muted);
    font-size: 11px;
  }
}

.lp-field-reset {
  flex-shrink: 0;
  padding: 7px 14px;
  border: 1px solid color-mix(in srgb, var(--m-border) 45%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--m-surface-alt) 60%, transparent);
  color: var(--m-text-secondary);
  font-size: 12px;

  &:active {
    transform: scale(0.95);
  }
}

.lp-row {
  display: flex;
  align-items: center;
  gap: 10px;

  & + .lp-row {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid color-mix(in srgb, var(--m-border) 26%, transparent);
  }

  label {
    width: 56px;
    flex-shrink: 0;
    color: var(--m-text-secondary);
    font-size: 13px;
  }
}

.lp-input {
  min-width: 0;
  flex: 1;
}

.lp-gender-seg {
  display: flex;
  flex: 1;
  min-width: 0;
  gap: 6px;

  button {
    flex: 1;
    min-height: 34px;
    padding: 0 8px;
    border: 1px solid color-mix(in srgb, var(--m-border) 40%, transparent);
    border-radius: 999px;
    background: transparent;
    color: var(--m-text-secondary);
    font-size: 12px;
    transition:
      background 160ms ease,
      color 160ms ease,
      border-color 160ms ease;

    &.active {
      border-color: color-mix(in srgb, var(--accent-color) 55%, transparent);
      background: color-mix(in srgb, var(--accent-color) 14%, transparent);
      color: var(--accent-color);
      font-weight: 700;
    }

    &:active {
      transform: scale(0.96);
    }
  }
}

.lp-hint {
  margin: 12px 6px 0;
  color: var(--m-text-muted);
  font-size: 11px;
  line-height: 1.5;
}

.lp-save-bar {
  margin-top: 14px;
}

.lp-save {
  width: 100%;
  min-height: 46px;
  border: 0;
  border-radius: 999px;
  background: var(--accent-color);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  transition: transform 160ms cubic-bezier(0.32, 0.72, 0, 1);

  &:active {
    transform: scale(0.97);
  }
}

.lp-clear-all {
  width: 100%;
  min-height: 42px;
  margin-top: 10px;
  border: 1px solid color-mix(in srgb, var(--m-border) 45%, transparent);
  border-radius: 999px;
  background: transparent;
  color: var(--m-text-muted);
  font-size: 13px;
  transition:
    color 160ms ease,
    border-color 160ms ease,
    background 160ms ease;

  &.confirming {
    border-color: color-mix(in srgb, #ef4444 55%, transparent);
    background: color-mix(in srgb, #ef4444 12%, transparent);
    color: #ef4444;
    font-weight: 700;
  }

  &:active {
    transform: scale(0.98);
  }
}

.lp-bottom-spacer {
  height: calc(var(--mobile-dock-content-inset, 144px) + var(--safe-area-inset-bottom, 0px) + 12px);
}
</style>
