// Prevents additional console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ai;
mod commands;
mod config;
mod document;
mod error;
mod native_export;
mod plugin;
mod project;
mod resource_engine;
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
    template::*,
    workspace::*,
};
use tauri::{Manager, Emitter};
use tauri::menu::{
    MenuBuilder, SubmenuBuilder, MenuItem,
};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .setup(|app| {
            // Initialize app state
            app.manage(config::AppState::new());

            // Initialize resource engine
            let resource_state = resource_engine::ResourceEngineState::new();
            let home = dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
            let resources_root = home.join("AiDocPlus").join("Resources");
            if let Err(e) = resource_state.init(resources_root.clone()) {
                eprintln!("[ResourceEngine] 初始化失败: {}", e);
            } else {
                // 从 bundled-resources 重建索引
                let bundled_dir = std::env::current_exe()
                    .ok()
                    .and_then(|p| p.parent().map(|p| p.to_path_buf()))
                    .unwrap_or_default()
                    .join("bundled-resources");
                if let Err(e) = resource_state.with_engine(|engine| {
                    engine.rebuild_index_from_bundled(&bundled_dir)?;
                    engine.rebuild_index_from_local()
                }) {
                    eprintln!("[ResourceEngine] 索引重建失败: {}", e);
                }
            }
            app.manage(resource_state);

            // Ensure plugins directory exists
            plugin::ensure_plugins_dir();

            // Ensure templates directory exists
            template::ensure_templates_dir();

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
                .item(&MenuItem::with_id(handle, "view_editor", "正文区", true, None::<&str>)?)
                .item(&MenuItem::with_id(handle, "view_plugins", "插件区", true, None::<&str>)?)
                .item(&MenuItem::with_id(handle, "view_composer", "合并区", true, None::<&str>)?)
                .build()?;

            // 帮助菜单
            let help_menu = SubmenuBuilder::new(handle, "帮助")
                .item(&MenuItem::with_id(handle, "shortcuts_ref", "快捷键参考", true, None::<&str>)?)
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
            write_file,
            delete_file,
            create_directory,

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

            // Import commands
            import_file,

            // Search commands
            search_documents,
            get_search_suggestions,

            // Workspace commands
            save_workspace,
            load_workspace,
            clear_workspace,

            // Plugin commands
            list_plugins,
            set_plugin_enabled,
            sync_plugin_manifests,

            // Template commands
            list_templates,
            get_template_content,
            create_template,
            update_template,
            delete_template,
            duplicate_template,
            save_template_from_document,
            create_document_from_template,
            list_template_categories,
            create_template_category,
            update_template_category,
            delete_template_category,
            reorder_template_categories,

            // Email commands
            test_smtp_connection,
            send_email,

            // Pandoc commands
            check_pandoc,
            pandoc_export,

            // Resource engine commands
            resource_list,
            resource_search,
            resource_get,
            resource_set_enabled,
            resource_stats,
            resource_categories,
            resource_rebuild_index,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
