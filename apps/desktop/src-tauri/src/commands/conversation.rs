#![allow(non_snake_case)]

use crate::config::AppState;
use crate::conversation_store::{self, FullConversation, MessageRecord};
use crate::error::Result;
use tauri::State;

/// 加载所有对话（含消息）- 前端初始化时调用
#[tauri::command]
pub fn load_all_conversations(
    state: State<'_, AppState>,
) -> Result<Vec<FullConversation>> {
    conversation_store::get_all_conversations(&state.db)
}

/// 创建对话
#[tauri::command]
pub fn db_create_conversation(
    state: State<'_, AppState>,
    id: String,
    documentId: String,
    title: String,
    createdAt: f64,
) -> Result<()> {
    crate::security::validate_id(&id, "id")?;
    crate::security::validate_id(&documentId, "documentId")?;
    conversation_store::create_conversation(&state.db, &id, &documentId, &title, createdAt)
}

/// 添加消息到对话
#[tauri::command]
pub fn db_add_message(
    state: State<'_, AppState>,
    conversationId: String,
    role: String,
    content: String,
    timestamp: Option<f64>,
    contextMode: Option<String>,
) -> Result<()> {
    crate::security::validate_id(&conversationId, "conversationId")?;
    let msg = MessageRecord {
        role,
        content,
        timestamp,
        context_mode: contextMode,
    };
    conversation_store::add_message(&state.db, &conversationId, &msg)
}

/// 更新对话最后一条消息内容（流式回复）
#[tauri::command]
pub fn db_update_last_message(
    state: State<'_, AppState>,
    conversationId: String,
    content: String,
) -> Result<()> {
    crate::security::validate_id(&conversationId, "conversationId")?;
    conversation_store::update_last_message(&state.db, &conversationId, &content)
}

/// 重命名对话
#[tauri::command]
pub fn db_rename_conversation(
    state: State<'_, AppState>,
    conversationId: String,
    title: String,
) -> Result<()> {
    crate::security::validate_id(&conversationId, "conversationId")?;
    conversation_store::rename_conversation(&state.db, &conversationId, &title)
}

/// 切换对话置顶
#[tauri::command]
pub fn db_pin_conversation(
    state: State<'_, AppState>,
    conversationId: String,
    pinned: bool,
) -> Result<()> {
    crate::security::validate_id(&conversationId, "conversationId")?;
    conversation_store::pin_conversation(&state.db, &conversationId, pinned)
}

/// 删除对话
#[tauri::command]
pub fn db_delete_conversation(
    state: State<'_, AppState>,
    conversationId: String,
) -> Result<()> {
    crate::security::validate_id(&conversationId, "conversationId")?;
    conversation_store::delete_conversation(&state.db, &conversationId)
}
