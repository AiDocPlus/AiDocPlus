// ── 邮件客户端窗口命令 ──

use crate::error::ResultExt;
use tauri::Manager;
use tauri::WebviewWindowBuilder;
use tauri::WebviewUrl;

/// 打开邮件客户端独立窗口
#[tauri::command]
pub fn open_mail_client(app_handle: tauri::AppHandle) -> crate::error::Result<()> {
    let window_label = "mail-client";

    // 如果窗口已存在，聚焦并返回
    if let Some(existing) = app_handle.get_webview_window(window_label) {
        let _ = existing.set_focus();
        return Ok(());
    }

    // 构建 URL：开发模式用 dev server，发布模式用构建产物
    let url = if cfg!(debug_assertions) {
        WebviewUrl::External(
            "http://localhost:1420/mail-client.html"
                .parse()
                .context("URL 解析失败")?,
        )
    } else {
        let full_url = if cfg!(target_os = "windows") {
            "https://tauri.localhost/mail-client.html".to_string()
        } else {
            "tauri://localhost/mail-client.html".to_string()
        };
        WebviewUrl::CustomProtocol(full_url.parse().context("URL 解析失败")?)
    };

    WebviewWindowBuilder::new(&app_handle, window_label, url)
        .title("邮件客户端 - AiDocPlus")
        .inner_size(1200.0, 800.0)
        .min_inner_size(900.0, 600.0)
        .resizable(true)
        .build()
        .context("创建邮件客户端窗口失败")?;

    Ok(())
}
