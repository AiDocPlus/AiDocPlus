# Pandoc 集成说明

## 概述

AiDocPlus 使用 Tauri Sidecar 机制集成了 Pandoc，支持多种格式的文档导出，无需用户手动安装 Pandoc。

## 支持的导出格式

| 格式类别 | 支持的格式 |
|---------|-----------|
| **文档格式** | PDF、DOCX、ODT、RTF |
| **标记语言** | HTML、Markdown (md)、reStructuredText (rst)、LaTeX |
| **电子书** | EPUB |
| **演示文稿** | Beamer、PPTX |

## 开发环境设置

### macOS (开发)

如果系统已安装 Pandoc（通过 Homebrew），可以创建符号链接：

```bash
cd apps/desktop/src-tauri/binaries
ln -sf /opt/homebrew/bin/pandoc pandoc-aarch64-apple-darwin
```

### Linux (开发)

```bash
cd apps/desktop/src-tauri/binaries
ln -sf /usr/local/bin/pandoc pandoc-x86_64-unknown-linux-gnu
```

## 生产环境部署

### 下载 Pandoc 二进制文件

访问 [Pandoc Releases](https://github.com/jgm/pandoc/releases) 下载对应平台的二进制文件。

#### macOS ARM64 (Apple Silicon)

```bash
cd apps/desktop/src-tauri/binaries
curl -L -o pandoc-arm64.zip https://github.com/jgm/pandoc/releases/download/3.1.11/pandoc-3.1.11-arm64-macOS.zip
unzip pandoc-arm64.zip
mv pandoc-3.1.11-arm64-macOS/bin/pandoc pandoc-aarch64-apple-darwin
chmod +x pandoc-aarch64-apple-darwin
rm pandoc-arm64.zip
rm -rf pandoc-3.1.11-arm64-macOS
```

#### macOS Intel x64

```bash
cd apps/desktop/src-tauri/binaries
curl -L -o pandoc-x64.zip https://github.com/jgm/pandoc/releases/download/3.1.11/pandoc-3.1.11-x86_64-macOS.zip
unzip pandoc-x64.zip
mv pandoc-3.1.11-x86_64-macOS/bin/pandoc pandoc-x86_64-apple-darwin
chmod +x pandoc-x86_64-apple-darwin
rm pandoc-x64.zip
rm -rf pandoc-3.1.11-x86_64-macOS
```

#### Windows x64

1. 下载 `pandoc-3.x.x-windows-x86_64.zip`
2. 解压并重命名为 `pandoc-x86_64-pc-windows-msvc.exe`
3. 放入 `src-tauri/binaries/` 目录

#### Linux x64

```bash
cd apps/desktop/src-tauri/binaries
curl -L -o pandoc-linux.tar.gz https://github.com/jgm/pandoc/releases/download/3.1.11/pandoc-3.1.11-linux-amd64.tar.gz
tar -xzf pandoc-linux.tar.gz
mv pandoc-3.1.11-linux-amd64/bin/pandoc pandoc-x86_64-unknown-linux-gnu
chmod +x pandoc-x86_64-unknown-linux-gnu
rm pandoc-linux.tar.gz
rm -rf pandoc-3.1.11-linux-amd64
```

## 文件大小影响

| 平台 | 大小范围 |
|------|---------|
| macOS (单一架构) | ~30-40 MB |
| Windows (x64) | ~50-70 MB |
| Linux (x64) | ~40-60 MB |

## 中文支持

PDF 导出默认使用 XeLaTeX 引擎和 SimSun 字体支持中文。如需修改字体，可在 `export_pandoc.rs` 中调整配置。

## 许可证声明

此应用使用 Pandoc (https://pandoc.org)，其采用 GNU General Public License version 2 or later。
Pandoc 版权所有 © 2006-2024 John MacFarlane 和贡献者。

Pandoc 作为独立进程运行（sidecar 模式），不影响主应用的许可证。
