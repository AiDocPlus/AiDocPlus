---
description: 创建 AiDocPlus 外部插件的完整流程和规范
---

## 创建新插件

> **⚠️ 所有插件代码必须在 AiDocPlus-Plugins 项目中操作（`/Users/jdh/Code/AiDocPlus-Plugins`），绝不在主程序 `src/plugins/` 下直接创建。**

### 1. 确定插件类型

- **内容生成类**（`content-generation`）：基于文档内容 AI 生成新内容，数据保存在 `document.pluginData`
  - 参考实现：`plugins/summary/`
- **功能执行类**（`functional`）：独立于文档的工具功能，数据独立存储
  - 参考实现：`plugins/email/`

### 2. 生成 UUID

```bash
uuidgen | tr '[:upper:]' '[:lower:]'
```

### 3. 创建插件目录和文件

在 `/Users/jdh/Code/AiDocPlus-Plugins/plugins/{name}/` 下创建：

**manifest.json**：
```json
{
  "id": "生成的UUID",
  "name": "插件名称",
  "version": "1.0.0",
  "description": "插件描述",
  "author": "AiDocPlus",
  "icon": "LucideIconName",
  "majorCategory": "content-generation 或 functional",
  "subCategory": "子分类",
  "tags": ["标签1", "标签2"],
  "enabled": true
}
```

**index.ts**：
```typescript
import { registerPlugin } from '../pluginStore';
import { registerPluginI18n } from '../i18n-loader';
import manifest from './manifest.json';
import { NamePluginPanel } from './NamePluginPanel';
import { LucideIcon } from 'lucide-react';
import zh from './i18n/zh.json';
import en from './i18n/en.json';
import ja from './i18n/ja.json';

registerPluginI18n(`plugin-${manifest.id}`, { zh, en, ja });

registerPlugin({
  id: manifest.id,
  name: manifest.name,
  icon: LucideIcon,
  description: manifest.description,
  majorCategory: manifest.majorCategory,
  subCategory: manifest.subCategory,
  PanelComponent: NamePluginPanel,
  hasData: (doc) => false, // 内容生成类：检查 pluginData；功能类：始终 false
});
```

**NamePluginPanel.tsx**：使用对应布局组件
- 内容生成类 → `PluginPanelLayout`
- 功能执行类 → `ToolPluginLayout`

**i18n/zh.json**、**i18n/en.json**、**i18n/ja.json**：翻译文件

### 4. 类型检查

// turbo
```bash
cd /Users/jdh/Code/AiDocPlus-Plugins && pnpm typecheck
```

### 5. 部署到主程序

```bash
cd /Users/jdh/Code/AiDocPlus-Plugins && pnpm deploy
```

### 6. 在主程序中验证

```bash
cd /Users/jdh/Code/AiDocPlus/apps/desktop && pnpm tauri dev
```

### 注意事项

- **零改动核心代码**：`loader.ts` 通过 `import.meta.glob` 自动发现新插件，无需修改任何主程序文件
- **SDK 只读**：不要修改 `sdk/` 目录下的文件，如需新接口请在主程序仓库提 Issue
- **i18n 必需**：所有用户可见文字必须通过 `host.platform.t()` 调用，禁止硬编码
- **deploy.sh 会跳过 SDK 文件**：不会覆盖主程序的 `_framework/`、`types.ts` 等
