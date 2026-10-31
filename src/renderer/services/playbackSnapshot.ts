import type { SongResult } from '@/types/music';

/**
 * 播放会话快照 —— 划掉后台恢复的落盘原子键
 *
 * 背景：player-core-store 是事件驱动写（起播后 1~5s 集中写完，播放期零写入），
 * iOS 上滑杀进程是 SIGKILL（不执行 beforeunload/pagehide），且 WKWebView 的
 * localStorage 惰性提交会把最近未 flush 的写入整批丢掉 → 磁盘停留在「上一首」。
 * 本服务以 ≤2s 粒度把「正在播的歌 + 进度」写进单个原子小键，写小且频繁，
 * 存活率远高于整包大写入；启动恢复时快照比 playMusic 持久化更新，优先采纳。
 */

const SNAPSHOT_KEY = 'player-session-snapshot';

export interface PlayerSessionSnapshot {
  songId: SongResult['id'];
  progress: number;
  updatedAt: number;
  song: SongResult;
}

/** 恢复所需最小曲目快照（对齐 playlist minifySong 口径，另保留 platform/playMusicUrl 供恢复链判定本地/云端） */
export function minifySongForSnapshot(s: SongResult): SongResult {
  return {
    id: s.id,
    name: s.name,
    picUrl: s.picUrl,
    ar: s.ar?.map((a) => ({ id: a.id, name: a.name })),
    al: s.al,
    source: s.source,
    platform: s.platform,
    dt: s.dt,
    playMusicUrl: s.playMusicUrl
  } as SongResult;
}

/**
 * 写入快照（同拍更新 playProgress：进度恢复的既有真源，seek 走它）。
 * song 无 id 时跳过；localStorage 异常静默（尽力而为的落盘）。
 */
export function writePlayerSessionSnapshot(song: SongResult | null | undefined, progress: number) {
  if (!song || song.id === null || song.id === undefined) return;
  try {
    const payload = JSON.stringify({
      songId: song.id,
      progress: Number.isFinite(progress) ? progress : 0,
      updatedAt: Date.now(),
      song: minifySongForSnapshot(song)
    });
    localStorage.setItem(SNAPSHOT_KEY, payload);
    localStorage.setItem(
      'playProgress',
      JSON.stringify({ songId: song.id, progress: Number.isFinite(progress) ? progress : 0 })
    );
  } catch {
    // 配额/序列化失败：尽力而为，不阻塞播放
  }
}

export function readPlayerSessionSnapshot(): PlayerSessionSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlayerSessionSnapshot;
    if (!parsed?.song || parsed.song.id === null || parsed.song.id === undefined) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * 只标记「会话当前曲」身份，不动 playProgress。
 * 切歌/过渡预写必须用这个：进度落盘是「每首歌上次听到哪」的既有语义（切歌不写、
 * 心跳/暂停/hidden 才写），若同拍覆盖为新歌 0，启动恢复链（handlePlayMusic 先于
 * playAudio 执行）会把真实进度抹成 0——进度恢复必丢。
 */
export function markSessionSnapshotSong(song: SongResult | null | undefined) {
  if (!song || song.id === null || song.id === undefined) return;
  try {
    const previous = readPlayerSessionSnapshot();
    const progress =
      previous && String(previous.songId) === String(song.id)
        ? Number(previous.progress) || 0
        : 0;
    const payload = JSON.stringify({
      songId: song.id,
      progress,
      updatedAt: Date.now(),
      song: minifySongForSnapshot(song)
    });
    localStorage.setItem(SNAPSHOT_KEY, payload);
  } catch {
    // 尽力而为
  }
}
