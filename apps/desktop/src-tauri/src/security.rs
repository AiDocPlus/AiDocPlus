/// 文件系统安全模块 — 集中的输入校验与路径防护
use std::path::{Path, PathBuf};

// ── 常量 ──

/// 单文档最大大小 (20 MB)
pub const MAX_DOCUMENT_SIZE: usize = 20 * 1024 * 1024;

/// 单个项目最大文件数
#[allow(dead_code)]
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
#[allow(dead_code)]
pub fn validate_path_under_root(path: &Path, root: &Path) -> crate::error::Result<PathBuf> {
    use crate::error::{AppError, ResultExt};
    // 先规范化
    let canonical = if path.exists() {
        path.canonicalize()
            .context_as("路径无效", AppError::SecurityError)?
    } else if let Some(parent) = path.parent() {
        // 文件尚不存在，校验父目录
        if !parent.exists() {
            std::fs::create_dir_all(parent)
                .context("创建目录失败")?;
        }
        let canonical_parent = parent.canonicalize()
            .context_as("父目录无效", AppError::SecurityError)?;
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

#[cfg(test)]
mod tests {
    use super::*;

    // ── validate_id ──

    #[test]
    fn valid_uuid_id() {
        assert!(validate_id("550e8400-e29b-41d4-a716-446655440000", "id").is_ok());
    }

    #[test]
    fn valid_alphanumeric_id() {
        assert!(validate_id("my_project-123", "id").is_ok());
    }

    #[test]
    fn empty_id_rejected() {
        let err = validate_id("", "testId").unwrap_err();
        assert!(err.to_string().contains("不能为空"));
    }

    #[test]
    fn id_too_long_rejected() {
        let long_id = "a".repeat(129);
        let err = validate_id(&long_id, "testId").unwrap_err();
        assert!(err.to_string().contains("过长"));
    }

    #[test]
    fn id_max_length_ok() {
        let max_id = "a".repeat(128);
        assert!(validate_id(&max_id, "testId").is_ok());
    }

    #[test]
    fn id_with_path_traversal_rejected() {
        assert!(validate_id("../etc/passwd", "id").is_err());
        assert!(validate_id("foo/bar", "id").is_err());
    }

    #[test]
    fn id_starting_with_dot_rejected() {
        assert!(validate_id(".hidden", "id").is_err());
        assert!(validate_id("..double", "id").is_err());
    }

    #[test]
    fn id_with_special_chars_rejected() {
        assert!(validate_id("hello world", "id").is_err());
        assert!(validate_id("id@name", "id").is_err());
        assert!(validate_id("id#1", "id").is_err());
    }

    // ── validate_title ──

    #[test]
    fn valid_title() {
        let result = validate_title("我的文档").unwrap();
        assert_eq!(result, "我的文档");
    }

    #[test]
    fn title_trimmed() {
        let result = validate_title("  hello  ").unwrap();
        assert_eq!(result, "hello");
    }

    #[test]
    fn empty_title_rejected() {
        assert!(validate_title("").is_err());
        assert!(validate_title("   ").is_err());
    }

    #[test]
    fn title_too_long_rejected() {
        let long_title = "a".repeat(MAX_TITLE_LENGTH + 1);
        assert!(validate_title(&long_title).is_err());
    }

    #[test]
    fn title_max_length_ok() {
        let max_title = "a".repeat(MAX_TITLE_LENGTH);
        assert!(validate_title(&max_title).is_ok());
    }

    #[test]
    fn title_with_path_separator_rejected() {
        assert!(validate_title("foo/bar").is_err());
        assert!(validate_title("foo\\bar").is_err());
        assert!(validate_title("foo\0bar").is_err());
    }

    // ── validate_content_size ──

    #[test]
    fn content_within_limit_ok() {
        assert!(validate_content_size("hello world").is_ok());
    }

    #[test]
    fn empty_content_ok() {
        assert!(validate_content_size("").is_ok());
    }

    #[test]
    fn content_at_limit_ok() {
        let content = "a".repeat(MAX_DOCUMENT_SIZE);
        assert!(validate_content_size(&content).is_ok());
    }

    #[test]
    fn content_over_limit_rejected() {
        let content = "a".repeat(MAX_DOCUMENT_SIZE + 1);
        assert!(validate_content_size(&content).is_err());
    }

    // ── sanitize_filename ──

    #[test]
    fn clean_filename_unchanged() {
        assert_eq!(sanitize_filename("hello.txt"), "hello.txt");
    }

    #[test]
    fn dangerous_chars_replaced() {
        assert_eq!(sanitize_filename("a/b\\c:d*e?f\"g<h>i|j"), "a_b_c_d_e_f_g_h_i_j");
    }

    #[test]
    fn null_char_replaced() {
        assert_eq!(sanitize_filename("foo\0bar"), "foo_bar");
    }

    #[test]
    fn dot_prefix_escaped() {
        assert_eq!(sanitize_filename(".hidden"), "_.hidden");
        assert_eq!(sanitize_filename("..double"), "_..double");
    }

    #[test]
    fn empty_name_becomes_untitled() {
        assert_eq!(sanitize_filename(""), "untitled");
    }

    #[test]
    fn long_name_truncated() {
        let long_name = "a".repeat(300);
        let result = sanitize_filename(&long_name);
        assert_eq!(result.len(), MAX_FILENAME_LENGTH);
    }

    #[test]
    fn unicode_filename_preserved() {
        assert_eq!(sanitize_filename("我的文档.md"), "我的文档.md");
    }
}
