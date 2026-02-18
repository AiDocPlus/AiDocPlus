#!/bin/bash
# AiDocPlus 总装脚本
# 一键从所有独立仓库组装完整应用到 AiDocPlus/ 构建目标
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PARENT_DIR="$(dirname "$PROJECT_ROOT")"

echo "=== AiDocPlus Assembly Pipeline ==="
echo "================================"

# 部署顺序：Main 必须最先（提供基础框架），其余按依赖顺序
REPOS=(Main Roles PromptTemplates DocTemplates ProjectTemplates AIProviders Plugins)

for repo in "${REPOS[@]}"; do
  REPO_DIR="${PARENT_DIR}/AiDocPlus-${repo}"
  if [ ! -d "$REPO_DIR" ]; then
    echo "[skip] AiDocPlus-${repo} 未找到"
    continue
  fi

  echo ""
  echo "[deploy] AiDocPlus-${repo}..."

  # 先 build（如果有 build.sh）
  if [ -f "${REPO_DIR}/scripts/build.sh" ]; then
    echo "   [build]..."
    bash "${REPO_DIR}/scripts/build.sh"
  fi

  # 再 deploy
  if [ -f "${REPO_DIR}/scripts/deploy.sh" ]; then
    bash "${REPO_DIR}/scripts/deploy.sh"
    echo "   [done] AiDocPlus-${repo} 部署完成"
  else
    echo "   [skip] 未找到 deploy.sh"
  fi
done

echo ""
echo "================================"
echo "Assembly complete! Run pnpm install && pnpm build in AiDocPlus/ to build."
