"""Deploy VitePress docs to server via SSH using paramiko."""
import os
import paramiko
import stat as stat_mod

SERVER = "43.250.173.177"
PORT = 22
USER = "root"
PASSWORD = "Du1xiang2yan3."
LOCAL_DIST = r"c:\Users\Administrator\Desktop\zephyrus-player-android\website\.vitepress\dist"
REMOTE_BASE = "/var/www/zephyrus/docs"

def ssh_exec(ssh, cmd):
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out.strip():
        print(f"  [{cmd}] -> {out.strip()}")
    if err.strip():
        print(f"  [{cmd}] ERR: {err.strip()}")

def upload_dir(sftp, local, remote):
    """Recursively upload a directory via SFTP."""
    for item in os.listdir(local):
        local_path = os.path.join(local, item)
        remote_path = f"{remote}/{item}"
        if os.path.isdir(local_path):
            try:
                sftp.stat(remote_path)
            except FileNotFoundError:
                sftp.mkdir(remote_path)
            upload_dir(sftp, local_path, remote_path)
        else:
            sftp.put(local_path, remote_path)
            print(f"  uploaded: {item}")

def main():
    print(f"Connecting to {SERVER}:{PORT}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SERVER, port=PORT, username=USER, password=PASSWORD, timeout=15)
    print("Connected!")

    # Create remote directory
    print("Creating remote directories...")
    ssh_exec(ssh, f"mkdir -p {REMOTE_BASE}")

    # Clean old content
    print("Cleaning old content...")
    ssh_exec(ssh, f"rm -rf {REMOTE_BASE}/*")

    # Upload files
    print(f"Uploading from {LOCAL_DIST} to {REMOTE_BASE}...")
    transport = ssh.get_transport()
    sftp = paramiko.SFTPClient.from_transport(transport)
    upload_dir(sftp, LOCAL_DIST, REMOTE_BASE)
    sftp.close()
    print("Upload complete!")

    # Configure Nginx
    print("Configuring Nginx...")
    nginx_conf = f"""server {{
    listen 80;
    server_name www.mucang.xyz mucang.xyz;

    location /zephyrus/docs/ {{
        alias {REMOTE_BASE}/;
        index index.html;
        try_files $uri $uri/ $uri.html /zephyrus/docs/index.html;
    }}
}}
"""
    # Write nginx config
    ssh_exec(ssh, f"echo '{nginx_conf}' > /etc/nginx/sites-available/zephyrus-docs")
    ssh_exec(ssh, "ln -sf /etc/nginx/sites-available/zephyrus-docs /etc/nginx/sites-enabled/zephyrus-docs")
    ssh_exec(ssh, "nginx -t 2>&1")
    ssh_exec(ssh, "systemctl reload nginx")
    print("Nginx configured!")

    ssh.close()
    print("Deployment complete!")
    print(f"Docs available at: http://www.mucang.xyz/zephyrus/docs/")

if __name__ == "__main__":
    main()
