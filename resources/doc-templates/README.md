# AiDocPlus-DocTemplates

AiDocPlus 文档模板资源仓库，包含 PPT 主题和文档模板分类定义。

## 资源内容

### PPT 主题（8 个）

| ID | 名称 | 主色 |
|----|------|------|
| business-blue | 商务蓝 | #1a56db |
| tech-dark | 科技暗色 | #6366f1 |
| minimal-white | 简约白 | #18181b |
| academic-green | 学术绿 | #166534 |
| creative-orange | 创意橙 | #ea580c |
| elegant-purple | 典雅紫 | #7c3aed |
| warm-red | 热情红 | #dc2626 |
| ocean-teal | 海洋青 | #0d9488 |

### 文档模板分类（8 个）

报告、文章、邮件草稿、会议纪要、创意写作、技术文档、学术论文、通用

## 目录结构

```
data/
├── _meta.json                    # 分类定义
└── ppt-theme/
    └── {theme-id}/
        └── manifest.json         # 主题配置（颜色、字体）
scripts/
├── build.sh / build.py           # 构建 → dist/*.generated.ts
├── deploy.sh                     # 部署到 AiDocPlus 构建目标
└── extract_from_source.js        # 一次性提取脚本
```

## 构建和部署

```bash
bash scripts/build.sh      # 生成 ppt-themes.generated.ts + doc-template-categories.generated.ts
bash scripts/deploy.sh      # 部署到 AiDocPlus/packages/shared-types/src/generated/
```

## 添加新 PPT 主题

1. 在 `data/ppt-theme/{id}/` 下创建 `manifest.json`：
```json
{
  "id": "my-theme",
  "name": "我的主题",
  "version": "1.0.0",
  "author": "Your Name",
  "resourceType": "ppt-theme",
  "colors": {
    "primary": "#1a56db",
    "secondary": "#3b82f6",
    "background": "#ffffff",
    "text": "#1e293b",
    "accent": "#0ea5e9"
  },
  "fonts": {
    "title": "system-ui, sans-serif",
    "body": "system-ui, sans-serif"
  }
}
```
2. 运行 `bash scripts/build.sh && bash scripts/deploy.sh`

## 生成文件

| 文件 | 部署位置 |
|------|----------|
| `ppt-themes.generated.ts` | `AiDocPlus/packages/shared-types/src/generated/` |
| `doc-template-categories.generated.ts` | `AiDocPlus/packages/shared-types/src/generated/` |
| PPT 主题 manifest | `AiDocPlus/apps/desktop/src-tauri/bundled-resources/document-templates/` |
