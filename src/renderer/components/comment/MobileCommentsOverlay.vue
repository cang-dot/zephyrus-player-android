<template>
  <section
    v-if="overlayMounted"
    class="mobile-comments-overlay"
    :style="[overlayTransformStyle, { paddingBottom: `${keyboardOverlap}px` }]"
    @click.stop
    @dblclick.stop
  >
    <header class="comments-chrome no-toggle">
      <button
        type="button"
        class="chrome-close no-toggle"
        :aria-label="t('player.commentPanel.close')"
        @click="closePage"
      >
        <i class="ri-close-line" />
      </button>
      <div class="chrome-song">
        <strong class="chrome-name">{{ songName }}</strong>
        <span v-if="commentStore.total > 0" class="chrome-count">
          {{
            t('player.commentPanel.commentsCount', {
              n: formatNumber(commentStore.total)
            })
          }}
        </span>
      </div>
      <div class="comments-sort" role="tablist">
        <button
          type="button"
          role="tab"
          :aria-selected="commentStore.sort === 'hot'"
          :class="{ active: commentStore.sort === 'hot' }"
          @click="commentStore.setSort('hot')"
        >
          {{ t('player.commentPanel.hot') }}
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="commentStore.sort === 'latest'"
          :class="{ active: commentStore.sort === 'latest' }"
          @click="commentStore.setSort('latest')"
        >
          {{ t('player.commentPanel.latest') }}
        </button>
      </div>
    </header>

    <div class="comments-body">
      <div ref="scrollRef" class="comments-scroll">
        <div v-if="commentStore.loading" class="comments-state">
          <i class="ri-loader-4-line spin" />
        </div>
        <div v-else-if="commentStore.error && list.length === 0" class="comments-state">
          <p>{{ t('player.commentPanel.loadFailed') }}</p>
          <button type="button" class="state-action" @click="reload">
            {{ t('player.commentPanel.retry') }}
          </button>
        </div>
        <div v-else-if="list.length === 0" class="comments-state">
          <p>{{ t('player.commentPanel.empty') }}</p>
        </div>
        <template v-else>
          <article v-for="comment in list" :key="comment.commentId" class="comment-item">
            <img class="comment-avatar" :src="avatarUrl(comment)" loading="lazy" alt="" />
            <div class="comment-main">
              <div class="comment-meta">
                <span class="comment-nick">{{ comment.user.nickname }}</span>
                <time class="comment-time">{{ formatTime(comment.time) }}</time>
              </div>
              <p class="comment-content">{{ comment.content }}</p>
              <div v-if="comment.beReplied && comment.beReplied.length" class="comment-quote">
                <span>
                  @{{ comment.beReplied[0].user.nickname }}：{{ comment.beReplied[0].content }}
                </span>
              </div>
              <div class="comment-actions">
                <button
                  type="button"
                  class="like-btn"
                  :class="{ liked: comment.liked }"
                  @click="onLike(comment)"
                >
                  <i :class="comment.liked ? 'ri-heart-3-fill' : 'ri-heart-3-line'" />
                  <span>{{ formatNumber(comment.likedCount) }}</span>
                </button>
                <button type="button" class="reply-btn" @click="startReply(comment)">
                  <i class="ri-chat-3-line" />
                  <span>{{ t('player.commentPanel.reply') }}</span>
                </button>
                <button
                  v-if="isMine(comment)"
                  type="button"
                  class="delete-btn"
                  :aria-label="t('player.commentPanel.delete')"
                  @click="onDelete(comment)"
                >
                  <i class="ri-delete-bin-6-line" />
                </button>
              </div>
              <div v-if="floorOf(comment)" class="comment-floor">
                <div
                  v-for="floorItem in floorOf(comment)!.comments"
                  :key="floorItem.commentId"
                  class="floor-item"
                >
                  <span class="floor-nick">{{ floorItem.user.nickname }}：</span>
                  <span class="floor-content">{{ floorItem.content }}</span>
                </div>
                <button
                  v-if="!floorOf(comment)!.finished"
                  type="button"
                  class="floor-more"
                  @click="expandFloor(comment)"
                >
                  <i v-if="floorOf(comment)!.loading" class="ri-loader-4-line spin" />
                  <template v-else>
                    {{
                      t('player.commentPanel.expandReplies', {
                        n: formatNumber(floorOf(comment)!.totalCount)
                      })
                    }}
                    <i class="ri-arrow-down-s-line" />
                  </template>
                </button>
              </div>
              <button
                v-else-if="replyTotal(comment) > 0"
                type="button"
                class="floor-trigger"
                @click="expandFloor(comment)"
              >
                {{
                  t('player.commentPanel.expandReplies', { n: formatNumber(replyTotal(comment)) })
                }}
                <i class="ri-arrow-down-s-line" />
              </button>
            </div>
          </article>
          <div ref="sentinelRef" class="comments-sentinel">
            <i v-if="commentStore.loadingMore" class="ri-loader-4-line spin" />
            <span v-else-if="commentStore.sort === 'latest' && commentStore.latestFinished">
              {{ t('player.commentPanel.noMore') }}
            </span>
          </div>
        </template>
      </div>

      <!-- 边缘渐进模糊：两层短距 backdrop-filter + 渐变 mask，模拟 Apple 式边缘质感 -->
      <div class="edge-blur blur-soft edge-top" aria-hidden="true"></div>
      <div class="edge-blur blur-strong edge-top" aria-hidden="true"></div>
      <div class="edge-blur blur-soft edge-bottom" aria-hidden="true"></div>
      <div class="edge-blur blur-strong edge-bottom" aria-hidden="true"></div>
    </div>

    <footer
      class="comments-composer no-toggle"
      :style="{ '--composer-extend': `${controlsInset}px` }"
    >
      <template v-if="commentStore.isLoggedIn">
        <div v-if="replyTarget" class="composer-context">
          <span>{{ t('player.commentPanel.replyTo', { name: replyTarget.user.nickname }) }}</span>
          <button type="button" :aria-label="t('player.commentPanel.cancel')" @click="cancelReply">
            <i class="ri-close-line" />
          </button>
        </div>
        <div class="composer-row">
          <input
            ref="inputRef"
            v-model="draft"
            type="text"
            maxlength="500"
            :placeholder="replyTarget ? '' : t('player.commentPanel.saySomething')"
            @keydown.enter.prevent="send"
          />
          <button
            type="button"
            class="composer-send"
            :disabled="!draft.trim() || commentStore.submitting"
            @click="send"
          >
            {{ t('player.commentPanel.send') }}
          </button>
        </div>
      </template>
      <button v-else type="button" class="composer-login" @click="goLogin">
        <i class="ri-user-3-line" />
        {{ t('player.commentPanel.loginToComment') }}
      </button>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { useWindowSize } from '@vueuse/core';
import { createDiscreteApi } from 'naive-ui';
import type { CSSProperties } from 'vue';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import type { LyricSwipeGestureApi } from '@/composables/useLyricSwipeGesture';
import { readPageSwipeDirection } from '@/composables/useLyricSwipeGesture';
import { useMobilePlayerTransition } from '@/composables/useMobilePlayerTransition';
import { playMusic } from '@/hooks/MusicHook';
import { registerMobileBackLayer } from '@/services/mobileBackStack';
import type { CommentSort } from '@/store/modules/comment';
import { CommentLoginRequiredError, useCommentStore } from '@/store/modules/comment';
import { usePlayerStore } from '@/store/modules/player';
import { useUserStore } from '@/store/modules/user';
import type { SongComment } from '@/types/comment';
import { formatNumber, getImgUrl } from '@/utils';

const { message, dialog } = createDiscreteApi(['message', 'dialog']);

const props = defineProps<{
  /** 评论页手势实例（由宿主样式播放器创建并绑定 capture 事件） */
  gesture: LyricSwipeGestureApi;
  /** 底部控制条避让高度(px)，缺省按横竖屏取 96/168 */
  bottomInset?: number;
}>();

const { t } = useI18n();
const router = useRouter();
const playerStore = usePlayerStore();
const userStore = useUserStore();
const commentStore = useCommentStore();
const playerTransition = useMobilePlayerTransition();

const { width: viewportWidth, height: viewportHeight } = useWindowSize();

// ── 配置感知：showCommentSection 开关与评论页方位 ──
const featureOn = ref(false);
const side = ref<'left' | 'right'>('left');
const refreshConfig = () => {
  featureOn.value = readPageSwipeDirection('comments') !== 'none';
  side.value = readPageSwipeDirection('comments') === 'right' ? 'right' : 'left';
};

const isOpen = computed(() => featureOn.value && playerStore.fullCommentsVisible);
// 手势预览/落位期间保持挂载，避免收尾瞬间闪断
const overlayMounted = computed(
  () => featureOn.value && (isOpen.value || props.gesture.previewing.value)
);

// 进出场 transform 直接复用手势实例的 overlayStyle（跟手 + 弹簧落位）
const overlayTransformStyle = computed(() => props.gesture.overlayStyle.value as CSSProperties);

const songName = computed(() => playMusic.value?.name || '');
const list = computed(() => (commentStore.sort === 'hot' ? commentStore.hot : commentStore.latest));

// 键盘避让：键盘弹出时按 visualViewport 的收缩量给整列加 padding-bottom，
// 输入条（flex 末项）与内容区一起抬到键盘上方
const keyboardOverlap = ref(0);
const updateKeyboardOverlap = () => {
  const vv = window.visualViewport;
  if (!vv) {
    keyboardOverlap.value = 0;
    return;
  }
  keyboardOverlap.value = Math.max(0, Math.round(window.innerHeight - (vv.height + vv.offsetTop)));
};

// 需要让出的播放控件高度：输入条面板垫在控件后面一直延伸到屏底（连续表面），
// 评论页打开期间共享底面已整体让位（chromeVisibility 归零），无需避让控件，
// 输入行直接落底；底面淡出(180ms)快于输入行下落(350ms)，无重叠窗口
const controlsInset = computed(() => {
  if (playerStore.fullCommentsVisible) return 0;
  if (!playerTransition.controlsVisible.value) return 0;
  return viewportWidth.value > viewportHeight.value ? 96 : (props.bottomInset ?? 168);
});

/** 右上角关闭按钮：走手势动画收起 */
const closePage = () => props.gesture.animateClose();

// ── 数据加载 ──
watch(isOpen, (open) => {
  if (open) void commentStore.loadComments(String(playerStore.currentSong?.id ?? ''));
});
watch(
  () => String(playerStore.currentSong?.id ?? ''),
  (id, prev) => {
    if (isOpen.value && id && id !== prev) void commentStore.loadComments(id);
  }
);

function reload() {
  void commentStore.loadComments(String(playerStore.currentSong?.id ?? ''));
}

// ── 楼层 ──
const floorOf = (comment: SongComment) => commentStore.floors[String(comment.commentId)];
const replyTotal = (comment: SongComment) =>
  floorOf(comment)?.totalCount ?? comment.replyCount ?? comment.beReplied?.length ?? 0;
const expandFloor = (comment: SongComment) => void commentStore.loadFloor(comment);

// ── 互动 ──
const isMine = (comment: SongComment) =>
  !!userStore.user?.userId && comment.user.userId === userStore.user.userId;
const avatarUrl = (comment: SongComment) => getImgUrl(comment.user?.avatarUrl, '60y60');

function promptLogin() {
  message.warning(t('player.commentPanel.loginRequired'));
}

const onLike = (comment: SongComment) => {
  commentStore.toggleLike(comment).catch((err: unknown) => {
    if (err instanceof CommentLoginRequiredError) promptLogin();
  });
};

// ── 回复与发送 ──
const draft = ref('');
const replyTarget = ref<SongComment | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);

const startReply = (comment: SongComment) => {
  replyTarget.value = comment;
  void nextTick(() => inputRef.value?.focus());
};
const cancelReply = () => {
  replyTarget.value = null;
};

const send = () => {
  const target = replyTarget.value;
  void commentStore
    .submitComment(draft.value, target ?? undefined)
    .then(() => {
      draft.value = '';
      replyTarget.value = null;
    })
    .catch((err: unknown) => {
      if (err instanceof CommentLoginRequiredError) promptLogin();
      else if (err instanceof Error) message.error(err.message);
    });
};

const onDelete = (comment: SongComment) => {
  dialog.warning({
    title: t('player.commentPanel.delete'),
    content: t('player.commentPanel.deleteConfirm'),
    positiveText: t('player.commentPanel.delete'),
    negativeText: t('player.commentPanel.cancel'),
    onPositiveClick: () => {
      commentStore.removeComment(comment).catch((err: unknown) => {
        if (err instanceof CommentLoginRequiredError) promptLogin();
        else if (err instanceof Error) message.error(err.message);
      });
    }
  });
};

const goLogin = () => {
  router.push({ path: '/user', query: { panel: 'login' } });
};

// ── 加载更多哨兵 ──
const sentinelRef = ref<HTMLElement | null>(null);
const scrollRef = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;
watch([overlayMounted, () => commentStore.sort], async () => {
  await nextTick();
  observer?.disconnect();
  if (overlayMounted.value && sentinelRef.value) observer?.observe(sentinelRef.value);
});

// 热门/最新各自记忆滚动进度，切换时保存旧页、恢复新页，互不共享
const tabScrollTops: Record<CommentSort, number> = { hot: 0, latest: 0 };
watch(
  () => commentStore.sort,
  async (next, prev) => {
    if (scrollRef.value) tabScrollTops[prev] = scrollRef.value.scrollTop;
    await nextTick();
    if (scrollRef.value) scrollRef.value.scrollTop = tabScrollTops[next] ?? 0;
  }
);

// ── Android 返回栈：评论页优先于播放器兜底层(500)，让位于歌词层(510) ──
let unregisterBackLayer: (() => void) | null = null;
onMounted(() => {
  refreshConfig();
  window.addEventListener('music-full-config-updated', refreshConfig);
  window.visualViewport?.addEventListener('resize', updateKeyboardOverlap);
  window.visualViewport?.addEventListener('scroll', updateKeyboardOverlap);
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void commentStore.loadMore();
    },
    { rootMargin: '240px' }
  );
  unregisterBackLayer = registerMobileBackLayer({
    id: 'player-comments-page',
    priority: 505,
    isActive: () => isOpen.value,
    onBack: () => {
      props.gesture.animateClose();
      return true;
    }
  });
});
onBeforeUnmount(() => {
  window.removeEventListener('music-full-config-updated', refreshConfig);
  window.visualViewport?.removeEventListener('resize', updateKeyboardOverlap);
  window.visualViewport?.removeEventListener('scroll', updateKeyboardOverlap);
  observer?.disconnect();
  observer = null;
  unregisterBackLayer?.();
  unregisterBackLayer = null;
});

// ── 相对时间 ──
const formatTime = (ms: number) => {
  const diff = Date.now() - ms;
  const minute = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;
  if (diff < minute) return t('player.commentPanel.justNow');
  if (diff < hour) return t('player.commentPanel.minutesAgo', { n: Math.floor(diff / minute) });
  if (diff < day) return t('player.commentPanel.hoursAgo', { n: Math.floor(diff / hour) });
  if (diff < day * 2) return t('player.commentPanel.yesterday');
  if (diff < day * 30) return t('player.commentPanel.daysAgo', { n: Math.floor(diff / day) });
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
</script>

<style scoped lang="scss">
.mobile-comments-overlay {
  position: absolute;
  inset: 0;
  z-index: var(--comments-overlay-z, 41);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* 皮肤表面可能继承居中排版，评论页统一左对齐 */
  text-align: left;
  /* 毛玻璃页面：与共享底面同一套玻璃语言，压暗保证任意样式背景上的可读性 */
  background: var(--comments-glass-background, rgba(14, 14, 16, 0.38));
  border-top: 1px solid var(--player-glass-border, rgba(255, 255, 255, 0.1));
  color: var(--player-glass-text, #fff);
  backdrop-filter: var(--comments-glass-filter, blur(18px) saturate(135%));
  -webkit-backdrop-filter: var(--comments-glass-filter, blur(18px) saturate(135%));
  will-change: transform, opacity;
}

@supports not (backdrop-filter: blur(1px)) {
  .mobile-comments-overlay {
    background: var(--comments-glass-fallback, rgba(20, 20, 22, 0.86));
  }
}

.comments-chrome {
  position: relative;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: 10px;
  padding: calc(var(--safe-area-inset-top, 0px) + 14px) 60px 10px 18px;
  border-bottom: 1px solid var(--player-glass-border, rgba(255, 255, 255, 0.08));

  .chrome-close {
    position: absolute;
    top: calc(var(--safe-area-inset-top, 0px) + 10px);
    right: 10px;
    display: grid;
    width: 34px;
    height: 34px;
    padding: 0;
    border: 1px solid var(--player-glass-border, rgba(255, 255, 255, 0.14));
    border-radius: 50%;
    background: var(--player-glass-background, rgba(255, 255, 255, 0.07));
    color: var(--player-glass-text, #fff);
    font-size: 18px;
    place-items: center;
  }
}

.chrome-song {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;

  .chrome-name {
    overflow: hidden;
    font-size: 17px;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chrome-count {
    flex-shrink: 0;
    color: var(--player-glass-text-secondary, rgba(255, 255, 255, 0.6));
    font-size: 12px;
  }
}

.comments-sort {
  display: inline-flex;
  align-self: flex-start;
  gap: 4px;
  padding: 3px;
  border-radius: 999px;
  background: var(--player-glass-background, rgba(255, 255, 255, 0.08));

  button {
    padding: 5px 16px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--player-glass-text-secondary, rgba(255, 255, 255, 0.62));
    font-size: 13px;
    transition:
      background-color 220ms var(--m-ease-drawer, cubic-bezier(0.32, 0.72, 0, 1)),
      color 220ms ease;

    &.active {
      background: var(--player-glass-background-active, rgba(255, 255, 255, 0.16));
      color: var(--player-glass-text, #fff);
      font-weight: 600;
    }
  }
}

.comments-body {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.comments-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 6px 18px 12px;
  /* 渐隐只做输入框正上方的短收尾（24px），内容可见到输入条上缘；
     主要的边缘质感交给渐模糊条带，避免大段透明带造成「内容被截断」观感 */
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent,
    #000 18px,
    #000 calc(100% - 24px),
    transparent calc(100% - 4px)
  );
  mask-image: linear-gradient(
    to bottom,
    transparent,
    #000 18px,
    #000 calc(100% - 24px),
    transparent calc(100% - 4px)
  );
  touch-action: pan-y;
}

/* 渐进模糊条带：离边缘越近模糊越强（soft 层长而浅，strong 层短而深），
   pointer-events 关闭以保证滚动与点击不受影响 */
.edge-blur {
  position: absolute;
  right: 0;
  left: 0;
  z-index: 2;
  pointer-events: none;
}

/* 毛玻璃已下线：边缘渐隐条带随 blur 一起失效（保留元素与布局，效果改由内容自身淡出承担） */
.blur-soft {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.blur-strong {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.edge-top.blur-soft {
  top: 0;
  height: 96px;
  -webkit-mask-image: linear-gradient(to bottom, #000, transparent);
  mask-image: linear-gradient(to bottom, #000, transparent);
}

.edge-top.blur-strong {
  top: 0;
  height: 44px;
  -webkit-mask-image: linear-gradient(to bottom, #000, transparent);
  mask-image: linear-gradient(to bottom, #000, transparent);
}

.edge-bottom.blur-soft {
  bottom: 0;
  height: 96px;
  -webkit-mask-image: linear-gradient(to top, #000, transparent);
  mask-image: linear-gradient(to top, #000, transparent);
}

.edge-bottom.blur-strong {
  bottom: 0;
  height: 44px;
  -webkit-mask-image: linear-gradient(to top, #000, transparent);
  mask-image: linear-gradient(to top, #000, transparent);
}

.comments-state {
  display: grid;
  padding: 64px 0;
  color: var(--player-glass-text-secondary, rgba(255, 255, 255, 0.6));
  font-size: 14px;
  justify-items: center;
  row-gap: 12px;

  .state-action {
    padding: 6px 22px;
    border: 1px solid var(--player-glass-border, rgba(255, 255, 255, 0.16));
    border-radius: 999px;
    background: var(--player-glass-background, rgba(255, 255, 255, 0.06));
    color: var(--player-glass-text, #fff);
    font-size: 13px;
  }
}

.comment-item {
  display: flex;
  gap: 12px;
  padding: 14px 0;

  + .comment-item {
    border-top: 1px solid var(--player-glass-border, rgba(255, 255, 255, 0.06));
  }
}

.comment-avatar {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  object-fit: cover;
}

.comment-main {
  flex: 1;
  min-width: 0;
}

.comment-meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;

  .comment-nick {
    overflow: hidden;
    color: var(--player-glass-text-secondary, rgba(255, 255, 255, 0.66));
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .comment-time {
    flex-shrink: 0;
    color: var(--player-glass-text-secondary, rgba(255, 255, 255, 0.38));
    font-size: 11px;
  }
}

.comment-content {
  padding-top: 4px;
  font-size: 14px;
  line-height: 1.55;
  white-space: pre-line;
  word-break: break-word;
}

.comment-quote {
  margin-top: 8px;
  padding: 8px 10px;
  border-left: 2px solid var(--player-glass-border, rgba(255, 255, 255, 0.18));
  border-radius: 6px;
  background: var(--player-glass-background, rgba(255, 255, 255, 0.05));
  color: var(--player-glass-text-secondary, rgba(255, 255, 255, 0.55));
  font-size: 12px;
}

.comment-actions {
  display: flex;
  align-items: center;
  gap: 18px;
  padding-top: 8px;

  button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--player-glass-text-secondary, rgba(255, 255, 255, 0.55));
    font-size: 12px;

    i {
      font-size: 15px;
    }
  }

  .like-btn.liked {
    color: var(--accent-color, #fa233b);
  }

  .delete-btn {
    margin-left: auto;
  }
}

.floor-trigger,
.floor-more {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 6px 0 0;
  border: 0;
  background: transparent;
  color: var(--accent-color, #4e6ef2);
  font-size: 12px;
}

.comment-floor {
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--player-glass-background, rgba(255, 255, 255, 0.05));

  .floor-item {
    padding: 3px 0;
    font-size: 13px;
    line-height: 1.5;

    .floor-nick {
      color: var(--player-glass-text-secondary, rgba(255, 255, 255, 0.55));
    }
  }

  .floor-more {
    padding-top: 8px;
  }
}

.comments-sentinel {
  display: grid;
  min-height: 32px;
  color: var(--player-glass-text-secondary, rgba(255, 255, 255, 0.4));
  font-size: 12px;
  justify-items: center;
}

.comments-composer {
  /* flex 末项：天然紧贴内容区底缘，内容区高度止于输入条上缘，
     不会再出现「内容与输入条之间的空白」；输入行靠 padding 让出控件高度，
     玻璃面板则垫在控件后面一路延伸到屏底，形成连续表面 */
  position: relative;
  z-index: 3;
  flex-shrink: 0;
  padding: 8px 14px calc(8px + var(--safe-area-inset-bottom, 0px) + var(--composer-extend, 0px));
  border-top: 1px solid var(--player-glass-border, rgba(255, 255, 255, 0.08));
  background: var(--comments-glass-background, rgba(14, 14, 16, 0.38));
  backdrop-filter: var(--comments-glass-filter, blur(18px) saturate(135%));
  -webkit-backdrop-filter: var(--comments-glass-filter, blur(18px) saturate(135%));
  /* 播放控件显隐时延伸段平滑伸缩（同一动画语言） */
  transition: padding-bottom 350ms var(--m-ease-drawer, cubic-bezier(0.32, 0.72, 0, 1));
}

.composer-context {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 6px;
  color: var(--player-glass-text-secondary, rgba(255, 255, 255, 0.6));
  font-size: 12px;

  button {
    padding: 2px;
    border: 0;
    background: transparent;
    color: inherit;
    font-size: 14px;
  }
}

.composer-row {
  display: flex;
  gap: 10px;

  input {
    flex: 1;
    min-width: 0;
    padding: 9px 14px;
    border: 1px solid var(--player-glass-border, rgba(255, 255, 255, 0.14));
    border-radius: 999px;
    background: var(--player-glass-background, rgba(255, 255, 255, 0.07));
    color: var(--player-glass-text, #fff);
    font-size: 14px;
    outline: none;

    &::placeholder {
      color: var(--player-glass-text-secondary, rgba(255, 255, 255, 0.38));
    }
  }

  .composer-send {
    flex-shrink: 0;
    padding: 0 18px;
    border: 0;
    border-radius: 999px;
    background: var(--accent-color, #4e6ef2);
    color: #fff;
    font-size: 13px;
    font-weight: 600;

    &:disabled {
      opacity: 0.4;
    }
  }
}

.composer-login {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  border: 1px solid var(--player-glass-border, rgba(255, 255, 255, 0.14));
  border-radius: 999px;
  background: var(--player-glass-background, rgba(255, 255, 255, 0.07));
  color: var(--player-glass-text, #fff);
  font-size: 13px;
}

.spin {
  display: inline-block;
  animation: comments-loading-spin 0.8s linear infinite;
}

@keyframes comments-loading-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .comments-sort button,
  .spin {
    transition: none;
    animation: none;
  }
}
</style>
