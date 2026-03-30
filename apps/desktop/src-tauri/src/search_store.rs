use rusqlite::params;
use crate::database::Database;
use crate::error::{Result, ResultExt};

/// 更新文档的搜索索引（创建/修改文档时调用）
pub fn upsert_document_index(
    db: &Database,
    document_id: &str,
    project_id: &str,
    title: &str,
    content: &str,
    author_notes: &str,
) -> Result<()> {
    let conn = db.search();

    // 先尝试删除旧记录再插入，FTS5 不支持 upsert
    conn.execute(
        "DELETE FROM search_index WHERE document_id = ?1",
        params![document_id],
    ).context("删除旧索引失败")?;

    conn.execute(
        "INSERT INTO search_index (document_id, project_id, title, content, author_notes)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![document_id, project_id, title, content, author_notes],
    ).context("更新搜索索引失败")?;

    Ok(())
}

/// 删除文档的搜索索引
pub fn remove_document_index(db: &Database, document_id: &str) -> Result<()> {
    let conn = db.search();
    conn.execute(
        "DELETE FROM search_index WHERE document_id = ?1",
        params![document_id],
    ).context("删除搜索索引失败")?;

    Ok(())
}

/// 按项目 ID 删除所有搜索索引（删除项目时调用）
pub fn remove_project_index(db: &Database, project_id: &str) -> Result<()> {
    let conn = db.search();
    conn.execute(
        "DELETE FROM search_index WHERE project_id = ?1",
        params![project_id],
    ).context("删除项目搜索索引失败")?;

    Ok(())
}

/// FTS5 全文搜索结果
#[allow(dead_code)]
pub struct FtsSearchResult {
    pub document_id: String,
    pub project_id: String,
    pub title: String,
    pub snippet: String,
    pub rank: f64,
}

/// 使用 FTS5 进行全文搜索
pub fn fts_search(
    db: &Database,
    project_id: &str,
    query: &str,
    limit: usize,
) -> Result<Vec<FtsSearchResult>> {
    let conn = db.search();

    // 转义 FTS5 特殊字符，简单搜索时用引号包裹
    let fts_query = format!("\"{}\"", query.replace('"', "\"\""));

    let mut stmt = conn.prepare(
        "SELECT document_id, project_id, title,
                snippet(search_index, 3, '<mark>', '</mark>', '...', 32) as snippet,
                rank
         FROM search_index
         WHERE search_index MATCH ?1 AND project_id = ?2
         ORDER BY rank
         LIMIT ?3"
    ).context("准备 FTS 查询失败")?;

    let results = stmt.query_map(
        params![fts_query, project_id, limit as i64],
        |row| {
            Ok(FtsSearchResult {
                document_id: row.get(0)?,
                project_id: row.get(1)?,
                title: row.get(2)?,
                snippet: row.get(3)?,
                rank: row.get(4)?,
            })
        },
    ).context("FTS 查询失败")?
    .filter_map(|r| r.ok())
    .collect();

    Ok(results)
}

/// 检查搜索索引是否为空（用于判断是否需要重建索引）
pub fn is_empty(db: &Database) -> Result<bool> {
    let conn = db.search();
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM search_index",
        [],
        |row| row.get(0),
    ).context("查询索引数失败")?;

    Ok(count == 0)
}

/// 重建全部搜索索引（从文档 JSON 文件遍历构建）
pub fn rebuild_index(db: &Database, projects_dir: &std::path::Path) -> Result<usize> {
    let conn = db.search();

    // 清空旧索引
    conn.execute("DELETE FROM search_index", [])
        .context("清空索引失败")?;

    if !projects_dir.exists() {
        return Ok(0);
    }

    let mut count = 0usize;
    let project_entries = std::fs::read_dir(projects_dir)
        .context("读取项目目录失败")?;

    for entry in project_entries.flatten() {
        let path = entry.path();
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

            let doc = match crate::document::Document::load(&doc_path) {
                Ok(d) => d,
                Err(_) => continue,
            };

            let _ = conn.execute(
                "INSERT INTO search_index (document_id, project_id, title, content, author_notes)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![doc.id, project_id, doc.title, doc.content, doc.author_notes],
            );
            count += 1;
        }
    }

    Ok(count)
}
