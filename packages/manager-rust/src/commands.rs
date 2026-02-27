use crate::ai;
use crate::category_ops;
use crate::import_export;
use crate::json_file_ops;
use crate::resource_ops;
use crate::types::{AIServiceConfig, ContentFileEntry, LocalAIServices, MetaConfig, ResourceSummary, SharedAIServices};
use tauri::{State, Window};
use std::sync::Mutex;

// ============================================================
// 数据目录状态（由启动参数传入）
// ============================================================

pub struct DataDirState(pub Mutex<Option<String>>);

impl DataDirState {
    pub fn new() -> Self {
        Self(Mutex::new(None))
    }

    pub fn set(&self, dir: String) {
        if let Ok(mut guard) = self.0.lock() {
            *guard = Some(dir);
        }
    }

    pub fn get(&self) -> Option<String> {
        self.0.lock().ok().and_then(|g| g.clone())
    }
}

/// 获取启动参数传入的数据目录
#[tauri::command]
pub fn cmd_get_data_dir(state: State<'_, DataDirState>) -> Result<Option<String>, String> {
    Ok(state.get())
}

// ============================================================
// 资源 CRUD 命令
// ============================================================

#[tauri::command]
pub fn cmd_scan_resources(data_dir: String) -> Result<Vec<ResourceSummary>, String> {
    resource_ops::scan_resources(&data_dir)
}

#[tauri::command]
pub fn cmd_read_manifest(resource_path: String) -> Result<serde_json::Value, String> {
    resource_ops::read_manifest(&resource_path)
}

#[tauri::command]
pub fn cmd_save_manifest(
    resource_path: String,
    manifest: serde_json::Value,
) -> Result<(), String> {
    resource_ops::save_manifest(&resource_path, manifest)
}

#[tauri::command]
pub fn cmd_create_resource(
    data_dir: String,
    category: String,
    id: String,
    manifest: serde_json::Value,
    content_files: Vec<ContentFileEntry>,
) -> Result<String, String> {
    resource_ops::create_resource(&data_dir, &category, &id, manifest, content_files)
}

#[tauri::command]
pub fn cmd_delete_resource(resource_path: String) -> Result<(), String> {
    resource_ops::delete_resource(&resource_path)
}

#[tauri::command]
pub fn cmd_batch_delete_resources(resource_paths: Vec<String>) -> Result<u32, String> {
    resource_ops::batch_delete_resources(&resource_paths)
}

#[tauri::command]
pub fn cmd_reorder_resources(id_order_pairs: Vec<(String, i32)>) -> Result<(), String> {
    resource_ops::reorder_resources(id_order_pairs)
}

#[tauri::command]
pub fn cmd_reindex_all_orders(data_dir: String) -> Result<u32, String> {
    resource_ops::reindex_all_orders(&data_dir)
}

// ============================================================
// 内容文件命令
// ============================================================

#[tauri::command]
pub fn cmd_read_content_file(file_path: String) -> Result<String, String> {
    resource_ops::read_content_file(&file_path)
}

#[tauri::command]
pub fn cmd_save_content_file(file_path: String, content: String) -> Result<(), String> {
    resource_ops::save_content_file(&file_path, &content)
}

// ============================================================
// 分类管理命令
// ============================================================

#[tauri::command]
pub fn cmd_read_meta(data_dir: String) -> Result<MetaConfig, String> {
    category_ops::read_meta(&data_dir)
}

#[tauri::command]
pub fn cmd_save_meta(data_dir: String, meta: MetaConfig) -> Result<(), String> {
    category_ops::save_meta(&data_dir, meta)
}

// ============================================================
// 导入导出命令
// ============================================================

#[tauri::command]
pub fn cmd_export_resources(
    resource_paths: Vec<String>,
    output_path: String,
) -> Result<String, String> {
    import_export::export_resources(&resource_paths, &output_path)
}

#[tauri::command]
pub fn cmd_import_resources(
    zip_path: String,
    data_dir: String,
) -> Result<import_export::ImportResult, String> {
    import_export::import_resources(&zip_path, &data_dir)
}

// ============================================================
// 批量操作命令
// ============================================================

#[tauri::command]
pub fn cmd_batch_set_enabled(
    resource_paths: Vec<String>,
    enabled: bool,
) -> Result<u32, String> {
    resource_ops::batch_set_enabled(&resource_paths, enabled)
}

#[tauri::command]
pub fn cmd_batch_move_category(
    resource_paths: Vec<String>,
    new_category: String,
) -> Result<u32, String> {
    resource_ops::batch_move_category(&resource_paths, &new_category)
}

// ============================================================
// AI 生成命令
// ============================================================

#[tauri::command]
pub async fn cmd_ai_generate(
    config: AIServiceConfig,
    system_prompt: String,
    user_prompt: String,
) -> Result<String, String> {
    ai::ai_generate(&config, &system_prompt, &user_prompt).await
}

#[tauri::command]
pub async fn cmd_ai_generate_stream(
    window: Window,
    config: AIServiceConfig,
    system_prompt: String,
    user_prompt: String,
) -> Result<String, String> {
    ai::ai_generate_stream(window, &config, &system_prompt, &user_prompt, "ai-generate-stream")
        .await
}

// ============================================================
// 构建触发命令
// ============================================================

#[tauri::command]
pub fn cmd_run_build_script(repo_dir: String) -> Result<String, String> {
    let build_script = std::path::Path::new(&repo_dir).join("scripts").join("build.sh");
    if !build_script.exists() {
        return Err("build.sh 不存在".to_string());
    }

    let output = std::process::Command::new("bash")
        .arg(&build_script)
        .current_dir(&repo_dir)
        .output()
        .map_err(|e| format!("执行 build.sh 失败: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(format!(
            "build.sh 执行失败:\n{}",
            String::from_utf8_lossy(&output.stderr)
        ))
    }
}

// ============================================================
// AI 配置持久化
// ============================================================

#[tauri::command]
pub fn cmd_load_ai_config() -> Result<AIServiceConfig, String> {
    let config_path = get_ai_config_path()?;
    if !config_path.exists() {
        return Ok(AIServiceConfig {
            base_url: "https://api.openai.com/v1".to_string(),
            api_key: String::new(),
            model: "gpt-4o".to_string(),
            max_tokens: 4096,
            temperature: 0.7,
        });
    }
    let content =
        std::fs::read_to_string(&config_path).map_err(|e| format!("读取 AI 配置失败: {}", e))?;
    serde_json::from_str(&content).map_err(|e| format!("解析 AI 配置失败: {}", e))
}

#[tauri::command]
pub fn cmd_save_ai_config(config: AIServiceConfig) -> Result<(), String> {
    let config_path = get_ai_config_path()?;
    if let Some(parent) = config_path.parent() {
        std::fs::create_dir_all(parent).ok();
    }
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("序列化 AI 配置失败: {}", e))?;
    std::fs::write(&config_path, content).map_err(|e| format!("写入 AI 配置失败: {}", e))
}

fn get_ai_config_path() -> Result<std::path::PathBuf, String> {
    let home = dirs::home_dir().ok_or("无法获取用户主目录")?;
    Ok(home
        .join(".aidocplus")
        .join("manager-ai-config.json"))
}

// ============================================================
// 读取主程序共享的 AI 服务列表
// ============================================================

#[tauri::command]
pub fn cmd_load_shared_ai_services() -> Result<SharedAIServices, String> {
    let home = dirs::home_dir().ok_or("无法获取用户主目录")?;
    let path = home.join(".aidocplus").join("ai-services.json");
    if !path.exists() {
        return Ok(SharedAIServices {
            services: vec![],
            active_service_id: String::new(),
            temperature: 0.7,
            max_tokens: 4096,
        });
    }
    let content =
        std::fs::read_to_string(&path).map_err(|e| format!("读取共享 AI 服务列表失败: {}", e))?;
    serde_json::from_str(&content).map_err(|e| format!("解析共享 AI 服务列表失败: {}", e))
}

// ============================================================
// 资源管理器本地 AI 服务列表
// ============================================================

fn get_local_ai_services_path() -> Result<std::path::PathBuf, String> {
    let home = dirs::home_dir().ok_or("无法获取用户主目录")?;
    Ok(home.join(".aidocplus").join("manager-ai-services.json"))
}

#[tauri::command]
pub fn cmd_load_local_ai_services() -> Result<LocalAIServices, String> {
    let path = get_local_ai_services_path()?;
    if !path.exists() {
        return Ok(LocalAIServices {
            services: vec![],
            active_service_id: String::new(),
        });
    }
    let content =
        std::fs::read_to_string(&path).map_err(|e| format!("读取本地 AI 服务列表失败: {}", e))?;
    serde_json::from_str(&content).map_err(|e| format!("解析本地 AI 服务列表失败: {}", e))
}

#[tauri::command]
pub fn cmd_save_local_ai_services(data: LocalAIServices) -> Result<(), String> {
    let path = get_local_ai_services_path()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).ok();
    }
    let content = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("序列化本地 AI 服务列表失败: {}", e))?;
    std::fs::write(&path, content).map_err(|e| format!("写入本地 AI 服务列表失败: {}", e))
}

// ============================================================
// JSON 文件模式命令（提示词模板等使用）
// ============================================================

#[tauri::command]
pub fn cmd_scan_json_resources(data_dir: String) -> Result<Vec<ResourceSummary>, String> {
    json_file_ops::scan_json_resources(&data_dir)
}

#[tauri::command]
pub fn cmd_read_json_categories(data_dir: String) -> Result<Vec<crate::types::CategoryDefinition>, String> {
    json_file_ops::read_json_categories(&data_dir)
}

#[tauri::command]
pub fn cmd_read_json_template(
    data_dir: String,
    category_key: String,
    template_id: String,
) -> Result<json_file_ops::JsonResourceDetail, String> {
    json_file_ops::read_json_template(&data_dir, &category_key, &template_id)
}

#[tauri::command]
pub fn cmd_save_json_template(
    data_dir: String,
    category_key: String,
    template_id: String,
    name: String,
    description: String,
    content: String,
    variables: Vec<String>,
    author_notes: Option<String>,
    ai_generated_content: Option<String>,
    enabled_plugins: Option<Vec<String>>,
    plugin_data: Option<serde_json::Value>,
    include_content: Option<bool>,
    include_ai_content: Option<bool>,
) -> Result<(), String> {
    json_file_ops::save_json_template(&data_dir, &category_key, &template_id, &name, &description, &content, variables, author_notes, ai_generated_content, enabled_plugins, plugin_data, include_content, include_ai_content)
}

#[tauri::command]
pub fn cmd_create_json_template(
    data_dir: String,
    category_key: String,
    id: String,
    name: String,
    description: String,
    content: String,
    variables: Vec<String>,
    author_notes: Option<String>,
    ai_generated_content: Option<String>,
    enabled_plugins: Option<Vec<String>>,
    plugin_data: Option<serde_json::Value>,
    include_content: Option<bool>,
    include_ai_content: Option<bool>,
) -> Result<String, String> {
    json_file_ops::create_json_template(&data_dir, &category_key, &id, &name, &description, &content, variables, author_notes, ai_generated_content, enabled_plugins, plugin_data, include_content, include_ai_content)
}

#[tauri::command]
pub fn cmd_delete_json_template(
    data_dir: String,
    category_key: String,
    template_id: String,
) -> Result<(), String> {
    json_file_ops::delete_json_template(&data_dir, &category_key, &template_id)
}

#[tauri::command]
pub fn cmd_batch_delete_json_templates(
    data_dir: String,
    paths: Vec<String>,
) -> Result<u32, String> {
    json_file_ops::batch_delete_json_templates(&data_dir, &paths)
}

#[tauri::command]
pub fn cmd_move_json_template(
    data_dir: String,
    from_category: String,
    template_id: String,
    to_category: String,
) -> Result<(), String> {
    json_file_ops::move_json_template(&data_dir, &from_category, &template_id, &to_category)
}

#[tauri::command]
pub fn cmd_save_json_category(
    data_dir: String,
    category_key: String,
    name: String,
    icon: String,
    order: i32,
) -> Result<(), String> {
    json_file_ops::save_json_category(&data_dir, &category_key, &name, &icon, order)
}

/// 返回所有需要注册的 Tauri 命令的 invoke_handler
/// 在各 app 的 main.rs 中调用：
/// ```rust
/// .invoke_handler(aidocplus_manager_rust::commands::get_invoke_handler())
/// ```
pub fn get_command_handlers() -> impl Fn(tauri::ipc::Invoke) -> bool {
    tauri::generate_handler![
        cmd_get_data_dir,
        cmd_scan_resources,
        cmd_read_manifest,
        cmd_save_manifest,
        cmd_create_resource,
        cmd_delete_resource,
        cmd_batch_delete_resources,
        cmd_reorder_resources,
        cmd_reindex_all_orders,
        cmd_read_content_file,
        cmd_save_content_file,
        cmd_read_meta,
        cmd_save_meta,
        cmd_export_resources,
        cmd_import_resources,
        cmd_batch_set_enabled,
        cmd_batch_move_category,
        cmd_ai_generate,
        cmd_ai_generate_stream,
        cmd_run_build_script,
        cmd_load_ai_config,
        cmd_save_ai_config,
        cmd_load_shared_ai_services,
        cmd_load_local_ai_services,
        cmd_save_local_ai_services,
        // JSON 文件模式命令
        cmd_scan_json_resources,
        cmd_read_json_categories,
        cmd_read_json_template,
        cmd_save_json_template,
        cmd_create_json_template,
        cmd_delete_json_template,
        cmd_batch_delete_json_templates,
        cmd_move_json_template,
        cmd_save_json_category,
    ]
}
