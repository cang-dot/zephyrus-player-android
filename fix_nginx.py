"""Fix Nginx config: add location block to existing server for www.mucang.xyz."""
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
        print(f"  [{cmd[:80]}] -> {out.strip()[:200]}")
    if err.strip():
        print(f"  [{cmd[:80]}] ERR: {err.strip()[:200]}")
    return out

def main():
    print(f"Connecting to {SERVER}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SERVER, port=22, username=USER, password=PASSWORD, timeout=15)
    print("Connected!")

    # Remove the conflicting standalone server block
    print("Removing standalone zephyrus-docs server block...")
    ssh_exec(ssh, "rm -f /etc/nginx/sites-enabled/zephyrus-docs /etc/nginx/sites-available/zephyrus-docs")

    # Find existing config for mucang.xyz
    print("Finding existing Nginx config for mucang.xyz...")
    result = ssh_exec(ssh, "grep -rl 'mucang.xyz' /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null")
    config_files = [f.strip() for f in result.strip().split('\n') if f.strip()]
    print(f"  Found: {config_files}")

    if not config_files:
        # Try sites-available
        result = ssh_exec(ssh, "grep -rl 'mucang.xyz' /etc/nginx/sites-available/ 2>/dev/null")
        config_files = [f.strip() for f in result.strip().split('\n') if f.strip()]
        print(f"  Found in sites-available: {config_files}")

    for cfg in config_files:
        print(f"  Reading {cfg}...")
        stdin, stdout, stderr = ssh.exec_command(f"cat {cfg}")
        content = stdout.read().decode()
        print(f"  Config length: {len(content)} chars")

        # Check if location /zephyrus/docs/ already exists
        if "zephyrus/docs" in content:
            print(f"  Already has zephyrus/docs location, skipping")
            continue

        # Find the server block's closing brace and add location before it
        # Simple approach: find the last } before the end and insert before it
        location_block = f"""
    location /zephyrus/docs/ {{
        alias {REMOTE_BASE}/;
        index index.html;
        try_files $uri $uri/ $uri.html /zephyrus/docs/index.html;
    }}
"""

        # Find the last closing brace of the server block
        # We need to insert before the last } of the server { } block
        # A simple approach: find "server {" and its matching close
        lines = content.split('\n')
        insert_idx = None
        for i in range(len(lines) - 1, -1, -1):
            if lines[i].strip() == '}':
                insert_idx = i
                break

        if insert_idx is not None:
            lines.insert(insert_idx, location_block)
            new_content = '\n'.join(lines)

            # Write back
            ssh_exec(ssh, f"cp {cfg} {cfg}.bak")
            # Use a temp file to write
            import tempfile
            import os
            tmpfd, tmppath = tempfile.mkstemp()
            with os.fdopen(tmpfd, 'w') as f:
                f.write(new_content)

            transport = ssh.get_transport()
            sftp = paramiko.SFTPClient.from_transport(transport)
            sftp.put(tmppath, cfg)
            sftp.close()
            os.unlink(tmppath)
            print(f"  Updated {cfg}")
        else:
            print(f"  Could not find insertion point in {cfg}")

    # Test and reload Nginx
    print("Testing Nginx config...")
    ssh_exec(ssh, "nginx -t 2>&1")
    print("Reloading Nginx...")
    ssh_exec(ssh, "systemctl reload nginx")

    ssh.close()
    print("Done! Check http://www.mucang.xyz/zephyrus/docs/")

if __name__ == "__main__":
    main()
