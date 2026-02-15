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
mod workspace;

use commands::{
    ai::*,
    document::*,
    email::*,
    export::*,
    file_system::*,
    import::*,
    plugin::*,
    project::*,
    search::*,
    workspace::*,
};
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .setup(|app| {
            // Initialize app state
            app.manage(config::AppState::new());

            // Initialize builtin plugins (idempotent)
            plugin::init_builtin_plugins();

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

            // Document commands
            create_document,
            save_document,
            delete_document,
            rename_document,
            get_document,
            list_documents,

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

            // Email commands
            test_smtp_connection,
            send_email,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
