use serde::{Deserialize, Serialize};
use std::fs;
use std::process::Command;

/// Pandoc 检测结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PandocCheckResult {
    pub available: bool,
    pub version: Option<String>,
    pub path: Option<String>,
    pub error: Option<String>,
}

/// 检测 Pandoc 是否安装及版本
#[tauri::command]
pub fn check_pandoc() -> PandocCheckResult {
    // 尝试运行 pandoc --version
    match Command::new("pandoc").arg("--version").output() {
        Ok(output) => {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                // 第一行通常是 "pandoc X.Y.Z"
                let version = stdout
                    .lines()
                    .next()
                    .and_then(|line| line.strip_prefix("pandoc "))
                    .unwrap_or("unknown")
                    .to_string();

                // 尝试获取 pandoc 路径
                let path = get_pandoc_path();

                PandocCheckResult {
                    available: true,
                    version: Some(version),
                    path,
                    error: None,
                }
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                PandocCheckResult {
                    available: false,
                    version: None,
                    path: None,
                    error: Some(format!("Pandoc 执行失败: {}", stderr)),
                }
            }
        }
        Err(e) => PandocCheckResult {
            available: false,
            version: None,
            path: None,
            error: Some(format!("未找到 Pandoc: {}", e)),
        },
    }
}

/// 获取 pandoc 可执行文件路径
fn get_pandoc_path() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("where")
            .arg("pandoc")
            .output()
            .ok()
            .and_then(|o| {
                if o.status.success() {
                    Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
                } else {
                    None
                }
            })
    }
    #[cfg(not(target_os = "windows"))]
    {
        Command::new("which")
            .arg("pandoc")
            .output()
            .ok()
            .and_then(|o| {
                if o.status.success() {
                    Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
                } else {
                    None
                }
            })
    }
}

/// 调用 Pandoc 导出文档
#[tauri::command]
pub fn pandoc_export(
    markdown: String,
    #[allow(non_snake_case)]
    outputPath: String,
    format: String,
    #[allow(non_snake_case)]
    extraArgs: Option<Vec<String>>,
    title: Option<String>,
) -> crate::error::Result<String> {
    use crate::error::{AppError, ResultExt};

    // 安全检查：验证输出路径在允许的目录内（用户主目录、AiDocPlus 数据目录、临时目录）
    let output_path = std::path::Path::new(&outputPath);
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent).context("创建输出目录失败")?;
    }
    let canonical_output = output_path.canonicalize()
        .map_err(|e| AppError::ValidationError(format!("输出路径无效: {}", e)))?;
    let mut is_output_allowed = false;
    // 检查是否在 AiDocPlus 数据目录下
    let data_root = crate::config::current_data_root();
    if let Ok(root) = data_root.canonicalize() {
        if canonical_output.starts_with(&root) { is_output_allowed = true; }
    }
    // 检查是否在用户主目录下
    if !is_output_allowed {
        if let Some(home) = dirs::home_dir() {
            if let Ok(home_c) = home.canonicalize() {
                if canonical_output.starts_with(&home_c) { is_output_allowed = true; }
            }
        }
    }
    // 检查是否在临时目录下
    if !is_output_allowed {
        if let Ok(tmp) = std::env::temp_dir().canonicalize() {
            if canonical_output.starts_with(&tmp) { is_output_allowed = true; }
        }
    }
    if !is_output_allowed {
        return Err(AppError::SecurityError(
            "安全限制：导出路径不在允许的目录内（用户主目录/AiDocPlus/临时目录）".to_string()
        ));
    }

    // Pandoc 安全参数白名单（只允许已知的非危险参数）
    let safe_args_whitelist: &[&str] = &[
        "-V",           // 变量设置（metadata variable）
        "--metadata",   // 元数据
        "-s",           // 独立文档
        "--standalone",
        "-S",           // 独立文档（旧写法）
        "--smart",
        "--css",        // CSS 样式
        "--toc",        // 目录
        "--toc-depth",  // 目录深度
        "--highlight-style", // 代码高亮
        "--reference-doc",   // 参考文档模板
        "-N",           // 章节编号
        "--number-sections",
        "--wrap",       // 自动换行
        "--columns",    // 列宽
        "-f",           // 输入格式
        "-t",           // 输出格式
        "--pdf-engine", // PDF 引擎
        "-o",           // 输出文件
        "--resource-path", // 资源路径
        "--extract-media", // 提取媒体
        "--self-contained", // 自包含
        "--embed-resources", // 嵌入资源
        "--data-dir",   // 数据目录
    ];

    // 创建临时 Markdown 文件
    let temp_dir = std::env::temp_dir().join("aidocplus_pandoc");
    fs::create_dir_all(&temp_dir).context("创建临时目录失败")?;

    let temp_md = temp_dir.join("input.md");
    fs::write(&temp_md, &markdown).context("写入临时文件失败")?;

    // 构建 pandoc 命令
    let mut cmd = Command::new("pandoc");
    cmd.arg("-f").arg("markdown");
    cmd.arg("-t").arg(&format);
    cmd.arg("-o").arg(&outputPath);

    // 添加标题元数据
    if let Some(ref t) = title {
        if !t.is_empty() {
            cmd.arg("--metadata").arg(format!("title={}", t));
        }
    }

    // 添加额外参数（白名单过滤）
    if let Some(args) = &extraArgs {
        for arg in args {
            let trimmed = arg.trim();
            if trimmed.is_empty() { continue; }

            // 处理 -V key=value 格式（两个参数合并为一个）
            if trimmed.starts_with("-V ") || trimmed.starts_with("-V\t") {
                cmd.arg("-V");
                cmd.arg(trimmed[3..].trim());
                continue;
            }

            // 白名单检查：提取参数名（第一个单词，去掉 -- 或 - 前缀）
            let arg_name = trimmed.split_whitespace().next().unwrap_or(trimmed);
            let clean_name = arg_name
                .strip_prefix("--")
                .or_else(|| arg_name.strip_prefix("-"))
                .unwrap_or(arg_name);

            if safe_args_whitelist.iter().any(|&safe| {
                safe == arg_name || safe == clean_name
                    || safe.starts_with('-') && arg_name == safe
            }) {
                // 对于需要取值的参数（如 --metadata、--css 等），拆分参数和值
                let needs_value = [
                    "--metadata", "-V", "--css", "--toc-depth", "--highlight-style",
                    "--reference-doc", "--columns", "--pdf-engine", "--resource-path",
                    "--extract-media", "--data-dir", "-f", "-t",
                ];
                if needs_value.iter().any(|&n| arg_name == n) {
                    // 参数和值已合并在一起（如 "--css style.css"），需要拆分
                    if let Some(eq_pos) = trimmed.find('=') {
                        cmd.arg(&trimmed[..eq_pos]);
                        cmd.arg(trimmed[eq_pos + 1..].trim());
                    } else {
                        // 按空格拆分第一个单词作为参数名，其余作为值
                        let parts: Vec<&str> = trimmed.splitn(2, char::is_whitespace).collect();
                        if parts.len() == 2 {
                            cmd.arg(parts[0]);
                            cmd.arg(parts[1].trim());
                        } else {
                            cmd.arg(trimmed);
                        }
                    }
                } else {
                    cmd.arg(trimmed);
                }
            }
            // 不在白名单的参数被静默忽略（安全策略）
        }
    }

    // 输入文件
    cmd.arg(&temp_md);

    // 执行
    let output = cmd
        .output()
        .map_err(|e| AppError::ExternalToolError(format!("执行 Pandoc 失败: {}。请确认 Pandoc 已正确安装。", e)))?;

    // 清理临时文件
    let _ = fs::remove_file(&temp_md);

    if output.status.success() {
        Ok(outputPath)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(AppError::ExportFailed(format!("Pandoc 导出失败: {}", stderr)))
    }
}
