#!/usr/bin/env python3
"""
AiDocPlus-DocTemplates 构建脚本
扫描 data/ 目录，生成 ppt-themes.generated.ts 和 doc-template-categories.generated.ts
"""
import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(REPO_DIR, "data")
DIST_DIR = os.path.join(REPO_DIR, "dist")

os.makedirs(DIST_DIR, exist_ok=True)


def ts_string(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)


def find_doc_templates(data_dir: str):
    """扫描所有非 ppt-theme 分类下的文档模板"""
    templates = []
    for cat_name in os.listdir(data_dir):
        if cat_name.startswith('_') or cat_name == 'ppt-theme':
            continue
        cat_dir = os.path.join(data_dir, cat_name)
        if not os.path.isdir(cat_dir):
            continue
        for tmpl_name in os.listdir(cat_dir):
            tmpl_dir = os.path.join(cat_dir, tmpl_name)
            manifest_path = os.path.join(tmpl_dir, 'manifest.json')
            if not os.path.isfile(manifest_path):
                continue
            with open(manifest_path, 'r', encoding='utf-8') as f:
                manifest = json.load(f)
            templates.append(manifest)
    templates.sort(key=lambda t: (t.get('majorCategory', ''), t.get('order', 0)))
    return templates


def generate_doc_templates_ts(templates):
    entries = []
    for t in templates:
        roles = t.get('roles', [])
        roles_ts = '[' + ', '.join(ts_string(r) for r in roles) + ']'
        tags = t.get('tags', [])
        tags_ts = '[' + ', '.join(ts_string(tag) for tag in tags) + ']'
        entries.append(
            f'  {{ id: {ts_string(t["id"])}, name: {ts_string(t["name"])}, '
            f'description: {ts_string(t.get("description", ""))}, '
            f'icon: {ts_string(t.get("icon", ""))}, '
            f'majorCategory: {ts_string(t.get("majorCategory", ""))}, '
            f'subCategory: {ts_string(t.get("subCategory", ""))}, '
            f'tags: {tags_ts}, roles: {roles_ts}, '
            f'order: {t.get("order", 0)}, source: "builtin" }},'
        )
    return f"""/**
 * 自动生成文件 — 请勿手动编辑
 * 由 AiDocPlus-DocTemplates/scripts/build.py 生成
 */

export interface BuiltinDocTemplate {{
  id: string;
  name: string;
  description: string;
  icon: string;
  majorCategory: string;
  subCategory: string;
  tags: string[];
  roles: string[];
  order: number;
  source: string;
}}

export const BUILT_IN_DOC_TEMPLATES: BuiltinDocTemplate[] = [
{chr(10).join(entries)}
];
"""


def find_ppt_themes(data_dir: str):
    themes = []
    ppt_dir = os.path.join(data_dir, "ppt-theme")
    if not os.path.isdir(ppt_dir):
        return themes
    for root, dirs, files in os.walk(ppt_dir):
        if "manifest.json" in files:
            with open(os.path.join(root, "manifest.json"), "r", encoding="utf-8") as f:
                manifest = json.load(f)
            themes.append(manifest)
    themes.sort(key=lambda t: t.get("order", 0))
    return themes


def load_categories(data_dir: str):
    meta_path = os.path.join(data_dir, "_meta.json")
    if not os.path.exists(meta_path):
        return []
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
    return meta.get("categories", [])


def generate_ppt_themes_ts(themes):
    entries = []
    for t in themes:
        colors = t.get("colors", {})
        fonts = t.get("fonts", {})
        lines = []
        lines.append("  {")
        lines.append(f"    id: {ts_string(t['id'])},")
        lines.append(f"    name: {ts_string(t['name'])},")
        # colors
        color_parts = []
        for k in ["primary", "secondary", "background", "text", "accent"]:
            color_parts.append(f"{k}: {ts_string(colors.get(k, ''))}")
        lines.append(f"    colors: {{ {', '.join(color_parts)} }},")
        # fonts
        font_parts = []
        for k in ["title", "body"]:
            font_parts.append(f"{k}: {ts_string(fonts.get(k, ''))}")
        lines.append(f"    fonts: {{ {', '.join(font_parts)} }},")
        lines.append("  },")
        entries.append("\n".join(lines))

    return f"""/**
 * 自动生成文件 — 请勿手动编辑
 * 由 AiDocPlus-DocTemplates/scripts/build.py 生成
 */
import type {{ PptTheme }} from '../index';

export const BUILT_IN_PPT_THEMES: PptTheme[] = [
{chr(10).join(entries)}
];

export const DEFAULT_PPT_THEME: PptTheme = BUILT_IN_PPT_THEMES[0];
"""


def generate_doc_categories_ts(categories):
    entries = []
    for cat in categories:
        key = cat["key"]
        label = cat["name"]
        order = cat.get("order", 0)
        cat_type = "builtin"
        entries.append(
            f'  {{ key: {ts_string(key)}, label: {ts_string(label)}, order: {order}, category_type: {ts_string(cat_type)} }},'
        )

    return f"""/**
 * 自动生成文件 — 请勿手动编辑
 * 由 AiDocPlus-DocTemplates/scripts/build.py 生成
 */

export interface DocTemplateCategory {{
  key: string;
  label: string;
  order: number;
  category_type: string;
}}

export const DEFAULT_DOC_TEMPLATE_CATEGORIES: DocTemplateCategory[] = [
{chr(10).join(entries)}
];
"""


def generate_json_files(data_dir: str, output_dir: str):
    """将目录结构转换为 JSON 文件模式：每个分类一个 .json 文件（跳过 ppt-theme）
    
    输入: data/category/id/{manifest.json, content.json}
    输出: output_dir/category.json
    格式: { key, name, icon, order, templates: [{ id, name, description, authorNotes, content, tags, order }] }
    """
    categories = load_categories(data_dir)
    if not categories:
        print("   [warn] 未找到分类定义 (_meta.json)")
        return 0

    os.makedirs(output_dir, exist_ok=True)
    total_templates = 0

    for cat in categories:
        cat_key = cat["key"]
        # 跳过 ppt-theme（PPT 主题不纳入文档模板 JSON 系统）
        if cat_key == "ppt-theme":
            continue

        cat_dir = os.path.join(data_dir, cat_key)
        templates = []

        if os.path.isdir(cat_dir):
            for tmpl_name in sorted(os.listdir(cat_dir)):
                tmpl_dir = os.path.join(cat_dir, tmpl_name)
                manifest_path = os.path.join(tmpl_dir, "manifest.json")
                if not os.path.isfile(manifest_path):
                    continue

                with open(manifest_path, "r", encoding="utf-8") as f:
                    manifest = json.load(f)

                # 读取 content.json，展开所有字段
                content_path = os.path.join(tmpl_dir, "content.json")
                author_notes = ""
                content_text = ""
                ai_generated_content = ""
                plugin_data = None
                if os.path.isfile(content_path):
                    with open(content_path, "r", encoding="utf-8") as f:
                        content_obj = json.load(f)
                    author_notes = content_obj.get("authorNotes", "")
                    content_text = content_obj.get("content", "")
                    ai_generated_content = content_obj.get("aiGeneratedContent", "")
                    if "pluginData" in content_obj and content_obj["pluginData"]:
                        plugin_data = content_obj["pluginData"]

                entry = {
                    "id": manifest["id"],
                    "name": manifest.get("name", ""),
                    "description": manifest.get("description", ""),
                    "authorNotes": author_notes,
                    "content": content_text,
                    "tags": manifest.get("tags", []),
                    "order": manifest.get("order", 0),
                    "enabledPlugins": manifest.get("enabledPlugins", []),
                    "includeContent": manifest.get("includeContent", bool(content_text)),
                    "includeAiContent": manifest.get("includeAiContent", bool(ai_generated_content)),
                }
                if ai_generated_content:
                    entry["aiGeneratedContent"] = ai_generated_content
                if plugin_data:
                    entry["pluginData"] = plugin_data

                templates.append(entry)

        templates.sort(key=lambda t: t["order"])
        total_templates += len(templates)

        cat_json = {
            "key": cat_key,
            "name": cat["name"],
            "icon": cat.get("icon", "📋"),
            "order": cat.get("order", 0),
            "templates": templates,
        }

        output_path = os.path.join(output_dir, f"{cat_key}.json")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(cat_json, f, ensure_ascii=False, indent=2)

    return total_templates


def main():
    print("[build] 构建文档模板数据...")
    themes = find_ppt_themes(DATA_DIR)
    categories = load_categories(DATA_DIR)

    # 生成 PPT 主题
    if themes:
        ts_content = generate_ppt_themes_ts(themes)
        output_path = os.path.join(DIST_DIR, "ppt-themes.generated.ts")
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(ts_content)
        print(f"   [ok] {len(themes)} 个 PPT 主题 -> ppt-themes.generated.ts")
    else:
        print("   [warn] 未找到 PPT 主题")

    # 生成文档模板分类
    if categories:
        cat_content = generate_doc_categories_ts(categories)
        cat_output = os.path.join(DIST_DIR, "doc-template-categories.generated.ts")
        with open(cat_output, "w", encoding="utf-8") as f:
            f.write(cat_content)
        print(f"   [ok] {len(categories)} 个分类 -> doc-template-categories.generated.ts")

    # 生成文档模板列表
    doc_templates = find_doc_templates(DATA_DIR)
    if doc_templates:
        dt_content = generate_doc_templates_ts(doc_templates)
        dt_output = os.path.join(DIST_DIR, "doc-templates.generated.ts")
        with open(dt_output, "w", encoding="utf-8") as f:
            f.write(dt_content)
        print(f"   [ok] {len(doc_templates)} 个文档模板 -> doc-templates.generated.ts")

    # 生成 JSON 文件模式数据（供资源管理器使用）
    json_output_dir = os.path.join(DIST_DIR, "json")
    total = generate_json_files(DATA_DIR, json_output_dir)
    print(f"   [ok] {total} 个模板 -> dist/json/ ({len(categories)} 个分类 JSON 文件)")

    print(f"[done] 构建完成")


if __name__ == "__main__":
    main()
