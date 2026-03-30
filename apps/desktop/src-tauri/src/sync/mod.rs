/**
 * sync/mod.rs — 云同步主模块
 */
pub mod backend;
pub mod change_tracker;
pub mod types;

use change_tracker::{detect_local_changes, scan_local_files, snapshot_file, ChangeType};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::path::PathBuf;
use types::*;

/// 需要同步的子目录
const SYNC_SUB_DIRS: &[&str] = &[
    "Projects",
    "DocTemplates",
    "PromptTemplates",
    "CodingScripts",
];

/// 需要同步的根目录文件
const SYNC_ROOT_FILES: &[&str] = &[
    "settings.json",
    "ui-preferences.json",
    "plugin-storage.json",
];

/// 同步管理器（全局状态）
pub struct SyncManager {
    config: Option<SyncConfig>,
    status: SyncStatus,
    cancel_flag: bool,
}

impl SyncManager {
    pub fn new() -> Self {
        Self {
            config: None,
            status: SyncStatus::default(),
            cancel_flag: false,
        }
    }

    /// 保存配置到磁盘（同步方法，原子写入）
    pub fn save_config_sync(&self, config: &SyncConfig, data_root: &Path) -> Result<(), String> {
        let sync_dir = data_root.join(".sync");
        let _ = fs::create_dir_all(&sync_dir);

        let config_path = sync_dir.join("config.json");
        let json = serde_json::to_string_pretty(config)
            .map_err(|e| format!("序列化配置失败: {}", e))?;
        crate::config::atomic_write(&config_path, &json)
            .map_err(|e| format!("保存配置失败: {}", e))?;
        Ok(())
    }

    /// 设置内存中的配置
    pub fn set_config(&mut self, config: SyncConfig) {
        self.config = Some(config);
        self.status.configured = true;
    }

    /// 获取当前配置
    pub fn get_config(&self) -> Option<&SyncConfig> {
        self.config.as_ref()
    }

    /// 从磁盘加载配置
    pub fn load_config(&mut self, data_root: &Path) -> Result<Option<SyncConfig>, String> {
        let config_path = data_root.join(".sync").join("config.json");
        if !config_path.exists() {
            return Ok(None);
        }
        let json = fs::read_to_string(&config_path)
            .map_err(|e| format!("读取同步配置失败: {}", e))?;
        let config: SyncConfig = serde_json::from_str(&json)
            .map_err(|e| format!("解析同步配置失败: {}", e))?;

        self.config = Some(config.clone());
        self.status.configured = true;
        Ok(Some(config))
    }

    /// 获取当前同步状态
    pub fn get_status(&self) -> SyncStatus {
        self.status.clone()
    }

    /// 同步完成后更新状态
    pub fn update_after_sync(&mut self, result: &SyncResult) {
        self.status.phase = SyncPhase::Idle;
        self.status.last_sync_files = result.uploaded + result.downloaded;
        self.status.conflict_count = result.conflicts;
        if let Some(m) = load_manifest_from_default().ok().flatten() {
            self.status.last_sync_time = m.last_sync_time;
        }
    }

    /// 取消同步
    pub fn cancel_sync(&mut self) {
        self.cancel_flag = true;
    }

    #[allow(dead_code)]
    pub fn is_cancelled(&self) -> bool {
        self.cancel_flag
    }
}

/// 根据配置创建后端实例
pub fn create_backend(config: &SyncConfig) -> Result<Box<dyn SyncBackend>, String> {
    match config.provider {
        SyncProvider::ICloudDrive => {
            let folder = config
                .icloud_folder
                .as_ref()
                .ok_or("iCloud Drive 文件夹路径未设置")?;
            Ok(Box::new(backend::local::LocalFolderBackend::new(PathBuf::from(folder))))
        }
        SyncProvider::WebDAV => {
            let url = config
                .webdav_url
                .as_ref()
                .ok_or("WebDAV URL 未设置")?;
            let username = config
                .webdav_username
                .as_ref()
                .ok_or("WebDAV 用户名未设置")?;
            let password = config
                .webdav_password
                .as_ref()
                .ok_or("WebDAV 密码未设置")?;
            let remote_dir = config
                .webdav_remote_dir
                .as_deref()
                .unwrap_or("AiDocPlus");
            Ok(Box::new(backend::webdav::WebDAVBackend::new(
                url, username, password, remote_dir,
            )))
        }
    }
}

/// 执行同步（独立函数，不持有锁）
pub async fn run_sync(
    backend: &dyn SyncBackend,
    config: &SyncConfig,
    data_root: &Path,
) -> Result<SyncResult, String> {
    let start = std::time::Instant::now();
    let mut result = SyncResult::default();

    // 1. 确保远程目录结构
    backend.ensure_remote_dirs(SYNC_SUB_DIRS).await?;

    // 2. 扫描本地文件（根据范围过滤）
    let mut local_snapshots = HashMap::new();

    for dir_name in SYNC_SUB_DIRS {
        if !should_sync_dir(dir_name, config) {
            continue;
        }
        let scans = scan_local_files(data_root, dir_name)?;
        local_snapshots.extend(scans);
    }

    if config.scope.sync_settings {
        for file_name in SYNC_ROOT_FILES {
            let file_path = data_root.join(file_name);
            if file_path.exists() {
                if let Ok(snapshot) = snapshot_file(data_root, file_name) {
                    local_snapshots.insert(file_name.to_string(), snapshot);
                }
            }
        }
    }

    // 3. 加载上次同步清单
    let manifest = load_manifest(data_root)?;

    // 4. 检测本地变更
    let local_changes = detect_local_changes(&local_snapshots, &manifest);

    // 5. 列出远程文件
    let mut remote_files_map: HashMap<String, RemoteFileInfo> = HashMap::new();
    for dir_name in SYNC_SUB_DIRS {
        if !should_sync_dir(dir_name, config) {
            continue;
        }
        let files = backend.list_remote_files(dir_name).await?;
        for f in files {
            remote_files_map.insert(f.path.clone(), f);
        }
    }
    if config.scope.sync_settings {
        for file_name in SYNC_ROOT_FILES {
            let files = backend.list_remote_files(file_name).await?;
            for f in files {
                remote_files_map.insert(f.path.clone(), f);
            }
        }
    }

    // 6. 上传本地变更（跳过有冲突的文件）
    for change in &local_changes {
        match change.change_type {
            ChangeType::LocalAdded
            | ChangeType::LocalModified => {
                if let Some(snap) = &change.local_snapshot {
                    // 冲突检测：如果远程文件也存在且有 mtime，检查是否双方都修改了
                    if let Some(remote_info) = remote_files_map.get(&change.relative_path) {
                        if is_conflict(&manifest, &change.relative_path, snap, remote_info) {
                            result.conflicts += 1;
                            result.conflict_files.push(change.relative_path.clone());
                            continue;
                        }
                    }
                    let local_path = data_root.join(&change.relative_path);
                    backend
                        .upload_file(&local_path, &change.relative_path)
                        .await
                        .map_err(|e| format!("上传 {} 失败: {}", change.relative_path, e))?;
                    result.uploaded += 1;
                }
            }
            ChangeType::LocalDeleted => {
                if remote_files_map.contains_key(&change.relative_path) {
                    backend.delete_remote_file(&change.relative_path).await
                        .map_err(|e| format!("删除远程 {} 失败: {}", change.relative_path, e))?;
                }
            }
            _ => {}
        }
    }

    // 7. 下载远程新增/修改的文件（跳过有冲突的文件）
    let last_snapshots: HashMap<&str, &FileSnapshot> = manifest
        .snapshots
        .iter()
        .map(|s| (s.relative_path.as_str(), s))
        .collect();

    for (remote_path, remote_info) in &remote_files_map {
        // 跳过本地已有且无变更的文件
        if let Some(local_snap) = local_snapshots.get(remote_path.as_str()) {
            // 本地文件存在且与上次清单一致（未本地修改），检查远程是否有变更
            if let Some(old) = last_snapshots.get(remote_path.as_str()) {
                if old.hash == local_snap.hash {
                    // 本地未修改，检查远程 mtime 判断是否有新版本
                    if let Some(remote_mtime) = remote_info.mtime_ms {
                        if let Some(old_mtime) = old_mtime_from_manifest(&manifest, remote_path) {
                            if remote_mtime <= old_mtime {
                                continue; // 远程也没变，跳过
                            }
                        }
                    }
                    // 本地未改、远程可能改了 → 下载
                    let local_path = data_root.join(remote_path);
                    match backend.download_file(remote_path, &local_path).await {
                        Ok(()) => result.downloaded += 1,
                        Err(e) => {
                            result.errors += 1;
                            eprintln!("[sync] 下载文件失败 {}: {}", remote_path, e);
                        }
                    }
                }
                // 本地有修改 → 已在上传阶段处理冲突
            }
        } else {
            // 本地不存在 → 下载
            let local_path = data_root.join(remote_path);
            match backend.download_file(remote_path, &local_path).await {
                Ok(()) => result.downloaded += 1,
                Err(e) => {
                    result.errors += 1;
                    eprintln!("[sync] 下载文件失败 {}: {}", remote_path, e);
                }
            }
        }
    }

    // 8. 更新清单（合并所有本地文件快照）
    let new_manifest = SyncManifest {
        snapshots: local_snapshots.into_values().collect(),
        last_sync_time: Some(chrono::Utc::now().to_rfc3339()),
    };
    save_manifest(data_root, &new_manifest)?;

    result.elapsed_ms = start.elapsed().as_millis() as u64;
    Ok(result)
}

fn should_sync_dir(dir_name: &str, config: &SyncConfig) -> bool {
    match dir_name {
        "Projects" => config.scope.sync_documents,
        "DocTemplates" | "PromptTemplates" => config.scope.sync_templates,
        "CodingScripts" => config.scope.sync_coding_scripts,
        _ => true,
    }
}

/// 冲突检测：上次同步后双方都修改了同一文件
fn is_conflict(
    manifest: &SyncManifest,
    path: &str,
    local_snap: &FileSnapshot,
    remote_info: &RemoteFileInfo,
) -> bool {
    let old_snap = match manifest.snapshots.iter().find(|s| s.relative_path == path) {
        Some(s) => s,
        None => return false, // 新文件，无冲突
    };

    // 本地已修改（hash 不同）
    if old_snap.hash == local_snap.hash {
        return false;
    }

    // 远程也修改了（mtime 不同且有 mtime 可用）
    if let Some(remote_mtime) = remote_info.mtime_ms {
        // 如果远程 mtime 比上次同步记录的更新，视为双方都修改了
        if remote_mtime > old_snap.mtime_ms {
            return true;
        }
    }

    false
}

fn old_mtime_from_manifest(manifest: &SyncManifest, path: &str) -> Option<u64> {
    manifest
        .snapshots
        .iter()
        .find(|s| s.relative_path == path)
        .map(|s| s.mtime_ms)
}

/// 加载同步清单
fn load_manifest(data_root: &Path) -> Result<SyncManifest, String> {
    let path = data_root.join(".sync").join("manifest.json");
    if !path.exists() {
        return Ok(SyncManifest::default());
    }
    let json = fs::read_to_string(&path)
        .map_err(|e| format!("读取清单失败: {}", e))?;
    serde_json::from_str(&json).map_err(|e| format!("解析清单失败: {}", e))
}

/// 从默认数据目录加载清单
fn load_manifest_from_default() -> Result<Option<SyncManifest>, String> {
    let data_root = crate::config::current_data_root();
    let path = data_root.join(".sync").join("manifest.json");
    if !path.exists() {
        return Ok(None);
    }
    Ok(Some(load_manifest(&data_root)?))
}

/// 保存同步清单（原子写入）
fn save_manifest(data_root: &Path, manifest: &SyncManifest) -> Result<(), String> {
    let sync_dir = data_root.join(".sync");
    let _ = fs::create_dir_all(&sync_dir);
    let path = sync_dir.join("manifest.json");
    let json = serde_json::to_string_pretty(manifest)
        .map_err(|e| format!("序列化清单失败: {}", e))?;
    crate::config::atomic_write(&path, &json)
        .map_err(|e| format!("保存清单失败: {}", e))
}
