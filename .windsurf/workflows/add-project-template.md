---
description: 添加新的内置项目模板到 AiDocPlus-ProjectTemplates 仓库
---

## 添加新项目模板

### 1. 确定模板分类和 ID

在 `AiDocPlus-ProjectTemplates/data/_meta.json` 中查看可用分类：
- `academic`（学术论文）、`business`（商务报告）、`tech`（技术文档）
- `creative`（创意写作）、`education`（教育教学）、`government`（公文政务）、`general`（通用）

模板 ID 格式：`{category}-{name}`，如 `tech-api-doc`

### 2. 创建模板目录和文件

在 `AiDocPlus-ProjectTemplates/data/{category}/{id}/` 下创建两个文件：

**manifest.json**：
```json
{
  "id": "{category}-{name}",
  "name": "模板名称",
  "description": "模板描述",
  "icon": "LucideIconName",
  "version": "1.0.0",
  "author": "AiDocPlus",
  "resourceType": "project-template",
  "majorCategory": "{category}",
  "subCategory": "general",
  "tags": ["标签1", "标签2"],
  "order": 0,
  "enabled": true,
  "source": "builtin",
  "createdAt": "2026-02-18T00:00:00Z",
  "updatedAt": "2026-02-18T00:00:00Z"
}
```

**content.json**：
```json
{
  "authorNotes": "AI 提示词，引导生成内容。要求：\n1. ...\n2. ...",
  "aiGeneratedContent": "",
  "content": "# [标题]\n\n## 章节一\n\n...",
  "pluginData": null
}
```

### 3. 构建和部署

// turbo
```bash
cd /Users/jdh/Code/AiDocPlus-ProjectTemplates && bash scripts/build.sh
```

// turbo
```bash
cd /Users/jdh/Code/AiDocPlus-ProjectTemplates && bash scripts/deploy.sh
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
