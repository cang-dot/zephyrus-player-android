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

import { fetchBilibiliComments } from '@/api/bilibili';
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
  /** 盖楼树：一级回复（含挂载的楼中楼 children） */
  tree: FloorNode[];
  /** 树扁平化（带深度）后的行：渲染用——保证任何层级的回复都可见 */
  rows: Array<{ comment: SongComment; depth: number }>;
  /** 分批渲染：当前显示的行数 */
  revealed: number;
  totalCount: number;
  /** 楼层分页游标（毫秒时间戳），-1 表首页 */
  cursor: number;
  finished: boolean;
  loading: boolean;
}

/** 盖楼节点：一级回复 + 挂在其下的楼中楼 */
export interface FloorNode {
  comment: SongComment;
  children: SongComment[];
}

/** 从平铺楼层回复解析盖楼树（只对关系明确的盖楼）：
 *  1. beReplied 预览与楼层内条目对撞（userId+内容）→ parent = 被回复者
 *  2. 内容 "@昵称" 前缀匹配楼层内评论者昵称 → parent = 该评论者
 *  3. 无明确 parent（含回复主评论自身的）→ 一级回复
 *  根解析沿 parent 链上溯（visited 防环）——楼层内互回（A→B→A）不会让全部
 *  回复沉没为无根节点（那会让"展开回复"渲染出空框）。 */
export function buildFloorTree(replies: SongComment[]): FloorNode[] {
  const byId = new Map<string, SongComment>();
  const byUserContent = new Map<string, SongComment>();
  for (const reply of replies) {
    byId.set(String(reply.commentId), reply);
    byUserContent.set(`${reply.user?.userId}|${reply.content}`, reply);
  }
  const nickIndex = new Map<string, SongComment>();
  for (const reply of replies) {
    const nick = reply.user?.nickname;
    if (nick && !nickIndex.has(nick)) nickIndex.set(nick, reply);
  }

  // 第一遍：确定每条回复的 parent（楼层内被回复者的 commentId；无明确关系 = null）
  const parentOf = new Map<string, string | null>();
  for (const reply of replies) {
    const selfId = String(reply.commentId);
    const preview = reply.beReplied?.[0];
    let parent: string | null = null;
    if (preview) {
      const hit =
        byUserContent.get(`${preview.user?.userId}|${preview.content}`) ||
        byUserContent.get(`|${preview.content}`);
      const hitId = hit ? String(hit.commentId) : null;
      if (hitId && hitId !== selfId) parent = hitId;
    }
    if (!parent) {
      const atMatch = /^@([^\s：:]+)[：:]?\s*/.exec(reply.content || '');
      if (atMatch) {
        const hit = nickIndex.get(atMatch[1]);
        const hitId = hit ? String(hit.commentId) : null;
        if (hitId && hitId !== selfId) parent = hitId;
      }
    }
    parentOf.set(selfId, parent);
  }

  // 第二遍：根 = parent 链的顶端（上溯到无 parent；visited 防环，环首当根）
  const rootOf = (id: string): string => {
    let cur = id;
    const seen = new Set<string>();
    for (;;) {
      if (seen.has(cur)) return cur;
      seen.add(cur);
      const p = parentOf.get(cur);
      if (!p || !byId.has(p) || p === cur) return cur;
      cur = p;
    }
  };

  // 建节点与挂接：楼中楼挂到**直接被回复者**的节点（语义：回复谁就挂在谁下）
  const byNodeComment = new Map<string, FloorNode>();
  const order: FloorNode[] = [];
  for (const reply of replies) {
    const node: FloorNode = { comment: reply, children: [] };
    byNodeComment.set(String(reply.commentId), node);
    if (rootOf(String(reply.commentId)) === String(reply.commentId)) order.push(node);
  }
  for (const reply of replies) {
    const parentId = parentOf.get(String(reply.commentId));
    if (!parentId) continue;
    const parentNode = byNodeComment.get(parentId);
    const selfNode = byNodeComment.get(String(reply.commentId))!;
    if (parentNode && parentNode !== selfNode) parentNode.children.push(selfNode.comment);
  }
  return order;
}

/** 树扁平化：根按原序，子回复缩进一层（楼中楼视觉），递归所有层级 */
function flattenFloorTree(nodes: FloorNode[], depth = 0): Array<{ comment: SongComment; depth: number }> {
  const rows: Array<{ comment: SongComment; depth: number }> = [];
  for (const node of nodes) {
    rows.push({ comment: node.comment, depth });
    if (node.children.length) rows.push(...flattenFloorTree(node.children, depth + 1));
  }
  return rows;
}

const FLOOR_PAGE_SIZE = 20;
const FLOOR_REVEAL_STEP = 10;
const FLOOR_REVEAL_INIT = 10;

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
  /** 热门接口无内容（冷门歌曲）：隐藏热门/最近滑块并固定在最新列 */
  const hotUnavailable = ref(false);
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
    hotUnavailable.value = false;
    latestOffset = 0;
    floors.value = {};
    error.value = '';
    requestId += 1;
  }

  /**
   * 回复关系反向回填：/comment/music 只把「被回复内容预览」（beReplied）挂在
   * 回复者身上，被回复的原评论自身没有任何回复标识，导致「A 回复 B」里 A 显示
   * 一条引用而 B 永远没有「展开回复」入口。这里用内容+用户匹配把回复数
   * 写回被回复者（commentId 无法直接从预览拿到，以内容对撞近似）。
   */
  function backfillReplyCounts() {
    const all = [...hot.value, ...latest.value];
    for (const reply of all) {
      const previews = reply.beReplied ?? [];
      if (!previews.length) continue;
      for (const preview of previews) {
        const target = all.find(
          (item) =>
            item.commentId !== reply.commentId &&
            item.user?.userId === preview.user?.userId &&
            item.content === preview.content
        );
        if (target && !target.replyCount) {
          target.replyCount = Math.max(1, Number(reply.replyCount) || previews.length);
        }
      }
    }
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

    // 哔哩哔哩视频：走 B 站评论接口（旧版，匿名可读）
    if (id.startsWith('bilibili:')) {
      loading.value = true;
      try {
        const bvid = id.slice('bilibili:'.length);
        const info = await (await import('@/api/bilibili')).getBilibiliVideoInfo(bvid);
        const result = await fetchBilibiliComments(info.aid || 0, 1);
        if (generation !== requestId) return;
        total.value = result.total;
        latest.value = result.replies.map((r: any) => ({
          user: { userId: r.mid, avatarUrl: r.avatarUrl, nickname: r.nickname },
          commentId: r.rpid,
          content: r.content,
          time: r.ctime,
          likedCount: r.likedCount,
          liked: false,
          beReplied: (r.replies || []).map((sub: any) => ({
            user: { userId: 0, avatarUrl: sub.avatarUrl, nickname: sub.nickname },
            content: sub.content
          })),
          replyCount: (r.replies || []).length
        }));
        latestFinished.value = true; // 旧接口无分页游标，一期只展示第一页
        if (!latest.value.length) error.value = 'empty';
      } catch (err) {
        if (generation !== requestId) return;
        error.value = err instanceof Error ? err.message : String(err);
      } finally {
        if (generation === requestId) loading.value = false;
      }
      return;
    }

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
      backfillReplyCounts();
      // 冷门歌曲：热门接口不返回内容 → 降级到最新列并隐藏热门/最近滑块
      if (!hot.value.length && latest.value.length) {
        hotUnavailable.value = true;
        sort.value = 'latest';
      }
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

  /** 懒加载楼层回复（分页游标推进），每页到达后重建盖楼树 */
  async function loadFloor(comment: SongComment) {
    const key = String(comment.commentId);
    const existing = floors.value[key];
    if (existing?.loading || (existing && existing.finished)) return;
    const state: FloorState = existing ?? {
      comments: [],
      tree: [],
      revealed: FLOOR_REVEAL_INIT,
      totalCount: comment.replyCount ?? (comment.beReplied?.length ? comment.beReplied.length : 0),
      cursor: -1,
      finished: false,
      loading: true
    };
    state.loading = true;
    floors.value = { ...floors.value, [key]: state };
    try {
      const res = await getCommentFloor(comment.commentId, songId.value, state.cursor, FLOOR_PAGE_SIZE);
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
      state.tree = buildFloorTree(state.comments);
      state.rows = flattenFloorTree(state.tree);
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
    } finally {
      state.loading = false;
      floors.value = { ...floors.value, [key]: state };
    }
  }

  /** 楼层分批渲染：每次多显示一批 */
  function revealMoreFloor(comment: SongComment) {
    const state = floors.value[String(comment.commentId)];
    if (!state) return;
    state.revealed = Math.min(state.rows.length, state.revealed + FLOOR_REVEAL_STEP);
    floors.value = { ...floors.value, [String(comment.commentId)]: state };
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
    hotUnavailable,
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
    revealMoreFloor,
    toggleLike,
    submitComment,
    removeComment
  };
});
