---
title: Python SDK
parent: 开放 API
nav_order: 1
---

# Python SDK

AiDocPlus Python SDK 提供 Proxy 自动代理，可零配置调用所有 API。

## 安装

```bash
pip install aidocplus
```

或在编程区中直接使用（已自动注入路径）。

## 快速开始

```python
from aidocplus import AiDocPlus

api = AiDocPlus()

# 列出项目
projects = api.project.list()

# 列出文档
docs = api.document.list(projectId="my-project")

# AI 对话
result = api.ai.chat(
    messages=[{"role": "user", "content": "帮我润色这段文字"}],
    system_prompt="你是一位资深的中文编辑"
)

# 导出文档
api.export.markdown(
    projectId="my-project",
    documentId="doc-001",
    outputPath="~/AiDocPlus/exports/output.md"
)

# 提示词模板
templates = api.template.list()
content = api.template.getContent(category="writing", templateId="blog-post")
```

## 连接参数

SDK 按以下优先级获取连接信息：

1. **函数参数**：`AiDocPlus(port=12345, token="xxx")`
2. **环境变量**：`AIDOCPLUS_API_PORT` / `AIDOCPLUS_API_TOKEN`
3. **配置文件**：`~/.aidocplus/api.json`

在编程区中运行时，环境变量已自动注入，无需任何配置。

## API 参考

SDK 使用 Proxy 自动代理，所有 API 命名空间和操作均可直接调用：

```python
api.<namespace>.<method>(**params)
```

详见 [API 参考](./api-reference) 获取完整的命名空间和操作列表。
