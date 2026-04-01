# 草案：故事写作文档规划

## 需求背景
用户希望创建一个专门用于故事写作的文档系统，要求能够方便故事写作。

## 初步理解
- 可能是指类似"写作工作坊"的文档格式
- 需要支持创意写作过程的各个环节
- 可能需要集成到现有的AiDocPlus文档类型系统中

## 已启动的研究
1. **代码库探索**（explore代理）：分析现有的文档类型系统，特别是novel类型的实现模式
2. **最佳实践研究**（librarian代理）：研究故事写作工作坊的最佳实践和模板结构

## 用户反馈
- **核心需求**：情节与结构规划（使用三幕式、英雄之旅等框架来组织情节结构、场景顺序和时间线）
- **集成方式**：作为新文档类型（推荐）实现，创建一个全新的'story-writing'文档类型
- **布局选择**：三栏全布局（类似novel类型），左侧情节大纲，中间编辑区，右侧AI助手
- **故事框架**：经典故事框架（英雄之旅、三幕式、Save the Cat等），提供标准化的故事结构模板
- **使用场景**：个人创作（个人创意写作、小说创作、剧本写作等）
- **UI/UX要求**：高可视化，包含图形化的情节结构图、时间线、角色关系图等
- **测试策略**：仅代理QA（主要依靠AI代理执行QA场景验证，不需要单元测试）
- **沟通偏好**：始终用中文与用户对话（已记录）

## 代码库研究结果
探索代理发现：
1. **文档类型系统模式**：
   - 每个文档类型在独立目录下，包含 definition.ts、Editor组件、AISidebar组件
   - 核心接口：DocTypeDefinition，包含 id、version、labelKey、descriptionKey、EditorComponent等
   - 布局模式：standard（标准布局）和 full（自定义三栏布局）
   - 实现示例：novel（三栏全布局）、study-notes（标准布局+自定义AI侧边栏）、normal（标准布局）
2. **实现步骤**：
   - 创建目录：apps/desktop/src-ui/src/document-types/story-writing/
   - 定义 definition.ts（实现 DocTypeDefinition 接口）
   - 实现 Editor组件（StoryDocWorkspace 或 StoryEditor）
   - 实现 AISidebar组件（StoryAISidebar）
   - 注册到 register.ts（registerBuiltinDocTypes）
   - 添加 i18n 键（labelKey、descriptionKey）
3. **AI 功能模式**：
   - defaultSystemPrompt：针对故事写作的系统提示
   - aiQuickActions：续写、扩写、大纲生成、润色等操作
4. **数据模式**：
   - createEmptyContent：创建初始故事内容模板
   - extractPlainText：提取纯文本用于搜索

## 故事写作最佳实践研究
图书馆员代理发现：
1. **主流方法论**：
   - Save the Cat! 打板 beat sheet：15个故事节拍模板
   - Hero's Journey（英雄之旅）：12阶段叙事框架
   - Story Grid：包含Foolscap、五大支柱、场景分析等工具
   - Character Bible：角色档案模板（外形、性格、动机、关系等）
2. **推荐文档结构**：
   - 封面/概要：标题、Logline、主题、体裁、目标读者
   - 角色档案：主角、反派、配角的详细档案
   - 世界观与设定：地点、规则、时间线、关键道具
   - 情节结构：Beat Sheet 或 Hero's Journey 映射
   - 场景列表：场景目标、冲突、价值转变
   - 人物弧线：外部目标与内部成长对照
   - 研究笔记：参考资料、术语表
   - Workshop活动区：写作练习、教师引导问题
3. **UI/UX建议**：
   - 左侧树状导航（概览/人物/世界观/情节/场景）
   - 右侧工作区（可拆分多列：Beat Sheet、Character Bio、World Rules、Scene List）
4. **参考资源**：
   - Save the Cat Beat Sheets: https://savethecat.com/beat-sheets
   - Story Grid Foolscap: https://storygrid.com/foolscap/
   - Claude Book Bible模板: https://www.claudecodehq.com/playbooks/book-bible

## 清空检查清单
- [x] 核心目标明确：创建专门的故事写作文档类型
- [x] 范围边界：新文档类型、三栏全布局、经典框架、个人创作、高可视化
- [x] 无关键歧义：所有主要需求已明确
- [x] 技术方案：创建新的文档类型，三栏全布局
- [x] 测试策略：仅代理QA（主要依靠AI代理执行QA场景验证，不需要单元测试）
- [x] 无阻塞问题：所有关键问题已回答

## 计划生成触发
所有需求已明确，自动过渡到计划生成阶段。正在等待图书馆员代理的结果（关于故事写作最佳实践），然后开始生成详细的工作计划。

## 当前状态
- [x] 用户访谈完成（核心需求、集成方式、布局、框架、场景、UI/UX、测试策略）
- [x] 代码库研究完成（文档类型系统模式分析）
- [ ] 故事写作最佳实践研究（进行中）
- [ ] 开始生成工作计划

## 下一步
1. 等待图书馆员代理结果
2. 咨询Metis进行差距分析
3. 生成详细工作计划到.sisyphus/plans/story-writing-document.md
4. 进行自我审查并分类差距
5. 向用户展示摘要
6. 询问高精度模式（Momus审查）