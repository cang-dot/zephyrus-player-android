"""Fix: add redirect from /zephyrus/docs to /zephyrus/docs/ and ensure location matching."""
import paramiko
import tempfile
import os

SERVER = "43.250.173.177"
USER = "root"
PASSWORD = "Du1xiang2yan3."

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SERVER, port=22, username=USER, password=PASSWORD, timeout=15)

    config = """server {
    server_name mucang.xyz www.mucang.xyz;
    root /var/www/mucang;
    index index.html;

    # Redirect /zephyrus/docs -> /zephyrus/docs/
    location = /zephyrus/docs {
        return 301 /zephyrus/docs/;
    }

    # Zephyrus docs
    location /zephyrus/docs/ {
        alias /var/www/zephyrus/docs/;
        index index.html;
        try_files $uri $uri/ $uri.html /zephyrus/docs/index.html;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Thymos Climax API
    location /api/ {
        proxy_pass http://127.0.0.1:30188/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass_request_body on;
        proxy_pass_request_headers on;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/mucang.xyz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mucang.xyz/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    if ($host = www.mucang.xyz) {
        return 301 https://$host$request_uri;
    }

    if ($host = mucang.xyz) {
        return 301 https://$host$request_uri;
    }

    listen 80;
    server_name mucang.xyz www.mucang.xyz;
    return 404;
}
"""

    tmpfd, tmppath = tempfile.mkstemp()
    with os.fdopen(tmpfd, 'w') as f:
        f.write(config)

    transport = ssh.get_transport()
    sftp = paramiko.SFTPClient.from_transport(transport)
    sftp.put(tmppath, "/etc/nginx/sites-available/mucang")
    sftp.close()
    os.unlink(tmppath)

    stdin, stdout, stderr = ssh.exec_command("nginx -t 2>&1")
    result = stdout.read().decode() + stderr.read().decode()
    print(f"Nginx test: {result}")

    if "successful" in result:
        stdin, stdout, stderr = ssh.exec_command("systemctl reload nginx")
        print("Nginx reloaded!")

    # Test both URLs
    for url in ["https://localhost/zephyrus/docs", "https://localhost/zephyrus/docs/"]:
        stdin, stdout, stderr = ssh.exec_command(f"curl -sk -o /dev/null -w '%{{http_code}}' {url}")
        code = stdout.read().decode().strip()
        print(f"{url} -> {code}")

    ssh.close()
    print("Done!")

if __name__ == "__main__":
    main()
