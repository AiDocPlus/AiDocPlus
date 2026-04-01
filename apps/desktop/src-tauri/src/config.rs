use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::RwLock;
use tauri::{AppHandle, Manager};
use crate::database::Database;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub data_root: PathBuf,
    pub projects_dir: PathBuf,
    pub autosave_interval: u64,
    pub max_versions: usize,
}

/// 默认数据根目录
pub fn default_data_root() -> PathBuf {
    dirs::home_dir().unwrap_or_else(|| PathBuf::from(".")).join("AiDocPlus")
}

/// 获取当前有效的数据根目录（优先自定义，否则默认）
/// 可在无 AppState 访问的上下文中使用
pub fn current_data_root() -> PathBuf {
    load_custom_data_root().unwrap_or_else(default_data_root)
}

/// 自定义数据目录配置文件（固定路径，不随数据目录移动）
fn data_dir_config_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".aidocplus")
        .join("data-dir.json")
}

/// 从配置文件读取自定义数据根目录
pub fn load_custom_data_root() -> Option<PathBuf> {
    let path = data_dir_config_path();
    if !path.exists() { return None; }
    let json = std::fs::read_to_string(&path).ok()?;
    let val: serde_json::Value = serde_json::from_str(&json).ok()?;
    val.get("dataRoot")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(PathBuf::from)
        .filter(|p| p.exists())
}

/// 保存自定义数据根目录到配置文件
pub fn save_custom_data_root(data_root: &PathBuf) -> crate::error::Result<()> {
    use crate::error::ResultExt;
    let path = data_dir_config_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).context("创建配置目录失败")?;
    }
    let json = serde_json::json!({ "dataRoot": data_root.to_string_lossy() });
    atomic_write(&path, &serde_json::to_string_pretty(&json).unwrap_or_default())?;
    Ok(())
}

impl AppConfig {
    pub fn with_data_root(data_root: PathBuf) -> Self {
        let projects_dir = data_root.join("Projects");
        Self {
            data_root,
            projects_dir,
            autosave_interval: 30,
            max_versions: 50,
        }
    }
}

impl Default for AppConfig {
    fn default() -> Self {
        let data_root = load_custom_data_root().unwrap_or_else(default_data_root);
        Self::with_data_root(data_root)
    }
}

pub struct AppState {
    inner: RwLock<AppConfig>,
    pub db: Database,
}

impl AppState {
    pub fn new() -> Self {
        let config = AppConfig::default();

        // Ensure projects directory exists
        if let Err(e) = std::fs::create_dir_all(&config.projects_dir) {
            eprintln!("Failed to create projects directory: {}", e);
        }

        eprintln!("[config] 数据根目录: {}", config.data_root.display());

        let db = Database::init(&config.data_root)
            .expect("[database] 初始化 SQLite 失败");

        // 首次启动时从文档 JSON 迁移版本数据到 SQLite
        if let Err(e) = db.migrate_versions_from_json(&config.projects_dir) {
            eprintln!("[database] 版本迁移失败（不影响启动）: {}", e);
        }

        // 首次启动时从 conversations.json 迁移对话数据到 SQLite
        if let Err(e) = db.migrate_conversations_from_json(&config.data_root) {
            eprintln!("[database] 对话迁移失败（不影响启动）: {}", e);
        }

        // 首次启动时构建全文搜索索引
        if crate::search_store::is_empty(&db).unwrap_or(true) {
            match crate::search_store::rebuild_index(&db, &config.projects_dir) {
                Ok(n) => eprintln!("[database] 搜索索引构建完成: {} 个文档", n),
                Err(e) => eprintln!("[database] 搜索索引构建失败（不影响启动）: {}", e),
            }
        }

        Self { inner: RwLock::new(config), db }
    }

    /// 获取当前数据根目录
    pub fn data_root(&self) -> PathBuf {
        self.inner.read().unwrap_or_else(|e| e.into_inner()).data_root.clone()
    }

    /// 获取当前项目目录
    pub fn projects_dir(&self) -> PathBuf {
        self.inner.read().unwrap_or_else(|e| e.into_inner()).projects_dir.clone()
    }

    /// 切换数据根目录（运行时）
    pub fn set_data_root(&self, new_root: PathBuf) -> crate::error::Result<()> {
        use crate::error::ResultExt;
        let new_config = AppConfig::with_data_root(new_root.clone());
        std::fs::create_dir_all(&new_config.projects_dir)
            .context("创建项目目录失败")?;
        save_custom_data_root(&new_root)?;
        *self.inner.write().unwrap_or_else(|e| e.into_inner()) = new_config;
        eprintln!("[config] 数据根目录已切换为: {}", new_root.display());
        Ok(())
    }

    pub fn get_project_path(&self, project_id: &str) -> PathBuf {
        self.projects_dir().join(format!("{}.json", project_id))
    }

    pub fn get_document_path(&self, project_id: &str, document_id: &str) -> PathBuf {
        self.projects_dir()
            .join(project_id)
            .join("documents")
            .join(format!("{}.json", document_id))
    }

    #[allow(dead_code)]
    pub fn get_versions_path(&self, project_id: &str, document_id: &str) -> PathBuf {
        self.projects_dir()
            .join(project_id)
            .join("versions")
            .join(document_id)
    }

    /// 获取完整配置快照
    pub fn config(&self) -> AppConfig {
        self.inner.read().unwrap_or_else(|e| e.into_inner()).clone()
    }
}

// Helper to get config directory
pub fn get_config_dir(handle: &AppHandle) -> PathBuf {
    handle
        .path()
        .app_config_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
}

// Helper to get data directory
#[allow(dead_code)]
pub fn get_data_dir(handle: &AppHandle) -> PathBuf {
    handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
}

// Re-export dirs
pub use dirs;

// Helper to get workspace state path
pub fn get_workspace_state_path(handle: &AppHandle) -> PathBuf {
    get_config_dir(handle).join("workspace-state.json")
}

/// 原子写入：先写临时文件再 rename，防止写入中断导致文件损坏
pub fn atomic_write(path: &std::path::Path, content: &str) -> crate::error::Result<()> {
    use crate::error::ResultExt;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .context("Failed to create directory")?;
    }
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, content)
        .context("Failed to write temp file")?;
    std::fs::rename(&tmp, path)
        .context("Failed to rename temp file")?;
    Ok(())
}
