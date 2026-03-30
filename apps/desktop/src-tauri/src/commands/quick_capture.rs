/// 速记窗口（Drafts 风格：置顶、独立 Webview）

#[tauri::command]
pub fn open_quick_capture(app_handle: tauri::AppHandle) -> crate::error::Result<()> {
    use crate::error::ResultExt;
    use tauri::Manager;
    use tauri::WebviewWindowBuilder;
    use tauri::WebviewUrl;

    let window_label = "quick-capture";

    if let Some(existing) = app_handle.get_webview_window(window_label) {
        let _ = existing.set_focus();
        let _ = existing.set_always_on_top(true);
        return Ok(());
    }

    let t = crate::menu_i18n::get_menu_texts();
    let title = t.quick_capture_window_title;

    let url = if cfg!(debug_assertions) {
        WebviewUrl::External(
            "http://localhost:1420/scratchpad.html"
                .parse()
                .context("URL 解析失败")?,
        )
    } else {
        WebviewUrl::App("scratchpad.html".into())
    };

    let window = WebviewWindowBuilder::new(&app_handle, window_label, url)
        .title(title)
        .inner_size(520.0, 400.0)
        .min_inner_size(360.0, 240.0)
        .resizable(true)
        .build()
        .context("创建速记窗口失败")?;

    let _ = window.set_always_on_top(true);

    Ok(())
}
