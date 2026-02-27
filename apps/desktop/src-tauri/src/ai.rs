#![allow(dead_code)]

use serde::{Deserialize, Serialize};

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
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
    pub fn get_base_url(&self) -> String {
        if let Some(url) = &self.base_url {
            return url.clone();
        }

        match self.provider.as_str() {
            "openai" => "https://api.openai.com/v1".to_string(),
            "anthropic" => "https://api.anthropic.com/v1".to_string(),
            "gemini" => "https://generativelanguage.googleapis.com/v1beta/openai".to_string(),
            "xai" => "https://api.x.ai/v1".to_string(),
            "deepseek" => "https://api.deepseek.com".to_string(),
            "qwen" => "https://dashscope.aliyuncs.com/compatible-mode/v1".to_string(),
            "glm" => "https://open.bigmodel.cn/api/paas/v4".to_string(),
            "glm-code" => "https://open.bigmodel.cn/api/coding/paas/v4".to_string(),
            "minimax" | "minimax-code" => "https://api.minimaxi.com/v1".to_string(),
            "kimi" => "https://api.moonshot.cn/v1".to_string(),
            "kimi-code" => "https://api.kimi.com/coding/v1".to_string(),
            "litellm" => "http://localhost:4000".to_string(),
            _ => "https://api.openai.com/v1".to_string(),
        }
    }

    pub fn get_default_model(&self) -> String {
        if let Some(model) = &self.model {
            return model.clone();
        }

        match self.provider.as_str() {
            "openai" => "gpt-4.1".to_string(),
            "anthropic" => "claude-opus-4-6".to_string(),
            "gemini" => "gemini-3-flash-preview".to_string(),
            "xai" => "grok-4-0709".to_string(),
            "deepseek" => "deepseek-chat".to_string(),
            "qwen" => "qwen3-max".to_string(),
            "glm" => "glm-5".to_string(),
            "glm-code" => "GLM-5".to_string(),
            "minimax" | "minimax-code" => "MiniMax-M2.5".to_string(),
            "kimi" => "kimi-k2.5".to_string(),
            "kimi-code" => "kimi-for-coding".to_string(),
            "litellm" => "gpt-4.1".to_string(),
            _ => "gpt-4.1".to_string(),
        }
    }
}
