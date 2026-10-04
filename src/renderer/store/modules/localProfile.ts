import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { type MusicPlatform,usePlatformAccountsStore } from './platformAccounts';
import { useUserStore } from './user';

/**
 * 离线资料覆盖层：与账号解耦的本地自定义资料。
 * 不管激活哪个账号，界面显示的昵称/签名/头像都优先取这里，
 * 某字段为空时回退到当前激活账号的平台原始资料（清除该字段即恢复平台显示）。
 * 头像仅存本地（base64 或 URL），不向任何平台同步。
 */
export interface LocalProfile {
  /** 覆盖显示昵称；空 = 用平台昵称 */
  nickname: string;
  /** 覆盖显示签名；空 = 用平台签名 */
  signature: string;
  /** 覆盖显示头像（data:base64 或 URL）；空 = 用平台头像 */
  avatarUrl: string;
  /** 本地展示性别：0 保密 / 1 男 / 2 女；null = 未自定义 */
  gender: number | null;
  /** 本地展示生日（毫秒时间戳）；null = 未自定义 */
  birthday: number | null;
  /** 本地展示地区（自由文本）；空 = 未自定义 */
  region: string;
}

const EMPTY_PROFILE: LocalProfile = {
  nickname: '',
  signature: '',
  avatarUrl: '',
  gender: null,
  birthday: null,
  region: ''
};

export const useLocalProfileStore = defineStore(
  'localProfile',
  () => {
    const profile = ref<LocalProfile>({ ...EMPTY_PROFILE });

    const hasOverrides = computed(() =>
      Boolean(
        profile.value.nickname ||
        profile.value.signature ||
        profile.value.avatarUrl ||
        profile.value.gender != null ||
        profile.value.birthday != null ||
        profile.value.region
      )
    );

    // 显示优先级：离线资料 > 激活账号 > 旧版 user store
    const displayNickname = computed(() => {
      if (profile.value.nickname) return profile.value.nickname;
      const accountsStore = usePlatformAccountsStore();
      return accountsStore.activeAccount?.nickname || useUserStore().user?.nickname || '';
    });

    const displayAvatarUrl = computed(() => {
      if (profile.value.avatarUrl) return profile.value.avatarUrl;
      const accountsStore = usePlatformAccountsStore();
      return accountsStore.activeAccount?.avatarUrl || useUserStore().user?.avatarUrl || '';
    });

    /** 平台原始签名（仅网易云登录后有 userDetail）；离线覆盖优先 */
    const displaySignature = computed(() => {
      if (profile.value.signature) return profile.value.signature;
      return useUserStore().userDetail?.profile?.signature || '';
    });

    /**
     * 写入覆盖资料。值为空字符串/null 的字段视为"清除覆盖"，
     * 显示自动回退到平台原始资料。
     */
    const saveProfile = (patch: Partial<LocalProfile>) => {
      const next = { ...profile.value };
      for (const [key, value] of Object.entries(patch)) {
        if (!(key in EMPTY_PROFILE)) continue;
        const empty = value === '' || value === null || value === undefined || Number.isNaN(value);
        (next as Record<string, unknown>)[key] = empty
          ? EMPTY_PROFILE[key as keyof LocalProfile]
          : value;
      }
      profile.value = next;
    };

    const clearProfile = () => {
      profile.value = { ...EMPTY_PROFILE };
    };

    return {
      profile,
      hasOverrides,
      displayNickname,
      displayAvatarUrl,
      displaySignature,
      saveProfile,
      clearProfile
    };
  },
  {
    persist: {
      key: 'local-profile-store',
      storage: localStorage,
      pick: ['profile']
    }
  }
);

/** 平台显示名（platformAccounts 内的 PLATFORM_NAMES 未导出，此处对齐其取值） */
export const platformDisplayName = (platform: MusicPlatform): string =>
  ({
    netease: '网易云',
    qq: 'QQ音乐',
    kugou: '酷狗音乐',
    spotify: 'Spotify',
    bilibili: '哔哩哔哩'
  })[platform];
