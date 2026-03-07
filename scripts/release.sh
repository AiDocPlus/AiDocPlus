#!/bin/bash
# AiDocPlus 一键发布脚本
# 用法: bash scripts/release.sh
# 前置条件:
#   - TAURI_SIGNING_PRIVATE_KEY 环境变量已设置
#   - APPLE_ID / APPLE_PASSWORD / APPLE_TEAM_ID 环境变量已设置
#   - gh CLI 已登录
#   - ClashX 代理运行中 (127.0.0.1:7890)
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DESKTOP_DIR="${PROJECT_ROOT}/apps/desktop"
TAURI_DIR="${DESKTOP_DIR}/src-tauri"
BUNDLE_DIR="${TAURI_DIR}/target/release/bundle"
REPO="AiDocPlus/AiDocPlus"

# ── 颜色输出 ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}[信息]${NC} $1"; }
ok()    { echo -e "${GREEN}[完成]${NC} $1"; }
warn()  { echo -e "${YELLOW}[警告]${NC} $1"; }
fail()  { echo -e "${RED}[错误]${NC} $1"; exit 1; }

# ── 0. 前置检查 ──
info "检查环境..."
[ -z "$TAURI_SIGNING_PRIVATE_KEY" ] && fail "TAURI_SIGNING_PRIVATE_KEY 未设置"
[ -z "$APPLE_ID" ] && fail "APPLE_ID 未设置"
[ -z "$APPLE_PASSWORD" ] && fail "APPLE_PASSWORD 未设置"
[ -z "$APPLE_TEAM_ID" ] && fail "APPLE_TEAM_ID 未设置"
command -v gh >/dev/null || fail "gh CLI 未安装"
command -v pnpm >/dev/null || fail "pnpm 未安装"
command -v xcrun >/dev/null || fail "xcrun 未安装"

# 读取版本号
VERSION=$(python3 -c "import json; print(json.load(open('${TAURI_DIR}/tauri.conf.json'))['version'])")
TAG="v${VERSION}"
info "版本: ${VERSION} (tag: ${TAG})"

# ── 1. 本地构建 macOS ──
info "开始构建 macOS..."
cd "$DESKTOP_DIR"
pnpm tauri build --bundles dmg 2>&1 | tail -20 || true

# 检查构建产物
APP_PATH="${BUNDLE_DIR}/macos/AiDocPlus.app"
[ -d "$APP_PATH" ] || fail "AiDocPlus.app 未生成"

# 检查 updater artifacts
UPDATER_TAR="${BUNDLE_DIR}/macos/AiDocPlus.app.tar.gz"
UPDATER_SIG="${BUNDLE_DIR}/macos/AiDocPlus.app.tar.gz.sig"

if [ ! -f "$UPDATER_TAR" ] || [ ! -f "$UPDATER_SIG" ]; then
    warn "Tauri 未生成 updater artifacts，可能构建失败或公证超时"
    warn "检查 TAURI_SIGNING_PRIVATE_KEY 是否正确设置"
    
    # 如果 .app 存在但 updater artifacts 不存在，可能是公证超时导致构建中断
    # 尝试手动生成
    if [ -d "$APP_PATH" ]; then
        info "手动生成 updater artifacts..."
        cd "${BUNDLE_DIR}/macos"
        tar -czf AiDocPlus.app.tar.gz AiDocPlus.app
        # 使用 tauri signer 签名
        cd "$DESKTOP_DIR"
        pnpm tauri signer sign "${UPDATER_TAR}" 2>/dev/null || {
            warn "tauri signer 签名失败，尝试直接使用私钥..."
            # Tauri v2 使用 minisign 格式
            fail "无法生成签名文件，请确保 TAURI_SIGNING_PRIVATE_KEY 正确"
        }
    fi
fi

[ -f "$UPDATER_TAR" ] || fail "AiDocPlus.app.tar.gz 未生成"
[ -f "$UPDATER_SIG" ] || fail "AiDocPlus.app.tar.gz.sig 未生成"
ok "构建完成，updater artifacts 已生成"

# ── 2. Apple 公证（通过代理）──
info "开始 Apple 公证（通过代理）..."

# 打包用于公证的 zip
NOTARIZE_ZIP="/tmp/AiDocPlus_notarize.zip"
ditto -c -k --keepParent "$APP_PATH" "$NOTARIZE_ZIP"

# 通过代理提交公证
https_proxy=http://127.0.0.1:7890 http_proxy=http://127.0.0.1:7890 \
    xcrun notarytool submit "$NOTARIZE_ZIP" \
    --apple-id "$APPLE_ID" \
    --team-id "$APPLE_TEAM_ID" \
    --password "$APPLE_PASSWORD" \
    --wait || fail "公证失败"

# Staple
xcrun stapler staple "$APP_PATH" || fail "Staple 失败"
ok "公证完成"
rm -f "$NOTARIZE_ZIP"

# ── 3. 生成 DMG ──
info "生成 DMG..."
DMG_PATH="${BUNDLE_DIR}/dmg/AiDocPlus_${VERSION}_aarch64.dmg"
mkdir -p "${BUNDLE_DIR}/dmg"
hdiutil create -volname "AiDocPlus" -srcfolder "$APP_PATH" -ov -format UDZO "$DMG_PATH"
ok "DMG 已生成: $(basename "$DMG_PATH")"

# ── 4. 复制到 Applications ──
info "复制到 /Applications..."
rm -rf /Applications/AiDocPlus.app
cp -R "$APP_PATH" /Applications/
ok "已复制到 /Applications"

# ── 5. 上传 macOS 产物到 GitHub Release ──
info "上传 macOS 产物到 GitHub Release..."

# 确保 Release 存在（CI 的 tauri-action 可能已创建）
gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1 || {
    info "Release 不存在，创建中..."
    gh release create "$TAG" --repo "$REPO" \
        --title "AiDocPlus ${TAG}" \
        --notes "## AiDocPlus ${TAG}" \
        --draft=false
}

# 上传文件
gh release upload "$TAG" "$DMG_PATH" --repo "$REPO" --clobber
gh release upload "$TAG" "$UPDATER_TAR" --repo "$REPO" --clobber
gh release upload "$TAG" "$UPDATER_SIG" --repo "$REPO" --clobber
ok "macOS 产物上传完成"

# ── 6. 等待 CI Windows 构建完成 ──
info "等待 CI Windows 构建完成..."
MAX_WAIT=1800  # 最多等 30 分钟
WAITED=0
INTERVAL=30

while [ $WAITED -lt $MAX_WAIT ]; do
    # 检查 .exe.sig 是否已上传（Windows 构建完成标志）
    ASSETS=$(gh release view "$TAG" --repo "$REPO" --json assets --jq '.assets[].name' 2>/dev/null)
    if echo "$ASSETS" | grep -q "\.exe\.sig$"; then
        ok "CI Windows 构建已完成"
        break
    fi
    
    echo -ne "\r  已等待 ${WAITED}s / ${MAX_WAIT}s..."
    sleep $INTERVAL
    WAITED=$((WAITED + INTERVAL))
done

echo ""
if [ $WAITED -ge $MAX_WAIT ]; then
    warn "等待超时，CI 可能仍在运行。可稍后手动运行: bash scripts/merge-latest-json.sh ${TAG}"
fi

# ── 7. 合并 latest.json ──
info "合并 latest.json..."

# 下载 CI 生成的 latest.json
LATEST_JSON="/tmp/latest.json"
gh release download "$TAG" --repo "$REPO" --pattern "latest.json" --output "$LATEST_JSON" --clobber 2>/dev/null || {
    warn "latest.json 尚未生成，创建新文件..."
    echo '{"version":"'"$VERSION"'","platforms":{}}' > "$LATEST_JSON"
}

# 读取 macOS 签名
MAC_SIG=$(cat "$UPDATER_SIG")
MAC_URL="https://github.com/${REPO}/releases/download/${TAG}/AiDocPlus.app.tar.gz"

# 用 python3 合并 latest.json
python3 -c "
import json, sys

with open('$LATEST_JSON', 'r') as f:
    data = json.load(f)

data['version'] = '$VERSION'
if 'platforms' not in data:
    data['platforms'] = {}

data['platforms']['darwin-aarch64'] = {
    'url': '$MAC_URL',
    'signature': '''$MAC_SIG'''
}

with open('$LATEST_JSON', 'w') as f:
    json.dump(data, f, indent=2)

print('[完成] latest.json 已合并，平台:', ', '.join(data['platforms'].keys()))
"

# 上传合并后的 latest.json
gh release upload "$TAG" "$LATEST_JSON" --repo "$REPO" --clobber
ok "latest.json 已上传"
rm -f "$LATEST_JSON"

# ── 完成 ──
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  AiDocPlus ${TAG} 发布完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "  Release: https://github.com/${REPO}/releases/tag/${TAG}"
echo ""

# 列出 Release 资产
gh release view "$TAG" --repo "$REPO" --json assets --jq '.assets[] | "  - \(.name) (\(.size / 1048576 | . * 100 | round / 100) MB)"'
