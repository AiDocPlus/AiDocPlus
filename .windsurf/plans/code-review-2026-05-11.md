# 代码审查报告 — 2026-05-11

## 项目概况

| 指标 | 数据 |
|------|------|
| 前端文件数 | 710 个 .ts/.tsx |
| 前端代码行数 | 194,903 行 |
| Rust 文件数 | 52 个 .rs |
| Rust 代码行数 | 22,605 行 |
| 前端测试 | 356 个通过（27 个测试文件） |
| Rust 测试 | 94 个通过 |
| TypeScript 编译 | ✅ 零错误 |
| Cargo check | ✅ 零错误零警告 |
| 当前版本 | 0.3.15 |

---

## ✅ 已做好的方面（优势）

1. **类型安全**：TypeScript strict mode 全面通过，无 `any` 逃逸到核心逻辑
2. **结构化错误处理**：Rust 端 `AppError` 枚举 + `ErrorCode` + `ResultExt` trait，前端 `formatBackendError()`
3. **安全防护**：输入校验（ID/标题/内容大小/URL）、SSRF 防护、路径遍历检测、ZIP 炸弹防护
4. **性能优化**：memo/useShallow/useCallback/防抖保存/内容卸载、启动并行加载
5. **国际化**：100% i18next 覆盖，zh/en 双语
6. **代码组织**：Store 拆分为多个 helper 文件、文档类型系统解耦、插件 SDK 隔离
7. **开发体验**：结构化日志、perfLog 诊断工具、workspace 状态持久化
8. **测试覆盖**：前端 356 测试 + Rust 94 测试，覆盖 store helpers/计算引擎/安全校验/错误处理

---

## 🔧 本次修复的问题

### 1. Rust 测试编译失败（严重）
- **文件**：`/Users/jdh/Code/AiDocPlus/apps/desktop/src-tauri/src/tools.rs`
- **问题**：`execute_tool()` 改为 `async fn` 后，2 个测试未更新为 `#[tokio::test]` + `.await`
- **修复**：将 `#[test] fn` 改为 `#[tokio::test] async fn`，调用加 `.await`

### 2. 缺少全局 ErrorBoundary（中等）
- **新增**：`/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/components/ErrorBoundary.tsx`
- **集成**：`main.tsx` 中包裹 `<App />`
- **效果**：React 组件树任何位置的渲染错误不再导致白屏，显示友好的错误恢复界面

### 3. 缺少全局 Promise rejection 捕获（中等）
- **文件**：`/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/main.tsx`
- **新增**：`window.addEventListener('unhandledrejection', ...)`
- **效果**：未 catch 的 Promise 错误不再静默丢失

### 4. dangerouslySetInnerHTML 缺少 XSS 消毒（高危）
- **新增**：`/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/lib/sanitize.ts`（DOMPurify 封装）
- **修复的文件**：
  - `mail-client/views/SentView.tsx` — 邮件正文（外部数据来源）
  - `mail-client/views/ComposeView.tsx` — 签名预览
  - `mail-client/views/SettingsView.tsx` — 签名预览
  - `plugins/email/dialogs/HistoryDialog.tsx` — 发送历史正文
  - `plugins/email/dialogs/DraftsDialog.tsx` — 草稿正文预览
- **未修改**（风险低/内部数据）：
  - Mermaid SVG（程序内部生成）
  - 微信公众号预览（用户自编辑内容）
  - FabricJS 画布（不是 HTML 注入场景）

### 5. Mutex poisoning 可能导致 panic（低危）
- **文件**：`/Users/jdh/Code/AiDocPlus/apps/desktop/src-tauri/src/database.rs`
- **修复**：`lock().unwrap()` → `lock().unwrap_or_else(|e| e.into_inner())`
- **效果**：即使其他线程 panic，数据库连接仍可安全使用

### 6. 生产代码残留 console.log
- **文件**：`/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/App.helpers.ts`
- **修复**：`console.log` → `console.info`

---

## 📋 已知但本次未修改的问题（建议后续处理）

### 低优先级
1. **~53 处 `any` 类型**：主要在 fabric.js/simple-mind-map/tiptap 第三方库交互处，属于类型声明不完善的妥协
2. **i18n 翻译文件有 4 处重复键**（行 2496/2635/2872/2918）：属于历史积累，建议清理
3. **大文件拆分建议**：
   - `useAppStore.ts`（2153 行）— 已拆分 helper，但主文件仍较大
   - `CalculatorWorkspace.tsx`（2342 行）— 计算文档工作区
   - `commands/stock.rs`（1879 行）— 股票模块
4. **邮件客户端窗口使用 inline styles**：独立设计系统，与主程序 Tailwind 体系不同，暂不迁移

### 中优先级
5. **Mermaid/微信预览的 dangerouslySetInnerHTML**：虽为内部数据，长期建议统一消毒
6. **`main.rs:438` 的 `get_webview_window("main").unwrap()`**：极低概率失败但理论上应 handle

---

## 验证结果

```
✅ tsc --noEmit — 零错误
✅ cargo check — 零错误零警告
✅ vitest run — 27 文件 356 测试全部通过
✅ cargo test — 94 测试全部通过
```
