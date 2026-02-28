---
title: JavaScript SDK
parent: 开放 API
nav_order: 2
---

# JavaScript SDK

AiDocPlus JavaScript SDK 提供 Proxy 自动代理，可零配置调用所有 API。

## 安装

```bash
npm install aidocplus
```

或在编程区中直接使用（已自动注入 `NODE_PATH`）。

## 快速开始

```javascript
const { AiDocPlus } = require('aidocplus');

const api = new AiDocPlus();

// 列出项目
const projects = await api.project.list();

// 列出文档
const docs = await api.document.list({ projectId: 'my-project' });

// AI 对话
const result = await api.ai.chat({
    messages: [{ role: 'user', content: '帮我润色这段文字' }],
    system_prompt: '你是一位资深的中文编辑'
});

// 导出文档
await api.export.markdown({
    projectId: 'my-project',
    documentId: 'doc-001',
    outputPath: '~/AiDocPlus/exports/output.md'
});

// 提示词模板
const templates = await api.template.list();
```

## 连接参数

SDK 按以下优先级获取连接信息：

1. **构造函数参数**：`new AiDocPlus({ port: 12345, token: 'xxx' })`
2. **环境变量**：`AIDOCPLUS_API_PORT` / `AIDOCPLUS_API_TOKEN`
3. **配置文件**：`~/.aidocplus/api.json`

在编程区中运行时，环境变量已自动注入，无需任何配置。

## API 参考

SDK 使用 Proxy 自动代理，所有 API 命名空间和操作均可直接调用：

```javascript
await api.<namespace>.<method>(params)
```

详见 [API 参考](./api-reference) 获取完整的命名空间和操作列表。
