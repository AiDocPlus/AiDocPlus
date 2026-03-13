use rusqlite::params;
use crate::database::Database;
use crate::document::DocumentVersion;
use crate::error::{AppError, Result, ResultExt};

/// 版本数量限制，防止存储耗尽
const MAX_VERSIONS: usize = 1000;

/// 插入一个新版本到 SQLite
pub fn insert_version(db: &Database, project_id: &str, version: &DocumentVersion) -> Result<()> {
    let conn = db.versions();
    conn.execute(
        "INSERT INTO versions (id, document_id, project_id, content, author_notes, ai_generated_content, created_at, created_by, change_description, plugin_data, enabled_plugins, composed_content)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            version.id,
            version.document_id,
            project_id,
            version.content,
            version.author_notes,
            version.ai_generated_content,
            version.created_at,
            version.created_by,
            version.change_description,
            version.plugin_data.as_ref().map(|v| serde_json::to_string(v).unwrap_or_default()),
            version.enabled_plugins.as_ref().map(|v| serde_json::to_string(v).unwrap_or_default()),
            version.composed_content,
        ],
    ).context("插入版本失败")?;

    // 版本数量限制：删除最旧的超限版本
    enforce_max_versions(&conn, &version.document_id)?;

    Ok(())
}

/// 列出某文档的所有版本（按时间正序）
pub fn list_versions(db: &Database, document_id: &str) -> Result<Vec<DocumentVersion>> {
    let conn = db.versions();
    let mut stmt = conn.prepare(
        "SELECT id, document_id, content, author_notes, ai_generated_content, created_at, created_by, change_description, plugin_data, enabled_plugins, composed_content
         FROM versions WHERE document_id = ?1 ORDER BY created_at ASC"
    ).context("查询版本失败")?;

    let versions = stmt.query_map(params![document_id], |row| {
        Ok(row_to_version(row))
    }).context("查询版本失败")?
    .filter_map(|r| r.ok())
    .collect();

    Ok(versions)
}

/// 获取单个版本
pub fn get_version(db: &Database, document_id: &str, version_id: &str) -> Result<DocumentVersion> {
    let conn = db.versions();
    conn.query_row(
        "SELECT id, document_id, content, author_notes, ai_generated_content, created_at, created_by, change_description, plugin_data, enabled_plugins, composed_content
         FROM versions WHERE document_id = ?1 AND id = ?2",
        params![document_id, version_id],
        |row| Ok(row_to_version(row)),
    ).map_err(|_| AppError::VersionNotFound(format!("版本未找到: {}", version_id)))
}

/// 删除单个版本
pub fn delete_version(db: &Database, document_id: &str, version_id: &str) -> Result<bool> {
    let conn = db.versions();
    let affected = conn.execute(
        "DELETE FROM versions WHERE document_id = ?1 AND id = ?2",
        params![document_id, version_id],
    ).context("删除版本失败")?;

    Ok(affected > 0)
}

/// 统计某文档的版本数量
#[allow(dead_code)]
pub fn count_versions(db: &Database, document_id: &str) -> Result<usize> {
    let conn = db.versions();
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM versions WHERE document_id = ?1",
        params![document_id],
        |row| row.get(0),
    ).context("统计版本失败")?;

    Ok(count as usize)
}

/// 删除某文档的全部版本（文档被删除时调用）
pub fn delete_all_versions(db: &Database, document_id: &str) -> Result<()> {
    let conn = db.versions();
    conn.execute(
        "DELETE FROM versions WHERE document_id = ?1",
        params![document_id],
    ).context("删除文档版本失败")?;

    Ok(())
}

/// 批量插入版本（用于迁移）
pub fn bulk_insert_versions(db: &Database, project_id: &str, versions: &[DocumentVersion]) -> Result<usize> {
    let conn = db.versions();
    let mut count = 0usize;

    // 使用事务提高批量插入性能
    conn.execute_batch("BEGIN TRANSACTION")
        .context("开启事务失败")?;

    for v in versions {
        let result = conn.execute(
            "INSERT OR IGNORE INTO versions (id, document_id, project_id, content, author_notes, ai_generated_content, created_at, created_by, change_description, plugin_data, enabled_plugins, composed_content)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                v.id,
                v.document_id,
                project_id,
                v.content,
                v.author_notes,
                v.ai_generated_content,
                v.created_at,
                v.created_by,
                v.change_description,
                v.plugin_data.as_ref().map(|val| serde_json::to_string(val).unwrap_or_default()),
                v.enabled_plugins.as_ref().map(|val| serde_json::to_string(val).unwrap_or_default()),
                v.composed_content,
            ],
        );

        if result.is_ok() {
            count += 1;
        }
    }

    conn.execute_batch("COMMIT")
        .context("提交事务失败")?;

    Ok(count)
}

/// 检查 versions 表是否为空（用于判断是否需要迁移）
pub fn is_empty(db: &Database) -> Result<bool> {
    let conn = db.versions();
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM versions",
        [],
        |row| row.get(0),
    ).context("查询版本数失败")?;

    Ok(count == 0)
}

// ── 内部辅助函数 ──

fn row_to_version(row: &rusqlite::Row) -> DocumentVersion {
    let plugin_data_str: Option<String> = row.get(8).unwrap_or(None);
    let enabled_plugins_str: Option<String> = row.get(9).unwrap_or(None);

    DocumentVersion {
        id: row.get(0).unwrap_or_default(),
        document_id: row.get(1).unwrap_or_default(),
        content: row.get(2).unwrap_or_default(),
        author_notes: row.get(3).unwrap_or_default(),
        ai_generated_content: row.get(4).unwrap_or_default(),
        created_at: row.get(5).unwrap_or(0),
        created_by: row.get(6).unwrap_or_default(),
        change_description: row.get(7).unwrap_or(None),
        plugin_data: plugin_data_str.and_then(|s| serde_json::from_str(&s).ok()),
        enabled_plugins: enabled_plugins_str.and_then(|s| serde_json::from_str(&s).ok()),
        composed_content: row.get(10).unwrap_or(None),
    }
}

fn enforce_max_versions(conn: &rusqlite::Connection, document_id: &str) -> Result<()> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM versions WHERE document_id = ?1",
        params![document_id],
        |row| row.get(0),
    ).context("统计版本失败")?;

    if count as usize > MAX_VERSIONS {
        let excess = count as usize - MAX_VERSIONS;
        conn.execute(
            "DELETE FROM versions WHERE id IN (
                SELECT id FROM versions WHERE document_id = ?1
                ORDER BY created_at ASC LIMIT ?2
            )",
            params![document_id, excess],
        ).context("清理超限版本失败")?;
    }

    Ok(())
}
