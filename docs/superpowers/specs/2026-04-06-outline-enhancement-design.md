# 大纲文档增强设计

日期：2026-04-06

## 1. 高亮颜色系统增强

### 现状
- 6 种硬编码颜色（黄、绿、蓝、紫、粉、红）
- `HIGHLIGHT_COLORS`（OutlineEditorToolbar）和 `HIGHLIGHT_SWATCHES`（NodeFloatingMenu）重复定义
- CSS 与 JS 色值不一致（green 色值不同，CSS 多 orange）
- `node.colorHighlight` 已存储但 OutlineRow 不渲染

### 方案
- 将高亮颜色提取到 `types.ts` 统一管理为共享常量
- 提供 **36 种预设颜色**（6 行 x 6 列色板）
- 色板底部增加**自定义颜色按钮**，弹出 `<input type="color">` 系统颜色选择器
- 自定义颜色缓存最近 8 个，持久化到文档数据
- 统一 CSS 与 JS 色值
- 修复 `node.colorHighlight` 在 OutlineRow 上不渲染的 bug

### 36 种预设颜色

| 行 | 色系 | 颜色 |
|---|---|---|
| 1 | 暖黄 | 淡黄 #fef3c7, 金黄 #fef08a, 琥珀 #fde68a, 蜜桃 #fed7aa, 杏色 #ffedd5, 浅橙 #ffedd5 |
| 2 | 绿系 | 薄荷 #d1fae5, 淡绿 #dcfce7, 翠绿 #bbf7d0, 橄榄 #d9f99d, 鼠尾草 #ecfccb, 青柠 #fef9c3 |
| 3 | 蓝系 | 天蓝 #dbeafe, 湖蓝 #bfdbfe, 钴蓝 #93c5fd, 靛蓝 #a5b4fc, 薰衣草 #ddd6fe, 雾蓝 #c7d2fe |
| 4 | 紫粉 | 淡紫 #e9d5ff, 丁香 #f3e8ff, 紫藤 #d8b4fe, 桃粉 #fce7f3, 玫瑰 #fecdd3, 浅红 #ffe4e6 |
| 5 | 红橙 | 珊瑚 #fed7aa, 番茄 #fecaca, 鲑鱼 #fda4af, 陶土 #fdba74, 赤褐 #f87171, 砖红 #ef4444 |
| 6 | 中性 | 浅灰 #f3f4f6, 银灰 #e5e7eb, 暖灰 #f5f5f4, 米色 #fefce8, 象牙 #fff7ed, 淡棕 #fef2f2 |

### UI 交互
- 工具栏和浮动菜单共用同一色板组件
- 色板以 Popover 弹出，6x6 网格 + 底部自定义按钮
- 自定义颜色显示为最近 8 个小圆点（如有）

## 2. 展开/收缩按钮合并

### 现状
- 工具栏 3 个按钮：切换活动分支、全部展开、全部收缩
- 占据较多空间

### 方案
- 合并"全部展开"+"全部收缩"为**智能切换按钮**
- 有折叠节点时 → `ChevronsDown` 图标 + "全部展开" tooltip → 点击展开所有
- 全部展开时 → `ChevronsUp` 图标 + "全部收缩" tooltip → 点击折叠所有
- 保留"切换活动分支"按钮，图标根据活动节点状态切换
- 判断依据：`collapsedNodeIds.size > 0` 则为有折叠

## 3. 其他问题修复

### 高优先级（功能缺陷）

| # | 问题 | 修复方案 |
|---|---|---|
| 1 | `node.colorHighlight` 不渲染 | OutlineRow 根据 `node.colorHighlight` 应用背景色 |
| 2 | `completed` 硬编码 `false` | 读取 `node.completed` 传入 ProseMirrorNodeEditor |
| 3 | `searchCaseSensitive`/`searchUseRegex` 无 setter | 移除死代码或暴露到 SearchPanel |
| 4 | `saveStatus` 永远不显示 `saving` | 接入保存流程，debounce 前设 saving，完成后设 saved |

### 中优先级（代码质量）

| # | 问题 | 修复方案 |
|---|---|---|
| 5 | 颜色数组重复定义 | 提取到 types.ts 共享常量 |
| 6 | CSS 与 JS 色值不一致 | 统一为 36 色板 |
| 7 | `outlineContext.ts`（745 行）死代码 | 删除 |
| 8 | `useOutlineReducer.ts`（497 行）死代码 | 删除 |
| 9 | `OutlineCommandPalette.tsx` 未引用 | 删除 |
| 10 | `TagCloud.tsx` 未引用 | 删除 |
| 11 | 虚拟化/非虚拟化渲染代码重复 | 提取公共渲染函数 |
| 12 | IME 处理三重检查冗余 | 统一到 ProseMirror 扩展层 |

### 低优先级（体验优化，可选）

| # | 问题 | 修复方案 |
|---|---|---|
| 13 | 浮动菜单 4 个禁用项 | 清理占位菜单项 |
| 14 | IME 冗余检查 | 统一到扩展层 |

## 涉及文件

| 文件 | 变更类型 |
|---|---|
| `document-types/outline/types.ts` | 新增高亮色常量、自定义色类型 |
| `components/OutlineEditorToolbar.tsx` | 替换色板、合并展开/收缩按钮 |
| `components/NodeFloatingMenu.tsx` | 替换色板为统一组件 |
| `components/OutlineRow.tsx` | 应用 colorHighlight 背景、修复 completed |
| `components/OutlineEditor.tsx` | 清理死状态、接入 saving 状态、提取渲染函数 |
| `components/OutlineEditorToolbar.tsx` | 新建共享色板组件 |
| `components/StatusBar.tsx` | saving 状态可达 |
| `OutlineWorkspace.tsx` | 传递 saving 状态 |
| `styles/outline.css` | 统一色值、新增自定义色样式 |
| `outlineContext.ts` | 删除 |
| `useOutlineReducer.ts` | 删除 |
| `OutlineCommandPalette.tsx` | 删除 |
| `TagCloud.tsx` | 删除 |
| `components/index.ts` | 移除已删组件导出 |
| `hooks/useOutlineKeyboard.ts` | IME 统一 |
| `components/ProseMirrorNodeEditor.tsx` | 移除冗余 IME 检查 |
