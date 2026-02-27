#!/usr/bin/env python3
"""
将 AiDocPlus-PromptTemplates 的目录结构转换为分类 JSON 文件。
每个分类一个 JSON 文件，包含分类元信息 + 该分类所有模板。

输入：data/ 目录（分类目录 → 模板目录 → manifest.json + content.md）
输出：data_new/ 目录（academic.json, business.json, ...）
"""
import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(REPO_DIR, "data")
OUTPUT_DIR = os.path.join(REPO_DIR, "data_new")

os.makedirs(OUTPUT_DIR, exist_ok=True)


def load_meta():
    """从 _meta.json 加载分类元信息"""
    meta_path = os.path.join(DATA_DIR, "_meta.json")
    if not os.path.exists(meta_path):
        return {}
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
    # 构建 key → {name, icon, order} 映射（去掉 subCategories）
    result = {}
    for i, cat in enumerate(meta.get("categories", [])):
        result[cat["key"]] = {
            "name": cat.get("name", cat["key"]),
            "icon": cat.get("icon", "📋"),
            "order": cat.get("order", i),
        }
    return result


def scan_category(cat_dir):
    """扫描一个分类目录，返回该分类下所有模板"""
    templates = []
    for entry in sorted(os.listdir(cat_dir)):
        tmpl_dir = os.path.join(cat_dir, entry)
        if not os.path.isdir(tmpl_dir):
            continue
        manifest_path = os.path.join(tmpl_dir, "manifest.json")
        content_path = os.path.join(tmpl_dir, "content.md")
        if not os.path.exists(manifest_path) or not os.path.exists(content_path):
            continue

        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        with open(content_path, "r", encoding="utf-8") as f:
            content = f.read().strip()

        templates.append({
            "id": manifest.get("id", entry),
            "name": manifest.get("name", ""),
            "description": manifest.get("description", ""),
            "content": content,
            "variables": extract_variables(manifest),
            "order": manifest.get("order", 0),
        })

    # 按 order 排序
    templates.sort(key=lambda t: (t["order"], t["name"]))
    return templates


def extract_variables(manifest):
    """提取变量列表"""
    variables = manifest.get("variables", [])
    result = []
    for v in variables:
        if isinstance(v, str):
            result.append(v)
        elif isinstance(v, dict) and "name" in v:
            result.append(v["name"])
    return result


def main():
    meta = load_meta()
    total_templates = 0
    total_categories = 0

    # 扫描 data/ 下的分类目录
    for entry in sorted(os.listdir(DATA_DIR)):
        cat_dir = os.path.join(DATA_DIR, entry)
        if not os.path.isdir(cat_dir):
            continue
        if entry.startswith("_") or entry.startswith("."):
            continue

        cat_key = entry
        cat_info = meta.get(cat_key, {
            "name": cat_key,
            "icon": "📋",
            "order": 999,
        })

        templates = scan_category(cat_dir)
        if not templates:
            print(f"  [skip] {cat_key}: 无模板")
            continue

        # 生成分类 JSON
        category_json = {
            "key": cat_key,
            "name": cat_info["name"],
            "icon": cat_info["icon"],
            "order": cat_info["order"],
            "templates": templates,
        }

        output_path = os.path.join(OUTPUT_DIR, f"{cat_key}.json")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(category_json, f, ensure_ascii=False, indent=2)

        total_templates += len(templates)
        total_categories += 1
        print(f"  [ok] {cat_key}.json: {len(templates)} 个模板")

    print(f"\n[done] 转换完成: {total_categories} 个分类, {total_templates} 个模板")
    print(f"输出目录: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
