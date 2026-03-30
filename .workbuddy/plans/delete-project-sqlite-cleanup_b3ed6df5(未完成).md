---
name: delete-project-sqlite-cleanup
overview: 在 delete_project 命令中补全 SQLite 残留数据清理：搜索索引、版本历史、AI 对话记录（含消息）。
todos:
  - id: add-search-store-fn
    content: 在 search_store.rs 新增 remove_project_index 函数
    status: pending
  - id: add-conv-store-fn
    content: 在 conversation_store.rs 新增 delete_conversations_by_document_ids 函数
    status: pending
  - id: update-delete-project
    content: 修改 project.rs delete_project 增加三项 SQLite 数据清理
    status: pending
    dependencies:
      - add-search-store-fn
      - add-conv-store-fn
---

## 核心需求

修复删除项目时 SQLite 数据残留问题。当前 `delete_project` 只删除了项目元数据文件和项目目录（含文档 JSON），但未清理 SQLite 中的关联数据，导致搜索索引、版本历史、AI 对话记录残留。

## 需清理的 SQLite 数据

1. **search_index**：全文搜索索引，`project_id` 字段直接关联项目
2. **versions**：版本历史记录，`project_id` 字段直接关联项目
3. **conversations + messages**：AI 对话记录，通过 `document_id` 间接关联文档；messages 表有 `ON DELETE CASCADE` 外键

## 技术方案

### 修改策略

在 `delete_project` 函数中，文件删除之前先清理 SQLite 数据（保证即使文件删除失败，数据已清理；反之亦然，后续重启时索引会自愈）。

### 实现步骤

**1. search_store.rs — 新增按项目删除搜索索引函数**

```rust
pub fn remove_project_index(db: &Database, project_id: &str) -> Result<()>
```

SQL: `DELETE FROM search_index WHERE project_id = ?1`

**2. conversation_store.rs — 新增按文档ID列表删除对话函数**

```rust
pub fn delete_conversations_by_document_ids(db: &Database, document_ids: &[String]) -> Result<()>
```

SQL: `DELETE FROM conversations WHERE document_id IN (...)`（messages 由 CASCADE 自动删除）

**3. project.rs — delete_project 增加清理逻辑**

- 在删除文件之前，先列出项目目录下所有文档 JSON 的文件名（去掉 `.json` 后缀即为 document_id）
- 依次调用：`remove_project_index` → `DELETE FROM versions` → `delete_conversations_by_document_ids`
- 文件系统的 `remove_dir_all` 已是递归删除，无需改动
- 使用 `let _ =` 忽略 SQLite 清理错误，不阻塞文件删除（残留数据影响有限，重启时搜索索引会自愈）

### 关键约束

- `state.db` 是 `pub` 字段，可直接访问 `Database` 实例
- conversations 表没有 `project_id` 字段，需通过文档 ID 间接关联
- 文档 JSON 文件名格式为 `{uuid}.json`，去掉后缀即为 document_id