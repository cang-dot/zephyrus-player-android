"""Debug: check and fix Nginx config on server."""
import paramiko

SERVER = "43.250.173.177"
USER = "root"
PASSWORD = "Du1xiang2yan3."
REMOTE_BASE = "/var/www/zephyrus/docs"

def ssh_exec(ssh, cmd):
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out.strip():
        print(f"[{cmd}]\n{out}")
    if err.strip():
        print(f"[{cmd}] ERR:\n{err}")
    return out

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SERVER, port=22, username=USER, password=PASSWORD, timeout=15)

    # Show current config
    print("=== Current mucang config ===")
    ssh_exec(ssh, "cat /etc/nginx/sites-available/mucang")

    # Show enabled sites
    print("\n=== Enabled sites ===")
    ssh_exec(ssh, "ls -la /etc/nginx/sites-enabled/")

    # Check if files exist
    print("\n=== Check docs files ===")
    ssh_exec(ssh, f"ls {REMOTE_BASE}/ | head -10")

    # Try a simpler location block - rewrite the entire config
    print("\n=== Rewriting config ===")
    new_config = """server {
    listen 80;
    server_name mucang.xyz www.mucang.xyz;

    root /var/www/mucang;
    index index.html;

    # Zephyrus docs
    location /zephyrus/docs/ {
        alias /var/www/zephyrus/docs/;
        index index.html;
        try_files $uri $uri/ $uri.html /zephyrus/docs/index.html;
    }

    location / {
        try_files $uri $uri/ =404;
    }
}
"""
    # Write the new config
    import tempfile, os
    tmpfd, tmppath = tempfile.mkstemp()
    with os.fdopen(tmpfd, 'w') as f:
        f.write(new_config)

    transport = ssh.get_transport()
    sftp = paramiko.SFTPClient.from_transport(transport)
    sftp.put(tmppath, "/etc/nginx/sites-available/mucang")
    sftp.close()
    os.unlink(tmppath)

    # Test and reload
    print("\n=== Test Nginx ===")
    ssh_exec(ssh, "nginx -t 2>&1")
    print("\n=== Reload Nginx ===")
    ssh_exec(ssh, "systemctl reload nginx")

    # Verify with curl
    print("\n=== Curl test ===")
    ssh_exec(ssh, "curl -s -o /dev/null -w '%{http_code}' http://localhost/zephyrus/docs/")
    ssh_exec(ssh, "curl -s http://localhost/zephyrus/docs/ | head -5")

    ssh.close()
    print("\nDone!")

if __name__ == "__main__":
    main()
