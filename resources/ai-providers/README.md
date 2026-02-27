# AiDocPlus-AIProviders

AiDocPlus AI 服务提供商资源仓库，包含各 AI 提供商的配置信息。

## 资源内容

### AI 提供商（13 个）

| ID | 名称 | 默认模型 |
|----|------|----------|
| openai | OpenAI | gpt-4.1 |
| anthropic | Anthropic | claude-sonnet-4-20250514 |
| gemini | Google Gemini | gemini-2.5-flash |
| xai | xAI (Grok) | grok-3 |
| deepseek | DeepSeek | deepseek-chat |
| qwen | 通义千问 | qwen-plus |
| glm | 智谱 GLM | glm-4-plus |
| glm-code | 智谱 CodeGeeX | codegeex-4 |
| minimax | MiniMax | MiniMax-Text-01 |
| minimax-code | MiniMax Code | MiniMax-M1 |
| kimi | Kimi | kimi-k2-0711-preview |
| kimi-code | Kimi Code | kimi-k2-0711-preview |
| custom | 自定义 | — |

## 目录结构

```
data/
├── _meta.json                    # 分类定义
└── {category}/{id}/
    └── manifest.json             # 提供商配置（baseUrl、模型列表、能力声明）
scripts/
├── build.sh / build.py           # 构建 → dist/ai-providers.generated.ts
├── deploy.sh                     # 部署到 AiDocPlus 构建目标
└── extract_from_source.js        # 一次性提取脚本
```

## 构建和部署

```bash
bash scripts/build.sh      # 生成 ai-providers.generated.ts
bash scripts/deploy.sh      # 部署到 AiDocPlus/packages/shared-types/src/generated/
```

## 添加新 AI 提供商

1. 在 `data/{category}/{id}/` 下创建 `manifest.json`：
```json
{
  "id": "my-provider",
  "name": "My Provider",
  "baseUrl": "https://api.example.com/v1",
  "defaultModel": "model-name",
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
2. 运行 `bash scripts/build.sh && bash scripts/deploy.sh`

## 生成文件

| 文件 | 部署位置 |
|------|----------|
| `ai-providers.generated.ts` | `AiDocPlus/packages/shared-types/src/generated/` |
| 提供商 manifest | `AiDocPlus/apps/desktop/src-tauri/bundled-resources/ai-providers/` |
