"""Deploy Zephyrus Player web build to mucang.xyz via SSH using paramiko."""
import os
import paramiko

SERVER = os.environ.get("ZEPHYRUS_SSH_HOST", "mucang.xyz")
PORT = 22
USER = "root"
PASSWORD = os.environ.get("ZEPHYRUS_SSH_PASSWORD")
LOCAL_DIST = r"c:\Users\Administrator\Desktop\zephyrus-player-android\src\renderer\dist"
REMOTE_BASE = "/var/www/mucang/zephyrus/web"


def ssh_exec(ssh, cmd):
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out.strip():
        print(f"  [{cmd}] -> {out.strip()}")
    if err.strip():
        print(f"  [{cmd}] ERR: {err.strip()}")


def upload_dir(sftp, local, remote):
    """Recursively upload a directory via SFTP, skipping precompressed .gz
    duplicates and files already present with the same size (resumable).

    index.html 永远强制上传：SPA 入口只含资源 hash 文件名，hash 变化时
    文件大小可能完全相同，按 size 跳过会让服务器停留在旧构建。"""
    for item in os.listdir(local):
        if item.endswith(".gz"):
            continue
        local_path = os.path.join(local, item)
        remote_path = f"{remote}/{item}"
        if os.path.isdir(local_path):
            try:
                sftp.stat(remote_path)
            except FileNotFoundError:
                sftp.mkdir(remote_path)
            upload_dir(sftp, local_path, remote_path)
        else:
            local_size = os.path.getsize(local_path)
            if item != "index.html":
                try:
                    if sftp.stat(remote_path).st_size == local_size:
                        continue
                except FileNotFoundError:
                    pass
            sftp.put(local_path, remote_path)
            print(f"  uploaded: {item}")


def main():
    if not PASSWORD:
        raise SystemExit("Set ZEPHYRUS_SSH_PASSWORD before deploying web build")
    print(f"Connecting to {SERVER}:{PORT}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SERVER, port=PORT, username=USER, password=PASSWORD, timeout=15)
    print("Connected!")

    print("Creating remote directory...")
    ssh_exec(ssh, f"mkdir -p {REMOTE_BASE}")

    print(f"Uploading from {LOCAL_DIST} to {REMOTE_BASE} (resumable)...")
    transport = ssh.get_transport()
    sftp = paramiko.SFTPClient.from_transport(transport)
    upload_dir(sftp, LOCAL_DIST, REMOTE_BASE)
    sftp.close()
    print("Upload complete!")

    print("Ensuring readable permissions...")
    ssh_exec(ssh, f"chmod -R a+rX {REMOTE_BASE}")

    print("Verifying via HTTPS...")
    ssh_exec(
        ssh,
        "curl -s -o /dev/null -w 'index: %{http_code}\\n' "
        "https://www.mucang.xyz/zephyrus/web/ ; "
        "curl -s -o /dev/null -w 'manifest: %{http_code}\\n' "
        "https://www.mucang.xyz/zephyrus/web/manifest.json",
    )

    ssh.close()
    print("Deploy finished!")


if __name__ == "__main__":
    main()
