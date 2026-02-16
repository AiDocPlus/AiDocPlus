use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub icon: String,
    #[serde(default)]
    pub author: String,
    #[serde(rename = "type", default = "default_plugin_type")]
    pub plugin_type: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(rename = "createdAt", default)]
    pub created_at: i64,
    #[serde(rename = "updatedAt", default)]
    pub updated_at: i64,
    #[serde(default, rename = "majorCategory")]
    pub major_category: String,
    #[serde(default, rename = "subCategory")]
    pub sub_category: String,
    #[serde(default)]
    pub category: String,
    #[serde(default)]
    pub tags: Vec<String>,
    // ── 插件市场预留字段 ──
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub homepage: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub license: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "minAppVersion")]
    pub min_app_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub permissions: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dependencies: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub conflicts: Option<Vec<String>>,
}

fn default_plugin_type() -> String {
    "external".to_string()
}

fn default_true() -> bool {
    true
}

/// 获取插件目录路径
pub fn get_plugins_dir() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join("AiDocPlus").join("Plugins")
}

/// 确保插件目录存在（应用启动时调用）
pub fn ensure_plugins_dir() {
    let plugins_dir = get_plugins_dir();
    if let Err(e) = fs::create_dir_all(&plugins_dir) {
        eprintln!("Failed to create plugins directory: {}", e);
    }
}

/// 同步插件 manifest 到磁盘（幂等）
/// 前端发现插件后调用，将 manifest 写入 ~/AiDocPlus/Plugins/{id}/manifest.json
/// 如果已存在，保留用户修改的 enabled 状态，只更新元数据
pub fn sync_plugin_manifests(manifests: Vec<PluginManifest>) -> Result<(), String> {
    let plugins_dir = get_plugins_dir();
    fs::create_dir_all(&plugins_dir).map_err(|e| format!("Failed to create plugins dir: {}", e))?;

    let now = chrono::Utc::now().timestamp();

    for mut manifest in manifests {
        let plugin_dir = plugins_dir.join(&manifest.id);
        fs::create_dir_all(&plugin_dir)
            .map_err(|e| format!("Failed to create plugin dir {}: {}", manifest.id, e))?;

        let manifest_path = plugin_dir.join("manifest.json");

        if manifest_path.exists() {
            // 已存在：保留用户的 enabled 状态和时间戳
            if let Ok(existing_json) = fs::read_to_string(&manifest_path) {
                if let Ok(existing) = serde_json::from_str::<PluginManifest>(&existing_json) {
                    manifest.enabled = existing.enabled;
                    manifest.created_at = existing.created_at;
                    manifest.updated_at = existing.updated_at;
                }
            }
        } else {
            // 首次写入：设置时间戳
            manifest.created_at = now;
            manifest.updated_at = now;
        }

        let json = serde_json::to_string_pretty(&manifest)
            .map_err(|e| format!("Failed to serialize manifest {}: {}", manifest.id, e))?;
        fs::write(&manifest_path, json)
            .map_err(|e| format!("Failed to write manifest {}: {}", manifest.id, e))?;
    }

    Ok(())
}

/// 扫描插件目录，返回所有 manifest
pub fn list_plugins() -> Vec<PluginManifest> {
    let plugins_dir = get_plugins_dir();
    if !plugins_dir.exists() {
        return Vec::new();
    }

    let mut plugins = Vec::new();
    if let Ok(entries) = fs::read_dir(&plugins_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let manifest_path = path.join("manifest.json");
            if !manifest_path.exists() {
                continue;
            }
            match fs::read_to_string(&manifest_path) {
                Ok(json) => match serde_json::from_str::<PluginManifest>(&json) {
                    Ok(manifest) => plugins.push(manifest),
                    Err(e) => eprintln!("Failed to parse manifest {:?}: {}", manifest_path, e),
                },
                Err(e) => eprintln!("Failed to read manifest {:?}: {}", manifest_path, e),
            }
        }
    }

    plugins
}

/// 修改指定插件的 enabled 状态
pub fn set_plugin_enabled(plugin_id: &str, enabled: bool) -> Result<(), String> {
    let plugins_dir = get_plugins_dir();
    let manifest_path = plugins_dir.join(plugin_id).join("manifest.json");

    if !manifest_path.exists() {
        return Err(format!("Plugin not found: {}", plugin_id));
    }

    let json = fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read manifest: {}", e))?;
    let mut manifest: PluginManifest = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse manifest: {}", e))?;

    manifest.enabled = enabled;
    manifest.updated_at = chrono::Utc::now().timestamp();

    let updated_json = serde_json::to_string_pretty(&manifest)
        .map_err(|e| format!("Failed to serialize manifest: {}", e))?;
    fs::write(&manifest_path, updated_json)
        .map_err(|e| format!("Failed to write manifest: {}", e))?;

    Ok(())
}
