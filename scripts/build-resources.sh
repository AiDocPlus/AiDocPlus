#!/bin/bash
# AiDocPlus 资源构建脚本
# 替代原来的 assemble.sh + 各资源仓库 deploy.sh
# 功能：运行各资源的 build.py → 部署 generated TS + bundled-resources
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
RESOURCES_DIR="${PROJECT_ROOT}/resources"
GENERATED_DIR="${PROJECT_ROOT}/packages/shared-types/src/generated"
BUNDLED_DIR="${PROJECT_ROOT}/apps/desktop/src-tauri/bundled-resources"

echo "=== AiDocPlus 资源构建 ==="
mkdir -p "$GENERATED_DIR"

# ── 1. AI Providers ──
echo ""
echo "[build] AI Providers..."
AI_DIR="${RESOURCES_DIR}/ai-providers"
python3 "${AI_DIR}/scripts/build.py"

# 部署 generated TS
if [ -f "${AI_DIR}/dist/ai-providers.generated.ts" ]; then
  cp "${AI_DIR}/dist/ai-providers.generated.ts" "${GENERATED_DIR}/"
  echo "   [ok] ai-providers.generated.ts"
fi

# 部署提供商数据到 bundled-resources
AI_BUNDLED="${BUNDLED_DIR}/ai-providers"
mkdir -p "$AI_BUNDLED"
if [ -f "${AI_DIR}/data/_meta.json" ]; then
  cp "${AI_DIR}/data/_meta.json" "${AI_BUNDLED}/"
fi
find "${AI_DIR}/data" -name "manifest.json" -not -path "*/_meta.json" | while read -r manifest_file; do
  provider_dir="$(dirname "$manifest_file")"
  rel_path="${provider_dir#${AI_DIR}/data/}"
  target_dir="${AI_BUNDLED}/${rel_path}"
  mkdir -p "$target_dir"
  cp "${provider_dir}/manifest.json" "$target_dir/"
done
TOTAL=$(find "${AI_DIR}/data" -name "manifest.json" -not -path "*/_meta.json" | wc -l | tr -d ' ')
echo "   [ok] ${TOTAL} 个提供商 -> bundled-resources/"

# ── 2. Prompt Templates ──
echo ""
echo "[build] Prompt Templates..."
PT_DIR="${RESOURCES_DIR}/prompt-templates"
python3 "${PT_DIR}/scripts/build.py"

# 部署 generated TS
for f in prompt-templates.generated.ts template-categories.generated.ts; do
  if [ -f "${PT_DIR}/dist/${f}" ]; then
    cp "${PT_DIR}/dist/${f}" "${GENERATED_DIR}/"
    echo "   [ok] ${f}"
  fi
done

# 部署分类 JSON 到 bundled-resources
PT_BUNDLED="${BUNDLED_DIR}/prompt-templates"
mkdir -p "$PT_BUNDLED"
rm -f "$PT_BUNDLED"/*.json
cp "${PT_DIR}/data"/*.json "$PT_BUNDLED/"
JSON_COUNT=$(ls -1 "${PT_DIR}/data"/*.json 2>/dev/null | wc -l | tr -d ' ')
echo "   [ok] ${JSON_COUNT} 个分类 JSON -> bundled-resources/"

# ── 3. Doc Templates ──
echo ""
echo "[build] Doc Templates..."
DT_DIR="${RESOURCES_DIR}/doc-templates"
python3 "${DT_DIR}/scripts/build.py"

# 部署 generated TS
for f in ppt-themes.generated.ts doc-template-categories.generated.ts doc-templates.generated.ts; do
  if [ -f "${DT_DIR}/dist/${f}" ]; then
    cp "${DT_DIR}/dist/${f}" "${GENERATED_DIR}/"
    echo "   [ok] ${f}"
  fi
done

# 部署 JSON 文件到 bundled-resources
DT_BUNDLED="${BUNDLED_DIR}/document-templates"
rm -rf "$DT_BUNDLED"
mkdir -p "$DT_BUNDLED"
JSON_DIR="${DT_DIR}/dist/json"
if [ -d "$JSON_DIR" ]; then
  cp "${JSON_DIR}"/*.json "$DT_BUNDLED/"
  DT_COUNT=$(ls -1 "${JSON_DIR}"/*.json 2>/dev/null | wc -l | tr -d ' ')
  echo "   [ok] ${DT_COUNT} 个分类 JSON -> bundled-resources/"
else
  echo "   [warn] dist/json/ 不存在，跳过"
fi

echo ""
echo "=== 资源构建完成 ==="
