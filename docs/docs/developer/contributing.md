---
title: 贡献指南
parent: 开发者
nav_order: 2
---

# 贡献指南

欢迎参与 AiDocPlus 开发！

## 技术栈

| 层 | 技术 |
|----|------|
| **桌面框架** | Tauri 2.x |
| **前端** | React 19 + TypeScript 5.9+ |
| **状态管理** | Zustand |
| **编辑器** | CodeMirror 6 |
| **后端** | Rust (Tokio) |
| **AI 通信** | SSE 流式 |
| **构建** | Turborepo + pnpm |

## 项目结构

```
AiDocPlus/
├── apps/desktop/          # 桌面应用
│   ├── src-tauri/         # Rust 后端
│   └── src-ui/            # React 前端
├── packages/              # 共享包
│   ├── shared-types/      # TypeScript 类型
│   ├── mcp-server/        # MCP Server
│   ├── sdk-python/        # Python SDK
│   └── sdk-js/            # JavaScript SDK
├── resources/             # 资源数据
└── docs/                  # 文档站点
```

## 开发环境

### 前置要求

- Node.js 18+
- pnpm 8+
- Rust 1.70+
- Tauri 2.x CLI

### 启动开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

### 构建

```bash
# 构建资源
bash scripts/build-resources.sh

# 构建应用
pnpm build
```

## 提交规范

- 使用中文提交信息
- 遵循项目现有代码风格
- 确保 `cargo check` 和 `pnpm tsc` 通过
- 新功能需要添加对应的 i18n 翻译键

## 反馈与建议

- [GitHub Issues](https://github.com/AiDocPlus/AiDocPlus/issues) — 提交 Bug 或功能建议
- [GitHub Discussions](https://github.com/AiDocPlus/AiDocPlus/discussions) — 讨论和交流
