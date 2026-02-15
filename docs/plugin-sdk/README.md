# AiDocPlus 插件开发指南

本文档面向外部独立开发者，介绍如何为 AiDocPlus 开发插件。

## 概述

AiDocPlus 采用**双类别插件架构**：

| 类别 | majorCategory | 说明 | 数据存储 |
|------|--------------|------|----------|
| **内容生成类** | `content-generation` | 基于文档内容 AI 生成新内容 | `document.pluginData` |
| **功能执行类** | `functional` | 独立于文档的工具功能 | `usePluginStorageStore` |

## 开发环境要求

- Node.js >= 18.0.0
- React 19
- TypeScript 5.8+
- 熟悉 React Hooks 和函数式组件

## SDK 文件结构

```
plugin-sdk/
├── types.ts                    # 插件类型定义
├── constants.ts                # UUID 常量和分类定义
├── _framework/
│   ├── PluginHostAPI.ts        # 核心 API（usePluginHost）
│   ├── PluginPanelLayout.tsx   # 内容生成类布局
│   ├── ToolPluginLayout.tsx    # 功能执行类布局
│   ├── AIContentDialog.tsx     # AI 内容生成弹窗
│   ├── PluginPromptBuilderDialog.tsx  # 提示词构造器
│   ├── pluginUtils.ts          # 工具函数
│   ├── ui.ts                   # UI 组件 re-export
│   └── i18n/
│       ├── zh.json
│       ├── en.json
│       └── ja.json
└── examples/
    ├── content-generation/     # 内容生成类示例（摘要插件）
    └── functional/             # 功能执行类示例（邮件插件）
```

## 快速开始

### 1. 创建插件目录

```
my-plugin/
├── index.ts              # 插件导出
├── MyPluginPanel.tsx     # 面板组件
└── i18n/
    ├── zh.json
    ├── en.json
    └── ja.json
```

### 2. 定义插件元数据

```typescript
// index.ts
import type { DocumentPlugin } from '@/plugins/types';
import { MyIcon } from 'lucide-react';
import { MyPluginPanel } from './MyPluginPanel';

export const myPlugin: DocumentPlugin = {
  id: 'your-uuid-here',  // 使用 UUID v4
  name: 'My Plugin',
  icon: MyIcon,
  description: 'Plugin description',
  majorCategory: 'content-generation',  // 或 'functional'
  subCategory: 'ai-text',
  i18nNamespace: 'plugin-myplugin',
  PanelComponent: MyPluginPanel,
  hasData: (doc) => {
    // 返回 doc.pluginData?.[id] 是否有有效数据
    const data = doc.pluginData?.['your-uuid-here'];
    return data != null && typeof data === 'object';
  },
};
```

### 3. 实现面板组件

#### 内容生成类（使用 PluginPanelLayout）

```tsx
// MyPluginPanel.tsx
import type { PluginPanelProps } from '@/plugins/types';
import { usePluginHost } from '@/plugins/_framework/PluginHostAPI';
import { PluginPanelLayout } from '@/plugins/_framework/PluginPanelLayout';
import { Button } from '@/plugins/_framework/ui';
import { useState } from 'react';

export function MyPluginPanel({ document, content, pluginData, onPluginDataChange, onRequestSave }: PluginPanelProps) {
  const host = usePluginHost();
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(
    (pluginData as { result?: string })?.result ?? null
  );

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setGenerating(true);
    try {
      const docContent = host.content.getDocumentContent();
      const response = await host.ai.chat([
        { role: 'system', content: prompt },
        { role: 'user', content: host.ai.truncateContent(docContent) },
      ]);

      setResult(response);
      onPluginDataChange({ result: response });
      onRequestSave?.();
    } catch (err) {
      host.ui.showStatus('Generation failed', true);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <PluginPanelLayout
      pluginIcon={MyIcon}
      pluginTitle="My Plugin"
      pluginDesc="Generate content with AI"
      prompt={prompt}
      onPromptChange={setPrompt}
      generating={generating}
      onGenerate={handleGenerate}
      hasContent={!!result}
    >
      {result && (
        <div className="prose dark:prose-invert max-w-none">
          {result}
        </div>
      )}
    </PluginPanelLayout>
  );
}
```

#### 功能执行类（使用 ToolPluginLayout）

```tsx
// MyPluginPanel.tsx
import type { PluginPanelProps } from '@/plugins/types';
import { usePluginHost } from '@/plugins/_framework/PluginHostAPI';
import { ToolPluginLayout } from '@/plugins/_framework/ToolPluginLayout';
import { useState } from 'react';

export function MyPluginPanel(_props: PluginPanelProps) {
  // 功能执行类插件不使用 pluginData，使用 storage
  const host = usePluginHost();
  const [status, setStatus] = useState('');

  // 从独立存储读取配置
  const config = host.storage.get<{ apiKey: string }>('config');

  const handleExecute = async () => {
    try {
      // 使用 platform.invoke 调用后端命令（仅限白名单）
      const result = await host.platform.invoke<string>('some_allowed_command', {
        arg: 'value',
      });
      setStatus(result);
    } catch (err) {
      host.ui.showStatus('Execution failed', true);
    }
  };

  return (
    <ToolPluginLayout
      pluginIcon={MyIcon}
      pluginTitle="My Tool"
      pluginDesc="A functional plugin"
      hasContent={true}
      statusMsg={status}
    >
      <button onClick={handleExecute}>Execute</button>
    </ToolPluginLayout>
  );
}
```

## PluginHostAPI 详解

通过 `usePluginHost()` 获取的完整 API：

### content - 内容访问

```typescript
host.content.getDocumentContent()     // 文档 Markdown 正文
host.content.getAIContent()           // AI 助手生成的内容
host.content.getComposedContent()     // 合并区内容
host.content.getPluginFragments()     // 其他插件的内容片段
host.content.getDocumentMeta()        // { id, title, projectId }
```

### ai - AI 服务

```typescript
// 非流式对话
const response = await host.ai.chat([
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Hello!' },
], { maxTokens: 4096 });

// 流式对话
const fullResponse = await host.ai.chatStream(
  messages,
  (chunk) => console.log('Received:', chunk),
  { maxTokens: 4096, signal: abortController.signal }
);

// 检查可用性
if (host.ai.isAvailable()) { /* ... */ }

// 截断内容（按用户设置）
const truncated = host.ai.truncateContent(longText);
```

### storage - 插件独立存储

```typescript
// 存储按 pluginId 隔离，不同插件不会冲突
host.storage.set('config', { theme: 'dark' });
const config = host.storage.get<{ theme: string }>('config');
host.storage.remove('config');
host.storage.clear();  // 清空该插件所有数据
```

### docData - 文档数据（仅内容生成类）

```typescript
// 功能执行类插件的 host.docData 为 null
if (host.docData) {
  const data = host.docData.getData() as MyPluginData;
  host.docData.setData({ ...data, updated: true });
  host.docData.markDirty();       // 标记文档为脏
  host.docData.requestSave();     // 请求立即保存到磁盘
}
```

### ui - UI 能力

```typescript
host.ui.showStatus('Processing...', false);  // 状态消息
host.ui.showStatus('Error!', true);          // 错误消息
await host.ui.copyToClipboard('text');       // 复制到剪贴板

// 文件对话框
const savePath = await host.ui.showSaveDialog({
  defaultName: 'output.txt',
  extensions: ['txt'],
});
const openPath = await host.ui.showOpenDialog({
  filters: [{ name: 'Images', extensions: ['png', 'jpg'] }],
});

host.ui.getLocale();  // 'zh' | 'en' | 'ja'
host.ui.getTheme();   // 'light' | 'dark'
```

### platform - 平台能力

```typescript
// Tauri invoke（仅允许白名单命令）
// 白名单：write_binary_file, read_file_base64, get_temp_dir, open_file_with_app, test_smtp_connection, send_email
try {
  const result = await host.platform.invoke<string>('write_binary_file', {
    path: '/path/to/file',
    data: [1, 2, 3],
  });
} catch (err) {
  // 命令不在白名单中会抛出错误
}

// 读取主程序配置（只读快照）
const aiConfig = host.platform.getConfig<{ provider: string }>('ai');

// i18n 翻译（自动使用插件命名空间）
const text = host.platform.t('generateButton');  // 如果 i18nNamespace 是 'plugin-myplugin'，会查找 plugin-myplugin:generateButton
```

### events - 事件订阅

```typescript
// 订阅事件
const unsubscribe = host.events.on('document:saved', (data) => {
  console.log('Document saved:', data.documentId);
});

// 取消订阅
unsubscribe();
// 或
host.events.off('document:saved', callback);
```

**可监听事件**：

| 事件 | 数据 |
|------|------|
| `document:saved` | `{ documentId: string }` |
| `document:changed` | `{ documentId: string, content: string }` |
| `document:switched` | `{ previousId: string \| null, currentId: string }` |
| `theme:changed` | `{ theme: 'light' \| 'dark' }` |
| `locale:changed` | `{ locale: string }` |
| `ai:generation-started` | `{ documentId: string, type: 'chat' \| 'content' }` |
| `ai:generation-completed` | `{ documentId: string, type: 'chat' \| 'content' }` |
| `plugin:activated` | `{ pluginId: string }` |
| `plugin:deactivated` | `{ pluginId: string }` |

## 国际化

每个插件应自带翻译文件：

```json
// i18n/zh.json
{
  "generateButton": "生成",
  "resultTitle": "生成结果"
}
```

```typescript
// 注册翻译（在插件 index.ts 中）
import { registerPluginI18n } from '@/plugins/i18n-loader';
import zh from './i18n/zh.json';
import en from './i18n/en.json';
import ja from './i18n/ja.json';

registerPluginI18n('plugin-myplugin', { zh, en, ja });

// 使用翻译
const text = host.platform.t('generateButton');
```

## 生命周期 Hook

在插件定义中添加生命周期回调：

```typescript
export const myPlugin: DocumentPlugin = {
  // ...
  onActivate: () => {
    console.log('Plugin activated');
  },
  onDeactivate: () => {
    console.log('Plugin deactivated');
  },
  onDocumentChange: () => {
    console.log('Document changed');
  },
};
```

## 文件导出规范

导出文件**必须**使用 Tauri 保存对话框 + `write_binary_file`：

```typescript
const handleExport = async (data: Uint8Array, defaultName: string) => {
  const filePath = await host.ui.showSaveDialog({
    defaultName,
    extensions: ['pdf'],  // 或其他格式
  });
  if (!filePath) return;

  await host.platform.invoke('write_binary_file', {
    path: filePath,
    data: Array.from(data),
  });
  host.ui.showStatus('Exported successfully');
};
```

## 完整示例

参考 `examples/` 目录中的示例插件：

- **内容生成类**：`examples/content-generation/` - 基于 `summary` 插件简化
- **功能执行类**：`examples/functional/` - 基于 `email` 插件简化

## 注意事项

1. **禁止直接 import** `@tauri-apps/*`、`@/stores/*`、`@/i18n`，必须通过 `PluginHostAPI` 访问
2. **命令白名单**：`platform.invoke` 只能调用白名单内的命令
3. **类型安全**：`pluginData` 和 `storage` 返回 `unknown`，需要类型断言
4. **样式隔离**：使用 Tailwind CSS，避免全局样式污染
5. **错误处理**：所有异步操作都应 try-catch

## 联系支持

如有问题，请联系：support@aidocplus.com

官网：https://aidocplus.com
