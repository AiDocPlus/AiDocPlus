---
description: 创建 AiDocPlus 外部插件（已迁移到独立项目）
---

# 创建外部插件 Skills

> **⚠️ 插件开发已迁移到独立项目 [AiDocPlus-Plugins](https://github.com/AiDocPlus/AiDocPlus-Plugins)。**
> 请在插件项目中创建和修改插件，参考插件项目的 `CLAUDE.md` 和 `.windsurf/workflows/create-plugin.md`。
> 本文件仅作为主程序侧的参考，完整的插件开发 Skills 请查看插件项目。

本文件保留了插件架构的核心规则供主程序开发者参考。如需创建新插件，请切换到 AiDocPlus-Plugins 项目。

> **主程序构建者角色**：在本项目中，你只负责维护 SDK 基础设施（`_framework/`、`PluginToolArea.tsx`、`registry.ts`、`loader.ts`）。插件代码由独立项目管理。

---

## 〇、插件体系架构（v3 — 全外部插件）

### 两大类别

| 大类 | majorCategory | 说明 | 数据特征 |
|------|--------------|------|----------|
| **内容生成类** | `content-generation` | 基于文档内容 AI 生成新内容 | 生成结果保存在 `document.pluginData`，设置独立存储 |
| **功能执行类** | `functional` | 独立于文档的工具功能 | 所有数据独立存储（`usePluginStorageStore`），不写入文档 |

架构支持动态添加第三大类（`majorCategory` 为 `string` 类型，不硬编码枚举）。

### 子类（subCategory）

**内容生成类**：`ai-text`（AI 文本）、`visualization`（可视化）、`data`（数据处理）、`analysis`（分析统计）
**功能执行类**：`communication`（通信协作）

子类也为 `string` 类型，可自由扩展。

### 自描述文档

文档通过 `enabledPlugins` 记录自己需要哪些插件，**两大类插件都包含在内**：
- `enabledPlugins` = 文档声明"我需要这些插件"（含生成类 + 功能类）
- `pluginData` = 文档携带"生成类插件的输出内容"（功能类不在此处）
- 加载文档时，根据 `enabledPlugins` 恢复完整的插件标签栏（两类都显示）

### 三层解耦架构

```
┌─────────────────────────────────────────┐
│            插件代码 (Plugin)              │
│  只 import 自 Plugin SDK                 │
├─────────────────────────────────────────┤
│         Plugin SDK（公共接口层）           │  ← 稳定的 API 边界
│  usePluginHost()  布局组件  UI 原语  类型  │
├─────────────────────────────────────────┤
│         Host Implementation（主程序）      │
│  Stores / Tauri / i18n / 平台 API        │
└─────────────────────────────────────────┘
```

**Plugin SDK** = `plugins/_framework/` 目录，是插件与主程序之间的唯一接口层。

### 插件的合法 import 范围

| 允许 import | 来源 |
|------------|------|
| `usePluginHost()` | `../_framework/PluginHostAPI` |
| 布局组件 | `../_framework/PluginPanelLayout`、`ToolPluginLayout`、`AIContentDialog` |
| UI 原语 | `../_framework/ui`（从 SDK 层 re-export shadcn 组件） |
| 类型 | `../types`、`@aidocplus/shared-types` |
| React / lucide-react | 标准库 |

| 禁止直接 import | 替代方式 |
|----------------|--------|
| `@/stores/*` | 通过 `host.platform.getConfig(section)` 查询配置 |
| `@tauri-apps/api/core` (`invoke`) | 通过 `host.platform.invoke(cmd, args)` 代理 |
| `@tauri-apps/plugin-dialog` | 通过 `host.ui.showSaveDialog()` / `showOpenDialog()` |
| `@/i18n` (`useTranslation`) | 通过 `host.platform.t(key, params)` |
| `@/components/ui/*` | 通过 `../_framework/ui` re-export 访问 |

### PluginHostAPI（主程序公共 API）

通过 React Context 注入，插件通过 `usePluginHost()` hook 获取：

```typescript
interface PluginHostAPI {
  apiVersion: 1;
  pluginId: string;
  content: ContentAPI;       // 内容访问（文档正文、AI 内容、合并区、插件片段）
  ai: AIAPI;                // AI 服务（chat、chatStream、isAvailable、truncateContent）
  storage: StorageAPI;       // 插件独立持久化存储（按 pluginId 隔离）
  docData: DocDataAPI | null; // 文档数据（仅内容生成类，功能类为 null）
  ui: UIAPI;                // UI 能力（状态消息、剪贴板、文件对话框、语言、主题）
  platform: PlatformAPI;    // 平台能力（invoke 代理、配置查询、i18n）
  events: EventsAPI;        // 事件订阅（文档保存、主题变化等）
}
```

### AIAPI（AI 服务）

```typescript
interface AIAPI {
  /** 非流式对话 */
  chat(messages: Array<{ role: string; content: string }>, options?: { maxTokens?: number }): Promise<string>;
  /** 流式对话（支持实时回调和取消） */
  chatStream(
    messages: Array<{ role: string; content: string }>,
    onChunk: (text: string) => void,
    options?: { maxTokens?: number; signal?: AbortSignal }
  ): Promise<string>;
  /** AI 服务是否可用 */
  isAvailable(): boolean;
  /** 按用户设置截断内容 */
  truncateContent(text: string): string;
}
```

**流式对话示例**：
```typescript
const abortController = new AbortController();

try {
  const fullResponse = await host.ai.chatStream(
    messages,
    (chunk) => {
      // 实时更新 UI
      setPartialContent(prev => prev + chunk);
    },
    { maxTokens: 4096, signal: abortController.signal }
  );
} catch (err) {
  if (err.message === 'Request aborted') {
    // 用户取消
  }
}

// 取消请求
abortController.abort();
```

### EventsAPI（事件订阅）

```typescript
interface EventsAPI {
  on<E extends PluginEvent>(event: E, callback: (data: PluginEventDataMap[E]) => void): () => void;
  off<E extends PluginEvent>(event: E, callback: Function): void;
}
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

**使用示例**：
```typescript
const host = usePluginHost();

useEffect(() => {
  const unsubscribe = host.events.on('theme:changed', (data) => {
    console.log('Theme changed to:', data.theme);
    // 更新插件 UI
  });
  return unsubscribe; // 组件卸载时自动取消订阅
}, [host]);
```

### PlatformAPI（平台桥梁）

插件不应直接 import `@tauri-apps`、`@/stores`、`@/i18n`，而是通过 `host.platform` 访问：

```typescript
interface PlatformAPI {
  /** 调用后端命令（Tauri invoke 代理，仅允许白名单命令） */
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
  /** 查询主程序配置（只读快照），section: 'email' | 'ai' | 'editor' | 'general' */
  getConfig<T>(section: string): T | null;
  /** i18n 翻译函数，自动加上插件命名空间前缀 */
  t(key: string, params?: Record<string, string | number>): string;
}
```

#### 命令权限白名单（强制）

`platform.invoke()` 只能调用以下命令，非白名单命令会抛出错误：

| 命令 | 用途 |
|------|------|
| `write_binary_file` | 写入二进制文件（导出功能） |
| `read_file_base64` | 读取文件为 base64（附件处理） |
| `get_temp_dir` | 获取临时目录路径 |
| `open_file_with_app` | 用系统应用打开文件（预览） |
| `test_smtp_connection` | 测试 SMTP 连接 |
| `send_email` | 发送邮件 |

**示例（功能执行类插件）**：
```typescript
const host = usePluginHost();
const t = host.platform.t;

// 查询主程序邮箱配置
const emailConfig = host.platform.getConfig<EmailSettings>('email');
const accounts = emailConfig?.accounts?.filter(a => a.enabled) || [];

// 调用后端命令
const result = await host.platform.invoke<string>('send_email', { ... });

// 翻译（自动加上 'plugin-email:' 前缀）
const label = t('title');  // 等价于 i18next.t('plugin-email:title')
```

### 插件独立存储（所有插件）

所有插件的设置和状态通过 `usePluginHost().storage` 独立存储：

```typescript
// 示例：摘要插件存储偏好风格
storage.set('preferredStyle', 'academic');
// 示例：邮件插件存储草稿
storage.set('draft', { to: '...', subject: '...' });
```

底层：`usePluginStorageStore`（Zustand persist → localStorage），按 pluginId 命名空间隔离。

### 生命周期 Hook

插件可在 `DocumentPlugin` 定义中添加生命周期回调：

```typescript
// 在插件 index.ts 中
export const myPlugin: DocumentPlugin = {
  id: '...',
  name: 'My Plugin',
  // ...
  onActivate: () => {
    console.log('Plugin panel mounted');
    // 初始化资源、订阅事件等
  },
  onDeactivate: () => {
    console.log('Plugin panel unmounted');
    // 清理资源、取消订阅等
  },
  onDocumentChange: () => {
    console.log('Document switched');
    // 响应文档切换，刷新数据等
  },
};
```

**调用时机**：
- `onActivate`：插件面板组件挂载时（用户切换到该插件标签）
- `onDeactivate`：插件面板组件卸载时（用户切换到其他插件或关闭）
- `onDocumentChange`：当前标签页的文档 ID 变化时

### 功能执行类插件布局 — `ToolPluginLayout`

```
┌──────────────────────────────────────────────┐
│ ① 工具栏（标准内容导入 + 插件自定义按钮）        │
│ [导入正文] [导入插件▼] [导入合并区] [...自定义]  │
├──────────────────────────────────────────────┤
│ ② 功能区（children，插件完全自定义）             │
├──────────────────────────────────────────────┤
│ ③ 状态栏                                     │
└──────────────────────────────────────────────┘
```

工具栏的「导入」按钮由 Layout 统一实现，通过 `usePluginHost().content` 获取数据。

### 通用 AI 内容生成弹窗 — `AIContentDialog`

功能执行类插件可在任意位置放置 AI 按钮，点击打开此弹窗：
1. 选择预设风格 / 输入自定义提示词
2. 点击生成 → 调用 `usePluginHost().ai.chat()`
3. 预览生成结果，可编辑
4. 确认 → `onGenerated(content)` 回调

### 可扩展性预留

| 扩展点 | 状态 | 说明 |
|--------|------|------|
| API 版本化 | ✅ 已实现 | `apiVersion: 1`，新增模块不破坏旧插件 |
| 分类体系 | ✅ 已实现 | string 类型，动态构建树 |
| 生命周期 Hook | ✅ 已实现 | `onActivate`/`onDeactivate`/`onDocumentChange`（在 `DocumentPlugin` 接口中定义，由 `PluginToolArea` 调用） |
| 事件订阅 | ✅ 已实现 | `host.events.on()`/`off()` 订阅主程序事件 |
| 流式 AI | ✅ 已实现 | `host.ai.chatStream()` 支持实时回调和取消 |
| 命令权限白名单 | ✅ 已实现 | `platform.invoke()` 仅允许安全命令 |
| 插件设置 UI | 📋 预留 | `SettingsComponent` 可选字段 |
| 插件间通信 | 📋 预留 | 通过 `eventBus` 可选参数 |
| 权限声明 | 📋 预留 | 利用已有 `permissions` 字段 |

### Manifest 字段

```typescript
interface PluginManifest {
  // ... 现有字段
  majorCategory: string;  // 大类：'content-generation' | 'functional' | ...
  subCategory: string;    // 子类：'ai-text' | 'visualization' | 'communication' | ...
}
```

### 插件管理界面

树状结构：大类 → 子类 → 插件（含数量统计），支持展开/折叠和搜索联动。

---

## 一、插件文件结构

每个外部插件完全自包含在 `src/plugins/{name}/` 目录下，无需修改任何核心文件：

| 文件 | 作用 | 必需 |
|------|------|------|
| `manifest.json` | 插件元数据（UUID、名称、分类、标签等） | ✅ |
| `index.ts` | 插件定义 + 自注册（`registerPlugin()`） | ✅ |
| `{Name}PluginPanel.tsx` | 插件面板 UI 组件 | ✅ |
| `i18n/{zh,en,ja}.json` | 国际化翻译文件 | ✅ |
| `{name}Utils.ts` | 辅助函数（可选） | ❌ |

> **零改动核心代码**：`loader.ts` 通过 `import.meta.glob` 自动发现新插件，`manifest.json` 通过 `syncManifestsToBackend()` 自动同步到后端。无需修改 `registry.ts`、`constants.ts`、`plugin.rs` 或 `main.rs`。

---

## 二、必须遵循的规则

### 规则 1：UUID 分配与 manifest.json

- 在插件目录下创建 `manifest.json`，包含唯一 UUID
- UUID 格式：`550e8400-e29b-41d4-a716-4466554400XX`，递增末两位
- 查看已有插件的 `manifest.json` 确定下一个可用编号

```json
{
  "id": "550e8400-e29b-41d4-a716-4466554400XX",
  "name": "插件中文名称",
  "version": "1.0.0",
  "description": "插件描述",
  "icon": "LucideIconName",
  "author": "AiDocPlus",
  "type": "external",
  "enabled": true,
  "majorCategory": "content-generation",
  "subCategory": "ai-text",
  "category": "ai-text",
  "tags": ["标签1", "tag2"]
}
```

### 规则 2：插件面板 Props

所有插件面板组件必须实现 `PluginPanelProps` 接口：

```typescript
import type { PluginPanelProps } from '../types';

export function XxxPluginPanel({
  document,     // 当前文档对象
  tabId,        // 当前标签页 ID
  content,      // 正文内容（AI 生成的内容，优先使用）
  pluginData,   // 该插件在文档中已保存的数据
  onPluginDataChange,  // 通知数据变更（自动持久化）
  onRequestSave,       // AI 生成完成后调用，触发磁盘保存
}: PluginPanelProps) { ... }
```

### 规则 3：AI 生成类插件的标准结构

**凡是需要 AI 生成内容的插件，必须使用 `PluginPanelLayout` 统一模板。**

#### 3.1 四区域布局（强制）

所有插件面板必须使用 `PluginPanelLayout` 组件，它提供统一的四区域布局：

```
┌──────────────────────────────────────────────────┐
│ ① 生成区（Generation Zone）                  [▲] │
│   ┌──────────────────────────────────────────┐   │
│   │  提示词框（textarea，2行高度，可手动编辑）  │   │
│   └──────────────────────────────────────────┘   │
│   ┌──────────┐ ┌──────────┐ ┌──────────────┐    │
│   │🔧提示词   │ │✨AI生成XXX│ │🗑️清空全部内容│    │
│   │  构造器   │ │          │ │  （红色）    │    │
│   └──────────┘ └──────────┘ └──────────────┘    │
├──────────────────────────────────────────────────┤
│ ② 工具栏区（Toolbar Zone）                       │
├──────────────────────────────────────────────────┤
│                                                  │
│ ③ 内容区（Content Zone）                         │
│                                                  │
├──────────────────────────────────────────────────┤
│ ④ 底部状态栏（Status Bar）                       │
└──────────────────────────────────────────────────┘
```

- **① 生成区**：包含提示词 textarea（2行高度）+ **四个按钮** + 右上角收起箭头（类似主界面编辑器的折叠指示箭头）
  - **提示词构造器按钮（强制）**：`Settings2` 图标 + 文字「提示词构造器」，点击弹出 `PluginPromptBuilderDialog` 窗口，插件自定义选择/设置/输入控件，确认后自动组装提示词填入提示词框
  - **AI 生成按钮（强制）**：`Wand2` 图标，文字格式为「AI 生成XXX」（如「AI 生成摘要」「AI 生成表格」），将文档正文 + 提示词发送给 AI
  - **清空全部内容按钮（强制）**：`Trash2` 图标 + 文字「清空全部内容」，红色文字样式 `text-destructive border-destructive/50 hover:bg-destructive/10`，通过 `onClearAll` prop 传入 `PluginPanelLayout`
  - **编辑源码按钮（推荐）**：`Code2` 图标 + 文字「编辑源码」，仅在有内容时显示，点击弹出 CodeMirror 编辑弹窗（含 EditorToolbar 工具栏 + 底部状态栏，显示行列/字符数/语言类型）。通过 `sourceCode` 和 `onSourceCodeSave` props 传入 `PluginPanelLayout`，框架自动处理弹窗逻辑。语言类型由框架启发式检测（JSON/Markdown/HTML/Mermaid/纯文本），并通过 `@codemirror/language-data` 自动加载语法高亮
  - 收起时显示提示词摘要 + 右侧展开箭头，不显示生成按钮
- **② 工具栏区**：`flex-shrink-0 border-b bg-muted/20`，**仅放置与插件内容相关的操作按钮**（如复制、导出、编辑等），不放收起/展开生成区的按钮
- **③ 内容区**：`flex-1 min-h-0 overflow-auto`，展示生成结果和编辑界面
- **④ 底部状态栏**：`flex-shrink-0 border-t bg-muted/30 text-sm`，显示操作提示信息

未生成内容时自动显示欢迎界面（居中图标 + 说明文字 + 提示词框 + 三个按钮）。

非 AI 插件（如统计插件）传入 `generationZoneVisible={false}` 隐藏生成区，但保留结构以便未来扩展。

#### 3.2 使用 PluginPanelLayout（强制）

```typescript
import { PluginPanelLayout } from '../_framework/PluginPanelLayout';
import { PluginPromptBuilderDialog } from '../_framework/PluginPromptBuilderDialog';

// 在组件 return 中：
return (
  <PluginPanelLayout
    pluginIcon={<MyIcon className="h-12 w-12 text-muted-foreground/50" />}
    pluginTitle={t('title')}
    pluginDesc={t('description')}
    prompt={prompt}
    onPromptChange={handlePromptChange}
    promptPlaceholder={t('promptPlaceholder')}
    generating={generating}
    onGenerate={handleGenerate}
    generateLabel={t('aiGenerate')}  // 格式："AI 生成摘要"、"AI 生成表格"等
    generatingLabel={t('generating')}
    onPromptBuilderOpen={() => setBuilderOpen(true)}  // 强制：提示词构造器
    promptBuilderDialog={<PluginPromptBuilderDialog ... />}
    toolbar={toolbarContent}
    hasContent={hasContent}
    statusMsg={statusMsg}
    statusIsError={statusIsError}
    onClearAll={handleClearAll}  // 强制：清空全部内容
    sourceCode={myData || undefined}  // 推荐：源码编辑（任意格式）
    onSourceCodeSave={(code) => {     // 推荐：保存编辑后的源码
      onPluginDataChange({ ...data, myField: code });
      markTabAsDirty(tabId);
    }}
  >
    {/* 内容区 */}
    {children}
  </PluginPanelLayout>
);
```

#### 3.3 提示词构建弹窗（强制）

每个 AI 插件必须实现 `PluginPromptBuilderDialog`，让用户通过选择/设置/输入来构建提示词：

```typescript
<PluginPromptBuilderDialog
  open={builderOpen}
  onOpenChange={setBuilderOpen}
  description={t('promptBuilderDesc')}
  onConfirm={(builtPrompt) => handlePromptChange(builtPrompt)}
  previewPrompt={previewPrompt}
>
  {/* 插件自定义的选择/设置/输入控件，必须使用 Button 组件 */}
  <div className="space-y-3">
    <label className="text-sm font-medium">选项标签</label>
    <div className="flex gap-2 flex-wrap">
      <Button variant="outline" size="sm" ...>选项1</Button>
      <Button variant="outline" size="sm" ...>选项2</Button>
    </div>
  </div>
</PluginPromptBuilderDialog>
```

弹窗自动提供：固定标题「提示词构造器」、描述、提示词预览区、取消/确认按钮。插件只需传入自定义控件和实时预览的提示词。

> **注意**：弹窗没有 `title` prop，标题由框架统一提供为「提示词构造器」。

> **职责分离（强制）**：提示词构造器弹窗的确认按钮只负责将组装好的提示词填充到提示词框中，**不允许直接触发 AI 生成任务**。用户必须点击「AI 生成XXX」按钮才能开始生成。

#### 3.4 默认提示词（强制）

每个 AI 插件必须定义一个有意义的默认提示词常量，用户未输入时自动使用。

**提示词模板规范（强制）**：所有提示词必须以「根据本文档的正文内容，」开头，再描述具体任务。这确保 AI 明确知道要基于文档正文来工作。

```typescript
const DEFAULT_PROMPT = '根据本文档的正文内容，提取其中的数据和表格，汇总生成多个表格。';
```

已有插件的默认提示词参考：

| 插件 | 默认提示词 |
|------|----------|
| 表格 | `根据本文档的正文内容，提取其中的数据和表格，汇总生成多个表格。` |
| 摘要 | `根据本文档的正文内容，用一句话概括核心内容，不超过50字。` |
| 测试题 | `根据本文档的正文内容，生成测试题。` |
| 思维导图 | `根据本文档的正文内容，生成结构化思维导图。` |
| 教案 | `根据本文档的正文内容，生成结构化教案。` |
| 翻译 | `根据本文档的正文内容，将其翻译为英文。` |
| 图表 | `根据本文档的正文内容，生成流程图。` |
| PPT | `根据本文档的正文内容，生成演示文稿幻灯片，约 10 页。` |

#### 3.5 提示词和内容持久化（强制）

插件数据中必须保存：
- **`lastPrompt`**：用户上次使用的提示词，下次打开时恢复
- **生成的内容数据**：插件特有的结构化数据

**提示词变更必须触发文档修改状态**：用户编辑提示词时，必须同时调用 `onPluginDataChange` 持久化并调用 `markTabAsDirty` 标记文档为已修改。推荐封装为 `handlePromptChange` 函数：

```typescript
const handlePromptChange = useCallback((val: string) => {
  setPrompt(val);
  onPluginDataChange({ ...data, lastPrompt: val });
  markTabAsDirty(tabId);
}, [data, onPluginDataChange, markTabAsDirty, tabId]);
```

```typescript
interface MyPluginData {
  lastPrompt?: string;        // 用户提示词（必须保存）
  // ... 插件特有的内容数据
}

// 恢复时：
const [prompt, setPrompt] = useState(data.lastPrompt || DEFAULT_PROMPT);
```

#### 3.6 按钮样式规范（强制）

**全局 Button 组件已内置统一的动态反馈（`@/components/ui/button.tsx`）：**

- **hover**：轻微上浮 + 阴影增强（`hover:-translate-y-[1px] hover:shadow-md`）
- **active**：缩放 + 透明度变化（`active:scale-95 active:opacity-80`）
- **transition**：150ms 平滑过渡

因此，**插件中所有按钮必须使用 `Button` 组件**，不允许使用原生 `<button>` 元素，以确保样式一致。

**按钮样式统一规则：**
- 所有按钮统一使用 `variant="outline"`，**不允许使用其他 variant**
- 危险操作按钮（如清空）仍用 `variant="outline"`，通过红色文字区分：`className="text-destructive border-destructive/50 hover:bg-destructive/10"`
- 不需要手动添加 active/hover 样式，Button 组件已全局内置

**按钮命名规范：**
- **提示词构造器按钮**：统一为「提示词构造器」
- **AI 生成按钮**：格式为「AI 生成XXX」，如「AI 生成摘要」「AI 生成表格」「AI 生成测试题」
- **清空按钮**：「清空全部内容」，红色文字 + Trash2 图标

#### 3.7 交互要求

1. **提示词输入框**：textarea（2行高度），用户可自由编辑
2. **提示词构造器按钮**：弹出提示词构造器弹窗，确认后**只填充提示词，不触发生成**
3. **AI 生成按钮**：点击后才真正开始 AI 生成任务
4. **清空全部内容按钮（强制）**：清除插件生成的所有内容和提示词，恢复默认状态。通过 `onClearAll` prop 传入 `PluginPanelLayout`，框架自动在生成区显示红色文字按钮。**所有 AI 插件必须提供此回调**
5. **默认提示词预填**：首次打开时填入默认提示词
6. **生成状态**：使用 `Loader2` 动画 + 文字提示
7. **状态信息规范（强制）**：所有状态信息（生成中、成功、失败、导出等）必须显示在插件底部状态栏，**不允许使用 `addAiMessage` 发送到主窗口聊天区域**
8. **支持重新生成**：生成后仍可修改提示词重新生成
9. **生成区收起**：右上角小箭头（类似主界面编辑器折叠箭头），收起后显示提示词摘要 + 展开箭头
10. **工具栏**：仅放置与插件内容相关的操作按钮，不放收起/展开生成区的按钮

#### 3.8 源码编辑器（推荐）

为插件提供源码编辑功能，用户可直接编辑生成的原始数据。框架自动处理弹窗、工具栏、状态栏和语言检测。

**传入方式**：通过 `sourceCode` 和 `onSourceCodeSave` props 传入 `PluginPanelLayout`：

```typescript
// 文本类数据（Markdown、纯文本等）直接传入
sourceCode={data.markdown || undefined}
onSourceCodeSave={(code) => {
  onPluginDataChange({ ...data, markdown: code });
  markTabAsDirty(tabId);
}}

// JSON 结构化数据需要序列化/反序列化
sourceCode={jsonData ? JSON.stringify(jsonData, null, 2) : undefined}
onSourceCodeSave={(code) => {
  try {
    const parsed = JSON.parse(code);
    onPluginDataChange(parsed);
    markTabAsDirty(tabId);
  } catch { /* 忽略无效 JSON */ }
}}
```

**框架自动提供**：
- **EditorToolbar 工具栏**：复用主编辑器的完整工具栏（撤销/重做、格式化、插入等）
- **底部状态栏**：实时显示行号、列号、选中字符数、总行数、总字符数
- **语言类型检测**：启发式检测 JSON/Markdown/HTML/Mermaid/纯文本，状态栏显示检测结果
- **语法高亮**：通过 `@codemirror/language-data` 的 `LanguageDescription.matchLanguageName` + `load()` 自动加载对应语言扩展
- **保存/取消按钮**：保存时调用 `onSourceCodeSave` 回调

**注意**：`sourceCode` 为 `undefined` 时按钮不显示；仅在 `hasContent` 为 `true` 且 `sourceCode != null` 且 `onSourceCodeSave` 存在时才显示编辑源码按钮。

#### 3.9 正文内容截断（强制）

插件发送给 AI 的正文内容必须统一使用 `truncateContent()` 工具函数，不允许硬编码截断长度：

```typescript
import { truncateContent } from '../_framework/pluginUtils';

// 在拼接 AI 消息时：
{ role: 'user', content: `${userPrompt}\n\n---\n本文档的正文内容如下：\n${truncateContent(sourceContent)}` }
```

- `truncateContent` 读取 `useSettingsStore` 中的 `ai.maxContentLength` 配置
- `maxContentLength = 0` 表示不限制（默认值）
- 用户可在设置面板「AI 设置 → 插件正文字数限制」中配置
- 正文内容前必须标注「本文档的正文内容如下：」

#### 3.10 AI 调用模板

```typescript
import { useAppStore } from '@/stores/useAppStore';
import { getAIInvokeParams } from '@/stores/useSettingsStore';
import { invoke } from '@tauri-apps/api/core';
import { truncateContent } from '../_framework/pluginUtils';

const DEFAULT_PROMPT = '根据本文档的正文内容，...';

// 在组件内：
const { markTabAsDirty } = useAppStore();
const [prompt, setPrompt] = useState(data.lastPrompt || DEFAULT_PROMPT);
const [statusMsg, setStatusMsg] = useState<string | null>(null);
const [statusIsError, setStatusIsError] = useState(false);
const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const showStatus = (msg: string, isError = false, persistent = false) => {
  if (statusTimerRef.current) { clearTimeout(statusTimerRef.current); statusTimerRef.current = null; }
  setStatusMsg(msg);
  setStatusIsError(isError);
  if (!persistent) {
    statusTimerRef.current = setTimeout(() => { setStatusMsg(null); statusTimerRef.current = null; }, 4000);
  }
};

const handleGenerate = async () => {
  const sourceContent = content || document.aiGeneratedContent || document.content || '';
  if (!sourceContent.trim()) {
    showStatus('文档内容为空，无法生成', true);
    return;
  }

  setGenerating(true);
  showStatus('正在生成，请稍候...', false, true); // persistent=true，生成中不自动清除
  const userPrompt = prompt.trim() || DEFAULT_PROMPT;
  const messages = [
    { role: 'system', content: '你是...（系统提示词）' },
    { role: 'user', content: `${userPrompt}\n\n---\n本文档的正文内容如下：\n${truncateContent(sourceContent)}` },
  ];

  try {
    const aiParams = getAIInvokeParams();
    const result = await invoke<string>('chat', {
      messages,
      ...aiParams,
      maxTokens: 4096,
    });
    // 解析 result，更新插件数据（必须包含 lastPrompt）
    onPluginDataChange({ lastPrompt: prompt, /* ...内容数据 */ });
    markTabAsDirty(tabId);
    showStatus('生成成功');
    onRequestSave?.(); // 触发磁盘保存
  } catch (err) {
    showStatus(`生成失败：${err instanceof Error ? err.message : String(err)}`, true);
  } finally {
    setGenerating(false);
  }
};

// 清空全部内容回调（传入 PluginPanelLayout 的 onClearAll）
const handleClearAll = () => {
  onPluginDataChange({});
  setPrompt(DEFAULT_PROMPT);
  markTabAsDirty(tabId);
  showStatus('已清空全部内容');
};
```

### 规则 4：AI 返回格式选择

- **结构化数据**（表格、测试题、教案等）：要求 AI 返回 **JSON**，并在 system prompt 中严格约定格式
- **富文本内容**（摘要、翻译等）：直接返回纯文本或 Markdown
- JSON 解析时必须处理 AI 可能附带的 markdown 代码块标记（` ```json ... ``` `）

### 规则 5：数据持久化

#### 5.1 内存更新（插件侧）

- 通过 `onPluginDataChange(data)` 保存数据到内存，框架自动注入 `_version` 字段
- 数据存储在 `document.pluginData[manifest.id]` 中
- 初始化时从 `pluginData` 恢复状态：`const data = (pluginData as MyPluginData) || {}`
- 修改数据后调用 `markTabAsDirty(tabId)` 标记文档为未保存

#### 5.2 磁盘保存触发策略

| 场景 | 触发方式 | 说明 |
|------|----------|------|
| AI 生成完成 | 插件调用 `onRequestSave?.()` | **必须**在生成成功后调用，框架会 `await saveDocument` 并 `markTabAsClean` |
| 提示词编辑 | 仅 `onPluginDataChange` + `markTabAsDirty` | 不触发即时保存，等待用户手动保存或定时器兜底 |
| 用户手动编辑 | EditorPanel 全局自动保存定时器 | 定时器检测 `tab.isDirty`，兜底保存插件数据变更 |
| 版本恢复 | 后端 `restore_version` | 自动恢复 `pluginData` 和 `enabledPlugins` |

#### 5.3 后端 `save_document` 的 Option 字段保护规则

**关键规则**：后端 `save_document` 中所有 `Option` 类型的字段（`attachments`、`pluginData`、`enabledPlugins`）必须使用 `if let Some` 保护，**禁止无条件直接赋值**：

```rust
// ✅ 正确：只有前端明确传值时才覆盖，None 时保留磁盘旧数据
if let Some(pd) = pluginData {
    document.plugin_data = Some(pd);
}

// ❌ 错误：前端传 undefined（Rust 侧为 None）时会清空磁盘数据
document.plugin_data = pluginData;
```

**原因**：前端 `saveDocument` 传 `pluginData: document.pluginData || undefined`，如果文档对象中 `pluginData` 恰好为 `undefined`（旧文档、竞争条件等），后端收到 `None` 后直接赋值会**清空磁盘上已有的插件数据**。

#### 5.4 `onRequestSave` 框架实现细节

`PluginToolArea` 中的 `handleRequestSave` 实现：
1. 从 store 获取**最新**文档（`useAppStore.getState().documents.find(...)`）
2. `await saveDocument(latestDoc)` 确保保存完成
3. 保存成功后 `markTabAsClean(tab.id)` 清除 dirty 标记，避免 EditorPanel 重复保存

插件侧只需在生成成功后调用 `onRequestSave?.()`，无需关心内部实现。

#### 5.5 版本历史

- 插件数据（`pluginData`）和启用插件列表（`enabledPlugins`）包含在版本历史中
- 创建版本时传入当前文档的 `pluginData` 和 `enabledPlugins`
- 恢复版本时自动还原这两个字段

### 规则 6：文件导出

Tauri 桌面应用中 `URL.createObjectURL` + `<a>.click()` **不工作**。必须使用：

```typescript
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';

const filePath = await save({
  defaultPath: '文件名.xlsx',
  filters: [{ name: '描述', extensions: ['xlsx'] }],
});
if (!filePath) return;

const data = Array.from(new Uint8Array(buffer));
await invoke('write_binary_file', { path: filePath, data });
```

### 规则 7：UI 规范

- 字体：`fontFamily: '宋体', fontSize: '16px'`
- 不使用弹出窗口提示，在面板内显示状态信息
- 退出/危险操作按钮为红色，居中
- 使用 `lucide-react` 图标
- 使用项目已有的 `@/components/ui/button` 等 UI 组件
- 确保 macOS 和 Windows 跨平台兼容

#### 7.1 主题颜色一致性（强制）

**所有插件 UI 必须与主程序主题保持完全一致。** 主程序通过 CSS 变量（`--background`、`--foreground`、`--muted`、`--border` 等）定义明暗主题，插件必须使用这些变量而非硬编码颜色值。

**强制规则：**

1. **禁止硬编码颜色**：不允许使用 `#ffffff`、`rgb(255,255,255)`、`white`、`black` 等固定颜色值作为背景或文字颜色。必须使用 Tailwind CSS 的主题类名（如 `bg-background`、`text-foreground`、`bg-muted`、`border-border` 等）
2. **Dialog 弹窗**：使用 SDK 导出的 `Dialog`/`DialogContent` 组件，框架已确保弹窗背景跟随主题（`bg-background text-foreground`，不透明，无 backdrop-blur）。**禁止在 DialogContent 上覆盖 `backgroundColor` 或 `color` 的 inline style**
3. **DropdownMenu / Popover**：同样使用 SDK 导出的组件，框架已通过全局 CSS 强制不透明背景
4. **暗色模式适配**：所有自定义样式必须同时考虑亮色和暗色模式。如需条件样式，使用 `dark:` 前缀（如 `text-green-600 dark:text-green-400`）
5. **获取当前主题**：通过 `host.ui.getTheme()` 获取（返回 `'light'` 或 `'dark'`），或监听 `host.events.on('theme:changed', callback)`
6. **HTML 内容渲染**：使用 `dangerouslySetInnerHTML` 渲染 HTML 内容时，外层容器必须添加 `prose dark:prose-invert` 类确保内容跟随主题

**允许的颜色使用场景：**
- 语义色彩标识（如 `text-red-500` 表示错误、`text-green-600` 表示成功、`bg-amber-500/10` 表示警告）
- 这些语义颜色在明暗模式下都有足够对比度，可以直接使用

**常用主题类名速查：**

| 用途 | 亮色效果 | 暗色效果 | Tailwind 类名 |
|------|---------|---------|--------------|
| 页面/面板背景 | 白色 | 深色 | `bg-background` |
| 主要文字 | 深色 | 浅色 | `text-foreground` |
| 次要文字 | 灰色 | 浅灰 | `text-muted-foreground` |
| 卡片/区块背景 | 白色 | 深色 | `bg-card` |
| 淡色背景 | 浅灰 | 深灰 | `bg-muted` / `bg-muted/30` |
| 边框 | 浅灰 | 深灰 | `border-border` |
| 输入框背景 | 白色 | 深色 | `bg-background` |
| 弹窗背景 | 白色 | 深色 | 由 `DialogContent` 自动处理 |

### 规则 8：index.ts 自注册（强制）

每个插件的 `index.ts` 必须：
1. 从 `manifest.json` 读取 UUID
2. 定义 `DocumentPlugin` 对象
3. 调用 `registerPlugin()` 自注册

```typescript
// index.ts 模板
import { IconName } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { registerPlugin } from '../pluginStore';
import { XxxPluginPanel } from './XxxPluginPanel';
import manifest from './manifest.json';
import zh from './i18n/zh.json';
import en from './i18n/en.json';
import ja from './i18n/ja.json';

// 注册插件 i18n
registerPluginI18n('plugin-xxx', { zh, en, ja });

export const xxxPlugin: DocumentPlugin = {
  id: manifest.id,
  name: manifest.name,
  icon: IconName,
  description: manifest.description,
  majorCategory: manifest.majorCategory,
  subCategory: manifest.subCategory,
  i18nNamespace: 'plugin-xxx',
  PanelComponent: XxxPluginPanel,
  hasData: (doc) => {
    const data = doc.pluginData?.[manifest.id];
    return data != null && typeof data === 'object'
      && 'someKey' in (data as Record<string, unknown>);
  },
};

// 自注册（模块加载时自动执行）
registerPlugin(xxxPlugin);
```

> **注意**：`registerPlugin` 从 `../pluginStore` 导入（而非 `../registry`），避免循环依赖。
> **无需修改 `registry.ts`、`constants.ts`、`plugin.rs` 或 `main.rs`**。`loader.ts` 会自动发现新插件。

### 规则 10：插件面板布局模式

**所有插件必须使用 `PluginPanelLayout` 组件**（见规则 3.1-3.2）。

- AI 生成类插件：使用完整四区域布局 + `PluginPromptBuilderDialog` 提示词构建弹窗
- 非 AI 插件（如统计插件）：传入 `generationZoneVisible={false}` 隐藏生成区，但保留结构以便未来扩展

框架组件位置（`src/plugins/_framework/`）：
- `PluginPanelLayout.tsx` — 内容生成类统一布局模板（四区域）
- `ToolPluginLayout.tsx` — 功能执行类统一布局（导入工具栏 + 功能区 + 状态栏）
- `PluginHostAPI.ts` — PluginHostAPI 类型定义 + React Context + `usePluginHost()` hook + 工厂函数
- `AIContentDialog.tsx` — 通用 AI 内容生成弹窗（预设风格 + 提示词 + 生成 + 编辑 + 确认）
- `PluginPromptBuilderDialog.tsx` — 提示词构造器弹窗壳（内容生成类使用）
- `ui.ts` — UI 原语 re-export 层（Button/Input/Select/Dialog 等，插件从此处 import）
- `pluginUtils.ts` — 工具函数（truncateContent 等）
- `index.ts` — i18n 注册
- `i18n/{zh,en,ja}.json` — 框架层翻译

独立存储：
- `src/stores/usePluginStorageStore.ts` — 插件独立持久化存储（Zustand persist，按 pluginId 隔离）

---

## 三、创建步骤清单

### 内容生成类插件

1. **创建目录**：`src/plugins/{name}/`
2. **创建 `manifest.json`**：包含 UUID（递增）、名称、`majorCategory: "content-generation"`、`subCategory` 等
3. **创建 `index.ts`**：定义 `DocumentPlugin`，从 `manifest.json` 读取 UUID，调用 `registerPlugin()` 自注册
4. **创建面板组件**：`{Name}PluginPanel.tsx`，实现 `PluginPanelProps`，使用 `PluginPanelLayout`
5. **创建 i18n 文件**：`i18n/{zh,en,ja}.json`
6. **创建工具文件**（可选）：`{name}Utils.ts`
7. **编译验证**：`npx tsc --noEmit`（前端）

### 功能执行类插件

1. **创建目录**：`src/plugins/{name}/`
2. **创建 `manifest.json`**：包含 UUID（递增）、名称、`majorCategory: "functional"`、`subCategory` 等
3. **创建 `index.ts`**：定义 `DocumentPlugin`，设置 `hasData: () => false`，调用 `registerPlugin()` 自注册
4. **创建面板组件**：`{Name}PluginPanel.tsx`，实现 `PluginPanelProps`，使用 `ToolPluginLayout` + `usePluginHost()`
5. **创建 i18n 文件**：`i18n/{zh,en,ja}.json`
6. **编译验证**：`npx tsc --noEmit`（前端）

> **无需修改任何核心文件**（`registry.ts`、`constants.ts`、`plugin.rs`、`main.rs`）。`loader.ts` 自动发现新插件。

**功能执行类插件关键区别**：
- 使用 `ToolPluginLayout` 而非 `PluginPanelLayout`
- 通过 `usePluginHost().storage` 独立持久化数据，不使用 `onPluginDataChange`
- `hasData` 始终返回 `false`（不在 document.pluginData 中存数据）
- AI 功能通过 `AIContentDialog` 弹窗实现，而非生成区
- 所有 import 必须来自 `_framework/` SDK 层

---

## 四、现有插件参考（21 个，全部为外部插件）

### 内容生成类插件（content-generation）

| 插件 | 目录 | AI 生成 | 导出 | 源码编辑 | 参考价值 |
|------|------|---------|------|----------|----------|
| 摘要 | `summary/` | ✅ 多风格 | 复制 | ✅ | **新内容生成类插件首选参考** |
| 测试题 | `quiz/` | ✅ JSON | HTML | ✅ JSON | JSON 解析 + HTML 渲染 |
| 思维导图 | `mindmap/` | ✅ Markdown | - | ✅ Markdown | Markdown 渲染 |
| 表格 | `table/` | ✅ JSON + 提示词 | Excel/CSV/JSON | ✅ JSON | 完整数据编辑 + 多格式导出 |
| PPT | `ppt/` | ✅ | PPTX | ✅ JSON | 文件导出（write_binary_file）|
| 翻译 | `translation/` | ✅ 多语言 | - | ✅ | 多选项 AI |
| 平行翻译 | `parallel-translation/` | ✅ 双语对照 | - | ✅ | 双语对照翻译 |
| 图表 | `diagram/` | ✅ Mermaid | SVG | ✅ Mermaid | Mermaid 代码渲染 |
| 统计 | `analytics/` | ❌ 纯前端 | - | ❌ | 非 AI 插件（generationZoneVisible=false） |
| 教案 | `lessonplan/` | ✅ | - | ✅ | 结构化生成 |
| 时间线 | `timeline/` | ✅ | - | ✅ | 时间线生成 |
| 审阅 | `review/` | ✅ | - | ✅ | 文档审阅批注 |
| 写作统计 | `writing-stats/` | ❌ 纯前端 | - | ❌ | 写作数据分析 |

### 功能执行类插件（functional）

| 插件 | 目录 | 布局 | AI 功能 | 独立存储 | 参考价值 |
|------|------|------|---------|----------|----------|
| 邮件 | `email/` | `ToolPluginLayout` | `AIContentDialog` 弹窗 | ✅ `host.storage` | **新功能执行类插件首选参考** |
| 文档对比 | `diff/` | `ToolPluginLayout` | - | ✅ | 文档版本对比 |
| 加密 | `encrypt/` | `ToolPluginLayout` | - | ✅ | 文档加密保护 |
| 水印 | `watermark/` | `ToolPluginLayout` | - | ✅ | 文档水印 |
| TTS | `tts/` | `ToolPluginLayout` | - | ✅ | 文字转语音 |
| Office 预览 | `officeviewer/` | `ToolPluginLayout` | - | ✅ | 文件预览 |
| Pandoc 导出 | `pandoc/` | `ToolPluginLayout` | - | ✅ | 多格式导出 |
| 发布 | `publish/` | `ToolPluginLayout` | - | ✅ | 外部发布 |

**内容生成类**推荐以 `summary/SummaryPluginPanel.tsx` 作为起始模板。
**功能执行类**推荐以 `email/EmailPluginPanel.tsx` 作为起始模板。
