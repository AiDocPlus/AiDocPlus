---
description: 添加新的 AI 服务提供商到 AiDocPlus-AIProviders 仓库
---

## 添加新 AI 提供商

### 1. 创建提供商目录和 manifest

在 `AiDocPlus-AIProviders/data/{category}/{id}/` 下创建 `manifest.json`：

```json
{
  "id": "provider-id",
  "name": "Provider Name",
  "baseUrl": "https://api.example.com/v1",
  "defaultModel": "model-name",
  "version": "1.0.0",
  "author": "AiDocPlus",
  "resourceType": "ai-provider",
  "capabilities": {
    "webSearch": false,
    "thinking": false,
    "functionCalling": false,
    "vision": false
  },
  "models": [
    { "id": "model-1", "name": "Model 1" },
    { "id": "model-2", "name": "Model 2" }
  ]
}
```

注意：`id` 必须与 `packages/shared-types/src/index.ts` 中 `AIProvider` 类型联合中的值一致。如果是新提供商，需要同时更新 `AIProvider` 类型定义。

### 2. 更新 AIProvider 类型（如需要）

如果添加的是全新提供商 ID，需要在 `AiDocPlus-Main/packages/shared-types/src/index.ts` 中更新：

```typescript
export type AIProvider = 'openai' | 'anthropic' | ... | 'new-provider' | 'custom';
```

同时更新 `AiDocPlus-Main/apps/desktop/src-tauri/src/ai.rs` 中的 `get_base_url` 和 `get_default_model` 方法。

### 3. 构建和部署

// turbo
```bash
cd /Users/jdh/Code/AiDocPlus-AIProviders && bash scripts/build.sh
```

// turbo
```bash
cd /Users/jdh/Code/AiDocPlus-AIProviders && bash scripts/deploy.sh
```

### 4. 验证

// turbo
```bash
cd /Users/jdh/Code/AiDocPlus/apps/desktop/src-ui && npx tsc --noEmit
```

// turbo
```bash
cd /Users/jdh/Code/AiDocPlus/apps/desktop/src-tauri && cargo check 2>&1 | tail -5
```
