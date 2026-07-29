#!/bin/bash
#
# APK Release Agent
# 每日从 GitHub Release 下载最新 APK，保留 30 天滑动窗口，
# 并更新文档页面中的下载链接。
#
# 部署位置: /opt/zephyrus-agent/apk-release-agent.sh
# Cron: 0 3 * * * /opt/zephyrus-agent/apk-release-agent.sh >> /var/log/zephyrus-agent.log 2>&1
#

set -uo pipefail

# ==================== 配置 ====================
GITHUB_REPO="cang-dot/zephyrus-player-android"
GITHUB_TOKEN="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"
APK_DIR="/var/www/zephyrus/apks"
DOCS_DIR="/var/www/zephyrus/docs"
DOCS_INSTALL_HTML="${DOCS_DIR}/guide/installation.html"
MAX_AGE_DAYS=30
BASE_URL="https://mucang.xyz/zephyrus/apks"

# ==================== 日志 ====================
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# ==================== 步骤 0: 确保 nginx 配置 ====================
setup_nginx() {
    # 查找包含 zephyrus/docs 的 nginx 配置文件
    local NGINX_CONFIG=""
    for f in /etc/nginx/sites-enabled/*; do
        if grep -q "zephyrus/docs" "$f" 2>/dev/null; then
            NGINX_CONFIG="$f"
            break
        fi
    done

    if [ -z "$NGINX_CONFIG" ]; then
        log "警告: 未找到包含 zephyrus/docs 的 nginx 配置文件"
        return 0
    fi

    if grep -q "zephyrus/apks" "$NGINX_CONFIG" 2>/dev/null; then
        log "nginx /zephyrus/apks/ 配置已存在"
        return 0
    fi

    log "添加 nginx /zephyrus/apks/ location 配置到 $NGINX_CONFIG ..."
    cp "$NGINX_CONFIG" "${NGINX_CONFIG}.bak"

    # 在 docs location 之前插入 apks location
    sed -i '/location \/zephyrus\/docs\//i\    # Zephyrus APK downloads\n    location /zephyrus/apks/ {\n        alias /var/www/zephyrus/apks/;\n        autoindex on;\n        types { application/vnd.android.package-archive apk; }\n        add_header Access-Control-Allow-Origin "*";\n    }\n' "$NGINX_CONFIG"

    if nginx -t 2>/dev/null; then
        systemctl reload nginx
        log "nginx 配置已更新并重载"
    else
        log "错误: nginx 配置测试失败，恢复备份"
        cp "${NGINX_CONFIG}.bak" "$NGINX_CONFIG"
        nginx -t 2>/dev/null && systemctl reload nginx
    fi
}

# ==================== 步骤 1: 获取最新 Release ====================
log "=== 开始执行 APK Release Agent ==="

setup_nginx

log "正在获取 GitHub 最新 Release..."
API_URL="https://api.github.com/repos/${GITHUB_REPO}/releases/latest"
RELEASE_JSON=$(curl -sf \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    "$API_URL" 2>/dev/null)

if [ -z "$RELEASE_JSON" ]; then
    log "错误: 无法获取 Release 信息"
    exit 1
fi

TAG_NAME=$(echo "$RELEASE_JSON" | jq -r '.tag_name')
RELEASE_DATE=$(echo "$RELEASE_JSON" | jq -r '.published_at')
HTML_URL=$(echo "$RELEASE_JSON" | jq -r '.html_url')

log "最新 Release: $TAG_NAME (发布于 $RELEASE_DATE)"

# 查找 APK asset（private 仓库需要用 API asset URL 下载）
ASSET_URL=$(echo "$RELEASE_JSON" | jq -r '.assets[] | select(.name | test("\\.apk$")) | .url' | head -1)
APK_NAME=$(echo "$RELEASE_JSON" | jq -r '.assets[] | select(.name | test("\\.apk$")) | .name' | head -1)

if [ -z "$ASSET_URL" ] || [ "$ASSET_URL" = "null" ]; then
    log "Release $TAG_NAME 没有找到 APK 文件，跳过"
    exit 0
fi

log "APK 文件: $APK_NAME"
log "Asset API URL: $ASSET_URL"

# ==================== 步骤 2: 下载 APK ====================
mkdir -p "$APK_DIR"

# 带版本号的文件名: zephyrus-player-v1.0.5.apk
VERSIONED_NAME="zephyrus-player-${TAG_NAME}.apk"
TARGET_PATH="${APK_DIR}/${VERSIONED_NAME}"

if [ -f "$TARGET_PATH" ]; then
    log "版本 $TAG_NAME 已存在，跳过下载"
else
    log "正在下载 $VERSIONED_NAME ..."
    TMP_PATH="${APK_DIR}/.downloading_${VERSIONED_NAME}"
    # private 仓库需要通过 API asset URL + Accept: octet-stream 下载
    if curl -sfL --max-time 300 \
        -H "Authorization: Bearer ${GITHUB_TOKEN}" \
        -H "Accept: application/octet-stream" \
        -o "$TMP_PATH" "$ASSET_URL"; then
        mv "$TMP_PATH" "$TARGET_PATH"
        log "下载完成: $TARGET_PATH ($(du -h "$TARGET_PATH" | cut -f1))"
    else
        log "错误: 下载失败"
        rm -f "$TMP_PATH"
        exit 1
    fi
fi

# 创建/更新 latest 软链接
ln -sf "$VERSIONED_NAME" "${APK_DIR}/zephyrus-player-latest.apk"
log "已更新 latest 软链接 -> $VERSIONED_NAME"

# ==================== 步骤 3: 清理超过 30 天的旧 APK ====================
log "清理超过 ${MAX_AGE_DAYS} 天的旧 APK..."
find "$APK_DIR" -name "zephyrus-player-*.apk" -type f -mtime +${MAX_AGE_DAYS} -print -delete | while read -r old_file; do
    log "删除旧文件: $(basename "$old_file")"
done

# 列出当前保留的 APK
log "当前保留的 APK 文件:"
ls -lht "$APK_DIR"/zephyrus-player-*.apk 2>/dev/null | while read -r line; do
    log "  $line"
done

# ==================== 步骤 4: 更新文档下载链接 ====================
log "更新文档中的下载链接..."

LATEST_URL="${BASE_URL}/zephyrus-player-latest.apk"

if [ -f "$DOCS_INSTALL_HTML" ]; then
    cp "$DOCS_INSTALL_HTML" "${DOCS_INSTALL_HTML}.bak"

    # VitePress 编译后的 HTML 格式:
    # <p>从 <a href="https://github.com/cang-dot/zephyrus-player-android/releases" target="_blank" rel="noreferrer">GitHub Releases</a> 下载最新的 APK 文件。</p>
    #
    # 替换为:
    # <p>从 <a href="https://mucang.xyz/zephyrus/apks/zephyrus-player-latest.apk" target="_blank" rel="noreferrer">此处下载最新 APK (v1.0.5)</a>，或前往 <a href="https://github.com/..." target="_blank" rel="noreferrer">GitHub Releases</a> 查看所有版本。</p>

    # 检查是否已经被替换过（避免重复替换）
    if grep -q "mucang.xyz/zephyrus/apks" "$DOCS_INSTALL_HTML"; then
        log "文档已包含服务器下载链接，更新版本号..."
        # 更新已有的版本号显示
        sed -i "s|最新 APK (v[0-9.]\+)|最新 APK (${TAG_NAME})|g" "$DOCS_INSTALL_HTML"
    else
        log "首次替换文档下载链接..."

        # 精确替换整段文字
        # 旧: 从 <a href="https://github.com/cang-dot/zephyrus-player-android/releases" ...>GitHub Releases</a> 下载最新的 APK 文件。
        # 新: 直接点击 <a href="https://mucang.xyz/.../latest.apk" ...>下载最新 APK (v1.0.5)</a>，也可从 <a href="https://github.com/.../releases" ...>GitHub Releases</a> 下载。

        OLD_PATTERN='从 <a href="https://github.com/cang-dot/zephyrus-player-android/releases" target="_blank" rel="noreferrer">GitHub Releases</a> 下载最新的 APK 文件。'
        NEW_PATTERN="直接点击 <a href=\"${LATEST_URL}\" target=\"_blank\" rel=\"noreferrer\">下载最新 APK (${TAG_NAME})</a>，也可从 <a href=\"https://github.com/cang-dot/zephyrus-player-android/releases\" target=\"_blank\" rel=\"noreferrer\">GitHub Releases</a> 查看所有版本。"

        # 使用 python 进行精确替换（sed 处理 HTML 特殊字符不可靠）
        python3 -c "
import sys
with open('$DOCS_INSTALL_HTML', 'r', encoding='utf-8') as f:
    content = f.read()
old = '''从 <a href=\"https://github.com/cang-dot/zephyrus-player-android/releases\" target=\"_blank\" rel=\"noreferrer\">GitHub Releases</a> 下载最新的 APK 文件。'''
new = '''直接点击 <a href=\"${LATEST_URL}\" target=\"_blank\" rel=\"noreferrer\">下载最新 APK (${TAG_NAME})</a>，也可从 <a href=\"https://github.com/cang-dot/zephyrus-player-android/releases\" target=\"_blank\" rel=\"noreferrer\">GitHub Releases</a> 查看所有版本。'''
if old in content:
    content = content.replace(old, new)
    with open('$DOCS_INSTALL_HTML', 'w', encoding='utf-8') as f:
        f.write(content)
    print('REPLACED')
else:
    print('NOT_FOUND')
" 2>&1 | while read -r result; do
            if [ "$result" = "REPLACED" ]; then
                log "文档下载链接已替换为: $LATEST_URL (版本 $TAG_NAME)"
            else
                log "警告: 未找到原始下载链接模式，尝试通用替换..."
                # 通用替换：将 releases 链接替换为服务器链接
                sed -i "s|https://github.com/${GITHUB_REPO}/releases|${LATEST_URL}|g" "$DOCS_INSTALL_HTML"
                log "已执行通用替换"
            fi
        done
    fi
else
    log "警告: 文档文件不存在: $DOCS_INSTALL_HTML"
fi

# ==================== 设置权限 ====================
chown -R www-data:www-data "$APK_DIR" 2>/dev/null || true
chmod -R 755 "$APK_DIR"

log "=== APK Release Agent 执行完成 ==="
