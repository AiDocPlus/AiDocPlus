---
name: diary-code-review-improvements
overview: 全面审查DiaryDocWorkspace代码，从性能优化、架构重构、功能增强三个维度提出专业化改进方案，并制定实施优先级
todos:
  - id: phase1-constants
    content: 提取魔法数字到constants.ts，定义SAVE_DEBOUNCE、MAX_SNAPSHOTS等常量
    status: completed
  - id: phase1-utils
    content: 创建utils.ts，使用nanoid替换Date.now()生成唯一ID，修复快照限制逻辑
    status: completed
    dependencies:
      - phase1-constants
  - id: phase1-types
    content: 优化types.ts类型定义，添加ColorLabel类型，导出完整类型
    status: completed
    dependencies:
      - phase1-constants
  - id: phase1-cleanup
    content: 清理eslint-disable注释，修复useEffect依赖，修复日期解析问题
    status: completed
    dependencies:
      - phase1-utils
      - phase1-types
  - id: phase2-split
    content: 拆分DiaryDocWorkspace为LeftPanel/EditorSection/RightPanel/StatusBar子组件
    status: completed
    dependencies:
      - phase1-cleanup
  - id: phase2-save
    content: 实现统一保存队列，合并双重debounce，修复内存泄漏
    status: completed
    dependencies:
      - phase2-split
  - id: phase2-memo
    content: 添加useMemo缓存筛选结果，优化大文档性能
    status: completed
    dependencies:
      - phase2-save
  - id: phase3-templates
    content: 实现DIARY_ENTRY_TEMPLATES模板系统，添加TemplateSelector组件
    status: completed
    dependencies:
      - phase2-memo
  - id: phase3-colors
    content: 实现COLOR_LABELS颜色标签系统，添加ColorLabelPicker组件
    status: completed
    dependencies:
      - phase3-templates
  - id: phase3-statusbar
    content: 创建StatusBar组件，显示字数、心情、天气、目标进度、连续天数等
    status: completed
    dependencies:
      - phase3-colors
  - id: phase3-typewriter
    content: 添加打字机模式支持，与NovelEditorSettings保持一致
    status: completed
    dependencies:
      - phase3-statusbar
  - id: phase4-views
    content: 添加卡片视图模式，增强DiaryEntryList组件
    status: completed
    dependencies:
      - phase3-typewriter
  - id: phase4-tracker
    content: 实现写作会话追踪，记录写作时长和空闲时间
    status: completed
    dependencies:
      - phase4-views
  - id: phase4-ai
    content: 升级DiaryAISidebar上下文引擎，添加阶段检测和个性化建议
    status: completed
    dependencies:
      - phase4-tracker
---

## 产品概述

日记本文档类型是AiDocPlus的核心编辑器之一，采用三栏布局（左侧日历/筛选/列表、中心编辑器、右侧AI助手），支持多日记本管理、条目编辑、AI辅助等功能。

## 核心问题分类（23项）

### 一、性能问题 (5项)

- **P1**: 频繁JSON序列化 - 每次内容变化都执行`JSON.stringify(diaryRef.current)`
- **P2**: useEffect依赖不完整 - `eslint-disable-next-line`忽略host.doc
- **P3**: 内存泄漏风险 - `metaSaveTimerRef`和`saveStatusTimerRef`未清理
- **P4**: 大文档性能 - `getEntriesOnThisDay`、`applyFilter`等函数条目多时慢
- **P5**: 状态同步开销 - `entryContent`与`diary.entries[].content`分离

### 二、架构问题 (4项)

- **A1**: 组件过重 - `DiaryDocWorkspace` 900+行需拆分
- **A2**: 状态分裂 - `entryContent`独立状态易造成不同步
- **A3**: `diaryRef`滥用 - 过度使用ref访问diary
- **A4**: 选择器冗余 - `useShallow`选择单个字段可优化

### 三、逻辑问题 (3项)

- **L1**: 日期解析隐患 - `new Date(y, m-1, 1)`跨年可能有问题
- **L2**: 保存竞态 - 两个独立auto-save可能同时触发
- **L3**: 模板追加 - 直接拼接`\n\n`可能破坏Markdown结构

### 四、潜在Bug (3项)

- **B1**: ID生成碰撞 - `Date.now()+random`毫秒内多次调用可能碰撞
- **B2**: 快照限制失效 - `slice(-20)`在`addSnapshot`追加后执行
- **B3**: 历史记录未实现 - 翻译键`historyComingSoon`表明功能未完成

### 五、代码质量问题 (4项)

- **Q1**: 魔法数字 - debounce时间(5000/2000ms)、快照数(20)等
- **Q2**: 类型断言 - `import('./types')`避免循环导入但类型不精确
- **Q3**: eslint禁用过多 - 4处`eslint-disable`
- **Q4**: 组件职责不清 - 布局、数据、交互混在一起

### 六、可借鉴NovelDocWorkspace的实践 (8项)

- **N1**: 条目模板系统 - 晨间/晚间/情绪/感恩等专用模板
- **N2**: 颜色标签系统 - 支持条目颜色分类
- **N3**: 写作目标追踪增强 - 每日/每周/每月目标+达成提醒
- **N4**: 写作会话追踪 - 空闲检测+写作时长统计
- **N5**: 打字机模式 - 光标居中提升专注度
- **N6**: 增强状态栏 - 目标进度+写作时长+连续天数
- **N7**: 视图模式增强 - 卡片视图、标签视图、月度/年度视图
- **N8**: AI上下文感知升级 - 阶段检测+个性化建议

## 改进目标

按照专业化要求，从架构、性能、功能三个层次系统改进日记本文档代码，达到生产级代码质量标准。

## 技术架构

### 目录结构（改进后）

```
apps/desktop/src-ui/src/document-types/diary/
├── components/                    # [NEW] 子组件目录
│   ├── LeftPanel.tsx             # 左栏组件（拆分）
│   ├── EditorSection.tsx         # 编辑区组件（拆分）
│   ├── RightPanel.tsx            # 右栏组件（拆分）
│   ├── StatusBar.tsx             # 状态栏组件（新增）
│   ├── TemplateSelector.tsx      # 模板选择器（新增）
│   └── ColorLabelPicker.tsx      # 颜色标签选择器（新增）
├── constants.ts                   # [NEW] 常量定义
├── utils.ts                       # [NEW] 工具函数（ID生成等）
├── DiaryDocWorkspace.tsx          # [MODIFY] 重构为布局组件
├── DiaryEditor.tsx                # [MODIFY] 简化包装
├── DiaryToolbar.tsx               # [MODIFY] 添加颜色标签入口
├── DiaryEntryList.tsx             # [MODIFY] 支持颜色标签显示
├── DiaryDashboard.tsx             # [MODIFY] 增强统计
├── types.ts                       # [MODIFY] 优化类型定义
├── diaryContext.ts                # [MODIFY] 升级AI上下文
└── ... 其他现有文件保持不变
```

### 关键实现

#### 1. 常量提取 (constants.ts)

```typescript
// 防抖时间
export const CONTENT_SAVE_DEBOUNCE_MS = 5000;
export const META_SAVE_DEBOUNCE_MS = 2000;
export const SNAPSHOT_SAVE_DEBOUNCE_MS = 60000;

// 限制
export const MAX_SNAPSHOTS = 20;
export const MAX_ENTRIES_PER_PAGE = 50;
export const WRITING_GOAL_DEFAULT = 500;

// ID长度
export const ID_RANDOM_LENGTH = 8;
```

#### 2. 唯一ID生成 (utils.ts)

```typescript
import { nanoid } from 'nanoid';
export const generateEntryId = () => nanoid(16);
```

#### 3. 统一保存队列

```typescript
// 使用单一保存队列，避免竞态
const saveQueueRef = useRef<Set<() => void>>(new Set());
const flushSave = useCallback(() => {
  saveQueueRef.current.forEach(fn => fn());
  saveQueueRef.current.clear();
}, []);
```

#### 4. 模板系统

```typescript
export const DIARY_ENTRY_TEMPLATES = [
  { key: 'morning', labelKey: 'diary.templateMorning', icon: '🌅', content: '## 今日目标\n\n## 感恩三件事\n\n## 今日计划\n' },
  { key: 'evening', labelKey: 'diary.templateEvening', icon: '🌙', content: '## 今日回顾\n\n## 今日收获\n\n## 明日改进\n' },
  { key: 'mood', labelKey: 'diary.templateMood', icon: '💭', content: '## 情绪状态\n\n## 触发事件\n\n## 应对方式\n' },
  { key: 'gratitude', labelKey: 'diary.templateGratitude', icon: '🙏', content: '## 感恩的人\n\n## 感恩的事\n\n## 感恩的理由\n' },
  { key: 'goal', labelKey: 'diary.templateGoal', icon: '🎯', content: '## 目标\n\n## 进度\n\n## 障碍\n' },
  { key: 'reflection', labelKey: 'diary.templateReflection', icon: '🔍', content: '## 发生了什么\n\n## 我学到了\n\n## 下次怎么做\n' },
];
```

#### 5. 颜色标签

```typescript
export const COLOR_LABELS = [
  { key: 'red', color: '#ef4444', labelKey: 'diary.colorRed' },
  { key: 'orange', color: '#f97316', labelKey: 'diary.colorOrange' },
  { key: 'yellow', color: '#eab308', labelKey: 'diary.colorYellow' },
  { key: 'green', color: '#22c55e', labelKey: 'diary.colorGreen' },
  { key: 'teal', color: '#14b8a6', labelKey: 'diary.colorTeal' },
  { key: 'blue', color: '#3b82f6', labelKey: 'diary.colorBlue' },
  { key: 'purple', color: '#8b5cf6', labelKey: 'diary.colorPurple' },
  { key: 'pink', color: '#ec4899', labelKey: 'diary.colorPink' },
];
```

## 实施策略

### 第一阶段：基础改进（不影响功能）

- 提取魔法数字到constants.ts
- 修复ID生成碰撞
- 修复快照限制Bug
- 优化日期解析
- 清理eslint-disable

### 第二阶段：架构优化

- 拆分DiaryDocWorkspace为子组件
- 合并双重debounce为统一保存队列
- 添加useMemo缓存筛选结果
- 修复内存泄漏

### 第三阶段：功能增强

- 实现多类型条目模板
- 添加颜色标签功能
- 增强状态栏
- 添加打字机模式

### 第四阶段：高级功能

- 卡片视图模式
- 写作会话追踪
- 版本历史完善
- AI上下文升级