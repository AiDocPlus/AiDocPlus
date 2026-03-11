# §1.3 编辑器性能优化 — 实施计划

## 现状分析

### 当前架构
- **编辑器**：`/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/components/editor/MarkdownEditor.tsx` — CodeMirror 6，15 个 Compartment 动态扩展
- **预览**：`/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/components/editor/MarkdownPreview.tsx` — ReactMarkdown + remark-gfm + rehype-katex + rehype-highlight + mermaid
- **状态栏**：`/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/components/editor/EditorStatusBar.tsx` — 显示行数/词数/字符数
- **自动保存**：`/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/components/editor/EditorPanel.tsx` — setInterval + ref + baseline 比较

### 已有优化
- ✅ Compartment 动态更新（设置变更不重建编辑器）
- ✅ 自动保存用 ref 避免频繁重建 interval
- ✅ 光标更新用 requestAnimationFrame + 值比较守卫
- ✅ docContent 更新有 300ms debounce
- ✅ EditorPanel 已 memo()
- ✅ MarkdownPreview 已 React.memo()
- ✅ 重型面板（版本历史、组合器、编程区）已 lazy 加载
- ✅ checkboxWidget 只扫描 visibleRanges

### 性能瓶颈

| 问题 | 位置 | 影响 | 严重度 |
|------|------|------|--------|
| 统计计算每次渲染执行 | MarkdownEditor L463-465 | 每次 docContent 变化时 split 全文 | 中 |
| EditorStatusBar 未 memo | EditorStatusBar.tsx | 父组件渲染时总是重渲染 | 低 |
| 预览模式全量渲染 | MarkdownPreview.tsx | ReactMarkdown 解析全文档，大文档卡顿 | 高 |
| 无大文档检测 | MarkdownEditor.tsx | >50KB 文档无特殊处理（lint/预览全开） | 高 |
| Mermaid 渲染无缓存 | MarkdownPreview L52-74 | 每次 content 变化重新渲染所有 mermaid | 中 |
| 分屏滚动同步无节流 | MarkdownEditor L470-481 | 每个 scroll 事件都触发计算 | 低 |

---

## 实施步骤

### Step 1：统计计算优化 + EditorStatusBar memo
**文件**：
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/components/editor/MarkdownEditor.tsx`
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/components/editor/EditorStatusBar.tsx`

**改动**：
1. 将 `characterCount`、`wordCount`、`lineCount` 改为 `useMemo`，依赖 `docContent`
2. `wordCount` 改用更高效的正则计算（避免 split + filter）
3. `EditorStatusBar` 加 `memo()` 包裹

### Step 2：大文档检测 + 自适应降级
**文件**：
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/components/editor/MarkdownEditor.tsx`

**改动**：
1. 定义大文档阈值：`LARGE_DOC_THRESHOLD = 100_000`（10 万字符，约 5~8 万字）
2. 当 `docContent.length > LARGE_DOC_THRESHOLD` 时：
   - 将 docContent debounce 从 300ms 提升到 800ms
   - 禁用 markdownLint（大文档 lint 逐行扫描开销大）
   - 分屏预览降级为按需手动刷新（显示"文档较大，点击刷新预览"按钮）
3. 在状态栏显示"大文档模式"提示

### Step 3：预览渲染优化
**文件**：
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/components/editor/MarkdownPreview.tsx`

**改动**：
1. 对 >50KB 的内容，截断预览：只渲染前 N 个字符 + 显示"文档较长，已截断预览"提示
2. Mermaid 渲染结果缓存：用 `Map<codeHash, svgString>` 缓存已渲染的 Mermaid 图表，content 变化时只重渲新增/变更的图表

### Step 4：滚动同步节流
**文件**：
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/components/editor/MarkdownEditor.tsx`

**改动**：
1. `handleEditorScroll` 用 `requestAnimationFrame` 节流（当前已用 scrollSyncLock，但可进一步用 rAF 去抖）

### Step 5：i18n + 验证
**文件**：
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/i18n/locales/zh/translation.json`
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/i18n/locales/en/translation.json`

**改动**：
1. 添加大文档模式相关翻译键
2. `tsc --noEmit` 验证

---

## 验证标准
- [ ] tsc --noEmit 零错误
- [ ] 10 万字文档打开无明显卡顿
- [ ] 分屏模式大文档输入流畅
- [ ] 小文档体验不变
