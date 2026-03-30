/**
 * sync/types.rs — 云同步核心类型定义
 */
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// 同步服务提供商
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SyncProvider {
    /// iCloud Drive（本地文件夹方案）
    #[serde(rename = "ICloudDrive")]
    ICloudDrive,
    /// 坚果云 WebDAV
    #[serde(rename = "WebDAV")]
    WebDAV,
}

/// 同步配置（持久化到 .sync/config.json）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncConfig {
    /// 服务提供商
    pub provider: SyncProvider,
    /// iCloud Drive：同步目标文件夹路径
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icloud_folder: Option<String>,
    /// WebDAV：服务器 URL
    #[serde(skip_serializing_if = "Option::is_none")]
    pub webdav_url: Option<String>,
    /// WebDAV：用户名
    #[serde(skip_serializing_if = "Option::is_none")]
    pub webdav_username: Option<String>,
    /// WebDAV：应用专用密码（加密存储）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub webdav_password: Option<String>,
    /// WebDAV：远程子目录（默认 "AiDocPlus"）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub webdav_remote_dir: Option<String>,
    /// 同步范围
    pub scope: SyncScope,
    /// 自动同步间隔（秒），0 表示禁用自动同步
    #[serde(default = "default_auto_sync_interval")]
    pub auto_sync_interval_secs: u64,
}

fn default_auto_sync_interval() -> u64 {
    300 // 5 分钟
}

/// 同步范围配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncScope {
    /// 同步文档和项目
    pub sync_documents: bool,
    /// 同步设置和偏好
    pub sync_settings: bool,
    /// 同步自定义模板
    pub sync_templates: bool,
    /// 同步插件数据
    pub sync_plugin_data: bool,
    /// 同步编程区脚本
    pub sync_coding_scripts: bool,
}

impl Default for SyncScope {
    fn default() -> Self {
        Self {
            sync_documents: true,
            sync_settings: true,
            sync_templates: true,
            sync_plugin_data: true,
            sync_coding_scripts: false,
        }
    }
}

/// 同步状态（前端展示用）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatus {
    /// 是否已配置同步
    pub configured: bool,
    /// 当前同步阶段
    pub phase: SyncPhase,
    /// 上次成功同步时间（ISO 8601）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_sync_time: Option<String>,
    /// 上次同步的文件数
    pub last_sync_files: u32,
    /// 待处理的冲突数
    pub conflict_count: u32,
    /// 错误信息
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl Default for SyncStatus {
    fn default() -> Self {
        Self {
            configured: false,
            phase: SyncPhase::Idle,
            last_sync_time: None,
            last_sync_files: 0,
            conflict_count: 0,
            error: None,
        }
    }
}

/// 同步阶段
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub enum SyncPhase {
    #[default]
    Idle,
    Scanning,
    Uploading,
    Downloading,
    ResolvingConflicts,
    Done,
    Error,
}

/// 同步操作结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    /// 上传文件数
    pub uploaded: u32,
    /// 下载文件数
    pub downloaded: u32,
    /// 跳过文件数（未变化）
    pub skipped: u32,
    /// 冲突文件数
    pub conflicts: u32,
    /// 错误文件数
    pub errors: u32,
    /// 耗时（毫秒）
    pub elapsed_ms: u64,
    /// 冲突文件列表
    pub conflict_files: Vec<String>,
}

impl Default for SyncResult {
    fn default() -> Self {
        Self {
            uploaded: 0,
            downloaded: 0,
            skipped: 0,
            conflicts: 0,
            errors: 0,
            elapsed_ms: 0,
            conflict_files: Vec::new(),
        }
    }
}

/// 远程文件信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteFileInfo {
    /// 相对路径
    pub path: String,
    /// 修改时间（Unix 时间戳毫秒，可能不可用）
    pub mtime_ms: Option<u64>,
    /// 文件大小（字节）
    pub size: Option<u64>,
}

/// 文件快照条目（记录在 manifest.json）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSnapshot {
    /// 相对路径
    pub relative_path: String,
    /// 文件 SHA256 哈希（hex）
    pub hash: String,
    /// 文件修改时间（Unix 时间戳毫秒）
    pub mtime_ms: u64,
    /// 文件大小（字节）
    pub size: u64,
}

/// 同步清单文件（.sync/manifest.json）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncManifest {
    /// 上次同步后的文件快照
    pub snapshots: Vec<FileSnapshot>,
    /// 上次同步时间（ISO 8601）
    pub last_sync_time: Option<String>,
}

impl Default for SyncManifest {
    fn default() -> Self {
        Self {
            snapshots: Vec::new(),
            last_sync_time: None,
        }
    }
}

/// 冲突信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)] // 冲突解决功能预留
pub struct ConflictInfo {
    /// 相对路径
    pub relative_path: String,
    /// 本地修改时间
    pub local_mtime_ms: u64,
    /// 远程修改时间
    pub remote_mtime_ms: u64,
}

/// 同步后端 trait（异步，reqwest 0.13 需要 async）
#[async_trait::async_trait]
pub trait SyncBackend: Send + Sync {
    /// 测试连接是否可用
    async fn test_connection(&self) -> Result<(), String>;

    /// 初始化远程目录结构
    async fn ensure_remote_dirs(&self, sub_dirs: &[&str]) -> Result<(), String>;

    /// 列出远程目录下的文件
    async fn list_remote_files(&self, prefix: &str) -> Result<Vec<RemoteFileInfo>, String>;

    /// 下载远程文件到本地路径
    async fn download_file(&self, remote_path: &str, local_path: &PathBuf) -> Result<(), String>;

    /// 上传本地文件到远程路径
    async fn upload_file(&self, local_path: &PathBuf, remote_path: &str) -> Result<(), String>;

    /// 删除远程文件
    async fn delete_remote_file(&self, remote_path: &str) -> Result<(), String>;
}
