/**
 * 歌曲评论 Store (SongComment)
 *
 * 按歌曲缓存评论区（热门/最新两列 + 楼层），承载全部写操作
 * （发布/回复/删除/点赞）。写操作依赖 request 拦截器自动附加的
 * 登录 cookie；未登录时抛 CommentLoginRequiredError 由组件引导登录。
 */

import { createDiscreteApi } from 'naive-ui';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import {
  deleteSongComment,
  getCommentFloor,
  getSongComment,
  likeSongComment,
  postSongComment,
  replySongComment
} from '@/api/comment';
import type { SongComment } from '@/types/comment';

const { message } = createDiscreteApi(['message']);

export type CommentSort = 'hot' | 'latest';

export class CommentLoginRequiredError extends Error {
  constructor() {
    super('login required');
    this.name = 'CommentLoginRequiredError';
  }
}

const PAGE_SIZE = 30;

interface FloorState {
  comments: SongComment[];
  totalCount: number;
  /** 楼层分页游标（毫秒时间戳），-1 表首页 */
  cursor: number;
  finished: boolean;
  loading: boolean;
}

function isLoginRequired(code: number) {
  return code === 301 || code === 302;
}

function extractErrMsg(data: unknown, fallback: string): string {
  const body = data as { msg?: string; message?: string; description?: string } | null;
  return body?.msg || body?.message || body?.description || fallback;
}

export const useCommentStore = defineStore('songComment', () => {
  // ==================== State ====================
  const songId = ref('');
  const sort = ref<CommentSort>('hot');
  const total = ref(0);
  const hot = ref<SongComment[]>([]);
  const latest = ref<SongComment[]>([]);
  const hotFinished = ref(true); // 热评仅首页返回
  const latestFinished = ref(false);
  const loading = ref(false);
  const loadingMore = ref(false);
  const error = ref('');
  const submitting = ref(false);
  const floors = ref<Record<string, FloorState>>({});
  let latestOffset = 0;
  let requestId = 0;

  const isLoggedIn = computed(() => {
    try {
      return !!localStorage.getItem('token');
    } catch {
      return false;
    }
  });

  // ==================== Actions ====================
  function resetState(id: string) {
    songId.value = id;
    total.value = 0;
    hot.value = [];
    latest.value = [];
    hotFinished.value = true;
    latestFinished.value = false;
    latestOffset = 0;
    floors.value = {};
    error.value = '';
    requestId += 1;
  }

  /** 切歌加载首页（同曲已有数据时直接复用缓存） */
  async function loadComments(id: string) {
    if (!id) return;
    if (id === songId.value && (hot.value.length > 0 || latest.value.length > 0 || loading.value)) {
      return;
    }
    const generation = requestId + 1;
    resetState(id);
    requestId = generation;
    loading.value = true;
    try {
      const res = await getSongComment(id, PAGE_SIZE, 0);
      if (generation !== requestId) return;
      const data = res.data;
      total.value = Number(data?.total) || 0;
      hot.value = data?.hotComments ?? [];
      latest.value = data?.comments ?? [];
      latestFinished.value = !data?.more;
      latestOffset = latest.value.length;
      if (!hot.value.length && !latest.value.length) {
        error.value = 'empty';
      }
    } catch (err) {
      if (generation !== requestId) return;
      error.value = err instanceof Error ? err.message : String(err);
    } finally {
      if (generation === requestId) loading.value = false;
    }
  }

  /** 翻页加载更多（热评仅首页，翻页只作用于最新列） */
  async function loadMore(target: CommentSort = sort.value) {
    if (target !== 'latest' || latestFinished.value || loadingMore.value || loading.value) return;
    const generation = requestId;
    loadingMore.value = true;
    try {
      const res = await getSongComment(songId.value, PAGE_SIZE, latestOffset);
      if (generation !== requestId) return;
      const page = res.data?.comments ?? [];
      latest.value = latest.value.concat(page);
      latestFinished.value = !res.data?.more || page.length === 0;
      latestOffset += page.length;
    } catch (err) {
      if (generation === requestId) {
        message.error(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (generation === requestId) loadingMore.value = false;
    }
  }

  function setSort(value: CommentSort) {
    sort.value = value;
  }

  /** 刷新最新列首页（发布/回复/删除后调用） */
  async function refreshLatest() {
    const generation = requestId;
    try {
      const res = await getSongComment(songId.value, PAGE_SIZE, 0);
      if (generation !== requestId) return;
      const data = res.data;
      total.value = Number(data?.total) || total.value;
      latest.value = data?.comments ?? [];
      latestFinished.value = !data?.more;
      latestOffset = latest.value.length;
      if (sort.value === 'latest') hot.value = data?.hotComments ?? [];
    } catch {
      // 刷新失败保留旧列表
    }
  }

  /** 懒加载楼层回复（分页游标推进） */
  async function loadFloor(comment: SongComment) {
    const key = String(comment.commentId);
    const existing = floors.value[key];
    if (existing?.loading || (existing && existing.finished)) return;
    const state: FloorState = existing ?? {
      comments: [],
      totalCount: comment.replyCount ?? (comment.beReplied?.length ? comment.beReplied.length : 0),
      cursor: -1,
      finished: false,
      loading: true
    };
    state.loading = true;
    floors.value = { ...floors.value, [key]: state };
    try {
      const res = await getCommentFloor(comment.commentId, songId.value, state.cursor, 20);
      // 楼层接口返回 { code, data: { comments, totalCount, time } }
      const payload =
        (res.data as { data?: { comments?: SongComment[]; totalCount?: number; time?: number } })
          ?.data ?? res.data;
      const page = payload?.comments ?? [];
      state.comments = state.cursor <= 0 ? page : state.comments.concat(page);
      state.totalCount = Number(payload?.totalCount) || state.totalCount || page.length;
      const nextCursor = Number(payload?.time ?? -1);
      state.finished = nextCursor <= 0 || page.length === 0;
      state.cursor = state.finished ? -1 : nextCursor;
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
    } finally {
      state.loading = false;
      floors.value = { ...floors.value, [key]: state };
    }
  }

  /** 点赞/取消点赞（乐观更新，失败回滚） */
  async function toggleLike(comment: SongComment) {
    if (!isLoggedIn.value) throw new CommentLoginRequiredError();
    const next = !comment.liked;
    comment.liked = next;
    comment.likedCount = Math.max(0, comment.likedCount + (next ? 1 : -1));
    try {
      const res = await likeSongComment(songId.value, comment.commentId, next);
      const code = Number((res.data as { code?: number })?.code);
      if (isLoginRequired(code)) throw new CommentLoginRequiredError();
      if (code !== 200) throw new Error(extractErrMsg(res.data, '操作失败'));
    } catch (err) {
      comment.liked = !next;
      comment.likedCount = Math.max(0, comment.likedCount + (next ? -1 : 1));
      if (err instanceof CommentLoginRequiredError) throw err;
      message.error(err instanceof Error ? err.message : String(err));
    }
  }

  /** 发布评论；replyTo 存在时为楼层回复 */
  async function submitComment(content: string, replyTo?: SongComment) {
    const text = content.trim();
    if (!text || submitting.value) return;
    if (!isLoggedIn.value) throw new CommentLoginRequiredError();
    submitting.value = true;
    try {
      const res = replyTo
        ? await replySongComment(songId.value, replyTo.commentId, text)
        : await postSongComment(songId.value, text);
      const body = res.data as { code?: number; msg?: string };
      if (isLoginRequired(Number(body?.code))) throw new CommentLoginRequiredError();
      if (Number(body?.code) !== 200) {
        throw new Error(extractErrMsg(body, '发送失败'));
      }
      message.success(replyTo ? '回复成功' : '评论成功');
      await refreshLatest();
    } finally {
      submitting.value = false;
    }
  }

  /** 删除本人评论（本地移除 + 总数递减） */
  async function removeComment(comment: SongComment) {
    if (!isLoggedIn.value) throw new CommentLoginRequiredError();
    const res = await deleteSongComment(songId.value, comment.commentId);
    const body = res.data as { code?: number; msg?: string };
    if (isLoginRequired(Number(body?.code))) throw new CommentLoginRequiredError();
    if (Number(body?.code) !== 200) {
      throw new Error(extractErrMsg(body, '删除失败'));
    }
    const drop = (list: SongComment[]) =>
      list.filter((item) => item.commentId !== comment.commentId);
    hot.value = drop(hot.value);
    latest.value = drop(latest.value);
    total.value = Math.max(0, total.value - 1);
    message.success('已删除');
  }

  return {
    songId,
    sort,
    total,
    hot,
    latest,
    hotFinished,
    latestFinished,
    loading,
    loadingMore,
    error,
    submitting,
    floors,
    isLoggedIn,
    loadComments,
    loadMore,
    setSort,
    refreshLatest,
    loadFloor,
    toggleLike,
    submitComment,
    removeComment
  };
});
