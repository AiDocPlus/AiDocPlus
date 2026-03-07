// Prevents additional console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ai;
mod api_gateway;
mod api_server;
mod cli;
mod commands;
mod config;
mod document;
mod error;
mod native_export;
mod paths;
mod plugin;
mod project;
mod template;
mod tools;
mod workspace;

use commands::{
    ai::*,
    document::*,
    email::*,
    export::*,
    file_system::*,
    import::*,
    pandoc::*,
    plugin::*,
    project::*,
    resource::*,
    search::*,
    settings::*,
    template::*,
    wechat::*,
    workspace::*,
    tts::*,
    python::*,
    nodejs::*,
    coding::*,
    script_runner::*,
};
use commands::tts::TtsState;
use commands::script_runner::RunningScriptState;
use aidocplus_manager_rust::commands::DataDirState;
use tauri::{Manager, Emitter, Listener};
use tauri::menu::{
    MenuBuilder, SubmenuBuilder, MenuItem,
};

fn main() {
    // CLI 命令在 Tauri 启动前处理，处理完直接退出不启动 GUI
    cli::try_handle_cli();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            // Initialize app state
            app.manage(config::AppState::new());
            app.manage(TtsState(std::sync::Mutex::new(None)));
            app.manage(RunningScriptState::default());
            app.manage(DataDirState::new());
            app.manage(ManagerWindowState(std::sync::Mutex::new(None)));

            // 注册自动更新插件
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;

            // 初始化跨平台资源路径（必须在其他模块使用 bundled-resources 之前）
            paths::init_bundled_resources_dir(app);

            // Ensure plugins directory exists
            plugin::ensure_plugins_dir();

            // Ensure templates directory exists
            template::ensure_doc_templates_dir();

            // ── 构建原生系统菜单 ──
            let handle = app.handle();

            // macOS 应用菜单
            let app_menu = SubmenuBuilder::new(handle, "AiDocPlus")
                .about(None)
                .separator()
                .item(&MenuItem::with_id(handle, "settings", "设置...", true, Some("CmdOrCtrl+,"))?)
                .separator()
                .services()
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .quit()
                .build()?;

            // 文件菜单
            let export_sub = SubmenuBuilder::new(handle, "导出")
                .item(&MenuItem::with_id(handle, "export_md", "Markdown (.md)", true, None::<&str>)?)
                .item(&MenuItem::with_id(handle, "export_html", "HTML (.html)", true, None::<&str>)?)
                .item(&MenuItem::with_id(handle, "export_docx", "Word (.docx)", true, None::<&str>)?)
                .item(&MenuItem::with_id(handle, "export_pdf", "PDF (.pdf)", true, None::<&str>)?)
                .item(&MenuItem::with_id(handle, "export_txt", "纯文本 (.txt)", true, None::<&str>)?)
                .build()?;

            let file_menu = SubmenuBuilder::new(handle, "文件")
                // ── 新建 ──
                .item(&MenuItem::with_id(handle, "new_project", "新建项目", true, Some("CmdOrCtrl+Shift+N"))?)
                .item(&MenuItem::with_id(handle, "new_document", "新建文档", true, Some("CmdOrCtrl+N"))?)
                .item(&MenuItem::with_id(handle, "new_from_template", "从模板新建...", true, Some("CmdOrCtrl+Shift+T"))?)
                .separator()
                // ── 保存 ──
                .item(&MenuItem::with_id(handle, "save", "保存", true, Some("CmdOrCtrl+S"))?)
                .item(&MenuItem::with_id(handle, "save_all", "全部保存", true, Some("CmdOrCtrl+Shift+S"))?)
                .separator()
                // ── 导入/导出文件 ──
                .item(&MenuItem::with_id(handle, "import_file", "导入文件...", true, Some("CmdOrCtrl+I"))?)
                .item(&export_sub)
                .separator()
                // ── 项目管理 ──
                .item(&MenuItem::with_id(handle, "project_rename", "重命名项目...", true, None::<&str>)?)
                .item(&MenuItem::with_id(handle, "project_delete", "删除项目...", true, None::<&str>)?)
                .item(&MenuItem::with_id(handle, "project_export_zip", "导出项目 (ZIP)...", true, None::<&str>)?)
                .item(&MenuItem::with_id(handle, "project_import_zip", "导入项目 (ZIP)...", true, None::<&str>)?)
                .item(&MenuItem::with_id(handle, "project_backup", "备份项目...", true, None::<&str>)?)
                .separator()
                // ── 模板 ──
                .item(&MenuItem::with_id(handle, "save_as_template", "存为模板...", true, None::<&str>)?)
                .item(&MenuItem::with_id(handle, "manage_templates", "管理模板...", true, None::<&str>)?)
                .separator()
                // ── 文档管理 ──
                .item(&MenuItem::with_id(handle, "doc_rename", "重命名文档...", true, None::<&str>)?)
                .item(&MenuItem::with_id(handle, "doc_delete", "删除文档...", true, None::<&str>)?)
                .item(&MenuItem::with_id(handle, "doc_duplicate", "复制文档", true, None::<&str>)?)
                .item(&MenuItem::with_id(handle, "doc_move_to", "移动文档到...", true, None::<&str>)?)
                .item(&MenuItem::with_id(handle, "doc_copy_to", "复制文档到...", true, None::<&str>)?)
                .separator()
                // ── 关闭 ──
                .item(&MenuItem::with_id(handle, "close_tab", "关闭文档", true, Some("CmdOrCtrl+W"))?)
                .build()?;

            // 编辑菜单（使用内置 PredefinedMenuItem 以确保剪贴板操作在所有输入框中正常工作）
            let edit_menu = SubmenuBuilder::new(handle, "编辑")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .separator()
                .item(&MenuItem::with_id(handle, "find", "查找...", true, Some("CmdOrCtrl+F"))?)
                .build()?;

            // 视图菜单
            let view_menu = SubmenuBuilder::new(handle, "视图")
                .item(&MenuItem::with_id(handle, "toggle_sidebar", "切换侧边栏", true, Some("CmdOrCtrl+B"))?)
                .item(&MenuItem::with_id(handle, "toggle_chat", "切换 AI 助手", true, Some("CmdOrCtrl+J"))?)
                .separator()
                .item(&MenuItem::with_id(handle, "toggle_layout", "切换布局", true, Some("CmdOrCtrl+L"))?)
                .item(&MenuItem::with_id(handle, "version_history", "版本历史", true, Some("CmdOrCtrl+H"))?)
                .separator()
                .item(&MenuItem::with_id(handle, "view_editor", "生成区", true, None::<&str>)?)
                .item(&MenuItem::with_id(handle, "view_plugins", "内容区", true, None::<&str>)?)
                .item(&MenuItem::with_id(handle, "view_composer", "合并区", true, None::<&str>)?)
                .item(&MenuItem::with_id(handle, "view_functional", "功能区", true, None::<&str>)?)
                .item(&MenuItem::with_id(handle, "view_coding", "编程区", true, None::<&str>)?)
                .build()?;

            // 帮助菜单
            let help_menu = SubmenuBuilder::new(handle, "帮助")
                .item(&MenuItem::with_id(handle, "shortcuts_ref", "快捷键参考", true, None::<&str>)?)
                .item(&MenuItem::with_id(handle, "first_run_guide", "新手引导", true, None::<&str>)?)
                .separator()
                .item(&MenuItem::with_id(handle, "help_website", "AiDocPlus 官网", true, None::<&str>)?)
                .item(&MenuItem::with_id(handle, "help_docs", "使用文档", true, None::<&str>)?)
                .item(&MenuItem::with_id(handle, "help_feedback", "反馈与建议", true, None::<&str>)?)
                .separator()
                .item(&MenuItem::with_id(handle, "check_update", "检查更新...", true, None::<&str>)?)
                .separator()
                .item(&MenuItem::with_id(handle, "about", "关于 AiDocPlus", true, None::<&str>)?)
                .build()?;

            let menu = MenuBuilder::new(handle)
                .item(&app_menu)
                .item(&file_menu)
                .item(&edit_menu)
                .item(&view_menu)
                .item(&help_menu)
                .build()?;

            app.set_menu(menu)?;

            // 监听菜单事件，转发到前端
            app.on_menu_event(move |app_handle, event| {
                let id = event.id().0.as_str();
                // 将菜单事件作为自定义事件发送到前端
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.emit("menu-event", id);
                }
            });

            // ── Deep Link URL Scheme 监听 ──
            let dl_handle = app.handle().clone();
            app.listen("deep-link://new-url", move |event: tauri::Event| {
                let payload = event.payload();
                println!("[AiDocPlus] 收到 deep-link URL: {}", payload);
                let _ = dl_handle.emit("deep-link:open", payload);
            });

            // 启动 API HTTP Server（后台 task）
            let app_handle = app.handle().clone();
            let api_handle = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                match api_server::start_api_server(api_handle).await {
                    Ok((port, _token)) => {
                        println!("[AiDocPlus] API Server 已启动，端口: {}", port);
                        // 通知前端 API Server 已就绪
                        let _ = app_handle.emit("api-server:ready", serde_json::json!({ "port": port }));
                    }
                    Err(e) => {
                        eprintln!("[AiDocPlus] API Server 启动失败: {}", e);
                    }
                }
            });

            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // File system commands
            read_directory,
            read_file,
            read_file_base64,
            read_text_file,
            write_file,
            delete_file,
            create_directory,
            get_file_metadata,
            get_home_dir,
            get_document_file_path,
            show_in_folder,

            // Project commands
            create_project,
            open_project,
            save_project,
            rename_project,
            delete_project,
            list_projects,
            export_project_zip,
            import_project_zip,

            // Document commands
            create_document,
            save_document,
            delete_document,
            rename_document,
            get_document,
            list_documents,
            move_document,
            copy_document,
            update_document_tags,
            list_all_tags,
            toggle_document_starred,

            // Version commands
            create_version,
            list_versions,
            get_version,
            restore_version,

            // Export commands
            export_document,
            export_document_native,
            export_and_open,
            write_binary_file,
            open_file_with_app,
            get_temp_dir,

            // AI commands
            chat,
            chat_stream,
            generate_content,
            generate_content_stream,
            stop_ai_stream,
            test_api_connection,
            export_ai_services,

            // Import commands
            import_file,

            // Search commands
            search_documents,
            get_search_suggestions,

            // Workspace commands
            save_workspace,
            load_workspace,
            clear_workspace,

            // Settings commands
            save_settings,
            load_settings,
            save_plugin_storage,
            load_plugin_storage,
            save_conversations,
            load_conversations,
            save_ui_preferences,
            load_ui_preferences,

            // Plugin commands
            list_plugins,
            set_plugin_enabled,
            sync_plugin_manifests,

            // Doc template commands
            list_doc_templates,
            get_doc_template_content,
            create_doc_template,
            update_doc_template,
            delete_doc_template,
            duplicate_doc_template,
            save_doc_template_from_document,
            create_document_from_doc_template,
            list_doc_template_categories,
            create_doc_template_category,
            update_doc_template_category,
            delete_doc_template_category,
            reorder_doc_template_categories,

            // Email commands
            test_smtp_connection,
            send_email,
            store_email_credential,
            delete_email_credential,

            // Pandoc commands
            check_pandoc,
            pandoc_export,

            // Resource commands
            open_resource_manager,
            list_prompt_templates,

            // Manager commands (integrated from resource-manager)
            aidocplus_manager_rust::commands::cmd_get_data_dir,
            aidocplus_manager_rust::commands::cmd_scan_resources,
            aidocplus_manager_rust::commands::cmd_read_manifest,
            aidocplus_manager_rust::commands::cmd_save_manifest,
            aidocplus_manager_rust::commands::cmd_create_resource,
            aidocplus_manager_rust::commands::cmd_delete_resource,
            aidocplus_manager_rust::commands::cmd_batch_delete_resources,
            aidocplus_manager_rust::commands::cmd_reorder_resources,
            aidocplus_manager_rust::commands::cmd_reindex_all_orders,
            aidocplus_manager_rust::commands::cmd_read_content_file,
            aidocplus_manager_rust::commands::cmd_save_content_file,
            aidocplus_manager_rust::commands::cmd_read_meta,
            aidocplus_manager_rust::commands::cmd_save_meta,
            aidocplus_manager_rust::commands::cmd_export_resources,
            aidocplus_manager_rust::commands::cmd_import_resources,
            aidocplus_manager_rust::commands::cmd_batch_set_enabled,
            aidocplus_manager_rust::commands::cmd_batch_move_category,
            aidocplus_manager_rust::commands::cmd_ai_generate,
            aidocplus_manager_rust::commands::cmd_ai_generate_stream,
            aidocplus_manager_rust::commands::cmd_run_build_script,
            aidocplus_manager_rust::commands::cmd_load_ai_config,
            aidocplus_manager_rust::commands::cmd_save_ai_config,
            aidocplus_manager_rust::commands::cmd_load_shared_ai_services,
            aidocplus_manager_rust::commands::cmd_load_local_ai_services,
            aidocplus_manager_rust::commands::cmd_save_local_ai_services,
            aidocplus_manager_rust::commands::cmd_scan_json_resources,
            aidocplus_manager_rust::commands::cmd_read_json_categories,
            aidocplus_manager_rust::commands::cmd_read_json_template,
            aidocplus_manager_rust::commands::cmd_save_json_template,
            aidocplus_manager_rust::commands::cmd_create_json_template,
            aidocplus_manager_rust::commands::cmd_delete_json_template,
            aidocplus_manager_rust::commands::cmd_batch_delete_json_templates,
            aidocplus_manager_rust::commands::cmd_move_json_template,
            aidocplus_manager_rust::commands::cmd_save_json_category,
            cmd_get_resource_type,
            cmd_get_home_dir,
            cmd_get_bundled_sub_dir,
            list_prompt_template_categories,
            save_custom_prompt_template,
            delete_custom_prompt_template,
            export_custom_prompt_templates,
            import_custom_prompt_templates,

            // WeChat commands
            wechat_http_request,

            // TTS commands
            tts_capabilities,
            tts_speak,
            tts_stop,
            tts_is_speaking,
            tts_set_rate,
            tts_set_pitch,
            tts_set_volume,
            tts_get_params,
            tts_get_param_ranges,
            tts_list_voices,
            tts_set_voice,

            // Python 脚本执行
            check_python,
            discover_pythons,
            run_python_script,

            // Node.js 脚本执行
            check_nodejs,
            run_node_script,

            // 流式脚本运行 + 终止
            run_script_stream,
            kill_running_script,

            // 编程区文件管理
            get_coding_scripts_dir,
            list_coding_scripts,
            list_coding_file_tree,
            read_coding_script,
            save_coding_script,
            delete_coding_script,
            rename_coding_script,
            create_coding_folder,
            delete_coding_folder,
            move_coding_item,
            read_external_file,
            search_coding_files,
            load_coding_state,
            save_coding_state,
            pip_install,
            pip_list,

        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    // 程序退出时清理 api.json
    api_server::cleanup_api_json();
}

// ── 资源管理器多窗口支持 ──

#[allow(dead_code)]
pub struct ManagerWindowState(std::sync::Mutex<Option<String>>);

#[tauri::command]
fn cmd_get_resource_type() -> Result<String, String> {
    // 多窗口模式下，resource-type 通过 URL query params 传递，此命令返回空
    Ok(String::new())
}

#[tauri::command]
fn cmd_get_home_dir() -> Result<String, String> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "无法获取用户主目录".to_string())
}

#[tauri::command]
fn cmd_get_bundled_sub_dir(sub: String) -> Option<String> {
    paths::bundled_sub_dir(&sub)
        .map(|p| p.to_string_lossy().to_string())
}
