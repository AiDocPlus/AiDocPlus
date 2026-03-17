#!/bin/bash
# ============================================================
# Gitee Release 发布脚本
# 用法: bash scripts/publish-gitee.sh <version>
# 示例: bash scripts/publish-gitee.sh 0.3.7
#
# 前置条件:
#   1. 已在 Gitee 创建仓库并配置 GitHub 镜像同步
#   2. 已在本地构建完成 Mac 版本 (pnpm tauri build)
#   3. CI 已构建完成 Windows 版本
#   4. 已设置环境变量 GITEE_TOKEN (Gitee 私人令牌)
# ============================================================

set -e

VERSION="${1}"
if [ -z "$VERSION" ]; then
  echo "❌ 用法: bash scripts/publish-gitee.sh <version>"
  echo "   示例: bash scripts/publish-gitee.sh 0.3.7"
  exit 1
fi

GITEE_OWNER="aidocplus"
GITEE_REPO="aidocplus"
TAG="v${VERSION}"

# 检查 GITEE_TOKEN
if [ -z "$GITEE_TOKEN" ]; then
  echo "❌ 请设置 GITEE_TOKEN 环境变量"
  echo "   获取方式: https://gitee.com/profile/personal_access_tokens"
  exit 1
fi

BUNDLE_DIR="apps/desktop/src-tauri/target/release/bundle"
MAC_DMG="${BUNDLE_DIR}/dmg/AiDocPlus_${VERSION}_aarch64.dmg"
MAC_TAR="${BUNDLE_DIR}/macos/AiDocPlus.app.tar.gz"
MAC_SIG="${BUNDLE_DIR}/macos/AiDocPlus.app.tar.gz.sig"

echo "📦 Gitee Release 发布 - ${TAG}"
echo "============================================"

# ── 1. 从 GitHub Release 下载 Windows 安装包 ──
WIN_EXE="/tmp/AiDocPlus_${VERSION}_x64-setup.exe"
WIN_SIG="/tmp/AiDocPlus_${VERSION}_x64-setup.exe.sig"

if [ ! -f "$WIN_EXE" ]; then
  echo "⬇️  下载 Windows 安装包..."
  gh release download "${TAG}" -p "AiDocPlus_${VERSION}_x64-setup.exe" -D /tmp --clobber 2>/dev/null || true
  gh release download "${TAG}" -p "AiDocPlus_${VERSION}_x64-setup.exe.sig" -D /tmp --clobber 2>/dev/null || true
fi

# ── 2. 读取签名 ──
MAC_SIGNATURE=""
WIN_SIGNATURE=""

if [ -f "$MAC_SIG" ]; then
  MAC_SIGNATURE=$(cat "$MAC_SIG")
elif [ -f "/tmp/AiDocPlus.app.tar.gz.sig" ]; then
  MAC_SIGNATURE=$(cat "/tmp/AiDocPlus.app.tar.gz.sig")
fi

if [ -f "$WIN_SIG" ]; then
  WIN_SIGNATURE=$(cat "$WIN_SIG")
fi

# ── 3. 更新 update/latest.json ──
echo "📝 更新 update/latest.json..."
GITEE_BASE="https://gitee.com/${GITEE_OWNER}/${GITEE_REPO}/releases/download/${TAG}"
PUB_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat > update/latest.json << EOJSON
{
  "version": "${VERSION}",
  "notes": "AiDocPlus ${TAG}",
  "pub_date": "${PUB_DATE}",
  "platforms": {
    "darwin-aarch64": {
      "signature": "${MAC_SIGNATURE}",
      "url": "${GITEE_BASE}/AiDocPlus.app.tar.gz"
    },
    "windows-x86_64": {
      "signature": "${WIN_SIGNATURE}",
      "url": "${GITEE_BASE}/AiDocPlus_${VERSION}_x64-setup.exe"
    },
    "windows-x86_64-nsis": {
      "signature": "${WIN_SIGNATURE}",
      "url": "${GITEE_BASE}/AiDocPlus_${VERSION}_x64-setup.exe"
    }
  }
}
EOJSON

echo "✅ update/latest.json 已更新"

# ── 4. 提交并推送 (触发 Gitee 镜像同步) ──
echo "📤 提交 update/latest.json..."
git add update/latest.json
git commit -m "chore: update latest.json for ${TAG} (Gitee)" || echo "  (无需提交，文件未变更)"
git push origin main

# ── 5. 通过 Gitee API 创建 Release ──
echo "🚀 在 Gitee 创建 Release ${TAG}..."
RELEASE_BODY="## AiDocPlus ${TAG}\n\n### 下载\n- **macOS (Apple Silicon)**: AiDocPlus_${VERSION}_aarch64.dmg\n- **Windows (x64)**: AiDocPlus_${VERSION}_x64-setup.exe\n\n### 自动更新\n已安装用户会收到自动更新提示。"

RESPONSE=$(curl -s -X POST "https://gitee.com/api/v5/repos/${GITEE_OWNER}/${GITEE_REPO}/releases" \
  -H "Content-Type: application/json" \
  -d "{
    \"access_token\": \"${GITEE_TOKEN}\",
    \"tag_name\": \"${TAG}\",
    \"target_commitish\": \"main\",
    \"name\": \"AiDocPlus ${TAG}\",
    \"body\": \"${RELEASE_BODY}\",
    \"prerelease\": false
  }")

RELEASE_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")

if [ -z "$RELEASE_ID" ]; then
  echo "⚠️  创建 Release 可能失败，请手动检查："
  echo "   https://gitee.com/${GITEE_OWNER}/${GITEE_REPO}/releases"
  echo "   响应: $RESPONSE"
else
  echo "✅ Release 创建成功 (ID: $RELEASE_ID)"

  # ── 6. 上传附件 ──
  upload_file() {
    local FILE_PATH="$1"
    local FILE_NAME=$(basename "$FILE_PATH")
    if [ -f "$FILE_PATH" ]; then
      echo "  📎 上传 ${FILE_NAME}..."
      curl -s -X POST "https://gitee.com/api/v5/repos/${GITEE_OWNER}/${GITEE_REPO}/releases/${RELEASE_ID}/attach_files" \
        -H "Content-Type: multipart/form-data" \
        -F "access_token=${GITEE_TOKEN}" \
        -F "file=@${FILE_PATH}" > /dev/null
      echo "  ✅ ${FILE_NAME} 上传完成"
    else
      echo "  ⚠️  文件不存在: ${FILE_PATH}"
    fi
  }

  # 上传 Mac 产物
  upload_file "$MAC_DMG"
  upload_file "$MAC_TAR"
  upload_file "$MAC_SIG"

  # 上传 Windows 产物
  upload_file "$WIN_EXE"
  upload_file "$WIN_SIG"
fi

echo ""
echo "============================================"
echo "✅ Gitee Release 发布完成！"
echo "   Release 地址: https://gitee.com/${GITEE_OWNER}/${GITEE_REPO}/releases/tag/${TAG}"
echo "   latest.json:  https://gitee.com/${GITEE_OWNER}/${GITEE_REPO}/raw/main/update/latest.json"
echo "============================================"
