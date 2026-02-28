---
title: 外部插件开发
parent: 开发者
nav_order: 1
---

# 外部插件协议设计方案

{: .label .label-yellow }
设计草案

本文档描述 AiDocPlus 外部插件协议的设计方案。该协议尚未实现，仅作为未来开发的参考。

## 概述

外部插件协议允许第三方开发者通过独立进程与 AiDocPlus 通信，扩展应用功能。

## 通信协议

### 传输层

- **stdin/stdout JSON-RPC 2.0** — 与 MCP、LSP 等协议一致
- AiDocPlus 作为宿主启动外部插件进程
- 消息以换行符分隔的 JSON 对象传输

### 消息格式

```json
// 请求（宿主 → 插件）
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "hostVersion": "0.3.0",
    "capabilities": ["ai", "document", "export"]
  }
}

// 响应（插件 → 宿主）
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "name": "my-plugin",
    "version": "1.0.0",
    "description": "示例外部插件",
    "capabilities": ["content-generation"]
  }
}

// 通知（双向）
{
  "jsonrpc": "2.0",
  "method": "document/changed",
  "params": { "documentId": "xxx" }
}
```

## 插件清单（manifest）

外部插件需要提供 `plugin.json` 清单文件：

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "示例外部插件",
  "author": "开发者名称",
  "main": "./dist/index.js",
  "runtime": "node",
  "type": "content",
  "capabilities": {
    "contentGeneration": true,
    "documentAccess": true,
    "aiAccess": true,
    "fileAccess": false
  },
  "ui": {
    "panel": {
      "title": "我的插件",
      "icon": "puzzle"
    }
  }
}
```

## 生命周期

1. **发现** — AiDocPlus 扫描 `~/AiDocPlus/plugins/` 目录
2. **启动** — 根据 `runtime` 字段启动进程（`node main.js`）
3. **初始化** — 发送 `initialize` 请求，交换能力声明
4. **运行** — 双向消息通信
5. **关闭** — 发送 `shutdown` 请求，等待进程退出

## 宿主 API（插件可调用）

外部插件通过 JSON-RPC 请求调用宿主 API：

| 方法 | 说明 |
|------|------|
| `host/getDocument` | 获取当前文档内容 |
| `host/setContent` | 设置插件面板内容 |
| `host/ai.chat` | 调用 AI 对话 |
| `host/ai.generate` | 调用 AI 生成 |
| `host/export.*` | 调用导出功能 |
| `host/showNotification` | 显示通知消息 |
| `host/storage.get` / `host/storage.set` | 插件持久化存储 |

## 插件事件（宿主推送）

| 事件 | 说明 |
|------|------|
| `document/changed` | 当前文档内容变更 |
| `document/switched` | 切换到其他文档 |
| `plugin/activated` | 插件面板被激活 |
| `plugin/deactivated` | 插件面板被隐藏 |

## 安全模型

- **能力声明**：插件只能使用 manifest 中声明的能力
- **路径限制**：文件访问限制在 `~/AiDocPlus/` 下
- **资源限制**：内存和 CPU 使用监控
- **用户确认**：首次安装外部插件时需要用户确认

## 开发工具（规划中）

- `aidocplus-plugin-cli` — 脚手架工具，快速创建插件项目
- `aidocplus-plugin-sdk` — TypeScript SDK，类型定义和辅助函数
- 热重载开发模式

## 实现计划

本协议为设计草案，计划在后续版本中分阶段实现：

1. **Phase 1** — 核心通信协议和生命周期管理
2. **Phase 2** — 宿主 API 和事件系统
3. **Phase 3** — UI 面板集成
4. **Phase 4** — 开发工具和文档
