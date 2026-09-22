import type { SongCommentThread } from '@/types/comment';
import request from '@/utils/request';

// resourceTypeMap 里 0 = R_SO_4_（歌曲评论线程）
const RESOURCE_TYPE_SONG = 0;

/**
 * 歌曲评论（热门 + 最新首页）
 */
export const getSongComment = (id: number | string, limit = 30, offset = 0) =>
  request.get<SongCommentThread>('/comment/music', { params: { id, limit, offset } });

/**
 * 楼层回复列表（time 为上一页返回的游标，-1 表首页）
 */
export const getCommentFloor = (
  parentCommentId: number | string,
  id: number | string,
  time = -1,
  limit = 20
) => request.get('/comment/floor', { params: { parentCommentId, id, time, limit } });

/**
 * 发表歌曲评论
 */
export const postSongComment = (id: number | string, content: string) =>
  request.post('/comment', { t: 1, type: RESOURCE_TYPE_SONG, id, content });

/**
 * 回复评论（楼层内回复同样走 t=2，commentId 为被回复的评论 ID）
 */
export const replySongComment = (
  id: number | string,
  commentId: number | string,
  content: string
) => request.post('/comment', { t: 2, type: RESOURCE_TYPE_SONG, id, commentId, content });

/**
 * 删除自己的评论
 */
export const deleteSongComment = (id: number | string, commentId: number | string) =>
  request.post('/comment', { t: 0, type: RESOURCE_TYPE_SONG, id, commentId });

/**
 * 点赞 / 取消点赞评论
 */
export const likeSongComment = (id: number | string, cid: number | string, like: boolean) =>
  request.post('/comment/like', { t: like ? 1 : 0, type: RESOURCE_TYPE_SONG, id, cid });
