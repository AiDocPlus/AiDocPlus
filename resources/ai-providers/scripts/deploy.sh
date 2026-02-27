#!/bin/bash
# AiDocPlus-AIProviders deploy.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
PARENT_DIR="$(dirname "$REPO_DIR")"
TARGET_DIR="${PARENT_DIR}/AiDocPlus"
DIST_DIR="${REPO_DIR}/dist"
DATA_DIR="${REPO_DIR}/data"

echo "[deploy] AiDocPlus-AIProviders -> ${TARGET_DIR}"

# 1. 部署 generated TypeScript 文件
GENERATED_DIR="${TARGET_DIR}/packages/shared-types/src/generated"
mkdir -p "$GENERATED_DIR"

if [ -f "${DIST_DIR}/ai-providers.generated.ts" ]; then
  cp "${DIST_DIR}/ai-providers.generated.ts" "${GENERATED_DIR}/"
  echo "   [ok] ai-providers.generated.ts -> generated/"
else
  echo "   [warn] dist/ai-providers.generated.ts 不存在，请先运行 build.sh"
fi

# 2. 部署提供商数据到 bundled-resources
BUNDLED_DIR="${TARGET_DIR}/apps/desktop/src-tauri/bundled-resources/ai-providers"
mkdir -p "$BUNDLED_DIR"

if [ -f "${DATA_DIR}/_meta.json" ]; then
  cp "${DATA_DIR}/_meta.json" "${BUNDLED_DIR}/"
fi

TOTAL=0
find "$DATA_DIR" -name "manifest.json" -not -path "*/_meta.json" | while read -r manifest_file; do
  provider_dir="$(dirname "$manifest_file")"
  rel_path="${provider_dir#${DATA_DIR}/}"
  target_dir="${BUNDLED_DIR}/${rel_path}"
  mkdir -p "$target_dir"
  cp "${provider_dir}/manifest.json" "$target_dir/"
done

TOTAL=$(find "$DATA_DIR" -name "manifest.json" -not -path "*/_meta.json" | wc -l | tr -d ' ')
echo "   [ok] ${TOTAL} 个提供商 -> bundled-resources/ai-providers/"
echo "[done] AiDocPlus-AIProviders 部署完成"
