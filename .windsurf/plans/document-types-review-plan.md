# 四大文档类型全面审查计划

> 审查范围：日记(diary)、大纲(outline)、计算(calculator)、任务清单(task-list)
> 标准：高品质、专业化、商业化

---

## 一、已发现的关键问题（按严重性排序）

### 🔴 P0 — 功能缺失/逻辑错误

| # | 文档类型 | 问题描述 | 文件 | 行号 |
|---|---------|---------|------|------|
| 1 | **大纲** | 导出缺少 DOCX/PDF 格式，仅有 Markdown/OPML/JSON/HTML，不符合全文档类型导出规范 | `outline/components/ExportDialog.tsx` | L34 |
| 2 | **日记** | 无撤销/重做功能 — 其余三种文档（大纲/计算/任务清单）均已实现 undo/redo | `diary/DiaryDocWorkspace.tsx` | 全局 |
| 3 | **日记** | 无错误边界(ErrorBoundary) — 计算和任务清单均有，日记渲染异常会导致整个标签页白屏 | `diary/DiaryDocWorkspace.tsx` | 全局 |
| 4 | **计算** | `handleBulkDelete` 使用 `window.confirm` 同步阻塞弹窗，用户体验差且无法国际化；任务清单已使用独立 Dialog 组件 | `calculator/CalculatorWorkspace.tsx` | L616 |

### 🟡 P1 — 代码缺陷/潜在 Bug

| # | 文档类型 | 问题描述 | 文件 | 行号 |
|---|---------|---------|------|------|
| 5 | **日记** | `today` 变量在渲染函数顶层调用 `getTodayDateStr()`，未使用 useMemo+时间依赖；若用户跨午夜不关闭页面，"历史上的今天"等数据不会刷新 | `diary/DiaryDocWorkspace.tsx` | L602 |
| 6 | **日记** | `handleSave` 无条件执行保存操作，不检查内容是否已变化，造成不必要的磁盘写入 | `diary/DiaryDocWorkspace.tsx` | L197-217 |
| 7 | **日记** | `diary` state 声明(L156)位于初始化 useEffect(L119-154)之后，代码组织混乱，增加维护风险 | `diary/DiaryDocWorkspace.tsx` | L119-156 |
| 8 | **计算** | `handleSearchNavigate` 在 `setActiveMatchIndex` 回调中调用 `setCalcDoc`，混合了两个 state 更新可能导致过期状态 | `calculator/CalculatorWorkspace.tsx` | L440-459 |
| 9 | **计算** | ID 生成方式不一致 — 多处使用 `Date.now()` + `Math.random()` 而非 `crypto.randomUUID()`，存在极低概率碰撞风险 | `calculator/CalculatorWorkspace.tsx` | L814-821 |
| 10 | **大纲** | `activeOutline` 的 fallback `createEmptyOutline()` 每次 render 创建新对象，若 outlines 为空可能触发子组件不必要的重渲染 | `outline/OutlineWorkspace.tsx` | L349-355 |

### 🟢 P2 — 性能/工程质量

| # | 文档类型 | 问题描述 | 文件 |
|---|---------|---------|------|
| 11 | **日记** | 大量子组件(Dashboard/Settings/Export/Import/Search/Trash)直接同步 import，未 lazy 加载，增加首屏 bundle 体积 | `diary/DiaryDocWorkspace.tsx` L16-33 |
| 12 | **计算** | CalculatorWorkspace.tsx 达 2511 行，建议将 SheetTabs、ErrorBoundary、搜索逻辑等拆分为独立文件 | `calculator/CalculatorWorkspace.tsx` |
| 13 | **日记** | 写作计时器每秒 setInterval + 每10秒 setState，长期运行可能不必要地触发组件树重渲染 | `diary/DiaryDocWorkspace.tsx` L315-336 |
| 14 | **任务清单** | TaskListWorkspace.tsx 达 2258 行，ListTabs/TaskRowBase/formatRelativeTime 等可拆分 | `task-list/TaskListWorkspace.tsx` |

---

## 二、修复实施计划（按优先级执行）

### Phase 1: P0 — 功能缺失修复

#### 1.1 大纲导出增加 DOCX/PDF 格式
- **目标文件**: `outline/components/ExportDialog.tsx`
- **方案**: 参照日记和任务清单的导出实现，在 ExportFormat 类型中增加 `'docx' | 'pdf'`，添加对应 UI 选项，实现导出逻辑（通过 Rust 后端 `export_document_native` 命令）
- **参考**: `diary/DiaryExportDialog.tsx` L92-115, `task-list/TaskListExportDialog.tsx` L156-186

#### 1.2 日记添加撤销/重做功能
- **目标文件**: `diary/DiaryDocWorkspace.tsx`
- **方案**: 参照任务清单的实现模式，添加 `past`/`future` 历史栈 + `pushHistory`/`handleUndo`/`handleRedo` 回调，在工具栏添加撤销/重做按钮
- **影响范围**: `DiaryDocWorkspace.tsx`, `DiaryToolbar.tsx`

#### 1.3 日记添加错误边界
- **目标文件**: `diary/DiaryDocWorkspace.tsx`
- **方案**: 参照 `TaskListWorkspaceErrorBoundary` / `CalculatorWorkspaceErrorBoundary`，创建 `DiaryWorkspaceErrorBoundary` 类组件，包裹主组件

#### 1.4 计算文档批量删除改用 Dialog 组件
- **目标文件**: `calculator/CalculatorWorkspace.tsx`
- **方案**: 移除 `window.confirm`，创建类似 `TaskListBulkDeleteDialog` 的确认对话框组件

### Phase 2: P1 — 代码缺陷修复

#### 2.1 日记跨午夜日期刷新
- 将 `today` 包裹在 useMemo 中，或添加定时刷新机制

#### 2.2 日记 handleSave 增加变化检查
- 在 handleSave 中比较当前内容与已保存内容，无变化时跳过

#### 2.3 日记 state 声明顺序调整
- 将 `diary` state 声明移到 useEffect 之前

#### 2.4 计算文档搜索导航状态更新
- 将 `setCalcDoc` 从 `setActiveMatchIndex` 回调中移出

#### 2.5 计算文档 ID 生成统一
- 提取公共的 `genId` 工具函数

#### 2.6 大纲 activeOutline fallback 稳定化
- 使用 useRef 或 useMemo 缓存空大纲 fallback

### Phase 3: P2 — 性能/工程优化

#### 3.1 日记子组件 lazy 加载
- 将 Dashboard/Settings/Export/Import/Search/Trash 改为 React.lazy

#### 3.2 计算文档组件拆分
- 将 SheetTabs、ErrorBoundary 拆分为独立文件

#### 3.3 日记写作计时器优化
- 仅在计时显示可见时更新 UI state

#### 3.4 任务清单组件拆分
- 将 ListTabs、TaskRowBase、formatRelativeTime 拆分

---

## 三、审查范围概览

| 文档类型 | 文件数 | 代码量 | 主要组件行数 |
|---------|-------|--------|-------------|
| 日记 | 30 | 338KB | DiaryDocWorkspace: 990行 |
| 大纲 | 10+5子目录 | 170KB+ | OutlineWorkspace: 1017行 |
| 计算 | 25+1引擎目录 | 511KB+ | CalculatorWorkspace: 2511行 |
| 任务清单 | 19 | 252KB | TaskListWorkspace: 2258行 |

---

## 四、预期执行顺序

1. **P0-#1**: 大纲导出增加 DOCX/PDF
2. **P0-#2**: 日记添加撤销/重做
3. **P0-#3**: 日记添加错误边界
4. **P0-#4**: 计算文档批量删除 Dialog 化
5. **P1-#5~#10**: 按序修复代码缺陷
6. **P2-#11~#14**: 按序优化性能和工程质量

> **注意**: 每项修复完成后需验证编译通过且不引入回归问题。
