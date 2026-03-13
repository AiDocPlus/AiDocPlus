use std::path::PathBuf;
use std::sync::Mutex;
use rusqlite::Connection;
use crate::error::{Result, ResultExt};

/// SQLite 数据库管理器
/// 管理 versions.db / conversations.db / search.db 的连接
pub struct Database {
    versions_conn: Mutex<Connection>,
    conversations_conn: Mutex<Connection>,
    search_conn: Mutex<Connection>,
}

/// 设置通用 PRAGMA（WAL 模式、外键等）
fn setup_pragmas(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA synchronous=NORMAL;
         PRAGMA foreign_keys=ON;
         PRAGMA busy_timeout=5000;"
    ).context("设置 PRAGMA 失败")?;
    Ok(())
}

impl Database {
    /// 初始化数据库，在指定数据根目录下创建 .db 文件
    pub fn init(data_root: &PathBuf) -> Result<Self> {
        // ── versions.db ──
        let versions_path = data_root.join("versions.db");
        let versions_conn = Connection::open(&versions_path)
            .context("打开 versions.db 失败")?;
        setup_pragmas(&versions_conn)?;

        versions_conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS versions (
                id TEXT PRIMARY KEY,
                document_id TEXT NOT NULL,
                project_id TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                author_notes TEXT NOT NULL DEFAULT '',
                ai_generated_content TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL,
                created_by TEXT NOT NULL DEFAULT 'user',
                change_description TEXT,
                plugin_data TEXT,
                enabled_plugins TEXT,
                composed_content TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_versions_document ON versions(document_id);
            CREATE INDEX IF NOT EXISTS idx_versions_created ON versions(document_id, created_at);"
        ).context("创建 versions 表失败")?;

        eprintln!("[database] versions.db 已初始化: {}", versions_path.display());

        // ── conversations.db ──
        let conversations_path = data_root.join("conversations.db");
        let conversations_conn = Connection::open(&conversations_path)
            .context("打开 conversations.db 失败")?;
        setup_pragmas(&conversations_conn)?;

        conversations_conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS conversations (
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
            CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id, timestamp);"
        ).context("创建 conversations 表失败")?;

        eprintln!("[database] conversations.db 已初始化: {}", conversations_path.display());

        // ── search.db ──
        let search_path = data_root.join("search.db");
        let search_conn = Connection::open(&search_path)
            .context("打开 search.db 失败")?;
        setup_pragmas(&search_conn)?;

        // FTS5 虚拟表：全文搜索索引
        search_conn.execute_batch(
            "CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
                document_id,
                project_id,
                title,
                content,
                author_notes,
                tokenize='unicode61'
            );"
        ).context("创建 search_index FTS5 表失败")?;

        eprintln!("[database] search.db 已初始化: {}", search_path.display());

        Ok(Self {
            versions_conn: Mutex::new(versions_conn),
            conversations_conn: Mutex::new(conversations_conn),
            search_conn: Mutex::new(search_conn),
        })
    }

    /// 获取 versions 数据库连接（加锁）
    pub fn versions(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.versions_conn.lock().unwrap()
    }

    /// 获取 conversations 数据库连接（加锁）
    pub fn conversations(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.conversations_conn.lock().unwrap()
    }

    /// 获取 search 数据库连接（加锁）
    pub fn search(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.search_conn.lock().unwrap()
    }

    /// 从文档 JSON 文件迁移版本数据到 SQLite
    /// 在应用启动时调用，仅在 SQLite 为空时执行
    pub fn migrate_versions_from_json(&self, projects_dir: &std::path::Path) -> Result<()> {
        use crate::version_store;

        // 如果 SQLite 已有数据，跳过迁移
        if !version_store::is_empty(self)? {
            return Ok(());
        }

        if !projects_dir.exists() {
            return Ok(());
        }

        eprintln!("[database] 开始从 JSON 迁移版本数据到 SQLite...");
        let mut total_versions = 0usize;
        let mut total_docs = 0usize;

        // 遍历所有项目目录
        let project_entries = std::fs::read_dir(projects_dir)
            .context("读取项目目录失败")?;

        for entry in project_entries.flatten() {
            let path = entry.path();
            // 跳过非目录（项目 JSON 文件）
            if !path.is_dir() { continue; }

            let project_id = path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();

            if project_id.is_empty() { continue; }

            let docs_dir = path.join("documents");
            if !docs_dir.exists() { continue; }

            let doc_entries = match std::fs::read_dir(&docs_dir) {
                Ok(e) => e,
                Err(_) => continue,
            };

            for doc_entry in doc_entries.flatten() {
                let doc_path = doc_entry.path();
                if doc_path.extension().and_then(|s| s.to_str()) != Some("json") {
                    continue;
                }

                // 加载文档（会反序列化 versions 字段）
                let doc = match crate::document::Document::load(&doc_path) {
                    Ok(d) => d,
                    Err(e) => {
                        eprintln!("[database] 跳过文档 {}: {}", doc_path.display(), e);
                        continue;
                    }
                };

                if doc.versions.is_empty() { continue; }

                let version_count = doc.versions.len();

                // 批量插入到 SQLite
                match version_store::bulk_insert_versions(self, &project_id, &doc.versions) {
                    Ok(n) => {
                        total_versions += n;
                        total_docs += 1;
                    }
                    Err(e) => {
                        eprintln!("[database] 迁移文档 {} 版本失败: {}", doc.id, e);
                        continue;
                    }
                }

                // 回写文档 JSON（此时 versions 已被 skip_serializing，不会写入）
                if let Err(e) = doc.save(&doc_path) {
                    eprintln!("[database] 回写文档 {} 失败: {}", doc.id, e);
                } else {
                    eprintln!("[database]   迁移文档 {} ({} 个版本)", doc.id, version_count);
                }
            }
        }

        eprintln!("[database] 版本迁移完成: {} 个文档, {} 个版本", total_docs, total_versions);
        Ok(())
    }

    /// 从 conversations.json 迁移对话数据到 SQLite
    pub fn migrate_conversations_from_json(&self, data_root: &std::path::Path) -> Result<()> {
        use crate::conversation_store;

        if !conversation_store::is_empty(self)? {
            return Ok(());
        }

        let json_path = data_root.join("conversations.json");
        if !json_path.exists() {
            return Ok(());
        }

        eprintln!("[database] 开始从 conversations.json 迁移对话数据...");

        let json_str = std::fs::read_to_string(&json_path)
            .context("读取 conversations.json 失败")?;

        // zustand persist 格式: { "state": { "conversations": [...], "currentConversationId": "..." }, "version": 0 }
        let parsed: serde_json::Value = serde_json::from_str(&json_str)
            .context("解析 conversations.json 失败")?;

        let convs_value = parsed
            .get("state")
            .and_then(|s| s.get("conversations"))
            .cloned()
            .unwrap_or(serde_json::Value::Array(vec![]));

        let full_convs: Vec<conversation_store::FullConversation> =
            serde_json::from_value(convs_value).unwrap_or_default();

        if full_convs.is_empty() {
            eprintln!("[database] conversations.json 为空，跳过迁移");
            return Ok(());
        }

        match conversation_store::bulk_import_conversations(self, &full_convs) {
            Ok(n) => {
                eprintln!("[database] 对话迁移完成: {} 个对话", n);
            }
            Err(e) => {
                eprintln!("[database] 对话迁移失败: {}", e);
                return Err(e);
            }
        }

        // 迁移成功后重命名旧文件（保留备份）
        let backup_path = data_root.join("conversations.json.migrated");
        if let Err(e) = std::fs::rename(&json_path, &backup_path) {
            eprintln!("[database] 重命名 conversations.json 失败: {}", e);
        }

        Ok(())
    }
}
