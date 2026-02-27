---
description: 修改编程区（CodingPanel）功能时的工作流程和技术要点
---

# 修改编程区（CodingPanel）

## 涉及的核心文件

| 文件 | 职责 |
|------|------|
| `apps/desktop/src-ui/src/components/coding/CodingPanel.tsx` | 主面板：工具栏、标签栏、CodeMirror 编辑器、输出区、设置面板、命令面板 |
| `apps/desktop/src-ui/src/components/coding/CodingFileTree.tsx` | 文件树侧边栏：递归树形、收藏、搜索、右键菜单 |
| `apps/desktop/src-ui/src/components/coding/CodingAssistantPanel.tsx` | AI 助手面板：快捷操作、上下文对话、代码块应用、Diff 预览 |
| `apps/desktop/src-ui/src/components/coding/codingAI.ts` | AI 自动化引擎：自动运行循环、流式对话、代码块提取 |
| `apps/desktop/src-ui/src/stores/useCodingStore.ts` | Zustand 状态管理：标签页、收藏、设置、运行历史 |
| `apps/desktop/src-tauri/src/commands/coding.rs` | Rust 后端：文件 CRUD、文件树、搜索、pip 管理、状态持久化 |
| `apps/desktop/src-tauri/src/main.rs` | 命令注册（coding::* 模块） |

## 修改步骤

### 1. 添加新的 Rust 后端命令

1. 在 `/Users/jdh/Code/AiDocPlus-Main/apps/desktop/src-tauri/src/commands/coding.rs` 中添加 `#[tauri::command]` 函数
2. 在 `/Users/jdh/Code/AiDocPlus-Main/apps/desktop/src-tauri/src/main.rs` 的 `invoke_handler` 中注册命令
3. 路径解析使用 `resolve_path()` 函数（相对路径基于 `~/AiDocPlus/CodingScripts/`，绝对路径直接使用）
4. 文件格式白名单：`py, html, htm, js, jsx, ts, tsx, json, md, css, txt, xml, yaml, yml, toml, sh, sql`

### 2. 添加前端状态

1. 在 `/Users/jdh/Code/AiDocPlus-Main/apps/desktop/src-ui/src/stores/useCodingStore.ts` 中添加状态和 action
2. 注意：不使用 Zustand persist，通过 `invoke('save_coding_state')` 手动持久化
3. 需要持久化的数据要加入 `persistState()` 方法的序列化对象中
4. 持久化有 500ms debounce

### 3. 添加 UI 功能

1. 工具栏按钮 → `CodingPanel.tsx` 的工具栏区域
2. 文件树功能 → `CodingFileTree.tsx`
3. AI 助手功能 → `CodingAssistantPanel.tsx` 或 `codingAI.ts`
4. 命令面板命令 → `CodingPanel.tsx` 中 `useMemo` 定义的 `commands` 数组

### 4. i18n 国际化

1. 翻译键使用 `coding.` 前缀
2. 必须同时更新中英文翻译文件：
   - `/Users/jdh/Code/AiDocPlus-Main/apps/desktop/src-ui/src/i18n/locales/zh/translation.json`
   - `/Users/jdh/Code/AiDocPlus-Main/apps/desktop/src-ui/src/i18n/locales/en/translation.json`
3. 所有 `t()` 调用必须包含 `defaultValue` 参数

### 5. 编译验证

// turbo
```bash
cd /Users/jdh/Code/AiDocPlus-Main/apps/desktop && pnpm tsc --noEmit
```

### 6. 运行验证

```bash
cd /Users/jdh/Code/AiDocPlus-Main/apps/desktop && pnpm tauri dev
```

## 技术要点

### CodeMirror 编辑器
- 使用 `lazy(() => import('@uiw/react-codemirror'))` 延迟加载
- 语言扩展动态加载（`@codemirror/lang-*`）
- 主题：auto/light/dark + 12 种 `@uiw/codemirror-theme-*`

### 拖拽排序
- 标签栏使用 `@dnd-kit/core` + `@dnd-kit/sortable`
- 面板宽度/高度使用 `onMouseDown` + `mousemove` 实现

### 脚本执行
- Python: `run_python_script` 命令（支持 `AIDOCPLUS_INPUT_FILE` / `AIDOCPLUS_OUTPUT_FILE` 环境变量）
- Node.js: `run_node_script` 命令
- 输出区支持 ANSI 彩色解析

### AI 自动化
- `aiAutoRun()`：生成→运行→检测→pip install→AI修正→重试（最多 3 次）
- 独立 `codingServiceId`，可与主编辑器使用不同 AI 服务
- 流式输出使用 Tauri `listen('ai:stream:chunk')` 事件

### 文件树
- 3 秒轮询刷新（`setInterval`）
- 全局内容搜索 debounce 300ms
- 收藏标记在 `useCodingStore.favorites` 中管理

### 输出区图片渲染
- 使用 Tauri `asset.localhost` 协议：`https://asset.localhost/` + 编码路径
- 正则检测输出中的图片路径并自动渲染
