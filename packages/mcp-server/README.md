# AiDocPlus MCP Server

通过 [Model Context Protocol](https://modelcontextprotocol.io/) 让 AI 助手（Claude Desktop、Cursor 等）直接操作 AiDocPlus。

## 前提条件

- AiDocPlus 桌面程序正在运行（API Server 会自动启动）
- Node.js 18+

## 安装依赖

```bash
cd packages/mcp-server
npm install
```

## Claude Desktop 配置

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`（macOS）或 `%APPDATA%\Claude\claude_desktop_config.json`（Windows）：

```json
{
  "mcpServers": {
    "aidocplus": {
      "command": "node",
      "args": ["/Users/你的用户名/Code/AiDocPlus/packages/mcp-server/index.js"]
    }
  }
}
```

## 可用工具（23 个）

### 程序与项目

| 工具名 | 说明 |
|--------|------|
| `aidocplus_status` | 获取程序运行状态 |
| `aidocplus_get_active_document` | 获取当前编辑的文档 |
| `aidocplus_get_selected_text` | 获取选中的文本 |
| `aidocplus_list_projects` | 列出所有项目 |

### 文档操作

| 工具名 | 说明 |
|--------|------|
| `aidocplus_list_documents` | 列出项目中的文档 |
| `aidocplus_get_document` | 获取文档详情 |
| `aidocplus_create_document` | 创建新文档 |
| `aidocplus_save_document` | 保存文档内容 |
| `aidocplus_search_documents` | 搜索文档 |

### AI 对话

| 工具名 | 说明 |
|--------|------|
| `aidocplus_ai_chat` | AI 对话（支持 system_prompt 参数） |
| `aidocplus_ai_generate` | AI 内容生成（快捷方式） |

### 模板与插件

| 工具名 | 说明 |
|--------|------|
| `aidocplus_list_templates` | 列出提示词模板（内置+自定义） |
| `aidocplus_get_template_content` | 获取模板完整内容 |
| `aidocplus_list_plugins` | 列出已安装的插件 |

### 文件操作

| 工具名 | 说明 |
|--------|------|
| `aidocplus_file_read` | 读取文件（限 ~/AiDocPlus/ 下） |
| `aidocplus_file_write` | 写入文件（限 ~/AiDocPlus/ 下） |
| `aidocplus_file_metadata` | 获取文件元数据 |

### 导出

| 工具名 | 说明 |
|--------|------|
| `aidocplus_export_markdown` | 导出为 Markdown 文件 |
| `aidocplus_export_html` | 导出为 HTML（公文排版） |
| `aidocplus_export_docx` | 导出为 Word（公文排版） |
| `aidocplus_export_pdf` | 导出为 PDF（浏览器打印） |
| `aidocplus_export_txt` | 导出为纯文本 |

### 脚本

| 工具名 | 说明 |
|--------|------|
| `aidocplus_list_scripts` | 列出脚本文件 |

## 工作原理

```
Claude Desktop  ←(stdio/MCP)→  MCP Server  ←(HTTP)→  AiDocPlus API Server
```

MCP Server 读取 `~/.aidocplus/api.json` 获取 AiDocPlus 的连接信息（端口 + Token），然后将 MCP tool 调用转发为 HTTP API 请求。
