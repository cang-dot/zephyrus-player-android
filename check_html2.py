"""Check HTML structure on server."""
import paramiko
import sys

SERVER = "43.250.173.177"
USER = "root"
PASSWORD = "Du1xiang2yan3."

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SERVER, port=22, username=USER, password=PASSWORD, timeout=15)

    # Check favicon link in HTML
    stdin, stdout, stderr = ssh.exec_command("grep -i 'icon' /var/www/zephyrus/docs/index.html | head -5")
    out = stdout.read().decode('utf-8', errors='replace')
    sys.stdout.buffer.write(b"=== Favicon ===\n")
    sys.stdout.buffer.write(out.encode('utf-8'))
    sys.stdout.buffer.write(b"\n")

    # Check icon.png exists
    stdin, stdout, stderr = ssh.exec_command("ls -la /var/www/zephyrus/docs/icon.png 2>/dev/null")
    out = stdout.read().decode('utf-8', errors='replace')
    sys.stdout.buffer.write(b"=== icon.png ===\n")
    sys.stdout.buffer.write(out.encode('utf-8'))
    sys.stdout.buffer.write(b"\n")

    # Check CSS files
    stdin, stdout, stderr = ssh.exec_command("ls /var/www/zephyrus/docs/assets/*.css 2>/dev/null")
    out = stdout.read().decode('utf-8', errors='replace')
    sys.stdout.buffer.write(b"=== CSS files ===\n")
    sys.stdout.buffer.write(out.encode('utf-8'))
    sys.stdout.buffer.write(b"\n")

    # Check the custom CSS content
    stdin, stdout, stderr = ssh.exec_command("grep -r 'border-radius' /var/www/zephyrus/docs/assets/*.css 2>/dev/null | head -5")
    out = stdout.read().decode('utf-8', errors='replace')
    sys.stdout.buffer.write(b"=== border-radius in CSS ===\n")
    sys.stdout.buffer.write(out.encode('utf-8'))
    sys.stdout.buffer.write(b"\n")

    ssh.close()

if __name__ == "__main__":
    main()
