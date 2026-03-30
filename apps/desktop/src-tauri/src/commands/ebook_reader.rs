/// 电子书阅读器 — 后端命令（库管理 + 文件导入 + 分类树 + 阅读窗口）
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::time::UNIX_EPOCH;
use uuid::Uuid;

// ── 数据结构 ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EbookCategory {
    pub id: String,
    pub name: String,
    /// None = root level
    pub parent_id: Option<String>,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EbookInfo {
    /// UUID-based 文件名（含扩展名）
    pub filename: String,
    /// 原始文件名
    pub original_name: String,
    /// 用户可编辑的显示名称（默认 = 去扩展名的原始文件名）
    pub display_name: String,
    /// 格式标识（md / html / pdf / docx / epub）
    pub format: String,
    /// 文件大小（字节）
    pub size_bytes: u64,
    /// 添加时间（ISO 8601）
    pub added_at: String,
    /// 所属分类（None = 未分类）
    pub category_id: Option<String>,
    /// 同分类内的排序位置
    pub sort_order: i64,
    /// 是否收藏
    #[serde(default)]
    pub starred: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EbookContent {
    /// 文本内容或 base64 编码的二进制数据
    pub data: String,
    /// 是否为二进制格式
    pub is_binary: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryIndex {
    pub version: u32,
    pub categories: Vec<EbookCategory>,
    pub books: Vec<EbookInfo>,
}

// ── 支持的格式 ──

const SUPPORTED_EXTENSIONS: &[&str] = &["md", "html", "htm", "docx", "pdf", "epub"];

/// 二进制格式列表
const BINARY_EXTENSIONS: &[&str] = &["pdf", "docx", "epub"];

fn is_supported(ext: &str) -> bool {
    SUPPORTED_EXTENSIONS.contains(&ext.to_lowercase().as_str())
}

fn is_binary_format(ext: &str) -> bool {
    BINARY_EXTENSIONS.contains(&ext.to_lowercase().as_str())
}

/// 规范化格式标识（htm → html）
fn normalize_format(ext: &str) -> String {
    match ext.to_lowercase().as_str() {
        "htm" => "html".to_string(),
        other => other.to_string(),
    }
}

/// 获取电子书库目录路径
fn library_dir() -> crate::error::Result<PathBuf> {
    let home = dirs::home_dir()
        .ok_or_else(|| crate::error::AppError::Internal("无法获取用户主目录".to_string()))?;
    Ok(home.join("AiDocPlus").join("EBookLibrary"))
}

/// 获取 library.json 路径
fn library_index_path() -> crate::error::Result<PathBuf> {
    Ok(library_dir()?.join("library.json"))
}

/// 从磁盘读取库索引，不存在时自动迁移
fn load_library_index() -> crate::error::Result<LibraryIndex> {
    let path = library_index_path()?;
    if path.exists() {
        let json = std::fs::read_to_string(&path).map_err(|e| {
            crate::error::AppError::Internal(format!("读取 library.json 失败: {}", e))
        })?;
        let index: LibraryIndex = serde_json::from_str(&json).map_err(|e| {
            crate::error::AppError::Internal(format!("解析 library.json 失败: {}", e))
        })?;
        Ok(index)
    } else {
        migrate_or_create_index()
    }
}

/// 保存库索引（原子写入）
fn save_library_index(index: &LibraryIndex) -> crate::error::Result<()> {
    let path = library_index_path()?;
    let json = serde_json::to_string_pretty(index).map_err(|e| {
        crate::error::AppError::Internal(format!("序列化 library.json 失败: {}", e))
    })?;
    crate::config::atomic_write(&path, &json)?;
    Ok(())
}

/// 首次加载：扫描文件系统，创建 library.json
fn migrate_or_create_index() -> crate::error::Result<LibraryIndex> {
    let dir = library_dir()?;
    let mut books = Vec::new();

    if dir.exists() {
        let entries = fs::read_dir(&dir)
            .map_err(|e| crate::error::AppError::Internal(format!("读取电子书库失败: {}", e)))?;

        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            // 跳过 library.json 自身
            if path.file_name().map(|n| n == "library.json").unwrap_or(false) {
                continue;
            }

            let ext = match path.extension().and_then(|e| e.to_str()) {
                Some(e) => e,
                None => continue,
            };
            if !is_supported(ext) {
                continue;
            }

            let metadata = match fs::metadata(&path) {
                Ok(m) => m,
                Err(_) => continue,
            };

            let filename = path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            // 迁移时原始名已不可恢复，display_name 使用文件名
            let display_name = filename
                .rsplit_once('.')
                .map(|(n, _)| n.to_string())
                .unwrap_or_else(|| filename.clone());

            let added_at = metadata
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| {
                    chrono::DateTime::from_timestamp(d.as_secs() as i64, 0)
                        .unwrap_or_else(Utc::now)
                        .to_rfc3339()
                })
                .unwrap_or_else(|| Utc::now().to_rfc3339());

            books.push(EbookInfo {
                filename,
                original_name: String::new(),
                display_name,
                format: normalize_format(ext),
                size_bytes: metadata.len(),
                added_at,
                category_id: None,
                sort_order: books.len() as i64,
                starred: false,
            });
        }
    }

    let index = LibraryIndex {
        version: 1,
        categories: Vec::new(),
        books,
    };
    save_library_index(&index)?;
    Ok(index)
}

// ── Tauri 命令 ──

#[tauri::command]
pub fn get_ebook_library_dir() -> crate::error::Result<String> {
    use crate::error::ResultExt;
    let dir = library_dir()?;
    fs::create_dir_all(&dir).context("创建电子书库目录失败")?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_library_index() -> crate::error::Result<LibraryIndex> {
    load_library_index()
}

#[tauri::command]
pub fn list_ebook_library() -> crate::error::Result<Vec<EbookInfo>> {
    let index = load_library_index()?;
    Ok(index.books)
}

#[tauri::command]
pub fn import_ebook(
    source_path: String,
    category_id: Option<String>,
) -> crate::error::Result<EbookInfo> {
    use crate::error::ResultExt;

    let src = PathBuf::from(&source_path);

    if !src.is_file() {
        return Err(crate::error::AppError::ValidationError(format!(
            "文件不存在: {}",
            source_path
        )));
    }

    let canonical = src.canonicalize().map_err(|_| {
        crate::error::AppError::ValidationError(format!("无法解析文件路径: {}", source_path))
    })?;

    let home = dirs::home_dir()
        .ok_or_else(|| crate::error::AppError::Internal("无法获取用户主目录".to_string()))?;
    let home_str = home.to_string_lossy();
    let canonical_str = canonical.to_string_lossy();

    if !canonical_str.starts_with(home_str.as_ref()) {
        return Err(crate::error::AppError::SecurityError(
            "不允许导入主目录之外的文件".to_string(),
        ));
    }

    // 校验扩展名
    let ext = src
        .extension()
        .and_then(|e| e.to_str())
        .ok_or_else(|| crate::error::AppError::ValidationError("无法识别文件格式".to_string()))?;

    if !is_supported(ext) {
        return Err(crate::error::AppError::ValidationError(format!(
            "不支持的文件格式: .{}，支持格式: md, html, pdf, docx, epub",
            ext
        )));
    }

    let dir = library_dir()?;
    fs::create_dir_all(&dir).context("创建电子书库目录失败")?;

    // 生成 UUID 文件名，保留原始扩展名
    let original_name = src
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let new_filename = format!("{}.{}", Uuid::new_v4(), ext);
    let dest = dir.join(&new_filename);

    let msg = format!("复制文件到电子书库失败: {}", source_path);
    fs::copy(&src, &dest).context(&msg)?;

    let metadata = fs::metadata(&dest).context("获取文件元数据失败")?;

    // display_name = 去掉扩展名的原始文件名
    let display_name = original_name
        .rsplit_once('.')
        .map(|(n, _)| n.to_string())
        .unwrap_or_else(|| original_name.clone());

    // 写入索引
    let mut index = load_library_index()?;

    // 计算同分类内最大 sort_order
    let max_sort = index
        .books
        .iter()
        .filter(|b| b.category_id == category_id)
        .map(|b| b.sort_order)
        .max()
        .unwrap_or(-1);

    let book = EbookInfo {
        filename: new_filename,
        original_name,
        display_name,
        format: normalize_format(ext),
        size_bytes: metadata.len(),
        added_at: Utc::now().to_rfc3339(),
        category_id,
        sort_order: max_sort + 1,
        starred: false,
    };

    index.books.push(book.clone());
    save_library_index(&index)?;

    Ok(book)
}

#[tauri::command]
pub fn toggle_ebook_starred(filename: String) -> crate::error::Result<bool> {
    use crate::error::ResultExt;
    let mut index = load_library_index().context("加载电子书索引失败")?;
    let book = index.books.iter_mut()
        .find(|b| b.filename == filename)
        .ok_or_else(|| crate::error::AppError::Internal("书籍未找到".to_string()))?;
    book.starred = !book.starred;
    let new_val = book.starred;
    save_library_index(&index).context("保存电子书索引失败")?;
    Ok(new_val)
}

#[tauri::command]
pub fn delete_ebook(filename: String) -> crate::error::Result<()> {
    use crate::error::ResultExt;

    // 安全检查：禁止路径分隔符
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return Err(crate::error::AppError::ValidationError(
            "文件名包含非法字符".to_string(),
        ));
    }

    let dir = library_dir()?;
    let path = dir.join(&filename);

    if path.exists() {
        let msg = format!("删除文件失败: {}", filename);
        fs::remove_file(&path).context(&msg)?;
    }

    // 从索引中移除
    let mut index = load_library_index()?;
    index.books.retain(|b| b.filename != filename);
    save_library_index(&index)?;

    Ok(())
}

#[tauri::command]
pub fn rename_ebook(filename: String, new_name: String) -> crate::error::Result<()> {
    let mut index = load_library_index()?;
    let book = index
        .books
        .iter_mut()
        .find(|b| b.filename == filename)
        .ok_or_else(|| {
            crate::error::AppError::Internal(format!("书籍未找到: {}", filename))
        })?;
    book.display_name = new_name;
    save_library_index(&index)
}

#[tauri::command]
pub fn move_ebook(
    filename: String,
    category_id: Option<String>,
    sort_order: Option<i64>,
) -> crate::error::Result<()> {
    let mut index = load_library_index()?;
    let book = index
        .books
        .iter_mut()
        .find(|b| b.filename == filename)
        .ok_or_else(|| {
            crate::error::AppError::Internal(format!("书籍未找到: {}", filename))
        })?;
    book.category_id = category_id;
    if let Some(so) = sort_order {
        book.sort_order = so;
    }
    save_library_index(&index)
}

#[tauri::command]
pub fn create_category(
    name: String,
    parent_id: Option<String>,
) -> crate::error::Result<EbookCategory> {
    let mut index = load_library_index()?;
    let sort_order = index
        .categories
        .iter()
        .filter(|c| c.parent_id == parent_id)
        .map(|c| c.sort_order)
        .max()
        .unwrap_or(-1)
        + 1;

    let cat = EbookCategory {
        id: Uuid::new_v4().to_string(),
        name,
        parent_id,
        sort_order,
    };
    index.categories.push(cat.clone());
    save_library_index(&index)?;
    Ok(cat)
}

#[tauri::command]
pub fn rename_category(id: String, new_name: String) -> crate::error::Result<()> {
    let mut index = load_library_index()?;
    let cat = index
        .categories
        .iter_mut()
        .find(|c| c.id == id)
        .ok_or_else(|| {
            crate::error::AppError::Internal(format!("分类未找到: {}", id))
        })?;
    cat.name = new_name;
    save_library_index(&index)
}

#[tauri::command]
pub fn delete_category(
    id: String,
    move_books_to_parent: bool,
) -> crate::error::Result<()> {
    let mut index = load_library_index()?;

    // 递归收集所有后代分类 ID
    let to_remove = descendant_category_ids(&index.categories, &id);

    // 获取被删分类的 parent_id
    let parent_id = index
        .categories
        .iter()
        .find(|c| c.id == id)
        .and_then(|c| c.parent_id.clone());

    // 处理受影响分类下的书籍
    for book in &mut index.books {
        if let Some(ref cid) = book.category_id {
            if to_remove.contains(cid) {
                book.category_id = if move_books_to_parent {
                    parent_id.clone()
                } else {
                    None
                };
            }
        }
    }

    index
        .categories
        .retain(|c| !to_remove.contains(&c.id));
    save_library_index(&index)
}

#[tauri::command]
pub fn reorder_books(
    category_id: Option<String>,
    ordered_filenames: Vec<String>,
) -> crate::error::Result<()> {
    let mut index = load_library_index()?;
    let order_map: HashMap<String, i64> = ordered_filenames
        .iter()
        .enumerate()
        .map(|(i, f)| (f.clone(), i as i64))
        .collect();
    for book in &mut index.books {
        if book.category_id == category_id {
            if let Some(so) = order_map.get(&book.filename) {
                book.sort_order = *so;
            }
        }
    }
    save_library_index(&index)
}

#[tauri::command]
pub fn reorder_categories(
    parent_id: Option<String>,
    ordered_ids: Vec<String>,
) -> crate::error::Result<()> {
    let mut index = load_library_index()?;
    let order_map: HashMap<String, i64> = ordered_ids
        .iter()
        .enumerate()
        .map(|(i, id)| (id.clone(), i as i64))
        .collect();
    for cat in &mut index.categories {
        if cat.parent_id == parent_id {
            if let Some(so) = order_map.get(&cat.id) {
                cat.sort_order = *so;
            }
        }
    }
    save_library_index(&index)
}

#[tauri::command]
pub fn read_ebook_file(filename: String) -> crate::error::Result<EbookContent> {
    use crate::error::ResultExt;

    // 安全检查：禁止路径分隔符
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return Err(crate::error::AppError::ValidationError(
            "文件名包含非法字符".to_string(),
        ));
    }

    let dir = library_dir()?;
    let path = dir.join(&filename);

    if !path.exists() {
        return Err(crate::error::AppError::Internal(format!(
            "文件不存在: {}",
            filename
        )));
    }

    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");

    if is_binary_format(ext) {
        // 二进制格式：读取并 base64 编码
        let msg = format!("读取文件失败: {}", filename);
        let bytes = fs::read(&path).context(&msg)?;
        Ok(EbookContent {
            data: BASE64.encode(&bytes),
            is_binary: true,
        })
    } else {
        // 文本格式：读取为 UTF-8
        let msg = format!("读取文件失败: {}", filename);
        let content = fs::read_to_string(&path).context(&msg)?;
        Ok(EbookContent {
            data: content,
            is_binary: false,
        })
    }
}

#[tauri::command]
pub fn open_ebook_reader(app_handle: tauri::AppHandle) -> crate::error::Result<()> {
    use crate::error::ResultExt;
    use tauri::Manager;
    use tauri::WebviewUrl;
    use tauri::WebviewWindowBuilder;

    let window_label = "ebook-reader";

    // 如果窗口已存在，聚焦并返回
    if let Some(existing) = app_handle.get_webview_window(window_label) {
        let _ = existing.set_focus();
        return Ok(());
    }

    // 构建 URL：开发模式用 dev server，发布模式用构建产物
    let url = if cfg!(debug_assertions) {
        WebviewUrl::External(
            "http://localhost:1420/reader.html"
                .parse()
                .context("URL 解析失败")?,
        )
    } else {
        WebviewUrl::App("reader.html".into())
    };

    WebviewWindowBuilder::new(&app_handle, window_label, url)
        .title("电子书阅读器 - AiDocPlus")
        .inner_size(1200.0, 800.0)
        .min_inner_size(900.0, 600.0)
        .resizable(true)
        .build()
        .context("创建电子书阅读器窗口失败")?;

    Ok(())
}

/// 递归收集分类及其所有后代 ID
fn descendant_category_ids(categories: &[EbookCategory], id: &str) -> Vec<String> {
    let mut result = vec![id.to_string()];
    let mut i = 0;
    while i < result.len() {
        for c in categories {
            if c.parent_id.as_deref() == Some(&result[i]) && !result.contains(&c.id) {
                result.push(c.id.clone());
            }
        }
        i += 1;
    }
    result
}

#[tauri::command]
pub fn export_ebook(filename: String, dest_path: String) -> crate::error::Result<()> {
    use crate::error::ResultExt;

    // 安全检查：禁止路径分隔符
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return Err(crate::error::AppError::ValidationError(
            "文件名包含非法字符".to_string(),
        ));
    }

    let dir = library_dir()?;
    let src = dir.join(&filename);

    if !src.exists() {
        return Err(crate::error::AppError::Internal(format!(
            "文件不存在: {}",
            filename
        )));
    }

    let msg = format!("导出文件失败: {}", filename);
    fs::copy(&src, &dest_path).context(&msg)?;

    Ok(())
}

#[tauri::command]
pub fn move_category(
    category_id: String,
    new_parent_id: Option<String>,
) -> crate::error::Result<()> {
    use crate::error::ResultExt;

    let mut index = load_library_index().context("加载电子书索引失败")?;

    // 不能移动到自身
    if new_parent_id.as_deref() == Some(&category_id) {
        return Err(crate::error::AppError::ValidationError(
            "不能将分类移动到自身".to_string(),
        ));
    }

    // 不能移动到自己的后代
    let descendants = descendant_category_ids(&index.categories, &category_id);
    if new_parent_id.as_ref().map_or(false, |pid| descendants.contains(pid)) {
        return Err(crate::error::AppError::ValidationError(
            "不能将分类移动到其子分类中".to_string(),
        ));
    }

    let cat_idx = index
        .categories
        .iter()
        .position(|c| c.id == category_id)
        .ok_or_else(|| {
            crate::error::AppError::Internal(format!("分类未找到: {}", category_id))
        })?;

    index.categories[cat_idx].parent_id = new_parent_id.clone();

    // 自动设置 sort_order = max(同级) + 1
    let max_sort = index
        .categories
        .iter()
        .filter(|c| c.parent_id == new_parent_id && c.id != category_id)
        .map(|c| c.sort_order)
        .max()
        .unwrap_or(-1);
    index.categories[cat_idx].sort_order = max_sort + 1;

    save_library_index(&index).context("保存电子书索引失败")
}

// ── 单元测试 ──

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_supported_extensions() {
        assert!(is_supported("md"));
        assert!(is_supported("html"));
        assert!(is_supported("htm"));
        assert!(is_supported("docx"));
        assert!(is_supported("pdf"));
        assert!(is_supported("epub"));
        assert!(is_supported("MD")); // 大写
        assert!(is_supported("PDF")); // 大写
    }

    #[test]
    fn test_unsupported_extension() {
        assert!(!is_supported("exe"));
        assert!(!is_supported("txt"));
        assert!(!is_supported("png"));
        assert!(!is_supported("zip"));
    }

    #[test]
    fn test_binary_formats() {
        assert!(is_binary_format("pdf"));
        assert!(is_binary_format("docx"));
        assert!(is_binary_format("epub"));
        assert!(!is_binary_format("md"));
        assert!(!is_binary_format("html"));
    }

    #[test]
    fn test_normalize_format() {
        assert_eq!(normalize_format("htm"), "html");
        assert_eq!(normalize_format("html"), "html");
        assert_eq!(normalize_format("md"), "md");
        assert_eq!(normalize_format("pdf"), "pdf");
    }

    #[test]
    fn test_filename_security() {
        // 路径分隔符应被拒绝
        assert!(contains_path_separator("../../../etc/passwd"));
        assert!(contains_path_separator("foo/bar.txt"));
        assert!(contains_path_separator("foo\\bar.txt"));
        assert!(contains_path_separator(".."));
        assert!(!contains_path_separator("valid-filename.pdf"));
        assert!(!contains_path_separator("uuid-1234.epub"));
    }

    fn contains_path_separator(name: &str) -> bool {
        name.contains('/') || name.contains('\\') || name.contains("..")
    }
}
