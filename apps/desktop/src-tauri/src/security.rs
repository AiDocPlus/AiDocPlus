/// 文件系统安全模块 — 集中的输入校验与路径防护
use std::path::{Path, PathBuf};

// ── 常量 ──

/// 单文档最大大小 (20 MB)
pub const MAX_DOCUMENT_SIZE: usize = 20 * 1024 * 1024;

/// 单个项目最大文件数
pub const MAX_PROJECT_FILES: usize = 500;

/// 文件名最大长度
pub const MAX_FILENAME_LENGTH: usize = 255;

/// 标题最大长度
pub const MAX_TITLE_LENGTH: usize = 200;

// ── ID 校验 ──

/// 校验 ID 是否为合法的 UUID 或安全标识符
/// 只允许：字母数字、连字符、下划线（防止路径注入 `../`）
pub fn validate_id(id: &str, field_name: &str) -> crate::error::Result<()> {
    use crate::error::AppError;
    if id.is_empty() {
        return Err(AppError::ValidationError(format!("{} 不能为空", field_name)));
    }
    if id.len() > 128 {
        return Err(AppError::ValidationError(format!("{} 过长（最大 128 字符）", field_name)));
    }
    if !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return Err(AppError::ValidationError(format!(
            "{} 包含非法字符（仅允许字母、数字、连字符、下划线）: {}",
            field_name, id
        )));
    }
    // 禁止 . 和 .. 开头
    if id.starts_with('.') {
        return Err(AppError::ValidationError(format!("{} 不能以 . 开头", field_name)));
    }
    Ok(())
}

// ── 标题校验 ──

/// 校验标题：非空、不超长、不含路径分隔符
pub fn validate_title(title: &str) -> crate::error::Result<String> {
    use crate::error::AppError;
    let trimmed = title.trim();
    if trimmed.is_empty() {
        return Err(AppError::ValidationError("标题不能为空".to_string()));
    }
    if trimmed.len() > MAX_TITLE_LENGTH {
        return Err(AppError::ValidationError(format!("标题过长（最大 {} 字符）", MAX_TITLE_LENGTH)));
    }
    // 禁止路径分隔符
    if trimmed.contains('/') || trimmed.contains('\\') || trimmed.contains('\0') {
        return Err(AppError::ValidationError("标题不能包含路径分隔符".to_string()));
    }
    Ok(trimmed.to_string())
}

// ── 内容大小校验 ──

/// 校验文档内容大小是否在限制范围内
pub fn validate_content_size(content: &str) -> crate::error::Result<()> {
    let size = content.len();
    if size > MAX_DOCUMENT_SIZE {
        return Err(crate::error::AppError::ValidationError(format!(
            "文档内容过大（{:.1} MB），最大允许 {} MB",
            size as f64 / 1024.0 / 1024.0,
            MAX_DOCUMENT_SIZE / 1024 / 1024
        )));
    }
    Ok(())
}

// ── 路径安全 ──

/// 校验路径是否在允许的根目录下（防止路径遍历）
pub fn validate_path_under_root(path: &Path, root: &Path) -> crate::error::Result<PathBuf> {
    use crate::error::AppError;
    // 先规范化
    let canonical = if path.exists() {
        path.canonicalize()
            .map_err(|e| AppError::SecurityError(format!("路径无效: {}", e)))?
    } else if let Some(parent) = path.parent() {
        // 文件尚不存在，校验父目录
        if !parent.exists() {
            std::fs::create_dir_all(parent)
                .map_err(|e| AppError::Internal(format!("创建目录失败: {}", e)))?;
        }
        let canonical_parent = parent.canonicalize()
            .map_err(|e| AppError::SecurityError(format!("父目录无效: {}", e)))?;
        canonical_parent.join(path.file_name().unwrap_or_default())
    } else {
        return Err(AppError::SecurityError("路径无效".to_string()));
    };

    let canonical_root = root.canonicalize().unwrap_or_else(|_| root.to_path_buf());

    if !canonical.starts_with(&canonical_root) {
        return Err(AppError::SecurityError(format!(
            "安全限制：路径 {:?} 不在允许的目录 {:?} 下",
            canonical.display(),
            canonical_root.display()
        )));
    }
    Ok(canonical)
}

/// 清理文件名中的危险字符（用于导出等场景）
pub fn sanitize_filename(name: &str) -> String {
    let sanitized: String = name.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' | '\0' => '_',
            _ => c,
        })
        .collect();
    // 限制长度
    let truncated = if sanitized.len() > MAX_FILENAME_LENGTH {
        sanitized[..MAX_FILENAME_LENGTH].to_string()
    } else {
        sanitized
    };
    // 禁止 . 和 .. 开头
    if truncated.starts_with('.') {
        format!("_{}", truncated)
    } else if truncated.is_empty() {
        "untitled".to_string()
    } else {
        truncated
    }
}
