use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use super::python::find_python;

/// 脚本目录: <data_root>/CodingScripts/
fn coding_scripts_dir() -> PathBuf {
    crate::config::current_data_root().join("CodingScripts")
}

/// 状态文件: ~/AiDocPlus/CodingScripts/.coding-state.json
fn coding_state_path() -> PathBuf {
    coding_scripts_dir().join(".coding-state.json")
}

/// 确保脚本目录存在
fn ensure_scripts_dir() -> crate::error::Result<()> {
    let dir = coding_scripts_dir();
    fs::create_dir_all(&dir).map_err(|e| crate::error::AppError::Internal(format!("创建脚本目录失败: {}", e)))
}

/// 解析文件路径：仅允许相对路径，基于 CodingScripts 目录
fn resolve_path(file_path: &str) -> crate::error::Result<PathBuf> {
    let p = PathBuf::from(file_path);
    if p.is_absolute() {
        return Err(crate::error::AppError::SecurityError(
            "安全限制：只允许相对路径".to_string()
        ));
    }
    // 拒绝包含 .. 的路径组件
    for component in p.components() {
        if let std::path::Component::ParentDir = component {
            return Err(crate::error::AppError::SecurityError(
                "安全限制：路径中不允许包含 ..".to_string()
            ));
        }
    }
    Ok(coding_scripts_dir().join(file_path))
}

// ── 脚本文件信息 ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptFileInfo {
    pub name: String,
    #[serde(rename = "relativePath")]
    pub relative_path: String,
    #[serde(rename = "absolutePath")]
    pub absolute_path: String,
    pub size: u64,
    #[serde(rename = "modifiedAt")]
    pub modified_at: u64,
}

// ── 命令 ──

/// 获取脚本目录绝对路径
#[tauri::command]
pub fn get_coding_scripts_dir() -> crate::error::Result<String> {
    ensure_scripts_dir()?;
    let dir = coding_scripts_dir();
    Ok(dir.to_string_lossy().to_string())
}

/// 列出目录下所有 .py 文件
#[tauri::command]
pub fn list_coding_scripts() -> crate::error::Result<Vec<ScriptFileInfo>> {
    ensure_scripts_dir()?;
    let dir = coding_scripts_dir();
    let mut scripts = Vec::new();

    let entries = fs::read_dir(&dir).map_err(|e| crate::error::AppError::Internal(format!("读取目录失败: {}", e)))?;
    const SUPPORTED_EXTS: &[&str] = &[
        "py", "html", "htm", "js", "jsx", "ts", "tsx", "json", "md",
        "css", "txt", "xml", "yaml", "yml", "toml", "sh", "sql",
    ];

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                if SUPPORTED_EXTS.contains(&ext.to_lowercase().as_str()) {
                    let meta = fs::metadata(&path).ok();
                    let name = path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    let relative_path = name.clone();
                    let absolute_path = path.to_string_lossy().to_string();
                    let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
                    let modified_at = meta
                        .and_then(|m| m.modified().ok())
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs())
                        .unwrap_or(0);

                    scripts.push(ScriptFileInfo {
                        name,
                        relative_path,
                        absolute_path,
                        size,
                        modified_at,
                    });
                }
            }
        }
    }

    // 按修改时间倒序
    scripts.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    Ok(scripts)
}

/// 读取脚本文件内容
#[tauri::command]
pub fn read_coding_script(
    #[allow(non_snake_case)]
    filePath: String,
) -> crate::error::Result<String> {
    let path = resolve_path(&filePath)?;
    if !path.exists() {
        return Err(crate::error::AppError::Internal(format!("文件不存在: {}", filePath)));
    }

    // 安全检查：解析后的路径必须在 CodingScripts 目录下
    let canonical = path.canonicalize()
        .map_err(|e| crate::error::AppError::ValidationError(format!("路径无效: {}", e)))?;
    let scripts_dir = coding_scripts_dir();
    let scripts_canonical = scripts_dir.canonicalize().unwrap_or(scripts_dir);
    if !canonical.starts_with(&scripts_canonical) {
        return Err(crate::error::AppError::SecurityError(
            "安全限制：只能读取 CodingScripts 目录下的文件".to_string()
        ));
    }

    fs::read_to_string(&canonical).map_err(|e| crate::error::AppError::Internal(format!("读取文件失败: {}", e)))
}

/// 保存脚本文件
#[tauri::command]
pub fn save_coding_script(
    #[allow(non_snake_case)]
    filePath: String,
    content: String,
) -> crate::error::Result<String> {
    ensure_scripts_dir()?;
    let path = resolve_path(&filePath)?;

    // 路径安全由 resolve_path 保证（拒绝绝对路径和 ..）

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| crate::error::AppError::Internal(format!("创建目录失败: {}", e)))?;
    }
    crate::config::atomic_write(&path, &content)?;
    Ok(path.to_string_lossy().to_string())
}

/// 删除脚本文件
#[tauri::command]
pub fn delete_coding_script(
    #[allow(non_snake_case)]
    filePath: String,
) -> crate::error::Result<()> {
    let path = resolve_path(&filePath)?;

    if path.exists() {
        fs::remove_file(&path).map_err(|e| crate::error::AppError::Internal(format!("删除文件失败: {}", e)))?;
    }
    Ok(())
}

/// 重命名脚本文件
#[tauri::command]
pub fn rename_coding_script(
    #[allow(non_snake_case)]
    filePath: String,
    #[allow(non_snake_case)]
    newName: String,
) -> crate::error::Result<String> {
    let old_path = resolve_path(&filePath)?;
    if !old_path.exists() {
        return Err(crate::error::AppError::Internal(format!("文件不存在: {}", filePath)));
    }

    let parent = old_path.parent().ok_or_else(|| crate::error::AppError::Internal("无法获取父目录".to_string()))?;
    let new_path = parent.join(&newName);
    if new_path.exists() {
        return Err(crate::error::AppError::ValidationError(format!("目标文件已存在: {}", newName)));
    }
    fs::rename(&old_path, &new_path).map_err(|e| crate::error::AppError::Internal(format!("重命名失败: {}", e)))?;
    Ok(new_path.to_string_lossy().to_string())
}

/// 加载编程区状态
#[tauri::command]
pub fn load_coding_state() -> crate::error::Result<Option<String>> {
    let path = coding_state_path();
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(&path).map_err(|e| crate::error::AppError::Internal(format!("读取状态失败: {}", e)))?;
    Ok(Some(content))
}

/// 保存编程区状态
#[tauri::command]
pub fn save_coding_state(json: String) -> crate::error::Result<()> {
    ensure_scripts_dir()?;
    let path = coding_state_path();
    crate::config::atomic_write(&path, &json)?;
    Ok(())
}

// ── 文件树（递归） ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileTreeNode {
    pub name: String,
    #[serde(rename = "relativePath")]
    pub relative_path: String,
    #[serde(rename = "isDir")]
    pub is_dir: bool,
    pub size: u64,
    #[serde(rename = "modifiedAt")]
    pub modified_at: u64,
    pub children: Option<Vec<FileTreeNode>>,
}

fn build_file_tree(dir: &std::path::Path, base: &std::path::Path) -> Vec<FileTreeNode> {
    let mut nodes = Vec::new();
    let Ok(entries) = fs::read_dir(dir) else { return nodes };

    const SUPPORTED_EXTS: &[&str] = &[
        "py", "html", "htm", "js", "jsx", "ts", "tsx", "json", "md",
        "css", "txt", "xml", "yaml", "yml", "toml", "sh", "sql",
    ];

    let mut dirs_vec = Vec::new();
    let mut files_vec = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
        // 跳过隐藏文件/目录
        if name.starts_with('.') { continue; }

        let rel = path.strip_prefix(base).unwrap_or(&path).to_string_lossy().to_string();
        let meta = fs::metadata(&path).ok();
        let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
        let modified_at = meta
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);

        if path.is_dir() {
            let children = build_file_tree(&path, base);
            dirs_vec.push(FileTreeNode {
                name, relative_path: rel, is_dir: true, size: 0, modified_at, children: Some(children),
            });
        } else if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            if SUPPORTED_EXTS.contains(&ext.to_lowercase().as_str()) {
                files_vec.push(FileTreeNode {
                    name, relative_path: rel, is_dir: false, size, modified_at, children: None,
                });
            }
        }
    }

    // 目录在前，文件在后，各自按名称排序
    dirs_vec.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    files_vec.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    nodes.extend(dirs_vec);
    nodes.extend(files_vec);
    nodes
}

/// 递归列出文件树
#[tauri::command]
pub fn list_coding_file_tree() -> crate::error::Result<Vec<FileTreeNode>> {
    ensure_scripts_dir()?;
    let dir = coding_scripts_dir();
    Ok(build_file_tree(&dir, &dir))
}

/// 创建子文件夹
#[tauri::command]
pub fn create_coding_folder(
    #[allow(non_snake_case)]
    folderPath: String,
) -> crate::error::Result<()> {
    ensure_scripts_dir()?;
    let path = resolve_path(&folderPath)?;

    fs::create_dir_all(&path).map_err(|e| crate::error::AppError::Internal(format!("创建文件夹失败: {}", e)))
}

/// 删除文件夹（必须为空）
#[tauri::command]
pub fn delete_coding_folder(
    #[allow(non_snake_case)]
    folderPath: String,
) -> crate::error::Result<()> {
    let path = resolve_path(&folderPath)?;
    if !path.exists() { return Ok(()); }
    if !path.is_dir() { return Err(crate::error::AppError::ValidationError("不是文件夹".to_string())); }

    fs::remove_dir_all(&path).map_err(|e| crate::error::AppError::Internal(format!("删除文件夹失败: {}", e)))
}

/// 移动/重命名文件或文件夹
#[tauri::command]
pub fn move_coding_item(
    #[allow(non_snake_case)]
    fromPath: String,
    #[allow(non_snake_case)]
    toPath: String,
) -> crate::error::Result<()> {
    let from = resolve_path(&fromPath)?;
    let to = resolve_path(&toPath)?;
    if !from.exists() { return Err(crate::error::AppError::Internal(format!("源路径不存在: {}", fromPath))); }
    if to.exists() { return Err(crate::error::AppError::ValidationError(format!("目标已存在: {}", toPath))); }

    if let Some(parent) = to.parent() {
        fs::create_dir_all(parent).map_err(|e| crate::error::AppError::Internal(format!("创建目录失败: {}", e)))?;
    }
    fs::rename(&from, &to).map_err(|e| crate::error::AppError::Internal(format!("移动失败: {}", e)))
}

/// 全局搜索文件内容
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    #[serde(rename = "filePath")]
    pub file_path: String,
    pub line: usize,
    pub text: String,
}

fn search_dir_recursive(dir: &std::path::Path, base: &std::path::Path, query: &str, results: &mut Vec<SearchResult>, max: usize) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    const EXTS: &[&str] = &["py","html","htm","js","jsx","ts","tsx","json","md","css","txt","xml","yaml","yml","toml","sh","sql"];
    for entry in entries.flatten() {
        if results.len() >= max { return; }
        let path = entry.path();
        if path.is_dir() {
            search_dir_recursive(&path, base, query, results, max);
        } else if path.is_file() {
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                if !EXTS.contains(&ext.to_lowercase().as_str()) { continue; }
            } else { continue; }
            let rel = path.strip_prefix(base).unwrap_or(&path).to_string_lossy().replace('\\', "/");
            if let Ok(content) = fs::read_to_string(&path) {
                let query_lower = query.to_lowercase();
                for (i, line) in content.lines().enumerate() {
                    if results.len() >= max { return; }
                    if line.to_lowercase().contains(&query_lower) {
                        results.push(SearchResult {
                            file_path: rel.clone(),
                            line: i + 1,
                            text: if line.len() > 200 { format!("{}...", &line[..200]) } else { line.to_string() },
                        });
                    }
                }
            }
        }
    }
}

#[tauri::command]
pub fn search_coding_files(query: String) -> crate::error::Result<Vec<SearchResult>> {
    if query.trim().is_empty() { return Ok(vec![]); }
    ensure_scripts_dir()?;
    let dir = coding_scripts_dir();
    let mut results = Vec::new();
    search_dir_recursive(&dir, &dir, &query, &mut results, 200);
    Ok(results)
}

/// 读取外部文件（绝对路径），限制只能读取用户主目录下的文件
#[tauri::command]
pub fn read_external_file(path: String) -> crate::error::Result<String> {
    use crate::error::{AppError, ResultExt};
    let p = std::path::PathBuf::from(&path);
    if !p.exists() { return Err(AppError::Internal(format!("文件不存在: {}", path))); }
    if !p.is_file() { return Err(AppError::ValidationError(format!("不是文件: {}", path))); }

    // 安全检查：canonicalize 后的路径必须在用户主目录下
    let canonical = p.canonicalize()
        .map_err(|e| AppError::ValidationError(format!("路径无效: {}", e)))?;
    if let Some(home) = dirs::home_dir() {
        let home_canonical = home.canonicalize().unwrap_or(home);
        if !canonical.starts_with(&home_canonical) {
            return Err(AppError::SecurityError(
                "安全限制：只允许读取用户主目录下的文件".to_string()
            ));
        }
    } else {
        return Err(AppError::Internal("无法获取用户主目录，拒绝读取".to_string()));
    }

    // 文件大小检查：超过 50MB 拒绝
    let metadata = fs::metadata(&canonical).context("获取文件信息失败")?;
    let max_size: u64 = 50 * 1024 * 1024; // 50MB
    if metadata.len() > max_size {
        return Err(AppError::ValidationError(format!(
            "文件过大（{} MB），最大允许读取 {} MB",
            metadata.len() / 1024 / 1024,
            max_size / 1024 / 1024
        )));
    }

    fs::read_to_string(&canonical).map_err(|e| AppError::Internal(format!("读取失败: {}", e)))
}

// ── pip 包管理 ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipInstallResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub packages: Vec<String>,
}

/// 使用 pip 安装 Python 包
#[tauri::command]
pub fn pip_install(
    packages: Vec<String>,
    #[allow(non_snake_case)]
    customPythonPath: Option<String>,
) -> crate::error::Result<PipInstallResult> {
    if packages.is_empty() {
        return Err(crate::error::AppError::ValidationError("未指定要安装的包".to_string()));
    }

    let python = find_python(customPythonPath.as_deref())
        .ok_or_else(|| crate::error::AppError::ExternalToolError("未找到 Python，请安装 Python 3 或在设置中指定路径".to_string()))?;

    let mut cmd = Command::new(&python);
    cmd.arg("-m").arg("pip").arg("install");
    for pkg in &packages {
        cmd.arg(pkg);
    }
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    let output = cmd.output().map_err(|e| crate::error::AppError::Internal(format!("执行 pip install 失败: {}", e)))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    Ok(PipInstallResult {
        success: output.status.success(),
        stdout,
        stderr,
        packages,
    })
}

/// 列出已安装的 pip 包
#[tauri::command]
pub fn pip_list(
    #[allow(non_snake_case)]
    customPythonPath: Option<String>,
) -> crate::error::Result<String> {
    let python = find_python(customPythonPath.as_deref())
        .ok_or_else(|| crate::error::AppError::ExternalToolError("未找到 Python".to_string()))?;

    let output = Command::new(&python)
        .arg("-m").arg("pip").arg("list").arg("--format=json")
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .output()
        .map_err(|e| crate::error::AppError::Internal(format!("执行 pip list 失败: {}", e)))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(crate::error::AppError::ExternalToolError(String::from_utf8_lossy(&output.stderr).to_string()))
    }
}
