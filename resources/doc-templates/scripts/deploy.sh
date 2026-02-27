#!/bin/bash
# AiDocPlus-DocTemplates deploy.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
PARENT_DIR="$(dirname "$REPO_DIR")"
TARGET_DIR="${PARENT_DIR}/AiDocPlus"
DIST_DIR="${REPO_DIR}/dist"
DATA_DIR="${REPO_DIR}/data"

echo "[deploy] AiDocPlus-DocTemplates -> ${TARGET_DIR}"

# 1. 部署 generated TypeScript 文件
GENERATED_DIR="${TARGET_DIR}/packages/shared-types/src/generated"
mkdir -p "$GENERATED_DIR"

for f in ppt-themes.generated.ts doc-template-categories.generated.ts doc-templates.generated.ts; do
  if [ -f "${DIST_DIR}/${f}" ]; then
    cp "${DIST_DIR}/${f}" "${GENERATED_DIR}/"
    echo "   [ok] ${f} -> generated/"
  fi
done

# 2. 运行 build.py 生成 JSON 文件模式数据
echo "   [build] 运行 build.py..."
python3 "${SCRIPT_DIR}/build.py"

# 3. 部署 JSON 文件到 bundled-resources（JSON 文件模式，供资源管理器使用）
BUNDLED_DIR="${TARGET_DIR}/apps/desktop/src-tauri/bundled-resources/document-templates"
rm -rf "$BUNDLED_DIR"
mkdir -p "$BUNDLED_DIR"

JSON_DIR="${DIST_DIR}/json"
if [ -d "$JSON_DIR" ]; then
  cp "${JSON_DIR}"/*.json "${BUNDLED_DIR}/"
  TOTAL=$(ls -1 "${JSON_DIR}"/*.json 2>/dev/null | wc -l | tr -d ' ')
  echo "   [ok] ${TOTAL} 个分类 JSON 文件 -> bundled-resources/document-templates/"
else
  echo "   [warn] dist/json/ 目录不存在，跳过部署"
fi

echo "[done] AiDocPlus-DocTemplates 部署完成"
