---
title: MCP Server
parent: 开放 API
nav_order: 3
---

# MCP Server

AiDocPlus MCP Server 实现了 [Model Context Protocol](https://modelcontextprotocol.io/)，提供 23 个工具，可被 Claude Desktop、Cursor 等 AI 工具直接调用。

## 配置

### Claude Desktop

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`（macOS）：

```json
{
  "mcpServers": {
    "aidocplus": {
      "command": "node",
      "args": ["/path/to/AiDocPlus/packages/mcp-server/index.js"]
    }
  }
}
```

### Cursor

在 Cursor 的 MCP 配置中添加相同的命令和参数。

## 工具列表（23 个）

### 程序与项目（4 个）
| 工具 | 说明 |
|------|------|
| `aidocplus_app_status` | 获取程序运行状态 |
| `aidocplus_project_list` | 列出所有项目 |
| `aidocplus_app_get_active_document` | 获取当前活动文档 |
| `aidocplus_app_get_selected_text` | 获取编辑器选中文本 |

### 文档操作（5 个）
| 工具 | 说明 |
|------|------|
| `aidocplus_document_list` | 列出项目下的文档 |
| `aidocplus_document_get` | 获取文档详情 |
| `aidocplus_document_create` | 创建新文档 |
| `aidocplus_document_save` | 保存文档 |
| `aidocplus_search_documents` | 搜索文档 |

### AI 对话（2 个）
| 工具 | 说明 |
|------|------|
| `aidocplus_ai_chat` | AI 对话（支持 system_prompt） |
| `aidocplus_ai_generate` | AI 内容生成（支持 system_prompt） |

### 模板与插件（3 个）
| 工具 | 说明 |
|------|------|
| `aidocplus_template_list` | 列出提示词模板 |
| `aidocplus_template_get_content` | 获取模板内容 |
| `aidocplus_plugin_list` | 列出已安装插件 |

### 文件操作（3 个）
| 工具 | 说明 |
|------|------|
| `aidocplus_file_read` | 读取文件 |
| `aidocplus_file_write` | 写入文件 |
| `aidocplus_file_metadata` | 获取文件元数据 |

### 导出（5 个）
| 工具 | 说明 |
|------|------|
| `aidocplus_export_markdown` | 导出为 Markdown |
| `aidocplus_export_html` | 导出为 HTML |
| `aidocplus_export_docx` | 导出为 Word |
| `aidocplus_export_pdf` | 导出为 PDF |
| `aidocplus_export_txt` | 导出为纯文本 |

### 脚本（1 个）
| 工具 | 说明 |
|------|------|
| `aidocplus_script_list_files` | 列出编程区脚本文件 |

## 连接方式

MCP Server 通过 stdio 协议与 AI 工具通信，内部通过 HTTP 调用 AiDocPlus API Server。连接参数从环境变量或 `~/.aidocplus/api.json` 自动获取。
