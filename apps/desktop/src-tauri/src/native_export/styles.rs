#![allow(dead_code)]

/// 中国公文排版标准常量 (GB/T 9704-2012)
/// 页边距 (mm)
pub const PAGE_MARGIN_TOP: f32 = 37.0;
pub const PAGE_MARGIN_BOTTOM: f32 = 35.0;
pub const PAGE_MARGIN_LEFT: f32 = 28.0;
pub const PAGE_MARGIN_RIGHT: f32 = 26.0;

/// 版心尺寸 (mm)
pub const PAGE_CONTENT_WIDTH: f32 = 156.0;
pub const PAGE_CONTENT_HEIGHT: f32 = 225.0;

/// 字号 (pt)
/// 2号 ≈ 22pt (标题)
pub const FONT_SIZE_TITLE: f32 = 22.0;
/// 3号 ≈ 16pt (正文、一至四级标题)
pub const FONT_SIZE_BODY: f32 = 16.0;
/// 4号 ≈ 14pt (页码、注释)
pub const FONT_SIZE_SMALL: f32 = 14.0;
/// 小4号 ≈ 12pt
pub const FONT_SIZE_FOOTNOTE: f32 = 12.0;

/// 行距 (pt) - 每页22行，版心225mm
/// 225mm / 22行 ≈ 10.23mm ≈ 29pt
pub const LINE_SPACING_PT: f32 = 29.0;

/// 每行字数
pub const CHARS_PER_LINE: u32 = 28;
/// 每页行数
pub const LINES_PER_PAGE: u32 = 22;

/// 首行缩进 (字符数)
pub const FIRST_LINE_INDENT: u32 = 2;

/// 字体名称 - 跨平台
/// 仿宋 (正文)
pub const FONT_FANGSONG: &[&str] = &["FangSong", "STFangsong", "仿宋", "仿宋_GB2312"];
/// 黑体 (一级标题)
pub const FONT_HEITI: &[&str] = &["SimHei", "STHeiti", "黑体", "Heiti SC"];
/// 楷体 (二级标题)
pub const FONT_KAITI: &[&str] = &["KaiTi", "STKaiti", "楷体", "Kaiti SC"];
/// 宋体 (文件标题、页码)
pub const FONT_SONGTI: &[&str] = &["SimSun", "STSong", "宋体", "Songti SC"];

/// 西文字体
pub const FONT_WESTERN: &str = "Times New Roman";

/// mm 转 twip (1mm = 56.7 twip, Word 内部单位)
pub fn mm_to_twip(mm: f32) -> i32 {
    (mm * 56.693).round() as i32
}

/// pt 转 half-point (Word 字号单位, 1pt = 2 half-points)
pub fn pt_to_half_point(pt: f32) -> usize {
    (pt * 2.0).round() as usize
}

/// pt 转 twip (1pt = 20 twip)
pub fn pt_to_twip(pt: f32) -> i32 {
    (pt * 20.0).round() as i32
}

/// 字符宽度转 twip (基于3号字16pt)
pub fn chars_to_twip(chars: u32) -> i32 {
    (chars as f32 * FONT_SIZE_BODY * 20.0).round() as i32
}

/// HTML 导出用的 CSS 模板
pub fn get_html_css() -> &'static str {
    r#"
    @page {
        size: A4;
        margin: 37mm 26mm 35mm 28mm;
    }
    * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }
    body {
        font-family: "FangSong", "STFangsong", "仿宋", "仿宋_GB2312", "PingFang SC", "Microsoft YaHei", sans-serif;
        font-size: 16pt;
        line-height: 29pt;
        color: #000;
        max-width: 156mm;
        margin: 0 auto;
        padding: 37mm 26mm 35mm 28mm;
    }
    p {
        text-indent: 2em;
        margin: 0;
        padding: 0;
    }
    /* 文件标题 - 2号宋体居中 */
    h1 {
        font-family: "SimSun", "STSong", "宋体", "Songti SC", serif;
        font-size: 22pt;
        font-weight: bold;
        text-align: center;
        line-height: 1.4;
        margin: 0.5em 0;
        text-indent: 0;
    }
    /* 一级标题 - 3号黑体 */
    h2 {
        font-family: "SimHei", "STHeiti", "黑体", "Heiti SC", sans-serif;
        font-size: 16pt;
        font-weight: normal;
        line-height: 29pt;
        margin: 0.3em 0;
        text-indent: 0;
    }
    /* 二级标题 - 3号楷体 */
    h3 {
        font-family: "KaiTi", "STKaiti", "楷体", "Kaiti SC", serif;
        font-size: 16pt;
        font-weight: normal;
        line-height: 29pt;
        margin: 0.3em 0;
        text-indent: 0;
    }
    /* 三级标题 - 3号仿宋加粗 */
    h4 {
        font-family: "FangSong", "STFangsong", "仿宋", "仿宋_GB2312", sans-serif;
        font-size: 16pt;
        font-weight: bold;
        line-height: 29pt;
        margin: 0.3em 0;
        text-indent: 0;
    }
    /* 四级标题 - 3号仿宋 */
    h5, h6 {
        font-family: "FangSong", "STFangsong", "仿宋", "仿宋_GB2312", sans-serif;
        font-size: 16pt;
        font-weight: normal;
        line-height: 29pt;
        margin: 0.3em 0;
        text-indent: 0;
    }
    /* 代码块 */
    pre {
        background-color: #f5f5f5;
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 12px;
        margin: 0.5em 0;
        overflow-x: auto;
        font-family: "Consolas", "Monaco", "Courier New", monospace;
        font-size: 12pt;
        line-height: 1.5;
        text-indent: 0;
    }
    code {
        font-family: "Consolas", "Monaco", "Courier New", monospace;
        font-size: 0.9em;
        background-color: #f0f0f0;
        padding: 2px 4px;
        border-radius: 3px;
    }
    pre code {
        background: none;
        padding: 0;
        border-radius: 0;
    }
    /* 表格 */
    table {
        border-collapse: collapse;
        width: 100%;
        margin: 0.5em 0;
        font-size: 14pt;
    }
    th, td {
        border: 1px solid #000;
        padding: 6px 10px;
        text-align: left;
        text-indent: 0;
    }
    th {
        background-color: #f0f0f0;
        font-weight: bold;
    }
    tr:nth-child(even) {
        background-color: #fafafa;
    }
    /* 列表 */
    ul, ol {
        margin: 0.3em 0;
        padding-left: 2em;
    }
    li {
        text-indent: 0;
        line-height: 29pt;
    }
    /* 引用块 */
    blockquote {
        border-left: 4px solid #ccc;
        margin: 0.5em 0;
        padding: 0.5em 1em;
        color: #555;
        text-indent: 0;
    }
    /* 分隔线 */
    hr {
        border: none;
        border-top: 1px solid #ccc;
        margin: 1em 0;
    }
    /* 链接 */
    a {
        color: #0066cc;
        text-decoration: underline;
    }
    /* 图片 */
    img {
        max-width: 100%;
        height: auto;
        display: block;
        margin: 0.5em auto;
    }
    /* 强调 */
    strong { font-weight: bold; }
    em { font-style: italic; }
    /* 打印样式 */
    @media print {
        body {
            padding: 0;
            max-width: none;
        }
        pre {
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        a { color: #000; text-decoration: none; }
        a::after { content: " (" attr(href) ")"; font-size: 0.8em; color: #666; }
    }
    "#
}
