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

/// rusqlite 错误 → Internal（消除数据库操作中大量 map_err 样板）
impl From<rusqlite::Error> for AppError {
    fn from(e: rusqlite::Error) -> Self {
        AppError::Internal(e.to_string())
    }
}

/// reqwest 错误 → Internal（消除 HTTP 请求中大量 map_err 样板）
impl From<reqwest::Error> for AppError {
    fn from(e: reqwest::Error) -> Self {
        AppError::Internal(e.to_string())
    }
}

/// Mutex PoisonError → Internal（消除锁操作中的 map_err 样板）
impl<T> From<std::sync::PoisonError<T>> for AppError {
    fn from(e: std::sync::PoisonError<T>) -> Self {
        AppError::Internal(e.to_string())
    }
}

/// 为 Result 添加 `.context("描述")` / `.context_with(|| format!(...))` 方法，
/// 自动将底层错误附加上下文信息，替代 `.map_err(|e| AppError::Internal(format!(...)))` 样板
///
/// 用法：
/// - `conn.execute(...).context("插入版本失败")?;`
/// - `fs::copy(&src, &dst).context_with(|| format!("复制文件失败 {:?}", name))?;`
/// - `conn.open(path).context_as("打开数据库失败", AppError::ResourceError)?;`
pub trait ResultExt<T> {
    fn context(self, msg: &str) -> Result<T>;
    fn context_with<F: FnOnce() -> String>(self, f: F) -> Result<T>;
    fn context_as<F: FnOnce(String) -> AppError>(self, msg: &str, wrap: F) -> Result<T>;
}

impl<T, E: std::fmt::Display> ResultExt<T> for std::result::Result<T, E> {
    fn context(self, msg: &str) -> Result<T> {
        self.map_err(|e| AppError::Internal(format!("{}: {}", msg, e)))
    }

    fn context_with<F: FnOnce() -> String>(self, f: F) -> Result<T> {
        self.map_err(|e| AppError::Internal(format!("{}: {}", f(), e)))
    }

    fn context_as<W: FnOnce(String) -> AppError>(self, msg: &str, wrap: W) -> Result<T> {
        self.map_err(|e| wrap(format!("{}: {}", msg, e)))
    }
}

/// 统一 Result 类型：所有 Tauri 命令使用此类型
pub type Result<T> = std::result::Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    // ── 错误码映射 ──

    #[test]
    fn io_error_code() {
        let err = AppError::Io(std::io::Error::new(std::io::ErrorKind::NotFound, "gone"));
        assert!(matches!(err.code(), ErrorCode::IoError));
    }

    #[test]
    fn project_not_found_code() {
        let err = AppError::ProjectNotFound("p1".into());
        assert!(matches!(err.code(), ErrorCode::ProjectNotFound));
    }

    #[test]
    fn document_not_found_code() {
        let err = AppError::DocumentNotFound("d1".into());
        assert!(matches!(err.code(), ErrorCode::DocumentNotFound));
    }

    #[test]
    fn validation_error_code() {
        let err = AppError::ValidationError("bad".into());
        assert!(matches!(err.code(), ErrorCode::ValidationError));
    }

    #[test]
    fn ai_error_code() {
        let err = AppError::AiError("timeout".into());
        assert!(matches!(err.code(), ErrorCode::AiError));
    }

    #[test]
    fn security_error_code() {
        let err = AppError::SecurityError("path traversal".into());
        assert!(matches!(err.code(), ErrorCode::SecurityError));
    }

    #[test]
    fn internal_error_code() {
        let err = AppError::Internal("oops".into());
        assert!(matches!(err.code(), ErrorCode::Internal));
    }

    // ── JSON 序列化 ──

    #[test]
    fn serialize_has_code_and_message() {
        let err = AppError::DocumentNotFound("文档未找到: doc_123".into());
        let json = serde_json::to_value(&err).unwrap();
        assert_eq!(json["code"], "DocumentNotFound");
        assert_eq!(json["message"], "文档未找到: doc_123");
    }

    #[test]
    fn serialize_internal_error() {
        let err = AppError::Internal("unexpected".into());
        let json = serde_json::to_value(&err).unwrap();
        assert_eq!(json["code"], "Internal");
        assert_eq!(json["message"], "unexpected");
    }

    #[test]
    fn serialize_ai_error() {
        let err = AppError::AiError("API 超时".into());
        let json = serde_json::to_value(&err).unwrap();
        assert_eq!(json["code"], "AiError");
        assert!(json["message"].as_str().unwrap().contains("超时"));
    }

    // ── From 转换 ──

    #[test]
    fn from_string() {
        let err: AppError = String::from("test error").into();
        assert!(matches!(err, AppError::Internal(_)));
        assert_eq!(err.to_string(), "test error");
    }

    #[test]
    fn from_str() {
        let err: AppError = "str error".into();
        assert!(matches!(err, AppError::Internal(_)));
        assert_eq!(err.to_string(), "str error");
    }

    // ── ResultExt ──

    #[test]
    fn context_adds_prefix() {
        let res: std::result::Result<(), std::io::Error> =
            Err(std::io::Error::new(std::io::ErrorKind::NotFound, "gone"));
        let err = res.context("读取文件失败").unwrap_err();
        assert!(matches!(err, AppError::Internal(_)));
        assert!(err.to_string().contains("读取文件失败"));
        assert!(err.to_string().contains("gone"));
    }

    #[test]
    fn context_with_supports_format() {
        let name = "test.txt";
        let res: std::result::Result<(), std::io::Error> =
            Err(std::io::Error::new(std::io::ErrorKind::NotFound, "gone"));
        let err = res.context_with(|| format!("复制文件失败 {:?}", name)).unwrap_err();
        assert!(matches!(err, AppError::Internal(_)));
        assert!(err.to_string().contains("test.txt"));
    }

    #[test]
    fn context_as_maps_to_variant() {
        let res: std::result::Result<(), std::io::Error> =
            Err(std::io::Error::new(std::io::ErrorKind::NotFound, "gone"));
        let err = res.context_as("导出失败", AppError::ExportFailed).unwrap_err();
        assert!(matches!(err, AppError::ExportFailed(_)));
        assert!(err.to_string().contains("导出失败"));
    }

    // ── Display ──

    #[test]
    fn display_preserves_message() {
        let err = AppError::ExportFailed("导出 PDF 失败".into());
        assert_eq!(format!("{}", err), "导出 PDF 失败");
    }
}
