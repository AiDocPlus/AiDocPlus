#!/bin/bash
# ============================================================
# AiDocPlus 版本号统一 Bump 脚本
# 用法: bash scripts/bump-version.sh <new_version>
# 示例: bash scripts/bump-version.sh 0.3.8
#
# 自动修改以下 3 个文件中的版本号：
#   - apps/desktop/package.json
#   - apps/desktop/src-tauri/tauri.conf.json
#   - apps/desktop/src-tauri/Cargo.toml
# 同时更新 update/latest.json 中的版本号
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

NEW_VERSION="${1}"
if [ -z "$NEW_VERSION" ]; then
  echo "❌ 用法: bash scripts/bump-version.sh <new_version>"
  echo "   示例: bash scripts/bump-version.sh 0.3.8"
  exit 1
fi

# 校验版本号格式
if ! echo "$NEW_VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "❌ 版本号格式不正确（需要 x.y.z）: $NEW_VERSION"
  exit 1
fi

PKG_JSON="${PROJECT_ROOT}/apps/desktop/package.json"
TAURI_CONF="${PROJECT_ROOT}/apps/desktop/src-tauri/tauri.conf.json"
CARGO_TOML="${PROJECT_ROOT}/apps/desktop/src-tauri/Cargo.toml"
UPDATE_JSON="${PROJECT_ROOT}/update/latest.json"

# 读取当前版本
OLD_VERSION=$(python3 -c "import json; print(json.load(open('${TAURI_CONF}'))['version'])")
echo "📦 版本号 Bump: ${OLD_VERSION} → ${NEW_VERSION}"

# ── 1. package.json ──
python3 -c "
import json
with open('${PKG_JSON}', 'r') as f:
    data = json.load(f)
data['version'] = '${NEW_VERSION}'
with open('${PKG_JSON}', 'w') as f:
    json.dump(data, f, indent=2)
    f.write('\n')
"
echo "  ✅ apps/desktop/package.json"

# ── 2. tauri.conf.json ──
python3 -c "
import json
with open('${TAURI_CONF}', 'r') as f:
    data = json.load(f)
data['version'] = '${NEW_VERSION}'
with open('${TAURI_CONF}', 'w') as f:
    json.dump(data, f, indent=2)
    f.write('\n')
"
echo "  ✅ apps/desktop/src-tauri/tauri.conf.json"

# ── 3. Cargo.toml ──
sed -i '' "s/^version = \"${OLD_VERSION}\"/version = \"${NEW_VERSION}\"/" "$CARGO_TOML"
echo "  ✅ apps/desktop/src-tauri/Cargo.toml"

# ── 4. update/latest.json（仅更新版本号字段）──
if [ -f "$UPDATE_JSON" ]; then
  python3 -c "
import json
with open('${UPDATE_JSON}', 'r') as f:
    data = json.load(f)
data['version'] = '${NEW_VERSION}'
with open('${UPDATE_JSON}', 'w') as f:
    json.dump(data, f, indent=2)
    f.write('\n')
"
  echo "  ✅ update/latest.json"
fi

# ── 5. 验证 ──
echo ""
echo "🔍 验证："
echo "  package.json:   $(python3 -c "import json; print(json.load(open('${PKG_JSON}'))['version'])")"
echo "  tauri.conf.json: $(python3 -c "import json; print(json.load(open('${TAURI_CONF}'))['version'])")"
echo "  Cargo.toml:     $(grep '^version' "$CARGO_TOML" | head -1 | sed 's/version = "\(.*\)"/\1/')"

echo ""
echo "✅ 版本号已统一更新为 ${NEW_VERSION}"
echo ""
echo "下一步："
echo "  1. 更新 CHANGELOG.md"
echo "  2. git add -A && git commit -m \"chore: bump version to ${NEW_VERSION}\""
echo "  3. git tag v${NEW_VERSION}"
echo "  4. git push origin main --tags"
echo "  5. bash scripts/release.sh"
