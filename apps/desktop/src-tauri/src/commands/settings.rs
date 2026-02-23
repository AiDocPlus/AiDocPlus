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
