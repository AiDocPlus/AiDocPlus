# §14 SQLite 精准引入实施计划

> **状态：✅ 全部三个阶段已完成实现**（Phase 1 + Phase 2 + Phase 3）

## 核心原则

1. **前端接口不变**：Tauri Command 的参数和返回值类型保持不变，SQLite 是纯后端实现细节
2. **向后兼容**：首次启动自动迁移旧数据到 SQLite，迁移后旧数据保留备份
3. **插件不受影响**：插件仍通过 JSON 读写 pluginData/storage
4. **三个独立 DB 文件**：`~/AiDocPlus/versions.db`、`~/AiDocPlus/conversations.db`、`~/AiDocPlus/search.db`

## Phase 1: versions.db（版本历史）✅

### 新增依赖
- `rusqlite = { version = "0.33", features = ["bundled"] }` — bundled 模式自带 SQLite

### 新增文件
- `src/database.rs` — SQLite 连接管理器，持有三个 DB 的 `Mutex<Connection>`
- `src/version_store.rs` — 版本 CRUD 操作（insert / list / get / delete / bulk_insert / count / is_empty）

### 表结构
```sql
-- versions.db
CREATE TABLE IF NOT EXISTS versions (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    author_notes TEXT NOT NULL DEFAULT '',
    ai_generated_content TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    created_by TEXT NOT NULL DEFAULT 'user',
    change_description TEXT,
    plugin_data TEXT,          -- JSON 字符串
    enabled_plugins TEXT,      -- JSON 字符串
    composed_content TEXT
);
CREATE INDEX IF NOT EXISTS idx_versions_document ON versions(document_id);
CREATE INDEX IF NOT EXISTS idx_versions_created ON versions(document_id, created_at);
```

### 修改文件
- `src/document.rs` — `versions` 字段: `#[serde(default, skip_serializing)]`，反序列化可读旧数据用于迁移，序列化不再写入
- `src/commands/document.rs` — 6 个版本命令全部改为调用 `version_store`
- `src/config.rs` — `AppState` 增加 `db: Database` 字段，初始化时调用迁移
- `src/main.rs` — 注册 `database` / `version_store` 模块

### 迁移策略
- `AppState::new()` → `Database::init()` → `migrate_versions_from_json()`
- 检查 `versions` 表是否为空，为空则遍历所有项目文档 JSON 导入
- 导入后回写 JSON（`skip_serializing` 自动去除 versions 数组）
- 迁移失败不阻塞启动

## Phase 2: conversations.db（对话记录）✅

### 新增文件
- `src/conversation_store.rs` — 对话 CRUD（create / get / get_all / add_message / update_last_message / rename / pin / delete / bulk_import / is_empty）
- `src/commands/conversation.rs` — 7 个 Tauri 命令

### 表结构
```sql
-- conversations.db
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    created_at REAL NOT NULL,
    updated_at REAL NOT NULL,
    is_pinned INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_conv_document ON conversations(document_id);
CREATE INDEX IF NOT EXISTS idx_conv_updated ON conversations(updated_at);

CREATE TABLE IF NOT EXISTS messages (
    rowid INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    timestamp REAL,
    context_mode TEXT,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id, timestamp);
```

### Tauri 命令
| 命令 | 说明 |
|------|------|
| `load_all_conversations` | 加载所有对话（含消息），前端初始化时调用 |
| `db_create_conversation` | 创建对话 |
| `db_add_message` | 添加消息 |
| `db_update_last_message` | 更新最后一条消息（流式回复） |
| `db_rename_conversation` | 重命名对话 |
| `db_pin_conversation` | 切换置顶 |
| `db_delete_conversation` | 删除对话（CASCADE 删除消息） |

### 前端适配
- `useConversationsStore.ts`：移除 `zustand/persist` 和 `tauriConversationsStorage`，改为纯内存 zustand + 异步 SQLite 持久化
- 新增 `loadConversationsFromDB()` 函数，在 `App.tsx` 启动时并行加载
- 保留旧的 `save_conversations`/`load_conversations` 命令用于回退

### 迁移策略
- `migrate_conversations_from_json()` 解析 zustand persist 格式 `{ state: { conversations: [...] } }`
- 使用 `bulk_import_conversations()` 批量导入
- 迁移成功后将 `conversations.json` 重命名为 `conversations.json.migrated`

## Phase 3: search.db（全文搜索索引 FTS5）✅

### 新增文件
- `src/search_store.rs` — FTS5 搜索操作（upsert_document_index / remove_document_index / fts_search / rebuild_index / is_empty）

### 表结构
```sql
-- search.db
CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
    document_id,
    project_id,
    title,
    content,
    author_notes,
    tokenize='unicode61'
);
```

### 索引维护
- `create_document` → 自动创建索引
- `save_document` → 自动更新索引（先删后插）
- `delete_document` → 自动删除索引
- 首次启动时如果索引为空，自动 `rebuild_index()` 遍历所有文档构建

### 搜索集成
- `search_documents` 命令新增 FTS5 快速路径：简单文本搜索（非正则、非全词、非大小写敏感）优先走 FTS5
- FTS5 无结果或失败时自动回退到原有文件遍历逻辑
- FTS5 snippet 函数提供上下文高亮片段

## 验证标准

1. ✅ `cargo build` 零编译错误
2. ✅ `tsc --noEmit` 零类型错误
3. 新建文档 → 创建版本 → 查看版本历史 → 恢复版本 功能正常
4. 对话功能正常（创建/发送消息/删除/置顶/重命名）
5. 搜索功能正常（FTS5 快速路径 + 回退到文件遍历）
6. 旧数据自动迁移成功（versions JSON → SQLite, conversations.json → SQLite）

## 文件清单

### 新增文件（Rust 后端）
| 文件 | 说明 |
|------|------|
| `src/database.rs` | SQLite 连接管理器（3 个 DB） |
| `src/version_store.rs` | 版本历史 CRUD |
| `src/conversation_store.rs` | 对话记录 CRUD |
| `src/search_store.rs` | FTS5 搜索索引 |
| `src/commands/conversation.rs` | 对话 Tauri 命令 |

### 修改文件（Rust 后端）
| 文件 | 说明 |
|------|------|
| `Cargo.toml` | 添加 `rusqlite` 依赖 |
| `src/main.rs` | 注册模块 + 命令 |
| `src/config.rs` | AppState 持有 Database + 迁移调用 |
| `src/document.rs` | versions 字段 skip_serializing |
| `src/commands/document.rs` | 版本命令 → version_store + 搜索索引维护 |
| `src/commands/search.rs` | FTS5 快速路径 |
| `src/commands/mod.rs` | 注册 conversation 模块 |

### 修改文件（前端）
| 文件 | 说明 |
|------|------|
| `src-ui/src/stores/useConversationsStore.ts` | 移除 persist，改用 SQLite 命令 |
| `src-ui/src/App.tsx` | 启动时并行加载对话数据 |
