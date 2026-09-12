"""Zephyrus 云端歌曲上传工具

用法:
  python upload_server_music.py <音频文件...> [--prefix PREFIX] [--check] [--yes]

流程:
  1. 读取每个音频文件的基础数据(时长/格式/大小)与元数据(ID3 / Vorbis 注释: 标题、艺术家、专辑、年份、作曲家、曲目、内嵌封面)
  2. 与线上 songs.json 做冲突检测(重复 id / 同标题歌曲)
  3. 展示待上传清单, 等待用户确认
  4. 确认后经 SFTP 上传音频与封面到 /var/www/mucang/server-music/, 并把新条目合并写入 songs.json

选项:
  --prefix PREFIX  新条目 id 前缀, 默认 "song" (id 形如 PREFIX_001)
  --check          只读取并展示元数据与冲突, 不连接服务器、不上传
  --yes            跳过交互确认直接上传

环境变量:
  ZEPHYRUS_SSH_PASSWORD  服务器 root 密码(必填, 与 deploy_web.py 一致)
"""
import json
import os
import re
import sys

import mutagen

SONGS_JSON_URL = "https://www.mucang.xyz/server-music/songs.json"
REMOTE_DIR = "/var/www/mucang/server-music"
REMOTE_JSON = f"{REMOTE_DIR}/songs.json"
SERVER = "mucang.xyz"

TAG_KEYS = [
    ("title", ["TIT2", "title", "\xa9nam"]),
    ("artist", ["TPE1", "artist", "\xa9ART"]),
    ("album", ["TALB", "album", "\xa9alb"]),
    ("year", ["TDRC", "TYER", "date", "\xa9day"]),
    ("composer", ["TCOM", "composer", "\xa9wrt"]),
    ("track", ["TRCK", "tracknumber", "trkn"]),
]


def read_meta(path: str) -> dict:
    """读取单个音频文件的基础数据与元数据, 返回 dict 或抛出异常."""
    base = os.path.basename(path)
    ext = os.path.splitext(base)[1].lower()
    m = mutagen.File(path, easy=False)
    if m is None:
        raise ValueError(f"无法识别音频格式: {base}")

    meta = {
        "file": base,
        "ext": ext,
        "size": os.path.getsize(path),
        "duration": round(float(getattr(m.info, "length", 0) or 0) * 1000),
        "title": None,
        "artist": None,
        "album": None,
        "year": None,
        "composer": None,
        "track": None,
        "has_picture": False,
    }

    if ext == ".flac":
        pic = getattr(m, "pictures", None)
        meta["has_picture"] = bool(pic and pic[0].data)
    else:
        try:
            pics = m.tags.getall("APIC") if m.tags else []
            meta["has_picture"] = bool(pics and pics[0].data)
        except Exception:
            meta["has_picture"] = False

    tag_map = {}
    try:
        if m.tags:
            for key, val in m.tags.items():
                tag_map.setdefault(key.lower(), val)
    except Exception:
        pass

    for field, keys in TAG_KEYS:
        text = None
        for k in keys:
            v = m.tags.get(k) if m.tags else None
            if v is None and k in tag_map:
                v = tag_map[k]
            if v is not None:
                # FLAC/Vorbis 注释值为 list, 取首个
                raw = v[0] if isinstance(v, list) else v
                text = str(raw).strip("\x00 ").replace("\x00", "").strip()
                break
        if text and field == "year":
            # 完整日期(如 2006-02-28)只保留年份
            import re as _re

            m_year = _re.match(r"\d{4}", text)
            text = m_year.group(0) if m_year else text
        meta[field] = text or None

    return meta


def fmt_duration(ms: int) -> str:
    s = ms // 1000
    return f"{s // 60}:{s % 60:02d}"


def fmt_bytes(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


def extract_lyrics(path: str, ext: str) -> tuple:
    """提取内嵌歌词. 返回 (lyrics_text, lyrics_ext) 或 (None, None).

    - MP3: USLT 标签文本; 若以 <tt 开头视为 TTML, 存 .ttml, 否则存 .lrc
    - FLAC: Vorbis lyrics 标签(通常为 LRC)
    """
    m = mutagen.File(path, easy=False)
    text = None
    if ext == ".flac":
        if getattr(m, "tags", None) and "lyrics" in m.tags:
            v = m.tags["lyrics"]
            text = v[0] if isinstance(v, list) else v
            text = str(text).strip()
    else:
        if m.tags:
            uslt = m.tags.getall("USLT")
            if uslt:
                text = str(uslt[0].text).strip()
    if not text:
        return None, None
    lyr_ext = ".ttml" if text.lstrip().startswith("<tt") else ".lrc"
    return text, lyr_ext


def preview(metas: list[dict], prefix: str) -> list[dict]:
    items = []
    for i, meta in enumerate(metas, 1):
        item = {
            "index": i,
            "file": meta["file"],
            "ext": meta["ext"],
            "id": f"{prefix}_{i:03d}",
            "name": meta.get("title") or os.path.splitext(meta["file"])[0],
            "artist": meta.get("artist") or "未知艺术家",
            "album": meta.get("album") or "",
            "year": meta.get("year"),
            "composer": meta.get("composer"),
            "track": meta.get("track"),
            "duration": meta["duration"],
            "has_picture": meta["has_picture"],
        }
        items.append(item)
    return items


def print_preview(items: list[dict]):
    print("=" * 78)
    print(f"共 {len(items)} 个文件, 待上传到 {SERVER}{REMOTE_DIR}")
    print("=" * 78)
    for it in items:
        extra = []
        if it["year"]:
            extra.append(f"年份={it['year']}")
        if it["composer"]:
            extra.append(f"作曲={it['composer']}")
        if it["track"]:
            extra.append(f"曲目={it['track']}")
        print(f"[{it['index']}] {it['file']}")
        print(f"     id={it['id']}  时长={fmt_duration(it['duration'])}  大小={fmt_bytes(it['file_size'])}")
        print(f"     标题={it['name']}  艺术家={it['artist']}  专辑={it['album'] or '(无)'}")
        if extra:
            print(f"     元数据: {'; '.join(extra)}")
        lyric_note = (
            f"内嵌歌词(将提取为{it['lyrics_ext'].lstrip('.')})"
            if it.get("lyrics")
            else "无内嵌歌词"
        )
        print(f"     封面={'内嵌(将提取)' if it['has_picture'] else '无内嵌封面 -> 跳过封面, 使用默认封面'}")
        print(f"     歌词={lyric_note}")
    print("=" * 78)


def fetch_remote_songs() -> list[dict]:
    import urllib.request

    with urllib.request.urlopen(SONGS_JSON_URL, timeout=20) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data.get("songs", [])


def check_conflicts(items: list[dict], remote_songs: list[dict], force: bool) -> bool:
    remote_names = {str(s.get("name", "")).strip() for s in remote_songs}
    remote_ids = {str(s.get("id", "")).strip() for s in remote_songs}
    warned = False
    ok = []
    for it in items:
        if str(it["name"]).strip() in remote_names or it["id"] in remote_ids:
            if not force:
                warned = True
                print(f"(跳过) 「{it['name']}」(id={it['id']}) 与线上已有歌曲冲突, 使用 --force 覆盖")
                continue
        ok.append(it)
    items[:] = ok
    return warned


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    args = sys.argv[1:]
    prefix = "song"
    check_only = False
    force = False
    auto_yes = False
    paths = []
    i = 0
    while i < len(args):
        arg = args[i]
        if arg == "--check":
            check_only = True
        elif arg == "--force":
            force = True
        elif arg == "--yes":
            auto_yes = True
        elif arg.startswith("--prefix="):
            prefix = arg.split("=", 1)[1].strip() or "song"
        elif arg == "--prefix":
            if i + 1 < len(args):
                prefix = args[i + 1].strip() or "song"
                i += 1
            else:
                print("--prefix 缺少值")
                sys.exit(1)
        elif arg.startswith("--"):
            print(f"未知选项: {arg}")
        else:
            paths.append(arg)
        i += 1

    if not paths:
        print("未提供任何音频文件路径")
        sys.exit(1)

    for p in paths:
        if not os.path.isfile(p):
            print(f"文件不存在: {p}")
            sys.exit(1)

    metas = []
    for p in paths:
        try:
            metas.append(read_meta(p))
        except Exception as e:
            print(f"解析失败 {p}: {e}")
            sys.exit(1)

    items = preview(metas, prefix)
    for it, meta in zip(items, metas):
        it["file_size"] = meta["size"]
        it["lyrics"], it["lyrics_ext"] = extract_lyrics(
            next(p for p in paths if os.path.basename(p) == it["file"]), meta["ext"]
        )

    remote_songs = []
    if not check_only:
        try:
            remote_songs = fetch_remote_songs()
            print(f"线上现有歌曲: {len(remote_songs)} 首")
        except Exception as e:
            print(f"读取线上 songs.json 失败: {e}")
            sys.exit(1)
    check_conflicts(items, remote_songs, force)
    if not items:
        print("没有待上传的条目")
        sys.exit(0)

    print_preview(items)

    if check_only:
        print("[--check] 仅检查模式, 未上传")
        return

    if not auto_yes:
        answer = input("确认上传以上条目? [y/N] ").strip().lower()
        if answer not in ("y", "yes"):
            print("已取消")
            sys.exit(0)

    password = os.environ.get("ZEPHYRUS_SSH_PASSWORD")
    if not password:
        print("需要环境变量 ZEPHYRUS_SSH_PASSWORD(与 deploy_web.py 相同)")
        sys.exit(1)

    import paramiko
    from pathlib import Path
    import socket

    socket.setdefaulttimeout(60)

    def make_conn():
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(SERVER, port=22, username="root", password=password, timeout=30)
        return ssh, ssh.open_sftp()

    def upload_resumable(sftp, src, remote, chunk=512 * 1024):
        """分块 + 断点续传: 每块写入后落盘, 连接断开后重连可从远程已传大小继续.
        避免大文件单连接长时间停滞(服务器间歇断开 10054/EOF)导致无限重传."""
        size = os.path.getsize(src)
        try:
            remote_size = sftp.stat(remote).st_size
        except IOError:
            remote_size = 0
        if remote_size == size:
            return
        if remote_size > size:
            # 续传叠加导致远程文件过大: 删除后从零重传
            print(f"      (远程文件异常偏大 {remote_size}, 删除重传)")
            sftp.remove(remote)
            remote_size = 0
        with open(src, "rb") as f:
            f.seek(remote_size)
            with sftp.open(remote, "ab") as rf:
                while True:
                    data = f.read(chunk)
                    if not data:
                        break
                    rf.write(data)
        # 核对最终大小
        if sftp.stat(remote).st_size != size:
            raise OSError("size mismatch after resume upload")

    def upload_one(sftp, it, src):
        if it["lyrics"] and it["lyrics_ext"]:
            lyrics_remote = f"{REMOTE_DIR}/lyrics_{it['id']}{it['lyrics_ext']}"
            with sftp.open(lyrics_remote, "wb") as fh:
                fh.write(it["lyrics"].encode("utf-8"))
            print(f"-> 上传歌词 {lyrics_remote}")
        audio_remote = f"{REMOTE_DIR}/{it['id']}{it['ext']}"
        print(f"-> 上传音频 {it['file']} ...")
        upload_resumable(sftp, src, audio_remote)
        print(f"   -> {audio_remote}")
        if it["has_picture"]:
            try:
                m = mutagen.File(src, easy=False)
                pic_data = None
                if it["ext"] == ".flac":
                    pic_data = m.pictures[0].data if m.pictures else None
                else:
                    pics = m.tags.getall("APIC") if m.tags else []
                    if pics:
                        pic_data = pics[0].data
                if pic_data:
                    cover_remote = f"{REMOTE_DIR}/cover_{it['id']}.jpg"
                    with sftp.open(cover_remote, "wb") as fh:
                        fh.write(pic_data)
                    print(f"   -> {cover_remote} (封面)")
                else:
                    print(f"   (跳过封面: 未取到图片数据)")
            except Exception as e:
                print(f"   (封面提取/上传失败, 已跳过: {e})")

    ssh, sftp = make_conn()
    print("已连接服务器")
    try:
        for it, meta in zip(items, metas):
            src = next(p for p in paths if os.path.basename(p) == it["file"])
            # 服务器会间歇性断开长连接(10054)。每首歌独立连接,
            # 断开后重建连接重试, 单文件最多 5 次
            for attempt in range(1, 6):
                try:
                    upload_one(sftp, it, src)
                    break
                except (EOFError, OSError, socket.error) as e:
                    print(f"   (连接中断, 第 {attempt} 次重试: {type(e).__name__})")
                    try:
                        sftp.close()
                    except Exception:
                        pass
                    try:
                        ssh.close()
                    except Exception:
                        pass
                    ssh, sftp = make_conn()
            else:
                raise RuntimeError(f"文件连续失败: {it['file']}")

        line = [json.loads(s) if isinstance(s, str) else s for s in remote_songs]
        existing_ids = {str(s.get("id", "")) for s in line}
        for it in items:
            if it["id"] in existing_ids:
                print(f"   (已存在于线上 songs.json, 跳过录入: {it['id']})")
                continue
            existing_ids.add(it["id"])
            entry = {
                "id": it["id"],
                "name": it["name"],
                "artists": [it["artist"]],
                "album": it["album"] or "",
                "duration": it["duration"],
                "audioUrl": f"https://www.mucang.xyz/server-music/{it['id']}{it['ext']}",
            }
            if it["year"]:
                entry["year"] = it["year"]
            if it["composer"]:
                entry["composer"] = it["composer"]
            if it["track"]:
                entry["track"] = it["track"]
            if it["has_picture"]:
                entry["picUrl"] = f"https://www.mucang.xyz/server-music/cover_{it['id']}.jpg"
            if it["lyrics"] and it["lyrics_ext"]:
                entry["lyricsUrl"] = (
                    f"https://www.mucang.xyz/server-music/lyrics_{it['id']}{it['lyrics_ext']}"
                )
            line.append(entry)

        local_json = Path("songs.json").resolve()
        with open(local_json, "w", encoding="utf-8") as fh:
            json.dump({"songs": line}, fh, ensure_ascii=False, indent=2)
        sftp.put(str(local_json), REMOTE_JSON)
        print(f"-> 已更新 {REMOTE_JSON} (共 {len(line)} 首)")
        os.remove(local_json)

        ssh.exec_command(f"chmod -R a+rX {REMOTE_DIR}")
        import urllib.request

        with urllib.request.urlopen(SONGS_JSON_URL, timeout=20) as resp:
            verify = json.loads(resp.read().decode("utf-8"))
            print(f"验证通过: 线上 songs.json 现有 {len(verify.get('songs', []))} 首")
    finally:
        try:
            sftp.close()
        except Exception:
            pass
        try:
            ssh.close()
        except Exception:
            pass


if __name__ == "__main__":
    main()