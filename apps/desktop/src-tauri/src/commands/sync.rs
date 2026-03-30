/**
 * commands/sync.rs — 云同步 IPC 命令
 */
use crate::config::AppState;
use crate::sync::types::*;
use crate::sync::SyncManager;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Emitter, Manager};

/// Tauri managed state 包装
pub struct SyncState(pub Mutex<SyncManager>);

impl SyncState {
    pub fn new() -> Self {
        Self(Mutex::new(SyncManager::new()))
    }
}

#[tauri::command]
pub async fn configure_sync(
    app_handle: tauri::AppHandle,
    sync_state: tauri::State<'_, SyncState>,
    app_state: tauri::State<'_, AppState>,
    config: SyncConfig,
) -> Result<(), String> {
    let data_root = app_state.data_root();

    // 保存配置（不强制测试连接）
    {
        let manager = sync_state.0.lock().map_err(|e| format!("锁失败: {}", e))?;
        manager.save_config_sync(&config, &data_root)?;
    }

    // 更新内存状态
    let interval_secs = config.auto_sync_interval_secs;
    {
        let mut manager = sync_state.0.lock().map_err(|e| format!("锁失败: {}", e))?;
        manager.set_config(config);
    }

    // 重启自动同步定时器
    start_auto_sync_timer(app_handle, interval_secs);

    Ok(())
}

#[tauri::command]
pub async fn sync_now(
    sync_state: tauri::State<'_, SyncState>,
    app_state: tauri::State<'_, AppState>,
) -> Result<SyncResult, String> {
    let data_root = app_state.data_root();
    let config = {
        let manager = sync_state.0.lock().map_err(|e| format!("锁失败: {}", e))?;
        manager.get_config().cloned()
    };

    let config = config.ok_or("同步未配置")?;
    let backend = crate::sync::create_backend(&config)?;

    let result = crate::sync::run_sync(backend.as_ref(), &config, &data_root).await?;

    {
        let mut manager = sync_state.0.lock().map_err(|e| format!("锁失败: {}", e))?;
        manager.update_after_sync(&result);
    }

    Ok(result)
}

#[tauri::command]
pub async fn get_sync_status(
    sync_state: tauri::State<'_, SyncState>,
) -> Result<SyncStatus, String> {
    let manager = sync_state.0.lock().map_err(|e| format!("锁失败: {}", e))?;
    Ok(manager.get_status())
}

#[tauri::command]
pub async fn test_sync_connection(config: SyncConfig) -> Result<bool, String> {
    let backend = crate::sync::create_backend(&config)?;
    backend.test_connection().await?;
    Ok(true)
}

#[tauri::command]
pub async fn cancel_sync(sync_state: tauri::State<'_, SyncState>) -> Result<(), String> {
    let mut manager = sync_state.0.lock().map_err(|e| format!("锁失败: {}", e))?;
    manager.cancel_sync();
    Ok(())
}

#[tauri::command]
pub async fn load_sync_config(
    sync_state: tauri::State<'_, SyncState>,
    app_state: tauri::State<'_, AppState>,
) -> Result<Option<SyncConfig>, String> {
    let data_root = app_state.data_root();
    let mut manager = sync_state.0.lock().map_err(|e| format!("锁失败: {}", e))?;
    manager.load_config(&data_root)
}

use std::time::Duration;

static AUTO_SYNC_RUNNING: AtomicBool = AtomicBool::new(false);

fn start_auto_sync_timer(app_handle: tauri::AppHandle, interval_secs: u64) {
    if interval_secs == 0 {
        return;
    }

    if AUTO_SYNC_RUNNING.swap(true, Ordering::Relaxed) {
        return;
    }

    let handle = app_handle.clone();
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(interval_secs));
        interval.tick().await;

        loop {
            interval.tick().await;

            let _ = handle.emit("sync:auto-sync-triggered", ());

            let config_clone = {
                let sync_state = handle.state::<SyncState>();
                let guard = sync_state.0.lock().unwrap_or_else(|e| e.into_inner());
                guard.get_config().cloned()
            };

            if let Some(config) = config_clone {
                if let Err(e) = trigger_sync(&handle, config).await {
                    eprintln!("[sync] 自动同步失败: {}", e);
                }
            }
        }
    });
}

async fn trigger_sync(app_handle: &tauri::AppHandle, config: SyncConfig) -> Result<(), String> {
    let _ = app_handle.emit("sync:status-change", serde_json::json!({
        "phase": "scanning"
    }));

    let data_root = crate::config::current_data_root();
    let backend = crate::sync::create_backend(&config)?;
    let result = crate::sync::run_sync(backend.as_ref(), &config, &data_root).await?;

    let sync_state = app_handle.state::<SyncState>();
    let guard = sync_state.0.lock();
    if let Ok(mut manager) = guard {
        manager.update_after_sync(&result);
    }

    let phase = if result.conflicts > 0 { "resolvingConflicts" } else { "done" };
    let _ = app_handle.emit("sync:status-change", serde_json::json!({
        "phase": phase,
        "uploaded": result.uploaded,
        "downloaded": result.downloaded,
        "conflicts": result.conflicts,
        "errors": result.errors,
    }));

    Ok(())
}
