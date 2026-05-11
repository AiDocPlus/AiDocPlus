# AiDocPlus 全面代码审查报告

> 审查范围：`src-tauri/src/` 后端 Rust 核心 + `src-ui/src/stores/` 前端状态管理  
> 日期：2026-04-27

---

## 一、总体评价

整体架构清晰，Tauri 命令与前端 store 分层合理，安全校验覆盖面广。以下按**安全**、**正确性**、**性能**、**可维护性**、**代码一致性**五个维度列出发现的问题。

---

## 二、安全问题

### 2.1 [高] `get_file_metadata` 缺少路径校验

**文件**：`/Users/jdh/Code/AiDocPlus/apps/desktop/src-tauri/src/commands/file_system.rs:263-274`

```rust
pub fn get_file_metadata(path: String) -> Result<serde_json::Value> {
    let file_path = Path::new(&path);
    if !file_path.exists() { ... }
    let metadata = fs::metadata(file_path).context("Failed to read metadata")?;
    // ⚠️ 没有调用 validate_path_in_allowed_dir
```

同文件中 `read_file`、`write_file`、`delete_file`、`create_directory` 都调用了 `validate_path_in_allowed_dir`，但 `get_file_metadata` 遗漏了，允许前端探测任意路径的文件大小和类型。

**建议**：添加 `validate_path_in_allowed_dir` 校验。

---

### 2.2 [高] `get_document_file_path` 硬编码路径、无 ID 校验

**文件**：`/Users/jdh/Code/AiDocPlus/apps/desktop/src-tauri/src/commands/file_system.rs:286-296`

```rust
pub fn get_document_file_path(project_id: String, document_id: String) -> Result<String> {
    let home = dirs::home_dir()...;
    let doc_path = home.join("AiDocPlus").join("Projects").join(&project_id)...;
    // ⚠️ 1. 没有 validate_id → project_id = "../../../etc" 可拼出危险路径
    // ⚠️ 2. 硬编码 "AiDocPlus"，未使用 config::current_data_root()
```

**建议**：
1. 添加 `security::validate_id(&project_id, "projectId")?;` 和 document_id 同理
2. 使用 `crate::config::current_data_root()` 替代硬编码

---

### 2.3 [中] `show_in_folder` 缺少路径校验

**文件**：`/Users/jdh/Code/AiDocPlus/apps/desktop/src-tauri/src/commands/file_system.rs:300-341`

该命令直接将前端传入的 `path` 传给 `open -R`（macOS）或 `explorer /select`（Windows），没有做路径校验。虽然不会直接读写文件，但允许在文件管理器中导航到任意路径。

**建议**：至少添加 `validate_path_allowed` 限制在允许目录内。

---

### 2.4 [中] `export_document_native` 路径校验不使用集中函数

**文件**：`/Users/jdh/Code/AiDocPlus/apps/desktop/src-tauri/src/commands/export.rs:48-67`

手动构建 `home_canonical` 和 `temp_canonical` 做路径校验，与 `security::validate_path_allowed` 逻辑重复且不一致（缺少 `data_root`）。

**建议**：统一使用 `security::validate_path_allowed`。

---

### 2.5 [低] `rename_document` 重复校验标题

**文件**：`/Users/jdh/Code/AiDocPlus/apps/desktop/src-tauri/src/commands/document.rs:161-172`

`security::validate_title(&newTitle)?;` 已在第 161 行做了空值和路径分隔符校验，但 168-172 行又手动做了一次 `trimmed_title.is_empty()` 检查，逻辑重复。

**建议**：移除手动的重复检查，依赖 `validate_title` 的返回值。

---

### 2.6 [低] `validate_path_under_root` 标记为 `dead_code`

**文件**：`/Users/jdh/Code/AiDocPlus/apps/desktop/src-tauri/src/security.rs:191`

该函数有 `#[allow(dead_code)]` 标记，说明目前没有被使用。如果不打算使用，建议移除以减少维护负担。

---

## 三、正确性问题

### 3.1 [中] `save_document` 的 `authorNotes` 未做 `validate_content_size`

**文件**：`/Users/jdh/Code/AiDocPlus/apps/desktop/src-tauri/src/commands/document.rs:67-74`

`content`、`aiGeneratedContent`、`composedContent` 都做了 `validate_content_size`，但 `authorNotes` 漏掉了。虽然实际使用中 authorNotes 不太可能超大，但作为防御性编程应一并校验。

**建议**：添加 `security::validate_content_size(&authorNotes)?;`

---

### 3.2 [中] `list_all_tags` 遍历所有项目的所有文档

**文件**：`/Users/jdh/Code/AiDocPlus/apps/desktop/src-tauri/src/commands/document.rs:577-626`

当 `projectId` 为 `None` 时，会遍历所有项目的所有文档 JSON 文件，每次都做完整的 `Document::load`（解析整个 JSON）。对于文档数量多的用户，这是一个性能隐患。

**建议**：考虑使用 SQLite 存储标签信息，或至少只解析 metadata 部分。

---

### 3.3 [低] `rename_document` 检查重名是全文件遍历

**文件**：`/Users/jdh/Code/AiDocPlus/apps/desktop/src-tauri/src/commands/document.rs:181-197`

遍历 `documents/` 目录下所有 JSON 文件并做 `Document::load` 来检查标题重名，O(n) 全量加载。

**建议**：如果文档数量增长，可考虑轻量级索引或仅读取 title 字段。

---

### 3.4 [低] `update_document_tags` 的 `HashSet` 转 `Vec` 顺序不确定

**文件**：`/Users/jdh/Code/AiDocPlus/apps/desktop/src-tauri/src/commands/document.rs:560-566`

```rust
let clean_tags: Vec<String> = tags
    .into_iter()
    .map(|t| t.trim().to_string())
    .filter(|t| !t.is_empty())
    .collect::<std::collections::HashSet<_>>()
    .into_iter()
    .collect();
```

`HashSet::into_iter()` 输出顺序不确定，用户传入的标签顺序会丢失。

**建议**：如果需要保序去重，可改用 `IndexSet` 或手动保序去重。

---

## 四、性能问题

### 4.1 [中] 前端 `loadProjects` 并行加载所有项目文档

**文件**：`/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/stores/useAppStore.ts:310-325`

```typescript
const results = await Promise.all(
  projects.map(async (p) => {
    return await invoke<Document[]>('list_documents', { projectId: p.id });
  })
);
const allDocs = results.flat();
```

启动时一次性加载**所有项目的所有文档元数据**。当项目数量多时（如 50+ 项目各含数十文档），启动加载可能较慢。

**建议**：考虑按需加载（仅加载当前项目 + 已打开标签页涉及的项目）。

---

### 4.2 [低] `restoreWorkspace` 中直接修改 `allDocuments` 数组

**文件**：`/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/stores/useAppStore.ts:1733-1734`

```typescript
const idx = allDocuments.findIndex(d => d.id === freshDoc.id);
if (idx >= 0) allDocuments[idx] = freshDoc;  // ⚠️ 直接修改引用
```

`allDocuments` 来自 `get().documents`，直接修改会绕过 Zustand 的不可变性约定。虽然稍后通过 `set({ documents: [...allDocuments] })` 产生了新引用，但中间状态不一致。

**建议**：使用 `.map()` 创建新数组。

---

### 4.3 [低] 前端 `closeOtherTabs` 串行保存文档

**文件**：`/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/stores/useAppStore.ts:1968-1973`

```typescript
for (const tab of otherTabs) {
  if (tab.isDirty) {
    const doc = documents.find(d => d.id === tab.documentId);
    if (doc) await saveDocument(doc);
  }
}
```

多个 dirty 文档串行保存。可用 `Promise.all` 并行保存提升速度。`closeAllTabs` 同理。

---

## 五、可维护性 / 代码风格

### 5.1 [中] 路径校验存在三套并行实现

当前有三套路径校验机制：
1. `security::validate_path_allowed` — 集中式，校验 home/temp/data_root
2. `file_system.rs::validate_path_in_allowed_dir` + `get_allowed_directories` — 模块内私有
3. `export.rs` 内手动 canonicalize — 内联式

**建议**：统一使用 `security::validate_path_allowed`，移除 `file_system.rs` 中的重复实现。`file_system.rs` 的 `get_allowed_directories` + `validate_path_in_allowed_dir` 功能与 `security::validate_path_allowed` 完全等价。

---

### 5.2 [中] 错误消息中英文混杂

- `file_system.rs` 中：`"File not found: {}"` (get_file_metadata:266)、`"Failed to read metadata"` (get_file_metadata:268)
- 同文件其他命令使用中文：`"文件不存在: {}"`、`"获取文件信息失败"`

**建议**：统一为中文错误消息（与项目其余部分一致）。

---

### 5.3 [低] `useAppStore.ts` 文件过大 (2152 行)

该文件包含项目管理、文档管理、AI 流式、标签页、工作区持久化、插件、文档模板等所有逻辑。

**建议**：已有 helper 文件拆分的良好实践（如 `useAppStore.document.helpers.ts`）。可进一步考虑将 AI 流式逻辑和标签页逻辑拆分为独立的 slice。

---

### 5.4 [低] `createDocumentFromDocTemplate` 错误格式不一致

**文件**：`/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/stores/useAppStore.ts:1361`

```typescript
set({ isLoading: false, error: String(error) });
```

其他地方使用 `formatBackendError(error)`，此处使用 `String(error)`，会丢失结构化错误信息。

**建议**：统一使用 `formatBackendError(error)`。

---

### 5.5 [低] `category` 相关方法的错误处理不一致

**文件**：`/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/stores/useAppStore.ts:1446, 1459, 1470, 1482`

```typescript
set({ error: error instanceof Error ? error.message : String(error) });
```

与其他方法的 `formatBackendError(error)` 不一致。

---

## 六、已做的改动

在本次审查过程中，已完成以下改动（经 `cargo check` 验证通过）：

### ✅ `write_binary_file` 重构

**文件**：`/Users/jdh/Code/AiDocPlus/apps/desktop/src-tauri/src/commands/document.rs:477-498`

- 移除了手动构建的 `allowed_dirs` 列表（37 行 → 17 行）
- 改用集中的 `security::validate_path_allowed` 函数
- 安全性等价：`validate_path_allowed` 已覆盖 home（含 Desktop/Downloads 等子目录）、temp_dir、data_root

---

## 七、建议修复优先级

| 优先级 | 问题 | 影响 |
|--------|------|------|
| **P0** | 2.1 `get_file_metadata` 缺路径校验 | 任意路径信息泄露 |
| **P0** | 2.2 `get_document_file_path` 无 ID 校验 + 硬编码 | 路径注入风险 |
| **P1** | 2.4 `export_document_native` 路径校验不统一 | 安全逻辑碎片化 |
| **P1** | 5.1 三套路径校验统一 | 维护负担 |
| **P2** | 2.3 `show_in_folder` 缺路径校验 | 低风险信息泄露 |
| **P2** | 3.1 `authorNotes` 缺大小校验 | 防御性不足 |
| **P2** | 4.1 启动时全量加载 | 大项目启动慢 |
| **P3** | 3.2/3.3 标签/重名全文件遍历 | 大项目性能 |
| **P3** | 4.2 直接修改数组引用 | Zustand 不变性违规 |
| **P3** | 5.2-5.5 代码风格不一致 | 可维护性 |
