#!/usr/bin/env python3
"""
AiDocPlus-PromptTemplates 构建脚本
读取 data/*.json 分类文件，生成 prompt-templates.generated.ts 和 template-categories.generated.ts
"""
import json
import os
import sys
import glob

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(REPO_DIR, "data")
DIST_DIR = os.path.join(REPO_DIR, "dist")

os.makedirs(DIST_DIR, exist_ok=True)


def ts_string(s: str) -> str:
    if "\n" in s:
        escaped = s.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")
        return f"`{escaped}`"
    else:
        return json.dumps(s, ensure_ascii=False)


def ts_string_array(arr: list) -> str:
    items = ", ".join(json.dumps(x, ensure_ascii=False) for x in arr)
    return f"[{items}]"


def load_category_files():
    """读取 data/*.json，返回 (categories, templates) 列表"""
    categories = []
    all_templates = []

    for json_path in sorted(glob.glob(os.path.join(DATA_DIR, "*.json"))):
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        cat_key = data["key"]
        categories.append({
            "key": cat_key,
            "name": data.get("name", cat_key),
            "icon": data.get("icon", "📋"),
            "order": data.get("order", 999),
        })

        for tmpl in data.get("templates", []):
            all_templates.append((cat_key, tmpl))

    categories.sort(key=lambda c: c["order"])
    return categories, all_templates


def generate_templates_ts(all_templates):
    entries = []
    for cat_key, tmpl in all_templates:
        lines = []
        lines.append("  {")
        lines.append(f"    id: {ts_string(tmpl['id'])},")
        lines.append(f"    name: {ts_string(tmpl.get('name', ''))},")
        lines.append(f"    category: {ts_string(cat_key)},")
        lines.append(f"    content: {ts_string(tmpl.get('content', ''))},")
        lines.append(f"    isBuiltIn: true,")
        if tmpl.get("description"):
            lines.append(f"    description: {ts_string(tmpl['description'])},")
        if tmpl.get("variables"):
            lines.append(f"    variables: {ts_string_array(tmpl['variables'])},")
        lines.append("  },")
        entries.append("\n".join(lines))

    return f"""/**
 * 自动生成文件 — 请勿手动编辑
 * 由 AiDocPlus-PromptTemplates/scripts/build.py 生成
 */
import type {{ PromptTemplate }} from '../index';

export const BUILT_IN_TEMPLATES: PromptTemplate[] = [
{chr(10).join(entries)}
];
"""


def generate_categories_ts(categories):
    entries = []
    for cat in categories:
        key = cat["key"]
        name = cat["name"]
        icon = cat.get("icon", "📋")
        entries.append(f"  {ts_string(key)}: {{ name: {ts_string(name)}, icon: {ts_string(icon)}, isBuiltIn: true }},")

    return f"""/**
 * 自动生成文件 — 请勿手动编辑
 * 由 AiDocPlus-PromptTemplates/scripts/build.py 生成
 */
import type {{ TemplateCategoryInfo }} from '../index';

export const TEMPLATE_CATEGORIES: Record<string, TemplateCategoryInfo> = {{
{chr(10).join(entries)}
}};
"""


def main():
    print("[build] 构建提示词模板数据...")
    categories, all_templates = load_category_files()

    if not all_templates:
        print("[warn] 未找到任何模板数据")
        sys.exit(1)

    # 生成 prompt-templates.generated.ts
    ts_content = generate_templates_ts(all_templates)
    output_path = os.path.join(DIST_DIR, "prompt-templates.generated.ts")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(ts_content)
    print(f"   [ok] {output_path}")

    # 生成 template-categories.generated.ts
    cat_content = generate_categories_ts(categories)
    cat_output = os.path.join(DIST_DIR, "template-categories.generated.ts")
    with open(cat_output, "w", encoding="utf-8") as f:
        f.write(cat_content)
    print(f"   [ok] {cat_output}")

    print(f"[done] 构建完成: {len(all_templates)} 个模板, {len(categories)} 个分类")


if __name__ == "__main__":
    main()
