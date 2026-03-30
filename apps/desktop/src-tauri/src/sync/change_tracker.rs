/**
 * sync/change_tracker.rs — 文件变更检测（mtime + SHA256 哈希快照）
 *
 * 比较当前文件系统状态与上次同步快照来检测变更。
 */
use crate::sync::types::{FileSnapshot, SyncManifest};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

/// 变更类型
#[derive(Debug, Clone, PartialEq)]
#[allow(dead_code)] // 远程同步功能预留
pub enum ChangeType {
    /// 本地新增
    LocalAdded,
    /// 本地修改
    LocalModified,
    /// 本地删除
    LocalDeleted,
    /// 远程新增
    RemoteAdded,
    /// 远程修改
    RemoteModified,
    /// 远程删除
    RemoteDeleted,
    /// 双方都修改了（冲突）
    BothModified,
}

/// 检测到的变更
#[derive(Debug, Clone)]
pub struct FileChange {
    pub relative_path: String,
    pub change_type: ChangeType,
    pub local_snapshot: Option<FileSnapshot>,
}

/// 计算文件 SHA256 哈希（hex）
pub fn file_hash(path: &Path) -> Result<String, String> {
    let data = fs::read(path).map_err(|e| format!("读取文件失败: {}", e))?;
    let mut hasher = Sha256::new();
    hasher.update(&data);
    Ok(format!("{:x}", hasher.finalize()))
}

/// 为文件创建快照
pub fn snapshot_file(base: &Path, relative_path: &str) -> Result<FileSnapshot, String> {
    let full_path = base.join(relative_path);
    let metadata = fs::metadata(&full_path).map_err(|e| format!("读取元数据失败: {}", e))?;

    let mtime_ms = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    let hash = file_hash(&full_path)?;

    Ok(FileSnapshot {
        relative_path: relative_path.to_string(),
        hash,
        mtime_ms,
        size: metadata.len(),
    })
}

/// 递归扫描目录，生成当前文件快照映射（相对路径 → FileSnapshot）
pub fn scan_local_files(
    base: &Path,
    sub_dir: &str,
) -> Result<HashMap<String, FileSnapshot>, String> {
    let scan_root = base.join(sub_dir);
    if !scan_root.exists() {
        return Ok(HashMap::new());
    }
    let mut result = HashMap::new();
    scan_recursive(base, &scan_root, sub_dir, &mut result)?;
    Ok(result)
}

fn scan_recursive(
    base: &Path,  // 始终是 data_root（不变）
    dir: &Path,   // 当前递归目录（逐层深入）
    prefix: &str, // 相对路径前缀
    result: &mut HashMap<String, FileSnapshot>,
) -> Result<(), String> {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(e) => {
            if e.kind() == std::io::ErrorKind::NotFound {
                return Ok(());
            }
            return Err(format!("读取目录失败: {}", e));
        }
    };

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();
        let file_name = path.file_name().unwrap_or_default().to_string_lossy();

        // 跳过隐藏文件和同步元数据
        if file_name.starts_with('.') {
            continue;
        }

        let relative = if prefix.is_empty() {
            file_name.to_string()
        } else {
            format!("{}/{}", prefix, file_name)
        };

        if path.is_dir() {
            scan_recursive(base, &path, &relative, result)?;
        } else if path.is_file() {
            // 始终使用 base（data_root）作为 snapshot_file 的基础路径
            if let Ok(snapshot) = snapshot_file(base, &relative) {
                result.insert(relative, snapshot);
            }
        }
    }
    Ok(())
}

/// 比较本地文件状态与上次同步快照，检测变更
pub fn detect_local_changes(
    current: &HashMap<String, FileSnapshot>,
    manifest: &SyncManifest,
) -> Vec<FileChange> {
    let mut changes = Vec::new();
    let last_snapshots: HashMap<&str, &FileSnapshot> = manifest
        .snapshots
        .iter()
        .map(|s| (s.relative_path.as_str(), s))
        .collect();

    // 检测新增和修改
    for (path, snapshot) in current {
        match last_snapshots.get(path.as_str()) {
            None => {
                changes.push(FileChange {
                    relative_path: path.clone(),
                    change_type: ChangeType::LocalAdded,
                    local_snapshot: Some(snapshot.clone()),
                });
            }
            Some(&old) => {
                if old.hash != snapshot.hash {
                    changes.push(FileChange {
                        relative_path: path.clone(),
                        change_type: ChangeType::LocalModified,
                        local_snapshot: Some(snapshot.clone()),
                    });
                }
            }
        }
    }

    // 检测删除
    for (path, _) in &last_snapshots {
        if !current.contains_key(*path) {
            changes.push(FileChange {
                relative_path: (*path).to_string(),
                change_type: ChangeType::LocalDeleted,
                local_snapshot: None,
            });
        }
    }

    changes
}
