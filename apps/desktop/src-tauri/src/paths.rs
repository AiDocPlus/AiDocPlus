use std::path::PathBuf;
use std::sync::OnceLock;
use tauri::Manager;

/// bundled-resources 根目录（应用启动时初始化）
static BUNDLED_RESOURCES_DIR: OnceLock<PathBuf> = OnceLock::new();

/// 在 main.rs setup() 中调用，使用 Tauri PathResolver 初始化 bundled-resources 路径
pub fn init_bundled_resources_dir(app: &tauri::App) {
    // 1. 优先使用 Tauri resource_dir（release 模式，跨平台正确解析）
    if let Ok(dir) = app.path().resource_dir() {
        let bundled: PathBuf = dir.join("bundled-resources");
        if bundled.exists() {
            eprintln!("[paths] bundled-resources (resource_dir): {}", bundled.display());
            let _ = BUNDLED_RESOURCES_DIR.set(bundled);
            return;
        }
    }

    // 2. 回退：exe 同级目录（兼容旧行为）
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let bundled = parent.join("bundled-resources");
            if bundled.exists() {
                eprintln!("[paths] bundled-resources (exe_parent): {}", bundled.display());
                let _ = BUNDLED_RESOURCES_DIR.set(bundled);
                return;
            }
        }
    }

    // 3. dev 模式回退：从 exe 向上查找 src-tauri/bundled-resources
    if let Some(dir) = find_dev_bundled_resources() {
        eprintln!("[paths] bundled-resources (dev): {}", dir.display());
        let _ = BUNDLED_RESOURCES_DIR.set(dir);
        return;
    }

    eprintln!("[paths] 警告: 未找到 bundled-resources 目录");
}

/// dev 模式下从 exe 路径向上查找 bundled-resources
fn find_dev_bundled_resources() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let mut dir = exe.parent()?.to_path_buf();
    loop {
        let candidate = dir.join("src-tauri").join("bundled-resources");
        if candidate.exists() {
            return Some(candidate);
        }
        let candidate2 = dir.join("bundled-resources");
        if candidate2.exists() {
            return Some(candidate2);
        }
        if !dir.pop() {
            return None;
        }
    }
}

/// 获取 bundled-resources 根目录
#[allow(dead_code)]
pub fn bundled_resources_dir() -> Option<PathBuf> {
    BUNDLED_RESOURCES_DIR.get().cloned()
}

/// 获取 bundled-resources 下的子目录
pub fn bundled_sub_dir(sub: &str) -> Option<PathBuf> {
    let dir = BUNDLED_RESOURCES_DIR.get()?.join(sub);
    if dir.exists() { Some(dir) } else { None }
}
