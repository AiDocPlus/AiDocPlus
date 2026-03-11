use serde::Serialize;

/// 结构化错误码，前端可据此区分错误类别并显示对应的用户友好消息
#[derive(Debug, Clone, Serialize)]
pub enum ErrorCode {
    /// 文件 / 网络 IO 错误
    IoError,
    /// JSON 序列化 / 反序列化失败
    SerializeError,
    /// 项目未找到
    ProjectNotFound,
    /// 文档未找到
    DocumentNotFound,
    /// 版本未找到
    VersionNotFound,
    /// 输入数据校验失败（ID / 标题 / 内容大小等）
    ValidationError,
    /// 导出失败
    ExportFailed,
    /// 导入失败
    ImportFailed,
    /// AI 服务错误
    AiError,
    /// 安全相关（路径遍历、ZIP 攻击等）
    SecurityError,
    /// 资源 / 凭证 / 设置操作失败
    ResourceError,
    /// 外部工具（Python / Node / Pandoc 等）执行失败
    ExternalToolError,
    /// 其他 / 未分类错误
    Internal,
}

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    Io(#[from] std::io::Error),

    #[error("{0}")]
    Serde(#[from] serde_json::Error),

    #[error("{0}")]
    ProjectNotFound(String),

    #[error("{0}")]
    DocumentNotFound(String),

    #[error("{0}")]
    VersionNotFound(String),

    #[error("{0}")]
    ValidationError(String),

    #[error("{0}")]
    ExportFailed(String),

    #[error("{0}")]
    ImportFailed(String),

    #[error("{0}")]
    AiError(String),

    #[error("{0}")]
    SecurityError(String),

    #[error("{0}")]
    ResourceError(String),

    #[error("{0}")]
    ExternalToolError(String),

    #[error("{0}")]
    Internal(String),
}

impl AppError {
    /// 返回结构化错误码
    pub fn code(&self) -> ErrorCode {
        match self {
            AppError::Io(_) => ErrorCode::IoError,
            AppError::Serde(_) => ErrorCode::SerializeError,
            AppError::ProjectNotFound(_) => ErrorCode::ProjectNotFound,
            AppError::DocumentNotFound(_) => ErrorCode::DocumentNotFound,
            AppError::VersionNotFound(_) => ErrorCode::VersionNotFound,
            AppError::ValidationError(_) => ErrorCode::ValidationError,
            AppError::ExportFailed(_) => ErrorCode::ExportFailed,
            AppError::ImportFailed(_) => ErrorCode::ImportFailed,
            AppError::AiError(_) => ErrorCode::AiError,
            AppError::SecurityError(_) => ErrorCode::SecurityError,
            AppError::ResourceError(_) => ErrorCode::ResourceError,
            AppError::ExternalToolError(_) => ErrorCode::ExternalToolError,
            AppError::Internal(_) => ErrorCode::Internal,
        }
    }
}

/// 结构化 JSON 序列化：`{ "code": "DocumentNotFound", "message": "文档未找到: xxx" }`
/// 前端通过 code 字段区分错误类别，message 字段显示用户友好消息
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut state = serializer.serialize_struct("AppError", 2)?;
        state.serialize_field("code", &self.code())?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
    }
}

/// 从 String 转换：映射到 Internal（兼容现有 `.map_err(|e| crate::error::AppError::Internal(e.to_string()))` 模式）
impl From<String> for AppError {
    fn from(s: String) -> Self {
        AppError::Internal(s)
    }
}

impl From<&str> for AppError {
    fn from(s: &str) -> Self {
        AppError::Internal(s.to_string())
    }
}

/// 统一 Result 类型：所有 Tauri 命令使用此类型
pub type Result<T> = std::result::Result<T, AppError>;
