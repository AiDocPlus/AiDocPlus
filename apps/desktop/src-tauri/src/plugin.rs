use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// 内置插件 UUID 常量
pub const PLUGIN_ID_PPT: &str = "550e8400-e29b-41d4-a716-446655440001";
pub const PLUGIN_ID_QUIZ: &str = "550e8400-e29b-41d4-a716-446655440002";
pub const PLUGIN_ID_SUMMARY: &str = "550e8400-e29b-41d4-a716-446655440003";
pub const PLUGIN_ID_MINDMAP: &str = "550e8400-e29b-41d4-a716-446655440004";
pub const PLUGIN_ID_TRANSLATION: &str = "550e8400-e29b-41d4-a716-446655440005";
pub const PLUGIN_ID_DIAGRAM: &str = "550e8400-e29b-41d4-a716-446655440006";
pub const PLUGIN_ID_ANALYTICS: &str = "550e8400-e29b-41d4-a716-446655440007";
pub const PLUGIN_ID_LESSONPLAN: &str = "550e8400-e29b-41d4-a716-446655440008";
pub const PLUGIN_ID_TABLE: &str = "550e8400-e29b-41d4-a716-446655440009";
pub const PLUGIN_ID_EMAIL: &str = "550e8400-e29b-41d4-a716-446655440010";

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
    "builtin".to_string()
}

fn default_true() -> bool {
    true
}

/// 获取插件目录路径
pub fn get_plugins_dir() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join("AiDocPlus").join("Plugins")
}

/// 初始化内置插件（幂等：仅在对应 UUID 文件夹不存在时写入）
pub fn init_builtin_plugins() {
    let plugins_dir = get_plugins_dir();
    if let Err(e) = fs::create_dir_all(&plugins_dir) {
        eprintln!("Failed to create plugins directory: {}", e);
        return;
    }

    let now = chrono::Utc::now().timestamp();

    let builtin_plugins = vec![
        PluginManifest {
            id: PLUGIN_ID_PPT.to_string(),
            name: "生成 PPT".to_string(),
            version: "1.0.0".to_string(),
            description: "根据文档内容 AI 生成演示文稿".to_string(),
            icon: "Presentation".to_string(),
            author: "AiDocPlus".to_string(),
            plugin_type: "builtin".to_string(),
            enabled: true,
            created_at: now,
            updated_at: now,
            major_category: "content-generation".to_string(),
            sub_category: "visualization".to_string(),
            category: "visualization".to_string(),
            tags: vec!["ppt".into(), "演示文稿".into(), "presentation".into(), "slides".into()],
            homepage: None, license: None, min_app_version: None,
            permissions: None, dependencies: None, conflicts: None,
        },
        PluginManifest {
            id: PLUGIN_ID_QUIZ.to_string(),
            name: "生成测试题".to_string(),
            version: "1.0.0".to_string(),
            description: "根据文档内容 AI 生成单选、多选、判断题".to_string(),
            icon: "ClipboardList".to_string(),
            author: "AiDocPlus".to_string(),
            plugin_type: "builtin".to_string(),
            enabled: true,
            created_at: now,
            updated_at: now,
            major_category: "content-generation".to_string(),
            sub_category: "ai-text".to_string(),
            category: "ai-text".to_string(),
            tags: vec!["quiz".into(), "测试".into(), "考试".into(), "题目".into()],
            homepage: None, license: None, min_app_version: None,
            permissions: None, dependencies: None, conflicts: None,
        },
        PluginManifest {
            id: PLUGIN_ID_SUMMARY.to_string(),
            name: "文档摘要".to_string(),
            version: "1.0.0".to_string(),
            description: "AI 提炼文档要点、生成多种风格摘要".to_string(),
            icon: "FileText".to_string(),
            author: "AiDocPlus".to_string(),
            plugin_type: "builtin".to_string(),
            enabled: true,
            created_at: now,
            updated_at: now,
            major_category: "content-generation".to_string(),
            sub_category: "ai-text".to_string(),
            category: "ai-text".to_string(),
            tags: vec!["summary".into(), "摘要".into(), "要点".into(), "概括".into()],
            homepage: None, license: None, min_app_version: None,
            permissions: None, dependencies: None, conflicts: None,
        },
        PluginManifest {
            id: PLUGIN_ID_MINDMAP.to_string(),
            name: "思维导图".to_string(),
            version: "1.0.0".to_string(),
            description: "AI 分析文档内容生成思维导图".to_string(),
            icon: "Brain".to_string(),
            author: "AiDocPlus".to_string(),
            plugin_type: "builtin".to_string(),
            enabled: true,
            created_at: now,
            updated_at: now,
            major_category: "content-generation".to_string(),
            sub_category: "visualization".to_string(),
            category: "visualization".to_string(),
            tags: vec!["mindmap".into(), "导图".into(), "结构".into(), "脑图".into()],
            homepage: None, license: None, min_app_version: None,
            permissions: None, dependencies: None, conflicts: None,
        },
        PluginManifest {
            id: PLUGIN_ID_TRANSLATION.to_string(),
            name: "翻译".to_string(),
            version: "1.0.0".to_string(),
            description: "AI 将文档内容翻译为多种语言".to_string(),
            icon: "Languages".to_string(),
            author: "AiDocPlus".to_string(),
            plugin_type: "builtin".to_string(),
            enabled: true,
            created_at: now,
            updated_at: now,
            major_category: "content-generation".to_string(),
            sub_category: "ai-text".to_string(),
            category: "ai-text".to_string(),
            tags: vec!["translation".into(), "翻译".into(), "多语言".into(), "英语".into()],
            homepage: None, license: None, min_app_version: None,
            permissions: None, dependencies: None, conflicts: None,
        },
        PluginManifest {
            id: PLUGIN_ID_DIAGRAM.to_string(),
            name: "Mermaid 图表".to_string(),
            version: "1.0.0".to_string(),
            description: "AI 生成流程图、时序图、类图等 Mermaid 图表".to_string(),
            icon: "GitBranch".to_string(),
            author: "AiDocPlus".to_string(),
            plugin_type: "builtin".to_string(),
            enabled: true,
            created_at: now,
            updated_at: now,
            major_category: "content-generation".to_string(),
            sub_category: "visualization".to_string(),
            category: "visualization".to_string(),
            tags: vec!["diagram".into(), "图表".into(), "流程图".into(), "mermaid".into(), "时序图".into()],
            homepage: None, license: None, min_app_version: None,
            permissions: None, dependencies: None, conflicts: None,
        },
        PluginManifest {
            id: PLUGIN_ID_ANALYTICS.to_string(),
            name: "文档统计".to_string(),
            version: "1.0.0".to_string(),
            description: "字数、阅读时间、关键词频率等统计分析".to_string(),
            icon: "BarChart3".to_string(),
            author: "AiDocPlus".to_string(),
            plugin_type: "builtin".to_string(),
            enabled: true,
            created_at: now,
            updated_at: now,
            major_category: "content-generation".to_string(),
            sub_category: "analysis".to_string(),
            category: "analysis".to_string(),
            tags: vec!["analytics".into(), "统计".into(), "字数".into(), "词频".into(), "阅读时间".into()],
            homepage: None, license: None, min_app_version: None,
            permissions: None, dependencies: None, conflicts: None,
        },
        PluginManifest {
            id: PLUGIN_ID_LESSONPLAN.to_string(),
            name: "教案生成".to_string(),
            version: "1.0.0".to_string(),
            description: "AI 根据文档内容生成结构化教案".to_string(),
            icon: "BookOpen".to_string(),
            author: "AiDocPlus".to_string(),
            plugin_type: "builtin".to_string(),
            enabled: true,
            created_at: now,
            updated_at: now,
            major_category: "content-generation".to_string(),
            sub_category: "ai-text".to_string(),
            category: "ai-text".to_string(),
            tags: vec!["lesson".into(), "教案".into(), "教学".into(), "课程".into()],
            homepage: None, license: None, min_app_version: None,
            permissions: None, dependencies: None, conflicts: None,
        },
        PluginManifest {
            id: PLUGIN_ID_TABLE.to_string(),
            name: "表格编辑器".to_string(),
            version: "1.0.0".to_string(),
            description: "创建和编辑表格，支持导出为 Excel 文件".to_string(),
            icon: "Table2".to_string(),
            author: "AiDocPlus".to_string(),
            plugin_type: "builtin".to_string(),
            enabled: true,
            created_at: now,
            updated_at: now,
            major_category: "content-generation".to_string(),
            sub_category: "data".to_string(),
            category: "data".to_string(),
            tags: vec!["table".into(), "表格".into(), "excel".into(), "xlsx".into(), "数据".into()],
            homepage: None, license: None, min_app_version: None,
            permissions: None, dependencies: None, conflicts: None,
        },
        PluginManifest {
            id: PLUGIN_ID_EMAIL.to_string(),
            name: "邮件发送".to_string(),
            version: "1.0.0".to_string(),
            description: "AI 辅助撰写邮件正文，通过 SMTP 直接发送文档内容".to_string(),
            icon: "Mail".to_string(),
            author: "AiDocPlus".to_string(),
            plugin_type: "builtin".to_string(),
            enabled: true,
            created_at: now,
            updated_at: now,
            major_category: "functional".to_string(),
            sub_category: "communication".to_string(),
            category: "communication".to_string(),
            tags: vec!["email".into(), "邮件".into(), "发送".into(), "smtp".into(), "协作".into()],
            homepage: None, license: None, min_app_version: None,
            permissions: None, dependencies: None, conflicts: None,
        },
    ];

    for manifest in builtin_plugins {
        let plugin_dir = plugins_dir.join(&manifest.id);
        if let Err(e) = fs::create_dir_all(&plugin_dir) {
            eprintln!("Failed to create plugin directory {}: {}", manifest.id, e);
            continue;
        }
        let manifest_path = plugin_dir.join("manifest.json");
        match serde_json::to_string_pretty(&manifest) {
            Ok(json) => {
                if let Err(e) = fs::write(&manifest_path, json) {
                    eprintln!("Failed to write manifest for {}: {}", manifest.id, e);
                }
            }
            Err(e) => {
                eprintln!("Failed to serialize manifest for {}: {}", manifest.id, e);
            }
        }
    }
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
