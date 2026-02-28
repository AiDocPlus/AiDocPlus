# AiDocPlus Python SDK

在 Python 脚本中调用 AiDocPlus 主程序的各种功能。

## 快速开始

```python
import aidocplus

# 连接到正在运行的 AiDocPlus（在编程区中运行时自动连接）
api = aidocplus.connect()

# 列出项目
projects = api.project.list()

# 列出文档
docs = api.document.list(projectId="your-project-id")

# 获取文档详情
doc = api.document.get(projectId="pid", documentId="did")

# 保存文档
api.document.save(projectId="pid", documentId="did", content="新内容")

# 搜索文档
results = api.search.documents(query="关键词")

# 获取程序状态
status = api.app.status()

# AI 对话
result = api.ai.chat(messages=[{"role": "user", "content": "你好"}])
print(result["content"])

# AI 对话（带系统提示）
result = api.ai.chat(
    messages=[{"role": "user", "content": "帮我润色这段文字"}],
    system_prompt="你是一位资深的中文编辑"
)

# AI 内容生成（快捷方式）
result = api.ai.generate(prompt="写一篇关于人工智能的短文")

# 导出文档为 Word
api.export.docx(projectId="pid", documentId="did")

# 直接导出 Markdown 内容为 HTML
api.export.html(content="# 标题\n正文内容", title="测试文档")

# 读写文件（限 ~/AiDocPlus/ 下）
api.file.write(path="~/AiDocPlus/notes/test.txt", content="hello")
data = api.file.read(path="~/AiDocPlus/notes/test.txt")

# 列出脚本文件
scripts = api.script.listFiles()

# 列出提示词模板
templates = api.template.list()
for t in templates["templates"]:
    print(t["name"], t["category"])

# 获取模板内容
tpl = api.template.getContent(templateId="some-template-id")
print(tpl["content"])
```

## 连接方式

连接参数按以下优先级获取：
1. **函数参数** — `aidocplus.connect(port=45678, token="xxx")`
2. **环境变量** — `AIDOCPLUS_API_PORT` + `AIDOCPLUS_API_TOKEN`（编程区自动注入）
3. **配置文件** — `~/.aidocplus/api.json`（程序启动时自动生成）

## API 命名空间

| 命名空间 | 说明 | 示例 |
|----------|------|------|
| `api.app` | 程序状态 | `api.app.status()` |
| `api.document` | 文档操作 | `api.document.list(projectId="...")` |
| `api.project` | 项目管理 | `api.project.list()` |
| `api.ai` | AI 对话 | `api.ai.chat(messages=[...])` |
| `api.search` | 搜索 | `api.search.documents(query="...")` |
| `api.export` | 导出 | `api.export.pdf(documentId="...")` |
| `api.email` | 邮件 | `api.email.send(to=[...])` |
| `api.template` | 模板 | `api.template.list()` |
| `api.plugin` | 插件 | `api.plugin.list()` |
| `api.tts` | 语音 | `api.tts.speak(text="...")` |
| `api.file` | 文件 | `api.file.read(path="...")` |
| `api.script` | 脚本 | `api.script.listFiles()` |
