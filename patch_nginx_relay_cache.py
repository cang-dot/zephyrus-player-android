import sys

path = '/etc/nginx/sites-enabled/mucang'
src = open(path).read()
if 'zephyrus/relay.html' in src:
    print('ALREADY_PATCHED')
    sys.exit(0)
anchor = '    # NetEase Music API proxy for relay page'
if anchor not in src:
    print('ANCHOR_NOT_FOUND')
    sys.exit(1)
patch = (
    '    # relay 中转页是分享入口,更新需立即生效,禁止浏览器缓存旧版\n'
    '    location = /zephyrus/relay.html {\n'
    '        add_header Cache-Control "no-cache";\n'
    '    }\n'
    '\n'
)
open(path, 'w').write(src.replace(anchor, patch + anchor, 1))
print('PATCHED')
