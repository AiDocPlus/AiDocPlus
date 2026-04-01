#![allow(dead_code)] // 长篇小说写作功能预留代码，后续开发使用

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

/// 获取小说设定集文件路径（含安全校验）
fn novel_settings_path(project_id: &str) -> crate::error::Result<PathBuf> {
    crate::security::validate_id(project_id, "projectId")?;
    let data_root = config::current_data_root();
    Ok(data_root
        .join("Projects")
        .join(project_id)
        .join("novel-settings.json"))
}

/// 加载小说设定集
#[tauri::command]
pub fn load_novel_settings(project_id: String) -> crate::error::Result<Option<NovelSettings>> {
    let path = novel_settings_path(&project_id)?;
    if !path.exists() {
        return Ok(None);
    }
    let content = std::fs::read_to_string(&path).context("读取小说设定集失败")?;
    let settings: NovelSettings = serde_json::from_str(&content).context("解析小说设定集失败")?;
    Ok(Some(settings))
}

/// 保存小说设定集
#[tauri::command]
pub fn save_novel_settings(
    project_id: String,
    settings: NovelSettings,
) -> crate::error::Result<()> {
    let path = novel_settings_path(&project_id)?;
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
    let path = novel_settings_path(&project_id)?;
    if path.exists() {
        std::fs::remove_file(&path).context("删除小说设定集失败")?;
    }
    Ok(())
}

// ═══ 风格语料库 CRUD ═══

/// 获取风格语料库目录路径（含安全校验）
fn style_corpus_dir(project_id: &str) -> crate::error::Result<PathBuf> {
    crate::security::validate_id(project_id, "projectId")?;
    let data_root = config::current_data_root();
    Ok(data_root
        .join("Projects")
        .join(project_id)
        .join("style-corpus"))
}

/// 加载风格语料库列表
#[tauri::command]
pub fn load_style_corpus_list(project_id: String) -> crate::error::Result<Vec<serde_json::Value>> {
    let dir = style_corpus_dir(&project_id)?;
    if !dir.exists() {
        return Ok(vec![]);
    }
    let index_path = dir.join("index.json");
    if !index_path.exists() {
        return Ok(vec![]);
    }
    let content = std::fs::read_to_string(&index_path).context("读取风格语料库索引失败")?;
    let list: Vec<serde_json::Value> =
        serde_json::from_str(&content).context("解析风格语料库索引失败")?;
    Ok(list)
}

/// 保存风格语料库列表
#[tauri::command]
pub fn save_style_corpus_list(
    project_id: String,
    list: Vec<serde_json::Value>,
) -> crate::error::Result<()> {
    let dir = style_corpus_dir(&project_id)?;
    std::fs::create_dir_all(&dir).context("创建风格语料库目录失败")?;
    let index_path = dir.join("index.json");
    let json = serde_json::to_string_pretty(&list).context("序列化风格语料库索引失败")?;
    config::atomic_write(&index_path, &json)?;
    Ok(())
}

/// 保存风格语料库的单个文本文件
#[tauri::command]
pub fn save_style_corpus_file(
    project_id: String,
    corpus_id: String,
    file_name: String,
    content: String,
) -> crate::error::Result<String> {
    crate::security::validate_id(&corpus_id, "corpusId")?;
    if file_name.contains('/') || file_name.contains('\\') || file_name.contains("..") {
        return Err(crate::error::AppError::SecurityError("文件名包含非法字符".to_string()));
    }
    let dir = style_corpus_dir(&project_id)?.join(&corpus_id);
    std::fs::create_dir_all(&dir).context("创建语料库文件目录失败")?;
    let file_path = dir.join(&file_name);
    config::atomic_write(&file_path, &content)?;
    Ok(file_path.to_string_lossy().to_string())
}

/// 读取风格语料库的单个文本文件
#[tauri::command]
pub fn read_style_corpus_file(
    project_id: String,
    corpus_id: String,
    file_name: String,
) -> crate::error::Result<String> {
    crate::security::validate_id(&corpus_id, "corpusId")?;
    let file_path = style_corpus_dir(&project_id)?
        .join(&corpus_id)
        .join(&file_name);
    let content = std::fs::read_to_string(&file_path).context("读取语料库文件失败")?;
    Ok(content)
}

/// 删除风格语料库
#[tauri::command]
pub fn delete_style_corpus(project_id: String, corpus_id: String) -> crate::error::Result<()> {
    crate::security::validate_id(&corpus_id, "corpusId")?;
    let dir = style_corpus_dir(&project_id)?.join(&corpus_id);
    if dir.exists() {
        std::fs::remove_dir_all(&dir).context("删除语料库目录失败")?;
    }
    Ok(())
}

/// 读取风格语料库所有文件内容（用于 AI 分析）
#[tauri::command]
pub fn read_style_corpus_all_files(
    project_id: String,
    corpus_id: String,
) -> crate::error::Result<Vec<StyleCorpusFileContent>> {
    crate::security::validate_id(&corpus_id, "corpusId")?;
    let dir = style_corpus_dir(&project_id)?.join(&corpus_id);
    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut files = vec![];
    for entry in std::fs::read_dir(&dir).context("读取语料库目录失败")? {
        let entry = entry.context("读取目录条目失败")?;
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension() {
                if ext == "txt" || ext == "md" {
                    let content = std::fs::read_to_string(&path).context("读取语料库文件失败")?;
                    let file_name = path
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_else(|| "unnamed".to_string());
                    let word_count = content.chars().filter(|c| !c.is_whitespace()).count() as u32;
                    files.push(StyleCorpusFileContent {
                        file_name,
                        content,
                        word_count,
                    });
                }
            }
        }
    }
    Ok(files)
}

/// 风格语料库文件内容
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StyleCorpusFileContent {
    pub file_name: String,
    pub content: String,
    pub word_count: u32,
}

/// 保存风格画像（AI 分析结果）
#[tauri::command]
pub fn save_style_profile(
    project_id: String,
    corpus_id: String,
    profile: serde_json::Value,
) -> crate::error::Result<()> {
    crate::security::validate_id(&corpus_id, "corpusId")?;
    let dir = style_corpus_dir(&project_id)?.join(&corpus_id);
    std::fs::create_dir_all(&dir).context("创建语料库目录失败")?;
    let profile_path = dir.join("style-profile.json");
    let json = serde_json::to_string_pretty(&profile).context("序列化风格画像失败")?;
    config::atomic_write(&profile_path, &json)?;
    Ok(())
}

/// 读取风格画像
#[tauri::command]
pub fn read_style_profile(
    project_id: String,
    corpus_id: String,
) -> crate::error::Result<Option<serde_json::Value>> {
    crate::security::validate_id(&corpus_id, "corpusId")?;
    let profile_path = style_corpus_dir(&project_id)?
        .join(&corpus_id)
        .join("style-profile.json");
    if !profile_path.exists() {
        return Ok(None);
    }
    let content = std::fs::read_to_string(&profile_path).context("读取风格画像失败")?;
    let profile: serde_json::Value = serde_json::from_str(&content).context("解析风格画像失败")?;
    Ok(Some(profile))
}

/// 保存文本块索引（用于 RAG 检索）
#[tauri::command]
pub fn save_style_chunks_index(
    project_id: String,
    corpus_id: String,
    chunks: Vec<serde_json::Value>,
) -> crate::error::Result<()> {
    crate::security::validate_id(&corpus_id, "corpusId")?;
    let dir = style_corpus_dir(&project_id)?.join(&corpus_id);
    std::fs::create_dir_all(&dir).context("创建语料库目录失败")?;
    let chunks_path = dir.join("chunks-index.json");
    let json = serde_json::to_string_pretty(&chunks).context("序列化文本块索引失败")?;
    config::atomic_write(&chunks_path, &json)?;
    Ok(())
}

/// 读取文本块索引
#[tauri::command]
pub fn read_style_chunks_index(
    project_id: String,
    corpus_id: String,
) -> crate::error::Result<Vec<serde_json::Value>> {
    crate::security::validate_id(&corpus_id, "corpusId")?;
    let chunks_path = style_corpus_dir(&project_id)?
        .join(&corpus_id)
        .join("chunks-index.json");
    if !chunks_path.exists() {
        return Ok(vec![]);
    }
    let content = std::fs::read_to_string(&chunks_path).context("读取文本块索引失败")?;
    let chunks: Vec<serde_json::Value> =
        serde_json::from_str(&content).context("解析文本块索引失败")?;
    Ok(chunks)
}
