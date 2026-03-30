# E-book Reader Tool

## TL;DR

> **Quick Summary**: Add an e-book reader tool that opens in a separate Tauri window from the tools menu, supporting 5 file formats (MD, HTML, Word, PDF, EPUB) with a personal library for saved documents, dark/light theme, font size control, and fullscreen mode.
>
> **Deliverables**:
> - New Rust backend module `commands/ebook_reader.rs` with library CRUD + file import
> - New React window `reader.html` + `src/reader/` with format-specific renderers
> - EPUB support via `epubjs` npm package
> - Tools menu entry + drag-and-drop file opening
> - i18n support (zh + en)
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 (Rust backend) → Task 5 (Reader shell) → Task 8 (Integration)

---

## Context

### Original Request
User wants an e-book reader tool accessible from the tools menu in a separate window. It should save/favorite MD and HTML documents for preview, and also open external files in MD, HTML, Word, PDF, and EPUB formats.

### Interview Summary
**Key Discussions**:
- EPUB depth: Basic reading (open, pagination, TOC navigation, font adjustment) — not full bookmarks/annotations
- Library management: Import copies to `~/AiDocPlus/EBookLibrary/` (not external references)
- Reading experience: Font size adjustment + dark/light theme + fullscreen mode
- Open methods: Tools menu entry + drag-and-drop file onto window
- Testing: Rust backend tests only, frontend verified via Agent QA scenarios

**Research Findings**:
- `epub.js 0.3.93`: ~70K weekly downloads, mature API despite 2022 last update, Chromium compatible
- Dependencies: jszip, @xmldom/xmldom, localforage, lodash
- epub.js needs ArrayBuffer input; Tauri backend reads file → returns base64 → frontend decodes to Uint8Array
- Multi-window pattern: WebviewWindowBuilder with debug/release URL branching (see help.rs)

### Metis Review
Metis consultation timed out. Self-review performed below as substitute.

---

## Work Objectives

### Core Objective
Add a standalone e-book reader window to AiDocPlus that serves as a personal document library and multi-format viewer.

### Concrete Deliverables
- `apps/desktop/src-tauri/src/commands/ebook_reader.rs` — Rust backend (library CRUD, file import, directory management)
- `apps/desktop/src-ui/reader.html` — New HTML entry point
- `apps/desktop/src-ui/src/reader/` — React components directory
  - `ReaderApp.tsx` — Main app shell (library sidebar + reading pane)
  - `LibraryPanel.tsx` — Book library list + import controls
  - `ReadingPane.tsx` — Format-dispatching reader container
  - `renderers/EpubReader.tsx` — EPUB renderer (epub.js)
  - `renderers/PdfReader.tsx` — PDF renderer (wraps existing PdfViewer)
  - `renderers/MarkdownReader.tsx` — MD renderer (wraps existing MarkdownPreview)
  - `renderers/HtmlReader.tsx` — HTML renderer (sandboxed iframe)
  - `renderers/WordReader.tsx` — DOCX renderer (wraps existing docx-preview)
  - `reader-main.tsx` — React entry point
  - `useReaderStore.ts` — Zustand store (library list, current book, theme, font size)
- `apps/desktop/src-ui/vite.config.ts` — Add `reader` rollup entry
- `apps/desktop/src-tauri/src/main.rs` — Register menu item + commands

### Definition of Done
- [ ] Tools menu shows "电子书阅读器" entry that opens a separate window
- [ ] Library panel lists imported documents with title, format icon, file size
- [ ] Importing MD/HTML copies file to `~/AiDocPlus/EBookLibrary/`
- [ ] Importing PDF/DOCX/EPUB copies file to library
- [ ] Each format renders correctly in the reading pane
- [ ] EPUB supports TOC navigation and pagination
- [ ] Font size controls work across all text-based formats
- [ ] Dark/light theme toggle works
- [ ] Fullscreen mode (F11 or toolbar button) works
- [ ] Drag-and-drop external file onto window opens it
- [ ] `cargo check` passes with zero errors
- [ ] `npx tsc --noEmit` passes with zero errors

### Must Have
- Separate Tauri window with single-instance check (focus existing if already open)
- Library management: list, import (copy), delete, open
- 5 format renderers: MD, HTML, Word (DOCX), PDF, EPUB
- EPUB: basic navigation (prev/next page, TOC sidebar, font size)
- Dark/light theme toggle
- Font size adjustment
- Fullscreen mode
- Drag-and-drop file opening
- i18n for all UI strings (zh + en)
- Cross-platform path handling (PathBuf::join())

### Must NOT Have (Guardrails)
- NO bookmarks or reading progress persistence (out of scope — user chose "basic reading")
- NO full-text search across books
- NO annotations, highlights, or notes
- NO file association registration (no system-level .epub → AiDocPlus binding)
- NO epub.js React wrapper packages — use epub.js directly to avoid unmaintained dependencies
- NO `as any` / `@ts-ignore` in TypeScript
- NO hardcoded Chinese strings — all via i18n
- NO direct `@tauri-apps/*` imports from reader components — use a thin invoke wrapper if needed
- NO epub.js `localforage` usage — we use file-based approach (Rust backend reads the file, frontend renders from ArrayBuffer)

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES (cargo test for Rust)
- **Automated tests**: Rust backend tests only
- **Framework**: `cargo test`
- **Frontend**: Agent-executed QA scenarios (Playwright for browser UI)

### QA Policy
Every task includes agent-executed QA scenarios. Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Window/UI**: Use Playwright (playwright skill) — Navigate, interact, assert DOM, screenshot
- **Rust backend**: Use Bash (`cargo test`) — Run tests, assert pass/fail
- **Build verification**: Use Bash (`cargo check`, `npx tsc --noEmit`) — Zero errors

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — Rust backend + frontend scaffolding):
├── Task 1: Rust backend commands (ebook_reader.rs) [deep]
├── Task 2: reader.html + vite.config.ts entry [quick]
├── Task 3: i18n keys (zh + en) [quick]
└── Task 4: reader-main.tsx + useReaderStore.ts [quick]

Wave 2 (After Wave 1 — core UI components):
├── Task 5: ReaderApp.tsx + LibraryPanel.tsx [visual-engineering]
├── Task 6: ReadingPane.tsx (format dispatcher) [quick]
├── Task 7: EpubReader.tsx [deep]
├── Task 8: MarkdownReader.tsx + HtmlReader.tsx [quick]
└── Task 9: PdfReader.tsx + WordReader.tsx [quick]

Wave 3 (After Wave 2 — menu integration + polish):
├── Task 10: main.rs menu + command registration + on_menu_event [quick]
├── Task 11: Drag-and-drop support + fullscreen mode [visual-engineering]
└── Task 12: Dark/light theme + font size controls [visual-engineering]

Wave FINAL (After ALL tasks — parallel reviews):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay

Critical Path: Task 1 → Task 5 → Task 6 → Task 10 → F1-F4 → user okay
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 4 (Wave 1), 5 (Wave 2)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 | None | 5, 6, 7, 8, 9 | 1 |
| 2 | None | 4 | 1 |
| 3 | None | 5, 6, 7, 8, 9, 10, 11, 12 | 1 |
| 4 | 2 | 5 | 1 |
| 5 | 1, 3, 4 | 10, 11, 12 | 2 |
| 6 | 1, 3 | 5, 10 | 2 |
| 7 | 1, 3 | 5 | 2 |
| 8 | 1, 3 | 5 | 2 |
| 9 | 1, 3 | 5 | 2 |
| 10 | 5 | F1-F4 | 3 |
| 11 | 5 | F1-F4 | 3 |
| 12 | 5 | F1-F4 | 3 |

### Agent Dispatch Summary
- **Wave 1**: 4 tasks — T1 → `deep`, T2 → `quick`, T3 → `quick`, T4 → `quick`
- **Wave 2**: 5 tasks — T5 → `visual-engineering`, T6 → `quick`, T7 → `deep`, T8 → `quick`, T9 → `quick`
- **Wave 3**: 3 tasks — T10 → `quick`, T11 → `visual-engineering`, T12 → `visual-engineering`
- **FINAL**: 4 tasks — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [ ] 1. Rust Backend: E-book Reader Commands

  **What to do**:
  - Create `apps/desktop/src-tauri/src/commands/ebook_reader.rs` with the following Tauri commands:
    - `get_ebook_library_dir()` — Returns `~/AiDocPlus/EBookLibrary/` path, creates dir if not exists
    - `list_ebook_library()` — Scans library dir for supported files (.md, .html, .htm, .docx, .pdf, .epub), returns `Vec<EbookInfo>` sorted by last modified (newest first)
    - `import_ebook(source_path: String)` — Validates file format, copies to library dir with UUID-based filename preserving original extension, returns `EbookInfo`
    - `delete_ebook(filename: String)` — Deletes file from library dir
    - `read_ebook_file(filename: String)` — Reads file as base64 (for EPUB/PDF/DOCX binary formats) or as String (for MD/HTML text formats). Returns `EbookContent { data: String, is_binary: bool }`
    - `open_ebook_reader(app_handle: tauri::AppHandle)` — Creates/resurfaces the reader window (same pattern as `help.rs`)
  - Define Rust structs: `EbookInfo { filename, original_name, format, size_bytes, added_at }`, `EbookContent { data, is_binary }`
  - Register module in `commands/mod.rs`
  - Add unit tests for: `list_ebook_library` (mock dir scan), format detection, import name collision handling

  **Must NOT do**:
  - Do NOT implement reading progress, bookmarks, or annotations
  - Do NOT add file association registration
  - Do NOT use `format!` for path joining — always use `path.join()` or `PathBuf::join()`
  - Do NOT hardcode `/` separator

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Multi-command Rust module with file system operations, needs careful cross-platform handling
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `git-master`: Not needed for single-file creation

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4)
  - **Blocks**: Tasks 5, 6, 7, 8, 9
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `apps/desktop/src-tauri/src/commands/help.rs:1-34` — Window creation pattern (WebviewWindowBuilder, single-instance check, debug/release URL)
  - `apps/desktop/src-tauri/src/commands/coding.rs` — File system CRUD pattern (list files, read, save, delete with PathBuf)
  - `apps/desktop/src-tauri/src/commands/import.rs:1-44` — Format detection by extension pattern

  **API/Type References**:
  - `apps/desktop/src-tauri/src/error.rs` — `AppError` enum and `Result` type for error handling
  - `apps/desktop/src-tauri/src/paths.rs` — Path resolution helpers (home dir, data dir, bundled resources)

  **Test References**:
  - No existing ebook tests — create new `#[cfg(test)]` module within ebook_reader.rs

  **External References**:
  - None needed

  **WHY Each Reference Matters**:
  - `help.rs`: Copy the exact window creation pattern — WebviewWindowBuilder, label check, URL construction
  - `coding.rs`: Follow file listing and reading patterns for cross-platform safety
  - `import.rs`: Reuse the extension matching logic for supported format detection
  - `error.rs`: Use existing error types for consistent error handling

  **Acceptance Criteria**:

  **If TDD (tests enabled):**
  - [ ] Test file created: `#[cfg(test)] mod tests` in ebook_reader.rs
  - [ ] `cd apps/desktop/src-tauri && cargo test --lib ebook_reader` → PASS

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Library directory auto-creation
    Tool: Bash
    Preconditions: ~/AiDocPlus/EBookLibrary/ does not exist
    Steps:
      1. Run: cd apps/desktop/src-tauri && cargo test test_library_dir_creation
      2. Assert exit code 0
      3. Assert ~/AiDocPlus/EBookLibrary/ exists
    Expected Result: Directory created, test passes
    Evidence: .sisyphus/evidence/task-1-library-dir-creation.txt

  Scenario: Import and list ebook
    Tool: Bash
    Preconditions: A test .md file exists at /tmp/test-ebook.md
    Steps:
      1. Run: cd apps/desktop/src-tauri && cargo test test_import_and_list
      2. Assert exit code 0
    Expected Result: File imported with UUID name, list returns it in results
    Evidence: .sisyphus/evidence/task-1-import-list.txt

  Scenario: Unsupported format rejection
    Tool: Bash
    Preconditions: A test .exe file exists at /tmp/test.exe
    Steps:
      1. Run: cd apps/desktop/src-tauri && cargo test test_unsupported_format
      2. Assert exit code 0
    Expected Result: Import returns error for unsupported format
    Evidence: .sisyphus/evidence/task-1-unsupported-format.txt
  ```

  **Commit**: YES (group 1)
  - Message: `feat(reader): add e-book reader Rust backend commands`
  - Files: `apps/desktop/src-tauri/src/commands/ebook_reader.rs`, `apps/desktop/src-tauri/src/commands/mod.rs`
  - Pre-commit: `cd apps/desktop/src-tauri && cargo check`

- [ ] 2. Reader HTML Entry + Vite Configuration

  **What to do**:
  - Create `apps/desktop/src-ui/reader.html` (copy pattern from `scratchpad.html`)
    - Change `<script>` src to `/src/reader/reader-main.tsx`
  - Edit `apps/desktop/src-ui/vite.config.ts`:
    - Add to `rollupOptions.input`: `reader: path.resolve(__dirname, 'reader.html')`
  - Add `epubjs` to npm dependencies: run `pnpm add epubjs` in `apps/desktop/src-ui/`

  **Must NOT do**:
  - Do NOT modify any existing rollup entries
  - Do NOT add epub.js React wrappers (epubjs-react-viewer, etc.)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small config changes, copy-paste pattern
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4)
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `apps/desktop/src-ui/scratchpad.html:1-13` — Exact HTML entry point template to copy
  - `apps/desktop/src-ui/vite.config.ts:27-33` — Current rollupOptions.input to extend

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Vite dev server includes reader entry
    Tool: Bash
    Preconditions: reader.html exists
    Steps:
      1. Run: cd apps/desktop/src-ui && npx vite build --mode development 2>&1 | head -20
      2. Assert output contains "reader.html" in generated chunks
    Expected Result: Reader entry included in build
    Evidence: .sisyphus/evidence/task-2-vite-entry.txt

  Scenario: epubjs installed
    Tool: Bash
    Steps:
      1. Run: cd apps/desktop/src-ui && node -e "require.resolve('epubjs')"
      2. Assert exit code 0
    Expected Result: epubjs resolves correctly
    Evidence: .sisyphus/evidence/task-2-epubjs-install.txt
  ```

  **Commit**: YES (group 2)
  - Message: `feat(reader): add reader window entry and store`
  - Files: `apps/desktop/src-ui/reader.html`, `apps/desktop/src-ui/vite.config.ts`, `apps/desktop/src-ui/package.json`, `apps/desktop/src-ui/pnpm-lock.yaml`
  - Pre-commit: `cd apps/desktop/src-ui && npx tsc --noEmit`

- [ ] 3. i18n Keys for E-book Reader

  **What to do**:
  - Add translation keys to BOTH `zh` and `en` translation files:
    - `apps/desktop/src-ui/src/i18n/locales/zh/translation.json`
    - `apps/desktop/src-ui/src/i18n/locales/en/translation.json`
  - Add a new `reader` namespace section with keys for:
    - Window title: `reader.title` = "电子书阅读器" / "E-book Reader"
    - Library: `reader.library` = "书库" / "Library", `reader.emptyLibrary` = "书库为空，导入文件开始阅读" / "Library is empty. Import files to start reading", `reader.importFile` = "导入文件" / "Import File"
    - Formats: `reader.formatMd`, `reader.formatHtml`, `reader.formatPdf`, `reader.formatDocx`, `reader.formatEpub`
    - Actions: `reader.delete` = "删除" / "Delete", `reader.deleteConfirm` = "确认删除此文件？" / "Delete this file?", `reader.open` = "打开" / "Open"
    - Reading: `reader.fontSize` = "字体大小" / "Font Size", `reader.increaseFont` = "增大字号" / "Increase", `reader.decreaseFont` = "减小字号" / "Decrease"
    - Theme: `reader.theme` = "主题" / "Theme", `reader.lightTheme` = "浅色" / "Light", `reader.darkTheme` = "深色" / "Dark"
    - Fullscreen: `reader.fullscreen` = "全屏" / "Fullscreen", `reader.exitFullscreen` = "退出全屏" / "Exit Fullscreen"
    - Navigation: `reader.toc` = "目录" / "Table of Contents", `reader.prevPage` = "上一页" / "Previous", `reader.nextPage` = "下一页" / "Next"
    - Menu: `reader.menuTitle` = "电子书阅读器…" / "E-book Reader…"
    - Errors: `reader.importFailed` = "导入失败" / "Import Failed", `reader.unsupportedFormat` = "不支持的文件格式" / "Unsupported Format"
  - Add menu i18n to Rust `menu_i18n.rs`:
    - `apps/desktop/src-tauri/src/menu_i18n.rs` — Add `tools_ebook_reader: &'static str` field + zh/en values

  **Must NOT do**:
  - Do NOT add keys to only one language file — both zh AND en must be updated
  - Do NOT hardcode any Chinese strings in React components — always use `t()`

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Straightforward JSON key additions to two files
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4)
  - **Blocks**: Tasks 5, 6, 7, 8, 9, 10, 11, 12
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `apps/desktop/src-tauri/src/menu_i18n.rs:190` — `tools_quick_capture` field pattern for menu items
  - `apps/desktop/src-tauri/src/menu_i18n.rs:331,471` — zh/en value pairs pattern

  **API/Type References**:
  - `apps/desktop/src-ui/src/i18n/locales/zh/translation.json` — Chinese translation file structure
  - `apps/desktop/src-ui/src/i18n/locales/en/translation.json` — English translation file structure

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: i18n keys present in both languages
    Tool: Bash
    Steps:
      1. Run: cd apps/desktop/src-ui && node -e "const zh=require('./src/i18n/locales/zh/translation.json'); const keys=Object.keys(zh.reader||{}); console.log('zh keys:', keys.length); const en=require('./src/i18n/locales/en/translation.json'); const ekeys=Object.keys(en.reader||{}); console.log('en keys:', ekeys.length); process.exit(keys.length===ekeys.length?0:1)"
      2. Assert exit code 0
      3. Assert both have >15 keys
    Expected Result: Same number of keys in both languages
    Evidence: .sisyphus/evidence/task-3-i18n-keys.txt

  Scenario: Rust menu i18n field exists
    Tool: Bash
    Steps:
      1. Run: grep -c "tools_ebook_reader" apps/desktop/src-tauri/src/menu_i18n.rs
      2. Assert output >= 3 (field declaration + zh value + en value)
    Expected Result: Field found in all 3 locations
    Evidence: .sisyphus/evidence/task-3-menu-i18n.txt
  ```

  **Commit**: YES (group 3)
  - Message: `feat(reader): add i18n keys for e-book reader`
  - Files: `apps/desktop/src-ui/src/i18n/locales/zh/translation.json`, `apps/desktop/src-ui/src/i18n/locales/en/translation.json`, `apps/desktop/src-tauri/src/menu_i18n.rs`
  - Pre-commit: `cd apps/desktop/src-tauri && cargo check`

- [ ] 4. Reader Entry Point + Zustand Store

  **What to do**:
  - Create `apps/desktop/src-ui/src/reader/reader-main.tsx` — React entry point:
    - Import React, render `<ReaderApp />` into `#root`
    - Initialize i18n if needed (check if main entry already does global init — if so, skip)
  - Create `apps/desktop/src-ui/src/reader/useReaderStore.ts` — Zustand store:
    - State: `books: EbookInfo[]`, `currentBook: EbookInfo | null`, `isLoading: boolean`, `error: string | null`, `fontSize: number` (default 16), `theme: 'light' | 'dark'` (default system), `isFullscreen: boolean`, `sidebarOpen: boolean` (default true)
    - Actions: `loadLibrary()` — calls `invoke('list_ebook_library')`, `importFile(path)` — calls `invoke('import_ebook')` + refreshes library, `deleteBook(filename)` — calls `invoke('delete_ebook')` + refreshes, `openBook(book)` — sets currentBook, `setFontSize(size)`, `toggleTheme()`, `setFullscreen(v)`, `toggleSidebar()`
    - Types: `EbookInfo { filename: string, originalName: string, format: string, sizeBytes: number, addedAt: string }`, `EbookContent { data: string, isBinary: boolean }`
    - NO Zustand persist — library state is always fresh from backend

  **Must NOT do**:
  - Do NOT use Zustand `persist` middleware — library is loaded from backend each time
  - Do NOT use `@tauri-apps/api` directly in store — use `invoke` from a thin wrapper if needed, or import from `@tauri-apps/api/core`

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Standard React entry + simple Zustand store
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Task 2)
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 5
  - **Blocked By**: Task 2 (needs reader.html to exist for build)

  **References**:

  **Pattern References**:
  - `apps/desktop/src-ui/src/scratchpad-main.tsx` — React entry point pattern (render App into root)
  - `apps/desktop/src-ui/src/stores/useCodingStore.ts` — Zustand store pattern with Tauri invoke calls
  - `apps/desktop/src-ui/src/stores/useSettingsStore.ts` — Zustand with persist (contrast — we do NOT persist)

  **API/Type References**:
  - `apps/desktop/src-tauri/src/commands/ebook_reader.rs` — Rust command signatures that store must match

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: TypeScript compiles cleanly
    Tool: Bash
    Steps:
      1. Run: cd apps/desktop/src-ui && npx tsc --noEmit
      2. Assert exit code 0
    Expected Result: Zero type errors
    Evidence: .sisyphus/evidence/task-4-ts-compile.txt
  ```

  **Commit**: YES (group 2)
  - Message: `feat(reader): add reader window entry and store`
  - Files: `apps/desktop/src-ui/src/reader/reader-main.tsx`, `apps/desktop/src-ui/src/reader/useReaderStore.ts`
  - Pre-commit: `cd apps/desktop/src-ui && npx tsc --noEmit`

- [ ] 5. ReaderApp Shell + LibraryPanel

  **What to do**:
  - Create `apps/desktop/src-ui/src/reader/ReaderApp.tsx` — Main layout:
    - Two-column layout: sidebar (LibraryPanel, 280px, collapsible) + main area (ReadingPane)
    - Toolbar at top with: theme toggle button, fullscreen button, font size +/- buttons
    - When no book is open: show empty state with import prompt
    - When book is open: show ReadingPane with the current book
    - All text via `t()` from `useTranslation()`
  - Create `apps/desktop/src-ui/src/reader/LibraryPanel.tsx` — Sidebar:
    - "Import File" button at top (calls native file dialog via `@tauri-apps/plugin-dialog`)
    - Scrollable list of books: format icon, original name (truncated), file size, added date
    - Click to open, right-click context menu: open, delete (with confirmation)
    - Empty state: icon + message
    - Sort by added date (newest first) from backend

  **Must NOT do**:
  - Do NOT implement search/filter in library
  - Do NOT hardcode text — all via i18n

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Two-column layout with sidebar, toolbar, responsive design
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: NO (Wave 2 starter)
  - **Parallel Group**: Wave 2
  - **Blocks**: Tasks 10, 11, 12
  - **Blocked By**: Tasks 1, 3, 4

  **References**:

  **Pattern References**:
  - `apps/desktop/src-ui/src/manager/ManagerWindow.tsx` — Two-panel layout (sidebar + main)
  - `apps/desktop/src-ui/src/components/file-tree/FileTree.tsx` — List items with icons, right-click menu
  - `apps/desktop/src-ui/src/plugins/_framework/ToolPluginLayout.tsx` — Toolbar + content area

  **API/Type References**:
  - `apps/desktop/src-ui/src/reader/useReaderStore.ts` — Store state/actions
  - `@tauri-apps/plugin-dialog` — `open({ filters: [...] })` for file dialog

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Reader app renders with library sidebar
    Tool: Playwright
    Preconditions: App running in dev mode
    Steps:
      1. Navigate to http://localhost:1420/reader.html
      2. Assert sidebar element with import button exists
      3. Assert main content area exists
      4. Take screenshot
    Expected Result: Two-column layout with toolbar
    Evidence: .sisyphus/evidence/task-5-reader-layout.png

  Scenario: Empty library shows placeholder
    Tool: Playwright
    Preconditions: Library is empty
    Steps:
      1. Navigate to reader window
      2. Assert text containing "empty" or "空" is visible
    Expected Result: Empty state displayed
    Evidence: .sisyphus/evidence/task-5-empty-library.png
  ```

  **Commit**: YES (group 4)
  - Message: `feat(reader): add reader app shell and library panel`
  - Files: `apps/desktop/src-ui/src/reader/ReaderApp.tsx`, `apps/desktop/src-ui/src/reader/LibraryPanel.tsx`
  - Pre-commit: `cd apps/desktop/src-ui && npx tsc --noEmit`

- [ ] 6. ReadingPane Format Dispatcher

  **What to do**:
  - Create `apps/desktop/src-ui/src/reader/ReadingPane.tsx`:
    - Read `currentBook` from store
    - On book change: `invoke('read_ebook_file', { filename })` to get content
    - Dispatch to renderer by format: `.md`→MarkdownReader, `.html`→HtmlReader, `.pdf`→PdfReader, `.docx`→WordReader, `.epub`→EpubReader
    - For binary files (is_binary=true): convert base64 to Uint8Array via `Uint8Array.from(atob(data), c => c.charCodeAt(0))`
    - Loading spinner + error display

  **Must NOT do**:
  - Do NOT implement rendering — just dispatch
  - Do NOT cache content

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 7, 8, 9)
  - **Parallel Group**: Wave 2
  - **Blocks**: None directly (used by Task 5)
  - **Blocked By**: Tasks 1, 3

  **References**:
  - `apps/desktop/src-ui/src/document-types/imitative-writing/SourceOfficeViewer.tsx` — Format switching pattern
  - `apps/desktop/src-ui/src/reader/useReaderStore.ts` — Store types

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: TypeScript compiles
    Tool: Bash
    Steps:
      1. cd apps/desktop/src-ui && npx tsc --noEmit
      2. Assert exit code 0
    Expected Result: Zero errors
    Evidence: .sisyphus/evidence/task-6-reading-pane.txt
  ```

  **Commit**: YES (group 5)

- [ ] 7. EPUB Renderer (epub.js)

  **What to do**:
  - Create `apps/desktop/src-ui/src/reader/renderers/EpubReader.tsx`:
    - Props: `data: Uint8Array`, `fontSize: number`, `theme: 'light' | 'dark'`
    - `import ePub from 'epubjs'` → `ePub(arrayBuffer)` → `book.renderTo(ref, { width: '100%', height: '100%', spread: 'none' })`
    - Navigation: prev/next buttons + TOC sidebar from `book.navigation.toc`
    - Theme: inject CSS via `rendition.themes.default({ body: { background, color } })`
    - Font size: `rendition.themes.fontSize(fontSize + 'px')`
    - Cleanup: `book.destroy()` + `rendition.destroy()` on unmount

  **Must NOT do**:
  - Do NOT use epubjs React wrappers
  - Do NOT implement bookmarks/annotations/progress

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: epub.js has iframe quirks, careful lifecycle management needed
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 5, 6, 8, 9)
  - **Parallel Group**: Wave 2
  - **Blocked By**: Tasks 1, 3

  **References**:
  - `apps/desktop/src-ui/src/plugins/officeviewer/components/PdfViewer.tsx` — ref-based rendering pattern

  **External References**:
  - epub.js API: `ePub(arrayBuffer)` → `book.renderTo(el, opts)` → `rendition.display()`
  - Navigation: `rendition.next()`, `rendition.prev()`, `book.navigation.toc`
  - Theme: `rendition.themes.default({ body: { background: '#1a1a2e', color: '#e0e0e0' } })`

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: EPUB compiles and renders
    Tool: Bash
    Steps:
      1. cd apps/desktop/src-ui && npx tsc --noEmit
      2. Assert exit code 0
    Expected Result: No TS errors
    Evidence: .sisyphus/evidence/task-7-epub-compile.txt

  Scenario: EPUB renders test file
    Tool: Playwright
    Preconditions: Test EPUB in library
    Steps:
      1. Open reader, click EPUB file
      2. Wait 3s for render
      3. Take screenshot
      4. Assert epub container/iframe exists
    Expected Result: EPUB content visible
    Evidence: .sisyphus/evidence/task-7-epub-render.png
  ```

  **Commit**: YES (group 5)

- [ ] 8. Markdown + HTML Renderers

  **What to do**:
  - Create `apps/desktop/src-ui/src/reader/renderers/MarkdownReader.tsx`:
    - Props: `content: string`, `fontSize: number`, `theme: 'light' | 'dark'`
    - Wrap existing `MarkdownPreview` from `@/components/editor/MarkdownPreview`
    - Apply fontSize via CSS on container
  - Create `apps/desktop/src-ui/src/reader/renderers/HtmlReader.tsx`:
    - Props: `content: string`, `fontSize: number`, `theme: 'light' | 'dark'`
    - Render via sandboxed `<iframe srcdoc={content}>` with `sandbox="allow-same-origin"`
    - Inject base CSS for font size and theme

  **Must NOT do**:
  - Do NOT use `dangerouslySetInnerHTML` — use iframe srcdoc

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocked By**: Tasks 1, 3

  **References**:
  - `apps/desktop/src-ui/src/components/editor/MarkdownPreview.tsx` — Existing MD preview

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: MD renders formatted content
    Tool: Playwright
    Steps:
      1. Open MD file in reader
      2. Assert heading/paragraph elements exist
      3. Take screenshot
    Expected Result: Markdown formatted
    Evidence: .sisyphus/evidence/task-8-md-render.png
  ```

  **Commit**: YES (group 5)

- [ ] 9. PDF + Word Renderers

  **What to do**:
  - Create `apps/desktop/src-ui/src/reader/renderers/PdfReader.tsx`:
    - Props: `data: Uint8Array`, `fontSize: number`, `theme: 'light' | 'dark'`
    - Wrap `PdfViewer` from `@/plugins/officeviewer/components/PdfViewer`
    - Create blob URL if needed: `URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))`
    - Cleanup: `URL.revokeObjectURL()` on unmount
  - Create `apps/desktop/src-ui/src/reader/renderers/WordReader.tsx`:
    - Props: `data: Uint8Array`, `fontSize: number`, `theme: 'light' | 'dark'`
    - Use `docx-preview`: `renderAsync(data, container, null, { className: 'docx-viewer' })`
    - Blob URL approach similar to PDF
    - Cleanup: revoke blob URL on unmount

  **Must NOT do**:
  - Do NOT duplicate rendering logic — reuse existing components
  - Do NOT forget blob URL cleanup

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocked By**: Tasks 1, 3

  **References**:
  - `apps/desktop/src-ui/src/plugins/officeviewer/components/PdfViewer.tsx` — PDF viewer
  - `apps/desktop/src-ui/src/document-types/imitative-writing/SourceOfficeViewer.tsx` — DOCX viewer

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: PDF renders canvas
    Tool: Playwright
    Steps:
      1. Open PDF file in reader
      2. Wait 3s
      3. Assert canvas elements exist
      4. Take screenshot
    Expected Result: PDF page visible
    Evidence: .sisyphus/evidence/task-9-pdf-render.png
  ```

  **Commit**: YES (group 5)

- [ ] 10. Menu Registration + Command Registration

  **What to do**:
  - Edit `apps/desktop/src-tauri/src/main.rs`:
    - In tools submenu builder (around line 334): add `MenuItem::with_id(handle, "tools_ebook_reader", t.tools_ebook_reader, true, None::<&str>)?` after the quick_capture item
    - In `on_menu_event` (around line 377): add `"tools_ebook_reader" => { let _ = commands::ebook_reader::open_ebook_reader(app_handle.clone()); }`
    - In `generate_handler![]` (around line 655): add all ebook_reader commands: `get_ebook_library_dir, list_ebook_library, import_ebook, delete_ebook, read_ebook_file, open_ebook_reader`

  **Must NOT do**:
  - Do NOT break existing menu items or command registration
  - Do NOT forget the comma between handler entries

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 11, 12)
  - **Parallel Group**: Wave 3
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 1, 3, 5

  **References**:
  - `apps/desktop/src-tauri/src/main.rs:334-342` — Tools menu builder
  - `apps/desktop/src-tauri/src/main.rs:370-387` — on_menu_event handler
  - `apps/desktop/src-tauri/src/main.rs:654-656` — Command registration (help + quick_capture)
  - `apps/desktop/src-tauri/src/menu_i18n.rs:190` — `tools_quick_capture` field pattern

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Cargo check passes with new commands
    Tool: Bash
    Steps:
      1. cd apps/desktop/src-tauri && cargo check
      2. Assert exit code 0, zero errors
    Expected Result: Compiles cleanly
    Evidence: .sisyphus/evidence/task-10-cargo-check.txt

  Scenario: Menu item registered
    Tool: Bash
    Steps:
      1. grep -c "tools_ebook_reader" apps/desktop/src-tauri/src/main.rs
      2. Assert output >= 3 (menu builder + event handler + comment)
    Expected Result: Found in all locations
    Evidence: .sisyphus/evidence/task-10-menu-registered.txt
  ```

  **Commit**: YES (group 6)
  - Message: `feat(reader): register tools menu entry and commands`
  - Files: `apps/desktop/src-tauri/src/main.rs`
  - Pre-commit: `cd apps/desktop/src-tauri && cargo check`

- [ ] 11. Drag-and-Drop + Fullscreen Mode

  **What to do**:
  - Edit `apps/desktop/src-ui/src/reader/ReaderApp.tsx`:
    - Add Tauri drag-drop listener: `listen<string>('tauri://drag-drop', async (event) => { ... })`
      - On drop: extract file paths from event payload, call `store.importFile(path)` then `store.openBook(imported)`
    - Add window drag-drop event setup on mount, cleanup on unmount
  - Add fullscreen mode:
    - Toolbar button that calls `invoke('plugin:window|toggle_maximize')` or uses `@tauri-apps/api/window` `getCurrentWindow().toggleFullscreen()`
    - Listen for F11 key shortcut
    - Update `isFullscreen` in store
    - Show/hide toolbar based on fullscreen state (auto-hide on mouse inactivity in fullscreen)

  **Must NOT do**:
  - Do NOT open files directly from drop path — always import (copy) to library first
  - Do NOT allow dropping unsupported formats silently — show error message

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Drag-drop UX + fullscreen behavior with smooth transitions
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 10, 12)
  - **Parallel Group**: Wave 3
  - **Blocked By**: Task 5

  **References**:
  - Tauri 2 drag-drop docs: `app.listen('tauri://drag-drop', callback)` with `event.payload` containing file paths
  - `@tauri-apps/api/window` — `getCurrentWindow().toggleFullscreen()`, `isFullscreen()`

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Drag-drop file imports and opens
    Tool: Playwright
    Preconditions: Reader window is open
    Steps:
      1. Simulate file drop event on reader window (may need manual QA note)
      2. If automated: dispatch tauri drag-drop event
      3. Assert import dialog or file appears in library
    Expected Result: File imported and opened
    Evidence: .sisyphus/evidence/task-11-drag-drop.png

  Scenario: Fullscreen toggle via button
    Tool: Playwright
    Steps:
      1. Click fullscreen button in toolbar
      2. Assert window goes fullscreen (check window state)
      3. Click again to exit
    Expected Result: Fullscreen toggles correctly
    Evidence: .sisyphus/evidence/task-11-fullscreen.png
  ```

  **Commit**: YES (group 7)
  - Message: `feat(reader): add drag-drop, theme toggle and fullscreen`
  - Files: `apps/desktop/src-ui/src/reader/ReaderApp.tsx`
  - Pre-commit: `cd apps/desktop/src-ui && npx tsc --noEmit`

- [ ] 12. Dark/Light Theme + Font Size Controls

  **What to do**:
  - Edit `apps/desktop/src-ui/src/reader/ReaderApp.tsx`:
    - Theme toggle: button in toolbar that calls `store.toggleTheme()`
    - Apply theme class to root container: `className={theme === 'dark' ? 'dark' : ''}`
    - Dark theme: dark background (`bg-gray-900`), light text, sidebar adapts
    - Light theme: default (light) colors
    - Default: detect system preference via `window.matchMedia('(prefers-color-scheme: dark)')`
  - Font size controls:
    - Two buttons in toolbar: A- (decrease) and A+ (increase)
    - Range: 12px to 32px, step 2px
    - Pass fontSize to all text-based renderers (MarkdownReader, HtmlReader, EpubReader)
    - Persist fontSize preference in store (no disk persist needed — session-only is fine)

  **Must NOT do**:
  - Do NOT use CSS-in-JS — Tailwind utility classes only
  - Do NOT apply fontSize to PDF/Word renderers (they have their own scaling)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Theme switching UX, smooth transitions, responsive controls
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 10, 11)
  - **Parallel Group**: Wave 3
  - **Blocked By**: Task 5

  **References**:
  - `apps/desktop/src-ui/src/reader/useReaderStore.ts` — `fontSize` and `theme` state
  - Tailwind CSS 4 dark mode: use `dark` class on parent element

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Theme toggle switches dark/light
    Tool: Playwright
    Steps:
      1. Open reader window
      2. Click theme toggle button
      3. Assert root element has 'dark' class
      4. Take screenshot
      5. Click again
      6. Assert 'dark' class removed
    Expected Result: Theme toggles correctly
    Evidence: .sisyphus/evidence/task-12-theme-toggle.png

  Scenario: Font size controls work
    Tool: Playwright
    Steps:
      1. Open a markdown file in reader
      2. Click A+ button 3 times
      3. Assert text size increased (check CSS font-size on content)
      4. Click A- button 2 times
      5. Assert text size decreased
    Expected Result: Font size adjusts as expected
    Evidence: .sisyphus/evidence/task-12-font-size.png
  ```

  **Commit**: YES (group 7)
  - Message: `feat(reader): add drag-drop, theme toggle and fullscreen`
  - Files: `apps/desktop/src-ui/src/reader/ReaderApp.tsx`
  - Pre-commit: `cd apps/desktop/src-ui && npx tsc --noEmit`

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists. For each "Must NOT Have": search codebase for forbidden patterns. Check evidence files exist. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `cargo check` + `npx tsc --noEmit` + `cargo test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, unused imports. Check AI slop: excessive comments, over-abstraction.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Start from clean state. Execute EVERY QA scenario from EVERY task. Test cross-task integration (library → open → read → theme switch → fullscreen). Test edge cases: empty library, corrupted EPUB, unsupported format. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff. Verify 1:1. Check "Must NOT do" compliance. Detect cross-task contamination.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| Group | Files | Message |
|-------|-------|---------|
| 1 | `commands/ebook_reader.rs`, `commands/mod.rs` | `feat(reader): add e-book reader Rust backend commands` |
| 2 | `reader.html`, `vite.config.ts`, `reader-main.tsx`, `useReaderStore.ts` | `feat(reader): add reader window entry and store` |
| 3 | `i18n/locales/*/translation.json` | `feat(reader): add i18n keys for e-book reader` |
| 4 | `reader/ReaderApp.tsx`, `reader/LibraryPanel.tsx` | `feat(reader): add reader app shell and library panel` |
| 5 | `reader/ReadingPane.tsx`, `reader/renderers/*.tsx` | `feat(reader): add format renderers (MD/HTML/PDF/DOCX/EPUB)` |
| 6 | `main.rs` | `feat(reader): register tools menu entry and commands` |
| 7 | `reader/ReaderApp.tsx` (theme/fullscreen/dnd) | `feat(reader): add drag-drop, theme toggle and fullscreen` |

Pre-commit verification: `cargo check && cd apps/desktop/src-ui && npx tsc --noEmit`

---

## Success Criteria

### Verification Commands
```bash
# Rust compilation + tests
cd apps/desktop/src-tauri && cargo check    # Expected: 0 errors, 0 warnings
cd apps/desktop/src-tauri && cargo test     # Expected: all tests pass

# TypeScript compilation
cd apps/desktop/src-ui && npx tsc --noEmit  # Expected: 0 errors

# Full build
cd apps/desktop && pnpm tauri build --debug --target aarch64-apple-darwin  # Expected: success
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All Rust tests pass
- [ ] TypeScript compilation clean
- [ ] Tools menu shows reader entry
- [ ] Reader window opens independently
- [ ] All 5 formats render correctly
- [ ] EPUB TOC navigation works
- [ ] Theme toggle works
- [ ] Font size adjustment works
- [ ] Fullscreen mode works
- [ ] Drag-and-drop works
- [ ] i18n complete (zh + en)
