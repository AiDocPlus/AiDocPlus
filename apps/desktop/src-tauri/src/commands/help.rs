/// 帮助中心窗口命令

#[tauri::command]
pub fn open_help_center(app_handle: tauri::AppHandle) -> crate::error::Result<()> {
    use crate::error::ResultExt;
    use tauri::Manager;
    use tauri::WebviewWindowBuilder;
    use tauri::WebviewUrl;

    let window_label = "help-center";

    // 如果窗口已存在，聚焦并返回
    if let Some(existing) = app_handle.get_webview_window(window_label) {
        let _ = existing.set_focus();
        return Ok(());
    }

    // 构建 URL：开发模式用 dev server，发布模式用构建产物
    let url = if cfg!(debug_assertions) {
        WebviewUrl::External("http://localhost:1420/help.html".parse().context("URL 解析失败")?)
    } else {
        WebviewUrl::App("help.html".into())
    };

    WebviewWindowBuilder::new(&app_handle, window_label, url)
        .title("帮助中心 - AiDocPlus")
        .inner_size(1200.0, 800.0)
        .min_inner_size(900.0, 600.0)
        .resizable(true)
        .build()
        .context("创建帮助中心窗口失败")?;

    Ok(())
}
