use crate::types::MetaConfig;
use std::fs;
use std::path::Path;

/// 读取 _meta.json 分类配置
pub fn read_meta(data_dir: &str) -> Result<MetaConfig, String> {
    let meta_path = Path::new(data_dir).join("_meta.json");
    eprintln!("[DEBUG] read_meta: meta_path={}", meta_path.display());
    if !meta_path.exists() {
        eprintln!("[DEBUG] read_meta: _meta.json 不存在!");
        return Ok(MetaConfig {
            schema_version: "1.0".to_string(),
            resource_type: String::new(),
            categories: Vec::new(),
        });
    }
    let content =
        fs::read_to_string(&meta_path).map_err(|e| format!("读取 _meta.json 失败: {}", e))?;
    serde_json::from_str(&content).map_err(|e| format!("解析 _meta.json 失败: {}", e))
}

/// 保存 _meta.json 分类配置
pub fn save_meta(data_dir: &str, meta: MetaConfig) -> Result<(), String> {
    let meta_path = Path::new(data_dir).join("_meta.json");
    let content = serde_json::to_string_pretty(&meta)
        .map_err(|e| format!("序列化 _meta.json 失败: {}", e))?;
    fs::write(&meta_path, content).map_err(|e| format!("写入 _meta.json 失败: {}", e))
}
