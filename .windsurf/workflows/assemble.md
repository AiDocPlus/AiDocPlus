---
description: 一键总装所有资源仓库并验证编译
---

## 总装构建和验证

### 1. 运行总装脚本

总装脚本按顺序执行所有仓库的 build + deploy：Main → PromptTemplates → DocTemplates → AIProviders → Plugins → ResourceManager

```bash
bash /Users/jdh/Code/AiDocPlus-Main/scripts/assemble.sh
```

### 2. 验证 TypeScript 编译

// turbo
```bash
cd /Users/jdh/Code/AiDocPlus/apps/desktop/src-ui && npx tsc --noEmit
```

### 3. 验证 Rust 编译

// turbo
```bash
cd /Users/jdh/Code/AiDocPlus/apps/desktop/src-tauri && cargo check 2>&1 | tail -5
```

### 4. 启动应用验证

```bash
cd /Users/jdh/Code/AiDocPlus/apps/desktop && pnpm tauri dev
```

### 注意事项

- 总装脚本位于 `AiDocPlus-Main/scripts/assemble.sh`，不在构建目标中
- `AiDocPlus-Main/scripts/deploy.sh` 使用 `rsync --delete`，但排除了 `generated/`、`bundled-resources/`、`plugins/*/` 防止其他仓库的产物被删除
- 如果某个资源仓库没有 `scripts/build.sh` 或 `scripts/deploy.sh`，总装脚本会跳过该步骤
- **资源管理器**（`AiDocPlus-ResourceManager`）是独立项目，不参与总装流程。管理器直接操作各资源仓库的 `data/` 目录，修改后需重新运行对应仓库的 `build.sh` + `deploy.sh` 才能生效到主程序
