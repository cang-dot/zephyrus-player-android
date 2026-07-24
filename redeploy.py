"""Redeploy VitePress docs to server."""
import paramiko
import os

SERVER = "43.250.173.177"
USER = "root"
PASSWORD = "Du1xiang2yan3."
LOCAL_DIST = r"c:\Users\Administrator\Desktop\zephyrus-player-android\website\.vitepress\dist"
REMOTE_BASE = "/var/www/zephyrus/docs"

def ssh_exec(ssh, cmd):
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out.strip(): print(f"  [{cmd[:60]}] -> {out.strip()[:100]}")
    if err.strip(): print(f"  [{cmd[:60]}] ERR: {err.strip()[:100]}")

def upload_dir(sftp, local, remote):
    for item in os.listdir(local):
        local_path = os.path.join(local, item)
        remote_path = f"{remote}/{item}"
        if os.path.isdir(local_path):
            try: sftp.stat(remote_path)
            except: sftp.mkdir(remote_path)
            upload_dir(sftp, local_path, remote_path)
        else:
            sftp.put(local_path, remote_path)

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SERVER, port=22, username=USER, password=PASSWORD, timeout=15)
    print("Connected!")

    ssh_exec(ssh, f"rm -rf {REMOTE_BASE}/*")
    transport = ssh.get_transport()
    sftp = paramiko.SFTPClient.from_transport(transport)
    upload_dir(sftp, LOCAL_DIST, REMOTE_BASE)
    sftp.close()
    print("Upload complete!")

    ssh_exec(ssh, "systemctl reload nginx")
    ssh.close()
    print("Done!")

if __name__ == "__main__":
    main()
