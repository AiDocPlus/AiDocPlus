/**
 * sync/backend/local.rs — iCloud Drive 本地文件夹后端
 *
 * 将数据文件复制到本地文件夹（如 iCloud Drive 目录），macOS 自动完成云端同步。
 */
use crate::sync::types::{RemoteFileInfo, SyncBackend};
use async_trait::async_trait;
use std::fs;
use std::path::{Path, PathBuf};

pub struct LocalFolderBackend {
    sync_dir: PathBuf,
}

fn expand_tilde(path: &str) -> PathBuf {
    if path == "~" || path.starts_with("~/") {
        if let Some(home) = dirs::home_dir() {
            let rest = path.strip_prefix("~/").unwrap_or("");
            return home.join(rest);
        }
    }
    PathBuf::from(path)
}

impl LocalFolderBackend {
    pub fn new(sync_dir: PathBuf) -> Self {
        let expanded = expand_tilde(&sync_dir.to_string_lossy());
        Self { sync_dir: expanded }
    }

    fn ensure_dir(&self) -> Result<(), String> {
        if !self.sync_dir.exists() {
            fs::create_dir_all(&self.sync_dir)
                .map_err(|e| format!("创建同步目录失败: {}", e))?;
        }
        Ok(())
    }

    /// 递归扫描目录
    fn scan_recursive(base: &Path, prefix: &str) -> Result<Vec<RemoteFileInfo>, String> {
        let entries = match fs::read_dir(base) {
            Ok(e) => e,
            Err(e) => {
                if e.kind() == std::io::ErrorKind::NotFound {
                    return Ok(Vec::new());
                }
                return Err(format!("读取目录失败: {}", e));
            }
        };

        let mut results = Vec::new();
        for entry in entries {
            let entry = entry.map_err(|e| format!("读取目录条目失败: {}", e))?;
            let path = entry.path();
            let file_name = path.file_name().unwrap_or_default().to_string_lossy().to_string();

            // 跳过隐藏文件
            if file_name.starts_with('.') {
                continue;
            }

            let relative = if prefix.is_empty() {
                file_name.clone()
            } else {
                format!("{}/{}", prefix, file_name)
            };

            if path.is_dir() {
                results.extend(Self::scan_recursive(&path, &relative)?);
            } else if path.is_file() {
                let metadata = match fs::metadata(&path) {
                    Ok(m) => m,
                    Err(_) => continue,
                };
                let mtime_ms = metadata
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as u64);
                results.push(RemoteFileInfo {
                    path: relative,
                    mtime_ms,
                    size: Some(metadata.len()),
                });
            }
        }
        Ok(results)
    }
}

#[async_trait]
impl SyncBackend for LocalFolderBackend {
    async fn test_connection(&self) -> Result<(), String> {
        self.ensure_dir()?;
        let test_path = self.sync_dir.join(".aidocplus-sync-test");
        fs::write(&test_path, b"sync-test").map_err(|e| format!("写入测试文件失败: {}", e))?;
        fs::remove_file(&test_path).ok();
        Ok(())
    }

    async fn ensure_remote_dirs(&self, sub_dirs: &[&str]) -> Result<(), String> {
        self.ensure_dir()?;
        for dir_name in sub_dirs {
            let dir_path = self.sync_dir.join(dir_name);
            if !dir_path.exists() {
                fs::create_dir_all(&dir_path)
                    .map_err(|e| format!("创建目录 {} 失败: {}", dir_name, e))?;
            }
        }
        Ok(())
    }

    async fn list_remote_files(&self, prefix: &str) -> Result<Vec<RemoteFileInfo>, String> {
        self.ensure_dir()?;
        let scan_base = self.sync_dir.join(prefix);
        if !scan_base.exists() {
            return Ok(Vec::new());
        }
        Self::scan_recursive(&scan_base, prefix)
    }

    async fn download_file(&self, remote_path: &str, local_path: &PathBuf) -> Result<(), String> {
        let src = self.sync_dir.join(remote_path);
        if !src.exists() {
            return Err(format!("远程文件不存在: {}", remote_path));
        }
        if let Some(parent) = local_path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("创建本地目录失败: {}", e))?;
            }
        }
        fs::copy(&src, local_path)
            .map_err(|e| format!("下载文件失败: {}", e))?;
        Ok(())
    }

    async fn upload_file(&self, local_path: &PathBuf, remote_path: &str) -> Result<(), String> {
        self.ensure_dir()?;
        let dst = self.sync_dir.join(remote_path);
        if let Some(parent) = dst.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("创建远程目录失败: {}", e))?;
            }
        }
        fs::copy(local_path, &dst).map_err(|e| format!("上传文件失败: {}", e))?;
        Ok(())
    }

    async fn delete_remote_file(&self, remote_path: &str) -> Result<(), String> {
        let path = self.sync_dir.join(remote_path);
        if path.exists() {
            fs::remove_file(&path).map_err(|e| format!("删除文件失败: {}", e))?;
        }
        Ok(())
    }
}
