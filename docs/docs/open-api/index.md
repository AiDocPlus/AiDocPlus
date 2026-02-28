---
title: 开放 API
nav_order: 5
has_children: true
permalink: /docs/open-api/
---

# 开放 API

AiDocPlus 提供完整的开放 API 系统，支持外部程序和脚本调用全部功能。

## 架构概览

```
外部调用方                        AiDocPlus 主程序
─────────                        ─────────────
Python SDK ─┐                   ┌─ api_server.rs（axum HTTP Server）
JS SDK     ─┤── HTTP POST ─────→│  Token 认证（Bearer）
MCP Server ─┤  /api/v1/call     │  ↓
curl / 脚本 ─┘                   └─ api_gateway.rs（JSON-RPC 路由）
                                      ↓ dispatch
                                   11 个命名空间 30+ 操作
```

## 连接信息

程序启动时在 `127.0.0.1` 上开启 HTTP Server（随机可用端口），连接信息写入 `~/.aidocplus/api.json`：

```json
{
  "port": 12345,
  "token": "64位hex",
  "pid": 1234,
  "version": "0.3.0"
}
```

## HTTP 端点

| 端点 | 方法 | 认证 | 说明 |
|------|------|------|------|
| `/api/v1/status` | GET | 无 | 运行状态 |
| `/api/v1/schema` | GET | 无 | API 自描述（所有命名空间和操作） |
| `/api/v1/call` | POST | Bearer Token | JSON-RPC 统一入口 |

### 调用示例（curl）

```bash
# 获取 API Schema
curl http://127.0.0.1:12345/api/v1/schema

# 调用 API
curl -X POST http://127.0.0.1:12345/api/v1/call \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"method": "document.list", "params": {"projectId": "my-project"}}'
```

## 接入方式

| 方式 | 适用场景 | 文档 |
|------|----------|------|
| [Python SDK](./python-sdk) | Python 脚本、数据分析 | `pip install aidocplus` |
| [JavaScript SDK](./js-sdk) | Node.js 脚本、自动化 | `require('aidocplus')` |
| [MCP Server](./mcp-server) | Claude Desktop / Cursor 等 AI 工具 | stdio 协议 |
| [编程区自动化](./automation) | AiDocPlus 内置编程区 | 零配置 |
| [API 参考](./api-reference) | 直接 HTTP 调用 | curl / 任意 HTTP 客户端 |

## 安全机制

- **Token 认证**：所有 `/api/v1/call` 请求需要 Bearer Token
- **路径安全**：文件操作通过 `canonicalize` + 前缀验证，限制在 `~/AiDocPlus/` 下
- **权限文件**：`~/.aidocplus/api.json` 权限为 `0600`，仅当前用户可读
