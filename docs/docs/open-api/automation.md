---
title: 编程区自动化
parent: 开放 API
nav_order: 5
---

# 编程区自动化

AiDocPlus 编程区运行脚本时会自动注入 API 连接参数，实现零配置调用。

## 工作原理

当你在编程区运行 Python 或 Node.js 脚本时，脚本运行器会自动注入以下环境变量：

| 环境变量 | 说明 |
|----------|------|
| `AIDOCPLUS_API_PORT` | API Server 端口号 |
| `AIDOCPLUS_API_TOKEN` | 认证 Token |
| `PYTHONPATH` | 追加 Python SDK 路径 |
| `NODE_PATH` | 追加 JS SDK 路径 |

## Python 示例

在编程区新建一个 `.py` 文件，直接编写：

```python
from aidocplus import AiDocPlus

api = AiDocPlus()

# 获取当前项目的所有文档
projects = api.project.list()
for p in projects['data']:
    print(f"项目: {p['name']}")
    docs = api.document.list(projectId=p['id'])
    for d in docs['data']:
        print(f"  文档: {d['title']}")
```

点击运行按钮即可执行，无需任何额外配置。

## JavaScript 示例

在编程区新建一个 `.js` 文件：

```javascript
const { AiDocPlus } = require('aidocplus');

async function main() {
    const api = new AiDocPlus();

    // 批量导出所有文档为 Markdown
    const projects = await api.project.list();
    for (const p of projects.data) {
        const docs = await api.document.list({ projectId: p.id });
        for (const d of docs.data) {
            await api.export.markdown({
                projectId: p.id,
                documentId: d.id,
                outputPath: `~/AiDocPlus/exports/${d.title}.md`
            });
            console.log(`已导出: ${d.title}`);
        }
    }
}

main().catch(console.error);
```

## 常见用例

- **批量导出**：将所有文档导出为指定格式
- **自动化生成**：使用 AI API 批量生成内容
- **数据分析**：统计文档数量、字数等
- **模板应用**：批量应用提示词模板生成内容
- **文件管理**：自动整理和备份文档文件
