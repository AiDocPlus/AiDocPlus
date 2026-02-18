use rusqlite::{params, Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

// ============================================================
// 数据结构
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceSummary {
    pub id: String,
    pub package_name: Option<String>,
    pub resource_type: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub author: String,
    pub version: String,
    pub major_category: String,
    pub sub_category: String,
    pub tags: Vec<String>,
    pub order: i32,
    pub enabled: bool,
    pub source: String,
    pub created_at: String,
    pub updated_at: String,
    pub data_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceFilter {
    pub resource_type: Option<String>,
    pub major_category: Option<String>,
    pub sub_category: Option<String>,
    pub source: Option<String>,
    pub enabled: Option<bool>,
    pub query: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceStats {
    pub total: u32,
    pub by_type: std::collections::HashMap<String, u32>,
    pub by_source: std::collections::HashMap<String, u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryInfo {
    pub key: String,
    pub name: String,
    pub icon: Option<String>,
    pub parent_key: Option<String>,
    pub order: i32,
    pub resource_type: String,
}

/// 通用 manifest 结构（从 JSON 文件读取）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenericManifest {
    pub id: String,
    #[serde(default)]
    pub package_name: Option<String>,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub icon: String,
    #[serde(default)]
    pub author: serde_json::Value, // String 或 AuthorInfo 对象
    #[serde(default)]
    pub version: String,
    #[serde(default, rename = "resourceType")]
    pub resource_type: String,
    #[serde(default, rename = "majorCategory")]
    pub major_category: String,
    #[serde(default, rename = "subCategory")]
    pub sub_category: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub order: i32,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default = "default_builtin")]
    pub source: String,
    #[serde(default, rename = "createdAt")]
    pub created_at: String,
    #[serde(default, rename = "updatedAt")]
    pub updated_at: String,
    #[serde(default, rename = "minAppVersion")]
    pub min_app_version: Option<String>,
    #[serde(default)]
    pub license: Option<String>,
    #[serde(default)]
    pub checksum: Option<String>,
}

fn default_true() -> bool { true }
fn default_builtin() -> String { "builtin".to_string() }

/// _meta.json 分类定义
#[derive(Debug, Clone, Deserialize)]
pub struct MetaConfig {
    #[serde(default, rename = "schemaVersion")]
    pub schema_version: String,
    #[serde(default, rename = "resourceType")]
    pub resource_type: String,
    #[serde(default)]
    pub categories: Vec<MetaCategory>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MetaCategory {
    pub key: String,
    pub name: String,
    pub icon: Option<String>,
    #[serde(default)]
    pub order: i32,
    #[serde(default, rename = "subCategories")]
    pub sub_categories: Vec<MetaSubCategory>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MetaSubCategory {
    pub key: String,
    pub name: String,
    pub icon: Option<String>,
    #[serde(default)]
    pub order: i32,
}

// ============================================================
// 资源引擎
// ============================================================

pub struct ResourceEngine {
    db: Connection,
    data_root: PathBuf,
}

impl ResourceEngine {
    /// 初始化资源引擎
    pub fn init(data_root: PathBuf) -> SqlResult<Self> {
        fs::create_dir_all(&data_root).ok();

        let db_path = data_root.join("index.db");
        let db = Connection::open(&db_path)?;

        // 启用 WAL 模式提升并发性能
        db.execute_batch("PRAGMA journal_mode=WAL;")?;

        let engine = Self { db, data_root };
        engine.create_tables()?;
        Ok(engine)
    }

    /// 创建数据库表
    fn create_tables(&self) -> SqlResult<()> {
        self.db.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS resources (
                id              TEXT PRIMARY KEY,
                package_name    TEXT UNIQUE,
                resource_type   TEXT NOT NULL,
                name            TEXT NOT NULL,
                description     TEXT DEFAULT '',
                icon            TEXT DEFAULT '',
                author          TEXT DEFAULT '',
                version         TEXT NOT NULL DEFAULT '1.0.0',
                major_category  TEXT NOT NULL DEFAULT '',
                sub_category    TEXT NOT NULL DEFAULT '',
                tags            TEXT DEFAULT '[]',
                sort_order      INTEGER DEFAULT 0,
                enabled         INTEGER DEFAULT 1,
                source          TEXT DEFAULT 'builtin',
                created_at      TEXT DEFAULT '',
                updated_at      TEXT DEFAULT '',
                installed_at    TEXT DEFAULT '',
                data_path       TEXT NOT NULL DEFAULT '',
                checksum        TEXT,
                min_app_version TEXT,
                extra           TEXT
            );

            CREATE TABLE IF NOT EXISTS categories (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                resource_type   TEXT NOT NULL,
                key             TEXT NOT NULL,
                name            TEXT NOT NULL,
                icon            TEXT,
                parent_key      TEXT,
                sort_order      INTEGER DEFAULT 0,
                i18n            TEXT,
                UNIQUE(resource_type, key, parent_key)
            );

            CREATE TABLE IF NOT EXISTS install_history (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                resource_id     TEXT NOT NULL,
                action          TEXT NOT NULL,
                from_version    TEXT,
                to_version      TEXT,
                timestamp       TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS dependencies (
                resource_id     TEXT NOT NULL,
                depends_on      TEXT NOT NULL,
                version_range   TEXT,
                dep_type        TEXT DEFAULT 'required',
                PRIMARY KEY (resource_id, depends_on)
            );

            CREATE INDEX IF NOT EXISTS idx_type ON resources(resource_type);
            CREATE INDEX IF NOT EXISTS idx_category ON resources(major_category, sub_category);
            CREATE INDEX IF NOT EXISTS idx_source ON resources(source);
            CREATE INDEX IF NOT EXISTS idx_enabled ON resources(enabled);
            "
        )?;

        // 创建 FTS5 虚拟表（如果不存在）
        self.db.execute_batch(
            "
            CREATE VIRTUAL TABLE IF NOT EXISTS resources_fts USING fts5(
                name, description, tags,
                content='resources', content_rowid='rowid'
            );
            "
        )?;

        Ok(())
    }

    /// 获取数据根目录
    pub fn data_root(&self) -> &Path {
        &self.data_root
    }

    // ============================================================
    // 索引重建
    // ============================================================

    /// 从 bundled-resources 目录扫描并重建索引
    pub fn rebuild_index_from_bundled(&self, bundled_dir: &Path) -> SqlResult<()> {
        if !bundled_dir.exists() {
            return Ok(());
        }

        // 遍历资源类型目录
        let type_dirs = [
            ("roles", "role"),
            ("prompt-templates", "prompt-template"),
            ("document-templates", "document-template"),
            ("project-templates", "project-template"),
            ("ai-providers", "ai-provider"),
        ];

        for (dir_name, resource_type) in &type_dirs {
            let type_dir = bundled_dir.join(dir_name);
            if !type_dir.exists() {
                continue;
            }

            // 加载分类定义
            let meta_path = type_dir.join("_meta.json");
            if meta_path.exists() {
                self.load_categories_from_meta(&meta_path, resource_type)?;
            }

            // 扫描资源目录
            self.scan_resource_dir(&type_dir, resource_type, "builtin")?;
        }

        // 重建 FTS 索引
        self.rebuild_fts()?;

        Ok(())
    }

    /// 从用户本地目录扫描资源
    pub fn rebuild_index_from_local(&self) -> SqlResult<()> {
        let resource_types = [
            ("roles", "role"),
            ("prompt-templates", "prompt-template"),
            ("document-templates", "document-template"),
            ("project-templates", "project-template"),
            ("ai-providers", "ai-provider"),
            ("plugins", "plugin"),
        ];

        for (dir_name, resource_type) in &resource_types {
            for source in &["builtin", "local", "community"] {
                let dir = self.data_root.join(dir_name).join(source);
                if dir.exists() {
                    self.scan_resource_dir(&dir, resource_type, source)?;
                }
            }
        }

        self.rebuild_fts()?;
        Ok(())
    }

    /// 扫描目录中的资源
    fn scan_resource_dir(&self, dir: &Path, resource_type: &str, source: &str) -> SqlResult<()> {
        if !dir.is_dir() {
            return Ok(());
        }

        let entries = match fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return Ok(()),
        };

        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let manifest_path = path.join("manifest.json");
            if !manifest_path.exists() {
                continue;
            }

            if let Ok(content) = fs::read_to_string(&manifest_path) {
                if let Ok(manifest) = serde_json::from_str::<GenericManifest>(&content) {
                    let author_str = match &manifest.author {
                        serde_json::Value::String(s) => s.clone(),
                        serde_json::Value::Object(obj) => {
                            obj.get("name")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string()
                        }
                        _ => String::new(),
                    };

                    let tags_json = serde_json::to_string(&manifest.tags).unwrap_or_default();
                    let data_path = path.to_string_lossy().to_string();
                    let now = chrono::Utc::now().to_rfc3339();

                    // 读取完整 manifest 作为 extra JSON
                    let extra = content.clone();

                    self.db.execute(
                        "INSERT OR REPLACE INTO resources (
                            id, package_name, resource_type, name, description, icon,
                            author, version, major_category, sub_category, tags,
                            sort_order, enabled, source, created_at, updated_at,
                            installed_at, data_path, checksum, min_app_version, extra
                        ) VALUES (
                            ?1, ?2, ?3, ?4, ?5, ?6,
                            ?7, ?8, ?9, ?10, ?11,
                            ?12, ?13, ?14, ?15, ?16,
                            ?17, ?18, ?19, ?20, ?21
                        )",
                        params![
                            manifest.id,
                            manifest.package_name,
                            if manifest.resource_type.is_empty() { resource_type } else { &manifest.resource_type },
                            manifest.name,
                            manifest.description,
                            manifest.icon,
                            author_str,
                            manifest.version,
                            manifest.major_category,
                            manifest.sub_category,
                            tags_json,
                            manifest.order,
                            manifest.enabled as i32,
                            if manifest.source == "builtin" { source } else { &manifest.source },
                            manifest.created_at,
                            manifest.updated_at,
                            now,
                            data_path,
                            manifest.checksum,
                            manifest.min_app_version,
                            extra,
                        ],
                    )?;
                }
            }
        }

        Ok(())
    }

    /// 从 _meta.json 加载分类定义
    fn load_categories_from_meta(&self, meta_path: &Path, resource_type: &str) -> SqlResult<()> {
        let content = match fs::read_to_string(meta_path) {
            Ok(c) => c,
            Err(_) => return Ok(()),
        };

        let meta: MetaConfig = match serde_json::from_str(&content) {
            Ok(m) => m,
            Err(_) => return Ok(()),
        };

        let rt = if meta.resource_type.is_empty() { resource_type } else { &meta.resource_type };

        for cat in &meta.categories {
            // 插入一级分类
            self.db.execute(
                "INSERT OR REPLACE INTO categories (resource_type, key, name, icon, parent_key, sort_order)
                 VALUES (?1, ?2, ?3, ?4, NULL, ?5)",
                params![rt, cat.key, cat.name, cat.icon, cat.order],
            )?;

            // 插入二级分类
            for sub in &cat.sub_categories {
                self.db.execute(
                    "INSERT OR REPLACE INTO categories (resource_type, key, name, icon, parent_key, sort_order)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![rt, sub.key, sub.name, sub.icon, cat.key, sub.order],
                )?;
            }
        }

        Ok(())
    }

    /// 重建 FTS 索引
    fn rebuild_fts(&self) -> SqlResult<()> {
        self.db.execute_batch(
            "
            DELETE FROM resources_fts;
            INSERT INTO resources_fts(rowid, name, description, tags)
                SELECT rowid, name, description, tags FROM resources;
            "
        )?;
        Ok(())
    }

    // ============================================================
    // 查询 API
    // ============================================================

    /// 列出资源
    pub fn list(&self, filter: &ResourceFilter) -> SqlResult<Vec<ResourceSummary>> {
        let mut sql = String::from(
            "SELECT id, package_name, resource_type, name, description, icon,
                    author, version, major_category, sub_category, tags,
                    sort_order, enabled, source, created_at, updated_at, data_path
             FROM resources WHERE 1=1"
        );
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(ref rt) = filter.resource_type {
            sql.push_str(&format!(" AND resource_type = ?{}", param_values.len() + 1));
            param_values.push(Box::new(rt.clone()));
        }
        if let Some(ref mc) = filter.major_category {
            sql.push_str(&format!(" AND major_category = ?{}", param_values.len() + 1));
            param_values.push(Box::new(mc.clone()));
        }
        if let Some(ref sc) = filter.sub_category {
            sql.push_str(&format!(" AND sub_category = ?{}", param_values.len() + 1));
            param_values.push(Box::new(sc.clone()));
        }
        if let Some(ref src) = filter.source {
            sql.push_str(&format!(" AND source = ?{}", param_values.len() + 1));
            param_values.push(Box::new(src.clone()));
        }
        if let Some(enabled) = filter.enabled {
            sql.push_str(&format!(" AND enabled = ?{}", param_values.len() + 1));
            param_values.push(Box::new(enabled as i32));
        }

        // 排序
        let sort_col = match filter.sort_by.as_deref() {
            Some("name") => "name",
            Some("updatedAt") => "updated_at",
            Some("createdAt") => "created_at",
            _ => "sort_order",
        };
        let sort_dir = match filter.sort_order.as_deref() {
            Some("desc") => "DESC",
            _ => "ASC",
        };
        sql.push_str(&format!(" ORDER BY {} {}", sort_col, sort_dir));

        if let Some(limit) = filter.limit {
            sql.push_str(&format!(" LIMIT {}", limit));
        }
        if let Some(offset) = filter.offset {
            sql.push_str(&format!(" OFFSET {}", offset));
        }

        let params_refs: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
        let mut stmt = self.db.prepare(&sql)?;
        let rows = stmt.query_map(params_refs.as_slice(), |row| {
            let tags_str: String = row.get(10)?;
            let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
            let enabled_int: i32 = row.get(12)?;
            Ok(ResourceSummary {
                id: row.get(0)?,
                package_name: row.get(1)?,
                resource_type: row.get(2)?,
                name: row.get(3)?,
                description: row.get(4)?,
                icon: row.get(5)?,
                author: row.get(6)?,
                version: row.get(7)?,
                major_category: row.get(8)?,
                sub_category: row.get(9)?,
                tags,
                order: row.get(11)?,
                enabled: enabled_int != 0,
                source: row.get(13)?,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
                data_path: row.get(16)?,
            })
        })?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row?);
        }
        Ok(results)
    }

    /// 全文搜索
    pub fn search(&self, query: &str, filter: &ResourceFilter) -> SqlResult<Vec<ResourceSummary>> {
        if query.trim().is_empty() {
            return self.list(filter);
        }

        let mut sql = String::from(
            "SELECT r.id, r.package_name, r.resource_type, r.name, r.description, r.icon,
                    r.author, r.version, r.major_category, r.sub_category, r.tags,
                    r.sort_order, r.enabled, r.source, r.created_at, r.updated_at, r.data_path
             FROM resources r
             JOIN resources_fts fts ON r.rowid = fts.rowid
             WHERE resources_fts MATCH ?1"
        );
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
        // FTS5 查询：添加通配符
        let fts_query = format!("{}*", query.trim());
        param_values.push(Box::new(fts_query));

        if let Some(ref rt) = filter.resource_type {
            sql.push_str(&format!(" AND r.resource_type = ?{}", param_values.len() + 1));
            param_values.push(Box::new(rt.clone()));
        }
        if let Some(ref src) = filter.source {
            sql.push_str(&format!(" AND r.source = ?{}", param_values.len() + 1));
            param_values.push(Box::new(src.clone()));
        }
        if let Some(enabled) = filter.enabled {
            sql.push_str(&format!(" AND r.enabled = ?{}", param_values.len() + 1));
            param_values.push(Box::new(enabled as i32));
        }

        sql.push_str(" ORDER BY rank LIMIT 100");

        let params_refs: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
        let mut stmt = self.db.prepare(&sql)?;
        let rows = stmt.query_map(params_refs.as_slice(), |row| {
            let tags_str: String = row.get(10)?;
            let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
            let enabled_int: i32 = row.get(12)?;
            Ok(ResourceSummary {
                id: row.get(0)?,
                package_name: row.get(1)?,
                resource_type: row.get(2)?,
                name: row.get(3)?,
                description: row.get(4)?,
                icon: row.get(5)?,
                author: row.get(6)?,
                version: row.get(7)?,
                major_category: row.get(8)?,
                sub_category: row.get(9)?,
                tags,
                order: row.get(11)?,
                enabled: enabled_int != 0,
                source: row.get(13)?,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
                data_path: row.get(16)?,
            })
        })?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row?);
        }
        Ok(results)
    }

    /// 获取单个资源详情（含完整 manifest JSON）
    pub fn get(&self, id: &str) -> SqlResult<Option<String>> {
        let mut stmt = self.db.prepare(
            "SELECT extra FROM resources WHERE id = ?1"
        )?;
        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            let extra: String = row.get(0)?;
            Ok(Some(extra))
        } else {
            Ok(None)
        }
    }

    /// 设置资源启用/禁用
    pub fn set_enabled(&self, id: &str, enabled: bool) -> SqlResult<()> {
        self.db.execute(
            "UPDATE resources SET enabled = ?1 WHERE id = ?2",
            params![enabled as i32, id],
        )?;
        Ok(())
    }

    /// 获取资源统计
    pub fn get_stats(&self) -> SqlResult<ResourceStats> {
        let total: u32 = self.db.query_row(
            "SELECT COUNT(*) FROM resources", [], |row| row.get(0)
        )?;

        let mut by_type = std::collections::HashMap::new();
        let mut stmt = self.db.prepare(
            "SELECT resource_type, COUNT(*) FROM resources GROUP BY resource_type"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, u32>(1)?))
        })?;
        for row in rows {
            let (k, v) = row?;
            by_type.insert(k, v);
        }

        let mut by_source = std::collections::HashMap::new();
        let mut stmt = self.db.prepare(
            "SELECT source, COUNT(*) FROM resources GROUP BY source"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, u32>(1)?))
        })?;
        for row in rows {
            let (k, v) = row?;
            by_source.insert(k, v);
        }

        Ok(ResourceStats { total, by_type, by_source })
    }

    /// 列出分类
    pub fn list_categories(&self, resource_type: &str) -> SqlResult<Vec<CategoryInfo>> {
        let mut stmt = self.db.prepare(
            "SELECT key, name, icon, parent_key, sort_order, resource_type
             FROM categories WHERE resource_type = ?1
             ORDER BY sort_order ASC"
        )?;
        let rows = stmt.query_map(params![resource_type], |row| {
            Ok(CategoryInfo {
                key: row.get(0)?,
                name: row.get(1)?,
                icon: row.get(2)?,
                parent_key: row.get(3)?,
                order: row.get(4)?,
                resource_type: row.get(5)?,
            })
        })?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row?);
        }
        Ok(results)
    }

    /// 删除资源
    pub fn delete(&self, id: &str) -> SqlResult<()> {
        self.db.execute("DELETE FROM resources WHERE id = ?1", params![id])?;
        self.rebuild_fts()?;
        Ok(())
    }

    /// 获取资源数量
    pub fn count(&self, resource_type: Option<&str>) -> SqlResult<u32> {
        if let Some(rt) = resource_type {
            self.db.query_row(
                "SELECT COUNT(*) FROM resources WHERE resource_type = ?1",
                params![rt],
                |row| row.get(0),
            )
        } else {
            self.db.query_row("SELECT COUNT(*) FROM resources", [], |row| row.get(0))
        }
    }
}

// ============================================================
// 全局引擎实例
// ============================================================

use std::sync::Mutex;

pub struct ResourceEngineState(pub Mutex<Option<ResourceEngine>>);

impl ResourceEngineState {
    pub fn new() -> Self {
        Self(Mutex::new(None))
    }

    /// 初始化引擎（应用启动时调用）
    pub fn init(&self, data_root: PathBuf) -> Result<(), String> {
        let engine = ResourceEngine::init(data_root)
            .map_err(|e| format!("资源引擎初始化失败: {}", e))?;
        let mut guard = self.0.lock().map_err(|e| format!("锁获取失败: {}", e))?;
        *guard = Some(engine);
        Ok(())
    }

    /// 获取引擎引用并执行操作
    pub fn with_engine<F, R>(&self, f: F) -> Result<R, String>
    where
        F: FnOnce(&ResourceEngine) -> SqlResult<R>,
    {
        let guard = self.0.lock().map_err(|e| format!("锁获取失败: {}", e))?;
        let engine = guard.as_ref().ok_or("资源引擎未初始化")?;
        f(engine).map_err(|e| format!("资源引擎错误: {}", e))
    }
}
