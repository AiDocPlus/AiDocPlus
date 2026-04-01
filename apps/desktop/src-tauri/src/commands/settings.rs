use std::fs;
use std::path::PathBuf;
use tauri::State;
use crate::config::AppState;
use crate::error::{AppError, Result, ResultExt};

/// 获取当前数据根目录
fn data_root(state: &AppState) -> PathBuf {
    state.data_root()
}

/// 设置文件路径: <data_root>/settings.json
fn settings_path(state: &AppState) -> PathBuf {
    data_root(state).join("settings.json")
}

/// 插件存储文件路径: <data_root>/plugin-storage.json
fn plugin_storage_path(state: &AppState) -> PathBuf {
    data_root(state).join("plugin-storage.json")
}

/// 对话记录文件路径: <data_root>/conversations.json
fn conversations_path(state: &AppState) -> PathBuf {
    data_root(state).join("conversations.json")
}

/// UI 偏好设置文件路径: <data_root>/ui-preferences.json
fn ui_preferences_path(state: &AppState) -> PathBuf {
    data_root(state).join("ui-preferences.json")
}

// ── 设置读写 ──

/// 保存设置（前端传入完整 JSON 字符串）
#[tauri::command]
pub fn save_settings(state: State<'_, AppState>, json: String) -> Result<()> {
    let path = settings_path(&state);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).context("创建目录失败")?;
    }
    crate::config::atomic_write(&path, &json)?;
    Ok(())
}

/// 加载设置（返回 JSON 字符串，文件不存在返回 null）
#[tauri::command]
pub fn load_settings(state: State<'_, AppState>) -> Result<Option<String>> {
    let path = settings_path(&state);
    if !path.exists() {
        return Ok(None);
    }
    let json = fs::read_to_string(&path).context("读取设置失败")?;
    Ok(Some(json))
}

// ── 插件存储 ──

/// 保存插件存储
#[tauri::command]
pub fn save_plugin_storage(state: State<'_, AppState>, json: String) -> Result<()> {
    let path = plugin_storage_path(&state);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).context("创建目录失败")?;
    }
    crate::config::atomic_write(&path, &json)?;
    Ok(())
}

/// 加载插件存储
#[tauri::command]
pub fn load_plugin_storage(state: State<'_, AppState>) -> Result<Option<String>> {
    let path = plugin_storage_path(&state);
    if !path.exists() {
        return Ok(None);
    }
    let json = fs::read_to_string(&path).context("读取插件存储失败")?;
    Ok(Some(json))
}

// ── 对话记录 ──

/// 保存对话记录
#[tauri::command]
pub fn save_conversations(state: State<'_, AppState>, json: String) -> Result<()> {
    let path = conversations_path(&state);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).context("创建目录失败")?;
    }
    crate::config::atomic_write(&path, &json)?;
    Ok(())
}

/// 加载对话记录
#[tauri::command]
pub fn load_conversations(state: State<'_, AppState>) -> Result<Option<String>> {
    let path = conversations_path(&state);
    if !path.exists() {
        return Ok(None);
    }
    let json = fs::read_to_string(&path).context("读取对话记录失败")?;
    Ok(Some(json))
}

// ── UI 偏好 ──

/// 保存 UI 偏好设置（排序等）
#[tauri::command]
pub fn save_ui_preferences(state: State<'_, AppState>, json: String) -> Result<()> {
    let path = ui_preferences_path(&state);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).context("创建目录失败")?;
    }
    crate::config::atomic_write(&path, &json)?;
    Ok(())
}

/// 加载 UI 偏好设置
#[tauri::command]
pub fn load_ui_preferences(state: State<'_, AppState>) -> Result<Option<String>> {
    let path = ui_preferences_path(&state);
    if !path.exists() {
        return Ok(None);
    }
    let json = fs::read_to_string(&path).context("读取UI偏好失败")?;
    Ok(Some(json))
}

// ── 数据目录管理 ──

/// 获取当前数据根目录路径
#[tauri::command]
pub fn get_data_root_path(state: State<'_, AppState>) -> Result<String> {
    Ok(state.data_root().to_string_lossy().to_string())
}

/// 切换数据根目录（仅修改配置，不迁移数据）
/// 需要重启应用生效
#[allow(non_snake_case)]
#[tauri::command]
pub fn change_data_root(state: State<'_, AppState>, newPath: String) -> Result<()> {
    let new_root = PathBuf::from(&newPath);

    // 安全限制：数据目录必须在用户 home 目录下（防止写入系统目录）
    if let Some(home) = dirs::home_dir() {
        let canonical_new = if new_root.exists() {
            new_root.canonicalize().unwrap_or(new_root.clone())
        } else {
            new_root.clone()
        };
        let canonical_home = home.canonicalize().unwrap_or(home);
        if !canonical_new.starts_with(&canonical_home) {
            return Err(AppError::SecurityError(
                "安全限制：数据目录必须在用户主目录下".to_string()
            ));
        }
    }

    if !new_root.exists() {
        fs::create_dir_all(&new_root).context("创建目录失败")?;
    }
    state.set_data_root(new_root)?;
    Ok(())
}

/// 将数据从当前目录迁移（复制）到新目录
/// 迁移完成后自动切换到新目录
#[allow(non_snake_case)]
#[tauri::command]
pub fn migrate_data_to_new_root(state: State<'_, AppState>, newPath: String) -> Result<String> {
    let old_root = state.data_root();
    let new_root = PathBuf::from(&newPath);

    // 安全限制：目标目录必须在用户 home 目录下
    if let Some(home) = dirs::home_dir() {
        let canonical_new = if new_root.exists() {
            new_root.canonicalize().unwrap_or(new_root.clone())
        } else {
            new_root.clone()
        };
        let canonical_home = home.canonicalize().unwrap_or(home);
        if !canonical_new.starts_with(&canonical_home) {
            return Err(AppError::SecurityError(
                "安全限制：数据目录必须在用户主目录下".to_string()
            ));
        }
    }

    if old_root == new_root {
        return Err(AppError::ValidationError("新旧数据目录相同，无需迁移".to_string()));
    }

    // 创建新目录
    fs::create_dir_all(&new_root).context("创建新数据目录失败")?;

    // 递归复制所有内容
    let count = copy_dir_recursive(&old_root, &new_root)?;

    // 切换到新目录
    state.set_data_root(new_root)?;

    Ok(format!("已迁移 {} 个文件到新数据目录", count))
}

/// 递归复制目录内容
fn copy_dir_recursive(src: &PathBuf, dst: &PathBuf) -> Result<usize> {
    let mut count = 0usize;
    let entries = fs::read_dir(src).context("读取源目录失败")?;

    for entry in entries {
        let entry = entry.context("读取目录项失败")?;
        let src_path = entry.path();
        let file_name = entry.file_name();
        let dst_path = dst.join(&file_name);

        if src_path.is_dir() {
            fs::create_dir_all(&dst_path).context("创建目录失败")?;
            count += copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)
                .context_with(|| format!("复制文件失败 {:?}", file_name))?;
            count += 1;
        }
    }
    Ok(count)
}
