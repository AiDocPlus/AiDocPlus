/**
 * 大纲文档 AI 提示词
 * 
 * 专业级大纲写作助手的系统提示词
 */

/**
 * AI 系统基础提示词
 */
export const OUTLINE_AI_SYSTEM_BASE = `你是专业的大纲写作助手，擅长结构化思维和层级化表达。

## 核心能力
1. **结构化分解**：将复杂主题分解为逻辑清晰的层级结构
2. **内容扩展**：基于简要描述生成详细的子要点
3. **润色优化**：改进语言表达，保持结构清晰
4. **格式规范**：使用标准大纲格式（缩进列表或 Markdown 标题）

## 输入格式
用户会提供：
- 当前大纲的 Markdown/文本表示（包含层级关系）
- 当前节点的上下文路径
- 用户请求（展开/润色/总结/生成全文）

## 输出格式

### 展开节点
输出该节点的 3-7 个子要点，每行一个，使用适当的缩进：
- 子要点 1
- 子要点 2
  - 详细说明 1
  - 详细说明 2
- 子要点 3

### 生成全文
从一级标题开始，构建完整的大纲结构：
# 主题标题
## 一级分支
### 二级分支
- 具体要点
- 具体要点

### 润色内容
保持原有层级结构，改进语言表达：
- 使用更准确的词汇
- 增强逻辑连贯性
- 保持简洁清晰

### 总结大纲
提取核心要点，输出 3-5 个关键点：
1. 核心要点 1
2. 核心要点 2
...

## 注意事项
- 使用中文输出
- 保持专业简洁的风格
- 确保层级逻辑清晰
- 避免过度展开（控制在合理范围）`;

/**
 * 展开节点的提示词模板
 */
export const EXPAND_NODE_PROMPT = `请为以下节点展开 {{count}} 个详细的子要点：

## 当前节点
内容：{{nodeText}}
层级：{{depth}}
父节点路径：{{parentPath}}

## 同级节点（供参考）
{{siblings}}

## 要求
1. 输出子节点列表（每行一个，使用 - 开头）
2. 如果子要点需要进一步细分，使用适当缩进（2空格）
3. 内容要与主题相关且具体
4. 保持逻辑连贯性

请直接输出子要点列表：
- `;

/**
 * 生成全文大纲的提示词模板
 */
export const GENERATE_FULL_PROMPT = `请为以下主题生成一个完整、详细的大纲结构：

## 主题
{{title}}

## 已有内容（如有）
{{existingContent}}

## 要求
1. 使用 Markdown 格式
2. 包含 2-3 层级的结构
3. 每个主题下有 3-5 个要点
4. 内容专业、逻辑清晰
5. 使用中文输出

请生成完整的大纲：
# {{title}}
`;

/**
 * 润色大纲的提示词模板
 */
export const POLISH_OUTLINE_PROMPT = `请润色以下大纲内容，改进语言表达和结构逻辑：

## 当前大纲
{{outlineContent}}

## 要求
1. 保持原有层级结构不变
2. 改进词汇选择，使用更准确、专业的表达
3. 增强句子之间的逻辑连贯性
4. 删除冗余内容，保持简洁
5. 确保整体逻辑清晰易懂

请输出润色后的大纲（保持相同格式）：
`;

/**
 * 总结大纲的提示词模板
 */
export const SUMMARIZE_OUTLINE_PROMPT = `请总结以下大纲的核心要点：

## 大纲内容
{{outlineContent}}

## 要求
1. 提取 3-5 个核心要点
2. 每个要点简洁明了（不超过20字）
3. 按重要性排序
4. 突出关键信息和结论

请输出总结：
1. 
`;

/**
 * 续写大纲的提示词模板
 */
export const CONTINUE_OUTLINE_PROMPT = `请根据以下大纲的现有内容，续写添加相关内容：

## 当前大纲
{{outlineContent}}

## 最后一个节点
{{lastNode}}

## 要求
1. 分析现有内容的逻辑和主题
2. 续写内容要与前文保持一致性
3. 添加 2-4 个新节点作为延续
4. 可以添加新的分支或深化现有分支

请输出续写内容：
`;

/**
 * AI 快速操作配置
 */
export const AI_QUICK_ACTIONS = [
  {
    id: 'expand',
    labelKey: 'outline.ai.expand',
    descriptionKey: 'outline.ai.expandDesc',
    icon: 'Sparkles',
    defaultCount: 5,
  },
  {
    id: 'generate',
    labelKey: 'outline.ai.generate',
    descriptionKey: 'outline.ai.generateDesc',
    icon: 'FileText',
  },
  {
    id: 'polish',
    labelKey: 'outline.ai.polish',
    descriptionKey: 'outline.ai.polishDesc',
    icon: 'Wand2',
  },
  {
    id: 'continue',
    labelKey: 'outline.ai.continue',
    descriptionKey: 'outline.ai.continueDesc',
    icon: 'PlusCircle',
  },
  {
    id: 'summarize',
    labelKey: 'outline.ai.summarize',
    descriptionKey: 'outline.ai.summarizeDesc',
    icon: 'WrapText',
  },
] as const;

export type AIQuickActionId = (typeof AI_QUICK_ACTIONS)[number]['id'];
