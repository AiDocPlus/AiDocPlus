---
description: 添加新的 PPT 主题到 AiDocPlus-DocTemplates 仓库
---

## 添加新 PPT 主题

### 1. 创建主题目录和 manifest

在 `AiDocPlus-DocTemplates/data/ppt-theme/{id}/` 下创建 `manifest.json`：

```json
{
  "id": "my-theme",
  "name": "主题名称",
  "version": "1.0.0",
  "author": "AiDocPlus",
  "resourceType": "ppt-theme",
  "colors": {
    "primary": "#1a56db",
    "secondary": "#3b82f6",
    "background": "#ffffff",
    "text": "#1e293b",
    "accent": "#0ea5e9"
  },
  "fonts": {
    "title": "system-ui, \"PingFang SC\", \"Microsoft YaHei\", sans-serif",
    "body": "system-ui, \"PingFang SC\", \"Microsoft YaHei\", sans-serif"
  }
}
```

颜色说明：
- `primary` — 主色调（标题、强调元素）
- `secondary` — 辅助色（次要元素）
- `background` — 背景色
- `text` — 正文文字色
- `accent` — 点缀色（图标、装饰）

### 2. 构建和部署

// turbo
```bash
cd /Users/jdh/Code/AiDocPlus-DocTemplates && bash scripts/build.sh
```

// turbo
```bash
cd /Users/jdh/Code/AiDocPlus-DocTemplates && bash scripts/deploy.sh
```

### 3. 验证

// turbo
```bash
cd /Users/jdh/Code/AiDocPlus/apps/desktop/src-ui && npx tsc --noEmit
```
