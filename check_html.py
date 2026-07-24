"""Check the actual HTML output to debug CSS issues."""
import paramiko

SERVER = "43.250.173.177"
USER = "root"
PASSWORD = "Du1xiang2yan3."

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SERVER, port=22, username=USER, password=PASSWORD, timeout=15)

    # Check the generated index.html for hero image structure
    stdin, stdout, stderr = ssh.exec_command("grep -A5 'VPImage\\|hero\\|image' /var/www/zephyrus/docs/index.html | head -30")
    print("=== Hero image in HTML ===")
    print(stdout.read().decode())

    # Check if custom.css exists in the build output
    stdin, stdout, stderr = ssh.exec_command("ls /var/www/zephyrus/docs/assets/*.css 2>/dev/null")
    print("=== CSS files ===")
    print(stdout.read().decode())

    # Check favicon link
    stdin, stdout, stderr = ssh.exec_command("grep -i 'icon\\|favicon' /var/www/zephyrus/docs/index.html")
    print("=== Favicon in HTML ===")
    print(stdout.read().decode())

    # Check if icon.png exists at the right path
    stdin, stdout, stderr = ssh.exec_command("ls -la /var/www/zephyrus/docs/icon.png 2>/dev/null")
    print("=== icon.png ===")
    print(stdout.read().decode())

    ssh.close()

if __name__ == "__main__":
    main()
