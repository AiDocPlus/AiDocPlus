#!/usr/bin/env node

/**
 * AiDocPlus MCP Server
 *
 * 通过 Model Context Protocol 暴露 AiDocPlus 的 API，
 * 让 AI 助手（Claude Desktop、Cursor 等）能直接操作文档、项目等。
 *
 * 使用方式：在 Claude Desktop 配置中添加：
 * {
 *   "mcpServers": {
 *     "aidocplus": {
 *       "command": "node",
 *       "args": ["/path/to/packages/mcp-server/index.js"]
 *     }
 *   }
 * }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ============================================================
// AiDocPlus HTTP 客户端（内联，避免外部依赖）
// ============================================================

function readApiJson() {
  const p = path.join(os.homedir(), '.aidocplus', 'api.json');
  try {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

function callApi(port, token, method, params = {}) {
  const payload = JSON.stringify({ method, params, id: `mcp_${Date.now()}` });
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/v1/call',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Caller-Level': 'external',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 30000,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          try {
            const body = JSON.parse(data);
            if (body.error) reject(new Error(`[${body.error.code}] ${body.error.message}`));
            else resolve(body.result);
          } catch (e) {
            reject(new Error(`解析响应失败: ${e.message}`));
          }
        });
      },
    );
    req.on('error', (e) => reject(new Error(`无法连接到 AiDocPlus: ${e.message}`)));
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
    req.write(payload);
    req.end();
  });
}

// ============================================================
// 工具定义
// ============================================================

const TOOLS = [
  {
    name: 'aidocplus_status',
    description: '获取 AiDocPlus 程序运行状态',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'aidocplus_get_active_document',
    description: '获取当前正在编辑的文档（标题、内容等）',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'aidocplus_get_selected_text',
    description: '获取编辑器中选中的文本',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'aidocplus_list_projects',
    description: '列出所有项目',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'aidocplus_list_documents',
    description: '列出指定项目中的所有文档',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'aidocplus_get_document',
    description: '获取指定文档的详情（标题、内容、元数据）',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
        documentId: { type: 'string', description: '文档 ID' },
      },
      required: ['projectId', 'documentId'],
    },
  },
  {
    name: 'aidocplus_create_document',
    description: '在指定项目中创建新文档',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
        title: { type: 'string', description: '文档标题' },
        author: { type: 'string', description: '作者（可选）' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'aidocplus_save_document',
    description: '保存文档内容',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
        documentId: { type: 'string', description: '文档 ID' },
        title: { type: 'string', description: '新标题（可选）' },
        content: { type: 'string', description: '新内容（可选）' },
      },
      required: ['projectId', 'documentId'],
    },
  },
  {
    name: 'aidocplus_search_documents',
    description: '搜索文档',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
        projectId: { type: 'string', description: '限定项目（可选）' },
      },
      required: ['query'],
    },
  },
  {
    name: 'aidocplus_ai_chat',
    description: '调用 AiDocPlus 内置 AI 对话',
    inputSchema: {
      type: 'object',
      properties: {
        messages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['user', 'assistant', 'system'] },
              content: { type: 'string' },
            },
          },
          description: '对话消息列表',
        },
        system_prompt: { type: 'string', description: '系统提示（自动注入到 messages 最前）' },
        temperature: { type: 'number', description: '温度 (0-2, 默认 0.7)' },
        max_tokens: { type: 'number', description: '最大生成 token 数' },
      },
      required: ['messages'],
    },
  },
  {
    name: 'aidocplus_ai_generate',
    description: '使用 AiDocPlus AI 生成内容（快捷方式，自动构建 user 消息）',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '生成提示词' },
        system_prompt: { type: 'string', description: '系统提示' },
        temperature: { type: 'number', description: '温度 (0-2, 默认 0.7)' },
        max_tokens: { type: 'number', description: '最大生成 token 数' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'aidocplus_list_templates',
    description: '列出所有提示词模板（内置 + 自定义）',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'aidocplus_get_template_content',
    description: '获取指定提示词模板的完整内容（含变量占位符）',
    inputSchema: {
      type: 'object',
      properties: {
        templateId: { type: 'string', description: '模板 ID' },
      },
      required: ['templateId'],
    },
  },
  {
    name: 'aidocplus_list_plugins',
    description: '列出已安装的插件',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'aidocplus_file_read',
    description: '读取 ~/AiDocPlus/ 下的文件内容',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件路径（限 ~/AiDocPlus/ 下）' },
      },
      required: ['path'],
    },
  },
  {
    name: 'aidocplus_file_write',
    description: '写入文件到 ~/AiDocPlus/ 下',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件路径（限 ~/AiDocPlus/ 下）' },
        content: { type: 'string', description: '文件内容' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'aidocplus_file_metadata',
    description: '获取 ~/AiDocPlus/ 下文件的元数据（大小、修改时间等）',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件路径（限 ~/AiDocPlus/ 下）' },
      },
      required: ['path'],
    },
  },
  {
    name: 'aidocplus_export_html',
    description: '将 Markdown 内容或文档导出为 HTML（公文排版）',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Markdown 内容（与 projectId+documentId 二选一）' },
        projectId: { type: 'string', description: '项目 ID' },
        documentId: { type: 'string', description: '文档 ID' },
        title: { type: 'string', description: '文档标题' },
        outputPath: { type: 'string', description: '输出路径（可选，默认 ~/AiDocPlus/exports/）' },
      },
    },
  },
  {
    name: 'aidocplus_export_docx',
    description: '将 Markdown 内容或文档导出为 Word（公文排版）',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Markdown 内容（与 projectId+documentId 二选一）' },
        projectId: { type: 'string', description: '项目 ID' },
        documentId: { type: 'string', description: '文档 ID' },
        title: { type: 'string', description: '文档标题' },
        outputPath: { type: 'string', description: '输出路径（可选）' },
      },
    },
  },
  {
    name: 'aidocplus_export_txt',
    description: '将 Markdown 内容或文档导出为纯文本',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Markdown 内容（与 projectId+documentId 二选一）' },
        projectId: { type: 'string', description: '项目 ID' },
        documentId: { type: 'string', description: '文档 ID' },
        title: { type: 'string', description: '文档标题' },
        outputPath: { type: 'string', description: '输出路径（可选）' },
      },
    },
  },
  {
    name: 'aidocplus_export_markdown',
    description: '将文档导出为 Markdown 文件',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Markdown 内容（与 projectId+documentId 二选一）' },
        projectId: { type: 'string', description: '项目 ID' },
        documentId: { type: 'string', description: '文档 ID' },
        title: { type: 'string', description: '文档标题' },
        outputPath: { type: 'string', description: '输出路径（可选）' },
      },
    },
  },
  {
    name: 'aidocplus_export_pdf',
    description: '将 Markdown 内容或文档导出为可打印 PDF（浏览器打印）',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Markdown 内容（与 projectId+documentId 二选一）' },
        projectId: { type: 'string', description: '项目 ID' },
        documentId: { type: 'string', description: '文档 ID' },
        title: { type: 'string', description: '文档标题' },
        outputPath: { type: 'string', description: '输出路径（可选）' },
      },
    },
  },
  {
    name: 'aidocplus_list_scripts',
    description: '列出 ~/AiDocPlus/CodingScripts/ 下的脚本文件',
    inputSchema: { type: 'object', properties: {} },
  },
];

// 工具名 → API 方法的映射
const TOOL_METHOD_MAP = {
  aidocplus_status: 'app.status',
  aidocplus_get_active_document: 'app.getActiveDocument',
  aidocplus_get_selected_text: 'app.getSelectedText',
  aidocplus_list_projects: 'project.list',
  aidocplus_list_documents: 'document.list',
  aidocplus_get_document: 'document.get',
  aidocplus_create_document: 'document.create',
  aidocplus_save_document: 'document.save',
  aidocplus_search_documents: 'search.documents',
  aidocplus_ai_chat: 'ai.chat',
  aidocplus_ai_generate: 'ai.generate',
  aidocplus_list_templates: 'template.list',
  aidocplus_get_template_content: 'template.getContent',
  aidocplus_list_plugins: 'plugin.list',
  aidocplus_file_read: 'file.read',
  aidocplus_file_write: 'file.write',
  aidocplus_file_metadata: 'file.metadata',
  aidocplus_export_html: 'export.html',
  aidocplus_export_docx: 'export.docx',
  aidocplus_export_txt: 'export.txt',
  aidocplus_export_markdown: 'export.markdown',
  aidocplus_export_pdf: 'export.pdf',
  aidocplus_list_scripts: 'script.listFiles',
};

// ============================================================
// MCP Server 启动
// ============================================================

const server = new Server(
  { name: 'aidocplus', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

// 注册工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// 注册工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const apiMethod = TOOL_METHOD_MAP[name];
  if (!apiMethod) {
    return {
      content: [{ type: 'text', text: `未知工具: ${name}` }],
      isError: true,
    };
  }

  // 读取连接信息
  const info = readApiJson();
  if (!info || !info.port || !info.token) {
    return {
      content: [{
        type: 'text',
        text: 'AiDocPlus 未运行或连接信息不可用。\n请确保 AiDocPlus 桌面程序已启动。',
      }],
      isError: true,
    };
  }

  try {
    const result = await callApi(info.port, info.token, apiMethod, args || {});
    return {
      content: [{
        type: 'text',
        text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
      }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `调用失败: ${err.message}` }],
      isError: true,
    };
  }
});

// 启动 stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // 输出到 stderr，不影响 stdio 协议通信
  console.error('[AiDocPlus MCP Server] 已启动，等待连接...');
}

main().catch((err) => {
  console.error('[AiDocPlus MCP Server] 启动失败:', err);
  process.exit(1);
});
