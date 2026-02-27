use crate::types::{ContentFileEntry, GenericManifest, ResourceSummary};
use std::fs;
use std::path::Path;

/// 扫描数据目录，返回所有资源摘要
pub fn scan_resources(data_dir: &str) -> Result<Vec<ResourceSummary>, String> {
    let data_path = Path::new(data_dir);
    eprintln!("[DEBUG] scan_resources: data_dir={}", data_dir);
    if !data_path.exists() {
        eprintln!("[DEBUG] scan_resources: 目录不存在!");
        return Ok(Vec::new());
    }

    let mut resources = Vec::new();

    // 遍历分类目录
    let entries = fs::read_dir(data_path).map_err(|e| format!("读取目录失败: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let dir_name = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        // 跳过 _meta.json 等非目录项和隐藏目录
        if dir_name.starts_with('_') || dir_name.starts_with('.') {
            continue;
        }

        // 检查是否直接包含 manifest.json（扁平结构）
        let manifest_path = path.join("manifest.json");
        if manifest_path.exists() {
            if let Ok(summary) = read_resource_summary(&path) {
                resources.push(summary);
            }
            continue;
        }

        // 遍历子目录（分类/资源 两级结构）
        if let Ok(sub_entries) = fs::read_dir(&path) {
            for sub_entry in sub_entries.flatten() {
                let sub_path = sub_entry.path();
                if !sub_path.is_dir() {
                    continue;
                }
                let sub_manifest = sub_path.join("manifest.json");
                if sub_manifest.exists() {
                    if let Ok(summary) = read_resource_summary(&sub_path) {
                        resources.push(summary);
                    }
                }
            }
        }
    }

    // 按分类分组，组内按 order 排序（order 是分类内排序）
    resources.sort_by(|a, b| {
        a.major_category
            .cmp(&b.major_category)
            .then(a.order.cmp(&b.order))
            .then(a.name.cmp(&b.name))
    });
    Ok(resources)
}

/// 读取单个资源摘要
fn read_resource_summary(resource_dir: &Path) -> Result<ResourceSummary, String> {
    let manifest_path = resource_dir.join("manifest.json");
    let content =
        fs::read_to_string(&manifest_path).map_err(|e| format!("读取 manifest 失败: {}", e))?;
    let manifest: GenericManifest =
        serde_json::from_str(&content).map_err(|e| format!("解析 manifest 失败: {}", e))?;
    Ok(manifest.to_summary(resource_dir.to_string_lossy().to_string()))
}

/// 读取完整 manifest JSON
pub fn read_manifest(resource_path: &str) -> Result<serde_json::Value, String> {
    let manifest_path = Path::new(resource_path).join("manifest.json");
    let content =
        fs::read_to_string(&manifest_path).map_err(|e| format!("读取 manifest 失败: {}", e))?;
    serde_json::from_str(&content).map_err(|e| format!("解析 manifest 失败: {}", e))
}

/// 保存 manifest JSON
pub fn save_manifest(resource_path: &str, manifest: serde_json::Value) -> Result<(), String> {
    let manifest_path = Path::new(resource_path).join("manifest.json");
    let content = serde_json::to_string_pretty(&manifest)
        .map_err(|e| format!("序列化 manifest 失败: {}", e))?;
    fs::write(&manifest_path, content).map_err(|e| format!("写入 manifest 失败: {}", e))
}

/// 创建新资源
pub fn create_resource(
    data_dir: &str,
    category: &str,
    id: &str,
    manifest: serde_json::Value,
    content_files: Vec<ContentFileEntry>,
) -> Result<String, String> {
    let resource_dir = Path::new(data_dir).join(category).join(id);

    if resource_dir.exists() {
        return Err(format!("资源目录已存在: {}", resource_dir.display()));
    }

    // 自动计算同分类下的最大 order + 1
    let mut manifest = manifest;
    let category_dir = Path::new(data_dir).join(category);
    if category_dir.exists() {
        let mut max_order: i64 = -1;
        if let Ok(entries) = fs::read_dir(&category_dir) {
            for entry in entries.flatten() {
                let mp = entry.path().join("manifest.json");
                if mp.exists() {
                    if let Ok(content) = fs::read_to_string(&mp) {
                        if let Ok(m) = serde_json::from_str::<serde_json::Value>(&content) {
                            let order = m.get("order").and_then(|v| v.as_i64()).unwrap_or(0);
                            if order > max_order {
                                max_order = order;
                            }
                        }
                    }
                }
            }
        }
        if let Some(obj) = manifest.as_object_mut() {
            obj.insert("order".to_string(), serde_json::json!(max_order + 1));
        }
    }

    fs::create_dir_all(&resource_dir).map_err(|e| format!("创建目录失败: {}", e))?;

    // 写入 manifest.json
    let manifest_content = serde_json::to_string_pretty(&manifest)
        .map_err(|e| format!("序列化 manifest 失败: {}", e))?;
    fs::write(resource_dir.join("manifest.json"), manifest_content)
        .map_err(|e| format!("写入 manifest 失败: {}", e))?;

    // 写入附属内容文件
    for file in &content_files {
        fs::write(resource_dir.join(&file.filename), &file.content)
            .map_err(|e| format!("写入 {} 失败: {}", file.filename, e))?;
    }

    Ok(resource_dir.to_string_lossy().to_string())
}

/// 删除资源（整个目录）
pub fn delete_resource(resource_path: &str) -> Result<(), String> {
    let path = Path::new(resource_path);
    if !path.exists() {
        return Err("资源目录不存在".to_string());
    }
    fs::remove_dir_all(path).map_err(|e| format!("删除资源失败: {}", e))
}

/// 批量删除资源
pub fn batch_delete_resources(resource_paths: &[String]) -> Result<u32, String> {
    let mut count = 0u32;
    for path in resource_paths {
        let p = Path::new(path);
        if p.exists() {
            fs::remove_dir_all(p).map_err(|e| format!("删除 {} 失败: {}", path, e))?;
            count += 1;
        }
    }
    Ok(count)
}

/// 读取内容文件
pub fn read_content_file(file_path: &str) -> Result<String, String> {
    fs::read_to_string(file_path).map_err(|e| format!("读取文件失败: {}", e))
}

/// 保存内容文件
pub fn save_content_file(file_path: &str, content: &str) -> Result<(), String> {
    fs::write(file_path, content).map_err(|e| format!("写入文件失败: {}", e))
}

/// 批量更新排序
pub fn reorder_resources(
    id_order_pairs: Vec<(String, i32)>,
) -> Result<(), String> {
    for (resource_path, new_order) in &id_order_pairs {
        let manifest_path = Path::new(resource_path).join("manifest.json");
        if !manifest_path.exists() {
            continue;
        }
        let content = fs::read_to_string(&manifest_path)
            .map_err(|e| format!("读取 manifest 失败: {}", e))?;
        let mut manifest: serde_json::Value =
            serde_json::from_str(&content).map_err(|e| format!("解析 manifest 失败: {}", e))?;

        if let Some(obj) = manifest.as_object_mut() {
            obj.insert("order".to_string(), serde_json::json!(new_order));
            obj.insert(
                "updatedAt".to_string(),
                serde_json::json!(chrono::Utc::now().to_rfc3339()),
            );
        }

        let new_content = serde_json::to_string_pretty(&manifest)
            .map_err(|e| format!("序列化失败: {}", e))?;
        fs::write(&manifest_path, new_content).map_err(|e| format!("写入失败: {}", e))?;
    }
    Ok(())
}

/// 批量设置启用/禁用
pub fn batch_set_enabled(resource_paths: &[String], enabled: bool) -> Result<u32, String> {
    let mut count = 0u32;
    for path in resource_paths {
        let manifest_path = Path::new(path).join("manifest.json");
        if !manifest_path.exists() {
            continue;
        }
        let content = fs::read_to_string(&manifest_path)
            .map_err(|e| format!("读取失败: {}", e))?;
        let mut manifest: serde_json::Value =
            serde_json::from_str(&content).map_err(|e| format!("解析失败: {}", e))?;

        if let Some(obj) = manifest.as_object_mut() {
            obj.insert("enabled".to_string(), serde_json::json!(enabled));
            obj.insert(
                "updatedAt".to_string(),
                serde_json::json!(chrono::Utc::now().to_rfc3339()),
            );
        }

        let new_content = serde_json::to_string_pretty(&manifest)
            .map_err(|e| format!("序列化失败: {}", e))?;
        fs::write(&manifest_path, new_content).map_err(|e| format!("写入失败: {}", e))?;
        count += 1;
    }
    Ok(count)
}

/// 批量移动分类
pub fn batch_move_category(
    resource_paths: &[String],
    new_category: &str,
) -> Result<u32, String> {
    let mut count = 0u32;
    for resource_path in resource_paths {
        let manifest_path = Path::new(resource_path).join("manifest.json");
        if !manifest_path.exists() {
            continue;
        }
        let content = fs::read_to_string(&manifest_path)
            .map_err(|e| format!("读取失败: {}", e))?;
        let mut manifest: serde_json::Value =
            serde_json::from_str(&content).map_err(|e| format!("解析失败: {}", e))?;

        if let Some(obj) = manifest.as_object_mut() {
            obj.insert(
                "majorCategory".to_string(),
                serde_json::json!(new_category),
            );
            obj.insert(
                "updatedAt".to_string(),
                serde_json::json!(chrono::Utc::now().to_rfc3339()),
            );
        }

        let new_content = serde_json::to_string_pretty(&manifest)
            .map_err(|e| format!("序列化失败: {}", e))?;
        fs::write(&manifest_path, new_content).map_err(|e| format!("写入失败: {}", e))?;

        // 移动目录到新分类下
        let old_path = Path::new(resource_path);
        let resource_name = old_path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let data_dir = old_path
            .parent()
            .and_then(|p| p.parent())
            .ok_or("无法获取数据目录")?;
        let new_dir = data_dir.join(new_category).join(&resource_name);

        if new_dir != old_path {
            fs::create_dir_all(new_dir.parent().unwrap_or(data_dir))
                .map_err(|e| format!("创建目录失败: {}", e))?;
            fs::rename(old_path, &new_dir).map_err(|e| format!("移动目录失败: {}", e))?;
        }

        count += 1;
    }
    Ok(count)
}

/// 一键重排：每个分类内的资源按名称排序后重新赋值 order 为 0, 1, 2...
pub fn reindex_all_orders(data_dir: &str) -> Result<u32, String> {
    let data_path = Path::new(data_dir);
    if !data_path.exists() {
        return Ok(0);
    }

    let mut total = 0u32;
    let entries = fs::read_dir(data_path).map_err(|e| format!("读取目录失败: {}", e))?;
    for entry in entries.flatten() {
        let cat_path = entry.path();
        if !cat_path.is_dir() {
            continue;
        }
        let dir_name = cat_path.file_name().unwrap_or_default().to_string_lossy().to_string();
        if dir_name.starts_with('_') || dir_name.starts_with('.') {
            continue;
        }

        // 收集分类下的资源目录
        let mut resource_dirs: Vec<std::path::PathBuf> = Vec::new();
        if let Ok(sub_entries) = fs::read_dir(&cat_path) {
            for sub_entry in sub_entries.flatten() {
                let sub_path = sub_entry.path();
                if sub_path.is_dir() && sub_path.join("manifest.json").exists() {
                    resource_dirs.push(sub_path);
                }
            }
        }

        if resource_dirs.is_empty() {
            continue;
        }

        // 按名称排序
        resource_dirs.sort_by(|a, b| {
            let name_a = read_manifest_name(a).unwrap_or_default();
            let name_b = read_manifest_name(b).unwrap_or_default();
            name_a.cmp(&name_b)
        });

        // 重新赋值 order 0, 1, 2...
        for (i, dir) in resource_dirs.iter().enumerate() {
            let manifest_path = dir.join("manifest.json");
            if let Ok(content) = fs::read_to_string(&manifest_path) {
                if let Ok(mut manifest) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(obj) = manifest.as_object_mut() {
                        obj.insert("order".to_string(), serde_json::json!(i as i32));
                    }
                    if let Ok(new_content) = serde_json::to_string_pretty(&manifest) {
                        let _ = fs::write(&manifest_path, new_content);
                        total += 1;
                    }
                }
            }
        }
    }

    Ok(total)
}

/// 从 manifest.json 读取 name 字段（用于排序）
fn read_manifest_name(resource_dir: &Path) -> Option<String> {
    let content = fs::read_to_string(resource_dir.join("manifest.json")).ok()?;
    let manifest: serde_json::Value = serde_json::from_str(&content).ok()?;
    manifest.get("name").and_then(|v| v.as_str()).map(|s| s.to_string())
}
