#!/bin/bash
# AiDocPlus-PromptTemplates deploy.sh
# 简化版：直接复制分类 JSON 文件，不再合并
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
PARENT_DIR="$(dirname "$REPO_DIR")"
TARGET_DIR="${PARENT_DIR}/AiDocPlus"
DEV_DIR="${PARENT_DIR}/AiDocPlus-Main"
DIST_DIR="${REPO_DIR}/dist"
DATA_DIR="${REPO_DIR}/data"

echo "[deploy] AiDocPlus-PromptTemplates"

# 1. 部署 generated TypeScript 文件
GENERATED_DIR="${TARGET_DIR}/packages/shared-types/src/generated"
mkdir -p "$GENERATED_DIR"

for f in prompt-templates.generated.ts template-categories.generated.ts; do
  if [ -f "${DIST_DIR}/${f}" ]; then
    cp "${DIST_DIR}/${f}" "${GENERATED_DIR}/"
    echo "   [ok] ${f} -> generated/"
  else
    echo "   [warn] dist/${f} 不存在，请先运行 build.sh"
  fi
done

# 2. 部署分类 JSON 文件到 bundled-resources（构建目标 + 开发目标）
BUNDLED_BUILD="${TARGET_DIR}/apps/desktop/src-tauri/bundled-resources/prompt-templates"
BUNDLED_DEV="${DEV_DIR}/apps/desktop/src-tauri/bundled-resources/prompt-templates"

for BUNDLED_DIR in "$BUNDLED_BUILD" "$BUNDLED_DEV"; do
  mkdir -p "$BUNDLED_DIR"
  # 清理目标目录中所有旧文件（防止已删除的分类 JSON 残留导致重复 key）
  rm -f "$BUNDLED_DIR"/*.json
  find "$BUNDLED_DIR" -mindepth 1 -maxdepth 1 -type d -exec rm -rf {} + 2>/dev/null || true
  # 复制分类 JSON 文件
  cp "${DATA_DIR}"/*.json "$BUNDLED_DIR/"
done

JSON_COUNT=$(ls -1 "${DATA_DIR}"/*.json 2>/dev/null | wc -l | tr -d ' ')
echo "   [ok] ${JSON_COUNT} 个分类 JSON -> bundled-resources/prompt-templates/"

echo "[done] AiDocPlus-PromptTemplates 部署完成"
