import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useSearchStore = defineStore('search', () => {
  const searchValue = ref('');
  const searchType = ref(1);
  const placeholder = ref('搜索音乐、歌手、歌单');

  const setSearchValue = (value: string) => {
    searchValue.value = value;
  };

  const setSearchType = (type: number) => {
    searchType.value = type;
  };

  const setPlaceholder = (value: string) => {
    placeholder.value = value;
  };

  return {
    searchValue,
    searchType,
    placeholder,
    setSearchValue,
    setSearchType,
    setPlaceholder
  };
});
