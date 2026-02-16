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
) -> Result<String, String> {
    // 确保输出目录存在
    if let Some(parent) = std::path::Path::new(&outputPath).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建输出目录失败: {}", e))?;
    }

    // 创建临时 Markdown 文件
    let temp_dir = std::env::temp_dir().join("aidocplus_pandoc");
    fs::create_dir_all(&temp_dir).map_err(|e| format!("创建临时目录失败: {}", e))?;

    let temp_md = temp_dir.join("input.md");
    fs::write(&temp_md, &markdown).map_err(|e| format!("写入临时文件失败: {}", e))?;

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

    // 添加额外参数
    if let Some(args) = &extraArgs {
        for arg in args {
            let trimmed = arg.trim();
            if !trimmed.is_empty() {
                // 处理 -V key=value 格式（两个参数）
                if trimmed.starts_with("-V ") || trimmed.starts_with("-V\t") {
                    cmd.arg("-V");
                    cmd.arg(trimmed[3..].trim());
                } else {
                    cmd.arg(trimmed);
                }
            }
        }
    }

    // 输入文件
    cmd.arg(&temp_md);

    // 执行
    let output = cmd
        .output()
        .map_err(|e| format!("执行 Pandoc 失败: {}。请确认 Pandoc 已正确安装。", e))?;

    // 清理临时文件
    let _ = fs::remove_file(&temp_md);

    if output.status.success() {
        Ok(outputPath)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("Pandoc 导出失败: {}", stderr))
    }
}
