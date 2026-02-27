use serde::{Deserialize, Serialize};

// ============================================================
// 资源摘要（列表展示用）
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceSummary {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    #[serde(rename = "majorCategory")]
    pub major_category: String,
    #[serde(rename = "subCategory")]
    pub sub_category: String,
    pub tags: Vec<String>,
    pub order: i32,
    pub enabled: bool,
    pub source: String,
    pub path: String,
}

// ============================================================
// _meta.json 分类结构
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetaConfig {
    #[serde(default, rename = "schemaVersion")]
    pub schema_version: String,
    #[serde(default, rename = "resourceType")]
    pub resource_type: String,
    #[serde(default)]
    pub categories: Vec<CategoryDefinition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryDefinition {
    pub key: String,
    pub name: String,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub order: i32,
    #[serde(default, rename = "subCategories")]
    pub sub_categories: Vec<SubCategoryDefinition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubCategoryDefinition {
    pub key: String,
    pub name: String,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub order: i32,
}

// ============================================================
// 通用 manifest（从 JSON 读取）
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenericManifest {
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub icon: String,
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub author: serde_json::Value,
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
    #[serde(default)]
    pub roles: Vec<String>,
    #[serde(default, rename = "createdAt")]
    pub created_at: String,
    #[serde(default, rename = "updatedAt")]
    pub updated_at: String,
}

fn default_true() -> bool {
    true
}
fn default_builtin() -> String {
    "builtin".to_string()
}

impl GenericManifest {
    pub fn author_name(&self) -> String {
        match &self.author {
            serde_json::Value::String(s) => s.clone(),
            serde_json::Value::Object(obj) => obj
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            _ => String::new(),
        }
    }

    pub fn to_summary(&self, path: String) -> ResourceSummary {
        ResourceSummary {
            id: self.id.clone(),
            name: self.name.clone(),
            description: self.description.clone(),
            icon: self.icon.clone(),
            major_category: self.major_category.clone(),
            sub_category: self.sub_category.clone(),
            tags: self.tags.clone(),
            order: self.order,
            enabled: self.enabled,
            source: self.source.clone(),
            path,
        }
    }
}

// ============================================================
// AI 服务配置
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIServiceConfig {
    #[serde(rename = "baseUrl")]
    pub base_url: String,
    #[serde(rename = "apiKey")]
    pub api_key: String,
    pub model: String,
    #[serde(default = "default_max_tokens", rename = "maxTokens")]
    pub max_tokens: u32,
    #[serde(default = "default_temperature")]
    pub temperature: f32,
}

fn default_max_tokens() -> u32 {
    0
}
fn default_temperature() -> f32 {
    0.7
}

// ============================================================
// 主程序共享的 AI 服务列表（~/.aidocplus/ai-services.json）
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SharedAIServices {
    #[serde(default)]
    pub services: Vec<SharedAIServiceItem>,
    #[serde(default, rename = "activeServiceId")]
    pub active_service_id: String,
    #[serde(default = "default_temperature")]
    pub temperature: f32,
    #[serde(default = "default_max_tokens", rename = "maxTokens")]
    pub max_tokens: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SharedAIServiceItem {
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub provider: String,
    #[serde(default, rename = "apiKey")]
    pub api_key: String,
    #[serde(default)]
    pub model: String,
    #[serde(default, rename = "baseUrl")]
    pub base_url: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

// ============================================================
// 资源管理器本地 AI 服务列表（~/.aidocplus/manager-ai-services.json）
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalAIServices {
    #[serde(default)]
    pub services: Vec<LocalAIServiceItem>,
    #[serde(default, rename = "activeServiceId")]
    pub active_service_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalAIServiceItem {
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub provider: String,
    #[serde(default, rename = "baseUrl")]
    pub base_url: String,
    #[serde(default, rename = "apiKey")]
    pub api_key: String,
    #[serde(default)]
    pub model: String,
    #[serde(default = "default_max_tokens", rename = "maxTokens")]
    pub max_tokens: u32,
    #[serde(default = "default_temperature")]
    pub temperature: f32,
}

// ============================================================
// 内容文件
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentFileEntry {
    pub filename: String,
    pub content: String,
}

// ============================================================
// 批量操作
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchUpdateRequest {
    #[serde(rename = "resourcePaths")]
    pub resource_paths: Vec<String>,
    pub field: String,
    pub value: serde_json::Value,
}
