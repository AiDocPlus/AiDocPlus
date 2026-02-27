#!/usr/bin/env python3
"""
从 shared-types/src/index.ts 中提取 BUILT_IN_TEMPLATES 和 TEMPLATE_CATEGORIES，
拆分为独立的 manifest.json + content.md 文件。
"""
import json
import os
import re
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(REPO_DIR, "data")

# 源文件路径
SOURCE_FILE = os.path.join(
    os.path.dirname(REPO_DIR), "AiDocPlus-Main",
    "packages", "shared-types", "src", "index.ts"
)


def extract_templates_and_categories(source_path: str):
    """用正则 + 状态机从 TypeScript 源码中提取模板数据"""
    with open(source_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 提取 TEMPLATE_CATEGORIES
    cat_match = re.search(
        r"export const TEMPLATE_CATEGORIES:\s*Record<string,\s*TemplateCategoryInfo>\s*=\s*\{(.*?)\};",
        content, re.DOTALL
    )
    categories = {}
    if cat_match:
        cat_block = cat_match.group(1)
        # 解析每个分类条目
        for m in re.finditer(
            r"['\"]?([\w-]+)['\"]?\s*:\s*\{\s*name:\s*['\"]([^'\"]+)['\"],\s*icon:\s*['\"]([^'\"]+)['\"]",
            cat_block
        ):
            key, name, icon = m.group(1), m.group(2), m.group(3)
            categories[key] = {"name": name, "icon": icon}

    # 提取 BUILT_IN_TEMPLATES 数组
    # 找到数组开始位置
    arr_start = content.find("export const BUILT_IN_TEMPLATES: PromptTemplate[] = [")
    if arr_start == -1:
        print("❌ 未找到 BUILT_IN_TEMPLATES")
        sys.exit(1)

    # 从数组开始位置解析每个对象
    templates = []
    pos = content.find("[", arr_start) + 1

    while pos < len(content):
        # 跳过空白和注释
        while pos < len(content) and content[pos] in " \t\n\r":
            pos += 1

        # 检查是否到达数组末尾
        if pos >= len(content) or content[pos] == "]":
            break

        # 跳过注释行
        if content[pos:pos+2] == "//":
            pos = content.find("\n", pos) + 1
            continue

        # 找到对象开始 {
        if content[pos] != "{":
            pos += 1
            continue

        # 匹配完整的对象（处理嵌套大括号和模板字符串）
        obj_start = pos
        brace_count = 0
        in_string = False
        string_char = None
        in_template = False
        i = pos

        while i < len(content):
            ch = content[i]

            if in_template:
                if ch == "\\" and i + 1 < len(content):
                    i += 2
                    continue
                if ch == "`":
                    in_template = False
                i += 1
                continue

            if in_string:
                if ch == "\\" and i + 1 < len(content):
                    i += 2
                    continue
                if ch == string_char:
                    in_string = False
                i += 1
                continue

            if ch == "`":
                in_template = True
                i += 1
                continue

            if ch in ("'", '"'):
                in_string = True
                string_char = ch
                i += 1
                continue

            if ch == "{":
                brace_count += 1
            elif ch == "}":
                brace_count -= 1
                if brace_count == 0:
                    obj_end = i + 1
                    obj_text = content[obj_start:obj_end]
                    template = parse_template_object(obj_text)
                    if template:
                        templates.append(template)
                    pos = obj_end
                    # 跳过逗号
                    while pos < len(content) and content[pos] in " \t\n\r,":
                        pos += 1
                    break

            i += 1
        else:
            break

    return templates, categories


def parse_template_object(obj_text: str) -> dict:
    """解析单个模板对象的 TypeScript 文本"""
    template = {}

    # 提取 id
    m = re.search(r"id:\s*['\"]([^'\"]+)['\"]", obj_text)
    if m:
        template["id"] = m.group(1)
    else:
        return None

    # 提取 name
    m = re.search(r"name:\s*['\"]([^'\"]+)['\"]", obj_text)
    if m:
        template["name"] = m.group(1)

    # 提取 category
    m = re.search(r"category:\s*['\"]([^'\"]+)['\"]", obj_text)
    if m:
        template["category"] = m.group(1)

    # 提取 description
    m = re.search(r"description:\s*['\"]([^'\"]*)['\"]", obj_text)
    if m:
        template["description"] = m.group(1)

    # 提取 content（可能是模板字符串或普通字符串）
    content = extract_content(obj_text)
    if content:
        template["content"] = content

    # 提取 variables
    m = re.search(r"variables:\s*\[(.*?)\]", obj_text, re.DOTALL)
    if m:
        vars_text = m.group(1)
        variables = re.findall(r"['\"]([^'\"]+)['\"]", vars_text)
        if variables:
            template["variables"] = variables

    template["isBuiltIn"] = True

    return template


def extract_content(obj_text: str) -> str:
    """从对象文本中提取 content 字段的值"""
    # 找到 content: 的位置
    m = re.search(r"\bcontent:\s*", obj_text)
    if not m:
        return ""

    pos = m.end()

    # 判断是模板字符串还是普通字符串
    if pos < len(obj_text) and obj_text[pos] == "`":
        # 模板字符串
        start = pos + 1
        i = start
        while i < len(obj_text):
            if obj_text[i] == "\\" and i + 1 < len(obj_text):
                i += 2
                continue
            if obj_text[i] == "`":
                return obj_text[start:i]
            i += 1
    elif pos < len(obj_text) and obj_text[pos] in ("'", '"'):
        # 普通字符串
        quote = obj_text[pos]
        start = pos + 1
        i = start
        while i < len(obj_text):
            if obj_text[i] == "\\" and i + 1 < len(obj_text):
                i += 2
                continue
            if obj_text[i] == quote:
                return obj_text[start:i].replace("\\n", "\n").replace("\\'", "'").replace('\\"', '"')
            i += 1

    return ""


def write_templates(templates: list, categories: dict):
    """将模板写入独立文件"""
    os.makedirs(DATA_DIR, exist_ok=True)

    # 写入 _meta.json
    cat_list = []
    for i, (key, info) in enumerate(categories.items()):
        cat_list.append({
            "key": key,
            "name": info["name"],
            "icon": info["icon"],
            "order": i,
            "subCategories": [
                {"key": "general", "name": "综合", "order": 0}
            ]
        })

    meta = {
        "schemaVersion": "1.0",
        "resourceType": "prompt-template",
        "defaultLocale": "zh",
        "categories": cat_list
    }

    with open(os.path.join(DATA_DIR, "_meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    # 按分类分组写入
    count = 0
    for tmpl in templates:
        category = tmpl.get("category", "general")
        tmpl_id = tmpl.get("id", "")
        if not tmpl_id:
            continue

        # 创建目录: data/{category}/{id}/
        tmpl_dir = os.path.join(DATA_DIR, category, tmpl_id)
        os.makedirs(tmpl_dir, exist_ok=True)

        # 写入 content.md
        content = tmpl.get("content", "")
        with open(os.path.join(tmpl_dir, "content.md"), "w", encoding="utf-8") as f:
            f.write(content)

        # 写入 manifest.json
        manifest = {
            "id": tmpl_id,
            "name": tmpl.get("name", ""),
            "description": tmpl.get("description", ""),
            "icon": categories.get(category, {}).get("icon", "📋"),
            "version": "1.0.0",
            "author": "AiDocPlus",
            "resourceType": "prompt-template",
            "majorCategory": category,
            "subCategory": "general",
            "tags": [tmpl.get("name", "")],
            "order": count,
            "enabled": True,
            "source": "builtin",
            "createdAt": "2026-02-18T00:00:00Z",
            "updatedAt": "2026-02-18T00:00:00Z",
        }

        if tmpl.get("variables"):
            manifest["variables"] = [
                {"name": v, "label": v, "type": "text", "required": False}
                for v in tmpl["variables"]
            ]

        with open(os.path.join(tmpl_dir, "manifest.json"), "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)

        count += 1

    return count


def main():
    if not os.path.exists(SOURCE_FILE):
        print(f"❌ 源文件不存在: {SOURCE_FILE}")
        sys.exit(1)

    print(f"📖 读取源文件: {SOURCE_FILE}")
    templates, categories = extract_templates_and_categories(SOURCE_FILE)

    print(f"   找到 {len(categories)} 个分类")
    print(f"   找到 {len(templates)} 个模板")

    if not templates:
        print("❌ 未提取到任何模板")
        sys.exit(1)

    # 按分类统计
    cat_counts = {}
    for t in templates:
        cat = t.get("category", "unknown")
        cat_counts[cat] = cat_counts.get(cat, 0) + 1

    print("\n📊 分类统计:")
    for cat, count in sorted(cat_counts.items(), key=lambda x: -x[1]):
        name = categories.get(cat, {}).get("name", cat)
        print(f"   {name} ({cat}): {count} 个")

    print(f"\n📝 写入模板文件到 {DATA_DIR}...")
    written = write_templates(templates, categories)
    print(f"✅ 完成！共写入 {written} 个模板")


if __name__ == "__main__":
    main()
