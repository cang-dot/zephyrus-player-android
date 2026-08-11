import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface SearchSourceOption {
  key: string;
  label: string;
  count?: number;
}

export const useSearchStore = defineStore('search', () => {
  const searchValue = ref('');
  const searchType = ref(1);
  const placeholder = ref('搜索音乐、歌手、歌单');
  const searchSource = ref('all');
  const searchSourceOptions = ref<SearchSourceOption[]>([
    { key: 'all', label: '全部' },
    { key: 'cross-qq', label: 'QQ音乐' },
    { key: 'cross-kugou', label: '酷狗' },
    { key: 'cross-joox', label: 'JOOX' },
    { key: 'cross-spotify', label: 'Spotify' },
    { key: 'netease', label: '网易云' },
    { key: 'server', label: 'Zephyrus云端' },
    { key: 'local', label: '本地' }
  ]);

  const setSearchValue = (value: string) => {
    searchValue.value = value;
  };

  const setSearchType = (type: number) => {
    searchType.value = type;
  };

  const setPlaceholder = (value: string) => {
    placeholder.value = value;
  };

  const setSearchSource = (source: string) => {
    searchSource.value = source || 'all';
  };

  const setSearchSourceOptions = (options: SearchSourceOption[]) => {
    const incoming = new Map(options.map((item) => [item.key, item]));
    searchSourceOptions.value = searchSourceOptions.value.map((item) => ({
      ...item,
      count: incoming.get(item.key)?.count
    }));
    for (const item of options) {
      if (!searchSourceOptions.value.some((existing) => existing.key === item.key)) {
        searchSourceOptions.value.push(item);
      }
    }
    if (!searchSourceOptions.value.some((item) => item.key === searchSource.value)) {
      searchSource.value = 'all';
    }
  };

  return {
    searchValue,
    searchType,
    placeholder,
    searchSource,
    searchSourceOptions,
    setSearchValue,
    setSearchType,
    setPlaceholder,
    setSearchSource,
    setSearchSourceOptions
  };
});
