---
description: 启动资源管理器（角色、AI服务商、提示词模板、项目模板、文档模板、插件）
---

## 启动资源管理器

资源管理器项目位于 `/Users/jdh/Code/AiDocPlus-ResourceManager`，包含 6 个独立的 Tauri 桌面应用。

### 1. 选择要启动的管理器

可用管理器：
- `roles` — 角色管理器（端口 1420，管理 AiDocPlus-Roles）
- `ai-providers` — AI 服务商管理器（端口 1421，管理 AiDocPlus-AIProviders）
- `prompt-templates` — 提示词模板管理器（端口 1422，管理 AiDocPlus-PromptTemplates）
- `project-templates` — 项目模板管理器（端口 1423，管理 AiDocPlus-ProjectTemplates）
- `doc-templates` — 文档模板管理器（端口 1424，管理 AiDocPlus-DocTemplates）
- `plugins` — 插件管理器（端口 1425，管理 AiDocPlus-Plugins）

### 2. 启动管理器

// turbo
```bash
cd /Users/jdh/Code/AiDocPlus-ResourceManager && pnpm dev:{manager-name}
```

例如启动角色管理器：
```bash
cd /Users/jdh/Code/AiDocPlus-ResourceManager && pnpm dev:roles
```

### 3. 验证全部 Rust 编译

// turbo
```bash
cd /Users/jdh/Code/AiDocPlus-ResourceManager && cargo check --workspace 2>&1 | tail -5
```

### 4. 构建管理器并部署到主程序

修改管理器代码后，需要重新构建并复制到主程序的 `bundled-resources/managers/` 目录：

```bash
# 构建管理器（以提示词模板管理器为例）
cd /Users/jdh/Code/AiDocPlus-ResourceManager/apps/prompt-templates-manager && npx tauri build

# 复制到主程序（macOS）
rm -rf /Users/jdh/Code/AiDocPlus-Main/apps/desktop/src-tauri/bundled-resources/managers/提示词模板管理器.app
cp -R /Users/jdh/Code/AiDocPlus-ResourceManager/target/release/bundle/macos/提示词模板管理器.app /Users/jdh/Code/AiDocPlus-Main/apps/desktop/src-tauri/bundled-resources/managers/
```

管理器名称与 app 名称映射：
| 管理器 | .app 名称 |
|--------|-----------|
| roles-manager | 角色管理器.app |
| ai-providers-manager | AI服务商管理器.app |
| prompt-templates-manager | 提示词模板管理器.app |
| project-templates-manager | 项目模板管理器.app |
| doc-templates-manager | 文档模板管理器.app |
| plugins-manager | 插件管理器.app |

**重要**：`cargo build --release` 只更新裸二进制文件，不会重新打包 .app bundle。必须使用 `npx tauri build` 才能生成完整的 .app。

### 注意事项

- 首次编译约 1 分钟（500+ Rust 依赖），后续增量编译约 4 秒
- 所有管理器共享 Cargo workspace 编译缓存（根目录 `target/`）
- 同时只能运行一个管理器（端口不冲突但 Cargo 锁文件冲突）
- 如遇端口占用：`lsof -ti:{port} | xargs kill -9`
- 管理器的 Tailwind CSS 类在 `index.css` 中通过 `@source` 指令扫描 `packages/manager-ui/src/**/*.tsx`
- 修改共享 UI 组件后需要重新构建管理器才能生效（`npx tauri build`）
- **提示词模板管理器**使用 JSON 文件模式（`dataMode: 'json-file'`），直接编辑分类 JSON 文件，从主程序启动时 `--data-dir` 指向 `bundled-resources/prompt-templates/`
