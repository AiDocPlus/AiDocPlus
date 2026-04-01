# 故事写作文档类型规划

## TL;DR

> **快速总结**：创建一个专门用于故事写作的新文档类型，集成经典故事框架（Save the Cat、Hero's Journey等），提供高可视化的三栏布局，支持情节结构规划、角色管理、世界观构建等核心功能。
>
> **交付物**：
> - 新的文档类型 `story-writing`
> - 三栏全布局工作区（左侧情节大纲，中间编辑区，右侧AI助手）
> - 集成经典故事框架模板（Save the Cat Beat Sheet、Hero's Journey 12阶段）
> - 高可视化UI组件（情节结构图、时间线、角色关系图）
> - AI辅助功能（续写、扩写、大纲生成、润色）
>
> **预计工作量**：中等
> **并行执行**：是 - 3波
> **关键路径**：Task 1 → Task 5 → Task 8 → Task 11 → Task 15 → Task 21 → F1-F4 → 用户确认

---

## 背景

### 原始请求
用户希望创建一个专门用于故事写作的文档系统，要求能够方便故事写作。

### 访谈摘要
**关键讨论**：
- **核心需求**：情节与结构规划（使用三幕式、英雄之旅等框架来组织情节结构、场景顺序和时间线）
- **集成方式**：作为新文档类型（推荐）实现，创建一个全新的'story-writing'文档类型
- **布局选择**：三栏全布局（类似novel类型），左侧情节大纲，中间编辑区，右侧AI助手
- **故事框架**：经典故事框架（英雄之旅、三幕式、Save the Cat等），提供标准化的故事结构模板
- **使用场景**：个人创作（个人创意写作、小说创作、剧本写作等）
- **UI/UX要求**：高可视化，包含图形化的情节结构图、时间线、角色关系图等
- **测试策略**：仅代理QA（主要依靠AI代理执行QA场景验证，不需要单元测试）

**研究发现**：
- **代码库分析**：文档类型系统模式已明确，需要创建definition.ts、Editor组件、AISidebar组件
- **最佳实践**：Save the Cat的15个beat sheet、Hero's Journey的12阶段、Story Grid的Foolscap等
- **推荐文档结构**：封面/概要、角色档案、世界观与设定、情节结构、场景列表、人物弧线等

### Metis审查
**识别的差距**（已解决）：
- 需要明确具体的可视化组件类型
- 需要确定哪些故事框架需要优先实现
- 需要明确AI功能的具体范围
- 需要确定与现有novel类型的差异点

---

## 工作目标

### 核心目标
创建一个专门用于故事写作的新文档类型，集成经典故事框架，提供高可视化的三栏布局，支持情节结构规划、角色管理、世界观构建等核心功能。

### 具体交付物
1. 新的文档类型 `story-writing`
2. 三栏全布局工作区
3. 集成经典故事框架模板
4. 高可视化UI组件
5. AI辅助功能
6. i18n支持

### 完成定义
- [ ] 所有核心功能实现
- [ ] 所有可视化组件正常工作
- [ ] AI功能集成完成
- [ ] i18n支持完整
- [ ] 代理QA场景通过

### 必须有
- 三栏全布局（左侧情节大纲，中间编辑区，右侧AI助手）
- 集成至少两种经典故事框架（Save the Cat Beat Sheet、Hero's Journey）
- 高可视化UI组件（情节结构图、时间线、角色关系图）
- AI辅助功能（续写、扩写、大纲生成、润色）
- 完整的i18n支持

### 必须没有（护栏）
- 不修改现有的novel文档类型
- 不创建复杂的协作功能（多人编辑、评论等）
- 不实现过于复杂的故事分析算法
- 不创建与现有插件系统冲突的功能

---

## 验证策略

### 测试决策
- **基础设施存在**：是
- **自动化测试**：仅代理QA
- **框架**：无（主要依靠代理执行QA场景）
- **如果TDD**：不适用

### QA策略
每个任务必须包含代理执行的QA场景。证据保存到`.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`。

- **前端/UI**：使用Playwright（playwright技能）- 导航、交互、断言DOM、截图
- **TUI/CLI**：使用interactive_bash（tmux）- 运行命令、发送按键、验证输出
- **API/后端**：使用Bash（curl）- 发送请求、断言状态+响应字段
- **库/模块**：使用Bash（bun/node REPL）- 导入、调用函数、比较输出

---

## 执行策略

### 并行执行波次

> 通过将独立任务分组为并行波次来最大化吞吐量。每波完成后再开始下一波。
> 目标：每波5-8个任务。少于3个任务（最终集成除外）= 分割不足。

```
第1波（立即开始 - 基础 + 脚手架）：
├── 任务1: 项目脚手架 + 配置 [快速]
├── 任务2: 设计系统令牌 [快速]
├── 任务3: 类型定义 [快速]
├── 任务4: 模式定义 [快速]
├── 任务5: 存储接口 + 内存实现 [快速]
├── 任务6: 认证中间件 [快速]
└── 任务7: 客户端模块 [快速]

第2波（第1波完成后 - 核心模块，最大并行）：
├── 任务8: 核心业务逻辑（依赖: 3, 5, 7）[深度]
├── 任务9: API端点（依赖: 4, 5）[未指定-高]
├── 任务10: 次要存储实现（依赖: 5）[未指定-高]
├── 任务11: 重试/回退逻辑（依赖: 8）[深度]
├── 任务12: UI布局 + 导航（依赖: 2）[视觉工程]
├── 任务13: API客户端 + hooks（依赖: 4）[快速]
└── 任务14: 遥测中间件（依赖: 5, 10）[未指定-高]

第3波（第2波完成后 - 集成 + UI）：
├── 任务15: 组合模块的主路由（依赖: 6, 11, 14）[深度]
├── 任务16: UI数据可视化（依赖: 12, 13）[视觉工程]
├── 任务17: 部署配置A（依赖: 15）[快速]
├── 任务18: 部署配置B（依赖: 15）[快速]
├── 任务19: 部署配置C（依赖: 15）[快速]
└── 任务20: UI请求日志 + 构建（依赖: 16）[视觉工程]

最终波（所有任务完成后 - 4个并行审查，然后用户确认）：
├── 任务F1: 计划合规性审计（oracle）
├── 任务F2: 代码质量审查（未指定-高）
├── 任务F3: 真实手动QA（未指定-高）
└── 任务F4: 范围保真度检查（深度）
-> 呈现结果 -> 获得用户明确确认

关键路径：任务1 → 任务5 → 任务8 → 任务11 → 任务15 → 任务21 → F1-F4 → 用户确认
并行加速：比顺序执行快约70%
最大并发：7（第1波和第2波）
```

### 依赖矩阵（缩写 - 在生成的计划中显示所有任务）

- **1-7**: — — 8-14, 1
- **8**: 3, 5, 7 — 11, 15, 2
- **11**: 8 — 15, 2
- **14**: 5, 10 — 15, 2
- **15**: 6, 11, 14 — 17-19, 21, 3
- **21**: 15 — 23, 24, 4

> 这是缩写供参考。您生成的计划必须包含所有任务的完整矩阵。

### 代理调度摘要

- **1**: **7** — T1-T4 → `快速`, T5 → `快速`, T6 → `快速`, T7 → `快速`
- **2**: **7** — T8 → `深度`, T9 → `未指定-高`, T10 → `未指定-高`, T11 → `深度`, T12 → `视觉工程`, T13 → `快速`, T14 → `未指定-高`
- **3**: **6** — T15 → `深度`, T16 → `视觉工程`, T17-T19 → `快速`, T20 → `视觉工程`
- **4**: **4** — T21 → `深度`, T22 → `未指定-高`, T23 → `深度`, T24 → `git`
- **最终**: **4** — F1 → `oracle`, F2 → `未指定-高`, F3 → `未指定-高`, F4 → `深度`

---

## TODOs

> 实现 + 测试 = 一个任务。永远不要分开。
> 每个任务必须有：推荐代理配置 + 并行化信息 + QA场景。
> **没有QA场景的任务是不完整的。没有例外。**

- [ ] 1. 创建故事写作文档类型目录结构

  **要做什么**：
  - 创建目录：`apps/desktop/src-ui/src/document-types/story-writing/`
  - 创建基础文件：`definition.ts`、`types.ts`
  - 创建占位组件文件：`StoryDocWorkspace.tsx`、`StoryAISidebar.tsx`
  - 确保目录结构与现有文档类型一致

  **必须不做**：
  - 不修改现有文档类型的代码
  - 不创建不必要的文件

  **推荐代理配置**：
  - **类别**：`快速`
    - 原因：目录创建和基础文件设置是简单任务
  - **技能**：无特殊技能需求
  - **评估但省略的技能**：无

  **并行化**：
  - **可以并行运行**：是
  - **并行组**：第1波（与任务2, 3, 4一起）
  - **阻塞**：任务5, 8, 12
  - **被阻塞**：无（可以立即开始）

  **参考**：

  **模式参考**（要遵循的现有代码）：
  - `apps/desktop/src-ui/src/document-types/novel/` - 小说文档类型的目录结构
  - `apps/desktop/src-ui/src/document-types/study-notes/` - 学习体会文档类型的目录结构

  **API/类型参考**：
  - `apps/desktop/src-ui/src/doctype-sdk/types.ts` - DocTypeDefinition接口定义

  **测试参考**：
  - 无（代理QA将验证目录结构）

  **外部参考**：
  - 无

  **为什么每个参考都很重要**：
  - `novel/`目录：提供三栏全布局文档类型的结构模式
  - `study-notes/`目录：提供标准布局文档类型的结构模式
  - `types.ts`：确保新文档类型符合接口规范

  **验收标准**：

  **QA场景（必须 - 任务没有这些场景就不完整）**：

  ```
  场景：创建目录结构
    工具：Bash（ls）
    前置条件：无
    步骤：
      1. 运行 `ls apps/desktop/src-ui/src/document-types/story-writing/`
      2. 验证目录存在
      3. 运行 `ls apps/desktop/src-ui/src/document-types/story-writing/definition.ts`
      4. 验证definition.ts文件存在
    预期结果：目录和文件都存在
    失败指标：目录或文件不存在
    证据：.sisyphus/evidence/task-1-directory-structure.txt

  场景：验证目录结构一致性
    工具：Bash（ls）
    前置条件：任务1完成
    步骤：
      1. 运行 `ls apps/desktop/src-ui/src/document-types/novel/`
      2. 运行 `ls apps/desktop/src-ui/src/document-types/story-writing/`
      3. 比较两个目录的结构模式
    预期结果：story-writing目录结构与novel目录结构一致
    失败指标：目录结构不一致
    证据：.sisyphus/evidence/task-1-structure-comparison.txt
  ```

  **要捕获的证据**：
  - [ ] 每个证据文件命名：task-{N}-{scenario-slug}.{ext}
  - [ ] 目录列表输出用于验证

  **提交**：是 | 与第1波分组
  - 消息：`feat(story-writing): 创建文档类型目录结构`
  - 文件：`apps/desktop/src-ui/src/document-types/story-writing/`
  - 预提交：无

- [ ] 2. 定义故事写作文档类型接口

  **要做什么**：
  - 在`definition.ts`中实现`DocTypeDefinition`接口
  - 定义基本属性：`id`、`version`、`labelKey`、`descriptionKey`、`icon`
  - 设置`layoutMode`为`'full'`（三栏全布局）
  - 定义`EditorComponent`和`AISidebarComponent`的懒加载导入
  - 创建`createEmptyContent`函数生成初始内容
  - 创建`extractPlainText`函数提取纯文本

  **必须不做**：
  - 不实现具体的编辑器组件（那是后续任务）
  - 不实现具体的AI侧边栏组件

  **推荐代理配置**：
  - **类别**：`快速`
    - 原因：接口定义是简单的TypeScript代码编写
  - **技能**：无特殊技能需求
  - **评估但省略的技能**：无

  **并行化**：
  - **可以并行运行**：是
  - **并行组**：第1波（与任务1, 3, 4一起）
  - **阻塞**：任务5, 8
  - **被阻塞**：无（可以立即开始）

  **参考**：

  **模式参考**（要遵循的现有代码）：
  - `apps/desktop/src-ui/src/document-types/novel/definition.ts` - 小说文档类型定义示例
  - `apps/desktop/src-ui/src/document-types/study-notes/definition.ts` - 学习体会文档类型定义示例

  **API/类型参考**：
  - `apps/desktop/src-ui/src/doctype-sdk/types.ts` - DocTypeDefinition接口

  **测试参考**：
  - 无（代理QA将验证接口实现）

  **外部参考**：
  - 无

  **为什么每个参考都很重要**：
  - `novel/definition.ts`：提供三栏全布局的定义模式
  - `study-notes/definition.ts`：提供标准布局的定义模式
  - `types.ts`：确保接口实现正确

  **验收标准**：

  **QA场景（必须 - 任务没有这些场景就不完整）**：

  ```
  场景：验证接口实现
    工具：Bash（tsc）
    前置条件：任务2完成
    步骤：
      1. 运行 `cd apps/desktop/src-ui && npx tsc --noEmit`
      2. 检查story-writing/definition.ts是否有类型错误
    预期结果：没有类型错误
    失败指标：有TypeScript类型错误
    证据：.sisyphus/evidence/task-2-type-check.txt

  场景：验证基本属性
    工具：Bash（cat）
    前置条件：任务2完成
    步骤：
      1. 读取 `apps/desktop/src-ui/src/document-types/story-writing/definition.ts`
      2. 验证包含`id: 'story-writing'`
      3. 验证包含`version: '1.0.0'`
      4. 验证包含`labelKey: 'docType.storyWriting'`
      5. 验证包含`layoutMode: 'full'`
    预期结果：所有基本属性都存在
    失败指标：缺少任何基本属性
    证据：.sisyphus/evidence/task-2-basic-props.txt
  ```

  **要捕获的证据**：
  - [ ] 每个证据文件命名：task-{N}-{scenario-slug}.{ext}
  - [ ] TypeScript编译输出用于验证

  **提交**：是 | 与第1波分组
  - 消息：`feat(story-writing): 定义文档类型接口`
  - 文件：`apps/desktop/src-ui/src/document-types/story-writing/definition.ts`
  - 预提交：`cd apps/desktop/src-ui && npx tsc --noEmit`

- [ ] 3. 创建故事写作类型定义

  **要做什么**：
  - 在`types.ts`中定义故事写作的领域类型
  - 定义`StoryWritingData`接口（故事数据结构）
  - 定义`Character`接口（角色档案）
  - 定义`PlotStructure`接口（情节结构）
  - 定义`WorldBuilding`接口（世界观设定）
  - 定义`Scene`接口（场景列表）

  **必须不做**：
  - 不创建过于复杂的类型定义（避免过度设计）
  - 不实现具体的UI组件

  **推荐代理配置**：
  - **类别**：`快速`
    - 原因：类型定义是简单的TypeScript接口编写
  - **技能**：无特殊技能需求
  - **评估但省略的技能**：无

  **并行化**：
  - **可以并行运行**：是
  - **并行组**：第1波（与任务1, 2, 4一起）
  - **阻塞**：任务5, 8
  - **被阻塞**：无（可以立即开始）

  **参考**：

  **模式参考**（要遵循的现有代码）：
  - `apps/desktop/src-ui/src/document-types/novel/types.ts` - 小说文档类型的类型定义
  - `packages/shared-types/src/index.ts` - 共享类型定义模式

  **API/类型参考**：
  - 无特定API参考

  **测试参考**：
  - 无（代理QA将验证类型定义）

  **外部参考**：
  - Save the Cat Beat Sheet结构：15个节拍模板
  - Hero's Journey 12阶段结构

  **为什么每个参考都很重要**：
  - `novel/types.ts`：提供故事相关类型的模式
  - `shared-types/src/index.ts`：提供类型定义的最佳实践
  - Save the Cat和Hero's Journey：确保类型定义支持经典故事框架

  **验收标准**：

  **QA场景（必须 - 任务没有这些场景就不完整）**：

  ```
  场景：验证类型定义
    工具：Bash（tsc）
    前置条件：任务3完成
    步骤：
      1. 运行 `cd apps/desktop/src-ui && npx tsc --noEmit`
      2. 检查story-writing/types.ts是否有类型错误
    预期结果：没有类型错误
    失败指标：有TypeScript类型错误
    证据：.sisyphus/evidence/task-3-type-check.txt

  场景：验证核心类型
    工具：Bash（cat）
    前置条件：任务3完成
    步骤：
      1. 读取 `apps/desktop/src-ui/src/document-types/story-writing/types.ts`
      2. 验证包含`StoryWritingData`接口
      3. 验证包含`Character`接口
      4. 验证包含`PlotStructure`接口
      5. 验证包含支持Save the Cat Beat Sheet的字段
      6. 验证包含支持Hero's Journey的字段
    预期结果：所有核心类型都存在
    失败指标：缺少任何核心类型
    证据：.sisyphus/evidence/task-3-core-types.txt
  ```

  **要捕获的证据**：
  - [ ] 每个证据文件命名：task-{N}-{scenario-slug}.{ext}
  - [ ] TypeScript编译输出用于验证

  **提交**：是 | 与第1波分组
  - 消息：`feat(story-writing): 创建故事写作类型定义`
  - 文件：`apps/desktop/src-ui/src/document-types/story-writing/types.ts`
  - 预提交：`cd apps/desktop/src-ui && npx tsc --noEmit`

- [ ] 4. 创建故事写作模式定义

  **要做什么**：
  - 在`types.ts`中定义故事写作的数据模式
  - 定义Save the Cat Beat Sheet的15个节拍
  - 定义Hero's Journey的12个阶段
  - 定义角色档案的数据结构
  - 定义世界观设定的数据结构
  - 定义场景列表的数据结构

  **必须不做**：
  - 不创建过于复杂的验证逻辑
  - 不实现具体的UI渲染

  **推荐代理配置**：
  - **类别**：`快速`
    - 原因：模式定义是简单的数据结构定义
  - **技能**：无特殊技能需求
  - **评估但省略的技能**：无

  **并行化**：
  - **可以并行运行**：是
  - **并行组**：第1波（与任务1, 2, 3一起）
  - **阻塞**：任务5, 8
  - **被阻塞**：无（可以立即开始）

  **参考**：

  **模式参考**（要遵循的现有代码）：
  - `apps/desktop/src-ui/src/document-types/novel/types.ts` - 小说文档类型的模式定义
  - `packages/shared-types/src/index.ts` - 共享类型模式

  **API/类型参考**：
  - 无特定API参考

  **测试参考**：
  - 无（代理QA将验证模式定义）

  **外部参考**：
  - Save the Cat Beat Sheet：15个节拍模板
  - Hero's Journey：12阶段结构
  - Story Grid Foolscap：一页计划模板

  **为什么每个参考都很重要**：
  - `novel/types.ts`：提供故事模式的定义模式
  - `shared-types/src/index.ts`：提供模式定义的最佳实践
  - Save the Cat、Hero's Journey、Story Grid：确保模式支持经典故事框架

  **验收标准**：

  **QA场景（必须 - 任务没有这些场景就不完整）**：

  ```
  场景：验证模式定义
    工具：Bash（tsc）
    前置条件：任务4完成
    步骤：
      1. 运行 `cd apps/desktop/src-ui && npx tsc --noEmit`
      2. 检查story-writing/types.ts是否有类型错误
    预期结果：没有类型错误
    失败指标：有TypeScript类型错误
    证据：.sisyphus/evidence/task-4-type-check.txt

  场景：验证故事框架模式
    工具：Bash（cat）
    前置条件：任务4完成
    步骤：
      1. 读取 `apps/desktop/src-ui/src/document-types/story-writing/types.ts`
      2. 验证包含Save the Cat Beat Sheet的15个节拍定义
      3. 验证包含Hero's Journey的12个阶段定义
      4. 验证包含角色档案的数据结构
      5. 验证包含世界观设定的数据结构
    预期结果：所有故事框架模式都存在
    失败指标：缺少任何故事框架模式
    证据：.sisyphus/evidence/task-4-framework-schemas.txt
  ```

  **要捕获的证据**：
  - [ ] 每个证据文件命名：task-{N}-{scenario-slug}.{ext}
  - [ ] TypeScript编译输出用于验证

  **提交**：是 | 与第1波分组
  - 消息：`feat(story-writing): 创建故事写作模式定义`
  - 文件：`apps/desktop/src-ui/src/document-types/story-writing/types.ts`
  - 预提交：`cd apps/desktop/src-ui && npx tsc --noEmit`

- [ ] 5. 实现故事写作存储接口

  **要做什么**：
  - 实现`StoryWritingStorage`接口
  - 创建内存存储实现`InMemoryStoryWritingStorage`
  - 实现故事数据的保存、加载、更新、删除操作
  - 实现角色档案的CRUD操作
  - 实现情节结构的CRUD操作
  - 实现世界观设定的CRUD操作

  **必须不做**：
  - 不实现持久化存储（那是后续任务）
  - 不创建复杂的查询功能

  **推荐代理配置**：
  - **类别**：`快速`
    - 原因：存储接口是简单的TypeScript接口实现
  - **技能**：无特殊技能需求
  - **评估但省略的技能**：无

  **并行化**：
  - **可以并行运行**：是
  - **并行组**：第1波（与任务1, 2, 3, 4一起）
  - **阻塞**：任务8, 10, 14
  - **被阻塞**：任务3, 4（需要类型定义）

  **参考**：

  **模式参考**（要遵循的现有代码）：
  - `apps/desktop/src-ui/src/stores/useAppStore.ts` - Zustand存储模式
  - `apps/desktop/src-ui/src/stores/useCodingStore.ts` - 编程区存储模式

  **API/类型参考**：
  - `apps/desktop/src-ui/src/document-types/story-writing/types.ts` - 故事写作类型定义

  **测试参考**：
  - 无（代理QA将验证存储接口）

  **外部参考**：
  - 无

  **为什么每个参考都很重要**：
  - `useAppStore.ts`：提供Zustand存储模式
  - `useCodingStore.ts`：提供复杂状态管理的模式
  - `types.ts`：确保存储接口符合类型定义

  **验收标准**：

  **QA场景（必须 - 任务没有这些场景就不完整）**：

  ```
  场景：验证存储接口
    工具：Bash（tsc）
    前置条件：任务5完成
    步骤：
      1. 运行 `cd apps/desktop/src-ui && npx tsc --noEmit`
      2. 检查存储接口是否有类型错误
    预期结果：没有类型错误
    失败指标：有TypeScript类型错误
    证据：.sisyphus/evidence/task-5-type-check.txt

  场景：验证存储操作
    工具：Bash（node）
    前置条件：任务5完成
    步骤：
      1. 创建测试脚本导入存储接口
      2. 测试保存故事数据
      3. 测试加载故事数据
      4. 测试更新角色档案
      5. 测试删除情节结构
    预期结果：所有存储操作都能正常工作
    失败指标：任何存储操作失败
    证据：.sisyphus/evidence/task-5-storage-operations.txt
  ```

  **要捕获的证据**：
  - [ ] 每个证据文件命名：task-{N}-{scenario-slug}.{ext}
  - [ ] TypeScript编译输出用于验证
  - [ ] Node.js测试脚本输出用于验证

  **提交**：是 | 与第1波分组
  - 消息：`feat(story-writing): 实现存储接口`
  - 文件：`apps/desktop/src-ui/src/document-types/story-writing/storage.ts`
  - 预提交：`cd apps/desktop/src-ui && npx tsc --noEmit`

- [ ] 6. 创建故事写作AI提示词模板

  **要做什么**：
  - 创建故事写作的AI提示词模板
  - 定义`defaultSystemPrompt`（故事写作系统提示）
  - 定义`aiQuickActions`（续写、扩写、大纲生成、润色等）
  - 创建Save the Cat Beat Sheet的专用提示词
  - 创建Hero's Journey的专用提示词
  - 创建角色发展的专用提示词

  **必须不做**：
  - 不创建过于复杂的提示词逻辑
  - 不实现具体的AI调用功能

  **推荐代理配置**：
  - **类别**：`快速`
    - 原因：提示词模板是简单的文本定义
  - **技能**：无特殊技能需求
  - **评估但省略的技能**：无

  **并行化**：
  - **可以并行运行**：是
  - **并行组**：第1波（与任务1, 2, 3, 4, 5一起）
  - **阻塞**：任务9, 11
  - **被阻塞**：任务3（需要类型定义）

  **参考**：

  **模式参考**（要遵循的现有代码）：
  - `apps/desktop/src-ui/src/document-types/novel/definition.ts` - 小说文档类型的AI提示词
  - `apps/desktop/src-ui/src/document-types/study-notes/definition.ts` - 学习体会文档类型的AI提示词

  **API/类型参考**：
  - 无特定API参考

  **测试参考**：
  - 无（代理QA将验证提示词模板）

  **外部参考**：
  - Save the Cat Beat Sheet：15个节拍模板
  - Hero's Journey：12阶段结构
  - 故事写作最佳实践

  **为什么每个参考都很重要**：
  - `novel/definition.ts`：提供故事写作AI提示词的模式
  - `study-notes/definition.ts`：提供学习类AI提示词的模式
  - Save the Cat、Hero's Journey：确保提示词支持经典故事框架

  **验收标准**：

  **QA场景（必须 - 任务没有这些场景就不完整）**：

  ```
  场景：验证提示词模板
    工具：Bash（cat）
    前置条件：任务6完成
    步骤：
      1. 读取 `apps/desktop/src-ui/src/document-types/story-writing/prompts.ts`
      2. 验证包含`defaultSystemPrompt`
      3. 验证包含`aiQuickActions`数组
      4. 验证包含Save the Cat Beat Sheet的专用提示词
      5. 验证包含Hero's Journey的专用提示词
    预期结果：所有提示词模板都存在
    失败指标：缺少任何提示词模板
    证据：.sisyphus/evidence/task-6-prompt-templates.txt

  场景：验证提示词内容
    工具：Bash（grep）
    前置条件：任务6完成
    步骤：
      1. 搜索提示词中是否包含"Save the Cat"相关关键词
      2. 搜索提示词中是否包含"Hero's Journey"相关关键词
      3. 搜索提示词中是否包含"角色发展"相关关键词
    预期结果：提示词包含相关关键词
    失败指标：提示词不包含相关关键词
    证据：.sisyphus/evidence/task-6-prompt-content.txt
  ```

  **要捕获的证据**：
  - [ ] 每个证据文件命名：task-{N}-{scenario-slug}.{ext}
  - [ ] 文件内容输出用于验证

  **提交**：是 | 与第1波分组
  - 消息：`feat(story-writing): 创建AI提示词模板`
  - 文件：`apps/desktop/src-ui/src/document-types/story-writing/prompts.ts`
  - 预提交：无

- [ ] 7. 创建故事写作i18n翻译

  **要做什么**：
  - 在中文翻译文件中添加故事写作的翻译键
  - 在英文翻译文件中添加故事写作的翻译键
  - 添加`docType.storyWriting`和`docType.storyWritingDesc`翻译
  - 添加故事写作UI组件的翻译
  - 添加故事框架术语的翻译
  - 添加AI提示词的翻译

  **必须不做**：
  - 不修改现有的翻译键
  - 不创建不必要的翻译

  **推荐代理配置**：
  - **类别**：`快速`
    - 原因：翻译添加是简单的文件编辑
  - **技能**：无特殊技能需求
  - **评估但省略的技能**：无

  **并行化**：
  - **可以并行运行**：是
  - **并行组**：第1波（与任务1, 2, 3, 4, 5, 6一起）
  - **阻塞**：任务12, 16
  - **被阻塞**：任务2（需要labelKey, descriptionKey）

  **参考**：

  **模式参考**（要遵循的现有代码）：
  - `apps/desktop/src-ui/src/i18n/locales/zh/translation.json` - 中文翻译文件
  - `apps/desktop/src-ui/src/i18n/locales/en/translation.json` - 英文翻译文件

  **API/类型参考**：
  - 无特定API参考

  **测试参考**：
  - 无（代理QA将验证翻译文件）

  **外部参考**：
  - Save the Cat Beat Sheet术语
  - Hero's Journey术语
  - 故事写作术语

  **为什么每个参考都很重要**：
  - `zh/translation.json`：提供中文翻译的模式
  - `en/translation.json`：提供英文翻译的模式
  - 故事写作术语：确保翻译准确专业

  **验收标准**：

  **QA场景（必须 - 任务没有这些场景就不完整）**：

  ```
  场景：验证翻译文件
    工具：Bash（cat）
    前置条件：任务7完成
    步骤：
      1. 读取 `apps/desktop/src-ui/src/i18n/locales/zh/translation.json`
      2. 验证包含`docType.storyWriting`翻译
      3. 验证包含`docType.storyWritingDesc`翻译
      4. 读取 `apps/desktop/src-ui/src/i18n/locales/en/translation.json`
      5. 验证包含对应的英文翻译
    预期结果：中英文翻译都存在
    失败指标：缺少任何翻译
    证据：.sisyphus/evidence/task-7-translations.txt

  场景：验证故事框架术语翻译
    工具：Bash（grep）
    前置条件：任务7完成
    步骤：
      1. 搜索中文翻译中是否包含"Save the Cat"相关术语
      2. 搜索中文翻译中是否包含"英雄之旅"相关术语
      3. 搜索英文翻译中是否包含"Save the Cat"相关术语
      4. 搜索英文翻译中是否包含"Hero's Journey"相关术语
    预期结果：翻译包含相关术语
    失败指标：翻译不包含相关术语
    证据：.sisyphus/evidence/task-7-framework-terms.txt
  ```

  **要捕获的证据**：
  - [ ] 每个证据文件命名：task-{N}-{scenario-slug}.{ext}
  - [ ] 文件内容输出用于验证

  **提交**：是 | 与第1波分组
  - 消息：`feat(story-writing): 添加i18n翻译`
  - 文件：`apps/desktop/src-ui/src/i18n/locales/{zh,en}/translation.json`
  - 预提交：无

---

## 最终验证波（所有实现任务完成后 - 4个并行审查）

> 4个审查代理并行运行。必须全部批准。向用户呈现综合结果并获得明确"确认"才能完成。
>
> **在获得用户明确批准前不要自动继续。在获得用户确认前不要将F1-F4标记为已检查。** 如果被拒绝或有用户反馈 -> 修复 -> 重新运行 -> 再次呈现 -> 等待确认。

- [ ] F1. **计划合规性审计** — `oracle`
  逐段阅读计划。对于每个"必须有"：验证实现是否存在（读取文件、curl端点、运行命令）。对于每个"必须没有"：在代码库中搜索禁止模式 - 如果找到，拒绝并提供file:line。检查.sisyphus/evidence/中的证据文件是否存在。将交付物与计划进行比较。
  输出：`必须有 [N/N] | 必须没有 [N/N] | 任务 [N/N] | 判决: 批准/拒绝`

- [ ] F2. **代码质量审查** — `未指定-高`
  运行 `tsc --noEmit` + linter + `bun test`。审查所有更改的文件：`as any`/`@ts-ignore`、空catch、生产代码中的console.log、注释掉的代码、未使用的导入。检查AI问题：过度注释、过度抽象、通用名称（data/result/item/temp）。
  输出：`构建 [通过/失败] | Lint [通过/失败] | 测试 [N通过/N失败] | 文件 [N清洁/N问题] | 判决`

- [ ] F3. **真实手动QA** — `未指定-高`（+ `playwright`技能如果有UI）
  从干净状态开始。执行每个任务的每个QA场景 - 遵循确切步骤，捕获证据。测试跨任务集成（功能协同工作，而非隔离）。测试边缘情况：空状态、无效输入、快速操作。保存到`.sisyphus/evidence/final-qa/`。
  输出：`场景 [N/N通过] | 集成 [N/N] | 边缘情况 [N测试] | 判决`

- [ ] F4. **范围保真度检查** — `深度`
  对于每个任务：读取"要做什么"，读取实际差异（git log/diff）。验证1:1 - 规范中的所有内容都已构建（无遗漏），没有构建超出规范的内容（无蔓延）。检查"必须没有"合规性。检测跨任务污染：任务N触及任务M的文件。标记未解释的更改。
  输出：`任务 [N/N合规] | 污染 [清洁/N问题] | 未解释 [清洁/N文件] | 判决`

---

## 提交策略

- **1**: `type(scope): desc` — file.ts, npm test

---

## 成功标准

### 验证命令
```bash
command  # 预期：输出
```

### 最终清单
- [ ] 所有"必须有"都存在
- [ ] 所有"必须没有"都不存在
- [ ] 所有测试通过