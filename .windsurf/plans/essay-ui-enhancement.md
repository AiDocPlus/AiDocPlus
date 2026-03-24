# 散文写作环境大规模改善计划

> **方向**：编辑器体验升级 + 写作辅助增强
> **当前状态**：14 个文件 → 目标 ~27 个文件
> **基础目录**：`/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/essay/`

---

## Phase 1: 专用散文编辑器 + 工具栏 + 状态栏（核心基础）

### 目标
将散文编辑器从通用 MarkdownEditor 升级为专用编辑体验，抽取工具栏和状态栏为独立组件。

### 新增文件
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/essay/EssayToolbar.tsx`
  - 从 EssayDocWorkspace 中抽取工具栏逻辑
  - 格式化按钮组（加粗/斜体/删除线/引用/分隔线/代码）
  - 视图模式切换按钮（编辑 ✏️ / 预览 👁️ / 分屏 ⬜⬜）
  - 大纲视图开关
  - 打字机滚动开关
  - 专注模式增强（隐藏两侧面板+全屏编辑器）
  - 散文子类型快速切换
  - 文档操作（新建/保存/导出）

- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/essay/EssayEditor.tsx`
  - 包裹 MarkdownEditor 的散文专用编辑器组件
  - **打字机滚动模式**：当前光标行始终保持在视窗垂直中部
  - **首行缩进**：中文散文段落自动首行缩进两个全角空格
  - **段落交互**：hover 段落左侧显示角色标记（起/承/转/合色块）
  - **段落间距**：散文段落间适当加大间距，提升阅读体验
  - 支持从外部接收高亮装饰数据（Phase 3 对接）

- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/essay/EssayStatusBar.tsx`
  - 从 EssayDocWorkspace 中抽取状态栏逻辑
  - 字数统计（当前/目标，进度条）
  - 段落数 / 句子数
  - 修辞数量（带颜色标识密度）
  - 阅读时间
  - 写作阶段指示器（构思/起草/修改/润色）
  - 写作速度（字/分钟，基于最近5分钟）
  - 保存状态
  - 光标位置（行:列）

### 修改文件
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/essay/EssayDocWorkspace.tsx`
  - 移除内联工具栏和状态栏代码，替换为新组件
  - 新增视图模式状态：`viewMode: 'edit' | 'preview' | 'split' | 'outline'`
  - 新增打字机滚动状态：`typewriterMode: boolean`
  - 中栏根据 viewMode 渲染不同组件

---

## Phase 2: 预览模式与大纲视图

### 目标
为散文提供专业的阅读预览和结构化大纲视图。

### 新增文件
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/essay/EssayPreview.tsx`
  - **杂志排版预览**：模拟期刊/杂志的排版样式
  - 标题样式（大号字、居中）
  - 正文段落缩进、行距1.8-2.0
  - 修辞手法高亮标注（彩色下划线+tooltip）
  - 意象关键词着色（按感官类型着色：视觉红、听觉蓝、嗅觉绿等）
  - 段落角色色带（左侧竖线颜色标识起承转合）
  - 元数据信息区（作者/子类型/情感基调/字数）
  - 打印友好样式（@media print）

- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/essay/EssayOutlineView.tsx`
  - **段落结构树**：
    - 每段显示：序号、角色标记色块、前30字预览、字数
    - 起承转合用不同颜色标识（起=蓝、承=绿、转=橙、合=紫）
  - **拖拽排序**：拖拽调整段落顺序，自动更新正文
  - **段落角色快速修改**：点击色块切换段落角色
  - **与编辑器联动**：点击段落项跳转到编辑器对应位置
  - **结构完整度指示**：检查起承转合是否完整，缺失项高亮提醒
  - 每段字数占比可视化（小条形图）

### 修改文件
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/essay/EssayDocWorkspace.tsx`
  - 中栏根据 viewMode 渲染 EssayEditor / EssayPreview / 分屏模式
  - 分屏模式：左编辑右预览，可调整比例
  - 大纲视图：替换左侧段落导航 Tab 或作为独立视图模式

---

## Phase 3: 修辞/意象实时高亮引擎

### 目标
在编辑器内实时检测并渲染修辞手法和意象关键词的高亮标注。

### 新增文件
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/essay/essayHighlighter.ts`
  - **增量检测引擎**：
    - 基于 essayAnalysis.ts 的修辞检测函数
    - 防抖处理（300ms）：编辑停止后才执行检测
    - 增量检测：仅重新检测变更的段落，复用未变段落结果
  - **高亮装饰数据生成**：
    - 修辞标注：`{ start, end, type: 'rhetoric', rhetoricType, label, color }`
    - 意象标注：`{ start, end, type: 'imagery', imageryType, keyword, color }`
  - **颜色映射**：
    - 比喻=蓝色、拟人=绿色、排比=紫色、对偶=橙色
    - 视觉意象=红色、听觉=蓝色、嗅觉=绿色、触觉=棕色、味觉=粉色
  - **性能保护**：超过 10000 字时降低检测频率

### 修改文件
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/essay/EssayEditor.tsx`
  - 集成 essayHighlighter 引擎
  - 接收高亮装饰数据并渲染到编辑器
  - 修辞：彩色波浪下划线 + hover 显示修辞类型
  - 意象：浅色背景 + hover 显示意象含义
  - 高亮开关（工具栏 → EssayToolbar 联动）

- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/essay/EssayToolbar.tsx`
  - 新增修辞高亮开关按钮
  - 新增意象标注开关按钮
  - 高亮开关状态与 EssayEditor 联动

---

## Phase 4: 写作模板与灵感系统

### 目标
提供散文写作模板和灵感生成工具，降低创作门槛。

### 新增文件
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/essay/essayTemplates.ts`
  - **模板数据定义**（每种子类型 2-3 个模板）：
    - 抒情散文：《故乡月色》《一封给时光的信》《窗前的老槐树》
    - 叙事散文：《那年夏天》《父亲的背影》《老街记忆》
    - 议论散文：《论读书》《生命的厚度》
    - 游记散文：《江南烟雨》《西北行记》
    - 哲理散文：《落叶的启示》《水的智慧》
  - 每个模板包含：
    - `title`: 模板标题
    - `description`: 模板描述
    - `skeleton`: 结构框架（起承转合各段引导文字）
    - `settings`: 预设设置（子类型/情感基调/目标字数/目标风格）
    - `prompts`: 写作引导提示（每段的写作方向提示）
    - `thumbnail`: 预览缩略文字

- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/essay/EssayTemplateDialog.tsx`
  - **模板选择对话框**（创建新散文时弹出，也可从工具栏打开）
  - 模板卡片网格展示（封面+标题+描述+子类型标签）
  - 按子类型分类筛选 Tab
  - 模板预览（点击卡片展开预览结构框架）
  - "使用模板"按钮：应用模板到当前文档
  - "空白文档"选项：不使用模板
  - 自定义模板管理（将当前文档保存为模板）

- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/essay/EssayWritingPrompt.tsx`
  - **写作灵感面板**（作为左侧面板的新 Tab）
  - 每日写作提示：基于当前主题 AI 生成 3-5 条写作方向
  - 主题联想词发散：输入一个词，AI 发散相关意象/场景/情感
  - 灵感卡片：展示名家名篇精选片段（按子类型分类）
  - 一键收集：将灵感/名句添加到素材库
  - 写作练习：提供 5-10 分钟定时写作练习（自由书写）

### 修改文件
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/essay/types.ts`
  - 新增 `EssayTemplate` 接口
  - 新增 `WritingPrompt` 接口

- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/essay/EssayDocWorkspace.tsx`
  - 左侧面板新增"灵感"Tab（💡图标）
  - 工具栏新增"模板"按钮
  - 集成 EssayTemplateDialog

---

## Phase 5: 大纲规划与韵律分析

### 目标
提供结构化的写作规划工具和散文特有的韵律节奏分析。

### 新增文件
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/essay/EssayOutlinePlanner.tsx`
  - **结构规划面板**（左侧面板新 Tab 或增强大纲视图）
  - 起承转合四段式结构模板（可自定义段数）
  - 每段设置：
    - 段落主题/要点
    - 目标字数
    - 关键意象
    - 情感方向
  - AI 辅助大纲生成：输入主题 → AI 生成完整大纲
  - 大纲完成度追踪（每段已写字数/目标字数进度条）
  - 与正文段落自动关联（基于段落顺序）

- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/essay/essayRhythm.ts`
  - **韵律节奏分析引擎**
  - 句子长度分析：
    - 长句（>30字）/ 中句（15-30字）/ 短句（<15字）比例
    - 连续长句/短句检测（提示节奏单调）
  - 段落节奏曲线：每段内句子长度的波动图数据
  - 句式起始模式：检测连续相同句式开头（建议变化）
  - 标点节奏：分析逗号/句号/感叹号/问号的使用频率和分布
  - 整体节奏评分（0-100）及改进建议

### 修改文件
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/essay/types.ts`
  - 新增 `EssayOutlineItem` 接口（段落规划数据结构）
  - `EssayDocumentContent` 新增 `outline: EssayOutlineItem[]` 字段

- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/essay/EssayDocWorkspace.tsx`
  - 左侧面板新增"规划"Tab（📐图标）

---

## Phase 6: 写作仪表盘与右键菜单

### 目标
提供全面的写作统计仪表盘和便捷的右键上下文菜单。

### 新增文件
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/essay/EssayDashboard.tsx`
  - **替换/增强现有 EssayAnalysisPanel**
  - 写作进度总览卡片（字数/段落/修辞/意象 四格统计）
  - 每日写作量图表（折线图，最近7/30天）
  - 修辞类型分布饼图（比喻/拟人/排比等占比）
  - 意象感官分布雷达图（视觉/听觉/嗅觉/触觉/味觉/抽象）
  - 韵律节奏可视化（句子长度波动图）
  - 段落复杂度热力图
  - 情感走势增强图（带注释、可点击跳转）
  - 综合评分雷达图 + 改进建议列表
  - 导出分析报告（Markdown/PDF）

- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/essay/EssayContextMenu.tsx`
  - **右键上下文菜单**
  - 段落级操作：
    - 标记段落角色（起/承/转/合/无）
    - 在上方/下方插入新段落
    - 合并相邻段落
    - 拆分当前段落
    - 移动段落（上移/下移）
  - 选中文本操作：
    - AI 分析 / AI 润色 / AI 续写
    - 添加到素材库（灵感/引用/意象/参考）
    - 标注修辞手法
    - 查找相似内容
    - 复制/剪切

### 修改文件
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/essay/EssayDocWorkspace.tsx`
  - 左侧面板"分析"Tab 替换为 EssayDashboard
  - 集成 EssayContextMenu
  - 右键事件处理

- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/essay/EssayAnalysisPanel.tsx`
  - 逐步迁移到 EssayDashboard，最终废弃

---

## 文件变更总览

### 新增文件（13个）
| Phase | 文件 | 说明 |
|-------|------|------|
| 1 | `EssayToolbar.tsx` | 专用工具栏 |
| 1 | `EssayEditor.tsx` | 专用编辑器 |
| 1 | `EssayStatusBar.tsx` | 专用状态栏 |
| 2 | `EssayPreview.tsx` | 阅读预览 |
| 2 | `EssayOutlineView.tsx` | 大纲视图 |
| 3 | `essayHighlighter.ts` | 实时高亮引擎 |
| 4 | `essayTemplates.ts` | 模板数据 |
| 4 | `EssayTemplateDialog.tsx` | 模板对话框 |
| 4 | `EssayWritingPrompt.tsx` | 写作灵感面板 |
| 5 | `EssayOutlinePlanner.tsx` | 大纲规划工具 |
| 5 | `essayRhythm.ts` | 韵律分析引擎 |
| 6 | `EssayDashboard.tsx` | 写作仪表盘 |
| 6 | `EssayContextMenu.tsx` | 右键菜单 |

### 主要修改文件
| 文件 | 涉及 Phase | 说明 |
|------|-----------|------|
| `EssayDocWorkspace.tsx` | 1-6 | 渐进式重构，整合所有新组件 |
| `types.ts` | 4, 5 | 新增模板/大纲数据结构 |
| `constants.ts` | 4 | 新增模板相关常量 |
| `EssayToolbar.tsx` | 1, 3 | 创建后在 Phase 3 增强高亮开关 |
| `EssayEditor.tsx` | 1, 3 | 创建后在 Phase 3 集成高亮渲染 |
| `EssayAnalysisPanel.tsx` | 6 | 被 EssayDashboard 替代 |

### 最终文件数：~27 个（从 14 个增长到 27 个）

---

## 实施顺序与依赖关系

```
Phase 1 (基础) ─┬─→ Phase 2 (预览/大纲)
                │
                └─→ Phase 3 (高亮引擎) ─→ Phase 6 (仪表盘)
                │
                └─→ Phase 4 (模板/灵感)
                │
                └─→ Phase 5 (规划/韵律)
```

- Phase 1 是所有后续 Phase 的前提
- Phase 2-5 可相对独立实施（但建议按顺序）
- Phase 6 依赖 Phase 3 的高亮引擎和 Phase 5 的韵律分析

---

## 验证清单（每个 Phase 完成后）
- [ ] `tsc --noEmit` 零错误
- [ ] `pnpm tauri dev` 启动正常
- [ ] 创建新散文文档 → 编辑器正常显示
- [ ] 各功能点手动测试通过
- [ ] 现有功能无回归（AI助手/素材库/导出/快照等）
