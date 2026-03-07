#!/usr/bin/env python3
"""
AiDocPlus 外部自动化 端到端测试

测试所有已实现的 API 命名空间：
  1. 连接 & 状态
  2. app.*
  3. project.*
  4. document.* (CRUD)
  5. template.*
  6. script.*
  7. plugin.*
  8. search.*
  9. export.*
  10. file.* (read/write/metadata)
  11. ai.* (需要已配置 AI 服务)

用法：
  python3 tests/e2e_api_test.py
"""

import os
import sys
import json
import traceback

# 禁用代理（本地 API Server 不走代理）
os.environ.pop("ALL_PROXY", None)
os.environ.pop("all_proxy", None)
os.environ.pop("HTTP_PROXY", None)
os.environ.pop("http_proxy", None)
os.environ.pop("HTTPS_PROXY", None)
os.environ.pop("https_proxy", None)
os.environ["no_proxy"] = "127.0.0.1,localhost"

# 添加 SDK 路径
SDK_PATH = os.path.join(os.path.dirname(__file__), "..", "packages", "sdk-python")
sys.path.insert(0, os.path.abspath(SDK_PATH))

from aidocplus import connect

# ── 测试框架 ──────────────────────────────────────────────

PASS = 0
FAIL = 0
SKIP = 0
results = []

def test(name, fn):
    global PASS, FAIL, SKIP
    try:
        result = fn()
        if result == "SKIP":
            SKIP += 1
            results.append(("⏭️", name, "跳过"))
            print(f"  ⏭️  {name} — 跳过")
        else:
            PASS += 1
            detail = f" → {result}" if result else ""
            results.append(("✅", name, detail))
            print(f"  ✅ {name}{detail}")
    except Exception as e:
        FAIL += 1
        msg = str(e)
        results.append(("❌", name, msg))
        print(f"  ❌ {name} — {msg}")
        traceback.print_exc()

# ── 连接 ─────────────────────────────────────────────────

print("=" * 60)
print("AiDocPlus 外部自动化 · 端到端测试")
print("=" * 60)

try:
    api = connect()
    print(f"\n✅ 已连接到 AiDocPlus API Server")
except Exception as e:
    print(f"\n❌ 连接失败: {e}")
    print("请确保 AiDocPlus 正在运行。")
    sys.exit(1)

# ── 1. 状态 & Schema ─────────────────────────────────────

print("\n── 1. 状态 & Schema ──")

def test_status():
    s = api.status()
    assert s["running"] is True
    return f"v{s['version']}, apiVersion={s['apiVersion']}"
test("status()", test_status)

def test_schema():
    s = api.schema()
    ns = list(s["namespaces"].keys())
    assert len(ns) >= 8, f"命名空间太少: {ns}"
    return f"{len(ns)} 个命名空间: {', '.join(sorted(ns))}"
test("schema()", test_schema)

# ── 2. app.* ──────────────────────────────────────────────

print("\n── 2. app.* ──")

def test_app_status():
    r = api.app.status()
    return f"{json.dumps(r, ensure_ascii=False)[:100]}"
test("app.status()", test_app_status)

def test_app_getActiveProjectId():
    r = api.app.getActiveProjectId()
    return f"projectId={r}"
test("app.getActiveProjectId()", test_app_getActiveProjectId)

def test_app_getActiveDocument():
    r = api.app.getActiveDocument()
    if r and isinstance(r, dict):
        return f"id={r.get('id','?')}, title={r.get('title','?')[:30]}"
    return f"{r}"
test("app.getActiveDocument()", test_app_getActiveDocument)

def test_app_getSelectedText():
    r = api.app.getSelectedText()
    if r:
        return f"选中文本: {str(r)[:50]}"
    return "无选中文本"
test("app.getSelectedText()", test_app_getSelectedText)

# ── 3. project.* ──────────────────────────────────────────

print("\n── 3. project.* ──")

PROJECT_ID = None
def test_project_list():
    global PROJECT_ID
    r = api.project.list()
    assert isinstance(r, list), f"预期 list，得到 {type(r)}"
    if len(r) > 0:
        PROJECT_ID = r[0].get("id") or r[0].get("projectId")
    return f"{len(r)} 个项目" + (f"，首个: {r[0].get('name','?')}" if r else "")
test("project.list()", test_project_list)

# ── 4. document.* ─────────────────────────────────────────

print("\n── 4. document.* ──")

DOC_ID = None
def test_document_list():
    global DOC_ID
    if not PROJECT_ID:
        return "SKIP"
    r = api.document.list(projectId=PROJECT_ID)
    assert isinstance(r, list), f"预期 list，得到 {type(r)}"
    if len(r) > 0:
        DOC_ID = r[0].get("id") or r[0].get("documentId")
    return f"{len(r)} 篇文档" + (f"，首篇: {r[0].get('title','?')[:30]}" if r else "")
test("document.list()", test_document_list)

def test_document_get():
    if not PROJECT_ID or not DOC_ID:
        return "SKIP"
    r = api.document.get(projectId=PROJECT_ID, documentId=DOC_ID)
    assert isinstance(r, dict), f"预期 dict，得到 {type(r)}"
    content = r.get("content", "")
    return f"标题: {r.get('title','?')[:30]}，内容长度: {len(content)}"
test("document.get()", test_document_get)

TEST_DOC_ID = None
def test_document_create():
    global TEST_DOC_ID
    if not PROJECT_ID:
        return "SKIP"
    r = api.document.create(
        projectId=PROJECT_ID,
        title="[E2E测试] 自动化测试文档",
        author="e2e_test"
    )
    if isinstance(r, dict):
        TEST_DOC_ID = r.get("id") or r.get("documentId")
    elif isinstance(r, str):
        TEST_DOC_ID = r
    return f"新文档 ID: {TEST_DOC_ID}"
test("document.create()", test_document_create)

def test_document_save():
    if not PROJECT_ID or not TEST_DOC_ID:
        return "SKIP"
    test_content = "# 自动化测试\n\n这是由 E2E 测试脚本自动创建的文档。\n\n- 时间: 测试运行中\n- 状态: 通过"
    r = api.document.save(
        projectId=PROJECT_ID,
        documentId=TEST_DOC_ID,
        title="[E2E测试] 自动化测试文档（已保存）",
        content=test_content
    )
    return f"保存成功"
test("document.save()", test_document_save)

# ── 5. template.* ─────────────────────────────────────────

print("\n── 5. template.* ──")

TEMPLATE_ID = None
def test_template_list():
    global TEMPLATE_ID
    r = api.template.list()
    # 返回可能是 list 或 dict（含 categories 字段）
    if isinstance(r, dict):
        cats = r.get("categories", r.get("templates", []))
        if isinstance(cats, list) and len(cats) > 0:
            for cat in cats:
                templates = cat.get("templates", [])
                if templates:
                    TEMPLATE_ID = templates[0].get("id")
                    break
        return f"{len(cats)} 个分类（dict 格式）"
    elif isinstance(r, list):
        if len(r) > 0:
            first_cat = r[0]
            templates = first_cat.get("templates", [])
            if templates:
                TEMPLATE_ID = templates[0].get("id")
        return f"{len(r)} 个分类（list 格式）"
    return f"返回类型: {type(r)}"
test("template.list()", test_template_list)

def test_template_getContent():
    if not TEMPLATE_ID:
        return "SKIP"
    r = api.template.getContent(templateId=TEMPLATE_ID)
    if isinstance(r, dict):
        content = r.get("content", "")
        return f"模板内容长度: {len(content)}"
    return f"返回: {str(r)[:80]}"
test("template.getContent()", test_template_getContent)

# ── 6. script.* ───────────────────────────────────────────

print("\n── 6. script.* ──")

def test_script_listFiles():
    r = api.script.listFiles()
    if isinstance(r, list):
        return f"{len(r)} 个脚本文件"
    if isinstance(r, dict):
        files = r.get("files", [])
        return f"{len(files)} 个脚本文件"
    return f"返回: {str(r)[:80]}"
test("script.listFiles()", test_script_listFiles)

# ── 7. plugin.* ───────────────────────────────────────────

print("\n── 7. plugin.* ──")

def test_plugin_list():
    r = api.plugin.list()
    if isinstance(r, dict):
        plugins = r.get("plugins", [])
        total = r.get("total", len(plugins))
        names = [p.get("name", p.get("id", "?")) for p in plugins[:5]]
        return f"{total} 个插件" + (f"，前5: {', '.join(names)}" if names else "")
    if isinstance(r, list):
        names = [p.get("name", p.get("id", "?")) for p in r[:5]]
        return f"{len(r)} 个插件，前5: {', '.join(names)}"
    return f"返回: {str(r)[:80]}"
test("plugin.list()", test_plugin_list)

# ── 8. search.* ───────────────────────────────────────────

print("\n── 8. search.* ──")

def test_search_documents():
    r = api.search.documents(query="测试")
    if isinstance(r, list):
        return f"搜索到 {len(r)} 篇文档"
    if isinstance(r, dict):
        results = r.get("results", [])
        return f"搜索到 {len(results)} 篇文档"
    return f"返回: {str(r)[:80]}"
test("search.documents()", test_search_documents)

# ── 9. export.* ───────────────────────────────────────────

print("\n── 9. export.* ──")

def test_export_markdown():
    r = api.export.markdown(content="# 测试标题\n\n测试内容段落。")
    if isinstance(r, dict):
        return f"导出路径: {r.get('path', '?')}"
    return f"返回: {str(r)[:80]}"
test("export.markdown()", test_export_markdown)

def test_export_html():
    r = api.export.html(content="# HTML导出测试\n\n<p>段落</p>")
    if isinstance(r, dict):
        return f"导出路径: {r.get('path', '?')}"
    return f"返回: {str(r)[:80]}"
test("export.html()", test_export_html)

def test_export_txt():
    r = api.export.txt(content="纯文本导出测试。")
    if isinstance(r, dict):
        return f"导出路径: {r.get('path', '?')}"
    return f"返回: {str(r)[:80]}"
test("export.txt()", test_export_txt)

# ── 10. file.* ────────────────────────────────────────────

print("\n── 10. file.* ──")

TEST_FILE_PATH = os.path.expanduser("~/AiDocPlus/_e2e_test_file.txt")
def test_file_write():
    r = api.file.write(path=TEST_FILE_PATH, content="E2E 测试文件内容\n第二行")
    return f"写入成功"
test("file.write()", test_file_write)

def test_file_read():
    r = api.file.read(path=TEST_FILE_PATH)
    if isinstance(r, dict):
        content = r.get("content", "")
        return f"读取 {len(content)} 字符"
    elif isinstance(r, str):
        return f"读取 {len(r)} 字符"
    return f"返回: {str(r)[:80]}"
test("file.read()", test_file_read)

def test_file_metadata():
    r = api.file.metadata(path=TEST_FILE_PATH)
    if isinstance(r, dict):
        return f"大小: {r.get('size', '?')} bytes"
    return f"返回: {str(r)[:80]}"
test("file.metadata()", test_file_metadata)

# ── 11. ai.* (可选) ───────────────────────────────────────

print("\n── 11. ai.* (需要已配置 AI 服务) ──")

def test_ai_generate():
    try:
        r = api.ai.generate(prompt="用一句话回答：1+1等于几？", temperature=0.1, max_tokens=50)
        if isinstance(r, dict):
            text = r.get("text", r.get("content", str(r)))
            return f"AI 回复: {str(text)[:80]}"
        return f"返回: {str(r)[:80]}"
    except Exception as e:
        msg = str(e)
        if "未配置" in msg or "not configured" in msg.lower() or "不可用" in msg:
            return "SKIP"
        if "429" in msg or "Too Many Requests" in msg or "访问量过大" in msg or "rate" in msg.lower():
            return "SKIP"  # AI 服务限流，非本地 bug
        raise
test("ai.generate()", test_ai_generate)

# ── 清理测试数据 ──────────────────────────────────────────

print("\n── 清理 ──")

def test_cleanup_file():
    if os.path.exists(TEST_FILE_PATH):
        os.remove(TEST_FILE_PATH)
    return "已清理测试文件"
test("清理测试文件", test_cleanup_file)

# ── 汇总 ─────────────────────────────────────────────────

print("\n" + "=" * 60)
print(f"测试汇总: ✅ {PASS} 通过  ❌ {FAIL} 失败  ⏭️  {SKIP} 跳过  (共 {PASS+FAIL+SKIP})")
print("=" * 60)

if FAIL > 0:
    print("\n失败项:")
    for icon, name, detail in results:
        if icon == "❌":
            print(f"  {icon} {name}: {detail}")

sys.exit(1 if FAIL > 0 else 0)
