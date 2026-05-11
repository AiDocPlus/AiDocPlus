/// 文件系统安全模块 — 集中的输入校验与路径防护
use std::path::{Path, PathBuf};

// ── SSRF 防护 ──

/// 校验 URL 是否为安全的 HTTPS 公网地址（防止 SSRF 攻击）
/// 阻止：内网地址、环回地址、链路本地、非 HTTP(S) 协议
pub fn validate_url_not_private(url_str: &str, field_name: &str) -> crate::error::Result<()> {
    use crate::error::AppError;
    use std::str::FromStr;

    let url = url::Url::parse(url_str).map_err(|e| {
        AppError::ValidationError(format!("{} URL 格式无效: {}", field_name, e))
    })?;

    let scheme = url.scheme().to_lowercase();
    if scheme != "https" && scheme != "http" {
        return Err(AppError::ValidationError(format!(
            "{} 仅允许 HTTP/HTTPS 协议",
            field_name
        )));
    }

    let host = url.host_str().ok_or_else(|| {
        AppError::ValidationError(format!("{} 缺少主机名", field_name))
    })?;

    // 解析主机为 IP 地址（失败说明是域名，后续 DNS 解析可能指向内网，
    // 但在桌面应用场景下用户主动配置的域名视为可信）
    if let Ok(ip) = std::net::IpAddr::from_str(host) {
        if is_private_ip(&ip) {
            return Err(AppError::SecurityError(format!(
                "{} 不允许访问内网地址: {}",
                field_name, host
            )));
        }
    } else {
        // 域名检查：阻止常见内网域名
        let host_lower = host.to_lowercase();
        let blocked_hosts = [
            "localhost", "localhost.localdomain",
            "ip6-localhost", "ip6-loopback",
        ];
        if blocked_hosts.contains(&host_lower.as_str()) {
            return Err(AppError::SecurityError(format!(
                "{} 不允许访问内网主机: {}",
                field_name, host
            )));
        }
    }

    Ok(())
}

/// 检查 IP 是否为内网 / 环回 / 链路本地地址
fn is_private_ip(ip: &std::net::IpAddr) -> bool {
    match ip {
        std::net::IpAddr::V4(v4) => {
            v4.is_loopback()
                || v4.is_private()
                || v4.is_link_local()
                // 0.0.0.0/8
                || v4.octets()[0] == 0
                // 载波级 NAT 100.64.0.0/10
                || (v4.octets()[0] == 100 && (v4.octets()[1] & 0b1100_0000) == 0b0100_0000)
                // IETF 协议保留 192.0.0.0/24, 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24
                || (v4.octets()[0] == 192 && v4.octets()[1] == 0 && v4.octets()[2] == 0)
                || (v4.octets()[0] == 192 && v4.octets()[1] == 0 && v4.octets()[2] == 2)
                || (v4.octets()[0] == 198 && v4.octets()[1] == 51 && v4.octets()[2] == 100)
                || (v4.octets()[0] == 203 && v4.octets()[1] == 0 && v4.octets()[2] == 113)
        }
        std::net::IpAddr::V6(v6) => {
            v6.is_loopback()
                || v6.is_multicast()
                // IPv6 映射的 IPv4 私有地址
                || match v6.to_ipv4_mapped() {
                    Some(v4) => is_private_ip(&std::net::IpAddr::V4(v4)),
                    None => false,
                }
        }
    }
}

/// 验证路径是否在允许的目录内（复用 canonicalize + starts_with 模式）
/// 允许的目录：用户 home、temp_dir、应用数据目录
pub fn validate_path_allowed(path: &Path, field_name: &str) -> crate::error::Result<PathBuf> {
    use crate::error::AppError;

    let canonical = path.canonicalize().map_err(|e| {
        AppError::ValidationError(format!("{} 路径无效或不存在: {}", field_name, e))
    })?;

    let mut allowed_dirs: Vec<PathBuf> = Vec::new();
    if let Some(home) = dirs::home_dir() {
        allowed_dirs.push(home);
    }
    allowed_dirs.push(std::env::temp_dir());
    allowed_dirs.push(crate::config::current_data_root());

    for allowed in &allowed_dirs {
        if let Ok(allowed_canonical) = allowed.canonicalize() {
            if canonical.starts_with(&allowed_canonical) {
                return Ok(canonical);
            }
        }
    }

    Err(AppError::SecurityError(format!(
        "安全限制：{} 不在允许的目录范围内",
        field_name
    )))
}

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


/// 清理文件名中的危险字符（用于导出等场景）
pub fn sanitize_filename(name: &str) -> String {
    let sanitized: String = name.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' | '\0' => '_',
            _ => c,
        })
        .collect();
    // 限制长度（按字符截断，避免将多字节 UTF-8 字符截断为无效序列）
    let truncated = if sanitized.chars().count() > MAX_FILENAME_LENGTH {
        sanitized.chars().take(MAX_FILENAME_LENGTH).collect()
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
