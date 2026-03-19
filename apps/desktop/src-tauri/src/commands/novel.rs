use crate::config;
use crate::error::ResultExt;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// 小说设定集 JSON 结构（与前端 NovelSettings 对应）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NovelSettings {
    #[serde(default)]
    pub genre: String,
    #[serde(default)]
    pub era: String,
    #[serde(default)]
    pub style: String,
    #[serde(default)]
    pub synopsis: String,
    #[serde(default)]
    pub world_view: String,
    #[serde(default)]
    pub outline_global: String,
    #[serde(default)]
    pub characters: Vec<serde_json::Value>,
    #[serde(default)]
    pub locations: Vec<serde_json::Value>,
    #[serde(default)]
    pub factions: Vec<serde_json::Value>,
    #[serde(default)]
    pub custom_entries: Vec<serde_json::Value>,
    #[serde(default)]
    pub timeline: Vec<serde_json::Value>,
    #[serde(default)]
    pub foreshadowing: Vec<serde_json::Value>,
    #[serde(default)]
    pub style_corpus_ids: Option<Vec<String>>,
    #[serde(default)]
    pub style_corpus_weights: Option<serde_json::Value>,
}

/// 获取小说设定集文件路径
fn novel_settings_path(project_id: &str) -> PathBuf {
    let data_root = config::current_data_root();
    data_root
        .join("Projects")
        .join(project_id)
        .join("novel-settings.json")
}

/// 加载小说设定集
#[tauri::command]
pub fn load_novel_settings(project_id: String) -> crate::error::Result<Option<NovelSettings>> {
    let path = novel_settings_path(&project_id);
    if !path.exists() {
        return Ok(None);
    }
    let content = std::fs::read_to_string(&path).context("读取小说设定集失败")?;
    let settings: NovelSettings = serde_json::from_str(&content).context("解析小说设定集失败")?;
    Ok(Some(settings))
}

/// 保存小说设定集
#[tauri::command]
pub fn save_novel_settings(project_id: String, settings: NovelSettings) -> crate::error::Result<()> {
    let path = novel_settings_path(&project_id);

    // 确保项目目录存在
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).context("创建项目目录失败")?;
    }

    // 原子写入
    let json = serde_json::to_string_pretty(&settings).context("序列化小说设定集失败")?;
    config::atomic_write(&path, &json)?;
    Ok(())
}

/// 删除小说设定集（项目转为非小说项目时调用）
#[tauri::command]
pub fn delete_novel_settings(project_id: String) -> crate::error::Result<()> {
    let path = novel_settings_path(&project_id);
    if path.exists() {
        std::fs::remove_file(&path).context("删除小说设定集失败")?;
    }
    Ok(())
}

// ═══ 风格语料库 CRUD ═══

/// 获取风格语料库目录路径
fn style_corpus_dir(project_id: &str) -> PathBuf {
    let data_root = config::current_data_root();
    data_root
        .join("Projects")
        .join(project_id)
        .join("style-corpus")
}

/// 加载风格语料库列表
#[tauri::command]
pub fn load_style_corpus_list(project_id: String) -> crate::error::Result<Vec<serde_json::Value>> {
    let dir = style_corpus_dir(&project_id);
    if !dir.exists() {
        return Ok(vec![]);
    }
    let index_path = dir.join("index.json");
    if !index_path.exists() {
        return Ok(vec![]);
    }
    let content = std::fs::read_to_string(&index_path).context("读取风格语料库索引失败")?;
    let list: Vec<serde_json::Value> = serde_json::from_str(&content).context("解析风格语料库索引失败")?;
    Ok(list)
}

/// 保存风格语料库列表
#[tauri::command]
pub fn save_style_corpus_list(project_id: String, list: Vec<serde_json::Value>) -> crate::error::Result<()> {
    let dir = style_corpus_dir(&project_id);
    std::fs::create_dir_all(&dir).context("创建风格语料库目录失败")?;
    let index_path = dir.join("index.json");
    let json = serde_json::to_string_pretty(&list).context("序列化风格语料库索引失败")?;
    config::atomic_write(&index_path, &json)?;
    Ok(())
}

/// 保存风格语料库的单个文本文件
#[tauri::command]
pub fn save_style_corpus_file(project_id: String, corpus_id: String, file_name: String, content: String) -> crate::error::Result<String> {
    let dir = style_corpus_dir(&project_id).join(&corpus_id);
    std::fs::create_dir_all(&dir).context("创建语料库文件目录失败")?;
    let file_path = dir.join(&file_name);
    config::atomic_write(&file_path, &content)?;
    Ok(file_path.to_string_lossy().to_string())
}

/// 读取风格语料库的单个文本文件
#[tauri::command]
pub fn read_style_corpus_file(project_id: String, corpus_id: String, file_name: String) -> crate::error::Result<String> {
    let file_path = style_corpus_dir(&project_id).join(&corpus_id).join(&file_name);
    let content = std::fs::read_to_string(&file_path).context("读取语料库文件失败")?;
    Ok(content)
}

/// 删除风格语料库
#[tauri::command]
pub fn delete_style_corpus(project_id: String, corpus_id: String) -> crate::error::Result<()> {
    let dir = style_corpus_dir(&project_id).join(&corpus_id);
    if dir.exists() {
        std::fs::remove_dir_all(&dir).context("删除语料库目录失败")?;
    }
    Ok(())
}
