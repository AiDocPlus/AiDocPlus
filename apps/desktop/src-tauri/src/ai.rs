#![allow(dead_code)]

use serde::{Deserialize, Serialize};

/// 提供商认证方式
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum AuthStyle {
    /// Authorization: Bearer <key>
    Bearer,
    /// x-api-key: <key>（Anthropic）
    ApiKeyHeader,
}

/// 提供商默认配置（静态注册表）
#[derive(Debug, Clone)]
pub struct ProviderDefaults {
    pub id: &'static str,
    pub base_url: &'static str,
    pub default_model: &'static str,
    pub auth_style: AuthStyle,
    pub default_temperature: f64,
    pub default_max_tokens: u32,
}

/// 所有已知提供商的静态注册表
pub static PROVIDER_REGISTRY: &[ProviderDefaults] = &[
    ProviderDefaults { id: "openai",       base_url: "https://api.openai.com/v1",                                    default_model: "gpt-4.1",             auth_style: AuthStyle::Bearer,       default_temperature: 0.7, default_max_tokens: 4096 },
    ProviderDefaults { id: "anthropic",    base_url: "https://api.anthropic.com/v1",                                 default_model: "claude-opus-4-6",     auth_style: AuthStyle::ApiKeyHeader,  default_temperature: 0.7, default_max_tokens: 8192 },
    ProviderDefaults { id: "gemini",       base_url: "https://generativelanguage.googleapis.com/v1beta/openai",      default_model: "gemini-3-flash-preview", auth_style: AuthStyle::Bearer,    default_temperature: 0.7, default_max_tokens: 4096 },
    ProviderDefaults { id: "xai",          base_url: "https://api.x.ai/v1",                                         default_model: "grok-4-0709",         auth_style: AuthStyle::Bearer,       default_temperature: 0.7, default_max_tokens: 4096 },
    ProviderDefaults { id: "deepseek",     base_url: "https://api.deepseek.com",                                     default_model: "deepseek-chat",       auth_style: AuthStyle::Bearer,       default_temperature: 0.7, default_max_tokens: 4096 },
    ProviderDefaults { id: "qwen",         base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",            default_model: "qwen3-max",           auth_style: AuthStyle::Bearer,       default_temperature: 0.7, default_max_tokens: 4096 },
    ProviderDefaults { id: "glm",          base_url: "https://open.bigmodel.cn/api/paas/v4",                         default_model: "glm-5",               auth_style: AuthStyle::Bearer,       default_temperature: 1.0, default_max_tokens: 8192 },
    ProviderDefaults { id: "glm-code",     base_url: "https://open.bigmodel.cn/api/coding/paas/v4",                  default_model: "GLM-5",               auth_style: AuthStyle::Bearer,       default_temperature: 1.0, default_max_tokens: 8192 },
    ProviderDefaults { id: "minimax",      base_url: "https://api.minimaxi.com/v1",                                  default_model: "MiniMax-M2.5",        auth_style: AuthStyle::Bearer,       default_temperature: 1.0, default_max_tokens: 8192 },
    ProviderDefaults { id: "minimax-code", base_url: "https://api.minimaxi.com/v1",                                  default_model: "MiniMax-M2.5",        auth_style: AuthStyle::Bearer,       default_temperature: 1.0, default_max_tokens: 8192 },
    ProviderDefaults { id: "kimi",         base_url: "https://api.moonshot.cn/v1",                                   default_model: "kimi-k2.5",           auth_style: AuthStyle::Bearer,       default_temperature: 0.7, default_max_tokens: 4096 },
    ProviderDefaults { id: "kimi-code",    base_url: "https://api.kimi.com/coding/v1",                               default_model: "kimi-for-coding",     auth_style: AuthStyle::Bearer,       default_temperature: 0.7, default_max_tokens: 4096 },
    ProviderDefaults { id: "litellm",      base_url: "http://localhost:4000",                                        default_model: "gpt-4.1",             auth_style: AuthStyle::Bearer,       default_temperature: 0.7, default_max_tokens: 4096 },
];

/// 默认回退配置（未知提供商）
static FALLBACK_DEFAULTS: ProviderDefaults = ProviderDefaults {
    id: "unknown",
    base_url: "https://api.openai.com/v1",
    default_model: "gpt-4.1",
    auth_style: AuthStyle::Bearer,
    default_temperature: 0.7,
    default_max_tokens: 4096,
};

/// 按 provider ID 查找注册表
pub fn get_provider_defaults(provider_id: &str) -> &'static ProviderDefaults {
    PROVIDER_REGISTRY.iter()
        .find(|p| p.id == provider_id)
        .unwrap_or(&FALLBACK_DEFAULTS)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIConfig {
    pub provider: String,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub model: Option<String>,
}

impl Default for AIConfig {
    fn default() -> Self {
        Self {
            provider: "openai".to_string(),
            api_key: None,
            base_url: None,
            model: None,
        }
    }
}

/// 聊天中附带的图片（base64 编码）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatImage {
    /// base64 编码的图片数据（不含 data: 前缀）
    pub data: String,
    /// MIME 类型，如 image/jpeg, image/png
    #[serde(rename = "mimeType")]
    pub mime_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
    /// 多模态图片（仅 user 消息使用）
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub images: Option<Vec<ChatImage>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatRequest {
    pub messages: Vec<ChatMessage>,
    pub model: Option<String>,
    pub temperature: Option<f64>,
    pub max_tokens: Option<u32>,
    pub stream: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResponse {
    pub id: Option<String>,
    pub content: String,
    pub model: Option<String>,
    pub usage: Option<Usage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Usage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

// OpenAI compatible API response format
#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum OpenAIResponse {
    Chat(OpenAIChatResponse),
    Stream(OpenAIStreamChunk),
}

#[derive(Debug, Clone, Deserialize)]
pub struct OpenAIChatResponse {
    pub id: String,
    pub object: String,
    pub created: u64,
    pub model: String,
    pub choices: Vec<Choice>,
    pub usage: Option<OpenAIUsage>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Choice {
    pub index: u32,
    pub message: Option<ChatMessage>,
    pub delta: Option<Delta>,
    pub finish_reason: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Delta {
    pub role: Option<String>,
    pub content: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OpenAIUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OpenAIStreamChunk {
    pub id: String,
    pub object: String,
    pub created: u64,
    pub model: String,
    pub choices: Vec<Choice>,
}

impl AIConfig {
    /// 获取注册表中的 provider 默认配置
    pub fn defaults(&self) -> &'static ProviderDefaults {
        get_provider_defaults(&self.provider)
    }

    pub fn get_base_url(&self) -> String {
        if let Some(url) = &self.base_url {
            return url.clone();
        }
        self.defaults().base_url.to_string()
    }

    pub fn get_default_model(&self) -> String {
        if let Some(model) = &self.model {
            return model.clone();
        }
        self.defaults().default_model.to_string()
    }

    /// 根据 provider 认证方式设置请求头
    pub fn apply_auth(&self, builder: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        match &self.api_key {
            Some(key) => match self.defaults().auth_style {
                AuthStyle::ApiKeyHeader => builder.header("x-api-key", key),
                AuthStyle::Bearer => builder.header("Authorization", format!("Bearer {}", key)),
            },
            None => builder,
        }
    }
}
