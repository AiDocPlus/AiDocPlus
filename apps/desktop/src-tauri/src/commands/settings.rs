use std::fs;
use std::path::PathBuf;

/// 设置文件路径: ~/AiDocPlus/settings.json
fn settings_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join("AiDocPlus").join("settings.json")
}

/// 插件存储文件路径: ~/AiDocPlus/plugin-storage.json
fn plugin_storage_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join("AiDocPlus").join("plugin-storage.json")
}

/// 保存设置（前端传入完整 JSON 字符串）
#[tauri::command]
pub fn save_settings(json: String) -> Result<(), String> {
    let path = settings_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
    }
    fs::write(&path, &json).map_err(|e| format!("写入设置失败: {}", e))?;
    Ok(())
}

/// 加载设置（返回 JSON 字符串，文件不存在返回 null）
#[tauri::command]
pub fn load_settings() -> Result<Option<String>, String> {
    let path = settings_path();
    if !path.exists() {
        return Ok(None);
    }
    let json = fs::read_to_string(&path).map_err(|e| format!("读取设置失败: {}", e))?;
    Ok(Some(json))
}

/// 保存插件存储
#[tauri::command]
pub fn save_plugin_storage(json: String) -> Result<(), String> {
    let path = plugin_storage_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
    }
    fs::write(&path, &json).map_err(|e| format!("写入插件存储失败: {}", e))?;
    Ok(())
}

/// 加载插件存储
#[tauri::command]
pub fn load_plugin_storage() -> Result<Option<String>, String> {
    let path = plugin_storage_path();
    if !path.exists() {
        return Ok(None);
    }
    let json = fs::read_to_string(&path).map_err(|e| format!("读取插件存储失败: {}", e))?;
    Ok(Some(json))
}

/// 对话记录文件路径: ~/AiDocPlus/conversations.json
fn conversations_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join("AiDocPlus").join("conversations.json")
}

/// 保存对话记录
#[tauri::command]
pub fn save_conversations(json: String) -> Result<(), String> {
    let path = conversations_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
    }
    fs::write(&path, &json).map_err(|e| format!("写入对话记录失败: {}", e))?;
    Ok(())
}

/// 加载对话记录
#[tauri::command]
pub fn load_conversations() -> Result<Option<String>, String> {
    let path = conversations_path();
    if !path.exists() {
        return Ok(None);
    }
    let json = fs::read_to_string(&path).map_err(|e| format!("读取对话记录失败: {}", e))?;
    Ok(Some(json))
}

/// UI 偏好设置文件路径: ~/AiDocPlus/ui-preferences.json
fn ui_preferences_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join("AiDocPlus").join("ui-preferences.json")
}

/// 保存 UI 偏好设置（排序等）
#[tauri::command]
pub fn save_ui_preferences(json: String) -> Result<(), String> {
    let path = ui_preferences_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
    }
    fs::write(&path, &json).map_err(|e| format!("写入UI偏好失败: {}", e))?;
    Ok(())
}

/// 加载 UI 偏好设置
#[tauri::command]
pub fn load_ui_preferences() -> Result<Option<String>, String> {
    let path = ui_preferences_path();
    if !path.exists() {
        return Ok(None);
    }
    let json = fs::read_to_string(&path).map_err(|e| format!("读取UI偏好失败: {}", e))?;
    Ok(Some(json))
}
