/// 菜单国际化：根据系统语言返回中/英文菜单文本
/// 仅用于 Tauri 原生菜单构建（main.rs setup 阶段）

/// 检测系统语言是否为中文
fn is_chinese() -> bool {
    // macOS: 读取 AppleLanguages
    #[cfg(target_os = "macos")]
    {
        if let Ok(output) = std::process::Command::new("defaults")
            .args(["read", "-g", "AppleLanguages"])
            .output()
        {
            let lang = String::from_utf8_lossy(&output.stdout);
            // AppleLanguages 返回类似 ("zh-Hans-CN", "en-CN", ...) 的数组
            // 只要第一个语言以 zh 开头就算中文
            if let Some(first) = lang.lines().nth(1) {
                return first.trim().trim_matches('"').trim_matches(',').starts_with("zh");
            }
        }
    }

    // Windows: 读取系统 locale
    #[cfg(target_os = "windows")]
    {
        if let Ok(lang) = std::env::var("LANG") {
            if lang.starts_with("zh") {
                return true;
            }
        }
        // 也检查 Windows 的 UI 语言
        if let Ok(output) = std::process::Command::new("powershell")
            .args(["-Command", "(Get-Culture).Name"])
            .output()
        {
            let culture = String::from_utf8_lossy(&output.stdout);
            return culture.trim().starts_with("zh");
        }
    }

    // 默认中文
    true
}

/// 菜单文本结构
pub struct MenuTexts {
    // 应用菜单
    pub settings: &'static str,
    // 文件菜单
    pub file: &'static str,
    pub export: &'static str,
    pub export_txt: &'static str,
    pub new_project: &'static str,
    pub new_document: &'static str,
    pub new_from_template: &'static str,
    pub save: &'static str,
    pub save_all: &'static str,
    pub import_file: &'static str,
    pub project_rename: &'static str,
    pub project_delete: &'static str,
    pub project_export_zip: &'static str,
    pub project_import_zip: &'static str,
    pub project_backup: &'static str,
    pub save_as_template: &'static str,
    pub manage_templates: &'static str,
    pub doc_rename: &'static str,
    pub doc_delete: &'static str,
    pub doc_duplicate: &'static str,
    pub doc_move_to: &'static str,
    pub doc_copy_to: &'static str,
    pub close_tab: &'static str,
    // 编辑菜单
    pub edit: &'static str,
    pub find: &'static str,
    // 视图菜单
    pub view: &'static str,
    pub toggle_sidebar: &'static str,
    pub toggle_chat: &'static str,
    pub toggle_layout: &'static str,
    pub version_history: &'static str,
    pub view_editor: &'static str,
    pub view_plugins: &'static str,
    pub view_composer: &'static str,
    pub view_functional: &'static str,
    pub view_coding: &'static str,
    // 帮助菜单
    pub help: &'static str,
    pub shortcuts_ref: &'static str,
    pub first_run_guide: &'static str,
    pub help_website: &'static str,
    pub help_docs: &'static str,
    pub help_feedback: &'static str,
    pub check_update: &'static str,
    pub about: &'static str,
}

const ZH: MenuTexts = MenuTexts {
    settings: "设置...",
    file: "文件",
    export: "导出",
    export_txt: "纯文本 (.txt)",
    new_project: "新建项目",
    new_document: "新建文档",
    new_from_template: "从模板新建...",
    save: "保存",
    save_all: "全部保存",
    import_file: "导入文件...",
    project_rename: "重命名项目...",
    project_delete: "删除项目...",
    project_export_zip: "导出项目 (ZIP)...",
    project_import_zip: "导入项目 (ZIP)...",
    project_backup: "备份项目...",
    save_as_template: "存为模板...",
    manage_templates: "管理模板...",
    doc_rename: "重命名文档...",
    doc_delete: "删除文档...",
    doc_duplicate: "复制文档",
    doc_move_to: "移动文档到...",
    doc_copy_to: "复制文档到...",
    close_tab: "关闭文档",
    edit: "编辑",
    find: "查找...",
    view: "视图",
    toggle_sidebar: "切换侧边栏",
    toggle_chat: "切换 AI 助手",
    toggle_layout: "切换布局",
    version_history: "版本历史",
    view_editor: "生成区",
    view_plugins: "内容区",
    view_composer: "合并区",
    view_functional: "功能区",
    view_coding: "编程区",
    help: "帮助",
    shortcuts_ref: "快捷键参考",
    first_run_guide: "新手引导",
    help_website: "AiDocPlus 官网",
    help_docs: "使用文档",
    help_feedback: "反馈与建议",
    check_update: "检查更新...",
    about: "关于 AiDocPlus",
};

const EN: MenuTexts = MenuTexts {
    settings: "Settings...",
    file: "File",
    export: "Export",
    export_txt: "Plain Text (.txt)",
    new_project: "New Project",
    new_document: "New Document",
    new_from_template: "New from Template...",
    save: "Save",
    save_all: "Save All",
    import_file: "Import File...",
    project_rename: "Rename Project...",
    project_delete: "Delete Project...",
    project_export_zip: "Export Project (ZIP)...",
    project_import_zip: "Import Project (ZIP)...",
    project_backup: "Backup Project...",
    save_as_template: "Save as Template...",
    manage_templates: "Manage Templates...",
    doc_rename: "Rename Document...",
    doc_delete: "Delete Document...",
    doc_duplicate: "Duplicate Document",
    doc_move_to: "Move Document to...",
    doc_copy_to: "Copy Document to...",
    close_tab: "Close Document",
    edit: "Edit",
    find: "Find...",
    view: "View",
    toggle_sidebar: "Toggle Sidebar",
    toggle_chat: "Toggle AI Assistant",
    toggle_layout: "Toggle Layout",
    version_history: "Version History",
    view_editor: "Generator",
    view_plugins: "Content",
    view_composer: "Composer",
    view_functional: "Functions",
    view_coding: "Coding",
    help: "Help",
    shortcuts_ref: "Keyboard Shortcuts",
    first_run_guide: "Getting Started",
    help_website: "AiDocPlus Website",
    help_docs: "Documentation",
    help_feedback: "Feedback & Suggestions",
    check_update: "Check for Updates...",
    about: "About AiDocPlus",
};

/// 获取当前系统语言对应的菜单文本
pub fn get_menu_texts() -> &'static MenuTexts {
    if is_chinese() { &ZH } else { &EN }
}
