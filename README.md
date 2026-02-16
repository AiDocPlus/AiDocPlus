# AiDocPlus - AI Document Editor

A cross-platform AI document editor built with Tauri and React.

Official Website: https://aidocplus.com

## Status

✅ **Initial Implementation Complete**

The project has been successfully set up with the following features:

### Implemented Features

#### Core Architecture
- ✅ **Monorepo Structure**: Turborepo-based monorepo with shared packages
- ✅ **Tauri 2.x Backend**: Rust backend with all IPC commands
- ✅ **React 19 Frontend**: TypeScript frontend with modern tooling
- ✅ **Three-Panel Layout**: File tree, editor, and AI chat panels

#### Backend (Rust)
- ✅ File system commands (read directory, file operations)
- ✅ Project management (create, open, save, delete, list)
- ✅ Document management (create, save, delete, get, list)
- ✅ Version control (create, list versions)
- ✅ Export functionality (Markdown, HTML, Text, JSON)

#### Frontend (React)
- ✅ Main layout with collapsible panels
- ✅ File tree component with project/document navigation
- ✅ Document editor with author notes and content sections
- ✅ AI chat panel interface
- ✅ Zustand state management
- ✅ Dark mode support

#### Shared Packages
- ✅ `@aidocplus/shared-types`: Common TypeScript types
- ✅ `@aidocplus/utils`: Utility functions

### Project Structure

```
aidocplus/
├── apps/
│   └── desktop/
│       ├── src-tauri/          # Tauri backend (Rust)
│       │   ├── src/
│       │   │   ├── main.rs
│       │   │   ├── commands/    # IPC command handlers
│       │   │   ├── ai.rs        # AI HTTP & streaming
│       │   │   ├── document.rs
│       │   │   ├── plugin.rs    # Plugin manifest sync & management
│       │   │   └── ...
│       │   └── Cargo.toml
│       └── src-ui/             # React frontend
│           ├── src/
│           │   ├── components/  # UI components (editor, chat, file-tree, tabs, settings)
│           │   ├── plugins/     # Plugin system (21 external plugins, auto-discovery)
│           │   │   ├── _framework/  # Plugin SDK
│           │   │   ├── pluginStore.ts  # Plugin registry (registerPlugin)
│           │   │   ├── loader.ts       # Auto-discovery (import.meta.glob)
│           │   │   └── {name}/         # Individual plugins (manifest.json + index.ts + Panel)
│           │   ├── stores/      # State management (Zustand)
│           │   └── i18n/        # Internationalization
│           └── package.json
├── packages/
│   ├── shared-types/           # Shared TypeScript types
│   └── utils/                  # Utility functions
├── docs/
│   └── plugin-sdk/             # Plugin SDK documentation & examples
└── turbo.json
```

### Development

```bash
# Install dependencies
pnpm install

# Run development mode
cd apps/desktop/src-ui
pnpm tauri dev

# Build for production
pnpm build
```

### Tech Stack

- **Desktop Framework**: Tauri 2.x
- **Frontend**: React 19 + TypeScript 5.8+
- **State Management**: Zustand
- **Styling**: Tailwind CSS 4
- **UI Components**: Radix UI
- **Build Tool**: Vite 7 + Turborepo
- **Editor**: CodeMirror 6
- **i18n**: i18next (zh/en/ja)

### Completed Features

- ✅ AI streaming chat & content generation (OpenAI-compatible API, GLM, etc.)
- ✅ CodeMirror 6 Markdown editor with syntax highlighting, folding, autocomplete
- ✅ Multi-format export (Markdown, HTML, DOCX, TXT, native + Pandoc)
- ✅ Version control with preview and restore
- ✅ Plugin system — 21 external plugins with auto-discovery, self-registration, and manifest-driven architecture
- ✅ Prompt templates
- ✅ Workspace autosave
- ✅ Attachment system

## License

MIT
