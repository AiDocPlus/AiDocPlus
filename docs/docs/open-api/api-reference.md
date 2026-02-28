---
title: API 参考
parent: 开放 API
nav_order: 4
---

# API 参考

AiDocPlus 开放 API 采用 JSON-RPC 风格，通过 `POST /api/v1/call` 统一入口调用。

## 请求格式

```json
{
  "method": "<namespace>.<operation>",
  "params": { ... }
}
```

## 命名空间

### app — 程序状态

| 操作 | 参数 | 说明 |
|------|------|------|
| `app.status` | 无 | 获取程序运行状态 |
| `app.getActiveDocument` | 无 | 获取当前活动文档 |
| `app.getSelectedText` | 无 | 获取编辑器选中文本 |
| `app.getActiveProjectId` | 无 | 获取当前活动项目 ID |

### document — 文档操作

| 操作 | 参数 | 说明 |
|------|------|------|
| `document.list` | `projectId` | 列出项目下的文档 |
| `document.get` | `projectId`, `documentId` | 获取文档详情 |
| `document.create` | `projectId`, `title`, `content?` | 创建新文档 |
| `document.save` | `projectId`, `documentId`, `content` | 保存文档 |

### project — 项目管理

| 操作 | 参数 | 说明 |
|------|------|------|
| `project.list` | 无 | 列出所有项目 |

### search — 搜索

| 操作 | 参数 | 说明 |
|------|------|------|
| `search.documents` | `query`, `projectId?` | 搜索文档 |

### ai — AI 对话与生成

| 操作 | 参数 | 说明 |
|------|------|------|
| `ai.chat` | `messages`, `system_prompt?`, `temperature?`, `max_tokens?` | AI 对话 |
| `ai.generate` | `prompt`, `system_prompt?`, `temperature?`, `max_tokens?` | AI 内容生成 |

`messages` 格式：`[{"role": "user", "content": "..."}]`

### export — 导出

| 操作 | 参数 | 说明 |
|------|------|------|
| `export.markdown` | `content` 或 `projectId`+`documentId`, `outputPath` | 导出 Markdown |
| `export.html` | 同上 | 导出 HTML |
| `export.docx` | 同上 | 导出 Word |
| `export.pdf` | 同上 | 导出 PDF |
| `export.txt` | 同上 | 导出纯文本 |

导出支持两种模式：传入 `content` 直接导出，或传入 `projectId` + `documentId` 从存储加载。

### template — 提示词模板

| 操作 | 参数 | 说明 |
|------|------|------|
| `template.list` | 无 | 列出所有模板分类和模板 |
| `template.getContent` | `category`, `templateId` | 获取模板内容 |

### plugin — 插件管理

| 操作 | 参数 | 说明 |
|------|------|------|
| `plugin.list` | 无 | 列出已安装插件 |
| `plugin.storage.get` | `pluginId`, `key` | 获取插件存储值 |
| `plugin.storage.set` | `pluginId`, `key`, `value` | 设置插件存储值 |

### file — 文件操作

| 操作 | 参数 | 说明 |
|------|------|------|
| `file.read` | `path` | 读取文件内容 |
| `file.write` | `path`, `content` | 写入文件内容 |
| `file.metadata` | `path` | 获取文件元数据 |

> 路径限制：所有文件操作限制在 `~/AiDocPlus/` 目录下。

### script — 脚本管理

| 操作 | 参数 | 说明 |
|------|------|------|
| `script.listFiles` | 无 | 列出编程区脚本文件 |

### tts — 语音朗读（占位）

| 操作 | 参数 | 说明 |
|------|------|------|
| `tts.speak` | `text` | 朗读文本 |
| `tts.stop` | 无 | 停止朗读 |
| `tts.listVoices` | 无 | 列出可用语音 |

### email — 邮件（占位）

| 操作 | 参数 | 说明 |
|------|------|------|
| `email.send` | `to`, `subject`, `body` | 发送邮件 |
| `email.testConnection` | 无 | 测试邮件连接 |

## 响应格式

```json
{
  "success": true,
  "data": { ... }
}
```

错误响应：

```json
{
  "success": false,
  "error": "错误信息"
}
```

## 动态 Schema

调用 `GET /api/v1/schema` 可获取实时的 API 自描述信息，包含所有命名空间、操作和参数说明。
