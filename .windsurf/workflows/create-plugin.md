---
description: 创建 AiDocPlus 外部插件的完整流程和规范
---

## 创建新插件

> **注意**：插件源码（index.ts、Panel 组件）需手动编写，无图形化管理器。

> **所有插件代码在 Monorepo 的 `apps/desktop/src-ui/src/plugins/` 目录下直接创建和开发。**

### 1. 确定插件类型

- **内容生成类**（`content-generation`）：基于文档内容 AI 生成新内容，数据保存在 `document.pluginData`
  - ⭐ 标杆实现：`plugins/table/`（表格）、`plugins/mindmap/`（思维导图）
- **功能执行类**（`functional`）：独立于文档的工具功能，数据通过 `host.storage` 独立存储
  - ⭐ 标杆实现：`plugins/email/`（邮件发送）

### 2. 生成 UUID

```bash
uuidgen | tr '[:upper:]' '[:lower:]'
```

### 3. 创建插件目录和文件

在 `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/plugins/{name}/` 下创建。

#### 内容生成类完整文件结构（对照 table / mindmap）

```
plugins/{name}/
├── manifest.json                  # 插件元数据
├── index.ts                       # 自注册入口
├── {Name}PluginPanel.tsx          # 主面板
├── {Name}AssistantPanel.tsx       # 自定义 AI 助手面板
├── {name}Context.ts               # 智能上下文引擎
├── quickActionDefs.ts             # 快捷操作定义
├── QuickActionCommandPalette.tsx  # 命令面板
├── types.ts                       # 领域类型
├── dialogs/
│   └── QuickActionManagerDialog.tsx
├── i18n/
│   ├── zh.json
│   └── en.json
└── ...                            # 领域组件（渲染器、转换器等）
```

#### 功能执行类完整文件结构（对照 email）

```
plugins/{name}/
├── manifest.json
├── index.ts                       # hasData 始终返回 false
├── {Name}PluginPanel.tsx          # 主面板（ToolPluginLayout）
├── {Name}AssistantPanel.tsx       # 自定义 AI 助手面板
├── {name}Reducer.ts               # 状态管理（useReducer）
├── quickActionDefs.ts
├── types.ts
├── utils.ts
├── dialogs/
│   ├── index.ts                   # barrel export
│   └── {Feature}Dialog.tsx
├── i18n/
│   ├── zh.json
│   └── en.json
└── ...                            # 业务引擎
```

#### manifest.json

```json
{
  "id": "生成的UUID",
  "name": "插件名称",
  "version": "1.0.0",
  "description": "插件描述",
  "author": "AiDocPlus",
  "icon": "LucideIconName",
  "type": "external",
  "enabled": true,
  "majorCategory": "content-generation 或 functional",
  "subCategory": "子分类",
  "tags": ["标签1", "标签2"]
}
```

#### index.ts（内容生成类示例，对照 table/index.ts）

```typescript
import React from 'react';
import { IconName } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { registerPlugin } from '../pluginStore';
const NamePluginPanel = React.lazy(() => import('./NamePluginPanel').then(m => ({ default: m.NamePluginPanel })));
const NameAssistantPanel = React.lazy(() => import('./NameAssistantPanel').then(m => ({ default: m.NameAssistantPanel })));
import manifest from './manifest.json';
import zh from './i18n/zh.json';
import en from './i18n/en.json';

registerPluginI18n('plugin-{name}', { zh, en });

export const namePlugin: DocumentPlugin = {
  id: manifest.id,
  name: '插件名称',
  icon: IconName,
  description: '插件描述',
  i18nNamespace: 'plugin-{name}',
  PanelComponent: NamePluginPanel,
  AssistantPanelComponent: NameAssistantPanel,
  hasData: (doc) => {
    const data = doc.pluginData?.[manifest.id];
    // 根据实际数据结构判断
    return data != null && typeof data === 'object';
  },
  toFragments: (pluginData) => {
    // 将插件数据转换为 Markdown 片段，用于合并区导入
    if (!pluginData) return [];
    return [{ title: '插件名称', markdown: '...' }];
  },
};

registerPlugin(namePlugin);
```

#### index.ts（功能执行类示例，对照 email/index.ts）

```typescript
import React from 'react';
import { IconName } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { registerPlugin } from '../pluginStore';
const NamePluginPanel = React.lazy(() => import('./NamePluginPanel').then(m => ({ default: m.NamePluginPanel })));
const NameAssistantPanel = React.lazy(() => import('./NameAssistantPanel').then(m => ({ default: m.NameAssistantPanel })));
import manifest from './manifest.json';
import zh from './i18n/zh.json';
import en from './i18n/en.json';

registerPluginI18n('plugin-{name}', { zh, en });

export const namePlugin: DocumentPlugin = {
  id: manifest.id,
  name: '插件名称',
  icon: IconName,
  description: '插件描述',
  majorCategory: 'functional',
  subCategory: '子分类',
  i18nNamespace: 'plugin-{name}',
  PanelComponent: NamePluginPanel,
  hasData: () => false,
  AssistantPanelComponent: NameAssistantPanel,
};

registerPlugin(namePlugin);
```

### 4. 类型检查

// turbo
```bash
cd /Users/jdh/Code/AiDocPlus/apps/desktop/src-ui && npx tsc --noEmit
```

### 5. 启动开发版验证

```bash
cd /Users/jdh/Code/AiDocPlus/apps/desktop && pnpm tauri dev
```

### 设计原则（强制）

1. **AI 助手面板必须自定义**：使用 `AssistantPanelComponent`（不使用 `assistantConfig`），实现多会话、上下文感知、直接操作
2. **上下文引擎独立**：抽离到 `{name}Context.ts`，分层构建（critical / important / supplementary），阶段自动检测
3. **快捷操作可配置**：`quickActionDefs.ts` 定义操作，支持用户管理（排序、启用/禁用），`host.storage` 持久化
4. **类型先行**：领域类型集中在 `types.ts`，UI 和逻辑模块共用
5. **弹窗集中管理**：复杂弹窗放 `dialogs/`，功能类通过 `index.ts` barrel export
6. **业务逻辑与 UI 解耦**：引擎、转换器、数据桥接独立为模块

### 注意事项

- **零改动核心代码**：`loader.ts` 通过 `import.meta.glob` 自动发现新插件，无需修改任何主程序文件
- **SDK 只读**：不要修改 `_framework/` 目录下的文件，如需新接口请提 Issue
- **i18n 必需**：所有用户可见文字必须通过 `host.platform.t()` 调用，禁止硬编码
- **双角色原则**：编辑 `plugins/{name}/` 时是外部开发者角色，所有 import 必须来自 SDK 层（`_framework/`）
