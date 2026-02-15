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
│       │   │   ├── config.rs
│       │   │   ├── document.rs
│       │   │   ├── error.rs
│       │   │   └── project.rs
│       │   └── Cargo.toml
│       └── src-ui/             # React frontend
│           ├── src/
│           │   ├── components/
│           │   │   ├── layout/
│           │   │   ├── editor/
│           │   │   ├── file-tree/
│           │   │   └── chat/
│           │   ├── stores/
│           │   └── App.tsx
│           └── package.json
├── packages/
│   ├── shared-types/           # Shared TypeScript types
│   └── utils/                  # Utility functions
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
- **Build Tool**: Vite 6 + Turborepo

### Next Steps

To complete the MVP:

1. **AI Integration**
   - [ ] Set up LiteLLM proxy service
   - [ ] Implement actual AI provider connections
   - [ ] Add streaming response support
   - [ ] Add prompt templates

2. **Editor Enhancements**
   - [ ] Implement rich text editor
   - [ ] Add markdown preview
   - [ ] Add syntax highlighting
   - [ ] Implement autosave

3. **Export Formats**
   - [ ] Add DOCX export (docx.js)
   - [ ] Add PDF export (Puppeteer)
   - [ ] Add XLSX/PPTX export

4. **Version Control**
   - [ ] Implement version comparison view
   - [ ] Add visual diff display
   - [ ] Implement version restore

5. **Plugin System**
   - [ ] Design plugin API (VSCode-compatible)
   - [ ] Implement plugin loader
   - [ ] Add example plugins

6. **Testing & Optimization**
   - [ ] Add unit tests
   - [ ] Performance optimization
   - [ ] Memory profiling
   - [ ] Cross-platform testing

## License

MIT
