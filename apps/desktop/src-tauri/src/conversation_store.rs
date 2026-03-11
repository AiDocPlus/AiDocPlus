use rusqlite::params;
use serde::{Deserialize, Serialize};
use crate::database::Database;
use crate::error::{AppError, Result};

/// 对话记录（不含消息）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationRecord {
    pub id: String,
    #[serde(rename = "documentId")]
    pub document_id: String,
    pub title: String,
    #[serde(rename = "createdAt")]
    pub created_at: f64,
    #[serde(rename = "updatedAt")]
    pub updated_at: f64,
    #[serde(rename = "isPinned")]
    pub is_pinned: bool,
}

/// 消息记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageRecord {
    pub role: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "contextMode")]
    pub context_mode: Option<String>,
}

/// 完整对话（含消息），与前端 Conversation 类型对齐
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FullConversation {
    pub id: String,
    #[serde(rename = "documentId")]
    pub document_id: String,
    pub title: String,
    pub messages: Vec<MessageRecord>,
    #[serde(rename = "createdAt")]
    pub created_at: f64,
    #[serde(rename = "updatedAt")]
    pub updated_at: f64,
    #[serde(rename = "isPinned")]
    pub is_pinned: bool,
}

/// 列出所有对话（不含消息）
pub fn list_conversations(db: &Database) -> Result<Vec<ConversationRecord>> {
    let conn = db.conversations();
    let mut stmt = conn.prepare(
        "SELECT id, document_id, title, created_at, updated_at, is_pinned
         FROM conversations ORDER BY is_pinned DESC, updated_at DESC"
    ).map_err(|e| AppError::Internal(format!("查询对话列表失败: {}", e)))?;

    let records = stmt.query_map([], |row| {
        Ok(ConversationRecord {
            id: row.get(0)?,
            document_id: row.get(1)?,
            title: row.get(2)?,
            created_at: row.get(3)?,
            updated_at: row.get(4)?,
            is_pinned: row.get::<_, i32>(5)? != 0,
        })
    }).map_err(|e| AppError::Internal(format!("查询对话列表失败: {}", e)))?
    .filter_map(|r| r.ok())
    .collect();

    Ok(records)
}

/// 获取完整对话（含消息）
pub fn get_conversation(db: &Database, conversation_id: &str) -> Result<FullConversation> {
    let conn = db.conversations();

    let conv = conn.query_row(
        "SELECT id, document_id, title, created_at, updated_at, is_pinned
         FROM conversations WHERE id = ?1",
        params![conversation_id],
        |row| {
            Ok(ConversationRecord {
                id: row.get(0)?,
                document_id: row.get(1)?,
                title: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
                is_pinned: row.get::<_, i32>(5)? != 0,
            })
        },
    ).map_err(|_| AppError::Internal(format!("对话未找到: {}", conversation_id)))?;

    let messages = get_messages(&conn, conversation_id)?;

    Ok(FullConversation {
        id: conv.id,
        document_id: conv.document_id,
        title: conv.title,
        messages,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        is_pinned: conv.is_pinned,
    })
}

/// 获取所有对话（含消息）- 用于前端初始化加载
pub fn get_all_conversations(db: &Database) -> Result<Vec<FullConversation>> {
    let convs = list_conversations(db)?;
    let conn = db.conversations();
    let mut result = Vec::with_capacity(convs.len());

    for conv in convs {
        let messages = get_messages(&conn, &conv.id)?;
        result.push(FullConversation {
            id: conv.id,
            document_id: conv.document_id,
            title: conv.title,
            messages,
            created_at: conv.created_at,
            updated_at: conv.updated_at,
            is_pinned: conv.is_pinned,
        });
    }

    Ok(result)
}

/// 创建对话
pub fn create_conversation(db: &Database, id: &str, document_id: &str, title: &str, created_at: f64) -> Result<()> {
    let conn = db.conversations();
    conn.execute(
        "INSERT INTO conversations (id, document_id, title, created_at, updated_at, is_pinned)
         VALUES (?1, ?2, ?3, ?4, ?4, 0)",
        params![id, document_id, title, created_at],
    ).map_err(|e| AppError::Internal(format!("创建对话失败: {}", e)))?;

    Ok(())
}

/// 添加消息
pub fn add_message(db: &Database, conversation_id: &str, msg: &MessageRecord) -> Result<()> {
    let conn = db.conversations();
    let now = msg.timestamp.unwrap_or_else(|| chrono::Utc::now().timestamp() as f64);

    conn.execute(
        "INSERT INTO messages (conversation_id, role, content, timestamp, context_mode)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            conversation_id,
            msg.role,
            msg.content,
            now,
            msg.context_mode,
        ],
    ).map_err(|e| AppError::Internal(format!("添加消息失败: {}", e)))?;

    // 更新对话的 updatedAt
    conn.execute(
        "UPDATE conversations SET updated_at = ?1 WHERE id = ?2",
        params![now, conversation_id],
    ).map_err(|e| AppError::Internal(format!("更新对话时间失败: {}", e)))?;

    Ok(())
}

/// 更新对话标题
pub fn rename_conversation(db: &Database, conversation_id: &str, title: &str) -> Result<()> {
    let conn = db.conversations();
    conn.execute(
        "UPDATE conversations SET title = ?1 WHERE id = ?2",
        params![title, conversation_id],
    ).map_err(|e| AppError::Internal(format!("重命名对话失败: {}", e)))?;

    Ok(())
}

/// 切换置顶
pub fn pin_conversation(db: &Database, conversation_id: &str, pinned: bool) -> Result<()> {
    let conn = db.conversations();
    conn.execute(
        "UPDATE conversations SET is_pinned = ?1 WHERE id = ?2",
        params![pinned as i32, conversation_id],
    ).map_err(|e| AppError::Internal(format!("切换置顶失败: {}", e)))?;

    Ok(())
}

/// 删除对话及其消息
pub fn delete_conversation(db: &Database, conversation_id: &str) -> Result<()> {
    let conn = db.conversations();
    // 消息会被 CASCADE 自动删除
    conn.execute(
        "DELETE FROM conversations WHERE id = ?1",
        params![conversation_id],
    ).map_err(|e| AppError::Internal(format!("删除对话失败: {}", e)))?;

    Ok(())
}

/// 更新对话的最后一条消息内容（用于流式回复更新）
pub fn update_last_message(db: &Database, conversation_id: &str, content: &str) -> Result<()> {
    let conn = db.conversations();
    conn.execute(
        "UPDATE messages SET content = ?1 WHERE rowid = (
            SELECT rowid FROM messages WHERE conversation_id = ?2 ORDER BY timestamp DESC LIMIT 1
        )",
        params![content, conversation_id],
    ).map_err(|e| AppError::Internal(format!("更新消息失败: {}", e)))?;

    Ok(())
}

/// 批量导入对话（用于迁移）
pub fn bulk_import_conversations(db: &Database, conversations: &[FullConversation]) -> Result<usize> {
    let conn = db.conversations();
    let mut count = 0usize;

    conn.execute_batch("BEGIN TRANSACTION")
        .map_err(|e| AppError::Internal(format!("开启事务失败: {}", e)))?;

    for conv in conversations {
        let result = conn.execute(
            "INSERT OR IGNORE INTO conversations (id, document_id, title, created_at, updated_at, is_pinned)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                conv.id,
                conv.document_id,
                conv.title,
                conv.created_at,
                conv.updated_at,
                conv.is_pinned as i32,
            ],
        );

        if result.is_ok() {
            // 插入消息
            for msg in &conv.messages {
                let _ = conn.execute(
                    "INSERT INTO messages (conversation_id, role, content, timestamp, context_mode)
                     VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![
                        conv.id,
                        msg.role,
                        msg.content,
                        msg.timestamp,
                        msg.context_mode,
                    ],
                );
            }
            count += 1;
        }
    }

    conn.execute_batch("COMMIT")
        .map_err(|e| AppError::Internal(format!("提交事务失败: {}", e)))?;

    Ok(count)
}

/// 检查 conversations 表是否为空
pub fn is_empty(db: &Database) -> Result<bool> {
    let conn = db.conversations();
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM conversations",
        [],
        |row| row.get(0),
    ).map_err(|e| AppError::Internal(format!("查询对话数失败: {}", e)))?;

    Ok(count == 0)
}

// ── 内部辅助函数 ──

fn get_messages(conn: &rusqlite::Connection, conversation_id: &str) -> Result<Vec<MessageRecord>> {
    let mut stmt = conn.prepare(
        "SELECT role, content, timestamp, context_mode
         FROM messages WHERE conversation_id = ?1 ORDER BY timestamp ASC"
    ).map_err(|e| AppError::Internal(format!("查询消息失败: {}", e)))?;

    let messages = stmt.query_map(params![conversation_id], |row| {
        Ok(MessageRecord {
            role: row.get(0)?,
            content: row.get(1)?,
            timestamp: row.get(2)?,
            context_mode: row.get(3)?,
        })
    }).map_err(|e| AppError::Internal(format!("查询消息失败: {}", e)))?
    .filter_map(|r| r.ok())
    .collect();

    Ok(messages)
}
