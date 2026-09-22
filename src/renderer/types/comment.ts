// 网易云歌曲评论数据结构（/comment/* 端点返回）

export interface CommentUser {
  userId: number;
  nickname: string;
  avatarUrl: string;
  vipType?: number;
  locationInfo?: {
    province?: number;
    city?: number;
    alias?: string;
  } | null;
}

export interface BeRepliedItem {
  user: CommentUser;
  content: string;
}

export interface SongComment {
  user: CommentUser;
  commentId: number;
  content: string;
  /** 毫秒时间戳 */
  time: number;
  likedCount: number;
  liked: boolean;
  /** 楼层回复预览（comment/music 返回时携带） */
  beReplied?: BeRepliedItem[];
  /** 楼层回复总数（部分端点返回，缺失时以 /comment/floor 实查为准） */
  replyCount?: number;
}

export interface SongCommentThread {
  total: number;
  more: boolean;
  hotComments: SongComment[];
  comments: SongComment[];
  moreHot?: boolean;
  userId?: number;
}

export interface FloorCommentThread {
  comments?: SongComment[];
  totalCount?: number;
  /** 下一次楼层分页游标（毫秒时间戳），-1/缺失表示没有更多 */
  time?: number;
  ownerComment?: SongComment;
}
