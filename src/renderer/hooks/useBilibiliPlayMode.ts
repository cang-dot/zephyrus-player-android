/**
 * 哔哩哔哩播放方式选择
 *
 * 「视频」与「音频」两种方式差异较大（前者是带画面的视频，后者是纯音频 + 字幕歌词），
 * 因此首次点击时询问，并支持"记住本次选择"（写入应用级设置 bilibiliPlayMode，
 * 三端一致，可在设置里改回 ask 以恢复询问）。
 */
import { NButton, useDialog } from 'naive-ui';
import { h, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { useSettingsStore } from '@/store/modules/settings';

export type BilibiliPlayMode = 'video' | 'audio';

export function useBilibiliPlayMode() {
  const dialog = useDialog();
  const { t } = useI18n();
  const rememberChecked = ref(true);

  const readRememberedMode = (): BilibiliPlayMode | null => {
    const value = useSettingsStore().setData?.bilibiliPlayMode;
    return value === 'video' || value === 'audio' ? value : null;
  };

  const persistMode = (mode: BilibiliPlayMode | 'ask'): void => {
    useSettingsStore().setSetData({ bilibiliPlayMode: mode });
  };

  /**
   * 解析本次播放方式。
   * @returns 'video' | 'audio'；用户取消时返回 null
   */
  const resolvePlayMode = async (): Promise<BilibiliPlayMode | null> => {
    try {
      const remembered = readRememberedMode();
      if (remembered) return remembered;
    } catch {
      /* store 未就绪时直接询问 */
    }

    return new Promise<BilibiliPlayMode | null>((resolve) => {
      rememberChecked.value = true;
      let settled = false;

      const finish = (mode: BilibiliPlayMode | null) => {
        if (settled) return;
        settled = true;
        if (mode && rememberChecked.value) persistMode(mode);
        dialog.destroyAll();
        resolve(mode);
      };

      dialog.info({
        title: t('songItem.bilibili.playModeTitle'),
        content: () => [
          h(
            'div',
            { style: { marginBottom: '12px' } },
            t('songItem.bilibili.playModeDesc')
          ),
          h(
            'label',
            {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                color: '#999',
                fontSize: '13px'
              }
            },
            [
              h('input', {
                type: 'checkbox',
                checked: rememberChecked.value,
                onChange: (event: Event) => {
                  rememberChecked.value = (event.target as HTMLInputElement).checked;
                }
              }),
              t('songItem.bilibili.playModeRemember')
            ]
          )
        ],
        action: () => [
          h(
            NButton,
            { size: 'small', tertiary: true, onClick: () => finish('video') },
            { default: () => t('songItem.bilibili.playModeVideo') }
          ),
          h(
            NButton,
            { size: 'small', type: 'primary', onClick: () => finish('audio') },
            { default: () => t('songItem.bilibili.playModeAudio') }
          )
        ],
        closable: true,
        maskClosable: false,
        class: 'app-confirm-dialog',
        style: { zIndex: 999999999 },
        onClose: () => finish(null),
        onMaskClick: () => finish(null)
      });
    });
  };

  /** 清掉记忆（设置页"每次询问"用） */
  const forgetMode = (): void => persistMode('ask');

  return { resolvePlayMode, forgetMode };
}
