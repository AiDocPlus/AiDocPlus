use std::fs;
use std::io::{Read, Write};
use std::path::Path;

/// 导出资源为 ZIP 文件
pub fn export_resources(resource_paths: &[String], output_path: &str) -> Result<String, String> {
    let file =
        fs::File::create(output_path).map_err(|e| format!("创建 ZIP 文件失败: {}", e))?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    for resource_path in resource_paths {
        let path = Path::new(resource_path);
        if !path.exists() || !path.is_dir() {
            continue;
        }

        let resource_name = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        // 递归添加目录中的所有文件
        add_dir_to_zip(&mut zip, path, &resource_name, options)
            .map_err(|e| format!("添加文件到 ZIP 失败: {}", e))?;
    }

    zip.finish()
        .map_err(|e| format!("完成 ZIP 写入失败: {}", e))?;

    Ok(output_path.to_string())
}

fn add_dir_to_zip(
    zip: &mut zip::ZipWriter<fs::File>,
    dir: &Path,
    prefix: &str,
    options: zip::write::FileOptions,
) -> Result<(), String> {
    let entries = fs::read_dir(dir).map_err(|e| format!("读取目录失败: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        let name = format!(
            "{}/{}",
            prefix,
            path.file_name()
                .unwrap_or_default()
                .to_string_lossy()
        );

        if path.is_dir() {
            add_dir_to_zip(zip, &path, &name, options)?;
        } else {
            let mut file =
                fs::File::open(&path).map_err(|e| format!("打开文件失败: {}", e))?;
            let mut buffer = Vec::new();
            file.read_to_end(&mut buffer)
                .map_err(|e| format!("读取文件失败: {}", e))?;

            zip.start_file(&name, options)
                .map_err(|e| format!("创建 ZIP 条目失败: {}", e))?;
            zip.write_all(&buffer)
                .map_err(|e| format!("写入 ZIP 失败: {}", e))?;
        }
    }

    Ok(())
}

/// 从 ZIP 文件导入资源
pub fn import_resources(zip_path: &str, data_dir: &str) -> Result<ImportResult, String> {
    let file = fs::File::open(zip_path).map_err(|e| format!("打开 ZIP 文件失败: {}", e))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("解析 ZIP 文件失败: {}", e))?;

    let mut imported = Vec::new();
    let mut skipped = Vec::new();

    // 收集所有顶层目录名
    let mut top_dirs: std::collections::HashSet<String> = std::collections::HashSet::new();
    for i in 0..archive.len() {
        if let Ok(file) = archive.by_index(i) {
            if let Some(first_component) = file.name().split('/').next() {
                if !first_component.is_empty() {
                    top_dirs.insert(first_component.to_string());
                }
            }
        }
    }

    for top_dir in &top_dirs {
        // 检查目标目录是否已存在
        // 导入时放入 data_dir 的根目录下（用户后续可移动分类）
        let target_dir = Path::new(data_dir).join("imported").join(top_dir);
        if target_dir.exists() {
            skipped.push(top_dir.clone());
            continue;
        }

        fs::create_dir_all(&target_dir).map_err(|e| format!("创建目录失败: {}", e))?;
        imported.push(top_dir.clone());
    }

    // 解压文件
    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("读取 ZIP 条目失败: {}", e))?;

        let name = file.name().to_string();
        let first_component = name.split('/').next().unwrap_or("");

        if !imported.contains(&first_component.to_string()) {
            continue;
        }

        let target_path = Path::new(data_dir).join("imported").join(&name);

        if file.is_dir() {
            fs::create_dir_all(&target_path).ok();
        } else {
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent).ok();
            }
            let mut buffer = Vec::new();
            file.read_to_end(&mut buffer)
                .map_err(|e| format!("读取 ZIP 内容失败: {}", e))?;
            fs::write(&target_path, buffer)
                .map_err(|e| format!("写入文件失败: {}", e))?;
        }
    }

    Ok(ImportResult {
        imported,
        skipped,
        failed: Vec::new(),
    })
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ImportResult {
    pub imported: Vec<String>,
    pub skipped: Vec<String>,
    pub failed: Vec<ImportFailure>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ImportFailure {
    pub id: String,
    pub error: String,
}
