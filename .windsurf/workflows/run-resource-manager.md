---
description: 启动资源管理器（提示词模板、文档模板）
---

## 启动资源管理器

资源管理器项目位于 `/Users/jdh/Code/AiDocPlus-ResourceManager`，是一个统一的 Tauri 桌面应用，管理提示词模板和文档模板。

### 1. 启动管理器

// turbo
```bash
cd /Users/jdh/Code/AiDocPlus-ResourceManager && pnpm dev:resource-manager
```

### 2. 验证全部 Rust 编译

// turbo
```bash
cd /Users/jdh/Code/AiDocPlus-ResourceManager && cargo check --workspace 2>&1 | tail -5
```

### 3. 构建管理器并部署到主程序

修改管理器代码后，需要重新构建并复制到主程序的 `bundled-resources/managers/` 目录：

```bash
# 构建管理器
cd /Users/jdh/Code/AiDocPlus-ResourceManager/apps/resource-manager && npx tauri build
```

**重要**：`cargo build --release` 只更新裸二进制文件，不会重新打包 .app bundle。必须使用 `npx tauri build` 才能生成完整的 .app。

### 注意事项

- 首次编译约 1 分钟（500+ Rust 依赖），后续增量编译约 4 秒
- 管理器的 Tailwind CSS 类在 `index.css` 中通过 `@source` 指令扫描 `packages/manager-ui/src/**/*.tsx`
- 修改共享 UI 组件后需要重新构建管理器才能生效（`npx tauri build`）
- **提示词模板**使用 JSON 文件模式（`dataMode: 'json-file'`），从主程序启动时 `--data-dir` 指向 `bundled-resources/prompt-templates/`
- **文档模板**使用目录模式，从主程序启动时 `--data-dir` 指向 `~/AiDocPlus/DocTemplates/`
