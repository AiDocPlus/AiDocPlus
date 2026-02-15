use serde::Serialize;

#[derive(Debug, thiserror::Error)]
#[allow(dead_code)]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("Project not found: {0}")]
    ProjectNotFound(String),

    #[error("Document not found: {0}")]
    DocumentNotFound(String),

    #[error("Invalid data: {0}")]
    InvalidData(String),

    #[error("Export failed: {0}")]
    ExportFailed(String),

    #[error("Version not found: {0}")]
    VersionNotFound(String),

    #[error("AI error: {0}")]
    AIError(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

// Implement for frontend error handling
pub type Result<T> = std::result::Result<T, String>;

#[allow(dead_code)]
pub fn to_result<T, F>(f: F) -> Result<T>
where
    F: FnOnce() -> std::result::Result<T, AppError>,
{
    f().map_err(|e| e.to_string())
}
