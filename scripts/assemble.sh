#!/bin/bash
# AiDocPlus 总装脚本
# 一键从所有独立仓库组装完整应用到 AiDocPlus/ 构建目标
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PARENT_DIR="$(dirname "$PROJECT_ROOT")"

echo "🔧 AiDocPlus Assembly Pipeline"
echo "================================"

# 部署顺序：Main 必须最先（提供基础框架），其余按依赖顺序
REPOS=(Main Roles PromptTemplates DocTemplates ProjectTemplates AIProviders Plugins)

for repo in "${REPOS[@]}"; do
  REPO_DIR="${PARENT_DIR}/AiDocPlus-${repo}"
  if [ ! -d "$REPO_DIR" ]; then
    echo "⚠️  跳过: AiDocPlus-${repo} 未找到"
    continue
  fi

  echo ""
  echo "📦 部署 AiDocPlus-${repo}..."

  # 先 build（如果有 build.sh）
  if [ -f "${REPO_DIR}/scripts/build.sh" ]; then
    echo "   🔨 构建中..."
    bash "${REPO_DIR}/scripts/build.sh"
  fi

  # 再 deploy
  if [ -f "${REPO_DIR}/scripts/deploy.sh" ]; then
    bash "${REPO_DIR}/scripts/deploy.sh"
    echo "   ✅ AiDocPlus-${repo} 部署完成"
  else
    echo "   ⚠️  未找到 deploy.sh，跳过"
  fi
done

echo ""
echo "================================"
echo "🎉 总装完成！可在 AiDocPlus/ 中执行 pnpm install && pnpm build 构建应用。"
